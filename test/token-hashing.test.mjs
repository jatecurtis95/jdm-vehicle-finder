// Item 3: reset/invite tokens are stored hashed. The raw token is emailed once
// and never persisted; the DB holds only its SHA-256 hash, so a leaked snapshot
// can't be used to claim a pending invite or hijack a reset. Lookups hash the
// presented token and match on that (with a raw fallback for legacy/seeded rows).
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import {
  hashToken, agentByInviteToken, clientByInviteToken, dealerByInviteToken,
  beginPasswordResetFor, setClientPassword, setAgentPassword,
} from "../src/auth.js";
import { createAgent, createDealer, inviteClientPortal } from "../src/admin.js";

const ADMIN = { role: "admin", id: 0 };
const fd = (obj) => { const f = new FormData(); for (const [k, v] of Object.entries(obj)) f.set(k, String(v)); return f; };

test("hashToken is a stable, non-reversible digest, empty in, empty out", async () => {
  const a = await hashToken("abc");
  const b = await hashToken("abc");
  assert.equal(a, b, "deterministic");
  assert.notEqual(a, "abc", "not the raw token");
  assert.notEqual(a, await hashToken("abd"), "distinct inputs differ");
  assert.equal(await hashToken(""), "");
});

test("createAgent stores only the hash, and the raw token still resolves", async () => {
  const env = makeEnv();
  const r = await createAgent(env, fd({ name: "Ben", email: "ben@x.com" }));
  assert.equal(r.ok, true);
  const stored = env.db.prepare("SELECT invite_token FROM users WHERE email = 'ben@x.com'").get().invite_token;
  assert.notEqual(stored, r.token, "raw token is not in the DB");
  assert.equal(stored, await hashToken(r.token), "the hash of the raw token is stored");
  const found = await agentByInviteToken(env, r.token);
  assert.ok(found && found.email === "ben@x.com", "raw token resolves via the hash lookup");
  assert.equal(await agentByInviteToken(env, "wrong-token"), null);
});

test("createDealer stores the hash and resolves the raw token", async () => {
  const env = makeEnv();
  const r = await createDealer(env, fd({ name: "D", email: "d@x.com" }));
  assert.equal(r.ok, true);
  const stored = env.db.prepare("SELECT invite_token FROM suppliers WHERE email='d@x.com'").get().invite_token;
  assert.equal(stored, await hashToken(r.token));
  assert.ok(await dealerByInviteToken(env, r.token));
});

test("inviteClientPortal stores the hash and resolves the raw token", async () => {
  const env = makeEnv(`INSERT INTO users (id,name,email) VALUES (1,'C','c@x.com');`);
  const r = await inviteClientPortal(env, 1, ADMIN);
  assert.equal(r.ok, true);
  const stored = env.db.prepare("SELECT invite_token FROM users WHERE id=1").get().invite_token;
  assert.equal(stored, await hashToken(r.token));
  assert.ok(await clientByInviteToken(env, r.token));
});

test("a password reset stores the hash; the raw token sets the password once", async () => {
  const env = makeEnv(`INSERT INTO users (id,name,email,portal_enabled,portal_revoked,pass_hash,pass_salt) VALUES (1,'C','c@x.com',1,0,'h','s');`);
  const r = await beginPasswordResetFor(env, "client", 1);
  assert.ok(r && r.token);
  const stored = env.db.prepare("SELECT invite_token FROM users WHERE id=1").get().invite_token;
  assert.equal(stored, await hashToken(r.token), "only the hash is persisted");
  const set = await setClientPassword(env, r.token, "Newpass1234");
  assert.equal(set.ok, true, "raw token from the email works");
  assert.equal(env.db.prepare("SELECT invite_token FROM users WHERE id=1").get().invite_token, null, "single-use: cleared");
  const again = await setClientPassword(env, r.token, "Another1234");
  assert.equal(again.ok, false, "token can't be reused");
});

test("a legacy plaintext token still works during rollout (raw fallback)", async () => {
  // A row seeded/issued before hashing shipped keeps its plaintext token.
  const env = makeEnv(`INSERT INTO users (id,name,email,pass_salt,pass_hash,invite_token,invite_exp, type) VALUES (1,'A','a@x',' ',' ','legacy-plain',${Date.now() + 3600000}, 'agent');`);
  const found = await agentByInviteToken(env, "legacy-plain");
  assert.ok(found && found.id === 1, "plaintext lookup still resolves");
  const set = await setAgentPassword(env, "legacy-plain", "Legacypw1234");
  assert.equal(set.ok, true);
});
