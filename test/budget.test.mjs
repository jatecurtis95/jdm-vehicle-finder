// The public request form makes an all-in AUD budget mandatory (to qualify leads
// and weed out time-wasters) and converts it to an approximate JPY auction-price
// ceiling that drives matching.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { createRequest } from "../src/admin.js";
import { audBudgetToYen } from "../src/calc.js";

const fd = (obj) => { const f = new FormData(); for (const [k, v] of Object.entries(obj)) f.set(k, v); return f; };

test("audBudgetToYen backs out import overhead + tax and converts at FX", () => {
  const y = audBudgetToYen(35000, 95);
  assert.ok(y > 1_800_000 && y < 2_600_000, "~¥2.2M ceiling for a $35k all-in budget");
  assert.ok(audBudgetToYen(80000, 95) > audBudgetToYen(35000, 95), "bigger budget → higher ceiling");
  assert.equal(audBudgetToYen(0, 95), null);
  assert.equal(audBudgetToYen("abc", 95), null);
  assert.ok(audBudgetToYen(6000, 95) > 0, "a tiny budget still floors to a small positive ceiling");
});

test("a request with no budget is rejected and creates nothing", async () => {
  const env = makeEnv();
  const r = await createRequest(env, fd({ name: "Dreamer", email: "d@example.com", marka_name: "NISSAN", portal_password: "Goodpass123" }));
  assert.equal(r.ok, false);
  assert.equal(r.error, "budget");
  assert.equal((await env.DB.prepare("SELECT COUNT(*) AS n FROM clients").first()).n, 0, "nothing stored");
});

test("a below-floor budget is rejected", async () => {
  const env = makeEnv();
  const r = await createRequest(env, fd({ name: "Lowball", email: "l@example.com", marka_name: "NISSAN", portal_password: "Goodpass123", budget_aud: "100" }));
  assert.equal(r.ok, false);
  assert.equal(r.error, "budget");
});

test("the AUD budget is converted to a yen ceiling on the saved search", async () => {
  const env = makeEnv();
  const r = await createRequest(env, fd({ name: "Buyer", email: "b@example.com", marka_name: "TOYOTA", portal_password: "Goodpass123", budget_aud: "35000" }));
  assert.equal(r.ok, true);
  const wl = await env.DB.prepare("SELECT price_max FROM wishlists WHERE client_id = ?").bind(r.clientId).first();
  assert.equal(wl.price_max, audBudgetToYen(35000, env.CALC_FX), "price_max is the converted yen ceiling");
  assert.equal(r.req.budget_aud, 35000, "the raw AUD figure is preserved for staff");
});
