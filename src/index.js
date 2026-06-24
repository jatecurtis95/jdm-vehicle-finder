// JDM Vehicle Finder — Cloudflare Worker entry point.
//
// scheduled(): runs the matcher on the cron schedule, queues new matches,
//   emails you a digest with approve/skip links.
// fetch(): serves the admin UI, the manual "run now" trigger, the form posts,
//   and the approve/skip decision links from the digest.

import { runAll } from "./matcher.js";
import { digestHtml, agentInviteHtml, requestAlertHtml } from "./render.js";
import { sendEmail, deliverToClient } from "./notify.js";
import { adminPage, requestPage, loginPage, setPasswordPage, createClient, createWishlist, createRequest, deleteClient, deleteWishlist, toggleWishlist, createAgent, deleteAgent, toggleAgent, resendInvite, toggleAgentAlerts, clientAccessibleBy, shareClient, unshareClient, assignClient, bulkAllocate, editWishlist, clientDetailPage, expirePast } from "./admin.js";
import { getSession, authenticate, sessionCookie, clearCookie, agentByInviteToken, setAgentPassword } from "./auth.js";
import { getSettings, settingOn, digestRecipient, saveSettings } from "./settings.js";
import { distinctMakers, distinctModels } from "./avtonet.js";
import { logoPngBytes } from "./assets.js";

export default {
  // -------- Scheduled matcher --------
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => { await expirePast(env); await runMatcher(env); })());
  },

  // -------- HTTP routes --------
  async fetch(request, env) {
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

    // Public vehicle-request form (no login) — for dealers and their clients.
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
          const req = await createRequest(env, await request.formData());
          if (req) await alertNewRequest(env, req);
        }
        return doc(await requestPage(env, { submitted: true }));
      }
      return doc(await requestPage(env));
    }

    // Feed lookup lists for the form dropdowns (public — just car names).
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
    // whichever domain they arrived on — custom domain or workers.dev.
    const here = (p) => new URL(p, url).toString();

    // Login / logout.
    if (path === "/login") {
      if (request.method === "POST") {
        const form = await request.formData();
        const who = await authenticate(env, form.get("email"), form.get("password"));
        if (who) {
          return new Response(null, { status: 303, headers: { Location: here("/admin"), "Set-Cookie": await sessionCookie(env, who.role, who.id) } });
        }
        await new Promise((r) => setTimeout(r, 600)); // throttle repeated guesses
        return doc(loginPage({ error: true }), 401);
      }
      if (await getSession(request, url, env)) return Response.redirect(here("/admin"), 303);
      return doc(loginPage());
    }
    if (path === "/logout") {
      return new Response(null, { status: 303, headers: { Location: here("/login"), "Set-Cookie": clearCookie() } });
    }

    // Agent set-password (from the emailed invite link). Public — the single-use
    // token authorises it. On success the agent is signed straight in.
    if (path === "/set-password") {
      if (request.method === "POST") {
        const form = await request.formData();
        const token = form.get("token");
        const pw = String(form.get("password") || "");
        if (pw !== String(form.get("confirm") || "")) {
          const a = await agentByInviteToken(env, token);
          return doc(a ? setPasswordPage({ token, name: a.name, error: "Those passwords don't match." }) : setPasswordPage({ invalid: true }));
        }
        const r = await setAgentPassword(env, token, pw);
        if (r.ok) {
          return new Response(null, { status: 303, headers: { Location: here("/admin"), "Set-Cookie": await sessionCookie(env, "agent", r.id) } });
        }
        const a = await agentByInviteToken(env, token);
        return doc(a ? setPasswordPage({ token, name: a.name, error: r.error }) : setPasswordPage({ invalid: true }));
      }
      const a = await agentByInviteToken(env, url.searchParams.get("token"));
      return doc(a ? setPasswordPage({ token: url.searchParams.get("token"), name: a.name }) : setPasswordPage({ invalid: true }));
    }

    // Bare domain → public request form, so the root is safe to share.
    if (path === "/") {
      return Response.redirect(here("/request"), 302);
    }

    // Everything below requires a signed-in session (admin or agent).
    const session = await getSession(request, url, env);
    if (!session) {
      return Response.redirect(here("/login"), 303);
    }
    const adminOnly = () => Response.redirect(here("/admin"), 303);

    if (path === "/admin") {
      const view = url.searchParams.get("view") || "intake";
      if (view === "client") {
        return doc(await clientDetailPage(env, url.searchParams.get("id"), session));
      }
      return doc(await adminPage(env, view, session));
    }

    if (path === "/run") {
      await runMatcher(env, session);
      return Response.redirect(here("/admin?view=matches"), 303);
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
      return Response.redirect(here("/admin?view=matches"), 303);
    }

    if (path === "/client" && request.method === "POST") {
      await createClient(env, await request.formData(), session);
      return Response.redirect(here("/admin"), 303);
    }

    if (path === "/client/delete" && request.method === "POST") {
      await deleteClient(env, (await request.formData()).get("id"), session);
      return Response.redirect(here("/admin?view=clients"), 303);
    }

    // Allocate clients to agents — admin only.
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
      const w = await env.DB.prepare("SELECT client_id FROM wishlists WHERE id = ?").bind(Number(f.get("id"))).first();
      return Response.redirect(here(w ? `/admin?view=client&id=${w.client_id}` : "/admin?view=wishlists"), 303);
    }

    if (path === "/wishlist/toggle" && request.method === "POST") {
      await toggleWishlist(env, (await request.formData()).get("id"), session);
      return Response.redirect(here("/admin?view=wishlists"), 303);
    }

    if (path === "/wishlist/delete" && request.method === "POST") {
      await deleteWishlist(env, (await request.formData()).get("id"), session);
      return Response.redirect(here("/admin?view=wishlists"), 303);
    }

    // Agent management — admin only.
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

    // Settings — admin only.
    if (path === "/settings" && request.method === "POST") {
      if (session.role !== "admin") return adminOnly();
      await saveSettings(env, await request.formData());
      return Response.redirect(here("/admin?view=settings"), 303);
    }

    // Client sharing — owner or admin (enforced in the handlers).
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

    return new Response("Not found", { status: 404 });
  },
};

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
      subject: `New vehicle request — ${req.name}`,
      html: requestAlertHtml(req, env.PUBLIC_URL),
    });
  } catch (err) {
    console.error("New-request alert failed:", err.message);
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
  if (total === 0) {
    return "Matcher ran. No new matches this time.";
  }
  if (session && session.role === "agent") {
    return `Matcher queued ${total} new match(es).`;
  }

  const settings = await getSettings(env);
  const groups = new Map(); // key -> { agent|null, entries }
  for (const entry of summary) {
    const aid = entry.wishlist.client_agent_id;
    const key = aid ? `agent:${aid}` : "admin";
    if (!groups.has(key)) {
      groups.set(key, {
        agent: aid ? { email: entry.wishlist.agent_email, name: entry.wishlist.agent_name, alerts: entry.wishlist.agent_alerts } : null,
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
  return `Matcher queued ${total} new match(es).`;
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
    return ajax ? new Response("invalid", { status: 400 }) : html("<p>Invalid link.</p>", 400);
  }

  // If the click came from inside the app (signed-in session), return to the
  // Matches view; otherwise (email link) show a simple confirmation page.
  const session = await getSession(request, url, env);
  const backToApp = !!session;
  const toMatches = () => Response.redirect(new URL("/admin?view=matches", url).toString(), 303);

  const item = await env.DB.prepare("SELECT * FROM queue WHERE token = ?").bind(token).first();
  if (!item) return ajax ? ok200() : html("<p>This item no longer exists.</p>", 404);
  // A signed-in agent may only act on their own clients' matches. Email links
  // (no session) are authorised by the unguessable token itself.
  if (session && session.role === "agent" && !(await clientAccessibleBy(env, item.client_id, session))) {
    return ajax ? new Response("forbidden", { status: 403 }) : (backToApp ? toMatches() : html("<p>This item no longer exists.</p>", 404));
  }
  if (item.status !== "pending") {
    return ajax ? ok200() : (backToApp ? toMatches() : html(`<p>Already handled (status: ${item.status}).</p>`));
  }

  if (action === "reject") {
    const reason = (url.searchParams.get("reason") || "").slice(0, 80) || null;
    await env.DB.prepare(
      "UPDATE queue SET status = 'rejected', reason = ?, decided_at = datetime('now') WHERE id = ?"
    ).bind(reason, item.id).run();
    return ajax ? ok200() : (backToApp ? toMatches() : html("<p>Skipped. The client will not be contacted about this car.</p>"));
  }

  // Approve. Watch-only "lead" wishlists never email the client — the match is
  // just marked handled so staff can follow up by phone instead.
  const client = await env.DB.prepare("SELECT * FROM clients WHERE id = ?").bind(item.client_id).first();
  const wishlist = await env.DB.prepare(
    "SELECT w.*, c.name AS client_name FROM wishlists w JOIN clients c ON c.id = w.client_id WHERE w.id = ?"
  ).bind(item.wishlist_id).first();
  if (wishlist && wishlist.watch_only) {
    await env.DB.prepare(
      "UPDATE queue SET status = 'sent', decided_at = datetime('now') WHERE id = ?"
    ).bind(item.id).run();
    return ajax ? ok200() : (backToApp ? toMatches() : html("<p>Marked for follow-up. The client was not emailed (watch-only lead).</p>"));
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
    return html(`<p>Approved and sent to ${escapeName(client?.name)} via ${channels}.</p>`);
  } catch (err) {
    await env.DB.prepare(
      "UPDATE queue SET status = 'failed', decided_at = datetime('now') WHERE id = ?"
    ).bind(item.id).run();
    return ajax ? new Response("send failed", { status: 500 }) : html(`<p>Approved but delivery failed: ${err.message}</p>`, 500);
  }
}

// Apply approve/reject to many queued matches at once (the Matches bulk bar).
// Mirrors the single-decision logic, keeps the agent per-item access check, and
// isolates each item so one bad lot or failed send never aborts the batch.
async function applyBulkDecisions(env, action, ids, session) {
  for (const id of ids) {
    try {
      const item = await env.DB.prepare("SELECT * FROM queue WHERE id = ?").bind(id).first();
      if (!item || item.status !== "pending") continue;
      if (session && session.role === "agent" && !(await clientAccessibleBy(env, item.client_id, session))) continue;

      if (action === "reject") {
        await env.DB.prepare(
          "UPDATE queue SET status = 'rejected', decided_at = datetime('now') WHERE id = ?"
        ).bind(item.id).run();
        continue;
      }

      const client = await env.DB.prepare("SELECT * FROM clients WHERE id = ?").bind(item.client_id).first();
      const wishlist = await env.DB.prepare(
        "SELECT w.*, c.name AS client_name FROM wishlists w JOIN clients c ON c.id = w.client_id WHERE w.id = ?"
      ).bind(item.wishlist_id).first();
      const lot = JSON.parse(item.lot_json);
      try {
        await deliverToClient(env, client, lot, wishlist);
        await env.DB.prepare(
          "UPDATE queue SET status = 'sent', decided_at = datetime('now') WHERE id = ?"
        ).bind(item.id).run();
      } catch (err) {
        await env.DB.prepare(
          "UPDATE queue SET status = 'failed', decided_at = datetime('now') WHERE id = ?"
        ).bind(item.id).run();
        console.error(`Bulk approve delivery failed (queue ${item.id}):`, err.message);
      }
    } catch (err) {
      console.error(`Bulk decision failed (queue ${id}):`, err.message);
    }
  }
}

function escapeName(s) {
  return String(s ?? "the client").replace(/</g, "&lt;");
}

// Return a complete HTML document as-is (used for the full-page admin/request UIs).
function doc(htmlString, status = 200) {
  return new Response(htmlString, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function html(body, status = 200) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:40px auto;padding:0 16px;color:#222">${body}</body>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
  );
}
