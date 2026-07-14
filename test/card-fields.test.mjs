// V1.3 Phase 3: every auction result card must identify the car well enough
// to act on without opening it - year, make, model AND variant, chassis code,
// transmission, drivetrain and the auction lot number, alongside the fields
// the card already carried (grade, house, date, mileage, eligibility, price).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "./helpers/d1.mjs";
import { auctionCardV2 } from "../src/auction-ui.js";

const LOT = {
  id: "L1", lot: "5041", marka_name: "TOYOTA", model_name: "MARK X", kuzov: "GRX120",
  grade: "250G S PACKAGE", kpp: "AT", priv: "4WD",
  year: "2015", auction: "USS Tokyo", auction_date: "2026-07-02T00:00:00",
  rate: "3.5", mileage: "149000", avg_price: "157000", start: "0",
  images: "https://img/a.jpg#https://img/b.jpg",
};

test("the card leads with the year and shows the variant beside the chassis code", () => {
  const html = auctionCardV2(LOT, { fx: 98, nowYear: 2026 });
  assert.match(html, /2015 TOYOTA MARK X/, "year opens the card name");
  assert.match(html, /250G S PACKAGE/, "the variant (feed trim string) is shown");
  assert.match(html, /GRX120/, "chassis code stays");
});

test("the card shows transmission, drivetrain and the lot number", () => {
  const html = auctionCardV2(LOT, { fx: 98, nowYear: 2026 });
  assert.match(html, />Transmission</, "a Transmission stat exists");
  assert.match(html, /AT(\s|&middot;|·|&#183;)+4WD|AT · 4WD/, "transmission with the drivetrain beside it");
  assert.match(html, />Lot</, "a Lot stat exists");
  assert.match(html, /5041/, "the auction lot number is shown");
});

test("missing spec fields degrade to a dash, never render 'undefined'", () => {
  const html = auctionCardV2({ id: "L2", marka_name: "HONDA", model_name: "NSX", year: "1992" }, { fx: 0, nowYear: 2026 });
  assert.ok(!/undefined/.test(html), "no raw undefined anywhere");
  assert.match(html, /1992 HONDA NSX/);
});

test("the watchlist snapshot carries the new fields so saved cards match live ones", () => {
  const html = auctionCardV2(LOT, { fx: 98, nowYear: 2026 });
  assert.match(html, /data-trans="/, "transmission travels with the heart snapshot");
  assert.match(html, /data-lotno="5041"/, "lot number travels with the heart snapshot");
  const src = readFile("src/auction-ui.js");
  // The client-side watchlist card builder must render the same keys.
  assert.match(src, /'trans','lotno'/, "watch snapshot key list includes trans and lotno");
});
