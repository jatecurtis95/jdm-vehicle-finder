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
  // Seed has 3 clients (overview KPI) and exactly 1 pending match (attention card).
  assert.match(html, /data-count="3"[^>]*>0<\/div>\s*<div class="cap">Active clients/);
  assert.match(html, /data-count="1"[^>]*>0<\/div>\s*<div class="ac-l">Matches to review/);
});

test("dashboard surfaces the roll-up KPIs and the question-framed sections", async () => {
  const env = makeEnv(readFile("seed/seed-dev.sql"));
  const html = await adminPage(env, "dashboard", ADMIN);
  assert.match(html, /Open requests/);
  assert.match(html, /Sent this week/);
  assert.match(html, /Members/);
  assert.match(html, /New matches per day/);            // the previously-unused found series
  assert.match(html, /Which auctions close today\?/);   // actionable 48h list, reframed
  assert.match(html, /Who needs attention today\?/);    // scheduled follow-ups
  assert.match(html, /Who owes money\?/);               // deposits outstanding
});

test("dashboard uses the full-width container", async () => {
  const env = makeEnv(readFile("seed/seed-dev.sql"));
  const html = await adminPage(env, "dashboard", ADMIN);
  assert.match(html, /class="content dash"/);
});

test("dashboard respects reduced motion (the script guards on the media query)", async () => {
  const env = makeEnv(readFile("seed/seed-dev.sql"));
  const html = await adminPage(env, "dashboard", ADMIN);
  assert.match(html, /prefers-reduced-motion: reduce/);
});

test("an agent dashboard is scoped to their own clients only", async () => {
  const env = makeEnv(readFile("seed/seed-dev.sql"));
  // Seed agent 9001 owns clients 9001 and 9002 (not the direct client 9003).
  const html = await adminPage(env, "dashboard", { role: "agent", id: 9001, name: "Demo Agent" });
  assert.match(html, /data-count="2"[^>]*>0<\/div>\s*<div class="cap">Active clients/);
  // The one pending seeded match belongs to a client this agent owns (attention card).
  assert.match(html, /data-count="1"[^>]*>0<\/div>\s*<div class="ac-l">Matches to review/);
  // Agents do not see the agents metric.
  assert.doesNotMatch(html, /Active agents/);
});
