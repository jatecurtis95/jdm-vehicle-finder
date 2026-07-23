> SUPERSEDED IN PART. Audited 22 Jul 2026 against baselines in
> audit/CLAIMS.md. Several premises were overturned. Read
> audit/FINDINGS.md before acting on any phase.

# Implementation Plan: JDMC 2.0 Finder Launch (excluding naming)

## What the codebase told us (shapes the whole plan)

- **"Dealer" currently means three different things**: a buyer tag (`clients.category`), a vehicle-*seller* table in the finder DB (`dealers` + `dealer_vehicles`), and trade-buyer portal accounts in the dealer portal's own separate DB. The unification section of the doc has to untangle this, not just rename tables.
- **Search automation is nearly done already**: cron runs every 6 hours (4×/day). What's missing is only a per-search manual trigger — `runWishlist()` exists but is never exposed individually.
- **The Auction History instinct is right**: it already has multi-select grade pills, colour/fuel/body/drivetrain, real result counts, and an Est. landed column. Live Auctions has almost none of that. The work is porting History's filter engine to Live, not building new.
- **Two landed-cost calculations coexist**: History rows use a rough formula (`AUD × 1.13 + $9,000`), while staff match cards call the real calculator API. The 5–10% accuracy goal means consolidating onto the real one.
- **The calculator source isn't on this machine** — `jdm-calculator` is archived on GitHub and only consumed as a live API. Any work on its internals (EBS per shipping line, etc.) requires cloning it first. [AUDIT: overturned, see C-006/C-131. Actual: a full clone with source exists at `C:\Users\jatec\repos\jdm-calculator` (referenced by Projects.code-workspace); no cloning is needed and the pricing tables are already located as hardcoded constants in `functions/api/calc-v2.js`.]
- **Answer to the open question on access/flags**: today it's a global `settings` table (`send_to_client`, `free_auto_send`, `whatsapp_enabled`, `free_search_limit`…) plus scattered per-row flags (`wishlists.auto_notify`, `clients.member`, `agents.alerts`). There is **no per-user notification preference model at all** — email delivery is gated by "does the client have an email + is the global switch on." SMS doesn't exist anywhere; WhatsApp (Twilio/Meta) is built and working.

## Phase 0 — Pre-flight (do before anything else)

1. Resolve the outstanding branches on `jdm-vehicle-finder`: review/merge or discard `codex/auction-history-example` (4 launch-hardening commits) and `rescue/onedrive-wip-2026-07-22`. Another session also holds unpushed overlapping work — reconcile before starting, since `main` = production deploy. [AUDIT: overturned in part, see C-002. Actual: `codex/auction-history-example` carries 9 commits not on main, not 4. Amended, see C-005: reconciliation also spans three active worktrees, nine local branches with no upstream, and a dirty main checkout, not just these two branches.]
2. Clone archived `jdm-calculator` locally (read-only) so its pricing tables (shipping lines, EBS, LCT, stamp duty) can be inspected for Phases 2 and 7. [AUDIT: overturned, see C-006/C-131. Actual: the clone already exists at `C:\Users\jatec\repos\jdm-calculator`; this action (C-010) is unnecessary and all claimed tables are confirmed hardcoded in `calc-v2.js`.]
3. Adopt the D1 migration-tracking discipline already noted as a launch prerequisite before any remote migration. [AUDIT: amended, see C-008. Actual: the adoption machinery is fully built and waiting (db:migrate/check scripts, adopt-migration-tracking.mjs, the one-off `db-adopt-tracking.yml` workflow); this shrinks to running the existing GitHub workflow once with approval, no build work.]

## Phase 1 — Auction Filtering (doc: "the main thing we need to get right")

**Complexity: MEDIUM · Files: `src/auction-ui.js`, `src/auction-history-query.js`, `src/auction-history.js`, `src/avtonet.js`**

1. **Unify Live Auctions onto the History filter engine** (Standardisation item): extract the shared filter form/validation from `auction-history.js`/`auction-history-query.js` and use it for both tabs, so filters and results match everywhere.
2. **Auction grade → multi-select everywhere**, ordered exactly `R, RA, 2, 3, 3.5, 4, 4.5, 5, 6, S`. History's pill set is currently `{3, 3.5, 4, 4.5, 5, R, RA}` — add `2`, `6`, `S`; replace Live's "min grade" number input with the same pills. Verify how `6`/`S` appear in the feed's `rate` column before wiring (grade is matched by exact string).
3. **Auction house → multi-select** on both tabs (currently single `<select>`; change the query from single `LIKE` to an OR-group).
4. **Unreliable filters (colour/fuel/body/drivetrain)**: these are keyword-inference against unstructured text, so filtering genuinely can exclude mislisted cars. Plan: keep them, but (a) label them "(as listed — may exclude incomplete listings)", (b) add an "include unspecified" toggle defaulting ON so blank-field lots aren't silently dropped, (c) probe the feed's structured columns (`kpp`, `priv`, `eng_v`, `color`) as the docs already recommend, and use them where they're reliable.
5. **Layout consistency — don't hide filters**: replace the collapsed `<details>` "More filters" sections with the always-visible pill-row style used for "auction held within" and grade, one consistent grid across both tabs, active-filter chips retained.
6. **Grade/trim search (the AUCRS-style item)**: the building block already exists (`distinctGrades()` feeds a datalist on the staff sold-prices page but was never wired into search). Wire it into both tabs as a variant/trim selector per make+model — this is what keeps Searches narrow.

## Phase 2 — Auction Results & landed-cost accuracy

**Complexity: MEDIUM · Files: `src/calc.js`, `src/auction-history.js`, `src/auction-ui.js`, `src/admin.js`**

1. **One landed-cost path**: route History rows and Live cards through the real calculator API (`estimateLanded()` with batching) instead of the rough ×1.13+$9k formula; keep the rough formula only as an instant placeholder while the real figure loads, or for the matcher's soft budget filter.
2. **Accuracy validation**: back-test the estimate against a handful of actual completed imports; add a settings-tunable bias to aim 5–10% under actuals. (Admin already has editable compliance/agency/FX — extend if back-testing shows other levers needed.)
3. **Results information pass**: bring Live cards up to History's information density (landed cost, engine/gearbox), and review the lot detail page fields — exact field list to be a design session after Phase 1 ships.

## Phase 3 — Unified Users model + terminology

**Complexity: HIGH (biggest structural item) · Files: migrations, `src/admin.js`, `src/index.js`, dealer-portal auth**

1. **Schema**: evolve `clients` into the unified `users` table with a `type` column (`customer`, `dealer`, `agent`, …) and a `tier` (fully-managed / paid-access / free), rather than creating a new table — it already holds all buyers with `category`, `source`, `member` proto-typing this. Migration renames + backfills types from existing columns. [AUDIT: amended, see C-076. Actual: the `source='public'` stamping lives in the `src/admin.js` handlers (~7450 Google OAuth signup, ~7481 public request form), not in request-wizard.js, so backfill logic keyed on source must target those handlers. Amended, see C-064: `clients` also carries its own login credentials (pass_salt/pass_hash/invite_token), a third live auth system this unification touches.]
2. **Fold in dealer-portal accounts**: portal `dealers` (trade buyers) become `users` with `type='dealer'`; keep their PBKDF2 auth working against the unified table (the portal already reads FINDER_DB for data, so this removes the fragile `dealer_username` text-link). [AUDIT: amended, see C-073. Actual: the portal also WRITES FINDER_DB (inserts clients, updates wishlists, batch-deletes queue/seen_lots/wishlists rows), so any clients/wishlists rename breaks it immediately; the portal deploy must land in the same window as the finder migration. See also C-064/C-066: four credential stores are in play (agents, clients logins, portal dealers, finder seller dealers), not the two this phase assumes.] The finder's `dealers` *seller* table gets renamed (e.g. `suppliers`) to kill the three-way name collision — that feature is flagged off and half-built, so it's cheap to rename now.
3. **Terminology sweep**: `wishlists`→`searches` and UI labels Customers→Users, Requests→Searches. UI labels + routes first (cheap, visible), table renames in the same migration window as (1) — one consistent cutover.
4. **Users view with tabs/filters**: rework the admin Customers list into a Users view with tabs for fully managed / free tier / dealers etc., driven by `type` + `tier`. Each user profile shows their Searches regardless of type.
5. Check the already-merged `requests-customers-unify` worktree branch first — some of this may be partially done.

## Phase 4 — Access, permissions & feature flags

**Complexity: MEDIUM · Depends on Phase 3**

1. Add a per-user flags/prefs structure (either columns or a `user_flags` table): `email_results` (default ON for free signups), `delivery_channel` (email / WhatsApp / both), `match_notifications` (the "new match, check your portal" ping), `portal_enabled`.
2. Delivery logic in `notify.js` reads per-user prefs first, global settings as master kill-switches only.
3. **Recommendation on SMS**: don't build SMS — WhatsApp is already wired (Twilio + Meta paths) and the "new match" short-ping template fits it exactly; SMS would be a new Twilio integration with per-message cost for no capability gain. Offer email + WhatsApp as the channel choices. (Decision pending.)

## Phase 5 — Search automation (small)

**Complexity: LOW**

1. Cadence: already 4×/day — decide whether to keep or drop to 3 (`0 */8 * * *`). No build work.
2. Add per-search manual trigger: expose `runWishlist()` behind `POST /admin/run-search/:id` (staff) and a rate-limited portal button (users), reusing the existing KV rate-limit helpers.

## Phase 6 — User-submitted units for review

**Complexity: MEDIUM · Depends on Phases 3–4**

1. Model on the existing `dealer_vehicles` submit → pending → approve/reject flow, generalized to a `submitted_units` review queue tied to `user_id`, with a portal "Ask us about this lot" action from any auction card. [AUDIT: overturned, see C-116/C-NEW-162. Actual: a member-facing "Request a bid on this car" flow already exists on the lot page, auction cards and watchlist, POSTing /portal/auctions/request and queueing the lot as a pending client_request with client alert and staff push. Only free/non-member access and quotas are missing; this item reduces to extending the existing mechanism, not building one.]
2. **Guardrails**: per-user quota stored per tier — e.g. free: 1/week, $50 tier: 2/week, managed: unlimited — enforced server-side D1-count-per-window plus the KV IP limiter. Quotas live in settings so they're tunable without deploys. Note the existing dealer-submission flow has *no* per-account rate limit today — this closes that hole too.
3. Admin review queue view with approve/respond actions, and a workload counter showing total submissions/day across the user base.

## Phase 7 — Calculator integration

**Complexity: MEDIUM–HIGH (depends on state of archived repo)** [AUDIT: amended, see C-131/C-NEW-163/C-NEW-164. Actual: the repo state is known (local clone, tables located), DNS is healthy and the portal embed already exists; revised complexity MEDIUM.]

1. Un-archive `jdm-calculator` and bring it into the active fold (also fixes the broken custom-domain DNS noted in the dealer-portal proxy comments). [AUDIT: stale, see C-122/C-NEW-163. Actual: a live probe on 22 Jul 2026 shows calculator.jdmconnect.com.au healthy (HTTP 200, resolves to Cloudflare, origin gate working); the portal proxy comment describing the DNS break is stale and should be corrected here, but there is no DNS to fix. The clone also already exists locally (C-006).]
2. **Admin-editable values**: move the hardcoded pricing tables (EBS per shipping line, agency fee, compliance, DAFF…) into config editable from the finder's admin Settings — pattern already exists for compliance/agency/FX.
3. **Presets/profiles**: simple customer mode (few inputs), dealer preset, expanded internal mode; profiles per user type via Phase 3's model.
4. Embed in the portal for customers and dealers; internal version hooked into auction search / price history (the dealer portal has an unbuilt design spec for exactly this "Quote landed cost" flow). [AUDIT: amended, see C-NEW-164. Actual: beyond the static spec, the portal dashboard (public/index.html) already embeds a working landed-cost calculator (shipping-line select, toggles, debounced recalc through the same-origin /api/calc proxy); rescope this item to the finder/member surfaces.]

## Phase 8 — Eligibility: Make/Model/Variant view (doc marks this "Future")

**Complexity: MEDIUM · Repo: `rover-eligibility-local`**

1. The deterministic variant-extraction pipeline is live and the hand-fix seam (`variant_overrides.json`) is empty with an unworked 82-row review queue. Work the queue (ignoring non-eligible listings cuts it further), then build the simpler consumer-facing Make→Model→Variant view alongside the existing power view.
2. That cleaned MMV dataset becomes the plug-in data for the landing page and finder (dual-purpose).

## Phase 9 — Lead landing page + price-range database

**Complexity: HIGH (greenfield) · Last, depends on 7 & 8**

1. Combine Finder + Eligibility + Calculator into one lead-qualification page. `jdm-bridge` is a clean host (no existing lead backend — the quote form is just a `mailto:`), or a new page on the finder itself — **decision needed on where it lives**.
2. Flow: visitor picks a car → instant eligibility check (25-year rule + embedded simplified eligibility search from Phase 8) → estimated price range.
3. **Price-range database**: a scheduled job precomputes avg/median/range per eligible make+model+variant from the sold-history `stats` table into a small summary table; the landing page reads only that. The market-intel panel on the lot detail page already computes comparable-sales stats — reuse that logic. [AUDIT: amended, see C-154/C-153. Actual: `stats` is not a local D1 table; it lives behind the remote auction-feed gateway (SQL over HTTP, with ~250-300 row sample caps), so the job must pull from the external gateway into a NEW local D1 summary table, not run a local rollup. The reusable avg/median/trend logic lives in `src/market.js` (marketIntel), not admin.js.] Test the algorithm against known models before letting it qualify leads.

## Not planned here (non-dev or already moving)

- **Lead funnel** (plan started) and **New Pricing Model** (mostly finished) — pressure-test separately.
- **Content** (testimonials, videos) — production work; the only dev tie-in is leaving embed slots on the landing page.

## Suggested order & effort

| Order | Phase | Complexity |
|---|---|---|
| 1 | 0 Pre-flight | LOW |
| 2 | 1 Filtering | MEDIUM |
| 3 | 2 Results/landed cost | MEDIUM |
| 4 | 5 Automation trigger | LOW |
| 5 | 3 Users model | HIGH |
| 6 | 4 Flags/permissions | MEDIUM |
| 7 | 6 Submitted units | MEDIUM |
| 8 | 7 Calculator | MEDIUM–HIGH |
| 9 | 8 Eligibility MMV | MEDIUM |
| 10 | 9 Landing page | HIGH |

[AUDIT: amended, see FINDINGS.md Section 6. Actual: the evidence contradicts three ratings (Phase 0 LOW rises to LOW-MEDIUM per C-002/C-005; Phase 6 MEDIUM falls to LOW-MEDIUM per C-116/C-NEW-162; Phase 7 MEDIUM-HIGH falls to MEDIUM per C-131/C-NEW-163/C-NEW-164), and Phase 5 at order 4 precedes the Phase 3 rename of the very wishlists/terminology it builds against; the revised order moves Phase 5 after Phases 3-4 so the trigger is built once.]

Phases 1–2–5 are launch-blocking polish on what exists; 3–4–6 are the structural re-model; 7–9 are the growth layer.

## Key risks

- **HIGH**: `main` = production deploy + unpushed overlapping work in another session — Phase 0 reconciliation is genuinely first.
- **HIGH**: Users-model migration touches auth in two apps and three "dealer" meanings; needs a staging D1 pass and the migration-tracking discipline before remote apply. [AUDIT: amended, see C-064/C-066/C-073. Actual: understated — it touches four credential stores (three live plus the dormant finder seller dealers), and because the portal writes FINDER_DB the cutover requires a same-window portal deploy.]
- **MEDIUM**: grade values `6`/`S` and structured colour/drivetrain columns need feed-data verification before the filter changes ship.
- **MEDIUM**: calculator repo state is unknown until cloned; EBS may need building from scratch. [AUDIT: overturned, see C-006/C-131. Actual: this risk is retired — the clone exists at `C:\Users\jatec\repos\jdm-calculator` and the shipping-line/LCT/stamp-duty/rego/GST/DAFF tables are confirmed as hardcoded constants in calc-v2.js.]

## Decisions pending

1. SMS: skip in favour of email + WhatsApp? (Recommended.)
2. Submission quotas per tier: free 1/week, $50-tier 2/week as starting numbers?
3. Landing page host: `jdm-bridge`, or a page on the finder domain?
4. Cron: keep 4×/day or drop to 3?
