// WhatsApp delivery for matched cars. Provider-agnostic by design: Twilio is the
// active path, and the Meta WhatsApp Cloud API is wired and ready to switch to by
// setting its secrets and the `whatsapp_provider` setting to "meta" - no code
// change. Runs on Cloudflare Workers via plain fetch (no SDKs).
//
// THE TEMPLATE RULE: a business-initiated WhatsApp message (an automated match the
// customer did not just reply to) must use a Meta-approved template. So when a
// template is configured we send it; free-form body text only delivers inside the
// 24h customer-service window (and on the Twilio sandbox, which is handy for an
// end-to-end test before your real sender + template are approved).
//
// Config (secrets unless noted). Everything no-ops safely until a provider is set.
//   Provider select: the `whatsapp_provider` setting ("twilio" | "meta"), or the
//                    WHATSAPP_PROVIDER var; falls back to whichever is configured.
//   Twilio:  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
//            TWILIO_WA_CONTENT_SID  (approved Content template "HX..."; omit to
//                                    send free-form body - sandbox / within 24h)
//   Meta:    META_WA_PHONE_NUMBER_ID, META_WA_TOKEN
//            META_WA_TEMPLATE_NAME, META_WA_TEMPLATE_LANG (e.g. "en_AU"; omit to
//                                    send free-form text - within 24h only)
//            META_WA_API_VERSION (optional, defaults to a current Graph version)

// The public request form is AU-facing, so a bare local number defaults to +61.
const DEFAULT_CC = "61";
const META_API_VERSION = "v21.0";

// Normalize a user-entered phone to bare E.164 digits (no "+", no spaces), e.g.
// "+61 4XX XXX XXX" -> "614XXXXXXXX", "04XX XXX XXX" -> "614XXXXXXXX". WhatsApp
// and Twilio both want E.164; we add the "+"/"whatsapp:" prefix per provider.
// An already-international number (leading "+" or "00") keeps its own country code.
export function toE164(raw, defaultCc = DEFAULT_CC) {
  const s = String(raw || "").trim();
  if (!s) return "";
  const international = s.startsWith("+") || s.startsWith("00");
  let digits = s.replace(/\D/g, "");
  if (s.startsWith("00")) digits = digits.replace(/^00/, "");
  if (!international) {
    if (digits.startsWith("0")) digits = defaultCc + digits.slice(1);
    else if (!digits.startsWith(defaultCc)) digits = defaultCc + digits;
  }
  return digits;
}

function twilioConfigured(env) {
  return !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_WHATSAPP_FROM);
}
function metaConfigured(env) {
  return !!(env.META_WA_PHONE_NUMBER_ID && env.META_WA_TOKEN);
}
export function whatsappConfigured(env) {
  return twilioConfigured(env) || metaConfigured(env);
}

// Decide which provider to use: honour the explicit preference when that provider
// is actually configured, otherwise fall back to whichever one has its secrets.
export function whatsappProvider(env, settings) {
  const pref = String(settings?.whatsapp_provider || env.WHATSAPP_PROVIDER || "twilio").toLowerCase();
  if (pref === "meta" && metaConfigured(env)) return "meta";
  if (pref === "twilio" && twilioConfigured(env)) return "twilio";
  if (twilioConfigured(env)) return "twilio";
  if (metaConfigured(env)) return "meta";
  return null;
}

// Send a matched-car WhatsApp. `msg` = { name, summary, url, bodyText, params? }.
// `params` is the ordered template variables; defaults to [name, summary, url] to
// match the recommended 3-variable template. Throws on misconfig/HTTP error so the
// caller can treat it as "not delivered" and fall back to email.
export async function sendWhatsApp(env, toNumber, msg = {}, settings = {}) {
  const to = toE164(toNumber);
  if (!to) throw new Error("WhatsApp: no usable number");
  const provider = whatsappProvider(env, settings);
  if (!provider) throw new Error("WhatsApp not configured");
  const params = msg.params || [msg.name || "there", msg.summary || "", msg.url || ""];
  return provider === "meta"
    ? sendViaMeta(env, to, msg, params)
    : sendViaTwilio(env, to, msg, params);
}

// --- Twilio (REST 2010-04-01 Messages API) ----------------------------------
async function sendViaTwilio(env, to, msg, params) {
  const sid = env.TWILIO_ACCOUNT_SID;
  const from = "whatsapp:+" + String(env.TWILIO_WHATSAPP_FROM).replace(/\D/g, "");
  const body = new URLSearchParams({ From: from, To: `whatsapp:+${to}` });
  if (env.TWILIO_WA_CONTENT_SID) {
    // Approved Content template: pass the SID and its {{1}},{{2}},... variables.
    const vars = {};
    params.forEach((p, i) => { vars[String(i + 1)] = String(p ?? ""); });
    body.set("ContentSid", env.TWILIO_WA_CONTENT_SID);
    body.set("ContentVariables", JSON.stringify(vars));
  } else {
    body.set("Body", msg.bodyText || msg.summary || "");
  }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${sid}:${env.TWILIO_AUTH_TOKEN}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) throw new Error(`Twilio WhatsApp HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// --- Meta WhatsApp Cloud API (Graph) ----------------------------------------
async function sendViaMeta(env, to, msg, params) {
  const ver = env.META_WA_API_VERSION || META_API_VERSION;
  const url = `https://graph.facebook.com/${ver}/${env.META_WA_PHONE_NUMBER_ID}/messages`;
  const payload = env.META_WA_TEMPLATE_NAME
    ? {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: env.META_WA_TEMPLATE_NAME,
          language: { code: env.META_WA_TEMPLATE_LANG || "en" },
          components: [{ type: "body", parameters: params.map((p) => ({ type: "text", text: String(p ?? "") })) }],
        },
      }
    : { messaging_product: "whatsapp", to, type: "text", text: { body: msg.bodyText || msg.summary || "" } };
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.META_WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Meta WhatsApp HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
