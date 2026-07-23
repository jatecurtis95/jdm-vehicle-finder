// V1.3 production-readiness: the password policy must welcome password
// managers and long passphrases, not fight them.
//
//  * Passwords of at least 64 characters are supported end to end.
//  * No small symbol allowlist: any printable character is fine (control
//    characters are still refused).
//  * Common / known-compromised passwords are rejected when a NEW password is
//    chosen, so day-one accounts don't ship with guessable credentials.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv, readFile } from "./helpers/d1.mjs";
import {
  authenticate, setClientPassword, passwordPolicyError, PW_MIN, PW_MAX,
} from "../src/auth.js";
import { setPasswordPage } from "../src/admin.js";

const FUTURE = () => Date.now() + 60 * 60 * 1000;

test("the policy accepts passwords of 64+ characters", () => {
  assert.ok(PW_MAX >= 64, `PW_MAX must be at least 64 (got ${PW_MAX})`);
  const long = "correct horse battery staple 42 " + "x".repeat(40); // 72 chars
  assert.equal(passwordPolicyError(long), null);
});

test("passwords longer than PW_MAX are still refused (bounds the hashing work)", () => {
  const over = "Aa1" + "x".repeat(PW_MAX);
  assert.match(passwordPolicyError(over) || "", /characters or fewer/);
});

test("no small symbol allowlist: quotes, brackets, spaces and unicode pass", () => {
  for (const pw of [
    'He said "no way!" 9 times',
    "semi;colon~and[brackets]{braces} 7",
    "emoji ok too ❤️ abc123",
    "sl/ash\\es|pipes`ticks' #1 fine",
  ]) {
    assert.equal(passwordPolicyError(pw), null, `should accept: ${pw}`);
  }
});

test("control characters are refused", () => {
  assert.notEqual(passwordPolicyError("Goodpass123\u0000"), null);
  assert.notEqual(passwordPolicyError("Goodpass123\n"), null);
});

test("common passwords are refused when setting a new password", () => {
  for (const pw of ["password123", "Password1234", "1234567890a", "qwerty123456"]) {
    assert.match(passwordPolicyError(pw) || "", /common/i, `should refuse: ${pw}`);
  }
});

test("a 64-character password round-trips: set via invite link, then sign in", async () => {
  const env = makeEnv();
  env.db.prepare(
    "INSERT INTO users (name, email, portal_enabled, invite_token, invite_exp) VALUES ('Long','long@example.com',1,'tok-long',?)"
  ).run(FUTURE());
  const pw = "a genuinely long passphrase with 64 characters in it -- number 7"; // 64 chars
  assert.equal(pw.length, 64);
  const r = await setClientPassword(env, "tok-long", pw);
  assert.equal(r.ok, true, r.error);
  const who = await authenticate(env, "long@example.com", pw);
  assert.ok(who, "the 64-char password must sign in");
  assert.equal(who.role, "client");
});

test("the set-password form allows the new policy (maxlength >= 64, no allowlist hint)", () => {
  const html = setPasswordPage({ token: "t", name: "N" });
  const m = html.match(/id="sp-pass"[^>]*maxlength="(\d+)"/);
  assert.ok(m, "set-password input renders a maxlength");
  assert.ok(Number(m[1]) >= 64, `set-password maxlength must be >= 64 (got ${m[1]})`);
  assert.ok(!/plus\s*!/.test(html), "the symbol-allowlist hint is gone");
});

test("the wizard's client-side mirror no longer enforces a symbol allowlist", () => {
  const src = readFile("src/request-wizard.js");
  assert.ok(
    !/A-Za-z0-9!@#\$%\^&\*\(\)/.test(src),
    "request-wizard.js must not re-impose the old symbol allowlist client-side"
  );
});
