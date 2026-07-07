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
  // The public form now requires model + year range + budget too; default them
  // so these tests exercise the path under test (email/password/dedupe), not the
  // search-field guards. Individual tests override to exercise those guards.
  for (const [k, v] of Object.entries({ budget_aud: "35000", model_name: "SUPRA", year_min: "1990", year_max: "2005", whatsapp: "0412345678", ...obj })) f.set(k, v);
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

test("signup now requires a mobile number (the form makes it mandatory)", async () => {
  const env = makeEnv();
  const r = await createRequest(env, fd({ name: "No Phone", email: "np@example.com", marka_name: "TOYOTA", portal_password: "Goodpass123", whatsapp: "" }));
  assert.equal(r.ok, false);
  assert.equal(r.error, "phone");
  assert.equal((await env.DB.prepare("SELECT COUNT(*) AS n FROM clients").first()).n, 0, "nothing created without a phone");
});

test("a brand-new signup must choose a policy-compliant password (nothing created otherwise)", async () => {
  const env = makeEnv();
  const r = await createRequest(env, fd({ name: "Weak", email: "weak@example.com", marka_name: "TOYOTA", portal_password: "weak" }));
  assert.equal(r.ok, false);
  assert.equal(r.error, "password");
  const n = (await env.DB.prepare("SELECT COUNT(*) AS n FROM clients").first()).n;
  assert.equal(n, 0, "no client is created when the password is rejected");
});

test("the request form now requires a make and a model", async () => {
  const env = makeEnv();
  const r = await createRequest(env, fd({ name: "X", email: "v1@example.com", marka_name: "NISSAN", model_name: "", portal_password: "Goodpass123" }));
  assert.equal(r.ok, false);
  assert.equal(r.error, "vehicle");
  assert.equal((await env.DB.prepare("SELECT COUNT(*) AS n FROM clients").first()).n, 0, "nothing created");
});

test("the request form now requires a sane year range", async () => {
  const env = makeEnv();
  const missing = await createRequest(env, fd({ name: "X", email: "v2@example.com", marka_name: "NISSAN", model_name: "SKYLINE", year_min: "", year_max: "", portal_password: "Goodpass123" }));
  assert.equal(missing.error, "year", "both years required");
  const inverted = await createRequest(env, fd({ name: "X", email: "v3@example.com", marka_name: "NISSAN", model_name: "SKYLINE", year_min: "2005", year_max: "1999", portal_password: "Goodpass123" }));
  assert.equal(inverted.error, "year", "from must not be after to");
});

test("a second signup on an email that already has a login folds in neutrally (V1.2 Phase 3)", async () => {
  const env = makeEnv();
  await createRequest(env, fd({ name: "First", email: "dupe@example.com", marka_name: "TOYOTA", portal_password: "Goodpass123" }));
  const before = env.DB.prepare("SELECT id, pass_hash FROM clients WHERE lower(email)='dupe@example.com'").first();
  const r = await createRequest(env, fd({ name: "Second", email: "dupe@example.com", marka_name: "HONDA", portal_password: "Another12345" }));
  // No error that reveals the account exists; the route shows the normal
  // confirmation and emails a sign-in link instead.
  assert.equal(r.ok, true);
  assert.equal(r.signinNeeded, true, "route must email a sign-in link");
  assert.equal(r.req.portal, false, "no new login is created");
  // One record, original credentials untouched by the typed password.
  const rows = (await env.DB.prepare("SELECT id, pass_hash FROM clients WHERE lower(email)='dupe@example.com'").all()).results;
  assert.equal(rows.length, 1, "no duplicate account");
  assert.equal(rows[0].pass_hash, before.pass_hash, "existing password hash untouched");
});
