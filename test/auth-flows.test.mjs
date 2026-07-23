// Finder V1.2 Phase 0 regression tests: the full credential lifecycle.
//
// 0.1  Signup via the public wizard path must round-trip: the SAME email and
//      password used at signup must authenticate() afterwards, for every role
//      that self-serves or is invited.
// 0.2  Set-password (invite) tokens must work end to end for agents, clients
//      and dealers, and one broken role branch must never break the others.
// 0.3  Password reset reuses the invite machinery with a 1 hour expiry and
//      must never reveal whether an email exists.
// 0.4  Length limits enforced server side (email 254, password 32).
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv, readFile } from "./helpers/d1.mjs";
import { createRequest } from "../src/admin.js";
import {
  authenticate, hashPassword,
  setAgentPassword, setClientPassword, setDealerPassword,
  beginPasswordReset, beginPasswordResetFor, RESET_TTL_MS,
  PW_MAX, EMAIL_MAX,
} from "../src/auth.js";

function fd(obj) {
  const f = new FormData();
  for (const [k, v] of Object.entries({
    budget_aud: "35000", model_name: "SUPRA", year_min: "1990", year_max: "2005",
    whatsapp: "0412345678", ...obj,
  })) f.set(k, v);
  return f;
}

const FUTURE = () => Date.now() + 60 * 60 * 1000;

async function seedAgent(env, email, password) {
  const { salt, hash } = await hashPassword(password);
  env.db.prepare("INSERT INTO agents (email, name, pass_salt, pass_hash, active) VALUES (?, 'Agent', ?, ?, 1)").run(email, salt, hash);
  return env.db.prepare("SELECT id FROM agents WHERE email = ?").get(email).id;
}
async function seedDealer(env, email, password) {
  const { salt, hash } = await hashPassword(password);
  env.db.prepare("INSERT INTO suppliers (email, name, pass_salt, pass_hash, active) VALUES (?, 'Dealer', ?, ?, 1)").run(email, salt, hash);
  return env.db.prepare("SELECT id FROM suppliers WHERE email = ?").get(email).id;
}

// --- 0.1: signup then login round-trips --------------------------------------

test("0.1 regression: public wizard signup, then authenticate with the same credentials", async () => {
  const env = makeEnv();
  const r = await createRequest(env, fd({
    name: "Ben Test", email: "bengc2000@gmail.com", marka_name: "TOYOTA",
    portal_password: "Goodpass123",
  }));
  assert.equal(r.ok, true, "signup stores the request");
  assert.equal(r.req.portal, true, "signup creates the login");

  const who = await authenticate(env, "bengc2000@gmail.com", "Goodpass123");
  assert.ok(who, "the same credentials must sign in");
  assert.equal(who.role, "client");

  // Case-insensitive on email, and the wrong password is still refused.
  assert.ok(await authenticate(env, "BenGC2000@Gmail.com", "Goodpass123"));
  assert.equal(await authenticate(env, "bengc2000@gmail.com", "Wrongpass123"), null);
});

test("0.1: a failed validation must surface as an error, never a silent fake success", async () => {
  const env = makeEnv();
  // Budget below the floor: rejected with a tagged error the route re-renders.
  const r = await createRequest(env, fd({
    name: "Low Budget", email: "low@example.com", marka_name: "TOYOTA",
    budget_aud: "500", portal_password: "Goodpass123",
  }));
  assert.equal(r.ok, false);
  assert.equal(r.error, "budget");
  assert.equal(env.db.prepare("SELECT COUNT(*) AS n FROM users").get().n, 0, "nothing stored");
});

test("0.1 route contract: /request re-renders EVERY validation error (no fall-through to success)", () => {
  const src = readFile("src/index.js");
  // The route must branch on any non-spam error, not an allow-list of a few.
  assert.match(src, /result\.error && result\.error !== "spam"/,
    "the /request POST must re-render for every validation error except the honeypot");
});

// --- 0.2: set-password works per role, and broken branches stay isolated ------

test("0.2: agent invite token sets a password and the agent can sign in", async () => {
  const env = makeEnv();
  env.db.prepare("INSERT INTO agents (email, name, pass_salt, pass_hash, invite_token, invite_exp) VALUES ('ag@example.com','Ag','','','tok-agent',?)").run(FUTURE());
  const r = await setAgentPassword(env, "tok-agent", "Agentpass123");
  assert.equal(r.ok, true);
  const who = await authenticate(env, "ag@example.com", "Agentpass123");
  assert.deepEqual(who && who.role, "agent");
});

test("0.2: client invite token sets a password and the client can sign in", async () => {
  const env = makeEnv();
  env.db.prepare("INSERT INTO users (name, email, portal_enabled, invite_token, invite_exp) VALUES ('Cl','cl@example.com',1,'tok-client',?)").run(FUTURE());
  const r = await setClientPassword(env, "tok-client", "Clientpass123");
  assert.equal(r.ok, true);
  const who = await authenticate(env, "cl@example.com", "Clientpass123");
  assert.deepEqual(who && who.role, "client");
});

test("0.2: dealer invite token sets a password and the dealer can sign in", async () => {
  const env = makeEnv();
  env.db.prepare("INSERT INTO suppliers (email, name, pass_salt, pass_hash, invite_token, invite_exp) VALUES ('dl@example.com','Dl','','','tok-dealer',?)").run(FUTURE());
  const r = await setDealerPassword(env, "tok-dealer", "Dealerpass123");
  assert.equal(r.ok, true);
  const who = await authenticate(env, "dl@example.com", "Dealerpass123");
  assert.deepEqual(who && who.role, "dealer");
});

test("0.2: expired and unknown invite tokens are refused with a friendly error", async () => {
  const env = makeEnv();
  env.db.prepare("INSERT INTO users (name, email, portal_enabled, invite_token, invite_exp) VALUES ('Old','old@example.com',1,'tok-old',?)").run(Date.now() - 1000);
  const expired = await setClientPassword(env, "tok-old", "Clientpass123");
  assert.equal(expired.ok, false);
  const unknown = await setClientPassword(env, "no-such-token", "Clientpass123");
  assert.equal(unknown.ok, false);
});

test("0.2: a broken role table breaks only that role's login, not everyone's", async () => {
  const env = makeEnv();
  env.db.prepare("INSERT INTO users (name, email, portal_enabled, invite_token, invite_exp) VALUES ('Cl','iso@example.com',1,'tok-iso',?)").run(FUTURE());
  await setClientPassword(env, "tok-iso", "Clientpass123");
  // Simulate the production incident: the dealers table is missing (a deploy
  // that outran its migration). Client login must still work.
  env.db.exec("DROP TABLE suppliers");
  const who = await authenticate(env, "iso@example.com", "Clientpass123");
  assert.deepEqual(who && who.role, "client", "client login survives a broken dealers branch");
});

// --- 0.3: password reset ------------------------------------------------------

test("0.3: reset for a portal client issues a 1 hour token that round-trips", async () => {
  const env = makeEnv();
  env.db.prepare("INSERT INTO users (name, email, portal_enabled, invite_token, invite_exp) VALUES ('Cl','reset@example.com',1,'tok-r1',?)").run(FUTURE());
  await setClientPassword(env, "tok-r1", "Original123");

  const before = Date.now();
  const r = await beginPasswordReset(env, "Reset@Example.com "); // case+space tolerated
  assert.ok(r && r.token, "an eligible account gets a token");
  assert.equal(r.kind, "client");
  const row = env.db.prepare("SELECT invite_exp FROM users WHERE email = 'reset@example.com'").get();
  assert.ok(row.invite_exp <= before + RESET_TTL_MS + 5000, "reset expiry is about 1 hour, not 7 days");

  const set = await setClientPassword(env, r.token, "Newpass1234");
  assert.equal(set.ok, true);
  assert.equal(await authenticate(env, "reset@example.com", "Original123"), null, "old password stops working");
  assert.ok(await authenticate(env, "reset@example.com", "Newpass1234"), "new password signs in");
  // Single use: the token is cleared on success.
  const again = await setClientPassword(env, r.token, "Another1234");
  assert.equal(again.ok, false);
});

test("0.3: reset works for agents and dealers too", async () => {
  const env = makeEnv();
  await seedAgent(env, "ra@example.com", "Agentpass123");
  await seedDealer(env, "rd@example.com", "Dealerpass123");
  const ra = await beginPasswordReset(env, "ra@example.com");
  assert.equal(ra && ra.kind, "agent");
  const rd = await beginPasswordReset(env, "rd@example.com");
  assert.equal(rd && rd.kind, "dealer");
  const setA = await setAgentPassword(env, ra.token, "Agentpass456");
  assert.equal(setA.ok, true);
  assert.ok(await authenticate(env, "ra@example.com", "Agentpass456"));
});

test("0.3: reset is refused (null) for unknown, revoked, deactivated and passwordless accounts", async () => {
  const env = makeEnv();
  assert.equal(await beginPasswordReset(env, "nobody@example.com"), null);

  // Passwordless client (portal enabled, never set a password): not eligible -
  // a reset must not become a back door around the invite flow.
  env.db.prepare("INSERT INTO users (name, email, portal_enabled) VALUES ('NoPw','nopw@example.com',1)").run();
  assert.equal(await beginPasswordReset(env, "nopw@example.com"), null);

  // Revoked client: staff said no; reset must respect that.
  env.db.prepare("INSERT INTO users (name, email, portal_enabled, portal_revoked, pass_salt, pass_hash) VALUES ('Rev','rev@example.com',0,1,'s','h')").run();
  assert.equal(await beginPasswordReset(env, "rev@example.com"), null);

  // Deactivated agent.
  const aid = await seedAgent(env, "off@example.com", "Agentpass123");
  env.db.prepare("UPDATE agents SET active = 0 WHERE id = ?").run(aid);
  assert.equal(await beginPasswordReset(env, "off@example.com"), null);

  // Admin-side variant refuses the same ineligible rows.
  assert.equal(await beginPasswordResetFor(env, "agent", aid), null);
  assert.equal(await beginPasswordResetFor(env, "client", 999999), null);
  assert.equal(await beginPasswordResetFor(env, "nonsense", 1), null);
});

// --- 0.4: server-side length limits -------------------------------------------

test("0.4: oversized email or password is rejected before any hashing work", async () => {
  const env = makeEnv();
  env.db.prepare("INSERT INTO users (name, email, portal_enabled, invite_token, invite_exp) VALUES ('Cl','cap@example.com',1,'tok-cap',?)").run(FUTURE());
  await setClientPassword(env, "tok-cap", "Clientpass123");

  const longEmail = "a".repeat(EMAIL_MAX) + "@example.com"; // over 254
  assert.equal(await authenticate(env, longEmail, "Clientpass123"), null);
  const longPw = "Aa1" + "x".repeat(PW_MAX); // over 32
  assert.equal(await authenticate(env, "cap@example.com", longPw), null);
  // The normal login still works (the caps must not break real users).
  assert.ok(await authenticate(env, "cap@example.com", "Clientpass123"));
});

test("0.4: the admin password is exempt from the user-password cap (compared, not hashed)", async () => {
  const env = makeEnv();
  env.ADMIN_PASSWORD = "an-admin-password-longer-than-32-characters-okay";
  const who = await authenticate(env, "", env.ADMIN_PASSWORD);
  assert.deepEqual(who, { role: "admin", id: 0 });
});
