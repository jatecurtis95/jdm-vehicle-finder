// Public-request portal self-signup must never set a password on an EXISTING
// client (that would let anyone who knows a passwordless client's email take
// over their portal). It may only create a login for a brand-new client.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { createClient, createRequest } from "../src/admin.js";
import { passwordPolicyError } from "../src/auth.js";

function fd(obj) {
  const f = new FormData();
  // Budget is mandatory on the public form; default it so these tests exercise
  // the path under test (email/password/dedupe), not the budget guard.
  for (const [k, v] of Object.entries({ budget_aud: "35000", ...obj })) f.set(k, v);
  return f;
}

test("self-signup is refused for an email that already exists (takeover prevention)", async () => {
  const env = makeEnv();
  // A staff-created client, reachable but with no portal password yet.
  await createClient(env, fd({ name: "Victim", email: "victim@example.com" }), { role: "admin", id: 0 });
  const before = env.DB.prepare("SELECT id, pass_hash FROM clients WHERE email = ?").bind("victim@example.com").first();
  assert.ok(before && !before.pass_hash, "precondition: victim has no password");

  // Attacker submits the public form with the victim's email and a chosen password.
  const r = await createRequest(env, fd({ name: "Attacker", email: "victim@example.com", marka_name: "NISSAN", portal_password: "attacker123" }));
  assert.equal(r.ok, true);
  assert.equal(r.req.portal, false, "must not enable a login on an existing client");

  const after = env.DB.prepare("SELECT pass_hash, portal_enabled FROM clients WHERE id = ?").bind(before.id).first();
  assert.ok(!after.pass_hash, "victim's password must remain unset");
  assert.equal(after.portal_enabled, 0, "victim's portal must not be force-enabled");
});

test("self-signup creates a login for a brand-new client", async () => {
  const env = makeEnv();
  const r = await createRequest(env, fd({ name: "New Buyer", email: "new@example.com", marka_name: "TOYOTA", portal_password: "buyer12345" }));
  assert.equal(r.ok, true);
  assert.equal(r.req.portal, true);
  const c = env.DB.prepare("SELECT pass_hash, portal_enabled FROM clients WHERE email = ?").bind("new@example.com").first();
  assert.ok(c.pass_hash, "new client gets a password hash");
  assert.equal(c.portal_enabled, 1);
});

test("password policy rejects short/long/weak/bad-charset and accepts a good one", () => {
  assert.ok(passwordPolicyError("short1"));               // too short
  assert.ok(passwordPolicyError("a".repeat(33) + "1"));   // too long
  assert.ok(passwordPolicyError("alllettersonly"));       // no number
  assert.ok(passwordPolicyError("1234567890"));           // no letter
  assert.ok(passwordPolicyError("hasUmlautÜ12"));    // disallowed character
  assert.equal(passwordPolicyError("Goodpass123"), null); // valid
});

test("signup now requires an email (the login identity)", async () => {
  const env = makeEnv();
  const r = await createRequest(env, fd({ name: "No Email", whatsapp: "0400111222", marka_name: "TOYOTA", portal_password: "Goodpass123" }));
  assert.equal(r.ok, false);
  assert.equal(r.error, "email");
});

test("a brand-new signup must choose a policy-compliant password (nothing created otherwise)", async () => {
  const env = makeEnv();
  const r = await createRequest(env, fd({ name: "Weak", email: "weak@example.com", marka_name: "TOYOTA", portal_password: "weak" }));
  assert.equal(r.ok, false);
  assert.equal(r.error, "password");
  const n = (await env.DB.prepare("SELECT COUNT(*) AS n FROM clients").first()).n;
  assert.equal(n, 0, "no client is created when the password is rejected");
});

test("a second signup on an email that already has a login is refused", async () => {
  const env = makeEnv();
  await createRequest(env, fd({ name: "First", email: "dupe@example.com", marka_name: "TOYOTA", portal_password: "Goodpass123" }));
  const r = await createRequest(env, fd({ name: "Second", email: "dupe@example.com", marka_name: "HONDA", portal_password: "Another12345" }));
  assert.equal(r.ok, false);
  assert.equal(r.error, "exists");
});
