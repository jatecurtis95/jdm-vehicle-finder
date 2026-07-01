import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { applyStripeEvent, createSubscriptionCheckout } from "../src/stripe.js";

const seedClient = (env, over = {}) =>
  env.DB.prepare("INSERT INTO clients (id,name,email) VALUES (?,?,?)")
    .bind(over.id || 1, over.name || "Stephen", over.email || "s@example.com").run();

const memberRow = (env, id = 1) =>
  env.DB.prepare("SELECT member, sub_status, stripe_customer_id, stripe_subscription_id FROM clients WHERE id=?").bind(id).first();

test("subscription checkout completed makes the client a member and stores the ids", async () => {
  const env = makeEnv();
  await seedClient(env);
  const status = await applyStripeEvent(env, {
    type: "checkout.session.completed",
    data: { object: { mode: "subscription", client_reference_id: "1", customer: "cus_1", subscription: "sub_1" } },
  });
  assert.equal(status, "subscribed");
  const r = await memberRow(env);
  assert.equal(r.member, 1);
  assert.equal(r.sub_status, "active");
  assert.equal(r.stripe_customer_id, "cus_1");
  assert.equal(r.stripe_subscription_id, "sub_1");
});

test("a cancelled subscription removes membership", async () => {
  const env = makeEnv();
  await seedClient(env);
  await applyStripeEvent(env, { type: "checkout.session.completed", data: { object: { mode: "subscription", client_reference_id: "1", customer: "cus_1", subscription: "sub_1" } } });
  const status = await applyStripeEvent(env, { type: "customer.subscription.deleted", data: { object: { id: "sub_1", customer: "cus_1" } } });
  assert.equal(status, "sub_inactive");
  const r = await memberRow(env);
  assert.equal(r.member, 0);
  assert.equal(r.sub_status, "canceled");
});

test("subscription.updated drives member off the status (past_due clears, active restores)", async () => {
  const env = makeEnv();
  await seedClient(env);
  await applyStripeEvent(env, { type: "checkout.session.completed", data: { object: { mode: "subscription", client_reference_id: "1", customer: "cus_1", subscription: "sub_1" } } });
  await applyStripeEvent(env, { type: "customer.subscription.updated", data: { object: { id: "sub_1", status: "past_due", customer: "cus_1" } } });
  assert.equal((await memberRow(env)).member, 0);
  await applyStripeEvent(env, { type: "customer.subscription.updated", data: { object: { id: "sub_1", status: "active", customer: "cus_1" } } });
  assert.equal((await memberRow(env)).member, 1);
});

test("a subscription event never touches an unrelated client", async () => {
  const env = makeEnv();
  await seedClient(env, { id: 1 });
  await seedClient(env, { id: 2, email: "other@example.com" });
  await applyStripeEvent(env, { type: "checkout.session.completed", data: { object: { mode: "subscription", client_reference_id: "1", customer: "cus_1", subscription: "sub_1" } } });
  await applyStripeEvent(env, { type: "customer.subscription.deleted", data: { object: { id: "sub_999", customer: "cus_999" } } });
  assert.equal((await memberRow(env, 1)).member, 1, "client 1 stays a member");
  assert.equal((await memberRow(env, 2)).member, 0);
});

test("a one-off deposit checkout still marks the payment paid (no regression)", async () => {
  const env = makeEnv();
  await seedClient(env);
  const ins = await env.DB.prepare("INSERT INTO payments (client_id, amount_cents, currency, status) VALUES (1, 50000, 'aud', 'created')").run();
  const pid = ins.meta.last_row_id;
  const status = await applyStripeEvent(env, {
    type: "checkout.session.completed",
    data: { object: { mode: "payment", metadata: { payment_id: String(pid) }, payment_intent: "pi_1", id: "cs_1" } },
  });
  assert.equal(status, "paid");
  const pay = await env.DB.prepare("SELECT status FROM payments WHERE id=?").bind(pid).first();
  assert.equal(pay.status, "paid");
  // The deposit must NOT have made them a member.
  assert.equal((await memberRow(env)).member, 0);
});

test("a redelivered event with the same id is applied once, then skipped", async () => {
  const env = makeEnv();
  await seedClient(env);
  const evt = {
    id: "evt_dupe",
    type: "checkout.session.completed",
    data: { object: { mode: "subscription", client_reference_id: "1", customer: "cus_1", subscription: "sub_1" } },
  };
  assert.equal(await applyStripeEvent(env, evt), "subscribed");
  // Stripe redelivers the identical event; the guard must short-circuit it.
  assert.equal(await applyStripeEvent(env, evt), "duplicate");
  const led = await env.DB.prepare("SELECT COUNT(*) AS c FROM stripe_events WHERE id=?").bind("evt_dupe").first();
  assert.equal(led.c, 1);
});

test("a failed event is rolled back so a Stripe retry can re-process it", async () => {
  const base = makeEnv();
  await seedClient(base);
  // Wrap the DB so the clients UPDATE throws on the first attempt only; the
  // ledger insert/delete still go through to the real in-memory DB.
  let failNext = true;
  const env = { DB: {
    prepare(sql) {
      if (failNext && sql.includes("UPDATE clients")) {
        return { bind: () => ({ run: () => { throw new Error("transient db error"); } }) };
      }
      return base.DB.prepare(sql);
    },
  } };
  const evt = {
    id: "evt_retry",
    type: "checkout.session.completed",
    data: { object: { mode: "subscription", client_reference_id: "1", customer: "cus_1", subscription: "sub_1" } },
  };
  await assert.rejects(() => applyStripeEvent(env, evt));
  // The guard row must have been rolled back, so the event is not stuck as seen.
  const after = await base.DB.prepare("SELECT COUNT(*) AS c FROM stripe_events WHERE id=?").bind("evt_retry").first();
  assert.equal(after.c, 0);
  // The retry now succeeds and provisions membership.
  failNext = false;
  assert.equal(await applyStripeEvent(env, evt), "subscribed");
  assert.equal((await base.DB.prepare("SELECT member FROM clients WHERE id=1").first()).member, 1);
});

test("createSubscriptionCheckout posts a monthly recurring price", async () => {
  const saved = globalThis.fetch;
  let body = "";
  globalThis.fetch = async (_url, opts) => { body = opts.body; return { ok: true, status: 200, json: async () => ({ id: "cs_test", url: "https://stripe.test/checkout" }) }; };
  try {
    const r = await createSubscriptionCheckout({ STRIPE_SECRET_KEY: "sk_test" }, {
      client: { id: 1, email: "a@b.com" }, amountCents: 4900, currency: "aud", successUrl: "https://x/ok", cancelUrl: "https://x/no",
    });
    assert.equal(r.url, "https://stripe.test/checkout");
    assert.match(body, /mode=subscription/);
    assert.match(body, /unit_amount%5D=4900/);
    assert.match(body, /recurring%5D%5Binterval%5D=month/);
    assert.match(body, /customer_email=a%40b.com/);
    assert.match(body, /client_reference_id=1/);
  } finally {
    globalThis.fetch = saved;
  }
});
