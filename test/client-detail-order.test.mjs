// IA-AUDIT item 5: the client record is action-first, not form-first. Order:
// header, Live matches, requested cars, history, searches as one-line summary
// rows (editor closed at every width), Add-another-search, then the Find-a-car
// form collapsed behind the header CTA. Rail: Activity earns the top slot only
// once the timeline has something in it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv, readFile } from "./helpers/d1.mjs";
import { clientDetailPage, logContactTap } from "../src/admin.js";

const ADMIN = { role: "admin", id: 0 };

function seededEnv() {
  return makeEnv(readFile("seed/seed-dev.sql"));
}

test("main column: matches render before searches, find form last", async () => {
  const env = seededEnv();
  const html = await clientDetailPage(env, 9001, ADMIN);
  const matches = html.indexOf("Live matches</h2>");
  const searches = html.search(/<span class="num">\d+<\/span> Search(es)?\b/);
  const find = html.indexOf('id="find"');
  assert.ok(matches > -1 && searches > -1 && find > -1, "all three sections render");
  assert.ok(matches < searches, "Live matches sit above the searches card");
  assert.ok(searches < find, "the find form is the last tool on the page");
});

test("a single search arrives with its editor closed", async () => {
  const env = seededEnv();
  const html = await clientDetailPage(env, 9001, ADMIN);
  assert.doesNotMatch(html, /<details class="wledit" open>/, "the edit form stays behind its disclosure at every width");
});

test("the find-a-car form is collapsed by default", async () => {
  const env = seededEnv();
  const html = await clientDetailPage(env, 9001, ADMIN);
  assert.match(html, /<details class="card foldcard" id="find"(?![^>]*\bopen\b)/, "closed foldcard by default");
});

test("the find-a-car form springs open when a search ran", async () => {
  const env = seededEnv();
  const html = await clientDetailPage(env, 9001, ADMIN, { search: { make: "NISSAN" } });
  assert.match(html, /<details class="card foldcard" id="find" open/, "results are never hidden behind a closed fold");
});

test("rail: an empty activity timeline sits below portal and edit details", async () => {
  const env = seededEnv();
  const html = await clientDetailPage(env, 9001, ADMIN);
  const portal = html.indexOf("BUYER PORTAL");
  const activity = html.indexOf("Activity</h2>");
  assert.ok(portal > -1 && activity > -1, "both rail cards render");
  assert.ok(portal < activity, "the best rail slot is not spent on emptiness");
});

test("rail: activity earns the top slot once a touch is logged", async () => {
  const env = seededEnv();
  await logContactTap(env, 9001, "whatsapp", ADMIN);
  const html = await clientDetailPage(env, 9001, ADMIN);
  const portal = html.indexOf("BUYER PORTAL");
  const activity = html.indexOf("Activity</h2>");
  assert.ok(activity < portal, "a live timeline is the rail's most valuable content");
});
