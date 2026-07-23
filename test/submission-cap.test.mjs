// Phase 6 guardrail (Ben Site Notes): a per-tier daily cap on member-submitted
// car requests, so a self-serve tier cannot flood the review queue. Managed
// customers stay uncapped.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { requestDailyCap, requestsToday } from "../src/index.js";
import { getSettings } from "../src/settings.js";

test("requestDailyCap: fully_managed is uncapped, other tiers are bounded", () => {
  const s = { cap_paid_daily: "10", cap_free_daily: "1" };
  assert.equal(requestDailyCap(s, "fully_managed"), Infinity, "managed customers are never capped");
  assert.equal(requestDailyCap(s, "paid_access"), 10);
  assert.equal(requestDailyCap(s, "free"), 1);
  assert.equal(requestDailyCap(s, "unknown"), 1, "an unknown tier falls back to the strict free cap");
});

test("requestDailyCap: staff can tune the caps via settings, with sane defaults", () => {
  assert.equal(requestDailyCap({ cap_paid_daily: "3" }, "paid_access"), 3);
  assert.equal(requestDailyCap({ cap_free_daily: "2" }, "free"), 2);
  assert.equal(requestDailyCap({}, "paid_access"), 10, "default when unset");
  assert.equal(requestDailyCap({}, "free"), 1, "default when unset");
});

test("requestsToday counts only today's client-submitted requests for that client", async () => {
  const env = makeEnv(`
    INSERT INTO users (id, name, email, portal_enabled, member, tier) VALUES
      (1,'Paid Pat','p@x',1,1,'paid_access'),
      (2,'Other Ollie','o@x',1,1,'paid_access');
    INSERT INTO searches (id, client_id, label) VALUES (1,1,'w'),(2,2,'w');
    INSERT INTO queue (id,wishlist_id,client_id,lot_id,lot_json,token,client_request,created_at) VALUES
      (1,1,1,'L1','{}','t1',1,datetime('now')),
      (2,1,1,'L2','{}','t2',1,datetime('now')),
      (3,1,1,'L3','{}','t3',1,datetime('now','-2 days')),
      (4,1,1,'L4','{}','t4',0,datetime('now')),
      (5,2,2,'L5','{}','t5',1,datetime('now'));
  `);
  assert.equal(await requestsToday(env, 1), 2, "two submitted today, not the older one or the staff-found one");
  assert.equal(await requestsToday(env, 2), 1, "scoped to the client");
  assert.equal(await requestsToday(env, 999), 0, "no rows for an unknown client");
});

test("getSettings surfaces the cap defaults so they are live-tunable", async () => {
  const env = makeEnv();
  const s = await getSettings(env);
  assert.equal(requestDailyCap(s, "paid_access"), 10);
  assert.equal(requestDailyCap(s, "free"), 1);
});
