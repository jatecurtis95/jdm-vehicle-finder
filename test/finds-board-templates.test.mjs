// The "clone the good bits" round: the public Recent-finds gallery (importer
// social proof), the Requests kanban board (Pipedrive-style pipeline), and the
// quick message template library on the client record.
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { clientDetailPage } from "../src/admin.js";
import { findsPage } from "../src/landing.js";
import { sessionCookie } from "../src/auth.js";
import { makeEnv } from "./helpers/d1.mjs";

const CTX = { waitUntil() {} };
const HOST = "https://jdmfinder.com.au";

const LOT = (id, extra = "") => JSON.stringify({
  id, year: "1997", marka_name: "TOYOTA", model_name: "CHASER", grade: "TOURER V",
  kuzov: "JZX100", mileage: "112000", rate: "4", start: "1650000", auction: "USS Nagoya",
  lot: "51301", images: `https://img1.ajes.com/imgs/${id}a.jpg#https://img1.ajes.com/imgs/${id}b.jpg`,
  _landed: { grandTotal: 36400, state: "WA" },
});

function seededEnv() {
  const env = makeEnv(`
    INSERT INTO clients (id, name, email, whatsapp, state) VALUES
      (20, 'Ahtesham Rahman', 'a.rahman@example.com', '+61466123456', 'WA'),
      (21, 'No Contact', NULL, NULL, 'VIC');
    INSERT INTO wishlists (id, client_id, label, marka_name, model_name, status) VALUES
      (30, 20, 'Daily', 'TOYOTA', 'CHASER', 'purchased'),
      (31, 21, 'Quiet', 'NISSAN', 'SKYLINE', 'new');
    INSERT INTO queue (id, wishlist_id, client_id, lot_id, lot_json, status, token, sent_at) VALUES
      (40, 30, 20, 'FD1', '${LOT("FD1")}', 'sent', 'tok-fd1', datetime('now','-2 days'));
  `);
  env.ADMIN_TOKEN = "test-admin-token";
  return env;
}

test("/finds is public, shows sent cars, and anonymises the buyer", async () => {
  const env = seededEnv();
  const res = await worker.fetch(new Request(HOST + "/finds"), env, CTX);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Real cars, found for real buyers/);
  assert.match(html, /class="vcard rv"/, "a find card renders for the sent lot");
  assert.match(html, /Ahtesham &middot; WA/, "buyer reduced to first name + state");
  assert.doesNotMatch(html, /Rahman/, "surname never leaks");
  assert.doesNotMatch(html, /a\.rahman@example\.com/, "email never leaks");
  assert.match(html, /vc-tier">Secured</, "purchased-stage requests show the Secured ribbon");
  assert.match(html, /\/assets\/lot-img\?u=/, "images go through our proxy, not hotlinked");
  assert.match(html, /A\$36,400/, "the snapshotted landed estimate shows");
});

test("the finds page degrades to a friendly empty state and the sitemap lists it", async () => {
  const env = makeEnv();
  env.ADMIN_TOKEN = "test-admin-token";
  const html = await findsPage(env);
  assert.match(html, /Fresh finds are on their way/);
  const sm = await worker.fetch(new Request(HOST + "/sitemap.xml"), env, CTX);
  assert.match(await sm.text(), /\/finds<\/loc>/);
});

test("the requests view offers List | Board and the board renders stage columns", async () => {
  const env = seededEnv();
  const cookie = (await sessionCookie(env, "admin", 0)).split(";")[0];
  const list = await worker.fetch(new Request(HOST + "/admin?view=requests", { headers: { Cookie: cookie } }), env, CTX);
  assert.equal(list.status, 200);
  const listHtml = await list.text();
  assert.match(listHtml, /class="lay-toggle"/, "list layout carries the toggle");
  assert.match(listHtml, /layout=board/, "toggle links to the board");

  const board = await worker.fetch(new Request(HOST + "/admin?view=requests&layout=board", { headers: { Cookie: cookie } }), env, CTX);
  assert.equal(board.status, 200);
  const html = await board.text();
  // One column per stage, cards are draggable, and the fallback select posts
  // to the same endpoint the drag-drop uses (touch and no-JS keep working).
  assert.match(html, /kbn-col" data-st="new"/);
  assert.match(html, /kbn-col" data-st="purchased"/);
  assert.match(html, /class="kbn-card" draggable="true" data-id="30"/);
  const card = html.slice(html.indexOf('data-id="30"'));
  assert.match(card.slice(0, 900), /action="\/request\/status"/, "card keeps the select fallback");
  assert.match(card.slice(0, 900), /layout=board/, "the fallback returns to the board");
  assert.match(html, /fetch\('\/request\/status'/, "drag-drop posts the stage change");
});

test("client detail offers prefilled quick message templates", async () => {
  const env = seededEnv();
  const html = await clientDetailPage(env, 20, { role: "admin", id: 0 });
  assert.match(html, /Quick message templates/);
  // WhatsApp deep link carries the prefilled, client-personalised text.
  assert.match(html, /wa\.me\/61466123456\?text=Hi%20Ahtesham/, "WhatsApp prefill uses the first name");
  assert.match(html, /Toyota%20Chaser/, "the primary search's car is merged into the copy");
  assert.match(html, /mailto:a\.rahman%40example\.com\?subject=|mailto:a\.rahman@example\.com\?subject=/, "email template carries a subject");
  assert.match(html, /body=Hi%20Ahtesham/, "email template carries the body");
  assert.match(html, /data-copy="Hi Ahtesham/, "copy-to-clipboard fallback present");
});

test("no contact channels means no template menu", async () => {
  const env = seededEnv();
  const html = await clientDetailPage(env, 21, { role: "admin", id: 0 });
  assert.doesNotMatch(html, /class="qmsg"/, "menu absent when there is no channel to send through");
});
