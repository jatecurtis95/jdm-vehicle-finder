# PERF_RESULTS.md - Phase 1/2 speed pass, before and after

Branch `perf/phase1-2-speed`, off `feat/phase1-filtering` (not main, since it
touches Phase 1 files). Measured 23 July 2026 against a local `wrangler dev`
with a 24-row auction fixture, using puppeteer-core and the pre-installed
Chromium. Standing rules from BUILD.md applied: smallest change per item, no
push to main, no migrations, no query-logic changes.

## Method and its limits

- Harness: `audit/perf/measure.mjs` loads each page twice (keeps the second)
  at a fixed 1280x900 viewport and does NOT scroll, so the figures are the
  INITIAL-load state, which is where lazy loading helps. It reads the browser
  Performance API (`navigation` + `resource` entries + the paint timeline).
- Data: `audit/perf/gen-fixture.mjs` writes a 24-row fixture
  (`audit/perf/fixture-24.xml`) plus a ~28KB grey placeholder image at
  `public/assets/perf-placeholder.svg`, pasted into `.dev.vars` as
  `AUCTION_FIXTURE`. Pages measured: `/portal/auctions?make=NISSAN` (Live) and
  `/portal/history?make=NISSAN` (Auction History), signed in as the seeded
  member buyer.
- Raw captures: `audit/perf/baseline.json`, `audit/perf/after-fix1.json`.

**Two honesty caveats on the local numbers:**

1. **The font-hang magnitude is a sandbox artefact.** In this environment the
   outbound fetch to `fonts.googleapis.com` is throttled by the agent proxy and
   takes about 12.8 s. That is why baseline FCP is around 13 s. In production
   the same render-blocking fetch is roughly 300 to 800 ms (per PERFORMANCE.md
   #4). So the DIRECTION and MECHANISM of the font finding are real and the fix
   removes the render-block entirely, but do not read "12.7 s saved" as a
   production number. The production saving is a few hundred ms of white screen
   per page.
2. **The placeholder is a compressible SVG.** Its transfer size (about 530
   bytes gzipped) understates a real JDM JPEG (30 to 80 KB). So the image win
   below is reported as REQUEST COUNT, not bytes: each deferred request is a
   real ~30 to 80 KB photo in production.

## Before and after

### Live Auctions (`/portal/auctions?make=NISSAN`)

| Metric | Baseline | After | Change |
|---|---|---|---|
| First Contentful Paint | 12,880 ms | 128 ms | render-block removed |
| DOMContentLoaded | 12,971 ms | 115 ms | render-block removed |
| Image requests on initial load | 24 | 6 | only above-fold now |
| Total requests on initial load | 28 | 10 | fewer eager images |
| External render-blocking requests | 1 (blocking) | 1 (non-blocking) | font async |

### Auction History (`/portal/history?make=NISSAN`)

| Metric | Baseline | After | Change |
|---|---|---|---|
| First Contentful Paint | 13,320 ms | 172 ms | render-block removed |
| DOMContentLoaded | 13,343 ms | 127 ms | render-block removed |
| Image requests on initial load | 11 | 11 | already lazy (no change) |
| Total requests on initial load | 14 | 14 | unchanged |

Note: `loadEventEnd` stays near 12.9 s on both pages after the fix, because the
browser's load event still waits for the now-background font fetch to resolve
(or hang) in the sandbox. FCP and DOMContentLoaded are the "content is visible"
metrics, and both drop from about 13 s to about 0.13 s.

Why History's image count did not move: the History table and mobile cards
already used `<img loading="lazy">` (built that way in Phase 1). The eager-image
problem lived only in the shared card component `auctionCardV2`, which Live (and
Watchlist, Sold prices, and the staff live tab) render. So History gained only
the font win; Live gained both.

## What changed

### Fix 1a - card images defer properly (finding #3)

`src/auction-ui.js`. The card photo was a CSS `background-image` on `.ac-photo`,
which cannot be lazy-loaded, so all 24 fired on parse. Replaced with a real
`<img class="ac-photo-img" loading="lazy" decoding="async" width="320"
height="214" alt="">` absolutely positioned to fill the box behind the existing
overlays (grade badge, heart, gradient, link stay above by z-index). The
`.ac-photo` keeps its fixed 168px height and dark placeholder colour, so there
is no layout shift while a photo loads; `width`/`height` give the intrinsic 3:2
ratio. `alt=""` because the photo is decorative (the card title and link carry
the accessible name). The client-side Watchlist card template got the same
treatment, and its now-dead post-render `backgroundImage` assignment loop was
removed. Result: Live initial image requests 24 to 6.

### Fix 1b - fonts stop blocking first paint (finding #4)

`src/theme.js` (`brandDoc`, the member/public shell) and `src/admin.js`
(`shell`, the staff shell). The Inter stylesheet `<link rel="stylesheet">` was
render-blocking; `display=swap` was already in the URL but that governs the
font FILE swap, not the STYLESHEET fetch, so paint still waited. Switched both
to the non-blocking pattern: `media="print" onload="this.media='all'"` with a
`<noscript>` fallback. First paint no longer waits on the third-party fetch;
`display=swap` paints text in the fallback and swaps Inter in when it arrives.
CSP already allows this (`script-src 'unsafe-inline'` covers the onload;
`style-src`/`font-src` unchanged). Chosen over self-hosting because it is the
smaller change (no font binaries shipped); self-hosting the two or three Inter
weights remains the better long-term option because it would also drop the
third-party origin, and is noted for a later pass.

### Fix 2 - landed-cost batching confirmed, no change needed

Confirmed the Phase 2 batching eliminated the per-row calculator POST on both
tabs. The Live/History server render uses the rough local `carAudToLanded`
placeholder (`src/auction-history.js:323`), never a per-row `estimateLanded`.
The real figures are filled by ONE batched POST per page to the landed-batch
endpoint (`landedFillScript`), verified in the dev log as a single
`POST /portal/landed-batch` per load with no direct browser-to-calculator
calls. No per-row calls remain on either tab, so nothing was changed here.

## Fix 3 - relay full-scan LIKEs: investigated, deliberately NOT changed

**What the query does.** Each search fires TWO queries to the feed relay
(`src/auction-history-query.js:388-392`): `select count(*) from <table> where
<where>` and `select * from <table> where <where> order by ... limit ...`, with
the identical WHERE. Text filters are leading-wildcard, e.g. `UPPER(marka_name)
LIKE '%NISSAN%'`, `UPPER(model_name) LIKE '%...%'` (lines 268, 323 to 355).

**Where the cost sits: entirely REMOTE.** `query()` base64-encodes the SQL and
`fetch`es `env.API_BASE` (`src/avtonet.js:71-73`), a PHP relay in front of the
provider's MySQL. The scan runs on the provider's server. Our Worker owns no
index and cannot change the provider's schema. So there is nothing "local" to
optimise; the latency is the provider executing two full scans.

**Options, by risk:**

1. Anchor the LIKE to a prefix (`LIKE 'NISSAN%'`) so an index could serve it.
   **RISKY - ALTERS RESULTS, so STOP.** The Phase 1 engine deliberately matches
   substrings: the make matches the first token, the model OR-matches the grade
   string, house/variant/chassis are contained-in matches. Prefix-anchoring
   would silently drop lots whose term appears mid-string. Not done.
2. Skip the `count(*)` second scan when page 1 returns fewer than a full page
   (the total is then exactly the row count). Results-identical, halves the
   round-trips for the common narrow-search-one-page case. SAFE, but: it touches
   freshly-built, tested query code, and it CANNOT be validated in this
   environment (the local fixture short-circuits the relay and returns
   instantly, so there is no real scan latency to measure a saving against).
   Under the "measure before and after, revert what does not measurably help"
   rule, shipping an unmeasurable change to the query layer here is the wrong
   call. Left for a pass that can measure against the real relay.
3. Cache the lookup lists and whole responses (Cache API or KV, short TTL). The
   provider explicitly permits caching lookup lists. Results-identical within
   the TTL, but adds infrastructure and a staleness knob, and is likewise
   unmeasurable locally. This is PERFORMANCE.md's medium-effort item #1 and
   belongs in its own change with real-relay timing.
4. Provider-side indexes on `(marka_name, model_name)`, `(auction_date)`,
   `(finish)`. The only real fix for the scan itself, but it is the RELAY
   OWNER's database, not ours. This is a conversation to have, not code to
   write, and `docs/auction-history.md` already flags it.

**Decision:** no relay change in this pass. The one risky option is off the
table (it changes which lots return); the safe options cannot be measured in
this sandbox and touch tested Phase 1 code; the real fix is the provider's index
work. Recorded here for a follow-up that has real-relay timing.

## Deliberately left alone

- **The in-client "find a car" flow** (`src/admin.js`, the staff client-find
  page) still calls the calculator per result row (PERFORMANCE.md #2). It is
  NOT one of the two named tabs, so it is out of scope for this pass; it is the
  natural next candidate and would reuse the Phase 2 batch endpoint.
- **Self-hosting the Inter fonts.** Better long-term (drops the third-party
  origin) but ships font binaries; deferred as a larger change than the async
  fix.
- **The `queue` D1 indexes** (PERFORMANCE.md #8) need a migration, which the
  standing rules forbid without approval. Still recorded, not done.
- **History image loading** was already correct; no change made.

## Verification

- Search results unchanged on both tabs: the query/data layer
  (`auction-history-query.js`, `avtonet.js`, `calc.js`) is byte-identical to the
  Phase 1 baseline (`git diff feat/phase1-filtering -- <those files>` is empty);
  only three presentational files changed (`admin.js`, `auction-ui.js`,
  `theme.js`). All 24 fixture lots still render on both tabs.
- `npm test`: 576 pass, 0 fail (unchanged from the Phase 1 baseline).
- `npm run test:e2e`: passes against the dev server
  (`E2E_BASE_URL`, `E2E_ADMIN_PASSWORD=devadmin`,
  `PUPPETEER_EXECUTABLE_PATH` at the sandbox Chromium). One first run failed
  only because the harness defaults to a different admin password than the local
  `.dev.vars`; with the matching password it is green.

## Reproducing

```
node audit/perf/gen-fixture.mjs            # writes placeholder + fixture-24.xml
# paste fixture-24.xml (one line) into .dev.vars as AUCTION_FIXTURE, plus
# ADMIN_PASSWORD/ADMIN_TOKEN; then:
npm run db:migrate:local && npm run db:seed:local
npx wrangler d1 execute jdm-vehicle-finder --local --command "UPDATE clients SET member=1 WHERE id=9001"
npm run dev &
node audit/perf/measure.mjs baseline       # or after-fix1
```

The placeholder under `public/assets/` is local-only scaffolding and is not
committed.
