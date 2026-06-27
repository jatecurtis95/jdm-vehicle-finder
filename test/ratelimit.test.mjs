import { test } from "node:test";
import assert from "node:assert/strict";
import { requestRateLimited } from "../src/index.js";

// Minimal KV stub: a Map with get/put, ignoring the TTL option.
function fakeKV(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    store: m,
    async get(k) { return m.has(k) ? m.get(k) : null; },
    async put(k, v) { m.set(k, v); },
  };
}

test("fails open when no KV is bound", async () => {
  assert.equal(await requestRateLimited({}, { ip: "1.1.1.1", email: "a@b.com" }), false);
});

test("allows under the limit and increments each key", async () => {
  const RL = fakeKV();
  const env = { RL };
  assert.equal(await requestRateLimited(env, { ip: "1.1.1.1", email: "A@B.com", whatsapp: "0412345678" }), false);
  assert.equal(RL.store.get("reqrl:ip:1.1.1.1"), "1");
  assert.equal(RL.store.get("reqrl:e:a@b.com"), "1"); // lowercased
  assert.equal(RL.store.get("reqrl:p:412345678"), "1"); // normalized phone
});

test("blocks once the per-IP cap is reached", async () => {
  const RL = fakeKV({ "reqrl:ip:9.9.9.9": "8" });
  assert.equal(await requestRateLimited({ RL }, { ip: "9.9.9.9", email: "new@b.com" }), true);
});

test("blocks the same contact even from a fresh IP (defeats IP rotation)", async () => {
  const RL = fakeKV({ "reqrl:e:victim@b.com": "6" });
  // Brand new IP, but the email has already hit its per-contact cap.
  assert.equal(await requestRateLimited({ RL }, { ip: "2.2.2.2", email: "victim@b.com" }), true);
});

test("blocks the same phone even reformatted", async () => {
  const RL = fakeKV({ "reqrl:p:412345678": "6" });
  assert.equal(await requestRateLimited({ RL }, { ip: "3.3.3.3", whatsapp: "+61 412 345 678" }), true);
});

test("a too-short phone is ignored for limiting", async () => {
  const RL = fakeKV();
  assert.equal(await requestRateLimited({ RL }, { ip: "4.4.4.4", whatsapp: "123" }), false);
  assert.equal(RL.store.has("reqrl:p:123"), false);
});

test("fails open if KV get throws", async () => {
  const env = { RL: { async get() { throw new Error("kv down"); }, async put() {} } };
  assert.equal(await requestRateLimited(env, { ip: "5.5.5.5", email: "a@b.com" }), false);
});
