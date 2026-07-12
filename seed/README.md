# Development seed data

`seed-dev.sql` loads a small, fully fabricated dataset so the app can be run and
tested locally without ever touching real customer records.

## Use

1. Create a local database and apply migrations:
   ```
   npm run db:migrate:local
   ```
2. Load the seed:
   ```
   npm run db:seed:local
   ```
3. Start the app locally:
   ```
   npm run dev
   ```

## What it creates

- Two agents. `demo.agent@example.com` has a working password; the other is in
  the invited (no password) state.
- One dealer account with a pending sample vehicle submission.
- Three clients, including one with the buyer portal enabled.
- Three wishlists (R34 GT-R, A80 Supra, an FD RX-7 watch-only lead).
- Three matches: two delivered to the portal buyer (one already requested) and
  one pending in the staff review queue.

## Dev logins (password for both: `demo1234`)

| Role  | Sign in at | Email                   |
|-------|------------|-------------------------|
| Agent | `/login`   | `demo.agent@example.com`|
| Buyer | `/login`   | `demo.buyer@example.com`|
| Dealer | `/dealer` | `demo.dealer@example.com`|
| Admin | `/login`   | leave email blank, use the `ADMIN_PASSWORD` from `.dev.vars` |

## Safety

- Every value is fabricated. No real names, emails or numbers.
- Rows use ids in the 9000+ range with `INSERT OR REPLACE`, so re-seeding is
  repeatable and cannot collide with real auto-increment ids.
- Apply only to a local database (`--local`). Never seed the remote/production
  database.
