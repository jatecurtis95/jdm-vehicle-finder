// Phase 2: one landed-cost path. The real calculator figure reaches History
// rows and Live cards through a deferred batched fill; the rough x1.13+$9k
// formula survives only as the instant placeholder. Estimates are cached per
// isolate, and a settings-tunable bias adjusts the headline figure.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import worker from "../src/index.js";
import { sessionCookie } from "../src/auth.js";
import { estimateLanded, estimateLandedBatch, attachLanded, landedConfig, _resetLandedCache } from "../src/calc.js";
import { auctionCardV2 } from "../src/auction-ui.js";
import { auctionHistoryPage } from "../src/auction-history.js";

const HOST = "https://jdmfinder.com.au";
const ROWS = `<aj><row><id>H1</id><lot>4021</lot><auction>USS Tokyo</auction><auction_date>2026-06-01T00:00:00</auction_date><marka_name>NISSAN</marka_name><model_name>SKYLINE</model_name><year>1999</year><kuzov>BNR34</kuzov><grade>GT-R</grade><mileage>62000</mileage><rate>4.5</rate><eng_v>2600</eng_v><finish>12850000</finish><images></images></row></aj>`;

// Stub: relay queries (base64 q param) answer with feed XML; calculator POSTs
// (jpyPrice body) answer with a fixed grandTotal and are counted; everything
// else (FX) fails so the fallback rate is used.
function stubNet({ grandTotal = 50000, rows = ROWS } = {}) {
  const calls = { calc: 0 };
  globalThis.fetch = async (u, init) => {
    let q = null; try { q = new URL(String(u)).searchParams.get("q"); } catch (e) {}
    if (q) {
      const sql = atob(q);
      const xml = /count\(\*\)/i.test(sql) ? `<aj><row><TAG0>1</TAG0></row></aj>` : rows;
      return { ok: true, status: 200, text: async () => xml };
    }
    if (init && init.method === "POST" && String(init.body || "").includes("jpyPrice")) {
      calls.calc++;
      return { ok: true, status: 200, json: async () => ({ calc: { grandTotal, landedAtPort: 40000, purchaseAUD: 30000 }, activeLineName: "TestLine" }) };
    }
    throw new Error("offline");
  };
  return calls;
}

function env(sql = "") {
  const e = makeEnv(sql);
  e.API_BASE = "http://feed/api";
  e.AVTONET_CODE = "c";
  e.ADMIN_TOKEN = "unit-test-signing-key";
  return e;
}

// --- Estimate cache and bias -------------------------------------------------

test("a repeated estimate for the same lot and state hits the cache, not the calculator", async () => {
  _resetLandedCache();
  const calls = stubNet();
  const e = env();
  const lot = { id: "CACHE1", avg_price: 3000000, eng_v: 2000 };
  const first = await estimateLanded(e, lot, { state: "VIC" });
  const second = await estimateLanded(e, lot, { state: "VIC" });
  assert.equal(first.grandTotal, 50000);
  assert.equal(second.grandTotal, 50000);
  assert.equal(calls.calc, 1, "one POST serves both reads");
  // A different state is a different estimate.
  await estimateLanded(e, lot, { state: "WA" });
  assert.equal(calls.calc, 2);
});

test("the settings bias adjusts the headline figure (aim under actuals)", async () => {
  _resetLandedCache();
  stubNet({ grandTotal: 100000 });
  const e = env(`INSERT INTO settings (key, value) VALUES ('calc_bias_pct', '-8');`);
  const cfg = await landedConfig(e);
  assert.equal(cfg.bias, -8);
  const lot = { id: "BIAS1", avg_price: 3000000 };
  await attachLanded(e, [{ lot, client: { state: "VIC" } }]);
  assert.equal(lot._landed.grandTotal, 92000, "grand total carries the -8% bias");
});

test("junk or out-of-band bias values are ignored", async () => {
  const good = await landedConfig(env(`INSERT INTO settings (key, value) VALUES ('calc_bias_pct', '12');`));
  assert.equal(good.bias, 12);
  const junk = await landedConfig(env(`INSERT INTO settings (key, value) VALUES ('calc_bias_pct', 'chicken');`));
  assert.equal(junk.bias, null);
  const wild = await landedConfig(env(`INSERT INTO settings (key, value) VALUES ('calc_bias_pct', '-90');`));
  assert.equal(wild.bias, null);
});

test("estimateLandedBatch returns a map and never exceeds the page cap", async () => {
  _resetLandedCache();
  const calls = stubNet();
  const items = Array.from({ length: 30 }, (_, i) => ({ id: `B${i}`, jpy: 1000000 + i, cc: 2000 }));
  const out = await estimateLandedBatch(env(), items, "QLD");
  assert.equal(Object.keys(out).length, 24, "capped at one results page");
  assert.equal(calls.calc, 24);
  assert.equal(out.B0, 50000);
});

// --- The card information pass ------------------------------------------------

test("live cards carry engine size and a landed slot with fill attributes", () => {
  const html = auctionCardV2(
    { id: "L1", marka_name: "NISSAN", model_name: "SKYLINE", year: "1999", rate: "4.5", eng_v: "2600", avg_price: "3000000", images: "" },
    { fx: 100, nowYear: 2026 }
  );
  assert.match(html, />Engine<\/div><div class="v">2,600 cc</);
  assert.match(html, /data-landed-slot data-lot="L1" data-jpy="3000000" data-cc="2600"/);
  assert.match(html, /≈ A\$42,900/, "the rough figure is the instant placeholder (3,000,000/100*1.13+9,000)");
});

test("sold cards show engine but never a landed slot", () => {
  const html = auctionCardV2(
    { id: "S1", marka_name: "NISSAN", model_name: "SKYLINE", year: "1999", rate: "4", eng_v: "2500", finish: "2500000", images: "" },
    { fx: 100, nowYear: 2026, soldPrice: 2500000 }
  );
  assert.match(html, />Engine</);
  assert.doesNotMatch(html, /data-landed-slot/);
});

// --- The deferred fill on the pages -------------------------------------------

test("history rows expose landed slots and the page ships the batched fill script", async () => {
  stubNet();
  const e = env(`INSERT INTO users (id,name,portal_enabled,member) VALUES (1,'Member Mike',1,1);`);
  const html = await auctionHistoryPage(e, { role: "client", id: 1 }, {});
  assert.match(html, /data-landed-slot data-lot="H1" data-jpy="12850000" data-cc="2600"/);
  assert.match(html, /fetch\("\/portal\/landed-batch"/, "the member page posts to the member endpoint");
  assert.match(html, /items:items\.slice\(0,24\)/, "the client also caps the batch");
});

test("members get real estimates from the batch endpoint; non-members are refused", async () => {
  _resetLandedCache();
  stubNet({ grandTotal: 61000 });
  const e = env(`INSERT INTO users (id,name,portal_enabled,member,state) VALUES
    (1,'Member Mike',1,1,'WA'),(2,'Free Fred',1,0,'VIC');`);
  const post = async (id) => worker.fetch(new Request(HOST + "/portal/landed-batch", {
    method: "POST",
    headers: { Cookie: (await sessionCookie(e, "client", id)).split(";")[0], Origin: HOST, "Content-Type": "application/json" },
    body: JSON.stringify({ items: [{ id: "X1", jpy: 2000000, cc: 2000 }] }),
  }), e, {});
  const ok = await post(1);
  assert.equal(ok.status, 200);
  const data = await ok.json();
  assert.equal(data.estimates.X1, 61000);
  const free = await post(2);
  assert.equal(free.status, 403, "non-members cannot burn calculator quota");
});

test("junk items are dropped server-side and an empty batch is a cheap no-op", async () => {
  _resetLandedCache();
  const calls = stubNet();
  const e = env(`INSERT INTO users (id,name,portal_enabled,member) VALUES (1,'Member Mike',1,1);`);
  const res = await worker.fetch(new Request(HOST + "/portal/landed-batch", {
    method: "POST",
    headers: { Cookie: (await sessionCookie(e, "client", 1)).split(";")[0], Origin: HOST, "Content-Type": "application/json" },
    body: JSON.stringify({ items: [{ id: "", jpy: 5 }, { id: "A", jpy: -3 }, { id: "B", jpy: "chicken" }, { id: "C", jpy: 9999999999 }] }),
  }), e, {});
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).estimates, {});
  assert.equal(calls.calc, 0, "nothing reached the calculator");
});

test("staff and dealer sessions have their own endpoints", async () => {
  _resetLandedCache();
  stubNet({ grandTotal: 72000 });
  const e = env(`INSERT INTO suppliers (id, email, name, company, pass_salt, pass_hash, active)
    VALUES (9, 'd@x', 'Dealer Dan', 'Dan Motors', 's', 'h', 1);`);
  const staff = await worker.fetch(new Request(HOST + "/admin/landed-batch", {
    method: "POST",
    headers: { Cookie: (await sessionCookie(e, "admin", 0)).split(";")[0], Origin: HOST, "Content-Type": "application/json" },
    body: JSON.stringify({ items: [{ id: "Y1", jpy: 4000000, cc: 0 }] }),
  }), e, {});
  assert.equal(staff.status, 200);
  assert.equal((await staff.json()).estimates.Y1, 72000);
  const dealer = await worker.fetch(new Request(HOST + "/dealer/landed-batch", {
    method: "POST",
    headers: { Cookie: (await sessionCookie(e, "dealer", 9)).split(";")[0], Origin: HOST, "Content-Type": "application/json" },
    body: JSON.stringify({ items: [{ id: "Y2", jpy: 4000001, cc: 0 }] }),
  }), e, {});
  assert.equal(dealer.status, 200);
  assert.equal((await dealer.json()).estimates.Y2, 72000);
});

test("an anonymous landed-batch post never reaches the calculator", async () => {
  const calls = stubNet();
  const res = await worker.fetch(new Request(HOST + "/portal/landed-batch", {
    method: "POST",
    headers: { Origin: HOST, "Content-Type": "application/json" },
    body: JSON.stringify({ items: [{ id: "Z", jpy: 1000000 }] }),
  }), env(), {});
  assert.equal(res.status, 303, "no session redirects to login");
  assert.equal(calls.calc, 0);
});

test("a calculator outage leaves the placeholders standing (empty estimates, HTTP 200)", async () => {
  _resetLandedCache();
  globalThis.fetch = async (u, init) => {
    let q = null; try { q = new URL(String(u)).searchParams.get("q"); } catch (e) {}
    if (q) return { ok: true, status: 200, text: async () => ROWS };
    throw new Error("calculator down");
  };
  const e = env(`INSERT INTO users (id,name,portal_enabled,member) VALUES (1,'Member Mike',1,1);`);
  const res = await worker.fetch(new Request(HOST + "/portal/landed-batch", {
    method: "POST",
    headers: { Cookie: (await sessionCookie(e, "client", 1)).split(";")[0], Origin: HOST, "Content-Type": "application/json" },
    body: JSON.stringify({ items: [{ id: "D1", jpy: 3000000, cc: 2000 }] }),
  }), e, {});
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).estimates, {});
});
