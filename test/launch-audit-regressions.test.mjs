import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { loginPage } from "../src/admin.js";
import { landingPage } from "../src/landing.js";
import { makeEnv } from "./helpers/d1.mjs";

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
  const env = makeEnv();
  env.AUCTION_FIXTURE = `<aj><row><id>audit-lot</id><lot>42</lot><auction>USS Tokyo</auction><auction_date>2099-01-15T02:00:00</auction_date><marka_name>NISSAN</marka_name><model_name>SKYLINE</model_name><year>2000</year><kuzov>BNR34</kuzov><grade>GT-R</grade><mileage>62000</mileage><rate>4.5</rate><start>9800000</start><lhdrive>0</lhdrive><images>https://img.test/front.jpg#https://img.test/rear.jpg</images></row></aj>`;
  const html = await landingPage(env);
  assert.match(html, /<main id="main"[^>]*>/);
  assert.match(html, /class="vc-photo">\s*<img[^>]+width="800"[^>]+height="600"/);
});
