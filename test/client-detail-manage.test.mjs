// Item 6: Archive/Delete are discoverable from the customer detail page, not
// just the Customers-list row menu (during QA they weren't obvious). The actions
// use the same confirm/danger pattern as every other destructive control and are
// only shown to the record's owner or an admin.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { clientDetailPage } from "../src/admin.js";

const ADMIN = { role: "admin", id: 0 };

function seed(extra = "") {
  return makeEnv(`
    INSERT INTO users (id,email,name,pass_salt,pass_hash,active, type) VALUES (5,'ag@x','Ag','s','h',1, 'agent'), (6,'ag2@x','Ag2','s','h',1, 'agent');
    INSERT INTO users (id,name,email,agent_id,archived) VALUES (10,'Alice Apple','a@x.com',5,0);
    ${extra}
  `);
}

test("admin sees the Manage card with Archive and Delete on the detail page", async () => {
  const html = await clientDetailPage(seed(), 10, ADMIN);
  assert.match(html, /MANAGE CUSTOMER/);
  assert.match(html, /action="\/client\/archive"/, "archive action present");
  assert.match(html, /action="\/client\/delete"/, "delete action present");
  // Delete carries the destructive confirmation.
  const del = html.slice(html.indexOf('action="/client/delete"'));
  assert.match(del.slice(0, 300), /data-danger/);
  assert.match(del.slice(0, 400), /data-confirm="Delete Alice Apple/);
});

test("an archived customer shows Restore instead of Archive", async () => {
  const env = seed();
  env.db.exec("UPDATE users SET archived = 1 WHERE id = 10;");
  const html = await clientDetailPage(env, 10, ADMIN);
  assert.match(html, /action="\/client\/unarchive"/, "restore action present");
  assert.match(html, /Restore from archive/);
  assert.doesNotMatch(html, /action="\/client\/archive"/, "no archive action when already archived");
});

test("the owning agent sees the Manage card", async () => {
  const html = await clientDetailPage(seed(), 10, { role: "agent", id: 5 });
  assert.match(html, /MANAGE CUSTOMER/);
  assert.match(html, /action="\/client\/delete"/);
});

test("a non-owner agent does not see the Manage card", async () => {
  const html = await clientDetailPage(seed(), 10, { role: "agent", id: 6 });
  assert.doesNotMatch(html, /MANAGE CUSTOMER/);
});
