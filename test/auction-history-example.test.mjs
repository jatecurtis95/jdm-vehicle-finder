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

test("auction-history example keeps date shortcuts visible and specialist filters progressive", async () => {
  const res = await worker.fetch(new Request("https://jdmfinder.com.au/auction-history-example"), makeEnv(), {});
  const html = await res.text();
  for (const label of ["4 weeks", "6 weeks", "3 months", "6 months", "12 months"]) assert.match(html, new RegExp(`>${label}<`, "i"));
  assert.match(html, /<details class="ah-more"/);
  for (const name of ["transmission", "mileageMax", "engineMin", "engineMax", "house", "body", "drivetrain", "fuel", "colour", "eligibility"]) {
    assert.match(html, new RegExp(`name="${name}"`), `${name} is available under more filters`);
  }
});

test("specialist filters narrow results and remain removable", async () => {
  const url = "https://jdmfinder.com.au/auction-history-example?transmission=Manual&drivetrain=AWD&range=6m";
  const res = await worker.fetch(new Request(url), makeEnv(), {});
  const html = await res.text();
  assert.match(html, /Manual/);
  assert.match(html, /AWD/);
  assert.match(html, /6 months/);
  assert.match(html, /class="ah-chip"/);
  assert.doesNotMatch(html, /Toyota Crown Royal Saloon G/);
});
