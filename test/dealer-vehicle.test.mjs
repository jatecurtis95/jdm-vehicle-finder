// Item 4: dealer vehicle submissions are validated server-side. Client-side
// maxlength / min-max are advisory, so a hand-built POST must still be held to
// sane text lengths and numeric ranges, with a friendly, display-ready error.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { submitDealerVehicle, DEALER_VEHICLE_LIMITS as L } from "../src/admin.js";

const DEALER = { role: "dealer", id: 1 };

function fd(obj) {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, String(v));
  return f;
}

function seed() {
  const env = makeEnv(`
    INSERT INTO suppliers (id, email, name, pass_salt, pass_hash, active)
    VALUES (1, 'd@x.com', 'Dealer One', 's', 'h', 1);
  `);
  return env;
}

const valid = { make: "NISSAN", model: "SKYLINE", year: "1999", grade: "5", mileage_km: "60000", price_aud: "45000", location: "Sydney NSW", description: "Clean R34." };

test("a well-formed submission is accepted and stored", async () => {
  const env = seed();
  const r = await submitDealerVehicle(env, fd(valid), DEALER);
  assert.equal(r.ok, true);
  const row = env.db.prepare("SELECT * FROM dealer_vehicles WHERE id = ?").get(r.id);
  assert.equal(row.make, "NISSAN");
  assert.equal(row.year, 1999);
  assert.equal(row.mileage_km, 60000);
  assert.equal(row.price_aud, 45000);
  assert.equal(row.status, "pending");
});

test("make and model are required with a friendly message", async () => {
  const env = seed();
  assert.match((await submitDealerVehicle(env, fd({ ...valid, make: "" }), DEALER)).error, /Make is required/);
  assert.match((await submitDealerVehicle(env, fd({ ...valid, model: "   " }), DEALER)).error, /Model is required/);
});

test("over-length text fields are rejected, not truncated silently", async () => {
  const env = seed();
  const long = "X".repeat(L.make + 1);
  const r = await submitDealerVehicle(env, fd({ ...valid, make: long }), DEALER);
  assert.equal(r.ok, false);
  assert.match(r.error, new RegExp(`${L.make} characters or fewer`));
  const descLong = await submitDealerVehicle(env, fd({ ...valid, description: "d".repeat(L.description + 1) }), DEALER);
  assert.match(descLong.error, /Description must be/);
  assert.equal(env.db.prepare("SELECT COUNT(*) AS n FROM dealer_vehicles").get().n, 0, "nothing stored on rejection");
});

test("price must be a valid positive AUD amount inside the cap", async () => {
  const env = seed();
  for (const bad of ["0", "-100", "abc", "", String(L.priceMax + 1)]) {
    const r = await submitDealerVehicle(env, fd({ ...valid, price_aud: bad }), DEALER);
    assert.equal(r.ok, false, `price ${bad} rejected`);
    assert.match(r.error, /valid price/);
  }
  // Commas and a dollar sign are tolerated on a valid figure.
  const ok = await submitDealerVehicle(env, fd({ ...valid, price_aud: "$45,000" }), DEALER);
  assert.equal(ok.ok, true);
  assert.equal(env.db.prepare("SELECT price_aud FROM dealer_vehicles WHERE id = ?").get(ok.id).price_aud, 45000);
});

test("year, when supplied, must be a real model year; blank is allowed", async () => {
  const env = seed();
  for (const bad of ["1800", "3000", "99", "19999"]) {
    const r = await submitDealerVehicle(env, fd({ ...valid, year: bad }), DEALER);
    assert.equal(r.ok, false, `year ${bad} rejected`);
    assert.match(r.error, /Year must be between/);
  }
  const blank = await submitDealerVehicle(env, fd({ ...valid, year: "" }), DEALER);
  assert.equal(blank.ok, true);
  assert.equal(env.db.prepare("SELECT year FROM dealer_vehicles WHERE id = ?").get(blank.id).year, null);
});

test("mileage, when supplied, must be a non-negative km value under the cap", async () => {
  const env = seed();
  for (const bad of ["-1", String(L.mileageMax + 1), "1.5e9"]) {
    const r = await submitDealerVehicle(env, fd({ ...valid, mileage_km: bad }), DEALER);
    assert.equal(r.ok, false, `mileage ${bad} rejected`);
    assert.match(r.error, /Mileage/);
  }
});

test("a non-dealer session is refused", async () => {
  const env = seed();
  const r = await submitDealerVehicle(env, fd(valid), { role: "admin", id: 0 });
  assert.equal(r.ok, false);
  assert.match(r.error, /not signed in as a dealer/);
});

test("an inactive dealer cannot submit", async () => {
  const env = makeEnv(`INSERT INTO suppliers (id, email, name, pass_salt, pass_hash, active) VALUES (2, 'z@x.com', 'Off', 's', 'h', 0);`);
  const r = await submitDealerVehicle(env, fd(valid), { role: "dealer", id: 2 });
  assert.equal(r.ok, false);
  assert.match(r.error, /inactive/);
});
