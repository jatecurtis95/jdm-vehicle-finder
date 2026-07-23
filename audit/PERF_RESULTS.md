# PERF_RESULTS.md - Phase 1/2 speed pass, before and after

Branch `perf/phase1-2-speed`, off `feat/phase1-filtering` (not main, since it
touches Phase 1 files). Measured 23 July 2026 against a local `wrangler dev`
with a 24-row auction fixture, using puppeteer-core and the pre-installed
Chromium. Standing rules from BUILD.md applied: smallest change per item, no
push to main, no migrations, no query-logic changes.

Two passes are recorded here. **Perf pass 2** (in-client find batching,
self-hosted Inter, and the count-scan write-up) is at the top; **perf pass 1**
(lazy card images, non-blocking fonts, batching confirmation, relay-LIKE
investigation) follows below and is unchanged.

---

# PERF PASS 2 (23 July 2026)

Extra measurement tool this pass: `audit/perf/slowcalc.mjs`, a local stand-in
for the landed-cost calculator, because the real
`calculator.jdmconnect.com.au` (like the feed relay) is unreachable in the
sandbox and fails fast, which would HIDE the server-side per-row blocking. It
responds after a set delay (300 ms used here) with the calc JSON shape and
exposes `GET /__count` to count calls, so a plain `curl` of a page reveals
exactly how many calculator calls its server render made. `.dev.vars` points
`CALC_API` at it. `audit/perf/measure-find.mjs` captures the staff find page.

## 1. In-client find flow - landed cost now deferred and batched

**The problem.** The staff "Find a car for a client" flow
(`src/admin.js`) called the calculator ONCE PER RESULT ROW during the page
render (`attachLanded` over up to 24 lots), so the HTML response blocked on
those calls. It was the last per-row caller after Phase 2 batched the tabs.

**The change.** The same deferred/batched path the tabs use: `staffFindCard`
renders a rough local placeholder (`carAudToLanded`, no network) tagged as a
`data-landed-slot`, and one batched `POST /admin/landed-batch?client=<id>`
fills the real figures after first paint (`landedFillScript`). The endpoint
resolves THAT client's state server-side (access-checked via
`clientAccessibleBy`, never trusted from the browser), so the estimate is
per-client exactly as before. The per-row `attachLanded` call is removed.

**Before and after** (staff find page, cold isolate, 300 ms stub calculator):

| Metric | Baseline | After | Change |
|---|---|---|---|
| Calculator calls during server render | 24 | 0 | deferred off the render path |
| TTFB (server first byte) | 2,241 ms | 277 ms | not blocked on the calculator |
| First Contentful Paint | 2,344 ms | 404 ms | " |
| Landed figures shown | 24 x A$50,000 | 24 x A$50,000 | identical (filled after paint) |

The 24-to-0 calls is deterministic (counted via the stub's `/__count` on a
`curl`, which runs no JS). The ~2 s TTFB saving scales with the real
calculator's per-call latency; 300 ms per call x 4 concurrency-6 waves is the
stand-in. The final figures are byte-identical to the old server-rendered
ones (A$50,000 from the stub); the only new thing on screen is the transient
`≈A$...` rough placeholder before the batch fills, matching the tabs. Locked
by a new assertion in `test/find-flow.test.mjs`.

## 2. Self-hosted Inter - drops the third-party origin and the swap flash

**The problem.** Pass 1 made the Google Fonts stylesheet non-render-blocking
(`media="print"` swap), which fixed FCP but left Inter arriving from a
third-party origin AFTER first paint, i.e. a visible fallback-to-Inter flash,
and in the sandbox the hung `fonts.googleapis.com` fetch kept the page's
`load` event pending for ~13 s.

**The change.** Self-hosted Inter woff2, latin subset, exactly the six weights
the CSS uses (300, 400, 500, 600, 700, 800), served from
`public/assets/fonts/` (SIL OFL-1.1, ~148 KB total). `@font-face` is inlined
in both shells via shared exports in `theme.js` (`FONT_FACE_CSS`,
`FONT_PRELOADS`); the above-the-fold weights (400/600/700) are `<link
rel="preload">`ed so Inter is ready by first paint, so there is no swap flash.
The Google `<link>` and both preconnects are gone from `brandDoc` (theme.js)
and the staff `shell` (admin.js), and the CSP drops
`fonts.googleapis.com`/`fonts.gstatic.com` to `style-src 'self'` /
`font-src 'self'`. Latin-ext was deliberately not shipped: the `latin` subset
already covers Latin-1 (a-y accents and the yen sign), which is complete for
this English/AU content; a rare exotic glyph falls back per-glyph.
Incidentally fixes a latent bug: the staff shell's old Google URL omitted
weight 800, which its CSS uses 18 times, so it was being faux-bolded.

**Before and after** (member pages; baseline column is pass 1's async-Google
state, so this isolates the self-host delta):

| Metric | Live (async Google) | Live (self-host) | History (async) | History (self-host) |
|---|---|---|---|---|
| First Contentful Paint | 128 ms | 160 ms | 172 ms | 128 ms |
| Load event end | 12,942 ms | 133 ms | 12,964 ms | 130 ms |
| External (cross-origin) requests | 1 | 0 | 1 | 0 |

FCP is unchanged within noise (it was already fixed in pass 1). The real
deltas: the page's `load` event now settles in ~130 ms instead of hanging on
the third-party fetch (a sandbox artefact in magnitude, but the third-party
DNS/TLS/round-trip it removes is real in production), and there are zero
cross-origin requests. The self-hosted woff2 add ~100 KB to page weight (the
honest cost of self-hosting), same-origin, preloaded and cached across pages.
The e2e smoke run dropped from ~89 s to ~20 s for the same reason (no hung
font fetch delaying `networkidle0`).

## 3. Duplicate count scan - written up, NOT implemented (no relay creds)

This session has no `AVTONET_CODE`, and the local fixture short-circuits the
relay (returns instantly, and its `count(*)` already yields a null total
locally), so there is no real relay latency to measure a saving against. Per
the "measure before and after, revert what does not measurably help" rule, and
the instruction to leave it if it cannot be validated live, it is NOT
implemented. What to change and how to verify:

**The change.** `runSearch` (`src/auction-history-query.js:388-392`) always
fires `count(*)` in parallel with the rows query. Fetch the rows first; when
`p.page === 1` and `rows.length < HISTORY_PER_PAGE`, the total IS
`rows.length` exactly, so skip the count query entirely; otherwise run it as
today. This halves the relay round-trips for every narrow search (the common
case, and the whole result fits on page one), preserves the exact "N sold
results" count display in all cases, and never changes which lots return.
Trade-off: on a full first page or a deep page (where the count is genuinely
needed) the two queries serialise instead of running in parallel, adding one
round-trip there; narrow searches dominate, so the average is a clear win.

An alternative, bigger change: query `LIMIT PER_PAGE + 1` and derive
`hasMore` from the extra row, dropping the count query ENTIRELY and forever.
That removes the exact total and the numbered pager (prev/next only), so it is
a product decision about the count display, not a pure perf change, and is out
of scope here.

**How to verify (needs a real `AVTONET_CODE`):**
1. Narrow search returning < 24 rows (e.g. a rare chassis code): confirm via
   `wrangler tail` that only ONE relay query fires (rows, no `count(*)`), the
   displayed total equals the row count, and TTFB is roughly halved vs today.
2. Broad search (> 24 results): confirm the count query still fires and
   "N sold results" is still correct.
3. Both cases: the returned lot set is byte-identical before and after
   (results unchanged) on Live and History, at several page depths.

---

# PERF PASS 1 (22-23 July 2026)

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

- **The in-client "find a car" flow** (`src/admin.js`) still called the
  calculator per result row here. DONE in perf pass 2 (section 1 above).
- **Self-hosting the Inter fonts.** DONE in perf pass 2 (section 2 above).
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
