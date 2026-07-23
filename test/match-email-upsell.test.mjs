// The vehicle-match email carries the "Full access" upsell for non-members when
// membership is purchasable, and never for members or when selling is off.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { clientHtml } from "../src/render.js";
import { deliverToClient } from "../src/notify.js";

const LOT = { year: "2010", marka_name: "NISSAN", model_name: "GT-R", rate: "4", start: 6000000, avg_price: 6000000 };
const WL = { marka_name: "NISSAN", model_name: "GT-R", price_max: 6000000 };

test("clientHtml renders the subscribe block only when an upsell is passed", () => {
  const c = { id: 1, name: "Jane", email: "j@x.com" };
  const on = clientHtml(LOT, c, WL, "https://jdmfinder.com.au", null, false, { priceAud: 49 });
  assert.match(on, /Unlock unlimited searches - A\$49\/mo/);
  assert.match(on, /Get full access/);
  assert.match(on, /https:\/\/jdmfinder\.com\.au\/login/, "links to the portal login");
  assert.doesNotMatch(on, /[–—]/, "no en/em dashes in customer copy");
  assert.doesNotMatch(clientHtml(LOT, c, WL, "https://jdmfinder.com.au", null, false), /Unlock unlimited/);
});

// Capture the Resend payload (email HTML) without sending; skip the calc API.
function captureEmail() {
  const orig = globalThis.fetch;
  const sent = [];
  globalThis.fetch = async (u, opts) => {
    if (String(u).includes("resend.com")) { sent.push(JSON.parse(opts.body)); return new Response('{"id":"e"}', { status: 200 }); }
    return new Response("{}", { status: 200 });
  };
  return { sent, restore: () => { globalThis.fetch = orig; } };
}
function envWith(extraSql) {
  const env = makeEnv(`INSERT INTO settings (key,value) VALUES ('client_landed','0');${extraSql || ""}`);
  env.STRIPE_SECRET_KEY = "sk_test_x";
  env.RESEND_API_KEY = "re_x";
  env.PUBLIC_URL = "https://jdmfinder.com.au";
  env.MAIL_FROM_CLIENT = "hello@jdmconnect.com.au";
  return env;
}

test("deliverToClient adds the upsell for a non-member when membership is purchasable", async () => {
  const env = envWith("INSERT INTO settings (key,value) VALUES ('membership_enabled','1');");
  env.db.exec("INSERT INTO users (id,name,email,member) VALUES (5,'Free','free@x.com',0);");
  const cap = captureEmail();
  try {
    const r = await deliverToClient(env, { id: 5, name: "Free", email: "free@x.com" }, LOT, WL);
    assert.equal(r.email, true);
    assert.equal(cap.sent.length, 1);
    assert.match(cap.sent[0].html, /Unlock unlimited searches/);
  } finally { cap.restore(); }
});

test("deliverToClient omits the upsell for a paying member", async () => {
  const env = envWith("INSERT INTO settings (key,value) VALUES ('membership_enabled','1');");
  env.db.exec("INSERT INTO users (id,name,email,member) VALUES (6,'Paid','paid@x.com',1);");
  const cap = captureEmail();
  try {
    await deliverToClient(env, { id: 6, name: "Paid", email: "paid@x.com" }, LOT, WL);
    assert.equal(cap.sent.length, 1);
    assert.doesNotMatch(cap.sent[0].html, /Unlock unlimited/);
  } finally { cap.restore(); }
});

test("deliverToClient omits the upsell when membership selling is off", async () => {
  const env = envWith(""); // membership_enabled defaults to "0"
  env.db.exec("INSERT INTO users (id,name,email,member) VALUES (7,'Free2','f2@x.com',0);");
  const cap = captureEmail();
  try {
    await deliverToClient(env, { id: 7, name: "Free2", email: "f2@x.com" }, LOT, WL);
    assert.doesNotMatch(cap.sent[0].html, /Unlock unlimited/);
  } finally { cap.restore(); }
});
