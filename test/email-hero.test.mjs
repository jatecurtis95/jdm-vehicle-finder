// The email hero image: correct auction-CDN size params, and proxied through
// our own /assets/lot-img route so mail-client image proxies can't block the
// third-party CDN. The CDN only understands '&'-appended params (&h=50, &w=320);
// '?w=...' is ignored, and fresh-listing tokens (ending "-<digit>") serve a
// 100x75 thumbnail unless &w=320 is requested explicitly.
import { test } from "node:test";
import assert from "node:assert/strict";
import { clientHtml } from "../src/render.js";

const PUB = "https://jdmfinder.com.au";
const CLIENT = { name: "Jate" };

test("email hero routes through /assets/lot-img and upsizes fresh-listing thumbs", () => {
  const lot = {
    year: 2022, marka_name: "TOYOTA", model_name: "CROWN",
    images: "https://8.ajes.com/imgs/tok-7&h=50#https://8.ajes.com/imgs/tok-7&h=50",
  };
  const html = clientHtml(lot, CLIENT, {}, PUB, null, true, null);
  assert.ok(html.includes(`${PUB}/assets/lot-img?u=`), "hero is proxied through our domain");
  assert.ok(html.includes(encodeURIComponent("https://8.ajes.com/imgs/tok-7&w=320")), "fresh token asks the CDN for &w=320");
  assert.ok(!html.includes("?w=680"), "the ignored ?w=680 form is gone");
});

test("email hero uses the plain original for photo tokens and never the sheet", () => {
  const lot = {
    year: 2022, marka_name: "TOYOTA", model_name: "CROWN",
    images: "https://8.ajes.com/imgs/sheetTok#https://8.ajes.com/imgs/frontTok#https://8.ajes.com/imgs/rearTok",
  };
  const html = clientHtml(lot, CLIENT, {}, PUB, null, true, null);
  assert.ok(html.includes(encodeURIComponent("https://8.ajes.com/imgs/frontTok")), "front photo is the hero");
  assert.ok(!html.includes(encodeURIComponent("https://8.ajes.com/imgs/sheetTok")), "the inspection sheet is never emailed as the hero");
});
