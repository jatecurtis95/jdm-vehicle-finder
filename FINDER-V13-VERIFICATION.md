# Finder V1.3 verification and fix report

Branch: `codex/finder-v13-fixes` (based on main at 4bd79ad, 14 Jul 2026).
Work order: Finder Site Notes V1.3 (Ben, 07/07/2026), FINDER-V13-FIXES.md,
FINDER-V12-FIXES.md, ADMIN-REDESIGN.md, COLOUR-AUDIT.md.

Headline: the V1.3 work order had already been implemented and merged to main
(Phases 0 to 5 and A to D, PRs #56 to #72, plus 20 launch-audit fixes). This
round therefore VERIFIED every requirement against the running code and fixed
the gaps that verification actually found. Nothing was rebuilt.

Baseline: 437/437 tests at 4bd79ad. Final: 467/467 tests, all local D1
migrations apply cleanly from scratch, browser smoke passes at 375px, and the
six core journeys were exercised end to end over HTTP against wrangler dev.

## SECURITY: exposed credentials (action required)

The V1.3 notes PDF contains the production admin password and a test-account
password in plain text. Treat both as compromised:

1. Rotate the admin password: `npx wrangler secret put ADMIN_PASSWORD`.
2. Reset the test account (bengc2000@gmail.com) via the Forgot password flow.
3. Consider enabling admin MFA (new, this round): set a base32 TOTP secret
   with `npx wrangler secret put ADMIN_TOTP_SECRET`; admin sign-in then
   requires the authenticator code. It is inert until the secret is set.

No replacement credentials appear in code, docs or this report.

## Fixes made this round

### 1. Password policy welcomed password managers (9f128e0)
- Issue: passwords capped at 32 chars with a small symbol allowlist; common
  passwords accepted. The work order requires 64+ char support, no symbol
  allowlist, and common-password rejection.
- Root cause: policy written to the V1.1 notes; superseded by this work order.
- Fix: `PW_MAX` 32 -> 128; only control characters are refused; a lowercased
  common/compromised list (password123 and friends, plus site-specific
  guesses) refuses guessable choices. Client-side wizard mirror updated;
  form copy no longer lists symbols. Existing logins unaffected.
- Files: src/auth.js, src/admin.js, src/request-wizard.js.
- Tests: test/password-policy.test.mjs (8), signup.test.mjs updated.

### 2. Admin MFA, opt-in TOTP (9f128e0)
- Issue: no MFA for the admin account; its password just leaked via the PDF.
- Fix: RFC 6238 TOTP (verified against the RFC test vectors) behind a signed
  5-minute pending cookie between the password and code steps. Failed codes
  count as admin login failures (same lockout and delay). Single-step
  behaviour is unchanged until ADMIN_TOTP_SECRET is set.
- Files: src/auth.js, src/index.js, src/admin.js (code page).
- Tests: test/admin-mfa.test.mjs (8, including no-secret regression).

### 3. Cards did not fully identify the car (e627bf3)
- Issue: result cards lacked year, variant, transmission, drivetrain and lot
  number (work order Phase 3 list).
- Fix: card name leads with the year; the variant (feed trim string) sits
  beside the chassis code; new Transmission (with drivetrain beside it) and
  Lot stats; watchlist snapshots and the client-side watch card mirror carry
  the same fields; missing values degrade to a dash.
- Files: src/auction-ui.js. Tests: test/card-fields.test.mjs (4).

### 4. Comparables could quietly mislead (425c19e)
- Issue: within a similarity tier, comparables were just the newest sales;
  and when a requested model code had no sold records the panel silently fell
  back to the whole model line (the Civic Type R complaint).
- Fix: comparables now rank by proximity to the subject car (a year apart
  weighs like ~25,000 km; recency breaks ties); a starved narrowing renders
  an explicit note ("No sold records match model code FL5 yet... treat them
  as a guide only"). Lot-detail callers pass the subject year and mileage.
- Files: src/market.js, src/admin.js. Tests: test/market-similarity.test.mjs (4).
- Note: transmission/drivetrain proximity is intentionally not queried; the
  model-code tier pins those in practice and the relay's stats table is not
  verified to carry kpp/priv (docs/auction-history.md probes).

### 5. Saved-search edits could blank every term (22128e3)
- Issue: creation refused a match-everything search, but both edit paths
  (staff and portal) skipped the rule, so an edit could blank all narrowing
  terms and leave a whole-feed search behind.
- Fix: both edits refuse server-side and leave the row untouched; the portal
  route redirects with an error instead of flashing "saved"; the staff route
  surfaces the shared failure notice.
- Files: src/admin.js, src/index.js. Tests: test/wishlist-term-guard.test.mjs (4).

### 6. Portal isolation proof extended (4238595)
- Issue: the work order requires permission tests for every customer-facing
  write path; approve/pay were tested, wishlist edit/pause/delete were not.
- Fix: tests only (guards already existed): foreign edit/pause/delete are
  refused, the owner still can. Files: test/portal-isolation.test.mjs.

### 7. Last em dash in customer copy (66672e1)
- "Likely eligible—needs confirmation" -> "Likely eligible, needs
  confirmation" per the house rule. Files: src/auction-ui.js (+ its test).

## Verified as already done (no changes)

- Auth: signup -> login for all four roles; set-password per role; forgot
  password with single-use hashed 1-hour tokens; neutral responses (identical
  page either way, confirmed live over HTTP); KV lockout (10 fails/15 min,
  1.5 s delay, admin and global dimensions); reset/signup/API rate limits;
  session invalidation on reset (session_ver); Origin/Referer CSRF guard on
  every authenticated POST; 4 KB auth body cap plus field caps; autocomplete
  attributes with no paste blocking; no passwords/tokens/links in logs.
- Auction search: no auto-submit or panel collapse on Make/Model change
  (regression-tested); background refill of model and model-code lists;
  feed-backed makers/models/codes/grades/houses lookups (houses cached 1 h so
  USS JAA appears on auction day); house filtering in SQL; explicit Search
  trigger and the sidebar "Run Searches"; GET-form filters in the URL; feed
  outage state distinct from "0 lots"; smart bar removed (parked); homepage
  lineup limited to `auction_date >= NOW()` and dropped when the feed is empty.
- Cards and detail: whole-card click-through with buttons excluded; the tick
  toggles only on the tick; heart only toggles the watchlist; Watchlist tab;
  greyed-out Sheet placeholder removed (link renders only when the sheet
  exists); Sold auctions and Sold prices tabs work; sheet image at &w=1400
  with an honest "once the auction house uploads it" state; full compound
  grades (3.5/B/C) via the sheet reader.
- Landed costs: one shared service (src/calc.js) calling the live JDM Connect
  calculator, used by cards, lot detail, matches, budget conversion and the
  wizard mirror; assumptions editable in Settings without a deploy
  (calc_compliance_aud, calc_agency_aud, calc_fx_jpy_aud); estimates hide
  when unavailable; the market snapshot shows a landed RANGE (p25 to p75).
- Wizard: Make clears Model and chassis code; feed-backed model selects (no
  free text, no "pick or type"); model-code and grade multi-select
  refinement; nickname on the Find car step; presets emptied pending SEVS
  review; AUD budget stored on the lead only with a live yen equivalent;
  Country field defaulting to Australia; free-tier search limit enforced
  server-side and configurable.
- Interested/requests: /portal/approve records the request idempotently with
  a timestamp, advances the parent request to "interested" without regressing
  later stages, bumps last_activity so it tops Admin Requests (newest-active
  ordering), logs the profile timeline both ways and alerts staff; rows lead
  with the car, never a raw lot id; links to the customer and the lot.
- Subscriptions: /portal/subscribe is a real page (honest not-purchasable
  state without Stripe, confirmed live); Stripe checkout posts a monthly
  recurring price; webhooks are signature-verified, idempotent and rolled
  back on failure; membership flips on subscription events only; match-email
  upsell only for non-members when selling is on.
- Validation/copy: shared field caps and E.164 phones; years bounded
  1970-2050 (future-proof); email uniqueness folds a repeat signup into the
  existing record with a neutral "check your email" flow (no enumeration,
  password never overwritten); "A your search" gone; fake stats gone; no
  em/en dashes (enforced by test).

## Verification performed

- Full suite: 467/467 (was 437 at baseline; 32 new tests, 3 updated).
- Migrations: `npm run qa:reset` applies every migration to a fresh local
  wrangler D1; migration/schema-check/schema-drift tests green.
- Browser smoke (Puppeteer, 375 x 812): request wizard, login accessibility
  (main landmark, skip link, no autofocus keyboard grab), 404 page, admin
  login and dealer view, no horizontal overflow anywhere.
- Live HTTP journeys against wrangler dev with the auction fixture: signup ->
  login (64-char spaced password) -> portal; wrong password 401; forgot
  password byte-identical for known and unknown emails; /api/makers,
  /api/models, /api/codes (friendly "EK9 - Civic Type R (EK9)" labels);
  buyer portal matches; "I'm interested" -> visible on admin Requests;
  admin search finds the new customer; subscribe page real and honest;
  foreign-account approve does nothing.
- Search-shape coverage (unit level): "MERCEDES AMG" vs "MERCEDES BENZ"
  (first-token make match reaches both listings, the E55 case), variant
  searches reach the trim column (Type R, S400), house filter (USS JAA),
  grade spellings via the multi-select, LHD exclusion, SQL escaping.

## Remaining limitations

- Feed timing gap: the relay surfaces some lots (notably USS JAA) up to a day
  later than AUCRS. Provider/data-source limitation, documented in
  FINDER-V13-FIXES.md PARKED; do not paper over it in UI.
- Live-relay checks (real Mercedes/Crown/Type R result sets, USS JAA rows,
  stats kpp/priv columns) need the relay token and should be a production
  smoke after the next deploy; local verification used the fixture.
- Landed figures on cards/detail are labelled indicative point estimates from
  the live calculator; only the wizard snapshot shows a range today.
- Email uniqueness is enforced at the application layer (fold-into-existing),
  not a DB unique index: the CRM deliberately allows staff-created duplicate
  rows per email, and production data already contains them.
- Deployment and the post-deploy production smoke were NOT run: pushing main
  auto-deploys, so that step stays with the owner.

## Rollback procedure

- Code: `npx wrangler rollback` to the previous deployment, or redeploy the
  prior main commit. This branch is additive and behind main's deploy.
- Database: this round adds NO migrations, so there is nothing to roll back
  in D1. (Settings keys are rows, not schema.)
- Admin MFA: unset/never set ADMIN_TOTP_SECRET to return to single-step login.

## Product decisions still required

1. Enable admin MFA? (Set ADMIN_TOTP_SECRET; recommended after the leak.)
2. Free-match review: currently manual review (free_auto_send=0, decided
   07/07/2026) - reconfirm before launch marketing.
3. "Run Searches" includes free accounts (run_includes_free=1, decided
   07/07/2026) - reconfirm.
4. Landed range display on cards/detail (what uncertainty band to claim) -
   deliberately not invented this round.
5. Presets: supply the SEVS-vetted list to repopulate the wizard presets.
6. Raise the feed-timing gap with the auction data provider.
