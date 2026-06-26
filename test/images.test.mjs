// splitImages decides which image is the inspection sheet and which is the
// lead/cover photo. The AI reader's sheet_index/cover_index are authoritative
// when present; otherwise it falls back to the feed convention (sheet first).
import { test } from "node:test";
import assert from "node:assert/strict";
import { splitImages, imageUrls } from "../src/avtonet.js";

test("AI cover photo leads the gallery and the sheet is taken from sheet_index", () => {
  const lot = { images: "s#a#b#c", _sheet: { found: true, sheet_index: 0, cover_index: 2 } };
  const r = splitImages(lot);
  assert.equal(r.sheet, "s");
  assert.equal(r.photos[0], "b"); // cover (bases[2]) promoted to front
  assert.ok(!r.photos.includes("s"));
  assert.equal(imageUrls(lot).medium, "b&w=320");
});

test("AI handles a sheet that isn't the first image", () => {
  const r = splitImages({ images: "a#s#b", _sheet: { found: true, sheet_index: 1, cover_index: 0 } });
  assert.equal(r.sheet, "s");
  assert.equal(r.photos[0], "a");
});

test("falls back to the first-image convention with no AI read", () => {
  const r = splitImages({ images: "s#a#b" });
  assert.equal(r.sheet, "s");
  assert.equal(r.photos[0], "a");
});

test("found:false means no sheet box, but an AI cover is still honoured", () => {
  const r = splitImages({ images: "a#b#c", _sheet: { found: false, sheet_index: -1, cover_index: 1 } });
  assert.equal(r.sheet, null);
  assert.equal(r.photos[0], "b");
});

test("out-of-range AI indices are ignored", () => {
  const r = splitImages({ images: "s#a", _sheet: { found: true, sheet_index: 9, cover_index: 9 } });
  assert.equal(r.sheet, "s"); // convention
  assert.equal(r.photos[0], "a");
});
