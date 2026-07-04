// IA-AUDIT items 3 and 4: the contact-tap plumbing already writes to the
// activity table (logContactTap, data-clog beacons); these tests pin the two
// missing pieces. Item 3: staff get toast feedback that the touch was logged.
// Item 4: last-contacted surfaces on the client header and the request
// identity card, aggregated the same way as the Customers column (sent
// vehicles + notes + logged contact taps).
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv, readFile } from "./helpers/d1.mjs";
import { adminPage, clientDetailPage, requestDetailPage, logContactTap } from "../src/admin.js";

const ADMIN = { role: "admin", id: 0 };

function seededEnv() {
  return makeEnv(readFile("seed/seed-dev.sql"));
}

test("client header shows Never contacted when there is no touch history", async () => {
  const env = seededEnv();
  // Ben (9002) only has a pending match: no send, no note, no logged tap.
  // (Aiko now seeds with 20-day-old touches as the gone-quiet fixture.)
  const html = await clientDetailPage(env, 9002, ADMIN);
  assert.match(html, /class="cd-lastc"/, "the last-contacted line renders in the header");
  assert.match(html, /Never contacted/, "no history reads as never contacted");
});

test("a logged WhatsApp tap surfaces on the client header with channel and actor", async () => {
  const env = seededEnv();
  const r = await logContactTap(env, 9001, "whatsapp", ADMIN);
  assert.equal(r.ok, true);
  const html = await clientDetailPage(env, 9001, ADMIN);
  assert.match(html, /Last contacted <b>just now<\/b>/, "the tap timestamp renders");
  assert.match(html, /WhatsApp by JDM Connect/, "channel and actor render");
  assert.doesNotMatch(html, /Never contacted/);
});

test("a sent vehicle also counts as contact on the client header", async () => {
  const env = seededEnv();
  await env.DB.prepare(
    `INSERT INTO queue (wishlist_id, client_id, lot_id, lot_json, status, token, sent_at)
     VALUES (9001, 9001, 'LC1', '{"id":"LC1"}', 'sent', 'lc-tok-1', datetime('now','-3 days'))`
  ).run();
  const html = await clientDetailPage(env, 9001, ADMIN);
  assert.match(html, /Last contacted <b>3d ago<\/b> &middot; vehicles sent/, "a combined-email send is a touch");
});

test("the request identity card shows last contacted distinct from last activity", async () => {
  const env = seededEnv();
  await logContactTap(env, 9001, "call", ADMIN);
  const html = await requestDetailPage(env, 9001, ADMIN);
  assert.match(html, /last activity/, "last activity stays");
  assert.match(html, /last contacted just now/, "the client-level touch renders on the request card");
});

test("the request identity card reads never contacted without history", async () => {
  const env = seededEnv();
  const html = await requestDetailPage(env, 9002, ADMIN);
  assert.match(html, /last contacted never/, "no history reads as never");
});

test("the contact-tap handler confirms the log with a toast", async () => {
  const env = seededEnv();
  const html = await adminPage(env, "dashboard", ADMIN);
  assert.match(html, /data-clog/, "the beacon handler ships in the shell");
  assert.match(html, /jdmToast\([^)]*logged/, "the tap drops a visible confirmation toast");
});
