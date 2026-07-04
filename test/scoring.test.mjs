// Matching-engine scoring logic. Pure functions, no DB needed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { lotPrice, scoreMatch, strengthFor, refine, buildSql } from "../src/matcher.js";

test("lotPrice prefers the starting bid, falls back to market estimate", () => {
  assert.equal(lotPrice({ start: 500000, avg_price: 900000 }), 500000);
  assert.equal(lotPrice({ start: 0, avg_price: 900000 }), 900000);
  assert.equal(lotPrice({ start: 0, avg_price: 0 }), 0);
});

test("strengthFor buckets scores into Strong/Good/Possible", () => {
  assert.equal(strengthFor(1.3).label, "Strong");
  assert.equal(strengthFor(0.6).label, "Good");
  assert.equal(strengthFor(0.59).label, "Possible");
  assert.equal(strengthFor(0).label, "Possible");
});

test("scoreMatch: a cheap, high-grade, code-specific lot ranks Strong", () => {
  const lot = { start: 500000, rate: "4.5" };
  const w = { price_max: 1000000, rate_min: 4, kuzov: "JZA80" };
  const score = scoreMatch(lot, w);
  assert.equal(strengthFor(score).label, "Strong");
});

test("scoreMatch: a mid lot ranks Good, a near-budget low-grade lot ranks Possible", () => {
  const good = scoreMatch({ start: 600000, rate: "4" }, { price_max: 1000000, rate_min: 3.5 });
  assert.equal(strengthFor(good).label, "Good");

  const weak = scoreMatch({ start: 980000, rate: "3" }, { price_max: 1000000, rate_min: 3 });
  assert.equal(strengthFor(weak).label, "Possible");
});

test("refine keeps lots meeting the grade and non-numeric grades, drops below-grade", () => {
  const lots = [{ id: "a", rate: "4" }, { id: "b", rate: "3.5" }, { id: "c", rate: "S" }];
  const kept = refine(lots, { rate_min: 4 }).map((l) => l.id);
  assert.deepEqual(kept, ["a", "c"]);
});

test("refine is a no-op when no minimum grade is set", () => {
  const lots = [{ id: "a", rate: "2" }];
  assert.equal(refine(lots, { rate_min: null }).length, 1);
});

test("buildSql only queries upcoming auctions, applies maker/year/price, orders and caps", () => {
  const sql = buildSql({ marka_name: "TOYOTA", year_min: 1990, year_max: 2002, price_max: 1500000 });
  assert.match(sql, /auction_date >= NOW\(\)/);
  assert.match(sql, /UPPER\(marka_name\) LIKE '%TOYOTA%'/);
  assert.match(sql, /year >= 1990/);
  assert.match(sql, /year <= 2002/);
  assert.match(sql, /1500000/);
  assert.match(sql, /ORDER BY auction_date ASC LIMIT 25/);
});

test("buildSql excludes left-hand-drive lots (RHD as standard)", () => {
  const sql = buildSql({ marka_name: "TOYOTA" });
  assert.match(sql, /lhdrive IS NULL OR lhdrive <> 1/);
});

test("buildSql matches the model term against the trim column too (variant searches)", () => {
  // Feed models are broad family names ("S CLASS"); the variant ("S400") lives
  // in the trim/grade string. A variant search must reach both columns.
  const sql = buildSql({ model_name: "S400" });
  assert.match(sql, /\(UPPER\(model_name\) LIKE '%S400%' OR UPPER\(grade\) LIKE '%S400%'\)/);
});

test("buildSql escapes a maker so quotes cannot break out of the literal", () => {
  const sql = buildSql({ marka_name: "O'Brien" });
  assert.ok(!/LIKE '%O'BRIEN%'/.test(sql), "raw single quote must not survive");
  // The maker is split on its first word, so the escaped literal is the leading
  // token; confirm the apostrophe was doubled, not dropped.
  assert.match(sql, /LIKE '%O''BRIEN%'/, "single quote is doubled into a safe literal");
});
