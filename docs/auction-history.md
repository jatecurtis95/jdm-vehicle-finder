# Auction History (member page)

Production design for the `/portal/history` page, built from the reviewed
concept on `codex/auction-history-example` (`src/auction-history-example.js`).
The concept page used fabricated rows and its own standalone shell; this page
uses the real sold-auction feed inside the buyer-portal shell.

## Data source

Historical sold results come from the AVTONET SQL-over-HTTP relay - the same
feed the matcher, the member "Sold auctions" page and the market panels use
(`src/avtonet.js`). It is queried as:

    <API_BASE>?code=<AVTONET_CODE>&q=<base64 SELECT>

The gateway permits SELECT against two tables only:

| Table   | Contents                                    |
|---------|---------------------------------------------|
| `main`  | live/upcoming lots                          |
| `stats` | historical sold results (`finish` = hammer) |

Provider rules honoured (as everywhere else in this codebase): query with
filters each run, always `LIMIT`ed; never mirror the table locally; lookup
lists (makers, houses) may be cached. Nothing is downloaded to the browser
beyond the rendered page - requirement 12 is satisfied by filtered,
paginated SQL, not client-side filtering.

Columns used (the `main` column list is confirmed live in
`avtonet.js MAIN_COLUMNS`; `stats` is the same feed family and is already
rendered through `fetchLot`/`auctionLotPage` with these fields):

| Column         | Meaning                          | Used for                       |
|----------------|----------------------------------|--------------------------------|
| `id`           | feed lot id                      | detail link                    |
| `lot`          | lot number at the house          | display                        |
| `auction`      | auction house name               | filter + display               |
| `auction_date` | sale date/time                   | date-range filter, sort        |
| `marka_name`   | make                             | filter + display               |
| `model_name`   | model                            | filter + display               |
| `grade`        | variant/trim string              | display, fuel/body keywords    |
| `year`         | build year                       | eligibility filter, sort       |
| `eng_v`        | engine capacity (cc)             | engine min/max filter          |
| `kpp`          | gearbox as listed (FA, F5, AT..) | transmission filter            |
| `priv`         | drivetrain as listed (4WD, ...)  | drivetrain filter              |
| `mileage`      | odometer (km, 0 = unknown)       | max-mileage filter, sort       |
| `color`        | colour as listed                 | colour filter                  |
| `rate`         | auction condition score          | display ("Grade 4.5")          |
| `finish`       | hammer price JPY (>0 = sold)     | sold price, price sort         |
| `kuzov`        | chassis / model code             | display                        |
| `images`       | "#"-joined CDN photo URLs        | thumbnail                      |

QA / offline: setting `AUCTION_FIXTURE` (feed XML) bypasses the relay
entirely, exactly like every other feed consumer, so tests and local QA run
deterministically with no network.

### Live-QA checklist (one-time, before enabling for members)

`kpp`, `priv`, `eng_v` and `color` are confirmed columns of `main`; they are
expected in `stats` (the single-lot fetch already `SELECT *`s stats rows and
renders transmission/engine/colour). Because a WHERE on a missing column
would error the whole query, run one probe per column on the live relay
(`select count(*) from stats where kpp <> ''` etc.) before launch. If a
column is missing from `stats`, remove the clause that references it in
`buildHistoryWhere` (`src/auction-history-query.js`) and drop the matching
select from the form in `src/auction-history.js`.

Known follow-up: the make/model/house dropdowns reuse the existing live-feed
lookup lists (`main`), so a make or house that only exists in old sold data
isn't offered in the dropdown - though a shared URL that names it still
filters correctly. Sourcing the lists from `stats` needs a provider
conversation about DISTINCT query cost first.

## Endpoint and response format

One server-rendered endpoint (the app is fully server-rendered; there is no
separate JSON API surface for members):

    GET /portal/history?<filters>   -> text/html (portal shell)

Because the form submits with GET, every search is a bookmarkable,
shareable URL (requirement 10).

Accepted query parameters - everything else is discarded, every value is
validated/coerced server-side (`validateHistoryParams`):

| Param          | Validation                                              |
|----------------|----------------------------------------------------------|
| `make`         | string <= 40 chars, SQL-escaped, first token used        |
| `model`        | string <= 60 chars, SQL-escaped                          |
| `range`        | whitelist: `4w` `6w` `3m` `6m` `12m`                     |
| `transmission` | whitelist: `manual` `automatic` `cvt`                    |
| `drivetrain`   | whitelist: `4wd` `2wd`                                   |
| `mileageMax`   | int, 1..1,000,000                                        |
| `engineMin/Max`| int cc, 1..20,000; swapped if min > max                  |
| `house`        | string <= 40 chars, SQL-escaped                          |
| `body`         | whitelist: `coupe` `sedan` `hatch` `wagon` `van` `suv` `truck` `convertible` |
| `fuel`         | whitelist: `petrol` `diesel` `hybrid` `electric`         |
| `colour`       | whitelist of common feed colours (LIKE match)            |
| `eligibility`  | whitelist: `eligible`                                    |
| `sort`         | whitelist: `newest` (default) `price_asc` `price_desc` `mileage_asc` `year_desc` |
| `page`         | int 1..200 (bounds the relay OFFSET scan)                |

Internal query contract (`searchHistory(env, params)`):

    {
      lots,       // rows for this page (<= 24)
      total,      // real COUNT(*) for the filters, or null if the count failed
      page, perPage, pageCount,
      hasMore,    // fallback pager signal when total is null
      ok,         // false = relay unreachable -> error state, never "0 results"
    }

Two relay queries per search: `select count(*) from stats where ...` and
`select <columns> from stats where ... order by ... limit <offset>,24`.

## Database indexes

The history dataset lives on the provider's MySQL gateway, not in our D1
database, so no D1 migration ships with this page and there are no local
indexes to add. What "indexed queries" means here:

* Every query is anchored on the columns the provider serves filtered
  queries for today (the sold page, market panels and matcher already filter
  on `marka_name`, `model_name`, `auction_date`, `finish`, `year`, `rate`,
  `mileage`, `auction`) plus `LIMIT offset,24`.
* Provider-side indexes that keep these access paths cheap:
  `(marka_name, model_name)`, `(auction_date)`, `(finish)`. Raise with the
  relay owner if history queries slow down.
* `page` is capped at 200 so the OFFSET scan is bounded.
* The two lookup lists on the form (makers, houses) reuse the existing
  12h/1h per-isolate caches (`distinctMakers`, `distinctHouses`) - no new
  feed load.

## Authentication / subscription rules

Identical to the existing member auction surfaces (`/portal/auctions`,
`/portal/sold`):

1. No session -> `GET /portal/history` is in the protected `/portal/*`
   family -> 303 to `/login`.
2. Session with role `client` -> row must match
   `SELECT * FROM clients WHERE id = ? AND portal_enabled = 1`; otherwise
   the "access ended" shell renders and no feed query runs.
3. `clients.member = 1` (the paid Full-access flag, set by the Stripe
   subscription webhook or staff toggle) is required to see data. A
   non-member gets the members-feature upsell state - the relay is never
   queried for them.
4. Admin/agent/dealer sessions never reach `/portal/*` (role routing in
   `index.js`); staff have their own Auctions workspace.

## Image and record-link resolution

* **Photos**: `lot.images` is a "#"-separated list of CDN base URLs
  (`*.ajes.com`). `splitImages(lot)` drops the inspection sheet;
  `imageUrls(lot).medium` (`&w=320`) is the card/table thumbnail, lazily
  loaded. Missing photo -> neutral "No photo" placeholder block. The CSP
  already allows `img-src https:`; the `/assets/lot-img` proxy remains an
  email-only concern.
* **Full auction record**: each result links to
  `/portal/auctions/lot?id=<lot.id>` - the existing lot detail page.
  `fetchLot` reads `main` first then falls back to `stats`, so sold lots
  render their gallery, inspection sheet, specs and market panel, and the
  page re-checks the same membership gate itself.

## Filter -> SQL mapping notes

Documented because two filters are keyword-derived (the feed has **no
structured body-type or fuel column** - confirmed against the live `main`
column list):

* **Transmission** (`kpp`): manual = `%MT%` or floor/column manual codes
  (`F3`..`F7`, `C4`, `C5`); automatic = `%AT%` or `FA`/`CA`/`A`;
  cvt = `%CVT%`. The token sets live in one exported constant
  (`KPP_GROUPS`) for easy tuning after live QA.
* **Drivetrain** (`priv`): `4wd` = `%4WD%`/`%AWD%`/`%4X4%`; `2wd` = empty or
  none of those.
* **Fuel**: keyword match over `grade`: diesel `%DIESEL%`; hybrid
  `%HYBRID%`/`%E-POWER%`/`%PHV%`; electric `%ELECTRIC%`/`%BEV%`; petrol =
  none of the fuel keywords. Best-effort by nature; the option labels say
  so ("Diesel (listed)").
* **Body type**: keyword match over `model_name` + `grade` (van, wagon,
  truck, coupe, sedan, hatchback, SUV/cross, convertible/roadster/cabrio).
  Same best-effort caveat, same labelling.
* **Import eligibility**: derived from `year`, mirroring
  `auctionEligibility` - "Eligible" filters to builds 26+ calendar years
  old, so the ambiguous 25-year boundary year is never asserted as eligible
  (launch-audit rule). Newer lots always render "Check eligibility".
* **Auction date**: `4w`=28, `6w`=42, `3m`=92, `6m`=183, `12m`=366 days back
  from today (UTC date), `auction_date >= '<cutoff>'`.
* **Mileage**: `mileage <= N AND mileage > 0` - unknown odometers (feed 0)
  are excluded only while a max-mileage filter (or mileage sort) is active.
