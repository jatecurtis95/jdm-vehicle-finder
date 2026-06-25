// Stripe event application is idempotent and only the right rows move. The
// webhook refuses to parse without a signing secret.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { applyStripeEvent, verifyAndParseEvent } from "../src/stripe.js";

const completed = {
  type: "checkout.session.completed",
  data: { object: { metadata: { payment_id: "1" }, payment_intent: "pi_1" } },
};

test("a completed checkout marks the payment paid, and replays are idempotent", async () => {
  const env = makeEnv(`INSERT INTO payments (id,client_id,amount_cents,currency,status) VALUES (1,1,50000,'aud','created');`);
  assert.equal(await applyStripeEvent(env, completed), "paid");
  let row = env.DB.prepare("SELECT status, stripe_intent FROM payments WHERE id=1").first();
  assert.equal(row.status, "paid");
  assert.equal(row.stripe_intent, "pi_1");

  // Replay the same event: still paid, no error, nothing double-applied.
  assert.equal(await applyStripeEvent(env, completed), "paid");
  row = env.DB.prepare("SELECT status FROM payments WHERE id=1").first();
  assert.equal(row.status, "paid");
});

test("an expired event only affects a still-created payment", async () => {
  const env = makeEnv(`INSERT INTO payments (id,client_id,amount_cents,status) VALUES (1,1,50000,'created');`);
  const s = await applyStripeEvent(env, { type: "checkout.session.expired", data: { object: { metadata: { payment_id: "1" } } } });
  assert.equal(s, "expired");
  assert.equal(env.DB.prepare("SELECT status FROM payments WHERE id=1").first().status, "expired");
});

test("a paid payment is not flipped back to expired by a late expired event", async () => {
  const env = makeEnv(`INSERT INTO payments (id,client_id,amount_cents,status) VALUES (1,1,50000,'paid');`);
  await applyStripeEvent(env, { type: "checkout.session.expired", data: { object: { metadata: { payment_id: "1" } } } });
  assert.equal(env.DB.prepare("SELECT status FROM payments WHERE id=1").first().status, "paid");
});

test("verifyAndParseEvent returns null when no signing secret is configured", async () => {
  const env = makeEnv();
  const r = await verifyAndParseEvent(env, "{}", "t=1,v1=deadbeef");
  assert.equal(r, null);
});
