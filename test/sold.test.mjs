// Member-only "Sold auctions" page: gating, the sold-price feed query, and the
// sold card. The stats feed is stubbed so no network is hit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { portalSoldPage } from "../src/admin.js";
import { searchSold } from "../src/avtonet.js";

const SOLD = "<aj><row><id>S1</id><marka_name>NISSAN</marka_name><model_name>SKYLINE</model_name><year>1999</year><rate>4</rate><finish>2500000</finish><auction>USS Tokyo</auction><auction_date>2026-06-01T00:00:00</auction_date><kuzov>BNR34</kuzov></row></aj>";

function stub(xml = SOLD) {
  globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => xml });
}
function env2() {
  const e = makeEnv("INSERT INTO clients (id,name,portal_enabled,member) VALUES (1,'Member Mike',1,1),(2,'Free Fred',1,0);");
  e.API_BASE = "http://feed/api"; e.AVTONET_CODE = "c";
  return e;
}
// Server-rendered cards only (the watchlist script embeds the same markup).
const acards = (h) => ((h.replace(/<script[\s\S]*?<\/script>/g, "")).match(/class="acard"/g) || []).length;

test("sold page is gated to members", async () => {
  stub();
  const e = env2();
  const free = await portalSoldPage(e, { role: "client", id: 2 }, {});
  assert.match(free, /members feature/i);
  assert.ok(!/name="q"/.test(free), "non-member gets no search bar");
  const member = await portalSoldPage(e, { role: "client", id: 1 }, {});
  assert.match(member, /<h1>Sold auctions<\/h1>/);
  assert.match(member, /Search sold auction results/);
});

test("the sold page renders sold cards with the hammer price and a Find-live action", async () => {
  stub();
  const html = await portalSoldPage(env2(), { role: "client", id: 1 }, {});
  assert.equal(acards(html), 1);
  assert.match(html, /Sold price/);
  assert.match(html, /¥2,500,000/);
  assert.match(html, /Find live/);
  assert.ok(!/class="ac-fav"/.test(html.replace(/<script[\s\S]*?<\/script>/g, "")), "sold cards have no watchlist heart");
});

function sqlStub() {
  const seen = [];
  globalThis.fetch = async (u) => {
    let q = null; try { q = new URL(u).searchParams.get("q"); } catch (e) {}
    if (q) seen.push(atob(q));
    return { ok: true, status: 200, text: async () => "<aj></aj>" };
  };
  return seen;
}
const env = () => ({ API_BASE: "http://feed/api", AVTONET_CODE: "c" });

test("searchSold reads the stats table, requires a hammer price, and sorts newest first", async () => {
  const seen = sqlStub();
  await searchSold(env(), { q: "skyline", priceMax: "2000000", house: "USS", gradeMin: "4" });
  const sql = seen[0];
  assert.match(sql, /FROM stats WHERE/);
  assert.match(sql, /finish > 0/);
  assert.match(sql, /finish <= 2000000/);       // price ceiling filters the sold price
  assert.match(sql, /UPPER\(auction\) LIKE '%USS%'/);
  assert.match(sql, /rate >= 4/);
  assert.match(sql, /UPPER\(model_name\) LIKE '%SKYLINE%'/);
  assert.match(sql, /ORDER BY auction_date DESC/);
});
