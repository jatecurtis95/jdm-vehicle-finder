// A buyer may only act on their own data. Covers the portal write paths
// (portalApprove, wishlist edit/toggle/delete) and the /portal/pay ownership
// guard - one customer must never be able to read or change another's records.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { portalApprove, portalEditWishlist, portalToggleWishlist, portalDeleteWishlist } from "../src/admin.js";

const FIX = `
  INSERT INTO users (id,name,portal_enabled,pass_salt,pass_hash) VALUES (1,'A',1,'s','h'),(2,'B',1,'s','h');
  INSERT INTO searches (id,client_id,marka_name) VALUES (1,1,'TOYOTA'),(2,2,'NISSAN');
  INSERT INTO queue (id,wishlist_id,client_id,lot_id,lot_json,status,token) VALUES
    (10,1,1,'L1','{}','sent','t1'),
    (20,2,2,'L2','{}','sent','t2');
`;

function fd(obj) {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
}

test("a client cannot approve another client's queued car", async () => {
  const env = makeEnv(FIX);
  const r = await portalApprove(env, 10, { role: "client", id: 2 });
  assert.equal(r.ok, false, "client 2 must not action client 1's queue item");
});

test("a client can approve their own queued car", async () => {
  const env = makeEnv(FIX);
  const r = await portalApprove(env, 10, { role: "client", id: 1 });
  assert.equal(r.ok, true);
});

test("the /portal/pay ownership guard rejects a foreign queue_id", async () => {
  const env = makeEnv(FIX);
  // Mirrors the guard added in startDepositCheckout (src/index.js).
  const owns = (qid, cid) => env.DB.prepare("SELECT 1 FROM queue WHERE id = ? AND client_id = ?").bind(qid, cid).first();
  assert.equal(owns(10, 2), null, "client 2 does not own queue 10");
  assert.ok(owns(10, 1), "client 1 owns queue 10");
});

test("a client cannot edit another client's saved search", async () => {
  const env = makeEnv(FIX);
  const r = await portalEditWishlist(env, fd({ id: "1", marka_name: "MAZDA" }), { role: "client", id: 2 });
  assert.ok(!r || !r.ok, "the foreign edit is refused");
  assert.equal(env.db.prepare("SELECT marka_name FROM searches WHERE id = 1").get().marka_name, "TOYOTA", "client 1's search is untouched");
});

test("a client cannot pause or delete another client's saved search", async () => {
  const env = makeEnv(FIX);
  await portalToggleWishlist(env, fd({ id: "1" }), { role: "client", id: 2 });
  assert.equal(env.db.prepare("SELECT active FROM searches WHERE id = 1").get().active, 1, "still active");
  await portalDeleteWishlist(env, fd({ id: "1" }), { role: "client", id: 2 });
  assert.ok(env.db.prepare("SELECT 1 FROM searches WHERE id = 1").get(), "still exists");
  // And the owner still can: the guard blocks strangers, not the owner.
  await portalDeleteWishlist(env, fd({ id: "1" }), { role: "client", id: 1 });
  assert.equal(env.db.prepare("SELECT 1 FROM searches WHERE id = 1").get(), undefined, "owner delete works");
});
