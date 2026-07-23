# PHASE3_PLAN.md - unified users model: planning document

Written 23 July 2026. Planning only: no code changed, no migration written,
no command below has been executed. Sources: this repo at `830ac98`
(branch `feat/phase1-filtering`, untouched) and `jdm-dealer-portal` at
`10f3d2f` (read-only clone, the audit's exact baseline commit). Where the
audit's claim ids (C-064, C-066, C-073, C-076, C-079) are cited, the claim
was re-verified against code this session.

The two audit escalations frame everything here: there are FOUR credential
stores, and the dealer portal is a WRITER to the finder database, not a
reader. main deploys straight to production on push, there is no staging
environment, and the two apps deploy through two unsynchronised pipelines.

---

## 1. CURRENT STATE

### 1.1 The two apps and the two databases

| App | Runtime | Own DB | Also binds |
|---|---|---|---|
| jdm-vehicle-finder (this repo) | Worker | D1 `jdm-vehicle-finder` (`2396671f-...`), bound as `DB` (`wrangler.toml:43-50`) | nothing else |
| jdm-dealer-portal | Pages Functions | D1 `jdm-dealers` (`16fa063d-...`), bound as `DB` (`portal wrangler.toml:6-9`) | the finder's D1 as `FINDER_DB` (`portal wrangler.toml:19-22`, same database_id) |

No `[env.*]` blocks, no preview database, no staging in either app.
Finder deploys on push to main (`.github/workflows/deploy.yml:15-18`);
production migrations are manual and approved (`db-apply-pending.yml:16-17`)
and the deploy gate blocks any deploy whose migrations describe tables
production does not have (`scripts/check-remote-schema.mjs:39-77`).

### 1.2 The four credential stores

All four are PBKDF2-SHA256, 100k iterations, 256-bit, 16-byte salt. The
finder's three share one code path; the portal's is a parallel
implementation with a different storage encoding.

| # | Store | Table and columns | Verified by | Notes |
|---|---|---|---|---|
| 1 | Staff agents | finder `agents.pass_salt/pass_hash` (`0001_baseline.sql:19-20`), email UNIQUE (`:28`) | `src/auth.js:400-405` | plus env-password admin with no row, id 0 (`auth.js:381`) |
| 2 | Buyer clients | finder `clients.pass_salt/pass_hash` (`0001:41-42`), email NOT unique | `src/auth.js:420-427` | iterates up to 5 duplicate rows per email and takes the first hash that verifies |
| 3 | Portal dealers (trade buyers) | portal DB `dealers.password_hash/salt`, keyed by `username TEXT PRIMARY KEY` (portal `scripts/schema.sql:8-16`) | portal `functions/api/login.js:85-103` | hash/salt stored base64url, NO iteration prefix (portal `lib/auth.js:13-16,36-49`) |
| 4 | Finder supplier dealers (sellers, dormant-ish) | finder `dealers.pass_salt/pass_hash NOT NULL` (`0013_dealer_system.sql:13-14`), email UNIQUE (`:9,22`) | `src/auth.js:407-412` | admin management is flagged off (`settings.js:54` `dealer_portal_enabled="0"`), but `authenticate()` checks the table and `/dealer/*` finder routes serve active rows |

Hash portability: finder hashes are stored as standard base64 with a
self-describing `100000.<hash>` prefix (`src/auth.js:143`); its verifier
accepts a bare hash as legacy 100k and bounds the iteration prefix
(`auth.js:145-159`). Portal hashes are the same bits in base64url with no
prefix. A mechanical transform (base64url to base64, prepend `100000.`)
makes portal hashes verify under the finder's `verifyPassword` with NO
password resets. This must be unit-tested before relying on it.

### 1.3 Sessions per population

| Population | Cookie | Payload | Signed with | Invalidated by |
|---|---|---|---|---|
| Finder admin/agent/client/finder-dealer | `fsess` (`auth.js:11`) | `role:id:exp:session_ver` (`auth.js:324`), 30 days (`auth.js:12`) | HMAC-SHA256, `env.ADMIN_TOKEN` (`auth.js:40-53`) | `session_ver` bump re-checked per request against the role's table (`auth.js:358-366`); row gone = session dead (`auth.js:363`) |
| Portal dealers | `__Host-jdm_session` (portal `lib/auth.js:161`) | JSON `{u: username, n, exp, a?:1}`, 7 days (portal `login.js:4-5,111-114`) | HMAC-SHA256, portal `env.SESSION_SECRET` | expiry only; `active` is checked at login, not per request |

Two facts matter for cutover design:
- The finder cookie's role string selects the TABLE for the per-request
  `session_ver` check (`auth.js:305-312, 358-366`) and the portal handler
  split (`index.js:853-860`). Move a row between tables, or change its id,
  and every outstanding cookie for it dies or misroutes.
- The portal cookie is keyed by USERNAME, not numeric id. If usernames are
  preserved, portal sessions survive an auth-backend swap untouched.

### 1.4 Every portal write to FINDER_DB (C-073, confirmed with lines)

All in portal `functions/api/requests.js`; every row is scoped by
`clients.dealer_username = <portal username>`:

| Operation | Line | Detail |
|---|---|---|
| INSERT INTO clients | `:148-151` | `(name, email, dealer_username)`; **reads `meta.last_row_id` at `:152`** to chain the wishlist insert |
| INSERT INTO wishlists | `:155-165` | 13 columns including `auto_notify` |
| UPDATE wishlists SET active | `:195-198` | after an ownership check (`:44-50`) |
| DELETE FROM queue / seen_lots / wishlists | `:206-210` | batch, per wishlist |
| DELETE FROM clients | `:215-216` | when the dealer's last wishlist for that client goes |
| Reads | `:44-50, :61-93` | wishlists JOIN clients, queue JOIN wishlists JOIN clients, all via `dealer_username` |

Note the portal creates ONE finder client row PER REQUEST (its own comment,
`requests.js:203-204`). These are containers, not accounts. The
`clients.dealer_username` column (`0001:38`) is the fragile text link the
charter wants removed; on the finder side it is read at `admin.js:6744`
(scope clause) and `admin.js:7425,7430` (Google/public lookups).

### 1.5 Finder-side write surface (what a rename must touch)

SQL-keyword statement counts (FROM/INTO/UPDATE/JOIN/DELETE): `clients` 117
statements across 8 files (admin.js 91, index.js 13, auth.js 6 including
the role-to-table string map at `auth.js:308,317,361,557`, matcher 2,
stripe 2, notify 1, auction-history 1, landing 1); `wishlists` 75 across 5
files (admin.js 66, index.js 4, matcher.js 2 at `:276,314`, stripe.js 2 at
`:263,268`, landing.js 1); `queue` 101 across 7 files (admin.js 72,
index.js 18, matcher.js 6, sheet.js 2, stripe.js 1, landing.js 1,
auth.js 1). Plus the drift-tolerant insert helpers `insertClientDrift`
(`admin.js:6755-6771`) and `insertWishlistDrift`/`updateWishlistDrift`
(`admin.js:6958-6981`), and the portal statements above.

### 1.6 Foreign keys and out-of-band id carriers

- `wishlists.client_id` (`0001:61`, FK), `queue.client_id` (`0001:93`),
  `watchlist_items.client_id` (`0018:11`, FK + UNIQUE(client_id, lot_id)),
  `client_shares(client_id, agent_id)` PK (`0001:51-54`),
  `activity.client_id/wishlist_id` (`0006:36-37`), `payments.client_id`
  (`0001:116`), `tasks.client_id/assigned_to/wishlist_id` (`0006:20-22`),
  `clients.agent_id` (`0001:39`), `wishlists.owner_id` (`0006:10`),
  `dealer_vehicles.dealer_id/approved_by` (`0013:29,43`).
- Stripe carries client ids OUT OF BAND: `metadata.client_id` on checkout
  (`stripe.js:72,98-99`) and the webhook reads it back (`stripe.js:195`),
  falling back to `stripe_customer_id`/`stripe_subscription_id` matching
  (`stripe.js:216-217`). An id remap while a checkout is in flight
  reconciles against the wrong row. Design rule adopted below: NO existing
  client id is ever remapped.
- `clients.google_sub` (`0008:10`) is the durable Google identity
  (`admin.js:7425-7438`); it must ride along with any row move.

### 1.7 Type and tier already prototyped

- `clients.category` `'private'|'dealer'` (`0011:8`, set list
  `admin.js:36-41`, written at `admin.js:6789,6841,6860,7590`).
- `clients.source` `'public'|'jdm'` (NULL = legacy jdm, `0016:1-6`);
  stamped public at `admin.js:7450` (Google) and `admin.js:7481` (public
  form), jdm at `admin.js:6812,7611`. C-076 confirmed:
  `request-wizard.js` contains no source stamping.
- `clients.member` (paid flag, `0002:5`; written by Stripe at
  `stripe.js:198,214`, toggled at `admin.js:8273`) plus
  `stripe_customer_id/stripe_subscription_id/sub_status` (`0003:7-9`) and
  the `free_*` settings (`settings.js:25-26,31,35`).
- Cross-check: `0019_share_links.sql` creates NO table despite its name;
  it is six queue columns (`0019:10-15`). No share_links table exists.

### 1.8 Cron blast radius

`crons = ["0 */6 * * *"]` (`wrangler.toml:37-38`) runs `expirePast` (UPDATE
queue, `admin.js:4599`), `autoFollowUps` (queue JOIN clients JOIN wishlists,
`admin.js:4568-4574`) and `runAll` (SELECT wishlists JOIN clients JOIN
agents at `matcher.js:273-279`; INSERT/UPDATE queue at
`matcher.js:217,350,367,385,390`) from `index.js:269-271`. Any window in
which these tables are mid-rename risks a failed tick every six hours.

---

## 2. TARGET STATE

### 2.1 Schema

`clients` evolves in place (per the charter: no new table, no id remaps).
New columns, all additive:

- `type TEXT NOT NULL DEFAULT 'customer'` - `'customer' | 'dealer'`
  initially; `'agent'` only if/when agents physically merge (open question
  8.2). `category='dealer'` rows (trade buyers) backfill to
  `type='dealer'`.
- `tier TEXT NOT NULL DEFAULT 'free'` - `'fully_managed' | 'paid_access' |
  'free'`. Proposed backfill, pending sign-off (open question 8.1):
  `member=1 -> 'paid_access'; else source='public' -> 'free'; else
  'fully_managed'`.
- `username TEXT` with a partial unique index (`WHERE username IS NOT
  NULL`) - the portal login key for imported dealer accounts.
- `dealer_user_id INTEGER` - replaces the `dealer_username` text link:
  which user owns this request-container row. (Retire `dealer_username`
  at contract time only.)

The physical renames (`clients` to `users`, `wishlists` to `searches`) are
the LAST step, not the first, and are executed only after both apps go
through a name-indirection layer (section 3). `dealer_vehicles` is NOT
renamed (Phase 6 replaces it with `submitted_units`). The finder's
supplier `dealers` table renames to `suppliers` in the same late window,
finder-only (the portal never touches it - its dealers live in the portal
DB).

### 2.2 How each credential store maps in

| Store | Mapping | Existing sessions |
|---|---|---|
| 1. Agents | Phase 3 proper: UNCHANGED (stay in `agents`; shown in the Users view as a read union). Physical merge is a separately gated step (8.2) because it remaps ids referenced by `client_shares.agent_id`, `clients.agent_id`, `wishlists.owner_id`, `tasks.assigned_to` and invalidates every agent cookie. | Unaffected in Phase 3 proper |
| 2. Clients' own logins | Already in the base table. Nothing moves; `type/tier` are new columns beside the existing hash. | Unaffected (same table, same ids, same session_ver) |
| 3. Portal dealers | One `clients` row per portal `dealers` row: `username`, `display_name -> name`, `email`, `active`, `type='dealer'`, `tier='paid_access'` (or per 8.1); `password_hash/salt` transformed base64url to base64 with the `100000.` prefix (1.2). The portal's login switches its lookup to FINDER_DB users-by-username; its own HMAC cookie format is unchanged. `is_admin` stays a portal-DB concern (8.4). | SURVIVE: portal cookies are username-keyed and the signing secret does not change. Only a password changed mid-transition needs care (dual-write, step 9 below) |
| 4. Finder supplier dealers | Do NOT merge. They are sellers, not buyers (the `0013:2-3` warning). Table renames to `suppliers` late; `authenticate()`'s dealer branch (`auth.js:407-412`), the role-to-table map (`auth.js:308,317,361,557`) and the `/dealer/*` finder routes (`index.js:2078-2125`) update in the same deploy. | Finder-dealer cookies re-validate against the renamed table the moment the same-commit deploy lands; a brief mismatch exists only during the deploy propagation itself. Population is tiny and the feature is flagged off |

Admin stays env-password, id 0, no row (`auth.js:381`) - untouched.

### 2.3 What the app looks like after

Admin sidebar says Users (with tabs Fully managed / Paid / Free / Dealers
/ Agents, driven by `type`+`tier`) and Searches; labels only, view keys
stay `clients`/`requests` behind the existing alias hook (`admin.js:1203`).
The portal scopes by `dealer_user_id` instead of `dealer_username`. Every
buyer-facing behaviour gates off `tier` instead of ad-hoc
`member`/`source` reads (those columns remain, now derived inputs).

---

## 3. CUTOVER STRATEGY

### Option A: direct rename, coordinated same-window deploy of both apps

Apply one migration that renames tables and adds columns, then deploy both
apps as fast as possible. Rejected:

- There is no atomicity to coordinate WITH. The finder pipeline runs the
  full suite plus e2e before deploying (`deploy.yml:36-70`, realistically
  5 to 15 minutes); the portal deploys via Pages separately. The deploy
  gate FORCES migration-before-deploy ordering
  (`check-remote-schema.mjs:69-77`), so from migration apply until the
  last app finishes deploying, production code is querying tables that no
  longer exist: every portal request page, every finder client/queue read,
  any cron tick, any Stripe webhook in the window.
- Rollback is a second coordinated window under pressure (reverse rename
  plus two redeploys), with portal writes possibly interleaved.
- There is no staging to rehearse the choreography even once.

### Option B: expand and contract (RECOMMENDED)

Every step is additive and independently deployable; the two apps never
need a shared window. The physical rename degenerates into a non-event
because, by the time it runs, both apps resolve table names through one
indirection point and tolerate either name.

- Expand: add `type/tier/username/dealer_user_id`, backfill, import portal
  accounts. Old code ignores unknown columns; the schema gate is satisfied
  because changes are additive (`migrations/README.md:44-46` explicitly
  prefers this).
- Migrate readers/writers: portal auth dual-reads (users first, own table
  as fallback), portal scoping moves to `dealer_user_id`, finder UI moves
  to type/tier. Each is one app, one deploy, one revert.
- Contract: only after both apps are indifferent to the names, rename
  tables in one small migration, flip the indirection, then delete old
  columns/fallbacks at leisure.

### On SQLite views as a compatibility bridge

`CREATE VIEW wishlists AS SELECT * FROM searches` keeps READS working, and
D1 should support it (the schema gate ignores non-table objects,
`check-remote-schema.mjs:47`). It does NOT cover the portal, because the
portal WRITES through these names, and SQLite views are read-only without
INSTEAD OF triggers. Even with triggers, the portal's client-create chains
off `meta.last_row_id` (`requests.js:152`), and D1's `last_row_id`
behaviour through an INSTEAD OF trigger is undocumented; D1 also
demonstrably restricts parts of SQLite (its authorizer rejects the
`pragma_table_info()` TVF, `check-remote-schema.mjs:94-100`). Verdict: a
view MAY be added as a read-only safety net during the rename window after
local and throwaway-D1 verification, but nothing in this plan DEPENDS on
views, and no write path ever goes through one. The indirection layer in
code is the real bridge.

---

## 4. STEP-BY-STEP SEQUENCE

Every production DB step goes through the approved workflow
(`db-apply-pending.yml`), never ad hoc. F = finder repo, P = portal repo.
Steps 1 to 3 are prerequisites; 4 to 8 are the expand phase; 9 to 12
migrate readers and writers; 13 to 16 are the contract phase (each
separately approvable, and 14 to 16 can be deferred indefinitely without
losing the functional wins).

1. **[production, one-off] Adopt migration tracking.** Run the "Adopt D1
   migration tracking" workflow (already built, PHASE0_PLAN section B).
   Verify: `npm run db:migrate:list` shows nothing pending. Without this,
   `db:migrate:remote` cannot run at all.
2. **[production, read-only] Backup.** `npx wrangler d1 export
   jdm-vehicle-finder --remote --output=backup-pre-phase3.sql` and the
   same for `jdm-dealers`. Verify: files are non-trivial and contain the
   expected tables. Re-export before EVERY later production step.
3. **[staging, build it] Create the rehearsal rig.** `npx wrangler d1
   create jdm-vehicle-finder-staging` (and a portal twin), import the
   step-2 exports, deploy a finder Worker to its workers.dev URL only and
   a portal Pages preview, each bound to the staging DBs via a temporary
   wrangler config that is never committed to main. Verify: both staging
   apps log in and browse against the copied data. This rig is where
   steps 4 to 16 are rehearsed before each production run.
4. **[local] F: migration 00NN "users expand".** ADD COLUMN `type`,
   `tier`, `username`, `dealer_user_id` to clients (defaults per 2.1);
   partial unique index on username; backfill UPDATEs for type
   (`category='dealer'`) and tier (rule 8.1 once signed off). Run
   `npm run db:migrate:local && npm run db:seed:local && npm test`.
   Verify: suite green, `db:check:local` passes.
5. **[staging then production] Apply the expand migration.** Staging
   first, click through; then the approved workflow for production.
   Verify after: `db:check:remote` green; spot queries -
   `SELECT type, tier, COUNT(*) FROM clients GROUP BY 1, 2` matches the
   dry-run counts from staging. Old code is untouched by these columns.
6. **[local] F: import tooling for portal accounts.** A script (pattern:
   `scripts/adopt-migration-tracking.mjs`) that reads a portal `dealers`
   export and emits INSERT statements for clients rows (`type='dealer'`,
   username, name, email, transformed salt/hash per 1.2) plus the
   `dealer_user_id` backfill UPDATE joining on
   `clients.dealer_username = users.username`. Include a unit test that a
   portal-format hash, once transformed, verifies under
   `verifyPassword` (`auth.js:145-159`).
7. **[staging] Rehearse the import.** Run the script's output against
   staging; log in on the staging PORTAL via a dual-read build (step 9)
   with a real dealer's credentials copied from the export. Verify: login
   works against the unified row; requests list identical before/after.
8. **[production] Run the import** via the approved workflow. Verify: row
   counts match the portal dealers table; every username unique; no
   existing client row was updated except `dealer_user_id` backfills.
9. **[P, deploy] Portal auth dual-read.** `login.js` (and
   `forgot/reset.js`) look up FINDER_DB `clients WHERE username = ? AND
   type='dealer'` first, fall back to the portal's own `dealers` table;
   password CHANGES during this period write to BOTH stores. Cookie
   format unchanged. Verify: existing sessions still pass the middleware;
   a fresh login and a password reset work; `login_events` still records.
10. **[P, deploy] Portal scoping moves off the text link.** `requests.js`
    ownership and list queries switch from `c.dealer_username = ?` to
    `c.dealer_user_id = ?` (resolved once from the session username); the
    client-create INSERT (`:148-151`) writes `dealer_user_id` AND
    `dealer_username` (dual-write) so a rollback of this deploy loses
    nothing. Verify on staging with a dealer that has existing requests.
11. **[F, deploy] Finder reads type/tier.** Users view with tabs (labels
    Users/Searches per 2.3, `admin.js:985,987,1006,1007,1070`; update
    `test/render-sweep.test.mjs:123-125`), tier-driven gates replacing
    direct `member`/`source` reads where behaviour is meant to be
    tier-based, agents shown as a UI union. Pure finder deploy,
    revertible by redeploying the previous commit.
12. **[P, deploy, after a bake period] Remove the portal fallback.**
    Auth reads FINDER_DB only; re-import any password changes that
    happened before step 9's dual-write landed (compare `updated`
    timestamps if available, else re-run the transform for rows whose
    hash differs). The portal `dealers` table stays as a dormant archive
    until 16.
13. **[both repos, deploys] Name indirection.** Mechanical sweep replacing
    literal table names in SQL with constants (`T.users`, `T.searches`,
    `T.queue`) resolved from one module per app; resolution prefers the
    new name if it exists (one cached `sqlite_master` probe per isolate)
    else the old. Sizing per 1.5: about 293 finder statements plus about
    12 portal statements. The full suite is the safety net; land it in
    slices (per table) if preferred. Behaviour identical before and
    after; deployable any time.
14. **[staging then production] The rename migration.** `ALTER TABLE
    clients RENAME TO users; ALTER TABLE wishlists RENAME TO searches;
    ALTER TABLE dealers RENAME TO suppliers;` (queue keeps its name -
    nothing user-facing says "queue"). SQLite rewrites FK references and
    index attachments on RENAME automatically. Both running apps flip via
    the step-13 probe on their next isolate; no deploy is required in the
    window. Verify: staging soak first (a full cron tick, a portal
    create/delete, a Stripe test webhook); production during a quiet hour
    with step 2's fresh export in hand.
15. **[F deploy, then P deploy] Same-window-free cleanup.** Update the
    role-to-table map (`auth.js:308,317,361,557`) so role 'dealer'
    resolves to `suppliers`, adminPage alias additions for any old
    bookmarks, and the schema-gate expectations (they update themselves:
    the gate derives from migrations). Remove the probe's old-name
    branches once both apps have deployed past 14.
16. **[local then production, last] Contract.** Drop
    `clients.dealer_username` (now unused), archive the portal's own
    `dealers` table, delete the drift fallbacks. Only after weeks of
    quiet.

## 5. ROLLBACK

| Step | Reversal | Window | Point of no return |
|---|---|---|---|
| 1 adopt tracking | `DROP TABLE d1_migrations` | any time | none (bookkeeping only) |
| 5 expand columns | ignore them, or `ALTER TABLE clients DROP COLUMN ...` (verify DROP COLUMN on a throwaway D1 first; SQLite supports it with index/FK restrictions - the partial index must be dropped first) | any time | none: old code never reads them |
| 8 account import | `DELETE FROM clients WHERE username IS NOT NULL AND type='dealer'` plus nulling `dealer_user_id` backfills; safe while nothing references the new rows | until step 10 is live | once portal writes hang data off `dealer_user_id` rows, deleting them orphans requests - after that, disable rather than delete |
| 9 portal dual-read | redeploy previous portal build | minutes | none (fallback still present) |
| 10 scoping switch | redeploy previous portal build; dual-written `dealer_username` keeps old queries correct | minutes | when dual-write of `dealer_username` is later removed (16) |
| 11 finder UI | redeploy previous finder build | minutes | none |
| 12 fallback removal | redeploy step-9 build | minutes | password changes made after removal exist only in FINDER_DB; re-sync before re-enabling the old store |
| 14 rename | reverse migration (`RENAME TO` back); both apps' probes flip back on next isolate | should be minutes; rehearse it on staging as part of step 14's drill | practically: once post-rename migrations or code start assuming new names exclusively (step 15 cleanup). Do not run 15 until 14 has soaked |
| 16 contract | restore from the step-2 export of that day | hard | THIS is the true point of no return; that is why it is last and lazy |

## 6. USER IMPACT

- **Customers, agents, admin:** no logout, no downtime on the recommended
  path. No id changes, no table moves for them until step 14, which is
  invisible at the session layer (role-to-table strings only change for
  the supplier store). Visible change: labels become Users/Searches.
- **Portal dealers:** no logout at cutover (username-keyed cookies,
  unchanged secret, dual-read). A dealer who changes their password
  exactly between step 9 landing and step 12's re-sync could need one
  reset; the dual-write is designed to make that set empty.
- **Finder supplier dealers:** cookie re-validation flips tables during
  the step 14/15 deploy; worst case those few users (feature flagged off)
  sign in again.
- **In-flight jobs:** cron ticks are safe at every step except a botched
  14, which is why 14 is staged, quiet-hour, and probe-bridged. Stripe
  webhooks are unaffected throughout because no existing client id is
  ever remapped and `stripe_customer_id` matching is id-independent
  (`stripe.js:216-217`).
- **Customer comms:** nothing needed. If Ben wants, a one-line portal
  notice ("you may be asked to sign in again") before step 12, but the
  design goal is that nobody notices anything except new labels.

## 7. LOCAL TEST PLAN

1. Fresh local DB: `npm run db:migrate:local && npm run db:seed:local`;
   with the expand migration in place, `npm test` (576 tests today) plus
   new tests below must pass, and `npm run db:check:local` stays green.
2. New unit tests to write with the build:
   - portal-hash transform verifies under `verifyPassword` (store 3);
   - type/tier backfill mapping against seeded category/source/member
     permutations;
   - the Users view tabs render counts per type/tier;
   - name-indirection probe picks the right table pre and post rename
     (run the suite twice: once on a schema with old names, once renamed).
3. Four (five) auth paths after each milestone, scriptable against
   `wrangler dev` with the seeded DB: admin env password (auth.js:381),
   agent row login (auth.js:400), client portal login (auth.js:420),
   finder dealer login (auth.js:407), each asserting the post-login home
   (`index.js:598-602`); plus the portal path below.
4. Cross-app rehearsal: run the portal locally against the SAME local
   SQLite as the finder by pointing both dev servers at one persistence
   directory (`wrangler dev --persist-to` / `wrangler pages dev
   --persist-to` with matching database ids). Then: create a request in
   the portal, run the finder matcher (`/run` route) against the fixture
   feed (`AUCTION_FIXTURE`), see the match on both sides; delete the
   request in the portal; confirm queue/seen_lots/wishlists rows go.
   Repeat this exact loop at steps 9, 10, 12, 13 and after the rename.
5. Rename drill: apply the step-14 migration to the local DB while both
   dev servers are RUNNING and confirm the probe flips without restarts;
   then reverse it and confirm the flip back.
6. e2e: `npm run test:e2e` (Playwright smoke) at each finder deploy step.

## 8. OPEN QUESTIONS (decisions needed before build)

1. **Tier backfill rule.** Proposed: `member=1 -> paid_access; else
   source='public' -> free; else fully_managed`. Is every staff-created,
   non-member client really "fully managed"? Needs Ben/Jate sign-off on
   the dry-run counts from step 4.
2. **Agents: physical merge or virtual union?** The charter names
   `type='agent'`, but a physical merge remaps agent ids referenced by
   `client_shares`, `clients.agent_id`, `wishlists.owner_id`,
   `tasks.assigned_to`, and logs every agent out. Recommendation: virtual
   union in the Users view for Phase 3, physical merge as its own later
   decision. Confirm this is an acceptable reading of the charter.
3. **Per-request pseudo-clients.** The portal creates one client row per
   request (`requests.js:203`). Collapse them to one container per dealer
   during Phase 3 (nicer data, more migration), or leave them owned via
   `dealer_user_id` (less risk)? Recommendation: leave, revisit in
   Phase 6.
4. **Portal `is_admin` accounts.** Keep the portal admin panel gated by
   the portal DB (recommended: notices/featured/registrations are
   portal-local features), or model it in the unified table?
5. **Duplicate client emails.** `authenticate()` tolerates up to 5 rows
   per email (`auth.js:420-427`). Does the unified users table enforce
   unique email eventually (requires a dedup exercise), or stay
   duplicate-tolerant with username as the only unique key? Affects
   whether login-by-email can ever be the single path.
6. **Do the physical renames actually ship?** Steps 4 to 13 deliver every
   functional outcome; 14 to 16 deliver naming purity at most of the
   plan's residual risk. The charter wants the renames; the risk table
   says they are separable. Ship or defer is a business call.
7. **Rename `dealers` to `suppliers` timing.** Bundled into step 14 here;
   alternately it can ride with Phase 6's `submitted_units` work, which
   touches the same feature. Either works; doing both renames in one
   migration window is one fewer approval.
8. **Staging costs and hygiene.** The staging D1 pair contains production
   personal data; confirm that is acceptable, or the import scripts
   need an anonymise pass before staging load.
9. **`SESSION_SECRET` custody.** Portal cookie continuity across step 9
   depends on the portal keeping its existing `SESSION_SECRET`. Confirm
   it is set as a Pages secret and not regenerated by any deploy tooling.
