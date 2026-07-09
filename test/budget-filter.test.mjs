// V1.3 Phase C, "done properly": the stated AUD budget now filters matches, but
// against the REAL per-lot landed estimate (attachLanded's _landed.grandTotal),
// never the rough JPY conversion we deliberately never store. Two safety rails:
// no budget means no filtering, and a lot with no computed estimate is always
// kept (an unknown cost is never assumed to be over budget).
import { test } from "node:test";
import assert from "node:assert/strict";
import { withinBudget } from "../src/matcher.js";

const lot = (id, grandTotal) => ({ id, _landed: grandTotal == null ? undefined : { grandTotal } });

test("drops lots that land clearly over budget, keeps those within it", () => {
  const lots = [lot("cheap", 30000), lot("edge", 38000), lot("dear", 60000)];
  const kept = withinBudget(lots, 35000, 10); // ceiling = 38,500
  const ids = kept.map((l) => l.id);
  assert.deepEqual(ids, ["cheap", "edge"], "the $60k car is dropped; the $38k car sits inside the 10% headroom");
});

test("no budget is a no-op (nothing is filtered)", () => {
  const lots = [lot("a", 30000), lot("b", 999999)];
  assert.equal(withinBudget(lots, 0, 10).length, 2, "budget 0 keeps everything");
  assert.equal(withinBudget(lots, null, 10).length, 2, "null budget keeps everything");
  assert.equal(withinBudget(lots, undefined, 10).length, 2, "missing budget keeps everything");
});

test("a lot with no computed landed estimate is never dropped", () => {
  const lots = [lot("known-dear", 90000), lot("unknown", null)];
  const kept = withinBudget(lots, 35000, 10);
  assert.deepEqual(kept.map((l) => l.id), ["unknown"], "the over-budget known car goes, the unknown-cost car stays");
});

test("headroom widens the ceiling", () => {
  const lots = [lot("x", 45000)];
  assert.equal(withinBudget(lots, 40000, 0).length, 0, "0% headroom: $45k over a $40k budget is dropped");
  assert.equal(withinBudget(lots, 40000, 20).length, 1, "20% headroom lifts the ceiling to $48k and keeps it");
});

test("a non-finite headroom falls back to the default 10%", () => {
  const lots = [lot("x", 43000)];
  // Default 10% of 40k = 44k ceiling, so a 43k car survives.
  assert.equal(withinBudget(lots, 40000, NaN).length, 1, "NaN headroom behaves like the 10% default");
  assert.equal(withinBudget(lots, 40000).length, 1, "an omitted headroom argument uses the 10% default");
});
