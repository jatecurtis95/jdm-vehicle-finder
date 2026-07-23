// The find-a-car-for-a-client flow: rich find-result cards (details link,
// sheet, eligibility), the client-context auction lot page (one-tap add, back
// to the search, landed-for-them), the find-similar shortcut on a match, and
// the flash-vs-#fragment redirect fix.
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { clientDetailPage, auctionLotPage, lotDetailPage } from "../src/admin.js";
import { sessionCookie } from "../src/auth.js";
import { makeEnv } from "./helpers/d1.mjs";

const CTX = { waitUntil() {} };
const HOST = "https://jdmfinder.com.au";
const ADMIN = { role: "admin", id: 0 };

const FIXTURE = `<aj><row><id>fx-1</id><lot>4021</lot><auction>USS Tokyo</auction><auction_date>2099-01-15T02:00:00</auction_date><marka_name>NISSAN</marka_name><model_name>SKYLINE</model_name><year>2000</year><kuzov>BNR34</kuzov><grade>GT-R</grade><mileage>62000</mileage><rate>4.5</rate><start>9800000</start><lhdrive>0</lhdrive></row></aj>`;

function seededEnv() {
  const env = makeEnv(`
    INSERT INTO clients (id, name, email, state) VALUES (7, 'Ben Carter', 'ben@example.com', 'NSW');
    INSERT INTO wishlists (id, client_id, label, marka_name, model_name) VALUES (70, 7, 'R34 hunt', 'NISSAN', 'SKYLINE');
    INSERT INTO queue (id, wishlist_id, client_id, lot_id, lot_json, status, token) VALUES
      (80, 70, 7, 'Q1', '{"id":"Q1","year":"1999","marka_name":"NISSAN","model_name":"SKYLINE","kuzov":"BNR34-XYZ","rate":"4","start":"8200000"}', 'pending', 'tok-q1');
  `);
  env.ADMIN_TOKEN = "test-admin-token";
  env.AUCTION_FIXTURE = FIXTURE;
  return env;
}

test("client find results carry details, eligibility and sold-history affordances", async () => {
  const env = seededEnv();
  const html = await clientDetailPage(env, 7, ADMIN, { search: { make: "NISSAN", model: "SKYLINE" } });
  // The details link opens the full lot page WITH client context and a back
  // path that returns to this exact search.
  assert.match(html, /view=auctionlot(?:&|&amp;)lot=fx-1(?:&|&amp;)client=7(?:&|&amp;)back=/, "details link carries lot + client + back");
  assert.match(html, /class="mp-link"/, "the photo is a link to the lot page");
  assert.match(html, /chip chip-good[^>]*>Eligible</, "the 25-year eligibility reads on the card");
  assert.match(html, /view=auctions(?:&|&amp;)tab=prices(?:&|&amp;)make=NISSAN(?:&|&amp;)model=SKYLINE/, "sold price history is one tap from the search");
});

test("find-result landed cost is deferred and batched, not computed per row", async () => {
  const env = seededEnv();
  const html = await clientDetailPage(env, 7, ADMIN, { search: { make: "NISSAN", model: "SKYLINE" } });
  // The card carries a fill slot (lot id + working JPY) instead of a
  // server-computed figure, so the page render makes no per-row calculator call.
  assert.match(html, /class="ml-v" data-landed-slot data-lot="fx-1" data-jpy="9800000"/, "landed renders as a deferred fill slot");
  assert.match(html, /Est\. landed · NSW/, "the label carries the client's state, resolved server-side");
  assert.match(html, /class="ml-v"[^>]*>≈A\$/, "an instant rough placeholder shows before the batch fills");
  // One batched fill call, scoped to this client so the endpoint uses their state.
  assert.match(html, /\/admin\/landed-batch\?client=7/, "a single batched fill call targets this client");
});

test("the auction lot page in client context offers a one-tap add and a back-to-search", async () => {
  const env = seededEnv();
  const back = "/admin?view=client&id=7&make=NISSAN&model=SKYLINE#find";
  const html = await auctionLotPage(env, ADMIN, "fx-1", { clientId: 7, back });
  assert.match(html, /Add to Ben's queue/, "primary action is one tap for the context client");
  assert.match(html, /Or add to a different client\.\.\./, "the generic picker stays available");
  assert.match(html, /class="btn-secondary" type="submit">Add</, "the fallback picker's Add steps down when the one-tap gold exists");
  assert.match(html, /Back to Ben's search/, "back points at the search, not the auctions workspace");
  assert.match(html, new RegExp(back.replace(/[?#&]/g, "\\$&")), "back href preserved verbatim");
});

test("without client context the lot page keeps the plain picker", async () => {
  const env = seededEnv();
  const html = await auctionLotPage(env, ADMIN, "fx-1", {});
  assert.doesNotMatch(html, /Add to Ben's queue/);
  assert.match(html, />Add to a client\.\.\.</);
  assert.match(html, /class="btn-primary" type="submit">Add</, "without context the picker's Add is the page primary");
  assert.match(html, /Back to auctions/);
});

test("adding from the lot page lands the flash BEFORE the #fragment", async () => {
  const env = seededEnv();
  const cookie = (await sessionCookie(env, "admin", 0)).split(";")[0];
  const body = new URLSearchParams({ client_id: "7", lot_id: "fx-1", back: "/admin?view=client&id=7&make=NISSAN#find" });
  const res = await worker.fetch(new Request(HOST + "/client/find", {
    method: "POST", redirect: "manual",
    headers: { Cookie: cookie, Origin: HOST, "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  }), env, CTX);
  assert.equal(res.status, 303);
  const loc = res.headers.get("location") || "";
  assert.match(loc, /&found=added#find$/, "found param sits in the query string, the anchor stays last");
});

test("a match detail page offers find-similar prefilled with the car's shape", async () => {
  const env = seededEnv();
  const html = await lotDetailPage(env, 80, ADMIN, {});
  assert.match(html, /Find similar live cars for Ben/);
  // Chassis narrows to the base code (JZX100, not JZX100-BLFVZ) so "contains"
  // matching stays broad enough to find sister lots.
  assert.match(html, /view=client&id=7&make=NISSAN&model=SKYLINE&kuzov=BNR34#find/, "prefill uses the base chassis code");
});
