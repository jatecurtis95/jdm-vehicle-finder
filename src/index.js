// JDM Vehicle Finder - Cloudflare Worker entry point.
//
// scheduled(): runs the matcher on the cron schedule, queues new matches,
//   emails you a digest with approve/skip links.
// fetch(): serves the admin UI, the manual "run now" trigger, the form posts,
//   and the approve/skip decision links from the digest.

import { runAll, sendWelcomeMatch } from "./matcher.js";
import { digestHtml, agentInviteHtml, requestAlertHtml, requestConfirmationHtml, clientPortalInviteHtml, clientRequestAlertHtml, dealerInviteHtml, passwordResetHtml } from "./render.js";
import { sendEmail, deliverToClient, deliverManyToClient, sendPush, paymentChime } from "./notify.js";
import { adminPage, requestPage, loginPage, mfaPage, setPasswordPage, forgotPasswordPage, createClient, updateClient, createWishlist, createRequest, createAdminRequest, deleteClient, deleteWishlist, toggleWishlist, createAgent, deleteAgent, toggleAgent, resendInvite, toggleAgentAlerts, clientAccessibleBy, shareClient, unshareClient, assignClient, bulkAllocate, editWishlist, clientDetailPage, clientDrawerFragment, matchesChunk, logContactTap, updateRequestStatus, requestDetailPage, addRequestNote, assignRequestOwner, setNextAction, createTask, toggleTask, deleteTask, recordMatchSent, stampMatchViewed, setMatchResponse, snoozeMatch, archiveClient, lotDetailPage, publicLotPage, auctionLotPage, expirePast, portalPage, portalAuctionsPage, requestAuctionLot, addLotToClient, addLotsToClient, autoFollowUps, setClientMember, portalAddWishlist, portalEditWishlist, portalToggleWishlist, portalDeleteWishlist, portalApprove, inviteClientPortal, revokeClientPortal, phoneKey, upsertGoogleClient, createDealer, resendDealerInvite, toggleDealer, deleteDealer, submitDealerVehicle, approveDealerVehicle, rejectDealerVehicle, getDealerVehicles, dealerPortalPage, updateShareDetails, setShareRevoked, regenerateShareLink } from "./admin.js";
import { getSession, authenticate, sessionCookie, clearCookie, agentByInviteToken, setAgentPassword, clientByInviteToken, setClientPassword, dealerByInviteToken, setDealerPassword, verifyShareLink, beginPasswordReset, beginPasswordResetFor, EMAIL_MAX, adminMfaEnabled, verifyAdminTotp, mfaPendingCookie, clearMfaCookie, readMfaPending } from "./auth.js";
import { googleConfigured, beginGoogle, completeGoogle, clearNonceCookie } from "./oauth.js";
import { getSettings, settingOn, settingNum, digestRecipient, saveSettings } from "./settings.js";
import { sendWhatsApp } from "./whatsapp.js";
import { readAuctionSheet, sweepUnreadSheets, fixAllPhotos } from "./sheet.js";
import { distinctMakers, distinctModels, distinctModelCodes, distinctGrades, refreshLotImages } from "./avtonet.js";
import { labelForCode } from "./model-codes.js";
import { marketSnapshot } from "./market.js";
import { logoPngBytes } from "./assets.js";
import { createCheckoutSession, createSubscriptionCheckout, createBillingPortalSession, verifyAndParseEvent, applyStripeEvent, stripeConfigured } from "./stripe.js";
import { notFoundPage, infoPage, decisionConfirmPage, privacyPage, termsPage, PUBLIC_ORIGIN } from "./theme.js";
import { landingPage, findsPage } from "./landing.js";
import { auctionHistoryPage, dealerHistoryPage } from "./auction-history.js";

const REQ_RL_IP = 8;       // public request submissions per IP per hour
const REQ_RL_CONTACT = 6;  // public request submissions per email/phone per hour

// Single public address. The other custom domains 301 here so the site can never
// look like two different websites. The *.workers.dev URL is intentionally left
// out so it stays a working direct fallback if a custom domain has DNS trouble.
const CANONICAL_HOST = "jdmfinder.com.au";
const REDIRECT_HOSTS = new Set(["finder.jdmconnect.com.au", "www.jdmfinder.com.au"]);

// --- CSRF: same-origin check for cookie-authenticated mutations --------------
// The staff app, buyer portal and dealer portal all authenticate with a session
// cookie, so a cross-site page could otherwise auto-submit a form that rides
// that cookie (CSRF). Every state-changing request from a signed-in session must
// therefore originate from one of our own pages. Browsers always attach an
// Origin header to non-GET requests (and a Referer on normal form posts), so a
// missing or foreign Origin/Referer on an authenticated mutation is refused.
// Token-gated public routes (/decide, /set-password) and the Stripe webhook sit
// ABOVE the session gate and are verified by their own token/signature, so they
// never reach this check. Read-only GET/HEAD is always allowed.
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
function isSameOriginRequest(request, url) {
  const allowed = new Set([url.host, CANONICAL_HOST, ...REDIRECT_HOSTS]);
  const hostOf = (v) => { try { return new URL(v).host; } catch (_) { return null; } };
  const origin = request.headers.get("Origin");
  if (origin) return allowed.has(hostOf(origin));   // Origin present → must be ours
  const referer = request.headers.get("Referer");
  if (referer) return allowed.has(hostOf(referer)); // fall back to Referer host
  return false;                                     // neither header → refuse
}

// Best-effort sliding-window limiter for the public request form. Limits per IP
// AND per contact (email / normalized phone) so IP rotation can't flood one
// client's searches. Fails open (no KV, or KV errors -> allowed) and only
// increments a key when the submission is being allowed.
export async function requestRateLimited(env, { ip, email, whatsapp }) {
  if (!env.RL) return false;
  const keys = [];
  if (ip) keys.push({ k: `reqrl:ip:${ip}`, cap: REQ_RL_IP });
  const e = String(email || "").trim().toLowerCase();
  if (e) keys.push({ k: `reqrl:e:${e}`, cap: REQ_RL_CONTACT });
  const pk = phoneKey(whatsapp);
  if (pk.length >= 8) keys.push({ k: `reqrl:p:${pk}`, cap: REQ_RL_CONTACT });
  const seen = [];
  for (const { k, cap } of keys) {
    try {
      const n = parseInt((await env.RL.get(k)) || "0", 10);
      if (n >= cap) return true;
      seen.push({ k, n });
    } catch (_) { /* fail open for this key */ }
  }
  for (const { k, n } of seen) {
    try { await env.RL.put(k, String(n + 1), { expirationTtl: 3600 }); } catch (_) { /* best effort */ }
  }
  return false;
}

// Sliding-window limiter for the public /api/* JSON endpoints (per IP).
// Same fail-open KV pattern as the request-form limiter above.
const API_RL_MAX = 60;          // calls
const API_RL_WINDOW_S = 300;    // per 5 minutes
async function apiRateLimited(env, ip) {
  if (!env.RL || !ip) return false;
  const k = `apirl:ip:${ip}`;
  try {
    const n = parseInt((await env.RL.get(k)) || "0", 10);
    if (n >= API_RL_MAX) return true;
    await env.RL.put(k, String(n + 1), { expirationTtl: API_RL_WINDOW_S });
  } catch (_) { /* fail open */ }
  return false;
}

// --- Login brute-force protection (KV-backed) --------------------------------
// Tracks failed sign-ins per IP and per email. After the key's cap within the
// window the source is locked out, and every failed attempt also costs a fixed
// delay so automated guessing is slow. Fails open if KV is unavailable.
//
// Two extra fixed dimensions an attacker cannot rotate away from:
//  * loginfail:admin  - a blank email targets the admin account (that IS the
//    admin login shape), so those attempts always count here too. Rotating IPs
//    no longer buys fresh unthrottled guesses at ADMIN_PASSWORD.
//  * loginfail:global - every failure from any source. Generous cap that only
//    a distributed attack would hit; makes email+IP rotation ineffective.
const LOGIN_MAX_FAILS = 10;
const LOGIN_ADMIN_MAX_FAILS = 10;
const LOGIN_GLOBAL_MAX_FAILS = 50;
const LOGIN_LOCK_SECONDS = 15 * 60;
const LOGIN_FAIL_DELAY_MS = 1500;
const LOGIN_GLOBAL_KEY = "loginfail:global";
function loginFailKeys(ip, email) {
  const keys = [];
  if (ip) keys.push({ k: `loginfail:ip:${ip}`, cap: LOGIN_MAX_FAILS });
  const e = String(email || "").trim().toLowerCase();
  if (e) keys.push({ k: `loginfail:e:${e}`, cap: LOGIN_MAX_FAILS });
  else keys.push({ k: "loginfail:admin", cap: LOGIN_ADMIN_MAX_FAILS });
  keys.push({ k: LOGIN_GLOBAL_KEY, cap: LOGIN_GLOBAL_MAX_FAILS });
  return keys;
}
async function loginLocked(env, ip, email) {
  if (!env.RL) return false;
  for (const { k, cap } of loginFailKeys(ip, email)) {
    try {
      const n = parseInt((await env.RL.get(k)) || "0", 10);
      if (n >= cap) return true;
    } catch (_) { /* fail open */ }
  }
  return false;
}
async function recordLoginFail(env, ip, email) {
  if (!env.RL) return;
  for (const { k } of loginFailKeys(ip, email)) {
    try {
      const n = parseInt((await env.RL.get(k)) || "0", 10);
      await env.RL.put(k, String(n + 1), { expirationTtl: LOGIN_LOCK_SECONDS });
    } catch (_) { /* best effort */ }
  }
}
async function clearLoginFails(env, ip, email) {
  if (!env.RL) return;
  for (const { k } of loginFailKeys(ip, email)) {
    // Never reset the fleet-wide counter on a success: an attacker with any
    // one valid account could otherwise launder their global failure count.
    if (k === LOGIN_GLOBAL_KEY) continue;
    try { await env.RL.delete(k); } catch (_) { /* best effort */ }
  }
}

// Oversized-body guard for the auth forms (V1.2 item 0.4): a real login,
// set-password or reset body is well under 4KB, so anything bigger is rejected
// before parsing. Missing Content-Length (rare for form posts) passes through -
// the field-level length caps behind this still hold.
const AUTH_BODY_MAX = 4096;
function authBodyTooLarge(request) {
  const len = Number(request.headers.get("Content-Length") || 0);
  return Number.isFinite(len) && len > AUTH_BODY_MAX;
}

// "Forgot password?" limiter: same fail-open KV pattern as the login limiter.
// Caps reset EMAILS, not page views - per IP and per target address - so the
// form can't be used to bomb an inbox or probe addresses at volume.
const RESET_RL_IP = 5;      // requests per IP per hour
const RESET_RL_EMAIL = 3;   // requests per target email per hour
async function resetRateLimited(env, ip, email) {
  if (!env.RL) return false;
  const keys = [];
  if (ip) keys.push({ k: `resetrl:ip:${ip}`, cap: RESET_RL_IP });
  const e = String(email || "").trim().toLowerCase();
  if (e) keys.push({ k: `resetrl:e:${e}`, cap: RESET_RL_EMAIL });
  const seen = [];
  for (const { k, cap } of keys) {
    try {
      const n = parseInt((await env.RL.get(k)) || "0", 10);
      if (n >= cap) return true;
      seen.push({ k, n });
    } catch (_) { /* fail open for this key */ }
  }
  for (const { k, n } of seen) {
    try { await env.RL.put(k, String(n + 1), { expirationTtl: 3600 }); } catch (_) { /* best effort */ }
  }
  return false;
}

// Push a "client is interested" alert when someone taps the CTA on a shared
// vehicle page. Best-effort: the response is already recorded by the caller.
async function notifyShareInterest(env, queueId) {
  try {
    const q = await env.DB.prepare(
      "SELECT q.lot_json, q.client_id, c.name AS client_name FROM queue q LEFT JOIN clients c ON c.id = q.client_id WHERE q.id = ?"
    ).bind(Number(queueId)).first();
    if (!q) return;
    let lot = {}; try { lot = JSON.parse(q.lot_json); } catch (e) {}
    const veh = [lot.year, lot.marka_name, lot.model_name].filter(Boolean).join(" ") || `Lot ${lot.lot || queueId}`;
    await sendPush(env, {
      title: "Interested via share link",
      message: `${q.client_name || "A client"} tapped I'm interested on ${veh}`,
      url: `${env.PUBLIC_URL}/admin?view=client&id=${q.client_id}`,
    });
  } catch (e) { console.error("notifyShareInterest failed:", e.message); }
}

// Stamp an account's most recent successful login - drives the CRM "Last login".
// Admin (id 0) has no DB row; only agents/clients/dealers do. Best-effort, never blocks.
async function touchLastSeen(env, role, id) {
  if (!id) return;
  let table;
  if (role === "agent") table = "agents";
  else if (role === "client") table = "clients";
  else if (role === "dealer") table = "dealers";
  else return;
  try { await env.DB.prepare(`UPDATE ${table} SET last_seen = datetime('now') WHERE id = ?`).bind(Number(id)).run(); } catch (_) { /* best effort */ }
}

export default {
  // -------- Scheduled matcher --------
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => { await expirePast(env); await autoFollowUps(env); await runMatcher(env); })());
  },

  // -------- HTTP routes --------
  // Last-resort catch: without it an uncaught exception surfaces to the
  // visitor as Cloudflare's raw "Error 1101 - Worker threw exception" page
  // (which is exactly what customers saw when set-password broke). Log enough
  // to find the failing route, then show the branded error page instead.
  async fetch(request, env, ctx) {
    try {
      return await this.handleRoutes(request, env, ctx);
    } catch (err) {
      console.error(`Unhandled error on ${request.method} ${new URL(request.url).pathname}: ${(err && err.stack) || err}`);
      try {
        return doc(infoPage("Something went wrong", "Sorry - something went wrong on our side. Please try again in a moment, and contact us if it keeps happening."), 500);
      } catch (_) {
        return new Response("Sorry - something went wrong on our side. Please try again in a moment.", { status: 500 });
      }
    }
  },

  async handleRoutes(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Canonicalize to one public domain. GET/HEAD only, so form POSTs and the
    // Stripe webhook (POST) are never redirected and keep working on any host.
    // /webhooks and /assets are exempt so already-sent email images and the
    // configured webhook URL keep resolving verbatim on the old domain too.
    if ((request.method === "GET" || request.method === "HEAD") &&
        REDIRECT_HOSTS.has(url.hostname) &&
        !path.startsWith("/webhooks/") && !path.startsWith("/assets/")) {
      url.hostname = CANONICAL_HOST;
      url.port = "";
      return Response.redirect(url.toString(), 301);
    }

    // Approve / skip links from the digest. Token-gated, no admin key needed
    // so they work from your inbox on any device.
    // Brand logo (served so emails can use a real PNG). Public.
    if (path === "/assets/logo-gold.png") {
      return new Response(logoPngBytes(), {
        headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
      });
    }

    // Lot-photo proxy for emails. Mail clients proxy or block images on
    // third-party hosts, so email templates reference this route on OUR domain
    // and the Worker fetches the photo from the auction CDN server-side.
    // Locked to that CDN's /imgs/ path (host + prefix anchored, length-capped)
    // so it can never be used as an open proxy; anything else 404s. Cached at
    // the edge - the tokens are immutable, so a week is safe.
    if (path === "/assets/lot-img") {
      const u = String(url.searchParams.get("u") || "");
      if (u.length > 500 || !/^https:\/\/[a-z0-9-]+\.ajes\.com\/imgs\/[!-~]+$/i.test(u)) {
        return new Response("Not found", { status: 404 });
      }
      const upstream = await fetch(u, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "image/*,*/*;q=0.8",
        },
        cf: { cacheEverything: true, cacheTtl: 604800 },
      });
      const type = upstream.headers.get("Content-Type") || "";
      if (!upstream.ok || !type.startsWith("image/")) {
        return new Response("Not found", { status: 404 });
      }
      return new Response(upstream.body, {
        headers: { "Content-Type": type, "Cache-Control": "public, max-age=604800, immutable" },
      });
    }

    // Emailed approve/skip links land here (GET) and show a confirmation page
    // whose button POSTs to /decide. This keeps a bare GET /decide POST-only, so
    // an email scanner / link-prefetcher can't silently approve or skip, while
    // the one-tap-from-your-inbox flow still works.
    if (path === "/decide/confirm" && (request.method === "GET" || request.method === "HEAD")) {
      const action = url.searchParams.get("action");
      const token = url.searchParams.get("token");
      if (!token || !["approve", "reject"].includes(action)) {
        return doc(infoPage("Invalid link", "That approve or skip link is not valid."), 400);
      }
      return doc(decisionConfirmPage(token, action, url.searchParams.get("return") || ""));
    }

    if (path === "/decide") {
      return handleDecision(request, env, url);
    }

    // Public, read-only shared vehicle view (the "Share" link). Token-gated and
    // view-only - it can never trigger approve/skip. No login required. The
    // token is verified against the row's current nonce + revocation state, so
    // a revoked or regenerated link lands on the same neutral expired page as
    // a forged one.
    if (path === "/v") {
      const sharedId = await verifyShareLink(env, url.searchParams.get("t"));
      if (!sharedId) return doc(infoPage("Link expired", "This share link is invalid or has expired. Ask JDM Connect for a fresh one.", { cta: { href: "/request", label: "Request a vehicle" } }), 404);
      // The page ALWAYS renders (a shared link must never rate-limit to a wall).
      // But the per-view side-effects - the outbound feed refresh inside
      // publicLotPage and the view-counter write - are capped per IP, so a
      // token holder can't hammer /v to amplify feed traffic, pollute the
      // "opened N times" stat, or spin D1 writes. Over the cap we still render,
      // just without the counter bump or the live image heal.
      const ip = request.headers.get("CF-Connecting-IP") || "";
      const hot = await apiRateLimited(env, ip);
      const viewerSession = await getSession(request, url, env).catch(() => null);
      // Only a genuine, un-throttled CUSTOMER open counts. A signed-in viewer is
      // staff previewing the link before sending (or a member opening their own
      // portal card) - it must not stamp viewed_at / log "Customer viewed X" /
      // bump the counter, or the real first customer view is lost and the
      // engagement signal is a staff artefact.
      if (!hot && !viewerSession) {
        ctx.waitUntil(stampMatchViewed(env, sharedId));
        ctx.waitUntil(env.DB.prepare(
          "UPDATE queue SET share_view_count = share_view_count + 1, share_last_viewed_at = datetime('now') WHERE id = ?"
        ).bind(sharedId).run());
      }
      return doc(await publicLotPage(env, sharedId, { thanks: url.searchParams.get("ok") === "1", skipRefresh: hot }));
    }

    // Public "I'm interested" tap from a shared vehicle page. The share token
    // (POST body, never the raw queue id) is re-verified, so only someone
    // holding a live link can record interest, and only for that one car.
    // Same-origin is not required: possessing the token IS the capability.
    if (path === "/v/interest" && request.method === "POST") {
      const ip = request.headers.get("CF-Connecting-IP") || "";
      if (await apiRateLimited(env, ip)) {
        return doc(infoPage("Too many requests", "Please wait a moment and try again."), 429);
      }
      const f = await request.formData();
      const token = String(f.get("t") || "");
      const sharedId = await verifyShareLink(env, token);
      if (!sharedId) return doc(infoPage("Link expired", "This share link is invalid or has expired. Ask JDM Connect for a fresh one.", { cta: { href: "/request", label: "Request a vehicle" } }), 404);
      const r = await setMatchResponse(env, sharedId, "interested", null).catch((e) => {
        console.error("/v/interest failed:", e.message);
        return { ok: false };
      });
      if (r && r.ok) {
        ctx.waitUntil(notifyShareInterest(env, sharedId));
      }
      return Response.redirect(new URL(`/v?t=${encodeURIComponent(token)}&ok=1`, url).toString(), 303);
    }

    // Public "Recent finds" gallery: importer-style social proof built from
    // cars actually sent to buyers (anonymised to first name + state).
    if (path === "/finds" || path === "/recent-finds") {
      return doc(await findsPage(env));
    }

    // Public privacy policy (linked from every email footer and the request form).
    if (path === "/privacy" || path === "/privacy-policy") {
      return doc(privacyPage());
    }
    // Public terms of service (footer / launch audit).
    if (path === "/terms" || path === "/terms-of-service") {
      return doc(termsPage());
    }
    // Sitemap: the public, indexable pages only. Session-gated surfaces and
    // token-gated share links stay out by design.
    if (path === "/sitemap.xml") {
      const pages = ["/", "/request", "/finds", "/privacy", "/terms"];
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `  <url><loc>${PUBLIC_ORIGIN}${p}</loc></url>`).join("\n")}\n</urlset>\n`;
      return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
    }

    // Public vehicle-request form (no login) - for dealers and their clients.
    // A signed-in buyer (e.g. via Google) sees the account step collapse to a
    // one-tap confirm, and their identity is taken from the session, not the form.
    if (path === "/request") {
      const session = await getSession(request, url, env);
      let signedIn = null;
      if (session && session.role === "client" && session.id) {
        const c = await env.DB.prepare("SELECT name, email, whatsapp FROM clients WHERE id = ?").bind(session.id).first();
        if (c) signedIn = { name: c.name || "", email: c.email || "", whatsapp: c.whatsapp || "" };
      }
      if (request.method === "POST") {
        // Rate limit (best-effort; fails open if KV is unavailable). Over the
        // limit we return the normal confirmation without storing anything, so
        // bots get no signal. Limited per IP AND per contact (email/phone) so IP
        // rotation can't spam one client's searches.
        const form = await request.formData();
        const limited = await requestRateLimited(env, {
          ip: request.headers.get("CF-Connecting-IP") || "",
          email: form.get("email"),
          whatsapp: form.get("whatsapp"),
        });
        // Rate-limited: tell the person honestly instead of faking success. A
        // fake success here meant a real visitor believed they had an account
        // when nothing was stored (V1.2 bug 0.1). Bots learn nothing new -
        // rate-limit responses are standard; the honeypot below still plays dead.
        if (limited) {
          return doc(await requestPage(env, { error: "limited", signedIn }), 429);
        }
        {
          const result = await createRequest(env, form, session);
          if (result.ok) {
            // A returning, passwordless record gets a secure set-password link by
            // email, so only the inbox owner can claim the login.
            let inviteSent = false;
            if (result.inviteNeeded) {
              try {
                const inv = await inviteClientPortal(env, result.clientId, { role: "admin", id: 0 });
                if (inv && inv.ok && inv.token) { await sendClientPortalInvite(env, inv); inviteSent = true; }
              } catch (e) { console.error("Signup set-password invite failed:", e.message); }
            }
            // The email already has a login: the enquiry folded into that
            // account and any typed password was ignored. Email a sign-in
            // link so the owner can pick it up; the page itself looks exactly
            // like every other confirmation (no account-existence signal).
            if (result.signinNeeded) {
              try {
                const r = await beginPasswordReset(env, result.req.email);
                if (r && r.token) {
                  await sendEmail(env, {
                    to: r.email,
                    subject: "Your new vehicle search - sign in to view it",
                    html: passwordResetHtml(r.name, `${env.PUBLIC_URL}/set-password?token=${r.token}`),
                    from: env.MAIL_FROM_CLIENT || env.MAIL_FROM_INTERNAL || env.MAIL_FROM,
                  });
                }
              } catch (e) { console.error("Signup sign-in link failed:", e.message); }
            }
            await alertNewRequest(env, result.req);     // notify staff
            await confirmRequest(env, result.req, result.ref); // receipt to the buyer
            // Free-tier hook: for non-member buyers, run the search once now and
            // send a first example, then show the "unlimited" upsell. Members
            // already have the full experience, so they see neither. Best-effort:
            // a failure here never blocks the confirmation.
            let welcome = null, upsell = null;
            try {
              const cm = await env.DB.prepare("SELECT member FROM clients WHERE id = ?").bind(result.clientId).first();
              if (!(cm && cm.member)) {
                const settings = await getSettings(env);
                // V1.3 (decided): free accounts are manually reviewed, so the
                // instant welcome match on signup is OFF by default. It only
                // goes out when free_auto_send is switched on in Settings.
                if (result.wishlistId && settingOn(settings, "free_auto_send")) welcome = await sendWelcomeMatch(env, result.wishlistId);
                const priceAud = settingNum(settings, "membership_monthly_aud", 49);
                // Only offer the upsell when membership is actually purchasable.
                if (stripeConfigured(env) && settingOn(settings, "membership_enabled") && priceAud > 0) {
                  upsell = { priceAud };
                }
              }
            } catch (e) { console.error("Welcome match / upsell failed:", e.message); }
            return doc(await requestPage(env, { submitted: true, ref: result.ref, req: result.req, welcome, upsell, inviteSent }));
          }
          // EVERY validation failure re-renders the wizard with the error and
          // the visitor's input preserved. The old code re-rendered only the
          // account-step errors and let vehicle/year/budget failures fall
          // through to the generic "success" page - a real person saw their
          // request confirmed while nothing was stored and no account existed
          // (V1.2 bug 0.1). Only the honeypot still plays dead below.
          if (result.error && result.error !== "spam") {
            return doc(await requestPage(env, { error: result.error, pwError: result.pwError, vals: result.vals, signedIn }));
          }
        }
        // Honeypot/spam: a generic success so bots get no signal.
        return doc(await requestPage(env, { submitted: true }));
      }
      const reqErr = url.searchParams.get("error") === "google" ? "google" : undefined;
      // Vehicle-enquiry links carry the car into the wizard (launch audit: the
      // selected car was lost). The prefill plumbing (vals -> selects, refine
      // panel auto-open) already exists for the validation re-render path.
      const qp = (k, max = 60) => String(url.searchParams.get(k) || "").slice(0, max).trim();
      const qVals = {};
      if (qp("make")) qVals.marka_name = qp("make");
      if (qp("model")) qVals.model_name = qp("model");
      if (/^\d{4}$/.test(qp("year"))) { qVals.year_min = qp("year"); qVals.year_max = qp("year"); }
      if (qp("chassis")) qVals.kuzov = qp("chassis");
      return doc(await requestPage(env, { signedIn, error: reqErr, vals: qVals }));
    }

    // Feed lookup lists for the form dropdowns (public - just car names).
    // CORS-open so other JDM apps (e.g. the dealer portal) can consume them.
    // Rate-limited per IP: a cache miss on these fans out to the auction relay
    // (up to ~16 upstream SQL calls per /api/market hit), so an anonymous loop
    // could burn the relay quota (audit Medium #12). Generous cap - real users
    // browsing the wizard make a handful of calls, not 60 in 5 minutes.
    if (path === "/api/makers" || path === "/api/models" || path === "/api/codes" || path === "/api/grades" || path === "/api/market") {
      const ip = request.headers.get("CF-Connecting-IP") || "";
      if (await apiRateLimited(env, ip)) {
        return new Response(JSON.stringify({ ok: false, error: "rate_limited" }), {
          status: 429,
          headers: { "Content-Type": "application/json", "Retry-After": "300", "Access-Control-Allow-Origin": "*" },
        });
      }
    }
    if (path === "/api/makers") {
      return new Response(JSON.stringify(await distinctMakers(env)), {
        headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*" },
      });
    }
    if (path === "/api/models") {
      return new Response(JSON.stringify(await distinctModels(env, url.searchParams.get("maker") || "")), {
        headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*" },
      });
    }
    // Model codes for a maker (+ optional model), labelled with the reviewed
    // association where one exists: [{ code, label }] (V1.2 Phase 4).
    if (path === "/api/codes") {
      const codes = await distinctModelCodes(env, url.searchParams.get("maker") || "", url.searchParams.get("model") || "");
      return new Response(JSON.stringify(codes.map((code) => ({ code, label: labelForCode(code) }))), {
        headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*" },
      });
    }
    // Grade (trim) spellings on current and recent listings for a selection.
    // Powers the Grade multi-select; spelling variants surface as-is.
    if (path === "/api/grades") {
      const grades = await distinctGrades(env, url.searchParams.get("maker") || "", url.searchParams.get("model") || "", url.searchParams.get("code") || "");
      return new Response(JSON.stringify(grades), {
        headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*" },
      });
    }
    // Onboarding "Market Snapshot": typical auction price, estimated landed cost
    // and rough monthly availability for a make/model, from real sold history.
    if (path === "/api/market") {
      const snap = await marketSnapshot(env, url.searchParams.get("make") || "", url.searchParams.get("model") || "", url.searchParams.get("yearMin") || "", url.searchParams.get("yearMax") || "").catch(() => ({ ok: false }));
      return new Response(JSON.stringify(snap), {
        headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=1800", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Same-host redirect helper: keeps the user (and their session cookie) on
    // whichever domain they arrived on - custom domain or workers.dev.
    const here = (p) => new URL(p, url).toString();

    // Where each role lands after signing in.
    const homeFor = (role) => {
      if (role === "client") return "/portal";
      if (role === "dealer") return "/dealer/portal";
      return "/admin";
    };

    // Login / logout.
    if (path === "/login") {
      const googleEnabled = googleConfigured(env);
      // "Start membership" links land here as /login?next=subscribe. Only this
      // one whitelisted value is honoured (and only for clients), so ?next= can
      // never become an open redirect or drop an admin somewhere unexpected.
      const next = url.searchParams.get("next") === "subscribe" ? "subscribe" : "";
      const afterLogin = (role) => (next && role === "client") ? "/portal/subscribe" : homeFor(role);
      if (request.method === "POST") {
        if (authBodyTooLarge(request)) return doc(loginPage({ error: true, googleEnabled, next }), 413);
        const form = await request.formData();
        const ip = request.headers.get("CF-Connecting-IP") || "";
        // Admin MFA step 2: an authenticator code plus the short-lived signed
        // pending cookie proving the password was just entered. Without the
        // cookie a code is worthless, so this step can't be reached (or
        // replayed later) on its own. Failed codes count as admin login
        // failures - same lockout and delay as password guessing.
        if (form.has("totp")) {
          if (!(await readMfaPending(request, env))) {
            return doc(loginPage({ error: true, googleEnabled, next }), 401, { "Set-Cookie": clearMfaCookie() });
          }
          if (await loginLocked(env, ip, "")) {
            await new Promise((r) => setTimeout(r, LOGIN_FAIL_DELAY_MS));
            return doc(loginPage({ locked: true, googleEnabled, next }), 429);
          }
          if (await verifyAdminTotp(env, form.get("totp"))) {
            await clearLoginFails(env, ip, "");
            const headers = new Headers({ Location: here(afterLogin("admin")) });
            headers.append("Set-Cookie", await sessionCookie(env, "admin", 0));
            headers.append("Set-Cookie", clearMfaCookie());
            return new Response(null, { status: 303, headers });
          }
          await recordLoginFail(env, ip, "");
          await new Promise((r) => setTimeout(r, LOGIN_FAIL_DELAY_MS));
          return doc(mfaPage({ error: true, next }), 401);
        }
        // Clip the email to its RFC maximum before it reaches KV keys or logs;
        // authenticate() enforces the same cap (plus the password cap) itself.
        const email = String(form.get("email") || "").slice(0, EMAIL_MAX);
        // Lockout: too many recent failures for this IP/email -> refuse without
        // even checking the password, so brute force can't keep guessing.
        if (await loginLocked(env, ip, email)) {
          await new Promise((r) => setTimeout(r, LOGIN_FAIL_DELAY_MS));
          return doc(loginPage({ locked: true, googleEnabled, email: String(email || ""), next }), 429);
        }
        const who = await authenticate(env, email, form.get("password"));
        if (who) {
          // Correct admin password with MFA enabled: no session yet - hand out
          // the pending cookie and ask for the authenticator code.
          if (who.role === "admin" && adminMfaEnabled(env)) {
            await clearLoginFails(env, ip, email);
            return doc(mfaPage({ next }), 200, { "Set-Cookie": await mfaPendingCookie(env) });
          }
          await clearLoginFails(env, ip, email);
          await touchLastSeen(env, who.role, who.id);
          return new Response(null, { status: 303, headers: { Location: here(afterLogin(who.role)), "Set-Cookie": await sessionCookie(env, who.role, who.id) } });
        }
        await recordLoginFail(env, ip, email);
        await new Promise((r) => setTimeout(r, LOGIN_FAIL_DELAY_MS)); // throttle repeated guesses
        // Re-render with the submitted email preserved so a typo'd password
        // never costs re-typing the address.
        return doc(loginPage({ error: true, googleEnabled, email: String(email || ""), next }), 401);
      }
      const existing = await getSession(request, url, env);
      if (existing) return Response.redirect(here(afterLogin(existing.role)), 303);
      const googleError = url.searchParams.get("error") === "google";
      return doc(loginPage({ googleEnabled, googleError, next }));
    }
    if (path === "/logout") {
      return new Response(null, { status: 303, headers: { Location: here("/login"), "Set-Cookie": clearCookie() } });
    }

    // Self-serve password reset (V1.2 item 0.3). The response is IDENTICAL
    // whether or not the email has an account, so the form can't be used to
    // probe which addresses are registered. Eligible accounts get a 1-hour
    // single-use link into the same /set-password flow as invites.
    if (path === "/forgot-password") {
      if (request.method === "POST") {
        if (authBodyTooLarge(request)) return doc(forgotPasswordPage({ sent: true }), 413);
        const form = await request.formData();
        const email = String(form.get("email") || "").trim().slice(0, EMAIL_MAX);
        const ip = request.headers.get("CF-Connecting-IP") || "";
        if (email && !(await resetRateLimited(env, ip, email))) {
          try {
            const r = await beginPasswordReset(env, email);
            if (r && r.token) {
              await sendEmail(env, {
                to: r.email,
                subject: "Reset your JDM Connect password",
                html: passwordResetHtml(r.name, `${env.PUBLIC_URL}/set-password?token=${r.token}`),
              });
            }
          } catch (e) {
            // Log loudly but still show the neutral page: an internal failure
            // must not reveal anything about the address either.
            console.error("Password reset failed:", e.message);
          }
        }
        return doc(forgotPasswordPage({ sent: true, email }));
      }
      return doc(forgotPasswordPage());
    }

    // --- Social login (Google). Inert until GOOGLE_CLIENT_ID/SECRET are set. ---
    // /auth/google starts the flow (intent=signup from the request form,
    // intent=login from the sign-in screen); the callback verifies the round-trip,
    // finds-or-creates the client, signs them in, and lands them appropriately.
    if (path === "/auth/google") {
      if (!googleConfigured(env)) return Response.redirect(here("/login"), 303);
      const intent = url.searchParams.get("intent") === "login" ? "login" : "signup";
      const { authUrl, cookie } = await beginGoogle(env, url.origin, intent);
      return new Response(null, { status: 303, headers: { Location: authUrl, "Set-Cookie": cookie } });
    }
    if (path === "/auth/google/callback") {
      if (!googleConfigured(env)) return Response.redirect(here("/login"), 303);
      const res = await completeGoogle(env, request, url);
      if (!res.ok) {
        const to = res.intent === "login" ? "/login?error=google" : "/request?error=google";
        return new Response(null, { status: 303, headers: { Location: here(to), "Set-Cookie": clearNonceCookie() } });
      }
      const person = await upsertGoogleClient(env, res.profile);
      if (!person || !person.id) {
        return new Response(null, { status: 303, headers: { Location: here("/login?error=google"), "Set-Cookie": clearNonceCookie() } });
      }
      const dest = res.intent === "login" ? "/portal" : "/request?g=1";
      await touchLastSeen(env, "client", person.id);
      const headers = new Headers({ Location: here(dest) });
      headers.append("Set-Cookie", await sessionCookie(env, "client", person.id));
      headers.append("Set-Cookie", clearNonceCookie());
      return new Response(null, { status: 303, headers });
    }

    // Set-password (from an emailed invite link). Public - the single-use token
    // authorises it. Works for agent, dealer and client invites; the token is
    // looked up against each in order. On success the user is signed straight in
    // and sent to their home.
    if (path === "/set-password") {
      // Resolve which kind of invite this token is. {kind, person} | null.
      // Each lookup is isolated so a broken table/column in one role's branch
      // (e.g. a deploy that outran its migration) can only disable that role -
      // it must never 500 the set-password flow for everyone (V1.2 bug 0.2).
      const resolveInvite = async (token) => {
        const lookups = [
          { kind: "agent", fn: agentByInviteToken },
          { kind: "dealer", fn: dealerByInviteToken },
          { kind: "client", fn: clientByInviteToken },
        ];
        for (const { kind, fn } of lookups) {
          try {
            const person = await fn(env, token);
            if (person) return { kind, person };
          } catch (e) {
            console.error(`/set-password ${kind} token lookup failed:`, e.message);
          }
        }
        return null;
      };
      if (request.method === "POST") {
        // Fully contained: a thrown handler here must re-render the branded
        // page with an error, never surface a raw Worker exception to a
        // customer holding their very first link from us.
        let token = null, name = "";
        try {
          if (authBodyTooLarge(request)) return doc(setPasswordPage({ invalid: true }), 413);
          const form = await request.formData();
          token = form.get("token");
          const pw = String(form.get("password") || "");
          const found = await resolveInvite(token);
          if (!found) return doc(setPasswordPage({ invalid: true }));
          name = found.person.name;
          if (pw !== String(form.get("confirm") || "")) {
            return doc(setPasswordPage({ token, name, error: "Those passwords don't match." }));
          }
          const r = found.kind === "agent"
            ? await setAgentPassword(env, token, pw)
            : found.kind === "dealer"
            ? await setDealerPassword(env, token, pw)
            : await setClientPassword(env, token, pw);
          if (r.ok) {
            const role = found.kind === "agent" ? "agent" : found.kind === "dealer" ? "dealer" : "client";
            return new Response(null, { status: 303, headers: { Location: here(homeFor(role)), "Set-Cookie": await sessionCookie(env, role, r.id) } });
          }
          return doc(setPasswordPage({ token, name, error: r.error }));
        } catch (e) {
          console.error("/set-password POST failed:", e.message);
          return doc(setPasswordPage({ token, name, error: "Sorry, something went wrong on our side. Please try the link again, and contact us if it keeps happening." }), 500);
        }
      }
      const found = await resolveInvite(url.searchParams.get("token"));
      return doc(found ? setPasswordPage({ token: url.searchParams.get("token"), name: found.person.name }) : setPasswordPage({ invalid: true }));
    }

    // Stripe webhook (public; verified by signature). Marks deposits paid.
    if (path === "/webhooks/stripe" && request.method === "POST") {
      const raw = await request.text();
      // No signing secret configured: we cannot verify, so do not 400 (which
      // would make Stripe exhaust retries). Acknowledge with 503 so it retries
      // later, once the secret is set, and log it loudly.
      if (!env.STRIPE_WEBHOOK_SECRET) {
        console.warn("Stripe webhook hit but STRIPE_WEBHOOK_SECRET is not set; ignoring.");
        return new Response("webhook not configured", { status: 503 });
      }
      const event = await verifyAndParseEvent(env, raw, request.headers.get("Stripe-Signature"));
      if (!event) return new Response("invalid signature", { status: 400 });
      // Applying is idempotent (WHERE status <> 'paid'), so a 500 here just lets
      // Stripe retry a transient DB hiccup safely.
      try {
        const status = await applyStripeEvent(env, event);
        // Phone chime on money in (a new member or a paid deposit). Skipped for
        // "duplicate"/other statuses, so Stripe retries never double-ping.
        const chime = paymentChime(event, status, env.PUBLIC_URL);
        if (chime) await sendPush(env, chime);
      } catch (err) {
        console.error("Stripe event failed:", err.message);
        return new Response("processing error", { status: 500 });
      }
      return new Response("ok", { status: 200 });
    }

    // Bare domain → public landing page: explains the service and offers a
    // clear path to start a search or sign in. Safe to share publicly.
    if (path === "/") {
      return doc(await landingPage(env));
    }

    // Unknown public GETs should be real 404s, not login redirects. Only the
    // known signed-in page families continue through to session handling.
    const protectedPage = path === "/logout" || path === "/run" ||
      path === "/admin" || path.startsWith("/admin/") ||
      path === "/portal" || path.startsWith("/portal/") ||
      path === "/dealer/portal" || path === "/dealer/history";
    if ((request.method === "GET" || request.method === "HEAD") && !protectedPage) {
      return doc(notFoundPage(), 404);
    }

    // Everything below requires a signed-in session.
    const session = await getSession(request, url, env);
    if (!session) {
      return Response.redirect(here("/login"), 303);
    }

    // CSRF guard: reject any state-changing request on an authenticated session
    // that didn't come from one of our own pages (missing/foreign Origin/Referer).
    if (MUTATING_METHODS.has(request.method) && !isSameOriginRequest(request, url)) {
      return doc(infoPage("Request blocked", "For your security, that action was blocked because it didn't come from JDM Connect. Please go back and try again from the app."), 403);
    }

    // Buyer (client) sessions are fully isolated from the staff app: they only
    // ever reach the /portal/* surface, handled here and nowhere else.
    if (session.role === "client") {
      return handleClientPortal(request, env, url, path, session, here);
    }

    // Dealer sessions are isolated: they only reach /dealer/* routes.
    if (session.role === "dealer") {
      return handleDealerPortal(request, env, url, path, session, here);
    }

    const adminOnly = () => Response.redirect(here("/admin"), 303);

    // Append a one-shot outcome message to a redirect destination. The admin
    // shell renders ?notice= as a success toast and ?notice_err= as an error
    // toast, then cleans the URL, so no quick-action POST finishes silently.
    const withNotice = (dest, msg, isErr = false) =>
      msg ? dest + (dest.includes("?") ? "&" : "?") + (isErr ? "notice_err=" : "notice=") + encodeURIComponent(msg) : dest;
    // Run a quick-action handler, then redirect with a visible outcome. A
    // thrown handler is contained here: the user lands back on the page they
    // came from with an error toast instead of a blank Worker error page.
    // `dest` may be a (possibly async) function when it depends on the outcome.
    const act = async (fn, dest, okMsg) => {
      let failed = false;
      try { await fn(); } catch (e) { failed = true; console.error(`${path} failed:`, e.message); }
      const d = typeof dest === "function" ? await dest() : dest;
      return Response.redirect(here(failed
        ? withNotice(d, "Sorry, that did not save. Please try again.", true)
        : withNotice(d, okMsg)), 303);
    };

    // Admin dealer management routes (admin only). The whole group also sits
    // behind the dealer_portal_enabled setting (launch audit: the feature ships
    // hidden until finished), so a stale bookmark or form can't resurrect it.
    if ((path === "/dealer" || path.startsWith("/dealer/") || path.startsWith("/dealer-vehicle/")) &&
        request.method === "POST" && path !== "/dealer/vehicle/submit") {
      const s = await getSettings(env);
      if (!settingOn(s, "dealer_portal_enabled")) {
        return Response.redirect(here(withNotice("/admin", "The dealer network is turned off in Settings.", true)), 303);
      }
    }
    if (path === "/dealer" && request.method === "POST") {
      if (session.role !== "admin") return adminOnly();
      const f = await request.formData();
      const r = await createDealer(env, f);
      if (r.ok) {
        if (r.token) await sendDealerInvite(env, r);
        return Response.redirect(here(withNotice("/admin?view=dealers", "Dealer added and invited")), 303);
      }
      const msg = r.error === "email already in use"
        ? "That email is already a dealer account. Use a different address."
        : "Could not create the dealer. Check the name and email.";
      return Response.redirect(here(withNotice("/admin?view=dealers", msg, true)), 303);
    }
    if (path === "/dealer/invite" && request.method === "POST") {
      if (session.role !== "admin") return adminOnly();
      const id = (await request.formData()).get("id");
      return act(async () => {
        const r = await resendDealerInvite(env, id);
        if (r) await sendDealerInvite(env, r);
      }, "/admin?view=dealers", "Invite re-sent");
    }
    if (path === "/dealer/toggle" && request.method === "POST") {
      if (session.role !== "admin") return adminOnly();
      const id = (await request.formData()).get("id");
      return act(() => toggleDealer(env, id), "/admin?view=dealers", "Dealer updated");
    }
    if (path === "/dealer/delete" && request.method === "POST") {
      if (session.role !== "admin") return adminOnly();
      const id = (await request.formData()).get("id");
      return act(() => deleteDealer(env, id), "/admin?view=dealers", "Dealer deleted");
    }

    // Dealer vehicle submissions: approve/reject
    if (path === "/dealer-vehicle/approve" && request.method === "POST") {
      if (session.role !== "admin") return adminOnly();
      const id = (await request.formData()).get("id");
      return act(() => approveDealerVehicle(env, id, session), "/admin?view=dealer-submissions", "Vehicle approved");
    }
    if (path === "/dealer-vehicle/reject" && request.method === "POST") {
      if (session.role !== "admin") return adminOnly();
      const f = await request.formData();
      return act(() => rejectDealerVehicle(env, f.get("id"), f.get("notes"), session), "/admin?view=dealer-submissions", "Vehicle rejected");
    }

    if (path === "/admin") {
      const view = url.searchParams.get("view") || "dashboard";
      if (view === "client") {
        const sp = url.searchParams;
        const search = {
          make: sp.get("make") || "", model: sp.get("model") || "",
          yearMin: sp.get("yearMin") || "", yearMax: sp.get("yearMax") || "",
          priceMax: sp.get("priceMax") || "", gradeMin: sp.get("gradeMin") || "",
          kuzov: sp.get("kuzov") || "",
        };
        return doc(await clientDetailPage(env, sp.get("id"), session, {
          dup: sp.get("dup"),
          saved: sp.get("saved"),
          cerr: sp.get("cerr"),
          found: sp.get("found"),
          search,
        }));
      }
      if (view === "lot") {
        const retRaw = url.searchParams.get("ret") || "";
        return doc(await lotDetailPage(env, url.searchParams.get("id"), session, {
          aiEnabled: !!env.ANTHROPIC_API_KEY,
          err: url.searchParams.get("err"),
          ret: retRaw.startsWith("/admin") ? retRaw : "",
        }));
      }
      if (view === "auctionlot") {
        const backRaw = url.searchParams.get("back") || "";
        return doc(await auctionLotPage(env, session, url.searchParams.get("lot"), {
          // "Shopping for this client" context from the client-page find
          // results: preselects the Add target and returns Back to the search.
          clientId: Number(url.searchParams.get("client")) || 0,
          back: backRaw.startsWith("/admin") ? backRaw : "",
        }));
      }
      if (view === "request") {
        return doc(await requestDetailPage(env, url.searchParams.get("id"), session, {
          saved: url.searchParams.get("saved") || "",
          // Typed content preserved from a failed note / follow-up post.
          note: url.searchParams.get("note") || "",
          naDate: url.searchParams.get("na_date") || "",
          naNote: url.searchParams.get("na_note") || "",
        }));
      }
      const adminOpts = { err: url.searchParams.get("err") };
      if (view === "matches") {
        const sp = url.searchParams;
        adminOpts.matchQuery = {
          f: sp.get("f") || "", soon: sp.get("soon") || "",
          group: sp.get("group") || "", shown: sp.get("shown") || "",
        };
      }
      if (view === "search") adminOpts.q = url.searchParams.get("q") || "";
      if (view === "tasks") adminOpts.taskMine = url.searchParams.get("mine") === "1";
      if (view === "requests") adminOpts.reqLayout = url.searchParams.get("layout") === "board" ? "board" : "";
      if (view === "clients") {
        adminOpts.showArchived = url.searchParams.get("archived") === "1";
        const cat = url.searchParams.get("cat") || "";
        adminOpts.cat = cat === "private" || cat === "dealer" ? cat : "";
        const src = url.searchParams.get("src") || "";
        adminOpts.src = src === "jdm" || src === "public" ? src : "";
      }
      // Re-rendered form values after a validation error (v_ prefixed params),
      // so a failed post never wipes what the user typed.
      if (view === "intake" || view === "agents") {
        const sp = url.searchParams;
        adminOpts.vals = {
          name: sp.get("v_name") || "", email: sp.get("v_email") || "",
          whatsapp: sp.get("v_whatsapp") || "", state: sp.get("v_state") || "",
          company: sp.get("v_company") || "", category: sp.get("v_category") || "",
          // Car fields, so a rejected one-step new request keeps the search too.
          label: sp.get("v_label") || "", marka_name: sp.get("v_marka_name") || "",
          model_name: sp.get("v_model_name") || "", year_min: sp.get("v_year_min") || "",
          year_max: sp.get("v_year_max") || "", price_max: sp.get("v_price_max") || "",
          mileage_min: sp.get("v_mileage_min") || "", mileage_max: sp.get("v_mileage_max") || "",
          rate_min: sp.get("v_rate_min") || "", kuzov: sp.get("v_kuzov") || "",
          grade_kw: sp.get("v_grade_kw") || "",
        };
      }
      if (view === "auctions") {
        const sp = url.searchParams;
        adminOpts.tab = sp.get("tab") || "live";
        adminOpts.found = sp.get("found") || "";
        // The history and live tabs validate their own params (the shared
        // engine in auction-history-query.js), so they get the raw query
        // rather than a whitelist. rates / houses / unspec are checkbox
        // multi-selects: getAll() keeps every ticked value.
        adminOpts.rawQuery = {
          ...Object.fromEntries(sp),
          rates: sp.getAll("rates").join(","),
          houses: sp.getAll("houses").join(","),
          unspec: sp.getAll("unspec"),
        };
        adminOpts.search = {
          q: sp.get("q") || "", make: sp.get("make") || "", model: sp.get("model") || "",
          house: sp.get("house") || "", yearMin: sp.get("yearMin") || "", yearMax: sp.get("yearMax") || "",
          priceMax: sp.get("priceMax") || "", gradeMin: sp.get("gradeMin") || "",
          grade: sp.get("grade") || "", window: sp.get("window") || "",
          kuzov: sp.get("kuzov") || "", layout: sp.get("layout") || "", page: sp.get("page") || "",
        };
      }
      if (view === "dealers") {
        adminOpts.dealerStatus = "pending";
      }
      if (view === "dealer-submissions") {
        adminOpts.dealerStatus = url.searchParams.get("status") || "pending";
      }
      return doc(await adminPage(env, view, session, adminOpts));
    }

    // Safe "return to" target for the CRM quick-action forms: only same-app
    // /admin paths are honoured, otherwise fall back to the requests list.
    const crmBack = (f, fallback = "/admin?view=requests") => {
      const b = String(f.get("back") || "");
      return b.startsWith("/admin") ? b : fallback;
    };

    // Move a request along the pipeline (Requests view + request detail).
    if (path === "/request/status" && request.method === "POST") {
      const f = await request.formData();
      return act(() => updateRequestStatus(env, f.get("id"), f.get("status"), session), crmBack(f), "Status updated");
    }

    // Add a free-text note to a request's timeline.
    if (path === "/request/note" && request.method === "POST") {
      const f = await request.formData();
      const dest = crmBack(f, `/admin?view=request&id=${Number(f.get("id")) || ""}`);
      try {
        await addRequestNote(env, f.get("id"), f.get("note"), session);
        return Response.redirect(here(withNotice(dest, "Note added")), 303);
      } catch (e) {
        // Carry the typed note back so a failed post never wipes it.
        console.error("/request/note failed:", e.message);
        const keep = dest + (dest.includes("?") ? "&" : "?") + "note=" + encodeURIComponent(String(f.get("note") || "").slice(0, 500));
        return Response.redirect(here(withNotice(keep, "Could not save the note. Your text is kept in the box.", true)), 303);
      }
    }

    // (Re)assign a request's owner (admin only).
    if (path === "/request/owner" && request.method === "POST") {
      const f = await request.formData();
      const dest = crmBack(f, `/admin?view=request&id=${Number(f.get("id")) || ""}`);
      if (session.role !== "admin") return Response.redirect(here(dest), 303);
      return act(() => assignRequestOwner(env, f.get("id"), f.get("owner_id"), session), dest, "Owner updated");
    }

    // Schedule / clear a request's next follow-up.
    if (path === "/request/next-action" && request.method === "POST") {
      const f = await request.formData();
      const dest = crmBack(f, `/admin?view=request&id=${Number(f.get("id")) || ""}`);
      const clearing = f.get("clear") === "1";
      try {
        await setNextAction(env, f.get("id"), { date: f.get("next_action_date"), note: f.get("next_action_note"), clear: clearing }, session);
        return Response.redirect(here(withNotice(dest, clearing ? "Follow-up cleared" : "Follow-up saved")), 303);
      } catch (e) {
        console.error("/request/next-action failed:", e.message);
        const sep = dest.includes("?") ? "&" : "?";
        const keep = dest + sep + "na_date=" + encodeURIComponent(String(f.get("next_action_date") || "")) + "&na_note=" + encodeURIComponent(String(f.get("next_action_note") || "").slice(0, 160));
        return Response.redirect(here(withNotice(keep, "Could not save the follow-up. Your entry is kept in the form.", true)), 303);
      }
    }

    // Tasks: create / toggle done / delete.
    if (path === "/task/create" && request.method === "POST") {
      const f = await request.formData();
      return act(() => createTask(env, f, session), crmBack(f, "/admin?view=tasks"), "Task created");
    }
    if (path === "/task/toggle" && request.method === "POST") {
      const f = await request.formData();
      return act(() => toggleTask(env, f.get("id"), session), crmBack(f, "/admin?view=tasks"), "Task updated");
    }
    if (path === "/task/delete" && request.method === "POST") {
      const f = await request.formData();
      return act(() => deleteTask(env, f.get("id"), session), crmBack(f, "/admin?view=tasks"), "Task deleted");
    }

    // Record a client's response to a sent vehicle (interested / passed).
    if (path === "/match/response" && request.method === "POST") {
      const f = await request.formData();
      return act(() => setMatchResponse(env, f.get("id"), f.get("response"), session), crmBack(f), "Response recorded");
    }

    // Share-link management (staff): the price band + condition notes shown on
    // the public page, and the link lifecycle (revoke / regenerate).
    if (path === "/share/details" && request.method === "POST") {
      const f = await request.formData();
      return act(() => updateShareDetails(env, f.get("id"), { priceNote: f.get("price_note"), conditionNotes: f.get("condition_notes") }, session), crmBack(f), "Share page updated");
    }
    if (path === "/share/revoke" && request.method === "POST") {
      const f = await request.formData();
      return act(() => setShareRevoked(env, f.get("id"), true, session), crmBack(f), "Share link revoked");
    }
    if (path === "/share/regenerate" && request.method === "POST") {
      const f = await request.formData();
      return act(() => regenerateShareLink(env, f.get("id"), session), crmBack(f), "New share link issued. Old links no longer work.");
    }

    // Soft-archive / restore a customer.
    if ((path === "/client/archive" || path === "/client/unarchive") && request.method === "POST") {
      const f = await request.formData();
      const archiving = path === "/client/archive";
      return act(() => archiveClient(env, f.get("id"), archiving, session), "/admin?view=clients",
        archiving ? "Client archived" : "Client restored");
    }

    // Log a contact-button tap (WhatsApp / Call / Email) as an activity event.
    // Fired as a beacon from the drawer and client-page quick actions; the
    // response is ignored by the caller.
    if (path === "/client/contact-log" && request.method === "POST") {
      const f = await request.formData();
      try { await logContactTap(env, f.get("id"), String(f.get("channel") || ""), session); } catch (e) { console.error("contact-log failed:", e.message); }
      return new Response("ok", { status: 200, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
    }

    // HTML fragment: the next page of match cards for the current filters (the
    // Matches "Load more" button), or one whole client group when ?cid= is set
    // (expanding a group whose cards sit beyond the current page). Session-scoped
    // exactly like the full view.
    if (path === "/admin/matches/chunk") {
      const sp = url.searchParams;
      const html = await matchesChunk(env, session, {
        f: sp.get("f") || "", soon: sp.get("soon") || "", group: sp.get("group") || "",
        offset: sp.get("offset") || "0", cid: sp.get("cid") || "",
      });
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...SECURITY_HEADERS } });
    }

    // Customer drawer fragment (HTML partial loaded by the admin shell's drawer).
    if (path === "/admin/drawer") {
      const frag = await clientDrawerFragment(env, url.searchParams.get("id"), session);
      return new Response(frag, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...SECURITY_HEADERS } });
    }

    // POST only: running every search can email/WhatsApp clients (auto-notify
    // wishlists), so a bare GET - link prefetch, bookmark, CSRF - must never
    // trigger it. POST also puts it behind the same-origin guard above.
    if (path === "/run" && request.method === "POST") {
      const ran = await runMatcher(env, session);
      // If auto sheet-reading is on (strong/all), catch up on a capped batch of
      // unread matches in the background so /run still redirects immediately.
      if (env.ANTHROPIC_API_KEY) {
        const s = await getSettings(env);
        if (s.ai_sheet_auto === "strong" || s.ai_sheet_auto === "all") {
          ctx.waitUntil(sweepUnreadSheets(env, s.ai_sheet_auto, s.ai_sheet_model));
        }
      }
      return Response.redirect(here(`/admin?view=matches&ran=${Number(ran) || 0}`), 303);
    }
    // Old GET bookmarks land on the Matches queue without running anything.
    if (path === "/run") return Response.redirect(here("/admin?view=matches"), 303);

    // One-click "Fix all photos": AI-read every un-read pending match in the
    // background, which tags each car's cover photo + sheet so the cards heal.
    // Admin only; gated by the API key.
    if (path === "/lot/fix-photos" && request.method === "POST") {
      if (session?.role !== "admin") return adminOnly();
      if (!env.ANTHROPIC_API_KEY) return Response.redirect(here("/admin?view=matches"), 303);
      const s = await getSettings(env);
      ctx.waitUntil(fixAllPhotos(env, s.ai_sheet_model));
      return Response.redirect(here("/admin?view=matches&fixing=1"), 303);
    }

    // AI auction-sheet reader: read one lot's inspection sheet and cache the
    // structured result onto the lot. Gated by the ANTHROPIC_API_KEY secret.
    if (path === "/lot/read-sheet" && request.method === "POST") {
      const f = await request.formData();
      const qid = Number(f.get("id"));
      const back = (err) => Response.redirect(here(`/admin?view=lot&id=${qid}${err ? `&err=${encodeURIComponent(err)}` : ""}`), 303);
      if (!Number.isInteger(qid) || qid <= 0) return adminOnly();
      const q = await env.DB.prepare("SELECT id, client_id, lot_json FROM queue WHERE id = ?").bind(qid).first();
      if (!q || !(await clientAccessibleBy(env, q.client_id, session))) return adminOnly();
      let lot = {};
      try { lot = JSON.parse(q.lot_json); } catch (e) {}
      const settings = await getSettings(env);
      // Pull the freshest image set first - the inspection sheet is often added
      // to a lot after we matched it, so the cached snapshot can lack it.
      const imagesChanged = await refreshLotImages(env, lot);
      const result = await readAuctionSheet(env, lot.images, settings.ai_sheet_model);
      if (result && !result.error) {
        lot._sheet = { ...result, read_at: new Date().toISOString() };
        await env.DB.prepare("UPDATE queue SET lot_json = ? WHERE id = ?").bind(JSON.stringify(lot), qid).run();
        return back();
      }
      // Even if the read failed, persist any refreshed images so the gallery updates.
      if (imagesChanged) {
        try { await env.DB.prepare("UPDATE queue SET lot_json = ? WHERE id = ?").bind(JSON.stringify(lot), qid).run(); } catch (e) {}
      }
      return back((result && result.error) || "Could not read the auction sheet.");
    }

    // Bulk approve/skip from the Matches view. Same per-item access rules as the
    // single /decide link; one failure never stops the batch.
    if (path === "/matches/bulk" && request.method === "POST") {
      const f = await request.formData();
      const action = f.get("action");
      const ids = f.getAll("ids").map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0);
      const back = f.get("back");
      const dest = (typeof back === "string" && back.startsWith("/admin")) ? back : "/admin?view=matches";
      if (!ids.length || !["approve", "reject", "delete"].includes(action)) {
        return Response.redirect(here(withNotice(dest, "Select at least one match first", true)), 303);
      }
      const n = ids.length, plural = n === 1 ? "match" : "matches";
      if (action === "delete") {
        return act(() => bulkDeleteMatches(env, ids, session), dest, `Deleted ${n} ${plural}`);
      }
      return act(() => applyBulkDecisions(env, action, ids, session), dest,
        action === "approve" ? `Sent ${n} ${plural} (one combined email per client)` : `Skipped ${n} ${plural}`);
    }

    // Snooze / wake a single match (IA-AUDIT item 12). Access and state rules
    // live in snoozeMatch; act() turns a throw into the standard failure notice.
    if (path === "/matches/snooze" && request.method === "POST") {
      const f = await request.formData();
      const id = f.get("id");
      const until = String(f.get("until") || "1d");
      const back = f.get("back");
      const dest = (typeof back === "string" && back.startsWith("/admin")) ? back : "/admin?view=matches";
      return act(() => snoozeMatch(env, id, until, session), dest,
        until === "clear" ? "Match is back in the review queue"
        : until === "close" ? "Snoozed until 24h before the auction closes"
        : "Snoozed until tomorrow");
    }

    if (path === "/client" && request.method === "POST") {
      const f = await request.formData();
      const r = await createClient(env, f, session);
      // Land on the new client's own page, not the dashboard: that's where the
      // "Add a search" / "Find a car" forms live, already tied to this client
      // (no client dropdown to re-pick, add-search open by default). Staff kept
      // adding the client, then not seeing where to add the car they want.
      if (r.ok) return Response.redirect(here(withNotice(`/admin?view=client&id=${r.id}`, "Client added, now add the car they're chasing below")), 303);
      if (r.error === "duplicate") return Response.redirect(here(`/admin?view=client&id=${r.id}&dup=1`), 303);
      // Validation error: bounce back with the submitted values so nothing the
      // user typed is lost.
      const qs = new URLSearchParams({ view: "intake", err: r.error || "save" });
      for (const k of ["name", "email", "whatsapp", "state", "category"]) {
        const v = String(f.get(k) || "").trim();
        if (v) qs.set("v_" + k, v);
      }
      return Response.redirect(here(`/admin?${qs.toString()}`), 303);
    }

    if (path === "/client/delete" && request.method === "POST") {
      const id = (await request.formData()).get("id");
      return act(() => deleteClient(env, id, session), "/admin?view=clients", "Client deleted");
    }

    // Edit a client's contact details (name, email, WhatsApp, state). Access and
    // validation are enforced inside updateClient; we just route the outcome back
    // to that client's page with a saved/error flag.
    if (path === "/client/update" && request.method === "POST") {
      const f = await request.formData();
      const id = Number(f.get("id")) || "";
      const r = await updateClient(env, f, session);
      if (r.ok) return Response.redirect(here(`/admin?view=client&id=${id}&saved=1`), 303);
      return Response.redirect(here(`/admin?view=client&id=${id}&cerr=${encodeURIComponent(r.error || "save")}`), 303);
    }

    // Staff add a lot they found via the in-client auction search to that client's
    // review queue. Access + dedupe enforced inside addLotToClient. We redirect
    // back to the same search (the "q" string) so the result list survives, with a
    // flash and a #find anchor to keep the user in place.
    if (path === "/client/find" && request.method === "POST") {
      const f = await request.formData();
      const id = Number(f.get("client_id")) || "";
      const r = await addLotToClient(env, id, f.get("lot_id"), session);
      const flash = r.ok ? (r.already ? "dup" : "added") : "err";
      // From the Auctions workspace, a `back` path returns to the same search.
      // The flash param must land BEFORE any #fragment (a client-page back
      // carries #find), or the server never sees it and the flash is lost.
      const back = String(f.get("back") || "");
      if (back.startsWith("/admin")) {
        const [backPath, backHash] = back.split("#");
        return Response.redirect(here(`${backPath}${backPath.includes("?") ? "&" : "?"}found=${flash}${backHash ? "#" + backHash : ""}`), 303);
      }
      // From a client's own page: keep the in-client search query and anchor.
      const q = String(f.get("q") || "").replace(/^[?&]+/, "");
      const base = `/admin?view=client&id=${id}&found=${flash}`;
      return Response.redirect(here(`${base}${q ? "&" + q : ""}#find`), 303);
    }

    // Bulk add-and-send from the auction-search surfaces (client page find
    // results + Auctions live tab): queue every selected lot for one client
    // and, in send mode, approve them via the bulk-decision path so the client
    // receives ONE combined email, not one per car.
    if (path === "/client/find/bulk" && request.method === "POST") {
      const f = await request.formData();
      const cid = Number(f.get("client_id")) || 0;
      const lotIds = f.getAll("lot_ids");
      const send = f.get("do") === "send";
      const ajax = f.get("ajax") === "1";
      const backRaw = String(f.get("back") || "");
      const dest = backRaw.startsWith("/admin") ? backRaw : `/admin?view=client&id=${cid}`;
      const jsonRes = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
      const fail = (msg, status = 400) => ajax ? jsonRes({ ok: false, error: msg }, status) : Response.redirect(here(withNotice(dest, msg, true)), 303);
      if (!cid) return fail("Choose a client first");
      if (!lotIds.length) return fail("Select at least one car first");
      try {
        const r = await addLotsToClient(env, cid, lotIds, session);
        if (!r.queued.length) return fail("Could not add those cars. Please try again.", 500);
        if (send) await applyBulkDecisions(env, "approve", r.queued, session);
        const n = r.queued.length;
        const msg = send
          ? `Sent ${n} car${n === 1 ? "" : "s"} in one combined message`
          : `Queued ${n} car${n === 1 ? "" : "s"} for review`;
        if (ajax) return jsonRes({ ok: true, queued: n, failed: r.failed, sent: send });
        return Response.redirect(here(withNotice(dest, msg + (r.failed ? ` (${r.failed} failed)` : ""))), 303);
      } catch (e) {
        console.error("/client/find/bulk failed:", e.message);
        return fail("Could not send those cars. Please try again.", 500);
      }
    }

    // Buyer portal access - enable + (re)send a set-password link, or revoke.
    // Owner/admin only (enforced inside the handlers).
    if (path === "/client/portal-invite" && request.method === "POST") {
      const id = (await request.formData()).get("id");
      const dest = `/admin?view=client&id=${Number(id) || ""}`;
      try {
        const r = await inviteClientPortal(env, id, session);
        if (r.ok && r.token) {
          await sendClientPortalInvite(env, r);
          return Response.redirect(here(withNotice(dest, `Set-password link emailed to ${r.email}`)), 303);
        }
        const msg = r.error === "no-email"
          ? "Add an email address for this client first, then invite them."
          : "Could not send the portal invite. Please try again.";
        return Response.redirect(here(withNotice(dest, msg, true)), 303);
      } catch (e) {
        console.error("/client/portal-invite failed:", e.message);
        return Response.redirect(here(withNotice(dest, "Could not send the portal invite. Please try again.", true)), 303);
      }
    }
    if (path === "/client/portal-revoke" && request.method === "POST") {
      const id = (await request.formData()).get("id");
      return act(() => revokeClientPortal(env, id, session), `/admin?view=client&id=${Number(id) || ""}`, "Portal access revoked");
    }
    // Admin-side "Send password reset" (V1.2 item 0.3): emails a 1-hour reset
    // link to an account that can already sign in. Distinct from the invite
    // buttons (which onboard accounts that have no password yet). Admin only.
    if (path === "/send-reset" && request.method === "POST") {
      if (session.role !== "admin") return adminOnly();
      const f = await request.formData();
      const kind = String(f.get("kind") || "");
      const id = Number(f.get("id")) || 0;
      const dest = kind === "client" ? `/admin?view=client&id=${id}`
        : kind === "dealer" ? "/admin?view=dealers"
        : "/admin?view=agents";
      try {
        const r = await beginPasswordResetFor(env, kind, id);
        if (r && r.token) {
          await sendEmail(env, {
            to: r.email,
            subject: "Reset your JDM Connect password",
            html: passwordResetHtml(r.name, `${env.PUBLIC_URL}/set-password?token=${r.token}`),
          });
          return Response.redirect(here(withNotice(dest, `Password reset link emailed to ${r.email}`)), 303);
        }
        return Response.redirect(here(withNotice(dest, "This account has no active login to reset - send an invite instead.", true)), 303);
      } catch (e) {
        console.error("/send-reset failed:", e.message);
        return Response.redirect(here(withNotice(dest, "Could not send the reset link. Please try again.", true)), 303);
      }
    }
    // Flip a client's paid-member flag (gates the auction page in their portal).
    // Admin only - membership is a paid feature; agents must never grant it.
    if (path === "/client/member" && request.method === "POST") {
      if (session.role !== "admin") return adminOnly();
      const f = await request.formData();
      const id = f.get("id");
      const on = f.get("member") === "1";
      return act(() => setClientMember(env, id, on, session), `/admin?view=client&id=${Number(id) || ""}`,
        on ? "Member access granted" : "Member access removed");
    }

    // Allocate clients to agents - admin only.
    if (path === "/client/assign" && request.method === "POST") {
      if (session.role !== "admin") return adminOnly();
      const f = await request.formData();
      return act(() => assignClient(env, f.get("client_id"), f.get("agent_id"), session), "/admin?view=clients", "Owner updated");
    }
    if (path === "/clients/bulk" && request.method === "POST") {
      if (session.role !== "admin") return adminOnly();
      const f = await request.formData();
      // The "Delete selected" button posts do=delete; Apply uses the action select.
      const action = f.get("do") === "delete" ? "delete" : f.get("action");
      const ids = f.getAll("ids");
      const n = ids.length;
      if (!n) return Response.redirect(here(withNotice("/admin?view=clients", "Tick at least one client first", true)), 303);
      // Delete reports its own outcome: agent-owned customers are protected
      // unless the admin ticked "Include agents' customers", so the notice has
      // to reflect how many were actually removed vs. skipped.
      if (action === "delete") {
        const includeAgents = f.get("confirm_agents") === "1";
        try {
          const res = await bulkAllocate(env, "delete", null, ids, session, includeAgents);
          const deleted = (res && res.deleted) || 0;
          const skipped = (res && res.skipped) || 0;
          const cust = (k) => `${k} ${k === 1 ? "customer" : "customers"}`;
          if (deleted === 0 && skipped === 0) {
            return Response.redirect(here(withNotice("/admin?view=clients", "No matching customers to delete.", true)), 303);
          }
          if (deleted === 0) {
            return Response.redirect(here(withNotice("/admin?view=clients", `Nothing deleted - all ${cust(skipped)} belong to an agent. Tick "Include agents' customers" to remove them.`, true)), 303);
          }
          const msg = skipped
            ? `Deleted ${cust(deleted)}; skipped ${skipped} owned by an agent (tick "Include agents' customers" to remove those too).`
            : `Deleted ${cust(deleted)}`;
          return Response.redirect(here(withNotice("/admin?view=clients", msg)), 303);
        } catch (e) {
          console.error("/clients/bulk delete failed:", e.message);
          return Response.redirect(here(withNotice("/admin?view=clients", "Sorry, that delete did not complete. Please try again.", true)), 303);
        }
      }
      const plural = n === 1 ? "client" : "clients";
      const okMsg = action === "archive" ? `Archived ${n} ${plural}`
        : action === "unarchive" ? `Restored ${n} ${plural}`
        : action === "share" ? `Shared ${n} ${plural}`
        : `Updated ${n} ${plural}`;
      return act(() => bulkAllocate(env, action, f.get("agent_id"), ids, session), "/admin?view=clients", okMsg);
    }

    // One-step new request: capture the customer AND the car in a single form,
    // then match-or-create the customer and add the wishlist in one go (staff
    // no longer create a client and then a search). Gated staff-only by the
    // section above (clients/dealers already diverted to their portals).
    if (path === "/request/new" && request.method === "POST") {
      const f = await request.formData();
      try {
        const r = await createAdminRequest(env, f, session);
        if (r && r.ok) {
          const msg = r.attached
            ? "Request added to the existing customer"
            : "New customer and request added";
          return Response.redirect(here(withNotice(`/admin?view=client&id=${r.clientId}`, msg)), 303);
        }
        // Validation error: bounce back to the one-step form, preserving input
        // (v_ prefixed params) so the fix is one field, not the whole form.
        const qs = new URLSearchParams({ view: "intake", err: (r && r.error) || "save" });
        for (const k of ["name", "email", "whatsapp", "state", "category", "label", "marka_name", "model_name", "year_min", "year_max", "price_max", "mileage_min", "mileage_max", "rate_min", "kuzov", "grade_kw"]) {
          const v = String(f.get(k) || "").trim();
          if (v) qs.set("v_" + k, v);
        }
        return Response.redirect(here(`/admin?${qs.toString()}`), 303);
      } catch (e) {
        console.error("/request/new failed:", e.message);
        return Response.redirect(here(withNotice("/admin?view=intake", "Could not add that request. Please try again.", true)), 303);
      }
    }

    if (path === "/wishlist" && request.method === "POST") {
      const f = await request.formData();
      const cid = f.get("client_id");
      const dest = cid ? `/admin?view=client&id=${cid}` : "/admin?view=clients";
      try {
        const r = await createWishlist(env, f, undefined, session);
        if (r && r.ok) return Response.redirect(here(withNotice(dest, "Search added")), 303);
        const msg = r && r.error === "term"
          ? "Add at least a make, model, chassis code or grade keyword so the search has something to match on."
          : r && r.error === "limit"
            ? "This client already has the maximum number of active searches. Pause or delete one first."
            : "Could not add that search. Please try again.";
        return Response.redirect(here(withNotice(dest, msg, true)), 303);
      } catch (e) {
        console.error("/wishlist failed:", e.message);
        return Response.redirect(here(withNotice(dest, "Could not add that search. Please try again.", true)), 303);
      }
    }

    if (path === "/wishlist/edit" && request.method === "POST") {
      const f = await request.formData();
      // Resolve the redirect target only if this session may actually see the
      // client, so a blocked edit never leaks a foreign client_id in the URL.
      return act(async () => {
        const r = await editWishlist(env, f, session);
        // A refused save (e.g. every narrowing term blanked) must surface as
        // the failure notice, not a false "Search updated".
        if (r && r.ok === false) throw new Error(r.error || "invalid");
      }, async () => {
        const w = await env.DB.prepare("SELECT client_id FROM wishlists WHERE id = ?").bind(Number(f.get("id"))).first();
        return (w && await clientAccessibleBy(env, w.client_id, session)) ? `/admin?view=client&id=${w.client_id}` : "/admin?view=clients";
      }, "Search updated");
    }

    // Helper: a search's edits/toggle/delete should return to its client page.
    const searchClientDest = async (id) => {
      const w = await env.DB.prepare("SELECT client_id FROM wishlists WHERE id = ?").bind(Number(id)).first();
      return (w && await clientAccessibleBy(env, w.client_id, session)) ? `/admin?view=client&id=${w.client_id}` : "/admin?view=clients";
    };

    if (path === "/wishlist/toggle" && request.method === "POST") {
      const id = (await request.formData()).get("id");
      const dest = await searchClientDest(id);
      return act(() => toggleWishlist(env, id, session), dest, "Search updated");
    }

    if (path === "/wishlist/delete" && request.method === "POST") {
      const id = (await request.formData()).get("id");
      const dest = await searchClientDest(id); // resolve before the row is gone
      return act(() => deleteWishlist(env, id, session), dest, "Search deleted");
    }

    // Agent management - admin only.
    if (path === "/agent" && request.method === "POST") {
      if (session.role !== "admin") return adminOnly();
      const f = await request.formData();
      try {
        const r = await createAgent(env, f);
        if (r && r.ok) {
          if (r.token) await sendInvite(env, r);
          return Response.redirect(here(withNotice("/admin?view=agents", "Agent added and invited")), 303);
        }
        // Keep the typed values on the re-render so the fix is one field, not
        // the whole form again.
        const qs = new URLSearchParams({ view: "agents" });
        for (const k of ["name", "email", "company"]) {
          const v = String(f.get(k) || "").trim();
          if (v) qs.set("v_" + k, v);
        }
        const msg = r && r.error === "email already in use"
          ? "That email is already an agent login. Use a different address."
          : "Could not create the agent. Check the name and email.";
        return Response.redirect(here(withNotice(`/admin?${qs.toString()}`, msg, true)), 303);
      } catch (e) {
        console.error("/agent failed:", e.message);
        return Response.redirect(here(withNotice("/admin?view=agents", "Could not create the agent. Please try again.", true)), 303);
      }
    }
    if (path === "/agent/invite" && request.method === "POST") {
      if (session.role !== "admin") return adminOnly();
      const id = (await request.formData()).get("id");
      return act(async () => {
        const r = await resendInvite(env, id);
        if (r) await sendInvite(env, r);
      }, "/admin?view=agents", "Invite re-sent");
    }
    if (path === "/agent/alerts" && request.method === "POST") {
      if (session.role !== "admin") return adminOnly();
      const id = (await request.formData()).get("id");
      return act(() => toggleAgentAlerts(env, id), "/admin?view=agents", "Alerts updated");
    }
    if (path === "/agent/toggle" && request.method === "POST") {
      if (session.role !== "admin") return adminOnly();
      const id = (await request.formData()).get("id");
      return act(() => toggleAgent(env, id), "/admin?view=agents", "Agent updated");
    }
    if (path === "/agent/delete" && request.method === "POST") {
      if (session.role !== "admin") return adminOnly();
      const id = (await request.formData()).get("id");
      return act(() => deleteAgent(env, id), "/admin?view=agents", "Agent deleted, along with their clients and history");
    }

    // Settings - admin only.
    if (path === "/settings" && request.method === "POST") {
      if (session.role !== "admin") return adminOnly();
      const f = await request.formData();
      return act(() => saveSettings(env, f), "/admin?view=settings", "Settings saved");
    }

    // Channel test-sends (IA-AUDIT item 18): verify email / WhatsApp config by
    // messaging yourself instead of a real client. Admin only.
    if (path === "/settings/test-email" && request.method === "POST") {
      if (session.role !== "admin") return adminOnly();
      const settings = await getSettings(env).catch(() => ({}));
      const to = digestRecipient(env, settings);
      return act(async () => {
        if (!to) throw new Error("no alert email configured");
        await sendEmail(env, {
          to,
          subject: "JDMFinder test email",
          html: "<p>This is a test from JDMFinder Settings. If you are reading it, email alerts are wired up.</p>",
        });
      }, "/admin?view=settings", `Test email sent${to ? ` to ${to}` : ""}`);
    }
    if (path === "/settings/test-whatsapp" && request.method === "POST") {
      if (session.role !== "admin") return adminOnly();
      const f = await request.formData();
      const to = String(f.get("to") || "").trim();
      const settings = await getSettings(env).catch(() => ({}));
      return act(async () => {
        if (!to) throw new Error("no test number");
        await sendWhatsApp(env, to, {
          name: "there",
          summary: "This is a test from JDMFinder Settings. Your WhatsApp channel is wired up.",
          url: env.PUBLIC_URL || "",
        }, settings);
      }, "/admin?view=settings", "Test WhatsApp sent");
    }

    // Client sharing - owner or admin (enforced in the handlers).
    if (path === "/share" && request.method === "POST") {
      const f = await request.formData();
      return act(() => shareClient(env, f.get("client_id"), f.get("agent_id"), session), "/admin?view=clients", "Client shared");
    }
    if (path === "/share/remove" && request.method === "POST") {
      const f = await request.formData();
      return act(() => unshareClient(env, f.get("client_id"), f.get("agent_id"), session), "/admin?view=clients", "Share removed");
    }

    return doc(notFoundPage(), 404);
  },
};

// --------------------------------------------------------------------------
// Client (buyer) portal request handling. Reached only for a client session;
// every action is scoped to session.id inside the admin.js handlers.
// --------------------------------------------------------------------------
async function handleClientPortal(request, env, url, path, session, here) {
  const back = (q = "") => Response.redirect(here("/portal" + q), 303);

  if (path === "/portal" && request.method === "GET") {
    const code = url.searchParams.get("ok");
    const err = url.searchParams.get("err");
    const flash =
      code === "requested" ? "Thanks - we've got it. We'll pull the auction sheet, translate it, and come back to you." :
      code === "paid" ? "Payment received - thank you. We'll be in touch with the next steps." :
      code === "member" ? "You're in - Full access is now active on your account." :
      code === "saved" ? "Saved." :
      err === "pay" ? "Sorry, we couldn't start that payment. Please try again or contact us." :
      err === "sub" ? "Sorry, we couldn't start that just now. Please try again or contact us." :
      err === "freelimit" ? "Free accounts run one active search at a time. Pause or delete your current search to swap it, or upgrade to Full access for unlimited searches." :
      err === "searchcap" ? "You've reached the maximum number of active searches. Pause or delete one first." :
      err === "save" ? "We couldn't save that search. Add at least a make, model or chassis code so we know what to look for." : "";
    return doc(await portalPage(env, session, { flash }));
  }

  // Member-only auction search page + request-a-lot action. The full query
  // bag goes through: every filter is validated inside validateLiveParams
  // (shared engine) before it can reach SQL. rates / houses / unspec are
  // checkbox multi-selects, so getAll() keeps every ticked value where
  // Object.fromEntries would keep only the last repeated param.
  if (path === "/portal/auctions" && request.method === "GET") {
    const sp = url.searchParams;
    const params = {
      ...Object.fromEntries(sp),
      rates: sp.getAll("rates").join(","),
      houses: sp.getAll("houses").join(","),
      unspec: sp.getAll("unspec"),
      tab: sp.get("tab") || "live", view: sp.get("view") || "grid",
      _flash: sp.get("_flash") || "",
    };
    return doc(await portalAuctionsPage(env, session, params));
  }
  if (path === "/portal/auctions/lot" && request.method === "GET") {
    // Full detail page for a single live lot (auctionLotPage re-checks membership).
    return doc(await auctionLotPage(env, session, url.searchParams.get("id")));
  }
  // Member-only Auction History: sold-price history with the full filter set
  // (docs/auction-history.md). Params come straight off the URL; every value
  // is validated inside validateHistoryParams before it can reach SQL.
  if (path === "/portal/history" && request.method === "GET") {
    // rates is a checkbox multi-select: getAll() keeps every ticked score
    // where Object.fromEntries would keep only the last repeated param.
    return doc(await auctionHistoryPage(env, session, {
      ...Object.fromEntries(url.searchParams),
      rates: url.searchParams.getAll("rates").join(","),
      houses: url.searchParams.getAll("houses").join(","),
      unspec: url.searchParams.getAll("unspec"),
    }));
  }
  if (path === "/portal/sold" && request.method === "GET") {
    // Superseded by Auction History: one destination for sold-price data.
    // Old bookmarks land there; make/model/house are the only params with a
    // history equivalent (validateHistoryParams drops anything unrecognised).
    const carry = new URLSearchParams();
    for (const k of ["make", "model", "house"]) {
      const v = (url.searchParams.get(k) || "").trim();
      if (v) carry.set(k, v);
    }
    const qs = carry.toString();
    return Response.redirect(here("/portal/history" + (qs ? "?" + qs : "")), 301);
  }
  // Server-side watchlist sync (launch audit: hearts were per-device only).
  // GET returns the member's saved lots as {lotId: snapshot}; POST accepts
  // {add:[snapshot...], remove:[lotId...]} from the shared watch script. The
  // client keeps localStorage as its cache, so this degrades gracefully.
  if (path === "/portal/watchlist" && request.method === "GET") {
    const rows = (await env.DB.prepare("SELECT lot_id, snapshot FROM watchlist_items WHERE client_id = ? ORDER BY id").bind(Number(session.id)).all()).results || [];
    const map = {};
    for (const r of rows) { try { map[r.lot_id] = JSON.parse(r.snapshot); } catch (e) {} }
    return new Response(JSON.stringify(map), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
  }
  if (path === "/portal/watchlist" && request.method === "POST") {
    const cid = Number(session.id);
    let body = {}; try { body = await request.json(); } catch (e) {}
    const adds = Array.isArray(body.add) ? body.add.slice(0, 100) : [];
    const removes = Array.isArray(body.remove) ? body.remove.slice(0, 100) : [];
    const WATCH_CAP = 200, SNAP_MAX = 2000, ID_MAX = 64;
    const stmts = [];
    for (const raw of removes) {
      const id = String(raw || "").slice(0, ID_MAX);
      if (id) stmts.push(env.DB.prepare("DELETE FROM watchlist_items WHERE client_id = ? AND lot_id = ?").bind(cid, id));
    }
    const have = (await env.DB.prepare("SELECT COUNT(*) AS n FROM watchlist_items WHERE client_id = ?").bind(cid).first())?.n || 0;
    let room = Math.max(0, WATCH_CAP - have + removes.length);
    for (const s of adds) {
      if (room <= 0) break;
      const id = String(s && s.id || "").slice(0, ID_MAX);
      if (!id) continue;
      const snapshot = JSON.stringify(s);
      if (snapshot.length > SNAP_MAX) continue;
      stmts.push(env.DB.prepare(
        "INSERT INTO watchlist_items (client_id, lot_id, snapshot) VALUES (?, ?, ?) ON CONFLICT(client_id, lot_id) DO UPDATE SET snapshot = excluded.snapshot"
      ).bind(cid, id, snapshot));
      room--;
    }
    if (stmts.length) await env.DB.batch(stmts);
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
  }

  if (path === "/portal/auctions/request" && request.method === "POST") {
    const c = await env.DB.prepare("SELECT * FROM clients WHERE id = ? AND portal_enabled = 1").bind(Number(session.id)).first();
    if (!c || !c.member) return Response.redirect(here("/portal/auctions"), 303);
    const r = await requestAuctionLot(env, c.id, (await request.formData()).get("id"));
    if (r.ok && !r.already) {
      await alertClientRequest(env, { client: c, lot: r.lot, wishlist: null });
      await sendPush(env, { title: "Member requested a car", message: `${c.name} requested ${[r.lot.year, r.lot.marka_name, r.lot.model_name].filter(Boolean).join(" ")}`.trim(), url: `${env.PUBLIC_URL}/admin?view=client&id=${c.id}` });
    }
    const msg = !r.ok
      ? (r.error === "sold"
        ? "That car has already sold at auction, so we can't bid on it. Search the live feed and we'll chase the next one."
        : "Sorry, we couldn't fetch that lot - please try again.")
      : r.already ? "You've already requested this car - we're on it." : "Requested! We'll chase this car and be in touch.";
    return Response.redirect(here("/portal/auctions?_flash=" + encodeURIComponent(msg)), 303);
  }

  if (path === "/portal/wishlist" && request.method === "POST") {
    const r = await portalAddWishlist(env, await request.formData(), session);
    if (r && r.error === "free_limit") return back("?err=freelimit");
    if (r && r.error === "limit") return back("?err=searchcap");
    // "Saved." only when a row was actually written - any other failure
    // (no search criteria, inactive client) must not flash success.
    if (!r || !r.ok) return back("?err=save");
    return back("?ok=saved");
  }
  if (path === "/portal/wishlist/edit" && request.method === "POST") {
    const r = await portalEditWishlist(env, await request.formData(), session);
    // A refused save (blanked search, foreign row) must not flash success.
    if (!r || !r.ok) return back("?err=save");
    return back("?ok=saved");
  }
  if (path === "/portal/wishlist/toggle" && request.method === "POST") {
    await portalToggleWishlist(env, await request.formData(), session);
    return back();
  }
  if (path === "/portal/wishlist/delete" && request.method === "POST") {
    await portalDeleteWishlist(env, await request.formData(), session);
    return back();
  }

  // Buyer asks us to action/translate a car - flag it and alert staff (once).
  if (path === "/portal/approve" && request.method === "POST") {
    const queueId = (await request.formData()).get("queue_id");
    const r = await portalApprove(env, queueId, session);
    if (r.ok && !r.alreadyDone) await alertClientRequest(env, r);
    return back("?ok=requested");
  }

  // Start a Stripe Checkout deposit for a car (config-gated).
  if (path === "/portal/pay" && request.method === "POST") {
    const queueId = Number((await request.formData()).get("queue_id")) || null;
    return startDepositCheckout(env, session, queueId, here);
  }
  if (path === "/portal/pay/success") return back("?ok=paid");
  if (path === "/portal/pay/cancel") return back();

  // Start (or manage) the Full access monthly membership.
  // A GET (typed URL, shared link, prefetch) lands on a real page: the plan
  // and a subscribe button when purchasable, an honest note when not
  // (V1.3 Phase C: the old behaviour was a bare 303 back to /portal).
  if (path === "/portal/subscribe" && request.method === "GET") {
    const settings = await getSettings(env);
    const priceAud = settingNum(settings, "membership_monthly_aud", 49);
    const me = await env.DB.prepare("SELECT member FROM clients WHERE id = ?").bind(session.id).first();
    if (me && me.member) return back("?ok=member");
    const purchasable = stripeConfigured(env) && settingOn(settings, "membership_enabled") && priceAud > 0;
    if (!purchasable) {
      return doc(infoPage("Full access", "Full access isn't available to buy online just yet. Message us and we'll set you up directly.", { cta: { href: "/portal", label: "Back to your garage" } }));
    }
    return doc(infoPage("Full access",
      `Unlimited saved searches, the live auction floor and landed pricing on every lot. A$${priceAud} a month, cancel anytime.<br><br>
       <form method="POST" action="/portal/subscribe" style="display:inline"><button class="btn-primary" type="submit">Subscribe now</button></form>`,
      { html: true, cta: { href: "/portal", label: "Back to your garage", secondary: true } }));
  }
  if (path === "/portal/subscribe" && request.method === "POST") {
    return startSubscriptionCheckout(env, session, here);
  }
  if (path === "/portal/billing" && request.method === "POST") {
    return startBillingPortal(env, session, here);
  }
  if (path === "/portal/subscribe/success") return back("?ok=member");
  if (path === "/portal/subscribe/cancel") return back();

  // Anything else for a client → their dashboard.
  return Response.redirect(here("/portal"), 303);
}

// Start a Stripe subscription Checkout for the Full access membership and
// redirect the buyer to Stripe. Config-gated; falls back to the portal on error.
async function startSubscriptionCheckout(env, session, here) {
  try {
    const settings = await getSettings(env);
    const priceAud = settingNum(settings, "membership_monthly_aud", 0);
    if (!stripeConfigured(env) || !settingOn(settings, "membership_enabled") || !(priceAud > 0)) {
      return Response.redirect(here("/portal?err=sub"), 303);
    }
    const client = await env.DB.prepare("SELECT * FROM clients WHERE id = ?").bind(session.id).first();
    if (!client) return Response.redirect(here("/portal?err=sub"), 303);
    if (client.member) return Response.redirect(here("/portal"), 303); // already a member
    const { url } = await createSubscriptionCheckout(env, {
      client,
      amountCents: Math.round(priceAud * 100),
      currency: (settings.stripe_currency || "aud").toLowerCase(),
      successUrl: here("/portal/subscribe/success"),
      cancelUrl: here("/portal/subscribe/cancel"),
    });
    return Response.redirect(url, 303);
  } catch (err) {
    console.error("Stripe subscription checkout failed:", err.message);
    return Response.redirect(here("/portal?err=sub"), 303);
  }
}

// Open the Stripe Billing Portal so a member can manage or cancel their plan.
async function startBillingPortal(env, session, here) {
  try {
    const client = await env.DB.prepare("SELECT stripe_customer_id FROM clients WHERE id = ?").bind(session.id).first();
    if (!stripeConfigured(env) || !client || !client.stripe_customer_id) {
      return Response.redirect(here("/portal?err=sub"), 303);
    }
    const { url } = await createBillingPortalSession(env, {
      customerId: client.stripe_customer_id,
      returnUrl: here("/portal"),
    });
    return Response.redirect(url, 303);
  } catch (err) {
    console.error("Stripe billing portal failed:", err.message);
    return Response.redirect(here("/portal?err=sub"), 303);
  }
}

// Create a Stripe Checkout Session for the configured deposit and redirect the
// buyer to Stripe. Falls back to the portal with an error flag on any problem.
async function startDepositCheckout(env, session, queueId, here) {
  try {
    const settings = await getSettings(env);
    const depositAud = Number(settings.stripe_deposit_aud || 0);
    if (!stripeConfigured(env) || !settingOn(settings, "stripe_enabled") || !(depositAud > 0)) {
      return Response.redirect(here("/portal?err=pay"), 303);
    }
    const client = await env.DB.prepare("SELECT * FROM clients WHERE id = ?").bind(session.id).first();
    if (!client) return Response.redirect(here("/portal?err=pay"), 303);
    // Only attach a queue_id the signed-in client actually owns. A client must
    // never be able to reference another client's match on their payment row.
    if (queueId) {
      const owns = await env.DB.prepare("SELECT 1 FROM queue WHERE id = ? AND client_id = ?").bind(queueId, session.id).first();
      if (!owns) queueId = null;
    }
    const { url: checkoutUrl } = await createCheckoutSession(env, {
      client,
      queueId,
      amountCents: Math.round(depositAud * 100),
      currency: (settings.stripe_currency || "aud").toLowerCase(),
      description: `JDM Connect deposit${queueId ? " (ref " + queueId + ")" : ""}`,
      successUrl: here("/portal/pay/success"),
      cancelUrl: here("/portal/pay/cancel"),
    });
    return Response.redirect(checkoutUrl, 303);
  } catch (err) {
    console.error("Stripe checkout failed:", err.message);
    return Response.redirect(here("/portal?err=pay"), 303);
  }
}

// Email a client their portal set-password link. `r` is { token, email, name }.
async function sendClientPortalInvite(env, r) {
  try {
    await sendEmail(env, {
      to: r.email,
      subject: "Your JDM Connect portal - set your password",
      html: clientPortalInviteHtml(r.name, `${env.PUBLIC_URL}/set-password?token=${r.token}`),
      from: env.MAIL_FROM_CLIENT || env.MAIL_FROM_INTERNAL || env.MAIL_FROM,
    });
  } catch (err) {
    console.error("Client portal invite email failed:", err.message);
  }
}

// Alert staff that a client asked us to action a specific car (from the portal).
async function alertClientRequest(env, info) {
  try {
    const settings = await getSettings(env);
    const title = `${info.lot.year || ""} ${info.lot.marka_name || ""} ${info.lot.model_name || ""}`.trim();
    await sendEmail(env, {
      to: digestRecipient(settings, env),
      subject: `${info.client?.name || "A client"} requested ${title || "a car"}`,
      html: clientRequestAlertHtml(info.client, info.lot, info.wishlist, env.PUBLIC_URL),
    });
  } catch (err) {
    console.error("Client request alert failed:", err.message);
  }
}

// Email an agent their set-password / reset link. `r` is { token, email, name }.
async function sendInvite(env, r) {
  try {
    await sendEmail(env, {
      to: r.email,
      subject: "Set up your JDM Connect Vehicle Finder login",
      html: agentInviteHtml(r.name, `${env.PUBLIC_URL}/set-password?token=${r.token}`),
    });
  } catch (err) {
    console.error("Agent invite email failed:", err.message);
  }
}

async function sendDealerInvite(env, r) {
  try {
    await sendEmail(env, {
      to: r.email,
      subject: "Set up your Dealer Portal login",
      html: dealerInviteHtml(r.name, `${env.PUBLIC_URL}/set-password?token=${r.token}`),
    });
  } catch (err) {
    console.error("Dealer invite email failed:", err.message);
  }
}

// Email the admin alert address when a customer submits the public request form
// (respects the "Email me new vehicle requests" Settings toggle).
async function alertNewRequest(env, req) {
  try {
    const settings = await getSettings(env);
    if (!settingOn(settings, "request_alerts")) return;
    await sendEmail(env, {
      to: digestRecipient(settings, env),
      subject: `New vehicle request - ${req.name}`,
      html: requestAlertHtml(req, env.PUBLIC_URL),
    });
  } catch (err) {
    console.error("New-request alert failed:", err.message);
  }
  // Phone chime (Pushover/ntfy) so a new lead pings you anywhere, even with the
  // site closed. No-ops until a push provider secret is set; never blocks.
  const want = [req.marka_name, req.model_name].filter(Boolean).join(" ").trim();
  // PII stays out of the push body (Pushover/ntfy/Telegram store messages on
  // their servers): name + vehicle identify the lead; details live behind the
  // admin link.
  await sendPush(env, {
    title: "New JDM Finder signup",
    message: `${req.name || "Someone"}${want ? " wants " + want : ""}`,
    url: `${env.PUBLIC_URL}/admin?view=clients`,
  });
}

// Email the buyer a confirmation receipt with their reference (Fix 7). Only
// possible because Fix 1 guarantees a contact method; skipped if it's WhatsApp
// only (no email on file). Never blocks the submission on a mail failure.
async function confirmRequest(env, req, ref) {
  try {
    if (!req || !req.email) return;
    await sendEmail(env, {
      to: req.email,
      subject: `We have your JDM request${req.name && req.name !== "-" ? ", " + String(req.name).trim().split(/\s+/)[0] : ""} (ref ${ref})`,
      html: requestConfirmationHtml(req, ref, env.PUBLIC_URL),
      from: env.MAIL_FROM_CLIENT || env.MAIL_FROM_INTERNAL || env.MAIL_FROM,
    });
  } catch (err) {
    console.error("Request confirmation email failed:", err.message);
  }
}

// Run the matcher (scoped to the session's agent, if any) and route the digest.
// Agents review their own matches in-app, so their manual "Search auctions" run
// emails nobody. For admin/cron runs, each match is grouped by its owning agent:
// that agent is alerted (if their alerts are on) and everything not owned by an
// agent goes to the admin alert address.
async function runMatcher(env, session) {
  const summary = await runAll(env, session);
  const total = summary.reduce((n, s) => n + s.queued.length, 0);
  if (total === 0) return 0;
  if (session && session.role === "agent") return total;

  const settings = await getSettings(env);
  const groups = new Map(); // key -> { agent|null, entries }
  for (const entry of summary) {
    const aid = entry.wishlist.client_agent_id;
    // A paused agent is not emailed; their clients' matches fold into the admin
    // digest so nothing is silently dropped.
    const toAgent = aid && entry.wishlist.agent_active;
    const key = toAgent ? `agent:${aid}` : "admin";
    if (!groups.has(key)) {
      groups.set(key, {
        agent: toAgent ? { email: entry.wishlist.agent_email, name: entry.wishlist.agent_name, alerts: entry.wishlist.agent_alerts } : null,
        entries: [],
      });
    }
    groups.get(key).entries.push(entry);
  }

  for (const { agent, entries } of groups.values()) {
    const n = entries.reduce((s, e) => s + e.queued.length, 0);
    const to = agent ? agent.email : digestRecipient(settings, env);
    if (agent ? (!agent.email || !agent.alerts) : !settingOn(settings, "email_alerts")) continue;
    try {
      await sendEmail(env, {
        to,
        subject: agent
          ? `${n} new auction match${n === 1 ? "" : "es"} for your clients`
          : `${n} new auction match${n === 1 ? "" : "es"} to review`,
        html: digestHtml(entries, env.PUBLIC_URL),
      });
    } catch (err) {
      console.error(`Digest email failed (${to}):`, err.message);
    }
  }
  return total;
}

// --------------------------------------------------------------------------
// Dealer portal request handling. Reached only for a dealer session;
// dealers submit vehicles for admin review.
// --------------------------------------------------------------------------
async function handleDealerPortal(request, env, url, path, session, here) {
  const back = (q = "") => Response.redirect(here("/dealer/portal" + q), 303);

  if (path === "/dealer/portal" && request.method === "GET") {
    // active = 1: a deactivated dealer's still-valid cookie must not keep
    // working (same guard as /dealer/history below).
    const dealer = await env.DB.prepare("SELECT id, name, company, email FROM dealers WHERE id = ? AND active = 1").bind(session.id).first();
    if (!dealer) return Response.redirect(here("/login"), 303);
    let flash = "";
    if (url.searchParams.get("ok") === "submitted") {
      flash = "Thanks! Your vehicle has been submitted for review. We'll notify you once the admin approves it.";
    }
    const err = url.searchParams.get("err");
    if (err) {
      flash = `Error: ${err}`;
    }
    const html = await dealerPortalPage(env, dealer, flash);
    return doc(html, 200);
  }

  // Auction history / sold prices, read-only for dealers. Params are raw off
  // the URL; validateHistoryParams coerces everything before SQL. rates is a
  // checkbox multi-select: getAll() keeps every ticked score.
  if (path === "/dealer/history" && request.method === "GET") {
    const dealer = await env.DB.prepare("SELECT id, name, company, email FROM dealers WHERE id = ? AND active = 1").bind(session.id).first();
    if (!dealer) return Response.redirect(here("/login"), 303);
    const html = await dealerHistoryPage(env, dealer, {
      ...Object.fromEntries(url.searchParams),
      rates: url.searchParams.getAll("rates").join(","),
      houses: url.searchParams.getAll("houses").join(","),
      unspec: url.searchParams.getAll("unspec"),
    });
    return doc(html, 200);
  }

  if (path === "/dealer/vehicle/submit" && request.method === "POST") {
    const f = await request.formData();
    const result = await submitDealerVehicle(env, f, session);
    if (result.ok) {
      return Response.redirect(here("/dealer/portal?ok=submitted"), 303);
    }
    return Response.redirect(here(`/dealer/portal?err=${encodeURIComponent(result.error || "save")}`), 303);
  }

  // Anything else for a dealer → their portal.
  return Response.redirect(here("/dealer/portal"), 303);
}

// Handle an approve/skip click from the digest or the in-app cards. When called
// with &ajax=1 (an in-app fetch), it returns a tiny 200/4xx instead of
// redirecting, so the card is removed in place with no full-page reload.
async function handleDecision(request, env, url) {
  if (request.method !== "POST") {
    return new Response("method not allowed", { status: 405, headers: { Allow: "POST" } });
  }
  let form;
  try {
    form = await request.formData();
  } catch (e) {
    form = new FormData();
  }
  const param = (name) => {
    const value = form.get(name);
    return value == null || value === "" ? url.searchParams.get(name) : String(value);
  };
  const token = param("token");
  const action = param("action");
  const ajax = param("ajax") === "1";
  const ok200 = () => new Response("ok", { status: 200, headers: { "Content-Type": "text/plain" } });
  if (!token || !["approve", "reject"].includes(action)) {
    return ajax ? new Response("invalid", { status: 400 }) : doc(infoPage("Invalid link", "That approve or skip link is not valid."), 400);
  }

  // If the click came from inside the app (signed-in session), return to where
  // the user was - an optional &return= path (e.g. the client they were on),
  // falling back to the Matches view. Email links (no session) get a simple
  // confirmation page instead.
  const session = await getSession(request, url, env);
  const backToApp = !!session;
  const ret = param("return");
  const dest = (typeof ret === "string" && ret.startsWith("/admin")) ? ret : "/admin?view=matches";
  const toMatches = () => Response.redirect(new URL(dest, url).toString(), 303);

  const item = await env.DB.prepare("SELECT * FROM queue WHERE token = ?").bind(token).first();
  if (!item) return ajax ? ok200() : doc(infoPage("Item not found", "This match no longer exists."), 404);
  // A signed-in agent may only act on their own clients' matches. Email links
  // (no session) are authorised by the unguessable token itself.
  if (session && session.role === "agent" && !(await clientAccessibleBy(env, item.client_id, session))) {
    return ajax ? new Response("forbidden", { status: 403 }) : (backToApp ? toMatches() : doc(infoPage("Item not found", "This match no longer exists."), 404));
  }
  if (item.status !== "pending") {
    return ajax ? ok200() : (backToApp ? toMatches() : doc(infoPage("Already handled", `This match was already handled (status: ${item.status}).`)));
  }

  if (action === "reject") {
    const reason = (param("reason") || "").slice(0, 80) || null;
    await env.DB.prepare(
      "UPDATE queue SET status = 'rejected', reason = ?, decided_at = datetime('now') WHERE id = ?"
    ).bind(reason, item.id).run();
    return ajax ? ok200() : (backToApp ? toMatches() : doc(infoPage("Skipped", "Skipped. The client will not be contacted about this car.")));
  }

  // Approve. Watch-only "lead" wishlists never email the client - the match is
  // just marked handled so staff can follow up by phone instead.
  const client = await env.DB.prepare("SELECT * FROM clients WHERE id = ?").bind(item.client_id).first();
  const wishlist = await env.DB.prepare(
    "SELECT w.*, c.name AS client_name FROM wishlists w JOIN clients c ON c.id = w.client_id WHERE w.id = ?"
  ).bind(item.wishlist_id).first();
  if (wishlist && wishlist.watch_only) {
    await env.DB.prepare(
      "UPDATE queue SET status = 'sent', decided_at = datetime('now') WHERE id = ?"
    ).bind(item.id).run();
    await recordMatchSent(env, item.id, session);
    return ajax ? ok200() : (backToApp ? toMatches() : doc(infoPage("Marked for follow-up", "Marked for follow-up. The client was not emailed because this is a watch-only lead.")));
  }
  const lot = JSON.parse(item.lot_json);
  try {
    const r = await deliverToClient(env, client, lot, wishlist);
    await env.DB.prepare(
      "UPDATE queue SET status = 'sent', decided_at = datetime('now') WHERE id = ?"
    ).bind(item.id).run();
    await recordMatchSent(env, item.id, session);
    if (ajax) return ok200();
    if (backToApp) return toMatches();
    const channels = [r.email && "email", r.whatsapp && "WhatsApp"].filter(Boolean).join(" + ") || "no channel (client has no contact set)";
    return doc(infoPage("Approved and sent", `Approved and sent to ${client?.name || "the client"} via ${channels}.`));
  } catch (err) {
    await env.DB.prepare(
      "UPDATE queue SET status = 'failed', decided_at = datetime('now') WHERE id = ?"
    ).bind(item.id).run();
    console.error("Approve delivery failed:", err.message);
    return ajax ? new Response("send failed", { status: 500 }) : doc(infoPage("Delivery failed", "Approved, but the message could not be delivered. Please try again or contact support."), 500);
  }
}

// Hard-delete selected matches from the queue (the Matches "Delete" bulk action
// - "start fresh"). Unlike Skip/reject, which keeps the row as 'rejected', this
// removes the rows entirely. Same per-item agent access check as reject; one
// failure never stops the batch.
async function bulkDeleteMatches(env, ids, session) {
  for (const id of ids) {
    try {
      const item = await env.DB.prepare("SELECT client_id FROM queue WHERE id = ?").bind(id).first();
      if (!item) continue;
      if (session && session.role === "agent" && !(await clientAccessibleBy(env, item.client_id, session))) continue;
      await env.DB.prepare("DELETE FROM queue WHERE id = ?").bind(id).run();
    } catch (err) {
      console.error(`Bulk delete failed (queue ${id}):`, err.message);
    }
  }
}

// Apply approve/reject to many queued matches at once (the Matches bulk bar).
// Keeps the agent per-item access check and isolates failures. On approve, all
// of one client's selected cars go out in a SINGLE combined email rather than
// one per car - so picking 10 cars for a client sends them one email, not ten.
async function applyBulkDecisions(env, action, ids, session) {
  if (action === "reject") {
    for (const id of ids) {
      try {
        const item = await env.DB.prepare("SELECT * FROM queue WHERE id = ?").bind(id).first();
        if (!item || item.status !== "pending") continue;
        if (session && session.role === "agent" && !(await clientAccessibleBy(env, item.client_id, session))) continue;
        await env.DB.prepare("UPDATE queue SET status = 'rejected', decided_at = datetime('now') WHERE id = ?").bind(item.id).run();
      } catch (err) {
        console.error(`Bulk reject failed (queue ${id}):`, err.message);
      }
    }
    return;
  }

  // Approve: collect deliverable cars grouped by client; watch-only leads are
  // marked handled without emailing (matches the single-decision behaviour).
  const byClient = new Map(); // client_id -> { client, rows:[{ item, lot, wishlist }] }
  const watchOnly = [];
  for (const id of ids) {
    try {
      const item = await env.DB.prepare("SELECT * FROM queue WHERE id = ?").bind(id).first();
      if (!item || item.status !== "pending") continue;
      if (session && session.role === "agent" && !(await clientAccessibleBy(env, item.client_id, session))) continue;
      const wishlist = await env.DB.prepare(
        "SELECT w.*, c.name AS client_name FROM wishlists w JOIN clients c ON c.id = w.client_id WHERE w.id = ?"
      ).bind(item.wishlist_id).first();
      if (wishlist && wishlist.watch_only) { watchOnly.push(item); continue; }
      let lot = {}; try { lot = JSON.parse(item.lot_json); } catch (e) {}
      if (!byClient.has(item.client_id)) {
        const client = await env.DB.prepare("SELECT * FROM clients WHERE id = ?").bind(item.client_id).first();
        byClient.set(item.client_id, { client, rows: [] });
      }
      byClient.get(item.client_id).rows.push({ item, lot, wishlist });
    } catch (err) {
      console.error(`Bulk approve prep failed (queue ${id}):`, err.message);
    }
  }

  for (const item of watchOnly) {
    try {
      await env.DB.prepare("UPDATE queue SET status = 'sent', decided_at = datetime('now') WHERE id = ?").bind(item.id).run();
      await recordMatchSent(env, item.id, session);
    } catch (err) {
      console.error(`Bulk watch-only mark failed (queue ${item.id}):`, err.message);
    }
  }

  for (const { client, rows } of byClient.values()) {
    const setStatus = (st) => env.DB.batch(rows.map(({ item }) =>
      env.DB.prepare("UPDATE queue SET status = ?, decided_at = datetime('now') WHERE id = ?").bind(st, item.id)));
    try {
      await deliverManyToClient(env, client, rows.map(({ lot, wishlist }) => ({ lot, wishlist })));
      await setStatus("sent");
      for (const { item } of rows) { try { await recordMatchSent(env, item.id, session); } catch (e) { /* best effort */ } }
    } catch (err) {
      console.error(`Bulk delivery failed (client ${client?.id}):`, err.message);
      try { await setStatus("failed"); } catch (e) { /* best effort */ }
    }
  }
}

// Baseline browser security headers for every HTML response (audit: no CSP /
// X-Frame-Options / HSTS / nosniff anywhere). The CSP allows exactly what the
// pages use today: inline scripts and styles (no nonces yet), Google Fonts,
// GTM + Meta Pixel, and https images (auction photos come from many external
// hosts). frame-ancestors 'none' + X-Frame-Options stop the login/portal/pay
// flows being framed for clickjacking.
const SECURITY_HEADERS = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://*.google-analytics.com https://connect.facebook.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://www.facebook.com",
    "frame-src https://www.googletagmanager.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
  ].join("; "),
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

// Return a complete HTML document as-is (used for the full-page admin/request UIs
// and the branded standalone info / 404 pages from theme.js).
function doc(htmlString, status = 200, extraHeaders = null) {
  return new Response(htmlString, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...SECURITY_HEADERS, ...(extraHeaders || {}) },
  });
}
