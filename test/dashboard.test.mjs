// The admin dashboard renders from real, scoped counts. We render it against the
// seeded in-memory database and assert the greeting, animated numbers and the
// design-system pieces are present and correctly wired.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv, readFile } from "./helpers/d1.mjs";
import { adminPage } from "../src/admin.js";

const ADMIN = { role: "admin", id: 0 };

test("dashboard renders the greeting, live kicker and a count-up overview", async () => {
  const env = makeEnv(readFile("seed/seed-dev.sql"));
  const html = await adminPage(env, "dashboard", ADMIN);
  assert.match(html, /class="greet"/);
  assert.match(html, /id="greetTime"/);
  assert.match(html, /class="dkick"/);
  assert.match(html, /data-count=/);
  assert.match(html, /Active clients/);
  assert.match(html, /Matches to review/);
});

test("dashboard numbers reflect the seeded data (scoped counts, not hardcoded)", async () => {
  const env = makeEnv(readFile("seed/seed-dev.sql"));
  const html = await adminPage(env, "dashboard", ADMIN);
  // Seed has 3 clients (overview KPI) and exactly 1 pending match (attention
  // card). Tiles render the REAL number server-side (launch audit: no more
  // 0-placeholder count-up).
  assert.match(html, /data-count="3"[^>]*>3<\/div>\s*<div class="cap">Active clients/);
  assert.match(html, /data-count="1"[^>]*>1<\/div>\s*<div class="ac-l">Matches to review/);
});

test("dashboard surfaces the roll-up KPIs and the question-framed sections", async () => {
  const env = makeEnv(readFile("seed/seed-dev.sql"));
  const html = await adminPage(env, "dashboard", ADMIN);
  assert.match(html, /Open requests/);
  assert.match(html, /Sent this week/);
  assert.match(html, /Members/);
  assert.match(html, /New matches per day/);            // the previously-unused found series
  assert.match(html, /Which auctions close within 48h\?/); // heading matches its 48h window (launch audit)
  assert.match(html, /Who needs attention today\?/);    // scheduled follow-ups
  assert.match(html, /Who owes money\?/);               // deposits outstanding
});

test("dashboard uses the full-width container", async () => {
  const env = makeEnv(readFile("seed/seed-dev.sql"));
  const html = await adminPage(env, "dashboard", ADMIN);
  assert.match(html, /class="content dash"/);
});

test("dashboard stat numbers are static server-rendered values (no count-up)", async () => {
  const env = makeEnv(readFile("seed/seed-dev.sql"));
  const html = await adminPage(env, "dashboard", ADMIN);
  // The count-up animation is gone (launch audit: it flashed wrong zeros);
  // the greeting script must not touch [data-count] nodes at all.
  const greet = html.slice(html.indexOf("greetTime") - 200, html.indexOf("greetTime") + 400);
  assert.doesNotMatch(greet, /data-count/, "dash script no longer animates the tiles");
});

test("an agent dashboard is scoped to their own clients only", async () => {
  const env = makeEnv(readFile("seed/seed-dev.sql"));
  // Seed agent 9101 owns clients 9001 and 9002 (not the direct client 9003).
  const html = await adminPage(env, "dashboard", { role: "agent", id: 9101, name: "Demo Agent" });
  assert.match(html, /data-count="2"[^>]*>2<\/div>\s*<div class="cap">Active clients/);
  // The one pending seeded match belongs to a client this agent owns (attention card).
  assert.match(html, /data-count="1"[^>]*>1<\/div>\s*<div class="ac-l">Matches to review/);
  // Agents do not see the agents metric.
  assert.doesNotMatch(html, /Active agents/);
});

// Regression: each question-framed section must be ONE grid item (heading above
// its own list). As two loose siblings, the .dcols two-column grid auto-placed
// every heading into column 1 and every list into column 2, shattering the page.
test("each dashboard Q&A section wraps its heading and list in one grid item", async () => {
  const env = makeEnv(readFile("seed/seed-dev.sql"));
  const html = await adminPage(env, "dashboard", ADMIN);
  const cols = html.match(/<div class="dcols">/g) || [];
  assert.equal(cols.length, 4, "four bands (gone-quiet joined the board, tasks closes it)");
  // Every .dcols band opens with a .dsec wrapper (heading + list inside it).
  assert.match(html, /<div class="dcols"><div class="dsec"><div class="sec-h">/);
  const secs = html.match(/<div class="dsec">/g) || [];
  assert.equal(secs.length, 7, "seven wrapped sections");
  // No section heading is ever a loose grid child of .dcols any more.
  assert.ok(!html.includes('<div class="dcols"><div class="sec-h">'), "headings are not loose grid children");
});
