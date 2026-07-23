// Stripe Checkout integration for buyer deposits.
//
// Hosted Checkout keeps card data entirely off our site (no PCI burden): we
// create a Checkout Session server-side, redirect the buyer to Stripe, and a
// signed webhook tells us when it's paid. Uses the REST API directly (no SDK),
// so it runs on Cloudflare Workers.
//
// Required secrets (set with `wrangler secret put`):
//   STRIPE_SECRET_KEY      sk_live_... or sk_test_...
//   STRIPE_WEBHOOK_SECRET  whsec_...  (from the webhook endpoint you create)
// Everything here no-ops safely until STRIPE_SECRET_KEY is set.

import { updateRequestStatus } from "./admin.js";

const STRIPE_API = "https://api.stripe.com/v1";
const enc = new TextEncoder();

export function stripeConfigured(env) {
  return !!env.STRIPE_SECRET_KEY;
}

// Flatten a nested object into Stripe's bracketed form-encoding, e.g.
// { line_items: { 0: { quantity: 1 } } } -> line_items[0][quantity]=1
function encodeForm(obj, prefix = "", out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") encodeForm(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out;
}

async function stripePost(env, path, params) {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: encodeForm(params).join("&"),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${data?.error?.message || "request failed"}`);
  return data;
}

// Create a Checkout Session for a deposit and record a pending payment row.
// Returns { url, paymentId }. amountCents is an integer minor-unit amount.
export async function createCheckoutSession(env, { client, queueId, amountCents, currency = "aud", description, successUrl, cancelUrl }) {
  if (!stripeConfigured(env)) throw new Error("Stripe is not configured");
  if (!(amountCents > 0)) throw new Error("Invalid amount");

  // Record the intent first so the webhook can resolve it by metadata.payment_id.
  const ins = await env.DB.prepare(
    "INSERT INTO payments (client_id, queue_id, amount_cents, currency, description, status) VALUES (?, ?, ?, ?, ?, 'created')"
  ).bind(client.id, queueId || null, amountCents, currency, description || null).run();
  const paymentId = ins.meta?.last_row_id;
  if (!paymentId) throw new Error("payment row insert returned no id");

  const session = await stripePost(env, "/checkout/sessions", {
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: String(client.id),
    customer_email: client.email || undefined,
    line_items: { 0: { quantity: 1, price_data: {
      currency,
      unit_amount: amountCents,
      product_data: { name: description || "JDM Connect deposit" },
    } } },
    metadata: { payment_id: String(paymentId), client_id: String(client.id), queue_id: queueId ? String(queueId) : "" },
  });

  await env.DB.prepare("UPDATE payments SET stripe_session = ? WHERE id = ?").bind(session.id, paymentId).run();
  return { url: session.url, paymentId };
}

// Create a Checkout Session for the recurring "Full access" membership and
// redirect the buyer to Stripe. Returns { url, sessionId }. Reuses an existing
// Stripe customer when we have one (so renewals attach to the same record),
// otherwise Checkout creates one from the email. amountCents is the monthly price.
export async function createSubscriptionCheckout(env, { client, amountCents, currency = "aud", successUrl, cancelUrl }) {
  if (!stripeConfigured(env)) throw new Error("Stripe is not configured");
  if (!(amountCents > 0)) throw new Error("Invalid amount");

  const params = {
    mode: "subscription",
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: String(client.id),
    line_items: { 0: { quantity: 1, price_data: {
      currency,
      unit_amount: amountCents,
      recurring: { interval: "month" },
      product_data: { name: "JDM Connect Full access" },
    } } },
    metadata: { client_id: String(client.id), kind: "membership" },
    subscription_data: { metadata: { client_id: String(client.id) } },
  };
  if (client.stripe_customer_id) params.customer = client.stripe_customer_id;
  else if (client.email) params.customer_email = client.email;

  const session = await stripePost(env, "/checkout/sessions", params);
  return { url: session.url, sessionId: session.id };
}

// Create a Stripe Billing Portal session so a member can manage or cancel their
// own subscription. Requires the Customer Portal to be enabled in the Stripe
// dashboard. Returns { url }.
export async function createBillingPortalSession(env, { customerId, returnUrl }) {
  if (!stripeConfigured(env)) throw new Error("Stripe is not configured");
  if (!customerId) throw new Error("No Stripe customer for this client");
  const session = await stripePost(env, "/billing_portal/sessions", {
    customer: customerId,
    return_url: returnUrl,
  });
  return { url: session.url };
}

// --- Webhook verification ----------------------------------------------------
function hex(bytes) {
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}
async function hmacHex(secret, payload) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return hex(new Uint8Array(sig));
}
function timingSafeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Verify a Stripe-Signature header against the raw request body. Returns the
// parsed event object, or null if the signature is missing/invalid/stale.
export async function verifyAndParseEvent(env, rawBody, sigHeader) {
  if (!env.STRIPE_WEBHOOK_SECRET || !sigHeader) return null;
  const parts = {};
  for (const p of String(sigHeader).split(",")) {
    const i = p.indexOf("=");
    if (i > 0) parts[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  }
  const t = parts.t, v1 = parts.v1;
  if (!t || !v1) return null;
  const expected = await hmacHex(env.STRIPE_WEBHOOK_SECRET, `${t}.${rawBody}`);
  if (!timingSafeEqualHex(expected, v1)) return null;
  const age = Math.abs(Date.now() / 1000 - Number(t));
  if (!Number.isFinite(age) || age > 300) return null; // 5-min replay window
  try { return JSON.parse(rawBody); } catch (e) { return null; }
}

// Apply a verified Stripe event exactly once. Stripe delivers events
// at-least-once and retries on any non-2xx, so the same event id can arrive
// more than once. We record each id the first time it is applied and skip
// repeats (returns "duplicate"), so a side effect (e.g. a future import-fee
// credit) can never run twice. If applying throws, the guard row is rolled back
// so Stripe's retry can re-run it. Falls open if the ledger table is missing,
// because the per-row writes in applyStripeEventInner are each idempotent.
export async function applyStripeEvent(env, event) {
  if (!event || !event.type) return "ignored";
  if (!event.id) return applyStripeEventInner(env, event); // nothing to dedup on
  let firstSeen = true;
  try {
    const rec = await env.DB.prepare(
      "INSERT OR IGNORE INTO stripe_events (id, type) VALUES (?, ?)"
    ).bind(event.id, event.type).run();
    firstSeen = (rec?.meta?.changes ?? 0) > 0;
  } catch (_) {
    firstSeen = true; // ledger unavailable: process rather than drop the event
  }
  if (!firstSeen) return "duplicate";
  try {
    return await applyStripeEventInner(env, event);
  } catch (err) {
    try { await env.DB.prepare("DELETE FROM stripe_events WHERE id = ?").bind(event.id).run(); } catch (_) {}
    throw err;
  }
}

// Apply a verified event to the payments / clients tables. Returns a short
// status string. Wrapped by applyStripeEvent above, which enforces exactly-once.
async function applyStripeEventInner(env, event) {
  if (!event || !event.type) return "ignored";
  const obj = event.data?.object || {};

  // Membership: a subscription Checkout completed. Mark the client a member and
  // store the Stripe customer/subscription so renewals and cancels can resolve
  // them. Checked before the deposit branch (both are checkout.session.completed).
  if (event.type === "checkout.session.completed" && (obj.mode === "subscription" || obj.metadata?.kind === "membership")) {
    const clientId = obj.client_reference_id || obj.metadata?.client_id;
    if (clientId) {
      await env.DB.prepare(
        `UPDATE users SET member = 1, sub_status = 'active',
            stripe_customer_id = COALESCE(?, stripe_customer_id),
            stripe_subscription_id = COALESCE(?, stripe_subscription_id)
          WHERE id = ?`
      ).bind(obj.customer || null, obj.subscription || null, Number(clientId)).run();
    }
    return "subscribed";
  }

  // Membership lifecycle: renewal, payment failure, cancellation. Drive the
  // member flag off the subscription status. Resolve the client by subscription
  // id (falling back to customer id if the checkout event hasn't landed yet).
  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const status = event.type === "customer.subscription.deleted" ? "canceled" : String(obj.status || "");
    const active = status === "active" || status === "trialing";
    await env.DB.prepare(
      `UPDATE users SET member = ?, sub_status = ?,
          stripe_subscription_id = COALESCE(stripe_subscription_id, ?)
        WHERE stripe_subscription_id = ?
           OR (stripe_subscription_id IS NULL AND stripe_customer_id = ? AND ? <> '')`
    ).bind(active ? 1 : 0, status, obj.id || null, obj.id || "", obj.customer || "", obj.customer || "").run();
    return active ? "sub_active" : "sub_inactive";
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const paymentId = obj.metadata?.payment_id;
    const intent = obj.payment_intent || null;
    if (paymentId) {
      await env.DB.prepare(
        "UPDATE payments SET status = 'paid', stripe_intent = ?, paid_at = datetime('now') WHERE id = ? AND status <> 'paid'"
      ).bind(intent, Number(paymentId)).run();
    } else if (obj.id) {
      await env.DB.prepare(
        "UPDATE payments SET status = 'paid', stripe_intent = ?, paid_at = datetime('now') WHERE stripe_session = ? AND status <> 'paid'"
      ).bind(intent, obj.id).run();
    }
    // CRM autopilot: a paid deposit moves the matching request to "Deposit
    // paid" without anyone typing anything. Best-effort; never fails the event.
    await advanceDepositPaid(env, obj);
    return "paid";
  }
  if (event.type === "checkout.session.expired" && obj.metadata?.payment_id) {
    await env.DB.prepare("UPDATE payments SET status = 'expired' WHERE id = ? AND status = 'created'").bind(Number(obj.metadata.payment_id)).run();
    return "expired";
  }
  return "ignored";
}

// Resolve which request a paid deposit belongs to (via the payment's queue row,
// falling back to the client's most recently active request) and advance it to
// "Deposit paid". Manual override wins: only earlier stages move. Best-effort.
async function advanceDepositPaid(env, obj) {
  try {
    const paymentId = obj.metadata?.payment_id;
    const p = paymentId
      ? await env.DB.prepare("SELECT client_id, queue_id FROM payments WHERE id = ?").bind(Number(paymentId)).first()
      : (obj.id ? await env.DB.prepare("SELECT client_id, queue_id FROM payments WHERE stripe_session = ?").bind(obj.id).first() : null);
    if (!p) return;
    let wid = null;
    if (p.queue_id) {
      const q = await env.DB.prepare("SELECT wishlist_id FROM queue WHERE id = ?").bind(Number(p.queue_id)).first();
      wid = q?.wishlist_id || null;
    }
    if (!wid && p.client_id) {
      const w = await env.DB.prepare(
        "SELECT id FROM searches WHERE client_id = ? ORDER BY COALESCE(last_activity, created_at) DESC LIMIT 1"
      ).bind(Number(p.client_id)).first();
      wid = w?.id || null;
    }
    if (!wid) return;
    const w = await env.DB.prepare("SELECT status FROM searches WHERE id = ?").bind(wid).first();
    if (w && ["new", "qualified", "searching", "vehicles_sent", "interested", "deposit_requested"].includes(w.status || "new")) {
      await updateRequestStatus(env, wid, "deposit_paid", { role: "admin", id: 0 });
    }
  } catch (e) { console.error("advanceDepositPaid failed:", e.message); }
}
