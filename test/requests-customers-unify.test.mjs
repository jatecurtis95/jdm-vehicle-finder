// Removing the Requests/Customers double-handling, without merging the tables.
//
// Two frictions are fixed and the Requests list is clarified:
//   * requestsView groups the pipeline by CUSTOMER: a returning buyer's several
//     searches read as one cluster (count badge on the head), pipeline counters
//     still tally per request, and every row still deep-links to the profile.
//   * createAdminRequest is the one-step staff "new request": it match-or-creates
//     the customer (source 'jdm') and adds the wishlist in a single submit,
//     reusing the public path's dedup + same-car refresh so no duplicate customer
//     or REQ is ever spawned. The route is staff-only.
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { adminPage, createAdminRequest } from "../src/admin.js";
import { sessionCookie } from "../src/auth.js";
import { makeEnv } from "./helpers/d1.mjs";

const ADMIN = { role: "admin", id: 0 };
const CTX = { waitUntil() {} };
const HOST = "https://jdmfinder.com.au";

const fd = (obj) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
};
async function cookieFor(env, role, id) {
  return (await sessionCookie(env, role, id)).split(";")[0];
}
// Read a pipeline stage card's count out of the rendered Requests view.
const pipeCount = (html, st) => {
  const m = html.match(new RegExp(`data-st="${st}"[^>]*><div class="pc-n">(\\d+)</div>`));
  return m ? Number(m[1]) : null;
};

// --- Feature 2: the Requests list groups by customer -------------------------

function groupedEnv() {
  // Rita is a returning customer (two active searches); Sam has one. Sam's is
  // the most recently active, so his cluster should lead.
  return makeEnv(`
    INSERT INTO clients (id, name, email, source) VALUES
      (1, 'Repeat Rita', 'rita@example.com', 'jdm'),
      (2, 'Solo Sam', 'sam@example.com', 'jdm');
    INSERT INTO wishlists (id, client_id, marka_name, model_name, active, status, last_activity, created_at) VALUES
      (10, 1, 'TOYOTA', 'SUPRA',   1, 'new',       datetime('now','-1 hour'),    datetime('now','-2 days')),
      (11, 1, 'NISSAN', 'SKYLINE', 1, 'new',       datetime('now','-3 hours'),   datetime('now','-1 day')),
      (12, 2, 'MAZDA',  'RX7',     1, 'searching', datetime('now','-30 minutes'),datetime('now','-5 hours'));
  `);
}

test("requestsView groups a returning customer's searches into one cluster with a count badge", async () => {
  const html = await adminPage(await groupedEnv(), "requests", ADMIN);
  // Rita's two searches are one cluster: a head row plus a continuation row,
  // both keyed to her client id, and a "2 requests" badge on the head.
  assert.match(html, /class="req-row req-head req-grp"[^>]*data-client="1"/, "cluster head row for the repeat customer");
  assert.match(html, /class="req-row req-cont req-grp"[^>]*data-client="1"/, "continuation row for the same customer");
  assert.match(html, /class="req-repeat"[^>]*>2 requests</, "returning-customer count badge");
  // Sam is a solo cluster: a head row with no group markers.
  assert.match(html, /class="req-row req-head"[^>]*data-client="2"/, "solo customer renders as a plain head row");
  assert.doesNotMatch(html, /class="req-row (req-head|req-cont) req-grp"[^>]*data-client="2"/, "the solo customer is never marked as a group");
});

test("pipeline counters still tally per request, not per customer", async () => {
  const html = await adminPage(await groupedEnv(), "requests", ADMIN);
  // Two New requests (both Rita's), one Searching (Sam's) - counted per wishlist.
  assert.equal(pipeCount(html, "new"), 2, "New stage counts both of the returning customer's requests");
  assert.equal(pipeCount(html, "searching"), 1, "Searching stage counts the one request");
});

test("each grouped request row still deep-links to the customer profile", async () => {
  const html = await adminPage(await groupedEnv(), "requests", ADMIN);
  assert.match(html, /href="\/admin\?view=client&id=1"/, "the returning customer's rows open her profile");
  assert.match(html, /href="\/admin\?view=client&id=2"/, "the solo customer's row opens his profile");
  // Every request keeps its own REQ reference inside the cluster.
  for (const ref of ["REQ-10", "REQ-11", "REQ-12"]) assert.ok(html.includes(ref), `${ref} rendered`);
});

// --- Feature 1: one-step admin "new request" --------------------------------

test("one-step create: a brand-new email creates a jdm customer plus a wishlist", async () => {
  const env = makeEnv();
  const r = await createAdminRequest(env, fd({ name: "Nina New", email: "nina@example.com", marka_name: "HONDA", model_name: "CIVIC" }), ADMIN);
  assert.equal(r.ok, true);
  assert.equal(r.created, true);
  assert.equal(r.attached, false);
  const clients = (await env.DB.prepare("SELECT id, source FROM clients").all()).results;
  assert.equal(clients.length, 1, "one new customer");
  assert.equal(clients[0].source, "jdm", "staff-added customers are tagged jdm");
  const wls = (await env.DB.prepare("SELECT client_id, marka_name FROM wishlists").all()).results;
  assert.equal(wls.length, 1, "one new request");
  assert.equal(wls[0].client_id, r.clientId, "the request is attached to the new customer");
  assert.equal(wls[0].marka_name, "HONDA");
});

test("one-step create: an existing customer's email attaches the request, no duplicate customer", async () => {
  const env = makeEnv();
  const first = await createAdminRequest(env, fd({ name: "Rita", email: "rita@example.com", marka_name: "TOYOTA", model_name: "SUPRA" }), ADMIN);
  // Same person, different car, email in a different case - must fold in.
  const second = await createAdminRequest(env, fd({ name: "Rita Again", email: "RITA@Example.com", marka_name: "NISSAN", model_name: "SKYLINE" }), ADMIN);
  assert.equal(second.ok, true);
  assert.equal(second.created, false);
  assert.equal(second.attached, true);
  assert.equal(second.clientId, first.clientId, "attached to the existing customer");
  assert.equal((await env.DB.prepare("SELECT COUNT(*) AS n FROM clients").first()).n, 1, "no duplicate customer");
  assert.equal((await env.DB.prepare("SELECT COUNT(*) AS n FROM wishlists WHERE client_id=?").bind(first.clientId).first()).n, 2, "both requests on the one customer");
});

test("one-step create: matching by phone attaches even when the email is new", async () => {
  const env = makeEnv();
  const first = await createAdminRequest(env, fd({ name: "Phil", whatsapp: "0412 345 678", marka_name: "TOYOTA", model_name: "AE86" }), ADMIN);
  const second = await createAdminRequest(env, fd({ name: "Phil P", email: "phil@example.com", whatsapp: "+61412345678", marka_name: "MAZDA", model_name: "RX8" }), ADMIN);
  assert.equal(second.attached, true);
  assert.equal(second.clientId, first.clientId, "same phone, one customer");
  assert.equal((await env.DB.prepare("SELECT COUNT(*) AS n FROM clients").first()).n, 1);
});

test("one-step create: the same car for a customer refreshes the request, no duplicate REQ", async () => {
  const env = makeEnv();
  const first = await createAdminRequest(env, fd({ name: "Rita", email: "rita@example.com", marka_name: "TOYOTA", model_name: "SUPRA" }), ADMIN);
  // Same make+model (any case) reuses the existing wishlist instead of adding one.
  const again = await createAdminRequest(env, fd({ name: "Rita", email: "rita@example.com", marka_name: "toyota", model_name: "supra" }), ADMIN);
  assert.equal(again.ok, true);
  assert.equal(again.wishlistId, first.wishlistId, "same make+model refreshes the one request");
  assert.equal((await env.DB.prepare("SELECT COUNT(*) AS n FROM wishlists").first()).n, 1, "no duplicate REQ");
});

test("one-step create requires a reachable customer (name + a contact channel)", async () => {
  const env = makeEnv();
  assert.equal((await createAdminRequest(env, fd({ email: "x@example.com", marka_name: "TOYOTA", model_name: "SUPRA" }), ADMIN)).error, "name");
  assert.equal((await createAdminRequest(env, fd({ name: "No Contact", marka_name: "TOYOTA", model_name: "SUPRA" }), ADMIN)).error, "contact");
  assert.equal((await env.DB.prepare("SELECT COUNT(*) AS n FROM clients").first()).n, 0, "nothing stored for an unreachable customer");
});

test("one-step create is scoped: an agent's new customer is theirs, not the public pool", async () => {
  const env = makeEnv();
  // A public customer with this email already exists.
  await createAdminRequest(env, fd({ name: "Public Pam", email: "pam@example.com", marka_name: "MAZDA", model_name: "MX5" }), ADMIN);
  // An agent using the same email gets their OWN customer (different scope).
  const r = await createAdminRequest(env, fd({ name: "Pam", email: "pam@example.com", marka_name: "MAZDA", model_name: "MX5" }), { role: "agent", id: 7 });
  assert.equal(r.created, true, "the agent gets their own customer, not the public one");
  const rows = (await env.DB.prepare("SELECT agent_id FROM clients WHERE lower(email)='pam@example.com' ORDER BY id").all()).results;
  assert.equal(rows.length, 2);
  assert.equal(rows[0].agent_id, null, "the public customer stays in the shared pool");
  assert.equal(rows[1].agent_id, 7, "the agent's customer is scoped to them");
});

// --- Staff-only gating on the route -----------------------------------------

test("the one-step request route is wired for staff and creates through the worker", async () => {
  const env = makeEnv();
  env.ADMIN_TOKEN = "test-admin-token"; // session signing key
  const cookie = await cookieFor(env, "admin", 0);
  const body = new URLSearchParams({ name: "Wade Worker", email: "wade@example.com", marka_name: "SUBARU", model_name: "WRX" });
  const res = await worker.fetch(new Request(HOST + "/request/new", {
    method: "POST", redirect: "manual",
    headers: { Cookie: cookie, Origin: HOST, "content-type": "application/x-www-form-urlencoded" },
    body,
  }), env, CTX);
  assert.equal(res.status, 303);
  assert.match(res.headers.get("location") || "", /view=client&id=\d+/, "lands on the new customer's profile");
  const c = await env.DB.prepare("SELECT source FROM clients WHERE lower(email)='wade@example.com'").first();
  assert.ok(c, "the customer was created");
  assert.equal(c.source, "jdm");
});

test("a buyer (client) session cannot reach the one-step request route", async () => {
  const env = makeEnv(`INSERT INTO clients (id, name, email, portal_enabled) VALUES (50, 'Buyer Bea', 'bea@example.com', 1);`);
  env.ADMIN_TOKEN = "test-admin-token"; // session signing key
  const cookie = await cookieFor(env, "client", 50);
  const body = new URLSearchParams({ name: "Gate Crash", email: "gate@example.com", marka_name: "TOYOTA", model_name: "YARIS" });
  const res = await worker.fetch(new Request(HOST + "/request/new", {
    method: "POST", redirect: "manual",
    headers: { Cookie: cookie, Origin: HOST, "content-type": "application/x-www-form-urlencoded" },
    body,
  }), env, CTX);
  // The buyer is diverted to their own portal; the admin handler never runs.
  assert.equal(res.status, 303);
  assert.match(res.headers.get("location") || "", /\/portal/, "buyer bounced to the portal");
  const created = await env.DB.prepare("SELECT id FROM clients WHERE lower(email)='gate@example.com'").first();
  assert.equal(created, null, "no admin customer/request created from a buyer session");
});
