// IA-AUDIT item 13: send-pacing decisions were blind. The Matches group
// header now carries "sent N this week (M opened), last Xd ago" per client,
// and the client page's Live matches card gets the same strip - over-sending
// in the same week is the fastest way to train buyers to ignore emails.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { adminPage, clientDetailPage } from "../src/admin.js";

const ADMIN = { role: "admin", id: 0 };

function lotJson(strength) {
  const d = new Date(Date.now() + 5 * 86400000).toISOString().replace("T", " ").slice(0, 19);
  return JSON.stringify({
    id: "LX", lot: "101", marka_name: "NISSAN", model_name: "SKYLINE", year: 1999,
    rate: "4", start: 1000000, mileage: 80000, auction: "USS Tokyo",
    auction_date: d, images: "", _strength: strength || "Strong",
  });
}

// Alice: 1 pending match + 2 sent this week (1 opened, 1 interested).
// Bob: 1 pending match, last send 20 days ago (outside the pacing window).
function seed() {
  return `
    INSERT INTO users (id, name, email) VALUES (1, 'Alice Apple', 'a@x.com'), (2, 'Bob Banana', 'b@x.com');
    INSERT INTO searches (id, client_id, label, marka_name) VALUES (1, 1, 'R34 hunt', 'NISSAN'), (2, 2, 'Supra hunt', 'TOYOTA');
    INSERT INTO queue (id, wishlist_id, client_id, lot_id, lot_json, status, token, created_at, sent_at, viewed_at, response) VALUES
      (1, 1, 1, 'L1', '${lotJson()}', 'pending', 't1', datetime('now'), NULL, NULL, NULL),
      (2, 1, 1, 'L2', '${lotJson()}', 'sent', 't2', datetime('now','-2 days'), datetime('now','-2 days'), datetime('now','-1 day'), 'interested'),
      (3, 1, 1, 'L3', '${lotJson()}', 'sent', 't3', datetime('now','-2 days'), datetime('now','-2 days'), NULL, NULL),
      (4, 2, 2, 'L4', '${lotJson()}', 'pending', 't4', datetime('now'), NULL, NULL, NULL),
      (5, 2, 2, 'L5', '${lotJson()}', 'sent', 't5', datetime('now','-20 days'), datetime('now','-20 days'), NULL, NULL);
  `;
}

test("the Matches group header carries send recency per client", async () => {
  const env = makeEnv(seed());
  const html = await adminPage(env, "matches", ADMIN);
  const alice = html.slice(html.indexOf("Alice Apple"), html.indexOf('data-cards="1"'));
  assert.match(alice, /sent 2 this week \(1 opened\), last 2d ago/, "the pacing read is in the header sub-line");
  const bob = html.slice(html.indexOf("Bob Banana"), html.indexOf('data-cards="2"'));
  assert.match(bob, /nothing sent this week/, "a quiet green light when the week is clear");
});

test("the client page's matches card gets the pacing strip", async () => {
  const env = makeEnv(seed());
  const html = await clientDetailPage(env, 1, ADMIN);
  assert.match(html, /class="help sentpace"[^>]*>2 sent this week &middot; 1 opened &middot; 1 interested/, "the strip renders above the grid");
});

test("no strip when nothing went out this week", async () => {
  const env = makeEnv(seed());
  const html = await clientDetailPage(env, 2, ADMIN);
  assert.doesNotMatch(html, /class="help sentpace"/, "no noise for a quiet week");
});
