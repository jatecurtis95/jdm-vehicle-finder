// Delivery: email via Resend, plus a WhatsApp stub for Phase 2.

import { clientHtml, clientMultiHtml, carText } from "./render.js";
import { estimateLanded } from "./calc.js";
import { getSettings, settingOn, settingNum } from "./settings.js";
import { sendWhatsApp, sendSms } from "./whatsapp.js";

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
// SMS bodies are short plain text (no templates): one line plus the portal link.
function smsMatchMsg(env, client, lot) {
  const url = `${env.PUBLIC_URL}/portal`;
  return { bodyText: `JDM Connect: ${waCarSummary(lot)} matches your search. View it in your portal: ${url}` };
}
function smsManyMsg(env, client, items) {
  const url = `${env.PUBLIC_URL}/portal`;
  return { bodyText: `JDM Connect: ${items.length} new matches for your search. View them in your portal: ${url}` };
}

// Log helpers so the WhatsApp outcome is visible in `wrangler tail`. Previously a
// successful send logged nothing, so an operator could not tell "delivered" from
// "skipped because the toggle was off / no number on file" - both looked silent.
function maskPhone(s) {
  const d = String(s || "");
  return d.length <= 4 ? "****" : "****" + d.slice(-4);
}
// Provider response id: Meta -> messages[0].id, Twilio -> sid. Note that an id
// only means the PROVIDER ACCEPTED the message, not that the handset received it
// (a free-form send outside the 24h window can be accepted then dropped).
function waResultId(res) {
  return (res && (res.sid || (res.messages && res.messages[0] && res.messages[0].id))) || "accepted";
}

// Send an email through Resend (https://resend.com).
// Requires env.RESEND_API_KEY and a verified sender domain for env.MAIL_FROM.
export async function sendEmail(env, { to, subject, html, from }) {
  // Dev safety: with MAIL_DRY_RUN on, never hit Resend. Log what would have been
  // sent and return a fake success so flows complete without real email going
  // out. Set MAIL_DRY_RUN=1 in .dev.vars (or any non-production environment).
  if (env.MAIL_DRY_RUN === "1" || env.MAIL_DRY_RUN === true) {
    // Mask addresses: Worker logs stream via `wrangler tail` (and any logpush
    // sink), so raw client emails must not land there if this flag is ever on
    // in production.
    const mask = (a) => String(a || "").replace(/^(.).*?(@|$)/, "$1***$2");
    const toLog = Array.isArray(to) ? to.map(mask).join(", ") : mask(to);
    console.log(`[MAIL_DRY_RUN] suppressed email to ${toLog} | subject: ${subject}`);
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
// the site isn't open - the trigger is server-side, so nothing needs to be in a
// browser. No-ops (returns false) until one provider is configured by secret, so
// it's safe to call unconditionally. Never throws.
//   Pushover: set PUSHOVER_TOKEN + PUSHOVER_USER (optional PUSHOVER_SOUND).
//   ntfy:     set NTFY_TOPIC (optional NTFY_SERVER, NTFY_PRIORITY, NTFY_TAGS).
export async function sendPush(env, { title, message, url }) {
  try {
    // Trim every secret. A stray newline or trailing space pasted into
    // `wrangler secret put` (a known Windows gotcha) would otherwise corrupt the
    // Pushover params or the ntfy topic in the URL and silently break the chime.
    const pushToken = String(env.PUSHOVER_TOKEN || "").trim();
    const pushUser = String(env.PUSHOVER_USER || "").trim();
    if (pushToken && pushUser) {
      const params = { token: pushToken, user: pushUser, title, message };
      if (url) params.url = url;
      const sound = String(env.PUSHOVER_SOUND || "").trim();
      if (sound) params.sound = sound;
      const res = await fetch("https://api.pushover.net/1/messages.json", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(params),
      });
      if (!res.ok) throw new Error(`Pushover HTTP ${res.status}`);
      return true;
    }
    // Telegram bot: free and reliable from Cloudflare Workers (api.telegram.org
    // is token-based, not IP-rate-limited the way ntfy.sh's free tier is).
    const tgToken = String(env.TELEGRAM_BOT_TOKEN || "").trim();
    const tgChat = String(env.TELEGRAM_CHAT_ID || "").trim();
    if (tgToken && tgChat) {
      const text = (title ? title + "\n" : "") + message + (url ? "\n" + url : "");
      const res = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: tgChat, text, disable_web_page_preview: true }),
      });
      if (!res.ok) throw new Error(`Telegram HTTP ${res.status}`);
      return true;
    }
    const ntfyTopic = String(env.NTFY_TOPIC || "").trim();
    if (ntfyTopic) {
      const base = String(env.NTFY_SERVER || "https://ntfy.sh").trim().replace(/\/+$/, "");
      const headers = { Title: asciiHeader(title) };
      if (url) headers.Click = url;
      const prio = String(env.NTFY_PRIORITY || "").trim();
      if (prio) headers.Priority = prio;
      const tags = String(env.NTFY_TAGS || "").trim();
      if (tags) headers.Tags = tags;
      // An ntfy access token authenticates the publish against your account, so
      // it uses your account's rate limit instead of ntfy.sh's per-IP limit -
      // the per-IP limit otherwise 429s us from Cloudflare's shared Worker IPs.
      const token = String(env.NTFY_TOKEN || "").trim();
      if (token) headers.Authorization = "Bearer " + token;
      const res = await fetch(`${base}/${ntfyTopic}`, { method: "POST", headers, body: message });
      if (!res.ok) throw new Error(`ntfy HTTP ${res.status}`);
      return true;
    }
  } catch (err) {
    console.error("Push notify failed:", err.message);
  }
  return false;
}

// Build the phone-chime payload for a money-in Stripe event, or null if the
// event isn't a new membership or a paid deposit. Only "subscribed"/"paid"
// (first-seen) statuses fire, so Stripe's retries (which return "duplicate")
// never double-ping. Exported so it can be unit-tested without a signed webhook.
export function paymentChime(event, status, publicUrl) {
  if (status !== "subscribed" && status !== "paid") return null;
  const o = (event && event.data && event.data.object) || {};
  const who = o.customer_details?.name || o.customer_details?.email || "A customer";
  const amt = o.amount_total != null
    ? `$${(Number(o.amount_total) / 100).toFixed(2)} ${String(o.currency || "aud").toUpperCase()}`
    : "";
  const isMember = status === "subscribed";
  return {
    title: isMember ? "New JDM Finder member" : "Deposit paid",
    message: `${who}${amt ? " - " + amt : ""}${isMember ? " joined Full access" : " paid a deposit"}`.trim(),
    url: `${publicUrl}/admin?view=payments`,
  };
}

// HTTP headers must be Latin-1/ASCII-safe; strip anything that isn't so a
// vehicle name with odd characters can't break the ntfy Title header.
function asciiHeader(s) {
  return String(s || "").replace(/[^\x20-\x7E]/g, "").slice(0, 200);
}

// The Full-access upsell to attach to a NON-member's match email, or null.
// Shown only when membership is actually purchasable (Stripe key set, selling
// enabled, a price). Members - and everyone when membership selling is off -
// get nothing. Falls back to a DB lookup when the caller didn't join `member`.
async function upsellFor(env, settings, client) {
  const purchasable = !!env.STRIPE_SECRET_KEY
    && settingOn(settings, "membership_enabled")
    && settingNum(settings, "membership_monthly_aud", 0) > 0;
  if (!purchasable) return null;
  let isMember = false;
  if (client && client.member != null) {
    isMember = !!client.member;
  } else if (client && client.id) {
    const row = await env.DB.prepare("SELECT member FROM clients WHERE id = ?").bind(client.id).first();
    isMember = !!(row && row.member);
  }
  if (isMember) return null;
  return { priceAud: settingNum(settings, "membership_monthly_aud", 49) };
}

// Send an approved lot to a client across whatever channels they have set.
// Returns { email: bool, whatsapp: bool } for status tracking.
export async function deliverToClient(env, client, lot, wishlist) {
  const result = { email: false, whatsapp: false, sms: false };
  const settings = await getSettings(env);
  // "Send to client" off → approving just marks the match handled; the client
  // isn't contacted (you reach out manually).
  if (!settingOn(settings, "send_to_client")) return result;

  if (client.email) {
    // Use the estimate snapshotted at match time, else compute it now, so the
    // client sees the same real landed figure staff reviewed (toggle-gated).
    const showLanded = settingOn(settings, "client_landed");
    const landed = showLanded ? (lot._landed || await estimateLanded(env, lot, client)) : null;
    const upsell = await upsellFor(env, settings, client);
    const subject = `${lot.year} ${lot.marka_name} ${lot.model_name} - a match for your search`;
    await sendEmail(env, {
      to: client.email,
      subject,
      html: clientHtml(lot, client, wishlist, env.PUBLIC_URL, landed, showLanded, upsell),
      from: env.MAIL_FROM_CLIENT || env.MAIL_FROM_INTERNAL || env.MAIL_FROM,
    });
    result.email = true;
  }

  if (client.whatsapp && settingOn(settings, "whatsapp_enabled")) {
    try {
      const res = await sendWhatsApp(env, client.whatsapp, waMatchMsg(env, client, lot), settings);
      result.whatsapp = true;
      console.log(`WhatsApp accepted by provider for client ${client.id} ${maskPhone(client.whatsapp)} (id ${waResultId(res)}). Accepted is not delivered: if it does not arrive, the message likely needs an approved template (no META_WA_TEMPLATE_NAME set sends free-form, which only delivers inside the 24h window).`);
    } catch (err) {
      // WhatsApp is best-effort; a failure must not block the email delivery.
      console.error("WhatsApp send skipped/failed:", err.message);
    }
  } else if (settingOn(settings, "whatsapp_enabled") && !client.whatsapp) {
    console.log(`WhatsApp not sent for client ${client.id}: no number on file.`);
  }

  if (client.whatsapp && settingOn(settings, "sms_enabled")) {
    try {
      await sendSms(env, client.whatsapp, smsMatchMsg(env, client, lot));
      result.sms = true;
      console.log(`SMS accepted by Twilio for client ${client.id} ${maskPhone(client.whatsapp)}.`);
    } catch (err) {
      // SMS is best-effort, like WhatsApp: never block the email delivery.
      console.error("SMS send skipped/failed:", err.message);
    }
  }

  return result;
}

// Send several approved lots to a client in ONE email (bulk approve). `items`
// is [{ lot, wishlist }]. A single car still uses the rich single-car email;
// multiple cars use the combined template. Returns { email, whatsapp }.
export async function deliverManyToClient(env, client, items) {
  const result = { email: false, whatsapp: false, sms: false };
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
    const upsell = enriched.length === 1 ? await upsellFor(env, settings, client) : null;
    const html = enriched.length === 1
      ? clientHtml(one.lot, client, one.wishlist, env.PUBLIC_URL, one.landed, showLanded, upsell)
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
      const res = await sendWhatsApp(env, client.whatsapp, waManyMsg(env, client, items), settings);
      result.whatsapp = true;
      console.log(`WhatsApp accepted by provider for client ${client.id} ${maskPhone(client.whatsapp)} (id ${waResultId(res)}, ${items.length} lots). Accepted is not delivered: a free-form send (no template) only delivers inside the 24h window.`);
    } catch (err) {
      console.error("WhatsApp send skipped/failed:", err.message);
    }
  }

  if (client.whatsapp && settingOn(settings, "sms_enabled")) {
    try {
      await sendSms(env, client.whatsapp, smsManyMsg(env, client, items));
      result.sms = true;
      console.log(`SMS accepted by Twilio for client ${client.id} ${maskPhone(client.whatsapp)} (${items.length} lots).`);
    } catch (err) {
      console.error("SMS send skipped/failed:", err.message);
    }
  }
  return result;
}
