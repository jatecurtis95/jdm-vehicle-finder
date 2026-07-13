import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import * as auth from "../src/auth.js";
import { makeEnv } from "./helpers/d1.mjs";

const HOST = "https://jdmfinder.com.au";
const CTX = { waitUntil() {} };

function authEnv() {
  const env = makeEnv(`
    INSERT INTO agents (id,email,name,pass_salt,pass_hash,active,session_ver)
    VALUES (1,'agent@example.com','Agent','','',1,0);
  `);
  env.ADMIN_TOKEN = "launch-security-signing-key";
  return env;
}

function cookieRequest(setCookie) {
  return new Request(HOST + "/admin", {
    headers: { Cookie: String(setCookie).split(";")[0] },
  });
}

test("legacy unversioned account sessions are no longer accepted", async () => {
  const env = authEnv();
  const expires = Date.now() + 60_000;
  const payload = `agent:1:${expires}`;
  const cookie = `fsess=${encodeURIComponent(`${payload}.${await auth.sign(env, payload)}`)}`;
  assert.equal(await auth.getSession(cookieRequest(cookie), new URL(HOST), env), null);
});

test("session-version database failures fail closed", async () => {
  const env = authEnv();
  const cookie = await auth.sessionCookie(env, "agent", 1);
  const realPrepare = env.DB.prepare.bind(env.DB);
  env.DB.prepare = (sql) => {
    if (/SELECT session_ver FROM agents/.test(sql)) throw new Error("simulated D1 outage");
    return realPrepare(sql);
  };
  assert.equal(await auth.getSession(cookieRequest(cookie), new URL(HOST), env), null);
});

test("public share links carry and enforce a bounded expiry", async () => {
  const env = authEnv();
  const issuedAt = 1_000_000;
  assert.ok(Number.isFinite(auth.SHARE_TTL_MS) && auth.SHARE_TTL_MS > 0);
  const token = await auth.makeShareToken(env, 42, issuedAt);
  assert.equal(await auth.readShareToken(env, token, issuedAt + 1), 42);
  assert.equal(await auth.readShareToken(env, token, issuedAt + auth.SHARE_TTL_MS + 1), null);
});

test("stale email decision links cannot mutate a match", async () => {
  const env = makeEnv(`
    INSERT INTO clients (id,name,email) VALUES (1,'Buyer','buyer@example.com');
    INSERT INTO wishlists (id,client_id,label,active) VALUES (1,1,'Old search',1);
    INSERT INTO queue (id,wishlist_id,client_id,lot_id,lot_json,status,token,created_at)
    VALUES (1,1,1,'OLD-LOT','{"id":"OLD-LOT"}','pending','old-action-token',datetime('now','-31 days'));
  `);
  env.ADMIN_TOKEN = "launch-security-signing-key";
  const response = await worker.fetch(new Request(HOST + "/decide", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: "old-action-token", action: "reject" }),
  }), env, CTX);
  assert.equal(response.status, 410);
  assert.equal(env.db.prepare("SELECT status FROM queue WHERE id = 1").get().status, "pending");
});
