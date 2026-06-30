// Bulk delete from the Clients view: an admin ticks several clients and removes
// them in one go. It must cascade (matches, seen-lots, searches, shares, client),
// only touch the selected ids, and stay admin-only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { bulkAllocate } from "../src/admin.js";

const FIXTURE = `
  INSERT INTO agents (id,email,name,pass_salt,pass_hash) VALUES (1,'a1@x','A1','','');
  INSERT INTO clients (id,name,email) VALUES (10,'Doomed One','d1@x'),(20,'Doomed Two','d2@x'),(30,'Survivor','s@x');
  INSERT INTO wishlists (id,client_id,label) VALUES (100,10,'w10'),(200,20,'w20'),(300,30,'w30');
  INSERT INTO seen_lots (wishlist_id,lot_id) VALUES (100,'L1'),(200,'L2'),(300,'L3');
  INSERT INTO queue (id,wishlist_id,client_id,lot_id,lot_json,token) VALUES
    (1,100,10,'L1','{}','t1'),(2,200,20,'L2','{}','t2'),(3,300,30,'L3','{}','t3');
  INSERT INTO client_shares (client_id,agent_id) VALUES (10,1),(30,1);
`;

const ADMIN = { role: "admin", id: 0 };

async function counts(env) {
  const one = async (sql) => (await env.DB.prepare(sql).first())?.n || 0;
  return {
    clients: await one("SELECT COUNT(*) AS n FROM clients"),
    wishlists: await one("SELECT COUNT(*) AS n FROM wishlists"),
    queue: await one("SELECT COUNT(*) AS n FROM queue"),
    seen: await one("SELECT COUNT(*) AS n FROM seen_lots"),
    shares: await one("SELECT COUNT(*) AS n FROM client_shares"),
  };
}

test("bulk delete removes selected clients and all their dependent rows", async () => {
  const env = makeEnv(FIXTURE);
  await bulkAllocate(env, "delete", "", ["10", "20"], ADMIN);
  const c = await counts(env);
  assert.deepEqual(c, { clients: 1, wishlists: 1, queue: 1, seen: 1, shares: 1 },
    "only the Survivor (30) and its rows remain");
  const survivor = await env.DB.prepare("SELECT id FROM clients").all();
  assert.deepEqual(survivor.results.map((r) => r.id), [30]);
});

test("bulk delete leaves un-selected clients untouched", async () => {
  const env = makeEnv(FIXTURE);
  await bulkAllocate(env, "delete", "", ["10"], ADMIN);
  assert.ok(await env.DB.prepare("SELECT id FROM clients WHERE id = 20").first(), "20 survives");
  assert.ok(await env.DB.prepare("SELECT id FROM clients WHERE id = 30").first(), "30 survives");
  assert.ok(!(await env.DB.prepare("SELECT id FROM clients WHERE id = 10").first()), "10 is gone");
});

test("bulk delete is admin-only - an agent cannot delete clients", async () => {
  const env = makeEnv(FIXTURE);
  await bulkAllocate(env, "delete", "", ["10", "20", "30"], { role: "agent", id: 1 });
  const c = await counts(env);
  assert.equal(c.clients, 3, "nothing deleted for a non-admin");
});

test("bulk delete with no ids is a safe no-op", async () => {
  const env = makeEnv(FIXTURE);
  await bulkAllocate(env, "delete", "", [], ADMIN);
  assert.equal((await env.DB.prepare("SELECT COUNT(*) AS n FROM clients").first()).n, 3);
});
