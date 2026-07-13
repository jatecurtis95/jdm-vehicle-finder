import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import worker from "../src/index.js";
import { loginPage, adminPage, clientDrawerFragment } from "../src/admin.js";
import { landingPage } from "../src/landing.js";
import { sessionCookie } from "../src/auth.js";
import { adoptionSql } from "../scripts/adopt-migration-tracking.mjs";
import { makeEnv } from "./helpers/d1.mjs";

const CTX = { waitUntil() {} };
const HOST = "https://jdmfinder.com.au";

async function cookieFor(env, role, id) {
  return (await sessionCookie(env, role, id)).split(";")[0];
}

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

// Landing photography ships as right-sized WebP with a preloaded hero
// (launch audit: ~2.75MB of full-res JPEGs drove a ~6s mobile LCP).
test("landing photography ships as sized WebP with a preloaded hero", async () => {
  const html = await landingPage(makeEnv());
  assert.match(html, /<link rel="preload" as="image" href="\/assets\/photo\/web\/hero_r32_garage-1280\.webp" imagesrcset="[^"]*hero_r32_garage-720\.webp 720w/, "hero preloads with a mobile variant");
  assert.match(html, /id="heroImg" fetchpriority="high"/, "hero image stays the priority fetch");
  assert.match(html, /src="\/assets\/photo\/web\/hero_r32_garage-1280\.webp"[^>]+width="1280" height="1920"/, "real pixel dimensions, not the old 1600x1067 constant");
  assert.ok(!/<img src="\/assets\/photo\/web\/[^"]+\.jpg"/.test(html), "no full-resolution JPEG is referenced");
});

// "Start membership" must lead to the paid path (login -> /portal/subscribe),
// never the free request wizard (launch audit: membership signup was broken).
// Runs after the live-card test above: landingPage caches the lineup per
// isolate, so the fixtured render must prime that cache first.
test("Start membership routes to the paid subscribe path, not the free form", async () => {
  const env = makeEnv(`INSERT INTO clients (id, name, email) VALUES (7, 'Casey Client', 'c@x.com');`);
  env.ADMIN_TOKEN = "test-admin-token"; // sessionCookie() signs with this
  const landing = await landingPage(env);
  assert.match(landing, /<a class="jf-gold" href="\/login\?next=subscribe">Start membership<\/a>/, "landing CTA targets the login hop");
  // The login form carries the whitelisted next value through the POST.
  assert.match(loginPage({ next: "subscribe" }), /action="\/login\?next=subscribe"/, "form action keeps next=");
  assert.match(loginPage({}), /action="\/login"(?!\?)/, "plain login stays plain");
  // A signed-in client hitting the CTA lands on the subscribe page...
  const client = await worker.fetch(new Request(HOST + "/login?next=subscribe", {
    headers: { Cookie: await cookieFor(env, "client", 7) }, redirect: "manual",
  }), env, CTX);
  assert.equal(client.status, 303);
  assert.match(client.headers.get("location") || "", /\/portal\/subscribe$/, "client is sent to subscribe");
  // ...while any other role ignores the hint (no cross-role redirect surface).
  const admin = await worker.fetch(new Request(HOST + "/login?next=subscribe", {
    headers: { Cookie: await cookieFor(env, "admin", 0) }, redirect: "manual",
  }), env, CTX);
  assert.match(admin.headers.get("location") || "", /\/admin$/, "admins still land on /admin");
  // Unknown next values are dropped entirely (no open-redirect vector).
  const stranger = await worker.fetch(new Request(HOST + "/login?next=https%3A%2F%2Fevil.example"), env, CTX);
  assert.match(await stranger.text(), /action="\/login"(?!\?)/, "unknown next never reaches the form");
});

// Every admin vehicle link must carry queue.id (what view=lot resolves by),
// never the external auction lot_id (launch audit: "latest car" links 404'd
// with "This vehicle is no longer in your queue").
test("admin vehicle links use queue.id, not the external lot_id", async () => {
  const lotJson = JSON.stringify({ id: "EXT-777", lot: "42", marka_name: "NISSAN", model_name: "SKYLINE", year: 1999 });
  const env = makeEnv(`
    INSERT INTO clients (id, name, email) VALUES (1, 'Alice Apple', 'a@x.com');
    INSERT INTO wishlists (id, client_id, label, marka_name) VALUES (1, 1, 'R34 hunt', 'NISSAN');
    INSERT INTO queue (id, wishlist_id, client_id, lot_id, lot_json, status, token, sent_at)
      VALUES (5, 1, 1, 'EXT-777', '${lotJson}', 'sent', 't5', datetime('now'));
  `);
  const admin = { role: "admin", id: 0 };
  const requests = await adminPage(env, "requests", admin);
  assert.match(requests, /view=lot&id=5/, "requests latest-car link carries queue.id");
  assert.ok(!requests.includes("view=lot&id=EXT-777"), "requests never links the raw lot_id");
  const drawer = await clientDrawerFragment(env, 1, admin);
  assert.match(drawer, /view=lot&id=5/, "client drawer match link carries queue.id");
  assert.ok(!drawer.includes("view=lot&id=EXT-777"), "drawer never links the raw lot_id");
  const search = await adminPage(env, "search", admin, { q: "EXT-777" });
  assert.match(search, /view=lot&id=5/, "global search match link carries queue.id");
  assert.ok(!search.includes("view=lot&id=EXT-777"), "search never links the raw lot_id");
});

// /run fans out every customer search and can notify clients directly, so it
// must never fire from a bare GET (launch audit: opening the link ran it).
test("Run Searches only fires on a confirmed same-origin POST", async () => {
  const env = makeEnv();
  env.ADMIN_TOKEN = "test-admin-token";
  const cookie = await cookieFor(env, "admin", 0);
  // A bare GET (bookmark, prefetch, pasted link) redirects without running.
  const get = await worker.fetch(new Request(HOST + "/run", { headers: { Cookie: cookie }, redirect: "manual" }), env, CTX);
  assert.equal(get.status, 303);
  assert.ok(!/ran=/.test(get.headers.get("location") || ""), "GET never runs the matcher");
  // A cross-origin POST is refused by the existing same-origin guard.
  const forged = await worker.fetch(new Request(HOST + "/run", {
    method: "POST", redirect: "manual",
    headers: { Cookie: cookie, Origin: "https://evil.example" },
  }), env, CTX);
  assert.equal(forged.status, 403, "cross-origin POST is blocked");
  // The real confirm-button POST still runs and reports its count.
  const real = await worker.fetch(new Request(HOST + "/run", {
    method: "POST", redirect: "manual",
    headers: { Cookie: cookie, Origin: HOST },
  }), env, CTX);
  assert.equal(real.status, 303);
  assert.match(real.headers.get("location") || "", /ran=\d/, "POST runs and redirects with the count");
});

// The dealer feature ships hidden until approved stock actually reaches buyers
// (launch audit). The Settings toggle controls the admin surface; an invited
// dealer's own portal keeps working, and its nav links the real route.
test("dealer feature is hidden for launch behind its Settings toggle", async () => {
  const env = makeEnv(`INSERT INTO dealers (id, email, name, pass_salt, pass_hash, active) VALUES (1, 'd@x.com', 'Dan Dealer', 's', 'h', 1);`);
  env.ADMIN_TOKEN = "test-admin-token";
  const admin = { role: "admin", id: 0 };
  // Off (the default): no dealer nav items, and view=dealers bounces home.
  const off = await adminPage(env, "dealers", admin);
  assert.ok(!off.includes('href="/admin?view=dealers"'), "dealer nav hidden when off");
  assert.ok(!off.includes("Dealer stock"), "dealer stock nav hidden when off");
  // On: the admin views come back.
  await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('dealer_portal_enabled','1')").run();
  const on = await adminPage(env, "dealers", admin);
  assert.ok(on.includes('href="/admin?view=dealer-submissions"'), "dealer nav returns when enabled");
  // The dealer's own portal works regardless, and its sidebar link points at
  // the real route (launch audit: href="/dealer" was a guaranteed 404).
  const portal = await worker.fetch(new Request(HOST + "/dealer/portal", {
    headers: { Cookie: await cookieFor(env, "dealer", 1) },
  }), env, CTX);
  assert.equal(portal.status, 200);
  const html = await portal.text();
  assert.match(html, /href="\/dealer\/portal"/, "dealer nav links the real route");
  assert.ok(!html.includes('href="/dealer"'), "the bare /dealer 404 link is gone");
});

// A provider outage must never render as "0 lots" / an empty market
// (launch audit). The bare test env has no feed URL, so the fetch throws -
// exactly the outage path.
test("an auction feed outage shows an error state, not 0 lots", async () => {
  const env = makeEnv(`INSERT INTO clients (id, name, email, portal_enabled, member) VALUES (7, 'Casey Client', 'c@x.com', 1, 1);`);
  env.ADMIN_TOKEN = "test-admin-token";
  const res = await worker.fetch(new Request(HOST + "/portal/auctions", {
    headers: { Cookie: await cookieFor(env, "client", 7) },
  }), env, CTX);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /can't reach the live auction feed/, "outage copy renders");
  assert.match(html, /feed unavailable/, "the toolbar count is replaced");
  assert.ok(!html.includes("0 lots"), "never shows 0 lots during an outage");
  assert.ok(!html.includes("No live lots in the feed right now"), "outage is not the normal empty state");
});

// Migration-tracking adoption (launch audit): the generated SQL must record
// every numbered migration as applied - and only record, never execute.
test("adoption SQL backfills d1_migrations for every numbered migration", () => {
  const sql = adoptionSql();
  assert.match(sql, /CREATE TABLE IF NOT EXISTS d1_migrations/, "uses wrangler's own DDL");
  assert.match(sql, /INSERT OR IGNORE INTO d1_migrations/, "idempotent backfill");
  assert.ok(!/ALTER TABLE|CREATE TABLE IF NOT EXISTS (?!d1_migrations)/.test(sql), "never executes a migration");
  const files = readdirSync("migrations", { withFileTypes: true })
    .filter((f) => f.isFile() && f.name.endsWith(".sql")).map((f) => f.name);
  assert.ok(files.length >= 17, "sanity: the numbered migrations are present");
  for (const f of files) assert.ok(sql.includes(`('${f}')`), `${f} is recorded`);
  assert.ok(!sql.includes("legacy"), "legacy one-offs are never recorded");
});

// The form says "Name is required" - the server must actually enforce it
// (launch audit: a blank/whitespace name still created an account).
test("the request form rejects a blank name server-side", async () => {
  const env = makeEnv();
  const res = await worker.fetch(new Request(HOST + "/request", {
    method: "POST",
    headers: { Origin: HOST, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      name: "   ", email: "new@x.com", portal_password: "abc12345", whatsapp: "+61400000000",
      marka_name: "NISSAN", model_name: "SKYLINE", year_min: "1995", year_max: "2001", budget_aud: "30000",
    }),
  }), env, CTX);
  assert.match(await res.text(), /Please enter your name/, "form re-renders with the name error");
  const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM clients").first();
  assert.equal(n.n, 0, "no account row was created");
});

// The portal must only flash "Saved." when a search row was actually written
// (launch audit: a rejected save could still show success).
test("saving a search without any criteria reports an error, not Saved", async () => {
  const env = makeEnv(`INSERT INTO clients (id, name, email, portal_enabled) VALUES (7, 'Casey Client', 'c@x.com', 1);`);
  env.ADMIN_TOKEN = "test-admin-token";
  const cookie = await cookieFor(env, "client", 7);
  const save = (body) => worker.fetch(new Request(HOST + "/portal/wishlist", {
    method: "POST", redirect: "manual",
    headers: { Cookie: cookie, Origin: HOST, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  }), env, CTX);
  // No make/model/chassis/grade: nothing is written, so no success flash.
  const empty = await save({ label: "My search" });
  assert.match(empty.headers.get("location") || "", /err=save/, "criteria-less save flashes an error");
  const rows = await env.DB.prepare("SELECT COUNT(*) AS n FROM wishlists").first();
  assert.equal(rows.n, 0, "nothing was inserted");
  // A real save still says Saved.
  const good = await save({ marka_name: "NISSAN", model_name: "SKYLINE" });
  assert.match(good.headers.get("location") || "", /ok=saved/, "valid save still succeeds");
});
