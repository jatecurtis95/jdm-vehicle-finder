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

test("Auctions live tab renders the tabs and the search bar", async () => {
  const env = makeEnv(); stub(lotXml());
  const html = await adminPage(env, "auctions", ADMIN, { tab: "live", search: {} });
  assert.match(html, /Live auctions/);
  assert.match(html, /Watchlist/);
  assert.match(html, /Sold prices/);
  assert.match(html, /Search make, model, chassis code/);
  assert.match(html, /All houses/);
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
});

test("Auctions sold tab shows a no-data message when there are no sold records", async () => {
  const env = makeEnv(); stub(`<aj></aj>`);
  const html = await adminPage(env, "auctions", ADMIN, { tab: "sold", search: { make: "NISSAN", model: "SKYLINE" } });
  assert.match(html, /No sold records/i);
});
