// Staff "Find a car for this client": addLotToClient files a found lot as a
// pending match in a per-client "Manual finds" search, deduped, access-checked.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { addLotToClient, clientDetailPage } from "../src/admin.js";

const FIXTURE = `
  INSERT INTO agents (id,email,name,pass_salt,pass_hash) VALUES (1,'a1@x','A1','',''),(2,'a2@x','A2','','');
  INSERT INTO clients (id,name,email,state,agent_id) VALUES (10,'Direct','d@x','VIC',NULL),(20,'Owned by A2','o@x','NSW',2);
`;
const ADMIN = { role: "admin", id: 0 };

// Make fetchLot (and the landed-cost calc) resolve to a fixed lot, no network.
function stubFeed(lotId = "L9") {
  globalThis.fetch = async () => ({
    ok: true, status: 200,
    text: async () => `<aj><row><id>${lotId}</id><marka_name>NISSAN</marka_name><model_name>SKYLINE</model_name><year>1999</year><lot>123</lot><auction_date>2099-01-01T00:00:00</auction_date><start>1500000</start></row></aj>`,
  });
}

test("addLotToClient files a pending match in a watch_only=0 'Manual finds' search", async () => {
  const env = makeEnv(FIXTURE); stubFeed("L9");
  const r = await addLotToClient(env, 10, "L9", ADMIN);
  assert.equal(r.ok, true);
  assert.ok(!r.already);
  const wl = await env.DB.prepare("SELECT * FROM wishlists WHERE client_id = 10").first();
  assert.equal(wl.label, "Manual finds");
  assert.equal(wl.watch_only, 0, "approving must email the client, like a normal match");
  const q = await env.DB.prepare("SELECT * FROM queue WHERE client_id = 10").first();
  assert.equal(q.status, "pending");
  assert.equal(q.lot_id, "L9");
  assert.match(q.reason, /staff/i);
  const seen = await env.DB.prepare("SELECT COUNT(*) AS n FROM seen_lots WHERE wishlist_id = ?").bind(wl.id).first();
  assert.equal(seen.n, 1);
});

test("adding the same lot twice is a no-op (deduped)", async () => {
  const env = makeEnv(FIXTURE); stubFeed("L9");
  await addLotToClient(env, 10, "L9", ADMIN);
  const r2 = await addLotToClient(env, 10, "L9", ADMIN);
  assert.equal(r2.already, true);
  const n = (await env.DB.prepare("SELECT COUNT(*) AS n FROM queue WHERE client_id = 10").first()).n;
  assert.equal(n, 1, "still only one queued row");
});

test("an agent cannot add a lot to a client they don't own", async () => {
  const env = makeEnv(FIXTURE); stubFeed("L9");
  const r = await addLotToClient(env, 10, "L9", { role: "agent", id: 1 });
  assert.equal(r.ok, false);
  assert.equal(r.error, "forbidden");
  const n = (await env.DB.prepare("SELECT COUNT(*) AS n FROM queue WHERE client_id = 10").first()).n;
  assert.equal(n, 0);
});

test("an agent can add a lot to their own client", async () => {
  const env = makeEnv(FIXTURE); stubFeed("L9");
  const r = await addLotToClient(env, 20, "L9", { role: "agent", id: 2 });
  assert.equal(r.ok, true);
  const n = (await env.DB.prepare("SELECT COUNT(*) AS n FROM queue WHERE client_id = 20").first()).n;
  assert.equal(n, 1);
});

test("client page shows the Find-a-car search and hides internal catch-all searches", async () => {
  const env = makeEnv(FIXTURE); stubFeed();
  await env.DB.prepare("INSERT INTO wishlists (client_id,label) VALUES (10,'Manual finds')").run();
  await env.DB.prepare("INSERT INTO wishlists (client_id,label,marka_name) VALUES (10,'Daily driver','TOYOTA')").run();
  const html = await clientDetailPage(env, 10, ADMIN, { search: {} });
  assert.match(html, /Find a car for/);
  assert.match(html, /Search auctions/);
  assert.match(html, /Daily driver/);                 // real search is listed
  assert.doesNotMatch(html, /Manual finds/);          // internal search is hidden
});

test("a lot that can't be fetched returns not_found, queues nothing", async () => {
  const env = makeEnv(FIXTURE);
  globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => `<aj></aj>` });
  const r = await addLotToClient(env, 10, "NOPE", ADMIN);
  assert.equal(r.ok, false);
  assert.equal(r.error, "not_found");
  const n = (await env.DB.prepare("SELECT COUNT(*) AS n FROM queue").first()).n;
  assert.equal(n, 0);
});
