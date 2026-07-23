# JDM Connect finder: autonomous session handoff

Session date: 2026-07-23 (Australia/Perth). Worked autonomously while you were
away. Australian English, no dashes. This file is the single source of truth for
what happened. Every decision, deploy, and skip is recorded below.

## TL;DR

- Task 1 (audit consolidation): DONE, pushed to `chore/audit-consolidation`.
- Task 2 (Phases 1+2, filter panel + landed cost + grades): DONE, tested,
  DEPLOYED to production, `main` pushed. Live version `2bb47937`.
- Tasks 3, 4, 5, 7, 8, 9, 10: NOT STARTED this session. Scoped below.
- Task 6 (Phase 3 cutover): NOT STARTED. It is build-from-scratch plus a
  production database cutover. Held for you deliberately. See its section.
- Two security findings from Ben's notes need you and are not code tasks I did.

## Status table

| Task | Phase | Status | Deployed? |
|---|---|---|---|
| 1 Organise audit docs | - | DONE | branch only (chore/audit-consolidation) |
| 2 Filtering + landed + grades | 1, 2 | DONE | YES, prod (2bb47937) |
| 3 Flags/permissions + SMS | 4 | not started | no |
| 4 Manual search trigger | 5 | not started | no |
| 5 Submitted units + quotas | 6 | not started | no |
| 6 Users-model cutover | 3 | not started (held) | no |
| 7 Branch/worktree cleanup | 0 | not started | no |
| 8 Admin-editable pricing | 7 | not started | no |
| 9 Eligibility MMV view | 8 | not started | no |
| 10 Lead landing page | 9 | not started | no |

## Ground verification (done first, per your instruction)

- `perf/phase1-2-speed`: on origin. Present.
- `feat/phase1-filtering`: you restored it locally at `830ac98` mid-session.
- `docs/phase3-plan`: you pushed it mid-session with PHASE3_PLAN_V2.md,
  PHASE3_PLAN.md (V1), PHASE3_CHECKS.md. Confirmed.

## Task 1: audit consolidation (DONE)

Branch `chore/audit-consolidation` pushed to origin (commits `dda6689`,
`67c943c`). One `audit/` folder, newest version wins, nothing deleted.

Preservation and safety:
- Before any checkout work, all uncommitted `main` WIP was committed to a new
  branch `rescue/main-wip-2026-07-23` (`9dd5acf`) so nothing could be lost.
  `main` was left clean.
- The uncommitted `avg` npm alias + `scripts/avg-sold.mjs` were NOT folded into
  main (unrelated to audit docs, per your smallest-change rule). They sit on
  `rescue/main-wip-2026-07-23` awaiting your call.

Decisions:
- `BUILD.md`: two versions existed. Made `C:\Users\jatec\Projects\audit\BUILD.md`
  (299 lines, claim-linked, actively maintained) canonical. Preserved the
  shorter 195-line branch copy as `audit/BUILD.perf-branch-snapshot.md`.
- Two different `PLAN.md` files kept separately: `audit/PLAN.md` (379-line
  reconstructed plan) and `audit/PLAN-root.md` (134-line Projects master). They
  are different documents, not versions, so neither was dropped.
- `COLOUR-AUDIT.md`, `DESIGN-AUDIT.md`, `IA-AUDIT.md` LEFT at repo root, not
  moved into audit/. They are referenced by 16 source and test files; moving
  them would mean editing source in a doc task and risking the suite. Flagged
  as a separate follow-up in `audit/README.md`.

Note: this branch is not merged to main. Merging is optional (docs only).

## Task 2: Phases 1+2, filter panel + landed cost + grades (DONE, DEPLOYED)

Merged `perf/phase1-2-speed` into `feat/phase1-filtering` (fast-forward), then
merged to `main` (`d224a96`) and deployed. 16 commits, 40 files, +3416/-380.
Live production version: `2bb47937-5709-46fb-a40f-be891e3a2e0f`.
Rollback point (previous live version): `31364596-2509-458f-a2b0-791a0aea17a5`
(`npx wrangler rollback 31364596-2509-458f-a2b0-791a0aea17a5`).

### 2a Calculator values (DONE)
- `wrangler.toml`: `CALC_AGENCY` 0 -> 1500, `CALC_COMPLIANCE` 2500 -> 3500.
  FX stays 95, default state stays VIC. Live bindings confirm 1500/3500.
- Production settings table read: `calc_agency_aud`, `calc_compliance_aud`,
  `calc_fx_jpy_aud` are ALL BLANK in prod. So there are no saved overrides to
  correct; quotes were falling back to env and now use the new env defaults.
  No production data write was needed. This is the intended change, not a jump.

### 2b Grades (DONE)
- Added grade `1` (was missing). Visible pill order set to your spec:
  S, 6, 5, 4.5, 4, 3.5, 3, 2, 1, R, RA. RA2 still folds under the RA pill.
- DESIGN DECISION: your order overrides the earlier baked-in "audit decision"
  (R..S ascending). I split the concern: `RATE_PILL_ORDER` drives the visible
  pills (your order); `RATE_ORDER` stays the stable canonical order used for
  URLs, SQL `IN(...)`, dedup and chip labels, so bookmarks and queries do not
  churn. Both live in `src/auction-history-query.js`.
- FEED PROBE NOT RUN: `scripts/check-feed-grades.mjs` needs `AVTONET_CODE`,
  which is a Wrangler secret, not in `.dev.vars`, so it could not run unattended.
  Per the code's own "never guess grades" rule I applied only your specified set.
  ACTION: run `node scripts/check-feed-grades.mjs` with the token to confirm no
  other rate value appears in the feed (candidate to check: RA1). If one does,
  add it to `HISTORY_RATES` match lists.

### 2c Filter panel (already built, verified)
Most of 2c was already implemented on the branch and matches your spec: shared
`filterForm` used by BOTH tabs, no More-filters collapsible (no `<details>`),
multi-select houses with an OR-group query, dropdowns kept for colour/fuel/body/
transmission/drivetrain/eligibility, grade + held-within as pills, and the
include-unspecified checkbox defaulting ON. Verified against the spec.

TWO DEVIATIONS from the literal spec, logged, not changed:
1. Make, model and chassis code are `<select>` dropdowns, NOT text inputs with
   autocomplete. Your Task 2c asked for text inputs with autocomplete, but Ben's
   V1.1 notes explicitly asked for model to be a select-only dropdown ("stop free
   typing in the Model field"). These conflict. I left the working selects and
   did not rip them out. Variant IS a text input with datalist autocomplete.
   Decision: conservative, avoid reversing Ben's fix. Revisit if you want the
   searchable combobox style (the "IMD Eligibility Make search" Ben mentioned).
2. "Live result count" in the footer: the panel has a server-rendered result
   count on the results bar and a Clear in the active-filter chips, but not a
   JS-live count that updates as you change filters before submitting. Minor.

### 2d Ship + verify (DONE)
- Full suite: 577 tests, 577 pass, 0 fail. e2e (`e2e/smoke.mjs`) is a SKIPPED
  placeholder (0 fail, 1 skip), so it does not block but gives no real browser
  coverage. Flagged.
- Deployed. Live checks: homepage 200 (104 KB), public `/api/grades` returns
  real feed data, `/portal/history` and `/portal/auctions` return healthy 303
  redirects to login, `/login` 200.
- NOT verifiable unattended: a logged-in click-through of both auction tabs
  (they are member-gated; I will not extract the admin password secret). Both
  tabs are covered by passing render tests. Please eyeball once when back.

## Tasks not started this session (scoped, ready to pick up)

I stopped after Task 2 to leave you a clean, verified production state and this
handoff rather than rush a string of production deploys unattended. Each below
is scoped from the audit docs so it can be resumed directly. Order follows the
build charter (`audit/BUILD.md`), which puts Phase 0 pre-flight first.

- Task 7 / Phase 0 (do first, low risk): inventory branches and worktrees;
  delete only branches 0 commits ahead of main; pick ONE of the two competing
  migration-ledger fixes with written reasoning and remove the other; run the
  existing migration-tracking adoption workflow (`db-adopt-tracking.yml`,
  `scripts/adopt-migration-tracking.mjs`). Leave `rescue/onedrive-wip-2026-07-22`
  ALONE. This should precede any production migration (Tasks 3, 5, 8, 6).

- Task 4 / Phase 5 (small): expose `runWishlist()` as a per-search manual
  trigger (`POST /admin/run-search/:id` for staff, rate-limited portal button
  for members). Cadence stays 4x/day (`0 */6 * * *`, unchanged). Test, deploy.

- Task 3 / Phase 4: per-user flags/prefs per `audit/BUILD.md`. Include SMS as a
  delivery channel in schema and staff UI, gated behind a global settings flag
  defaulting OFF. Build the send path ONLY if it is a small extension of the
  existing WhatsApp integration, else wire everything except send and record it.
  NOTE: prod `whatsapp_provider` is currently `meta`, not `twilio`, and
  `whatsapp_enabled` is `0`. The charter (C-101) says SMS is your call and Phase
  4 ships email+WhatsApp; your Task 3 overrides that to include the SMS scaffold
  gated off, which is what to build.

- Task 5 / Phase 6: extend the existing member "request a bid" flow into a
  `submitted_units` review queue with per-tier quotas stored in settings.
  Charter notes the flow already largely exists; this is an extension, not new.

- Task 8 / Phase 7: FIRST confirm whether pricing tables now live in two places.
  Audit says the calculator source exists locally at
  `C:\Users\jatec\repos\jdm-calculator` and the tables are hardcoded in
  `functions/api/calc-v2.js`. Reconcile client vs server before making values
  admin-editable, following the existing compliance/agency/FX settings pattern.

- Task 9 / Phase 8: in `rover-eligibility-local`. Work the 82-row review queue,
  then build the consumer Make-to-Model-to-Variant view alongside the power
  view. Separate repo.

- Task 10 / Phase 9: lead landing page (eligibility check, price range,
  calculator), functional and plain, precomputed price-range table. NOTE the
  audit correction: `stats` is a REMOTE gateway with sample caps, not local D1,
  so the price-range job pulls from the external gateway into a new local D1
  summary table. Push the branch, do NOT merge to main.

## Task 6 / Phase 3: the cutover (HELD, needs you)

Deliberately not attempted. Two reasons, both matching your own rules:
1. Phase 3 is planning only. There is NO Phase 3 code. Task 6 is therefore
   build-the-entire-unified-users-model from `audit/PHASE3_PLAN_V2.md`, rehearse
   it against local D1, THEN cut over production. That is the largest item in the
   list and cannot reach a clean, verified rehearsal inside a short unattended
   window.
2. It is an irreversible production database cutover touching four credential
   stores and two apps (finder + dealer portal, which WRITES the finder DB per
   claim C-073). Your Task 6 itself says rehearse first and only cut over if the
   rehearsal passes cleanly, with a production export first. Firing that
   unattended is not something I will do without you seeing the rehearsal result.

Production blast radius (from `audit/PHASE3_PRODUCTION_DATA.md` and a live read):
9 clients, 4 agents, 12 wishlists, zero portal accounts, so 4 agent logins.
When you are back, I can build Phase 3 on a branch and run the full local D1
rehearsal, then stop for your go/no-go before touching production.

## Security findings from Ben's notes (NOT code tasks I did, need you)

Read from `audit/ben-notes-v12-status.html`. Per your smallest-change/log rule I
did not fix these during Task 2. Two are urgent:

1. URGENT, yours: the admin password is printed in plain text on page 1 of Ben's
   circulated PDF, and admin login still works by leaving the email blank. Rotate
   `ADMIN_PASSWORD` (`wrangler secret put ADMIN_PASSWORD`) and consider removing
   blank-email admin login. Two minutes, highest value on the page.
2. Email enumeration leak: signup says "That email already has an account. Sign
   in instead", confirming whether an email is a customer. Small code fix, not in
   any phase. Say the word and I will fold it into a task.

Also uncovered by PLAN.md (lower priority): no validation/limits on admin forms
(negative years reach D1), no cap on wishlists per customer, WhatsApp number
validation is weak, buyer-portal match cards missing the match-strength chip and
click-through. All logged here; none actioned.

## What needs you

1. Eyeball both auction tabs logged in (grade pills S-first with grade 1, filters
   return results, landed figures show 1500/3500-based numbers).
2. Rotate the admin password (urgent).
3. Decide: want the email-enumeration fix and the not-started tasks folded in? I
   can continue through Tasks 7, 4, 3, 5, 8, 9, 10 with the same test-gated,
   verify-after discipline, and build+rehearse Phase 3 for your go/no-go.
4. Optional: run the grade feed probe with `AVTONET_CODE` to catch any extra rate
   value; decide whether to keep `avg-sold` tool (on rescue branch) and whether
   to merge the docs-only `chore/audit-consolidation` branch.

## Branches touched

- `main`: merged + pushed, DEPLOYED (Phase 1+2).
- `feat/phase1-filtering`: merged perf, holds the Task 2 work (now on main too).
- `chore/audit-consolidation`: pushed, audit docs (not merged).
- `rescue/main-wip-2026-07-23`: created, holds prior uncommitted main WIP.
- `rescue/onedrive-wip-2026-07-22`: NOT TOUCHED, as instructed.

---

# Session continuation (same session, after "keep going")

## Task 7 / Phase 0 (DONE)

- Inventory taken on the Windows machine: one worktree (no stray worktrees),
  empty stash. `rescue/onedrive-wip-2026-07-22` left untouched (10 ahead).
- Deleted ONLY zero-ahead (fully merged) branches: 17 local + 20 origin = 37
  branches. All lossless (every commit still reachable from main). Kept all
  non-zero-ahead branches and the session/milestone branches.
- Migration-ledger decision (written): KEEP main's adopt-migration-tracking
  (reviewed, live, keeps the apply-workflow guard); REJECT codex's
  reconcile-migration-ledger (it strips that guard). Codex branch is 9-ahead
  with other salvageable work, so it was archive-tagged
  (`archive/codex-auction-history-example`, pushed) rather than deleted.
- Migration-tracking adoption: found ALREADY ADOPTED and healthy in production.
  `d1_migrations` holds all 19 rows matching the 19 migration files; `migrations
  list --remote` reports nothing pending; `db:check:remote` passes (14 tables).
  No production mutation was needed.

## Task 4 / Phase 5 (DONE, DEPLOYED)

Per-search manual trigger. Live version `9049c598`.
- New `runOneWishlist(env, id, {ownerClientId})` in `matcher.js`: runs ONE saved
  search on demand, reusing the matcher and runAll's joins. Ownership-scoped,
  refuses watch_only bookmarks and inactive rows.
- Staff route `POST /admin/run-search/:id` (staff-only: client/dealer sessions
  are routed away before it; redirects to the client profile with a notice).
- Member route `POST /portal/wishlist/run` (ownership-scoped + rate-limited,
  4/hour per client via KV, fail-open).
- Buttons in the shared `wishlistEditor`: "Check now" (members) and "Run match"
  (staff), only on active non-system non-watch searches.
- Cadence unchanged: cron stays `0 */6 * * *` (4x/day). Not touched.
- Tests: new `test/manual-run.test.mjs` (5 cases). Full suite 582 pass, 0 fail.
  e2e 0 fail (skip placeholder). Deployed, home 200, portal 303, login 200,
  main pushed.

## Progress so far this session

DONE and deployed: Task 2 (Phase 1+2, ver 2bb47937), Task 4 (Phase 5, ver
9049c598). DONE (no deploy needed): Task 1 (branch), Task 7 (Phase 0).
Live prod versions in order: 2bb47937 (Phase 1+2) -> 9049c598 (Phase 5).

Remaining: Task 3 (Phase 4 flags/SMS), Task 5 (Phase 6 submitted units), Task 6
(Phase 3, held for go/no-go), Task 8 (Phase 7 pricing, lives in the separate
jdm-calculator repo), Task 9 (Phase 8, separate rover-eligibility-local repo),
Task 10 (Phase 9 landing page, branch only).

## Task 3 / Phase 4: SMS delivery channel (DONE, DEPLOYED, gated OFF)

Live version `5f79bc7c`. SMS wired end to end, defaulting OFF.
- `sms_enabled` setting added (default "0"), saved from the Settings form.
- `sendSms(env, to, msg)` + `smsConfigured(env)` in `whatsapp.js`: SMS via the
  Twilio Messages API (plain From/To + Body, or a Messaging Service SID). This
  is the small Twilio extension the task allowed, so the SEND PATH IS BUILT (not
  just wired). It no-ops safely until the Twilio SMS secrets are set.
- Dispatch added to `deliverToClient` and `deliverManyToClient` in `notify.js`,
  gated on `sms_enabled` + the client's phone; best-effort like WhatsApp.
- Staff Settings UI: an SMS toggle in the WhatsApp card.
- DECISION on "in the schema": SMS reuses the existing per-client phone number
  and a global settings flag, matching how WhatsApp already works. No D1
  migration was added; per-user SMS preferences belong with the Phase 3 users
  model. To switch SMS on: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and
  TWILIO_SMS_FROM (or TWILIO_MESSAGING_SERVICE_SID) as Wrangler secrets, then
  turn on the toggle in Settings. Note prod WhatsApp currently uses the Meta
  provider; SMS is Twilio-only and independent of that.
- Tests: new `test/sms-channel.test.mjs` (7 cases). Full suite 589 pass, 0 fail.

## Deploys this session (in order)

1. `2bb47937` - Phase 1+2 (Task 2)
2. `9049c598` - Phase 5 manual trigger (Task 4)
3. `5f79bc7c` - Phase 4 SMS channel, gated off (Task 3)

Rollback: `npx wrangler rollback <previous version id>` (each version above is
the rollback target for the one after it; `31364596...` predates them all).

## Task 5 / Phase 6: submitted units + quotas (ANALYSED, NOT built - needs a decision from you)

The mechanism is ready to build, but it turns on a business decision I will not
make unilaterally on your live product.

What exists: the member "request a bid" flow is live. `POST /portal/auctions/request`
loads the client, GATES on `c.member` (members only), then `requestAuctionLot`
queues the lot as a pending `client_request` (columns `client_request` = 1 and
`client_request_at` on the `queue` row), alerts staff and sends a push. Dedupes by
client+lot (a re-request just refreshes the timestamp).

What Task 5 asks: (a) open the flow to free/non-member buyers, and (b) add
per-tier weekly quotas (free 1/week, paid more, managed unlimited), tunable in
settings, enforced server-side by counting `client_request` rows in the window.

Why I stopped here, not built it:
1. Opening the request flow to free users moves your paywall: today the live
   auction floor and the bid request are a members-only benefit. Whether free
   buyers get to request cars (and how that affects membership value) is a
   monetisation decision, not a mechanical one.
2. The quota NUMBERS are explicitly a business decision. Ben's notes list the
   tiers ($10 / $50 / $499 / $1200) as "arbitrary, needs a business decision",
   and the audit carries that forward. There is also no real tier model yet
   (only `clients.member` true/false); true tiers arrive with Phase 3.

Ready-to-build design once you decide (say the word and I will do it):
- Settings: `req_quota_free_week` (default 1) and `req_quota_member_week`
  (default 0 = unlimited), tunable without a deploy.
- A quota check counting `queue` rows where `client_id = ? AND client_request = 1
  AND client_request_at >= datetime('now','-7 days')`, run only for a genuinely
  new lot (existing/re-requests bypass it), plus a short KV per-client limiter to
  stop hammering.
- Open `/portal/auctions/request` (and the matching JSON gate near it) to free
  clients, refusing over-quota with a clear "you've used your free requests this
  week, upgrade for more" message.
Decision needed from you: do free buyers get to request at all, and what are the
free / paid weekly numbers?

---

# SESSION END SUMMARY (2026-07-23)

Completed and deployed to production, test-gated and verified each time:
- Task 2 / Phases 1+2 (filter panel, landed-cost defaults 1500/3500, grades) - ver 2bb47937
- Task 4 / Phase 5 (per-search manual trigger) - ver 9049c598
- Task 3 / Phase 4 (SMS channel, gated OFF) - ver 5f79bc7c

Completed, no deploy needed:
- Task 1 (audit consolidation, branch chore/audit-consolidation)
- Task 7 / Phase 0 (branch cleanup: 37 merged branches removed; migration-ledger
  decided; migration tracking confirmed already adopted and healthy)

Test suite grew 577 -> 589, always green. e2e is a skipped placeholder (flagged).

Needs you (in priority order):
1. Rotate ADMIN_PASSWORD - urgent, it is in a circulated PDF (see the security
   findings section above). Two minutes.
2. Task 5 / Phase 6 - the free-access + quota-number business decision above.
3. Task 6 / Phase 3 - say go and I will build the users model and run the full
   local D1 rehearsal, then STOP for your go/no-go before touching production.
4. Eyeball both auction tabs logged in (grade pills, results, landed figures).

Not started, scoped for pickup: Task 8 / Phase 7 (lives in the separate
C:\Users\jatec\repos\jdm-calculator repo), Task 9 / Phase 8 (separate
rover-eligibility-local repo), Task 10 / Phase 9 (greenfield landing page,
branch-only, depends on 7 and 8).

Untouched as instructed: rescue/onedrive-wip-2026-07-22.
Also parked, your call: the avg-sold tool on rescue/main-wip-2026-07-23, and the
docs-only chore/audit-consolidation branch (merge to main if you want the full
audit/ folder there; main currently has the Phase 1/2 subset plus this HANDOFF).

---

# Phase 3 (Task 6): migration BUILT and verified; full cutover NOT run (rehearsal gate)

Branch `feat/phase3-users-model`, migration `migrations/0020_users_model.sql`
committed and pushed (`005666c`).

Done and verified:
- Migration 0020 written per PHASE3_PLAN_V2.md and REHEARSED on a fresh local D1
  with seed data. It applied cleanly (23 statements, no errors) and transformed
  the data correctly: clients -> users (+ type/tier with CHECK constraints); tier
  backfill (member=1 -> paid_access, source='public' -> free, else fully_managed
  - seed rows landed fully_managed); the agents fold into users as type='agent'
  with ids 1000+old (verified: no collision with customer ids; references remapped
  across users.agent_id, client_shares.agent_id, wishlists.owner_id,
  tasks.assigned_to); member/category/dealer_username dropped; agents table
  dropped; wishlists -> searches (FK columns intact); dealers -> suppliers; four
  new indexes (unique email/username/google_sub, plus type). Local state was reset
  clean afterwards.

Why the cutover did NOT run - this is your Task 6 rehearsal rule working:
- The migration is roughly 5% of Phase 3. The rest is a large code sweep plus
  non-mechanical work: ~145 `clients` SQL sites, ~80 `wishlists`, ~16 `dealers`,
  a SEMANTIC agents-fold across ~39 sites (agents becomes `users WHERE
  type='agent'` with id remap, not a rename), ~29 `member` sites plus the
  member-to-tier gate/Stripe/upsell/staff-selector logic, ~31 `category` sites,
  across admin.js (654 KB), index.js, auth.js, matcher, stripe, notify,
  auction-history, landing. THEN 389 table references across the test suite, the
  schema-check DEPLOY GATE (`check-remote-schema.mjs` must expect the new schema
  or main will not deploy), seed and qa-reset, AND the separate `jdm-dealer-portal`
  repo (functions/api/requests.js, login/forgot/reset) which binds the SAME
  production database.
- That is 700+ edit sites across two repos, ending in an irreversible production
  database cutover. Your rule: rehearse the ENTIRE cutover to clean-green first,
  cut over only if it passes, roll back on any failure. A clean full rehearsal
  (fresh D1, every test updated and green, e2e, four auth paths, the two-app
  portal loop) is not reachable for a refactor this size in one sitting, and
  cutting over on anything less would risk your live client and agent data.
- One production risk the plan itself flags (PHASE3_CHECKS Task 1) and that MUST
  be checked before any cutover: the new unique email index assumes zero
  case-insensitive email collision between your one client-with-email and the four
  agents. Confirm with a read-only production query first, or the migration aborts
  at index creation. Command is in PHASE3_CHECKS.md section 1.2.

Recommended path (I can drive it, it is a focused pass not a tail-of-session job):
build the full sweep + portal + tests + schema-check on `feat/phase3-users-model`,
take it through the complete local rehearsal to clean-green, run the production
collision check, then export + cutover + smoke exactly per PHASE3_PLAN_V2 sections
5 to 8, rollback-ready. The verified migration is the foundation to build on.

# Task 5 / Phase 6 - decision recorded, build folded into the Phase 3 pass

You decided: free customers get 1 request with details hidden (an upgrade teaser),
quota 1. Buildable, but it touches the request flow and the member model that
Phase 3 renames, so building it now against clients/member and redoing it after
the rename is wasteful. It belongs in the Phase 3 pass, on users/tier: open
`/portal/auctions/request` to tier='free' customers with a 1-request quota, and
render their one matched car with details masked behind an upgrade CTA.
