// V1.2 Phase 4: model code and grade search. Wishlists store model_code and
// grades; the matcher narrows on them when present and builds IDENTICAL SQL
// when they are absent (existing matcher behaviour and tests unchanged).
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { buildSql, parseGrades, scoreMatch } from "../src/matcher.js";
import { createClient, createWishlist, editWishlist, gradesText } from "../src/admin.js";
import { labelForCode, MODEL_CODE_LABELS } from "../src/model-codes.js";

const ADMIN = { role: "admin", id: 0 };
const fd = (obj) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) v.forEach((x) => f.append(k, x));
    else f.set(k, String(v));
  }
  return f;
};

test("buildSql is unchanged for wishlists without model_code/grades", () => {
  const w = { marka_name: "TOYOTA", model_name: "SUPRA", year_min: 1993 };
  const base = buildSql(w);
  const withNulls = buildSql({ ...w, model_code: null, grades: null });
  assert.equal(withNulls, base, "null new fields produce identical SQL");
  assert.ok(!/model_code/i.test(base));
});

test("buildSql narrows on model_code and ORs the grade spellings", () => {
  const sql = buildSql({ marka_name: "MERCEDES BENZ", model_name: "S CLASS", model_code: "222058", grades: JSON.stringify(["S450", "S450 Exclusive"]) });
  assert.ok(sql.includes("UPPER(kuzov) LIKE '%222058%'"), "model code filters the kuzov column");
  assert.ok(sql.includes("UPPER(grade) LIKE '%S450%' OR UPPER(grade) LIKE '%S450 EXCLUSIVE%'"), "grades OR together");
});

test("parseGrades handles JSON, legacy pipe strings and junk", () => {
  assert.deepEqual(parseGrades('["RS","RS Advance"]'), ["RS", "RS Advance"]);
  assert.deepEqual(parseGrades("RS|RS Advance"), ["RS", "RS Advance"]);
  assert.deepEqual(parseGrades(""), []);
  assert.deepEqual(parseGrades(null), []);
  assert.deepEqual(parseGrades("not json ["), ["not json ["]);
  assert.equal(parseGrades(JSON.stringify(Array.from({ length: 20 }, (_, i) => "g" + i))).length, 8, "capped at 8");
});

test("a model_code or grades selection counts as search specificity", () => {
  const lot = { start: 1000000, rate: "4" };
  const plain = scoreMatch(lot, { price_max: 2000000 });
  const withCode = scoreMatch(lot, { price_max: 2000000, model_code: "BNR32" });
  assert.ok(withCode > plain, "model_code adds the specificity bonus");
});

test("wishlists store and edit model_code and grades (multi-select and comma text)", async () => {
  const env = makeEnv();
  const c = await createClient(env, fd({ name: "Buyer", email: "mc@example.com" }), ADMIN);
  const r = await createWishlist(env, fd({ client_id: c.id, marka_name: "NISSAN", model_code: "BNR32", grades: ["GT-R", "GT-R V-SPEC"] }), undefined, ADMIN);
  assert.equal(r.ok, true);
  const w = env.DB.prepare("SELECT * FROM searches WHERE client_id = ?").bind(c.id).first();
  assert.equal(w.model_code, "BNR32");
  assert.deepEqual(JSON.parse(w.grades), ["GT-R", "GT-R V-SPEC"]);
  assert.equal(gradesText(w.grades), "GT-R, GT-R V-SPEC");
  // Edit via the plain comma-separated text input (the wishlist editor form).
  await editWishlist(env, fd({ id: w.id, marka_name: "NISSAN", model_code: "BNR34", grades: "GT-R, M-SPEC" }), ADMIN);
  const after = env.DB.prepare("SELECT * FROM searches WHERE id = ?").bind(w.id).first();
  assert.equal(after.model_code, "BNR34");
  assert.deepEqual(JSON.parse(after.grades), ["GT-R", "M-SPEC"]);
});

test("model_code alone is an acceptable narrowing term", async () => {
  const env = makeEnv();
  const c = await createClient(env, fd({ name: "Buyer", email: "mc2@example.com" }), ADMIN);
  const r = await createWishlist(env, fd({ client_id: c.id, model_code: "FD3S" }), undefined, ADMIN);
  assert.equal(r.ok, true, "model_code satisfies the narrowing-term guard");
});

test("labelForCode renders the reviewed association or the bare code", () => {
  assert.equal(labelForCode("bnr32"), "BNR32 - Skyline GT-R (R32)");
  assert.equal(labelForCode("ZZZ999"), "ZZZ999", "unknown codes stay bare");
  assert.equal(labelForCode(""), "");
  assert.ok(Object.keys(MODEL_CODE_LABELS).length > 30, "association list is populated");
});
