// Auction History (member page): server-side validation of every query
// parameter, the filter -> stats SQL mapping, sorting, real-count pagination,
// membership/permission gating, and the empty / error / loading states.
// The stats feed is stubbed so no network is hit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import worker from "../src/index.js";
import { sessionCookie } from "../src/auth.js";
import { auctionHistoryPage } from "../src/auction-history.js";
import { auctionLotPage, requestAuctionLot, adminAuctionsPage } from "../src/admin.js";
import {
  validateHistoryParams, buildHistoryWhere, searchHistory,
  validateLiveParams, buildAuctionWhere, searchLive,
} from "../src/auction-history-query.js";

const ROWS = `<aj>
<row><id>H1</id><lot>4021</lot><auction>USS Tokyo</auction><auction_date>2026-06-01T00:00:00</auction_date><marka_name>NISSAN</marka_name><model_name>SKYLINE</model_name><year>1999</year><kuzov>BNR34</kuzov><grade>GT-R V-SPEC</grade><color>Bayside Blue</color><mileage>62000</mileage><rate>4.5</rate><eng_v>2600</eng_v><kpp>F6</kpp><priv>4WD</priv><finish>12850000</finish><images>https://img.ajes.com/imgs/s1#https://img.ajes.com/imgs/p1#https://img.ajes.com/imgs/p2</images></row>
<row><id>H2</id><lot>5150</lot><auction>TAA Kinki</auction><auction_date>2026-05-20T00:00:00</auction_date><marka_name>TOYOTA</marka_name><model_name>CROWN</model_name><year>1998</year><kuzov>JZS155</kuzov><grade>ROYAL SALOON</grade><color>Pearl</color><mileage>83000</mileage><rate>4</rate><eng_v>3000</eng_v><kpp>FA</kpp><priv></priv><finish>1180000</finish><images></images></row>
</aj>`;

// Stub the relay: count(*) queries answer with `count`, row queries with
// `rows`. Non-relay fetches (the FX service) throw, exercising the safe
// fallbacks. Returns the decoded SQL of every relay call for assertions.
function stubFeed({ rows = ROWS, count = 2, fail = false } = {}) {
  const seen = [];
  globalThis.fetch = async (u) => {
    let q = null;
    try { q = new URL(String(u)).searchParams.get("q"); } catch (e) {}
    if (!q) throw new Error("offline");
    const sql = atob(q);
    seen.push(sql);
    if (fail) throw new Error("relay down");
    const xml = /count\(\*\)/i.test(sql) ? `<aj><row><TAG0>${count}</TAG0></row></aj>` : rows;
    return { ok: true, status: 200, text: async () => xml };
  };
  return seen;
}

function env() {
  const e = makeEnv(`INSERT INTO users (id,name,portal_enabled,member) VALUES
    (1,'Member Mike',1,1),(2,'Free Fred',1,0),(3,'Off Olive',0,0);`);
  e.API_BASE = "http://feed/api";
  e.AVTONET_CODE = "c";
  e.ADMIN_TOKEN = "unit-test-signing-key";
  return e;
}
const MEMBER = { role: "client", id: 1 };
const FREE = { role: "client", id: 2 };
const statsSql = (seen) => seen.filter((s) => /from stats/i.test(s));

// --- Parameter validation ---------------------------------------------------

test("every query parameter is validated or dropped server-side", () => {
  const p = validateHistoryParams({
    sort: "evil", page: "abc", range: "2y", transmission: "STEPTRONIC",
    drivetrain: "hover", body: "spaceship", fuel: "coal", colour: "<script>",
    eligibility: "yes", mileageMax: "chicken", engineMin: "-5", engineMax: "0",
  });
  assert.equal(p.sort, "newest");
  assert.equal(p.page, 1);
  assert.equal(p.range, "");
  assert.equal(p.transmission, "");
  assert.equal(p.drivetrain, "");
  assert.equal(p.body, "");
  assert.equal(p.fuel, "");
  assert.equal(p.colour, "");
  assert.equal(p.eligibility, "");
  assert.equal(p.mileageMax, null);
  assert.equal(p.engineMin, null);
  assert.equal(p.engineMax, null);
});

test("numeric bounds: page clamps, engine range swaps when inverted", () => {
  assert.equal(validateHistoryParams({ page: "999999" }).page, 200);
  assert.equal(validateHistoryParams({ page: "-4" }).page, 1);
  const p = validateHistoryParams({ engineMin: "3000", engineMax: "1500" });
  assert.equal(p.engineMin, 1500);
  assert.equal(p.engineMax, 3000);
  // Case-insensitive whitelists still accept mixed-case input.
  assert.equal(validateHistoryParams({ transmission: "Manual" }).transmission, "manual");
});

test("a hostile make value cannot break out of the SQL literal", () => {
  const p = validateHistoryParams({ make: "NIS'SAN; DROP TABLE stats --" });
  const w = buildHistoryWhere(p).join(" AND ");
  assert.ok(!w.includes(";"), "no statement separator survives");
  assert.ok(!w.includes("--"), "no SQL comment survives");
  assert.match(w, /NIS''SAN/, "quotes are doubled inside the literal");
});

// --- Filter -> SQL mapping ---------------------------------------------------

test("all thirteen filters map to their stats columns", () => {
  const now = Date.UTC(2026, 6, 14);
  const p = validateHistoryParams({
    make: "NISSAN", model: "SKYLINE", range: "6m", transmission: "manual",
    drivetrain: "4wd", mileageMax: "100000", engineMin: "1500", engineMax: "3000",
    house: "USS", body: "coupe", fuel: "diesel", colour: "white", eligibility: "eligible",
  });
  const w = buildHistoryWhere(p, now).join(" AND ");
  assert.match(w, /finish > 0/, "sold rows only");
  assert.match(w, /UPPER\(marka_name\) LIKE '%NISSAN%'/);
  assert.match(w, /UPPER\(model_name\) LIKE '%SKYLINE%'/);
  const cutoff = new Date(now - 183 * 86400000).toISOString().slice(0, 10);
  assert.ok(w.includes(`auction_date >= '${cutoff}'`), "6 months = 183 days back");
  assert.match(w, /UPPER\(kpp\) LIKE '%MT%' OR UPPER\(kpp\) IN \('F3', 'F4', 'F5', 'F6', 'F7', 'C4', 'C5'\)/);
  assert.match(w, /UPPER\(priv\) LIKE '%4WD%'/);
  assert.match(w, /\(mileage > 0 AND mileage <= 100000\)/, "unknown odometers excluded under a ceiling");
  assert.match(w, /eng_v >= 1500/);
  assert.match(w, /eng_v <= 3000/);
  assert.match(w, /UPPER\(auction\) LIKE '%USS%'/);
  assert.match(w, /UPPER\(model_name\) LIKE '%COUPE%' OR UPPER\(grade\) LIKE '%COUPE%'/);
  assert.match(w, /UPPER\(grade\) LIKE '%DIESEL%'/);
  assert.match(w, /UPPER\(color\) LIKE '%WHITE%'/);
  assert.ok(w.includes(`year <= ${2026 - 26}`), "eligible = 26+ years old, boundary year excluded");
});

// --- V1.4 filters: year, chassis code, auction grade, price, mileage floor,
// --- variant keyword ---------------------------------------------------------

test("year, mileage and price ranges are bounded and swap when inverted", () => {
  const p = validateHistoryParams({ yearMin: "2005", yearMax: "1998", mileageMin: "90000", mileageMax: "40000", priceMin: "5000000", priceMax: "1000000" });
  assert.equal(p.yearMin, 1998);
  assert.equal(p.yearMax, 2005);
  assert.equal(p.mileageMin, 40000);
  assert.equal(p.mileageMax, 90000);
  assert.equal(p.priceMin, 1000000);
  assert.equal(p.priceMax, 5000000);
  const junk = validateHistoryParams({ yearMin: "1800", yearMax: "3000", mileageMin: "0", priceMin: "-5", priceMax: "chicken" });
  assert.equal(junk.yearMin, null);
  assert.equal(junk.yearMax, null);
  assert.equal(junk.mileageMin, null);
  assert.equal(junk.priceMin, null);
  assert.equal(junk.priceMax, null);
});

test("auction grade accepts only whitelisted scores, from string or repeats", () => {
  assert.equal(validateHistoryParams({ rates: "4,4.5,evil,;DROP" }).rates, "4,4.5");
  assert.equal(validateHistoryParams({ rates: ["4.5", "R", "junk"] }).rates, "r,4.5", "canonical order is R, RA, 2..S");
  assert.equal(validateHistoryParams({ rates: "RA" }).rates, "ra");
  assert.equal(validateHistoryParams({ rates: "4.5,4.5,4" }).rates, "4,4.5", "deduped and canonical order");
  assert.equal(validateHistoryParams({}).rates, "");
});

// --- Phase 1: the full pill set and the RA2 exact-string trap ----------------

test("the grade pill set covers R, RA, 2, 3, 3.5, 4, 4.5, 5, 6, S in order", () => {
  const p = validateHistoryParams({ rates: "s,6,2,r,ra" });
  assert.equal(p.rates, "r,ra,2,6,s", "new scores accepted, canonical order kept");
});

test("the RA pill also matches RA2, so an RA2 lot cannot vanish silently", () => {
  const w = buildHistoryWhere(validateHistoryParams({ rates: "ra" })).join(" AND ");
  assert.match(w, /UPPER\(rate\) IN \('RA', 'RA2'\)/);
  // The 2 pill stays a pure condition-2 match: RA2 is an accident-repair
  // grade, not a clean 2.
  const w2 = buildHistoryWhere(validateHistoryParams({ rates: "2" })).join(" AND ");
  assert.match(w2, /UPPER\(rate\) IN \('2'\)/);
});

test("grade 6 and S map to exact spellings pending the feed check", () => {
  const w = buildHistoryWhere(validateHistoryParams({ rates: "6,s" })).join(" AND ");
  assert.match(w, /UPPER\(rate\) IN \('6', 'S'\)/);
});

test("the new filters map to their stats columns", () => {
  const p = validateHistoryParams({
    yearMin: "1995", yearMax: "2002", kuzov: "BNR34", rates: "4.5,r",
    mileageMin: "20000", priceMin: "1000000", priceMax: "15000000", variant: "V-SPEC",
  });
  const w = buildHistoryWhere(p).join(" AND ");
  assert.match(w, /year >= 1995/);
  assert.match(w, /\(year > 0 AND year <= 2002\)/, "unknown build years excluded under a ceiling");
  assert.match(w, /UPPER\(kuzov\) LIKE '%BNR34%'/);
  assert.match(w, /UPPER\(rate\) IN \('R', '4\.5'\)/);
  assert.match(w, /mileage >= 20000/);
  assert.match(w, /finish >= 1000000/);
  assert.match(w, /finish <= 15000000/);
  assert.match(w, /UPPER\(grade\) LIKE '%V-SPEC%'/);
});

test("hostile chassis-code and variant values stay inside the SQL literal", () => {
  const p = validateHistoryParams({ kuzov: "BNR'; DROP--", variant: "GT'R; --" });
  const w = buildHistoryWhere(p).join(" AND ");
  assert.ok(!w.includes(";"), "no statement separator survives");
  assert.ok(!w.includes("--"), "no SQL comment survives");
  assert.match(w, /BNR''/);
  assert.match(w, /GT''R/);
});

test("the form exposes the new filters and the grade multi-select", async () => {
  stubFeed();
  const html = await auctionHistoryPage(env(), MEMBER, {});
  for (const name of ["yearMin", "yearMax", "kuzov", "mileageMin", "priceMin", "priceMax", "variant"]) {
    assert.match(html, new RegExp(`name="${name}"`), `${name} filter is available`);
  }
  assert.match(html, /type="checkbox" name="rates" value="4\.5"/, "grade scores are multi-select");
  assert.match(html, /type="checkbox" name="rates" value="ra"/i);
});

test("the new filters render as removable chips", async () => {
  stubFeed();
  const html = await auctionHistoryPage(env(), MEMBER, {
    yearMin: "1995", yearMax: "2002", kuzov: "BNR34", rates: "4.5,r", priceMax: "15000000", variant: "V-SPEC",
  });
  assert.match(html, /aria-label="Remove From 1995 filter"/);
  assert.match(html, /aria-label="Remove To 2002 filter"/);
  assert.match(html, /aria-label="Remove BNR34 filter"/);
  assert.match(html, /aria-label="Remove Grade R, 4.5 filter"/);
  assert.match(html, /aria-label="Remove Under ¥15,000,000 filter"/);
  assert.match(html, /aria-label="Remove &quot;V-SPEC&quot; filter"/);
});

test("repeated rates params survive the member route", async () => {
  const e = env();
  const seen = stubFeed();
  const cookie = (await sessionCookie(e, "client", 1)).split(";")[0];
  const res = await worker.fetch(new Request("https://jdmfinder.com.au/portal/history?rates=4.5&rates=r", {
    headers: { Cookie: cookie },
  }), e, {});
  assert.equal(res.status, 200);
  assert.ok(statsSql(seen).some((s) => /UPPER\(rate\) IN \('R', '4\.5'\)/.test(s)), "both scores reach the query");
});

// --- Phase 1: auction house multi-select and the include-unspecified toggle --

test("multiple auction houses become one OR-group; the legacy house param still works", () => {
  const multi = buildHistoryWhere(validateHistoryParams({ houses: ["USS Tokyo", "TAA Kinki"] })).join(" AND ");
  assert.match(multi, /\(UPPER\(auction\) LIKE '%USS TOKYO%' OR UPPER\(auction\) LIKE '%TAA KINKI%'\)/);
  const legacy = buildHistoryWhere(validateHistoryParams({ house: "USS" })).join(" AND ");
  assert.match(legacy, /UPPER\(auction\) LIKE '%USS%'/);
  const merged = validateHistoryParams({ houses: "USS Tokyo", house: "USS Tokyo" });
  assert.equal(merged.houses, "USS Tokyo", "deduped case-insensitively");
});

test("include-unspecified defaults ON: blank colour/drivetrain/fuel fields stay in", () => {
  const p = validateHistoryParams({ colour: "white", drivetrain: "4wd", fuel: "diesel" });
  assert.equal(p.unspec, true);
  const w = buildHistoryWhere(p).join(" AND ");
  assert.match(w, /\(color IS NULL OR color = '' OR \(UPPER\(color\) LIKE '%WHITE%'\)\)/);
  assert.match(w, /\(priv IS NULL OR priv = '' OR \(UPPER\(priv\) LIKE '%4WD%'/);
  assert.match(w, /\(grade IS NULL OR grade = '' OR \(UPPER\(grade\) LIKE '%DIESEL%'\)\)/);
});

test("unticking include-unspecified excludes blank fields instead", () => {
  const p = validateHistoryParams({ colour: "white", drivetrain: "2wd", fuel: "petrol", unspec: ["0"] });
  assert.equal(p.unspec, false);
  const w = buildHistoryWhere(p).join(" AND ");
  assert.doesNotMatch(w, /color IS NULL/);
  assert.match(w, /priv <> ''/, "strict 2WD needs a listed drivetrain");
  assert.match(w, /grade <> ''/, "strict petrol needs listed trim text");
  // The hidden-0-plus-ticked-1 form submit still means ON.
  assert.equal(validateHistoryParams({ unspec: ["0", "1"] }).unspec, true);
});

test("petrol means none of the listed fuel keywords; 2WD means not-4WD or blank", () => {
  const w = buildHistoryWhere(validateHistoryParams({ fuel: "petrol", drivetrain: "2wd" })).join(" AND ");
  assert.match(w, /UPPER\(grade\) NOT LIKE '%DIESEL%'/);
  assert.match(w, /UPPER\(grade\) NOT LIKE '%HYBRID%'/);
  assert.match(w, /priv IS NULL OR priv = ''/);
  assert.match(w, /UPPER\(priv\) NOT LIKE '%4WD%'/);
});

test("no filters means only the sold-row guard - no accidental narrowing", () => {
  assert.deepEqual(buildHistoryWhere(validateHistoryParams({})), ["finish > 0"]);
});

// --- Phase 1: the same engine drives the Live Auctions tabs ------------------

test("live mode: upcoming RHD lots, start-price semantics, closing-soonest default", async () => {
  const seen = stubFeed();
  const p = validateLiveParams({ priceMin: "500000", priceMax: "3000000" });
  await searchLive(env(), p);
  const sql = seen.find((s) => /from main/i.test(s) && /order by/i.test(s));
  assert.match(sql, /auction_date >= NOW\(\)/);
  assert.match(sql, /\(lhdrive IS NULL OR lhdrive <> 1\)/, "LHD lots never surface");
  assert.match(sql, /\(\(start > 0 AND start >= 500000\) OR start <= 0\)/, "POA lots stay in under a price floor");
  assert.match(sql, /\(\(start > 0 AND start <= 3000000\) OR start <= 0\)/, "POA lots stay in under a price ceiling");
  assert.match(sql, /order by auction_date ASC/);
  assert.ok(seen.some((s) => /count\(\*\)/i.test(s) && /from main/i.test(s)), "live gets a real COUNT(*) too");
});

test("live mode: held-within is history-only and legacy gradeMin maps to pills", () => {
  const p = validateLiveParams({ range: "6m", gradeMin: "4" });
  assert.equal(p.range, "", "no auction-held-within over upcoming lots");
  assert.equal(p.rates, "4,4.5,5,6", "numeric pills at or above the old floor; letter grades stay out, as the numeric compare always did");
  const w = buildAuctionWhere(p).join(" AND ");
  assert.match(w, /UPPER\(rate\) IN \('4', '4\.5', '5', '6'\)/);
});

test("live mode: a start-price sort excludes POA rows, like the mileage sort", () => {
  const w = buildAuctionWhere(validateLiveParams({ sort: "price_asc" })).join(" AND ");
  assert.match(w, /start > 0/);
});

test("the member live tab runs the shared engine with pills and houses applied", async () => {
  const e = env();
  const seen = stubFeed();
  const cookie = (await sessionCookie(e, "client", 1)).split(";")[0];
  const res = await worker.fetch(new Request("https://jdmfinder.com.au/portal/auctions?make=NISSAN&rates=ra&houses=USS+Tokyo&houses=TAA+Kinki", {
    headers: { Cookie: cookie },
  }), e, {});
  assert.equal(res.status, 200);
  const mainSql = seen.filter((s) => /from main/i.test(s));
  assert.ok(mainSql.some((s) => /UPPER\(rate\) IN \('RA', 'RA2'\)/.test(s)), "RA2 stays reachable from the live tab");
  assert.ok(mainSql.some((s) => /UPPER\(auction\) LIKE '%USS TOKYO%' OR UPPER\(auction\) LIKE '%TAA KINKI%'/.test(s)), "both houses reach the query as an OR-group");
});

// --- Sorting and pagination --------------------------------------------------

test("searchHistory sorts by the whitelisted key and defaults to newest", async () => {
  let seen = stubFeed();
  await searchHistory(env(), validateHistoryParams({ sort: "price_asc" }));
  assert.match(statsSql(seen).find((s) => /order by/.test(s)), /order by finish ASC/);
  seen = stubFeed();
  await searchHistory(env(), validateHistoryParams({ sort: "nonsense" }));
  assert.match(statsSql(seen).find((s) => /order by/.test(s)), /order by auction_date DESC/);
});

test("the mileage sort excludes unknown odometers so 0 km can't rank first", async () => {
  const seen = stubFeed();
  await searchHistory(env(), validateHistoryParams({ sort: "mileage_asc" }));
  const sql = statsSql(seen).find((s) => /order by/.test(s));
  assert.match(sql, /mileage > 0/);
  assert.match(sql, /order by mileage ASC/);
});

test("pagination is LIMIT/OFFSET against the feed with a real COUNT(*)", async () => {
  const seen = stubFeed({ count: 100 });
  const r = await searchHistory(env(), validateHistoryParams({ page: "3" }));
  assert.match(statsSql(seen).find((s) => /limit/.test(s)), /limit 48, 24/);
  assert.ok(statsSql(seen).some((s) => /count\(\*\)/.test(s)), "a count query ran");
  assert.equal(r.total, 100);
  assert.equal(r.pageCount, 5);
  assert.equal(r.page, 3);
  assert.equal(r.hasMore, true);
});

test("a failed count only costs the numbered pager, not the page", async () => {
  const seen = [];
  globalThis.fetch = async (u) => {
    let q = null; try { q = new URL(String(u)).searchParams.get("q"); } catch (e) {}
    if (!q) throw new Error("offline");
    const sql = atob(q); seen.push(sql);
    if (/count\(\*\)/.test(sql)) throw new Error("count exploded");
    return { ok: true, status: 200, text: async () => ROWS };
  };
  const r = await searchHistory(env(), validateHistoryParams({}));
  assert.equal(r.ok, true);
  assert.equal(r.total, null);
  assert.equal(r.lots.length, 2);
});

test("a relay outage flags ok:false instead of pretending 0 results", async () => {
  stubFeed({ fail: true });
  const r = await searchHistory(env(), validateHistoryParams({}));
  assert.equal(r.ok, false);
  assert.equal(r.lots.length, 0);
});

// --- Permissions ---------------------------------------------------------

test("unauthenticated /portal/history redirects to login", async () => {
  stubFeed();
  const res = await worker.fetch(new Request("https://jdmfinder.com.au/portal/history"), env(), {});
  assert.equal(res.status, 303);
  assert.match(res.headers.get("Location"), /\/login/);
});

test("a signed-in member reaches the page through the route with filters applied", async () => {
  const e = env();
  const seen = stubFeed();
  const cookie = (await sessionCookie(e, "client", 1)).split(";")[0];
  const res = await worker.fetch(new Request("https://jdmfinder.com.au/portal/history?make=NISSAN&sort=price_desc", {
    headers: { Cookie: cookie },
  }), e, {});
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<h1>Auction history<\/h1>/);
  assert.ok(statsSql(seen).some((s) => /UPPER\(marka_name\) LIKE '%NISSAN%'/.test(s)));
  assert.ok(statsSql(seen).some((s) => /order by finish DESC/.test(s)));
});

test("non-members get the upsell and the feed is never queried for them", async () => {
  const seen = stubFeed();
  const html = await auctionHistoryPage(env(), FREE, {});
  assert.match(html, /members feature/i);
  assert.match(html, /\/portal\/subscribe/);
  assert.ok(!/name="make"/.test(html), "no search form for non-members");
  assert.equal(statsSql(seen).length, 0, "no stats query ran");
});

test("a revoked/disabled portal account sees access ended, not data", async () => {
  const seen = stubFeed();
  const html = await auctionHistoryPage(env(), { role: "client", id: 3 }, {});
  assert.match(html, /isn't active right now/);
  assert.equal(statsSql(seen).length, 0);
});

// --- Page rendering --------------------------------------------------------

test("every filter sits in one always-visible panel - nothing folds (Phase 1)", async () => {
  stubFeed();
  const html = await auctionHistoryPage(env(), MEMBER, {});
  assert.match(html, /method="GET" action="\/portal\/history"/, "searches are bookmarkable URLs");
  for (const label of ["4 weeks", "6 weeks", "3 months", "6 months", "12 months"]) {
    assert.match(html, new RegExp(`>${label}<`), `${label} date shortcut stays visible`);
  }
  const form = html.match(/<form class="ahx-filter"[\s\S]*?<\/form>/)[0];
  assert.doesNotMatch(form, /<details/, "no collapsed sections in the filter panel");
  assert.doesNotMatch(form, /More filters/, "the More filters fold is gone");
  for (const name of ["make", "model", "range", "transmission", "drivetrain", "mileageMax", "engineMin", "engineMax", "houses", "body", "fuel", "colour", "eligibility", "unspec"]) {
    assert.match(form, new RegExp(`name="${name}"`), `${name} filter is available`);
  }
  // The keyword-inference filters carry the as-listed caveat and the
  // include-unspecified toggle defaults to ticked.
  assert.match(form, /\(as listed\)/);
  assert.match(form, /may exclude incomplete listings/);
  assert.match(form, /name="unspec" value="1" checked/);
  // The full grade pill row, in the visible Ben launch-plan order (R, RA..S, grade 1 kept).
  const rateOrder = [...form.matchAll(/name="rates" value="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(rateOrder, ["r", "ra", "1", "2", "3", "3.5", "4", "4.5", "5", "6", "s"]);
  // Auction houses are a multi-select of checkboxes, not a single select.
  assert.match(form, /type="checkbox" name="houses"/);
  assert.doesNotMatch(form, /<select name="house"/);
});

test("each result shows the full record summary and links to the auction record", async () => {
  stubFeed();
  const html = await auctionHistoryPage(env(), MEMBER, {});
  assert.match(html, /1999 Nissan Skyline/);
  assert.match(html, /GT-R V-SPEC/);
  assert.match(html, /Manual \(F6\)/, "gearbox code is decoded");
  assert.match(html, /4WD/);
  assert.match(html, /2,600 cc/);
  assert.match(html, /62,000 km/);
  assert.match(html, /USS Tokyo/);
  assert.match(html, /Lot 4021/);
  assert.match(html, /1 Jun 2026/);
  assert.match(html, /Grade 4.5/);
  assert.match(html, /class="ahx-sold">Sold</);
  assert.match(html, /¥12,850,000/);
  assert.match(html, /Est. landed/);
  assert.match(html, /Eligible/);
  assert.match(html, /\/portal\/auctions\/lot\?id=H1/, "links to the full auction record");
  assert.match(html, /img.ajes.com\/imgs\/p1&amp;w=320|img.ajes.com\/imgs\/p1&w=320/, "car photo, not the inspection sheet");
});

test("the mobile card layout from the example is preserved", async () => {
  stubFeed();
  const html = await auctionHistoryPage(env(), MEMBER, {});
  assert.match(html, /class="ahx-mobile"/);
  assert.match(html, /class="ahx-rcard"/);
  assert.match(html, /<dt>Gearbox \/ drive<\/dt>/);
  assert.match(html, /<dt>Odometer<\/dt>/);
  assert.match(html, /<dt>Sold price<\/dt>/);
});

test("active filters render as removable chips with a clear-all action", async () => {
  stubFeed();
  const html = await auctionHistoryPage(env(), MEMBER, { make: "NISSAN", transmission: "manual", range: "6m" });
  assert.match(html, /class="ahx-chip"/);
  assert.match(html, /aria-label="Remove Nissan filter"/);
  assert.match(html, /aria-label="Remove Manual filter"/);
  assert.match(html, /aria-label="Remove Last 6 months filter"/);
  // Removing the make chip keeps the other filters in the URL.
  assert.match(html, /href="\/portal\/history\?range=6m&amp;transmission=manual"/);
  assert.match(html, /href="\/portal\/history">Clear all filters</);
});

test("the result count, sort controls and numbered pager render from the real total", async () => {
  stubFeed({ count: 100 });
  const html = await auctionHistoryPage(env(), MEMBER, { page: "3" });
  assert.match(html, /100 sold results/);
  assert.match(html, /Page 3 of 5/);
  assert.match(html, /aria-current="page"[^>]*>3</);
  assert.match(html, /sort=price_asc/, "sort links carry the whitelisted keys");
  assert.match(html, /class="ahx-sort on"[^>]*>Newest</, "default sort is marked active");
});

test("re-submitting the form keeps a non-default sort", async () => {
  stubFeed();
  const html = await auctionHistoryPage(env(), MEMBER, { sort: "price_desc" });
  assert.match(html, /<input type="hidden" name="sort" value="price_desc">/);
});

test("empty results offer a way out; an outage never reads as empty", async () => {
  stubFeed({ rows: "<aj></aj>", count: 0 });
  const emptyFiltered = await auctionHistoryPage(env(), MEMBER, { make: "NISSAN" });
  assert.match(emptyFiltered, /No sold results match those filters/);
  assert.match(emptyFiltered, /Clear all filters/);
  stubFeed({ fail: true });
  const down = await auctionHistoryPage(env(), MEMBER, {});
  assert.match(down, /can't reach the live auction feed/);
  assert.match(down, /feed unavailable/);
  assert.doesNotMatch(down, /No sold results/);
});

test("the page ships a loading state for searches and result navigation", async () => {
  stubFeed();
  const html = await auctionHistoryPage(env(), MEMBER, {});
  assert.match(html, /data-ahx-form/);
  assert.match(html, /Searching\.\.\./);
  assert.match(html, /aria-busy/);
});

test("invalid query params degrade to defaults instead of erroring", async () => {
  const e = env();
  const seen = stubFeed();
  const cookie = (await sessionCookie(e, "client", 1)).split(";")[0];
  const res = await worker.fetch(new Request("https://jdmfinder.com.au/portal/history?sort=DROP&page=zzz&fuel=coal&engineMin=-9&range=99weeks", {
    headers: { Cookie: cookie },
  }), e, {});
  assert.equal(res.status, 200);
  const sql = statsSql(seen).find((s) => /order by/.test(s));
  assert.match(sql, /order by auction_date DESC/);
  assert.match(sql, /limit 0, 24/);
  assert.doesNotMatch(sql, /DROP|coal|99weeks/);
});

test("members see Auction history in the portal navigation", async () => {
  stubFeed();
  const html = await auctionHistoryPage(env(), MEMBER, {});
  assert.match(html, /href="\/portal\/history"[^>]*>.*Auction history/s);
});

test("a page beyond the last one says so instead of contradicting the count", async () => {
  stubFeed({ rows: "<aj></aj>", count: 60 }); // 60 results = 3 pages
  const html = await auctionHistoryPage(env(), MEMBER, { page: "50" });
  assert.match(html, /gone past the last page/);
  assert.match(html, /Back to the first page/);
  assert.doesNotMatch(html, /No sold results to show right now/);
  assert.doesNotMatch(html, /Page 50 of 3/, "no nonsensical pager on an out-of-range page");
});

// --- The linked auction record for a sold lot -------------------------------

test("the linked record for a sold lot shows the sold price and offers no bid", async () => {
  stubFeed(); // fetchLot falls back to the stats row (H1, finish > 0)
  const html = await auctionLotPage(env(), MEMBER, "H1");
  assert.match(html, /Sold price/);
  assert.match(html, /¥12,850,000/);
  assert.match(html, /already sold at auction/);
  assert.match(html, /Find one like this live/);
  // The shared watch script embeds these strings in inert JS; the rendered
  // markup is what must not offer them (same convention as sold.test.mjs).
  const markup = html.replace(/<script[\s\S]*?<\/script>/g, "");
  assert.doesNotMatch(markup, /action="\/portal\/auctions\/request"/, "no bid form on a sold record");
  assert.doesNotMatch(markup, /Save to watchlist/, "no watchlist heart on a sold record");
});

test("a bid request on a sold lot is refused server-side", async () => {
  stubFeed();
  const r = await requestAuctionLot(env(), 1, "H1");
  assert.equal(r.ok, false);
  assert.equal(r.error, "sold");
});

// --- Staff surface (Admin -> Auctions -> Auction history) -------------------

test("staff get the same Auction History as a tab in the Auctions workspace", async () => {
  const seen = stubFeed({ count: 37 });
  const html = await adminAuctionsPage(env(), { role: "admin", id: 0 }, {
    tab: "history",
    rawQuery: { make: "NISSAN", sort: "price_asc" },
  });
  assert.match(html, />Auction history</, "the tab is in the strip");
  assert.match(html, /name="view" value="auctions"/, "the form posts back into the workspace");
  assert.match(html, /name="tab" value="history"/);
  assert.match(html, /37 sold results/);
  assert.match(html, /1999 Nissan Skyline/);
  assert.match(html, /\/admin\?view=auctionlot&(amp;)?lot=H1/, "record links stay in the staff app");
  assert.doesNotMatch(html, /portal\/auctions\/lot/, "no member-portal links on the staff surface");
  assert.ok(statsSql(seen).some((s) => /UPPER\(marka_name\) LIKE '%NISSAN%'/.test(s)), "filters apply");
  assert.ok(statsSql(seen).some((s) => /order by finish ASC/.test(s)), "sorting applies");
});

test("the staff history tab needs no membership and other tabs are unchanged", async () => {
  stubFeed();
  const html = await adminAuctionsPage(env(), { role: "admin", id: 0 }, { tab: "history", rawQuery: {} });
  assert.doesNotMatch(html, /members feature/i);
  const live = await adminAuctionsPage(env(), { role: "admin", id: 0 }, {});
  assert.match(live, /Search live Japanese auctions/, "the live tab still renders its own search header");
});

// --- Dealer surface (V1.4: /dealer/history in the dealer portal) -------------

function dealerEnv() {
  const e = makeEnv(`INSERT INTO suppliers (id, email, name, company, pass_salt, pass_hash, active)
    VALUES (9, 'd@x', 'Dealer Dan', 'Dan Motors', 's', 'h', 1);`);
  e.API_BASE = "http://feed/api";
  e.AVTONET_CODE = "c";
  e.ADMIN_TOKEN = "unit-test-signing-key";
  return e;
}

test("dealers reach Auction history at /dealer/history with filters applied", async () => {
  const e = dealerEnv();
  const seen = stubFeed();
  const cookie = (await sessionCookie(e, "dealer", 9)).split(";")[0];
  const res = await worker.fetch(new Request("https://jdmfinder.com.au/dealer/history?make=NISSAN&rates=4.5&rates=r", {
    headers: { Cookie: cookie },
  }), e, {});
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<h1>Auction history<\/h1>/);
  assert.match(html, /1999 Nissan Skyline/);
  assert.match(html, /¥12,850,000/);
  assert.ok(statsSql(seen).some((s) => /UPPER\(marka_name\) LIKE '%NISSAN%'/.test(s)));
  assert.ok(statsSql(seen).some((s) => /UPPER\(rate\) IN \('R', '4\.5'\)/.test(s)), "the multi-select survives the dealer route");
});

test("the dealer surface offers no staff or member record links", async () => {
  const e = dealerEnv();
  stubFeed();
  const cookie = (await sessionCookie(e, "dealer", 9)).split(";")[0];
  const res = await worker.fetch(new Request("https://jdmfinder.com.au/dealer/history", { headers: { Cookie: cookie } }), e, {});
  const html = await res.text();
  assert.doesNotMatch(html, /portal\/auctions\/lot/, "no member links");
  assert.doesNotMatch(html, /view=auctionlot/, "no staff links");
  assert.doesNotMatch(html, /View record/);
  assert.doesNotMatch(html, /Find live/);
  assert.match(html, /action="\/dealer\/history"/, "the form posts back to the dealer route");
});

test("the dealer sidebar links both portal pages and marks history active", async () => {
  const e = dealerEnv();
  stubFeed();
  const cookie = (await sessionCookie(e, "dealer", 9)).split(";")[0];
  const res = await worker.fetch(new Request("https://jdmfinder.com.au/dealer/history", { headers: { Cookie: cookie } }), e, {});
  const html = await res.text();
  assert.match(html, /href="\/dealer\/portal"[^>]*>.*Submitted stock/s);
  assert.match(html, /class="active"[^>]*href="\/dealer\/history"/);
  assert.match(html, /Sold prices/, "the item says what it shows");
});

test("clients and staff cannot reach the dealer history route", async () => {
  const e = dealerEnv();
  stubFeed();
  const anon = await worker.fetch(new Request("https://jdmfinder.com.au/dealer/history"), e, {});
  assert.equal(anon.status, 303, "anonymous is sent to login");
  const clientCookie = (await sessionCookie(e, "client", 1)).split(";")[0];
  const asClient = await worker.fetch(new Request("https://jdmfinder.com.au/dealer/history", { headers: { Cookie: clientCookie } }), e, {});
  assert.notEqual(asClient.status, 200, "a client session is redirected away");
});
