// Delivery: email via Resend, plus a WhatsApp stub for Phase 2.

import { clientHtml, clientMultiHtml, carText } from "./render.js";
import { estimateLanded } from "./calc.js";
import { getSettings, settingOn } from "./settings.js";

// Send an email through Resend (https://resend.com).
// Requires env.RESEND_API_KEY and a verified sender domain for env.MAIL_FROM.
export async function sendEmail(env, { to, subject, html, from }) {
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
    const subject = `${lot.year} ${lot.marka_name} ${lot.model_name} — a match for your search`;
    await sendEmail(env, {
      to: client.email,
      subject,
      html: clientHtml(lot, client, wishlist, env.PUBLIC_URL, landed, showLanded),
      from: env.MAIL_FROM_CLIENT || env.MAIL_FROM_INTERNAL || env.MAIL_FROM,
    });
    result.email = true;
  }

  if (client.whatsapp) {
    try {
      await sendWhatsApp(env, client.whatsapp, carText(lot));
      result.whatsapp = true;
    } catch (err) {
      // WhatsApp is optional in Phase 1; don't fail the whole delivery.
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
      ? `${one.lot.year} ${one.lot.marka_name} ${one.lot.model_name} — a match for your search`
      : `${enriched.length} cars matched to your search`;
    await sendEmail(env, {
      to: client.email,
      subject,
      html,
      from: env.MAIL_FROM_CLIENT || env.MAIL_FROM_INTERNAL || env.MAIL_FROM,
    });
    result.email = true;
  }

  if (client.whatsapp) {
    try {
      await sendWhatsApp(env, client.whatsapp, items.map((it) => carText(it.lot)).join("\n\n"));
      result.whatsapp = true;
    } catch (err) {
      console.error("WhatsApp send skipped/failed:", err.message);
    }
  }
  return result;
}

// --- WhatsApp (Phase 2) -----------------------------------------------------
// Stub. To enable, add a provider. Twilio example is sketched below; uncomment
// and set TWILIO_* secrets. Until then this throws so callers treat it as
// "not delivered" and fall back to email.
export async function sendWhatsApp(env, toNumber, text) {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_WHATSAPP_FROM) {
    throw new Error("WhatsApp not configured (Phase 2)");
  }
  const sid = env.TWILIO_ACCOUNT_SID;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const body = new URLSearchParams({
    From: `whatsapp:${env.TWILIO_WHATSAPP_FROM}`,
    To: `whatsapp:${toNumber}`,
    Body: text,
  });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + btoa(`${sid}:${env.TWILIO_AUTH_TOKEN}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`Twilio HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.json();
}
