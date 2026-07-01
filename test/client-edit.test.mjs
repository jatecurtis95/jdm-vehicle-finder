// Editing an existing client's contact details: the updateClient data function
// (validation, access control, duplicate guard) and the edit form on the client
// detail page.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { createClient, updateClient, clientDetailPage } from "../src/admin.js";
import { normalizeState } from "../src/calc.js";

const fd = (obj) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
};
const ADMIN = { role: "admin", id: 0 };

async function seed(env, fields, session = ADMIN) {
  const r = await createClient(env, fd(fields), session);
  return r.id;
}

test("updateClient edits name, email, whatsapp and state", async () => {
  const env = makeEnv();
  const id = await seed(env, { name: "Old Name", email: "old@example.com" });
  const r = await updateClient(env, fd({ id, name: "New Name", email: "new@example.com", whatsapp: "0400111222", state: "vic" }), ADMIN);
  assert.equal(r.ok, true);
  const row = await env.DB.prepare("SELECT name,email,whatsapp,state FROM clients WHERE id=?").bind(id).first();
  assert.equal(row.name, "New Name");
  assert.equal(row.email, "new@example.com");
  assert.equal(row.whatsapp, "0400111222");
  assert.equal(row.state, normalizeState("vic"));
});

test("updateClient requires a name", async () => {
  const env = makeEnv();
  const id = await seed(env, { name: "Keep Me", email: "keep@example.com" });
  const r = await updateClient(env, fd({ id, name: "  ", email: "keep@example.com" }), ADMIN);
  assert.equal(r.ok, false);
  assert.equal(r.error, "name");
  const row = await env.DB.prepare("SELECT name FROM clients WHERE id=?").bind(id).first();
  assert.equal(row.name, "Keep Me", "name unchanged after a rejected edit");
});

test("updateClient requires at least one contact channel", async () => {
  const env = makeEnv();
  const id = await seed(env, { name: "Reachable", email: "r@example.com" });
  const r = await updateClient(env, fd({ id, name: "Reachable", email: "", whatsapp: "" }), ADMIN);
  assert.equal(r.ok, false);
  assert.equal(r.error, "contact");
});

test("updateClient lets you keep the same email (self-match is not a duplicate)", async () => {
  const env = makeEnv();
  const id = await seed(env, { name: "Same", email: "same@example.com" });
  const r = await updateClient(env, fd({ id, name: "Same Renamed", email: "same@example.com" }), ADMIN);
  assert.equal(r.ok, true);
});

test("updateClient refuses a change that collides with another client", async () => {
  const env = makeEnv();
  const a = await seed(env, { name: "Alice", email: "alice@example.com" });
  await seed(env, { name: "Bob", email: "bob@example.com" });
  const r = await updateClient(env, fd({ id: a, name: "Alice", email: "bob@example.com" }), ADMIN);
  assert.equal(r.ok, false);
  assert.equal(r.error, "duplicate");
  const row = await env.DB.prepare("SELECT email FROM clients WHERE id=?").bind(a).first();
  assert.equal(row.email, "alice@example.com", "the colliding email was not saved");
});

test("updateClient blocks a non-owner agent and allows the owner/admin", async () => {
  const env = makeEnv();
  const owner = { role: "agent", id: 7 };
  const stranger = { role: "agent", id: 9 };
  const id = await seed(env, { name: "Owned", email: "owned@example.com" }, owner);

  const blocked = await updateClient(env, fd({ id, name: "Hacked", email: "owned@example.com" }), stranger);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error, "forbidden");

  const byOwner = await updateClient(env, fd({ id, name: "Owner Edit", email: "owned@example.com" }), owner);
  assert.equal(byOwner.ok, true);
  const byAdmin = await updateClient(env, fd({ id, name: "Admin Edit", email: "owned@example.com" }), ADMIN);
  assert.equal(byAdmin.ok, true);
});

test("updateClient won't strip the email while the buyer portal is enabled", async () => {
  const env = makeEnv();
  const id = await seed(env, { name: "Portal User", email: "portal@example.com" });
  await env.DB.prepare("UPDATE clients SET portal_enabled=1 WHERE id=?").bind(id).run();
  const r = await updateClient(env, fd({ id, name: "Portal User", email: "", whatsapp: "0400111222" }), ADMIN);
  assert.equal(r.ok, false);
  assert.equal(r.error, "portal_email");
});

test("the client detail page shows an Edit details form prefilled with current values", async () => {
  const env = makeEnv();
  const id = await seed(env, { name: "Editable Person", email: "edit@example.com", whatsapp: "0400111222" });
  const html = await clientDetailPage(env, id, ADMIN);
  assert.match(html, /action="\/client\/update"/, "edit form posts to the update route");
  assert.match(html, /value="Editable Person"/, "name is prefilled");
  assert.match(html, /value="edit@example.com"/, "email is prefilled");
  assert.match(html, /name="whatsapp"/, "whatsapp field present");
});
