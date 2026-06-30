// Standard list-table niceties: every long admin list gets a live search/filter
// box wired to the shared jdmFilterTable handler.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { adminPage } from "../src/admin.js";

const ADMIN = { role: "admin", id: 0 };

test("the Clients list has a search box wired to the filter handler", async () => {
  const env = makeEnv(`INSERT INTO clients (id,name,email,state) VALUES (1,'Alice','a@x','VIC'),(2,'Bob','b@x','NSW');`);
  const html = await adminPage(env, "clients", ADMIN);
  assert.match(html, /class="tbl-search"/, "renders a search input");
  assert.match(html, /id="clientsTbl"/, "the table is targetable");
  assert.match(html, /function jdmFilterTable/, "the global filter handler ships");
  assert.match(html, /jdmSelectAllVisible/, "select-all respects the filter");
});

test("the Payments list has a search box", async () => {
  const env = makeEnv(`INSERT INTO clients (id,name) VALUES (1,'Alice');
    INSERT INTO payments (client_id,amount_cents,currency,status,description) VALUES (1,50000,'aud','paid','Deposit');`);
  const html = await adminPage(env, "payments", ADMIN);
  assert.match(html, /id="paymentsTbl"/);
  assert.match(html, /class="tbl-search"/);
});
