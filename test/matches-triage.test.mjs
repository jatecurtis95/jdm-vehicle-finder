// The reorganised Matches view: server-side triage defaults (Strong + Good,
// closing soonest), group-by-client with whole-group counts and send-all,
// paging via ?shown= and the /admin/matches/chunk fragment, and the
// stale-Possible skip tooling. All state lives in the URL so it survives a
// round trip to lot detail.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { adminPage, matchesChunk } from "../src/admin.js";

const ADMIN = { role: "admin", id: 0 };

// One pending queue row. Auction dates are exact offsets from now (not a
// calendar day at a fixed hour), so daysUntil() rounds the same way at any
// time of day and the tests never go flaky near midnight.
function lotJson(id, strength, daysOut) {
  const d = new Date(Date.now() + daysOut * 86400000).toISOString().replace("T", " ").slice(0, 19);
  return JSON.stringify({
    id, lot: "1" + id, marka_name: "NISSAN", model_name: "SKYLINE", year: 1999,
    rate: "4", start: 1000000, mileage: 80000, auction: "USS Tokyo",
    auction_date: d, images: "", _strength: strength,
  });
}

function seed({ possAgeDays = 0 } = {}) {
  const rows = [];
  let qid = 1;
  const add = (cid, strength, daysOut, createdAgo = 0) => {
    rows.push(`(${qid}, ${cid}, ${cid}, 'L${qid}', '${lotJson("L" + qid, strength, daysOut)}', 'pending', 'tok${qid}', datetime('now', '-${createdAgo} days'))`);
    qid++;
  };
  // Client 1: one Strong closing tomorrow, one Good in 3 days.
  add(1, "Strong", 1);
  add(1, "Good", 3);
  // Client 2: one Good closing today, one Possible (old).
  add(2, "Good", 0);
  add(2, "Possible", 5, possAgeDays);
  return `
    INSERT INTO users (id, name, email) VALUES (1, 'Alice Apple', 'a@x.com'), (2, 'Bob Banana', 'b@x.com');
    INSERT INTO searches (id, client_id, label, marka_name) VALUES (1, 1, 'R34 hunt', 'NISSAN'), (2, 2, 'Supra hunt', 'TOYOTA');
    INSERT INTO queue (id, wishlist_id, client_id, lot_id, lot_json, status, token, created_at) VALUES ${rows.join(",")};
  `;
}

test("Matches defaults to Strong + Good closing soonest, with the Possible-hidden banner", async () => {
  const env = makeEnv(seed());
  const html = await adminPage(env, "matches", ADMIN);
  // Banner announces the default filter and offers Show all.
  assert.match(html, /Showing 3 Strong and Good matches/, "banner with the filtered count");
  assert.match(html, /1 Possible hidden/, "banner says how many are hidden");
  assert.match(html, /f=all/, "a one-tap Show all link");
  // The Possible card is not rendered; Strong and Good are.
  assert.ok(!html.includes('data-qid="4"'), "Possible card hidden by default");
  assert.ok(html.includes('data-qid="1"') && html.includes('data-qid="3"'), "Strong and Good cards render");
});

test("Matches groups by client by default with whole-group counts, summary and send-all", async () => {
  const env = makeEnv(seed());
  const html = await adminPage(env, "matches", ADMIN);
  assert.match(html, /data-group="client"/, "grouped by client by default");
  // Bob's group closes today (0 days) so it sorts first.
  const bob = html.indexOf("Bob Banana"), alice = html.indexOf("Alice Apple");
  assert.ok(bob >= 0 && alice >= 0 && bob < alice, "soonest-closing group first");
  // Whole-group count and per-group send-all with the exact count + first name.
  assert.match(html, /Send all 2 to Alice/, "send-all with the group count");
  assert.match(html, /class="gh-count" data-n="2"/, "count attr for in-place updates");
  // Summary strip: strength breakdown + closes-from.
  assert.match(html, /1 Strong, 1 Good/, "group strength summary");
  assert.match(html, /closes today|closes tomorrow/, "group closing summary");
});

test("filter, grouping and page size live in the URL query", async () => {
  const env = makeEnv(seed());
  const flat = await adminPage(env, "matches", ADMIN, { matchQuery: { f: "all", group: "none" } });
  assert.match(flat, /data-group="none"/, "flat list honoured");
  assert.ok(flat.includes('data-qid="4"'), "f=all shows the Possible card");
  const poss = await adminPage(env, "matches", ADMIN, { matchQuery: { f: "poss" } });
  assert.ok(poss.includes('data-qid="4"') && !poss.includes('data-qid="1"'), "f=poss shows only Possible");
  const soon = await adminPage(env, "matches", ADMIN, { matchQuery: { f: "all", soon: "1", group: "none" } });
  assert.ok(soon.includes('data-qid="3"') && !soon.includes('data-qid="2"'), "soon=1 keeps only lots closing within 48h");
});

test("paging renders only ?shown= cards and the chunk endpoint serves the rest in order", async () => {
  const env = makeEnv(seed());
  const paged = await adminPage(env, "matches", ADMIN, { matchQuery: { f: "all", group: "none", shown: "2" } });
  const cardCount = (paged.match(/class="mcard scard"/g) || []).length;
  assert.equal(cardCount, 2, "only the first page of cards renders");
  assert.match(paged, /Load 2 more \(2 left\)/, "load-more announces the remainder");
  // Group headers still render with accurate counts even when unpaged.
  const grouped = await adminPage(env, "matches", ADMIN, { matchQuery: { f: "all", shown: "1" } });
  assert.match(grouped, /Send all 2 to Bob/, "group header counts include unloaded cards");
  // Chunk continues the same order (flat, f=all: sorted closing soonest).
  const chunk = await matchesChunk(env, ADMIN, { f: "all", group: "none", offset: "2" });
  const chunkCards = (chunk.match(/class="mcard scard"/g) || []).length;
  assert.equal(chunkCards, 2, "chunk returns the remaining cards");
  assert.ok(chunk.includes('data-qid="2"') && chunk.includes('data-qid="4"'), "chunk holds the later-closing cards");
});

test("groups beyond the page render folded and the chunk endpoint serves one client via ?cid=", async () => {
  const env = makeEnv(seed());
  // shown=1 loads only Bob's soonest card, so Alice's group has no cards on
  // the page; her header must arrive folded (a closed dropdown) rather than
  // expanded over nothing.
  const html = await adminPage(env, "matches", ADMIN, { matchQuery: { f: "all", shown: "1" } });
  assert.match(html, /class="mgroup folded" data-cid="1"/, "unloaded group arrives folded");
  assert.match(html, /aria-expanded="false" aria-label="Expand Alice Apple's matches"/, "folded group reads as closed");
  assert.match(html, /class="mgroup" data-cid="2"/, "group with loaded cards stays expanded");
  assert.match(html, /id="mGrid"[^>]*data-qs="view=matches&amp;f=all"/, "grid carries the filter query for on-demand group fetches");
  // The cid fetch returns every card for that client under the same filters.
  const chunk = await matchesChunk(env, ADMIN, { f: "all", cid: "1" });
  assert.ok(chunk.includes('data-qid="1"') && chunk.includes('data-qid="2"'), "both of Alice's cards return");
  assert.ok(!chunk.includes('data-qid="3"') && !chunk.includes('data-qid="4"'), "no other client's cards leak in");
  // Filters still apply: under the Strong + Good default Bob's Possible stays out.
  const sg = await matchesChunk(env, ADMIN, { cid: "2" });
  assert.ok(sg.includes('data-qid="3"') && !sg.includes('data-qid="4"'), "cid fetch honours the strength filter");
});

test("admin triage buttons carry the exact stale-Possible id lists", async () => {
  const env = makeEnv(seed({ possAgeDays: 9 }));
  const html = await adminPage(env, "matches", ADMIN);
  assert.match(html, /id="triStale" data-ids="4"[^>]*>Skip Possible older than 7 days \(1\)/, "stale skip carries the id and count");
  assert.match(html, /id="triPoss" data-ids="4"[^>]*>Skip all Possible \(1\)/, "skip-all carries the id and count");
  // Agents do not get the queue-wide skip tools.
  const agentHtml = await adminPage(env, "matches", { role: "agent", id: 99 });
  assert.ok(!agentHtml.includes('id="triStale"'), "stale skip is admin only");
});

test("a queue with no Strong or Good falls back to showing everything", async () => {
  const env = makeEnv(`
    INSERT INTO users (id, name) VALUES (1, 'Solo');
    INSERT INTO searches (id, client_id, label) VALUES (1, 1, 'Any');
    INSERT INTO queue (id, wishlist_id, client_id, lot_id, lot_json, status, token) VALUES
      (1, 1, 1, 'L1', '${lotJson("L1", "Possible", 4)}', 'pending', 't1');
  `);
  const html = await adminPage(env, "matches", ADMIN);
  assert.ok(html.includes('data-qid="1"'), "the only (Possible) card still renders");
  assert.ok(!html.includes('id="mBanner"'), "no misleading hidden banner");
});

test("match cards thread the current filters through lot links via ret=", async () => {
  const env = makeEnv(seed());
  const html = await adminPage(env, "matches", ADMIN, { matchQuery: { f: "strong" } });
  assert.match(html, /view=lot&id=1&ret=%2Fadmin%3Fview%3Dmatches%26f%3Dstrong/, "lot link carries the return path");
});
