// JDM Vehicle Finder - Cloudflare Worker entry point.
//
// scheduled(): runs the matcher on the cron schedule, queues new matches,
//   emails you a digest with approve/skip links.
// fetch(): serves the admin UI, the manual "run now" trigger, the form posts,
//   and the approve/skip decision links from the digest.

import { runAll } from "./matcher.js";
import { digestHtml, agentInviteHtml, requestAlertHtml, requestConfirmationHtml, clientPortalInviteHtml, clientRequestAlertHtml } from "./render.js";
import { sendEmail, deliverToClient, deliverManyToClient, sendPush } from "./notify.js";
import { adminPage, requestPage, loginPage, setPasswordPage, createClient, createWishlist, createRequest, deleteClient, deleteWishlist, toggleWishlist, createAgent, deleteAgent, toggleAgent, resendInvite, toggleAgentAlerts, clientAccessibleBy, shareClient, unshareClient, assignClient, bulkAllocate, editWishlist, clientDetailPage, lotDetailPage, publicLotPage, expirePast, portalPage, portalAddWishlist, portalEditWishlist, portalToggleWishlist, portalDeleteWishlist, portalApprove, inviteClientPortal, revokeClientPortal } from "./admin.js";
import { getSession, authenticate, sessionCookie, clearCookie, agentByInviteToken, setAgentPassword, clientByInviteToken, setClientPassword, readShareToken } from "./auth.js";
import { getSettings, settingOn, digestRecipient, saveSettings } from "./settings.js";
import { readAuctionSheet, sweepUnreadSheets, fixAllPhotos } from "./sheet.js";
import { distinctMakers, distinctModels, refreshLotImages } from "./avtonet.js";
import { logoPngBytes } from "./assets.js";
import { createCheckoutSession, verifyAndParseEvent, applyStripeEvent, stripeConfigured } from "./stripe.js";
import { notFoundPage, infoPage } from "./theme.js";
import { landingPage } from "./landing.js";

export default {
  // -------- Scheduled matcher --------
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => { await expirePast(env); await runMatcher(env); })());
  },

  // -------- HTTP routes --------
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Approve / skip links from the digest. Token-gated, no admin key needed
    // so they work from your inbox on any device.
    // Brand logo (served so emails can use a real PNG). Public.
    if (path === "/assets/logo-gold.png") {
      return new Response(logoPngBytes(), {
        headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
      });
    }

    if (path === "/decide") {
      return handleDecision(request, env, url);
    }

    // Public, read-only shared vehicle view (the "Share" link). Token-gated and
    // view-only — it can never trigger approve/skip. No login required.
    if (path === "/v") {
      const sharedId = await readShareToken(env, url.searchParams.get("t"));
      if (!sharedId) return doc(infoPage("Link expired", "This share link is invalid or has expired. Ask JDM Connect for a fresh one.", { cta: { href: "/request", label: "Request a vehicle" } }), 404);
      return doc(await publicLotPage(env, sharedId));
    }

    // Public vehicle-request form (no login) - for dealers and their clients.
    if (path === "/request") {
      if (request.method === "POST") {
        // Per-IP rate limit (best-effort; fails open if KV is unavailable).
        // Over the limit we return the normal confirmation without storing
        // anything, so bots get no signal. 8/hour is far above real use.
        const ip = request.headers.get("CF-Connecting-IP") || "";
        let limited = false;
        if (env.RL && ip) {
          try {
            const k = `reqrl:${ip}`;
            const n = parseInt((await env.RL.get(k)) || "0", 10);
            if (n >= 8) limited = true;
            else await env.RL.put(k, String(n + 1), { expirationTtl: 3600 });
          } catch (_) { /* fail open */ }
        }
        if (!limited) {
          const result = await createRequest(env, await request.formData());
          if (result.ok) {
            await alertNewRequest(env, result.req);     // notify staff
            await confirmRequest(env, result.req, result.ref); // receipt to the buyer
            return doc(await requestPage(env, { submitted: true, ref: result.ref, req: result.req }));
          }
          if (result.error === "contact") {
            // No email or WhatsApp - re-render with the error and their input.
            return doc(await requestPage(env, { error: "contact", vals: result.vals }));
          }
          // Honeypot/spam falls through to a generic success so bots get no signal.
        }
        return doc(await requestPage(env, { submitted: true }));
      }
      return doc(await requestPage(env));
    }

    // Feed lookup lists for the form dropdowns (public - just car names).
    // CORS-open so other JDM apps (e.g. the dealer portal) can consume them.
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

    // Same-host redirect helper: keeps the user (and their session cookie) on
    // whichever domain they arrived on - custom domain or workers.dev.
    const here = (p) => new URL(p, url).toString();

    // Where each role lands after signing in.
    const homeFor = (role) => (role === "client" ? "/portal" : "/admin");

    // Login / logout.
    if (path === "/login") {
      if (request.method === "POST") {
        const form = await request.formData();
        const who = await authenticate(env, form.get("email"), form.get("password"));
        if (who) {
          return new Response(null, { status: 303, headers: { Location: here(homeFor(who.role)), "Set-Cookie": await sessionCookie(env, who.role, who.id) } });
        }
        await new Promise((r) => setTimeout(r, 600)); // throttle repeated guesses
        return doc(loginPage({ error: true }), 401);
      }
      const existing = await getSession(request, url, env);
      if (existing) return Response.redirect(here(homeFor(existing.role)), 303);
      return doc(loginPage());
    }
    if (path === "/logout") {
      return new Response(null, { status: 303, headers: { Location: here("/login"), "Set-Cookie": clearCookie() } });
    }

    // Set-password (from an emailed invite link). Public - the single-use token
    // authorises it. Works for both agent and client invites; the token is
    // looked up against agents first, then clients. On success the user is
    // signed straight in and sent to their home.
    if (path === "/set-password") {
      // Resolve which kind of invite this token is. {kind, person} | null.
      const resolveInvite = async (token) => {
        const a = await agentByInviteToken(env, token);
        if (a) return { kind: "agent", person: a };
        const c = await clientByInviteToken(env, token);
        if (c) return { kind: "client", person: c };
        return null;
      };
      if (request.method === "POST") {
        const form = await request.formData();
        const token = form.get("token");
        const pw = String(form.get("password") || "");
        const found = await resolveInvite(token);
        if (!found) return doc(setPasswordPage({ invalid: true }));
        if (pw !== String(form.get("confirm") || "")) {
          return doc(setPasswordPage({ token, name: found.person.name, error: "Those passwords don't match." }));
        }
        const r = found.kind === "agent"
          ? await setAgentPassword(env, token, pw)
          : await setClientPassword(env, token, pw);
        if (r.ok) {
          const role = found.kind === "agent" ? "agent" : "client";
          return new Response(null, { status: 303, headers: { Location: here(homeFor(role)), "Set-Cookie": await sessionCookie(env, role, r.id) } });
        }
        return doc(setPasswordPage({ token, name: found.person.name, error: r.error }));
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
        await applyStripeEvent(env, event);
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

    // Everything below requires a signed-in session.
    const session = await getSession(request, url, env);
    if (!session) {
      return Response.redirect(here("/login"), 303);
    }

    // Buyer (client) sessions are fully isolated from the staff app: they only
    // ever reach the /portal/* surface, handled here and nowhere else.
    if (session.role === "client") {
      return handleClientPortal(request, env, url, path, session, here);
    }
    const adminOnly = () => Response.redirect(here("/admin"), 303);

    if (path === "/admin") {
      const view = url.searchParams.get("view") || "dashboard";
      if (view === "client") {
        return doc(await clientDetailPage(env, url.searchParams.get("id"), session));
      }
      if (view === "lot") {
        return doc(await lotDetailPage(env, url.searchParams.get("id"), session, {
          aiEnabled: !!env.ANTHROPIC_API_KEY,
          err: url.searchParams.get("err"),
        }));
      }
      return doc(await adminPage(env, view, session, { err: url.searchParams.get("err") }));
    }

    if (path === "/run") {
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
      // Pull the freshest image set first — the inspection sheet is often added
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
      if (["approve", "reject"].includes(action) && ids.length) {
        await applyBulkDecisions(env, action, ids, session);
      }
      const back = f.get("back");
      const dest = (typeof back === "string" && back.startsWith("/admin")) ? back : "/admin?view=matches";
      return Response.redirect(here(dest), 303);
    }

    if (path === "/client" && request.method === "POST") {
      const r = await createClient(env, await request.formData(), session);
      if (!r.ok) return Response.redirect(here(`/admin?view=intake&err=${r.error}`), 303);
      return Response.redirect(here("/admin"), 303);
    }

    if (path === "/client/delete" && request.method === "POST") {
      await deleteClient(env, (await request.formData()).get("id"), session);
      return Response.redirect(here("/admin?view=clients"), 303);
    }

    // Buyer portal access - enable + (re)send a set-password link, or revoke.
    // Owner/admin only (enforced inside the handlers).
    if (path === "/client/portal-invite" && request.method === "POST") {
      const id = (await request.formData()).get("id");
      const r = await inviteClientPortal(env, id, session);
      if (r.ok && r.token) await sendClientPortalInvite(env, r);
      return Response.redirect(here(`/admin?view=client&id=${Number(id) || ""}`), 303);
    }
    if (path === "/client/portal-revoke" && request.method === "POST") {
      const id = (await request.formData()).get("id");
      await revokeClientPortal(env, id, session);
      return Response.redirect(here(`/admin?view=client&id=${Number(id) || ""}`), 303);
    }

    // Allocate clients to agents - admin only.
    if (path === "/client/assign" && request.method === "POST") {
      if (session.role !== "admin") return adminOnly();
      const f = await request.formData();
      await assignClient(env, f.get("client_id"), f.get("agent_id"), session);
      return Response.redirect(here("/admin?view=clients"), 303);
    }
    if (path === "/clients/bulk" && request.method === "POST") {
      if (session.role !== "admin") return adminOnly();
      const f = await request.formData();
      await bulkAllocate(env, f.get("action"), f.get("agent_id"), f.getAll("ids"), session);
      return Response.redirect(here("/admin?view=clients"), 303);
    }

    if (path === "/wishlist" && request.method === "POST") {
      const f = await request.formData();
      await createWishlist(env, f, undefined, session);
      const cid = f.get("client_id");
      return Response.redirect(here(cid ? `/admin?view=client&id=${cid}` : "/admin?view=wishlists"), 303);
    }

    if (path === "/wishlist/edit" && request.method === "POST") {
      const f = await request.formData();
      await editWishlist(env, f, session);
      // Resolve the redirect target only if this session may actually see the
      // client, so a blocked edit never leaks a foreign client_id in the URL.
      const w = await env.DB.prepare("SELECT client_id FROM wishlists WHERE id = ?").bind(Number(f.get("id"))).first();
      const dest = (w && await clientAccessibleBy(env, w.client_id, session)) ? `/admin?view=client&id=${w.client_id}` : "/admin?view=wishlists";
      return Response.redirect(here(dest), 303);
    }

    if (path === "/wishlist/toggle" && request.method === "POST") {
      await toggleWishlist(env, (await request.formData()).get("id"), session);
      return Response.redirect(here("/admin?view=wishlists"), 303);
    }

    if (path === "/wishlist/delete" && request.method === "POST") {
      await deleteWishlist(env, (await request.formData()).get("id"), session);
      return Response.redirect(here("/admin?view=wishlists"), 303);
    }

    // Agent management - admin only.
    if (path === "/agent" && request.method === "POST") {
      if (session.role !== "admin") return adminOnly();
      const r = await createAgent(env, await request.formData());
      if (r.ok && r.token) await sendInvite(env, r);
      return Response.redirect(here("/admin?view=agents"), 303);
    }
    if (path === "/agent/invite" && request.method === "POST") {
      if (session.role !== "admin") return adminOnly();
      const r = await resendInvite(env, (await request.formData()).get("id"));
      if (r) await sendInvite(env, r);
      return Response.redirect(here("/admin?view=agents"), 303);
    }
    if (path === "/agent/alerts" && request.method === "POST") {
      if (session.role !== "admin") return adminOnly();
      await toggleAgentAlerts(env, (await request.formData()).get("id"));
      return Response.redirect(here("/admin?view=agents"), 303);
    }
    if (path === "/agent/toggle" && request.method === "POST") {
      if (session.role !== "admin") return adminOnly();
      await toggleAgent(env, (await request.formData()).get("id"));
      return Response.redirect(here("/admin?view=agents"), 303);
    }
    if (path === "/agent/delete" && request.method === "POST") {
      if (session.role !== "admin") return adminOnly();
      await deleteAgent(env, (await request.formData()).get("id"));
      return Response.redirect(here("/admin?view=agents"), 303);
    }

    // Settings - admin only.
    if (path === "/settings" && request.method === "POST") {
      if (session.role !== "admin") return adminOnly();
      await saveSettings(env, await request.formData());
      return Response.redirect(here("/admin?view=settings"), 303);
    }

    // Client sharing - owner or admin (enforced in the handlers).
    if (path === "/share" && request.method === "POST") {
      const f = await request.formData();
      await shareClient(env, f.get("client_id"), f.get("agent_id"), session);
      return Response.redirect(here("/admin?view=clients"), 303);
    }
    if (path === "/share/remove" && request.method === "POST") {
      const f = await request.formData();
      await unshareClient(env, f.get("client_id"), f.get("agent_id"), session);
      return Response.redirect(here("/admin?view=clients"), 303);
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
      code === "saved" ? "Saved." :
      err === "pay" ? "Sorry, we couldn't start that payment. Please try again or contact us." : "";
    return doc(await portalPage(env, session, { flash }));
  }

  if (path === "/portal/wishlist" && request.method === "POST") {
    await portalAddWishlist(env, await request.formData(), session);
    return back("?ok=saved");
  }
  if (path === "/portal/wishlist/edit" && request.method === "POST") {
    await portalEditWishlist(env, await request.formData(), session);
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

  // Anything else for a client → their dashboard.
  return Response.redirect(here("/portal"), 303);
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
  await sendPush(env, {
    title: "New JDM Finder signup",
    message: `${req.name || "Someone"}${want ? " wants " + want : ""}${req.email ? " (" + req.email + ")" : ""}`,
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

// Handle an approve/skip click from the digest or the in-app cards. When called
// with &ajax=1 (an in-app fetch), it returns a tiny 200/4xx instead of
// redirecting, so the card is removed in place with no full-page reload.
async function handleDecision(request, env, url) {
  const token = url.searchParams.get("token");
  const action = url.searchParams.get("action");
  const ajax = url.searchParams.get("ajax") === "1";
  const ok200 = () => new Response("ok", { status: 200, headers: { "Content-Type": "text/plain" } });
  if (!token || !["approve", "reject"].includes(action)) {
    return ajax ? new Response("invalid", { status: 400 }) : doc(infoPage("Invalid link", "That approve or skip link is not valid."), 400);
  }

  // If the click came from inside the app (signed-in session), return to the
  // Matches view; otherwise (email link) show a simple confirmation page.
  const session = await getSession(request, url, env);
  const backToApp = !!session;
  const toMatches = () => Response.redirect(new URL("/admin?view=matches", url).toString(), 303);

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
    const reason = (url.searchParams.get("reason") || "").slice(0, 80) || null;
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
    return ajax ? ok200() : (backToApp ? toMatches() : doc(infoPage("Marked for follow-up", "Marked for follow-up. The client was not emailed because this is a watch-only lead.")));
  }
  const lot = JSON.parse(item.lot_json);
  try {
    const r = await deliverToClient(env, client, lot, wishlist);
    await env.DB.prepare(
      "UPDATE queue SET status = 'sent', decided_at = datetime('now') WHERE id = ?"
    ).bind(item.id).run();
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
    } catch (err) {
      console.error(`Bulk delivery failed (client ${client?.id}):`, err.message);
      try { await setStatus("failed"); } catch (e) { /* best effort */ }
    }
  }
}

// Return a complete HTML document as-is (used for the full-page admin/request UIs
// and the branded standalone info / 404 pages from theme.js).
function doc(htmlString, status = 200) {
  return new Response(htmlString, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
