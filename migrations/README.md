# Database migrations

The production D1 schema is versioned by the numbered SQL files in this folder.
Wrangler records each applied file in `d1_migrations` and will only run a file
once.

## Layout

- `0001_baseline.sql` is the cumulative starting schema.
- `0002_*.sql`, `0003_*.sql`, and later files are ordered, additive changes.
- `legacy/` contains historical loose scripts for reference only. Do not run
  them against production.

Never edit a numbered migration after it has reached production. Add the next
numbered file instead. Prefer additive tables, columns, and indexes so code and
schema changes can be rolled out safely.

## Normal workflow

1. Add a numbered migration.
2. Apply it to the local D1 and run the complete test suite:

   ```powershell
   npm run db:migrate:local
   npm test
   ```

3. Review the SQL and take a production backup.
4. Apply it to production through the migration runner:

   ```powershell
   npm run db:migrate:remote
   ```

5. Verify the schema and ledger:

   ```powershell
   npm run db:check:remote
   npm run db:migrate:list
   ```

The deploy workflow runs the remote schema check before publishing the Worker,
so code cannot deploy ahead of a required table or column.

## One-time production ledger reconciliation

Migrations 0004 through 0017 were historically applied as individual SQL files,
so the live schema contained them before their ledger rows existed. Do not run
the normal migration command while that partial ledger still reports those files
as pending, because their `ALTER TABLE` statements would collide with live
columns.

Use `scripts/reconcile-migration-ledger.mjs` for the one-time adoption. It:

1. verifies the existing ledger is an exact prefix of the repository files;
2. proves every expected table, column, and index is already live;
3. refuses to baseline a migration containing non-additive/data-changing SQL;
4. performs a read-only dry run unless `--apply` is explicitly supplied;
5. exports a full production SQL backup outside the repository before writing;
6. inserts only the missing ledger rows and verifies the complete ledger.

Run and review the dry run first:

```powershell
npm run db:reconcile:remote
```

After explicit approval, apply and verify:

```powershell
npm run db:reconcile:remote -- --apply
npm run db:migrate:list
npm run db:check:remote
```

Once it reports 17 of 17 migrations, all future production changes use the
normal `db:migrate:remote` workflow above.
