// Per-user session revocation: a versioned cookie stops validating once the
// account's session_ver is bumped (deactivate / portal-revoke / password reset),
// without rotating ADMIN_TOKEN. Legacy 3-part cookies are grandfathered.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { sessionCookie, getSession, bumpSessionVer, sign } from "../src/auth.js";

const FIXTURE = `
  INSERT INTO agents (id,email,name,pass_salt,pass_hash,active,session_ver)
    VALUES (1,'a1@x','A1','','',1,0);
  INSERT INTO users (id,name,email,portal_enabled,session_ver)
    VALUES (10,'C1','c@x',1,0);
`;

// makeEnv doesn't set ADMIN_TOKEN (the HMAC signing key); sessions need it.
function env() { const e = makeEnv(FIXTURE); e.ADMIN_TOKEN = "unit-test-signing-key"; return e; }

// Build a request whose Cookie header carries the given session cookie string.
function reqWith(setCookie) {
  const value = String(setCookie).split(";")[0]; // "fsess=..."
  return { headers: { get: (h) => (h === "Cookie" ? value : null) } };
}
const URLX = new URL("https://x/");

test("a fresh versioned cookie validates", async () => {
  const e = env();
  const cookie = await sessionCookie(e, "agent", 1);
  const s = await getSession(reqWith(cookie), URLX, e);
  assert.deepEqual(s, { role: "agent", id: 1 });
});

test("bumping session_ver invalidates the old cookie", async () => {
  const e = env();
  const cookie = await sessionCookie(e, "client", 10); // stamped at ver 0
  assert.ok(await getSession(reqWith(cookie), URLX, e), "valid before revoke");
  await bumpSessionVer(e, "client", 10);               // now ver 1
  assert.equal(await getSession(reqWith(cookie), URLX, e), null, "old cookie rejected");
  const fresh = await sessionCookie(e, "client", 10);  // re-login → ver 1
  assert.ok(await getSession(reqWith(fresh), URLX, e), "fresh cookie valid again");
});

test("a deleted account's versioned cookie is rejected", async () => {
  const e = env();
  const cookie = await sessionCookie(e, "agent", 1);
  await e.DB.prepare("DELETE FROM agents WHERE id = 1").run();
  assert.equal(await getSession(reqWith(cookie), URLX, e), null);
});

test("legacy 3-part cookies are grandfathered (no version check)", async () => {
  const e = env();
  const exp = Date.now() + 60000;
  const payload = `agent:1:${exp}`;                       // old 3-part format
  const legacy = `fsess=${encodeURIComponent(payload + "." + (await sign(e, payload)))}`;
  const s = await getSession(reqWith(legacy), URLX, e);
  assert.deepEqual(s, { role: "agent", id: 1 }, "old cookie still accepted until expiry");
});

test("admin cookie needs no DB row", async () => {
  const e = env();
  const cookie = await sessionCookie(e, "admin", 0);
  const s = await getSession(reqWith(cookie), URLX, e);
  assert.deepEqual(s, { role: "admin", id: 0 });
});
