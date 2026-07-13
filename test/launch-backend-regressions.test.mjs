// RED-stage launch regressions. These tests capture the externally observable
// contracts that the launch audit found broken; production changes come later.
import { test } from "node:test";
import assert from "node:assert/strict";

import worker from "../src/index.js";
import { createRequest } from "../src/admin.js";
import { query, searchLots } from "../src/avtonet.js";
import { runAll } from "../src/matcher.js";
import { sessionCookie } from "../src/auth.js";
import { makeEnv } from "./helpers/d1.mjs";

const HOST = "https://jdmfinder.com.au";
const CTX = { waitUntil() {} };

function form(values = {}) {
  const out = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) {
      for (const item of value) out.append(key, String(item));
    } else {
      out.set(key, String(value));
    }
  }
  return out;
}

function requestForm(overrides = {}) {
  return form({
    name: "Launch Buyer",
    email: "launch-buyer@example.com",
    whatsapp: "0412345678",
    portal_password: "Goodpass123",
    marka_name: "NISSAN",
    model_name: "SKYLINE",
    year_min: "1995",
    year_max: "2000",
    budget_aud: "55000",
    ...overrides,
  });
}

async function cookieFor(env, role, id) {
  env.ADMIN_TOKEN ||= "launch-regression-session-secret";
  return (await sessionCookie(env, role, id)).split(";")[0];
}

async function routedPost(env, path, values, { role = "admin", id = 0, origin = HOST } = {}) {
  const cookie = await cookieFor(env, role, id);
  return worker.fetch(new Request(HOST + path, {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: origin,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(values),
  }), env, CTX);
}

function matcherEnv() {
  const env = makeEnv(`
    INSERT INTO clients (id, name, email, state, archived)
      VALUES (1, 'Active buyer', 'active@example.com', 'VIC', 0);
    INSERT INTO wishlists (id, client_id, marka_name, model_name, active)
      VALUES (1, 1, 'NISSAN', 'SKYLINE', 1);
    INSERT INTO settings (key, value) VALUES ('budget_filter', '0'), ('email_alerts', '0');
  `);
  env.ADMIN_TOKEN = "launch-regression-session-secret";
  env.AUCTION_FIXTURE = `<aj><row>
    <id>LAUNCH-LOT-1</id><marka_name>NISSAN</marka_name><model_name>SKYLINE</model_name>
    <year>1999</year><auction_date>2099-01-01 10:00:00</auction_date>
    <start>0</start><avg_price>0</avg_price><lhdrive>0</lhdrive>
  </row></aj>`;
  return env;
}

test("GET and HEAD /run never execute searches; only a same-origin POST may run them", async () => {
  const readCounts = {};
  for (const method of ["GET", "HEAD"]) {
    const env = matcherEnv();
    const cookie = await cookieFor(env, "admin", 0);
    await worker.fetch(new Request(HOST + "/run", { method, headers: { Cookie: cookie } }), env, CTX);
    readCounts[method] = env.db.prepare("SELECT COUNT(*) AS n FROM queue").get().n;
  }

  const foreign = matcherEnv();
  const blocked = await routedPost(foreign, "/run", {}, { origin: "https://evil.example" });
  assert.equal(blocked.status, 403, "a cross-site POST is rejected by the same-origin guard");
  assert.equal(foreign.db.prepare("SELECT COUNT(*) AS n FROM queue").get().n, 0);

  const own = matcherEnv();
  const ran = await routedPost(own, "/run", {});
  assert.deepEqual({
    getQueued: readCounts.GET,
    headQueued: readCounts.HEAD,
    foreignStatus: blocked.status,
    foreignQueued: foreign.db.prepare("SELECT COUNT(*) AS n FROM queue").get().n,
    ownStatus: ran.status,
    ownQueued: own.db.prepare("SELECT COUNT(*) AS n FROM queue").get().n,
  }, {
    getQueued: 0,
    headQueued: 0,
    foreignStatus: 403,
    foreignQueued: 0,
    ownStatus: 303,
    ownQueued: 1,
  });
});

test("portal add-search redirects an empty search to an error, never to Saved", async () => {
  const env = makeEnv(`
    INSERT INTO clients (id, name, email, portal_enabled, member)
      VALUES (1, 'Buyer', 'buyer@example.com', 1, 1);
  `);
  const res = await routedPost(env, "/portal/wishlist", {}, { role: "client", id: 1 });
  const location = new URL(res.headers.get("Location"));
  assert.deepEqual({
    err: location.searchParams.get("err"),
    hasSuccess: location.searchParams.has("ok"),
    savedRows: env.db.prepare("SELECT COUNT(*) AS n FROM wishlists").get().n,
  }, { err: "term", hasSuccess: false, savedRows: 0 });
});

test("portal edit rejects an empty search, preserves the old criteria, and never redirects to Saved", async () => {
  const env = makeEnv(`
    INSERT INTO clients (id, name, email, portal_enabled, member)
      VALUES (1, 'Buyer', 'buyer@example.com', 1, 1);
    INSERT INTO wishlists (id, client_id, marka_name, model_name, year_min, year_max, active)
      VALUES (10, 1, 'NISSAN', 'SKYLINE', 1995, 2000, 1);
  `);
  const res = await routedPost(env, "/portal/wishlist/edit", { id: "10" }, { role: "client", id: 1 });
  const location = new URL(res.headers.get("Location"));
  const row = env.db.prepare("SELECT marka_name, model_name, year_min, year_max FROM wishlists WHERE id = 10").get();
  assert.deepEqual(
    {
      err: location.searchParams.get("err"),
      hasSuccess: location.searchParams.has("ok"),
      savedCriteria: { ...row },
    },
    {
      err: "term",
      hasSuccess: false,
      savedCriteria: { marka_name: "NISSAN", model_name: "SKYLINE", year_min: 1995, year_max: 2000 },
    },
  );
});

test("the generic admin action wrapper renders returned ok:false as an error", async () => {
  const env = makeEnv();
  const res = await routedPost(env, "/request/status", { id: "999", status: "not-a-real-status" });
  const location = new URL(res.headers.get("Location"));
  assert.ok(location.searchParams.get("notice_err"), "the redirect carries an error notice");
  assert.equal(location.searchParams.has("notice"), false, "it must not claim Status updated");
});

test("an anonymous public request rejects a blank required name before writing anything", async () => {
  const env = makeEnv();
  const result = await createRequest(env, requestForm({ name: "" }));
  assert.deepEqual(
    { ok: result.ok, error: result.error },
    { ok: false, error: "name" },
  );
  assert.equal(env.db.prepare("SELECT COUNT(*) AS n FROM clients").get().n, 0);
  assert.equal(env.db.prepare("SELECT COUNT(*) AS n FROM wishlists").get().n, 0);
});

test("a repeated public request updates every duplicate search criterion instead of retaining stale values", async () => {
  const env = makeEnv();
  const first = await createRequest(env, requestForm({
    label: "Old criteria",
    year_min: "1995",
    year_max: "1998",
    budget_aud: "45000",
    mileage_max: "140000",
    rate_min: "3",
    kuzov: "ECR33",
    grade_kw: "GTS",
    model_code: "ECR33",
    grades: ["3", "3.5"],
  }));
  assert.equal(first.ok, true);

  const second = await createRequest(env, requestForm({
    name: "Updated Buyer",
    label: "Current criteria",
    year_min: "1999",
    year_max: "2002",
    budget_aud: "90000",
    mileage_max: "80000",
    rate_min: "4.5",
    kuzov: "BNR34",
    grade_kw: "V-SPEC",
    model_code: "BNR34",
    grades: ["4", "4.5"],
    destination_country: "New Zealand",
  }));
  assert.equal(second.ok, true);
  assert.equal(second.wishlistId, first.wishlistId, "the repeat submission remains one search");
  assert.equal(env.db.prepare("SELECT COUNT(*) AS n FROM wishlists").get().n, 1);

  const saved = env.db.prepare(`SELECT label, year_min, year_max, budget_aud, mileage_max, rate_min,
                           kuzov, grade_kw, model_code, grades, destination_country
                      FROM wishlists WHERE id = ?`).get(second.wishlistId);
  assert.deepEqual(
    { ...saved },
    {
      label: "Current criteria",
      year_min: 1999,
      year_max: 2002,
      budget_aud: 90000,
      mileage_max: 80000,
      rate_min: 4.5,
      kuzov: "BNR34",
      grade_kw: "V-SPEC",
      model_code: "BNR34",
      grades: '["4","4.5"]',
      destination_country: "New Zealand",
    },
  );
});

test("membership success only claims Full access after the client row is active", async () => {
  const env = makeEnv(`
    INSERT INTO clients (id, name, email, portal_enabled, member, sub_status)
      VALUES (1, 'Buyer', 'buyer@example.com', 1, 0, NULL);
  `);
  const cookie = await cookieFor(env, "client", 1);
  const visit = () => worker.fetch(new Request(HOST + "/portal/subscribe/success", {
    headers: { Cookie: cookie },
  }), env, CTX);

  const pending = new URL((await visit()).headers.get("Location"));
  env.db.prepare("UPDATE clients SET member = 1, sub_status = 'active' WHERE id = 1").run();
  const active = new URL((await visit()).headers.get("Location"));
  assert.deepEqual({
    pendingClaims: pending.searchParams.get("ok"),
    activeClaims: active.searchParams.get("ok"),
  }, { pendingClaims: null, activeClaims: "member" });
});

test("deposit success only claims payment received when that client's payment row is paid", async () => {
  const env = makeEnv(`
    INSERT INTO clients (id, name, email, portal_enabled)
      VALUES (1, 'Buyer', 'buyer@example.com', 1);
    INSERT INTO payments (id, client_id, amount_cents, currency, status)
      VALUES (12, 1, 50000, 'aud', 'created');
  `);
  const cookie = await cookieFor(env, "client", 1);
  const visit = () => worker.fetch(new Request(HOST + "/portal/pay/success?payment_id=12", {
    headers: { Cookie: cookie },
  }), env, CTX);

  const pending = new URL((await visit()).headers.get("Location"));
  env.db.prepare("UPDATE payments SET status = 'paid' WHERE id = 12").run();
  const paid = new URL((await visit()).headers.get("Location"));
  assert.deepEqual({
    createdClaims: pending.searchParams.get("ok"),
    paidClaims: paid.searchParams.get("ok"),
  }, { createdClaims: null, paidClaims: "paid" });
});

test("runAll excludes archived clients even when their wishlists remain active", async () => {
  const env = matcherEnv();
  env.db.exec(`
    INSERT INTO clients (id, name, email, state, archived)
      VALUES (2, 'Archived buyer', 'archived@example.com', 'VIC', 1);
    INSERT INTO wishlists (id, client_id, marka_name, model_name, active)
      VALUES (2, 2, 'NISSAN', 'SKYLINE', 1);
  `);
  await runAll(env, { role: "admin", id: 0 });
  assert.equal(env.db.prepare("SELECT COUNT(*) AS n FROM queue WHERE client_id = 1").get().n, 1);
  assert.equal(
    env.db.prepare("SELECT COUNT(*) AS n FROM queue WHERE client_id = 2").get().n,
    0,
    "archived customers cannot keep generating matches",
  );
});

test("auction search exposes a typed provider-unavailable state instead of a legitimate empty result", async () => {
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 503, text: async () => "maintenance" });
  try {
    const result = await searchLots({ API_BASE: "https://auction.test", AVTONET_CODE: "test" }, { make: "NISSAN" });
    assert.equal(result.unavailable, true, "the UI can distinguish an outage from zero matching cars");
    assert.deepEqual(result.lots, []);
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test("AVTONET requests carry an abort signal so a stalled provider cannot run forever", async () => {
  const savedFetch = globalThis.fetch;
  let signal;
  globalThis.fetch = async (_url, init = {}) => {
    signal = init.signal;
    return { ok: true, status: 200, text: async () => "<aj></aj>" };
  };
  try {
    await query({ API_BASE: "https://auction.test", AVTONET_CODE: "test" }, "SELECT * FROM main LIMIT 1");
    assert.ok(signal instanceof AbortSignal, "query supplies a bounded AbortSignal.timeout");
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test("oversized public request bodies are rejected before formData parsing", async () => {
  const env = makeEnv();
  let parsed = false;
  const request = new Request(HOST + "/request", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": "1048577",
    },
    body: "name=x",
  });
  request.formData = async () => {
    parsed = true;
    throw new Error("formData must not be reached");
  };

  const res = await worker.fetch(request, env, CTX);
  assert.deepEqual({ status: res.status, parsed }, { status: 413, parsed: false });
});

test("oversized Stripe webhooks are rejected before raw-body parsing", async () => {
  const env = makeEnv();
  env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  let parsed = false;
  const request = new Request(HOST + "/webhooks/stripe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": "1048577",
      "Stripe-Signature": "t=1,v1=bad",
    },
    body: "{}",
  });
  request.text = async () => {
    parsed = true;
    throw new Error("request.text must not be reached");
  };

  const res = await worker.fetch(request, env, CTX);
  assert.deepEqual({ status: res.status, parsed }, { status: 413, parsed: false });
});
