// The customer list separates trade vs retail (category) AND self-submitted vs
// staff-added (source), as two independent tab filters. Regression guard for the
// bug where the category tabs did nothing because the view never received the
// ?cat value. Also pins the new "Added by JDM / Public sign-ups" split and that
// staff-created clients are tagged source='jdm', public ones 'public'.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { adminPage, createClient, createRequest } from "../src/admin.js";

const ADMIN = { role: "admin", id: 0 };
const cf = (obj) => { const f = new FormData(); for (const [k, v] of Object.entries(obj)) f.set(k, v); return f; };

async function seed(env) {
  await createClient(env, cf({ name: "Trade Tom", email: "tom@x.com", category: "dealer" }), ADMIN);
  await createClient(env, cf({ name: "Retail Rita", email: "rita@x.com", category: "private" }), ADMIN);
  // A public self-submission (request form) -> source 'public'.
  const rf = cf({ name: "Public Pete", email: "pete@x.com", whatsapp: "0412345678", marka_name: "TOYOTA", model_name: "SUPRA", year_min: "1993", year_max: "2002", budget_aud: "40000", portal_password: "Goodpass123" });
  await createRequest(env, rf);
}

test("staff-added clients are tagged jdm, public submissions tagged public", async () => {
  const env = makeEnv();
  await seed(env);
  const rows = (await env.DB.prepare("SELECT name, source FROM users ORDER BY name").all()).results;
  const by = Object.fromEntries(rows.map((r) => [r.name, r.source]));
  assert.equal(by["Trade Tom"], "jdm", "staff add -> jdm");
  assert.equal(by["Retail Rita"], "jdm", "staff add -> jdm");
  assert.equal(by["Public Pete"], "public", "request form -> public");
});

test("category tabs actually filter the list (regression: ?cat was ignored)", async () => {
  const env = makeEnv();
  await seed(env);
  const dealers = await adminPage(env, "clients", ADMIN, { cat: "dealer" });
  assert.ok(dealers.includes("Trade Tom"), "dealer view shows the dealer");
  assert.ok(!dealers.includes("Retail Rita"), "dealer view hides private buyers");
  const priv = await adminPage(env, "clients", ADMIN, { cat: "private" });
  assert.ok(priv.includes("Retail Rita") && !priv.includes("Trade Tom"), "private view is filtered too");
});

test("source tabs split Added-by-JDM from Public sign-ups", async () => {
  const env = makeEnv();
  await seed(env);
  const jdm = await adminPage(env, "clients", ADMIN, { src: "jdm" });
  assert.ok(jdm.includes("Trade Tom") && jdm.includes("Retail Rita"), "JDM view shows staff-added clients");
  assert.ok(!jdm.includes("Public Pete"), "JDM view hides public sign-ups");
  const pub = await adminPage(env, "clients", ADMIN, { src: "public" });
  assert.ok(pub.includes("Public Pete") && !pub.includes("Trade Tom"), "Public view shows only self-submitted");
});

test("the two filters combine (dealer AND added-by-JDM)", async () => {
  const env = makeEnv();
  await seed(env);
  const html = await adminPage(env, "clients", ADMIN, { cat: "dealer", src: "jdm" });
  assert.ok(html.includes("Trade Tom"), "the JDM-added dealer shows");
  assert.ok(!html.includes("Retail Rita") && !html.includes("Public Pete"), "everything else is filtered out");
});

test("client saves still work when the source column is missing (drift tolerance)", async () => {
  const env = makeEnv();
  env.db.exec("ALTER TABLE users DROP COLUMN source");
  const r = await createClient(env, cf({ name: "No Column", email: "nc@x.com", category: "private" }), ADMIN);
  assert.equal(r.ok, true, "the client is created even though the DB lacks the source column");
});
