import { test } from "node:test";
import assert from "node:assert/strict";
import { sendWhatsApp, toE164, whatsappProvider, whatsappConfigured } from "../src/whatsapp.js";

const TWILIO = { TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "tok", TWILIO_WHATSAPP_FROM: "+14155238886" };
const META = { META_WA_PHONE_NUMBER_ID: "PNID", META_WA_TOKEN: "metatok" };
const MSG = { name: "Stephen", summary: "1999 Nissan Skyline", url: "https://x/portal", bodyText: "line1\nline2" };

// Capture the outbound request by stubbing fetch; restore after.
async function capture(fn) {
  const saved = globalThis.fetch;
  let req = null;
  globalThis.fetch = async (url, opts) => {
    req = { url, opts };
    return { ok: true, status: 200, json: async () => ({ ok: true }), text: async () => "" };
  };
  try { await fn(); return req; } finally { globalThis.fetch = saved; }
}

test("toE164 normalizes AU local and international numbers to bare E.164 digits", () => {
  assert.equal(toE164("0412 345 678"), "61412345678");
  assert.equal(toE164("+61 412 345 678"), "61412345678");
  assert.equal(toE164("61412345678"), "61412345678");
  assert.equal(toE164("0061412345678"), "61412345678");
  assert.equal(toE164("+1 (415) 523-8886"), "14155238886"); // keeps its own country code
  assert.equal(toE164(""), "");
});

test("Twilio free-form: posts whatsapp From/To and a plain Body when no template SID", async () => {
  const req = await capture(() => sendWhatsApp(TWILIO, "0412 345 678", MSG, {}));
  assert.match(req.url, /api\.twilio\.com.*Messages\.json/);
  assert.equal(req.opts.body.get("From"), "whatsapp:+14155238886");
  assert.equal(req.opts.body.get("To"), "whatsapp:+61412345678");
  assert.equal(req.opts.body.get("Body"), "line1\nline2");
  assert.ok(!req.opts.body.get("ContentSid"), "no template used");
});

test("Twilio template: posts ContentSid and numbered ContentVariables", async () => {
  const env = { ...TWILIO, TWILIO_WA_CONTENT_SID: "HX123" };
  const req = await capture(() => sendWhatsApp(env, "0412345678", MSG, {}));
  assert.equal(req.opts.body.get("ContentSid"), "HX123");
  assert.deepEqual(JSON.parse(req.opts.body.get("ContentVariables")), {
    "1": "Stephen", "2": "1999 Nissan Skyline", "3": "https://x/portal",
  });
});

test("Meta template: posts a template message with body parameters in order", async () => {
  const env = { ...META, META_WA_TEMPLATE_NAME: "car_match", META_WA_TEMPLATE_LANG: "en_AU" };
  const req = await capture(() => sendWhatsApp(env, "0412345678", MSG, { whatsapp_provider: "meta" }));
  assert.match(req.url, /graph\.facebook\.com.*PNID\/messages/);
  const body = JSON.parse(req.opts.body);
  assert.equal(body.type, "template");
  assert.equal(body.to, "61412345678");
  assert.equal(body.template.name, "car_match");
  assert.equal(body.template.language.code, "en_AU");
  assert.deepEqual(body.template.components[0].parameters.map((p) => p.text), [
    "Stephen", "1999 Nissan Skyline", "https://x/portal",
  ]);
});

test("Meta free-form: posts a text message when no template name is set", async () => {
  const req = await capture(() => sendWhatsApp(META, "0412345678", MSG, { whatsapp_provider: "meta" }));
  const body = JSON.parse(req.opts.body);
  assert.equal(body.type, "text");
  assert.equal(body.text.body, "line1\nline2");
});

test("provider selection honours the setting, then falls back to whatever is configured", () => {
  const both = { ...TWILIO, ...META };
  assert.equal(whatsappProvider(both, { whatsapp_provider: "meta" }), "meta");
  assert.equal(whatsappProvider(both, { whatsapp_provider: "twilio" }), "twilio");
  assert.equal(whatsappProvider(both, {}), "twilio"); // default preference
  assert.equal(whatsappProvider(META, { whatsapp_provider: "twilio" }), "meta"); // twilio not configured -> fall back
  assert.equal(whatsappProvider({}, {}), null);
});

test("whatsappConfigured is true when either provider has its secrets", () => {
  assert.equal(whatsappConfigured({}), false);
  assert.equal(whatsappConfigured(TWILIO), true);
  assert.equal(whatsappConfigured(META), true);
});

test("sendWhatsApp throws (caller falls back to email) when unconfigured or numberless", async () => {
  await assert.rejects(() => sendWhatsApp({}, "0412345678", MSG, {}), /not configured/);
  await assert.rejects(() => sendWhatsApp(TWILIO, "", MSG, {}), /no usable number/);
});
