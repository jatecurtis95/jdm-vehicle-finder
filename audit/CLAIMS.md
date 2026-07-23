# Audit baseline
jdm-vehicle-finder:      f414a2d
jdm-dealer-portal:       10f3d2f
rover-eligibility-local: 6fdbede
jdm-bridge:              92788cb
jdm-calculator:          053c2ae   (C:\Users\jatec\repos\jdm-calculator)
All evidence in this file refers to these commits.

Note: jdm-calculator sits outside C:\Users\jatec\Projects and was tagged after
the main audit pass, so evidence in C-006, C-131 and C-133 is pinned
retrospectively. The deployed calculator may be ahead of this commit; confirm
before Phase 7 migrates its pricing tables.

# Claims Register — JDMC 2.0 Finder Plan (PLAN.md)

Source: c:\Users\jatec\Projects\PLAN.md
Convention: FACT/GAP claims start UNVERIFIED and are verifiable by the audit loop.
ACTION/DECISION claims are Status: N/A and skipped by the loop.
Priority (FACT/GAP only): P1 = being wrong changes a phase's scope, ordering, or risks breaking auth, a migration, or production. P2 = being wrong is a detail that implementation would surface anyway.
Ordering: all P1 claims first (ID order), then all remaining claims (ID order). IDs are stable.
Repos: finder = jdm-vehicle-finder · portal = jdm-dealer-portal · elig = rover-eligibility-local · bridge = jdm-bridge · calc-repo = jdm-calculator (local at C:\Users\jatec\repos\jdm-calculator, outside the Projects folder)

# P1 claims

## C-001
Phase: 0
Type: FACT
Priority: P1
Claim: Branch codex/auction-history-example exists on jdm-vehicle-finder
Expected location: finder (git)
Verify by: git branch -a in jdm-vehicle-finder
Status: VERIFIED
Evidence: .git/refs/heads/codex/auction-history-example:1 "ec9030c8e61507047bcd5599d37f923e0fb9ee07"
Notes: Also present as remotes/origin/codex/auction-history-example in git branch -a. HEAD = f414a2d (matches audit baseline).

## C-003
Phase: 0
Type: FACT
Priority: P1
Claim: Branch rescue/onedrive-wip-2026-07-22 exists on jdm-vehicle-finder
Expected location: finder (git)
Verify by: git branch -a
Status: VERIFIED
Evidence: .git/refs/heads/rescue/onedrive-wip-2026-07-22:1 "8a40a541f9aaf01b5e5b0b6b7e3312b9581aae9f"
Notes: Local branch only; no matching remotes/origin ref in git branch -a output.

## C-004
Phase: 0
Type: FACT
Priority: P1
Claim: Pushing main on jdm-vehicle-finder triggers a production deploy
Expected location: finder repo CI config / wrangler.toml / ARCHITECTURE.md
Verify by: inspect deploy workflow or CF Workers build config linkage
Status: VERIFIED
Evidence: jdm-vehicle-finder/.github/workflows/deploy.yml:17 "branches: [main]"; deploy.yml:70 "command: deploy"
Notes: GitHub Actions "Deploy to Cloudflare" runs on every push to main and ends with wrangler deploy (cloudflare/wrangler-action@v3). Gated by tests, e2e smoke, and a remote-schema check (db:check:remote) — deploy can fail if prod D1 schema lags migrations, but the trigger itself is push-to-main.

## C-005
Phase: 0
Type: FACT
Priority: P1
Claim: Another session holds unpushed work overlapping the finder repo
Expected location: finder (git)
Verify by: git status / git stash list / worktree list / reflog for uncommitted or unpushed refs
Status: VERIFIED
Evidence: .git/refs/heads/codex/finder-v13-fixes:1 "9ae1768d3c2c451fafd64408096f85e95b777186"; .git/worktrees/requests-customers-unify/gitdir:1 "...jdm-vehicle-finder.worktrees/requests-customers-unify/.git"
Notes: Corroborated three ways: (1) three linked worktrees active (jdm-finder-v13, jdm-share-links, requests-customers-unify) per git worktree list; (2) 9 local branches have no upstream (incl. codex/finder-v13-fixes, feat/requests-customers-unify, feat/sold-prices-merge, feat/phase5-design-system) per git for-each-ref; (3) main checkout itself dirty (M package.json + 6 untracked files incl. CODE_AUDIT.md, FLOW_AUDIT.md, UI_AUDIT.md). Unpushed overlapping work definitely exists; "another session" attribution is inferred from the active worktrees.

## C-006
Phase: 0
Type: GAP
Priority: P1
Claim: jdm-calculator source code is not present anywhere under C:\Users\jatec\Projects
Expected location: c:\Users\jatec\Projects
Verify by: search all repos for calculator app source (pricing tables, /api/calc implementation)
Status: VERIFIED
Evidence: jdm-vehicle-finder/src/calc.js:156 "fetch(env.CALC_API || \"https://calculator.jdmconnect.com.au/api/calc\""; jdm-dealer-portal/functions/api/calc.js:12 "UPSTREAM = 'https://jdm-calculator.pages.dev/api/calc'"
Notes: No jdm-calculator dir under Projects (top-level listing) and no /api/calc implementation — every hit for "api/calc|jdm-calculator" in Projects is a consumer (finder fetch, portal proxy, wrangler.toml CALC_API, docs). LCT/stamp-duty grep hits are static landing copy (jdm-vehicle-finder/src/landing-data.js:67), not pricing tables. IMPORTANT caveat: the claim is true only as scoped — a full clone WITH source EXISTS OUTSIDE Projects at C:\Users\jatec\repos\jdm-calculator (functions/api/calc.js + calc-v2.js, index.html, data.json), referenced by Projects.code-workspace:9 "path": "../repos/jdm-calculator". PLAN.md:9's premise "The calculator source isn't on this machine" is therefore WRONG; Phase-0 clone action (C-010) may be unnecessary. Also relevant to C-007/C-121/C-131.

## C-007
Phase: 0
Type: FACT
Priority: P1
Claim: jdm-calculator is an archived repo on GitHub (jatecurtis95)
Expected location: github.com/jatecurtis95/jdm-calculator
Verify by: confirm from local references only — ARCHITECTURE.md lists jdm-calculator as archived, and no local clone exists under Projects
Status: VERIFIED
Evidence: ARCHITECTURE.md:16 "Archived (read-only on GitHub, clone if ever needed): ... jdm-calculator"; C:\Users\jatec\repos\jdm-calculator\.git\config:9 "url = https://github.com/jatecurtis95/jdm-calculator.git"
Notes: Verified within the claim's local-references scope: ARCHITECTURE.md:16 lists jdm-calculator among archived read-only GitHub repos, and the clone's git remote confirms the jatecurtis95 account. Caveat: GitHub's actual archived flag was NOT live-probed (deferred per plan). Note the verify-by premise "no local clone exists under Projects" holds only as scoped — a full clone exists OUTSIDE Projects at C:\Users\jatec\repos\jdm-calculator (see C-006).

## C-008
Phase: 0
Type: GAP
Priority: P1
Claim: D1 migration tracking discipline is not yet adopted for remote migrations
Expected location: finder migrations/README.md, package.json scripts, wrangler.toml
Verify by: check for d1 migrations apply workflow vs ad-hoc execution
Status: VERIFIED
Evidence: .github/workflows/deploy.yml:9 "is not adopted in prod - see migrations/README.md"; migrations/README.md:71 "until the tracking is adopted"
Notes: From session memory ("adopt D1 migration tracking before any migrate:remote"). Memory-derived. If evidence is absent, mark STALE, not REFUTED. RESULT: gap confirmed at baseline f414a2d — but the adoption machinery is fully built and waiting: package.json:11-14 has db:migrate:local/remote/list + db:check:remote scripts; scripts/adopt-migration-tracking.mjs exists; .github/workflows/db-adopt-tracking.yml is a one-off manual workflow ("adopt wrangler's d1_migrations tracking table", line 1) that runs the adoption SQL --remote; db-apply-pending.yml:42 guards "migration tracking must be adopted first". So ACTION C-011 shrinks to: run the existing "Adopt D1 migration tracking" GitHub workflow once with approval (migrations/README.md:80) — no build work needed.

## C-014
Phase: 1
Type: FACT
Priority: P1
Claim: History renders on 3 surfaces (portal /portal/history, admin tab=history, dealer /dealer/history) via HISTORY_SURFACES
Expected location: finder src/auction-history.js
Verify by: read HISTORY_SURFACES and route wiring
Status: VERIFIED
Evidence: src/auction-history.js:57 "export const HISTORY_SURFACES = {"; :59 "basePath: \"/portal/history\""; :64-66 staff basePath "/admin" + baseParams { view: "auctions", tab: "history" }; :73 "basePath: \"/dealer/history\""
Notes: All three surfaces wired: member page renders at auction-history.js:458 (HISTORY_SURFACES.member), dealer at :476 (HISTORY_SURFACES.dealer, route src/index.js:2017 "/dealer/history"), staff at src/admin.js:8079 (tab === "history" → HISTORY_SURFACES.staff). Dealer surface is deliberately link-less (:70-76 "renders no links") — read-only, as the plan assumes.

## C-015
Phase: 1
Type: FACT
Priority: P1
Claim: Live search filter UI is auctionSearchHeader() in src/auction-ui.js (~line 145), shared by member and staff pages
Expected location: finder src/auction-ui.js
Verify by: read function and its call sites
Status: VERIFIED
Evidence: src/auction-ui.js:152 "export function auctionSearchHeader(o = {})"; src/admin.js:7714-7715 call with action "/portal/auctions" (member); src/admin.js:8189 call with action "/admin" (staff)
Notes: Actual definition line is 152, not ~145 — within the plan's "~" tolerance. Shared-by-both-surfaces confirmed: exactly two call sites, member portal and staff workspace, differing only in action/hidden/showBid options.

## C-030
Phase: 1
Type: FACT
Priority: P1
Claim: Fuel filter is keyword inference (FUEL_KEYWORDS) against the grade trim-text field; there is no structured fuel column
Expected location: finder src/auction-history-query.js (~lines 40-46)
Verify by: read FUEL_KEYWORDS and matching logic
Status: VERIFIED
Evidence: src/auction-history-query.js:40-44 "export const FUEL_KEYWORDS = { diesel...hybrid...electric...petrol: { tokens: [] }"; :37-38 "The feed has no structured fuel column"; :197-199 fuelClause() → likeAny("grade", ...)
Notes: Matching is LIKE against the `grade` trim-text column exactly as claimed. Nuance the plan already flags elsewhere: "petrol" is defined as the ABSENCE of all other fuel tokens (:198 notLikeAll), so petrol results include any listing whose trim text simply omits fuel words.

## C-031
Phase: 1
Type: FACT
Priority: P1
Claim: Body-type filter is keyword inference (BODY_KEYWORDS) against model_name + grade text
Expected location: finder src/auction-history-query.js (~lines 50-59)
Verify by: read BODY_KEYWORDS and matching logic
Status: VERIFIED
Evidence: src/auction-history-query.js:50-54 "export const BODY_KEYWORDS = { coupe...sedan...hatch...wagon..."; :202-204 bodyClause() → "[...likeAny(\"model_name\", tokens), ...likeAny(\"grade\", tokens)].join(\" OR \")"
Notes: Keyword inference against model_name + grade confirmed; header comment :48-49 "the feed has no structured body column either".

## C-053
Phase: 2
Type: FACT
Priority: P1
Claim: History rows compute landed cost via carAudToLanded() = AUD x 1.13 + 9000
Expected location: finder src/calc.js (~101-105), src/auction-history.js (~252-278)
Verify by: read carAudToLanded and its call site
Status: VERIFIED
Evidence: src/calc.js:104 "return Math.round(v * ON_VALUE_TAX + IMPORT_OVERHEAD_AUD)"; calc.js:86-87 "IMPORT_OVERHEAD_AUD = 9000...ON_VALUE_TAX = 1.13"; src/auction-history.js:256 "const landed = audVal > 0 ? carAudToLanded(audVal) : null"
Notes: Formula and history-row call site both exact. Also used by market.js:278 (Market Snapshot) — same rough model, consistent with the in-code comment (calc.js:97-100 "Not a quote; the real calculator is used once a specific lot is in hand").

## C-055
Phase: 2
Type: FACT
Priority: P1
Claim: Staff match/queue cards and the lot detail page call the real calculator API via estimateLanded()
Expected location: finder src/calc.js (~130-181), src/admin.js (~6155, 6190-6192)
Verify by: read estimateLanded and call sites
Status: VERIFIED
Evidence: src/calc.js:130 "export async function estimateLanded(env, lot, client, cfg = null)"; :156 fetch(env.CALC_API || "https://calculator.jdmconnect.com.au/api/calc"); src/admin.js:6155 lot detail "await attachLanded(env, [{ lot, client: { state: ctxClient.state } }])"; src/admin.js:1272 queue/match batch attachLanded
Notes: Substance confirmed with one mechanism detail: admin.js never calls estimateLanded directly — it goes through the attachLanded batch wrapper (calc.js:202, which calls estimateLanded at :209 with bounded concurrency). Lot detail (admin.js:6155, landed line rendered :6190-6192), staff match/queue batch (:1272), client find view (:5399) and member auctions page (:7810) all route through it. See C-NEW-163: CALC_API in prod wrangler.toml points at the custom domain whose DNS reportedly broke.

## C-064
Phase: 3
Type: FACT
Priority: P1
Claim: clients table holds all buyers with columns incl. name, email, whatsapp, agent_id, dealer_username, category, source, member, portal_enabled
Expected location: finder migrations/0001_baseline.sql + later migrations
Verify by: read schema across migrations
Status: VERIFIED
Evidence: migrations/0001_baseline.sql:33-40 "name...email...whatsapp...dealer_username TEXT...agent_id...portal_enabled"; 0002_client_member.sql:5 "ADD COLUMN member"; 0011:8 "ADD COLUMN category"; 0016_client_source.sql:6 "ADD COLUMN source TEXT"
Notes: All claimed columns confirmed. Correction of detail: source added by 0016_client_source.sql (register elsewhere said 0017). NEW fact for Phase 3 scope: clients ALSO carries its own login credentials (0001:41-42 pass_salt/pass_hash + invite_token, PBKDF2 per legacy schema comments) — so unification touches THREE auth systems (agents, client portal logins, dealer-portal logins), not two. PLAN.md Phase 3 only accounts for the dealer-portal PBKDF2.

## C-065
Phase: 3
Type: FACT
Priority: P1
Claim: clients.category ('private' | 'dealer') was added by migration 0011_client_category.sql as a buyer tag
Expected location: finder migrations/0011_client_category.sql
Verify by: read the migration
Status: VERIFIED
Evidence: migrations/0011_client_category.sql:8 "ADD COLUMN category TEXT NOT NULL DEFAULT 'private'"; 0011:3 "'dealer' (a trade buyer we sell to/for)"
Notes: Buyer-tag semantics confirmed by the migration's own comment. Bonus corroboration of C-008: 0011:7 warns "NEVER `migrations apply` - the tracking table is out of sync".

## C-066
Phase: 3
Type: FACT
Priority: P1
Claim: Migration 0013_dealer_system.sql created dealers + dealer_vehicles tables for vehicle sellers/suppliers
Expected location: finder migrations/0013_dealer_system.sql
Verify by: read the migration
Status: VERIFIED
Evidence: migrations/0013_dealer_system.sql:7 "CREATE TABLE IF NOT EXISTS dealers"; 0013:27 "CREATE TABLE IF NOT EXISTS dealer_vehicles"; 0013:2 "separate logins for vehicle suppliers (dealers)"
Notes: Sellers/suppliers purpose stated in the header comment. Finder dealers rows have their own email+PBKDF2 credentials (0013:9,13-14) — a fourth credential store if ever enabled.

## C-068
Phase: 3
Type: FACT
Priority: P1
Claim: The dealer portal has its own dealers table (username PK, password_hash, salt, display_name, email, is_admin) in a separate jdm-dealers D1
Expected location: jdm-dealer-portal scripts/schema.sql
Verify by: read the schema
Status: VERIFIED
Evidence: jdm-dealer-portal/scripts/schema.sql:7-14 "dealers ( username TEXT PRIMARY KEY, password_hash...salt...display_name...email...is_admin"
Notes: All claimed columns present (plus active, created_at). Separate jdm-dealers D1 confirmed by portal wrangler.toml having its own env.DB binding distinct from FINDER_DB.

## C-069
Phase: 3
Type: FACT
Priority: P1
Claim: Portal "dealers" are trade buyers/requesters while finder "dealers" are sellers — two different entities with the same name
Expected location: jdm-dealer-portal scripts/schema.sql vs finder migrations/0013_dealer_system.sql
Verify by: compare table purposes/columns and usage
Status: VERIFIED
Evidence: finder migrations/0013_dealer_system.sql:2-4 "vehicle suppliers...These dealers are sellers"; jdm-dealer-portal/functions/api/requests.js:10 "clients.dealer_username" scoping buyers' requests to portal accounts
Notes: Two unrelated schemas share the name: finder dealers = suppliers with email-keyed logins submitting stock; portal dealers = username-keyed trade-buyer accounts that own finder clients/wishlists. Confirms the plan's collision premise.

## C-070
Phase: 3
Type: FACT
Priority: P1
Claim: clients.dealer_username is a TEXT link (no FK) to the portal's dealers.username across databases
Expected location: finder migrations + portal functions/api/requests.js
Verify by: read column definition and join usage
Status: VERIFIED
Evidence: migrations/0001_baseline.sql:38 "dealer_username TEXT" (no REFERENCES clause); jdm-dealer-portal/functions/api/requests.js:46 "JOIN clients c ON c.id = w.client_id WHERE...c.dealer_username = ?"
Notes: Plain TEXT column, no FK (cross-database so none possible); portal joins on it for ownership. Legacy comment (migrations/legacy/schema-pre-baseline.sql:27) confirms intent: "portal dealer who created this".

## C-071
Phase: 3
Type: FACT
Priority: P1
Claim: Portal /api/requests scopes visible wishlists/clients by c.dealer_username = ?
Expected location: jdm-dealer-portal functions/api/requests.js
Verify by: read the query
Status: VERIFIED
Evidence: jdm-dealer-portal/functions/api/requests.js:66 "WHERE c.dealer_username = ?"; also :46 and :90 (matches query)
Notes: All three read paths (ownership check, request list, match list) scope by dealer_username; mutations re-check ownership (requests.js:10 comment, :215 DELETE guarded by "AND dealer_username = ?").

## C-072
Phase: 3
Type: FACT
Priority: P1
Claim: Portal auth is self-contained PBKDF2 + HMAC session cookie against its own dealers table, never authenticating against FINDER_DB
Expected location: jdm-dealer-portal functions/lib/auth.js, functions/_middleware.js
Verify by: read auth flow
Status: VERIFIED
Evidence: jdm-dealer-portal/functions/lib/auth.js:13-14 "PBKDF2_ITERATIONS = 100_000...SHA-256"; auth.js:69 "Stateless session token...base64url(HMAC)"; functions/api/login.js:85-86 "SELECT username, password_hash...FROM dealers" via env.DB
Notes: Login validates against the portal's own env.DB dealers table; auth.js is pure WebCrypto (no DB access); _middleware.js contains zero env.DB/FINDER_DB references (session verified statelessly by HMAC). No FINDER_DB usage anywhere in the auth path — claim fully holds.

## C-073
Phase: 3
Type: FACT
Priority: P1
Claim: The portal binds FINDER_DB (the finder's D1) and reads/writes its clients/wishlists/queue tables directly
Expected location: jdm-dealer-portal wrangler config + functions/api/*.js
Verify by: read binding and usage
Status: VERIFIED
Evidence: jdm-dealer-portal/wrangler.toml:20 "binding = \"FINDER_DB\""; functions/api/requests.js:149 "INSERT INTO clients (name, email, dealer_username)"; :196 "UPDATE wishlists SET active"
Notes: Read AND write confirmed — the portal inserts clients, updates wishlists, and batch-deletes queue/seen_lots/wishlists rows (requests.js:207-209) directly in the finder's D1. Any wishlists/clients rename in Phase 3 breaks the portal in the same deploy window.

## C-074
Phase: 3
Type: FACT
Priority: P1
Claim: wishlists is the "requests" entity with client_id, status, owner_id, active, auto_notify, watch_only
Expected location: finder migrations (0001, 0006, others)
Verify by: read schema
Status: VERIFIED
Evidence: migrations/0001_baseline.sql:61 "client_id INTEGER NOT NULL REFERENCES clients(id)"; 0001:72-74 "active...auto_notify...watch_only"; 0006_crm_phase2.sql:9-10 "ADD COLUMN status...ADD COLUMN owner_id"
Notes: All six claimed columns confirmed (client_id/active/auto_notify/watch_only in baseline; status/owner_id added by 0006, which also adds deposit_status).

## C-076
Phase: 3
Type: FACT
Priority: P1
Claim: request-wizard.js creates clients + wishlists rows with source='public' (self-signup path)
Expected location: finder src/request-wizard.js
Verify by: read the insert logic
Status: AMENDED
Evidence: src/admin.js:7481 "state, source: \"public\""; src/admin.js:7450 "portal_enabled: 1, google_sub: sub, source: \"public\""
Notes: Correction: the source='public' inserts do NOT live in request-wizard.js — grep finds no "source" in that file at all (it is form/UI only). The client-creation handlers that stamp source='public' are in src/admin.js (~7450 Google-OAuth signup path, ~7481 public request-form path). Semantics confirmed by src/admin.js:2382 comment: "A client's source is 'public' only when they submitted the request form or...". Backfill logic in Phase 3 should target admin.js handlers, not the wizard.

## C-077
Phase: 3
Type: FACT
Priority: P1
Claim: clients.member (0/1, Stripe-driven) is the only free-vs-paid distinction on buyers
Expected location: finder migrations/0002, 0003 + src usage
Verify by: read member usage; confirm no other tier column
Status: VERIFIED
Evidence: migrations/0002_client_member.sql:5 "ADD COLUMN member INTEGER NOT NULL DEFAULT 0"; 0003_client_subscription.sql:4 "active subscription sets member = 1"
Notes: member is 0/1, Stripe-driven per 0003's comment (staff can still comp manually). No other tier-like column exists: grep "tier" across migrations hits only a README example filename (migrations/README.md:21 "0002_add_tiers.sql").

## C-078
Phase: 3
Type: FACT
Priority: P1
Claim: The finder's dealer (seller) feature is gated off by the dealer_portal_enabled setting and described in-code as half-built
Expected location: finder src/settings.js, src/admin.js
Verify by: read setting default and gating
Status: VERIFIED
Evidence: src/settings.js:48 "the dealer feature is half-built (approved stock never reaches"; settings.js:51 "dealer_portal_enabled: \"0\""; src/index.js:838 "if (!settingOn(s, \"dealer_portal_enabled\"))"
Notes: Default off, gated in index.js (route guard ~833-838) and admin.js:1212 (dealersOn). The in-code launch-audit comment explicitly calls it half-built — supports the plan's "cheap to rename now" premise.

## C-079
Phase: 3
Type: FACT
Priority: P1
Claim: A worktree branch requests-customers-unify exists and is listed as merged in ARCHITECTURE.md's cleanup queue
Expected location: c:\Users\jatec\Projects\ARCHITECTURE.md; finder git branches
Verify by: read cleanup queue; git branch --merged
Status: VERIFIED
Evidence: ARCHITECTURE.md:86 ".worktrees\requests-customers-unify | Merged worktrees → `git worktree remove`"; git branch --merged main includes "feat/requests-customers-unify"
Notes: If truly merged, some unification work may already be on main. CONFIRMED both ways: the cleanup queue lists it as a merged worktree AND git branch --merged main shows feat/requests-customers-unify (exact branch name has the feat/ prefix; worktree dir is requests-customers-unify). So some Customers/Requests unification work IS already on main — C-088 (review prior art) is now mandatory before Phase 3 design, and C-080/C-081's absence findings show the merged work did not add users/tier schema.

## C-080
Phase: 3
Type: GAP
Priority: P1
Claim: No unified users table with a type column exists
Expected location: finder migrations/
Verify by: confirm absence across all migrations
Status: VERIFIED
Evidence: grep "CREATE TABLE (IF NOT EXISTS )?users" across jdm-vehicle-finder/migrations/ returns zero matches (only clients/agents/dealers/wishlists/etc. exist)
Notes: GAP confirmed at baseline f414a2d — no users table in any migration, including the merged requests-customers-unify work.

## C-081
Phase: 3
Type: GAP
Priority: P1
Claim: No tier column (fully-managed / paid-access / free) exists on any user-like table
Expected location: finder migrations/
Verify by: confirm absence
Status: VERIFIED
Evidence: grep "tier" across jdm-vehicle-finder/migrations/ matches only migrations/README.md:21 "0002_add_tiers.sql" (an example filename in the how-to text)
Notes: GAP confirmed — no tier column on clients, agents, dealers or any other table. Free-vs-paid remains solely clients.member (see C-077).

## C-093
Phase: 4
Type: FACT
Priority: P1
Claim: Client email delivery is gated only by client.email being populated plus the global send_to_client switch — no per-client unsubscribe/preference column
Expected location: finder src/notify.js + migrations
Verify by: read deliverToClient gating; confirm no pref column
Status: VERIFIED
Evidence: src/notify.js:199 "if (!settingOn(settings, \"send_to_client\")) return result"; :201 "if (client.email) {" → :208 sendEmail(...to: client.email); same pair in deliverManyToClient :240/:242
Notes: No per-client unsubscribe/preference column exists: grep across migrations for opt_out/alerts/notify hits only agents.alerts (0001_baseline.sql:24 — staff digest flag, see C-092) and wishlists.auto_notify (0001:73 — a per-SEARCH "skip review, deliver immediately" flag, not an opt-out). client_landed only toggles landed-cost display, not delivery. Claim holds exactly.

## C-094
Phase: 4
Type: GAP
Priority: P1
Claim: No per-user notification preferences table (notification_prefs / subscriptions) exists in either repo
Expected location: finder migrations/, jdm-dealer-portal scripts/
Verify by: confirm absence
Status: VERIFIED
Evidence: grep -i "notification_pref|subscription|prefs" across jdm-vehicle-finder/migrations/ matches only 0003_client_subscription.sql (Stripe payment state, e.g. :8 "ADD COLUMN stripe_subscription_id TEXT"); zero matches in jdm-dealer-portal
Notes: GAP confirmed — the only "subscription" anywhere is Stripe billing state, not notification preferences. Full CREATE TABLE inventory across migrations (agents, clients, client_shares, wishlists, seen_lots, queue, settings, payments, stripe_events, tasks, activity, dealers, dealer_vehicles, watchlist_items) contains no prefs table.

## C-095
Phase: 4
Type: GAP
Priority: P1
Claim: SMS capability does not exist anywhere (no Twilio SMS API usage; only WhatsApp)
Expected location: finder src/ (all), jdm-dealer-portal
Verify by: grep for SMS/Messages API usage
Status: VERIFIED
Evidence: grep -i "sms|twilio" across finder src/: Twilio appears only in src/whatsapp.js, always WhatsApp-prefixed — whatsapp.js:91-92 "From: \"whatsapp:+\"...To: `whatsapp:+${to}`" into :102 api.twilio.com Messages.json; zero matches in jdm-dealer-portal
Notes: GAP confirmed — the Twilio Messages API is used exclusively with whatsapp: addresses (never bare SMS numbers); the only other "messages" hit is Pushover operator push (notify.js:101). No SMS capability anywhere.

## C-096
Phase: 4
Type: FACT
Priority: P1
Claim: WhatsApp is implemented in src/whatsapp.js with both Twilio and Meta Cloud API paths, switched by the whatsapp_provider setting
Expected location: finder src/whatsapp.js
Verify by: read provider selection
Status: VERIFIED
Evidence: src/whatsapp.js:57 "const pref = String(settings?.whatsapp_provider || env.WHATSAPP_PROVIDER || \"twilio\")"; :81 sendViaTwilio (api.twilio.com :102); :115 sendViaMeta (graph.facebook.com :122)
Notes: Both paths implemented; selection order is whatsapp_provider setting → WHATSAPP_PROVIDER var → whichever provider has secrets configured (:56-62), no-op if neither. Header comment :1-4 states Twilio is the active path, Meta "wired and ready to switch to... no code change".

## C-104
Phase: 5
Type: FACT
Priority: P1
Claim: wrangler.toml sets crons = ["0 */6 * * *"] (every 6 hours, 4x/day)
Expected location: finder wrangler.toml (~line 38)
Verify by: read the [triggers] block
Status: VERIFIED
Evidence: wrangler.toml:37-38 "[triggers]\ncrons = [\"0 */6 * * *\"]"
Notes: Exactly as claimed (line 38, plan said ~38). Comment :36 "Times are UTC".

## C-108
Phase: 5
Type: GAP
Priority: P1
Claim: No endpoint runs a single wishlist/search on demand — runWishlist() is only called from the runAll loop
Expected location: finder src/matcher.js (~161, ~258), src/index.js
Verify by: find all runWishlist call sites
Status: VERIFIED
Evidence: src/matcher.js:161 "export async function runWishlist(env, wishlist, opts = {})"; sole call site matcher.js:285 "const queued = await runWishlist(env, w, ...)" inside the runAll per-wishlist loop
Notes: GAP confirmed — grep for runWishlist across src/ returns only the definition and the single runAll-loop call; no route in index.js invokes it directly. Note the member "Request a bid" flow (see C-116) queues a specific LOT without running a search — it is not a per-wishlist run either.

## C-109
Phase: 5
Type: FACT
Priority: P1
Claim: KV-backed sliding-window rate limiters (RL namespace) exist in index.js and fail open if KV is unavailable
Expected location: finder src/index.js (~60-167), wrangler.toml
Verify by: read the limiter helpers and binding
Status: VERIFIED
Evidence: src/index.js:56-61 "Best-effort sliding-window limiter... Fails open (no KV, or KV errors -> allowed)... if (!env.RL) return false"; :86-94 apiRateLimited same pattern; wrangler.toml:54 "binding = \"RL\""
Notes: Three limiter families all on the RL KV namespace, all fail-open: request form (per-IP + per-contact, :60-79), public /api/* (per-IP 60/5min, :84-94), and login lockout (:123-149, which deliberately never clears the fleet-wide fail counter on success, :145-147). Pedantic detail: implementation is TTL'd fixed-window counters, which the code itself labels "sliding-window" — behaviourally window caps, matching the plan's intent.

## C-113
Phase: 6
Type: FACT
Priority: P1
Claim: dealer_vehicles has a submit-pending-approve/reject flow (submitDealerVehicle, approveDealerVehicle, rejectDealerVehicle)
Expected location: finder src/admin.js (~8691 and nearby)
Verify by: read the three functions
Status: VERIFIED
Evidence: src/admin.js:8691 submitDealerVehicle → :8745 "INSERT INTO dealer_vehicles (...status) VALUES (..., 'pending')"; :8760 approveDealerVehicle → :8767 "SET status = 'approved'"; :8777 rejectDealerVehicle → :8785 "SET status = 'rejected'"
Notes: Full submit-pending-approve/reject flow confirmed, wired in index.js (:2026 dealer submit route, :878/:883 admin approve/reject actions). BUG (recorded, not fixed): approveDealerVehicle stamps approved_by with a hardcoded 0 — admin.js:8768 ".bind(0, vid)" — instead of the approving admin's id, so the audit column never records who approved. Also corroborates settings.js:48's "approved stock never reaches" half-built note (C-078): approval only flips status.

## C-115
Phase: 6
Type: GAP
Priority: P1
Claim: The dealer vehicle submission flow has no per-IP or per-account rate limit of its own (only the session auth gate)
Expected location: finder src/admin.js, src/index.js
Verify by: confirm no limiter call on the submission route
Status: VERIFIED
Evidence: src/index.js:2024-2026 "/dealer/vehicle/submit" POST goes straight from formData to submitDealerVehicle with no limiter call; src/admin.js:8692-8694 checks only session.role === "dealer" + dealers.active
Notes: GAP confirmed — the RL helpers (requestRateLimited/apiRateLimited/login lock) are not invoked on this route, and submitDealerVehicle enforces field caps (DEALER_VEHICLE_LIMITS) but no per-account submission count or window. Only the session auth gate stands, as claimed. (Low live exposure while dealer_portal_enabled defaults off, C-078.)

## C-116
Phase: 6
Type: GAP
Priority: P1
Claim: No user-facing "submit a unit for review / ask us about this lot" flow exists
Expected location: finder src/
Verify by: confirm absence in portal routes
Status: REFUTED
Evidence: src/admin.js:6206 member lot page "Request a bid on this car" → POST /portal/auctions/request; src/index.js:1681-1687 route → requestAuctionLot; src/admin.js:7778-7780 "INSERT INTO queue (...status...client_request...reason) VALUES (..., 'pending', ?, 1, datetime('now'), 'Direct request from auction search')"
Notes: A user-facing "ask us about this lot" flow DOES exist for members: Request-bid buttons on the lot detail page (:6206), auction search cards (:7726) and watchlist tab (auction-ui.js:317) all POST /portal/auctions/request, which files the lot into the staff review queue as a pending client_request under an auto-created "Direct requests" wishlist, alerts the client (index.js:1686) and pushes staff (:1687 "Member requested a car"). Share-link pages additionally offer "Enquire about this car" → /request wizard (admin.js:5892-5900). What genuinely does NOT exist: the flow for free/non-member users (member-gated at index.js:1683 "if (!c || !c.member)") and any submission quotas. This materially shrinks Phase 6's C-118 (build a review queue) to "extend the existing queue/client_request mechanism to more tiers + quotas" — see C-NEW-162.

## C-121
Phase: 7
Type: FACT
Priority: P1
Claim: The calculator is deployed at jdm-calculator.pages.dev with custom domain calculator.jdmconnect.com.au, API POST /api/calc
Expected location: finder src/calc.js, jdm-dealer-portal functions/api/calc.js (as consumers)
Verify by: read the URLs in local consumer code only (finder src/calc.js and jdm-dealer-portal functions/api/calc.js)
Status: VERIFIED
Evidence: jdm-dealer-portal/functions/api/calc.js:12-13 "UPSTREAM = 'https://jdm-calculator.pages.dev/api/calc'; UPSTREAM_ORIGIN = 'https://calculator.jdmconnect.com.au'"; finder src/calc.js:156-157 fetch("https://calculator.jdmconnect.com.au/api/calc", { method: "POST" })
Notes: Verified within the local-consumer scope: both the pages.dev deployment URL and the custom domain appear in consumer code, endpoint is POST /api/calc. Finder prod config pins the custom domain (wrangler.toml:82 CALC_API) — see C-NEW-163 for why that matters given C-122. Live probe still deferred per plan.

## C-122
Phase: 7
Type: FACT
Priority: P1
Claim: The calculator custom-domain DNS broke when the zone moved Cloudflare accounts
Expected location: jdm-dealer-portal functions/api/calc.js (comments)
Verify by: read the comment in jdm-dealer-portal functions/api/calc.js only
Status: VERIFIED
Evidence: jdm-dealer-portal/functions/api/calc.js:8-10 "Fetch the stable *.pages.dev URL directly rather than the custom domain, so the portal does not depend on calculator.jdmconnect.com.au DNS (which broke when the zone moved Cloudflare accounts)"
Notes: Comment states the break verbatim. Adjacent scope finding: the portal routed AROUND the broken domain, but the finder still routes THROUGH it (wrangler.toml:82 CALC_API = the custom domain; calc.js code default likewise). If the DNS is still broken, every finder landed estimate fails silently to null (estimateLanded catch → null, calc.js:177-179). Appended as C-NEW-163 — this changes Phase 2/7 risk ordering (fix DNS or repoint CALC_API before relying on estimates). UPDATE 22 Jul 2026: the comment is stale and misleading — the DNS issue it describes has been resolved (live probe under C-NEW-163: custom domain returns 200, resolves to Cloudflare). The claim stays VERIFIED (the comment does say this), but the comment should be corrected during Phase 7, and the C-NEW-163 risk it prompted is REFUTED.

## C-131
Phase: 7
Type: FACT
Priority: P1
Claim: The calculator's internal pricing tables (shipping lines, LCT, stamp duty, rego, GST, DAFF) are hardcoded inside the calculator app
Expected location: calc-repo (jdm-calculator, not local)
Verify by: confirm from local consumer code only — the finder's calc payload exposes no pricing-table parameters beyond complianceCost/agencyFee/fx (finder src/calc.js), implying internal tables are hardcoded upstream
Status: VERIFIED
Evidence: C:\Users\jatec\repos\jdm-calculator\functions\api\calc-v2.js:14-15 "Shipping line rate tables (SENSITIVE)... const SHIPPING_LINES = ["; :24 DAFF_CLEANING; :27-28 REGO_COSTS/NSW_REGO; :50 calcLCT; :56 calcStampDuty; :195 GST hardcoded "* 0.10"
Notes: Verified DIRECTLY, not just by consumer-side implication — the "not local / clone first" premise is moot because a full clone already exists at C:\Users\jatec\repos\jdm-calculator (established in C-006). All claimed tables (shipping lines, LCT, stamp duty, rego, GST, DAFF) are hardcoded JS constants/functions inside calc-v2.js. Consumer-side implication also holds: finder payload (calc.js:138-153) exposes only complianceCost/agencyFee plus boolean toggles. Phase 0's clone ACTION (C-010) is unnecessary; Phase 7 can start from the existing clone.

## C-133
Phase: 7
Type: GAP
Priority: P1
Claim: The calculator's pricing tables are not editable from any admin UI
Expected location: finder src/admin.js, jdm-dealer-portal public/admin.html, calc-repo
Verify by: confirm no UI writes those tables
Status: VERIFIED
Evidence: repos\jdm-calculator\functions\api\calc-v2.js:15-28 tables are compile-time consts (no storage read); finder src/calc.js:193 admin settings cover only "calc_compliance_aud / calc_agency_aud / calc_fx_jpy_aud"; portal calc surfaces (public/index.html:1619 POST /api/calc) are consumer calculators, not editors
Notes: GAP confirmed — the calculator repo ships no admin surface at all (only index.html/test.html consumer pages), so shipping-line/LCT/stamp/rego/GST/DAFF numbers can only change via code deploy. The finder's "Landed cost assumptions" settings (C-129) tune payload overrides, never the upstream tables. Adjacent: the dealer portal ALREADY embeds a working calculator UI — see C-NEW-164 (shrinks Phase 7's C-137).

## C-143
Phase: 8
Type: FACT
Priority: P1
Claim: The eligibility UI is a flat filterable list of raw SEV register entries (one row per entry), not a make-model-variant navigator
Expected location: elig index.html (build(), ~line 674)
Verify by: read build() and the list rendering
Status: VERIFIED
Evidence: rover-eligibility-local/index.html:674 "function build(data){"; :676 "(data.sev||[]).forEach(s=>{" and :692 "(data.mre||[]).forEach(m=>{" building one row object per register entry; :1059-1065 "const list = filtered(); const total = list.length;... list.slice(start, start + PAGE)"
Notes: Confirmed a flat filterable/paginated list of raw SEV + MRE register entries. Rows are variant-TITLED via extractor display fields (:682 dispVariant/_display_variant etc.) but there is no make→model→variant grouping or navigation — one row per entry as claimed. (Definition sits at line 674 exactly as the plan cites.)

## C-146
Phase: 8
Type: GAP
Priority: P1
Claim: No consumer-facing Make-Model-Variant browse view exists
Expected location: elig
Verify by: confirm absence in index.html / routes
Status: VERIFIED
Evidence: rover-eligibility-local/index.html is a single-view app — the only render paths are the flat table (build() :674, filtered()/slice :1059-1065) and the per-entry detail panel (:1250 "Approved model reports for this vehicle" cross-links); no second view, route, or make/model/variant navigator exists
Notes: GAP confirmed — no consumer-facing MMV browse view. The detail panel does cross-link SEV↔MRE entries (:1245-1251), which is entry-graph navigation, not an MMV hierarchy. Raw material for the planned view exists (per-row _display_variant/_display_model_code/_display_engine), consistent with Phase 8's build action C-148.

## C-151
Phase: 9
Type: FACT
Priority: P1
Claim: The jdm-bridge quote form validates client-side and composes a mailto:info@jdmbridge.com.au — no backend
Expected location: bridge script.js (quoteForm)
Verify by: read the form handler
Status: VERIFIED
Evidence: jdm-bridge/script.js:29-30 "// Quote form → mailto compose (no backend yet...)... getElementById('quoteForm')"; :33 client-side "EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/"; :51-52 "window.location.href = 'mailto:info@jdmbridge.com.au?subject=' + encodeURIComponent(subject)..."
Notes: Exactly as claimed — client-side validation (email regex + error element :32/:47) then a composed mailto to info@jdmbridge.com.au; the comment itself records "no backend yet; see DESIGN.md accepted debt".

## C-153
Phase: 9
Type: FACT
Priority: P1
Claim: The lot detail page has a market-intel panel computing avg/median/trend for comparable sold cars
Expected location: finder src/admin.js (auctionLotPage, ~6109-6253)
Verify by: read the panel code
Status: VERIFIED
Evidence: src/admin.js:6160 auctionLotPage calls "marketIntel(env, lot.marka_name, lot.model_name, ... { kuzov, grade, year, mileage })"; :6236 renders marketPanel(market); src/market.js:211-212 "avg: Math.round(...), median: median(prices)" and :189-202 12-week per-week trend aggregates
Notes: Location amendment worth noting: the panel is rendered from auctionLotPage (admin.js ~6160/6236, within the plan's cited range) but the avg/median/trend COMPUTATION lives in src/market.js (marketIntel, querying the remote stats gateway — aggregates at market.js:163, trend loop :199-202, rendered stats "Avg sold"/"Median"/"Price trend" :359-362). So the price-range-database base (Phase 9) is market.js, not admin.js. Member visibility is gated by the market_for_clients setting (admin.js:6158).

## C-154
Phase: 9
Type: GAP
Priority: P1
Claim: No precomputed price-range summary table (per eligible make/model/variant) exists
Expected location: finder migrations/ + src/
Verify by: confirm absence of such a table and populating job
Status: VERIFIED
Evidence: full CREATE TABLE inventory across jdm-vehicle-finder/migrations/ (agents, clients, client_shares, wishlists, seen_lots, queue, settings, payments, stripe_events, tasks, activity, dealers, dealer_vehicles, watchlist_items) contains no price-range/summary table; grep -i "price_range|price_summary" across migrations returns zero
Notes: GAP confirmed. All market stats are computed per-request against the remote stats gateway (market.js:163 "select avg(FINISH)... from stats where"), nothing is precomputed or persisted, and no scheduled job writes summaries. IMPORTANT scope note for Phase 9: `stats` is NOT a local D1 table — it lives behind the remote auction-feed gateway (SQL-over-HTTP via market.js/avtonet.js query helper), so the planned "scheduled job precomputing price ranges from the stats table" (C-158) must pull from the external gateway (with its ~250-300 row sample caps seen at market.js:189) into a NEW local D1 table, not run a local SQL rollup.

# Remaining claims (P2, ACTION, DECISION)

## C-002
Phase: 0
Type: FACT
Priority: P2
Claim: codex/auction-history-example contains 4 commits not on main
Expected location: finder (git)
Verify by: git log --oneline main..codex/auction-history-example | count
Status: REFUTED
Evidence: .git/refs/heads/codex/auction-history-example:1 "ec9030c8e61507047bcd5599d37f923e0fb9ee07"; git log main..codex/auction-history-example = 9 commits
Notes: Actual count is 9, not 4 (range ec9030c..f275866, from "test: add auction history example contract" to "test: capture launch token regressions"). Plan understates the branch's divergence.

## C-009
Phase: 0
Type: ACTION
Claim: Review/merge or discard the two outstanding branches before other work
Expected location: finder (git)
Verify by: -
Status: N/A
Evidence:
Notes:

## C-010
Phase: 0
Type: ACTION
Claim: Clone archived jdm-calculator locally (read-only) for inspection
Expected location: calc-repo
Verify by: -
Status: N/A
Evidence:
Notes:

## C-011
Phase: 0
Type: ACTION
Claim: Adopt D1 migration tracking before any remote migration
Expected location: finder
Verify by: -
Status: N/A
Evidence:
Notes:

## C-012
Phase: 1
Type: FACT
Priority: P2
Claim: History filter form component is auctionHistoryContent in src/auction-history.js (~line 374)
Expected location: finder src/auction-history.js
Verify by: read function definition
Status: UNVERIFIED
Evidence:
Notes:

## C-013
Phase: 1
Type: FACT
Priority: P2
Claim: History query/validation layer is validateHistoryParams/buildHistoryWhere/searchHistory in src/auction-history-query.js
Expected location: finder src/auction-history-query.js
Verify by: read exported functions
Status: UNVERIFIED
Evidence:
Notes:

## C-016
Phase: 1
Type: FACT
Priority: P2
Claim: Live query logic is searchLots() in src/avtonet.js (~line 181) against the `main` table
Expected location: finder src/avtonet.js
Verify by: read searchLots and its FROM clause
Status: UNVERIFIED
Evidence:
Notes:

## C-017
Phase: 1
Type: FACT
Priority: P2
Claim: History queries run against the `stats` (sold) table
Expected location: finder src/auction-history-query.js
Verify by: read searchHistory FROM clause
Status: UNVERIFIED
Evidence:
Notes:

## C-018
Phase: 1
Type: FACT
Priority: P2
Claim: History grade pill set HISTORY_RATES is exactly {3, 3.5, 4, 4.5, 5, R, RA}
Expected location: finder src/auction-history-query.js (~lines 84-92)
Verify by: read the HISTORY_RATES definition
Status: UNVERIFIED
Evidence:
Notes:

## C-019
Phase: 1
Type: GAP
Priority: P2
Claim: Grades 2, 6 and S are not selectable in the History grade filter
Expected location: finder src/auction-history-query.js
Verify by: confirm absence from HISTORY_RATES
Status: UNVERIFIED
Evidence:
Notes:

## C-020
Phase: 1
Type: FACT
Priority: P2
Claim: History grade filter matches via UPPER(rate) IN (...) exact string comparison
Expected location: finder src/auction-history-query.js (~lines 218-221)
Verify by: read buildHistoryWhere rates clause
Status: UNVERIFIED
Evidence:
Notes:

## C-021
Phase: 1
Type: FACT
Priority: P2
Claim: Live grade filter is a single numeric "Min grade" input (gradeMin, 1-6 hint)
Expected location: finder src/auction-ui.js (~line 195)
Verify by: read the input markup
Status: UNVERIFIED
Evidence:
Notes:

## C-022
Phase: 1
Type: FACT
Priority: P2
Claim: gradeMin is applied as rate >= gMin in the live query
Expected location: finder src/avtonet.js (~line 202)
Verify by: read the WHERE clause
Status: UNVERIFIED
Evidence:
Notes:

## C-023
Phase: 1
Type: GAP
Priority: P2
Claim: Live Auctions tab has no colour, fuel, body-type or drivetrain filters
Expected location: finder src/auction-ui.js, src/avtonet.js
Verify by: confirm absence from form fields and searchLots params
Status: UNVERIFIED
Evidence:
Notes:

## C-024
Phase: 1
Type: FACT
Priority: P2
Claim: Live auction-house filter is a single-select <select name="house">
Expected location: finder src/auction-ui.js (~line 186)
Verify by: read the select markup
Status: UNVERIFIED
Evidence:
Notes:

## C-025
Phase: 1
Type: FACT
Priority: P2
Claim: History auction-house filter is also single-select
Expected location: finder src/auction-history.js (~line 172)
Verify by: read the select markup
Status: UNVERIFIED
Evidence:
Notes:

## C-026
Phase: 1
Type: FACT
Priority: P2
Claim: House options come from distinctHouses(): SELECT DISTINCT auction FROM main, cached 1 hour
Expected location: finder src/avtonet.js (~lines 431-445)
Verify by: read distinctHouses
Status: UNVERIFIED
Evidence:
Notes:

## C-027
Phase: 1
Type: FACT
Priority: P2
Claim: House filter matches via UPPER(auction) LIKE '%...%' (contains) in both live and history queries
Expected location: finder src/avtonet.js (~206), src/auction-history-query.js (~240)
Verify by: read both WHERE clauses
Status: UNVERIFIED
Evidence:
Notes:

## C-028
Phase: 1
Type: FACT
Priority: P2
Claim: History colour filter is 15 preset buckets (HISTORY_COLOURS) matched by LIKE token OR-groups against the color column
Expected location: finder src/auction-history-query.js (~lines 63-79)
Verify by: read HISTORY_COLOURS and its WHERE construction
Status: UNVERIFIED
Evidence:
Notes:

## C-029
Phase: 1
Type: FACT
Priority: P2
Claim: Colours without a preset bucket cannot be selected and are excluded from any colour-filtered search
Expected location: finder src/auction-history-query.js
Verify by: confirm filter only accepts bucket keys
Status: UNVERIFIED
Evidence:
Notes:

## C-032
Phase: 1
Type: FACT
Priority: P2
Claim: Drivetrain filter uses the priv column: 4wd matches tokens 4WD/AWD/4X4, 2wd matches everything else
Expected location: finder src/auction-history-query.js (~lines 33-35, 192-195)
Verify by: read the priv matching logic
Status: UNVERIFIED
Evidence:
Notes:

## C-033
Phase: 1
Type: FACT
Priority: P2
Claim: docs/auction-history.md recommends live-probing kpp/priv/eng_v/color columns on stats before enabling those filters
Expected location: finder docs/auction-history.md (~lines 59-70)
Verify by: read the doc section
Status: UNVERIFIED
Evidence:
Notes:

## C-034
Phase: 1
Type: GAP
Priority: P2
Claim: No "include unspecified" toggle exists for the inference-based filters
Expected location: finder src/auction-history.js, src/auction-history-query.js
Verify by: confirm absence in form and query builder
Status: UNVERIFIED
Evidence:
Notes:

## C-035
Phase: 1
Type: FACT
Priority: P2
Claim: Live "More filters" is a collapsed <details class="asrch-more"> containing only year from/to, max JPY price and min grade
Expected location: finder src/auction-ui.js (~lines 188-199)
Verify by: read the details block
Status: UNVERIFIED
Evidence:
Notes:

## C-036
Phase: 1
Type: FACT
Priority: P2
Claim: After a search runs, the whole live form folds behind an "Edit search" summary chip (asrch-fold)
Expected location: finder src/auction-ui.js (~lines 159-222)
Verify by: read the fold logic
Status: UNVERIFIED
Evidence:
Notes:

## C-037
Phase: 1
Type: FACT
Priority: P2
Claim: History advanced filters sit in a collapsed <details class="ahx-more"> 5-column grid that auto-opens when any ADVANCED_KEYS param is set
Expected location: finder src/auction-history.js (~lines 50, 143, 160-179)
Verify by: read the details block and ADVANCED_KEYS
Status: UNVERIFIED
Evidence:
Notes:

## C-038
Phase: 1
Type: FACT
Priority: P2
Claim: History renders active filters as removable chips (chipsRow)
Expected location: finder src/auction-history.js (~line 239)
Verify by: read chipsRow
Status: UNVERIFIED
Evidence:
Notes:

## C-039
Phase: 1
Type: FACT
Priority: P2
Claim: distinctGrades() exists, pulling distinct grade (trim/variant) strings per make/model/code from live+sold
Expected location: finder src/avtonet.js (~line 397)
Verify by: read distinctGrades
Status: UNVERIFIED
Evidence:
Notes:

## C-040
Phase: 1
Type: FACT
Priority: P2
Claim: distinctGrades feeds the staff sold-prices datalist and the /api/grades endpoint
Expected location: finder src/admin.js (~8097, 8121), src/index.js (~529)
Verify by: read both call sites
Status: UNVERIFIED
Evidence:
Notes:

## C-041
Phase: 1
Type: GAP
Priority: P2
Claim: The Live Auctions search UI never wires distinctGrades in (no trim/variant selector)
Expected location: finder src/auction-ui.js
Verify by: confirm no call/reference from live search form
Status: UNVERIFIED
Evidence:
Notes:

## C-042
Phase: 1
Type: FACT
Priority: P2
Claim: History uses a real COUNT(*) total and a numbered pager
Expected location: finder src/auction-history-query.js, src/auction-history.js
Verify by: read count query and pager rendering
Status: UNVERIFIED
Evidence:
Notes:

## C-043
Phase: 1
Type: FACT
Priority: P2
Claim: Live search has no true total count (renders "N lots+", prev/older paging only)
Expected location: finder src/auction-ui.js, src/avtonet.js
Verify by: confirm absence of COUNT and read pager markup
Status: UNVERIFIED
Evidence:
Notes:

## C-044
Phase: 1
Type: ACTION
Claim: Extract a shared filter form/validation engine and use it on both tabs
Expected location: finder src/
Verify by: -
Status: N/A
Evidence:
Notes:

## C-045
Phase: 1
Type: ACTION
Claim: Make auction grade a multi-select ordered R, RA, 2, 3, 3.5, 4, 4.5, 5, 6, S on both tabs
Expected location: finder src/
Verify by: -
Status: N/A
Evidence:
Notes:

## C-046
Phase: 1
Type: ACTION
Claim: Verify how grades 6 and S appear in the feed's rate column before wiring
Expected location: finder (feed data probe)
Verify by: -
Status: N/A
Evidence:
Notes:

## C-047
Phase: 1
Type: ACTION
Claim: Make auction house multi-select on both tabs (OR-group of LIKEs)
Expected location: finder src/
Verify by: -
Status: N/A
Evidence:
Notes:

## C-048
Phase: 1
Type: ACTION
Claim: Label inference filters "(as listed — may exclude incomplete listings)"
Expected location: finder src/
Verify by: -
Status: N/A
Evidence:
Notes:

## C-049
Phase: 1
Type: ACTION
Claim: Add an "include unspecified" toggle (default ON) to inference filters
Expected location: finder src/
Verify by: -
Status: N/A
Evidence:
Notes:

## C-050
Phase: 1
Type: ACTION
Claim: Probe structured feed columns (kpp/priv/eng_v/color) and use them where reliable
Expected location: finder
Verify by: -
Status: N/A
Evidence:
Notes:

## C-051
Phase: 1
Type: ACTION
Claim: Replace collapsed "More filters" details with always-visible pill-row layout, consistent across both tabs, chips retained
Expected location: finder src/
Verify by: -
Status: N/A
Evidence:
Notes:

## C-052
Phase: 1
Type: ACTION
Claim: Wire a per-make+model variant/trim selector (distinctGrades) into both search tabs
Expected location: finder src/
Verify by: -
Status: N/A
Evidence:
Notes:

## C-054
Phase: 2
Type: FACT
Priority: P2
Claim: Constants IMPORT_OVERHEAD_AUD=9000, ON_VALUE_TAX=1.13, MIN_CAR_VALUE_AUD=2000 are defined in src/calc.js
Expected location: finder src/calc.js
Verify by: read the constant definitions
Status: UNVERIFIED
Evidence:
Notes:

## C-056
Phase: 2
Type: FACT
Priority: P2
Claim: Live auction cards show no landed cost — only JPY price and a bare A$ conversion (priceLine)
Expected location: finder src/auction-ui.js (~lines 50-58, 82-143)
Verify by: read auctionCardV2 and priceLine
Status: UNVERIFIED
Evidence:
Notes:

## C-057
Phase: 2
Type: FACT
Priority: P2
Claim: attachLanded() batches calculator calls with bounded concurrency (default 6), reading settings once per batch
Expected location: finder src/calc.js (~202-215)
Verify by: read attachLanded
Status: UNVERIFIED
Evidence:
Notes:

## C-058
Phase: 2
Type: FACT
Priority: P2
Claim: audBudgetToYen() converts an AUD budget to a JPY auction-price ceiling as a matcher soft filter
Expected location: finder src/calc.js
Verify by: read audBudgetToYen and matcher usage
Status: UNVERIFIED
Evidence:
Notes:

## C-059
Phase: 2
Type: FACT
Priority: P2
Claim: FX rate is live-fetched from api.frankfurter.app, cached 6h, with CALC_FX fallback (default 95) and settings override
Expected location: finder src/calc.js (~57)
Verify by: read getLiveFx
Status: UNVERIFIED
Evidence:
Notes:

## C-060
Phase: 2
Type: GAP
Priority: P2
Claim: No settings-tunable bias exists to aim the landed estimate 5-10% under actuals
Expected location: finder src/calc.js, src/settings.js
Verify by: confirm absence of a bias/adjustment setting
Status: UNVERIFIED
Evidence:
Notes:

## C-061
Phase: 2
Type: ACTION
Claim: Route History rows and Live cards through the real calculator API; keep rough formula only as placeholder/soft filter
Expected location: finder src/
Verify by: -
Status: N/A
Evidence:
Notes:

## C-062
Phase: 2
Type: ACTION
Claim: Back-test landed estimates against actual completed imports and add a tunable bias
Expected location: finder
Verify by: -
Status: N/A
Evidence:
Notes:

## C-063
Phase: 2
Type: ACTION
Claim: Bring Live card information density up to History's; review lot detail fields with the owner
Expected location: finder src/
Verify by: -
Status: N/A
Evidence:
Notes:

## C-067
Phase: 3
Type: FACT
Priority: P2
Claim: The 0013 migration header comment explicitly flags the naming collision with clients.category='dealer'
Expected location: finder migrations/0013_dealer_system.sql
Verify by: read the header comment
Status: UNVERIFIED
Evidence:
Notes:

## C-075
Phase: 3
Type: FACT
Priority: P2
Claim: Admin sidebar labels clients as "Customers", wishlists as "Requests", dealers as "Dealers", dealer_vehicles as "Dealer stock"
Expected location: finder src/admin.js (~lines 985-994)
Verify by: read sidebar nav markup
Status: UNVERIFIED
Evidence:
Notes:

## C-082
Phase: 3
Type: FACT
Priority: P2
Claim: agents is a separate table for internal staff logins (email, pass_hash, alerts, company)
Expected location: finder migrations/0001_baseline.sql
Verify by: read schema
Status: UNVERIFIED
Evidence:
Notes:

## C-083
Phase: 3
Type: ACTION
Claim: Evolve clients into users with type + tier columns, backfilling from category/source/member
Expected location: finder migrations/
Verify by: -
Status: N/A
Evidence:
Notes:

## C-084
Phase: 3
Type: ACTION
Claim: Fold portal dealer accounts into users (type='dealer') keeping PBKDF2 auth working
Expected location: finder + jdm-dealer-portal
Verify by: -
Status: N/A
Evidence:
Notes:

## C-085
Phase: 3
Type: ACTION
Claim: Rename the finder's seller dealers table (e.g. suppliers) to remove the three-way name collision
Expected location: finder migrations/
Verify by: -
Status: N/A
Evidence:
Notes:

## C-086
Phase: 3
Type: ACTION
Claim: Terminology sweep — wishlists to searches, UI labels Customers to Users and Requests to Searches, one cutover
Expected location: finder src/ + migrations/
Verify by: -
Status: N/A
Evidence:
Notes:

## C-087
Phase: 3
Type: ACTION
Claim: Build a tabbed admin Users view (fully managed / free tier / dealers) driven by type + tier
Expected location: finder src/admin.js
Verify by: -
Status: N/A
Evidence:
Notes:

## C-088
Phase: 3
Type: ACTION
Claim: Review the merged requests-customers-unify branch for prior art before starting
Expected location: finder (git)
Verify by: -
Status: N/A
Evidence:
Notes:

## C-089
Phase: 4
Type: FACT
Priority: P2
Claim: Global settings keys include send_to_client, free_auto_send, whatsapp_enabled, whatsapp_provider, email_alerts, client_landed, request_alerts, membership_enabled, run_includes_free, free_search_limit, free_result_limit, dealer_portal_enabled, budget_filter
Expected location: finder src/settings.js (DEFAULTS)
Verify by: read DEFAULTS object
Status: UNVERIFIED
Evidence:
Notes:

## C-090
Phase: 4
Type: FACT
Priority: P2
Claim: free_auto_send is decided OFF by default per code comment
Expected location: finder src/settings.js
Verify by: read default and comment
Status: UNVERIFIED
Evidence:
Notes:

## C-091
Phase: 4
Type: FACT
Priority: P2
Claim: free_result_limit is marked "reserved, not yet enforced"
Expected location: finder src/settings.js (or usage sites)
Verify by: read comment; confirm no enforcement code
Status: UNVERIFIED
Evidence:
Notes:

## C-092
Phase: 4
Type: FACT
Priority: P2
Claim: agents.alerts gates whether an agent receives the digest email
Expected location: finder src/index.js (~line 1974)
Verify by: read the skip condition
Status: UNVERIFIED
Evidence:
Notes:

## C-097
Phase: 4
Type: FACT
Priority: P2
Claim: WhatsApp delivery is best-effort and non-blocking — on failure the email still sends
Expected location: finder src/notify.js
Verify by: read the try/fallback around WhatsApp send
Status: UNVERIFIED
Evidence:
Notes:

## C-098
Phase: 4
Type: FACT
Priority: P2
Claim: deliverToClient / deliverManyToClient in src/notify.js (~194, ~236) send the client match emails
Expected location: finder src/notify.js
Verify by: read both functions
Status: UNVERIFIED
Evidence:
Notes:

## C-099
Phase: 4
Type: FACT
Priority: P2
Claim: Email provider is Resend via sendEmail() (notify.js ~45), requiring RESEND_API_KEY, with MAIL_DRY_RUN support
Expected location: finder src/notify.js
Verify by: read sendEmail
Status: UNVERIFIED
Evidence:
Notes:

## C-100
Phase: 4
Type: FACT
Priority: P2
Claim: sendPush() provides operator-only push (Pushover/Telegram/ntfy) for signups, payments, share-link interest
Expected location: finder src/notify.js (~89)
Verify by: read sendPush and call sites
Status: UNVERIFIED
Evidence:
Notes:

## C-101
Phase: 4
Type: DECISION
Claim: Skip SMS; offer email + WhatsApp as the delivery channel choices
Expected location: -
Verify by: -
Status: N/A
Evidence:
Notes: Recommended in plan; awaiting owner confirmation.

## C-102
Phase: 4
Type: ACTION
Claim: Add per-user flags: email_results, delivery_channel, match_notifications, portal_enabled
Expected location: finder migrations/ + src/
Verify by: -
Status: N/A
Evidence:
Notes:

## C-103
Phase: 4
Type: ACTION
Claim: Rework notify.js to read per-user prefs first, with globals as kill-switches only
Expected location: finder src/notify.js
Verify by: -
Status: N/A
Evidence:
Notes:

## C-105
Phase: 5
Type: FACT
Priority: P2
Claim: The scheduled handler runs expirePast, autoFollowUps, then runMatcher
Expected location: finder src/index.js (~217-221)
Verify by: read scheduled()
Status: UNVERIFIED
Evidence:
Notes:

## C-106
Phase: 5
Type: FACT
Priority: P2
Claim: POST /run exists and is session-scoped — agents run their own clients' searches, admin runs everything
Expected location: finder src/index.js (~1116-1127), src/matcher.js
Verify by: read the route and runMatcher scoping
Status: UNVERIFIED
Evidence:
Notes:

## C-107
Phase: 5
Type: FACT
Priority: P2
Claim: /run is POST-only with a same-origin check
Expected location: finder src/index.js
Verify by: read the guard
Status: UNVERIFIED
Evidence:
Notes:

## C-110
Phase: 5
Type: FACT
Priority: P2
Claim: The public request form is limited to 8/hr per IP and 6/hr per contact
Expected location: finder src/index.js (~60)
Verify by: read REQ_RL_IP / REQ_RL_CONTACT
Status: UNVERIFIED
Evidence:
Notes:

## C-111
Phase: 5
Type: DECISION
Claim: Keep cron at 4x/day or drop to 3x/day (0 */8 * * *)
Expected location: finder wrangler.toml
Verify by: -
Status: N/A
Evidence:
Notes: Awaiting owner choice.

## C-112
Phase: 5
Type: ACTION
Claim: Expose per-search manual trigger — staff POST /admin/run-search/:id and a rate-limited portal button
Expected location: finder src/
Verify by: -
Status: N/A
Evidence:
Notes:

## C-114
Phase: 6
Type: FACT
Priority: P2
Claim: DEALER_VEHICLE_LIMITS enforces server-side field caps (length caps, year 1950-2035, numeric ranges)
Expected location: finder src/admin.js (~8682)
Verify by: read the limits object and enforcement
Status: UNVERIFIED
Evidence:
Notes:

## C-117
Phase: 6
Type: DECISION
Claim: Submission quotas — free 1/week, $50 tier 2/week, fully managed unlimited
Expected location: -
Verify by: -
Status: N/A
Evidence:
Notes: Starting numbers proposed; awaiting owner confirmation.

## C-118
Phase: 6
Type: ACTION
Claim: Build a submitted_units review queue keyed by user_id with an "Ask us about this lot" portal action
Expected location: finder src/ + migrations/
Verify by: -
Status: N/A
Evidence:
Notes:

## C-119
Phase: 6
Type: ACTION
Claim: Enforce per-tier quotas server-side (D1 count per window + KV IP limiter), tunable via settings
Expected location: finder src/
Verify by: -
Status: N/A
Evidence:
Notes:

## C-120
Phase: 6
Type: ACTION
Claim: Add admin review queue view with approve/respond actions and a submissions-per-day workload counter
Expected location: finder src/admin.js
Verify by: -
Status: N/A
Evidence:
Notes:

## C-123
Phase: 7
Type: FACT
Priority: P2
Claim: The finder calls the calculator API directly from the Worker with an allow-listed Origin header and env.CALC_API override
Expected location: finder src/calc.js
Verify by: read the fetch call
Status: UNVERIFIED
Evidence:
Notes:

## C-124
Phase: 7
Type: FACT
Priority: P2
Claim: The dealer portal has a thin same-origin proxy at functions/api/calc.js forwarding to jdm-calculator.pages.dev
Expected location: jdm-dealer-portal functions/api/calc.js
Verify by: read the proxy
Status: UNVERIFIED
Evidence:
Notes:

## C-125
Phase: 7
Type: FACT
Priority: P2
Claim: Calc payload fields are jpyPrice, fxRate, vehicleSizeIdx, destinationPort, regState, includeOnRoad, includeDelivery, includeDaff, isFuelEfficient, bmsbSeason, isNonJapanOrigin, complianceCost, agencyFee
Expected location: finder src/calc.js
Verify by: read the payload construction
Status: UNVERIFIED
Evidence:
Notes:

## C-126
Phase: 7
Type: FACT
Priority: P2
Claim: STATE_TO_PORT maps WA-Fremantle, VIC/TAS-Melbourne, QLD-Brisbane, NSW/ACT-Port Kembla, SA-Adelaide, NT-Fremantle
Expected location: finder src/calc.js
Verify by: read the map
Status: UNVERIFIED
Evidence:
Notes:

## C-127
Phase: 7
Type: FACT
Priority: P2
Claim: Consumed calculator outputs are grandTotal, landedAtPort, purchaseAUD, activeLineName
Expected location: finder src/calc.js
Verify by: read response handling
Status: UNVERIFIED
Evidence:
Notes:

## C-128
Phase: 7
Type: FACT
Priority: P2
Claim: No literal "EBS" reference exists anywhere in the local codebase
Expected location: all local repos
Verify by: case-insensitive grep for EBS
Status: UNVERIFIED
Evidence:
Notes: EBS may live only in the archived calculator source.

## C-129
Phase: 7
Type: FACT
Priority: P2
Claim: Admin Settings "Landed cost assumptions" edits calc_compliance_aud, calc_agency_aud, calc_fx_jpy_aud without redeploy
Expected location: finder src/admin.js (~1599), src/settings.js
Verify by: read the settings section and DEFAULTS
Status: UNVERIFIED
Evidence:
Notes:

## C-130
Phase: 7
Type: FACT
Priority: P2
Claim: Compliance/agency values fall back to env CALC_COMPLIANCE / CALC_AGENCY, then hardcoded defaults 4000 / 0
Expected location: finder src/calc.js (landedConfig)
Verify by: read landedConfig
Status: UNVERIFIED
Evidence:
Notes:

## C-132
Phase: 7
Type: FACT
Priority: P2
Claim: portal public/auction-search.html is a static design spec (not live functionality) documenting a planned "Quote landed cost" deep-link
Expected location: jdm-dealer-portal public/auction-search.html
Verify by: read the file; confirm it is not routed/live
Status: UNVERIFIED
Evidence:
Notes:

## C-134
Phase: 7
Type: ACTION
Claim: Un-archive/clone the calculator, restore it to the active fold, fix the custom-domain DNS
Expected location: calc-repo
Verify by: -
Status: N/A
Evidence:
Notes:

## C-135
Phase: 7
Type: ACTION
Claim: Move calculator pricing tables into admin-editable config (EBS per shipping line, agency fee, compliance, DAFF)
Expected location: calc-repo + finder src/admin.js
Verify by: -
Status: N/A
Evidence:
Notes:

## C-136
Phase: 7
Type: ACTION
Claim: Build customer (simplified), dealer (preset) and internal (expanded) calculator modes with per-user-type profiles
Expected location: calc-repo + finder
Verify by: -
Status: N/A
Evidence:
Notes:

## C-137
Phase: 7
Type: ACTION
Claim: Embed the calculator in the portal; hook the internal version into auction search and price history
Expected location: finder src/ + jdm-dealer-portal
Verify by: -
Status: N/A
Evidence:
Notes:

## C-138
Phase: 8
Type: FACT
Priority: P2
Claim: extract_variants.py is a deterministic, extractive-only engine (EXTRACT_VERSION=3, enforced by _assert_extractive)
Expected location: elig scripts/extract_variants.py
Verify by: read the version constant and assertion
Status: UNVERIFIED
Evidence:
Notes:

## C-139
Phase: 8
Type: FACT
Priority: P2
Claim: The extractor runs standalone or is auto-invoked at the end of each scraper snapshot
Expected location: elig scripts/
Verify by: read the scraper's post-snapshot hook
Status: UNVERIFIED
Evidence:
Notes:

## C-140
Phase: 8
Type: FACT
Priority: P2
Claim: variant_overrides.json contains only a _comment and one _example entry — no real overrides
Expected location: elig scripts/data/variant_overrides.json
Verify by: read the file
Status: UNVERIFIED
Evidence:
Notes:

## C-141
Phase: 8
Type: FACT
Priority: P2
Claim: variant_review_queue.csv has 82 flagged rows (83 lines) and is unworked
Expected location: elig scripts/data/variant_review_queue.csv
Verify by: count lines
Status: UNVERIFIED
Evidence:
Notes:

## C-142
Phase: 8
Type: FACT
Priority: P2
Claim: test_variant_extraction.py exists and exercises the extraction rules
Expected location: elig scripts/test_variant_extraction.py
Verify by: read the test file
Status: UNVERIFIED
Evidence:
Notes:

## C-144
Phase: 8
Type: FACT
Priority: P2
Claim: Eligibility data is served via a gated Pages Function (functions/api/data.js — origin/referer/rate-limit), not a public data.json
Expected location: elig functions/api/data.js
Verify by: read the gating
Status: UNVERIFIED
Evidence:
Notes:

## C-145
Phase: 8
Type: FACT
Priority: P2
Claim: Display enrichment fields _display_variant / _display_model_code / _display_engine are written by the Python extractor and consumed by the UI
Expected location: elig scripts/extract_variants.py + index.html
Verify by: read producer and consumer
Status: UNVERIFIED
Evidence:
Notes:

## C-147
Phase: 8
Type: ACTION
Claim: Work the 82-row review queue, skipping non-eligible listings
Expected location: elig scripts/data/
Verify by: -
Status: N/A
Evidence:
Notes:

## C-148
Phase: 8
Type: ACTION
Claim: Build the simpler consumer-facing MMV view alongside the existing power view
Expected location: elig
Verify by: -
Status: N/A
Evidence:
Notes:

## C-149
Phase: 8
Type: ACTION
Claim: Expose the cleaned MMV dataset for the landing page and finder to consume
Expected location: elig + finder
Verify by: -
Status: N/A
Evidence:
Notes:

## C-150
Phase: 9
Type: FACT
Priority: P2
Claim: jdm-bridge is a static single-page site (index.html, styles.css, script.js) with no framework or build step
Expected location: bridge
Verify by: list files; check for package.json/build config
Status: UNVERIFIED
Evidence:
Notes:

## C-152
Phase: 9
Type: GAP
Priority: P2
Claim: jdm-bridge has no eligibility or calculator embed (no iframe/embed/jdmconnect references)
Expected location: bridge index.html, script.js
Verify by: grep for eligibility|calculator|iframe|embed|jdmconnect
Status: UNVERIFIED
Evidence:
Notes:

## C-155
Phase: 9
Type: DECISION
Claim: Landing page host — jdm-bridge vs a page on the finder domain
Expected location: -
Verify by: -
Status: N/A
Evidence:
Notes: Awaiting owner choice.

## C-156
Phase: 9
Type: ACTION
Claim: Build the combined lead-qualification page (Finder + Eligibility + Calculator)
Expected location: bridge or finder (per C-155)
Verify by: -
Status: N/A
Evidence:
Notes:

## C-157
Phase: 9
Type: ACTION
Claim: Implement eligibility-first lead flow (25-year rule + embedded simplified eligibility search)
Expected location: landing page host
Verify by: -
Status: N/A
Evidence:
Notes:

## C-158
Phase: 9
Type: ACTION
Claim: Build a scheduled job precomputing price ranges for eligible MMV from the stats table into a summary table
Expected location: finder
Verify by: -
Status: N/A
Evidence:
Notes:

## C-159
Phase: 9
Type: ACTION
Claim: Validate the price-range algorithm against known models before it gates leads
Expected location: finder
Verify by: -
Status: N/A
Evidence:
Notes:

## C-160
Phase: -
Type: DECISION
Claim: Lead funnel and New Pricing Model are handled separately, out of this plan's scope
Expected location: -
Verify by: -
Status: N/A
Evidence:
Notes:

## C-161
Phase: -
Type: DECISION
Claim: Content production (testimonials, videos) is out of scope except leaving embed slots on the landing page
Expected location: -
Verify by: -
Status: N/A
Evidence:
Notes:

# New claims (appended by audit loop — adjacent findings not accounted for in PLAN.md)

## C-NEW-162
Phase: 6
Type: FACT
Priority: P1
Claim: A member-facing "ask us about this lot" flow already exists — Request-bid buttons on the lot page, search cards and watchlist POST /portal/auctions/request, which queues the lot as a pending client_request and pushes staff — so Phase 6's C-118 reduces to extending this to other tiers plus quotas
Expected location: finder src/admin.js (requestAuctionLot ~7759, buttons ~6206/~7726), src/index.js (~1681), src/auction-ui.js (~317)
Verify by: read requestAuctionLot and the three button surfaces; confirm member gating and queue insert
Status: UNVERIFIED
Evidence:
Notes: Found while verifying C-116 (now REFUTED on this basis; pointer evidence there: admin.js:7778-7780 INSERT INTO queue ... 'pending', client_request 1, reason 'Direct request from auction search'; index.js:1683 member gate; index.js:1687 staff push). PLAN.md Phase 6 does not mention this mechanism; a fresh loop pass should confirm the citations at baseline f414a2d.

## C-NEW-163
Phase: 7
Type: FACT
Priority: P1
Claim: The finder's production config points CALC_API at calculator.jdmconnect.com.au — the custom domain whose DNS broke when the zone moved Cloudflare accounts — so if that DNS is still broken, every finder landed estimate (estimateLanded/attachLanded) silently returns null in production while the dealer portal keeps working via its pages.dev proxy
Expected location: finder wrangler.toml (~82 CALC_API), src/calc.js (~156 default + ~177-179 catch→null); jdm-dealer-portal functions/api/calc.js:8-13 (the workaround the finder lacks)
Verify by: read wrangler.toml CALC_API and the estimateLanded error path; live-probe calculator.jdmconnect.com.au vs jdm-calculator.pages.dev (manual/deferred)
Status: REFUTED
Evidence: live probe 22 Jul 2026: POST https://calculator.jdmconnect.com.au/api/calc with the Origin header calc.js:160 sends → HTTP 200 in 0.26s; same request without Origin → 403 (origin gate working); GET / → 200; DNS resolves to Cloudflare
Notes: Found while verifying C-121/C-122; the config facts stand (wrangler.toml:82 pins the custom domain) but the feared consequence does not: the custom domain is healthy, so finder landed estimates are NOT silently nulling on DNS grounds, and Phase 7 does not need to precede Phase 2. The portal comment describing the DNS break is stale — see C-122 Notes. Probe used an empty payload (correctly returned calc:null); realistic-payload sanity check tracked as C-NEW-165.

## C-NEW-164
Phase: 7
Type: FACT
Priority: P1
Claim: The dealer portal dashboard already embeds a working landed-cost calculator UI (shipping-line select, toggles, debounced recalc POSTing /api/calc through the same-origin proxy) — so Phase 7's C-137 "Embed the calculator in the portal" is partially done and should be rescoped to the finder/member surfaces
Expected location: jdm-dealer-portal public/index.html (~399 shipping-line select, ~1610-1622 scheduleRecalc/recalc → fetch('/api/calc'), ~2454-2458 calcToggles), functions/api/calc.js (proxy)
Verify by: read the calc section of public/index.html and confirm it is live (not a static spec like auction-search.html)
Status: UNVERIFIED
Evidence:
Notes: Found while verifying C-133. Pointer evidence: public/index.html:1619 "const r = await fetch('/api/calc', { method: 'POST' ...". Distinct from C-132's auction-search.html (a static design spec); index.html is the portal's real dashboard. A loop pass should confirm the embed renders for logged-in dealers at baseline 10f3d2f.

## C-NEW-165
Phase: 7
Type: FACT
Priority: P2
Claim: A realistic-payload calc probe returns sane end-to-end landed figures (grandTotal/landedAtPort/purchaseAUD) — the 22 Jul 2026 reachability probe used an empty payload, which correctly returned calc:null, so correctness of actual calculations remains unproven
Expected location: live https://calculator.jdmconnect.com.au/api/calc (probe with a realistic payload per finder src/calc.js:138-153)
Verify by: POST a realistic payload (jpyPrice, fxRate, vehicleSizeIdx, destinationPort, regState, toggles, complianceCost, agencyFee) with the allowed Origin; check calc.grandTotal is finite, positive and plausible
Status: UNVERIFIED
Evidence:
Notes: Follow-up to the C-NEW-163 probe: reachable ≠ correct. An empty payload exercising the null path proves the endpoint is up and origin-gated, not that pricing tables and totals behave. Relevant before Phase 2 leans on estimateLanded output.
