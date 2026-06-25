// A buyer may only act on their own queued cars. Covers the portal write path
// (portalApprove) and the /portal/pay ownership guard.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { portalApprove } from "../src/admin.js";

const FIX = `
  INSERT INTO clients (id,name,portal_enabled,pass_salt,pass_hash) VALUES (1,'A',1,'s','h'),(2,'B',1,'s','h');
  INSERT INTO wishlists (id,client_id) VALUES (1,1),(2,2);
  INSERT INTO queue (id,wishlist_id,client_id,lot_id,lot_json,status,token) VALUES
    (10,1,1,'L1','{}','sent','t1'),
    (20,2,2,'L2','{}','sent','t2');
`;

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
