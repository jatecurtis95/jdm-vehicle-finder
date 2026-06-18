// JDM Vehicle Finder — Cloudflare Worker entry point.
//
// scheduled(): runs the matcher on the cron schedule, queues new matches,
//   emails you a digest with approve/skip links.
// fetch(): serves the admin UI, the manual "run now" trigger, the form posts,
//   and the approve/skip decision links from the digest.

import { runAll } from "./matcher.js";
import { digestHtml } from "./render.js";
import { sendEmail, deliverToClient } from "./notify.js";
import { adminPage, requestPage, loginPage, createClient, createWishlist, createRequest, deleteClient, deleteWishlist, toggleWishlist } from "./admin.js";
import { isAuthed, passwordValid, sessionCookie, clearCookie } from "./auth.js";
import { distinctMakers, distinctModels } from "./avtonet.js";
import { logoPngBytes } from "./assets.js";

export default {
  // -------- Scheduled matcher --------
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runMatcher(env));
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
        await createRequest(env, await request.formData());
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
        if (passwordValid(env, form.get("password"))) {
          return new Response(null, { status: 303, headers: { Location: here("/admin"), "Set-Cookie": await sessionCookie(env) } });
        }
        await new Promise((r) => setTimeout(r, 600)); // throttle repeated guesses
        return doc(loginPage({ error: true }), 401);
      }
      if (await isAuthed(request, url, env)) return Response.redirect(here("/admin"), 303);
      return doc(loginPage());
    }
    if (path === "/logout") {
      return new Response(null, { status: 303, headers: { Location: here("/login"), "Set-Cookie": clearCookie() } });
    }

    // Bare domain → public request form, so the root is safe to share.
    if (path === "/") {
      return Response.redirect(here("/request"), 302);
    }

    // Admin area — require a signed-in session (legacy ?key= still accepted).
    if (!(await isAuthed(request, url, env))) {
      return Response.redirect(here("/login"), 303);
    }

    if (path === "/admin") {
      return doc(await adminPage(env, url.searchParams.get("view") || "intake"));
    }

    if (path === "/run") {
      await runMatcher(env);
      return Response.redirect(here("/admin?view=matches"), 303);
    }

    if (path === "/client" && request.method === "POST") {
      await createClient(env, await request.formData());
      return Response.redirect(here("/admin"), 303);
    }

    if (path === "/client/delete" && request.method === "POST") {
      await deleteClient(env, (await request.formData()).get("id"));
      return Response.redirect(here("/admin?view=clients"), 303);
    }

    if (path === "/wishlist" && request.method === "POST") {
      await createWishlist(env, await request.formData());
      return Response.redirect(here("/admin?view=wishlists"), 303);
    }


    if (path === "/wishlist/toggle" && request.method === "POST") {
      await toggleWishlist(env, (await request.formData()).get("id"));
      return Response.redirect(here("/admin?view=wishlists"), 303);
    }

    if (path === "/wishlist/delete" && request.method === "POST") {
      await deleteWishlist(env, (await request.formData()).get("id"));
      return Response.redirect(here("/admin?view=wishlists"), 303);
    }

    return new Response("Not found", { status: 404 });
  },
};

// Run the matcher and send the digest. Returns a human-readable summary string.
async function runMatcher(env) {
  const summary = await runAll(env);
  const total = summary.reduce((n, s) => n + s.queued.length, 0);
  if (total === 0) {
    return "Matcher ran. No new matches this time.";
  }
  try {
    await sendEmail(env, {
      to: env.DIGEST_EMAIL,
      subject: `${total} new auction match${total === 1 ? "" : "es"} to review`,
      html: digestHtml(summary, env.PUBLIC_URL),
    });
  } catch (err) {
    console.error("Digest email failed:", err.message);
    return `Matcher queued ${total} match(es) but the digest email failed: ${err.message}`;
  }
  return `Matcher queued ${total} new match(es) and emailed the digest.`;
}

// Handle an approve/skip click from the digest.
async function handleDecision(request, env, url) {
  const token = url.searchParams.get("token");
  const action = url.searchParams.get("action");
  if (!token || !["approve", "reject"].includes(action)) {
    return html("<p>Invalid link.</p>", 400);
  }

  // If the click came from inside the app (signed-in session), return to the
  // Matches view; otherwise (email link) show a simple confirmation page.
  const backToApp = await isAuthed(request, url, env);
  const toMatches = () => Response.redirect(new URL("/admin?view=matches", url).toString(), 303);

  const item = await env.DB.prepare("SELECT * FROM queue WHERE token = ?").bind(token).first();
  if (!item) return html("<p>This item no longer exists.</p>", 404);
  if (item.status !== "pending") {
    return backToApp ? toMatches() : html(`<p>Already handled (status: ${item.status}).</p>`);
  }

  if (action === "reject") {
    await env.DB.prepare(
      "UPDATE queue SET status = 'rejected', decided_at = datetime('now') WHERE id = ?"
    ).bind(item.id).run();
    return backToApp ? toMatches() : html("<p>Skipped. The client will not be contacted about this car.</p>");
  }

  // Approve: deliver to the client.
  const client = await env.DB.prepare("SELECT * FROM clients WHERE id = ?").bind(item.client_id).first();
  const wishlist = await env.DB.prepare(
    "SELECT w.*, c.name AS client_name FROM wishlists w JOIN clients c ON c.id = w.client_id WHERE w.id = ?"
  ).bind(item.wishlist_id).first();
  const lot = JSON.parse(item.lot_json);
  try {
    const r = await deliverToClient(env, client, lot, wishlist);
    await env.DB.prepare(
      "UPDATE queue SET status = 'sent', decided_at = datetime('now') WHERE id = ?"
    ).bind(item.id).run();
    if (backToApp) return toMatches();
    const channels = [r.email && "email", r.whatsapp && "WhatsApp"].filter(Boolean).join(" + ") || "no channel (client has no contact set)";
    return html(`<p>Approved and sent to ${escapeName(client?.name)} via ${channels}.</p>`);
  } catch (err) {
    await env.DB.prepare(
      "UPDATE queue SET status = 'failed', decided_at = datetime('now') WHERE id = ?"
    ).bind(item.id).run();
    return html(`<p>Approved but delivery failed: ${err.message}</p>`, 500);
  }
}

function escapeName(s) {
  return String(s ?? "the client").replace(/</g, "&lt;");
}

// Return a complete HTML document as-is (used for the full-page admin/request UIs).
function doc(htmlString, status = 200) {
  return new Response(htmlString, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function html(body, status = 200) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:40px auto;padding:0 16px;color:#222">${body}</body>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
