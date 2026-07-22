# JDMFinder Structural / Code Audit

Audit date: 2026-07-21 (Australia/Perth)  
Baseline commit: `ec9030c8e61507047bcd5599d37f923e0fb9ee07` on `codex/auction-history-example`  
Scope: the current working tree, including its uncommitted changes

## Executive summary

The codebase is operationally substantial rather than generally chaotic. It has clear domain modules for authentication, matching, notifications, payments, settings, rendering, and auction access; a large automated test suite; versioned D1 migrations; and a successful Wrangler dry build. The largest maintainability problem is that `src/admin.js` has become a 597 KB application inside the application. The largest immediate quality problem is not dead code: it is that the current working tree has 29 failing tests. The largest product-risk defect is the delivery state machine, where failed client sends are moved out of the only visible review state and cannot be retried.

The three biggest problems are:

1. **The current working tree is not a green baseline.** It contains 1,066 added and 363 removed lines across 16 tracked files plus two untracked files. `npm test` reports 490 tests, 461 passing and 29 failing.
2. **`src/admin.js` is an oversized mixed-responsibility module.** It combines data access, mutations, page rendering, CSS, client-side JavaScript, auth pages, staff pages, buyer pages, dealer pages, and design primitives.
3. **State and presentation drift across parallel implementations.** Delivery states, duplicated CSS primitives, and several similar route handlers have diverged. This causes real defects such as stranded `failed` queue rows and visual defects such as undefined `.btn-outline` links.

## Baseline and tooling

| Check | Result |
|---|---|
| Git status | Dirty: 16 modified tracked files; `scripts/avg-sold.mjs` and `test/avg-sold.test.mjs` untracked |
| Diff size | 1,066 insertions, 363 deletions |
| Test suite | 490 total; 461 pass; 29 fail |
| Wrangler dry build | Pass |
| Worker upload | 1005.01 KiB raw; 283.99 KiB gzip; 13 static assets |
| `depcheck@1.4.7` | No unused or missing dependencies |
| `madge@8.0.0 --circular` | 24 modules processed; no circular dependencies |
| `knip@5.64.0` | Could not run: incompatible with the installed Node 24.18 runtime (`ts.getDefaultLibFilePath is not a function`) |

The failing tests are concentrated in auction eligibility/rendering, dashboard output, dealer routes and lifecycle, membership CTAs, public routes/share flow, landing behavior, rate limiting, missing-migration auth tolerance, public lot isolation, and dealer-shell rendering. Some corresponding tests and implementations are modified in the working tree, so the failures must be reconciled before cleanup conclusions are treated as release conclusions.

## Actual architecture and data flow

`src/index.js` is the Worker entry point and central router. It applies canonical-host behavior, public routes, authentication, CSRF checks, role routing, and action dispatch. `src/admin.js` contains most D1-backed business operations and almost all staff/buyer/dealer HTML. `src/matcher.js` converts wishlists into auction-provider queries, enriches and filters lots, and writes queue/seen rows. `src/notify.js` sends email and WhatsApp. `src/stripe.js` creates Stripe sessions, verifies webhooks, deduplicates events, and updates payments/membership. `src/auth.js` owns password, token, and session behavior. `src/theme.js`, `src/landing-css.js`, `src/request-wizard.js`, `src/auction-ui.js`, and embedded blocks in `src/admin.js` supply parallel HTML/CSS/JS presentation systems.

The dominant data path is:

`HTTP/cron -> src/index.js -> domain function -> D1/provider -> server-rendered HTML or notification`

This is a reasonable small-Worker architecture, but `index.js` and especially `admin.js` are now too broad for safe local reasoning.

## Findings

### C1 — Current working tree fails 29 tests

**Severity:** High  
**Applies to:** current working tree; not proven for clean `HEAD`

The suite fails quickly and consistently. Dealer behavior alone accounts for multiple failures, and rate limiting accounts for seven. Do not delete tests as “stale” in bulk: determine whether the implementation or each expectation represents intended behavior.

Recommendation: create a failure ledger grouped by changed source file, decide intended behavior, and return to green before cleanup/refactoring.

### C2 — Failed deliveries become invisible and non-retryable

**Severity:** High  
**Applies to:** both current implementation and the reviewed delivery flow

Single approval writes `status = 'failed'` on delivery error (`src/index.js:1997-2002`). Bulk approval does the same for every selected row for that client (`src/index.js:2075-2085`). The review query selects only `q.status = 'pending'` (`src/admin.js:1126`), and the decision handler accepts only `pending` (`src/index.js:1961-1963`). There is no failed-delivery screen or retry transition.

This is a state-machine bug, not cosmetic cleanup. A transient mail outage can permanently remove a paying client's match from normal staff work.

Recommendation: expose `failed` rows, retain a safe retry action, record error/attempt metadata, and return structured bulk results.

### C3 — Bulk actions swallow partial failures and the UI reports blanket success

**Severity:** High  
**Applies to:** current working tree

`applyBulkDecisions` catches per-row/per-client errors and returns no result (`src/index.js:2027-2087`). The AJAX endpoint therefore cannot distinguish sent, failed, skipped, unauthorized, missing, or already-handled rows. Client-side code announces a sent count based on selected IDs rather than persisted outcomes (`src/admin.js:4128-4156`).

Recommendation: return `{sent, failed, skipped, unauthorized}` IDs/counts and render an honest message with a retry link when failures occur.

### C4 — `src/admin.js` is a 597 KB mixed-responsibility module

**Severity:** Medium  
**Applies to:** both `HEAD` and working tree

It is approximately 7,762 physical lines in the current tree and contains SQL, CRUD, access control, page composition, CSS, inline browser scripts, emails/UX strings, and multiple application shells. `src/index.js` is also 113 KB and contains more than 70 explicit route branches.

Recommendation: split by stable responsibility, beginning with low-risk pure moves:

- `admin/data/*` for scoped queries and mutations;
- `admin/views/*` for dashboard, customers, requests, matches, payments, dealers;
- `admin/ui/*` for shared shell, controls, dialog/toast scripts;
- separate route tables/handlers in `index.js` only after behavior is covered.

Avoid a broad rewrite. Move one cohesive area at a time with re-exports and a green suite.

### C5 — Duplicated design primitives drift across shells

**Severity:** Medium  
**Applies to:** both `HEAD` and working tree

`.card`, `.actions`, `.btn-gold`, `.btn-dark`, `.btn-notify`, `.chip`, `.pill`, `.empty`, and `.reqok` are separately defined in `src/theme.js` and `src/admin.js`, with different padding, weights, radii, color values, and states. Other screen-specific blocks add further button/card families.

Recommendation: establish one token source and explicit shell variants. Do not merely rename every class to the same name while keeping different semantics.

### C6 — Test-email route passes arguments in the wrong order

**Severity:** Medium  
**Applies to:** current working tree and likely `HEAD`

`digestRecipient` is declared as `(settings, env)` (`src/settings.js:77`), while `/settings/test-email` calls `digestRecipient(env, settings)` (`src/index.js:1433`). Other callers use the correct order.

Recommendation: fix with a focused route test that verifies the saved digest address and environment fallback.

### C7 — Setup and script drift

**Severity:** Medium  
**Applies to:** current tree

- `setup.sh:50` executes nonexistent `schema.sql`; migrations now live under `migrations/`.
- `package.json` references `scripts/avg-sold.mjs`, but that file and its test are untracked.
- Two workflows exist: `deploy.yml` and `db-apply-pending.yml`. Their continued purpose should be documented; do not archive them solely because they are old.

Recommendation: either update `setup.sh` to the migration workflow or remove it with documentation; deliberately include or remove the average-sold tooling as one change.

### C8 — Probable dead CSS, but earlier lists overclaimed

**Severity:** Low  
**Applies to:** current tree

Selectors such as `.reqok*`, `.pricegrid`, `.gate*`, `.cta-import*`, and `.ghead*` appear to have definitions without current rendered markup. They are candidates for deletion after tests/render checks. `.kebab` must not be accepted blindly as dead: the kebab SVG is still used by row menus, although the exact `.kebab` class may have moved to `.rowmenu-btn`.

Recommendation: prove dead selectors by searching generated markup and running targeted rendered-page tests. Delete in small batches.

### C9 — Sequential external work can make bulk delivery slow

**Severity:** Medium  
**Applies to:** current tree

`deliverManyToClient` awaits landed estimates sequentially for each item (`src/notify.js:242-248`). Bulk preparation also performs multiple queries per selected ID (`src/index.js:2046-2060`). D1 batching is used for status updates, but the read/enrichment path remains N+1-like.

Recommendation: fetch selected rows with one joined query; use bounded parallel landed estimation or a batch calculator endpoint if supported. Preserve per-client failure isolation.

### C10 — Stripe amount validation has no upper sanity bound

**Severity:** Medium/High  
**Applies to:** current tree

Checkout validates only `amountCents > 0` (`src/stripe.js:50-52`, `83-85`). Settings allow arbitrary numeric deposit values, and route code converts editable values directly into cents (`src/index.js:1642-1653`, `1686-1703`). The amount is snapshotted correctly into the payment row and Stripe session, so a later settings edit does not alter an existing checkout; the remaining risk is accidental or malicious configuration of an extreme amount/currency.

Recommendation: validate a narrow currency allow-list and business-approved min/max bounds both when saving settings and immediately before Checkout creation. Handle separately from cleanup.

### C11 — Stripe event ledger is robust but not truly transactional with side effects

**Severity:** Medium  
**Applies to:** current tree

The event ID is inserted, the business update is performed, and the event row is deleted if an exception propagates (`src/stripe.js:164-182`). Tests cover duplicate suppression and a thrown update followed by retry. However, these are separate D1 statements rather than one database transaction. A process termination after a business update but before response leaves the ledger row—which safely suppresses duplicate provisioning—but a future non-idempotent external side effect added inside the handler would require an outbox or explicit state machine.

Recommendation: retain current behavior, document the invariant, and avoid adding irreversible external side effects inside `applyStripeEvent` without an outbox.

### C12 — Secret scan requires operational verification, not repository inference

**Severity:** High if the reported leak is real; unverified by this audit

`.dev.vars` is present locally but is ignored; only `.dev.vars.example` is tracked. A pattern scan found secret *names/examples* in configuration and tests, not a confirmed live secret value. The previously named PDF/HTML leak files are not present in the current tree. `seed/import-managed-2026-07.sql` is absent now but its path exists in Git history.

Repository inspection cannot prove that `ADMIN_PASSWORD` was rotated or that `ADMIN_TOTP_SECRET` is configured. If a real password appeared in a distributed document, rotate it regardless of file deletion; deleting a file does not revoke a credential.

## Dependencies, files, exports, and cruft

- `depcheck` found both declared development dependencies in use and no missing imports.
- `madge` found no circular import graph from `src/index.js`.
- `knip` could not be used under the installed Node runtime; therefore this audit does **not** claim a definitive unused-export list.
- Root markdown contains many historical implementation/audit documents. Archiving them may improve navigation, but they are documentation, not runtime dead weight. Decide a documentation retention policy rather than deleting by count.
- Console output in `scripts/*` is normal CLI output. `src/matcher.js` logs structured run results. Notification logs mask client contact values. These are not stray debug logs by default.
- The base64 logo in `src/assets.js` contributes roughly 57 KB source; public static hosting would be simpler but is low priority.

## Ranked cleanup plan

| Rank | What to do | Why | Effort | Break risk | Cleanup impact |
|---:|---|---|:---:|:---:|:---:|
| 1 | Reconcile the 29 failing tests and establish intended behavior | No safe cleanup baseline exists while tests are red | M | Low | High |
| 2 | Add failed-delivery visibility and retry; return truthful bulk results | Prevents silent lost client notifications | M | Med | High |
| 3 | Fix `digestRecipient(settings, env)` and add the route test | Confirmed small functional defect | S | Low | Med |
| 4 | Resolve untracked average-sold files and the broken `setup.sh` | Makes fresh clones and onboarding deterministic | S | Low | Med |
| 5 | Define/remove `.btn-outline` and fix the group-send button class | Removes confirmed UI drift | S | Low | Med |
| 6 | Delete proven-unused CSS in small tested batches | Removes noise without speculative deletion | S | Low | Med |
| 7 | Consolidate tokens and core control states across shells | Stops future visual divergence | M | Med | High |
| 8 | Replace per-ID bulk preparation with joined reads and structured results | Improves performance and correctness together | M | Med | High |
| 9 | Split `admin.js` by domain/view via pure moves and re-exports | Restores local comprehensibility | L | Med | High |
| 10 | Split route handlers from `index.js` after flow tests exist | Reduces router blast radius | L | Med | Med |

## Handle separately and carefully

| Item | Reason |
|---|---|
| Rotate admin password and configure TOTP | Operational secret work; cannot be verified from source |
| Add Stripe amount/currency bounds | Touches money; require explicit business limits and Stripe tests |
| Assess historical client-data file | May require privacy review and coordinated Git history rewrite |
| Change webhook/idempotency structure | Current design is tested; changes need failure-injection tests |

## Overall verdict

The committed design shows good instincts around CSRF, token hashing, Stripe signature verification, idempotency, scoped access, migrations, and failure isolation. The repository is not suffering from indiscriminate dependency or circular-import sprawl. It is suffering from concentration and drift: too much UI/data behavior in two central files, multiple parallel design systems, and incomplete state handling. Stabilize the current working tree first, fix delivery correctness second, and refactor only behind green flow tests.
