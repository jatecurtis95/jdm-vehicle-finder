# BUILD.md - JDMC 2.0 Finder build charter

**Status: authoritative.** This charter governs the build. Where it conflicts
with Ben's doc, the original PLAN.md text, or any other document, this file
wins. It was distilled on 22 July 2026 from `audit/PLAN.md` (the reconstructed,
audit-annotated plan). The full evidence base (`CLAIMS.md`, 161 claims with
file:line evidence, and `FINDINGS.md`) lives on the Windows machine and is
referenced here by claim id; the per-phase corrections below carry across every
`[AUDIT: ...]` annotation from PLAN.md.

## Scope

**In:** Phases 0 to 9 as specified below.

**Out (decided, do not build, do not design for):**
- Multi-market (AUS / UK / HK). No market or region column anywhere, in any
  schema or interface. Ben's doc raises it; it is deferred, not scoped.
- Content (testimonials, videos) - production work; the only dev tie-in is
  leaving embed slots on the Phase 9 landing page.
- Lead funnel (plan already started elsewhere).
- New Pricing Model (mostly finished elsewhere).

## Decisions already made - record, do not relitigate

1. **Multi-market is out.** See above.
2. **Search cadence stays at 4 per day.** Deliberate override of Ben's doc,
   which asks for 2 to 3. Phase 5 is therefore only the manual trigger; the
   cron does not change.
3. **RA2 stays in scope.** Grades match by exact string, so a lot graded
   `RA2` matches neither an `RA` pill nor a `2` pill and vanishes silently.
   The filter engine maps the RA pill to {RA, RA2}; the pre-deploy feed check
   (`scripts/check-feed-grades.mjs`) is the only sanctioned source for
   extending grade spellings.
4. **Filtering: port the Auction History filter engine to Live Auctions** so
   both behave identically. All filters in ONE large always-visible panel.
   Nothing collapsed, no "More filters" details element, no hidden sections.
5. **SMS is open and is Ben's call.** Do not build it. Do not close it. His
   answer is needed before Phase 4 starts.
6. **A "Finder Notes document" is cited by Ben** as wholly included but has
   not been sighted. Chase it; anything it adds is new scope to be triaged
   against this charter, not silently absorbed.

## Build order

0, 1, 2, 3, 4, 5, 6, 7, 8, 9 - with Phase 5 deliberately sitting AFTER
Phases 3 and 4 in execution order, so the manual trigger is not built against
tables Phase 3 renames.

| Order | Phase | Complexity (audited) | Status |
|---|---|---|---|
| 1 | 0 Pre-flight | LOW to MEDIUM | investigation done (`audit/PHASE0_PLAN.md`); execution needs approval |
| 2 | 1 Filtering | MEDIUM | **BUILT** on `feat/phase1-filtering` (22 Jul 2026); pending review + live feed check |
| 3 | 2 Results / landed cost | MEDIUM | next |
| 4 | 3 Users model | HIGH, heavier than framed | blocked on Phase 0 reconciliation |
| 5 | 4 Flags / permissions | MEDIUM | blocked on Ben's SMS answer |
| 6 | 5 Automation trigger | LOW | after 3 and 4 |
| 7 | 6 Submitted units | LOW to MEDIUM | extend existing flow |
| 8 | 7 Calculator | MEDIUM | repo known, embed partly done |
| 9 | 8 Eligibility MMV | MEDIUM | - |
| 10 | 9 Landing page | HIGH | last, depends on 7 and 8 |

## Phase specifications (with audit corrections carried across)

### Phase 0 - Pre-flight
Reconcile outstanding branches, worktrees and unpushed work before anything
structural, because main deploys to production.
- **[Correction, C-002]** `codex/auction-history-example` carries 9 commits
  not on main (not 4), including production-release-control and
  launch-regression work.
- **[Correction, C-005]** Reconciliation also spans three worktrees, nine
  unpushed branches and a dirty main **on the Windows machine** - none of
  that is visible from the repository remote; it must be inventoried there.
- **[Correction, C-006/C-131]** `jdm-calculator` does NOT need cloning; it is
  fully cloned at `C:\Users\jatec\repos\jdm-calculator`, pricing tables are
  hardcoded consts in `calc-v2.js`.
- **[Correction, C-008]** Migration-tracking adoption is not build work: the
  full toolchain exists (`db:migrate:*` scripts,
  `scripts/adopt-migration-tracking.mjs`, the manual "Adopt D1 migration
  tracking" workflow, and a guard in `db-apply-pending.yml`). It reduces to
  running the existing workflow once, with approval.

### Phase 1 - Auction filtering  (BUILT, pending review)
Files: `src/auction-history-query.js`, `src/auction-history.js`,
`src/auction-ui.js`, `src/admin.js`, `src/index.js`.
- One shared filter engine validates and queries both Live (`main`) and
  History (`stats`).
- Grade multi-select everywhere, ordered exactly R, RA, 2, 3, 3.5, 4, 4.5,
  5, 6, S; Live's min-grade number input replaced by the pills; RA pill also
  matches RA2 (decision 3). Feed check for 6 / S / RA2 spellings before
  deploy: `scripts/check-feed-grades.mjs` (needs `AVTONET_CODE`).
- Auction house multi-select on both tabs (OR-group; legacy single `house`
  param still honoured).
- Unreliable filters (colour / fuel / body / drivetrain) labelled "(as
  listed, may exclude incomplete listings)" with an include-unspecified
  toggle defaulting ON. Body stays positive-match only (no field to be
  blank). Structured columns `kpp`, `priv`, `eng_v`, `color` are used where
  they exist (they already were).
- One always-visible panel on both tabs (decision 4); chips retained;
  variant/trim input wired to `distinctGrades()` on both tabs.

### Phase 2 - Auction results and landed-cost accuracy
Files: `src/calc.js`, `src/auction-history.js`, `src/auction-ui.js`,
`src/admin.js`.
- One landed-cost path: History rows and Live cards use the real calculator
  (batched), not the rough x1.13 + $9,000 formula. The rough formula remains
  only as an instant placeholder / the matcher's soft budget filter.
- Settings-tunable bias so estimates can aim 5 to 10% under actuals after
  back-testing against completed imports (back-testing itself is a
  data exercise, not code in this phase).
- Live cards rise to History's information density (landed cost, engine).
  The exact lot-detail field list is a design session after Phase 1 ships.

### Phase 3 - Unified Users model + terminology
Files: migrations, `src/admin.js`, `src/index.js`, dealer-portal auth.
- Evolve `clients` into `users` with `type` (customer / dealer / agent) and
  `tier` (fully-managed / paid-access / free). Rename + backfill, not a new
  table.
- **[Correction, C-076]** `source='public'` stamping lives in
  `admin.js:7450` and `:7481`, not `request-wizard.js`.
- **[Correction, C-064/C-066/C-068]** FOUR credential stores to reconcile:
  agents, `clients`' own PBKDF2 columns (`pass_salt`/`pass_hash`,
  `migrations/0001_baseline.sql:41-42`), dealer-portal accounts, and a
  dormant fourth in the finder's supplier `dealers` table.
- **[Correction, C-073]** The dealer portal WRITES to FINDER_DB (inserts
  `clients`, updates/deletes `wishlists` and queue rows). Any rename is a
  coordinated two-app atomic deploy, not a solo migration.
- Terminology sweep: `wishlists` to `searches`; UI labels Customers to Users,
  Requests to Searches. Labels + routes first, table renames in the same
  migration window.
- **[Correction, C-079]** `feat/requests-customers-unify` is already merged
  to main but added no users/tier schema; review it first (see
  `audit/PHASE0_PLAN.md` section C).
- **[Correction, ordering]** Do NOT rename `dealer_vehicles` in this phase;
  Phase 6 replaces it with `submitted_units`.
- Hard prerequisites: Phase 0 reconciliation executed; staging D1 pass;
  migration-tracking adopted; both apps deployed in the same window.

### Phase 4 - Access, permissions and feature flags
Depends on Phase 3. Per-user flags/prefs (`email_results`,
`delivery_channel`, `match_notifications`, `portal_enabled`); `notify.js`
reads per-user prefs first, global settings as kill-switches only.
- SMS: decision 5 applies. Recommendation on file is "don't build SMS,
  WhatsApp covers it", but the call is Ben's; obtain it before starting.

### Phase 5 - Search automation (manual trigger only)
- Cadence stays 4x/day (decision 2). No cron change.
- Expose `runWishlist()` behind `POST /admin/run-search/:id` (staff) and a
  rate-limited portal button (users), reusing the existing KV rate-limit
  helpers. Built AFTER Phases 3 and 4 so it targets the renamed tables.

### Phase 6 - User-submitted units for review
- **[Correction, C-116/C-NEW-162]** A member-facing flow already exists
  (Request-bid -> `/portal/auctions/request` -> pending `client_request`
  queue row + staff push). This phase EXTENDS that flow to free-tier
  coverage and quotas; it does not build a new one. Complexity LOW to
  MEDIUM.
- Per-tier quotas in settings (tunable without deploys), enforced
  server-side (D1 count per window) plus the KV IP limiter. Closes the
  dealer-submission flow's missing per-account rate limit too.
- Admin review queue with approve/respond and a submissions-per-day counter.
- Caveat: C-NEW-162 was pointer-level evidence; if the existing flow turns
  out shallower than believed, scope grows back towards the original.

### Phase 7 - Calculator integration
- **[Correction, C-006/C-131]** Repo state known: cloned locally, pricing
  tables are consts in `calc-v2.js`. Complexity MEDIUM, not MEDIUM-HIGH.
- **[Correction, C-122/C-NEW-163]** The calculator DNS is NOT broken (live
  probe 22 Jul 2026: HTTP 200 with Origin header, 403 without, GET / 200).
  Fix the stale portal proxy comment at `functions/api/calc.js:8-10` in this
  phase; do not chase DNS.
- **[Correction, C-NEW-164]** The portal already embeds a working
  calculator; recent commits added `calculator-embed.html` and a WordPress
  snippet. Check whether pricing tables now exist BOTH client-side
  (`calc-v2.js`) and server-side (Netlify function) - if so this phase
  reconciles two locations, not one.
- Admin-editable values (EBS per shipping line, agency fee, compliance,
  DAFF) from the finder's Settings; presets per user type via Phase 3.

### Phase 8 - Eligibility Make/Model/Variant view
Repo: `rover-eligibility-local`. Work the 82-row review queue (skip
non-eligible listings), then the consumer-facing Make -> Model -> Variant
view beside the power view. The cleaned MMV dataset feeds Phase 9.

### Phase 9 - Lead landing page + price-range database
Last; depends on 7 and 8. Decision still needed on where it lives
(`jdm-bridge` or a page on the finder).
- **[Correction, C-153/C-154]** The `stats` table is a REMOTE GATEWAY with
  sample caps, not local D1: the price-range precompute CANNOT be a
  scheduled D1 query. Reuse the comparable-sales logic in `src/market.js`
  (not `admin.js`), and design the precompute around gateway limits. Test
  the algorithm against known models before it qualifies leads.

## Key risks (carried from the audit)

- **HIGH:** main deploys to production and unpushed overlapping work exists
  in another session / on the Windows machine. Phase 0 is genuinely first
  for anything structural.
- **HIGH:** the Phase 3 migration touches auth in four credential stores
  across two apps, and the dealer portal writes to FINDER_DB.
- **MEDIUM:** grade values 6 / S / RA2 and the structured colour/drivetrain
  columns need live feed verification before the Phase 1 filters ship
  (`scripts/check-feed-grades.mjs` is the probe; not yet run - needs
  credentials).

## Standing rules (absolute)

- Never push to any remote. Never merge, rebase or delete branches without
  explicit approval.
- Never apply a migration, local or remote, without asking. main deploys to
  production.
- All code work on a branch, never on main.
- Make the smallest change that satisfies each task. No refactoring adjacent
  code, no fixing unrelated bugs, nothing out of scope. Anything worth doing
  gets listed in `audit/PROGRESS.md` instead of done.
- Known bugs recorded in the audit (`approved_by` hardcoded 0 at
  `src/admin.js:8768`; stale proxy comment at `functions/api/calc.js:8-10`;
  "sliding-window" mislabel at `src/index.js:56`) are fixed only in the
  phase that touches that file, never opportunistically.
- Australian English. No em dashes or en dashes.
