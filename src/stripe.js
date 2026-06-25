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

// Apply a verified event to the payments table. Returns a short status string.
export async function applyStripeEvent(env, event) {
  if (!event || !event.type) return "ignored";
  const obj = event.data?.object || {};
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
    return "paid";
  }
  if (event.type === "checkout.session.expired" && obj.metadata?.payment_id) {
    await env.DB.prepare("UPDATE payments SET status = 'expired' WHERE id = ? AND status = 'created'").bind(Number(obj.metadata.payment_id)).run();
    return "expired";
  }
  return "ignored";
}
