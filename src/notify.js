// Delivery: email via Resend, plus a WhatsApp stub for Phase 2.

import { clientHtml, clientMultiHtml, carText } from "./render.js";
import { estimateLanded } from "./calc.js";
import { getSettings, settingOn } from "./settings.js";
import { sendWhatsApp } from "./whatsapp.js";

// --- WhatsApp message builders ----------------------------------------------
// The approved template uses 3 variables: the client's first name, a one-line
// car summary, and a link to their portal. `bodyText` is the free-form version,
// used by the Twilio sandbox and inside the 24h window.
function waFirstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "there";
}
function waCarSummary(lot) {
  return `${lot.year || ""} ${lot.marka_name || ""} ${lot.model_name || ""}`.replace(/\s+/g, " ").trim() || "a new match";
}
function waMatchMsg(env, client, lot) {
  const url = `${env.PUBLIC_URL}/portal`;
  return { name: waFirstName(client.name), summary: waCarSummary(lot), url, bodyText: `${carText(lot)}\n\nView in your portal: ${url}` };
}
function waManyMsg(env, client, items) {
  const url = `${env.PUBLIC_URL}/portal`;
  const summary = `${items.length} new matches for your search`;
  const bodyText = items.map((it) => carText(it.lot)).join("\n\n") + `\n\nView them in your portal: ${url}`;
  return { name: waFirstName(client.name), summary, url, bodyText };
}

// Send an email through Resend (https://resend.com).
// Requires env.RESEND_API_KEY and a verified sender domain for env.MAIL_FROM.
export async function sendEmail(env, { to, subject, html, from }) {
  // Dev safety: with MAIL_DRY_RUN on, never hit Resend. Log what would have been
  // sent and return a fake success so flows complete without real email going
  // out. Set MAIL_DRY_RUN=1 in .dev.vars (or any non-production environment).
  if (env.MAIL_DRY_RUN === "1" || env.MAIL_DRY_RUN === true) {
    console.log(`[MAIL_DRY_RUN] suppressed email to ${Array.isArray(to) ? to.join(", ") : to} | subject: ${subject}`);
    return { id: "dry-run", dryRun: true };
  }
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY not set");
  }
  const fromAddr = from || env.MAIL_FROM_INTERNAL || env.MAIL_FROM || "onboarding@resend.dev";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `JDM Connect <${fromAddr}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

// Push a phone notification (a "chime") for time-sensitive events like a new
// signup or payment. Reaches your phone via the Pushover or ntfy app even when
// the site isn't open — the trigger is server-side, so nothing needs to be in a
// browser. No-ops (returns false) until one provider is configured by secret, so
// it's safe to call unconditionally. Never throws.
//   Pushover: set PUSHOVER_TOKEN + PUSHOVER_USER (optional PUSHOVER_SOUND).
//   ntfy:     set NTFY_TOPIC (optional NTFY_SERVER, NTFY_PRIORITY, NTFY_TAGS).
export async function sendPush(env, { title, message, url }) {
  try {
    if (env.PUSHOVER_TOKEN && env.PUSHOVER_USER) {
      const params = { token: env.PUSHOVER_TOKEN, user: env.PUSHOVER_USER, title, message };
      if (url) params.url = url;
      if (env.PUSHOVER_SOUND) params.sound = env.PUSHOVER_SOUND;
      const res = await fetch("https://api.pushover.net/1/messages.json", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(params),
      });
      if (!res.ok) throw new Error(`Pushover HTTP ${res.status}`);
      return true;
    }
    if (env.NTFY_TOPIC) {
      const base = (env.NTFY_SERVER || "https://ntfy.sh").replace(/\/+$/, "");
      const headers = { Title: asciiHeader(title) };
      if (url) headers.Click = url;
      if (env.NTFY_PRIORITY) headers.Priority = String(env.NTFY_PRIORITY);
      if (env.NTFY_TAGS) headers.Tags = env.NTFY_TAGS;
      const res = await fetch(`${base}/${env.NTFY_TOPIC}`, { method: "POST", headers, body: message });
      if (!res.ok) throw new Error(`ntfy HTTP ${res.status}`);
      return true;
    }
  } catch (err) {
    console.error("Push notify failed:", err.message);
  }
  return false;
}

// HTTP headers must be Latin-1/ASCII-safe; strip anything that isn't so a
// vehicle name with odd characters can't break the ntfy Title header.
function asciiHeader(s) {
  return String(s || "").replace(/[^\x20-\x7E]/g, "").slice(0, 200);
}

// Send an approved lot to a client across whatever channels they have set.
// Returns { email: bool, whatsapp: bool } for status tracking.
export async function deliverToClient(env, client, lot, wishlist) {
  const result = { email: false, whatsapp: false };
  const settings = await getSettings(env);
  // "Send to client" off → approving just marks the match handled; the client
  // isn't contacted (you reach out manually).
  if (!settingOn(settings, "send_to_client")) return result;

  if (client.email) {
    // Use the estimate snapshotted at match time, else compute it now, so the
    // client sees the same real landed figure staff reviewed (toggle-gated).
    const showLanded = settingOn(settings, "client_landed");
    const landed = showLanded ? (lot._landed || await estimateLanded(env, lot, client)) : null;
    const subject = `${lot.year} ${lot.marka_name} ${lot.model_name} - a match for your search`;
    await sendEmail(env, {
      to: client.email,
      subject,
      html: clientHtml(lot, client, wishlist, env.PUBLIC_URL, landed, showLanded),
      from: env.MAIL_FROM_CLIENT || env.MAIL_FROM_INTERNAL || env.MAIL_FROM,
    });
    result.email = true;
  }

  if (client.whatsapp && settingOn(settings, "whatsapp_enabled")) {
    try {
      await sendWhatsApp(env, client.whatsapp, waMatchMsg(env, client, lot), settings);
      result.whatsapp = true;
    } catch (err) {
      // WhatsApp is best-effort; a failure must not block the email delivery.
      console.error("WhatsApp send skipped/failed:", err.message);
    }
  }

  return result;
}

// Send several approved lots to a client in ONE email (bulk approve). `items`
// is [{ lot, wishlist }]. A single car still uses the rich single-car email;
// multiple cars use the combined template. Returns { email, whatsapp }.
export async function deliverManyToClient(env, client, items) {
  const result = { email: false, whatsapp: false };
  if (!items || !items.length) return result;
  const settings = await getSettings(env);
  if (!settingOn(settings, "send_to_client")) return result;

  if (client.email) {
    const showLanded = settingOn(settings, "client_landed");
    const enriched = [];
    for (const it of items) {
      const landed = showLanded ? (it.lot._landed || await estimateLanded(env, it.lot, client)) : null;
      enriched.push({ lot: it.lot, wishlist: it.wishlist, landed });
    }
    const one = enriched[0];
    const html = enriched.length === 1
      ? clientHtml(one.lot, client, one.wishlist, env.PUBLIC_URL, one.landed, showLanded)
      : clientMultiHtml(client, enriched, env.PUBLIC_URL, showLanded);
    const subject = enriched.length === 1
      ? `${one.lot.year} ${one.lot.marka_name} ${one.lot.model_name} - a match for your search`
      : `${enriched.length} cars matched to your search`;
    await sendEmail(env, {
      to: client.email,
      subject,
      html,
      from: env.MAIL_FROM_CLIENT || env.MAIL_FROM_INTERNAL || env.MAIL_FROM,
    });
    result.email = true;
  }

  if (client.whatsapp && settingOn(settings, "whatsapp_enabled")) {
    try {
      await sendWhatsApp(env, client.whatsapp, waManyMsg(env, client, items), settings);
      result.whatsapp = true;
    } catch (err) {
      console.error("WhatsApp send skipped/failed:", err.message);
    }
  }
  return result;
}
