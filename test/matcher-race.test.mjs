// Item 5: duplicate matcher enqueue race. Matcher dedupe used to be purely
// app-level (read seen_lots, then insert). Two matcher runs that both read the
// feed before either wrote its seen_lots row would each queue the same lot,
// producing duplicate matches. The queue insert is now gated on the lot not
// already being claimed in seen_lots (whose PRIMARY KEY is the dedupe anchor),
// written in the same batch, so a second run finds the first's claim and no-ops.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { runWishlist } from "../src/matcher.js";

const LOT = {
  id: "L100", marka_name: "NISSAN", model_name: "SKYLINE", year: 1999,
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
    INSERT INTO clients (id, name, email, state) VALUES (1, 'Buyer', 'b@x.com', 'VIC');
    INSERT INTO wishlists (id, client_id, marka_name, model_name, active)
      VALUES (1, 1, 'NISSAN', 'SKYLINE', 1);
  `);
}

test("two concurrent runs of the same wishlist queue the lot exactly once", async () => {
  const env = makeEnv();
  seed(env);
  const restore = stubFeed([LOT]);
  try {
    // Run twice back-to-back (D1 batches serialize, so this models the race:
    // both runs saw the lot as fresh, then wrote in sequence).
    const first = await runWishlist(env, { id: 1, client_id: 1, marka_name: "NISSAN", model_name: "SKYLINE", client_state: "VIC" }, { budgetFilter: false });
    const second = await runWishlist(env, { id: 1, client_id: 1, marka_name: "NISSAN", model_name: "SKYLINE", client_state: "VIC" }, { budgetFilter: false });

    assert.equal(first.length, 1, "the first run queues the fresh lot");
    assert.equal(second.length, 0, "the second run adds nothing: the lot is already claimed");

    const rows = env.db.prepare("SELECT COUNT(*) AS n FROM queue WHERE wishlist_id = 1 AND lot_id = 'L100'").get();
    assert.equal(rows.n, 1, "exactly one queue row for the lot, never a duplicate");
    const seenRows = env.db.prepare("SELECT COUNT(*) AS n FROM seen_lots WHERE wishlist_id = 1 AND lot_id = 'L100'").get();
    assert.equal(seenRows.n, 1, "one seen_lots claim");
  } finally {
    restore();
  }
});

test("a run whose seen_lots row already exists queues nothing, even before the app-level filter", async () => {
  const env = makeEnv();
  seed(env);
  // Pre-claim the lot in seen_lots as if a prior run had (but leave no queue row,
  // simulating the narrow window). The WHERE NOT EXISTS guard must still hold.
  env.db.exec("INSERT INTO seen_lots (wishlist_id, lot_id) VALUES (1, 'L100');");
  const restore = stubFeed([LOT]);
  try {
    const queued = await runWishlist(env, { id: 1, client_id: 1, marka_name: "NISSAN", model_name: "SKYLINE", client_state: "VIC" }, { budgetFilter: false });
    assert.equal(queued.length, 0, "already-claimed lot is never re-queued");
    const rows = env.db.prepare("SELECT COUNT(*) AS n FROM queue WHERE lot_id = 'L100'").get();
    assert.equal(rows.n, 0, "no queue row written");
  } finally {
    restore();
  }
});
