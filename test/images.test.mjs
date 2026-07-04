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

test("a 2-image snapshot is [front, rear] — front is the cover, not the rear", () => {
  // The feed's initial upload has no inspection sheet; image[0] is the front
  // 3/4. We must NOT drop it as a sheet (that showed the rear as the cover).
  const r = splitImages({ images: "front#rear" });
  assert.equal(r.sheet, null);
  assert.equal(r.photos[0], "front");
  assert.deepEqual(r.photos, ["front", "rear"]);
});

test("a 3-image snapshot is [sheet, front, rear] — the sheet is stripped", () => {
  // Live-feed sampling (July 2026): from 3 images up the fuller set has landed
  // and image[0] is the inspection sheet. Leaving it in place emailed clients
  // the Japanese grading sheet as the hero photo.
  const r = splitImages({ images: "s#front#rear" });
  assert.equal(r.sheet, "s");
  assert.equal(r.photos[0], "front");
  assert.ok(!r.photos.includes("s"));
});

test("a full set (4+ images) with no AI still strips the leading sheet", () => {
  const r = splitImages({ images: "s#a#b#c" });
  assert.equal(r.sheet, "s");
  assert.equal(r.photos[0], "a");
  assert.ok(!r.photos.includes("s"));
});

test("found:false means no sheet box, but an AI cover is still honoured", () => {
  const r = splitImages({ images: "a#b#c", _sheet: { found: false, sheet_index: -1, cover_index: 1 } });
  assert.equal(r.sheet, null);
  assert.equal(r.photos[0], "b");
});

test("out-of-range AI indices fall back to the convention on a full set", () => {
  const r = splitImages({ images: "s#a#b#c", _sheet: { found: true, sheet_index: 9, cover_index: 9 } });
  assert.equal(r.sheet, "s"); // convention (4+ images)
  assert.equal(r.photos[0], "a");
});
