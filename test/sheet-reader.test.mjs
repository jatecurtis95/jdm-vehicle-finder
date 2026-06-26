// The AI auction-sheet reader: images are fetched server-side and sent as
// base64 (many JDM auction hosts block hotlinking, so handing Anthropic a raw
// URL fails), with a URL fallback. fixAllPhotos reads every un-read match in
// bounded batches so the cards heal.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv, readFile } from "./helpers/d1.mjs";
import { readAuctionSheet, fixAllPhotos } from "../src/sheet.js";

const RESULT = { found: true, sheet_index: 0, cover_index: 1, exterior: "B", interior: "C", repairs: [], equipment: [], notes_en: "ok", overall_grade: "4", mileage_km: "" };

test("images are fetched server-side and sent as base64", async () => {
  let sent = null, imgFetches = 0;
  globalThis.fetch = async (u, opts) => {
    if (String(u).includes("api.anthropic.com")) { sent = JSON.parse(opts.body); return { ok: true, status: 200, json: async () => ({ content: [{ type: "text", text: JSON.stringify(RESULT) }] }) }; }
    imgFetches++;
    return { ok: true, status: 200, headers: { get: () => "image/jpeg" }, arrayBuffer: async () => new Uint8Array([255, 216, 255, 1]).buffer };
  };
  const r = await readAuctionSheet({ ANTHROPIC_API_KEY: "k" }, "https://i/a?x=1#https://i/b?x=1", "claude-haiku-4-5");
  assert.equal(r.found, true);
  assert.equal(imgFetches, 2);
  const imgs = sent.messages[0].content.filter((b) => b.type === "image");
  assert.ok(imgs.every((b) => b.source.type === "base64"));
});

test("falls back to a URL block when the server-side image fetch fails", async () => {
  let sent = null;
  globalThis.fetch = async (u, opts) => {
    if (String(u).includes("api.anthropic.com")) { sent = JSON.parse(opts.body); return { ok: true, status: 200, json: async () => ({ content: [{ type: "text", text: JSON.stringify(RESULT) }] }) }; }
    throw new Error("hotlink blocked");
  };
  const r = await readAuctionSheet({ ANTHROPIC_API_KEY: "k" }, "https://i/a?x=1", "claude-haiku-4-5");
  assert.ok(!r.error);
  const blk = sent.messages[0].content.find((b) => b.type === "image");
  assert.equal(blk.source.type, "url");
});

test("fixAllPhotos reads every un-read match once, then is a no-op", async () => {
  let reads = 0;
  globalThis.fetch = async (u) => {
    const s = String(u);
    if (s.includes("api.anthropic.com")) { reads++; return { ok: true, status: 200, json: async () => ({ content: [{ type: "text", text: JSON.stringify(RESULT) }] }) }; }
    if (s.includes("feed")) return { ok: true, status: 200, text: async () => "<aj><row></row></aj>" };
    return { ok: true, status: 200, headers: { get: () => "image/jpeg" }, arrayBuffer: async () => new Uint8Array([255, 216, 255, 1]).buffer };
  };
  const env = makeEnv(readFile("seed/seed-dev.sql"));
  env.ANTHROPIC_API_KEY = "k"; env.API_BASE = "http://feed/api"; env.AVTONET_CODE = "c";
  const cid = (await env.DB.prepare("SELECT id FROM clients LIMIT 1").first()).id;
  await env.DB.prepare("DELETE FROM queue").run();
  for (let i = 0; i < 5; i++) {
    await env.DB.prepare("INSERT INTO queue (wishlist_id,client_id,lot_id,lot_json,status,token) VALUES (?,?,?,?,?,?)")
      .bind(1, cid, "L" + i, JSON.stringify({ id: "L" + i, images: "https://i/a" + i + "?x=1#https://i/b" + i + "?x=1" }), "pending", "t" + i).run();
  }
  assert.equal(await fixAllPhotos(env, "claude-haiku-4-5", 30, 3), 5);
  assert.equal(reads, 5);
  reads = 0;
  assert.equal(await fixAllPhotos(env, "claude-haiku-4-5", 30, 3), 0);
  assert.equal(reads, 0);
});
