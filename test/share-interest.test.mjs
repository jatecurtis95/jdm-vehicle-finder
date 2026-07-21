// The public share-link surface through the real worker: view counting for
// anonymous opens, the "I'm interested" tap (token-verified, never id-driven),
// and the revoke / regenerate lifecycle end to end.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import worker from "../src/index.js";
import { makeShareToken, sessionCookie } from "../src/auth.js";
import { regenerateShareLink, setShareRevoked } from "../src/admin.js";

const HOST = "https://jdmfinder.com.au";

function seed() {
  return `
    INSERT INTO agents (id, email, name, pass_salt, pass_hash, active) VALUES (7, 'stranger@x.com', 'Stranger', '', '', 1);
    INSERT INTO clients (id, name, email, whatsapp, portal_enabled, agent_id) VALUES
      (1, 'Jordan Buyer', 'jordan@x.com', '+61400111222', 1, NULL);
    INSERT INTO wishlists (id, client_id, label, marka_name, model_name, active, status) VALUES
      (1, 1, 'Aqua', 'TOYOTA', 'AQUA', 1, 'vehicles_sent');
    INSERT INTO queue (id, wishlist_id, client_id, lot_id, lot_json, status, token) VALUES
      (10, 1, 1, 'L1', '{"year":2021,"marka_name":"TOYOTA","model_name":"AQUA","lot":"9850","rate":"3.5","mileage":43000}', 'sent', 't-1');
  `;
}

let env, ctx;
before(() => {
  // No network: the image-heal feed read and any push notification just no-op.
  globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => "<aj></aj>", json: async () => ({}) });
  env = makeEnv(seed());
  env.ADMIN_TOKEN = "test-secret";
  ctx = { waitUntil() {} };
});

const get = (path, headers = {}) =>
  worker.fetch(new Request(HOST + path, { headers, redirect: "manual" }), env, ctx);
const post = (path, body) =>
  worker.fetch(new Request(HOST + path, {
    method: "POST",
    body: new URLSearchParams(body),
    headers: { "Content-Type": "application/x-www-form-urlencoded", "CF-Connecting-IP": "203.0.113.9" },
    redirect: "manual",
  }), env, ctx);
// Same-origin authenticated POST (staff routes sit behind the session + CSRF
// same-origin guard, so Origin must match the request host).
const post2 = (path, body, cookie) =>
  worker.fetch(new Request(HOST + path, {
    method: "POST",
    body: new URLSearchParams(body),
    headers: { "Content-Type": "application/x-www-form-urlencoded", "CF-Connecting-IP": "203.0.113.9", "Origin": HOST, Cookie: cookie },
    redirect: "manual",
  }), env, ctx);

test("anonymous opens count views; signed-in opens don't", async () => {
  const tok = await makeShareToken(env, 10);
  const res = await get(`/v?t=${encodeURIComponent(tok)}`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /TOYOTA|Toyota/);
  let q = await env.DB.prepare("SELECT share_view_count FROM queue WHERE id = 10").first();
  assert.equal(q.share_view_count, 1);

  const cookie = (await sessionCookie(env, "admin", 0)).split(";")[0];
  const res2 = await get(`/v?t=${encodeURIComponent(tok)}`, { Cookie: cookie });
  assert.equal(res2.status, 200);
  q = await env.DB.prepare("SELECT share_view_count, share_last_viewed_at FROM queue WHERE id = 10").first();
  assert.equal(q.share_view_count, 1, "a staff preview must not inflate the client view count");
  assert.ok(q.share_last_viewed_at);
});

test("a bad token 404s without revealing whether the row exists", async () => {
  assert.equal((await get("/v?t=10.forged")).status, 404);
  assert.equal((await get("/v?t=999999.forged")).status, 404);
  assert.equal((await get("/v")).status, 404);
});

test("I'm interested records the response and only via a live token", async () => {
  const tok = await makeShareToken(env, 10);
  const res = await post("/v/interest", { t: tok });
  assert.equal(res.status, 303);
  assert.match(res.headers.get("Location"), /\/v\?t=.*ok=1/);
  const q = await env.DB.prepare("SELECT response FROM queue WHERE id = 10").first();
  assert.equal(q.response, "interested");

  // The thanks state renders on the follow-up GET.
  const html = await (await get(`/v?t=${encodeURIComponent(tok)}&ok=1`)).text();
  assert.match(html, /know you&rsquo;re interested/);

  // A forged token can't record anything.
  await env.DB.prepare("UPDATE queue SET response = NULL WHERE id = 10").run();
  assert.equal((await post("/v/interest", { t: "10.forged" })).status, 404);
  const q2 = await env.DB.prepare("SELECT response FROM queue WHERE id = 10").first();
  assert.equal(q2.response, null);
});

test("staff /share/* routes wire through the worker and gate on client access", async () => {
  const adminCookie = (await sessionCookie(env, "admin", 0)).split(";")[0];
  // Save price + notes through the real route.
  const save = await post2("/share/details", { id: "10", price_note: "Suggest 16-17k", condition_notes: "Clean.", back: "/admin?view=lot&id=10" }, adminCookie);
  assert.equal(save.status, 303);
  let q = await env.DB.prepare("SELECT share_price_note, share_condition_notes FROM queue WHERE id = 10").first();
  assert.equal(q.share_price_note, "Suggest 16-17k");
  assert.equal(q.share_condition_notes, "Clean.");

  // Revoke, then the public link is dead.
  const tok = await makeShareToken(env, 10);
  assert.equal((await post2("/share/revoke", { id: "10", back: "/admin?view=lot&id=10" }, adminCookie)).status, 303);
  assert.equal((await get(`/v?t=${encodeURIComponent(tok)}`)).status, 404);

  // Regenerate re-opens it under a new nonce.
  assert.equal((await post2("/share/regenerate", { id: "10", back: "/admin?view=lot&id=10" }, adminCookie)).status, 303);
  q = await env.DB.prepare("SELECT share_nonce, share_revoked_at FROM queue WHERE id = 10").first();
  assert.ok(q.share_nonce);
  assert.equal(q.share_revoked_at, null);

  // An agent with no access to client 1 gets a benign redirect and no write.
  const agentCookie = (await sessionCookie(env, "agent", 7)).split(";")[0];
  const before = await env.DB.prepare("SELECT share_price_note FROM queue WHERE id = 10").first();
  const forbidden = await post2("/share/details", { id: "10", price_note: "HACKED", condition_notes: "x", back: "/admin?view=lot&id=10" }, agentCookie);
  assert.equal(forbidden.status, 303, "act() swallows the throw into a redirect");
  const after = await env.DB.prepare("SELECT share_price_note FROM queue WHERE id = 10").first();
  assert.equal(after.share_price_note, before.share_price_note, "a stranger agent must not overwrite the note");
});

test("revoke kills the link everywhere; regenerate issues a working replacement", async () => {
  const admin = { role: "admin", id: 0 };
  const oldTok = await makeShareToken(env, 10);
  await setShareRevoked(env, 10, true, admin);
  assert.equal((await get(`/v?t=${encodeURIComponent(oldTok)}`)).status, 404);
  assert.equal((await post("/v/interest", { t: oldTok })).status, 404);

  await regenerateShareLink(env, 10, admin);
  assert.equal((await get(`/v?t=${encodeURIComponent(oldTok)}`)).status, 404, "old token stays dead after regeneration");
  const { share_nonce } = await env.DB.prepare("SELECT share_nonce FROM queue WHERE id = 10").first();
  const newTok = await makeShareToken(env, 10, share_nonce);
  assert.equal((await get(`/v?t=${encodeURIComponent(newTok)}`)).status, 200);
});
