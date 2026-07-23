// IA-AUDIT item 11: the send decision on lot detail is made on behalf of a
// client and their budget, so the client block moves from the bottom of the
// rail to directly under the landed figure, and gains the budget delta staff
// actually quote on the phone ("about A$10,000 under").
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { lotDetailPage } from "../src/admin.js";

const ADMIN = { role: "admin", id: 0 };

// avg_price 8,000,000 JPY with purchaseAUD A$80,000 -> implied 0.01 AUD per
// JPY, so a 1,000,000 JPY budget gap reads as about A$10,000.
const LOT = JSON.stringify({
  id: "L1", lot: "40123", marka_name: "NISSAN", model_name: "SKYLINE", year: 2000,
  rate: "4.5", start: 7500000, avg_price: 8000000, mileage: 62000, auction: "USS Tokyo",
  auction_date: "2027-12-20 10:00:00", images: "",
  _landed: { grandTotal: 109900, purchaseAUD: 80000, state: "VIC" },
});

// lotDetailPage signs a share token, which needs the ADMIN_TOKEN secret.
function envWith(sql) {
  return { ...makeEnv(sql), ADMIN_TOKEN: "test-secret" };
}

function seed(priceMaxSql) {
  return `
    INSERT INTO users (id, name, email) VALUES (1, 'Aiko Tanaka', 'a@x.com');
    INSERT INTO searches (id, client_id, label, marka_name${priceMaxSql ? ", price_max" : ""}) VALUES (1, 1, 'R34 GT-R', 'NISSAN'${priceMaxSql ? `, ${priceMaxSql}` : ""});
    INSERT INTO queue (id, wishlist_id, client_id, lot_id, lot_json, status, token, created_at) VALUES
      (1, 1, 1, 'L1', '${LOT}', 'pending', 'tok1', datetime('now'));
  `;
}

test("the client block sits under the landed figure, above actions and specs", async () => {
  const env = envWith(seed("9000000"));
  const html = await lotDetailPage(env, 1, ADMIN);
  const top = html.indexOf('class="ld-top"');
  const client = html.indexOf('class="ld-client"');
  const actions = html.indexOf('class="ld-actions"');
  const specs = html.indexOf('class="ld-rows"');
  assert.ok(top > -1 && client > -1 && actions > -1 && specs > -1, "all rail pieces render");
  assert.ok(top < client && client < actions && actions < specs, "price, client fit, action, then detail");
});

test("under budget: the delta line quotes the AUD gap", async () => {
  const env = envWith(seed("9000000"));
  const html = await lotDetailPage(env, 1, ADMIN);
  assert.match(html, /A\$109,900 landed vs ¥9,000,000 budget/, "landed vs budget");
  assert.match(html, /about A\$10,000 under/, "the phone-quote number");
});

test("over budget: the delta flips and reads as over", async () => {
  const env = envWith(seed("7000000"));
  const html = await lotDetailPage(env, 1, ADMIN);
  assert.match(html, /about A\$10,000 over/, "over-budget is stated, not hidden");
  assert.match(html, /class="ld-cl-b over"/, "the over state carries a warning tone");
});

test("no budget on the search: no delta line", async () => {
  const env = envWith(seed(""));
  const html = await lotDetailPage(env, 1, ADMIN);
  assert.doesNotMatch(html, /class="ld-cl-b/, "nothing invented when there is no budget");
});
