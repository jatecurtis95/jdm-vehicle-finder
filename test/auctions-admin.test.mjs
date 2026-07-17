// The staff Auctions workspace: a live-feed search (with an Add-to-client picker)
// and a sold-price history lookup. Feed calls are stubbed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { adminPage } from "../src/admin.js";

const ADMIN = { role: "admin", id: 0 };
const lotXml = (id = "L1") => `<aj><row><id>${id}</id><marka_name>NISSAN</marka_name><model_name>SKYLINE</model_name><year>1999</year><lot>50</lot><auction>USS</auction><auction_date>2099-01-01T00:00:00</auction_date><start>2000000</start><rate>4</rate></row></aj>`;
function stub(xml) { globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => xml, json: async () => ({}) }); }

test("the Auctions nav item shows in the sidebar", async () => {
  const env = makeEnv(); stub(lotXml());
  const html = await adminPage(env, "dashboard", ADMIN);
  assert.match(html, /href="\/admin\?view=auctions"/);
});

test("Auctions live tab renders the tabs and the filter panel", async () => {
  const env = makeEnv(); stub(lotXml());
  const html = await adminPage(env, "auctions", ADMIN, { tab: "live", search: {} });
  assert.match(html, /Live auctions/);
  assert.match(html, /Watchlist/);
  assert.match(html, /Sold prices/);
  // V1.3 Phase A: the free-text smart bar is parked; explicit filters only,
  // including the labelled model-code select, and no auto-submit on change.
  assert.ok(!/asrch-bar/.test(html), "smart search bar removed (sidebar global search is separate)");
  assert.match(html, /All makes/);
  assert.match(html, /All model codes/);
  assert.match(html, /All houses/);
  assert.ok(!/onchange="this\.form\.submit\(\)"/.test(html), "filter selects never auto-submit");
});

test("Auctions live search lists lots with an Add-to-client picker", async () => {
  const env = makeEnv(`INSERT INTO clients (id,name,email) VALUES (5,'Buyer','b@x');`);
  stub(lotXml("L9"));
  const html = await adminPage(env, "auctions", ADMIN, { tab: "live", search: { make: "NISSAN" } });
  assert.match(html, /SKYLINE/i, "lists the matching lot");
  assert.match(html, /Add to client/);
  assert.match(html, /name="client_id"/);
  assert.match(html, /<option value="5">Buyer<\/option>/, "the staff's client is pickable");
  assert.match(html, /action="\/client\/find"/);
  assert.match(html, /class="btn-secondary btn-sm" type="submit">Add</, "card Add stays quiet - the live tab's only gold is the search submit");
});

test("Auctions Sold prices tab shows a no-data message when there are no sold records", async () => {
  const env = makeEnv(); stub(`<aj></aj>`);
  const html = await adminPage(env, "auctions", ADMIN, { tab: "prices", search: { make: "NISSAN", model: "SKYLINE" } });
  assert.match(html, /No sold records/i);
});

test("the old Sold auctions tab folds into Sold prices (alias keeps bookmarks working)", async () => {
  const env = makeEnv();
  const soldXml = `<aj><row><id>S1</id><marka_name>NISSAN</marka_name><model_name>SKYLINE</model_name><year>1999</year><rate>4</rate><finish>2500000</finish><auction>USS Tokyo</auction><auction_date>2026-06-01T00:00:00</auction_date></row></aj>`;
  stub(soldXml);
  const html = await adminPage(env, "auctions", ADMIN, { tab: "sold", search: {} });
  assert.doesNotMatch(html, />Sold auctions</, "the separate tab is gone from the bar");
  assert.match(html, />Sold prices</, "the merged tab renders instead");
  assert.match(html, /Sold price/);           // the card price label
  assert.match(html, /¥2,500,000/);           // the sold lots still browse
  assert.match(html, /Latest sold results/);  // first-load framing
});
