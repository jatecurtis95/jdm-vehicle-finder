// Stateless signed-cookie sessions with two roles: "admin" (JDM Connect, sees
// everything) and "agent" (sees only their own clients/wishlists/matches).
//
// The cookie carries `role:id:expiry`, signed with HMAC-SHA256 keyed by
// ADMIN_TOKEN — no server-side session store. Admin logs in with ADMIN_PASSWORD
// (or ADMIN_TOKEN); agents log in with their email + password (PBKDF2-hashed in
// the agents table). Login is via the form only — no ?key= URL fallback.

const COOKIE = "fsess";
const SESSION_SECONDS = 60 * 60 * 24 * 30; // 30 days
const PBKDF2_ITER = 100000;
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
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(env.ADMIN_TOKEN || ""), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return toBase64Url(new Uint8Array(sig));
}

// Constant-time comparison.
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// --- Password hashing (PBKDF2-SHA256) ---------------------------------------
async function deriveHash(password, saltBytes) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations: PBKDF2_ITER, hash: "SHA-256" }, key, 256
  );
  return new Uint8Array(bits);
}
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveHash(password, salt);
  return { salt: toBase64(salt), hash: toBase64(hash) };
}
export async function verifyPassword(password, saltB64, hashB64) {
  if (!password || !saltB64 || !hashB64) return false;
  try {
    const hash = await deriveHash(password, fromBase64(saltB64));
    return safeEqual(toBase64(hash), hashB64);
  } catch (e) {
    return false;
  }
}

// --- Admin password ----------------------------------------------------------
export function passwordValid(env, password) {
  if (typeof password !== "string" || password.length === 0) return false;
  return [env.ADMIN_PASSWORD, env.ADMIN_TOKEN].filter(Boolean).some((c) => safeEqual(password, c));
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
  if ((role !== "admin" && role !== "agent") || !/^\d+$/.test(expStr) || Number(expStr) < Date.now()) return null;
  return { role, id: Number(idStr) || 0 };
}

// Current session from the signed cookie. {role,id}|null. (The legacy
// ?key=ADMIN_TOKEN URL fallback was removed so the admin token can't leak via
// URLs, browser history, referrers or server logs.)
export async function getSession(request, url, env) {
  return sessionFromCookie(request, env);
}

// Verify login credentials. Admin password wins; otherwise email+password is
// checked against an active agent (with a password set). Returns {role,id}|null.
export async function authenticate(env, email, password) {
  if (passwordValid(env, password)) return { role: "admin", id: 0 };
  const e = String(email || "").trim().toLowerCase();
  if (!e || !password) return null;
  const agent = await env.DB.prepare(
    "SELECT id, pass_salt, pass_hash, active FROM agents WHERE email = ?"
  ).bind(e).first();
  if (!agent || !agent.active || !agent.pass_hash) return null;
  if (await verifyPassword(password, agent.pass_salt, agent.pass_hash)) return { role: "agent", id: agent.id };
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
  if (typeof password !== "string" || password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }
  const a = await agentByInviteToken(env, token);
  if (!a) return { ok: false, error: "This link is invalid or has expired." };
  const { salt, hash } = await hashPassword(password);
  await env.DB.prepare(
    "UPDATE agents SET pass_salt = ?, pass_hash = ?, invite_token = NULL, invite_exp = NULL, active = 1 WHERE id = ?"
  ).bind(salt, hash, a.id).run();
  return { ok: true, id: a.id, email: a.email };
}
