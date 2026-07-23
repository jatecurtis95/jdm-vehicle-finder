// Item 2: CSRF protection. Admin, agent, buyer-portal and dealer actions all
// authenticate with a session cookie, so a state-changing request from a signed-in
// session must originate from one of our own pages. The guard sits at the single
// session gate in index.js, so it covers every authenticated route uniformly.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import worker from "../src/index.js";
import { sessionCookie } from "../src/auth.js";

const CTX = { waitUntil() {} };
const HOST = "https://jdmfinder.com.au";

function env() {
  const e = makeEnv(`INSERT INTO users (id,name,email) VALUES (1,'C','c@x.com');`);
  e.ADMIN_TOKEN = "test-admin-token";
  return e;
}

// Build a Cookie header from the Set-Cookie string sessionCookie() returns.
async function adminCookie(e) {
  const setCookie = await sessionCookie(e, "admin", 0);
  return setCookie.split(";")[0]; // "fsess=<value>"
}

function post(cookie, headers = {}) {
  return new Request(HOST + "/client/delete", {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/x-www-form-urlencoded", ...headers },
    body: new URLSearchParams({ id: "1" }),
  });
}

test("an authenticated POST with no Origin or Referer is blocked (403)", async () => {
  const e = env();
  const res = await worker.fetch(post(await adminCookie(e)), e, CTX);
  assert.equal(res.status, 403);
  assert.match(await res.text(), /Request blocked/);
  // The action did not run: the client row is untouched.
  assert.equal(e.db.prepare("SELECT COUNT(*) AS n FROM users WHERE id=1").get().n, 1);
});

test("an authenticated POST from a foreign Origin is blocked (403)", async () => {
  const e = env();
  const res = await worker.fetch(post(await adminCookie(e), { Origin: "https://evil.example" }), e, CTX);
  assert.equal(res.status, 403);
  assert.equal(e.db.prepare("SELECT COUNT(*) AS n FROM users WHERE id=1").get().n, 1, "not deleted");
});

test("a foreign Referer (Origin absent) is also blocked", async () => {
  const e = env();
  const res = await worker.fetch(post(await adminCookie(e), { Referer: "https://evil.example/attack" }), e, CTX);
  assert.equal(res.status, 403);
});

test("a same-origin POST passes the guard and runs the action", async () => {
  const e = env();
  const res = await worker.fetch(post(await adminCookie(e), { Origin: HOST }), e, CTX);
  assert.notEqual(res.status, 403, "same-origin is allowed through");
  assert.equal(res.status, 303, "the delete handler runs and redirects");
  assert.equal(e.db.prepare("SELECT COUNT(*) AS n FROM users WHERE id=1").get().n, 0, "client deleted");
});

test("a same-origin Referer (no Origin header) is accepted", async () => {
  const e = env();
  const res = await worker.fetch(post(await adminCookie(e), { Referer: HOST + "/admin?view=customers" }), e, CTX);
  assert.equal(res.status, 303);
});

test("the canonical/redirect hosts count as same-origin", async () => {
  const e = env();
  const res = await worker.fetch(post(await adminCookie(e), { Origin: "https://finder.jdmconnect.com.au" }), e, CTX);
  assert.notEqual(res.status, 403);
});

test("a GET on an authenticated session is never blocked by the CSRF guard", async () => {
  const e = env();
  const req = new Request(HOST + "/admin", { headers: { Cookie: await adminCookie(e) } });
  const res = await worker.fetch(req, e, CTX);
  assert.notEqual(res.status, 403, "reads are unaffected");
});

test("an unauthenticated POST (no session) is not CSRF-blocked; it redirects to login", async () => {
  const e = env();
  const res = await worker.fetch(post("nonsense=1"), e, CTX);
  // No valid session → the session gate redirects to /login before the guard,
  // so a logged-out request never sees the 403.
  assert.equal(res.status, 303);
  assert.match(res.headers.get("Location") || "", /\/login/);
});
