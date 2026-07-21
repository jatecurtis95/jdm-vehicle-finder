// The "Share" feature: a signed token drives a read-only public lot view. The
// token must be unforgeable and view-only, one link must be revocable /
// regenerable without rotating ADMIN_TOKEN (the row nonce), and the public page
// must show the staff-authored guidance without leaking client/admin data.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv, readFile } from "./helpers/d1.mjs";
import { makeShareToken, readShareToken, verifyShareLink } from "../src/auth.js";
import { publicLotPage, updateShareDetails, setShareRevoked, regenerateShareLink } from "../src/admin.js";

// The public page heals lot images from the live feed; tests must never touch
// the network, so the feed just looks empty.
globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => "<aj></aj>", json: async () => ({}) });

function env(token = "topsecret") {
  const e = makeEnv(readFile("seed/seed-dev.sql"));
  e.ADMIN_TOKEN = token;
  return e;
}
const admin = { role: "admin", id: 0 };

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

test("nonce-bearing tokens verify only against their nonce", async () => {
  const e = env();
  const tok = await makeShareToken(e, 42, "abc");
  assert.equal(await readShareToken(e, tok, "abc"), 42);
  assert.equal(await readShareToken(e, tok, "xyz"), null, "wrong nonce must fail");
  assert.equal(await readShareToken(e, tok), null, "missing nonce must fail");
  const legacy = await makeShareToken(e, 42);
  assert.equal(await readShareToken(e, legacy, "abc"), null, "legacy token must fail once a nonce exists");
});

test("verifyShareLink honours the row's nonce, revocation and regeneration", async () => {
  const e = env();
  const row = await e.DB.prepare("SELECT id FROM queue LIMIT 1").first();
  // Fresh rows have no nonce, so legacy-shaped tokens (links already in the
  // wild) keep working.
  const legacyTok = await makeShareToken(e, row.id);
  assert.equal(await verifyShareLink(e, legacyTok), row.id);

  // Revoke: every token dies, with no distinguishable failure mode.
  await setShareRevoked(e, row.id, true, admin);
  assert.equal(await verifyShareLink(e, legacyTok), null);

  // Regenerate: re-enables the link under a new nonce; the old token stays dead.
  await regenerateShareLink(e, row.id, admin);
  assert.equal(await verifyShareLink(e, legacyTok), null, "pre-regeneration token must stay dead");
  const q = await e.DB.prepare("SELECT share_nonce, share_revoked_at FROM queue WHERE id = ?").bind(row.id).first();
  assert.ok(q.share_nonce, "regenerate must set a nonce");
  assert.equal(q.share_revoked_at, null, "regenerate must re-enable the link");
  const freshTok = await makeShareToken(e, row.id, q.share_nonce);
  assert.equal(await verifyShareLink(e, freshTok), row.id);

  // Garbage never verifies.
  assert.equal(await verifyShareLink(e, "999999.deadbeef"), null);
  assert.equal(await verifyShareLink(e, ""), null);
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

test("staff price guidance and condition notes render on the public page, escaped", async () => {
  const e = env();
  const row = await e.DB.prepare("SELECT id FROM queue WHERE status = 'pending' LIMIT 1").first();
  await updateShareDetails(e, row.id, {
    priceNote: "Suggest 16-17k landed <b>",
    conditionNotes: "Small scratches & dents.\nInterior slightly dirty.",
  }, admin);
  const html = await publicLotPage(e, row.id);
  assert.match(html, /Our price guidance/);
  assert.match(html, /clv-grid/, "renders the client listing layout");
  assert.match(html, /Suggest 16-17k landed &lt;b&gt;/, "price note must be escaped");
  assert.match(html, /Condition notes/);
  assert.match(html, /Small scratches &amp; dents\./);
  assert.match(html, /Interior slightly dirty\./);
  assert.match(html, /I&rsquo;m interested/);
  // The blurb rides into the social preview so WhatsApp unfurls answer
  // "what / how good / how much" without opening the page.
  assert.match(html, /<meta property="og:description" content="Suggest 16-17k landed/);
});

test("page without staff guidance renders no empty price/notes shells", async () => {
  const e = env();
  const row = await e.DB.prepare("SELECT id FROM queue WHERE status = 'pending' AND share_price_note IS NULL LIMIT 1").first();
  const html = await publicLotPage(e, row.id);
  assert.doesNotMatch(html, /Our price guidance/);
  assert.doesNotMatch(html, /Condition notes/);
});

test("a revoked row renders the friendly not-found page even if called directly", async () => {
  const e = env();
  const row = await e.DB.prepare("SELECT id FROM queue LIMIT 1").first();
  await setShareRevoked(e, row.id, true, admin);
  const html = await publicLotPage(e, row.id);
  assert.match(html, /Car not found/);
});

test("an agent cannot manage share links for another agent's client", async () => {
  const e = env();
  // Find a queue row whose client is NOT owned by agent 5 and not shared.
  const row = await e.DB.prepare(
    `SELECT q.id FROM queue q JOIN clients c ON c.id = q.client_id
      WHERE COALESCE(c.agent_id, 0) != 5
        AND NOT EXISTS (SELECT 1 FROM client_shares s WHERE s.client_id = c.id AND s.agent_id = 5)
      LIMIT 1`
  ).first();
  if (!row) return; // seed has no such row; nothing to assert
  const stranger = { role: "agent", id: 5 };
  await assert.rejects(() => updateShareDetails(e, row.id, { priceNote: "x", conditionNotes: "y" }, stranger));
  await assert.rejects(() => setShareRevoked(e, row.id, true, stranger));
  await assert.rejects(() => regenerateShareLink(e, row.id, stranger));
});

test("unknown shared lot renders a friendly not-found", async () => {
  const html = await publicLotPage(env(), 999999);
  assert.match(html, /Car not found/);
});
