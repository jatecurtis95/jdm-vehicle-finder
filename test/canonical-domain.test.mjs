// One canonical public domain: jdmfinder.com.au. The other custom domains 301 to
// it (GET/HEAD only) so the site can never look like two different websites,
// while POSTs (forms, the Stripe webhook) and /assets stay verbatim on any host.
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { makeEnv } from "./helpers/d1.mjs";

test("non-canonical custom domains 301 to jdmfinder.com.au, preserving path + query", async () => {
  const env = makeEnv();
  for (const host of ["finder.jdmconnect.com.au", "www.jdmfinder.com.au"]) {
    const res = await worker.fetch(new Request(`https://${host}/admin?view=clients`), env, {});
    assert.equal(res.status, 301, `${host} should redirect`);
    assert.equal(res.headers.get("location"), "https://jdmfinder.com.au/admin?view=clients");
  }
});

test("the canonical domain is never redirected", async () => {
  const env = makeEnv();
  const res = await worker.fetch(new Request("https://jdmfinder.com.au/assets/logo-gold.png"), env, {});
  assert.notEqual(res.status, 301);
  assert.equal(res.headers.get("content-type"), "image/png");
});

test("the Stripe webhook POST is never host-redirected (a 301 would break Stripe)", async () => {
  const env = makeEnv();
  const res = await worker.fetch(
    new Request("https://finder.jdmconnect.com.au/webhooks/stripe", { method: "POST", body: "{}" }),
    env, {}
  );
  assert.notEqual(res.status, 301);
});

test("assets stay verbatim on the old host so already-sent email images keep loading", async () => {
  const env = makeEnv();
  const res = await worker.fetch(new Request("https://finder.jdmconnect.com.au/assets/logo-gold.png"), env, {});
  assert.notEqual(res.status, 301);
  assert.equal(res.headers.get("content-type"), "image/png");
});

test("the *.workers.dev fallback URL is left alone (not redirected)", async () => {
  const env = makeEnv();
  const res = await worker.fetch(new Request("https://jdm-vehicle-finder.jate-curtis.workers.dev/assets/logo-gold.png"), env, {});
  assert.notEqual(res.status, 301);
});
