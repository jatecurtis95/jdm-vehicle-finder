// Item 1: deploy-time schema gate. scripts/check-remote-schema.mjs derives the
// schema the code expects from the migration files, reads production's live
// schema, and blocks the deploy if production is missing any table/column - so a
// deploy can never race ahead of a manually-applied migration again.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  expectedSchemaFromMigrations, rowsToSchema, diffSchema, parseWranglerJson,
} from "../scripts/check-remote-schema.mjs";

test("expected schema is built from the migrations and includes the drift-prone columns", () => {
  const s = expectedSchemaFromMigrations();
  // Core tables from the baseline.
  for (const t of ["clients", "wishlists", "queue", "seen_lots", "dealers", "dealer_vehicles"]) {
    assert.ok(s.has(t), `expected table ${t}`);
  }
  // The exact columns whose absence in prod caused the original incident.
  assert.ok(s.get("wishlists").has("budget_aud"), "wishlists.budget_aud (migration 0014)");
  assert.ok(s.get("wishlists").has("model_code"), "wishlists.model_code (0015)");
  assert.ok(s.get("wishlists").has("grades"), "wishlists.grades (0015)");
  assert.ok(s.get("clients").has("category"), "clients.category (0011)");
  // Infra tables never count.
  assert.ok(!s.has("d1_migrations"));
  assert.ok(!s.has("sqlite_sequence"));
});

test("diffSchema reports nothing when production has everything (extra columns ok)", () => {
  const expected = rowsToSchema([{ tbl: "t", col: "a" }, { tbl: "t", col: "b" }]);
  const actual = rowsToSchema([{ tbl: "t", col: "a" }, { tbl: "t", col: "b" }, { tbl: "t", col: "extra" }, { tbl: "other", col: "z" }]);
  assert.deepEqual(diffSchema(expected, actual), []);
});

test("diffSchema flags a missing column and a missing table", () => {
  const expected = rowsToSchema([{ tbl: "wishlists", col: "id" }, { tbl: "wishlists", col: "budget_aud" }, { tbl: "dealers", col: "id" }]);
  const actual = rowsToSchema([{ tbl: "wishlists", col: "id" }]); // no budget_aud, no dealers table
  assert.deepEqual(diffSchema(expected, actual), ["dealers", "wishlists.budget_aud"]);
});

test("a production database exactly at the migrations passes the gate", () => {
  const expected = expectedSchemaFromMigrations();
  // Simulate prod being identical to the migrations.
  const rows = [];
  for (const [tbl, cols] of expected) for (const col of cols) rows.push({ tbl, col });
  assert.deepEqual(diffSchema(expected, rowsToSchema(rows)), []);
});

test("a production database missing migration 0015 is caught", () => {
  const expected = expectedSchemaFromMigrations();
  const rows = [];
  for (const [tbl, cols] of expected) for (const col of cols) {
    if (tbl === "wishlists" && (col === "model_code" || col === "grades")) continue; // 0015 not applied
    rows.push({ tbl, col });
  }
  const missing = diffSchema(expected, rowsToSchema(rows));
  assert.deepEqual(missing, ["wishlists.grades", "wishlists.model_code"]);
});

test("parseWranglerJson pulls rows out of the wrangler --json envelope", () => {
  const out = 'some banner line\n[{"results":[{"tbl":"clients","col":"id"}],"success":true,"meta":{}}]\n';
  assert.deepEqual(parseWranglerJson(out), [{ tbl: "clients", col: "id" }]);
});

test("parseWranglerJson reads a PRAGMA table_info result (column names live under .name)", () => {
  // This is the real shape the remote check consumes: D1 blocks the
  // pragma_table_info() table-valued function (SQLITE_AUTH 7500), so the script
  // runs `PRAGMA table_info(<table>)` per table and maps each row's `name`.
  const out = '[{"results":[{"cid":0,"name":"id","type":"INTEGER"},{"cid":1,"name":"budget_aud","type":"INTEGER"}],"success":true,"meta":{}}]';
  const cols = parseWranglerJson(out).map((r) => r.name);
  assert.deepEqual(cols, ["id", "budget_aud"]);
});
