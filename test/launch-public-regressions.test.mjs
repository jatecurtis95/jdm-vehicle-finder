import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import worker from "../src/index.js";
import {
  createRequest,
  portalAuctionsPage,
  portalSoldPage,
  publicLotPage,
  requestPage,
} from "../src/admin.js";
import { landingPage } from "../src/landing.js";
import { landingCss } from "../src/landing-css.js";
import { landingMotionScript } from "../src/landing-motion.js";
import { onboardingCss, wizardScript } from "../src/request-wizard.js";
import { brandShell, LOGO, privacyPage } from "../src/theme.js";
import { makeEnv, repoRoot } from "./helpers/d1.mjs";

const CTX = { waitUntil() {} };
const EMPTY_FEED = "<aj></aj>";
const wizard = () => wizardScript({
  pwMin: 8, pwMax: 128, budgetMin: 5000, signedIn: false,
  fx: 95, overheadAud: 9000, onValueTax: 1.13, minCarAud: 2000,
});

let landingHtmlPromise;
function landingHtml() {
  if (!landingHtmlPromise) {
    const env = makeEnv();
    env.AUCTION_FIXTURE = EMPTY_FEED;
    landingHtmlPromise = landingPage(env);
  }
  return landingHtmlPromise;
}

function completeRequest(overrides = {}) {
  const f = new FormData();
  for (const [k, v] of Object.entries({
    name: "Launch Buyer", email: "launch@example.com", whatsapp: "0412345678",
    portal_password: "Launchpass123", marka_name: "NISSAN", model_name: "SKYLINE",
    year_min: "1999", year_max: "2001", budget_aud: "55000", ...overrides,
  })) f.set(k, v);
  return f;
}

test("membership CTAs preserve purchase intent and never loop back to the request form", async () => {
  const landing = await landingHtml();
  assert.match(landing, /href="\/request\?(?:[^\"]*&amp;)*plan=membership[^\"]*"[^>]*>Start membership<\/a>/i);

  const env = makeEnv();
  env.AUCTION_FIXTURE = EMPTY_FEED;
  const intentPage = await worker.fetch(new Request("https://jdmfinder.com.au/request?plan=membership"), env, CTX);
  const intentHtml = await intentPage.text();
  assert.match(intentHtml, /(?:name="(?:plan|intent)"[^>]*value="membership"|action="\/request\?plan=membership")/i);

  const success = await requestPage(env, {
    submitted: true,
    req: { name: "Launch Buyer", email: "launch@example.com", portal: true },
    upsell: { priceAud: 49 },
  });
  const i = success.indexOf("Get full access");
  assert.ok(i > 0, "the full-access offer is visible");
  const cta = success.slice(Math.max(0, i - 500), i + 100);
  assert.match(cta, /portal\/subscribe/, "the upsell continues to checkout");
  assert.doesNotMatch(cta, /href="\/request"/, "the upsell does not restart onboarding");
});

test("anonymous requests require a real name on the server", async () => {
  const env = makeEnv();
  const result = await createRequest(env, completeRequest({ name: "   " }));
  assert.equal(result.ok, false);
  assert.equal(result.error, "name");
  assert.equal((await env.DB.prepare("SELECT COUNT(*) AS n FROM clients").first()).n, 0);
});

test("the name error is announced, routed to account step, and focused on submit", async () => {
  const env = makeEnv();
  env.AUCTION_FIXTURE = EMPTY_FEED;
  const html = await requestPage(env, { error: "name", vals: { name: "" } });
  assert.match(html, /data-error-step="4"/);
  assert.match(html, /id="rq-name"[^>]*aria-describedby="rq-name-error"/);
  assert.match(html, /id="rq-name-error"[^>]*role="alert"/);

  const script = wizard();
  assert.match(script, /rq-name-error/);
  const submit = script.slice(script.indexOf("form.addEventListener('submit'"), script.indexOf("root.classList.add"));
  assert.match(submit, /\.focus\(/, "invalid submit moves keyboard focus to the first invalid field");
});

test("request drafts expire, can be cleared, and retain model-code and multi-grade choices", async () => {
  const script = wizard();
  assert.match(script, /DRAFT_TTL/);
  assert.match(script, /savedAt\s*:\s*Date\.now\(\)/);
  assert.match(script, /model_code/);
  assert.match(script, /grades/);
  assert.match(script, /(?:selectedOptions|\.multiple)/, "multi-select values are serialised as a collection");

  const env = makeEnv();
  env.AUCTION_FIXTURE = EMPTY_FEED;
  const html = await requestPage(env);
  assert.match(html, /data-clear-draft/);
});

test("a request draft is cleared only after the server renders success", async () => {
  const script = wizard();
  const submit = script.slice(script.indexOf("form.addEventListener('submit'"), script.indexOf("root.classList.add"));
  assert.doesNotMatch(submit, /removeItem\(DRAFT\)/);

  const env = makeEnv();
  env.AUCTION_FIXTURE = EMPTY_FEED;
  const success = await requestPage(env, { submitted: true, req: { name: "Launch Buyer" } });
  assert.match(success, /localStorage\.removeItem\('jdmReqDraft'\)/);
});

test("buyer mobile navigation uses a real button and hides closed links from keyboard users", () => {
  const html = brandShell(
    '<aside class="side" id="buyerNav"><nav><a href="/portal">Garage</a></nav></aside>',
    "<h1>Garage</h1>",
  );
  assert.doesNotMatch(html, /type="checkbox"[^>]*id="navToggle"/);
  assert.match(html, /<button(?=[^>]*class="nav-burger")(?=[^>]*aria-controls="buyerNav")(?=[^>]*aria-expanded="false")[^>]*>/);
  assert.ok(/<aside[^>]*(?:\binert\b|aria-hidden="true")/.test(html) || /\.side\{[^}]*visibility:hidden/.test(html),
    "the off-canvas links are hidden or inert while the drawer is closed");
});

test("landing mobile menu exposes state, supports Escape, and restores focus", async () => {
  const html = await landingHtml();
  assert.match(html, /<button(?=[^>]*id="navBurger")(?=[^>]*aria-controls="navMenu")[^>]*>/);
  assert.match(html, /<div(?=[^>]*id="navMenu")(?=[^>]*(?:\bhidden\b|\binert\b))[^>]*>/);
  const motion = landingMotionScript(63780);
  assert.match(motion, /Escape/);
  assert.match(motion, /burger\.focus\(/);
});

test("logos and the request header fit a 320px viewport", () => {
  assert.doesNotMatch(LOGO, /style="[^"]*width\s*:\s*190px/);
  const phone = onboardingCss.slice(onboardingCss.indexOf("@media(max-width:360px)"));
  assert.match(phone, /\.ob-brand \.tag\{[^}]*display:none/);
  assert.match(phone, /\.ob-nav-in\{[^}]*padding/);
});

test("the WhatsApp contact button is lifted above mobile wizard controls", async () => {
  const env = makeEnv();
  env.AUCTION_FIXTURE = EMPTY_FEED;
  const html = await requestPage(env);
  assert.match(html, /<body[^>]*class="[^"]*request-page[^"]*"/);
  assert.match(html, /@media\(max-width:640px\)[\s\S]*\.request-page \.wa-fab\{bottom:calc\(96px/);
});

test("gold landing anchors resolve to dark, accessible text", () => {
  assert.match(landingCss, /\.jf\s+(?:a\.jf-gold|\.jf-gold)\{[^}]*color:#15120A/);
  assert.doesNotMatch(landingCss, /\.jf a\{[^}]*color:inherit/,
    "a more-specific inherited anchor colour must not override the gold CTA colour");
});

test("the public home has launch-ready SEO metadata and trust links", async () => {
  const html = await landingHtml();
  assert.match(html, /<meta(?=[^>]*name="description")(?=[^>]*content="[^"]{40,}")[^>]*>/i);
  assert.match(html, /<link(?=[^>]*rel="canonical")(?=[^>]*href="https:\/\/jdmfinder\.com\.au\/")[^>]*>/i);
  for (const key of ["og:title", "og:description", "og:url", "og:type"]) {
    assert.match(html, new RegExp(`<meta(?=[^>]*property=["']${key}["'])(?=[^>]*content=["'][^"']+)[^>]*>`, "i"));
  }
  const footer = html.slice(html.indexOf('<footer class="jf-foot"'));
  assert.match(footer, /href="\/privacy"/);
  assert.match(footer, /href="\/terms"/);
  assert.match(footer, /href="mailto:[^"]+"/);
});

test("sitemap, security contact, and customer terms are public routes", async () => {
  const env = makeEnv();
  for (const [path, type, body] of [
    ["/sitemap.xml", /xml/, /<urlset[\s\S]*https:\/\/jdmfinder\.com\.au\//],
    ["/.well-known/security.txt", /text\/plain/, /Contact:\s*mailto:/i],
    ["/terms", /text\/html/, /refund|cancel/i],
  ]) {
    const res = await worker.fetch(new Request(`https://jdmfinder.com.au${path}`), env, CTX);
    assert.equal(res.status, 200, path);
    assert.match(res.headers.get("content-type") || "", type, path);
    assert.match(await res.text(), body, path);
  }
});

test("a shared vehicle enquiry carries its lot context into the request", async () => {
  const env = makeEnv(`
    INSERT INTO clients (id,name) VALUES (1,'Buyer');
    INSERT INTO wishlists (id,client_id,label) VALUES (1,1,'Shared car');
    INSERT INTO queue (id,wishlist_id,client_id,lot_id,lot_json,status,token) VALUES
      (42,1,1,'LOT-CONTEXT','{"id":"LOT-CONTEXT","year":"1999","marka_name":"NISSAN","model_name":"SKYLINE"}','sent','shared');
  `);
  env.AUCTION_FIXTURE = '<aj><row><id>LOT-CONTEXT</id><marka_name>NISSAN</marka_name><model_name>SKYLINE</model_name><year>1999</year></row></aj>';
  const lot = await publicLotPage(env, 42);
  const tag = lot.match(/<a[^>]*href="([^"]+)"[^>]*>Enquire about this car<\/a>/i);
  assert.ok(tag, "the enquiry CTA exists");
  assert.match(tag[1], /(?:lot|source_lot)=LOT-CONTEXT/);

  const href = tag[1].replaceAll("&amp;", "&");
  const res = await worker.fetch(new Request(new URL(href, "https://jdmfinder.com.au")), env, CTX);
  const form = await res.text();
  assert.match(form, /<input(?=[^>]*name="source_lot_id")(?=[^>]*value="LOT-CONTEXT")[^>]*>/);
  assert.match(form, /(?:data-want|value)="SKYLINE"/);
});

test("buyer auction filters use landed AUD and free accounts get a real upgrade action", async () => {
  const memberEnv = makeEnv(`INSERT INTO clients (id,name,portal_enabled,member) VALUES (1,'Member',1,1);`);
  memberEnv.AUCTION_FIXTURE = EMPTY_FEED;
  const member = await portalAuctionsPage(memberEnv, { role: "client", id: 1 });
  assert.match(member, /Max (?:landed )?budget[^<]*\(AUD\)/i);
  assert.match(member, /name="budgetAud"/);
  assert.doesNotMatch(member, /Max price[^<]*\(JPY\)/i);

  const freeEnv = makeEnv(`
    INSERT INTO clients (id,name,portal_enabled,member) VALUES (2,'Free',1,0);
    INSERT INTO settings (key,value) VALUES ('membership_enabled','1'),('membership_monthly_aud','49');
  `);
  freeEnv.STRIPE_SECRET_KEY = "sk_test_launch";
  for (const html of [
    await portalAuctionsPage(freeEnv, { role: "client", id: 2 }),
    await portalSoldPage(freeEnv, { role: "client", id: 2 }),
  ]) {
    assert.match(html, /<form[^>]*method="POST"[^>]*action="\/portal\/subscribe"/i);
  }
});

test("a provider outage is not misreported as zero live auction lots", async () => {
  const env = makeEnv(`INSERT INTO clients (id,name,portal_enabled,member) VALUES (1,'Member',1,1);`);
  env.API_BASE = "data:text/plain,provider%20offline";
  env.AVTONET_CODE = "test";
  const html = await portalAuctionsPage(env, { role: "client", id: 1 });
  assert.match(html, /auction feed is temporarily unavailable/i);
  assert.doesNotMatch(html, /No live lots in the feed right now/i);
});

test("landing hero assets are responsive, immutable, and scroll work is frame-throttled", async () => {
  const html = await landingHtml();
  const hero = html.match(/<img(?=[^>]*id="heroImg")[^>]*>/)?.[0] || "";
  assert.match(hero, /srcset="[^"]+"/);
  assert.match(hero, /sizes="[^"]+"/);
  const entries = hero.match(/srcset="([^"]+)"/)?.[1].split(",") || [];
  assert.ok(entries.length >= 2, "at least two hero widths are available");
  for (const entry of entries) {
    const path = new URL(entry.trim().split(/\s+/)[0], "https://jdmfinder.com.au").pathname;
    assert.ok(existsSync(join(repoRoot, "public", path.replace(/^\//, ""))), `${path} exists`);
  }

  const headersPath = join(repoRoot, "public", "_headers");
  assert.ok(existsSync(headersPath), "static asset cache policy exists");
  assert.match(readFileSync(headersPath, "utf8"), /\/assets\/\*[\s\S]*max-age=31536000[\s\S]*immutable/i);

  const motion = landingMotionScript(63780);
  assert.doesNotMatch(motion, /addEventListener\('scroll',onScroll/,
    "the raw scroll event does not run layout work directly");
  assert.match(motion, /requestAnimationFrame\(onScroll\)/);
});

test("privacy disclosures name every live customer-data channel", () => {
  const html = privacyPage();
  for (const provider of ["Meta", "WhatsApp", "ntfy", "Resend", "Stripe", "Cloudflare"]) {
    assert.match(html, new RegExp(provider, "i"), provider);
  }
});
