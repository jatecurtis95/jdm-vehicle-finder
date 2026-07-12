# QA & local staging

A reusable, disposable local environment for exercising JDM Connect end to end -
public request form, buyer portal, agent, admin and dealer flows - without
touching production or any real customer data.

## One-time setup

1. Copy the dev vars and adjust as needed:
   ```
   cp .dev.vars.example .dev.vars
   ```
   The defaults are QA-safe: `MAIL_DRY_RUN=1` (no real email is ever sent),
   Stripe blank/test-only, and a local D1 database.
2. Install dependencies: `npm install`.

## Reset to a known state

```
npm run qa:reset                 # wipe local D1 + KV, re-apply migrations, load seed-dev.sql
npm run qa:reset -- --worstcase  # load seed-worstcase.sql instead (edge-case data)
npm run qa:reset -- --no-seed    # migrations only, empty data
```

This clears `.wrangler/state` (the local D1 database and KV), re-applies every
migration to a fresh database, and loads a seed. Run it whenever you want a clean
slate. It is local-only and never touches the remote database.

Then start the app:

```
npm run dev
```

## Test credentials

Created by `seed/seed-dev.sql` (all data is fabricated):

| Role         | How to sign in                                             |
| ------------ | ---------------------------------------------------------- |
| Admin        | `/login`, **blank email** + your `ADMIN_PASSWORD` (`.dev.vars`, default `devadmin`) |
| Agent        | `/login`, `demo.agent@example.com` / `demo1234`            |
| Buyer portal | `/portal`, `demo.buyer@example.com` / `demo1234`           |
| Dealer       | `/dealer`, `demo.dealer@example.com` / `demo1234`           |

The public request form at `/request` needs no login.

## Deterministic auction data (fixture mode)

The matcher, auction search and the free-tier welcome match all read the live
auction relay. For repeatable QA without the relay or a token, set
`AUCTION_FIXTURE` in `.dev.vars` to feed XML - paste the contents of
[`seed/auction-fixture.example.xml`](seed/auction-fixture.example.xml), which
carries a small JDM set (R34 GT-R, A80 Supra, FD RX-7, EK9 Type R) that matches
the seeded searches. With it set, `query()` returns those lots and skips the
network. Leave it blank to use the real relay. It is inert unless set, so
production is never affected.

Note: the fixture is returned as-is regardless of the SQL query, so tailor it to
the searches you are testing. The matcher's code-side refinement (grade filter)
still applies.

## Email and payments

- **Email**: `MAIL_DRY_RUN=1` makes `sendEmail` log what it would have sent and
  return success - so set-password links, reset links and match emails are
  visible in the `wrangler dev` console without a real inbox. Copy the logged
  link to continue a flow (e.g. `/set-password?token=...`).
- **Stripe**: use **test** keys only (`sk_test_...`). Enable deposits in
  Settings → Payments, then pay with card `4242 4242 4242 4242`, any future
  expiry and CVC. Never put a live key in local dev or staging.

## Schema checks

Verify a database has every table/column the migrations expect:

```
npm run db:check:local     # against the local D1
npm run db:check:remote    # against production (needs CLOUDFLARE_API_TOKEN)
```

The remote check also runs automatically before every deploy (see
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) and
[`migrations/README.md`](migrations/README.md)) and blocks a deploy that would
race ahead of a migration.

## Automated tests

```
npm test
```

Runs the full `node --test` suite against an in-memory SQLite built from the same
migrations, so it always matches the schema `qa:reset` produces.
