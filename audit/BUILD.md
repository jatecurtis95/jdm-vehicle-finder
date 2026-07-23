# JDMC 2.0 Finder: Build Charter

Status: authoritative. This document governs the build. Where PLAN.md and this
charter disagree, this charter wins. PLAN.md remains as annotated history;
audit/FINDINGS.md and audit/CLAIMS.md remain the evidence base. Claim IDs
(C-xxx) cited throughout refer to audit/CLAIMS.md.

Baselines: finder f414a2d, portal 10f3d2f, elig 6fdbede, bridge 92788cb,
calculator 053c2ae (local clone at C:\Users\jatec\repos\jdm-calculator).

Companion document: audit/PHASE0_PLAN.md carries the Phase 0 investigation
detail (branch reconciliation, migration tracking, unify branch review) and
the performance diagnostic.

## 1. Scope

In scope: Phases 0 to 9 as chartered in section 5.

Out of scope, and not to be reintroduced by any phase:

- Multi-market (AUS/UK/HK). No market or region column is to be added
  anywhere, including the new tables Phases 3, 6 and 9 create.
- Content production (testimonials, videos). The only dev tie-in is leaving
  embed slots on the Phase 9 landing page.
- Lead funnel (planned separately).
- New Pricing Model (mostly finished, pressure-tested separately).

## 2. Decisions already made (closed, do not relitigate)

1. **Multi-market is out.** No market or region column anywhere. Any schema
   proposal containing one is rejected on sight.
2. **Search cadence stays at 4 per day** (`0 */6 * * *`, C-104). This is a
   deliberate override of Ben's doc, which asks for 2 to 3. Closes C-111.
   Phase 5 is therefore only the manual trigger.
3. **RA2 stays in scope.** Grades match by exact string (C-020), so a lot
   graded RA2 would match neither an RA pill nor a 2 pill and would vanish
   from results silently. The Phase 1 feed probe (C-046) is widened: check
   the rate column for RA2 and any other non-standard values alongside the
   6 and S check, then decide within Phase 1 whether RA2 should match RA.
4. **Filtering: one engine, one panel.** Port the Auction History filter
   engine to Live Auctions so both tabs behave identically (C-044). All
   filters live in ONE large, always-visible panel. Nothing collapsed: no
   "More filters" details element (C-035, C-037), no hidden sections, and
   the post-search "Edit search" fold (C-036) goes too. Ben's requirement is
   that filters are all together and not hidden.
5. **SMS is still open and is Ben's call** (C-101). Do not build it. Do not
   close it. Phase 4 ships email and WhatsApp; the flags structure must not
   preclude adding an SMS channel later.
6. **Build order is the corrected order in section 5**, with Phase 5 after
   Phases 3 and 4 so the trigger is not built against tables Phase 3 renames
   (FINDINGS section 4).

## 3. Open items (pending Ben, not blockers to start)

| Item | Claim | Blocks |
|---|---|---|
| SMS channel yes/no | C-101 | Nothing; Phase 4 ships without it |
| Submission quota numbers per tier | C-117 | Phase 6 final config only; mechanism builds regardless |
| Landing page host: jdm-bridge or finder domain | C-155 | Phase 9 start |

## 4. The Finder Notes document

Ben cites a "Finder Notes document" as wholly included in his requirements.
It has not been sighted during planning or audit. Two candidate files exist
in the finder repo and should be sighted during Phase 0:
`jdm-vehicle-finder/Finder Site Notes V1.2 - Status.pdf` and
`jdm-vehicle-finder/ben-notes-v12-status.html`.

Until it is sighted, the following are flagged as exposed to unsighted
requirements. If the document surfaces and conflicts, raise it; do not
silently absorb scope.

- Phase 1: the filter set may be incomplete against Ben's list.
- Phase 2: the results and lot detail field list (the design session in
  C-063) may already be specified.
- Phase 3: tier names and definitions (fully managed / paid access / free)
  may be specified differently.
- Phase 6: quota expectations may be specified.
- Phase 9: landing page flow and content may be specified.

## 5. Build order

Corrected by the audit (FINDINGS section 6). Phase 5 sits after 3 and 4 so
the trigger is built once against the renamed schema.

| Order | Phase | Complexity (revised) | Why revised |
|---|---|---|---|
| 1 | 0 Pre-flight | LOW-MEDIUM | Reconciliation bigger than planned (C-002, C-005); clone and tracking build work vanished (C-006, C-008) |
| 2 | 1 Filtering | MEDIUM | As planned; feed probe widened for 6, S, RA2 |
| 3 | 2 Results and landed cost | MEDIUM | As planned; C-NEW-165 probe is a cheap precondition |
| 4 | 3 Users model | HIGH | Heavier than planned: four credential stores, two-app deploy |
| 5 | 4 Flags and permissions | MEDIUM | As planned |
| 6 | 5 Automation trigger | LOW | Manual trigger only; moved after 3 and 4 |
| 7 | 6 Submitted units | LOW-MEDIUM | Smaller: extend the existing request-bid flow |
| 8 | 7 Calculator | MEDIUM | Smaller: no DNS fix, repo state known, portal embed live |
| 9 | 8 Eligibility MMV | MEDIUM | As planned |
| 10 | 9 Landing page | HIGH | Grew: stats table is a remote gateway, not local D1 |

## 6. Phase charters

### Phase 0: Pre-flight

Goal: a clean, reconciled, tracked starting line. Nothing else ships first.

Scope (detail in audit/PHASE0_PLAN.md):

1. Branch and worktree reconciliation (C-002, C-005): 9 divergent commits on
   `codex/auction-history-example`, `rescue/onedrive-wip-2026-07-22`, three
   linked worktrees, nine unpushed branches, dirty main. Inventory, then
   merge, cherry-pick or discard per the Phase 0 plan. All git actions that
   touch main require explicit approval (section 7).
2. Migration tracking adoption (C-008, C-011): run the existing one-off
   `db-adopt-tracking.yml` workflow once, with approval. No build work. In
   the same change, sweep the comments that adoption makes stale:
   `.github/workflows/deploy.yml:9` and `migrations/0011_client_category.sql:7`
   (FINDINGS section 7 item 4).
3. Prior-art review of the merged `feat/requests-customers-unify` work
   (C-079, C-088): recorded in PHASE0_PLAN.md, re-read at Phase 3 design.
4. Sight the Finder Notes candidates (section 4) and update the exposure
   register.
5. Performance diagnostic (new, not in PLAN.md): findings and ranked
   recommendations live in PHASE0_PLAN.md. Diagnose before optimising; any
   fixes are scheduled into the phase that owns the touched file.

Dropped from PLAN.md: cloning jdm-calculator (C-010); the clone already
exists at C:\Users\jatec\repos\jdm-calculator (C-006, C-131).

Exit criteria: main clean; every branch and worktree dispositioned or
consciously parked; tracking adopted and verified; unify prior art recorded.

### Phase 1: Auction filtering

Goal: Live Auctions and Auction History filter identically, through one
engine, in one always-visible panel.

Files: src/auction-ui.js, src/auction-history.js, src/auction-history-query.js,
src/avtonet.js.

1. Extract the History filter engine (validation + form) and drive both tabs
   from it (C-044). Verified surface map: C-014, C-015.
2. Grade pills, multi-select, ordered exactly R, RA, 2, 3, 3.5, 4, 4.5, 5,
   6, S on both tabs (C-045), replacing Live's numeric min-grade input
   (C-021, C-022).
3. Feed probe first (C-046, widened per decision 3): how do 6, S, RA2 and
   any other non-standard values appear in the rate column? Decide the RA2
   mapping (own pill vs matches RA) from that data, within this phase.
   Matching is exact string (C-020), so unmapped values vanish silently;
   that outcome is not acceptable for RA2.
4. Auction house multi-select on both tabs; single LIKE becomes an OR group
   (C-047).
5. Inference filters (colour, fuel, body, drivetrain; C-030, C-031): keep,
   label "(as listed - may exclude incomplete listings)" (C-048), add an
   "include unspecified" toggle defaulting ON (C-049), and probe the
   structured feed columns kpp/priv/eng_v/color, using them where reliable
   (C-050). The petrol-by-absence quirk (FINDINGS section 7 item 5) is
   covered by the labelling and toggle; no separate fix.
6. One large always-visible filter panel on both tabs, per decision 4. All
   details elements and the post-search fold are removed. Active-filter
   chips are retained (C-038).
7. Variant/trim selector per make and model via distinctGrades() wired into
   both tabs (C-052); the building block exists (C-039, C-040) but was never
   wired into search (C-041).

### Phase 2: Auction results and landed-cost accuracy

Files: src/calc.js, src/auction-history.js, src/auction-ui.js, src/admin.js.

Precondition: the C-NEW-165 realistic-payload probe. The 22 Jul 2026 probe
proved reachability only (empty payload, calc:null); prove that a realistic
payload returns finite, plausible grandTotal/landedAtPort before leaning on
estimateLanded(). Cheap, do it first.

1. One landed-cost path: route History rows and Live cards through the real
   calculator (estimateLanded via the attachLanded batch wrapper, C-055);
   the rough formula (AUD x 1.13 + 9000, C-053) survives only as an instant
   placeholder and the matcher's soft budget filter (C-061).
2. Implementation must follow the landed-cost performance recommendations in
   PHASE0_PLAN.md (call batching, caching, timeouts); do not multiply
   per-row upstream calls on hot pages.
3. Accuracy: back-test against actual completed imports; add a
   settings-tunable bias aiming 5 to 10 per cent under actuals (C-062).
4. Results information pass: bring Live cards to History's density; lot
   detail field list is a design session after Phase 1 ships (C-063), noting
   the Finder Notes exposure (section 4).

### Phase 3: Unified users model and terminology

Complexity: HIGH, and heavier than PLAN.md assumed. Files: migrations,
src/admin.js, src/index.js, plus the dealer portal.

Preconditions: migration tracking adopted (Phase 0); prior-art review of the
merged unify work re-read (C-088); staging D1 pass before any remote apply.

The two audit headlines that reshape this phase:

**Four credential stores, not two** (FINDINGS section 2):

| # | Store | Location |
|---|---|---|
| 1 | agents (staff logins) | finder D1 (C-082, C-064) |
| 2 | clients own portal logins (pass_salt/pass_hash/invite_token) | finder D1 (C-064) |
| 3 | portal dealers (PBKDF2 + HMAC session) | separate jdm-dealers D1 (C-068, C-072) |
| 4 | finder dealers (sellers), dormant behind flag | finder D1 (C-066, C-078) |

Unification touches three live auth systems plus one dormant, not "keep the
portal's PBKDF2 working" alone.

**The portal writes FINDER_DB** (C-073): it inserts clients, updates
wishlists and batch-deletes queue/seen_lots/wishlists rows. Any rename of
clients or wishlists breaks the portal immediately. This phase is therefore
a coordinated two-app cutover: the finder migration and the portal deploy
land in the same window. The full change-together checklist is FINDINGS
section 3 ("Everything that must change together in one deploy window").

Work items:

1. Schema: evolve clients into users with type and tier columns, backfilling
   from category/source/member (C-083). No market or region column. Backfill
   logic keyed on source targets the src/admin.js handlers (~7450 Google
   OAuth signup, ~7481 public request form), not request-wizard.js (C-076).
2. Fold portal dealer accounts into users with type='dealer', PBKDF2 auth
   preserved (C-084), replacing the fragile dealer_username text link
   (C-070, C-071).
3. Naming: canonical meaning is "dealer" = trade buyer only. Rename the
   finder's seller `dealers` table (for example suppliers) (C-085). Do NOT
   rename dealer_vehicles here; Phase 6 restructures it and renaming it
   twice is wasted work (FINDINGS section 4 item 2).
4. Terminology sweep in the same cutover: wishlists to searches, UI labels
   Customers to Users and Requests to Searches (C-086).
5. Tabbed admin Users view driven by type and tier (C-087).

### Phase 4: Access, permissions and feature flags

Depends on Phase 3.

1. Per-user flags/prefs structure: email_results, delivery_channel,
   match_notifications, portal_enabled (C-102). Today there is no per-user
   preference model at all (C-093, C-094).
2. notify.js reads per-user prefs first; global settings become master
   kill-switches only (C-103).
3. Channels offered: email and WhatsApp (both Twilio and Meta paths ready,
   C-096). SMS: per decision 5, not built, not closed; the channel enum must
   be extensible.

### Phase 5: Automation trigger

Complexity: LOW. Sits here, after Phases 3 and 4, so the trigger is built
once against the renamed schema and restructured accounts (FINDINGS section
4 item 1).

1. Cadence: stays 4 per day per decision 2. No cron change, no build work.
2. Per-search manual trigger: expose runWishlist() (sole caller today is the
   runAll loop, C-108) behind POST /admin/run-search/:id for staff and a
   rate-limited portal button for users, reusing the existing KV limiters
   (C-109, C-112). Route and label names follow the Phase 3 terminology
   (searches, not wishlists).
3. If this phase edits the limiter helpers, correct the mislabelled
   "sliding-window" comment at src/index.js:56 (FINDINGS section 7 item 3);
   otherwise it falls to whichever phase touches that file first.

### Phase 6: User-submitted units

Complexity: LOW-MEDIUM (down from MEDIUM). Depends on Phases 3 and 4.

PLAN.md assumed no user-facing flow existed; that was refuted (C-116). The
member "Request a bid" flow already exists end to end: buttons on the lot
page, search cards and watchlist POST /portal/auctions/request, queue the
lot as a pending client_request, alert the client and push staff
(C-NEW-162). What is genuinely missing: access for free/non-member tiers,
and quotas.

1. Extend the existing queue/client_request mechanism to more tiers; do not
   build a parallel review queue.
2. Quotas per tier, enforced server-side (D1 count per window) plus the KV
   IP limiter, tunable via settings (C-119). Numbers pending Ben (C-117);
   build the mechanism with placeholder config.
3. Close the missing rate limit on the dealer submission route (C-115).
4. Admin review/workload view: approve/respond actions plus a
   submissions-per-day counter (C-120).
5. dealer_vehicles restructuring happens here (generalised submitted-units
   queue keyed by user_id, C-118), deferred from Phase 3 by design.
6. Fix the approved_by bug while touching this flow: approveDealerVehicle
   stamps a literal 0 instead of the approving admin's id
   (src/admin.js:8768, FINDINGS section 7 item 1).

### Phase 7: Calculator integration

Complexity: MEDIUM (down from MEDIUM-HIGH). The uncertainty PLAN.md priced
in is resolved: the source is local (C-006), the pricing tables are located
as hardcoded constants in functions/api/calc-v2.js (C-131), the custom
domain DNS is healthy (C-NEW-163 refuted the outage fear), and the portal
already embeds a working calculator (C-NEW-164).

1. No DNS fix. Correct the stale portal proxy comment at
   jdm-dealer-portal/functions/api/calc.js:8-10 (FINDINGS section 7 item 2).
2. Before migrating pricing tables, confirm the deployed calculator matches
   the local clone at 053c2ae; the deployment may be ahead (CLAIMS.md
   baseline note).
3. Un-archive the repo and bring it into the active fold; move the hardcoded
   tables (shipping lines, LCT, stamp duty, rego, GST, DAFF) into
   admin-editable config, following the existing compliance/agency/FX
   pattern (C-129, C-135). Note there is no admin surface at all today
   (C-133).
4. Modes/presets per user type via Phase 3's model: simple customer, dealer
   preset, expanded internal (C-136).
5. Embed work is rescoped to the finder/member surfaces; the portal
   dashboard embed already exists and works (C-NEW-164, C-137).

### Phase 8: Eligibility Make/Model/Variant view

Repo: rover-eligibility-local. As planned (C-143, C-146 confirmed the
baseline and the gap).

1. Work the 82-row variant review queue, skipping non-eligible listings
   (C-141, C-147); the override seam (variant_overrides.json) is empty.
2. Build the simpler consumer-facing Make to Model to Variant view alongside
   the existing power view (C-148).
3. Expose the cleaned MMV dataset for the landing page and finder (C-149).

### Phase 9: Lead landing page and price-range database

Complexity: HIGH. Last; depends on Phases 7 and 8. Host decision pending
Ben (C-155).

1. Combined lead-qualification page: pick a car, instant eligibility check
   (25-year rule plus the Phase 8 simplified search), estimated price range
   (C-156, C-157).
2. Price-range database, corrected scope (C-154): `stats` is NOT a local D1
   table; it lives behind the remote auction-feed gateway (SQL over HTTP)
   with observed sample caps of roughly 250 to 300 rows. The scheduled job
   must pull from the external gateway into a NEW local D1 summary table;
   a local SQL rollup is not possible. No market or region column.
3. Reuse base is src/market.js (marketIntel: avg/median/trend), not admin.js
   (C-153).
4. Validate the price-range algorithm against known models before it gates
   leads (C-159).
5. Leave embed slots for content; content itself is out of scope (C-161).

## 7. Standing rules

1. **main deploys to production** in jdm-vehicle-finder (push to main runs
   wrangler deploy via GitHub Actions, C-004). Never push to main without
   asking. Never apply a remote migration without asking.
2. **Australian English throughout**: code comments, UI copy, docs, commit
   messages. No em dashes or en dashes anywhere.
3. **Known bugs are recorded in FINDINGS.md section 7.** Do not fix them
   opportunistically. Each is fixed in the phase that owns the file it
   lives in:

   | Bug | Owner phase |
   |---|---|
   | approved_by hardcoded 0 (admin.js:8768) | Phase 6 |
   | Stale DNS comment (portal calc.js:8-10) | Phase 7 |
   | "sliding-window" mislabel (index.js:56) | First phase to edit the limiter helpers (5 or 6) |
   | Tracking-adoption stale comments (deploy.yml:9, 0011:7) | Phase 0, same change as adoption |
   | Petrol-by-absence quirk (auction-history-query.js:198) | Phase 1, via C-048/C-049 (labelling and toggle, not a code fix) |

4. **Decisions in section 2 are closed.** Reopening one requires Ben, not a
   build-session judgement call.
5. **Schema discipline**: every D1 change is a numbered migration; local and
   staging first; remote apply only through the tracked pipeline and only
   with approval (rule 1).
6. **Two-app changes deploy together.** Anything renaming tables the portal
   writes (clients, wishlists, queue, seen_lots) lands finder and portal in
   the same window (C-073).
