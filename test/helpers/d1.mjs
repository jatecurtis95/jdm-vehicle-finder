// Minimal D1-compatible shim over node:sqlite, so the Worker's data-access code
// can run unchanged against an in-memory SQLite database in tests.
//
// D1's methods are async in production; this shim returns values synchronously,
// which is fine because the app always awaits them (await of a non-promise just
// yields the value).
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");

class D1Stmt {
  constructor(db, sql, params) { this.db = db; this.sql = sql; this.params = params || []; }
  bind(...args) { return new D1Stmt(this.db, this.sql, args); }
  first() { const row = this.db.prepare(this.sql).get(...this.params); return row === undefined ? null : row; }
  all() { return { results: this.db.prepare(this.sql).all(...this.params) }; }
  run() { const info = this.db.prepare(this.sql).run(...this.params); return { meta: { last_row_id: Number(info.lastInsertRowid), changes: info.changes } }; }
}

class D1 {
  constructor(db) { this._db = db; }
  prepare(sql) { return new D1Stmt(this._db, sql); }
  batch(stmts) { return stmts.map((s) => s.run()); }
}

// Create an in-memory DB with the baseline schema applied, plus any extra SQL
// (seed rows, fixtures). Returns an env-like object: { DB, db }.
export function makeEnv(extraSql) {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(resolve(ROOT, "migrations", "0001_baseline.sql"), "utf8"));
  if (extraSql) db.exec(extraSql);
  return { DB: new D1(db), db };
}

export function readFile(rel) { return readFileSync(resolve(ROOT, rel), "utf8"); }
export const repoRoot = ROOT;
