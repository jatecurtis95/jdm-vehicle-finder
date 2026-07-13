// Emit the SQL that adopts wrangler's d1_migrations tracking table on a
// database whose schema is ALREADY fully migrated by hand (production's state
// since 0002; see migrations/README.md "Adopting the runner").
//
// Every numbered migration file is recorded as applied WITHOUT executing it -
// the files from 0002 on contain plain (non-idempotent) ALTER TABLE statements
// that would fail with "duplicate column" if re-run. After this SQL is applied,
// `wrangler d1 migrations list --remote` reports nothing pending and
// `wrangler d1 migrations apply --remote` becomes safe for future (00NN+) files.
//
// The table DDL matches wrangler's own (DEFAULT_MIGRATION_TABLE), and
// INSERT OR IGNORE keys on the UNIQUE name column, so re-running the output is
// harmless. Run via the "Adopt D1 migration tracking" GitHub workflow.
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function adoptionSql(dir = join(root, "migrations")) {
  // Non-recursive *.sql, sorted - the exact set and names wrangler's runner
  // globs (migrations/legacy/ and README.md are naturally excluded).
  const files = readdirSync(dir, { withFileTypes: true })
    .filter((f) => f.isFile() && f.name.endsWith(".sql"))
    .map((f) => f.name)
    .sort();
  if (!files.length) throw new Error(`no migration files found in ${dir}`);
  const bad = files.find((f) => !/^[\w.-]+$/.test(f));
  if (bad) throw new Error(`unexpected characters in migration filename: ${bad}`);
  const values = files.map((f) => `('${f}')`).join(",\n  ");
  return `CREATE TABLE IF NOT EXISTS d1_migrations(
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT OR IGNORE INTO d1_migrations (name) VALUES
  ${values};
`;
}

// CLI: print the SQL so the workflow can pipe it into `wrangler d1 execute`.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stdout.write(adoptionSql());
}
