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
  assert.match(html, /Live overview/);
  assert.match(html, /data-count=/);
  assert.match(html, /Active clients/);
  assert.match(html, /Matches to review/);
});

test("dashboard numbers reflect the seeded data (scoped counts, not hardcoded)", async () => {
  const env = makeEnv(readFile("seed/seed-dev.sql"));
  const html = await adminPage(env, "dashboard", ADMIN);
  // Seed has 3 clients and exactly 1 pending match.
  assert.match(html, /data-count="3"[^>]*>0<\/div>\s*<div class="l">Active clients/);
  assert.match(html, /data-count="1"[^>]*>0<\/div>\s*<div class="l">Matches to review/);
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
  assert.match(html, /data-count="2"[^>]*>0<\/div>\s*<div class="l">Active clients/);
  // Agents do not see the agents metric.
  assert.doesNotMatch(html, /Active agents/);
});
