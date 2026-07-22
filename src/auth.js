// Stateless signed-cookie sessions with four roles: "admin" (JDM Connect, sees
// everything), "agent" (sees only their own clients/wishlists/matches), "client"
// (buyer portal), and "dealer" (vehicle submissions & review).
//
// The cookie carries `role:id:expiry:session-version`, signed with HMAC-SHA256 keyed by
// ADMIN_TOKEN - no server-side session store. Admin logs in with ADMIN_PASSWORD
// (required; ADMIN_TOKEN is signing-key only and is never a valid password);
// agents log in with their email + password (PBKDF2-hashed in the agents
// table). Login is via the form only - no ?key= URL fallback.

const COOKIE = "fsess";
const SESSION_SECONDS = 60 * 60 * 24 * 30; // 30 days
// HARD PLATFORM CAP: deployed Cloudflare Workers reject PBKDF2 above 100,000
// iterations ("Pbkdf2 failed: iteration counts above 100000 are not
// supported"). Local workerd does NOT enforce this, so a higher count passes
// `wrangler dev` and then breaks every set-password/signup/reset in
// production (audit Low #18's 210k bump did exactly that on 2026-07-02, fixed
// on main in PR #55). Do not raise this until Cloudflare lifts the cap. New
// hashes embed their iteration count as an "<iter>." prefix on the stored
// hash; bare legacy hashes (no prefix) verify at the same 100k count.
const PBKDF2_ITER = 100000;
const PBKDF2_ITER_LEGACY = 100000;
const enc = new TextEncoder();

function toBase64(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function fromBase64(str) {
  const bin = atob(str);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
function toBase64Url(bytes) {
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sign(env, msg) {
  // ADMIN_TOKEN is the single HMAC key behind every signed artifact: session
  // cookies, OAuth state, and public share links. If it were unset, signing
  // would collapse to a known empty key and all of them would become forgeable.
  // Fail closed instead - in production the secret is always present, so this
  // only ever trips a misconfigured deploy (signing-free public paths, e.g. the
  // canonical redirect and static assets, never reach here and keep working).
  if (!env.ADMIN_TOKEN) throw new Error("ADMIN_TOKEN is not configured");
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(env.ADMIN_TOKEN), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return toBase64Url(new Uint8Array(sig));
}

// Constant-time comparison. Exported so the OAuth layer can compare its
// browser-bound nonce without leaking length/prefix timing.
export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// --- OAuth state (CSRF) ------------------------------------------------------
// A short-lived signed token that ties a social-login round-trip to us. It
// carries the intent (signup|login) and a random nonce; the same nonce is also
// set as a browser cookie, so the callback can prove the response belongs to the
// browser that started the flow (defeats login-CSRF and replay). Signed with the
// same ADMIN_TOKEN HMAC as sessions, namespaced so it can't be swapped for one.
const OAUTH_STATE_SECONDS = 10 * 60; // 10 minutes to complete the round-trip
const OAUTH_INTENTS = ["signup", "login"];
export async function makeOauthState(env, intent, nonce) {
  const i = OAUTH_INTENTS.includes(intent) ? intent : "signup";
  // The payload is colon-delimited, so the nonce must be base64url (no colon)
  // for readOauthState's split to be unambiguous. randomToken() already is; this
  // asserts the invariant so a future caller can't quietly break it.
  if (!/^[A-Za-z0-9_-]+$/.test(String(nonce || ""))) throw new Error("invalid oauth nonce");
  const exp = Date.now() + OAUTH_STATE_SECONDS * 1000;
  const payload = `${i}:${nonce}:${exp}`;
  return `${payload}.${await sign(env, "oauth:" + payload)}`;
}
export async function readOauthState(env, token) {
  const val = String(token || "");
  const dot = val.lastIndexOf(".");
  if (dot < 1) return null;
  const payload = val.slice(0, dot);
  const sig = val.slice(dot + 1);
  if (!safeEqual(sig, await sign(env, "oauth:" + payload))) return null;
  const parts = payload.split(":");
  if (parts.length !== 3) return null;
  const [intent, nonce, expStr] = parts;
  if (!OAUTH_INTENTS.includes(intent) || !nonce || !/^\d+$/.test(expStr) || Number(expStr) < Date.now()) return null;
  return { intent, nonce };
}

// --- Public share tokens -----------------------------------------------------
// A stateless, signed token for the read-only public lot view ("Share" button).
// Distinct from the queue row's `token` (which drives approve/skip), so a shared
// link can only VIEW a car - it can never trigger an action. The signed expiry
// prevents old emails and copied URLs remaining valid forever. No DB column needed.
export const SHARE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export async function makeShareToken(env, queueId, now = Date.now()) {
  const id = Number(queueId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const issuedAt = Number(now);
  if (!Number.isFinite(issuedAt)) return null;
  const exp = issuedAt + SHARE_TTL_MS;
  const payload = `${id}:${exp}`;
  return `${payload}.${await sign(env, `share:${payload}`)}`;
}
export async function readShareToken(env, token, now = Date.now()) {
  const checkedAt = Number(now);
  if (!Number.isFinite(checkedAt)) return null;
  const value = String(token || "");
  const dot = value.lastIndexOf(".");
  if (dot < 1) return null;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const parts = payload.split(":");
  if (parts.length !== 2) return null;
  const [idStr, expStr] = parts;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0 || !/^\d+$/.test(expStr) || Number(expStr) < checkedAt || !sig) return null;
  return safeEqual(sig, await sign(env, `share:${payload}`)) ? id : null;
}

// --- Password hashing (PBKDF2-SHA256) ---------------------------------------
async function deriveHash(password, saltBytes, iterations) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations, hash: "SHA-256" }, key, 256
  );
  return new Uint8Array(bits);
}
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveHash(password, salt, PBKDF2_ITER);
  return { salt: toBase64(salt), hash: `${PBKDF2_ITER}.${toBase64(hash)}` };
}
export async function verifyPassword(password, saltB64, hashB64) {
  if (!password || !saltB64 || !hashB64) return false;
  try {
    // "<iter>.<hash>" = self-describing; bare base64 (no ".") = legacy 100k.
    // Bounds reject nonsense counts without ever deriving at them.
    const stored = String(hashB64);
    const dot = stored.indexOf(".");
    const iter = dot > 0 ? parseInt(stored.slice(0, dot), 10) : PBKDF2_ITER_LEGACY;
    if (!Number.isInteger(iter) || iter < 50000 || iter > 10000000) return false;
    const hash = await deriveHash(password, fromBase64(saltB64), iter);
    return safeEqual(toBase64(hash), dot > 0 ? stored.slice(dot + 1) : stored);
  } catch (e) {
    return false;
  }
}

// --- Password policy ---------------------------------------------------------
// One canonical policy, enforced everywhere a NEW password is set (public
// self-signup, agent/client invite set-password). Length is the main lever; the
// charset limit keeps inputs to plain keyboard characters (the set the doc
// approved) and the max length bounds the hashing work. Existing logins are not
// affected - this only gates newly chosen passwords.
export const PW_MIN = 10;
export const PW_MAX = 32;
// RFC 5321 upper bound for a deliverable address; anything longer is junk and
// is rejected server-side before any DB or hashing work.
export const EMAIL_MAX = 254;
export const PW_SYMBOLS = "!@#$%^&*()-_=+?<>";
const PW_ALLOWED_RE = /^[A-Za-z0-9!@#$%^&*()\-_=+?<>]+$/;
// Returns a human-readable reason the password is rejected, or null if it passes.
export function passwordPolicyError(password) {
  const s = typeof password === "string" ? password : "";
  if (s.length < PW_MIN) return `Password must be at least ${PW_MIN} characters.`;
  if (s.length > PW_MAX) return `Password must be ${PW_MAX} characters or fewer.`;
  if (!PW_ALLOWED_RE.test(s)) return "Password can only use letters, numbers, and these symbols: " + PW_SYMBOLS.split("").join(" ");
  if (!/[A-Za-z]/.test(s) || !/[0-9]/.test(s)) return "Password must include at least one letter and one number.";
  return null;
}

// --- Admin password ----------------------------------------------------------
// ADMIN_PASSWORD is the ONLY accepted admin credential. ADMIN_TOKEN is strictly
// the HMAC signing key and must never be compared against user-supplied input -
// accepting it here would let a leaked/guessed token both log in as admin AND
// forge arbitrary session/share/OAuth tokens (the two roles need opposite
// secrecy properties). If ADMIN_PASSWORD is unset, admin login is disabled.
export function passwordValid(env, password) {
  if (typeof password !== "string" || password.length === 0) return false;
  return Boolean(env.ADMIN_PASSWORD) && safeEqual(password, env.ADMIN_PASSWORD);
}

// --- Sessions ----------------------------------------------------------------
// A per-user session version, stamped into the cookie and re-checked on every
// request. Bumping it (on deactivate / portal-revoke / password reset) makes
// that account's existing cookies stop validating, WITHOUT rotating ADMIN_TOKEN
// (which would sign every user out). Admin (id 0) has no DB row, so it stays 0.
// Account sessions fail closed if D1 cannot prove their current version. A
// transient database fault must not revive a revoked or deleted credential.
export async function currentSessionVer(env, role, id) {
  if (!id || (role !== "agent" && role !== "client" && role !== "dealer")) return 0;
  const table = role === "agent" ? "agents" : role === "client" ? "clients" : "dealers";
  const row = await env.DB.prepare(`SELECT session_ver FROM ${table} WHERE id = ?`).bind(Number(id)).first();
  if (!row) throw new Error("session account does not exist");
  return Number(row.session_ver) || 0;
}

// Bump an account's session version, immediately invalidating its live cookies.
export async function bumpSessionVer(env, role, id) {
  if (!id || (role !== "agent" && role !== "client" && role !== "dealer")) return;
  const table = role === "agent" ? "agents" : role === "client" ? "clients" : "dealers";
  try { await env.DB.prepare(`UPDATE ${table} SET session_ver = session_ver + 1 WHERE id = ?`).bind(Number(id)).run(); } catch (e) { /* best effort */ }
}

export async function sessionCookie(env, role, id) {
  const exp = Date.now() + SESSION_SECONDS * 1000;
  const ver = await currentSessionVer(env, role, id);
  const payload = `${role}:${id || 0}:${exp}:${ver}`;
  const value = `${payload}.${await sign(env, payload)}`;
  return `${COOKIE}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}`;
}
export function clearCookie() {
  return `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

function readCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > -1 && part.slice(0, i) === name) return part.slice(i + 1);
  }
  return null;
}

async function sessionFromCookie(request, env) {
  const raw = readCookie(request, COOKIE);
  if (!raw) return null;
  const val = decodeURIComponent(raw);
  const dot = val.lastIndexOf(".");
  if (dot < 1) return null;
  const payload = val.slice(0, dot);
  const sig = val.slice(dot + 1);
  if (!safeEqual(sig, await sign(env, payload))) return null;
  const parts = payload.split(":");
  if (parts.length !== 4) return null;
  // Only versioned cookies are accepted. Legacy 3-part cookies could not be
  // revoked per account and were retired before launch.
  const [role, idStr, expStr, verStr] = parts;
  if (!["admin", "agent", "client", "dealer"].includes(role) || !/^\d+$/.test(idStr) || !/^\d+$/.test(expStr) || !/^\d+$/.test(verStr) || Number(expStr) < Date.now()) return null;
  const id = Number(idStr) || 0;
  if (parts.length === 4 && (role === "agent" || role === "client" || role === "dealer")) {
    if (!/^\d+$/.test(verStr)) return null;
    try {
      const table = role === "agent" ? "agents" : role === "client" ? "clients" : "dealers";
      const row = await env.DB.prepare(`SELECT session_ver FROM ${table} WHERE id = ?`).bind(id).first();
      if (!row) return null;                                   // account deleted → invalid
      if ((Number(row.session_ver) || 0) !== Number(verStr)) return null; // revoked/bumped
    } catch (e) { return null; }
  }
  if (role === "admin" && (id !== 0 || Number(verStr) !== 0)) return null;
  return { role, id };
}

// Current session from the signed cookie. {role,id}|null. (The legacy
// ?key=ADMIN_TOKEN URL fallback was removed so the admin token can't leak via
// URLs, browser history, referrers or server logs.)
export async function getSession(request, url, env) {
  return sessionFromCookie(request, env);
}

// Verify login credentials. Admin password wins; then an active agent (email +
// password); then an active dealer (email + password); then a portal-enabled
// client (email + password). {role,id}|null.
export async function authenticate(env, email, password) {
  if (passwordValid(env, password)) return { role: "admin", id: 0 };
  const e = String(email || "").trim().toLowerCase();
  if (!e || !password) return null;
  // Server-side length caps (V1.2 item 0.4). Every stored user password fits
  // the policy (max PW_MAX), so anything longer can only be junk or an attack;
  // reject it before any DB read or PBKDF2 work. The admin comparison above is
  // exempt: it is a constant-time equality check, not a hash.
  if (e.length > EMAIL_MAX || String(password).length > PW_MAX) return null;

  // Each role lookup is isolated: a broken table/column in one branch (e.g. a
  // deploy that outruns its migration) must degrade that role only, never 500
  // every login on the site. That exact failure shipped once (dealers table).
  const tryRole = async (fn) => {
    try { return await fn(); } catch (err) {
      console.error("authenticate role lookup failed:", err.message);
      return null;
    }
  };

  const agent = await tryRole(() => env.DB.prepare(
    "SELECT id, pass_salt, pass_hash, active FROM agents WHERE email = ?"
  ).bind(e).first());
  if (agent && agent.active && agent.pass_hash && await verifyPassword(password, agent.pass_salt, agent.pass_hash)) {
    return { role: "agent", id: agent.id };
  }

  const dealer = await tryRole(() => env.DB.prepare(
    "SELECT id, pass_salt, pass_hash, active FROM dealers WHERE email = ?"
  ).bind(e).first());
  if (dealer && dealer.active && dealer.pass_hash && await verifyPassword(password, dealer.pass_salt, dealer.pass_hash)) {
    return { role: "dealer", id: dealer.id };
  }

  // Buyer portal: a client who has been given access and set a password. An
  // email can map to several client rows (e.g. a staff-created record plus a
  // later self-signup), and the password may live on any of them - an invite
  // link sets it on the specific row it was issued for. Verify against each
  // candidate (newest first) rather than only the newest, so a valid password
  // on an older duplicate still signs in.
  const clients = ((await tryRole(() => env.DB.prepare(
    "SELECT id, pass_salt, pass_hash FROM clients WHERE lower(email) = ? AND portal_enabled = 1 AND pass_hash IS NOT NULL AND pass_hash <> '' ORDER BY id DESC LIMIT 5"
  ).bind(e).all())) || {}).results || [];
  for (const client of clients) {
    if (await verifyPassword(password, client.pass_salt, client.pass_hash)) {
      return { role: "client", id: client.id };
    }
  }
  return null;
}

// --- Agent invites (agent sets their own password) ---------------------------
export function randomToken() {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(24)));
}

// Single-use invite / reset tokens are secrets that grant a password set. We
// store only their SHA-256 hash in the DB (invite_token column), so a leaked DB
// snapshot can't be used to claim a pending invite or hijack a reset - the raw
// token exists only in the one email we send. On lookup we hash the presented
// token and match on that. randomToken() output is 24 random bytes, so a raw
// token can never collide with a hash; the lookups below therefore also accept
// a raw match, which keeps any pre-hash plaintext rows (issued before this
// rolled out, or seeded in tests) working until they expire.
export async function hashToken(token) {
  const t = String(token || "");
  if (!t) return "";
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(t));
  return toBase64Url(new Uint8Array(digest));
}
// The pair (hashed, raw) to bind into a `invite_token IN (?, ?)` lookup.
async function tokenMatchPair(token) {
  const raw = String(token || "");
  return [await hashToken(raw), raw];
}

// Look up the agent for a valid, unexpired invite token.
export async function agentByInviteToken(env, token) {
  if (!token) return null;
  const a = await env.DB.prepare(
    "SELECT id, name, email, invite_exp FROM agents WHERE invite_token IN (?, ?)"
  ).bind(...(await tokenMatchPair(token))).first();
  if (!a || !a.invite_exp || Number(a.invite_exp) < Date.now()) return null;
  return a;
}

// Schema-drift tolerance: run the preferred statement; if it fails only
// because the session_ver column (migration 0010) has not reached this
// database yet, run the legacy statement instead so the user-facing action
// still completes. The session-version bump resumes once 0010 is applied.
export async function runWithSessionVerFallback(env, preferredSql, legacySql, binds, who) {
  try {
    await env.DB.prepare(preferredSql).bind(...binds).run();
  } catch (e) {
    if (!/session_ver/i.test(String(e && e.message))) throw e;
    console.error(`${who}: session_ver column missing (apply migration 0010); completing without the session bump`);
    await env.DB.prepare(legacySql).bind(...binds).run();
  }
}

// Set an agent's password from a valid invite token. Returns {ok, id, email}.
export async function setAgentPassword(env, token, password) {
  const pwErr = passwordPolicyError(password);
  if (pwErr) return { ok: false, error: pwErr };
  const a = await agentByInviteToken(env, token);
  if (!a) return { ok: false, error: "This link is invalid or has expired." };
  const { salt, hash } = await hashPassword(password);
  // Bump session_ver so any older sessions for this agent stop validating once
  // the password changes (a reset should log out the old device).
  await runWithSessionVerFallback(env,
    "UPDATE agents SET pass_salt = ?, pass_hash = ?, invite_token = NULL, invite_exp = NULL, active = 1, session_ver = session_ver + 1 WHERE id = ?",
    "UPDATE agents SET pass_salt = ?, pass_hash = ?, invite_token = NULL, invite_exp = NULL, active = 1 WHERE id = ?",
    [salt, hash, a.id], "setAgentPassword");
  return { ok: true, id: a.id, email: a.email };
}

// --- Client (buyer) portal invites (same shape as agents) --------------------
// Look up the client for a valid, unexpired invite token.
export async function clientByInviteToken(env, token) {
  if (!token) return null;
  const c = await env.DB.prepare(
    "SELECT id, name, email, invite_exp FROM clients WHERE invite_token IN (?, ?)"
  ).bind(...(await tokenMatchPair(token))).first();
  if (!c || !c.invite_exp || Number(c.invite_exp) < Date.now()) return null;
  return c;
}

// Set a client's portal password from a valid invite token. Returns {ok,id,email}.
export async function setClientPassword(env, token, password) {
  const pwErr = passwordPolicyError(password);
  if (pwErr) return { ok: false, error: pwErr };
  const c = await clientByInviteToken(env, token);
  if (!c) return { ok: false, error: "This link is invalid or has expired." };
  const { salt, hash } = await hashPassword(password);
  // Bump session_ver so any older portal sessions stop validating on reset.
  await runWithSessionVerFallback(env,
    "UPDATE clients SET pass_salt = ?, pass_hash = ?, invite_token = NULL, invite_exp = NULL, portal_enabled = 1, session_ver = session_ver + 1 WHERE id = ?",
    "UPDATE clients SET pass_salt = ?, pass_hash = ?, invite_token = NULL, invite_exp = NULL, portal_enabled = 1 WHERE id = ?",
    [salt, hash, c.id], "setClientPassword");
  return { ok: true, id: c.id, email: c.email };
}

// --- Dealer invites (same pattern as agents and clients) ----------------------
// Look up the dealer for a valid, unexpired invite token.
export async function dealerByInviteToken(env, token) {
  if (!token) return null;
  const d = await env.DB.prepare(
    "SELECT id, name, email, invite_exp FROM dealers WHERE invite_token IN (?, ?)"
  ).bind(...(await tokenMatchPair(token))).first();
  if (!d || !d.invite_exp || Number(d.invite_exp) < Date.now()) return null;
  return d;
}

// --- Self-serve password reset (V1.2 item 0.3) --------------------------------
// Reuses the invite-token machinery: a reset stamps a fresh single-use token
// (1 hour expiry, vs 7 days for onboarding invites) onto the account row, and
// the emailed link lands on the same /set-password flow. Only accounts that can
// ALREADY sign in are eligible - a reset must never grant access that staff have
// not granted (revoked portals, deactivated agents/dealers, invite-pending rows).
export const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

// Stamp a reset token onto a specific account. {kind,id,name,email,token}|null.
// Used by the admin-side "Send password reset" actions; the email lookup below
// wraps it for the public form.
export async function beginPasswordResetFor(env, kind, id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return null;
  const eligible = {
    agent: "SELECT id, name, email FROM agents WHERE id = ? AND active = 1 AND pass_hash IS NOT NULL AND pass_hash <> ''",
    dealer: "SELECT id, name, email FROM dealers WHERE id = ? AND active = 1 AND pass_hash IS NOT NULL AND pass_hash <> ''",
    client: "SELECT id, name, email FROM clients WHERE id = ? AND portal_enabled = 1 AND portal_revoked = 0 AND pass_hash IS NOT NULL AND pass_hash <> ''",
  }[kind];
  if (!eligible) return null;
  const row = await env.DB.prepare(eligible).bind(n).first();
  if (!row || !row.email) return null;
  const token = randomToken();
  const exp = Date.now() + RESET_TTL_MS;
  const table = kind === "agent" ? "agents" : kind === "dealer" ? "dealers" : "clients";
  // Store only the hash; the raw token goes out in the email and is returned here.
  await env.DB.prepare(`UPDATE ${table} SET invite_token = ?, invite_exp = ? WHERE id = ?`)
    .bind(await hashToken(token), exp, row.id).run();
  return { kind, id: row.id, name: row.name, email: row.email, token };
}

// Public "Forgot password?" lookup by email, across every role. Checks agents,
// then dealers, then clients (mirroring authenticate's precedence). Returns the
// reset payload for the first eligible account, or null - the ROUTE must render
// the identical neutral response either way (no account enumeration).
export async function beginPasswordReset(env, email) {
  const e = String(email || "").trim().toLowerCase();
  if (!e || e.length > EMAIL_MAX) return null;
  const lookups = [
    { kind: "agent", sql: "SELECT id FROM agents WHERE lower(email) = ? AND active = 1 AND pass_hash IS NOT NULL AND pass_hash <> '' LIMIT 1" },
    { kind: "dealer", sql: "SELECT id FROM dealers WHERE lower(email) = ? AND active = 1 AND pass_hash IS NOT NULL AND pass_hash <> '' LIMIT 1" },
    { kind: "client", sql: "SELECT id FROM clients WHERE lower(email) = ? AND portal_enabled = 1 AND portal_revoked = 0 AND pass_hash IS NOT NULL AND pass_hash <> '' ORDER BY id DESC LIMIT 1" },
  ];
  for (const { kind, sql } of lookups) {
    try {
      const row = await env.DB.prepare(sql).bind(e).first();
      if (row) return beginPasswordResetFor(env, kind, row.id);
    } catch (err) {
      // Same isolation as authenticate: one broken role branch degrades that
      // role only.
      console.error("beginPasswordReset lookup failed:", err.message);
    }
  }
  return null;
}

// Set a dealer's password from a valid invite token. Returns {ok,id,email}.
export async function setDealerPassword(env, token, password) {
  const pwErr = passwordPolicyError(password);
  if (pwErr) return { ok: false, error: pwErr };
  const d = await dealerByInviteToken(env, token);
  if (!d) return { ok: false, error: "This link is invalid or has expired." };
  const { salt, hash } = await hashPassword(password);
  // Bump session_ver so any older sessions stop validating on password reset.
  await env.DB.prepare(
    "UPDATE dealers SET pass_salt = ?, pass_hash = ?, invite_token = NULL, invite_exp = NULL, active = 1, session_ver = session_ver + 1 WHERE id = ?"
  ).bind(salt, hash, d.id).run();
  return { ok: true, id: d.id, email: d.email };
}
