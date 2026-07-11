# Database migrations

Schema for the `jdm-vehicle-finder` D1 database is versioned here and applied
with Cloudflare's built-in migration runner (`wrangler d1 migrations apply`),
which records what it has run in a `d1_migrations` table so each file runs once.

## Layout

- `0001_baseline.sql` - the cumulative baseline schema. Every statement is
  idempotent (`CREATE ... IF NOT EXISTS`), so it is safe to run against a fresh
  database and a no-op against one that already has the tables. This is the full
  end-state, folded together from the historical loose `migrate-*.sql` files.
- `legacy/` - the original loose migration and one-off data-fix files, kept for
  history. They were already applied to production over time and are now
  represented by the baseline. Do not re-run them.
- `0002_*.sql`, `0003_*.sql`, ... - new changes from here on. One concern per
  file, numbered in order, with a short header comment.

## Workflow

1. Add a new numbered file, for example `migrations/0002_add_tiers.sql`.
2. Apply it locally first and run the tests:
   ```
   npm run db:migrate:local
   npm test
   ```
3. When you are happy, apply it to production. This step changes live data, so
   it is gated: only run it after Jate has approved the specific migration.
   ```
   npm run db:migrate:remote
   ```
4. Check what production has applied at any time:
   ```
   npm run db:migrate:list
   ```

## Production safety rules

- Never apply a migration to production without explicit approval.
- SQLite has no `ADD COLUMN IF NOT EXISTS`. For a brand new column, a plain
  `ALTER TABLE ... ADD COLUMN` is fine because the runner applies each file once.
  Never edit a migration that has already been applied to production; add a new
  one instead.
- Prefer additive changes (new tables, new nullable columns with defaults) so a
  deploy and its migration can go out independently without breaking the
  currently running Worker.

## Deploy-time schema gate

Because production migrations are applied by hand, a deploy could previously ship
code that read a column production did not have yet. The deploy workflow now runs
`npm run db:check:remote` (`scripts/check-remote-schema.mjs`) BEFORE
`wrangler deploy`. It:

1. Applies every numbered migration to a throwaway in-memory SQLite to get the
   schema the code expects (identical to what the test suite runs against).
2. Reads production's live schema with `wrangler d1 execute --remote`.
3. Fails the deploy, listing exactly what is missing, if production lacks any
   expected table or column. Extra columns in production are ignored.

So the order of operations for a schema change is unchanged, just enforced:
apply the migration to production first (with approval), then the deploy passes.
Run the same check locally against prod any time with `npm run db:check:remote`,
or against your local D1 with `npm run db:check:local`.

## Adopting the runner on the existing production database

Production already has every table in `0001_baseline.sql`. Because the baseline
is fully idempotent, running `db:migrate:remote` against production will apply
`0001_baseline` as a harmless no-op and then record it in `d1_migrations`, after
which only `0002+` do real work. Do this once, with approval, before the first
real new migration.
