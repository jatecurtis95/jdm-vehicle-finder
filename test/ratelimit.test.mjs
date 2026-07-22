import { test } from "node:test";
import assert from "node:assert/strict";
import { requestRateLimited } from "../src/index.js";
import { makeEnv } from "./helpers/d1.mjs";

const countRows = (env) => env.db.prepare("SELECT bucket, count, reset_at FROM rate_limits ORDER BY bucket").all();

test("fails closed when the D1 limiter is unavailable", async () => {
  assert.equal(await requestRateLimited({}, { ip: "1.1.1.1", email: "a@b.com" }), true);
});

test("allows under the limit and atomically increments every applicable bucket", async () => {
  const env = makeEnv();
  assert.equal(await requestRateLimited(env, {
    ip: "1.1.1.1", email: "A@B.com", whatsapp: "0412345678",
  }), false);
  const rows = countRows(env);
  assert.equal(rows.length, 3);
  assert.ok(rows.every((row) => row.count === 1 && row.reset_at > Date.now()));
  assert.ok(rows.every((row) => !/1\.1\.1\.1|a@b\.com|412345678/i.test(row.bucket)), "identifiers are hashed at rest");
});

test("blocks once the per-IP cap is exceeded", async () => {
  const env = makeEnv();
  for (let i = 0; i < 8; i++) {
    assert.equal(await requestRateLimited(env, { ip: "9.9.9.9" }), false, `attempt ${i + 1} is within cap`);
  }
  assert.equal(await requestRateLimited(env, { ip: "9.9.9.9" }), true);
});

test("blocks the same contact across fresh IPs", async () => {
  const env = makeEnv();
  for (let i = 0; i < 6; i++) {
    assert.equal(await requestRateLimited(env, { ip: `2.2.2.${i}`, email: "victim@b.com" }), false);
  }
  assert.equal(await requestRateLimited(env, { ip: "2.2.2.99", email: "victim@b.com" }), true);
});

test("blocks the same phone even when it is reformatted", async () => {
  const env = makeEnv();
  for (let i = 0; i < 6; i++) {
    assert.equal(await requestRateLimited(env, { ip: `3.3.3.${i}`, whatsapp: "0412 345 678" }), false);
  }
  assert.equal(await requestRateLimited(env, { ip: "3.3.3.99", whatsapp: "+61 412 345 678" }), true);
});

test("a too-short phone does not create a contact bucket", async () => {
  const env = makeEnv();
  assert.equal(await requestRateLimited(env, { ip: "4.4.4.4", whatsapp: "123" }), false);
  assert.equal(countRows(env).length, 1, "only the IP bucket is stored");
});

test("D1 errors fail closed instead of silently disabling protection", async () => {
  const env = makeEnv();
  env.DB.prepare = () => { throw new Error("simulated D1 outage"); };
  assert.equal(await requestRateLimited(env, { ip: "5.5.5.5", email: "a@b.com" }), true);
});

test("concurrent increments do not lose updates", async () => {
  const env = makeEnv();
  const results = await Promise.all(Array.from({ length: 20 }, () =>
    requestRateLimited(env, { ip: "6.6.6.6" })));
  assert.equal(results.filter((limited) => !limited).length, 8);
  assert.equal(results.filter(Boolean).length, 12);
  assert.equal(countRows(env)[0].count, 20);
});

test("an expired bucket resets atomically on the next request", async () => {
  const env = makeEnv();
  assert.equal(await requestRateLimited(env, { ip: "7.7.7.7" }), false);
  env.db.prepare("UPDATE rate_limits SET count = 99, reset_at = ?").run(Date.now() - 1);
  assert.equal(await requestRateLimited(env, { ip: "7.7.7.7" }), false);
  const row = countRows(env)[0];
  assert.equal(row.count, 1);
  assert.ok(row.reset_at > Date.now());
});
