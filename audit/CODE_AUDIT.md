# CODE_AUDIT — jdm-vehicle-finder

**Date:** 21 Jul 2026 · **Branch:** `main` · **Scope:** read-only audit, no code changed.

**How this was produced:** `npx knip` (unused files/exports/deps), `npx depcheck`, `npx madge --circular`, a real build (`npx wrangler deploy --dry-run --outdir …`), the full test suite (`npm test`), plus manual verification of every tool finding by grepping for references. Nothing below is asserted from a file name alone.

**Baseline health signals**

| Check | Result |
|---|---|
| Build (`wrangler deploy --dry-run`) | ✅ Clean, no warnings. Worker bundle 1,052 KiB raw / **299 KiB gzipped** (~25× headroom vs Cloudflare's 3 MB free-tier limit) |
| Tests (`npm test`) | ✅ **544/544 pass** in ~1.7 s (84 test files + 1 shared D1 helper; one harmless stderr line where a live-feed fetch degrades in the test env) |
| Circular dependencies (madge) | ✅ None. All 26 `src/` modules reachable from `src/index.js` — no orphaned modules |
| Unused dependencies (depcheck/knip) | ✅ None (see §2) |
| TODO/FIXME/HACK markers in `src/` | ✅ Zero |
| Commented-out code blocks | ✅ None found (heuristic hits were all real documentation comments) |
| Backup/old/copy/temp-named files | ✅ None |
| Stray `console.log` | ✅ Only intentional ops logging in `src/notify.js` (visible via `wrangler tail`) — 4 sites, all deliberate |
| Uncommitted work | ⚠️ `package.json` modified (adds `avg` script) + untracked `scripts/avg-sold.mjs`, `ben-notes-v12-status.html`, `Finder Site Notes V1.2 - Status.pdf` |

---

## 1. Dead code

The codebase is unusually clean for its build history. All knip findings were manually verified against `src/`, `test/`, `scripts/`, and `e2e/` — none are used anywhere, including tests.

### 1a. Fully dead symbols (no caller anywhere, not even inside their own file)

| Symbol | Location | Note |
|---|---|---|
| `parseSheetResponse` | `src/sheet.js:205` | Dead function — never called anywhere |
| `MAIN_COLUMNS` | `src/avtonet.js:13` | Dead constant — only a prose mention in `docs/auction-history.md` |
| `LINEUP` | `src/landing-data.js:52` | Orphaned static lineup data — `landing.js` imports its 8 siblings but not this |
| `lineupCard` | `src/landing.js:320-355` | Dead renderer paired with `LINEUP` — superseded by `liveLineup()`/`liveCard()` (live feed). Remove both together |
| `aud` | `src/render.js:38` | Dead JPY→AUD estimator using hardcoded `JPY_AUD = 0.0103` — superseded by the live-FX pipeline in `calc.js`. (Test matches for "aud" are the currency-code literal, not this function) |
| `engagementCell` | `src/admin.js:2613-2618` | Documented helper ("Powers the Requests 'Examples' column") that nothing invokes — feature cut, helper left behind |
| `validDeposit` | `src/admin.js:2954` | Dead; its siblings `DEPOSIT_LABELS`/`depositBadge` are alive |
| `clampMin` | `src/admin.js:7631` | Dead; sibling `clampRange` on the next line is used |

### 1b. Dead *exports* (code is used internally; the `export` keyword is superfluous)

These aren't dead code — they're internal helpers/constants whose export nothing imports. Removing the `export` keyword shrinks the public surface and keeps knip honest:

- `src/assets.js:3` — `LOGO_GOLD_PNG_B64` (used by `logoPngBytes()` internally)
- `src/auction-history-query.js:11,13,35,93` — `HISTORY_PER_PAGE`, `HISTORY_MAX_PAGE`, `PRIV_4WD_TOKENS`, `ELIGIBLE_MIN_AGE_YEARS`
- `src/auth.js:145,207,305` — `verifyPassword`, `passwordValid`, `currentSessionVer`
- `src/avtonet.js:91` — `parseRows`
- `src/calc.js:185` — `landedConfig`
- `src/request-wizard.js:17` — `POPULAR`
- `src/theme.js:15,58,373` — `FONT`, `themeCss`, `escHtml`

### 1c. Routes and views — no zombies

Every `*View`/`*Page` function in `src/admin.js` has a live call site (verified against `adminPage()`'s view dispatch and `index.js` imports). The `portalSoldPage`/`wishlistsView` removals from the UX overhaul were clean; `/portal/sold` (`src/index.js:1577-1588`) is now a pure 301 shim, intentionally kept for bookmarks.

### 1d. Semi-orphaned script

- `scripts/optimize-landing-images.mjs` — knip calls it an unused file; it's actually the documented tool for regenerating landing WebP images, but it has **no npm script entry** and no README mention (only a comment in `src/landing.js:43`). Add an `images:optimize` script or README pointer so it stays discoverable.

## 2. Unused dependencies

**None.** `package.json` declares exactly two devDependencies (`wrangler`, `puppeteer-core`), both used. There are no runtime dependencies at all — the app is dependency-free vanilla JS, which is a genuine strength.

Two small gaps:
- `sharp` is used by `scripts/optimize-landing-images.mjs` but not declared anywhere (works today only via ad-hoc install/npx). Declare it as a devDependency or document the `npx` invocation.
- `scripts/avg-sold.mjs` is wired into `package.json` (`npm run avg`) but **untracked in git** — a fresh clone would fail. Commit it (or drop the script entry).

## 3. Duplication

### 3a. Two-and-a-half parallel CSS design systems (the biggest duplication)

| System | Location | Size | Serves |
|---|---|---|---|
| `CSS` (+ `GOOGLE_BTN_CSS`, `DASH2_CSS`, `REQ_CSS`, `RD_CSS`) | `src/admin.js:215-917` etc. | ~63.5 KB | Admin panel |
| `themeCss` | `src/theme.js:58-369` | ~27.7 KB | Customer-facing pages (login, wizard, portal, legal) |
| `landingCss` | `src/landing-css.js:12-420` | ~31.9 KB | Public landing page |
| `AUCTION_CSS` | `src/auction-ui.js:342` | ~11.1 KB | Auction browsing UI (shared into both surfaces) |

`admin.js` `CSS` and `theme.js` `themeCss` share **91 class names** (`.btn-primary`, `.btn-secondary`, `.card`, `.chip`, `.pill`, …) whose rule bodies have **already drifted** — e.g. `.btn-primary` is `padding:12px 24px; color:var(--gold-on); font-weight:600` in admin (`admin.js:332`) vs `padding:12px 22px; color:#15120A; font-weight:700` in theme (`theme.js:176`). They even use different token vocabularies (`--r-ctl`/`--fs-sec`/`--sp-5` vs `--radius`/hardcoded values). The team already knows this is a defect source: `test/render-sweep.test.mjs:5-6` exists specifically to catch cross-system class mismatches. That test is a good tourniquet, but the underlying duplication remains.

### 3b. HTML escaping — 4 implementations, 2 avoidable

- `src/render.js:30` `esc()` — the canonical server-side escaper (imported by 6 files)
- `src/theme.js:373` `escHtml()` — self-described mirror of `render.esc` "so this module has no import cycle" (also escapes `'`, so they're not even identical)
- `src/auction-ui.js:295` and `src/request-wizard.js:441` — inline client-side copies inside `<script>` strings (**unavoidable** — browser code can't import Worker modules; note the wizard copy doesn't escape `"`)

The render/theme pair could share a dependency-free `escape.js` leaf module.

### 3c. Four things named `aud`

`render.js:38` (dead, hardcoded rate), `admin.js:1059` (Stripe cents formatter), `auction-ui.js:56` (live-FX JPY→AUD display), `request-wizard.js:415` (`fmtAud`, client-side). Different purposes, same name — a collision hazard rather than copy-paste, but it shows no canonical money formatter was ever chosen.

### 3d. Duplicate local `FONT` constants

`theme.js:15`, `admin.js:213`, and `render.js:17` each define their own `FONT` with different values.

### 3e. What is *not* duplicated (good news)

- The auction-history renderer is properly shared: one `auctionHistoryContent(env, params, surface)` (`src/auction-history.js:317`) serves both the member page and the admin tab via `HISTORY_SURFACES` — no forked markup.
- Pagination and the D1-over-HTTP `query()` helper each have exactly one implementation.

## 4. Leftover cruft

Source-level cruft is nearly absent (zero TODOs, no commented-out code, no backup files). The cruft lives in the **repo root as markdown**, all last touched ≥7 days ago:

### Stale one-off AI-session reports (13 files, safe to delete or archive)

- **Dealer feature — 6 docs for one feature, 5 committed the same day (2026-07-07):** `DEALER-REDESIGN.md` (spec, shipped), `DEALER_FEATURE.md`, `DEALER_SYSTEM_COMPLETE.md`, `IMPLEMENTATION_COMPLETE.md`, `DEPLOYMENT_SUMMARY.md` (four overlapping "it's done" reports), and `DEALER_SYSTEM_GUIDE.md` (the only one with lasting operational value — keep or merge into `USER-GUIDE.md`).
- **Commit-pinned audits whose line numbers are guaranteed stale:** `ADMIN-REDESIGN.md` (scoped to commit `eac40b8`), `COLOUR-AUDIT.md`, `DESIGN-AUDIT.md`, `IA-AUDIT.md`.
- **Session work-orders/changelogs:** `FINDER-V12-FIXES.md`, `FINDER-V13-FIXES.md`, `FINDER-V13-VERIFICATION.md` (keep this one accessible — it documents rollback steps), `CHANGES_SUMMARY.md`, `WEBSITE_CHANGES.md` (whose own header admits it's a reconstruction of a doc that went missing — doc sprawl already caused confusion once).

### Living docs (keep)

`README.md`, `QA.md`, `USER-GUIDE.md`, `docs/auction-history.md` (cross-referenced from code), `migrations/README.md`, `seed/README.md`.

### Other cruft

- `docs/stage0-cleanup-plan.md` — proposes two live-DB cleanups, explicitly "neither has been run", dormant since 25 Jun. Either run them or delete the doc; right now it's an unowned TODO.
- `docs/web-interface-audit.md` — line-number-pinned audit of a July-1 branch; self-admits drift. Stale.
- `docs/JDM-Connect-User-Guide.pdf` — 4.1 MB binary in git, possibly diverged from `USER-GUIDE.md` (both claim to be the user guide).
- **Untracked local files:** `ben-notes-v12-status.html` + `Finder Site Notes V1.2 - Status.pdf` (see §9 — the PDF is a credential-exposure artifact, not mere clutter), `UX-AUDIT.md` (correctly gitignored for PII, but still sitting in the root).
- `migrations/legacy/` (11 SQL files) — intentional, clearly documented "do not re-run" archive. **Not cruft.**
- The sibling worktree `c:\Users\jatec\Projects\jdm-finder-v13` is fully merged and removable (`git worktree remove ../jdm-finder-v13`).

## 5. Architecture

**Actual structure and flow:** a single Cloudflare Worker. `src/index.js` (2,175 lines) receives every request, does session/CSRF/rate-limit checks, and dispatches through ~90 sequential `if (path === "…")` branches to handler functions in the other 25 flat `src/` files. Handlers run D1 queries directly (no data-access layer), build complete HTML strings, and `index.js`'s `doc()` wraps them in a `Response` with security headers. A 6-hourly cron runs expiry, follow-ups, and the auction matcher. There is no client framework — pages ship inline `<style>` and `<script>` strings.

**The one clean boundary:** `index.js` genuinely contains no HTML and no D1 — it is routing + middleware only. That separation is real and respected.

**The problem is `src/admin.js`: 631 KB, 8,644 lines, 191 top-level functions** — views, inline-`<script>` generators, direct D1 CRUD (`createClient`, `deleteClient`, `bulkAllocate`…), access-control helpers (`clientAccessibleBy`, `accessScope`), and UI atoms all in one file, with `index.js` importing 60+ names from it in a single statement. Where a client is deleted (`admin.js:6754`) and where the delete button is drawn (`admin.js:2385`) live in the same 8,644-line haystack. It uses `env.DB.prepare(…)` 218 times with no shared wrapper. This is the single biggest maintainability problem in the repo — a mini-monolith inside an otherwise thin Worker.

**Naming friction:**
- `auction-ui.js` (live search) vs `auction-history.js` (sold results page) vs `auction-history-query.js` (its SQL layer) — nothing in the names signals which is which.
- The landing page is split 4 ways (`landing.js` / `landing-css.js` / `landing-data.js` / `landing-motion.js`) — a convention no other page follows.
- "Where do I change the accent gold?" has three candidate files (`theme.js`, `landing-css.js`, `admin.js`).
- `portal-shell.js` is a 22-line module that exists solely to break an import cycle for one shared sidebar function (self-documented; a symptom of the admin.js↔auction-history coupling).

## 6. Overengineering

**This codebase's failure mode is under-abstraction, not overengineering.** There is no ORM, no DI, no plugin system, no config framework, zero runtime dependencies. The few flags found:

- The 4-file landing-page split is more separation than one mostly-static page needs, and it's a one-off pattern.
- `index.js`'s three portal blocks (`handleClientPortal`, `handleDealerPortal`, admin) each re-implement the same act-then-redirect quick-action pattern inline.
- `db-seed-managed.yml` is a single-use July-2026 data import dressed up as a permanent GitHub Actions workflow (see §8).
- The `dealer_portal_enabled` flag is intentional (feature ships hidden by design) and implemented as a plain settings row — appropriately lightweight, **not** flagged.

The flip side: the 631 KB `admin.js` and the ~90-branch if-chain router are "simplicity" that has outgrown itself.

## 7. Performance smells

Calibrated for a low-traffic tool with one public page. Nothing is near a platform limit (bundle at ~10% of the free-tier cap; D1 usage is disciplined — nearly every list query has a `LIMIT`, multi-row writes use `env.DB.batch()`, `JSON.parse` of lot blobs is memoized, the FX rate is cached at isolate scope for 6 h).

Findings that actually matter, in order:

1. **Every HTML response inlines its full CSS/JS chrome and is served `Cache-Control: no-store`** (`src/index.js:2221-2224` applies `no-store` unconditionally via `doc()`). Admin pages re-send ~87 KB of fixed shell (63.5 KB `CSS` + drawer/uxGuard/tableTools/reveal scripts) on **every** navigation; the public landing page re-sends ~32 KB of CSS per view with zero cache reuse. Compression softens the wire cost, but repeat-visit bytes could be ~0 with a static stylesheet + long-lived cache. Medium priority for the landing page (real visitors, Core Web Vitals), low for admin.
2. **Bulk approve/reject N+1** — `applyBulkDecisions` (`src/index.js:2130-2167`) runs up to 3 sequential D1 round trips *per selected id* (queue row, wishlist+client join, client) plus per-id UPDATEs on reject. Fifty selections ≈ 60–150 sequential queries ≈ seconds of button latency. Fixable with `WHERE id IN (…)` batching.
3. **`deliverManyToClient` calls the external landed-cost API serially per item** (`src/notify.js:245-248`) instead of reusing `attachLanded`'s bounded-concurrency pool (`src/calc.js:202-215`) that the rest of the codebase uses. Low impact (small item counts), trivially inconsistent.
4. **Matcher cron fans out one external relay HTTP call per active wishlist, sequentially** (`src/matcher.js:258-300`, 4×/day). Deliberate (rate-limit-friendly) and fine today; watch it if wishlists reach the hundreds (15-min cron ceiling).
5. **`getSettings()` is re-queried ~25 places**, including once per client inside bulk loops (`src/settings.js:54-63`). The table is ~30 rows so it's near-free; thread it through if touching that code anyway.
6. **`public/assets` holds ~2.6 MB of `.jpg` masters that are never served** — `photo()`/`photoSrcset()` (`src/landing.js:44-67`) always rewrite to the WebP variants. **Do not delete them:** they are the documented source inputs to `scripts/optimize-landing-images.mjs`. Optionally move masters out of `public/` so they aren't deployed as unreachable CDN files. The served images are already properly responsive (srcset, hero preload with `fetchpriority="high"`).

Non-findings: images optimised, no layout-shifting patterns observed server-side, no unbounded per-request compute, regex XML parsing is bounded by query LIMITs.

## 8. Config and env sprawl

Config is mostly consolidated (one `wrangler.toml`, one `.dev.vars` + example, no stray `.env` files) — but there is drift:

- **`setup.sh` is broken/stale:** step 4 runs `wrangler d1 execute … --file schema.sql` (`setup.sh:50`) but **`schema.sql` no longer exists** — schema moved entirely to `migrations/`. It also predates and bypasses the migration-tracking workflow. Fix or delete; today it fails partway and encourages the wrong workflow.
- **`.github/workflows/`** — 4 workflows, no conflicting overlap: `deploy.yml` (push-to-main CI: tests → e2e smoke → schema gate → deploy; healthy), `db-apply-pending.yml` (the sanctioned migration path; keep), `db-adopt-tracking.yml` (one-time historical fix, already run on 13 Jul — archivable), `db-seed-managed.yml` (single-use July-2026 client import with hardcoded count assertions — archivable, and see §9 re its data file).
- **`.dev.vars` vs `.dev.vars.example` drift:** local `.dev.vars` is missing the `AUCTION_FIXTURE` key the example documents (feature just no-ops; still, sync them).
- **`package.json` vs working tree drift:** the `avg` script points at untracked `scripts/avg-sold.mjs` (uncommitted-work hazard).
- `wrangler.toml` itself is clean and well-commented — no stale vars found; the cron comment ("Adjust once the provider confirms rate limits") is the only placeholder-y note.

## 9. Risk flags (payments, auth, webhooks, secrets)

### What is solid (verified, leave alone)

- **Stripe webhook verification is correct:** manual HMAC-SHA256 over `t.rawBody`, constant-time comparison, 300 s replay window (`src/stripe.js:141-155`); raw body read before parse; returns 503 (not 400) when unconfigured so Stripe retries (`src/index.js:685-709`).
- **Stripe idempotency:** `stripe_events` ledger with `INSERT OR IGNORE` on `event.id` and rollback-on-throw so retries can reprocess (`src/stripe.js:164-183`), backed by `WHERE status <> 'paid'` guards. Stripe ships deliberately inert — every entry point is gated on `stripeConfigured(env)` + a settings toggle; **no live or test keys anywhere in the repo**.
- **Auth fundamentals:** PBKDF2-SHA256 100k iterations with self-describing format and bounds-checked verify (`src/auth.js:21,145`); `HttpOnly; Secure; SameSite=Lax` signed session cookies with real per-account revocation via `session_ver` (`src/auth.js:295-309`); centralized Origin/Referer CSRF gate on all mutating authed routes (`src/index.js:46-54,797-799`) with dedicated tests; layered login rate limiting (per-IP, per-email, admin-key, global ceiling; `src/index.js:97-150`); Google OAuth `state` is signed, time-boxed, and nonce-bound to a cookie (`src/oauth.js`).
- **Public POST surface is each individually protected:** `/webhooks/stripe` (signature), `/v/interest` (signed share token + IP throttle), `/request` (IP + per-contact throttle + honeypot), `/set-password` (single-use hashed expiring token), `/login` (lockout + body-size cap).
- **Notification paths don't retry-storm** (WhatsApp is best-effort, never blocks email), secrets are `.trim()`ed defensively, PII is masked in logs.

### What needs attention

| Sev | Finding |
|---|---|
| **CRITICAL** | **Admin auth is one shared password (`ADMIN_PASSWORD`, blank-email login, `src/auth.js:207`) and it has a documented unrotated plaintext exposure** — `ben-notes-v12-status.html:276-283` (in the repo root) records that the real admin password was printed in a PDF that "has been emailed around". TOTP MFA exists (`src/auth.js:192-250`) but is opt-in via `ADMIN_TOTP_SECRET` and nothing confirms it's enabled in prod. **Action: rotate `ADMIN_PASSWORD` (`wrangler secret put ADMIN_PASSWORD`), set `ADMIN_TOTP_SECRET`, reset the `bengc2000` test account — then delete the PDF/HTML from the working tree.** This is operational, not a code change. |
| **MED** | **Real client PII committed to git:** `seed/import-managed-2026-07.sql` contains ~16 real customers' first names + car preferences/budgets, tracked in git and loadable into prod via `db-seed-managed.yml` — despite `.gitignore` explicitly blocking a *different* file (`import-clients.sql`) for exactly this reason. No emails/phones, so exposure is moderate. Purging it means a history rewrite (force-push coordination) — decide deliberately; at minimum stop the pattern and archive the workflow. |
| **MED** | **Checkout amounts come from an admin-editable settings row with only a `>0` check** (`src/stripe.js:50-106` ← `src/index.js:1714-1789`). No price allowlist or sanity bounds — a compromised admin session could redirect checkout amounts. Add a max bound / use Stripe Price objects when payments go live in earnest. |
| **LOW** | Rate limiting **fails open** if the `RL` KV binding is missing/unavailable, silently and without alerting (`src/index.js:97-150`). |
| **LOW** | `ADMIN_TOKEN` is a single HMAC key securing three trust boundaries at once (sessions, OAuth state, share links) — acknowledged in code (`src/auth.js:41-47`); one compromise invalidates all three. |
| **LOW** | Signup leaks account existence ("That email already has an account") — self-acknowledged in the notes file, unfixed. |
| **LOW** | `stripe_events` ledger path isn't exercised by tests (fixtures omit `event.id`, so only the status-guard idempotency is tested); no end-to-end test forges a bad `Stripe-Signature` against the real route. |
| **LOW** | WhatsApp "accepted ≠ delivered" gap has no status-callback reconciliation — a broken integration degrades silently to email-only. |
| INFO | `wrangler.toml` carries `account_id`/`database_id` in plaintext — standard for Wrangler, identifiers not secrets. |

---

## A. Overall health — plain English

**This codebase is in much better shape than its AI-heavy build history would predict.** The usual accumulation pattern — dead routes, unused deps, circular imports, commented-out graveyards, scratch tests — is almost entirely absent. It builds clean, all 544 tests pass in under 2 seconds, there are zero runtime dependencies, no circular imports, no TODO debt, and the security-sensitive code (Stripe webhooks, password hashing, CSRF, rate limiting) is genuinely well-engineered with tests to match. The mess that *does* exist is concentrated in three places:

1. **`src/admin.js` is a 631 KB / 8,644-line god-module** — 191 functions mixing views, inline scripts, direct D1 CRUD, and access control, with 218 raw DB calls and no internal boundaries. Every feature touches it; it's where the iterative-AI history actually shows. This is the #1 tax on future work.
2. **An unresolved credential exposure, not a code bug:** the shared admin password was leaked in plaintext in an emailed PDF and still hasn't been rotated (documented in `ben-notes-v12-status.html`, sitting in the repo root), MFA isn't confirmed on — and real client names are committed in `seed/import-managed-2026-07.sql`. Rotating the secret is a two-minute fix with the highest value-per-effort in this entire report.
3. **Documentation/config debris and drifted duplication:** ~13 stale session-report markdown files in the root (6 for the dealer feature alone), a broken `setup.sh`, two one-shot GitHub workflows still live, and two CSS systems sharing 91 class names whose styles have already diverged (currently held together by a regression test rather than by design).

## B. Ranked cleanup plan

Sorted highest-impact-per-risk first. Effort: S < 1 h, M = half-day–2 days, L = multi-day. Risk = chance of breaking the live app (push to `main` = deploy, so everything below assumes the normal CI path).

### Quick wins — safe to do now

| # | What to do | Why | Effort | Risk | Impact |
|---|---|---|---|---|---|
| 1 | **Rotate `ADMIN_PASSWORD`** (`wrangler secret put`), set `ADMIN_TOTP_SECRET`, reset the `bengc2000` test account; then delete `Finder Site Notes V1.2 - Status.pdf` + `ben-notes-v12-status.html` from the working tree | Known plaintext exposure of the only admin credential; ops-only, no code change | S | Low | **High** |
| 2 | Delete/archive the 13 stale root markdown files (move to `docs/archive/` if you want history): 4 dealer "done" reports, `DEALER-REDESIGN.md`, 4 commit-pinned audits, `FINDER-V12/V13-FIXES.md`, `CHANGES_SUMMARY.md`, `WEBSITE_CHANGES.md`; keep `FINDER-V13-VERIFICATION.md` (rollback steps) and `DEALER_SYSTEM_GUIDE.md` (or fold into `USER-GUIDE.md`) | Root-level noise; has already caused confusion once (`WEBSITE_CHANGES.md` is a reconstruction of a lost doc); zero code impact | S | Low | **High** |
| 3 | Commit `scripts/avg-sold.mjs` + the `package.json` `avg` script (currently uncommitted); declare `sharp` or document its npx use; add an `images:optimize` script entry for `optimize-landing-images.mjs` | `npm run avg` breaks on fresh clone; orphaned tooling stays findable | S | Low | Med |
| 4 | Delete the 8 fully dead symbols (§1a): `parseSheetResponse`, `MAIN_COLUMNS`, `LINEUP`+`lineupCard`, `render.js aud`, `engagementCell`, `validDeposit`, `clampMin` | Verified zero references incl. tests; each is a future-reader trap | S | Low | Med |
| 5 | Fix or delete `setup.sh` (references nonexistent `schema.sql`, bypasses migration tracking); archive `db-adopt-tracking.yml` and `db-seed-managed.yml` (both one-shots, already run) | Broken bootstrap misleads; a stray workflow_dispatch on the seed import shouldn't stay one click away | S | Low | Med |
| 6 | Drop the superfluous `export` keywords on the 15 internally-used symbols (§1b) | Shrinks the API surface; makes the next knip run signal-only | S | Low | Low–Med |
| 7 | Resolve `docs/stage0-cleanup-plan.md` (run the two proposed DB cleanups via the migration workflow, or delete the doc); delete stale `docs/web-interface-audit.md`; reconcile `docs/JDM-Connect-User-Guide.pdf` (4.1 MB) vs `USER-GUIDE.md`; sync `.dev.vars` with its example; `git worktree remove ../jdm-finder-v13` | Unowned TODOs and 4 MB of possibly-diverged binary docs | S | Low | Low–Med |

### Medium projects — normal review + CI

| # | What to do | Why | Effort | Risk | Impact |
|---|---|---|---|---|---|
| 8 | Extract the CSS blobs to static cached stylesheets (start with `landingCss` → `/landing.css` with immutable caching; relax `doc()`'s blanket `no-store` for the public landing page) | ~32 KB re-sent to every landing visitor on every view today; the landing page is the one surface with real external traffic | M | Med | Med |
| 9 | Batch the bulk approve/reject N+1 (`applyBulkDecisions`, `src/index.js:2130-2167`) with `WHERE id IN (…)`; while there, swap `deliverManyToClient`'s serial landed-cost loop to `attachLanded` | 60–150 sequential D1 calls per bulk action = seconds of admin latency; covered by existing match/notify tests | M | Med | Med |
| 10 | Unify the escapers: shared dependency-free `escape.js` replacing `render.esc`/`theme.escHtml`; rename the three living `aud` formatters to distinct names; deduplicate the three `FONT` constants | Two drifted escapers is an XSS-consistency hazard in waiting; `aud` name collisions invite the wrong import | M | Med | Med |
| 11 | Begin splitting `admin.js` along its existing comment banners: first pull out the data-access/CRUD functions (`createClient`, `updateClient`, `deleteClient`, `bulkAllocate`, dealer CRUD…) into `admin-data.js`, then the inline-`<script>` builders. Pure moves + re-exports; the 544-test suite and render sweep are the safety net | The single biggest maintainability problem; incremental moves keep each PR reviewable | L | Med | **High** |

### Handle carefully — payments / auth / data (do NOT bundle with cleanup)

| # | What to do | Why | Effort | Risk | Impact |
|---|---|---|---|---|---|
| 12 | Decide on `seed/import-managed-2026-07.sql` (real client names in git). Minimum: archive the workflow and stop the pattern. Full fix: history rewrite — coordinate, and note the unpushed overlapping session memory warns about | Real PII in a repo; history rewrite is disruptive and interacts with the other session's unpushed work | M | **High** | Med |
| 13 | Add a sanity bound/allowlist on Stripe checkout amounts pulled from settings; add a ledger-path test with a real `event.id` and a forged-signature route test | Payment-amount integrity; the webhook crypto itself is correct — this is belt-and-braces before payments scale | M | **High** (touches money) | Med |
| 14 | Consider alerting (or fail-closed for login only) when the `RL` KV binding is unavailable; consider splitting `ADMIN_TOKEN` into per-purpose keys | Both are deliberate current tradeoffs, acknowledged in code; changing them touches every session/link — only with focused review | M | **High** | Low–Med |
| 15 | **Leave alone:** `src/stripe.js` signature/idempotency core, `src/auth.js` hashing/session/revocation, the CSRF gate, OAuth state handling, `migrations/legacy/`, the `/portal/sold` 301 shim, the `dealer_portal_enabled` flag, and the `.jpg` masters in `public/assets/photo/web/` (inputs to the image pipeline — moving them out of `public/` is optional polish) | All verified correct or intentionally kept; churning them is pure risk for zero mess-reduction | — | — | — |
