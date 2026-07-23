# PERFORMANCE.md - why the site is slow (diagnosis only, nothing fixed)

Written 22 July 2026 by static analysis of the codebase at `f414a2d` plus the
Phase 1 branch. No running site, no profiler and no production logs were
available from this session, so there are no measured timings here - each
finding names the mechanism, where it lives, and what evidence would confirm
it. Ranked by expected impact against effort.

**One premise correction first:** the brief asked about "Supabase CDN image
loading". There is no Supabase anywhere in this codebase (zero references).
Auction images are served straight from the auction provider's CDN
(`img.ajes.com`, URL suffixes `&h=50` / `&w=320` per the provider's rules)
and landing/static assets from the Worker's own `public/assets`. The image
findings below are about those two sources.

## Ranking

| # | Finding | Impact | Effort |
|---|---|---|---|
| 1 | Relay round trips dominate every auction page | HIGH | MEDIUM |
| 2 | In-client find calls the calculator once per result row | HIGH (that page) | LOW |
| 3 | Live/watch card images load eagerly as CSS backgrounds | MEDIUM-HIGH | LOW |
| 4 | Google Fonts CSS render-blocks first paint | MEDIUM | LOW |
| 5 | Phase 2 design risk: real landed costs on 24-row pages | MEDIUM (future) | design item |
| 6 | Matcher cron bursts feed + calculator subrequests | MEDIUM (invisible) | MEDIUM |
| 7 | Cold isolates dump all lookup caches | LOW-MEDIUM | folds into #1 |
| 8 | D1 queue table missing client_id / lot_id indexes | LOW today | LOW (migration - needs approval) |
| 9 | Inline CSS/JS re-shipped on every navigation | LOW | not worth it yet |

---

### 1. Relay round trips dominate every auction page (HIGH / MEDIUM)

Every Live Auctions or Auction History load makes 4 to 8 HTTPS calls to the
feed relay (`jdm-relay.php` on shared PHP hosting, SQL base64-encoded in the
query string). The waves are already parallelised
(`auctionHistoryContent` / `liveSearchBlock`), but the page still waits for
two sequential waves, each as slow as its slowest query:

- Wave 1: `distinctMakers`, `distinctHouses`, FX, `COUNT(*)`, page of rows.
- Wave 2 (make chosen): `distinctModels`, `distinctModelCodes`,
  `distinctGrades` (grades itself is two queries: main + stats).

Two structural problems sit under that:

- **Every filtered query is a full scan on the provider's MySQL.** All text
  filters are leading-wildcard (`LIKE '%NISSAN%'`), which no index serves,
  and the `COUNT(*)` runs the same scan a second time. `stats` is the big
  table; docs/auction-history.md already flags asking the relay owner for
  indexes on `(marka_name, model_name)`, `(auction_date)`, `(finish)`.
- **The lookup caches are per-isolate** (makers 12h, houses 1h, models/codes
  12h in Maps). Cloudflare recycles isolates constantly, so real users pay
  the full lookup set far more often than the TTLs suggest (see #7).

What would confirm it: `wrangler tail` timings around `query()`, or timing
one relay call by hand; expect 200 to 800 ms each on shared PHP hosting.

Cheapest wins, in order: move the lookup lists to KV or the Cache API with
the same TTLs (provider explicitly allows caching lookup lists) so they
survive isolates; skip the `COUNT(*)` when page 1 returns fewer than 24 rows
(the count is knowable from the rows); short-TTL cache (60 to 120 s) on
whole relay responses keyed by SQL via the Cache API - repeat searches and
pagination become near-free without violating the no-mirroring rule. The
provider-side index conversation is the only fix for cold search latency
itself.

### 2. In-client find calls the calculator once per result row (HIGH on that page / LOW)

`src/admin.js:5398` (the client-page "find a car" flow): every search with
results runs `attachLanded()` over the WHOLE result page - up to 24 lots,
each an individual POST to `calculator.jdmconnect.com.au/api/calc`
(`estimateLanded`, no batch endpoint), at concurrency 6 with a 6 s timeout.
That is ceil(24/6) = 4 serial waves of external POSTs before the page
renders: roughly 1.5 to 4 s added on a healthy calculator, and up to
24 s of hang if the calculator is struggling (each wave can burn its own
timeout). Nothing is cached: the same lot searched twice costs twice.

Contrast: the staff Matches view already solved this pattern properly
(`admin.js:1259-1271`) - it snapshots the estimate into `lot_json` at queue
time and only computes legacy rows, capped at 40 per load. The find flow
predates that discipline.

Fixes, cheapest first: cache estimates per (lot id, state, config) in the
isolate or KV with a short TTL; or render the page immediately and fill the
landed figures client-side from a small endpoint; or snapshot like Matches
does. This is also the dress rehearsal for #5.

### 3. Live/watch card images load eagerly as CSS backgrounds (MEDIUM-HIGH / LOW)

`auctionCardV2` puts the lot photo on `.ac-photo` as a CSS
`background-image` (`src/auction-ui.js:122`). CSS backgrounds cannot use
native `loading="lazy"`, so a 24-card Live page fetches all 24 provider-CDN
images (`&w=320`, roughly 30 to 80 KB each - call it 1 to 2 MB) the moment
the HTML parses, competing with everything else on the connection. The
cards' `content-visibility:auto` defers rendering cost but not the fetches.
The History table and mobile cards already do this right (`<img
loading="lazy">` at `auction-history.js`).

Fix: swap the background for a real `<img loading="lazy" decoding="async">`
inside `.ac-photo` (object-fit cover) in `auctionCardV2` and the client-side
watch-card template that mirrors it. Small, contained, big bandwidth win on
mobile.

### 4. Google Fonts CSS render-blocks first paint (MEDIUM / LOW)

`brandDoc()` (`src/theme.js:437`) links the Inter stylesheet from
`fonts.googleapis.com` in `<head>`. The preconnects and `display=swap` are
already there, but the stylesheet fetch itself still blocks render: DNS +
TLS + CSS from one origin, then the WOFF2 from a second. On a cold mobile
connection that chain is commonly 300 to 800 ms of white screen for every
page, portal and admin alike.

Fix options (pick one): self-host the two or three Inter weights actually
used as WOFF2 under `public/assets` (best; kills both third-party origins),
or load the stylesheet asynchronously (`media="print"` +
`onload="media='all'"` with a noscript fallback). Everything else in the
head is inline and non-blocking.

### 5. Phase 2 design risk: real landed costs on list pages (MEDIUM, future)

Today the History "Est. landed" column is `carAudToLanded()` - pure local
arithmetic (x1.13 + $9,000), zero network cost, which is why History renders
fast despite showing a landed figure on every row. Phase 2 replaces the
rough figure with the real calculator. If that lands as "call
`estimateLanded` per visible row", every History and Live page inherits
finding #2 times 24. The Phase 2 build must therefore include the caching or
deferred-fill design up front (short-TTL cache keyed by lot + state +
config, or client-side fill after first paint), not as an afterthought.

### 6. Matcher cron bursts (MEDIUM but invisible to users / MEDIUM)

Each cron run (4x/day) walks every active wishlist: one feed query per
wishlist (`matcher.js`), then `attachLanded` over the fresh candidates (one
calculator POST each, concurrency 6), then notifications. Nobody sees this
latency directly, but the Worker invocation has a subrequest budget
(1,000 on paid plans), and wishlist growth multiplies feed + calculator +
email subrequests inside one scheduled invocation. Symptoms when it bites:
matcher runs that silently stop partway, missing matches with no error page
anywhere. Worth confirming from `wrangler tail` during a cron tick. Fixes
when needed: estimate caching (shared with #2/#5), chunking wishlists across
multiple scheduled invocations, and per-run counters logged at the end.

### 7. Cold isolates dump every cache (LOW-MEDIUM / folds into #1)

`_fxCache`, `_makersCache`, `_modelsCache`, `_codesCache`, `_gradesCache`,
`_housesCache` are all module-level Maps. Any isolate recycle (deploys,
idleness, load balancing) resets the lot, so the "first request pays
everything" case from #1 recurs all day. The KV/Cache-API move in #1 fixes
this as a side effect. Not a separate work item.

### 8. D1: queue has no client_id or lot_id index (LOW today / LOW)

Auction-path D1 queries are light (clients by primary key, a bid-count per
member page, the queued-badge lookup `WHERE lot_id IN (...)` on the staff
live tab), but the `queue` table is only indexed on `status` and `token`
(`migrations/0001_baseline.sql:104-105`). `queue.client_id` and
`queue.lot_id` are filtered in several hot paths (portal pages, badges,
dedup checks) and rely on full scans. Harmless at hundreds of rows,
worth two indexes before the table grows past tens of thousands.
**Requires a migration, so per the standing rules it is recorded here, not
done.** Suggested when approved: `CREATE INDEX idx_queue_client ON
queue(client_id); CREATE INDEX idx_queue_lot ON queue(lot_id);`

### 9. Inline everything (LOW / leave alone)

Every page ships the full theme CSS plus feature CSS and scripts inline -
roughly 50 to 100 KB of HTML per navigation and no cross-page caching. That
is a deliberate, reasonable trade for a server-rendered Worker app (one
round trip, no asset pipeline), and gzip absorbs most of it. Only worth
revisiting if real metrics show HTML download time mattering; do not
restructure speculatively.

### Not findings (checked and fine)

- The landing page already preloads its hero with `srcset`/`fetchpriority`
  and has an image-optimisation script; `public/assets` totals ~3.9 MB but
  nothing suggests it ships wholesale to any single page.
- Worker cold start itself (bundle parse) is a JS isolate in the low
  milliseconds; the bundle has no heavy dependencies. Setting
  `minify = true` in `wrangler.toml` is a free nicety, nothing more.
- The Phase 1 engine bounds every relay query (`LIMIT`, page cap 200,
  houses cap 15), so no new unbounded scan was introduced.

## Suggested order of attack

1. #3 and #4 (an afternoon each, purely additive, visible on every page).
2. #2 (one contained function, and it de-risks #5's design).
3. #1 KV lookup caches + count skip (medium; biggest single latency win).
4. #5 as part of the Phase 2 build, not after it.
5. #8 indexes whenever a migration window is already open.
6. #6 only when `wrangler tail` shows a cron run near its budget.
