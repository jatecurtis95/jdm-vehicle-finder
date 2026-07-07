// Finder V1.2 Phase 2: request wizard UX fixes.
// - Refine fields (nickname, mileage, grade, chassis) live on the Find car step.
// - Budget is AUD on-road with a live yen-equivalent element.
// - Model is a feed-backed select (no "pick or type" hint anywhere).
// - Changing Make clears the chassis code along with the model (script contract).
// - Presets ship empty until the SEVS-vetted list is supplied, and the
//   dropdown hides itself while the list is empty.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv, readFile } from "./helpers/d1.mjs";
import { requestPage, adminPage, createRequest } from "../src/admin.js";
import { audBudgetToYen } from "../src/calc.js";

const ADMIN = { role: "admin", id: 0 };

function step(html, n) {
  const i = html.indexOf(`data-step="${n}"`);
  const j = html.indexOf("</section>", i);
  assert.ok(i > -1 && j > i, `step ${n} section exists`);
  return html.slice(i, j);
}

test("refine fields and the nickname sit on the Find car step, not a later page", async () => {
  const html = await requestPage(makeEnv());
  const s1 = step(html, 1);
  for (const name of ["label", "mileage_max", "rate_min", "kuzov"]) {
    assert.match(s1, new RegExp(`name="${name}"`), `${name} is on step 1`);
  }
  // Nickname is visible (top of the section), not inside the refine fold.
  const fold = s1.indexOf("Refine my search");
  const nick = s1.indexOf('name="label"');
  assert.ok(nick > -1 && (fold === -1 || nick < fold), "nickname sits above the refine fold");
  const s2 = step(html, 2);
  for (const name of ["mileage_max", "rate_min", "kuzov"]) {
    assert.doesNotMatch(s2, new RegExp(`name="${name}"`), `${name} no longer on step 2`);
  }
});

test("budget is labelled AUD on-road and carries the live yen-equivalent element", async () => {
  const html = await requestPage(makeEnv());
  const s2 = step(html, 2);
  assert.match(s2, /Max budget/);
  assert.match(s2, /AUD, on-road/);
  assert.match(s2, /id="rq-yen"/, "the yen equivalent line renders");
  // The wizard script mirrors the server's inverse so preview == stored ceiling.
  assert.match(html, /Math\.max\(\(n-OVH\)\/TAX,MINCAR\)\*FX/, "yen preview uses the audBudgetToYen formula");
});

test("model fields are feed-backed selects with no 'pick or type' hint anywhere", async () => {
  const pub = await requestPage(makeEnv());
  assert.match(pub, /<select name="model_name" id="rq-models"/);
  assert.doesNotMatch(pub, /pick or type/i);
  const intake = await adminPage(makeEnv(), "intake", ADMIN);
  assert.doesNotMatch(intake, /pick or type/i);
});

test("changing Make clears the chassis code with the model (script contract)", () => {
  const src = readFile("src/admin.js");
  const i = src.indexOf('mk.addEventListener("change"');
  assert.ok(i > -1);
  const handler = src.slice(i, i + 400);
  assert.match(handler, /kuzov/, "the make-change handler clears the chassis code");
});

test("presets ship empty (SEVS-vetted list pending) and the dropdown hides itself", async () => {
  const src = readFile("src/admin.js");
  assert.match(src, /const WL_PRESETS = \[\];/, "preset data is empty until Jate/Ben supply the vetted list");
  const intake = await adminPage(makeEnv(), "intake", ADMIN);
  assert.doesNotMatch(intake, /Quick preset/, "no preset dropdown renders while the list is empty");
});

test("the wishlist stores the AUD budget alongside the yen ceiling", async () => {
  const env = makeEnv();
  const f = new FormData();
  for (const [k, v] of Object.entries({
    name: "Both Figures", email: "both@example.com", whatsapp: "0412345678",
    marka_name: "TOYOTA", model_name: "SUPRA", year_min: "1993", year_max: "2002",
    budget_aud: "45000", portal_password: "Goodpass123",
  })) f.set(k, v);
  const r = await createRequest(env, f);
  assert.equal(r.ok, true);
  const wl = await env.DB.prepare("SELECT price_max, budget_aud FROM wishlists WHERE client_id = ?").bind(r.clientId).first();
  assert.equal(wl.budget_aud, 45000, "the AUD figure is stored");
  assert.equal(wl.price_max, audBudgetToYen(45000, env.CALC_FX), "the matcher's yen ceiling is unchanged");
});
