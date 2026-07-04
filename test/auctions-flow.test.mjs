// IA-AUDIT item 15: the Auctions find flow on a phone. The search form
// collapses to a one-line summary after a search runs (flight-search
// pattern), the live feed reads closing-soonest and says so, and watched
// lots entering their final 24h page the staff via a dashboard alert strip
// (client-side, because the watchlist itself lives in localStorage).
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { adminPage, adminAuctionsPage } from "../src/admin.js";
import { auctionCardV2 } from "../src/auction-ui.js";

const ADMIN = { role: "admin", id: 0 };

test("the search form collapses to a summary bar once a search ran", async () => {
  const env = makeEnv("");
  const searched = await adminAuctionsPage(env, ADMIN, { search: { make: "NISSAN", yearMin: "1999" } });
  assert.match(searched, /<details class="asrch-fold">/, "form folds behind the summary");
  assert.match(searched, /Edit search/, "the way back in is labelled");
  assert.match(searched, /Nissan[\s\S]*1999/, "the summary digests the criteria");
  const blank = await adminAuctionsPage(env, ADMIN, {});
  assert.doesNotMatch(blank, /<details class="asrch-fold">/, "no fold before any search - the form is the page");
});

test("the live feed bar declares closing-soonest ordering", async () => {
  const env = makeEnv("");
  const html = await adminAuctionsPage(env, ADMIN, {});
  assert.match(html, /closing soonest first/, "the default sort is stated, mirroring Matches");
});

test("watchlist snapshots carry a parseable close timestamp", () => {
  const html = auctionCardV2(
    { id: "X1", marka_name: "NISSAN", model_name: "SKYLINE", rate: "4", auction_date: "2027-12-20 10:00:00", images: "" },
    { nowYear: 2026 }
  );
  assert.match(html, /data-ts="2027-12-20 10:00:00"/, "the heart snapshot can power closing alerts");
});

test("the dashboard ships the watch-alert strip", async () => {
  const env = makeEnv("");
  const html = await adminPage(env, "dashboard", ADMIN);
  assert.match(html, /id="watchAlert"/, "the slot renders");
  assert.match(html, /jdmWatch/, "the script reads the client-side watchlist");
  assert.match(html, /tab=watch/, "the alert links back to the watchlist");
});

test("the auctions page ships the watch-alert strip too", async () => {
  const env = makeEnv("");
  const html = await adminAuctionsPage(env, ADMIN, {});
  assert.match(html, /id="watchAlert"/, "deadline work pages you where you already are");
});
