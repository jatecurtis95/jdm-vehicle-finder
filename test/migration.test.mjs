// The baseline migration must apply cleanly and include the columns the live
// code reads (the old schema.sql was missing some), and the dev seed must load.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv, readFile } from "./helpers/d1.mjs";

function tableNames(db) {
  return db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
}
function columns(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((r) => r.name);
}

test("baseline creates every core table", () => {
  const { db } = makeEnv();
  const names = tableNames(db);
  for (const t of ["users", "client_shares", "searches", "suppliers", "seen_lots", "queue", "settings", "payments"]) {
    assert.ok(names.includes(t), `missing table: ${t}`);
  }
});

test("baseline includes columns the code depends on that schema.sql had missed", () => {
  const { db } = makeEnv();
  assert.ok(columns(db, "users").includes("company"), "users.company");
  assert.ok(columns(db, "queue").includes("reason"), "queue.reason");
  assert.ok(columns(db, "users").includes("portal_enabled"), "users.portal_enabled");
  assert.ok(columns(db, "searches").includes("needs_detail"), "searches.needs_detail");
});

test("the dev seed loads on top of the baseline and creates the demo logins", () => {
  const env = makeEnv(readFile("seed/seed-dev.sql"));
  const agent = env.DB.prepare("SELECT name FROM users WHERE email = ?").bind("demo.agent@example.com").first();
  assert.equal(agent.name, "Demo Agent");
  const buyer = env.DB.prepare("SELECT portal_enabled FROM users WHERE email = ?").bind("demo.buyer@example.com").first();
  assert.equal(buyer.portal_enabled, 1, "demo buyer has the portal enabled");
  const sent = env.DB.prepare("SELECT COUNT(*) AS n FROM queue WHERE status = 'sent'").first();
  assert.ok(sent.n >= 2, "seed delivers at least two cars to the portal buyer");
});
