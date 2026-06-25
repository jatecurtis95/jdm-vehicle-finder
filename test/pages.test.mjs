// Every admin page renders within the shared frame and uses sentence-case
// labels (no ALL CAPS), so the pages visibly belong to one product.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv, readFile } from "./helpers/d1.mjs";
import { adminPage } from "../src/admin.js";
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

test("gold accent token is the brief value across the admin", async () => {
  const env = makeEnv(readFile("seed/seed-dev.sql"));
  const html = await adminPage(env, "dashboard", ADMIN);
  assert.match(html, /--gold:#C9962F/);
});

test("the public landing page explains the service and links to start a search and to sign in", async () => {
  const env = makeEnv(readFile("seed/seed-dev.sql"));
  const html = landingPage(env);
  assert.match(html, /<!doctype html/i, "renders a full document");
  // It is a real home, not the bare form: value prop + how-it-works present.
  assert.match(html, /How it works/i, "explains how it works");
  // Both entry paths a visitor needs are present and reachable.
  assert.match(html, /href="\/request"/, "a path to start a request");
  assert.match(html, /href="\/login"/, "a path to sign in");
  // Membership info answers the "is there a cost / can I sign up" question.
  assert.match(html, /Membership/i, "membership section");
  assert.ok(!FORBIDDEN_DASH.test(html), "no em or en dashes in the copy");
});

test("the Matches page renders the spec-sheet layout and keeps the bulk-select contract", async () => {
  const env = makeEnv(readFile("seed/seed-dev.sql"));
  const html = await adminPage(env, "matches", ADMIN);
  assert.match(html, /class="mticker"/, "divided stat ticker");
  assert.match(html, /class="mcard scard"/, "spec-sheet card keeps the mcard hook for the JS");
  assert.match(html, /Match for:/, "client strip");
  // The filter/sort/bulk JS depends on these, so the redesign must preserve them.
  assert.match(html, /class="msel"/, "per-card select checkbox");
  assert.match(html, /class="btn-notify"/, "approve link the JS binds to");
  assert.match(html, /data-str=/, "strength data attr for filtering");
  assert.ok(!ALL_CAPS_LABEL.test(html), "no shouty <label> text");
});
