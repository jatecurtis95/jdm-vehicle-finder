// The old member "Sold auctions" page was superseded by Auction History:
// /portal/sold now 301s to /portal/history (bookmarks survive, one sold-data
// UI). The sold-price feed query itself still powers the staff Sold prices tab.
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { makeEnv } from "./helpers/d1.mjs";
import { sessionCookie } from "../src/auth.js";
import { searchSold } from "../src/avtonet.js";

const HOST = "https://jdmfinder.com.au";

async function memberFetch(path) {
  const env = makeEnv("INSERT INTO users (id,name,portal_enabled,member) VALUES (1,'Member Mike',1,1);");
  env.ADMIN_TOKEN = "test-admin-token";
  const cookie = (await sessionCookie(env, "client", 1)).split(";")[0];
  return worker.fetch(new Request(HOST + path, { headers: { Cookie: cookie }, redirect: "manual" }), env, {});
}

test("/portal/sold permanently redirects to /portal/history", async () => {
  const res = await memberFetch("/portal/sold");
  assert.equal(res.status, 301);
  assert.equal(res.headers.get("location"), HOST + "/portal/history");
});

test("the redirect carries make/model/house and drops params history can't use", async () => {
  const res = await memberFetch("/portal/sold?make=NISSAN&model=SKYLINE&house=USS&priceMax=2000000&view=list");
  assert.equal(res.status, 301);
  const loc = new URL(res.headers.get("location"));
  assert.equal(loc.pathname, "/portal/history");
  assert.equal(loc.searchParams.get("make"), "NISSAN");
  assert.equal(loc.searchParams.get("model"), "SKYLINE");
  assert.equal(loc.searchParams.get("house"), "USS");
  assert.equal(loc.searchParams.get("priceMax"), null, "sold-only params are dropped");
  assert.equal(loc.searchParams.get("view"), null, "sold-only params are dropped");
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
