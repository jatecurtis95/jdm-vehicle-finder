// Stateless signed-cookie sessions with two roles: "admin" (JDM Connect, sees
// everything) and "agent" (sees only their own clients/wishlists/matches).
//
// The cookie carries `role:id:expiry`, signed with HMAC-SHA256 keyed by
// ADMIN_TOKEN — no server-side session store. Admin logs in with ADMIN_PASSWORD
// (required; ADMIN_TOKEN is signing-key only and is never a valid password);
// agents log in with their email + password (PBKDF2-hashed in the agents
// table). Login is via the form only — no ?key= URL fallback.

const COOKIE = "fsess";
const SESSION_SECONDS = 60 * 60 * 24 * 30; // 30 days
// OWASP (2023) recommends >=600k PBKDF2-SHA256 iterations; the Workers CPU
// budget caps what a login request can afford, so 210k is the practical
// balance (audit Low #18, set 2026-07-02). New hashes embed their iteration
// count as an "<iter>." prefix on the stored hash; bare legacy hashes (no
// prefix) verify at the old 100k count until that user next sets a password.
const PBKDF2_ITER = 210000;
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

async function sign(env, msg) {
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
// link can only VIEW a car — it can never trigger an action. No DB column needed.
export async function makeShareToken(env, queueId) {
  const id = Number(queueId);
  if (!Number.isInteger(id) || id <= 0) return null;
  return `${id}.${await sign(env, `share:${id}`)}`;
}
export async function readShareToken(env, token) {
  const [idStr, sig] = String(token || "").split(".");
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0 || !sig) return null;
  return safeEqual(sig, await sign(env, `share:${id}`)) ? id : null;
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
// the HMAC signing key and must never be compared against user-supplied input —
// accepting it here would let a leaked/guessed token both log in as admin AND
// forge arbitrary session/share/OAuth tokens (the two roles need opposite
// secrecy properties). If ADMIN_PASSWORD is unset, admin login is disabled.
export function passwordValid(env, password) {
  if (typeof password !== "string" || password.length === 0) return false;
  return Boolean(env.ADMIN_PASSWORD) && safeEqual(password, env.ADMIN_PASSWORD);
}

// --- Sessions ----------------------------------------------------------------
export async function sessionCookie(env, role, id) {
  const exp = Date.now() + SESSION_SECONDS * 1000;
  const payload = `${role}:${id || 0}:${exp}`;
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
  if (parts.length !== 3) return null;
  const [role, idStr, expStr] = parts;
  if (!["admin", "agent", "client"].includes(role) || !/^\d+$/.test(expStr) || Number(expStr) < Date.now()) return null;
  return { role, id: Number(idStr) || 0 };
}

// Current session from the signed cookie. {role,id}|null. (The legacy
// ?key=ADMIN_TOKEN URL fallback was removed so the admin token can't leak via
// URLs, browser history, referrers or server logs.)
export async function getSession(request, url, env) {
  return sessionFromCookie(request, env);
}

// Verify login credentials. Admin password wins; then an active agent (email +
// password); then a portal-enabled client (email + password). {role,id}|null.
export async function authenticate(env, email, password) {
  if (passwordValid(env, password)) return { role: "admin", id: 0 };
  const e = String(email || "").trim().toLowerCase();
  if (!e || !password) return null;

  const agent = await env.DB.prepare(
    "SELECT id, pass_salt, pass_hash, active FROM agents WHERE email = ?"
  ).bind(e).first();
  if (agent && agent.active && agent.pass_hash && await verifyPassword(password, agent.pass_salt, agent.pass_hash)) {
    return { role: "agent", id: agent.id };
  }

  // Buyer portal: a client who has been given access and set a password. If an
  // email somehow maps to several clients, the most recent portal account wins.
  const client = await env.DB.prepare(
    "SELECT id, pass_salt, pass_hash FROM clients WHERE lower(email) = ? AND portal_enabled = 1 AND pass_hash IS NOT NULL AND pass_hash <> '' ORDER BY id DESC LIMIT 1"
  ).bind(e).first();
  if (client && await verifyPassword(password, client.pass_salt, client.pass_hash)) {
    return { role: "client", id: client.id };
  }
  return null;
}

// --- Agent invites (agent sets their own password) ---------------------------
export function randomToken() {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(24)));
}

// Look up the agent for a valid, unexpired invite token.
export async function agentByInviteToken(env, token) {
  if (!token) return null;
  const a = await env.DB.prepare(
    "SELECT id, name, email, invite_exp FROM agents WHERE invite_token = ?"
  ).bind(String(token)).first();
  if (!a || !a.invite_exp || Number(a.invite_exp) < Date.now()) return null;
  return a;
}

// Set an agent's password from a valid invite token. Returns {ok, id, email}.
export async function setAgentPassword(env, token, password) {
  const pwErr = passwordPolicyError(password);
  if (pwErr) return { ok: false, error: pwErr };
  const a = await agentByInviteToken(env, token);
  if (!a) return { ok: false, error: "This link is invalid or has expired." };
  const { salt, hash } = await hashPassword(password);
  await env.DB.prepare(
    "UPDATE agents SET pass_salt = ?, pass_hash = ?, invite_token = NULL, invite_exp = NULL, active = 1 WHERE id = ?"
  ).bind(salt, hash, a.id).run();
  return { ok: true, id: a.id, email: a.email };
}

// --- Client (buyer) portal invites (same shape as agents) --------------------
// Look up the client for a valid, unexpired invite token.
export async function clientByInviteToken(env, token) {
  if (!token) return null;
  const c = await env.DB.prepare(
    "SELECT id, name, email, invite_exp FROM clients WHERE invite_token = ?"
  ).bind(String(token)).first();
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
  await env.DB.prepare(
    "UPDATE clients SET pass_salt = ?, pass_hash = ?, invite_token = NULL, invite_exp = NULL, portal_enabled = 1 WHERE id = ?"
  ).bind(salt, hash, c.id).run();
  return { ok: true, id: c.id, email: c.email };
}
