// Phase 4 CRM autopilot: the pipeline feeds itself from events that already
// happen (sends, responses, contact taps, payments) with zero manual entry.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { recordMatchSent, autoFollowUps, logContactTap, adminPage, clientDetailPage, clientDrawerFragment } from "../src/admin.js";

const ADMIN = { role: "admin", id: 0 };
const BASE = `
  INSERT INTO users (id,name,email,state) VALUES (1,'Jordan Buyer','j@x.com','VIC');
  INSERT INTO searches (id,client_id,label,marka_name,status) VALUES (1,1,'R34 hunt','NISSAN','new');
`;

test("first lot sent auto-advances a new request to Vehicles sent and seeds a follow-up", async () => {
  const env = makeEnv(BASE + `
    INSERT INTO queue (id,wishlist_id,client_id,lot_id,lot_json,status,token) VALUES
      (10,1,1,'L1','{"year":1999,"marka_name":"NISSAN","model_name":"SKYLINE"}','sent','t1');
  `);
  await recordMatchSent(env, 10, ADMIN);
  const w = await env.DB.prepare("SELECT status FROM searches WHERE id = 1").first();
  assert.equal(w.status, "vehicles_sent", "request moved forward automatically");
  const t = await env.DB.prepare("SELECT * FROM tasks WHERE wishlist_id = 1 AND status != 'done'").first();
  assert.ok(t, "a follow-up task was seeded");
});

test("a manually chosen later stage is never overwritten by a send", async () => {
  const env = makeEnv(BASE + `
    UPDATE searches SET status = 'deposit_paid' WHERE id = 1;
    INSERT INTO queue (id,wishlist_id,client_id,lot_id,lot_json,status,token) VALUES
      (10,1,1,'L1','{"marka_name":"NISSAN"}','sent','t1');
  `);
  await recordMatchSent(env, 10, ADMIN);
  const w = await env.DB.prepare("SELECT status FROM searches WHERE id = 1").first();
  assert.equal(w.status, "deposit_paid", "manual override wins");
});

test("autoFollowUps creates one task for sent-but-unopened cars, idempotently", async () => {
  const env = makeEnv(BASE + `
    INSERT INTO queue (id,wishlist_id,client_id,lot_id,lot_json,status,token,sent_at) VALUES
      (10,1,1,'L1','{}','sent','t1',datetime('now','-4 days')),
      (11,1,1,'L2','{}','sent','t2',datetime('now','-5 days'));
  `);
  const created = await autoFollowUps(env);
  assert.equal(created, 1, "one task per request, not per car");
  const again = await autoFollowUps(env);
  assert.equal(again, 0, "no duplicate while a follow-up is open");
  const t = await env.DB.prepare("SELECT title, type, due_date FROM tasks WHERE wishlist_id = 1").first();
  assert.match(t.title, /unopened for 3 days/);
  assert.equal(t.type, "follow_up");
});

test("autoFollowUps skips cars that were opened or answered", async () => {
  const env = makeEnv(BASE + `
    INSERT INTO queue (id,wishlist_id,client_id,lot_id,lot_json,status,token,sent_at,viewed_at) VALUES
      (10,1,1,'L1','{}','sent','t1',datetime('now','-4 days'),datetime('now','-3 days'));
  `);
  assert.equal(await autoFollowUps(env), 0);
});

test("logContactTap writes an access-checked activity row", async () => {
  const env = makeEnv(BASE);
  const r = await logContactTap(env, 1, "whatsapp", ADMIN);
  assert.equal(r.ok, true);
  const a = await env.DB.prepare("SELECT type, detail FROM activity WHERE client_id = 1").first();
  assert.equal(a.type, "contact");
  assert.match(a.detail, /WhatsApp/);
  // A foreign agent cannot log against a client they cannot see.
  await env.DB.prepare("INSERT INTO agents (id,email,name,pass_salt,pass_hash) VALUES (9,'x@x','X','','')").run();
  const deny = await logContactTap(env, 1, "call", { role: "agent", id: 9 });
  assert.equal(deny.ok, false);
});

test("the Customers list shows a derived last-contact dot from sends and contact taps", async () => {
  const env = makeEnv(BASE + `
    INSERT INTO queue (id,wishlist_id,client_id,lot_id,lot_json,status,token,sent_at) VALUES
      (10,1,1,'L1','{}','sent','t1',datetime('now','-1 days'));
  `);
  const html = await adminPage(env, "clients", ADMIN);
  assert.match(html, /Last contact/, "column present");
  assert.match(html, /health-green/, "recent send shows a green dot");
});

test("client detail merges sends, notes, payments and logins into one feed plus sent-lot history", async () => {
  const env = makeEnv(BASE + `
    UPDATE users SET last_seen = datetime('now','-1 days') WHERE id = 1;
    INSERT INTO queue (id,wishlist_id,client_id,lot_id,lot_json,status,token,sent_at,viewed_at,response,decided_at) VALUES
      (10,1,1,'L1','{"year":1999,"marka_name":"NISSAN","model_name":"SKYLINE"}','sent','t1',datetime('now','-2 days'),datetime('now','-1 days'),'interested',datetime('now','-2 days'));
    INSERT INTO activity (client_id, wishlist_id, type, detail, actor) VALUES (1, 1, 'note', 'Called about shipping', 'JDM Connect');
    INSERT INTO payments (client_id, amount_cents, currency, status, paid_at) VALUES (1, 50000, 'aud', 'paid', datetime('now'));
  `);
  globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => "<aj></aj>" });
  const html = await clientDetailPage(env, 1, ADMIN, { search: {} });
  assert.match(html, /Sent and past cars/, "sent-lot history card");
  assert.match(html, /Interested/, "response state visible");
  assert.match(html, /Called about shipping/, "notes in the feed");
  assert.match(html, /Payment paid: A\$500/, "payments in the feed");
  assert.match(html, /Signed in to the portal/, "portal login in the feed");
});

test("the drawer shows derived last-contacted and a distinct Interested badge", async () => {
  const env = makeEnv(BASE + `
    INSERT INTO queue (id,wishlist_id,client_id,lot_id,lot_json,status,token,sent_at,response) VALUES
      (10,1,1,'L1','{}','sent','t1',datetime('now','-1 days'),'interested');
  `);
  const html = await clientDrawerFragment(env, 1, ADMIN);
  assert.match(html, /Last contacted/);
  assert.match(html, /health-green/);
  assert.match(html, /chip chip-good">Interested/, "Interested styled distinctly from Viewed");
});
