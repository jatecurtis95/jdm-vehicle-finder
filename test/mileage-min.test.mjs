// Minimum-mileage search criterion (Shoto's request): mirrors mileage_max, so a
// buyer can exclude implausibly-low / wound-back odometers. Covers the matcher
// SQL, that the add-search form round-trips the value, and drift tolerance when
// the column hasn't been applied yet.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { buildSql } from "../src/matcher.js";
import { createClient, createWishlist } from "../src/admin.js";

const ADMIN = { role: "admin", id: 0 };
const cf = (obj) => { const f = new FormData(); for (const [k, v] of Object.entries(obj)) f.set(k, v); return f; };

test("buildSql adds a minimum-mileage floor only when it is set and positive", () => {
  assert.match(buildSql({ marka_name: "NISSAN", mileage_min: 50000 }), /mileage >= 50000/, "floor applied");
  assert.doesNotMatch(buildSql({ marka_name: "NISSAN" }), /mileage >=/, "no floor without the field");
  assert.doesNotMatch(buildSql({ marka_name: "NISSAN", mileage_min: 0 }), /mileage >=/, "zero is a no-op, not a clause");
});

test("min and max mileage combine into a band", () => {
  const sql = buildSql({ marka_name: "NISSAN", mileage_min: 40000, mileage_max: 120000 });
  assert.match(sql, /mileage <= 120000/, "upper bound present");
  assert.match(sql, /mileage >= 40000/, "lower bound present");
});

test("createWishlist stores mileage_min from the form", async () => {
  const env = makeEnv();
  const c = await createClient(env, cf({ name: "Buyer", email: "mm@x.com" }), ADMIN);
  const r = await createWishlist(env, cf({ client_id: String(c.id), marka_name: "TOYOTA", model_name: "CHASER", mileage_min: "60000", mileage_max: "150000" }), undefined, ADMIN);
  assert.equal(r.ok, true);
  const w = await env.DB.prepare("SELECT mileage_min, mileage_max FROM searches WHERE client_id = ?").bind(c.id).first();
  assert.equal(w.mileage_min, 60000, "the floor is stored");
  assert.equal(w.mileage_max, 150000, "the ceiling is stored too");
});

test("add-search still works when the mileage_min column is missing (drift tolerance)", async () => {
  const env = makeEnv();
  const c = await createClient(env, cf({ name: "Buyer2", email: "mm2@x.com" }), ADMIN);
  env.db.exec("ALTER TABLE searches DROP COLUMN mileage_min");
  const r = await createWishlist(env, cf({ client_id: String(c.id), marka_name: "TOYOTA", model_name: "SUPRA", mileage_min: "50000" }), undefined, ADMIN);
  assert.equal(r.ok, true, "the search saves even though the DB lacks the column yet");
});
