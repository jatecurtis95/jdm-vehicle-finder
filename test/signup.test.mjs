// Public-request portal self-signup must never set a password on an EXISTING
// client (that would let anyone who knows a passwordless client's email take
// over their portal). It may only create a login for a brand-new client.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { createClient, createRequest } from "../src/admin.js";

function fd(obj) {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
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
