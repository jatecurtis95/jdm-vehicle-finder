// Free-tier teaser: a free (non-member) customer sees that a match was found for
// their search, but the car's details stay locked behind an upgrade. Capped by
// free_result_limit. Members see the full card as before.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { portalPage } from "../src/admin.js";

const LOT = JSON.stringify({ year: 2002, marka_name: "NISSAN", model_name: "SKYLINE", lot: "L1", start: 4000000, avg_price: 4000000, rate: "4.5" });

function seed(member) {
  const env = makeEnv(`
    INSERT INTO settings (key,value) VALUES ('membership_enabled','1'),('free_result_limit','1');
    INSERT INTO users (id,name,email,portal_enabled,member,source) VALUES (1,'Buyer','b@x.com',1,${member},'public');
    INSERT INTO searches (id,client_id,label,active) VALUES (10,1,'GTR hunt',1);
    INSERT INTO queue (id,wishlist_id,client_id,lot_id,lot_json,status,token) VALUES (100,10,1,'L1','${LOT}','sent','tok1');
  `);
  env.STRIPE_SECRET_KEY = "sk_test_x";
  env.PUBLIC_URL = "https://jdmfinder.com.au";
  return env;
}

test("a free customer sees a locked teaser, not the car's details", async () => {
  const html = await portalPage(seed(0), { role: "client", id: 1 });
  assert.match(html, /Match found/, "the teaser confirms a match exists");
  assert.match(html, /Upgrade to see this car/, "the upgrade CTA is shown");
  assert.doesNotMatch(html, /skyline/i, "the car's model is hidden from free customers");
});

test("a member sees the full car details, no teaser", async () => {
  const html = await portalPage(seed(1), { role: "client", id: 1 });
  assert.match(html, /skyline/i, "members see the actual car");
  assert.doesNotMatch(html, /Upgrade to see this car/, "no locked teaser CTA for members");
});

test("the free cap follows free_result_limit: a second match stays hidden with a prompt", async () => {
  const env = makeEnv(`
    INSERT INTO settings (key,value) VALUES ('membership_enabled','1'),('free_result_limit','1');
    INSERT INTO users (id,name,email,portal_enabled,member,source) VALUES (1,'Buyer','b@x.com',1,0,'public');
    INSERT INTO searches (id,client_id,label,active) VALUES (10,1,'GTR hunt',1);
    INSERT INTO queue (id,wishlist_id,client_id,lot_id,lot_json,status,token) VALUES (100,10,1,'L1','${LOT}','sent','tok1');
    INSERT INTO queue (id,wishlist_id,client_id,lot_id,lot_json,status,token) VALUES (101,10,1,'L2','${LOT}','sent','tok2');
  `);
  env.STRIPE_SECRET_KEY = "sk_test_x";
  env.PUBLIC_URL = "https://jdmfinder.com.au";
  const html = await portalPage(env, { role: "client", id: 1 });
  assert.match(html, /Plus 1 more match waiting/, "extra matches are teased, not shown");
});

test("a managed client (member 0, no public source) sees full details, never the teaser", async () => {
  const env = makeEnv(`
    INSERT INTO settings (key,value) VALUES ('membership_enabled','1'),('free_result_limit','1');
    INSERT INTO users (id,name,email,portal_enabled,member) VALUES (1,'Managed','m@x.com',1,0);
    INSERT INTO searches (id,client_id,label,active) VALUES (10,1,'Managed hunt',1);
    INSERT INTO queue (id,wishlist_id,client_id,lot_id,lot_json,status,token) VALUES (100,10,1,'L1','${LOT}','sent','tok1');
  `);
  env.STRIPE_SECRET_KEY = "sk_test_x";
  env.PUBLIC_URL = "https://jdmfinder.com.au";
  const html = await portalPage(env, { role: "client", id: 1 });
  assert.match(html, /skyline/i, "a managed client (source null) is never locked out");
  assert.doesNotMatch(html, /Upgrade to see this car/, "no teaser for managed clients");
});
