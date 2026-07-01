// Google social login: the state/nonce CSRF token, the config gate, the
// find-or-create-client upsert, a mocked end-to-end callback, and the rendered
// "Continue with Google" / signed-in surfaces. No network: fetch is stubbed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { makeOauthState, readOauthState } from "../src/auth.js";
import { googleConfigured, beginGoogle, completeGoogle, clearNonceCookie } from "../src/oauth.js";
import { upsertGoogleClient, loginPage, requestPage, createRequest } from "../src/admin.js";

const ENV = { ADMIN_TOKEN: "unit-test-signing-key" };
const withGoogle = (env) => Object.assign(env, { GOOGLE_CLIENT_ID: "cid.apps.googleusercontent.com", GOOGLE_CLIENT_SECRET: "secret" });
const nonceFromCookie = (c) => c.split(";")[0].split("=")[1];

// ---- config gate ----------------------------------------------------------
test("googleConfigured needs BOTH id and secret", () => {
  assert.equal(googleConfigured({}), false);
  assert.equal(googleConfigured({ GOOGLE_CLIENT_ID: "x" }), false);
  assert.equal(googleConfigured({ GOOGLE_CLIENT_SECRET: "y" }), false);
  assert.equal(googleConfigured({ GOOGLE_CLIENT_ID: "x", GOOGLE_CLIENT_SECRET: "y" }), true);
});

// ---- state token (CSRF) ---------------------------------------------------
test("oauth state round-trips intent + nonce, and rejects tampering", async () => {
  const token = await makeOauthState(ENV, "login", "nonce-abc");
  const parsed = await readOauthState(ENV, token);
  assert.deepEqual(parsed, { intent: "login", nonce: "nonce-abc" });

  assert.equal(await readOauthState(ENV, token + "x"), null, "tampered signature rejected");
  assert.equal(await readOauthState(ENV, "garbage"), null, "malformed token rejected");
  assert.equal(await readOauthState({ ADMIN_TOKEN: "different" }, token), null, "wrong key rejected");
});

test("oauth state normalises an unknown intent to signup", async () => {
  const parsed = await readOauthState(ENV, await makeOauthState(ENV, "hax", "n1"));
  assert.equal(parsed.intent, "signup");
});

// ---- begin: authorize URL + nonce cookie ----------------------------------
test("beginGoogle builds the authorize URL and a browser-bound nonce cookie", async () => {
  const { authUrl, cookie } = await beginGoogle(withGoogle({ ...ENV }), "https://jdmfinder.com.au", "signup");
  const u = new URL(authUrl);
  assert.equal(u.origin + u.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(u.searchParams.get("client_id"), "cid.apps.googleusercontent.com");
  assert.equal(u.searchParams.get("redirect_uri"), "https://jdmfinder.com.au/auth/google/callback");
  assert.equal(u.searchParams.get("response_type"), "code");
  assert.match(u.searchParams.get("scope"), /openid.*email.*profile/);
  // The state carries the same nonce that is set in the cookie.
  const nonce = nonceFromCookie(cookie);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.equal((await readOauthState(ENV, u.searchParams.get("state"))).nonce, nonce);
});

// ---- callback ------------------------------------------------------------
test("completeGoogle rejects a nonce that doesn't match the cookie", async () => {
  const env = withGoogle({ ...ENV });
  const state = await makeOauthState(env, "login", "real-nonce");
  const url = new URL("https://jdmfinder.com.au/auth/google/callback?code=abc&state=" + encodeURIComponent(state));
  const request = new Request(url, { headers: { Cookie: "foauth=WRONG" } });
  const res = await completeGoogle(env, request, url);
  assert.equal(res.ok, false);
  assert.equal(res.error, "nonce");
  assert.equal(res.intent, "login", "intent echoed so the caller can bounce correctly");
});

test("completeGoogle: happy path exchanges the code and returns a verified profile", async () => {
  const env = withGoogle({ ...ENV });
  const nonce = "n-happy";
  const state = await makeOauthState(env, "signup", nonce);
  const url = new URL("https://jdmfinder.com.au/auth/google/callback?code=THECODE&state=" + encodeURIComponent(state));
  const request = new Request(url, { headers: { Cookie: "foauth=" + nonce } });

  const orig = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (u, opts) => {
    calls.push(String(u));
    if (String(u).includes("oauth2.googleapis.com/token")) {
      assert.match(opts.body.toString(), /code=THECODE/);
      assert.match(opts.body.toString(), /client_secret=secret/);
      return new Response(JSON.stringify({ access_token: "AT", token_type: "Bearer" }), { status: 200 });
    }
    return new Response(JSON.stringify({ sub: "google-123", email: "Buyer@Gmail.com", email_verified: true, name: "Jane Buyer" }), { status: 200 });
  };
  try {
    const res = await completeGoogle(env, request, url);
    assert.equal(res.ok, true);
    assert.equal(res.intent, "signup");
    assert.equal(res.profile.email, "buyer@gmail.com", "email lower-cased");
    assert.equal(res.profile.sub, "google-123");
    assert.equal(res.profile.name, "Jane Buyer");
    assert.equal(calls.length, 2, "token exchange then userinfo");
  } finally {
    globalThis.fetch = orig;
  }
});

test("completeGoogle refuses an unverified Google email", async () => {
  const env = withGoogle({ ...ENV });
  const nonce = "n-unv";
  const state = await makeOauthState(env, "signup", nonce);
  const url = new URL("https://jdmfinder.com.au/auth/google/callback?code=C&state=" + encodeURIComponent(state));
  const request = new Request(url, { headers: { Cookie: "foauth=" + nonce } });
  const orig = globalThis.fetch;
  globalThis.fetch = async (u) =>
    String(u).includes("/token")
      ? new Response(JSON.stringify({ access_token: "AT" }), { status: 200 })
      : new Response(JSON.stringify({ sub: "s", email: "x@y.com", email_verified: false }), { status: 200 });
  try {
    const res = await completeGoogle(env, request, url);
    assert.equal(res.ok, false);
    assert.equal(res.error, "unverified");
  } finally {
    globalThis.fetch = orig;
  }
});

test("clearNonceCookie expires the cookie", () => {
  assert.match(clearNonceCookie(), /foauth=;/);
  assert.match(clearNonceCookie(), /Max-Age=0/);
});

// ---- upsertGoogleClient ---------------------------------------------------
test("upsertGoogleClient creates, dedupes by sub, and links an existing email account", async () => {
  const env = makeEnv();
  const db = env.db;

  // New Google user -> creates a portal-enabled client with the sub stored.
  const a = await upsertGoogleClient(env, { sub: "sub-1", email: "New@Gmail.com", name: "New Person" });
  assert.equal(a.created, true);
  const row = db.prepare("SELECT name,email,portal_enabled,google_sub FROM clients WHERE id=?").get(a.id);
  assert.equal(row.email, "new@gmail.com");
  assert.equal(row.portal_enabled, 1);
  assert.equal(row.google_sub, "sub-1");
  assert.equal(row.name, "New Person");

  // Same sub again -> same record, not a duplicate.
  const b = await upsertGoogleClient(env, { sub: "sub-1", email: "new@gmail.com", name: "New Person" });
  assert.equal(b.created, false);
  assert.equal(b.id, a.id);

  // An existing email/password client (no sub) gets linked + portal-enabled,
  // and their real name is preserved (not overwritten by Google's).
  db.exec("INSERT INTO clients (id,name,email,portal_enabled,pass_hash) VALUES (77,'Real Name','legacy@x.com',0,'HASH');");
  const c = await upsertGoogleClient(env, { sub: "sub-9", email: "Legacy@x.com", name: "Google Name" });
  assert.equal(c.created, false);
  assert.equal(c.id, 77);
  const linked = db.prepare("SELECT name,portal_enabled,google_sub FROM clients WHERE id=77").get();
  assert.equal(linked.google_sub, "sub-9");
  assert.equal(linked.portal_enabled, 1);
  assert.equal(linked.name, "Real Name", "existing real name kept");

  // Never touches agent-owned records.
  db.exec("INSERT INTO clients (id,name,email,agent_id) VALUES (88,'Agent Client','owned@x.com',5);");
  const d = await upsertGoogleClient(env, { sub: "sub-owned", email: "owned@x.com", name: "Hijack" });
  assert.equal(d.created, true, "a fresh public client is made, the agent-owned one is untouched");
  assert.notEqual(d.id, 88);
  assert.equal(db.prepare("SELECT google_sub FROM clients WHERE id=88").get().google_sub, null);
});

// ---- rendered surfaces ----------------------------------------------------
test("loginPage shows the Google button only when enabled", () => {
  const on = loginPage({ googleEnabled: true });
  assert.match(on, /Continue with Google/);
  assert.match(on, /\/auth\/google\?intent=login/);
  const off = loginPage({});
  assert.doesNotMatch(off, /Continue with Google/);
});

test("request form shows the Google signup button when configured", async () => {
  const env = withGoogle(makeEnv());
  const html = await requestPage(env, {});
  assert.match(html, /Continue with Google/);
  assert.match(html, /\/auth\/google\?intent=signup/);
  assert.match(html, /name="portal_password"/, "anonymous visitors still get the password field");
  assert.match(html, /id="rq-whatsapp"[^>]*required/, "the mobile number field is mandatory");
});

test("createRequest attaches to the signed-in client, no password or form email", async () => {
  const env = makeEnv();
  const db = env.db;
  const c = await upsertGoogleClient(env, { sub: "s-req", email: "g@x.com", name: "G Buyer" });
  const form = new FormData();
  form.set("marka_name", "TOYOTA");
  form.set("model_name", "SUPRA");
  form.set("year_min", "1993");
  form.set("year_max", "1998");
  form.set("budget_aud", "80000");
  form.set("whatsapp", "+61412345678"); // phone is now mandatory; a Google client has none on file
  form.set("email", "attacker@evil.com"); // must be ignored in favour of the session identity

  const result = await createRequest(env, form, { role: "client", id: c.id });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.req.email, "g@x.com", "identity comes from the session, not the form");
  assert.equal(result.req.name, "G Buyer", "Lead-eligible: name present");
  assert.equal(result.inviteNeeded, false, "signed-in Google client is never nagged for a password");
  const w = db.prepare("SELECT client_id, marka_name FROM wishlists WHERE client_id=?").get(c.id);
  assert.equal(w.marka_name, "TOYOTA", "wishlist attached to the signed-in client");
  assert.equal(db.prepare("SELECT whatsapp FROM clients WHERE id=?").get(c.id).whatsapp, "+61412345678", "the supplied phone is saved to the client");
});

test("request form collapses the account step for a signed-in buyer", async () => {
  const env = makeEnv();
  const html = await requestPage(env, { signedIn: { name: "Jane", email: "jane@x.com" } });
  assert.match(html, /Signed in as/);
  assert.match(html, /jane@x.com/);
  assert.doesNotMatch(html, /name="portal_password"/, "no password field when signed in");
  assert.match(html, /var SIGNEDIN=true/, "wizard skips step-4 validation");
});
