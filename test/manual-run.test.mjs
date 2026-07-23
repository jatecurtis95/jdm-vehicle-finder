// Phase 5: per-search manual trigger. runOneWishlist runs ONE saved search on
// demand, reusing the matcher. It is ownership-scoped (a member can only run
// their own searches), refuses watch_only bookmarks, and ignores inactive rows.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { runOneWishlist } from "../src/matcher.js";

const LOT = {
  id: "L200", marka_name: "NISSAN", model_name: "SKYLINE", year: 1999,
  kuzov: "BNR34", start: 4000000, avg_price: 0, mileage: 60000, rate: "4.5",
  auction_date: "2099-01-01T00:00:00",
};

function stubFeed(lots) {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true, status: 200,
    text: async () => `<aj>${lots.map((l) => `<row>${Object.entries(l).map(([k, v]) => `<${k}>${v}</${k}>`).join("")}</row>`).join("")}</aj>`,
  });
  return () => { globalThis.fetch = orig; };
}

function seed(env) {
  env.db.exec(`
    INSERT INTO settings (key, value) VALUES ('budget_filter', '0');
    INSERT INTO users (id, name, email, state) VALUES (1, 'Buyer', 'b@x.com', 'VIC');
    INSERT INTO users (id, name, email, state) VALUES (2, 'Other', 'o@x.com', 'VIC');
    INSERT INTO searches (id, client_id, marka_name, model_name, active)
      VALUES (10, 1, 'NISSAN', 'SKYLINE', 1);
    INSERT INTO searches (id, client_id, marka_name, model_name, active, watch_only)
      VALUES (11, 1, 'NISSAN', 'SKYLINE', 1, 1);
    INSERT INTO searches (id, client_id, marka_name, model_name, active)
      VALUES (12, 1, 'TOYOTA', 'SUPRA', 0);
  `);
}

test("staff run of one search queues its fresh matches", async () => {
  const env = makeEnv();
  seed(env);
  const restore = stubFeed([LOT]);
  try {
    const r = await runOneWishlist(env, 10);
    assert.equal(r.ok, true);
    assert.equal(r.queued, 1, "the fresh lot is queued");
    assert.equal(env.db.prepare("SELECT COUNT(*) AS n FROM queue WHERE wishlist_id = 10").get().n, 1);
  } finally { restore(); }
});

test("re-running the same search queues nothing the second time", async () => {
  const env = makeEnv();
  seed(env);
  const restore = stubFeed([LOT]);
  try {
    await runOneWishlist(env, 10);
    const r2 = await runOneWishlist(env, 10);
    assert.equal(r2.queued, 0, "already-seen lot is not re-queued");
  } finally { restore(); }
});

test("member run is scoped to their own searches", async () => {
  const env = makeEnv();
  seed(env);
  const restore = stubFeed([LOT]);
  try {
    const foreign = await runOneWishlist(env, 10, { ownerClientId: 2 });
    assert.equal(foreign.ok, false);
    assert.equal(foreign.notFound, true);
    assert.equal(env.db.prepare("SELECT COUNT(*) AS n FROM queue").get().n, 0, "a foreign search runs nothing");
    const own = await runOneWishlist(env, 10, { ownerClientId: 1 });
    assert.equal(own.ok, true);
    assert.equal(own.queued, 1, "the owner can run it");
  } finally { restore(); }
});

test("a watch_only bookmark is refused, not run as a search", async () => {
  const env = makeEnv();
  seed(env);
  const restore = stubFeed([LOT]);
  try {
    const r = await runOneWishlist(env, 11);
    assert.equal(r.ok, false);
    assert.equal(r.watchOnly, true);
    assert.equal(env.db.prepare("SELECT COUNT(*) AS n FROM queue").get().n, 0);
  } finally { restore(); }
});

test("an inactive search is not run", async () => {
  const env = makeEnv();
  seed(env);
  const restore = stubFeed([LOT]);
  try {
    const r = await runOneWishlist(env, 12);
    assert.equal(r.ok, false);
    assert.equal(r.notFound, true, "active = 0 is excluded by the WHERE clause");
  } finally { restore(); }
});
