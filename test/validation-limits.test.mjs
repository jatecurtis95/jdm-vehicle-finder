// V1.2 Phase 3: sitewide validation and limits. Server-side sanitisers must
// hold no matter what a hand-built POST sends: field lengths clipped, years
// four digits in 1970 to 2050, numerics positive and capped, phones E.164,
// wishlists capped per client and never match-all.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { createClient, createWishlist, editWishlist, phoneE164, WISHLIST_ACTIVE_CAP } from "../src/admin.js";

const ADMIN = { role: "admin", id: 0 };

function fd(obj) {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, String(v));
  return f;
}

test("phoneE164 normalises AU formats and rejects junk", () => {
  assert.equal(phoneE164("0412 345 678"), "+61412345678");
  assert.equal(phoneE164("+61 412 345 678"), "+61412345678");
  assert.equal(phoneE164("61412345678"), "+61412345678");
  assert.equal(phoneE164("+81 90-1234-5678"), "+819012345678");
  assert.equal(phoneE164("12345"), null, "too short");
  assert.equal(phoneE164("not a phone"), null);
  assert.equal(phoneE164("+123456789012345678"), null, "too long");
  assert.equal(phoneE164(""), null);
});

test("createClient rejects a bad email and a junk phone, stores E.164", async () => {
  const env = makeEnv();
  const bad = await createClient(env, fd({ name: "A", email: "not-an-email" }), ADMIN);
  assert.equal(bad.error, "email");
  const badPhone = await createClient(env, fd({ name: "B", whatsapp: "junk" }), ADMIN);
  assert.equal(badPhone.error, "whatsapp");
  const ok = await createClient(env, fd({ name: "C", whatsapp: "0412 345 678" }), ADMIN);
  assert.equal(ok.ok, true);
  const row = env.DB.prepare("SELECT whatsapp FROM users WHERE id = ?").bind(ok.id).first();
  assert.equal(row.whatsapp, "+61412345678", "stored in canonical E.164");
});

test("createWishlist clamps years, caps numerics, clips strings", async () => {
  const env = makeEnv();
  const c = await createClient(env, fd({ name: "Buyer", email: "b@example.com" }), ADMIN);
  const r = await createWishlist(env, fd({
    client_id: c.id,
    marka_name: "T".repeat(500),         // clipped to 60
    year_min: "1900",                     // out of range -> null
    year_max: "2049",
    price_max: "999999999999",            // capped
    mileage_max: "-5",                    // invalid -> null
    rate_min: "9",                        // clamped to 6
  }), undefined, ADMIN);
  assert.equal(r.ok, true);
  const w = env.DB.prepare("SELECT * FROM searches WHERE client_id = ?").bind(c.id).first();
  assert.equal(w.marka_name.length, 60);
  assert.equal(w.year_min, null);
  assert.equal(w.year_max, 2049);
  assert.equal(w.price_max, 100000000);
  assert.equal(w.mileage_max, null);
  assert.equal(w.rate_min, 6);
});

test("createWishlist refuses a match-all search and enforces the active cap", async () => {
  const env = makeEnv();
  const c = await createClient(env, fd({ name: "Buyer", email: "cap@example.com" }), ADMIN);
  const empty = await createWishlist(env, fd({ client_id: c.id, label: "everything" }), undefined, ADMIN);
  assert.equal(empty.error, "term", "a search with no narrowing term is refused");
  for (let i = 0; i < WISHLIST_ACTIVE_CAP; i++) {
    const r = await createWishlist(env, fd({ client_id: c.id, marka_name: "TOYOTA", label: "s" + i }), undefined, ADMIN);
    assert.equal(r.ok, true, "search " + i + " under the cap saves");
  }
  const over = await createWishlist(env, fd({ client_id: c.id, marka_name: "HONDA" }), undefined, ADMIN);
  assert.equal(over.error, "limit", "the search over the cap is refused");
});

test("editWishlist sanitises the same way (years, caps)", async () => {
  const env = makeEnv();
  const c = await createClient(env, fd({ name: "Buyer", email: "e@example.com" }), ADMIN);
  await createWishlist(env, fd({ client_id: c.id, marka_name: "MAZDA" }), undefined, ADMIN);
  const w = env.DB.prepare("SELECT id FROM searches WHERE client_id = ?").bind(c.id).first();
  await editWishlist(env, fd({ id: w.id, marka_name: "MAZDA", year_min: "2005", year_max: "1998", price_max: "2000000" }), ADMIN);
  const after = env.DB.prepare("SELECT * FROM searches WHERE id = ?").bind(w.id).first();
  assert.equal(after.year_min, 1998, "inverted years are swapped");
  assert.equal(after.year_max, 2005);
  assert.equal(after.price_max, 2000000);
});
