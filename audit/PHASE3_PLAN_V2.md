# PHASE3_PLAN_V2.md - unified users model, redesigned for a pre-launch database

Written 23 July 2026. SUPERSEDES `PHASE3_PLAN.md` (V1). Planning only: no
code, no migration files, `feat/phase1-filtering` untouched.

Basis: the production data check. Note: `audit/PHASE3_PRODUCTION_DATA.md`
was not found in this repository or on any origin branch at writing time -
the figures below are taken from the brief and should be committed with
that file for the record. Production holds **9 clients (1 with an email, 0
with passwords), 4 agents, 0 portal dealer accounts, 0 supplier dealers, 0
dealer_vehicles, 0 portal container rows, 12 wishlists, zero collisions or
duplicates anywhere**. The finder is pre-launch. V1 was engineered to
protect live users, live sessions, live credentials and live portal writes.
None of those exist.

---

## 1. V1 machinery no longer needed

- **The password transform pipeline (V1 steps 6-8).** There are 0 portal
  dealer accounts, so there is nothing to import and no hash to convert.
  The transform itself stays VERIFIED and documented
  (`PHASE3_CHECKS.md` Task 2: base64url to base64, prepend `100000.`,
  empirically true/false-correct against both apps' real code). Keep it as
  reference: if any portal account is created before this ships, that
  recipe is the import path.
- **Session preservation choreography.** 0 portal accounts means 0 portal
  sessions; 0 clients with passwords means 0 buyer sessions; 0 supplier
  dealers means 0 finder-dealer sessions. The only live sessions are the
  admin (env password, no row) and up to 4 agents, who can simply be told
  to sign in again. Dual-read auth, username-keyed cookie continuity and
  `session_ver` carry-over all drop.
- **The `portal_enabled = 0` collision quarantine.** Zero email collisions
  and zero duplicates anywhere, so there is no credential-precedence
  problem to quarantine.
- **The `dealer_user_id` backfill.** 0 container rows carry
  `dealer_username`; there is nothing to re-parent. Better: the
  container-per-request pattern is eliminated outright (section 3), so the
  column is never created.
- **The tier backfill sign-off ceremony.** The rule now decides 9 rows, 0
  of them members. Staff can eyeball the result in one screen; no dry-run
  governance needed.
- **The 16-step expand-and-contract sequence, the name-indirection probe
  layer and the staging D1 rig.** All of it existed so two apps with live
  users could cross a rename without a shared deploy window. With zero
  portal users the portal cannot write (every write sits behind its login
  middleware), and with zero buyer/dealer sessions the only thing a brief
  window can break is the staff app and a 6-hourly cron tick. A direct
  cutover is now the right shape: V1's own analysis rejected it only
  because of live-user blast radius that no longer exists.

## 2. What still constrains us

- **The portal still binds the production database** (same `database_id
  2396671f-...`, portal `wrangler.toml:19-22`) and its code still writes
  the OLD table names (`functions/api/requests.js:148-216`). The portal
  must be updated too - but because it has zero accounts, its deploy needs
  no shared window. The real constraint becomes: **no portal account may
  be created (no registration approved) until the updated portal is
  deployed.** That is a freeze on an idle feature, not a coordination
  dance.
- **main deploys straight to production** (`deploy.yml:15-18`) and the
  deploy gate forces migration-before-deploy ordering
  (`check-remote-schema.mjs:69-77`). So there is an unavoidable window
  between applying the rename migration and the new Worker finishing its
  pipeline, during which the live Worker queries tables that no longer
  exist. Pre-launch, that breaks only the staff app for some minutes.
  Mitigations: run in a quiet hour, away from the cron marks (00/06/12/18
  UTC, `wrangler.toml:37-38`), with the code already reviewed and merged
  up to the final push.
- **No staging exists** (no `[env.*]`, single D1); everything is rehearsed
  on local D1 (section 7), which is real SQLite and covers the SQL
  semantics.
- Still standing: production migrations only via the approved workflow
  (`db-apply-pending.yml`), which requires the one-off migration-tracking
  adoption first; `wrangler d1 export` backups before every production
  step; client ids never remapped (Stripe metadata carries them out of
  band, `stripe.js:72,98-99,195` - almost certainly zero live checkouts,
  but the rule costs nothing since renames move no rows); no market or
  region column anywhere (charter decision 1); `dealer_vehicles` is NOT
  renamed (Phase 6 replaces it with `submitted_units`); Australian
  English, smallest change, everything on branches.

## 3. Target schema, designed properly

Near-greenfield: constraints that were impossible against legacy data are
now free. Mechanically, `clients` is RENAMED to `users` (`ALTER TABLE ...
RENAME TO` rewrites child `REFERENCES` clauses automatically, avoiding any
dangling-FK trap) and then shaped with `ADD COLUMN` (SQLite allows CHECK
constraints on added columns) plus partial unique indexes. Design:

```sql
-- users = clients renamed, plus:
type  TEXT NOT NULL DEFAULT 'customer'
      CHECK (type IN ('customer', 'dealer', 'agent'))
tier  TEXT NOT NULL DEFAULT 'free'
      CHECK (tier IN ('free', 'paid_access', 'fully_managed'))
username TEXT            -- dealer login key; NULL for everyone else
alerts   INTEGER NOT NULL DEFAULT 1   -- carried from agents
active   INTEGER NOT NULL DEFAULT 1   -- carried from agents/dealers
company  TEXT                          -- carried from agents

-- uniqueness now enforceable (case-insensitive via index collation):
CREATE UNIQUE INDEX idx_users_email    ON users(email COLLATE NOCASE)
  WHERE email IS NOT NULL AND email <> '';
CREATE UNIQUE INDEX idx_users_username ON users(username COLLATE NOCASE)
  WHERE username IS NOT NULL;
CREATE UNIQUE INDEX idx_users_google   ON users(google_sub)
  WHERE google_sub IS NOT NULL;
CREATE INDEX idx_users_type ON users(type);
```

Dropped from the old shape (data allows it: 9 rows, all trivially
convertible): `member` (superseded by `tier`; every read/write moves over,
notably `matcher.js:278`, `stripe.js:198,214`, `portal-shell.js:24-32`,
`auction-history.js:617`, `admin.js:8273`), `category` (superseded by
`type`; `admin.js:36-41` and its write sites), and `dealer_username` (the
fragile text link dies; nothing references it in production). Kept as-is:
`source` (acquisition channel, orthogonal to tier), `agent_id` (now
meaning "owning staff user id"), the portal/invite/session/Stripe/Google
columns, `archived`.

- **Agents fold in now** (V1 open question 2, closed): 4 rows move to
  `users` with `type='agent'` and NEW ids (1000 + old id, so they can
  never collide with preserved customer ids); the references
  (`users.agent_id`, `searches.owner_id`, `tasks.assigned_to`,
  `client_shares.agent_id`) are updated in the same migration. The
  `agents` table is then dropped. Admin stays env-password, id 0, no row.
- **`wishlists` renames to `searches`** with its columns unchanged.
  Deliberate, documented debt: FK COLUMN names (`client_id`,
  `wishlist_id`, `agent_id`) keep their old names everywhere - renaming
  them would roughly double the code sweep for zero product value.
- **`dealers` renames to `suppliers`** (0 rows; kills the third "dealer"
  meaning per the charter). `dealer_vehicles` untouched.
- **The container-per-request pattern is deleted, not migrated.** When the
  portal gains accounts, a dealer IS a `users` row (`type='dealer'`,
  `username` set); their requests become `searches` rows attached directly
  to that user id. No per-request pseudo-clients, ever.
- **Tier semantics:** meaningful for `type='customer'` only; agents and
  dealers keep the default. The 9 existing rows backfill by the agreed
  rule (`member=1` none exist; `source='public'` to `free`; else
  `fully_managed`) and staff can hand-correct any of the 9 in the UI
  afterwards.
- **No market or region column.** Out of scope by charter decision; the
  CHECK-constrained enums above are deliberately the only new axes.

### member to tier semantics

`member` was the only free-versus-paid signal in the system and it is
Stripe-driven, so dropping it needs explicit semantics, not just a sweep.
Line references are from the 23 July member-to-tier investigation.

1. **Tier model.** `free` and `paid_access` are a self-serve ladder.
   `fully_managed` is a separate staff-set track, not a rung above
   `paid_access`. Nothing automatic ever writes `fully_managed`.

2. **Stripe transition rule.** Stripe only ever moves a user between
   `free` and `paid_access`:
   - subscribe (`stripe.js:198`): `SET tier = 'paid_access' WHERE
     tier = 'free'`
   - lifecycle downgrade (`stripe.js:214`): `SET tier = 'free' WHERE
     tier = 'paid_access'`
   - `fully_managed` is never touched by any webhook.
   This closes both the undefined downgrade target (the old boolean lost
   nothing on `member = 0`; a ternary tier needs a stated landing spot)
   and the risk of a managed client demoting themselves by purchasing a
   subscription.

3. **Gate rule (decided, not open).** Gates become
   `tier IN ('paid_access', 'fully_managed')`. This is a deliberate
   product change: fully managed clients gain the auction search, history
   and landed-batch access they did not have under `member`. Rationale:
   they are the highest-value clients, and locking them out while a
   self-serve subscriber gets in is backwards. Safe to change now, since
   production has zero members. Applies to: `admin.js:7685`,
   `auction-history.js:617`, `index.js:1721-1722`, `index.js:1761`,
   `admin.js:6110-6116`, `matcher.js:278`.

4. **Upsell exception.** `notify.js:182-186` must gate on
   `tier = 'free'` specifically, NOT on `tier != 'paid_access'`.
   Otherwise fully managed clients receive upsell emails for a tier below
   the one they already have.

5. **Staff control.** The boolean toggle (`setClientMember` at
   `admin.js:8267-8274`, route `index.js:1408-1413`, button
   `admin.js:5315`) becomes a three-way tier selector. This plan states
   staff can hand-correct tier; no such control currently exists, so the
   selector is part of the build, not an assumption.

6. **Sweep items not previously named.** The dashboard members KPI
   (`admin.js:1943`), the `?ok=member` flash copy (`index.js:1658`), and
   at least 12 test fixture files plus `seed/seed-dev.sql`.

## 4. The renames, included this time

With 21 data rows total, the renames are cheap now and expensive later; V1
deferred them only to protect users who do not exist. What each touches:

**Finder** (sizing from V1 section 1.5): `clients` to `users` - 117
SQL-keyword statements across 8 files (admin.js 91, index.js 13, auth.js 6
including the role-to-table string map at `auth.js:308,317,361,557`,
matcher/stripe/notify/auction-history/landing) plus the drift helpers
(`admin.js:6755-6981`); `wishlists` to `searches` - 75 statements across 5
files; `dealers` to `suppliers` - `authenticate()`'s dealer branch
(`auth.js:407-412`), the `/dealer/*` finder routes (`index.js:2078-2125`),
admin dealer management; `member`/`category` column swaps ride the same
sweep. Plus `seed/seed-dev.sql`, `scripts/qa-reset.mjs`, the test suite's
literal SQL (e.g. `wishlist-term-guard.test.mjs`, `wishlist-drift`,
`portal-isolation`), the `HEADERS`/nav labels (Users, Searches -
`admin.js:985,987,1006,1007,1070`; view keys stay `clients`/`requests`
behind the alias hook at `admin.js:1203`), and `docs/`.

**Portal**: `functions/api/requests.js` (about 12 statements: table names,
and scoping rewritten from `clients.dealer_username` to `searches.user_id
= (SELECT id FROM users WHERE username = ? AND type='dealer')` - in
practice the session resolves the id once); `login.js`/`forgot.js`/
`reset.js` re-pointed at FINDER_DB `users` for `type='dealer'` rows (the
portal's own `dealers` table and `SESSION_SECRET` cookie format can stay
for its admin panel, or be retired when Phase 6 touches the portal - not
blocking). `wrangler.toml` unchanged.

`authenticate()` reworks once: one `users` lookup by email deriving role
from `type` (`customer` to role `client`), suppliers checked for role
`dealer` as today, admin unchanged.

## 5. Sequence

1. **[local, finder]** Build the whole change on a branch off main:
   migration 00NN (rename clients to users; ADD COLUMN type/tier/username/
   alerts/active/company with CHECKs; backfill type/tier for the 9 rows;
   insert the 4 agents as users id 1000+; update the four reference
   columns; drop member/category/dealer_username; drop agents; rename
   wishlists to searches and dealers to suppliers; create the partial
   unique indexes) plus the full code sweep and label changes. Verify:
   `npm run db:migrate:local && npm run db:seed:local && npm test` green
   (seed updated in the same branch), `npm run db:check:local` green.
2. **[local, portal]** Branch the portal: table names, scoping, auth
   source. Verify: the shared-local-D1 rehearsal loop in section 7 passes
   end to end.
3. **[production, one-off]** Run the "Adopt D1 migration tracking"
   workflow if not already done. Verify: `npm run db:migrate:list` shows
   nothing pending.
4. **[production]** `npx wrangler d1 export` both databases. Verify: the
   finder export contains the expected 9/4/12 rows.
5. **[production]** Freeze the idle portal: no registration approvals from
   now until step 8 (a message to Ben, not a code change).
6. **[production]** In a quiet hour away from the cron marks: apply the
   migration via the approved workflow, then immediately merge the finder
   branch to main so the deploy pipeline runs. Verify after: deploy green
   (the schema gate itself proves production matches the migrations);
   staff login works; the 9 users and 12 searches render; counts match
   step 4's export.
7. **[production]** Smoke the moved data: create a test user + search from
   the staff app, run the matcher once (`/run`), confirm a queue row
   appears, then delete the test rows. Verify agent login for one real
   agent (they sign in fresh; old agent cookies are dead by design).
8. **[production, any time after 6]** Deploy the portal branch (Pages).
   Verify: portal login page loads; with a seeded test dealer user
   (created via staff app, `type='dealer'`, username + invite), the portal
   request loop works against production, then remove the test dealer.
   Unfreeze registrations.

## 6. Data move

Nothing is copied between tables, so nothing can be lost in transit:

- **9 clients**: stay in their rows; the table is renamed around them.
  Ids untouched, satisfying the Stripe rule (`metadata.client_id`,
  `stripe.js:195`) even though live checkouts are almost certainly zero.
  `type`/`tier` backfill by rule; the single row with an email is
  unaffected by the new unique index (one row cannot collide).
- **12 wishlists**: stay in their rows; table renamed to `searches`;
  `client_id` values still point at the same preserved user ids.
- **4 agents**: the only rows that move tables. Inserted into `users` as
  id 1000+old with `type='agent'`, email/name/hash/invite/alerts/company
  carried verbatim (same PBKDF2 format, same code path - no transform
  needed inside the finder). The four reference columns update in the
  same migration. Old agent sessions die (role-to-table and id both
  change); 4 people sign in again.

## 7. Local rehearsal

1. Fresh local DB (delete `.wrangler/state`), `npm run db:migrate:local`
   (runs baseline through the new migration in order - this proves the
   migration runs on a schema shaped exactly like production's), then
   `npm run db:seed:local` and `npm test`.
2. Auth paths against `wrangler dev`: admin env password; agent login
   (seeded agent, now a `users` row - proves the fold); client portal
   invite + login (proves customer auth on `users`); supplier-dealer login
   path still refuses gracefully with 0 rows.
3. Two-app loop: run the portal with `wrangler pages dev` pointed at the
   SAME local persistence directory (`--persist-to`, matching database
   ids). Create a `type='dealer'` user with a username via the staff app,
   log in to the portal with it, create a request, run the matcher with
   `AUCTION_FIXTURE` set, see the match in the portal list, delete the
   request, confirm the searches/queue/seen_lots rows go.
4. Restore drill: import the step-4-style export into a scratch local DB
   and confirm the pre-migration state comes back cleanly.
5. `npm run test:e2e` on the finder branch.

## 8. Rollback

- **Step 3 (adopt tracking):** `DROP TABLE d1_migrations`. No app impact.
- **Step 6 (migration + deploy), the only step with teeth:** restore order
  matters - first re-import the step-4 finder export (25 rows; seconds),
  THEN revert the merge so the pipeline redeploys the old Worker (old code
  needs the old schema, and the gate will hold the deploy until the
  restore has happened). Any data created between cutover and rollback is
  in the export-diff and must be re-entered by hand - which is why step 7
  smokes immediately and the window stays short. Practical point of no
  return: once real launch traffic starts writing to `users`/`searches`,
  restoring the old export means merging, so roll FORWARD after launch.
- **Step 8 (portal deploy):** redeploy the previous Pages build. Zero
  users, zero consequence; the freeze from step 5 simply resumes.

## 9. Open questions - V1 had nine, the data closes most

Closed by the data or by this design:
1. Tier backfill rule - CLOSED: decides 9 rows, none paid; staff can
   hand-correct in the UI. No sign-off ceremony needed.
2. Agents physical merge - CLOSED: folded now, 4 rows, re-login accepted.
3. Per-request pseudo-clients - CLOSED: 0 exist; the pattern is deleted.
4. Portal `is_admin` - CLOSED for this phase: 0 portal accounts of any
   kind; the portal admin panel stays portal-local until Phase 6 touches
   the portal again.
5. Duplicate emails / uniqueness - CLOSED: zero duplicates in production,
   so the users table launches with case-insensitive unique email,
   username and google_sub from day one.
6. Ship or defer the renames - CLOSED: shipped in this phase, per the
   brief and the data.
7. `suppliers` rename timing - CLOSED: bundled here (0 rows).
8. Staging with production data - CLOSED: moot; local rehearsal covers it
   and there is no meaningful data to anonymise.
9. `SESSION_SECRET` custody - CLOSED: moot with 0 portal sessions; the
   portal keeps its secret regardless.

Decided since first writing, and deliberately NOT open:
- **The member-to-tier gate rule.** Decided in section 3 ("member to tier
  semantics", item 3): gates become `tier IN ('paid_access',
  'fully_managed')`, a stated product change that grants fully managed
  clients member-level access. This should be COMMUNICATED to Ben as part
  of the cutover summary, not asked of him - production has zero members,
  so there is no behaviour for anyone to lose.

Genuinely still open, needing a human:
- **Cutover date and the launch freeze.** Step 6 wants a quiet hour and a
  short code-merge window, and the whole plan assumes launch has not
  happened mid-flight. Who picks the date, and is any marketing or
  onboarding planned that could create real users before it?
- **The portal registration freeze (step 5).** Ben owns the portal's
  registration approvals; he needs to agree to hold them until step 8.
- **Do the 4 agents get told, or just logged out?** Trivial either way;
  a one-line message beforehand is kinder. Someone should own sending it.
