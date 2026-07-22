// Unit coverage for the sold-price lookup tool. Pure functions only: the maths,
// the SQL WHERE builder (including injection safety), the arg parser and the
// .dev.vars / wrangler [vars] config reader. No network or relay token needed.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeStats,
  median,
  buildStatsWhere,
  monthsAgo,
  chooseMode,
  parseArgs,
  parseVarLines,
  parseWranglerVars,
} from "../scripts/avg-sold.mjs";

test("computeStats: average, median and range on a known set", () => {
  const s = computeStats([3_000_000, 9_000_000, 9_000_000, 11_300_000]);
  assert.equal(s.count, 4);
  assert.equal(s.average, 8_075_000);
  assert.equal(s.median, 9_000_000);
  assert.equal(s.min, 3_000_000);
  assert.equal(s.max, 11_300_000);
});

test("computeStats ignores zero, blank and non-numeric finish values", () => {
  const s = computeStats(["0", "", "abc", "5000000", 7_000_000]);
  assert.equal(s.count, 2);
  assert.equal(s.average, 6_000_000);
});

test("computeStats on an empty set returns nulls, not NaN", () => {
  const s = computeStats([]);
  assert.equal(s.count, 0);
  assert.equal(s.average, null);
  assert.equal(s.median, null);
});

test("median handles odd and even counts", () => {
  assert.equal(median([1, 2, 3]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), null);
});

test("buildStatsWhere composes the expected filters", () => {
  const w = buildStatsWhere({
    make: "NISSAN", model: "SKYLINE", grade: "GT-R",
    yearMin: 1993, yearMax: 2002, months: 6,
  });
  assert.match(w, /finish > 0/);
  assert.match(w, /UPPER\(marka_name\) LIKE '%NISSAN%'/);
  assert.match(w, /UPPER\(model_name\) LIKE '%SKYLINE%'/);
  assert.match(w, /UPPER\(grade\) LIKE '%GT-R%'/);
  assert.match(w, /year >= 1993/);
  assert.match(w, /year <= 2002/);
  assert.match(w, /auction_date >= '\d{4}-\d{2}-\d{2}'/);
});

test("buildStatsWhere uses only the first make token and adds no window by default", () => {
  const w = buildStatsWhere({ make: "MERCEDES BENZ" });
  assert.match(w, /LIKE '%MERCEDES%'/);
  assert.doesNotMatch(w, /BENZ/);
  assert.doesNotMatch(w, /INTERVAL/);
});

test("buildStatsWhere neutralises SQL injection in inputs", () => {
  const w = buildStatsWhere({ make: "NISSAN", model: "S'; DROP TABLE stats;--" });
  assert.doesNotMatch(w, /;/, "statement separators are stripped");
  assert.doesNotMatch(w, /--/, "SQL comments are stripped");
  assert.match(w, /''/, "embedded single quote is doubled, not left raw");
});

test("months = 0 disables the window (all-time)", () => {
  const w = buildStatsWhere({ make: "TOYOTA", months: 0 });
  assert.doesNotMatch(w, /auction_date >=/);
});

test("buildStatsWhere uses a literal date cutoff, never DATE_SUB", () => {
  const w = buildStatsWhere({ make: "NISSAN", months: 6 });
  assert.match(w, /auction_date >= '\d{4}-\d{2}-\d{2}'/);
  assert.doesNotMatch(w, /DATE_SUB/i);
});

test("monthsAgo returns YYYY-MM-DD N months before the reference", () => {
  assert.equal(monthsAgo(12, new Date("2026-07-15T00:00:00Z")), "2025-07-15");
  assert.equal(monthsAgo(6, new Date("2026-07-15T00:00:00Z")), "2026-01-15");
});

test("chooseMode prefers direct when PROVIDER_API is set; flags override", () => {
  assert.equal(chooseMode({}, { PROVIDER_API: "http://x" }), "direct");
  assert.equal(chooseMode({}, {}), "relay");
  assert.equal(chooseMode({ relay: true }, { PROVIDER_API: "http://x" }), "relay");
  assert.equal(chooseMode({ direct: true }, {}), "direct");
});

test("parseArgs reads value flags and boolean flags", () => {
  const a = parseArgs(["--make", "NISSAN", "--model", "SKYLINE", "--months", "6", "--json"]);
  assert.equal(a.make, "NISSAN");
  assert.equal(a.model, "SKYLINE");
  assert.equal(a.months, "6");
  assert.equal(a.json, true);
});

test("parseArgs normalises kebab flags to camelCase", () => {
  const a = parseArgs(["--year-min", "1993", "--self-test"]);
  assert.equal(a.yearMin, "1993");
  assert.equal(a.selfTest, true);
});

test("parseVarLines parses KEY = value and ignores comments", () => {
  const v = parseVarLines('# comment\nAVTONET_CODE = "abc123"\nCALC_FX = "95"\n\n');
  assert.equal(v.AVTONET_CODE, "abc123");
  assert.equal(v.CALC_FX, "95");
});

test("parseWranglerVars reads only the [vars] table", () => {
  const toml = [
    "name = \"jdm-vehicle-finder\"",
    "[vars]",
    "API_BASE = \"https://example.com/relay.php\"",
    "CALC_FX = \"95\"",
    "[env.production]",
    "API_BASE = \"https://should-not-win.example\"",
  ].join("\n");
  const v = parseWranglerVars(toml);
  assert.equal(v.API_BASE, "https://example.com/relay.php");
  assert.equal(v.CALC_FX, "95");
});
