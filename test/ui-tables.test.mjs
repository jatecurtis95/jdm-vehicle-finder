// Standard list-table niceties: every long admin list gets a live search/filter
// box wired to the shared jdmFilterTable handler.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { adminPage } from "../src/admin.js";

const ADMIN = { role: "admin", id: 0 };

test("the Clients list has a search box wired to the filter handler", async () => {
  const env = makeEnv(`INSERT INTO users (id,name,email,state) VALUES (1,'Alice','a@x','VIC'),(2,'Bob','b@x','NSW');`);
  const html = await adminPage(env, "clients", ADMIN);
  assert.match(html, /class="tbl-search"/, "renders a search input");
  assert.match(html, /id="clientsTbl"/, "the table is targetable");
  assert.match(html, /function jdmFilterTable/, "the global filter handler ships");
  assert.match(html, /jdmSelectAllVisible/, "select-all respects the filter");
});

test("the Payments list has a search box", async () => {
  const env = makeEnv(`INSERT INTO users (id,name) VALUES (1,'Alice');
    INSERT INTO payments (client_id,amount_cents,currency,status,description) VALUES (1,50000,'aud','paid','Deposit');`);
  const html = await adminPage(env, "payments", ADMIN);
  assert.match(html, /id="paymentsTbl"/);
  assert.match(html, /class="tbl-search"/);
});

// Below 640px the wide tables swap for server-rendered card lists (both are in
// the HTML; CSS toggles). Requests, Customers, Agents and Payments all ship one.
test("list views ship a mobile card list beside the desktop table", async () => {
  const env = makeEnv(`
    INSERT INTO agents (id,email,name,pass_salt,pass_hash) VALUES (1,'a@x','Agent A','s','h');
    INSERT INTO users (id,name,email,state,agent_id) VALUES (1,'Alice','a@x','VIC',1);
    INSERT INTO searches (id,client_id,label,marka_name,status,last_activity) VALUES (1,1,'R34','NISSAN','new',datetime('now'));
    INSERT INTO payments (client_id,amount_cents,currency,status,description,stripe_session) VALUES (1,50000,'aud','paid','Deposit','cs_test_a1b2c3d4e5f6g7h8i9j0');
  `);
  for (const view of ["requests", "clients", "agents", "payments"]) {
    const html = await adminPage(env, view, ADMIN);
    assert.match(html, /class="mcl"/, `${view} has the mobile card list`);
    assert.match(html, /class="card tbl-desk"/, `${view} table is desktop-scoped`);
  }
  // Requests mobile card carries the stage chip, REQ ref and activity time.
  const req = await adminPage(env, "requests", ADMIN);
  assert.match(req, /mcl-row[^>]*data-st="new"/, "stage on the card for the pipeline filter");
  assert.match(req, /REQ-1/, "request reference");
  // Payments: session ids are truncated with a copy control, not overflowing.
  const pay = await adminPage(env, "payments", ADMIN);
  assert.match(pay, /cs_test_a1b2c3d4e5f6g7h8i9j0/, "full id available to copy");
  assert.match(pay, /data-sess=/, "copy button present");
});
