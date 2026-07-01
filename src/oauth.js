// Google social login (OAuth 2.0 Authorization Code flow), Workers-native.
//
// The flow, end to end:
//   1. /auth/google?intent=signup|login  -> beginGoogle() builds the Google
//      authorize URL with a signed `state` (intent + nonce) and sets the nonce
//      as a short-lived, HttpOnly, SameSite=Lax cookie. We redirect the browser.
//   2. Google authenticates the user and redirects back to
//      /auth/google/callback?code=...&state=...
//   3. completeGoogle() verifies the state signature AND that the state's nonce
//      matches the cookie (browser-bound, so a stranger can't complete the flow
//      in the victim's browser), then exchanges the code for tokens server-to-
//      server (authenticated by our client secret) and reads the verified email
//      + name from Google's userinfo endpoint.
//
// The whole feature is inert until GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are
// configured, so the code is safe to ship before the credentials exist.

import { makeOauthState, readOauthState, randomToken, safeEqual } from "./auth.js";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO = "https://openidconnect.googleapis.com/v1/userinfo";
const SCOPE = "openid email profile";
const NONCE_COOKIE = "foauth";
const NONCE_MAX_AGE = 600; // seconds; matches the 10-minute state window

// True only when both halves of the credential pair are present.
export function googleConfigured(env) {
  return Boolean(env && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

// Same-origin callback: we build the redirect_uri from whichever host the user
// is actually on, so the nonce cookie set on that host is present at the
// callback (no cross-domain cookie loss). Each host used must be registered in
// the Google console.
function redirectUri(origin) {
  return `${origin}/auth/google/callback`;
}

function nonceCookie(nonce) {
  return `${NONCE_COOKIE}=${nonce}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${NONCE_MAX_AGE}`;
}
export function clearNonceCookie() {
  return `${NONCE_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
function readNonceCookie(request) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > -1 && part.slice(0, i) === NONCE_COOKIE) return part.slice(i + 1);
  }
  return null;
}

// Build the Google authorize URL for `intent` ("signup" | "login") and the
// nonce cookie the caller must set on the redirect. Returns {authUrl, cookie}.
export async function beginGoogle(env, origin, intent) {
  const nonce = randomToken();
  const wanted = intent === "login" ? "login" : "signup";
  const state = await makeOauthState(env, wanted, nonce);
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: SCOPE,
    state,
    access_type: "online",
    include_granted_scopes: "true",
    prompt: "select_account",
  });
  return { authUrl: `${GOOGLE_AUTH}?${params.toString()}`, cookie: nonceCookie(nonce) };
}

// Verify the callback and resolve the Google identity. Returns
// {ok:true, intent, profile:{sub,email,name}} or {ok:false, intent, error}.
// `intent` is echoed even on failure so the caller can bounce to the right page.
export async function completeGoogle(env, request, url) {
  const providerErr = url.searchParams.get("error"); // e.g. access_denied
  const code = url.searchParams.get("code");
  const st = await readOauthState(env, url.searchParams.get("state"));
  const intent = st && st.intent === "login" ? "login" : "signup";
  if (providerErr) return { ok: false, intent, error: providerErr };
  if (!code || !st) return { ok: false, intent, error: "state" };

  // Browser-bound check: the nonce in the signed state must equal the nonce in
  // the cookie set when the flow began.
  const cookieNonce = readNonceCookie(request);
  if (!cookieNonce || !safeEqual(cookieNonce, st.nonce)) return { ok: false, intent, error: "nonce" };

  // Exchange the one-time code for tokens. This call carries our client secret,
  // so Google authenticates us and the response is trustworthy.
  let tok;
  try {
    const res = await fetch(GOOGLE_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri(url.origin),
        grant_type: "authorization_code",
      }).toString(),
    });
    if (!res.ok) return { ok: false, intent, error: "token" };
    tok = await res.json();
  } catch (e) {
    return { ok: false, intent, error: "token" };
  }
  if (!tok || !tok.access_token) return { ok: false, intent, error: "token" };

  // Read the profile. Because the access token came from our authenticated
  // exchange, this response is trusted without separately verifying the JWT.
  let ui;
  try {
    const res = await fetch(GOOGLE_USERINFO, { headers: { Authorization: `Bearer ${tok.access_token}` } });
    if (!res.ok) return { ok: false, intent, error: "userinfo" };
    ui = await res.json();
  } catch (e) {
    return { ok: false, intent, error: "userinfo" };
  }

  const email = String(ui.email || "").trim().toLowerCase();
  const verified = ui.email_verified === true || ui.email_verified === "true";
  const sub = String(ui.sub || "").trim();
  // Only trust a Google-verified email with a stable subject id. An unverified
  // email could belong to someone else (account claim), and a missing `sub`
  // means a malformed/spoofed profile we won't act on - a real Google token
  // always carries it.
  if (!email || !verified || !sub) return { ok: false, intent, error: "unverified" };
  return { ok: true, intent, profile: { sub, email, name: String(ui.name || "").trim() } };
}
