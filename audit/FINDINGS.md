# Audit Findings: JDMC 2.0 Finder Plan (PLAN.md)

Source register: audit/CLAIMS.md at baseline finder f414a2d / portal 10f3d2f / elig 6fdbede / bridge 92788cb.
All P1 claims resolved. Claim IDs cited throughout. Section 7 records bugs and stale comments found during verification; nothing was fixed.

## 1. Wrong assumptions

Every claim that came back REFUTED or AMENDED, plus two plan premises the evidence overturned even though the claims themselves verified as scoped.

### C-002 (REFUTED) - branch divergence understated
PLAN.md Phase 0 assumed `codex/auction-history-example` carries 4 launch-hardening commits. Actual count is 9 commits not on main (range ec9030c..f275866, from "test: add auction history example contract" to "test: capture launch token regressions"). Phase 0's reconciliation effort is larger than planned.

### C-076 (AMENDED) - self-signup inserts are not in request-wizard.js
PLAN.md assumed the `source='public'` client-creation path lives in `src/request-wizard.js`. It does not; that file is form/UI only and contains no `source` reference. The inserts that stamp `source='public'` are in `src/admin.js` (~7450 Google OAuth signup, ~7481 public request-form handler). Affects Phase 3: any type/tier backfill keyed on source must target the admin.js handlers, not the wizard.

### C-116 (REFUTED) - "no user-facing submit-a-lot flow" is false
PLAN.md Phase 6 assumed no user-facing "ask us about this lot" flow exists and planned to build one. A member-facing flow already exists: Request-bid buttons on the lot detail page (admin.js:6206), auction search cards (admin.js:7726) and the watchlist tab (auction-ui.js:317) all POST `/portal/auctions/request` (index.js:1681-1687), which files the lot into the staff `queue` as a pending `client_request`, alerts the client and pushes staff. What genuinely does not exist: access for free/non-member users (member-gated at index.js:1683) and any submission quotas. Phase 6 shrinks from "build a review queue" to "extend the existing queue/client_request mechanism to more tiers plus quotas" (see C-NEW-162).

### C-NEW-163 (REFUTED) - the feared calculator DNS outage is not real
The audit raised a risk that the finder's production `CALC_API` (wrangler.toml:82, pinned to calculator.jdmconnect.com.au) pointed at a domain with broken DNS, which would silently null every finder landed estimate. A live probe on 22 Jul 2026 refuted it: the custom domain returns HTTP 200, resolves to Cloudflare, and the origin gate works (403 without the Origin header). Consequences: Phase 7 does not need to precede Phase 2, PLAN.md Phase 7 item 1 ("fixes the broken custom-domain DNS") has nothing to fix, and the portal proxy comment that prompted the fear is stale (see Section 7).

### PLAN.md:9 premise (overturned via C-006, C-007, C-131) - the calculator source IS on this machine
PLAN.md states "The calculator source isn't on this machine" and Phase 0 item 2 plans to clone it. A full clone with source exists at `C:\Users\jatec\repos\jdm-calculator` (functions/api/calc.js and calc-v2.js, index.html, data.json), referenced by Projects.code-workspace:9. The claim C-006 verified only as scoped to the Projects directory; the plan's premise is wrong. C-131 confirmed the pricing tables directly from that clone rather than by consumer-side inference. Affects Phase 0 (clone action C-010 unnecessary) and Phase 7 (repo state is now known, not "unknown until cloned").

### C-122 (VERIFIED claim, STALE underlying fact) - the DNS break is history
The claim that the portal proxy comment describes a DNS break verified (the comment does say it, calc.js:8-10), but the described condition no longer holds: the DNS issue is resolved per the C-NEW-163 probe. The plan's Phase 7 rationale built on this comment is stale. The comment itself should be corrected during Phase 7.

## 2. Omissions

PLAN.md is accurate about what it examined but incomplete about what it did not. The following surfaced in claim Notes or C-NEW entries and is unaccounted for in the plan.

### Headline: four credential stores, not two
PLAN.md Phase 3 accounts for two auth systems (finder agents plus dealer-portal PBKDF2). The evidence shows four independent credential stores:

| # | Store | Location | Evidence |
|---|-------|----------|----------|
| 1 | `agents` (staff logins: email, pass_hash, alerts, company) | finder D1 | C-082, C-064 notes |
| 2 | `clients` own portal logins (pass_salt, pass_hash, invite_token, PBKDF2 per legacy schema comments) | finder D1, 0001_baseline.sql:41-42 | C-064 notes |
| 3 | Portal `dealers` (username PK, password_hash, salt; PBKDF2 100k iterations plus HMAC session cookie) | separate jdm-dealers D1 | C-068, C-072 |
| 4 | Finder `dealers` (sellers) with their own email plus PBKDF2 credentials (0013:9,13-14) | finder D1 | C-066 notes |

Phase 3's unification therefore touches three live auth systems plus a fourth dormant one, not "keep the portal's PBKDF2 working" alone. This grows Phase 3's scope and its migration risk.

### Headline: the portal writes to FINDER_DB, not just reads
C-073 confirmed the dealer portal binds the finder's D1 as FINDER_DB and both reads and writes it: `INSERT INTO clients (name, email, dealer_username)` (requests.js:149), `UPDATE wishlists SET active` (requests.js:196), and batch deletes across queue, seen_lots and wishlists (requests.js:207-209). PLAN.md Phase 3 mentions the portal "reads FINDER_DB for data". Consequence: any rename of `clients` or `wishlists` breaks the portal immediately, so the portal deploy must land in the same window as the finder migration. Phase 3 becomes a coordinated two-app cutover, not a finder-side migration with a follow-up.

### Other omissions

- **Migration-tracking adoption machinery already built (C-008).** Phase 0 item 3 assumed adopting D1 migration tracking is work to do. The machinery exists and waits: `db:migrate:*` and `db:check:remote` scripts (package.json:11-14), `scripts/adopt-migration-tracking.mjs`, a one-off manual GitHub workflow `db-adopt-tracking.yml`, and a guard in `db-apply-pending.yml:42`. The action shrinks to running the existing workflow once with approval.
- **Unification prior art already merged (C-079, C-080, C-081).** `feat/requests-customers-unify` is merged into main and listed in ARCHITECTURE.md's cleanup queue. Some Customers/Requests unification work is already live, though it added no `users` table or `tier` column. Reviewing that prior art (C-088) is mandatory before Phase 3 design, not optional.
- **Phase 0 reconciliation is bigger than two branches (C-005).** Beyond the two named branches: three linked worktrees active, nine local branches with no upstream (including codex/finder-v13-fixes, feat/sold-prices-merge, feat/phase5-design-system), and the main checkout itself dirty (modified package.json plus six untracked files).
- **The portal already embeds a working calculator (C-NEW-164).** The portal dashboard (public/index.html) has a live landed-cost calculator UI with shipping-line select, toggles and debounced recalc POSTing `/api/calc` through the same-origin proxy. Phase 7's C-137 "embed the calculator in the portal" is partially done; rescope to the finder/member surfaces. (Unverified pointer evidence; a confirmation pass is queued.)
- **`stats` is not a local table (C-154 notes).** Phase 9's price-range precompute job assumes a rollup "from the sold-history stats table". `stats` lives behind the remote auction-feed gateway (SQL over HTTP via market.js/avtonet.js) with roughly 250-300 row sample caps observed at market.js:189. The job must pull from the external gateway into a new local D1 summary table, not run a local SQL rollup.
- **Market-intel computation lives in market.js, not admin.js (C-153).** The lot-page panel renders from admin.js but avg/median/trend computation is `marketIntel()` in src/market.js. Phase 9's reuse base is market.js.
- **Calculator correctness unproven (C-NEW-165).** The reachability probe used an empty payload. Whether real payloads return sane grandTotal/landedAtPort figures is unverified, and matters before Phase 2 leans on `estimateLanded()` output.
- **Request-bid is not a search run (C-108 notes).** The member Request-bid flow queues a specific lot without running a search; Phase 5's per-wishlist manual trigger remains genuinely missing.
- **`clients.source` added by 0016, not 0017 (C-064 notes).** Register detail only.

## 3. The three meanings of "dealer"

From the evidence, every table, column, route and auth path using the word across both apps:

### Meaning A: buyer tag on clients
- `clients.category` = 'private' | 'dealer', added by migration 0011_client_category.sql as "a trade buyer we sell to/for" (C-065).

### Meaning B: vehicle sellers/suppliers (finder, flagged off and half-built)
- Tables `dealers` and `dealer_vehicles`, migration 0013_dealer_system.sql, purpose "vehicle suppliers... These dealers are sellers" (C-066, C-069). Own email plus PBKDF2 credentials (credential store #4).
- Setting `dealer_portal_enabled`, default "0" (settings.js:51), gating route guard index.js:838 and admin.js:1212 `dealersOn` (C-078).
- Routes: `/dealer/history` (index.js:2017; HISTORY_SURFACES.dealer, auction-history.js:73, C-014) and `/dealer/vehicle/submit` (index.js:2024-2026, C-115).
- Auth path: session `role === "dealer"` plus `dealers.active` check (admin.js:8692-8694, C-115).
- Flow functions: submitDealerVehicle / approveDealerVehicle / rejectDealerVehicle (admin.js:8691/8760/8777, C-113), admin approve/reject actions (index.js:878/883).
- Admin sidebar labels "Dealers" and "Dealer stock" (C-075, unverified P2).
- The 0013 header comment itself flags the collision with clients.category='dealer' (C-067, unverified P2).

### Meaning C: trade-buyer portal accounts (dealer portal, separate DB)
- Portal `dealers` table (username PK, password_hash, salt, display_name, email, is_admin, active) in its own jdm-dealers D1 (C-068).
- Auth path: self-contained PBKDF2 plus HMAC session cookie against that table, never FINDER_DB (C-072; login.js:85-86).
- Cross-database link: `clients.dealer_username` TEXT, no FK (C-070), used by portal `/api/requests` ownership scoping `WHERE c.dealer_username = ?` at requests.js:46/66/90 and the guarded DELETE at :215 (C-071), and stamped by the portal's own `INSERT INTO clients (..., dealer_username)` (C-073).

### Canonical naming
One canonical meaning: **"dealer" = trade buyer only** (Meaning C, absorbing Meaning A). Portal dealer accounts become `users` with `type='dealer'` (C-084); `clients.category='dealer'` backfills into `users.type` (C-083). The finder's seller tables (Meaning B) are renamed, for example `suppliers` / `supplier_vehicles` (C-085), which is cheap while the feature is flagged off and half-built (C-078); but see Section 4 before renaming dealer_vehicles.

### Everything that must change together in one deploy window
Because the portal writes FINDER_DB (C-073), the finder migration and the portal deploy cannot be split:

1. Finder D1 migration: evolve `clients` to `users` (type, tier), rename seller `dealers` table, replace or preserve the `dealer_username` link semantics.
2. Finder code: the Meaning B routes, session role string, setting key, gate checks, HISTORY_SURFACES.dealer, submit/approve/reject functions, admin sidebar labels listed above.
3. Portal code: every `dealer_username` query (requests.js:46/66/90/149/215), and the login path (login.js:85-86) if accounts fold into the unified table in the same cut.
4. Migration-tracking adoption (C-008, C-011) must already be done before any of this touches remote D1.

## 4. Ordering problems

Work the current order does twice:

1. **Phase 5 (order 4) before Phase 3 (order 5).** The per-search manual trigger (`POST /admin/run-search/:id` plus a portal button, C-112) is built against `wishlists` and the Requests/Searches terminology, which Phase 3 then renames (C-086) and whose portal accounts Phase 3 restructures (C-084). Route wiring, queries and labels get touched twice. Phase 5 is small either way; moving it after Phases 3-4 costs nothing at launch except the trigger arriving later, and avoids the rework.
2. **Phase 3 renames dealer_vehicles, Phase 6 replaces it.** Phase 3's collision cleanup renames the seller tables (C-085) while Phase 6 generalises the dealer_vehicles submit/pending/approve flow into a `submitted_units` queue keyed by user_id (C-118). If Phase 6 supersedes dealer_vehicles, renaming it in Phase 3 is wasted work. Recommendation: in Phase 3 rename only the `dealers` (sellers) table and defer dealer_vehicles restructuring wholly to Phase 6.
3. **Phase 2 vs Phase 7, resolved.** The audit briefly implied Phase 7 (calculator/DNS) had to precede Phase 2's reliance on `estimateLanded()`; C-NEW-163's refutation restores the plan's order. The only residual Phase 2 prerequisite is the cheap realistic-payload probe (C-NEW-165), not calculator work.

## 5. Scope changes

### Phases that grew
| Phase | Driver claims | What grew |
|-------|--------------|-----------|
| 0 | C-002, C-005 | Reconciliation: 9 divergent commits not 4; three active worktrees, nine unpushed branches, dirty main, not just two branches |
| 3 | C-064, C-066, C-073, C-079 | Four credential stores instead of two; portal writes FINDER_DB so the cutover is a coordinated two-app deploy; mandatory prior-art review of merged unification work (C-088) |
| 9 | C-154, C-153 | Precompute job must pull from the remote stats gateway (sample caps ~250-300 rows) into a new D1 table; reuse base is market.js, a remote-querying module, not a local rollup |

### Phases that shrank
| Phase | Driver claims | What shrank |
|-------|--------------|-------------|
| 0 | C-006, C-131 (C-010 moot); C-008 (C-011 reduced) | No clone needed, the calculator source already sits at C:\Users\jatec\repos\jdm-calculator; tracking adoption is one run of an existing GitHub workflow |
| 6 | C-116 (REFUTED), C-NEW-162 | The member "Request a bid" flow, queue insert, client alert and staff push all exist; work reduces to widening tier access, quotas (C-117, C-119) and the admin workload view (C-120) |
| 7 | C-NEW-163, C-122, C-131, C-NEW-164 | No DNS fix needed; repo state known and pricing tables located (hardcoded consts in calc-v2.js); portal calculator embed already live, C-137 rescopes to finder/member surfaces |

Phases 1, 2, 4 and 8 verified essentially as planned (C-014/C-015/C-030/C-031 for 1; C-053/C-055 for 2; C-093 to C-096 for 4; C-143/C-146 for 8), with Phase 2 gaining only the C-NEW-165 probe as a cheap precondition.

## 6. Revised plan

Corrected order and effort table. Changes from PLAN.md: Phase 5 moves after Phases 3-4 (Section 4 item 1); complexity ratings restated where the evidence contradicts them.

| Order | Phase | PLAN.md complexity | Revised | Why |
|---|---|---|---|---|
| 1 | 0 Pre-flight | LOW | LOW-MEDIUM | Clone and tracking-adoption work vanished (C-006, C-008) but branch/worktree reconciliation is materially bigger (C-002, C-005) and gates a production-deploying main (C-004) |
| 2 | 1 Filtering | MEDIUM | MEDIUM | Verified as assumed (C-014, C-015, C-030, C-031); feed probe for grades 6/S (C-046) still outstanding |
| 3 | 2 Results/landed cost | MEDIUM | MEDIUM | As planned; run the C-NEW-165 realistic-payload probe before relying on estimateLanded |
| 4 | 3 Users model | HIGH | HIGH (heavier than assumed) | Four credential stores (C-064, C-066), same-window portal deploy (C-073), prior-art review first (C-079, C-088) |
| 5 | 4 Flags/permissions | MEDIUM | MEDIUM | Gaps confirmed exactly (C-093, C-094, C-095); WhatsApp both paths ready (C-096) |
| 6 | 5 Automation trigger | LOW | LOW | Moved after Phase 3 so the trigger is built once against the renamed schema (Section 4 item 1); runWishlist gap confirmed (C-108) |
| 7 | 6 Submitted units | MEDIUM | LOW-MEDIUM | Existing member request flow to extend, not a greenfield build (C-116, C-NEW-162); quota/limiter work remains (C-115, C-119) |
| 8 | 7 Calculator | MEDIUM-HIGH | MEDIUM | The "depends on state of archived repo" uncertainty is resolved: source local, tables located (C-131), portal embed live (C-NEW-164), DNS healthy (C-NEW-163) |
| 9 | 8 Eligibility MMV | MEDIUM | MEDIUM | Flat-list baseline and MMV gap confirmed (C-143, C-146); display fields ready as raw material |
| 10 | 9 Landing page | HIGH | HIGH | Confirmed, with the added remote-gateway constraint on the price-range job (C-154) |

Complexity ratings the evidence contradicts: Phase 7 (down from MEDIUM-HIGH), Phase 6 (down from MEDIUM), Phase 0 (up from LOW), and Phase 3 (HIGH stands but is understated in the plan's two-auth-system framing).

Key-risk corrections: PLAN.md's "calculator repo state is unknown until cloned; EBS may need building from scratch" risk is retired (C-006, C-131). The "Users-model migration touches auth in two apps" risk understates it: three live credential stores plus one dormant, and a mandatory same-window portal deploy.

## 7. Bugs and stale comments

Recorded during verification, not fixed:

1. **BUG: approved_by hardcoded to zero.** `approveDealerVehicle` stamps `approved_by` with a literal 0 instead of the approving admin's id: jdm-vehicle-finder/src/admin.js:8768 `.bind(0, vid)`. The audit column never records who approved (C-113). Low live exposure while dealer_portal_enabled defaults off (C-078), but fix when Phase 6 touches this flow.
2. **STALE COMMENT: portal proxy DNS note.** jdm-dealer-portal/functions/api/calc.js:8-10 says the custom domain calculator.jdmconnect.com.au "broke when the zone moved Cloudflare accounts". The live probe of 22 Jul 2026 shows the domain healthy (200, Cloudflare-resolved, origin gate working). The comment misled the plan into a Phase 7 DNS-fix item and the C-NEW-163 risk; correct it during Phase 7 (C-122, C-NEW-163).
3. **MISLEADING COMMENT: "sliding-window" limiters.** jdm-vehicle-finder/src/index.js:56 labels the RL helpers sliding-window; the implementation is TTL'd fixed-window counters (C-109). Behaviour matches intent (window caps, fail-open) but the label is wrong.
4. **COMMENTS TO RETIRE AFTER TRACKING ADOPTION.** .github/workflows/deploy.yml:9 ("is not adopted in prod") and migrations/0011_client_category.sql:7 ("NEVER `migrations apply` - the tracking table is out of sync") both become stale the moment the one-off adoption workflow runs (C-008, C-011); sweep them in the same change.
5. **Known behavioural quirk, not a bug.** The "petrol" fuel filter matches by absence of all other fuel tokens (auction-history-query.js:198), so petrol results include listings whose trim text simply omits fuel words (C-030). The plan's Phase 1 labelling/toggle items (C-048, C-049) already cover this.
