// Landed-cost helper logic (state normalisation feeds the per-client estimate
// and the shipping-port mapping). The estimate itself calls the external
// calculator, so here we lock down the pure inputs it depends on.
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeState, isAuState, auStates } from "../src/calc.js";

test("normalizeState accepts codes and full names, case-insensitively", () => {
  assert.equal(normalizeState("vic"), "VIC");
  assert.equal(normalizeState("VIC"), "VIC");
  assert.equal(normalizeState("Victoria"), "VIC");
  assert.equal(normalizeState("new south wales"), "NSW");
});

test("normalizeState returns null for unknown or empty input", () => {
  assert.equal(normalizeState("Atlantis"), null);
  assert.equal(normalizeState(""), null);
  assert.equal(normalizeState(null), null);
  assert.equal(normalizeState(123), null);
});

test("isAuState recognises the eight states/territories only", () => {
  assert.equal(isAuState("QLD"), true);
  assert.equal(isAuState("qld"), true);
  assert.equal(isAuState("ZZ"), false);
});

test("auStates lists all eight and is a fresh copy each call", () => {
  const a = auStates();
  assert.equal(a.length, 8);
  a.push("XX");
  assert.equal(auStates().length, 8, "mutating the returned array must not leak");
});
