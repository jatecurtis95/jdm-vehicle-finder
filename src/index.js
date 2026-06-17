// JDM Vehicle Finder — Cloudflare Worker entry point.
//
// scheduled(): runs the matcher on the cron schedule, queues new matches,
//   emails you a digest with approve/skip links.
// fetch(): serves the admin UI, the manual "run now" trigger, the form posts,
//   and the approve/skip decision links from the digest.

import { runAll } from "./matcher.js";
import { digestHtml } from "./render.js";
import { sendEmail, deliverToClient } from "./notify.js";
import { adminPage, requestPage, authed, createClient, createWishlist, createRequest } from "./admin.js";
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
    if (path === "/assets/logo-black.png") {
      return new Response(logoPngBytes(), {
        headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
      });
    }

    if (path === "/decide") {
      return handleDecision(env, url);
    }

    // Public vehicle-request form (no admin key) — for dealers and their clients.
    if (path === "/request") {
      if (request.method === "POST") {
        await createRequest(env, await request.formData());
        return doc(await requestPage(env, { submitted: true }));
      }
      return doc(await requestPage(env));
    }

    // Everything below requires the admin key.
    if (!authed(url, env)) {
      return new Response("Unauthorized. Append ?key=YOUR_ADMIN_TOKEN", { status: 401 });
    }
    const key = url.searchParams.get("key");

    if (path === "/" || path === "/admin") {
      return doc(await adminPage(env, key, url.searchParams.get("view") || "intake"));
    }

    if (path === "/run") {
      await runMatcher(env);
      return Response.redirect(`${env.PUBLIC_URL}/admin?view=matches&key=${encodeURIComponent(key)}`, 303);
    }

    if (path === "/client" && request.method === "POST") {
      await createClient(env, await request.formData());
      return Response.redirect(`${env.PUBLIC_URL}/admin?key=${encodeURIComponent(key)}`, 303);
    }

    if (path === "/wishlist" && request.method === "POST") {
      await createWishlist(env, await request.formData());
      return Response.redirect(`${env.PUBLIC_URL}/admin?key=${encodeURIComponent(key)}`, 303);
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
async function handleDecision(env, url) {
  const token = url.searchParams.get("token");
  const action = url.searchParams.get("action");
  if (!token || !["approve", "reject"].includes(action)) {
    return html("<p>Invalid link.</p>", 400);
  }

  // If the click came from inside the app (carries the admin key), return to
  // the Matches view; otherwise (email link) show a simple confirmation page.
  const key = url.searchParams.get("key");
  const backToApp = env.ADMIN_TOKEN && key === env.ADMIN_TOKEN;
  const toMatches = () => Response.redirect(`${env.PUBLIC_URL}/admin?view=matches&key=${encodeURIComponent(key)}`, 303);

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
