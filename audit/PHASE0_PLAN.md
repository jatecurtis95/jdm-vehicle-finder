# PHASE0_PLAN.md - Pre-flight reconciliation plan (investigation only)

Written 22 July 2026 from the cloud session on `jatecurtis95/jdm-vehicle-finder`.
**Nothing in this document has been executed.** Every git command below is a
proposal for a human-approved session; per the standing rules this session
never merges, rebases, deletes branches or pushes.

**Hard limitation up front (C-005):** the audit records three worktrees, nine
unpushed branches and a dirty main ON THE WINDOWS MACHINE. None of that is
visible from the remote this session can see. Everything below covers the 26
branches on `origin` only. The Windows-side inventory (`git worktree list`,
`git branch -vv`, `git status` in each worktree, `git stash list`) must be
taken on that machine before any of the deletions below are executed,
because a remote branch that looks safe to delete here may be checked out or
extended in a local worktree there.

---

## A. Branch inventory (origin, vs `origin/main` at f414a2d)

### A1. The two branches Phase 0 names explicitly

**`codex/auction-history-example`** - 9 ahead / 35 behind, forked 13 Jul at
8c3750a. Confirmed: it is a strict ancestor of the rescue branch (the rescue
branch contains all 9 commits plus one more), so it needs no separate rescue -
deal with the rescue branch and this one follows.

None of the 9 commits are patch-equivalent to main (`git cherry`: all `+`),
but their CONTENT falls into three buckets:

1. **Superseded:** the auction-history example page
   (`src/auction-history-example.js`, its test, its `index.js` route, the two
   "progressive filters" commits). Main's production Auction History was
   built FROM this concept (docs/auction-history.md says so) and Phase 1 has
   now unified the filters further. Discard.
2. **Not on main and valuable:** five launch-regression test suites
   (`test/launch-admin|backend|public|release|security-regressions.test.mjs`,
   ~1,035 lines), a production smoke script (`scripts/production-smoke.mjs`),
   `public/_headers` hardening, SHA-pinned actions + `environment: production`
   gating in the workflows.
3. **Competing, needs a decision:** `scripts/reconcile-migration-ledger.mjs`
   plus its rewrite of `db-apply-pending.yml` and `migrations/README.md`.
   This is a SECOND solution to the same problem C-008's machinery solves
   (see section B). The codex version REMOVES main's adoption guard from
   `db-apply-pending.yml` in favour of ledger reconciliation. Adopting both
   blindly would leave the apply workflow guardless against a half-adopted
   ledger. Pick ONE: recommendation is main's adopt-tracking workflow
   (simpler, already reviewed, already on main), and cherry-pick only
   buckets 2 items from codex.
   Note: codex also edits `migrations/0011` and `0013` - comment-only
   (verified by diff), so no schema risk, but any cherry-pick touching
   migration files must stay comment-only or the adoption backfill and
   file-hash expectations drift.

**`rescue/onedrive-wip-2026-07-22`** - 10 ahead / 35 behind = codex's 9 plus
`8a40a54` "wip: rescue uncommitted OneDrive-clone work". That WIP commit is
the single most dangerous object in the inventory:

- It touches 21 files in one commit, including `src/admin.js` (+331/-x),
  `src/index.js` (+357), `src/matcher.js` (+134), `src/avtonet.js` (+100),
  `src/auction-ui.js`, `src/theme.js`, `src/auth.js`, `src/landing*.js`,
  `test/ratelimit.test.mjs`, `test/session-revocation.test.mjs`.
- **Overlap warning:** `admin.js`, `index.js`, `avtonet.js`,
  `auction-ui.js` are files Phase 1 has ALREADY rewritten on
  `feat/phase1-filtering`, and `admin.js` + `calc.js`-adjacent code is
  Phase 2 territory; `admin.js`/`index.js` are Phase 3 territory. A late
  merge of this WIP will conflict with all of it.
- It also contains unique, likely-wanted work: three audit documents
  (`CODE_AUDIT.md`, `FLOW_AUDIT.md`, `UI_AUDIT.md`), `scripts/avg-sold.mjs`
  + `test/avg-sold.test.mjs` (439 + 128 lines, relevant to Phase 9's
  price-range precompute), and launch-hardening edits of unknown intent.

The WIP commit mixes at least four unrelated workstreams; it cannot be
merged as-is. It must be SPLIT: docs and scripts extracted now (safe,
additive), the `src/` edits diffed file-by-file against main to decide
per-hunk whether they are (a) already superseded by main's launch-audit
fixes, (b) wanted and to be re-applied as clean commits, or (c) abandoned.

### A2. Small unmerged branches

| Branch | Ahead | Verdict from evidence | Proposed action |
|---|---|---|---|
| `claude/jdm-connect-qa-deploy-sad0ht` | 1 | `git cherry` says patch-equivalent to main (TVF fix already on main) | delete |
| `feat/dealer-category-and-match-fixes` | 1 | content (0011 category, RHD matching) visibly live on main via squashed PRs; SHA differs | verify with `git range-diff`, then delete |
| `claude/quick-edit-client-vehicle-ntxr2t` | 4 | its own commit message says PR #71's squash landed the content | verify, then delete |
| `feat/portal-requests` | 5 | **no merge base with main** - a different repo root (old bootstrap); its features (dealer_username, auto_notify) exist on main in evolved form | keep 30 days as archive tag, then delete |
| `claude/password-section-issues-ozgkds` | 12 (6 real) | mileage-min, category tabs etc. all visibly on main (0017 exists, tests exist); rest are merge commits | verify, then delete |

### A3. Stale long-diverged branches (all 87 behind, last commits 24 Jun - 3 Jul)

`claude/requested-changes-45iaj3` (167), `fix/set-password-1101` (171),
`fix/dashboard-two-column-grid` (169), `feat/finder-ux-and-fixes` (155),
`feat/matches-colour-sort` (75), `feat/matches-redesign` (73),
`feat/product-foundation` (69), `feat/client-portal-stripe` (62).

These forked before the squash-merge era and their "ahead" counts are almost
entirely commits whose content landed on main via squashed PRs (the July
history on main names the same features). One exception to check:
`feat/client-portal-stripe`'s "single toggle to show/hide landed (AUD) price
to clients" (24 Jun) - confirm that toggle exists on main before deleting;
it is Phase 2-adjacent.

### A4. Fully merged / zero-ahead branches (safe deletes)

`docs/user-guide`, `docs/user-guide-pdf`, `feat/admin-design-overhaul`,
`feat/client-share-links`, `feat/ia-audit-contact-logging`,
`feat/ia-audit-first-pass`, `feat/ia-audit-remaining`,
`feat/phase5-design-system`, `finder-v12`, `fix/v13-audit-gaps` - all
ahead=0. Delete freely.

### A5. Proposed command sequence (DO NOT RUN without approval)

Step 0 - Windows machine only:
```
git worktree list
git branch -vv               # unpushed branches
git stash list
git -C <each-worktree> status --porcelain
```
Risk if skipped: deleting an origin branch that a Windows worktree has
checked out leaves that worktree orphaned mid-work.

Step 1 - safety net (annotated tags keep the SHAs reachable after deletes):
```
for b in codex/auction-history-example rescue/onedrive-wip-2026-07-22 \
         feat/portal-requests feat/client-portal-stripe; do
  git tag archive/$b origin/$b
done
git push origin --tags
```
Risk: none (tags are additive). This is the one push in the plan.

Step 2 - extract the safe, additive pieces of the rescue WIP onto a new
branch off main:
```
git checkout -b chore/rescue-salvage origin/main
git checkout origin/rescue/onedrive-wip-2026-07-22 -- \
    CODE_AUDIT.md FLOW_AUDIT.md UI_AUDIT.md \
    scripts/avg-sold.mjs test/avg-sold.test.mjs
npm test                      # avg-sold.test must pass against main
git commit
```
Risk: `avg-sold` may depend on the WIP's `avtonet.js` changes - if its test
fails, keep the script on the branch unreferenced and note it for Phase 9.

Step 3 - cherry-pick the codex keepers onto a review branch:
```
git checkout -b chore/launch-hardening origin/main
git cherry-pick a53cc64 ab88949 ec9030c     # the three regression-test commits
git cherry-pick 2b15021                     # release controls - EXPECT conflicts
```
What breaks: 2b15021 conflicts with main's later workflow rewrites
(`db-apply-pending.yml`, `deploy.yml`, `migrations/README.md`) because main
built the adoption-guard approach after codex forked. Resolve by keeping
main's guard + adopt workflow, taking only the SHA-pinning,
`environment: production`, `public/_headers` and smoke-script hunks. The
regression-test commits may also fail against today's code where main fixed
the same findings differently - run the suite, adapt assertions, and treat
each failure as either a stale assertion or a real regression.

Step 4 - after review and merge of the salvage branches, delete:
```
git push origin --delete <branch>   # per A2/A3/A4 verdicts, after verification
```
Verification per branch before its delete:
`git range-diff origin/main $(git merge-base origin/main origin/<b>) origin/<b>`
and confirm every real commit shows as equivalent or visibly superseded.

Step 5 - the dirty main + unpushed branches on Windows: commit or stash the
dirty state onto a rescue branch there, push it, and re-run this inventory
against the new remote picture before Phase 3 starts.

---

## B. Migration-tracking adoption (C-008) - what it is, what it does

**Problem it solves:** production's schema is fully migrated, but everything
since 0002 was applied by hand (`d1 execute`), so wrangler's `d1_migrations`
bookkeeping table is missing/empty. In that state
`wrangler d1 migrations apply --remote` would re-run non-idempotent ALTERs
and die on "duplicate column". Phase 3's migration window needs the runner
working.

**The machinery (all already on main):**
- `scripts/adopt-migration-tracking.mjs` - emits SQL that creates
  `d1_migrations` (wrangler's own DDL: id, name UNIQUE, applied_at) and
  `INSERT OR IGNORE`s every numbered `migrations/*.sql` filename. It
  executes NO migration files.
- `.github/workflows/db-adopt-tracking.yml` - manual dispatch only. Steps:
  (1) `npm run db:check:remote` schema gate - refuses to mark files applied
  unless production actually has every table/column the migrations define;
  (2) pipes the adoption SQL through `wrangler d1 execute --remote`;
  (3) verifies `d1 migrations list` reports nothing pending.
- `.github/workflows/db-apply-pending.yml` - the normal future path; its
  guard step refuses to run while `d1_migrations` is missing or empty.

**What it changes in D1:** exactly one new table, `d1_migrations`, plus one
row per existing migration file. Zero changes to application tables, zero
DDL against them.

**Reversibility:** fully reversible - `DROP TABLE d1_migrations` returns
production to today's state. `INSERT OR IGNORE` on the UNIQUE name column
makes re-runs harmless, and the workflow is explicitly idempotent.

**What to verify after running (the workflow does 1 and 2 itself):**
1. `npm run db:migrate:list` shows nothing pending.
2. `npm run db:check:remote` still passes.
3. `wrangler d1 execute jdm-vehicle-finder --remote --json --command
   "SELECT COUNT(*) FROM d1_migrations"` equals the count of numbered files
   in `migrations/` (currently 19).
4. The two stale comments the audit flagged (migration files still saying
   "NEVER migrations apply") get updated in the next commit that touches
   those files.

**Interaction warning:** the codex branch's
`scripts/reconcile-migration-ledger.mjs` + workflow rewrite is a competing
implementation of this same adoption (and codex REMOVES the apply-workflow
guard). Decide for main's version (recommended - reviewed and live) and
drop codex's, or the reverse; never merge both.

**Not run from this session** (needs `CLOUDFLARE_API_TOKEN`, workflow
dispatch approval, and it mutates production D1 - out of bounds here).

---

## C. `feat/requests-customers-unify` - what already landed (C-079)

The branch was merged into main around 6a34849 (a merge of main INTO the
branch, after which the branch line became main's first-parent history). Its
real commits, all live on main:

| Commit | What it changed |
|---|---|
| `494d138` | One-step admin "new request": `createAdminRequest` match-or-creates the customer (source 'jdm') + wishlist in a single staff-only submit, reusing the public path's dedup so no duplicate customer/REQ spawns. Requests list groups the pipeline BY CUSTOMER (cluster + count badge, per-request pipeline counters intact). `src/admin.js` +244, `src/index.js` +37, new `test/requests-customers-unify.test.mjs`. |
| `ed4c3c8` | Code-review fixes on that flow (`admin.js` +66). |
| `c148be4` | Agent-owned customers protected from admin bulk delete (`admin.js`, `index.js`, `test/bulk-delete.test.mjs`). |

**Phase 3 items it covers:**
- The "Requests grouped by customer" half of the Users-view reorganisation -
  the Requests list already reads customer-first. Phase 3's Users view with
  type/tier tabs can build on this grouping pattern.
- Duplicate-customer prevention on staff intake (dedup + same-car refresh) -
  one less data-quality hazard for the `clients` -> `users` backfill.
- An ownership/permission precedent (agent-owned rows shielded from admin
  bulk actions) that the unified model must preserve.

**Phase 3 items it does NOT cover (confirmed, C-079):** no `users` table, no
`type` column, no `tier` column, no credential-store consolidation, no
terminology sweep (labels still Customers/Requests), no dealer-portal
account fold-in. The test file's own header says "without merging the
tables". Phase 3's schema work starts from scratch; only the UI grouping
and dedup layers are prior art.
