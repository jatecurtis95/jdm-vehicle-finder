// IA-AUDIT item 7: the gone-quiet dashboard list. A real buyer deliberates for
// weeks; this resurfaces clients who ENGAGED (opened or said interested), have
// an active request, and have had no touch (sent vehicle, note or logged
// contact tap) in 14 or more days. Distinct from Stalled requests, which is
// request-activity based and ignores engagement.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv, readFile } from "./helpers/d1.mjs";
import { adminPage, logContactTap } from "../src/admin.js";

const ADMIN = { role: "admin", id: 0 };

function seededEnv() {
  return makeEnv(readFile("seed/seed-dev.sql"));
}

// A sent-and-opened vehicle N days ago: engagement plus a touch timestamp.
async function sentAndViewed(env, clientId, wishlistId, daysAgo, opts = {}) {
  await env.DB.prepare(
    `INSERT INTO queue (wishlist_id, client_id, lot_id, lot_json, status, token, sent_at, viewed_at, response)
     VALUES (?, ?, ?, '{"id":"GQ"}', 'sent', ?, datetime('now', ?), ${opts.viewed === false ? "NULL" : "datetime('now', ?)"}, ?)`
  ).bind(wishlistId, clientId, "GQ-" + clientId + "-" + Math.floor(daysAgo), "gq-tok-" + clientId + "-" + Math.floor(daysAgo),
    `-${daysAgo} days`, ...(opts.viewed === false ? [] : [`-${daysAgo} days`]), opts.response || null).run();
}

test("an engaged client with no touch in 14+ days appears in the gone-quiet list", async () => {
  const env = seededEnv();
  await sentAndViewed(env, 9001, 9001, 20);
  const html = await adminPage(env, "dashboard", ADMIN);
  assert.match(html, /Who's gone quiet\?/, "the section renders");
  assert.match(goneQuietSlice(html), /Aiko Tanaka/, "the engaged, untouched client is listed");
  assert.match(html, /Who's gone quiet\? <span class="ct">\(1\)/, "the count reflects the one quiet client");
});

// The gone-quiet section only, ended at the next section heading so a client
// legitimately listed under Stalled cannot bleed into the assertion.
function goneQuietSlice(html) {
  const start = html.indexOf("Who's gone quiet?");
  const end = html.indexOf("Which requests are stalled?", start);
  return html.slice(start, end > start ? end : start + 1200);
}

test("a recent touch removes the client from the gone-quiet list", async () => {
  const env = seededEnv();
  await sentAndViewed(env, 9001, 9001, 20);
  await logContactTap(env, 9001, "call", ADMIN);
  const html = await adminPage(env, "dashboard", ADMIN);
  assert.doesNotMatch(goneQuietSlice(html), /Aiko Tanaka/, "a fresh touch resets the clock");
});

test("engagement is required: a sent-but-never-opened client stays out", async () => {
  const env = seededEnv();
  await sentAndViewed(env, 9002, 9002, 20, { viewed: false });
  const html = await adminPage(env, "dashboard", ADMIN);
  assert.doesNotMatch(goneQuietSlice(html), /Ben Carter/, "no engagement means cold list, not gone-quiet");
});

test("an interested response counts as engagement even without a view", async () => {
  const env = seededEnv();
  await sentAndViewed(env, 9002, 9002, 20, { viewed: false, response: "interested" });
  const html = await adminPage(env, "dashboard", ADMIN);
  assert.match(goneQuietSlice(html), /Ben Carter/, "interested buyers are the warmest resurfacing target");
});

test("a client whose requests are all lost or delivered stays out", async () => {
  const env = seededEnv();
  await sentAndViewed(env, 9001, 9001, 20);
  await env.DB.prepare("UPDATE wishlists SET status = 'lost' WHERE client_id = 9001").run();
  const html = await adminPage(env, "dashboard", ADMIN);
  assert.doesNotMatch(goneQuietSlice(html), /Aiko Tanaka/, "closed pipelines are not resurfaced");
});

test("the empty state renders quiet with an outline button", async () => {
  const env = seededEnv();
  // The seed ships Aiko 20 days quiet; a fresh touch resets her clock so the
  // board is empty.
  await logContactTap(env, 9001, "call", ADMIN);
  const html = await adminPage(env, "dashboard", ADMIN);
  const i = html.indexOf("Who's gone quiet?");
  assert.ok(i > -1, "section renders even when empty");
  const sec = html.slice(i, i + 700);
  assert.match(sec, /btn-line/, "zero count keeps the outline button (gold diet)");
  assert.match(sec, /No engaged buyers have gone quiet/, "calm empty state");
});
