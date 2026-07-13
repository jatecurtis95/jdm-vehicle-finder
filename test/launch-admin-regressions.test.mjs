// Launch-gate regressions for the staff dashboard, dealer inventory and shared
// auction UI. These tests describe user-visible outcomes discovered in the
// pre-launch audit; production fixes intentionally follow in the GREEN stage.
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import {
  adminPage,
  approveDealerVehicle,
  clientDrawerFragment,
  dealerPortalPage,
  dealerSubmissionsPage,
  portalAuctionsPage,
  requestDetailPage,
} from "../src/admin.js";
import { AUCTION_CSS, auctionEligibility } from "../src/auction-ui.js";
import { sessionCookie } from "../src/auth.js";
import { makeEnv } from "./helpers/d1.mjs";

const ADMIN = { role: "admin", id: 0 };

function queueFixture({ archived = 0, watch = false } = {}) {
  return makeEnv(`
    INSERT INTO clients (id, name, email, portal_enabled, archived)
    VALUES (17, 'Jordan Buyer', 'jordan@example.com', 1, ${archived});
    INSERT INTO wishlists
      (id, client_id, label, marka_name, model_name, active, status, watch_only)
    VALUES
      (31, 17, 'R34 search', 'NISSAN', 'SKYLINE', 1, 'searching', ${watch ? 1 : 0});
    INSERT INTO queue
      (id, wishlist_id, client_id, lot_id, lot_json, status, token, created_at)
    VALUES
      (731, 31, 17, 'FEED-LOT-ABC',
       json_object(
         'year', 1999,
         'marka_name', 'NISSAN',
         'model_name', 'SKYLINE',
         'lot', '42',
         'auction', 'USS Tokyo',
         'auction_date', datetime('now', '+36 hours'),
         '_strength', 'Strong',
         '_watch', ${watch ? "json('true')" : "json('false')"},
         '_landed', json_object('grandTotal', 55000, 'state', 'WA')
       ),
       'pending', 'queue-token-731', datetime('now'));
  `);
}

function taggedCount(html, label, className) {
  const safe = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<div class="${className}" data-count="(\\d+)"[^>]*>([^<]*)<\\/div>\\s*<div class="(?:cap|ac-l)">${safe}<\\/div>`);
  const match = html.match(re);
  assert.ok(match, `rendered count for ${label}`);
  return { data: Number(match[1]), text: match[2].trim() };
}

function openingForm(html, action) {
  const safe = action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.match(new RegExp(`<form\\b[^>]*action="${safe}"[^>]*>`))?.[0] || "";
}

function cssRule(selector) {
  const declarations = [];
  for (const match of AUCTION_CSS.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const selectors = match[1].split(",").map((part) => part.trim());
    if (selectors.includes(selector)) declarations.push(match[2]);
  }
  return declarations.join(";");
}

test("global admin search opens the queue row, not the external feed lot id", async () => {
  const html = await adminPage(queueFixture(), "search", ADMIN, { q: "FEED-LOT-ABC" });
  assert.match(html, /href="\/admin\?view=lot&amp;id=731"|href="\/admin\?view=lot&id=731"/);
  assert.doesNotMatch(html, /href="\/admin\?view=lot(?:&amp;|&)id=FEED-LOT-ABC"/);
});

test("customer drawer recent matches open the queue row", async () => {
  const html = await clientDrawerFragment(queueFixture(), 17, ADMIN);
  assert.match(html, /href="\/admin\?view=lot&amp;id=731"|href="\/admin\?view=lot&id=731"/);
  assert.doesNotMatch(html, /href="\/admin\?view=lot(?:&amp;|&)id=FEED-LOT-ABC"/);
});

test("requests latest-car links open the queue row", async () => {
  const html = await adminPage(queueFixture(), "requests", ADMIN);
  assert.match(html, /href="\/admin\?view=lot&amp;id=731"|href="\/admin\?view=lot&id=731"/);
  assert.doesNotMatch(html, /href="\/admin\?view=lot(?:&amp;|&)id=FEED-LOT-ABC"/);
});

test("dealer navigation stays on the real dealer portal route", async () => {
  const env = makeEnv(`
    INSERT INTO dealers (id, email, name, company, pass_salt, pass_hash, active)
    VALUES (4, 'dealer@example.com', 'Dealer Person', 'Tokyo Stock', 's', 'h', 1);
  `);
  const html = await dealerPortalPage(env, { id: 4, name: "Dealer Person", company: "Tokyo Stock" });
  assert.match(html, /href="\/dealer\/portal"/);
  assert.doesNotMatch(html, /href="\/dealer"[^/]/);
});

test("dealer portal supports photos and a complete stock lifecycle", async () => {
  const env = makeEnv(`
    INSERT INTO dealers (id, email, name, company, pass_salt, pass_hash, active)
    VALUES (4, 'dealer@example.com', 'Dealer Person', 'Tokyo Stock', 's', 'h', 1);
    INSERT INTO dealer_vehicles
      (id, dealer_id, make, model, year, price_aud, photos, status, admin_notes)
    VALUES
      (1, 4, 'NISSAN', 'SKYLINE', 1999, 78000, json_array('https://img.test/r34.jpg'), 'pending', NULL),
      (2, 4, 'TOYOTA', 'SUPRA', 1998, 85000, json_array('https://img.test/supra.jpg'), 'approved', NULL),
      (3, 4, 'MAZDA', 'RX-7', 1996, 69000, json_array('https://img.test/rx7.jpg'), 'rejected', 'Please add an interior photo.'),
      (4, 4, 'HONDA', 'NSX', 1992, 125000, json_array('https://img.test/nsx.jpg'), 'archived', NULL),
      (5, 4, 'MITSUBISHI', 'LANCER', 2001, 49000, json_array('https://img.test/evo.jpg'), 'sold', NULL);
  `);
  const html = await dealerPortalPage(env, { id: 4, name: "Dealer Person", company: "Tokyo Stock" });

  assert.match(html, /name="photos"/i, "submission form accepts vehicle photos");
  assert.match(html, /<img\b[^>]+src="https:\/\/img\.test\/r34\.jpg"/i, "submitted photos are visible");
  for (const action of ["update", "resubmit", "withdraw", "sold", "archive", "restore"]) {
    assert.match(html, new RegExp(`action="/dealer/vehicle/${action}"`), `${action} action is available`);
  }
  assert.match(html, />\s*Sold\s*</i);
  assert.match(html, />\s*Archived\s*</i);
});

test("only approved dealer stock is publicly visible to buyers", async () => {
  const env = makeEnv(`
    INSERT INTO dealers (id, email, name, company, pass_salt, pass_hash, active)
    VALUES (4, 'dealer@example.com', 'Dealer Person', 'Tokyo Stock', 's', 'h', 1);
    INSERT INTO dealer_vehicles (id, dealer_id, make, model, price_aud, status)
    VALUES
      (1, 4, 'LIVE', 'SKYLINE', 78000, 'approved'),
      (2, 4, 'SECRET', 'SUPRA', 85000, 'pending'),
      (3, 4, 'SOLD', 'RX7', 69000, 'sold'),
      (4, 4, 'ARCHIVED', 'NSX', 125000, 'archived');
  `);
  const res = await worker.fetch(new Request("https://jdmfinder.com.au/stock"), env, { waitUntil() {} });
  const html = await res.text();

  assert.equal(res.status, 200);
  assert.match(html, /LIVE SKYLINE/);
  assert.match(html, /href="\/stock(?:\/1|\?id=1)"/);
  assert.doesNotMatch(html, /SECRET SUPRA|SOLD RX7|ARCHIVED NSX/);
});

test("dealer review shows evidence and confirms approve or reject", () => {
  const html = dealerSubmissionsPage([{
    id: 1,
    dealer_name: "Dealer Person",
    dealer_company: "Tokyo Stock",
    make: "NISSAN",
    model: "SKYLINE",
    year: 1999,
    price_aud: 78000,
    status: "pending",
    photos: JSON.stringify(["https://img.test/r34.jpg"]),
  }], "pending");

  assert.match(html, /<img\b[^>]+src="https:\/\/img\.test\/r34\.jpg"/i);
  assert.match(openingForm(html, "/dealer-vehicle/approve"), /data-confirm=/);
  assert.match(openingForm(html, "/dealer-vehicle/reject"), /data-confirm=/);
});

test("approving stock emails the dealer that their vehicle is live", async () => {
  const env = makeEnv(`
    INSERT INTO dealers (id, email, name, company, pass_salt, pass_hash, active)
    VALUES (4, 'dealer@example.com', 'Dealer Person', 'Tokyo Stock', 's', 'h', 1);
    INSERT INTO dealer_vehicles (id, dealer_id, make, model, year, price_aud, status)
    VALUES (1, 4, 'NISSAN', 'SKYLINE', 1999, 78000, 'pending');
  `);
  env.ADMIN_TOKEN = "launch-admin-session-secret";
  env.RESEND_API_KEY = "re_test";
  env.PUBLIC_URL = "https://jdmfinder.com.au";
  const cookie = (await sessionCookie(env, "admin", 0)).split(";")[0];
  const deliveries = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes("api.resend.com")) {
      deliveries.push(JSON.parse(options.body));
      return new Response('{"id":"dealer-status-mail"}', {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  try {
    const res = await worker.fetch(new Request("https://jdmfinder.com.au/dealer-vehicle/approve", {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: "https://jdmfinder.com.au",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ id: "1" }),
    }), env, { waitUntil() {} });
    assert.equal(res.status, 303);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(deliveries.length, 1);
  assert.deepEqual(deliveries[0].to, ["dealer@example.com"]);
  assert.match(deliveries[0].subject, /approved|live/i);
  assert.match(deliveries[0].html, /NISSAN|SKYLINE/i);
});

test("dealer approval does not report success for a missing submission", async () => {
  const result = await approveDealerVehicle(makeEnv(), 99999, ADMIN);
  assert.equal(result.ok, false);
});

test("import eligibility is cautious at the 25-year boundary", () => {
  const safeOld = auctionEligibility({ year: "2000" }, 2026);
  const boundary = auctionEligibility({ year: "2001" }, 2026);

  assert.equal(safeOld.cls, "ok");
  assert.match(safeOld.label, /likely/i, "an old model year is still not presented as a legal guarantee");
  assert.equal(boundary.cls, "check", "a boundary model year needs its build date checked");
  assert.match(boundary.label, /build date|check/i);
});

test("per-card approve and skip explain their effect before acting", async () => {
  const normal = await adminPage(queueFixture(), "matches", ADMIN, { matchQuery: { f: "all" } });
  assert.match(normal, /data-confirm="[^"]*(?:approve|send)[^"]*Jordan Buyer[^"]*"/i);
  assert.match(normal, /data-confirm="[^"]*skip[^"]*"/i);

  const watch = await adminPage(queueFixture({ watch: true }), "matches", ADMIN, { matchQuery: { f: "all" } });
  assert.match(watch, /will not be contacted/i);
  assert.match(watch, /Marked done/i, "watch-only completion is not announced as sent to the client");
});

test("dashboard counts render their real value before JavaScript runs", async () => {
  const html = await adminPage(queueFixture(), "dashboard", ADMIN);
  assert.deepEqual(taggedCount(html, "Active clients", "num"), { data: 1, text: "1" });
  assert.deepEqual(taggedCount(html, "Matches to review", "ac-n"), { data: 1, text: "1" });
});

test("dashboard excludes archived customers from active pipeline and queue metrics", async () => {
  const html = await adminPage(queueFixture({ archived: 1 }), "dashboard", ADMIN);
  assert.deepEqual(taggedCount(html, "Active clients", "num"), { data: 0, text: "0" });
  assert.deepEqual(taggedCount(html, "Open requests", "num"), { data: 0, text: "0" });
  assert.deepEqual(taggedCount(html, "Matches to review", "ac-n"), { data: 0, text: "0" });
  assert.deepEqual(taggedCount(html, "Closing in 48h", "ac-n"), { data: 0, text: "0" });
});

test("48-hour closing section says 48 hours, not today", async () => {
  const html = await adminPage(queueFixture(), "dashboard", ADMIN);
  assert.match(html, /Which auctions close (?:in|within) (?:the next )?48\s*(?:h|hours)\?/i);
  assert.doesNotMatch(html, /Which auctions close today\?/i);
});

test("closed customer drawer is hidden and inert until opened", async () => {
  const html = await adminPage(makeEnv(), "clients", ADMIN);
  const panel = html.match(/<aside\b[^>]*id="dwPanel"[^>]*>/)?.[0] || "";

  assert.match(panel, /\bhidden\b/);
  assert.match(panel, /\binert\b/);
  assert.match(panel, /aria-hidden="true"/);
  assert.match(html, /removeAttribute\(['"]inert['"]\)/);
  assert.match(html, /setAttribute\(['"]inert['"],\s*['"]{0,1}['"]\)/);
});

test("risky request status changes require confirmation", async () => {
  const list = await adminPage(queueFixture(), "requests", ADMIN);
  assert.doesNotMatch(list, /class="rstat-sel"[^>]+onchange="this\.form\.submit\(\)"/);
  assert.match(list, /jdmConfirmStatus|data-confirm-status/);

  const detail = await requestDetailPage(queueFixture(), 31, ADMIN);
  const depositForm = [...detail.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)]
    .map((match) => match[0])
    .find((form) => /action="\/request\/status"/.test(form) && /name="status" value="deposit_paid"/.test(form)) || "";
  assert.match(depositForm.match(/^<form\b[^>]*>/)?.[0] || "", /data-confirm=/);
});

test("auction controls meet the 44px touch-target minimum", () => {
  for (const selector of [".atab", ".av", ".ac-fav", ".ac-sheet", ".ac-req"] ) {
    const rule = cssRule(selector);
    assert.ok(rule, `${selector} has a CSS rule`);
    const has44Height = /(?:height|min-height|block-size|min-block-size):\s*44px/.test(rule);
    assert.ok(has44Height, `${selector} is at least 44px tall`);
  }
  for (const selector of [".av", ".ac-fav"] ) {
    const rule = cssRule(selector);
    const has44Width = /(?:width|min-width|inline-size|min-inline-size):\s*44px/.test(rule);
    assert.ok(has44Width, `${selector} is at least 44px wide`);
  }
});

test("free auction gate gives buyers a direct upgrade action", async () => {
  const env = makeEnv(`
    INSERT INTO clients (id, name, email, portal_enabled, member)
    VALUES (17, 'Jordan Buyer', 'jordan@example.com', 1, 0);
  `);
  const html = await portalAuctionsPage(env, { role: "client", id: 17 });
  assert.match(html, /(?:href|action)="\/portal\/subscribe"/);
  assert.match(html, /(?:upgrade|get full access|become a member)/i);
});
