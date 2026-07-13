#!/usr/bin/env node
// Safely adopt Wrangler's migration ledger on an existing production D1 whose
// additive schema changes were historically applied with `d1 execute`.
//
// Default: read-only audit. Add --apply only after reviewing the audit. Apply
// exports a full local SQL backup before it writes the missing ledger rows.

import { DatabaseSync } from "node:sqlite";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expectedSchemaFromMigrations, diffSchema, parseWranglerJson, rowsToSchema } from "./check-remote-schema.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const DB_NAME = "jdm-vehicle-finder";
const ACCOUNT_ID = "78a4648f57e3da163587fff349bf8b19";
const WRANGLER = resolve(ROOT, "node_modules", "wrangler", "bin", "wrangler.js");
const APPLY = process.argv.includes("--apply");
const MIGRATIONS = readdirSync(resolve(ROOT, "migrations"))
  .filter((name) => /^\d+.*\.sql$/.test(name))
  .sort();
const HISTORICAL_PENDING_FIRST = "0004_stripe_events.sql";
const HISTORICAL_PENDING_LAST = "0017_wishlist_mileage_min.sql";

if (!existsSync(WRANGLER)) throw new Error("Run npm install before reconciling migrations.");

const childEnv = { ...process.env, CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || ACCOUNT_ID };

function wrangler(args, capture = true) {
  return execFileSync(process.execPath, [WRANGLER, ...args], {
    cwd: ROOT,
    env: childEnv,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
  });
}

function remoteRows(sql) {
  return parseWranglerJson(wrangler(["d1", "execute", DB_NAME, "--remote", "--json", "--command", sql]));
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function quoteSql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function remoteSchema(expected) {
  const rows = [];
  for (const table of expected.keys()) {
    for (const column of remoteRows(`PRAGMA table_info(${quoteIdentifier(table)})`)) {
      rows.push({ tbl: table, col: column.name });
    }
  }
  return rowsToSchema(rows);
}

function expectedIndexes() {
  const db = new DatabaseSync(":memory:");
  for (const name of MIGRATIONS) db.exec(readFileSync(resolve(ROOT, "migrations", name), "utf8"));
  const names = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  ).all().map((row) => row.name);
  db.close();
  return names;
}

function assertSchemaOnly(names) {
  for (const name of names) {
    const sql = readFileSync(resolve(ROOT, "migrations", name), "utf8")
      .replace(/--[^\r\n]*/g, "");
    const statements = sql.split(";").map((part) => part.trim()).filter(Boolean);
    for (const statement of statements) {
      if (!/^(?:CREATE\s+(?:UNIQUE\s+)?(?:TABLE|INDEX)\s+IF\s+NOT\s+EXISTS|ALTER\s+TABLE\s+\S+\s+ADD\s+COLUMN)\b/i.test(statement)) {
        throw new Error(`${name} contains a non-additive statement and cannot be ledger-baselined automatically: ${statement.slice(0, 90)}`);
      }
    }
  }
}

function assertLedgerPrefix(rows) {
  for (let index = 0; index < rows.length; index += 1) {
    const expected = MIGRATIONS[index];
    if (!expected || rows[index].name !== expected) {
      throw new Error(`Migration ledger is not the expected prefix at row ${index + 1}: found ${rows[index].name}, expected ${expected || "no row"}.`);
    }
  }
}

function backupProduction() {
  const directory = resolve(homedir(), "JDMFinder-backups");
  mkdirSync(directory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const output = resolve(directory, `jdmfinder-before-ledger-${stamp}.sql`);
  wrangler(["d1", "export", DB_NAME, "--remote", "--output", output, "--skip-confirmation"], false);
  if (!existsSync(output)) throw new Error("D1 export reported success but no backup file was created.");
  return output;
}

function audit() {
  const ledger = remoteRows("SELECT id, name, applied_at FROM d1_migrations ORDER BY id");
  assertLedgerPrefix(ledger);
  const pending = MIGRATIONS.slice(ledger.length);
  if (!pending.length) return { ledger, pending };
  if (pending[0] !== HISTORICAL_PENDING_FIRST || pending.at(-1) !== HISTORICAL_PENDING_LAST) {
    throw new Error(`Refusing an unexpected baseline range: ${pending[0]} through ${pending.at(-1)}.`);
  }

  assertSchemaOnly(pending);
  const expected = expectedSchemaFromMigrations();
  const missing = diffSchema(expected, remoteSchema(expected));
  if (missing.length) throw new Error(`Production schema is not ready to baseline. Missing: ${missing.join(", ")}`);

  const actualIndexes = new Set(remoteRows(
    "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  ).map((row) => row.name));
  const missingIndexes = expectedIndexes().filter((name) => !actualIndexes.has(name));
  if (missingIndexes.length) throw new Error(`Production indexes are not ready to baseline. Missing: ${missingIndexes.join(", ")}`);

  return { ledger, pending };
}

function main() {
  const { ledger, pending } = audit();
  console.log(`Verified production schema and indexes. Ledger has ${ledger.length}/${MIGRATIONS.length} migrations.`);
  if (!pending.length) {
    console.log("Migration ledger is already fully reconciled; nothing to do.");
    return;
  }
  console.log("Already-live migrations awaiting ledger reconciliation:");
  for (const name of pending) console.log(`  - ${name}`);
  if (!APPLY) {
    console.log("DRY RUN only. Review the list, then run: npm run db:reconcile:remote -- --apply");
    return;
  }

  const backup = backupProduction();
  console.log(`Production backup written outside the repository: ${backup}`);
  const firstId = ledger.length + 1;
  const values = pending.map((name, offset) => `(${firstId + offset}, ${quoteSql(name)})`).join(",\n  ");
  const sql = `BEGIN TRANSACTION;\nINSERT OR IGNORE INTO d1_migrations (id, name) VALUES\n  ${values};\nCOMMIT;`;
  wrangler(["d1", "execute", DB_NAME, "--remote", "--yes", "--command", sql], false);

  const verified = remoteRows("SELECT id, name, applied_at FROM d1_migrations ORDER BY id");
  assertLedgerPrefix(verified);
  if (verified.length !== MIGRATIONS.length) {
    throw new Error(`Ledger write did not reconcile every migration (${verified.length}/${MIGRATIONS.length}). Backup: ${backup}`);
  }
  console.log(`Migration ledger reconciled and verified (${verified.length}/${MIGRATIONS.length}).`);
}

try {
  main();
} catch (error) {
  console.error(`Migration reconciliation refused: ${error.message}`);
  process.exitCode = 1;
}
