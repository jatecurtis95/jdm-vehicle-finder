// IA-AUDIT first pass (approved items 1, 2, 6, 9): hot-lead age and pinning on
// Requests, non-zero stage chips on mobile, the dashboard reorder with the gold
// diet, and the request detail mobile reorder. Rendered against the in-memory
// database like the other view tests; CSS behaviour that node cannot measure is
// pinned as a contract on the emitted stylesheet.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv, readFile } from "./helpers/d1.mjs";
import { adminPage, requestDetailPage } from "../src/admin.js";

const ADMIN = { role: "admin", id: 0 };

function seededEnv() {
  return makeEnv(readFile("seed/seed-dev.sql"));
}

// Insert a wishlist row with full control over status / activity / age.
async function addRequest(env, { id, clientId = 9001, status = "new", createdAgo = "-10 minutes", lastActivity = null, label = "Test search" }) {
  await env.DB.prepare(
    `INSERT INTO wishlists (id, client_id, label, marka_name, active, status, last_activity, created_at)
     VALUES (?, ?, ?, 'TOYOTA', 1, ?, ?, datetime('now', ?))`
  ).bind(id, clientId, label, status, lastActivity, createdAgo).run();
}

// ---- Item 1: hot-lead age on New requests, untouched New pinned to top ------

test("an untouched New request shows its age, hot once past the one-hour window", async () => {
  const env = seededEnv();
  await addRequest(env, { id: 501, status: "new", createdAgo: "-2 hours" });
  await addRequest(env, { id: 502, status: "new", createdAgo: "-10 minutes" });
  const html = await adminPage(env, "requests", ADMIN);
  assert.match(html, /req-age req-age-hot[^>]*>New 2h ago/, "2h-old untouched New is hot");
  assert.match(html, /req-age(?! req-age-hot)[^>]*>New 10m ago/, "10m-old New shows age without the hot state");
});

test("requests order by most recent activity (V1.3 Phase C)", async () => {
  const env = seededEnv();
  // Ben's V1.3 rule: most recently ACTIVE requests at the top, so a portal
  // "I'm interested" tap (which bumps last_activity) floats that request up.
  // Untouched requests then sort by recency of creation; age chips flag News.
  await addRequest(env, { id: 503, status: "searching", createdAgo: "-3 days", lastActivity: new Date().toISOString(), label: "Active search" });
  await addRequest(env, { id: 501, status: "new", createdAgo: "-2 hours" });
  await addRequest(env, { id: 502, status: "new", createdAgo: "-10 minutes" });
  const html = await adminPage(env, "requests", ADMIN);
  const touched = html.indexOf("REQ-503");
  const newer = html.indexOf("REQ-502");
  const older = html.indexOf("REQ-501");
  assert.ok(older > -1 && newer > -1 && touched > -1, "all three rows render");
  assert.ok(touched < newer, "the just-touched request floats to the top");
  assert.ok(newer < older, "then untouched requests, most recently created first");
});

test("a New request with logged activity is not treated as a hot lead", async () => {
  const env = seededEnv();
  await addRequest(env, { id: 504, status: "new", createdAgo: "-3 hours", lastActivity: new Date().toISOString() });
  const html = await adminPage(env, "requests", ADMIN);
  assert.doesNotMatch(html, /req-age-hot/, "touched New rows never show the hot state");
});

// ---- Item 2: zero-count pipeline stages collapse behind a toggle on mobile --

test("zero-count stage cards are marked and a mobile All-stages toggle exists", async () => {
  const env = seededEnv();
  await addRequest(env, { id: 505, status: "new", createdAgo: "-5 minutes" });
  const html = await adminPage(env, "requests", ADMIN);
  assert.match(html, /class="pipe-card pipe-zero"/, "empty stages carry the pipe-zero marker");
  assert.match(html, /class="pipe-card"[^>]*data-st="new"/, "a non-empty stage is not marked pipe-zero");
  assert.match(html, /class="pipe-more"/, "the All-stages toggle renders");
  // CSS contract: mobile hides zero stages until the toggle opens them.
  assert.match(html, /@media\(max-width:700px\)\{[^}]*\.pipe \.pipe-zero\{display:none\}/, "zero stages hidden at mobile widths");
  assert.match(html, /\.pipe\.all \.pipe-zero\{display:block\}/, "the toggle reveals them");
});

// ---- Item 6: dashboard tile order, demoted overview, gold diet --------------

test("dashboard leads with the deadline tiles and a hot-lead tile, team overview demoted", async () => {
  const env = seededEnv();
  await addRequest(env, { id: 506, status: "new", createdAgo: "-2 hours" });
  const html = await adminPage(env, "dashboard", ADMIN);
  const idx = (s) => { const i = html.indexOf(s); assert.ok(i > -1, s + " renders"); return i; };
  assert.ok(idx("New leads to contact") < idx("Closing in 48h"), "hot leads lead the band");
  assert.ok(idx("Closing in 48h") < idx("Matches to review"), "deadline before queue");
  assert.ok(idx("Matches to review") < idx("Follow-ups due"), "core-flow tiles before contact obligations");
  assert.ok(idx("Follow-ups due") < idx("Overdue tasks"), "task tiles last");
  assert.ok(idx("Needs attention today") < idx("Team overview"), "attention band outranks the vanity roll-up");
  // The 2h-old untouched lead flips the tile red (the seed's own untouched
  // wishlists join the count, so only the tone and presence are pinned).
  // Tiles now server-render the REAL number, never a 0 placeholder.
  assert.match(html, /acard-bad" href="\/admin\?view=requests"><div class="ac-n" data-count="(\d+)">\1<\/div><div class="ac-l">New leads to contact/, "untouched lead past 1h renders the tile red with its real count");
});

test("dashboard section buttons are gold only when their count is non-zero", async () => {
  const env = seededEnv();
  const html = await adminPage(env, "dashboard", ADMIN);
  // Seed has no follow-ups due: that section's button must be the quiet outline.
  const attn = html.slice(html.indexOf("Who needs attention today?"), html.indexOf("Who needs attention today?") + 300);
  assert.match(attn, /btn-line/, "zero-count section uses the outline button");
  assert.doesNotMatch(attn, /btn-gold/, "zero-count section shows no gold");
});

test("a due follow-up turns its dashboard section button gold", async () => {
  const env = seededEnv();
  await env.DB.prepare(
    `INSERT INTO wishlists (id, client_id, label, marka_name, active, status, next_action_date, created_at)
     VALUES (507, 9001, 'Follow-up search', 'TOYOTA', 1, 'searching', date('now'), datetime('now'))`
  ).run();
  const html = await adminPage(env, "dashboard", ADMIN);
  const attn = html.slice(html.indexOf("Who needs attention today?"), html.indexOf("Who needs attention today?") + 300);
  assert.match(attn, /btn-gold/, "non-zero section earns the gold button");
});

// ---- Item 9: request detail mobile order, single backlink, compact stepper --

test("request detail has exactly one Back-to-requests control and a compact stage line", async () => {
  const env = seededEnv();
  await addRequest(env, { id: 508, status: "searching", createdAgo: "-1 day", label: "Detail search" });
  const html = await requestDetailPage(env, 508, ADMIN);
  const backs = (html.match(/Back to requests/g) || []).length;
  assert.equal(backs, 1, "the duplicate backlink is gone, the topbar button remains");
  assert.match(html, /rd-stage-line[^>]*>Stage 3 of 12/, "the mobile stepper compresses to stage-of-total");
});

test("request detail cards carry mobile order classes and the CSS interleaves them", async () => {
  const env = seededEnv();
  await addRequest(env, { id: 509, status: "new", createdAgo: "-1 hour", label: "Order search" });
  const html = await requestDetailPage(env, 509, ADMIN);
  for (const c of ["rd-c-client", "rd-c-owner", "rd-c-deposit", "rd-c-request", "rd-c-vehicles", "rd-c-status", "rd-c-next", "rd-c-note", "rd-c-tasks", "rd-c-activity"]) {
    assert.ok(html.includes(c), c + " class present");
  }
  // CSS contract: at the stacked breakpoint the columns dissolve so the cards
  // re-order (status and next action directly after the client card).
  assert.match(html, /@media\(max-width:1180px\)\{[^<]*\.rdcol\{display:contents\}/, "columns dissolve at the stacked width");
  assert.match(html, /\.rd-c-client\{order:1\}\.rd-c-status\{order:2\}\.rd-c-next\{order:3\}/, "after-call cards move to the top on mobile");
});
