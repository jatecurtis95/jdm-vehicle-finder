// V1.3 Phase 4: comparable sales must be genuinely comparable.
//
//  * Within the matched similarity tier, comparables are ranked by proximity
//    to the subject car (nearby year, then similar mileage), not just
//    whatever sold most recently.
//  * When a model code (or grade) was requested but has no sold records, the
//    panel must SAY it fell back to the wider model line instead of quietly
//    presenting unrelated cars as comparables.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv, readFile } from "./helpers/d1.mjs";
import { marketIntel, marketPanel } from "../src/market.js";

const NOW = Date.parse("2026-06-26T00:00:00Z");

function feedEnv() {
  const env = makeEnv(readFile("seed/seed-dev.sql"));
  env.API_BASE = "http://feed.test/api";
  env.AVTONET_CODE = "c";
  return env;
}

// Recent rows spread across years and mileages; the subject car is a 2005 with
// about 100,000 km, so the 2005/98k row is the best comparable even though the
// 2020 row sold most recently (it comes first in feed order).
const RECENT_ROWS = [
  { year: 2020, km: 20000, finish: 900000 },
  { year: 1998, km: 220000, finish: 150000 },
  { year: 2005, km: 98000, finish: 420000 },
  { year: 2006, km: 130000, finish: 380000 },
].map((r) => `<row><marka_name>SUBARU</marka_name><model_name>IMPREZA</model_name><year>${r.year}</year><grade>WRX</grade><rate>4</rate><auction_date>2026-06-20 10:00</auction_date><finish>${r.finish}</finish><mileage>${r.km}</mileage><kuzov>GDB</kuzov></row>`).join("");

function stubFeed({ kuzovTierCount }) {
  globalThis.fetch = async (url) => {
    const sql = atob(new URL(url).searchParams.get("q"));
    let rows = "<row></row>";
    if (sql.includes("select count(*)")) {
      // The kuzov-narrowed probe: parameterised so tests can starve the tier.
      const narrowed = sql.includes("KUZOV") || sql.includes("GRADE) LIKE");
      rows = `<row><tag0>${narrowed ? kuzovTierCount : 40}</tag0></row>`;
    } else if (sql.includes("min(FINISH)")) {
      rows = "<row><tag0>400000</tag0><tag1>40</tag1><tag2>150000</tag2><tag3>900000</tag3></row>";
    } else if (sql.includes("AUCTION_DATE <")) {
      rows = "<row><tag0>300000</tag0><tag1>2</tag1></row>";
    } else if (sql.includes("select FINISH,RATE")) {
      rows = "<row><finish>420000</finish><rate>4</rate></row>";
    } else if (sql.includes("marka_name,model_name,year")) {
      rows = RECENT_ROWS;
    }
    return { ok: true, status: 200, text: async () => `<aj>${rows}</aj>` };
  };
}

test("comparables rank by year and mileage proximity to the subject car", async () => {
  stubFeed({ kuzovTierCount: 12 });
  const m = await marketIntel(feedEnv(), "SUBARU", "IMPREZA", NOW, {
    kuzov: "GDB", year: "2005", mileage: "100000",
  });
  assert.equal(m.similarity, "model code GDB");
  assert.ok(m.recent.length >= 3);
  assert.equal(String(m.recent[0].year), "2005", "the 2005/98k car is the closest comparable");
  assert.equal(String(m.recent[1].year), "2006", "the 2006/130k car comes second");
  assert.notEqual(String(m.recent[0].year), "2020", "the freshest-but-dissimilar car must not lead");
});

test("without subject context the feed's recency order is preserved", async () => {
  stubFeed({ kuzovTierCount: 12 });
  const m = await marketIntel(feedEnv(), "SUBARU", "IMPREZA", NOW, { kuzov: "GDB" });
  assert.equal(String(m.recent[0].year), "2020", "no subject car = keep newest-sold-first order");
});

test("a starved model-code tier is reported as a fallback, not passed off as similar", async () => {
  stubFeed({ kuzovTierCount: 0 });
  const m = await marketIntel(feedEnv(), "SUBARU", "IMPREZA", NOW, { kuzov: "FL5" });
  assert.equal(m.similarity, "", "the bare model line was used");
  assert.match(String(m.fallback || ""), /model code FL5/, "the panel data records what could not be matched");
  const html = marketPanel(m, 95);
  assert.match(html, /No sold records match model code FL5/i, "the panel says so out loud");
  assert.match(html, /guide only/i, "and frames the wider figures as a guide");
});

test("no fallback note when nothing narrower was requested", async () => {
  stubFeed({ kuzovTierCount: 0 });
  const m = await marketIntel(feedEnv(), "SUBARU", "IMPREZA", NOW);
  assert.ok(!m.fallback, "no narrowing requested = no fallback flag");
  assert.ok(!/No sold records match/.test(marketPanel(m, 95)));
});
