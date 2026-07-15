// The merged Sold prices tab: one place for sold history, with the averages
// panel on top and the individual sold lots below, driven by the same
// filters (year range, grade/trim, time window). Feed calls are stubbed with
// the gateway's real shapes: unnamed aggregates come back as tag0..tagN.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { adminPage } from "../src/admin.js";
import { marketIntel } from "../src/market.js";
import { searchSold } from "../src/avtonet.js";

const ADMIN = { role: "admin", id: 0 };
const NOW = Date.parse("2026-07-15T00:00:00Z");
const SOLD_ROWS = `<aj>
<row><id>S1</id><marka_name>NISSAN</marka_name><model_name>SKYLINE</model_name><year>1999</year><grade>GT-R</grade><rate>4</rate><finish>2500000</finish><auction>USS Tokyo</auction><auction_date>2026-06-01T00:00:00</auction_date><kuzov>BNR34</kuzov><mileage>62000</mileage></row>
<row><id>S2</id><marka_name>NISSAN</marka_name><model_name>SKYLINE</model_name><year>2000</year><grade>GT-R V-SPEC</grade><rate>4.5</rate><finish>12850000</finish><auction>TAA Kinki</auction><auction_date>2026-05-20T00:00:00</auction_date><kuzov>BNR34</kuzov><mileage>88000</mileage></row>
</aj>`;

// Branch the stub on the decoded SQL: aggregate queries answer with unnamed
// tags (tag0..), row queries with sold rows. Returns every SQL seen.
function stubFeed() {
  const seen = [];
  globalThis.fetch = async (u) => {
    let q = null;
    try { q = new URL(String(u)).searchParams.get("q"); } catch (e) {}
    if (!q) throw new Error("offline"); // FX etc. fall back safely
    const sql = atob(q);
    seen.push(sql);
    let xml;
    if (sql.includes("min(FINISH)")) xml = "<aj><row><tag0>2500000</tag0><tag1>42</tag1><tag2>1000000</tag2><tag3>12850000</tag3></row></aj>";
    else if (sql.includes("AUCTION_DATE <")) xml = "<aj><row><tag0>2400000</tag0><tag1>3</tag1></row></aj>"; // weekly trend
    else if (sql.includes("count(*)")) xml = "<aj><row><tag0>42</tag0></row></aj>"; // similarity probes
    else if (sql.includes("FINISH,RATE")) xml = "<aj><row><finish>2500000</finish><rate>4</rate></row></aj>";
    else xml = SOLD_ROWS; // row queries: searchSold, comparables, lookups
    return { ok: true, status: 200, text: async () => xml };
  };
  return seen;
}

function env() {
  const e = makeEnv();
  e.API_BASE = "http://feed/api";
  e.AVTONET_CODE = "c";
  return e;
}
const cutoffFor = (days) => new Date(NOW - days * 86400000).toISOString().slice(0, 10);

// --- Query layer -------------------------------------------------------------

test("marketIntel applies year range and the chosen window to the stats SQL", async () => {
  const seen = stubFeed();
  const m = await marketIntel(env(), "NISSAN", "SKYLINE", NOW, { yearMin: 1995, yearMax: 2002, windowDays: 183 });
  const agg = seen.find((s) => s.includes("min(FINISH)"));
  assert.match(agg, /YEAR >= 1995/);
  assert.match(agg, /YEAR <= 2002/);
  assert.ok(agg.includes(`AUCTION_DATE >= '${cutoffFor(183)}'`), "6-month cutoff computed in JS");
  assert.equal(m.windowLabel, "last 6 months");
  assert.equal(m.count, 42);
  assert.equal(m.bars.length, 12, "the 12-week trend bars keep working");
});

test("marketIntel windowDays 0 means all time - no date cutoff at all", async () => {
  const seen = stubFeed();
  const m = await marketIntel(env(), "NISSAN", "SKYLINE", NOW, { windowDays: 0 });
  const agg = seen.find((s) => s.includes("min(FINISH)"));
  assert.doesNotMatch(agg, /AUCTION_DATE >=/);
  assert.equal(m.windowed, false);
  assert.equal(m.windowLabel, "all time");
});

test("marketIntel still falls back to all-time when the window has no sales", async () => {
  const seen = [];
  globalThis.fetch = async (u) => {
    const sql = atob(new URL(String(u)).searchParams.get("q"));
    seen.push(sql);
    let xml;
    // Windowed aggregate: zero sales; all-time aggregate: data.
    if (sql.includes("min(FINISH)")) {
      xml = sql.includes("AUCTION_DATE >=")
        ? "<aj><row><tag0>0</tag0><tag1>0</tag1><tag2>0</tag2><tag3>0</tag3></row></aj>"
        : "<aj><row><tag0>900000</tag0><tag1>7</tag1><tag2>500000</tag2><tag3>1400000</tag3></row></aj>";
    } else if (sql.includes("AUCTION_DATE <")) xml = "<aj><row><tag0>0</tag0><tag1>0</tag1></row></aj>";
    else if (sql.includes("count(*)")) xml = "<aj><row><tag0>7</tag0></row></aj>";
    else if (sql.includes("FINISH,RATE")) xml = "<aj><row><finish>900000</finish><rate>4</rate></row></aj>";
    else xml = SOLD_ROWS;
    return { ok: true, status: 200, text: async () => xml };
  };
  const m = await marketIntel(env(), "TOYOTA", "SPRINTER", NOW, { windowDays: 84 });
  assert.equal(m.windowed, false);
  assert.equal(m.windowLabel, "all time");
  assert.equal(m.count, 7);
});

test("searchSold takes the same grade and window filters", async () => {
  const seen = stubFeed();
  await searchSold(env(), { make: "NISSAN", model: "SKYLINE", yearMin: "1995", grade: "GT-R", windowDays: 366, nowMs: NOW });
  const sql = seen.find((s) => /from stats/i.test(s));
  assert.match(sql, /year >= 1995/);
  assert.match(sql, /UPPER\(grade\) LIKE '%GT\\-R%'|UPPER\(grade\) LIKE '%GT-R%'/);
  assert.ok(sql.includes(`auction_date >= '${cutoffFor(366)}'`));
});

// --- The merged tab ----------------------------------------------------------

test("Sold prices shows the averages panel AND the sold lots for one filter set", async () => {
  const seen = stubFeed();
  const html = await adminPage(makeEnvFeed(), "auctions", ADMIN, {
    tab: "prices",
    search: { make: "NISSAN", model: "SKYLINE", yearMin: "1995", yearMax: "2002", grade: "GT-R", window: "6m" },
  });
  assert.match(html, /Avg sold/);                 // marketPanel headline
  assert.match(html, /Market &middot; last 6 months/);
  assert.match(html, /42 sold/);
  assert.match(html, /Sold price/);               // the cards underneath
  assert.match(html, /¥12,850,000/);
  assert.match(html, /Sold at auction/);          // lots toolbar label
  assert.match(html, /Find live/, "cards link back to the live search");
  // The shell's inline scripts mention "A$" in comments; the rendered markup
  // is what must stay conversion-free.
  assert.doesNotMatch(html.replace(/<script[\s\S]*?<\/script>/g, ""), /A\$/, "the whole tab stays pure JPY");
  // The same filters reached both the averages and the lot browse.
  assert.ok(seen.some((s) => s.includes("min(FINISH)") && /YEAR >= 1995/.test(s)));
  assert.ok(seen.some((s) => /select \* from stats/i.test(s) && /year >= 1995/.test(s) && /UPPER\(grade\) LIKE/.test(s)));
  // Form state round-trips.
  assert.match(html, /name="yearMin"[^>]*value="1995"/);
  assert.match(html, /name="grade"[^>]*value="GT-R"/);
  assert.match(html, /<option value="6m" selected>/);
});

test("first load is useful: popular chips and the latest sold results", async () => {
  stubFeed();
  const html = await adminPage(makeEnvFeed(), "auctions", ADMIN, { tab: "prices", search: {} });
  assert.match(html, /Popular lookups/);
  assert.match(html, /tab=prices&(amp;)?make=NISSAN&(amp;)?model=SKYLINE/, "chips run the lookup in one tap");
  assert.match(html, /Latest sold results/);
  assert.match(html, /¥2,500,000/, "recent sold lots fill the page");
  assert.doesNotMatch(html, /Avg sold/, "no averages panel until a lookup runs");
});

test("make and model autocomplete via datalists; grades appear after a lookup", async () => {
  stubFeed();
  const blank = await adminPage(makeEnvFeed(), "auctions", ADMIN, { tab: "prices", search: {} });
  assert.match(blank, /<datalist id="auc-makers">/);
  assert.match(blank, /list="auc-makers"/);
  assert.match(blank, /<datalist id="auc-models">/);
  assert.match(blank, /list="auc-models"/);
  const searched = await adminPage(makeEnvFeed(), "auctions", ADMIN, { tab: "prices", search: { make: "NISSAN", model: "SKYLINE" } });
  assert.match(searched, /<datalist id="auc-grades">.*<option/, "grade suggestions load for the selection");
});

test("the tab bar is consolidated: Live, Watchlist, Sold prices, Auction history", async () => {
  stubFeed();
  const html = await adminPage(makeEnvFeed(), "auctions", ADMIN, { tab: "live", search: {} });
  assert.match(html, />Live auctions</);
  assert.match(html, />Watchlist/);
  assert.match(html, />Sold prices</);
  assert.match(html, />Auction history</);
  assert.doesNotMatch(html, />Sold auctions</, "the fifth tab is gone");
});

// makeEnv + feed credentials; kept at the bottom because tests above read
// clearer without it inline.
function makeEnvFeed() {
  const e = makeEnv();
  e.API_BASE = "http://feed/api";
  e.AVTONET_CODE = "c";
  return e;
}
