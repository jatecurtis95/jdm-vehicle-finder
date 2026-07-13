import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { makeEnv } from "./helpers/d1.mjs";

test("public auction-history example presents buyer-friendly filters and results", async () => {
  const res = await worker.fetch(new Request("https://jdmfinder.com.au/auction-history-example"), makeEnv(), {});
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<h1>Auction history<\/h1>/);
  assert.match(html, /name="q"/);
  assert.match(html, /name="make"/);
  assert.match(html, /name="yearMin"/);
  assert.match(html, /name="gradeMin"/);
  assert.match(html, /Recent market snapshot/);
  assert.match(html, /Hammer price/);
  assert.match(html, /Est\. landed/);
  assert.match(html, /class="ah-table"/);
  assert.match(html, /class="ah-mobile"/);
});

test("auction-history example reflects filters in removable chips and narrows results", async () => {
  const url = "https://jdmfinder.com.au/auction-history-example?q=skyline&make=NISSAN&yearMin=1999";
  const res = await worker.fetch(new Request(url), makeEnv(), {});
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Skyline/i);
  assert.match(html, /class="ah-chip"/);
  assert.match(html, /NISSAN/);
  assert.doesNotMatch(html, /Honda Civic Type R/);
});
