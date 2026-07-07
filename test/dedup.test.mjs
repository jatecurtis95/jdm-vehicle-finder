import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { phoneKey, createClient, createRequest } from "../src/admin.js";

const fd = (obj) => {
  const f = new FormData();
  // The public request form now requires model + year range + budget; default
  // them so these dedupe tests aren't tripped by the search-field guards (admin
  // intake ignores the extra fields).
  for (const [k, v] of Object.entries({ budget_aud: "35000", model_name: "SUPRA", year_min: "1990", year_max: "2005", ...obj })) f.set(k, v);
  return f;
};
const ADMIN = { role: "admin", id: 0 };

test("phoneKey normalizes AU formats to the same national number", () => {
  assert.equal(phoneKey("+61 412 345 678"), "412345678");
  assert.equal(phoneKey("0412345678"), "412345678");
  assert.equal(phoneKey("61412345678"), "412345678");
  assert.equal(phoneKey("(04) 1234 5678"), "412345678");
  assert.equal(phoneKey("0061 412 345 678"), "412345678"); // intl 00 prefix
  // A different country code is not stripped, so it stays distinct.
  assert.notEqual(phoneKey("+44 412345678"), phoneKey("+61 412345678"));
  assert.equal(phoneKey(""), "");
});

test("admin intake creates a fresh client when nothing matches", async () => {
  const env = makeEnv();
  const r = await createClient(env, fd({ name: "Alice", email: "alice@example.com" }), ADMIN);
  assert.equal(r.ok, true);
  assert.ok(r.id > 0);
});

test("admin intake folds a same-email enquiry into the existing client", async () => {
  const env = makeEnv();
  const a = await createClient(env, fd({ name: "Alice", email: "Alice@Example.com" }), ADMIN);
  const b = await createClient(env, fd({ name: "Alice Again", email: "alice@example.com", whatsapp: "0400111222" }), ADMIN);
  assert.equal(b.ok, false);
  assert.equal(b.error, "duplicate");
  assert.equal(b.id, a.id);
  // Only one client row exists, and the new phone was backfilled.
  const n = (await env.DB.prepare("SELECT COUNT(*) AS n FROM clients").first()).n;
  assert.equal(n, 1);
  const row = await env.DB.prepare("SELECT whatsapp FROM clients WHERE id=?").bind(a.id).first();
  assert.equal(phoneKey(row.whatsapp), "400111222");
});

test("admin intake matches by phone even when the format differs", async () => {
  const env = makeEnv();
  const a = await createClient(env, fd({ name: "Bob", whatsapp: "0412 345 678" }), ADMIN);
  const b = await createClient(env, fd({ name: "Bob B", whatsapp: "+61412345678" }), ADMIN);
  assert.equal(b.error, "duplicate");
  assert.equal(b.id, a.id);
});

test("allow_dupe lets staff deliberately create a separate record", async () => {
  const env = makeEnv();
  await createClient(env, fd({ name: "Fam", email: "fam@example.com" }), ADMIN);
  const b = await createClient(env, fd({ name: "Fam Two", email: "fam@example.com", allow_dupe: "1" }), ADMIN);
  assert.equal(b.ok, true);
  const n = (await env.DB.prepare("SELECT COUNT(*) AS n FROM clients").first()).n;
  assert.equal(n, 2);
});

test("an agent's duplicate check is scoped to their own clients, not public ones", async () => {
  const env = makeEnv();
  // A public client with this email exists.
  await createClient(env, fd({ name: "Public Carl", email: "carl@example.com" }), ADMIN);
  // An agent adding the same email gets their OWN new client (different scope).
  const agent = { role: "agent", id: 7 };
  const r = await createClient(env, fd({ name: "Carl", email: "carl@example.com" }), agent);
  assert.equal(r.ok, true);
  const rows = (await env.DB.prepare("SELECT agent_id FROM clients WHERE lower(email)='carl@example.com' ORDER BY id").all()).results;
  assert.equal(rows.length, 2);
  assert.equal(rows[0].agent_id, null);
  assert.equal(rows[1].agent_id, 7);
});

test("a second account on a registered email never clobbers the real record (anti-clobber)", async () => {
  const env = makeEnv();
  // A real client signs up with an account.
  await createRequest(env, fd({ name: "Stephen Real", email: "s@example.com", marka_name: "TOYOTA", model_name: "AQUA", portal_password: "Stephen12345", whatsapp: "0400000082" }));
  const before = env.DB.prepare("SELECT pass_hash FROM clients WHERE lower(email)='s@example.com'").first();
  // A stranger who knows the email submits with a bogus name and password.
  // V1.2 Phase 3: the response is neutral (no account-existence leak); the
  // enquiry folds into the existing record, credentials and name untouched,
  // and a sign-in link is emailed to the real inbox owner.
  const hack = await createRequest(env, fd({ name: "HACKED", email: "s@example.com", marka_name: "TOYOTA", model_name: "SUPRA", portal_password: "Hacker123456", whatsapp: "0499999999" }));
  assert.equal(hack.ok, true);
  assert.equal(hack.signinNeeded, true);
  assert.equal(hack.req.portal, false, "the stranger gets no login");
  const row = await env.DB.prepare("SELECT name, pass_hash FROM clients WHERE lower(email)='s@example.com'").first();
  assert.equal(row.name, "Stephen Real", "the real name is never overwritten");
  assert.equal(row.pass_hash, before.pass_hash, "the real password is never overwritten");
});

test("public request fills in a name on an existing passwordless record", async () => {
  const env = makeEnv();
  // Staff-entered, passwordless, placeholder name.
  await createClient(env, fd({ name: "Website enquiry", email: "p@example.com" }), { role: "admin", id: 0 });
  // The same person submits the public form with their real name (no password
  // needed: the record already exists, so they're not opening a new account).
  const r = await createRequest(env, fd({ name: "Real Name", email: "p@example.com", marka_name: "TOYOTA", model_name: "AQUA", whatsapp: "0400000097" }));
  assert.equal(r.ok, true);
  assert.equal(r.req.existing, true);
  const rows = (await env.DB.prepare("SELECT name FROM clients WHERE lower(email)='p@example.com'").all()).results;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "Real Name");
});

test("a returning email folds into the one client, no duplicate", async () => {
  const env = makeEnv();
  // Staff-entered passwordless client so the public form can still add to it.
  await createClient(env, fd({ name: "Stephen", email: "st@example.com", whatsapp: "0451 671 516" }), { role: "admin", id: 0 });
  const r = await createRequest(env, fd({ name: "Stephen", email: "st@example.com", marka_name: "TOYOTA", model_name: "AQUA", year_min: "2013", year_max: "2015", whatsapp: "0451 671 516" }));
  assert.equal(r.ok, true);
  const n = (await env.DB.prepare("SELECT COUNT(*) AS n FROM clients").first()).n;
  assert.equal(n, 1, "same person reuses the one client");
});
