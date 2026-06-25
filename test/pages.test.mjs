// Every admin page renders within the shared frame and uses sentence-case
// labels (no ALL CAPS), so the pages visibly belong to one product.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv, readFile } from "./helpers/d1.mjs";
import { adminPage } from "../src/admin.js";

const ADMIN = { role: "admin", id: 0 };
const ALL_CAPS_LABEL = /<label[^>]*>\s*[A-Z][A-Z ]{2,}(?:<|\s)/;

for (const view of ["dashboard", "clients", "wishlists", "agents", "payments", "settings"]) {
  test(`admin page "${view}" renders in the shared frame with no ALL CAPS labels`, async () => {
    const env = makeEnv(readFile("seed/seed-dev.sql"));
    const html = await adminPage(env, view, ADMIN);
    assert.match(html, /<!doctype html|<aside class="side"/i, "renders the app frame");
    assert.ok(!ALL_CAPS_LABEL.test(html), "no shouty ALL CAPS <label> text");
  });
}

test("the Clients list uses colour-coded avatars from the shared palette", async () => {
  const env = makeEnv(readFile("seed/seed-dev.sql"));
  const html = await adminPage(env, "clients", ADMIN);
  assert.match(html, /class="avatar" style="background:#/, "avatar has a hashed colour");
});

test("gold accent token is the brief value across the admin", async () => {
  const env = makeEnv(readFile("seed/seed-dev.sql"));
  const html = await adminPage(env, "dashboard", ADMIN);
  assert.match(html, /--gold:#C9962F/);
});
