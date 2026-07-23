// Every admin page renders within the shared frame and uses sentence-case
// labels (no ALL CAPS), so the pages visibly belong to one product.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv, readFile } from "./helpers/d1.mjs";
import { adminPage, portalPage } from "../src/admin.js";
import { landingPage } from "../src/landing.js";

// Unicode em dash, en dash, and friends are banned in UI copy across the app.
const FORBIDDEN_DASH = /[‒–—―−]/;

const ADMIN = { role: "admin", id: 0 };
const ALL_CAPS_LABEL = /<label[^>]*>\s*[A-Z][A-Z ]{2,}(?:<|\s)/;

for (const view of ["dashboard", "clients", "wishlists", "agents", "payments", "settings"]) {
  test(`admin page "${view}" renders in the shared frame with no ALL CAPS labels`, async () => {
    const env = makeEnv(readFile("seed/seed-dev.sql"));
    const html = await adminPage(env, view, ADMIN);
    assert.match(html, /<!doctype html|<aside class="side"/i, "renders the app frame");
    assert.ok(!ALL_CAPS_LABEL.test(html), "no shouty ALL CAPS <label> text");
  });
}

test("the Clients list uses colour-coded avatars from the shared palette", async () => {
  const env = makeEnv(readFile("seed/seed-dev.sql"));
  const html = await adminPage(env, "clients", ADMIN);
  assert.match(html, /class="avatar" style="background:#/, "avatar has a hashed colour");
});

test("gold accent token matches the dark brand gold across the admin", async () => {
  const env = makeEnv(readFile("seed/seed-dev.sql"));
  const html = await adminPage(env, "dashboard", ADMIN);
  // Admin runs the same dark-luxury palette as the public pages (theme.js).
  assert.match(html, /--gold:#CAA34C/);
});

test("settings page exposes the WhatsApp auto-send toggle and provider select", async () => {
  const env = makeEnv(readFile("seed/seed-dev.sql"));
  const html = await adminPage(env, "settings", ADMIN);
  assert.match(html, /id="set-whatsapp"/, "WhatsApp settings card present");
  assert.match(html, /name="whatsapp_enabled"/, "on/off toggle present");
  assert.match(html, /name="whatsapp_provider"/, "provider select present");
  assert.ok(!FORBIDDEN_DASH.test(html), "no em or en dashes in settings copy");
});

test("the public landing page explains the service and links to start a search and to sign in", async () => {
  const env = makeEnv(readFile("seed/seed-dev.sql"));
  const html = await landingPage(env);
  assert.match(html, /<!doctype html/i, "renders a full document");
  // It is a real home, not the bare form: value prop + how-it-works present.
  assert.match(html, /How it works/i, "explains how it works");
  // Both entry paths a visitor needs are present and reachable.
  assert.match(html, /href="\/request"/, "a path to start a request");
  assert.match(html, /href="\/login"/, "a path to sign in");
  // Offer copy is aligned: Free + a single A$49 Full-access plan; no stale tiers.
  assert.match(html, /A\$49/, "shows the Full-access price");
  assert.ok(!/founding|importer|A\$19|A\$12|A\$39|first 100/i.test(html), "no stale/contradictory pricing");
  // Membership info answers the "is there a cost / can I sign up" question.
  assert.match(html, /Membership/i, "membership section");
  assert.ok(!FORBIDDEN_DASH.test(html), "no em or en dashes in the copy");
});

test("landing page reflects a changed membership price from settings", async () => {
  const env = makeEnv(`INSERT INTO settings (key,value) VALUES ('membership_monthly_aud','39');`);
  const html = await landingPage(env);
  assert.match(html, /A\$39/, "price is driven by the setting");
  assert.ok(!/A\$49/.test(html), "old default not shown once overridden");
});

test("the buyer portal shows an at-a-glance summary with real per-client counts", async () => {
  const env = makeEnv(`
    INSERT INTO users (id,name,portal_enabled) VALUES (1,'Jordan',1);
    INSERT INTO searches (id,client_id,label,active) VALUES (1,1,'R34',1),(2,1,'Daily',1),(3,1,'Rotary',0);
    INSERT INTO queue (id,wishlist_id,client_id,lot_id,lot_json,status,token,client_request) VALUES
      (10,1,1,'L1','{"year":1999,"marka_name":"NISSAN","model_name":"SKYLINE"}','sent','t1',0),
      (11,1,1,'L2','{"year":1999,"marka_name":"NISSAN","model_name":"SKYLINE"}','sent','t2',1),
      (12,2,1,'L3','{"year":2018,"marka_name":"TOYOTA","model_name":"PRIUS"}','sent','t3',0);
  `);
  const html = await portalPage(env, { role: "client", id: 1 });
  assert.match(html, /class="pstats"/, "renders the dashboard summary");
  // 3 sent cars, 1 already in progress -> 2 awaiting; 2 of 3 searches active.
  assert.match(html, /New for you<\/div><div class="pv" data-count="2"/, "awaiting count");
  assert.match(html, /Cars found<\/div><div class="pv" data-count="3"/, "cars-found count");
  assert.match(html, /In progress<\/div><div class="pv" data-count="1"/, "in-progress count");
  assert.match(html, /Active searches<\/div><div class="pv" data-count="2"/, "active-searches count");
  assert.ok(!ALL_CAPS_LABEL.test(html), "no shouty <label> text");
});

test("the Matches page renders the queue rows and keeps the bulk-select contract", async () => {
  const env = makeEnv(readFile("seed/seed-dev.sql"));
  const html = await adminPage(env, "matches", ADMIN);
  assert.match(html, /class="mticker"/, "divided stat ticker");
  assert.match(html, /class="mcard scard"/, "queue row keeps the mcard hook for the JS");
  assert.match(html, /class="sc-for"/, "client attribution line on the row");
  // The filter/sort/bulk JS depends on these, so the redesign must preserve them.
  assert.match(html, /class="msel"/, "per-card select checkbox");
  assert.match(html, /class="btn-primary btn-sm"/, "approve link the JS binds to");
  assert.match(html, /data-str=/, "strength data attr for filtering");
  assert.ok(!ALL_CAPS_LABEL.test(html), "no shouty <label> text");
});
