// Auction search UI building blocks: eligibility rule, the rich result card,
// and the extended search filters (free-text q, auction house). No network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { auctionEligibility, auctionCardV2 } from "../src/auction-ui.js";
import { searchLots, distinctHouses } from "../src/avtonet.js";

const LOT = {
  id: "L1", lot: "5041", marka_name: "TOYOTA", model_name: "MARK X", kuzov: "GRX120",
  year: "2015", auction: "USS Tokyo", auction_date: "2026-07-02T00:00:00",
  rate: "3.5", mileage: "149000", avg_price: "157000", start: "0",
  images: "https://img/a.jpg#https://img/b.jpg#https://img/c.jpg#https://img/d.jpg",
};

test("eligibility follows the 25-year age rule", () => {
  assert.equal(auctionEligibility({ year: "1999" }, 2026).cls, "ok");
  // Exactly 25 calendar years: the feed has no build month, so the car may not
  // be 25 yet - never assert certainty on the boundary year (launch audit).
  const boundary = auctionEligibility({ year: "2001" }, 2026);
  assert.equal(boundary.cls, "check");
  assert.equal(boundary.label, "Likely eligible—needs confirmation");
  assert.equal(auctionEligibility({ year: "2000" }, 2026).cls, "ok"); // 26 years: certain
  assert.equal(auctionEligibility({ year: "2015" }, 2026).cls, "check");
  assert.equal(auctionEligibility({ year: "" }, 2026).cls, "check");
});

test("the card renders the key spec fields, eligibility and an A$ estimate", () => {
  const html = auctionCardV2(LOT, { fx: 98, nowYear: 2026, actions: "<button>Go</button>" });
  assert.match(html, /class="acard"/);
  assert.match(html, /Grade 3\.5/);
  assert.match(html, /GRX120/);           // chassis code
  assert.match(html, /USS Tokyo/);        // auction house
  assert.match(html, /149,000 km/);       // full mileage, not rounded
  assert.match(html, /Recent avg/);       // avg_price present so it wins the label
  assert.match(html, /¥157,000/);
  assert.match(html, /A\$1,60[0-9]/);     // 157000 / 98 rounded to AUD
  assert.match(html, /ac-elig check/);    // 2015 car needs an eligibility check
  assert.match(html, /class="ac-fav"/);
  assert.match(html, /data-id="L1"/);
  assert.match(html, /<button>Go<\/button>/); // injected primary action
});

test("the card hides the heart when fav is off and shows POA with no price", () => {
  const html = auctionCardV2({ id: "L2", marka_name: "HONDA", model_name: "NSX", year: "1992" }, { fx: 0, nowYear: 2026, fav: false });
  assert.ok(!/class="ac-fav"/.test(html), "no heart");
  assert.match(html, /POA/);
  assert.ok(!/A\$/.test(html), "no A$ estimate without an fx rate");
  assert.match(html, /ac-elig ok/, "1992 car is age-eligible");
});

// A tiny fetch stub that records the decoded SQL so we can assert the WHERE.
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

test("searchLots filters on the free-text q across make, model, chassis and lot", async () => {
  const seen = sqlStub();
  await searchLots(env(), { q: "nissan skyline" });
  const sql = seen[0];
  assert.match(sql, /UPPER\(marka_name\) LIKE '%NISSAN%'/);
  assert.match(sql, /UPPER\(model_name\) LIKE '%SKYLINE%'/);
  // each token becomes its own OR-group, AND-joined
  assert.ok((sql.match(/OR UPPER\(lot\) LIKE/g) || []).length >= 2);
});

test("searchLots filters on the auction house", async () => {
  const seen = sqlStub();
  await searchLots(env(), { house: "USS Osaka" });
  assert.match(seen[0], /UPPER\(auction\) LIKE '%USS OSAKA%'/);
});

// The same two matching rules buildSql carries (RHD standard, trim-column
// match) must also hold on the member search path. scoring.test.mjs asserts
// them on buildSql; these mirror that on searchLots, which builds and runs its
// own SQL rather than returning it.
test("searchLots excludes left-hand-drive lots (RHD as standard)", async () => {
  const seen = sqlStub();
  await searchLots(env(), { make: "TOYOTA" });
  assert.match(seen[0], /lhdrive IS NULL OR lhdrive <> 1/);
});

test("searchLots matches the model term against the trim column too (variant searches)", async () => {
  // Feed models are broad family names ("S CLASS"); the variant ("S400") lives
  // in the trim/grade string. A variant search must reach both columns.
  const seen = sqlStub();
  await searchLots(env(), { model: "S400" });
  assert.match(seen[0], /\(UPPER\(model_name\) LIKE '%S400%' OR UPPER\(grade\) LIKE '%S400%'\)/);
});

test("searchLots escapes a maker so quotes cannot break out of the literal", async () => {
  const seen = sqlStub();
  await searchLots(env(), { make: "O'Brien" });
  assert.ok(!/LIKE '%O'BRIEN%'/.test(seen[0]), "raw single quote must not survive");
  // The maker is split on its first word, so the escaped literal is the leading
  // token; confirm the apostrophe was doubled, not dropped.
  assert.match(seen[0], /LIKE '%O''BRIEN%'/, "single quote is doubled into a safe literal");
});

test("distinctHouses returns the sorted, de-duped list from the feed", async () => {
  globalThis.fetch = async () => ({
    ok: true, status: 200,
    text: async () => "<aj><row><auction>USS Tokyo</auction></row><row><auction>USS Osaka</auction></row></aj>",
  });
  const houses = await distinctHouses(env());
  assert.deepEqual(houses.sort(), ["USS Osaka", "USS Tokyo"]);
});
