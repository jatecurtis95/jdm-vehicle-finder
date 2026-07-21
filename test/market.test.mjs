// Market intelligence: computed from the historical `stats` feed and rendered
// into a self-contained panel. The vendor gateway aliases aggregates as
// TAG0..TAGn (lowercased to tag0.. by our parser); these tests pin that mapping
// and the panel's empty/populated states without hitting the network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv, readFile } from "./helpers/d1.mjs";
import { marketIntel, marketPanel, priceTiers, gradeTier } from "../src/market.js";

const NOW = Date.parse("2026-06-26T00:00:00Z");

function feedEnv() {
  const env = makeEnv(readFile("seed/seed-dev.sql"));
  env.API_BASE = "http://feed.test/api";
  env.AVTONET_CODE = "c";
  return env;
}

// Branch the stubbed feed on the decoded SQL so each query type gets sane rows.
function stubFeed() {
  globalThis.fetch = async (url) => {
    const sql = atob(new URL(url).searchParams.get("q"));
    let rows = "<row></row>";
    if (sql.includes("min(FINISH)")) rows = "<row><tag0>371567</tag0><tag1>120</tag1><tag2>3000</tag2><tag3>1462000</tag3></row>";
    else if (sql.includes("AUCTION_DATE <")) rows = "<row><tag0>300000</tag0><tag1>5</tag1></row>";
    else if (sql.includes("select FINISH,RATE")) rows = [550000, 40000, 155000, 184000, 10000].map((f, i) => `<row><finish>${f}</finish><rate>${i % 2 ? "4" : "3.5"}</rate></row>`).join("");
    else if (sql.includes("marka_name,model_name,year")) rows = "<row><marka_name>NISSAN</marka_name><model_name>DAYZ</model_name><year>2021</year><grade>2WD</grade><rate>4</rate><auction_date>2026-06-25 10:00</auction_date><finish>550000</finish></row>";
    return { ok: true, status: 200, text: async () => `<aj>${rows}</aj>` };
  };
}

test("marketIntel maps aggregates, median, trend, grade mix and comparables", async () => {
  stubFeed();
  const m = await marketIntel(feedEnv(), "NISSAN", "DAYZ", NOW);
  assert.equal(m.count, 120);
  assert.equal(m.avg, 371567);
  assert.equal(m.low, 3000);
  assert.equal(m.high, 1462000);
  assert.equal(m.median, 155000); // median of [10000,40000,155000,184000,550000]
  assert.equal(m.bars.length, 12);
  assert.ok(m.bars.every((b) => b.avg === 300000));
  assert.ok(m.gradeMix.length > 0);
  assert.equal(m.recent[0].model, "DAYZ");
  // Stubbed sample is all 3.5/4-graded, so exactly one tier: Grade 3 - 4.
  assert.equal(m.tiers.length, 1);
  assert.equal(m.tiers[0].label, "Grade 3 - 4");
  assert.equal(m.tiers[0].count, 5);
  assert.equal(m.tiers[0].median, 155000);
});

test("gradeTier bands condition scores and priceTiers keeps repaired sales apart", () => {
  assert.equal(gradeTier("R"), "rep");
  assert.equal(gradeTier("RA"), "rep");
  assert.equal(gradeTier("S"), "top");
  assert.equal(gradeTier("6"), "top");
  assert.equal(gradeTier("5"), "top");
  assert.equal(gradeTier("4.5"), "top");
  assert.equal(gradeTier("4"), "mid");
  assert.equal(gradeTier("3"), "mid");
  assert.equal(gradeTier("2"), ""); // rough cars join no tier
  assert.equal(gradeTier("***"), "");
  assert.equal(gradeTier(""), "");

  const rows = [
    { finish: "100", rate: "R" }, { finish: "200", rate: "RA" },
    { finish: "300", rate: "3" }, { finish: "400", rate: "3.5" }, { finish: "500", rate: "4" },
    { finish: "600", rate: "4.5" }, { finish: "700", rate: "5" }, { finish: "800", rate: "S" }, { finish: "900", rate: "6" },
    { finish: "999", rate: "***" }, { finish: "998", rate: "" }, { finish: "997", rate: "2" },
    { finish: "0", rate: "4" }, // unsold/priceless rows never count
  ];
  const t = priceTiers(rows);
  assert.deepEqual(t.map((x) => x.key), ["top", "mid", "rep"]);
  assert.deepEqual(t.map((x) => x.count), [4, 3, 2]);
  assert.equal(t[0].median, 750); // 600,700,800,900
  assert.equal(t[1].median, 400);
  assert.equal(t[2].median, 150);
  assert.equal(t[0].low, 600);
  assert.equal(t[0].high, 900);
  assert.deepEqual(priceTiers([]), []);
});

test("marketIntel returns null when make or model is missing", async () => {
  stubFeed();
  assert.equal(await marketIntel(feedEnv(), "", "DAYZ", NOW), null);
  assert.equal(await marketIntel(feedEnv(), "NISSAN", "", NOW), null);
});

test("marketPanel renders headline figures and comparables in pure JPY, empty when no data", async () => {
  stubFeed();
  const m = await marketIntel(feedEnv(), "NISSAN", "DAYZ", NOW);
  const html = marketPanel(m);
  assert.match(html, /Market &middot; last 12 weeks/);
  assert.match(html, /371,567/);
  assert.doesNotMatch(html, /A\$/, "sold prices are never converted to AUD");
  assert.match(html, /Median by condition/);
  assert.match(html, /Grade 3 - 4/);
  assert.match(html, /Recent comparable sales/);
  assert.match(html, /Dayz/); // model is title-cased for display
  assert.equal(marketPanel(null), "");
  assert.equal(marketPanel({ count: 0 }), "");
});
