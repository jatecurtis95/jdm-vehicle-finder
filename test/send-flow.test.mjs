// The Phase 2 send flow: select several search-result cards, then send them to
// one client as ONE combined email (addLotsToClient + the bulk-decision path),
// or just queue them for review. Covers the server helper and the UI surfaces
// (sticky send bar, selectable cards, no-contact data for the confirm).
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { addLotsToClient, clientDetailPage, adminPage } from "../src/admin.js";

const ADMIN = { role: "admin", id: 0 };
const FIXTURE = `
  INSERT INTO users (id,name,email,state) VALUES (10,'Jordan Buyer','j@x.com','VIC');
  INSERT INTO users (id,name,state) VALUES (11,'No Contact','QLD');
`;

// URL-sensitive feed stub: the relay carries its SQL base64-encoded in the ?q=
// param, so decode it and echo back whichever lot id was asked for. That lets
// multiple distinct lots be added in one test.
function stubFeed() {
  globalThis.fetch = async (url) => {
    let id = "L1";
    try {
      const u = new URL(String(url), "https://feed.test/");
      const sql = atob(u.searchParams.get("q") || "");
      const m = /id='([^']+)'/.exec(sql);
      if (m) id = m[1];
    } catch (e) { /* default id */ }
    return {
      ok: true, status: 200,
      text: async () => `<aj><row><id>${id}</id><marka_name>NISSAN</marka_name><model_name>SKYLINE</model_name><year>1999</year><lot>123</lot><auction_date>2099-01-01T00:00:00</auction_date><start>1500000</start></row></aj>`,
    };
  };
}

test("addLotsToClient queues every selected lot once and reports counts", async () => {
  const env = makeEnv(FIXTURE); stubFeed();
  const r = await addLotsToClient(env, 10, ["L1", "L2", "L2", "L3"], ADMIN);
  assert.equal(r.requested, 3, "duplicate selections are collapsed");
  assert.equal(r.queued.length, 3, "each distinct lot gets a queue row");
  assert.equal(r.failed, 0);
  const n = (await env.DB.prepare("SELECT COUNT(*) AS n FROM queue WHERE client_id = 10 AND status = 'pending'").first()).n;
  assert.equal(n, 3);
});

test("addLotsToClient returns the existing queue id for an already-queued lot", async () => {
  const env = makeEnv(FIXTURE); stubFeed();
  const first = await addLotsToClient(env, 10, ["L1"], ADMIN);
  const again = await addLotsToClient(env, 10, ["L1"], ADMIN);
  assert.deepEqual(again.queued, first.queued, "same queue row, no duplicate");
  const n = (await env.DB.prepare("SELECT COUNT(*) AS n FROM queue WHERE client_id = 10").first()).n;
  assert.equal(n, 1);
});

test("client-page find results are selectable and ship the sticky send bar", async () => {
  const env = makeEnv(FIXTURE); stubFeed();
  const html = await clientDetailPage(env, 10, ADMIN, { search: { make: "NISSAN" } });
  assert.match(html, /class="mcard selcard" data-lot="/, "result card is tap-selectable");
  assert.match(html, /class="fsel"/, "always-visible selection checkbox");
  assert.match(html, /id="sendBar"[^>]*data-client="10"[^>]*data-name="Jordan"[^>]*data-contact="1"/, "send bar knows the client and their reachability");
  assert.match(html, /Queue for review/, "secondary queue action");
});

test("the send bar flags a client with no email or WhatsApp for the confirm guard", async () => {
  const env = makeEnv(FIXTURE); stubFeed();
  const html = await clientDetailPage(env, 11, ADMIN, { search: { make: "NISSAN" } });
  assert.match(html, /id="sendBar"[^>]*data-contact="0"/, "no-contact state reaches the confirm");
});

test("the Auctions live tab renders selectable cards and a client-picker send bar", async () => {
  const env = makeEnv(FIXTURE); stubFeed();
  const html = await adminPage(env, "auctions", ADMIN, { tab: "live", search: { make: "NISSAN" } });
  assert.match(html, /class="acard selcard" data-lot="/, "auction card is selectable");
  assert.match(html, /id="sbClient"/, "send bar carries the client picker");
  assert.match(html, /data-contact="1">Jordan Buyer</, "picker options carry reachability");
  assert.match(html, /data-contact="0">No Contact</, "contactless client flagged");
});
