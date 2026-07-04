// IA-AUDIT item 12: match snooze. Skip is terminal and Approve sends now;
// staff were parking matches in Awaiting review as an improvised snooze,
// polluting the workload counts. Snooze (tomorrow, or 24h before the auction
// closes) hides a pending match from every pending surface until due, with a
// Snoozed filter so nothing can vanish irrecoverably.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { adminPage, snoozeMatch } from "../src/admin.js";

const ADMIN = { role: "admin", id: 0 };

function lotJson(daysOut) {
  const d = new Date(Date.now() + daysOut * 86400000).toISOString().replace("T", " ").slice(0, 19);
  return JSON.stringify({
    id: "L1", lot: "101", marka_name: "NISSAN", model_name: "SKYLINE", year: 1999,
    rate: "4", start: 1000000, mileage: 80000, auction: "USS Tokyo",
    auction_date: d, images: "", _strength: "Strong",
  });
}

function seed() {
  return `
    INSERT INTO clients (id, name, email) VALUES (1, 'Alice Apple', 'a@x.com');
    INSERT INTO wishlists (id, client_id, label, marka_name) VALUES (1, 1, 'R34 hunt', 'NISSAN');
    INSERT INTO queue (id, wishlist_id, client_id, lot_id, lot_json, status, token, created_at) VALUES
      (1, 1, 1, 'L1', '${lotJson(5)}', 'pending', 'tok1', datetime('now'));
  `;
}

test("snoozing hides the match from Matches and the dashboard until due", async () => {
  const env = makeEnv(seed());
  await snoozeMatch(env, 1, "1d", ADMIN);
  const matches = await adminPage(env, "matches", ADMIN);
  assert.doesNotMatch(matches, /data-qid="1"/, "the card leaves the review grid");
  assert.match(matches, /Snoozed \(1\)/, "a quiet filter chip says where it went");
  const dash = await adminPage(env, "dashboard", ADMIN);
  assert.match(dash, /<div class="ov-n">0<\/div>\s*<div class="ov-l">Matches to review<\/div>|Matches to review/, "dashboard renders");
});

test("the Snoozed filter lists it with a wake action, and waking restores it", async () => {
  const env = makeEnv(seed());
  await snoozeMatch(env, 1, "1d", ADMIN);
  const snoozed = await adminPage(env, "matches", ADMIN, { matchQuery: { f: "snoozed" } });
  assert.match(snoozed, /data-qid="1"/, "the snoozed list shows the card");
  assert.match(snoozed, /Wake now/, "a wake action is offered");
  await snoozeMatch(env, 1, "clear", ADMIN);
  const matches = await adminPage(env, "matches", ADMIN);
  assert.match(matches, /data-qid="1"/, "waking puts it straight back in review");
});

test("snooze to close wakes the match 24h before the auction", async () => {
  const env = makeEnv(seed());
  await snoozeMatch(env, 1, "close", ADMIN);
  const row = await env.DB.prepare("SELECT snoozed_until FROM queue WHERE id = 1").first();
  const wake = Date.parse(row.snoozed_until.replace(" ", "T") + "Z");
  const expected = Date.now() + 4 * 86400000; // closes in 5 days, wake at day 4
  assert.ok(Math.abs(wake - expected) < 3600000, `wake within an hour of T-24h (got ${row.snoozed_until})`);
});

test("an agent without access to the client cannot snooze", async () => {
  const env = makeEnv(seed());
  await assert.rejects(() => snoozeMatch(env, 1, "1d", { role: "agent", id: 99 }), "foreign agent is rejected");
  const row = await env.DB.prepare("SELECT snoozed_until FROM queue WHERE id = 1").first();
  assert.equal(row.snoozed_until, null, "nothing was written");
});

test("pending cards offer both snooze options", async () => {
  const env = makeEnv(seed());
  const html = await adminPage(env, "matches", ADMIN);
  assert.match(html, />Snooze</, "the quiet snooze disclosure renders");
  assert.match(html, /Tomorrow/, "revisit tomorrow");
  assert.match(html, /24h before close/, "the deadline-aware variant");
});
