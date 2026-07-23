// A production database can lag the code by a migration (they are applied
// manually, with approval). The customer-facing flows must degrade gracefully
// rather than throw a raw Worker exception (Cloudflare 1101), which is exactly
// what happened to the first real portal signup: POST /set-password crashed on
// the missing session_ver column from migration 0010.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { repoRoot } from "./helpers/d1.mjs";
import worker from "../src/index.js";
import { toggleAgent, revokeClientPortal } from "../src/admin.js";

class D1Stmt {
  constructor(db, sql, params) { this.db = db; this.sql = sql; this.params = params || []; }
  bind(...args) { return new D1Stmt(this.db, this.sql, args); }
  first() { const row = this.db.prepare(this.sql).get(...this.params); return row === undefined ? null : row; }
  all() { return { results: this.db.prepare(this.sql).all(...this.params) }; }
  run() { const info = this.db.prepare(this.sql).run(...this.params); return { meta: { last_row_id: Number(info.lastInsertRowid), changes: info.changes } }; }
}
class D1 { constructor(db) { this._db = db; } prepare(sql) { return new D1Stmt(this._db, sql); } batch(s) { return s.map((x) => x.run()); } }

// An env whose schema stops BEFORE migration 0010 (no last_seen/session_ver).
function envWithout0010(extraSql) {
  const db = new DatabaseSync(":memory:");
  const files = readdirSync(resolve(repoRoot, "migrations"))
    .filter((f) => /^\d+.*\.sql$/.test(f) && !f.startsWith("0010")).sort();
  for (const f of files) db.exec(readFileSync(resolve(repoRoot, "migrations", f), "utf8"));
  if (extraSql) db.exec(extraSql);
  return { DB: new D1(db), db, ADMIN_TOKEN: "test-admin-token" };
}

const CTX = { waitUntil() {} };
const postForm = (path, fields) => new Request("https://jdmfinder.com.au" + path, {
  method: "POST", body: new URLSearchParams(fields),
});

test("a customer can set their portal password even when migration 0010 is missing", async () => {
  const env = envWithout0010(`
    INSERT INTO users (id, name, email, portal_enabled, invite_token, invite_exp)
    VALUES (1, 'Ahtesham Khan', 'a@x.com', 1, 'tok123', ${Date.now() + 86400000});
  `);
  const res = await worker.fetch(postForm("/set-password", { token: "tok123", password: "supersecret123", confirm: "supersecret123" }), env, CTX);
  assert.equal(res.status, 303, "signs the customer straight in");
  assert.match(res.headers.get("Location") || "", /\/portal/);
  const c = await env.DB.prepare("SELECT pass_hash, invite_token FROM users WHERE id = 1").first();
  assert.ok(c.pass_hash, "password stored");
  assert.equal(c.invite_token, null, "single-use token consumed");
});

test("agent set-password also survives the missing column", async () => {
  const env = envWithout0010(`
    INSERT INTO users (id, name, email, pass_salt, pass_hash, invite_token, invite_exp, type) VALUES (1, 'Agent A', 'ag@x.com', '', '', 'atok', ${Date.now() + 86400000}, 'agent');
  `);
  const res = await worker.fetch(postForm("/set-password", { token: "atok", password: "supersecret123", confirm: "supersecret123" }), env, CTX);
  assert.equal(res.status, 303);
  const a = await env.DB.prepare("SELECT pass_hash FROM users WHERE id = 1").first();
  assert.ok(a.pass_hash, "password stored");
});

test("agent toggle and portal revoke degrade to the legacy update, not a throw", async () => {
  const env = envWithout0010(`
    INSERT INTO users (id, name, email, pass_salt, pass_hash, active, type) VALUES (1, 'A', 'a@x', 's', 'h', 1, 'agent');
    INSERT INTO users (id, name, email, portal_enabled, pass_hash, pass_salt) VALUES (2, 'C', 'c@x', 1, 'h', 's');
  `);
  await toggleAgent(env, 1);
  assert.equal((await env.DB.prepare("SELECT active FROM users WHERE id = 1").first()).active, 0, "agent paused");
  await revokeClientPortal(env, 2, { role: "admin", id: 0 });
  const c = await env.DB.prepare("SELECT portal_enabled, portal_revoked, pass_hash FROM users WHERE id = 2").first();
  assert.equal(c.portal_enabled, 0, "portal revoked");
  assert.equal(c.portal_revoked, 1, "revoke veto set");
  assert.equal(c.pass_hash, null, "password cleared");
});

test("any unexpected throw in POST /set-password renders the branded page, never a 1101", async () => {
  const env = envWithout0010(`
    INSERT INTO users (id, name, email, portal_enabled, invite_token, invite_exp)
    VALUES (1, 'Ahtesham Khan', 'a@x.com', 1, 'tok123', ${Date.now() + 86400000});
  `);
  // Sabotage the DB mid-flow so setClientPassword throws something unrelated
  // to schema drift: the route containment must still answer with HTML.
  const realPrepare = env.DB.prepare.bind(env.DB);
  env.DB.prepare = (sql) => {
    if (/UPDATE users SET pass_salt/.test(sql)) throw new Error("simulated D1 outage");
    return realPrepare(sql);
  };
  const res = await worker.fetch(postForm("/set-password", { token: "tok123", password: "supersecret123", confirm: "supersecret123" }), env, CTX);
  assert.equal(res.status, 500);
  const html = await res.text();
  assert.match(html, /Set your password/, "branded page, not a raw error");
  assert.match(html, /something went wrong on our side/);
});
