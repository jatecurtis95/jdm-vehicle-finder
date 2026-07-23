// Whole-app render sweep: render every admin view and portal page through the
// real worker with seeded data, then scan the emitted HTML for defect classes
// that unit assertions miss - retired button classes surviving a rename,
// undefined/NaN leaking into markup, links to removed routes, and a tier
// class used on a page whose embedded CSS never defines it (the two CSS
// systems - admin.js CSS and theme.js themeCss - make that an easy miss).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import worker from "../src/index.js";
import { sessionCookie, makeShareToken } from "../src/auth.js";

const HOST = "https://jdmfinder.com.au";
const FEED_ROW = `<row><id>L1</id><marka_name>NISSAN</marka_name><model_name>SKYLINE</model_name><year>1999</year><rate>4</rate><start>1000000</start><finish>2500000</finish><auction>USS Tokyo</auction><auction_date>2027-01-01T00:00:00</auction_date><kuzov>BNR34</kuzov><kpp>MT</kpp><priv>4WD</priv><eng_v>2600</eng_v><color>white</color><images>https://img.test/a.jpg</images></row>`;

function seed() {
  return `
    INSERT INTO users (id, email, name, pass_salt, pass_hash, active, type) VALUES (5, 'ben@x.com', 'Ben', '', '', 1, 'agent');
    INSERT INTO users (id, name, email, whatsapp, portal_enabled, member, agent_id) VALUES
      (1, 'Jordan Member', 'jordan@x.com', '+61400111222', 1, 1, NULL),
      (2, 'Casey Free', 'casey@x.com', NULL, 1, 0, 5);
    INSERT INTO searches (id, client_id, label, marka_name, model_name, active, status, deposit_status) VALUES
      (1, 1, 'R34', 'NISSAN', 'SKYLINE', 1, 'searching', 'none'),
      (2, 2, 'Supra', 'TOYOTA', 'SUPRA', 1, 'deposit_requested', 'requested');
    INSERT INTO queue (id, wishlist_id, client_id, lot_id, lot_json, status, token, client_request) VALUES
      (10, 1, 1, 'L1', '{"year":1999,"marka_name":"NISSAN","model_name":"SKYLINE","lot":"42","images":["https://img.test/car.jpg"]}', 'pending', 't-1', 0),
      (11, 1, 1, 'L2', '{"year":1998,"marka_name":"NISSAN","model_name":"SILVIA","lot":"43"}', 'sent', 't-2', 1);
    INSERT INTO payments (client_id, amount_cents, currency, status, description, created_at) VALUES
      (1, 100000, 'aud', 'paid', 'Deposit', datetime('now'));
    INSERT INTO tasks (id, title, client_id, assigned_to, due_date, status) VALUES
      (1, 'Call Jordan re finance', 1, NULL, date('now'), 'todo');
  `;
}

// Retired in the four-tier button rename; none may ever reappear in markup.
const OLD_CLASSES = /btn-gold|btn-dark|btn-notify|btn-skip|btn-del(?!ete)(?![a-z-])|btn-line|btn-search|btn-link/;
const TIERS = ["btn-primary", "btn-secondary", "btn-tertiary", "btn-danger", "btn-sm", "run-btn"];

const stripScripts = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, "");

function scan(name, html) {
  const body = stripScripts(html);
  const m = body.match(OLD_CLASSES);
  assert.equal(m, null, `${name}: retired class "${m && m[0]}" survives in markup`);
  for (const bad of [">undefined<", '"undefined"', ">NaN<", "[object Object]"]) {
    assert.ok(!body.includes(bad), `${name}: literal ${bad} in output`);
  }
  assert.ok(!body.includes("/portal/sold"), `${name}: links to removed /portal/sold`);
  assert.ok(!body.includes("view=wishlists"), `${name}: links to removed view=wishlists`);
  const styles = (html.match(/<style[\s\S]*?<\/style>/gi) || []).join("\n");
  for (const t of TIERS) {
    const used = new RegExp(`class="[^"]*\\b${t}\\b`).test(body);
    if (used) assert.ok(new RegExp(`\\.${t}[\\s{,:.]`).test(styles), `${name}: class ${t} used but no .${t} rule in this page's CSS`);
  }
}

let env, ctx, adminCookie, agentCookie, clientCookie, freeCookie, realFetch;
before(async () => {
  realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => `<aj>${FEED_ROW}${FEED_ROW.replace(/L1/g, "L2").replace(/SKYLINE/g, "SILVIA")}</aj>`, json: async () => ({}) });
  env = makeEnv(seed());
  env.ADMIN_TOKEN = "test-secret";
  ctx = { waitUntil() {} };
  adminCookie = (await sessionCookie(env, "admin", 0)).split(";")[0];
  agentCookie = (await sessionCookie(env, "agent", 5)).split(";")[0];
  clientCookie = (await sessionCookie(env, "client", 1)).split(";")[0];
  freeCookie = (await sessionCookie(env, "client", 2)).split(";")[0];
});

async function render(path, cookie, want) {
  const req = new Request(HOST + path, { headers: cookie ? { Cookie: cookie } : {}, redirect: "manual" });
  const res = await worker.fetch(req, env, ctx);
  assert.equal(res.status, want, `${path} status`);
  return res.status === 200 ? res.text() : "";
}

test("every admin view, portal page and public page renders free of rename and output defects", async () => {
  // The public share page is token-gated; mint a real token for seeded row 10
  // so the sweep covers it like any other route.
  const shareTok = await makeShareToken(env, 10);
  const ROUTES = [
    [`/v?t=${encodeURIComponent(shareTok)}`, () => null, 200],
    ["/admin?view=dashboard", () => adminCookie, 200],
    ["/admin?view=requests", () => adminCookie, 200],
    ["/admin?view=requests&layout=board", () => adminCookie, 200],
    ["/admin?view=matches", () => adminCookie, 200],
    ["/admin?view=clients", () => adminCookie, 200],
    ["/admin?view=auctions&tab=live", () => adminCookie, 200],
    ["/admin?view=auctions&tab=prices", () => adminCookie, 200],
    ["/admin?view=auctions&tab=history", () => adminCookie, 200],
    ["/admin?view=payments", () => adminCookie, 200],
    ["/admin?view=settings", () => adminCookie, 200],
    ["/admin?view=search&q=nissan", () => adminCookie, 200],
    ["/admin?view=tasks", () => adminCookie, 200],
    ["/admin?view=agents", () => adminCookie, 200],
    ["/admin?view=intake", () => adminCookie, 200],
    ["/admin?view=wishlists", () => adminCookie, 200],
    ["/admin?view=client&id=1", () => adminCookie, 200],
    ["/admin?view=request&id=1", () => adminCookie, 200],
    ["/admin?view=lot&id=10", () => adminCookie, 200],
    ["/admin?view=dashboard", () => agentCookie, 200],
    ["/admin?view=requests", () => agentCookie, 200],
    ["/portal", () => clientCookie, 200],
    ["/portal", () => freeCookie, 200],
    ["/portal/auctions", () => clientCookie, 200],
    ["/portal/auctions?make=NISSAN", () => clientCookie, 200],
    ["/portal/history", () => clientCookie, 200],
    ["/portal/auctions/lot?id=L1", () => clientCookie, 200],
    ["/portal/subscribe", () => freeCookie, 200],
    ["/", () => null, 200],
    ["/login", () => null, 200],
    ["/request", () => null, 200],
    ["/privacy", () => null, 200],
    ["/terms", () => null, 200],
    ["/definitely-not-a-page", () => null, 404],
  ];
  for (const [path, cookie, want] of ROUTES) {
    const html = await render(path, cookie(), want);
    if (html) scan(path, html);
  }
});

test("legacy ?view=wishlists still lands on Customers, not the dashboard fallback", async () => {
  const html = await render("/admin?view=wishlists", adminCookie, 200);
  assert.match(html, /<title>Customers - JDM Connect<\/title>/);
});

test("the sidebar lists the daily six; Tasks and Agents live under Dashboard and Settings", async () => {
  const html = await render("/admin?view=dashboard", adminCookie, 200);
  const nav = html.match(/<nav class="nav">[\s\S]*?<\/nav>/)[0];
  for (const v of ["dashboard", "requests", "matches", "clients", "auctions", "payments", "settings"]) {
    assert.match(nav, new RegExp(`href="/admin\\?view=${v}"`), `nav keeps ${v}`);
  }
  assert.doesNotMatch(nav, /view=tasks/, "Tasks is out of the nav (folded into Dashboard)");
  assert.doesNotMatch(nav, /view=agents/, "Agents is out of the nav (moved under Settings)");
  assert.doesNotMatch(nav, /view=dealers/, "dealer items stay hidden while the flag is off");

  // The demoted views stay routable and highlight the item they live under.
  const tasks = await render("/admin?view=tasks", adminCookie, 200);
  assert.match(tasks.match(/<nav class="nav">[\s\S]*?<\/nav>/)[0], /class="active" href="\/admin\?view=dashboard"/);
  const agents = await render("/admin?view=agents", adminCookie, 200);
  assert.match(agents.match(/<nav class="nav">[\s\S]*?<\/nav>/)[0], /class="active" href="\/admin\?view=settings"/);

  // Settings carries the Team card that now owns agent management.
  const settings = await render("/admin?view=settings", adminCookie, 200);
  assert.match(settings, /id="set-team"/);
  assert.match(settings, /href="\/admin\?view=agents"/);
});
