// Emailed approve/skip must stay safe AND keep working: a bare GET /decide is
// POST-only (a link scanner can't silently mutate), while the digest email links
// to a GET confirmation page whose button POSTs to /decide.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import worker from "../src/index.js";
import { digestHtml } from "../src/render.js";

const ctx = { waitUntil() {} };
const get = (p) => new Request("https://jdmfinder.com.au" + p);

test("GET /decide stays POST-only (405) so a link prefetch can't mutate state", async () => {
  const res = await worker.fetch(get("/decide?token=t&action=reject"), makeEnv(), ctx);
  assert.equal(res.status, 405);
});

test("GET /decide/confirm shows a POST confirmation so inbox approve still works", async () => {
  const res = await worker.fetch(get("/decide/confirm?token=tok123&action=approve"), makeEnv(), ctx);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<form method="POST" action="\/decide"/, "the button POSTs to /decide");
  assert.match(html, /name="token" value="tok123"/);
  assert.match(html, /name="action" value="approve"/);
  assert.match(html, /Approve/);
});

test("GET /decide/confirm rejects a missing or invalid action", async () => {
  assert.equal((await worker.fetch(get("/decide/confirm?token=t&action=bogus"), makeEnv(), ctx)).status, 400);
  assert.equal((await worker.fetch(get("/decide/confirm?action=approve"), makeEnv(), ctx)).status, 400);
});

test("digest email approve/skip links point at the confirmation page, not a mutating GET", () => {
  const summary = [{
    wishlist: { marka_name: "NISSAN", model_name: "GT-R" },
    queued: [{ lot: { year: "2010", marka_name: "NISSAN", model_name: "GT-R" }, token: "TOKz" }],
  }];
  const html = digestHtml(summary, "https://jdmfinder.com.au");
  assert.match(html, /\/decide\/confirm\?token=TOKz/, "links to the confirm page");
  assert.doesNotMatch(html, /\/decide\?token=/, "no bare mutating GET /decide links");
});
