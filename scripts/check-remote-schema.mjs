#!/usr/bin/env node
// Deploy safety gate (QA follow-up item 1). Production deploys happen on push to
// main, but D1 migrations are applied manually (the migrations runner's tracking
// table was never adopted in prod - see migrations/README.md). That let code
// ship that referenced columns which did not yet exist in production.
//
// This script closes the gap by VERIFYING, before every deploy, that production
// already has every table and column the migrations define. The migration files
// are the source of truth: we apply them to a throwaway in-memory SQLite to get
// the schema the code expects, read production's live schema with wrangler, and
// fail the deploy if production is missing anything. Extra columns in production
// are fine and ignored. Applying migrations to production stays a deliberate,
// approved step (npm run db:migrate:remote or the Apply-pending-columns workflow);
// this only ever blocks a deploy from racing ahead of that step.
//
// Usage:
//   node scripts/check-remote-schema.mjs                 # check --remote (needs CLOUDFLARE_API_TOKEN)
//   node scripts/check-remote-schema.mjs --local         # check the local D1 instead
//   node scripts/check-remote-schema.mjs --actual-json f  # diff against a captured JSON (tests/offline)
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const DB_NAME = "jdm-vehicle-finder";

// Tables that are infrastructure, not application schema, and must never count
// as "expected" or "missing".
const IGNORE_TABLE = (name) =>
  !name || name.startsWith("sqlite_") || name.startsWith("_cf_") || name === "d1_migrations";

// Build the schema the code expects by applying every numbered migration in
// order to a fresh in-memory database - exactly what test/helpers/d1.mjs does,
// so "expected" here is identical to the schema the test suite runs against.
export function expectedSchemaFromMigrations() {
  const db = new DatabaseSync(":memory:");
  const migDir = resolve(ROOT, "migrations");
  const files = readdirSync(migDir).filter((f) => /^\d+.*\.sql$/.test(f)).sort();
  for (const f of files) db.exec(readFileSync(resolve(migDir, f), "utf8"));
  const rows = db.prepare(
    `SELECT m.name AS tbl, ti.name AS col
       FROM sqlite_master m
       JOIN pragma_table_info(m.name) ti
      WHERE m.type = 'table'`
  ).all();
  db.close();
  return rowsToSchema(rows);
}

// Turn [{tbl, col}, ...] into Map<table, Set<column>>, dropping infra tables.
export function rowsToSchema(rows) {
  const schema = new Map();
  for (const r of rows || []) {
    const tbl = r.tbl ?? r.table ?? r.name;
    const col = r.col ?? r.column;
    if (IGNORE_TABLE(tbl) || !col) continue;
    if (!schema.has(tbl)) schema.set(tbl, new Set());
    schema.get(tbl).add(col);
  }
  return schema;
}

// Everything in `expected` that `actual` lacks, as "table" or "table.column"
// strings. Extra tables/columns in `actual` are ignored.
export function diffSchema(expected, actual) {
  const missing = [];
  for (const [tbl, cols] of expected) {
    if (!actual.has(tbl)) { missing.push(tbl); continue; }
    const have = actual.get(tbl);
    for (const c of cols) if (!have.has(c)) missing.push(`${tbl}.${c}`);
  }
  return missing.sort();
}

// The query that reads a D1 database's table/column layout. pragma_table_info is
// a table-valued function SQLite/D1 both support.
const SCHEMA_SQL =
  "SELECT m.name AS tbl, ti.name AS col FROM sqlite_master m " +
  "JOIN pragma_table_info(m.name) ti WHERE m.type = 'table'";

// Pull the schema rows out of `wrangler d1 execute --json` output. wrangler
// prints an array of result objects; the rows live under [0].results.
export function parseWranglerJson(stdout) {
  const start = stdout.indexOf("[");
  if (start === -1) throw new Error("no JSON array in wrangler output:\n" + stdout);
  const parsed = JSON.parse(stdout.slice(start));
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  return (first && first.results) || [];
}

function fetchRemoteSchema(local) {
  const args = ["wrangler", "d1", "execute", DB_NAME, local ? "--local" : "--remote", "--json", "--command", SCHEMA_SQL];
  const stdout = execFileSync("npx", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  return rowsToSchema(parseWranglerJson(stdout));
}

function main() {
  const argv = process.argv.slice(2);
  const local = argv.includes("--local");
  const actualJsonIdx = argv.indexOf("--actual-json");

  const expected = expectedSchemaFromMigrations();
  let actual;
  if (actualJsonIdx !== -1) {
    const file = argv[actualJsonIdx + 1];
    actual = rowsToSchema(parseWranglerJson(readFileSync(file, "utf8")));
  } else {
    actual = fetchRemoteSchema(local);
  }

  const missing = diffSchema(expected, actual);
  if (missing.length) {
    console.error("✗ Production schema is behind the migrations. Missing:");
    for (const m of missing) console.error("    - " + m);
    console.error(
      "\nApply the outstanding migrations to production BEFORE deploying, e.g.\n" +
      "  npm run db:migrate:remote        (if the migrations runner is adopted), or\n" +
      "  wrangler d1 execute " + DB_NAME + " --remote --file migrations/<file>.sql\n" +
      "  (see migrations/README.md - the tracking table is out of sync in prod).\n"
    );
    process.exit(1);
  }
  console.log(`✓ Production schema is up to date: ${expected.size} tables verified.`);
}

// Only run the CLI when invoked directly, so tests can import the helpers.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
