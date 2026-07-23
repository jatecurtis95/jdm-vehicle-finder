# Implementation Plan: JDMC 2.0 Finder Launch

> **SUPERSEDED IN PART.** Audited 22 July 2026 against the codebase.
> Several premises were overturned. Read the Audit Summary below before
> acting on any phase. Inline `[AUDIT: ...]` notes mark specific corrections.
>
> **Reconstructed 22 July 2026** from the original text plus audit results.
> The full claims register (`CLAIMS.md`, 161 claims with file:line evidence)
> and `FINDINGS.md` remain on the Windows machine and are not reproduced here.

---

## Audit Summary

**Baselines.** jdm-vehicle-finder `f414a2d`, jdm-dealer-portal `10f3d2f`,
rover-eligibility-local `6fdbede`, jdm-bridge `92788cb`, jdm-calculator
`053c2ae` (at `C:\Users\jatec\repos\jdm-calculator`, 9 commits behind origin
at time of audit, though `calc-v2.js` was unchanged across those commits).

**Scale.** 161 claims extracted, 117 verifiable (99 FACT, 18 GAP), triaged to
48 P1. All 48 resolved.

**Headline result.** PLAN.md is accurate about everything it examined. Its
failure mode is omission, not error. The two most consequential findings are
both things the plan did not mention rather than things it got wrong.

### Overturned premises

1. **The calculator source is on this machine** at
   `C:\Users\jatec\repos\jdm-calculator`, fully cloned. The plan's "not on
   this machine, must clone first" is wrong. Pricing tables live in
   `calc-v2.js`. (C-006, C-131)
2. **The outstanding branch has 9 divergent commits, not 4**, including
   production-release-control and launch-regression work. Reconciliation also
   spans three worktrees, nine unpushed branches and a dirty main. (C-002,
   C-005)
3. **A member-facing "ask us about this lot" flow already exists.** The
   Request-bid buttons POST to `/portal/auctions/request` and create a pending
   `client_request` queue row with a staff push. Phase 6's premise is false.
   (C-116, C-NEW-162)
4. **The calculator DNS is not broken.** Live probe 22 July 2026 returned HTTP
   200 in 0.26s with the Origin header `calc.js:160` sends, 403 without it,
   and GET / returned 200. The portal proxy comment describing a DNS break is
   stale and misleading. (C-122, C-NEW-163)

### Omissions that change scope

5. **Four credential stores, not one.** Agents, the `clients` table's own
   PBKDF2 login columns (`pass_salt` / `pass_hash` at
   `migrations/0001_baseline.sql:41-42`), the dealer-portal accounts, and a
   dormant fourth in the finder's supplier `dealers` table. The plan accounts
   only for the dealer-portal one. Phase 3 is materially heavier than framed.
   (C-064, C-066, C-068)
6. **The dealer portal writes to FINDER_DB**, not just reads it: inserts
   `clients`, updates and deletes `wishlists` and queue rows. Any Phase 3
   rename breaks the portal in the same deploy window, so this is a
   coordinated two-app atomic deploy, not a migration. (C-073)
7. **Migration-tracking adoption machinery already exists**: `db:migrate:*`
   scripts, `scripts/adopt-migration-tracking.mjs`, a manual adoption GitHub
   workflow, and a guard in `db-apply-pending.yml`. Phase 0's task reduces to
   running the existing workflow once, with approval. (C-008)
8. **Unification prior art is already merged to main.** The
   `feat/requests-customers-unify` branch is merged, though it added no users
   or tier schema. Reviewing it is a hard prerequisite for Phase 3. (C-079)
9. **The portal already embeds a working calculator**, partially completing
   Phase 7. Recent calculator commits also added a dedicated
   `calculator-embed.html` and a WordPress embed snippet. (C-NEW-164)
10. **Phase 9's `stats` table is a remote gateway with sample caps**, not
    local D1. The precompute job cannot be a scheduled D1 query. Reusable
    comparable-sales logic lives in `src/market.js`, not `admin.js`.
    (C-153, C-154)

### Decisions made

- **Multi-market (AUS, UK, HK) is OUT of scope.** No market or region column
  anywhere. Ben's doc raises it; it is deferred.
- **Search cadence stays at 4 per day.** Deliberate override of Ben's doc,
  which asks for 2 to 3. Phase 5 is therefore only the manual trigger.
- **RA2 stays in scope.** Grades match by exact string, so a lot graded `RA2`
  would match neither an `RA` pill nor a `2` pill and would vanish from
  results silently.
- **Filtering: one large always-visible panel.** No collapsed sections, no
  "More filters" details element.
- **SMS is open and is Ben's call.** Do not build it, do not close it.
- **Also out of scope:** Content, Lead funnel, New Pricing Model.

### Open items

- Ben cites a "Finder Notes document" as wholly included. It has not been
  sighted. Chase it before Phase 1.
- SMS decision needed from Ben before Phase 4.
- C-NEW-162 and C-NEW-164 cut scope on pointer-level evidence and were never
  fully confirmed. Both reduce work, so being wrong means under-planning.

### Bugs and stale comments found (recorded, not fixed)

- `approveDealerVehicle` stamps `approved_by` with a hardcoded `0` instead of
  the admin's id, at `src/admin.js:8768`. (C-113)
- The portal proxy DNS comment at `functions/api/calc.js:8-10` is stale.
  (C-122)
- Rate limiters labelled "sliding-window" at `src/index.js:56` are actually
  TTL fixed-window counters. (C-109)
- Two migration-tracking comments go stale the moment adoption runs.

---

## What the codebase told us (shapes the whole plan)

"Dealer" currently means three different things: a buyer tag
(`clients.category`), a vehicle-seller table in the finder DB (`dealers` +
`dealer_vehicles`), and trade-buyer portal accounts in the dealer portal's own
separate DB. The unification section of your doc has to untangle this, not
just rename tables.

Search automation is nearly done already: cron runs every 6 hours (4x/day).
What's missing is only a per-search manual trigger. `runWishlist()` exists but
is never exposed individually.

Your instinct about Auction History is right: it already has multi-select
grade pills, colour/fuel/body/drivetrain, real result counts, and an Est.
landed column. Live Auctions has almost none of that. The work is porting
History's filter engine to Live, not building new.

Two landed-cost calculations coexist: History rows use a rough formula
(AUD x 1.13 + $9,000), while staff match cards call the real calculator API.
The 5 to 10% accuracy goal means consolidating onto the real one.

The calculator source isn't on this machine. `jdm-calculator` is archived on
GitHub and only consumed as a live API. Any work on its internals (EBS per
shipping line, etc.) requires cloning it first.
**[AUDIT: overturned, see C-006 and C-131. The repo is fully cloned locally at
`C:\Users\jatec\repos\jdm-calculator`. Pricing tables are hardcoded consts in
`calc-v2.js`. No cloning required.]**

Answer to your open question on access/flags: today it's a global `settings`
table (`send_to_client`, `free_auto_send`, `whatsapp_enabled`,
`free_search_limit`) plus scattered per-row flags (`wishlists.auto_notify`,
`clients.member`, `agents.alerts`). There is no per-user notification
preference model at all. Email delivery is gated by "does the client have an
email + is the global switch on". SMS doesn't exist anywhere; WhatsApp
(Twilio/Meta) is built and working.

---

## Phase 0 — Pre-flight (do before anything else)

Resolve the outstanding branches on `jdm-vehicle-finder`: review/merge or
discard `codex/auction-history-example` (4 launch-hardening commits) and
`rescue/onedrive-wip-2026-07-22`. Another session also holds unpushed
overlapping work. Reconcile before starting, since main = production deploy.
**[AUDIT: amended, see C-002. The branch carries 9 commits not on main, not 4,
including production-release-control and launch-regression work. Per C-005,
reconciliation also spans three worktrees, nine unpushed branches and a dirty
main. Larger job than framed.]**

Clone archived `jdm-calculator` locally (read-only) so its pricing tables
(shipping lines, EBS, LCT, stamp duty) can be inspected for Phases 2 and 7.
**[AUDIT: unnecessary, see C-006. Already cloned locally.]**

Adopt the D1 migration-tracking discipline already noted as a launch
prerequisite before any remote migration.
**[AUDIT: amended, see C-008. The full adoption toolchain already exists
(`db:migrate:*` scripts, `scripts/adopt-migration-tracking.mjs`, a manual
adoption GitHub workflow, and a guard in `db-apply-pending.yml`). This reduces
to running the existing workflow once, with approval. Not build work.]**

---

## Phase 1 — Auction Filtering (doc: "the main thing we need to get right")

Complexity: MEDIUM. Files: `src/auction-ui.js`, `src/auction-history-query.js`,
`src/auction-history.js`, `src/avtonet.js`

**Unify Live Auctions onto the History filter engine** (Standardisation item):
extract the shared filter form/validation from `auction-history.js` and
`auction-history-query.js` and use it for both tabs, so filters and results
match everywhere.

**Auction grade to multi-select everywhere**, ordered exactly R, RA, 2, 3,
3.5, 4, 4.5, 5, 6, S. History's pill set is currently {3, 3.5, 4, 4.5, 5, R,
RA}. Add 2, 6, S; replace Live's "min grade" number input with the same pills.
Verify how 6/S appear in the feed's rate column before wiring (grade is
matched by exact string).
**[DECISION: also check the feed for `RA2` and any other non-standard values
in the same pass. Because matching is by exact string, an `RA2` lot matches
neither the `RA` pill nor the `2` pill and disappears from results silently.]**

**Auction house to multi-select on both tabs** (currently single `<select>`;
change the query from single LIKE to an OR-group).

**Unreliable filters (colour/fuel/body/drivetrain):** these are keyword
inference against unstructured text, so filtering genuinely can exclude
mislisted cars, exactly your concern. Plan: keep them, but (a) label them
"(as listed, may exclude incomplete listings)", (b) add an "include
unspecified" toggle defaulting ON so blank-field lots aren't silently dropped,
(c) probe the feed's structured columns (`kpp`, `priv`, `eng_v`, `color`) as
the docs already recommend, and use them where they're reliable.

**Layout consistency, don't hide filters:** replace the collapsed `<details>`
"More filters" sections with the always-visible pill-row style used for
"auction held within" and grade, one consistent grid across both tabs,
active-filter chips retained.
**[DECISION: all filters go in ONE large, always-visible panel. Nothing
collapsed, no "More filters" details element, no hidden sections.]**

**Grade/trim search (the AUCRS-style item):** the building block already
exists (`distinctGrades()` feeds a datalist on the staff sold-prices page but
was never wired into search). Wire it into both tabs as a variant/trim
selector per make+model. This is what keeps Searches narrow.

---

## Phase 2 — Auction Results & landed-cost accuracy

Complexity: MEDIUM. Files: `src/calc.js`, `src/auction-history.js`,
`src/auction-ui.js`, `src/admin.js`

**One landed-cost path:** route History rows and Live cards through the real
calculator API (`estimateLanded()` with batching) instead of the rough
x1.13+$9k formula; keep the rough formula only as an instant placeholder while
the real figure loads, or for the matcher's soft budget filter.

**Accuracy validation:** back-test the estimate against a handful of actual
completed imports; add a settings-tunable bias so you can aim 5 to 10% under
actuals as the doc suggests. (Admin already has editable compliance/agency/FX;
extend if back-testing shows other levers needed.)

**Results information pass:** bring Live cards up to History's information
density (landed cost, engine/gearbox), and review the lot detail page fields.
Treat the exact field list as a design session once Phase 1 ships.

---

## Phase 3 — Unified Users model + terminology

Complexity: HIGH (biggest structural item). Files: migrations, `src/admin.js`,
`src/index.js`, dealer-portal auth

**Schema:** evolve `clients` into the unified `users` table with a `type`
column (customer, dealer, agent) and a `tier` (fully-managed / paid-access /
free), rather than creating a new table. It already holds all buyers with
`category`, `source`, `member` prototyping this. Migration renames + backfills
types from existing columns.
**[AUDIT: amended. Per C-076, the `source='public'` stamping lives in
`admin.js:7450` and `:7481`, not `request-wizard.js` (which contains no
`source` at all). Per C-064, `clients` rows carry their own PBKDF2 login
columns (`pass_salt`/`pass_hash`), making this a third auth system the plan
does not account for.]**

**Fold in dealer-portal accounts:** portal dealers (trade buyers) become users
with `type='dealer'`; keep their PBKDF2 auth working against the unified table
(the portal already reads FINDER_DB for data, so this removes the fragile
`dealer_username` text-link). The finder's `dealers` seller table gets renamed
(e.g. `suppliers`) to kill the three-way name collision. That feature is
flagged off and half-built, so it's cheap to rename now.
**[AUDIT: amended. Per C-073, the portal WRITES to FINDER_DB, not just reads:
it inserts `clients`, and updates and deletes `wishlists` and queue rows. Any
rename breaks the portal in the same deploy window, making this a coordinated
two-app atomic deploy. Per C-064 and C-066, there are FOUR credential stores
to reconcile: agents, `clients` own logins, portal dealers, and a dormant
fourth in the finder's supplier `dealers` table.]**

**Terminology sweep:** `wishlists` to `searches`, and UI labels Customers to
Users, Requests to Searches. Do the UI labels + routes first (cheap, visible),
table renames in the same migration window as (1). One consistent cutover, per
your "make changes consistently" principle.

**Users view with tabs/filters:** rework the admin Customers list into a Users
view with tabs for fully managed / free tier / dealers etc., driven by `type`
+ `tier`. Each user profile shows their Searches regardless of type.

Check the already-merged `requests-customers-unify` worktree branch first;
some of this may be partially done.
**[AUDIT: confirmed, see C-079. The branch is genuinely merged into main,
though it added no users or tier schema.]**

---

## Phase 4 — Access, permissions & feature flags

Complexity: MEDIUM. Depends on Phase 3.

Add a per-user flags/prefs structure (either columns or a `user_flags` table):
`email_results` (default ON for free signups), `delivery_channel`
(email / WhatsApp / both), `match_notifications` (the "new match, check your
portal" ping), `portal_enabled`.

Delivery logic in `notify.js` reads per-user prefs first, global settings as
master kill-switches only.

**Recommendation on SMS:** don't build SMS. WhatsApp is already wired (Twilio
+ Meta paths) and the "new match" short-ping template fits it exactly; SMS
would be a new Twilio integration with per-message cost for no capability
gain. Offer email + WhatsApp as the channel choices.
**[DECISION: SMS remains OPEN and is Ben's call, not ours to close. Do not
build it. Do not close it. Get his answer before starting this phase.]**

---

## Phase 5 — Search automation (small)

Complexity: LOW

**Cadence:** already 4x/day. Decide whether to keep or drop to 3
(`0 */8 * * *`). No build work.
**[DECISION: cadence STAYS at 4 per day. This is a deliberate override of
Ben's doc, which asks for 2 to 3. No change required, so this phase is only
the manual trigger below.]**

**Add per-search manual trigger:** expose `runWishlist()` behind
`POST /admin/run-search/:id` (staff) and a rate-limited portal button (users),
reusing the existing KV rate-limit helpers.

**[AUDIT: ordering. This phase moves AFTER Phases 3 and 4, so the trigger is
not built against tables Phase 3 renames.]**

---

## Phase 6 — User-submitted units for review

Complexity: MEDIUM. Depends on Phases 3 to 4.

Model on the existing `dealer_vehicles` submit -> pending -> approve/reject
flow, generalized to a `submitted_units` review queue tied to `user_id`, with
a portal "Ask us about this lot" action from any auction card.
**[AUDIT: overturned, see C-116 and C-NEW-162. A member-facing flow already
exists: Request-bid buttons POST to `/portal/auctions/request`, creating a
pending `client_request` queue row with a staff push. The real gap is only
free-tier coverage and quotas, so this phase reduces to extending the existing
flow, not building a new one. Revised complexity: LOW to MEDIUM.]**

**Guardrails (the doc's core worry):** per-user quota stored per tier, e.g.
free: 1/week, $50 tier: 2/week, managed: unlimited. Enforced server-side
D1-count-per-window plus the KV IP limiter. Quotas live in settings so you can
tune without deploys. Note the existing dealer-submission flow has no
per-account rate limit today, so this closes that hole too.

Admin review queue view with approve/respond actions, and a workload counter
so you can see total submissions/day across the user base (your sizing
concern).

---

## Phase 7 — Calculator integration

Complexity: MEDIUM to HIGH (depends on state of archived repo)
**[AUDIT: revised to MEDIUM. The repo state is known, not unknown: it is fully
cloned locally. Per C-NEW-164 the portal already embeds a working calculator,
and recent commits added a dedicated `calculator-embed.html` and a WordPress
embed snippet.]**

Un-archive `jdm-calculator` and bring it into the active fold (also fixes the
broken custom-domain DNS noted in the dealer-portal proxy comments).
**[AUDIT: stale, see C-122 and C-NEW-163. The 22 July 2026 live probe shows
the domain healthy (HTTP 200 with the correct Origin header, 403 without, GET
/ returns 200). The portal proxy comment at `functions/api/calc.js:8-10` is
what needs correcting, not the DNS.]**

**Admin-editable values:** move the hardcoded pricing tables (EBS per shipping
line, agency fee, compliance, DAFF) into config editable from the finder's
admin Settings. Pattern already exists for compliance/agency/FX.
**[AUDIT: note. Check whether pricing tables now exist in two places, both
client-side in `calc-v2.js` and server-side in the Netlify function, since a
recent commit appears to have moved `SHIPPING_LINES` server-side. If so, this
task has two locations to reconcile.]**

**Presets/profiles:** simple customer mode (few inputs), dealer preset,
expanded internal mode; profiles per user type via Phase 3's model.

Embed in the portal for customers and dealers; internal version hooked into
auction search / price history.
**[AUDIT: partly done already, see C-NEW-164.]**

---

## Phase 8 — Eligibility: Make/Model/Variant view (doc marks this "Future")

Complexity: MEDIUM. Repo: `rover-eligibility-local`

The deterministic variant-extraction pipeline is live and the hand-fix seam
(`variant_overrides.json`) is empty with an unworked 82-row review queue. Work
the queue (ignoring non-eligible listings, per the doc, cuts it further), then
build the simpler consumer-facing Make -> Model -> Variant view alongside the
existing power view.

That cleaned MMV dataset becomes the plug-in data for the landing page and
finder (dual-purpose, as the doc envisions).

---

## Phase 9 — Lead landing page + price-range database

Complexity: HIGH (greenfield). Last, depends on 7 and 8.

Combine Finder + Eligibility + Calculator into one lead-qualification page.
`jdm-bridge` is a clean host (no existing lead backend, the quote form is just
a `mailto:`), or a new page on the finder itself. Decision needed on where it
lives.

**Flow:** visitor picks a car -> instant eligibility check (25-year rule +
embedded simplified eligibility search from Phase 8) -> estimated price range.

**Price-range database** (your "don't search each time" instinct is right): a
scheduled job precomputes avg/median/range per eligible make+model+variant
from the sold-history stats table into a small summary table; the landing page
reads only that. The market-intel panel on the lot detail page already
computes comparable-sales stats, so reuse that logic. Test the algorithm
against known models before letting it qualify leads.
**[AUDIT: amended, see C-154 and C-153. The `stats` table is a REMOTE GATEWAY
table with sample caps, not local D1, so the precompute job cannot be a
scheduled D1 query. The reusable comparable-sales logic lives in
`src/market.js`, not `admin.js`.]**

---

## Not planned here (non-dev or already moving)

Lead funnel (plan started) and New Pricing Model (mostly finished).
Content (testimonials, videos), production work; the only dev tie-in is
leaving embed slots on the landing page.
**[DECISION: all three are explicitly OUT of scope.]**

---

## Suggested order & effort

| Order | Phase | Complexity (original) | Complexity (audited) |
|---|---|---|---|
| 1 | 0 Pre-flight | LOW | **LOW to MEDIUM** (9 commits, 3 worktrees, 9 unpushed branches) |
| 2 | 1 Filtering | MEDIUM | MEDIUM |
| 3 | 2 Results/landed cost | MEDIUM | MEDIUM |
| 4 | ~~5 Automation trigger~~ | LOW | **moved, see below** |
| 5 | 3 Users model | HIGH | **HIGH, heavier than framed** (4 credential stores, two-app deploy) |
| 6 | 4 Flags/permissions | MEDIUM | MEDIUM (blocked on Ben's SMS answer) |
| 7 | 5 Automation trigger | LOW | **LOW** (cadence unchanged, trigger only) |
| 8 | 6 Submitted units | MEDIUM | **LOW to MEDIUM** (extend existing flow) |
| 9 | 7 Calculator | MEDIUM to HIGH | **MEDIUM** (repo known, embed partly done) |
| 10 | 8 Eligibility MMV | MEDIUM | MEDIUM |
| 11 | 9 Landing page | HIGH | HIGH |

**[AUDIT: ordering change. Phase 5's manual trigger was originally scheduled
before the Phase 3 rename it would be rebuilt against, so it moves to after
Phases 3 and 4. Separately, Phase 3 should not rename `dealer_vehicles`, since
Phase 6 replaces it with `submitted_units`.]**

Phases 1, 2 are launch-blocking polish on what exists; 3, 4, 6 are the
structural re-model; 7 to 9 are the growth layer.

---

## Key risks

**HIGH:** main = production deploy + unpushed overlapping work in another
session. Phase 0 reconciliation is genuinely first.

**HIGH:** Users-model migration touches auth in **four** credential stores
across two apps and three "dealer" meanings, and the dealer portal writes to
FINDER_DB. Needs a staging D1 pass, the migration-tracking discipline, and a
coordinated same-window deploy of both apps.
**[AUDIT: escalated from the original, which said two auth systems and framed
the portal as read-only.]**

**MEDIUM:** grade values 6/S, RA2, and structured colour/drivetrain columns
need feed-data verification before the filter changes ship.

**MEDIUM:** ~~calculator repo state is unknown until cloned; EBS may need
building from scratch.~~
**[AUDIT: resolved. Repo is cloned and inspected; pricing tables exist as
hardcoded consts in `calc-v2.js`. Risk retired.]**

---

## Standing rules

- `main` deploys to production in `jdm-vehicle-finder`. Never push to main
  without asking. Never apply a remote migration without asking. Local
  migrations and seeding (`db:migrate:local`, `db:seed:local`) are fine.
- All code work on a branch.
- Make the smallest change that satisfies the task. No refactoring adjacent
  code, no fixing unrelated bugs, nothing out of scope. Log anything spotted
  rather than acting on it.
- Australian English. No em dashes or en dashes.
- Known bugs listed in the Audit Summary are recorded, not to be fixed
  opportunistically. Fix them in the phase that touches that file.
