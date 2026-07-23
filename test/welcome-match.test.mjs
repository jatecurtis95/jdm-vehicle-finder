// Free-tier "first example on signup": sendWelcomeMatch finds the best live
// match, queues + records it, and returns a summary for the confirmation page;
// and the confirmation page renders the first-match note and the upsell. The
// auction feed is stubbed via fetch; send_to_client is off so no email goes out.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { sendWelcomeMatch } from "../src/matcher.js";
import { requestPage } from "../src/admin.js";

const XML_ONE = `<aj><row><id>777</id><marka_name>TOYOTA</marka_name><model_name>SUPRA</model_name><year>1995</year><start>3000000</start><avg_price>0</avg_price><mileage>78000</mileage><rate>4.5</rate><auction_date>2099-01-01 00:00</auction_date></row></aj>`;
const XML_NONE = `<aj></aj>`;

function stubFeed(xml) {
  const orig = globalThis.fetch;
  globalThis.fetch = async (u) => {
    // Resend (email) should never be hit here (send_to_client is off), but be safe.
    if (String(u).includes("resend.com")) return new Response("{}", { status: 200 });
    return new Response(xml, { status: 200 });
  };
  return () => { globalThis.fetch = orig; };
}

test("sendWelcomeMatch finds the best live match, queues it and marks it seen", async () => {
  const env = makeEnv("INSERT INTO settings (key,value) VALUES ('send_to_client','0');");
  const db = env.db;
  db.exec(`INSERT INTO users (id,name,email) VALUES (300,'Free Buyer','free@x.com');
           INSERT INTO searches (id,client_id,marka_name,model_name,year_min,year_max,price_max,active)
             VALUES (900,300,'TOYOTA','SUPRA',1993,1998,5000000,1);`);

  const restore = stubFeed(XML_ONE);
  try {
    const res = await sendWelcomeMatch(env, 900);
    assert.equal(res.found, true);
    assert.equal(res.count, 1);
    assert.equal(res.lot.marka_name, "TOYOTA");
    assert.ok(res.lot._strength, "the match is quality-labelled");
    // Email is off in this test, so nothing was sent...
    assert.equal(res.emailed, false);
    // ...but it is queued (as pending, for the normal review flow) and recorded.
    const q = db.prepare("SELECT lot_id, status FROM queue WHERE client_id=300").get();
    assert.equal(q.lot_id, "777");
    assert.equal(q.status, "pending", "left pending because it wasn't auto-emailed");
    const seen = db.prepare("SELECT lot_id FROM seen_lots WHERE wishlist_id=900").get();
    assert.equal(seen.lot_id, "777", "recorded so the cron won't resurface it");
  } finally {
    restore();
  }
});

test("sendWelcomeMatch returns nothing (and queues nothing) when the feed is empty", async () => {
  const env = makeEnv();
  const db = env.db;
  db.exec(`INSERT INTO users (id,name,email) VALUES (301,'No Match','none@x.com');
           INSERT INTO searches (id,client_id,marka_name,model_name,active) VALUES (901,301,'NISSAN','FIGARO',1);`);
  const restore = stubFeed(XML_NONE);
  try {
    const res = await sendWelcomeMatch(env, 901);
    assert.equal(res.found, false);
    assert.equal(res.count, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM queue WHERE client_id=301").get().n, 0);
  } finally {
    restore();
  }
});

test("sendWelcomeMatch never throws on a bad wishlist id", async () => {
  const env = makeEnv();
  const res = await sendWelcomeMatch(env, 99999);
  assert.deepEqual(res, { found: false, emailed: false, count: 0, lot: null });
});

test("confirmation page shows the first-match note and the subscribe upsell", async () => {
  const env = makeEnv();
  const req = { name: "Jane", email: "jane@x.com", marka_name: "TOYOTA", model_name: "SUPRA", year_min: "1993", year_max: "1998", budget_aud: 80000 };
  const welcome = { found: true, emailed: true, count: 1, lot: { year: "1995", marka_name: "TOYOTA", model_name: "SUPRA", _strength: "Good", _strengthColor: "#CAA34C" } };
  const html = await requestPage(env, { submitted: true, ref: "JDM-2026-00300", req, welcome, upsell: { priceAud: 49 } });
  assert.match(html, /already found/);
  assert.match(html, /1995 TOYOTA SUPRA/);
  assert.match(html, /emailed/);
  assert.match(html, /Unlock unlimited/);
  assert.match(html, /A\$49\/mo/);
  assert.match(html, /Get full access/);
});

test("confirmation page shows a 'scanning' note when no match yet, and no upsell for members", async () => {
  const env = makeEnv();
  const req = { name: "Jane", email: "jane@x.com", marka_name: "NISSAN", model_name: "FIGARO" };
  // welcome present but not found, and NO upsell (e.g. a member, or membership off).
  const html = await requestPage(env, { submitted: true, ref: "JDM-2026-00301", req, welcome: { found: false, emailed: false, count: 0, lot: null }, upsell: null });
  assert.match(html, /search is running against every live Japanese auction/i);
  assert.doesNotMatch(html, /Get full access/);
});
