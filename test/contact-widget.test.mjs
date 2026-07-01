// The floating "Chat with us on WhatsApp" button must appear on customer-facing
// pages (brandDoc) but never leak into the staff admin shell.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv, readFile } from "./helpers/d1.mjs";
import { brandDoc } from "../src/theme.js";
import { adminPage } from "../src/admin.js";

test("customer pages get the WhatsApp contact button", () => {
  const html = brandDoc("<main>hello</main>", "Test");
  assert.match(html, /wa\.me\/61415111221/, "links to the business WhatsApp number");
  assert.match(html, /Chat with us/);
  assert.match(html, /id="waFab"/);
  assert.match(html, /Away - leave a message/, "has the outside-hours state");
});

test("the staff admin does NOT show the customer WhatsApp button", async () => {
  const env = makeEnv(readFile("seed/seed-dev.sql"));
  const html = await adminPage(env, "dashboard", { role: "admin", id: 0 });
  assert.doesNotMatch(html, /wa\.me\/61415111221/);
  assert.doesNotMatch(html, /id="waFab"/);
});
