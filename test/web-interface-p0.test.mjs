import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import worker from "../src/index.js";
import { adminPage, lotDetailPage, portalPage, requestPage } from "../src/admin.js";

const ADMIN = { role: "admin", id: 0 };

function envWithPendingMatch() {
  const env = makeEnv(`
    INSERT INTO clients (id,name,email,portal_enabled) VALUES (1,'Jordan','jordan@example.com',1);
    INSERT INTO wishlists (id,client_id,label,active,watch_only) VALUES (1,1,'R34',1,1);
    INSERT INTO queue (id,wishlist_id,client_id,lot_id,lot_json,status,token) VALUES
      (10,1,1,'L1','{"year":1999,"marka_name":"NISSAN","model_name":"SKYLINE","lot":"42","images":["https://img.test/car.jpg"]}','pending','tok-pending');
  `);
  env.ADMIN_TOKEN = "test-secret";
  return env;
}

test("admin views with no primary action do not render empty buttons", async () => {
  const env = makeEnv();
  for (const view of ["requests", "tasks", "search"]) {
    const html = await adminPage(env, view, ADMIN);
    assert.doesNotMatch(html, /<a class="btn-dark" href="\/admin\?view=intake">\s*<\/a>/, `${view} has no empty action link`);
  }
});

test("buyer portal stat counts have server-rendered fallback text and live regions", async () => {
  const env = makeEnv(`
    INSERT INTO clients (id,name,portal_enabled) VALUES (1,'Jordan',1);
    INSERT INTO wishlists (id,client_id,label,active) VALUES (1,1,'R34',1),(2,1,'Daily',1),(3,1,'Rotary',0);
    INSERT INTO queue (id,wishlist_id,client_id,lot_id,lot_json,status,token,client_request) VALUES
      (10,1,1,'L1','{"year":1999,"marka_name":"NISSAN","model_name":"SKYLINE"}','sent','t1',0),
      (11,1,1,'L2','{"year":1999,"marka_name":"NISSAN","model_name":"SKYLINE"}','sent','t2',1),
      (12,2,1,'L3','{"year":2018,"marka_name":"TOYOTA","model_name":"PRIUS"}','sent','t3',0);
  `);
  const html = await portalPage(env, { role: "client", id: 1 });
  assert.match(html, /New for you<\/div><div class="pv" data-count="2" aria-live="polite">2<\/div>/);
  assert.match(html, /Cars found<\/div><div class="pv" data-count="3" aria-live="polite">3<\/div>/);
  assert.match(html, /In progress<\/div><div class="pv" data-count="1" aria-live="polite">1<\/div>/);
  assert.match(html, /Active searches<\/div><div class="pv" data-count="2" aria-live="polite">2<\/div>/);
});

test("non-functional anchors are replaced or given safe default hrefs", async () => {
  const env = envWithPendingMatch();
  const lot = await lotDetailPage(env, 10, ADMIN);
  assert.match(lot, /id="shareWa"[^>]+href="https:\/\/wa\.me\/\?text=/, "WhatsApp share has a default href");

  const publicLot = await (await import("../src/admin.js")).publicLotPage(env, 10);
  assert.doesNotMatch(publicLot, /<a class="active">/, "active public tab is not a dead anchor");
  assert.match(publicLot, /aria-current="page"/);
});

test("wizard validation errors are live regions and fields describe their errors", async () => {
  const html = await requestPage(makeEnv());
  for (const id of ["rq-vehicle-error", "rq-year-error", "rq-budget-error", "rq-email-error", "rq-pass-error"]) {
    assert.match(html, new RegExp(`id="${id}"[^>]+role="alert"`), `${id} is announced`);
  }
  assert.match(html, /id="rq-maker"[^>]+aria-describedby="rq-vehicle-error"/);
  assert.match(html, /id="rq-models"[^>]+aria-describedby="rq-vehicle-error"/);
  assert.match(html, /id="rq-ymin"[^>]+aria-describedby="rq-year-error"/);
  assert.match(html, /id="rq-ymax"[^>]+aria-describedby="rq-year-error"/);
  assert.match(html, /id="rq-budget"[^>]+aria-describedby="rq-budget-error"/);
  assert.match(html, /id="rq-email"[^>]+aria-describedby="rq-email-error"/);
  assert.match(html, /id="rq-pass"[^>]+aria-describedby="rq-pass-error"/);
});

test("customer drawer has dialog semantics, live content and keyboard focus support", async () => {
  const html = await adminPage(makeEnv(), "clients", ADMIN);
  assert.match(html, /id="dwPanel"[^>]+role="dialog"[^>]+aria-modal="true"/);
  assert.match(html, /id="dwContent"[^>]+aria-live="polite"/);
  assert.match(html, /\.dw-panel\{[^}]*overscroll-behavior:contain/);
  assert.doesNotMatch(html, /id="navToggle"[^>]+aria-hidden="true"/);
  assert.match(html, /lastFocus/);
  assert.match(html, /focusable/);
});

test("approve and skip controls use POST forms and GET /decide cannot mutate state", async () => {
  const env = envWithPendingMatch();
  const html = await lotDetailPage(env, 10, ADMIN);
  assert.doesNotMatch(html, /href="\/decide\?[^"]*action=approve/);
  assert.doesNotMatch(html, /href="\/decide\?[^"]*action=reject/);
  assert.match(html, /<form method="POST" action="\/decide"[^>]*>/);
  assert.match(html, /name="action" value="approve"/);
  // The confirm states the consequence, naming the client.
  assert.match(html, /onsubmit="return confirm\('Approve and send this car to Jordan\? They get one message with this car\.'\)"/);

  const res = await worker.fetch(new Request("https://jdmfinder.com.au/decide?token=tok-pending&action=reject"), env, { waitUntil() {} });
  assert.equal(res.status, 405);
  const row = await env.DB.prepare("SELECT status FROM queue WHERE id = 10").first();
  assert.equal(row.status, "pending");
});
