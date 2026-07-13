import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { loginPage } from "../src/admin.js";
import { landingPage } from "../src/landing.js";
import { makeEnv, readFile } from "./helpers/d1.mjs";

test("standalone login has a working skip target and semantic main landmark", () => {
  const html = loginPage();
  assert.match(html, /<a class="skip-link" href="#main">/);
  assert.match(html, /<main id="main"[^>]*>/);
  assert.doesNotMatch(html, /name="password"[^>]*\sautofocus(?:\s|>)/);
});

test("an unknown public URL returns the branded 404 instead of redirecting to login", async () => {
  const res = await worker.fetch(new Request("https://jdmfinder.com.au/not-a-real-page"), makeEnv(), {});
  assert.equal(res.status, 404);
  assert.equal(res.headers.get("location"), null);
  assert.match(await res.text(), /Page not found/);
});

test("the landing page uses a semantic main and reserves live-card image space", async () => {
  const env = makeEnv(readFile("seed/seed-dev.sql"));
  env.AUCTION_FIXTURE = readFile("seed/auction-fixture.example.xml");
  const html = await landingPage(env);
  assert.match(html, /<main id="main"[^>]*>/);
  assert.match(html, /class="vc-photo">\s*<img[^>]+width="800"[^>]+height="600"/);
});
