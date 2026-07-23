# Phase 3 production data check

Run 22 July 2026 against production D1. All queries read-only SELECTs.

Verified target: `account_id 78a4648f57e3da163587fff349bf8b19` (the account in
wrangler.toml line 5), database `jdm-vehicle-finder`
`2396671f-a3b6-4a33-bd9b-2b9fee37e0c2` (matches wrangler.toml line 46). Single
env block, no separate production env. The dealer portal binds the same
database_id as FINDER_DB, confirming C-073.

## Headline

Production is effectively empty. The finder is pre-launch.

| Table | Rows |
|---|---|
| clients | 9 |
| clients with an email | 1 |
| clients with pass_hash | **0** |
| clients with google_sub | 0 |
| agents | 4 |
| dealers (supplier) | 0 |
| dealer_vehicles | 0 |
| clients with dealer_username (portal containers) | 0 |
| portal dealer accounts (jdm-dealers DB) | **0** |
| wishlists | 12, across 9 owners |

## Collision checks: all clear

- clients~agents email overlap: 0
- clients~supplier dealers: 0
- agents~supplier dealers: 0
- duplicate emails within clients: none
- case-variant duplicates in agents: none
- case-variant duplicates in supplier dealers: none

## Tier backfill

All 9 rows land in `fully_managed`. 3 rows have `source IS NULL` (legacy), the
other 6 have `source = 'jdm'`. **No row has `source = 'public'`**, so that
branch of the proposed rule matches nothing. `member = 1` count is 0.
No archived rows, no revoked rows, no trade buyers.

All 9 appear to be staff or test rows. Only one carries an email, and it is
Jate's own.

## What this does to Phase 3

The four credential stores are real in code but nearly empty in data. Only
`agents` holds real credentials, with 4 rows.

Work the PHASE3_PLAN assumed necessary, now unnecessary:

- **Password transform.** Zero portal hashes exist. Nothing to convert. The
  transform was verified correct and can be kept for reference, but no
  migration step needs it.
- **Session preservation.** Zero portal accounts, therefore zero live portal
  sessions. Nobody can be logged out.
- **`portal_enabled = 0` collision mechanism.** Nothing to import, and zero
  email overlaps anyway.
- **`dealer_user_id` backfill.** Zero container rows.
- **Tier backfill sign-off from Ben.** Moot. 9 staff/test rows.
- **The 16-step expand-and-contract cutover.** Designed for a populated
  production database. Overkill for 9 rows and 12 wishlists.

## Recommendation

Treat Phase 3 as near-greenfield schema work rather than a migration.

Build the `users` table with `type` and `tier` designed properly from the
start, point the code at it, and move the 9 client rows and 12 wishlists
across in a single simple step. The elaborate dual-write, backfill and
name-indirection machinery exists to protect data that is not there.

The two genuine constraints that remain:

1. The dealer portal writes to the finder's production database (same
   `database_id`), so both apps still need coordinated deployment. This is
   unchanged by the data volume.
2. `main` deploys to production, so there is still no staging buffer.
   Rehearse locally.

The window to do this cheaply is now, before launch. Once real customers
exist, the full PHASE3_PLAN cutover becomes the correct approach again.

## Caveat

This describes the finder's D1 only. JDM Connect's live customer records sit
in GoHighLevel and elsewhere, and are not touched by Phase 3.
