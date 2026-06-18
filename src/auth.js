// Stateless signed-cookie session for the admin area.
//
// The session cookie carries an expiry timestamp signed with HMAC-SHA256,
// keyed by ADMIN_TOKEN. No server-side session store is needed: a cookie is
// valid iff its signature verifies and it hasn't expired. Login checks the
// submitted password against ADMIN_PASSWORD (preferred) or ADMIN_TOKEN.

const COOKIE = "fsess";
const SESSION_SECONDS = 60 * 60 * 24 * 30; // 30 days
const enc = new TextEncoder();

function toBase64Url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(env, msg) {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(env.ADMIN_TOKEN || ""), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return toBase64Url(new Uint8Array(sig));
}

// Constant-time comparison to avoid leaking match length via timing.
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// True if the submitted login password matches a configured credential.
export function passwordValid(env, password) {
  if (typeof password !== "string" || password.length === 0) return false;
  return [env.ADMIN_PASSWORD, env.ADMIN_TOKEN].filter(Boolean).some((c) => safeEqual(password, c));
}

// Set-Cookie value that establishes a signed session.
export async function sessionCookie(env) {
  const exp = String(Date.now() + SESSION_SECONDS * 1000);
  const value = `${exp}.${await sign(env, exp)}`;
  return `${COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}`;
}

// Set-Cookie value that immediately clears the session.
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

async function hasValidSession(request, env) {
  const raw = readCookie(request, COOKIE);
  if (!raw) return false;
  const dot = raw.lastIndexOf(".");
  if (dot < 1) return false;
  const exp = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await sign(env, exp));
}

// Authenticated if a valid session cookie is present, or the legacy
// ?key=ADMIN_TOKEN fallback matches (kept so old bookmarks keep working).
export async function isAuthed(request, url, env) {
  const key = url.searchParams.get("key");
  if (key && env.ADMIN_TOKEN && safeEqual(key, env.ADMIN_TOKEN)) return true;
  return hasValidSession(request, env);
}
