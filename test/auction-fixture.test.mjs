// Item 7: offline auction fixture mode. When env.AUCTION_FIXTURE holds feed XML,
// query() returns those rows and skips the relay, so QA and local staging get
// deterministic auction data with no live API. Inert unless the var is set.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { query } from "../src/avtonet.js";
import { repoRoot } from "./helpers/d1.mjs";

const FIXTURE = readFileSync(resolve(repoRoot, "seed/auction-fixture.example.xml"), "utf8");

test("query() returns the fixture rows and never hits the network when AUCTION_FIXTURE is set", async () => {
  let fetched = false;
  const orig = globalThis.fetch;
  globalThis.fetch = async () => { fetched = true; throw new Error("network should not be called"); };
  try {
    const rows = await query({ AUCTION_FIXTURE: FIXTURE, API_BASE: "http://relay", AVTONET_CODE: "x" }, "SELECT * FROM main");
    assert.equal(fetched, false, "the relay was not called");
    assert.ok(rows.length >= 4, "fixture lots parsed");
    const skyline = rows.find((r) => r.model_name === "SKYLINE");
    assert.ok(skyline, "the R34 fixture lot is present");
    assert.equal(skyline.kuzov, "BNR34");
    assert.equal(skyline.marka_name, "NISSAN");
  } finally {
    globalThis.fetch = orig;
  }
});

test("query() falls through to the relay when AUCTION_FIXTURE is blank", async () => {
  let calledUrl = "";
  const orig = globalThis.fetch;
  globalThis.fetch = async (u) => { calledUrl = String(u); return { ok: true, status: 200, text: async () => "<aj></aj>" }; };
  try {
    await query({ AUCTION_FIXTURE: "", API_BASE: "http://relay", AVTONET_CODE: "tok" }, "SELECT 1");
    assert.match(calledUrl, /^http:\/\/relay\?code=tok/, "the relay is used when no fixture is set");
  } finally {
    globalThis.fetch = orig;
  }
});
