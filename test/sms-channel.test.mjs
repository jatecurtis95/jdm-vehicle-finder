// Phase 4: SMS as a delivery channel, gated behind the sms_enabled setting
// (default OFF) and wired end to end. The send path is a small extension of the
// existing Twilio integration: same Messages API, plain From/To and Body.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { smsConfigured, sendSms } from "../src/whatsapp.js";
import { getSettings, saveSettings } from "../src/settings.js";
import { deliverToClient } from "../src/notify.js";

const TWILIO = { TWILIO_ACCOUNT_SID: "ACxxx", TWILIO_AUTH_TOKEN: "tok", TWILIO_SMS_FROM: "+61400000000" };

function stubFetch() {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    calls.push({ url: String(url), body: opts && opts.body ? String(opts.body) : "" });
    return { ok: true, status: 200, json: async () => ({ sid: "SMxxx" }), text: async () => "" };
  };
  return { calls, restore: () => { globalThis.fetch = orig; } };
}

test("smsConfigured needs account, token and a sender", () => {
  assert.equal(smsConfigured({}), false);
  assert.equal(smsConfigured({ TWILIO_ACCOUNT_SID: "a", TWILIO_AUTH_TOKEN: "b" }), false);
  assert.equal(smsConfigured({ ...TWILIO }), true);
  assert.equal(smsConfigured({ TWILIO_ACCOUNT_SID: "a", TWILIO_AUTH_TOKEN: "b", TWILIO_MESSAGING_SERVICE_SID: "MG1" }), true);
});

test("sendSms posts a plain SMS to the Twilio Messages API", async () => {
  const { calls, restore } = stubFetch();
  try {
    await sendSms({ ...TWILIO }, "0412345678", { bodyText: "hello" });
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /api\.twilio\.com\/2010-04-01\/Accounts\/ACxxx\/Messages\.json/);
    assert.match(calls[0].body, /To=%2B61412345678/); // E.164, url-encoded +
    assert.match(calls[0].body, /From=%2B61400000000/);
    assert.match(calls[0].body, /Body=hello/);
    assert.doesNotMatch(calls[0].body, /whatsapp/i); // a plain SMS, not WhatsApp
  } finally { restore(); }
});

test("sendSms uses a Messaging Service SID when set, instead of From", async () => {
  const { calls, restore } = stubFetch();
  try {
    await sendSms({ TWILIO_ACCOUNT_SID: "ACx", TWILIO_AUTH_TOKEN: "t", TWILIO_MESSAGING_SERVICE_SID: "MG9" }, "0412345678", { bodyText: "hi" });
    assert.match(calls[0].body, /MessagingServiceSid=MG9/);
    assert.doesNotMatch(calls[0].body, /(^|&)From=/);
  } finally { restore(); }
});

test("sendSms refuses when unconfigured or given no number", async () => {
  await assert.rejects(() => sendSms({}, "0412345678", { bodyText: "x" }), /not configured/);
  await assert.rejects(() => sendSms({ ...TWILIO }, "", { bodyText: "x" }), /no usable number/);
});

test("sms_enabled defaults off and saveSettings persists it", async () => {
  const env = makeEnv();
  assert.equal((await getSettings(env)).sms_enabled, "0");
  await saveSettings(env, { get: (k) => (k === "sms_enabled" ? "on" : null) });
  assert.equal((await getSettings(env)).sms_enabled, "1");
});

test("deliverToClient sends SMS when enabled and configured", async () => {
  const env = makeEnv();
  Object.assign(env, TWILIO, { PUBLIC_URL: "https://jdmfinder.com.au" });
  env.db.exec("INSERT INTO settings (key,value) VALUES ('send_to_client','1'),('sms_enabled','1');");
  const { calls, restore } = stubFetch();
  try {
    const client = { id: 1, name: "Sam", email: null, whatsapp: "0412345678" };
    const res = await deliverToClient(env, client, { year: 1999, marka_name: "NISSAN", model_name: "SKYLINE" }, {});
    assert.equal(res.sms, true);
    assert.equal(calls.length, 1, "exactly one SMS send");
    assert.match(calls[0].body, /Body=JDM\+Connect/);
  } finally { restore(); }
});

test("deliverToClient does not send SMS when the toggle is off", async () => {
  const env = makeEnv();
  Object.assign(env, TWILIO, { PUBLIC_URL: "https://jdmfinder.com.au" });
  env.db.exec("INSERT INTO settings (key,value) VALUES ('send_to_client','1'),('sms_enabled','0');");
  const { calls, restore } = stubFetch();
  try {
    const client = { id: 1, name: "Sam", email: null, whatsapp: "0412345678" };
    const res = await deliverToClient(env, client, { year: 1999, marka_name: "NISSAN", model_name: "SKYLINE" }, {});
    assert.equal(res.sms, false);
    assert.equal(calls.length, 0);
  } finally { restore(); }
});
