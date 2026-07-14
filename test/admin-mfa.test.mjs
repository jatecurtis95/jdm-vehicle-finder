// Admin MFA (TOTP, RFC 6238). Opt-in: when ADMIN_TOTP_SECRET is set, the admin
// password alone no longer issues a session - a 6-digit authenticator code is
// required as a second step. Inert (existing single-step behaviour) when the
// secret is unset, so enabling it is purely an ops decision.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import worker from "../src/index.js";
import { base32Decode, totpCode, verifyAdminTotp } from "../src/auth.js";

const CTX = { waitUntil() {} };
const HOST = "https://jdmfinder.com.au";
// RFC 6238 test secret: ASCII "12345678901234567890" as base32.
const RFC_SECRET_B32 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

function env(extra = {}) {
  const e = makeEnv();
  e.ADMIN_TOKEN = "test-admin-token";
  e.ADMIN_PASSWORD = "an-admin-password-for-tests";
  return Object.assign(e, extra);
}

function loginPost(body, headers = {}) {
  return new Request(HOST + "/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers },
    body: new URLSearchParams(body),
  });
}

// --- TOTP primitive against the RFC 6238 vectors (SHA-1, 6 digits) -----------

test("totpCode matches the RFC 6238 test vectors", async () => {
  const secret = base32Decode(RFC_SECRET_B32);
  assert.equal(await totpCode(secret, 59 * 1000), "287082");
  assert.equal(await totpCode(secret, 1111111109 * 1000), "081804");
  assert.equal(await totpCode(secret, 1234567890 * 1000), "005924");
});

test("base32Decode handles case, whitespace and padding; refuses junk", () => {
  const a = base32Decode(RFC_SECRET_B32);
  const b = base32Decode("gezd gnbv gy3t qojq gezd gnbv gy3t qojq==");
  assert.deepEqual(Array.from(b), Array.from(a));
  assert.equal(base32Decode("not base32 !!!"), null);
});

test("verifyAdminTotp accepts one step of clock drift either side, refuses others", async () => {
  const e = { ADMIN_TOTP_SECRET: RFC_SECRET_B32 };
  const now = 1111111109 * 1000;
  const secret = base32Decode(RFC_SECRET_B32);
  assert.equal(await verifyAdminTotp(e, "081804", now), true);
  assert.equal(await verifyAdminTotp(e, await totpCode(secret, now - 30 * 1000), now), true);
  assert.equal(await verifyAdminTotp(e, await totpCode(secret, now + 30 * 1000), now), true);
  assert.equal(await verifyAdminTotp(e, await totpCode(secret, now + 90 * 1000), now), false);
  assert.equal(await verifyAdminTotp(e, "000000", now), false);
  assert.equal(await verifyAdminTotp(e, "junk", now), false);
  assert.equal(await verifyAdminTotp({}, "081804", now), false, "no secret configured = MFA off");
});

// --- Login flow ---------------------------------------------------------------

test("without ADMIN_TOTP_SECRET the admin password signs straight in (regression)", async () => {
  const e = env();
  const res = await worker.fetch(loginPost({ email: "", password: e.ADMIN_PASSWORD }), e, CTX);
  assert.equal(res.status, 303);
  assert.match(res.headers.get("Set-Cookie") || "", /fsess=/);
});

test("with MFA on, the correct password alone gets the code page, not a session", async () => {
  const e = env({ ADMIN_TOTP_SECRET: RFC_SECRET_B32 });
  const res = await worker.fetch(loginPost({ email: "", password: e.ADMIN_PASSWORD }), e, CTX);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /name="totp"/, "renders the authenticator-code form");
  const cookies = res.headers.get("Set-Cookie") || "";
  assert.match(cookies, /fmfa=/, "sets the pending-MFA cookie");
  assert.ok(!/fsess=/.test(cookies), "must NOT issue a session before the code");
});

test("a valid code with the pending cookie completes the sign-in", async () => {
  const e = env({ ADMIN_TOTP_SECRET: RFC_SECRET_B32 });
  const step1 = await worker.fetch(loginPost({ email: "", password: e.ADMIN_PASSWORD }), e, CTX);
  const fmfa = (step1.headers.get("Set-Cookie") || "").split(";")[0];
  const code = await totpCode(base32Decode(RFC_SECRET_B32), Date.now());
  const res = await worker.fetch(loginPost({ totp: code }, { Cookie: fmfa }), e, CTX);
  assert.equal(res.status, 303);
  const cookies = res.headers.get("Set-Cookie") || "";
  assert.match(cookies, /fsess=/, "issues the admin session");
});

test("a wrong code is refused and never issues a session", async () => {
  const e = env({ ADMIN_TOTP_SECRET: RFC_SECRET_B32 });
  const step1 = await worker.fetch(loginPost({ email: "", password: e.ADMIN_PASSWORD }), e, CTX);
  const fmfa = (step1.headers.get("Set-Cookie") || "").split(";")[0];
  const res = await worker.fetch(loginPost({ totp: "000000" }, { Cookie: fmfa }), e, CTX);
  assert.equal(res.status, 401);
  assert.ok(!/fsess=/.test(res.headers.get("Set-Cookie") || ""));
});

test("a code with no pending-MFA cookie is refused (can't skip the password)", async () => {
  const e = env({ ADMIN_TOTP_SECRET: RFC_SECRET_B32 });
  const code = await totpCode(base32Decode(RFC_SECRET_B32), Date.now());
  const res = await worker.fetch(loginPost({ totp: code }), e, CTX);
  assert.equal(res.status, 401);
  assert.ok(!/fsess=/.test(res.headers.get("Set-Cookie") || ""));
});
