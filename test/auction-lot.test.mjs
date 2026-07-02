// auctionLotPage: clicking a live auction card opens a full lot-detail page.
// Staff get an "Add to a client" picker; members get "Request a bid" + watch.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { auctionLotPage } from "../src/admin.js";

const FIXTURE = `
  INSERT INTO clients (id,name,email,state,agent_id,portal_enabled,member)
    VALUES (10,'Staff Client','d@x','VIC',NULL,0,0),
           (30,'Paid Member','m@x','QLD',NULL,1,1),
           (40,'Free Portal','f@x','NSW',NULL,1,0);
`;
const ADMIN = { role: "admin", id: 0 };

// Stub the auction feed so fetchLot resolves to a fixed live lot (no network).
function stubFeed(lotId = "L9") {
  globalThis.fetch = async () => ({
    ok: true, status: 200,
    text: async () => `<aj><row><id>${lotId}</id><marka_name>NISSAN</marka_name><model_name>SKYLINE</model_name><year>1999</year><kuzov>BNR34</kuzov><lot>123</lot><auction>USS Tokyo</auction><auction_date>2099-01-01T00:00:00</auction_date><rate>4.5</rate><start>1500000</start><mileage>60000</mileage></row></aj>`,
  });
}

test("staff lot detail shows the vehicle, auction grade and an add-to-client picker", async () => {
  const env = makeEnv(FIXTURE); stubFeed("L9");
  const html = await auctionLotPage(env, ADMIN, "L9");
  assert.match(html, /NISSAN SKYLINE/);
  assert.match(html, /Auction grade/);
  assert.match(html, /action="\/client\/find"/, "staff can add the lot to a client");
  assert.match(html, /Staff Client/, "the client picker lists accessible clients");
});

test("member lot detail shows Request a bid and gates on membership", async () => {
  const env = makeEnv(FIXTURE); stubFeed("L9");
  const paid = await auctionLotPage(env, { role: "client", id: 30 }, "L9");
  assert.match(paid, /action="\/portal\/auctions\/request"/, "a member can request a bid");
  assert.doesNotMatch(paid, /action="\/client\/find"/, "members never see the staff picker");

  const free = await auctionLotPage(env, { role: "client", id: 40 }, "L9");
  assert.match(free, /members feature/i, "a non-member is told it's a members feature");
});

test("a lot that is not in the feed renders a graceful not-found", async () => {
  const env = makeEnv(FIXTURE);
  globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => `<aj></aj>` });
  const html = await auctionLotPage(env, ADMIN, "NOPE");
  assert.match(html, /not found/i);
});
