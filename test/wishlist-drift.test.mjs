// Incident regression: production ran V1.2/V1.3 code before migrations 0014
// (budget_aud) and 0015 (model_code, grades) were applied to the live D1 DB, so
// every staff/portal "add search" INSERT threw "no column named model_code" and
// surfaced "Could not add that search." The write paths are now schema-drift
// tolerant: they strip a missing migration-gated column and retry, storing the
// search without that field rather than hard-failing. This test reproduces the
// missing-column state by dropping those columns, then asserts saves succeed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { createClient, createWishlist, editWishlist } from "../src/admin.js";

const ADMIN = { role: "admin", id: 0 };

function fd(obj) {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
}

// Simulate a production DB stuck a migration behind: drop the columns that
// 0014/0015 add, so the code is newer than the schema (exactly the incident).
function dropDriftColumns(env) {
  for (const col of ["budget_aud", "model_code", "grades"]) {
    env.db.exec(`ALTER TABLE wishlists DROP COLUMN ${col}`);
  }
}

test("add-search still saves when model_code/grades columns are missing (the incident)", async () => {
  const env = makeEnv();
  const c = await createClient(env, fd({ name: "Buyer", email: "drift@example.com" }), ADMIN);
  dropDriftColumns(env);

  // Before the fix this threw "no column named model_code" -> generic error.
  const r = await createWishlist(env, fd({
    client_id: String(c.id), marka_name: "NISSAN", model_name: "SKYLINE",
    model_code: "BNR32", grades: "RB,RS",
  }), undefined, ADMIN);
  assert.equal(r.ok, true, "the search saves despite the missing columns");

  const row = await env.DB.prepare("SELECT marka_name, model_name FROM wishlists WHERE client_id = ?").bind(c.id).first();
  assert.equal(row.marka_name, "NISSAN", "the core search is stored");
  assert.equal(row.model_name, "SKYLINE", "stored without the model_code/grades fields the DB can't hold yet");
});

test("edit-search still saves when the drift columns are missing", async () => {
  const env = makeEnv();
  const c = await createClient(env, fd({ name: "Buyer2", email: "drift2@example.com" }), ADMIN);
  const r = await createWishlist(env, fd({ client_id: String(c.id), marka_name: "TOYOTA", model_name: "SUPRA" }), undefined, ADMIN);
  assert.equal(r.ok, true);
  const w = await env.DB.prepare("SELECT id FROM wishlists WHERE client_id = ?").bind(c.id).first();
  dropDriftColumns(env);

  // Owner is the admin, so wishlistOwnedBy passes; the UPDATE names model_code/
  // grades which no longer exist -> must strip-and-retry, not throw.
  await editWishlist(env, fd({ id: String(w.id), marka_name: "TOYOTA", model_name: "CHASER", model_code: "JZX100" }), ADMIN);
  const row = await env.DB.prepare("SELECT model_name FROM wishlists WHERE id = ?").bind(w.id).first();
  assert.equal(row.model_name, "CHASER", "the edit is applied even without the drift columns");
});

test("with the columns present, model_code and grades are stored normally", async () => {
  const env = makeEnv();
  const c = await createClient(env, fd({ name: "Buyer3", email: "drift3@example.com" }), ADMIN);
  const r = await createWishlist(env, fd({
    client_id: String(c.id), marka_name: "HONDA", model_name: "CIVIC",
    model_code: "EK9", grades: '["R","RS"]',
  }), undefined, ADMIN);
  assert.equal(r.ok, true);
  const row = await env.DB.prepare("SELECT model_code, grades FROM wishlists WHERE client_id = ?").bind(c.id).first();
  assert.equal(row.model_code, "EK9", "when the schema is current the field is persisted, no degradation");
  assert.ok(String(row.grades).includes("R"), "grades persist when the column exists");
});
