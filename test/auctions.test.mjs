// Member-only auction search page: gating, live search, request-a-lot, and the
// admin member toggle. The live feed is stubbed so no network is hit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { portalAuctionsPage, requestAuctionLot, setClientMember } from "../src/admin.js";

const TWO_LOTS = "<aj><row><id>L1</id><marka_name>NISSAN</marka_name><model_name>SKYLINE</model_name><year>1999</year><start>2200000</start><rate>4</rate><kuzov>BNR34</kuzov></row><row><id>L2</id><marka_name>NISSAN</marka_name><model_name>SKYLINE</model_name><year>2001</year><start>1800000</start><rate>4.5</rate></row></aj>";
const ONE_LOT = "<aj><row><id>L9</id><marka_name>NISSAN</marka_name><model_name>SKYLINE</model_name><year>1999</year><start>2500000</start><rate>4</rate></row></aj>";

function stub(single = false) {
  globalThis.fetch = async (u) => {
    let q = null; try { q = new URL(u).searchParams.get("q"); } catch (e) {}
    const sql = q ? atob(q) : "";
    return { ok: true, status: 200, text: async () => (/WHERE id=/.test(sql) ? ONE_LOT : (single ? ONE_LOT : TWO_LOTS)) };
  };
}
function env2() {
  const e = makeEnv("INSERT INTO users (id,name,portal_enabled,member) VALUES (1,'Member Mike',1,1),(2,'Free Fred',1,0);");
  e.API_BASE = "http://feed/api"; e.AVTONET_CODE = "c";
  return e;
}
// Count server-rendered cards only: the client-side watchlist script embeds the
// same card markup as a JS template string, so strip <script> blocks first.
const acards = (h) => ((h.replace(/<script[\s\S]*?<\/script>/g, "")).match(/class="acard"/g) || []).length;

test("auction page is gated to members", async () => {
  stub();
  const e = env2();
  const free = await portalAuctionsPage(e, { role: "client", id: 2 }, {});
  assert.match(free, /members feature/i);
  assert.ok(!/name="make"/.test(free), "non-member gets no search filters");
  const member = await portalAuctionsPage(e, { role: "client", id: 1 }, {});
  assert.match(member, /<h1>Auction search<\/h1>/);
  assert.match(member, /Search live Japanese auctions/);
  assert.match(member, /name="make"/, "member gets the search filters");
});

test("a member search renders one card per live lot", async () => {
  stub();
  const html = await portalAuctionsPage(env2(), { role: "client", id: 1 }, { make: "NISSAN", model: "SKYLINE" });
  assert.match(html, /live lots/, "the results bar shows the live count");
  assert.equal(acards(html), 2);
  assert.match(html, /class="ac-fav"/, "cards carry a watchlist heart");
  assert.match(html, /Request bid/, "buyer cards can request a bid");
});

test("the member live tab shares the History filter panel (Phase 1)", async () => {
  stub();
  const html = await portalAuctionsPage(env2(), { role: "client", id: 1 }, {});
  const form = html.match(/<form class="ahx-filter"[\s\S]*?<\/form>/)[0];
  assert.doesNotMatch(form, /<details/, "nothing collapsed, no More filters");
  const rateOrder = [...form.matchAll(/name="rates" value="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(rateOrder, ["r", "ra", "1", "2", "3", "3.5", "4", "4.5", "5", "6", "s"], "grade pills in Ben launch-plan order (R, RA..S, grade 1 kept), replacing the min-grade input");
  assert.doesNotMatch(form, /name="gradeMin"/);
  assert.match(form, /name="variant"[^>]*list="ahx-grades"/, "the trim selector is wired to the grades datalist");
  assert.match(form, /Start price from \(JPY\)/, "live prices are start prices");
  assert.match(html, /Closing soonest/, "the default sort is stated on the results bar");
});

test("the Watchlist tab renders the client-side grid container, not the feed", async () => {
  stub();
  const html = await portalAuctionsPage(env2(), { role: "client", id: 1 }, { tab: "watch" });
  assert.match(html, /id="watchGrid"/);
  assert.equal(acards(html), 0, "no server-rendered cards on the watch tab");
  assert.match(html, /jdmWatch/, "the watchlist script is present");
});

test("requesting a lot files it against a catch-all search and is idempotent", async () => {
  stub();
  const e = env2();
  const r1 = await requestAuctionLot(e, 1, "L9");
  assert.ok(r1.ok && !r1.already);
  const wl = await e.DB.prepare("SELECT watch_only FROM searches WHERE client_id=1 AND label='Direct requests'").first();
  assert.equal(wl.watch_only, 1);
  const row = await e.DB.prepare("SELECT client_request,status FROM queue WHERE client_id=1 AND lot_id='L9'").first();
  assert.equal(row.client_request, 1);
  assert.equal(row.status, "pending");
  const r2 = await requestAuctionLot(e, 1, "L9");
  assert.ok(r2.already);
  const n = (await e.DB.prepare("SELECT COUNT(*) n FROM queue WHERE client_id=1 AND lot_id='L9'").first()).n;
  assert.equal(n, 1);
});

test("admin member toggle flips the flag", async () => {
  stub();
  const e = env2();
  await setClientMember(e, 2, true, { role: "admin", id: 0 });
  assert.equal((await e.DB.prepare("SELECT member FROM users WHERE id=2").first()).member, 1);
  await setClientMember(e, 2, false, { role: "admin", id: 0 });
  assert.equal((await e.DB.prepare("SELECT member FROM users WHERE id=2").first()).member, 0);
});
