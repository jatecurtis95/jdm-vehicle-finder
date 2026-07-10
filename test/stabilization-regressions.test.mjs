import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv, readFile } from "./helpers/d1.mjs";
import { runWishlist } from "../src/matcher.js";
import { adminPage, dealerPortalPage } from "../src/admin.js";

const ADMIN = { role: "admin", id: 0 };

function feedXml(lots) {
  return `<aj>${lots.map((lot) => `<row>${Object.entries(lot)
    .map(([key, value]) => `<${key}>${value}</${key}>`).join("")}</row>`).join("")}</aj>`;
}

test("a partially full queue still reaches affordable candidates after expensive ones", async () => {
  const env = makeEnv(`
    INSERT INTO clients (id, name, email, state) VALUES (1, 'Buyer', 'buyer@example.com', 'VIC');
    INSERT INTO wishlists (id, client_id, marka_name, model_name, active, budget_aud)
      VALUES (1, 1, 'NISSAN', 'SKYLINE', 1, 40000);
    INSERT INTO settings (key, value) VALUES ('calc_fx_jpy_aud', '95');
  `);
  env.CALC_API = "https://calculator.test/api/calc";
  env.CALC_DEFAULT_STATE = "VIC";

  // Leave only ten queue slots. The first ten feed rows are over budget; the
  // next fifteen are affordable and must not be starved by the capacity slice.
  const pending = env.db.prepare(
    "INSERT INTO queue (wishlist_id, client_id, lot_id, lot_json, status, token) VALUES (1, 1, ?, '{}', 'pending', ?)"
  );
  for (let i = 0; i < 30; i++) pending.run(`OLD-${i}`, `old-token-${i}`);

  const lots = Array.from({ length: 25 }, (_, i) => ({
    id: `FRESH-${i}`,
    marka_name: "NISSAN",
    model_name: "SKYLINE",
    year: 1999,
    kuzov: "BNR34",
    rate: "4.5",
    start: 5000000 + i,
    avg_price: 5000000 + i,
    auction_date: `2099-01-${String(i + 1).padStart(2, "0")} 10:00:00`,
  }));

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).startsWith(env.CALC_API)) {
      const price = Number(JSON.parse(init.body).jpyPrice);
      const expensive = price < 5000010;
      return { ok: true, json: async () => ({ calc: { grandTotal: expensive ? 90000 : 30000 } }) };
    }
    return { ok: true, status: 200, text: async () => feedXml(lots) };
  };
  try {
    const queued = await runWishlist(env, {
      id: 1, client_id: 1, marka_name: "NISSAN", model_name: "SKYLINE",
      client_state: "VIC", budget_aud: 40000,
    }, { budgetFilter: true, budgetHeadroom: 10 });
    assert.equal(queued.length, 10, "all remaining queue slots are filled with affordable cars");
    assert.ok(queued.every(({ lot }) => Number(lot._landed?.grandTotal) === 30000));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("the request wizard does not scroll the active step during initial render", () => {
  const src = readFile("src/request-wizard.js");
  assert.match(src, /function render\(shouldScroll\)/, "render distinguishes initial load from step navigation");
  assert.match(src, /if\(shouldScroll&&a\.scrollIntoView\)/, "scrolling only happens after explicit navigation");
  assert.match(src, /render\(false\);/, "initial render preserves the top-of-page introduction");
});

test("dealer management and submissions render inside the shared admin shell", async () => {
  const env = makeEnv();
  for (const view of ["dealers", "dealer-submissions"]) {
    const html = await adminPage(env, view, ADMIN, { dealerStatus: "pending" });
    assert.match(html, /<aside class="side">/, `${view} keeps admin navigation`);
    assert.match(html, /href="\/admin\?view=dealers"/, `${view} exposes dealer management navigation`);
    assert.match(html, /href="\/admin\?view=dealer-submissions"/, `${view} exposes submissions navigation`);
    assert.doesNotMatch(html, /min-width:\s*1000px/, `${view} has no fixed desktop-only minimum width`);
  }
});

test("the dealer portal uses the shared branded shell and collapses forms on phones", async () => {
  const env = makeEnv(`INSERT INTO dealers (id, email, name, company, pass_salt, pass_hash, active) VALUES (1, 'dealer@example.com', 'Dealer One', 'Demo Cars', 'salt', 'hash', 1);`);
  const html = await dealerPortalPage(env, { id: 1, name: "Dealer One", email: "dealer@example.com", company: "Demo Cars", active: 1 });
  assert.match(html, /<aside class="side">/, "dealer portal keeps the shared navigation shell");
  assert.match(html, /href="\/dealer"/, "dealer home is reachable from its navigation");
  assert.match(html, /@media\(max-width:640px\)[^{]*\{[^}]*\.dealer-form-grid\{grid-template-columns:1fr/s, "vehicle form becomes one column on phones");
  assert.doesNotMatch(html, /body \{ font-family: -apple-system/, "legacy standalone stylesheet is gone");
});

test("local QA scripts resolve npx cross-platform and worst-case data layers over the normal seed", () => {
  const reset = readFile("scripts/qa-reset.mjs");
  const schema = readFile("scripts/check-remote-schema.mjs");
  assert.match(reset, /wranglerCli/, "QA reset resolves Wrangler's local JavaScript CLI");
  assert.match(schema, /wranglerCli/, "schema checks resolve Wrangler's local JavaScript CLI");
  assert.match(reset, /run\(process\.execPath/, "QA reset launches Wrangler through Node itself");
  assert.match(schema, /execFileSync\(process\.execPath/, "schema checks launch Wrangler through Node itself");
  assert.doesNotMatch(reset, /run\("npx"/, "QA reset never directly spawns npx on Windows");
  assert.doesNotMatch(schema, /execFileSync\("npx"/, "schema check never directly spawns npx on Windows");
  assert.match(reset, /seed\/seed-dev\.sql[\s\S]*seed\/seed-worstcase\.sql/, "worst-case mode loads the base seed before its overlay");
});

test("the deploy workflow runs the full test suite before deploying", () => {
  const workflow = readFile(".github/workflows/deploy.yml");
  const testsAt = workflow.indexOf("npm test");
  const browserAt = workflow.indexOf("npm run test:e2e");
  const deployAt = workflow.indexOf("Deploy Worker");
  assert.ok(testsAt > -1, "workflow runs npm test");
  assert.ok(browserAt > testsAt, "workflow runs a browser smoke test after unit regressions");
  assert.ok(deployAt > browserAt, "all tests run before deployment");
});

test("README setup commands reference the migration files that actually exist", () => {
  const readme = readFile("README.md");
  assert.doesNotMatch(readme, /migrate-portal\.sql|--file schema\.sql|relay\/jdm-relay\.php/);
  assert.match(readme, /d1 migrations apply jdm-vehicle-finder --remote/);
});
