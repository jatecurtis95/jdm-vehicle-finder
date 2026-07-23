# PROGRESS.md - session report, 22 July 2026

Cloud session on `jatecurtis95/jdm-vehicle-finder`, working from
`audit/PLAN.md` (the reconstructed audited plan) and `audit/BUILD.md` (the
charter distilled from it). **Stopped before Phase 3 as instructed.**
Nothing was pushed to any remote; nothing was merged, rebased or deleted; no
migration was applied anywhere; no schema changed. All work sits on the local
branch `feat/phase1-filtering` (12 commits on top of main at `f414a2d`).
Full test suite: **576 tests, all passing** (564 pre-existing, 12 new).

## Completed

1. **audit/PLAN.md committed** (`c21cbb7`) so the charter travels with the
   repo. FINDINGS.md / CLAIMS.md remain on the Windows machine; corrections
   were carried from PLAN.md's inline audit annotations.
2. **audit/BUILD.md** (`1d2e2d5`) - the authoritative charter: scope, six
   recorded decisions, build order (Phase 5 after 3 and 4), per-phase specs
   with every audit correction, standing rules.
3. **audit/PHASE0_PLAN.md** (`1d2e2d5`) - investigation only, nothing
   executed. All 26 origin branches inventoried with verdicts; the
   migration-tracking adoption machinery documented (what it changes,
   reversibility, verification); requests-customers-unify coverage of
   Phase 3 mapped.
4. **audit/PERFORMANCE.md** (`2d341bc`) - diagnosis only, ranked impact vs
   effort. Headlines: relay round-trip waves and full-scan LIKEs dominate
   the auction pages; the in-client find flow made one calculator POST per
   result row; live card images defeat lazy loading; Google Fonts CSS
   render-blocks. Note: the brief said "Supabase CDN" - there is no
   Supabase anywhere in this codebase; images come from the provider CDN.
5. **Phase 1 built** (`3b4ba6a`..`522e602`): one filter engine for Live and
   History; grade pills R, RA, 2, 3, 3.5, 4, 4.5, 5, 6, S everywhere with
   RA2 folded under RA; auction-house multi-select as an OR-group with
   legacy `house` compatibility; include-unspecified toggle (default ON)
   with "(as listed)" caveats; ONE always-visible panel, no folds; trim
   datalist from distinctGrades() on both tabs; real COUNT(*) totals and
   numbered pagination on Live; `scripts/check-feed-grades.mjs` written as
   the pre-deploy grade probe.
6. **Phase 2 built** (`6d7ff6b`..`9a07927`): one landed-cost path. Pages
   render instantly with the rough x1.13+$9k figure as a placeholder, then
   one batched, session-gated, rate-limited POST per page swaps in real
   calculator estimates (History rows + Live cards). Live cards gained
   Engine and Est. landed, matching History's density. Estimates cached per
   (lot, price, state, assumptions). New `calc_bias_pct` setting (signed %)
   so estimates can be aimed 5 to 10% under actuals after back-testing.

## What changed, where (all on `feat/phase1-filtering`)

- `src/auction-history-query.js` - shared validator/WHERE builder for both
  relay tables; rates/houses/unspec; LIVE_SORTS; searchLive.
- `src/auction-history.js` - one-panel filter form (mode-aware), chips,
  liveSearchBlock, landed slots + landedFillScript, surface endpoints.
- `src/auction-ui.js` - old auctionSearchHeader and its CSS removed;
  viewToggle helper; cards gained Engine + Est. landed and snapshot engine.
- `src/admin.js` - both Live surfaces rewired onto liveSearchBlock; staff
  tab strip carries the shared filters; Settings gained the bias field.
- `src/index.js` - routes pass multi-select params via getAll(); three
  landed-batch endpoints with a per-session KV limiter.
- `src/calc.js` - estimate cache, estimateLandedBatch, bias in
  landedConfig/estimateLanded, and the missing getSettings import (below).
- `src/settings.js` - calc_bias_pct default + form parsing.
- `docs/auction-history.md` - filter mapping updated for Phase 1.
- `scripts/check-feed-grades.mjs` - new feed probe.
- Tests: `auction-history`, `auctions`, `auctions-flow`, `auctions-admin`
  updated where the product decision deliberately changed behaviour (the
  More-filters fold and old live header are gone); new
  `test/landed-phase2.test.mjs`.

## Bug found and fixed (in scope per the charter rule)

`src/calc.js` never imported `getSettings`, so `landedConfig()` always threw
internally and returned null: **the Settings-page landed-cost overrides
(compliance, agency, FX) have silently never applied in production** - every
estimate has been using env defaults. Found because Phase 2's bias flows
through the same path; fixed in `6d7ff6b` (calc.js is a Phase 2 file). Worth
telling Ben: any estimate tuning done through Settings until now did nothing.

## Could not verify without a running site / credentials

- **The RA2 / 6 / S feed check has NOT been run live.** The script exists
  and degrades correctly, but this environment has no `AVTONET_CODE`. Run
  `node scripts/check-feed-grades.mjs` with credentials before the Phase 1
  filters deploy; extend `HISTORY_RATES` match lists from its output if it
  finds other compounds.
- Visual layout of the new one-panel filter form and the enlarged card grid
  (server-rendered HTML is test-covered; pixels are not).
- The datalist refresh and deferred landed fill in a real browser (the
  scripts are static-tested only).
- Real relay latency and calculator latency (PERFORMANCE.md is static
  analysis; no timings).
- Whether the settings-overrides bug fix changes production estimate values
  noticeably (it will, wherever Settings values differ from env defaults).

## Questions hit (parked, not resolved)

1. Should RA2 also match the "2" pill? Implemented as RA-family only
   (accident-repair grade, not a clean 2), documented in code and docs.
   Reverse is a one-line change if Ben disagrees.
2. Where should the old live free-text `q` param go? The form field was
   removed in V1.3; the engine now drops `q` silently. Old bookmarks with a
   q term lose it. Acceptable?
3. Dealer landed estimates use the default state (VIC unless
   CALC_DEFAULT_STATE says otherwise) - dealers have no state on file. Fine,
   or should the dealer table grow a state? (Phase 3 territory.)
4. The staff prices tab (Sold prices) still has its own separate form -
   Phase 1 scoped "both tabs" as Live + History. Should prices unify too?
5. PHASE0_PLAN A5 step 1 proposes archive tags (one `git push origin
   --tags`) before deletions - approval needed since this session pushes
   nothing.

## Deliberately left undone (and why)

- **Phase 3 and beyond** - hard stop per instructions.
- The Phase 0 command sequence - investigation only, as instructed.
- The migration-tracking adoption run - mutates production D1, needs
  approval and credentials.
- The two `queue` indexes from PERFORMANCE.md #8 - a migration; recorded,
  not written.
- PERFORMANCE.md fixes #1 (KV lookup caches), #3 (lazy card images), #4
  (self-hosted fonts) - diagnosis-only task; #5 was however folded into the
  Phase 2 design (deferred fill exists precisely so real landed costs never
  block a page).
- Landed figures on the client-side Watchlist cards - the snapshot has no
  live price context; small follow-up if wanted.
- The `approved_by = 0` bug (admin.js:8768), the stale proxy comment
  (functions/api/calc.js - dealer portal repo, not this one), and the
  rate-limiter mislabel (index.js:56) - none of their phases were built
  this session, so per the charter they stay recorded, untouched.
- `feat/client-portal-stripe`'s landed-price toggle needs confirming on
  main before that branch is deleted (PHASE0_PLAN A3).

## What to check first

1. **Read the calc.js bugfix** (`6d7ff6b`) - it changes production
   behaviour the moment Settings values differ from env defaults. Decide
   whether current Settings rows hold values you actually want applied.
2. Run the feed check with credentials; extend the grade match lists if it
   reports unmatched values.
3. Skim `audit/BUILD.md` for anything mis-carried from the annotations, and
   the two decisions I made inside Phase 1's letter (RA2 under RA only;
   body filter excluded from the unspecified toggle - both documented).
4. Click through the new panel on a dev deploy: member live, staff live,
   member history, dealer history; tick RA + a couple of houses; untick
   include-unspecified; watch the Est. landed figures swap from "≈" rough
   to real ones a beat after load.
5. Then the Phase 0 verdicts in PHASE0_PLAN.md - the rescue WIP split is
   the one that gets harder the longer Phases 1-2 sit unmerged, because it
   touches the same files.
