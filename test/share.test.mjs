// The "Share" feature: a stateless signed token drives a read-only public lot
// view. The token must be unforgeable, view-only, and the public page must not
// leak any client/admin information.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv, readFile } from "./helpers/d1.mjs";
import { makeShareToken, readShareToken } from "../src/auth.js";
import { publicLotPage } from "../src/admin.js";

function env(token = "topsecret") {
  const e = makeEnv(readFile("seed/seed-dev.sql"));
  e.ADMIN_TOKEN = token;
  return e;
}

test("share token round-trips and rejects tampering", async () => {
  const e = env();
  const tok = await makeShareToken(e, 42);
  assert.equal(await readShareToken(e, tok), 42);
  assert.equal(await readShareToken(e, "42.bogus"), null);
  assert.equal(await readShareToken(e, "abc"), null);
  assert.equal(await readShareToken(e, ""), null);
  // A token signed with a different ADMIN_TOKEN must not validate.
  assert.equal(await readShareToken(env("other-key"), tok), null);
});

test("public lot page shows the car but never client or admin data", async () => {
  const e = env();
  const row = await e.DB.prepare("SELECT id, client_id FROM queue WHERE status = 'pending' LIMIT 1").first();
  const client = await e.DB.prepare("SELECT name FROM clients WHERE id = ?").bind(row.client_id).first();
  const html = await publicLotPage(e, row.id);
  assert.match(html, /Enquire about this car/);
  assert.match(html, /plv-grid/);
  assert.ok(!html.includes(client.name), "must not leak the matched client's name");
  assert.ok(!/Approve|Back to matches|Feed image data/.test(html), "must not expose admin controls");
});

test("unknown shared lot renders a friendly not-found", async () => {
  const html = await publicLotPage(env(), 999999);
  assert.match(html, /Car not found/);
});
