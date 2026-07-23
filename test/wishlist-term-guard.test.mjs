// V1.3 Phase 5: a saved search must always keep at least one narrowing term
// (make, model, chassis, grade keyword or model code). Creation enforces this,
// but the EDIT paths did not - blanking every field via edit turned the search
// into a whole-feed match-everything, exactly what the create guard exists to
// prevent. Both the staff and the portal edit must refuse a blanked search and
// leave the stored row untouched.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv, readFile } from "./helpers/d1.mjs";
import { createWishlist, editWishlist, portalAddWishlist, portalEditWishlist } from "../src/admin.js";

const ADMIN = { role: "admin", id: 0 };

function fd(obj) {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
}

function seededEnv() {
  const env = makeEnv(`
    INSERT INTO users (id, name, email, portal_enabled) VALUES (1, 'Cust', 'c@x.com', 1);
  `);
  return env;
}

test("staff edit refuses to blank every narrowing term and keeps the row intact", async () => {
  const env = seededEnv();
  const c = await createWishlist(env, fd({ client_id: "1", marka_name: "SUBARU", model_name: "IMPREZA" }), null, ADMIN);
  assert.equal(c.ok, true);
  const id = env.db.prepare("SELECT id FROM searches WHERE client_id = 1").get().id;

  const r = await editWishlist(env, fd({ id: String(id), marka_name: "", model_name: "", kuzov: "", grade_kw: "", model_code: "" }), ADMIN);
  assert.ok(r && r.ok === false && r.error === "term", "the blanked edit is refused with the term error");
  const w = env.db.prepare("SELECT marka_name, model_name FROM searches WHERE id = ?").get(id);
  assert.equal(w.marka_name, "SUBARU", "the stored search is untouched");
  assert.equal(w.model_name, "IMPREZA");
});

test("staff edit with at least one term still saves normally", async () => {
  const env = seededEnv();
  await createWishlist(env, fd({ client_id: "1", marka_name: "SUBARU", model_name: "IMPREZA" }), null, ADMIN);
  const id = env.db.prepare("SELECT id FROM searches WHERE client_id = 1").get().id;
  const r = await editWishlist(env, fd({ id: String(id), marka_name: "TOYOTA", model_name: "", kuzov: "", grade_kw: "", model_code: "" }), ADMIN);
  assert.ok(!r || r.ok !== false, "a one-term edit is accepted");
  assert.equal(env.db.prepare("SELECT marka_name FROM searches WHERE id = ?").get(id).marka_name, "TOYOTA");
});

test("portal edit refuses a blanked search server-side", async () => {
  const env = seededEnv();
  const session = { role: "client", id: 1 };
  const a = await portalAddWishlist(env, fd({ marka_name: "HONDA", model_name: "S2000" }), session);
  assert.equal(a.ok, true);
  const id = env.db.prepare("SELECT id FROM searches WHERE client_id = 1").get().id;

  const r = await portalEditWishlist(env, fd({ id: String(id), marka_name: "", model_name: "", kuzov: "", grade_kw: "", model_code: "" }), session);
  assert.ok(r && r.ok === false && r.error === "term", "portal edit refuses the blanked search");
  assert.equal(env.db.prepare("SELECT marka_name FROM searches WHERE id = ?").get(id).marka_name, "HONDA");
});

test("the portal edit route surfaces the refusal instead of flashing success", () => {
  const src = readFile("src/index.js");
  const route = src.slice(src.indexOf('"/portal/wishlist/edit"'));
  assert.match(route.slice(0, 400), /err=save/, "the portal edit route must branch to an error notice on a refused save");
});
