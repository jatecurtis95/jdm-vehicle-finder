// sendPush: a phone "chime" for new signups/payments via Pushover or ntfy.
// Server-side trigger, so it reaches the phone with the site closed. No-ops
// until a provider is configured; never throws.
import { test } from "node:test";
import assert from "node:assert/strict";
import { sendPush } from "../src/notify.js";

test("uses Pushover when its secrets are set", async () => {
  let url = null, body = null;
  globalThis.fetch = async (u, opts) => { url = String(u); body = opts.body; return { ok: true, status: 200 }; };
  const ok = await sendPush({ PUSHOVER_TOKEN: "t", PUSHOVER_USER: "u", PUSHOVER_SOUND: "cashregister" },
    { title: "New signup", message: "jate wants a Supra", url: "https://x/admin" });
  assert.equal(ok, true);
  assert.match(url, /api\.pushover\.net/);
  const p = new URLSearchParams(body);
  assert.equal(p.get("token"), "t");
  assert.equal(p.get("user"), "u");
  assert.equal(p.get("sound"), "cashregister");
  assert.match(p.get("message"), /Supra/);
});

test("uses ntfy when NTFY_TOPIC is set, with an ASCII-safe Title header", async () => {
  let url = null, headers = null, body = null;
  globalThis.fetch = async (u, opts) => { url = String(u); headers = opts.headers; body = opts.body; return { ok: true, status: 200 }; };
  const ok = await sendPush({ NTFY_TOPIC: "jdm-finder-7h2k9x", NTFY_PRIORITY: "high" },
    { title: "New signup — jate", message: "wants a Supra", url: "https://x/admin" });
  assert.equal(ok, true);
  assert.equal(url, "https://ntfy.sh/jdm-finder-7h2k9x");
  assert.ok(!/[^\x20-\x7E]/.test(headers.Title), "Title header is ASCII-safe");
  assert.equal(headers.Priority, "high");
  assert.equal(headers.Click, "https://x/admin");
  assert.equal(body, "wants a Supra");
});

test("no-ops (returns false, no fetch) when no provider is configured", async () => {
  let called = false;
  globalThis.fetch = async () => { called = true; return { ok: true, status: 200 }; };
  const ok = await sendPush({}, { title: "x", message: "y" });
  assert.equal(ok, false);
  assert.equal(called, false);
});

test("never throws when the provider call fails", async () => {
  globalThis.fetch = async () => { throw new Error("network down"); };
  const ok = await sendPush({ NTFY_TOPIC: "t" }, { title: "x", message: "y" });
  assert.equal(ok, false);
});
