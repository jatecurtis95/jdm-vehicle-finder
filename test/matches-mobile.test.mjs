// IA-AUDIT item 8: at 375 the pre-list chrome (ticker grid + banner) cost the
// whole first screen; the first match card landed at 1075px. A single-row
// count strip replaces both at mobile widths (each count tappable, the
// banner's shown/hidden message folded in), the ticker/banner pair stays
// untouched at desktop, and the selection bulk bar drops to the thumb.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { adminPage } from "../src/admin.js";

const ADMIN = { role: "admin", id: 0 };

function lotJson(id, strength, daysOut) {
  const d = new Date(Date.now() + daysOut * 86400000).toISOString().replace("T", " ").slice(0, 19);
  return JSON.stringify({
    id, lot: "1" + id, marka_name: "NISSAN", model_name: "SKYLINE", year: 1999,
    rate: "4", start: 1000000, mileage: 80000, auction: "USS Tokyo",
    auction_date: d, images: "", _strength: strength,
  });
}

function seed() {
  return `
    INSERT INTO clients (id, name, email) VALUES (1, 'Alice Apple', 'a@x.com');
    INSERT INTO wishlists (id, client_id, label, marka_name) VALUES (1, 1, 'R34 hunt', 'NISSAN');
    INSERT INTO queue (id, wishlist_id, client_id, lot_id, lot_json, status, token, created_at) VALUES
      (1, 1, 1, 'L1', '${lotJson("L1", "Strong", 1)}', 'pending', 'tok1', datetime('now')),
      (2, 1, 1, 'L2', '${lotJson("L2", "Possible", 5)}', 'pending', 'tok2', datetime('now'));
  `;
}

test("the mobile count strip renders every ticker count as a tappable link", async () => {
  const env = makeEnv(seed());
  const html = await adminPage(env, "matches", ADMIN);
  const i = html.indexOf('class="mstrip"');
  assert.ok(i > -1, "the strip renders");
  const strip = html.slice(i, i + 1500);
  for (const label of ["Awaiting", "Strong", "Good", "Possible", "48h"]) {
    assert.match(strip, new RegExp(`<a class="msk[^"]*"[^>]*>${label}`), `${label} is a tappable count`);
  }
});

test("the strip folds the banner's shown/hidden message in under the default filter", async () => {
  const env = makeEnv(seed());
  const html = await adminPage(env, "matches", ADMIN);
  assert.match(html, /class="ms-note">1 shown, 1 hidden <a href="[^"]*f=all[^"]*">Show all<\/a>/, "the note replaces the banner at mobile");
  const all = await adminPage(env, "matches", ADMIN, { matchQuery: { f: "all" } });
  assert.doesNotMatch(all, /class="ms-note"/, "no note when nothing is hidden");
});

test("mobile CSS: ticker and banner hide, strip shows, bulk bar drops to the thumb", async () => {
  const env = makeEnv(seed());
  const html = await adminPage(env, "matches", ADMIN);
  assert.match(html, /\.mstrip\{display:none\}/, "strip hidden at desktop - 1440 untouched");
  assert.match(html, /@media\(max-width:759px\)\{[^}]*\.mticker\{display:none\}/, "ticker grid hides at mobile");
  assert.match(html, /\.mbanner\{display:none\}/, "banner hides at mobile (its message lives in the strip)");
  assert.match(html, /@media\(max-width:640px\)\{[\s\S]*?\.bulkbar2\{[^}]*position:fixed;[^}]*bottom:0/, "selection bar pins to the bottom at the thumb");
});

test("'Search again' is renamed so search means only one thing on this page", async () => {
  const env = makeEnv(seed());
  const html = await adminPage(env, "matches", ADMIN);
  assert.match(html, /New auction search/, "topbar action renamed");
  assert.doesNotMatch(html, /Search again/, "the ambiguous label is gone");
  const empty = await adminPage(makeEnv(""), "matches", ADMIN);
  assert.doesNotMatch(empty, /Search again/, "empty state uses the new name too");
});

test("the empty matches queue carries one inline primary CTA that runs the search", async () => {
  const html = await adminPage(makeEnv(""), "matches", ADMIN);
  assert.match(html, /<form method="POST" action="\/run"[^>]*data-confirm="Run the auction search for every active customer search now\?/, "empty state posts /run with the consequence spelled out");
  assert.match(html, /class="btn-primary"[^>]*>Run the auction search</, "the empty state's CTA is the page's gold primary");
});
