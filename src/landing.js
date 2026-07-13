// Public landing page (the front door for jdmfinder.com.au and
// finder.jdmconnect.com.au). Rebuilt to the JDMFinder v2 design handoff: a long,
// conversion-focused marketing page whose single job is to turn a curious
// enthusiast into a free signup, with the A$49/month membership as the warm
// upgrade. "Start your search" repeats down the page.
//
// Visual direction (v2): dark, premium, editorial, auction-sheet precision. The
// v2 handoff dropped the display serif, so the whole page is Inter (loaded by
// brandDoc) with a system monospace stack for the spec-sheet voice (eyebrows,
// labels, prices, the ticker). Gold (#CAA34C / #E6C879) is the only accent, used
// for a rule, a label, a single number, never a flood fill. The page carries two
// scroll-pinned moments (a 300vh feature stage and a 260vh landed-cost card) and
// a handful of count-up numbers; all motion is restrained and reduced-motion safe.
//
// The handoff ships as a .dc.html prototype that must NOT be shipped as-is; this
// is the production rebuild in the worker's own idiom (HTML string + theme.js
// tokens + scoped .jf styles), so portal and landing stay one design language.
//
// Copy rule (from the handoff): no em or en dashes anywhere. Use commas,
// periods, or hyphens; the middot ( . ) separator is fine. The membership price
// is read from admin Settings and templated through `price`, never hardcoded, so
// the page and billing stay one source of truth.
//
// Photography note: the handoff's reference photos are placeholder/unlicensed, so
// every full-bleed image is an atmospheric CSS placeholder here, with a comment
// marking exactly where a licensed <img> (carrying the id the motion script
// parallaxes) is dropped in. Nothing else needs to change when real photos land.

import { LOGO, brandDoc } from "./theme.js";
import { getSettings, settingNum } from "./settings.js";
import { landingCss } from "./landing-css.js";
import { landingMotionScript } from "./landing-motion.js";
import { searchLots, imageUrls } from "./avtonet.js";
import { esc, displayGrade } from "./render.js";
import {
  TICKER, FEATURES, NUMBERS, STEPS, COST_LINES, COST_TOTAL, REVIEWS, FAQS,
} from "./landing-data.js";

// --- small render helpers --------------------------------------------------

// JDM Connect's licensed auction photography, served at the edge from /public
// (see wrangler.toml [assets]). Treatment (cool, deep-shadow) is applied in CSS.
// The page references the WebP variants scripts/optimize-landing-images.mjs
// generates from the .jpg sources (launch audit: the full-resolution JPEGs were
// the main cause of the ~6s mobile LCP); rerun that script after changing a
// photo and paste its PHOTO_DIMS output here (real -1280 pixel sizes, so the
// browser reserves the right box).
const IMG = "/assets/photo/web";
const PHOTO_DIMS = {
  "180sx_rps13.jpg": [1280, 877],
  "chaser_jzx100.jpg": [1280, 931],
  "hero_r32_garage.jpg": [1280, 1920],
  "r34_highway_bw.jpg": [1280, 854],
  "s14_garage.jpg": [1280, 1600],
  "s15_enginebay.jpg": [1280, 855],
  "s15_specr.jpg": [1280, 807],
  "shibuya_night.jpg": [1280, 710],
  "tokyo_r34_night.jpg": [1280, 1707],
};
const photoSrcset = (file) => {
  const base = file.replace(/\.jpg$/, "");
  return { src: `${IMG}/${base}-1280.webp`, srcset: `${IMG}/${base}-720.webp 720w, ${IMG}/${base}-1280.webp 1280w` };
};
const photo = (file, alt, { id = "", eager = false } = {}) => {
  const [w, h] = PHOTO_DIMS[file] || [1280, 853];
  const { src, srcset } = photoSrcset(file);
  return `<img src="${src}" srcset="${srcset}" sizes="100vw" alt="${alt}" width="${w}" height="${h}"${id ? ` id="${id}"` : ""} ${
    eager ? `fetchpriority="high" decoding="async"` : `loading="lazy" decoding="async"`
  }>`;
};

const eyebrow = (label, extra = "") =>
  `<div class="eb rv${extra}"><span class="r"></span><span class="t">${label}</span></div>`;

// Atmospheric placeholder, kept as a fallback for any photo slot left empty.
const placeholder = (tag = "") =>
  `<div class="ph"></div>${tag ? `<div class="ph-tag">${tag}</div>` : ""}`;

const featureCallout = (f) => `
  <div class="feat-callout" data-feat>
    <div class="k">${f.k}</div>
    <h2>${f.big}</h2>
    <p>${f.sub}</p>
  </div>`;

const stepEl = (s) => `
  <div class="step rv">
    <div class="sn">STEP ${s.n}</div>
    <h3>${s.title}</h3>
    <p>${s.body}</p>
  </div>`;

// V1.3 Phase A: the lineup strip shows GENUINELY UPCOMING lots pulled live
// from the auction feed (searchLots only returns auction_date >= NOW()),
// cached 30 minutes per isolate. When the feed yields nothing usable the
// whole strip is dropped rather than showing stale or invented cars.
let _lineupCache = { cards: null, exp: 0 };
const LINEUP_TTL = 30 * 60 * 1000;
function lineupTier(lot) {
  const jpy = Number(lot.start) > 0 ? Number(lot.start) : Number(lot.avg_price) || 0;
  if (jpy > 0 && jpy <= 1500000) return "Attainable";
  if (jpy > 0 && jpy <= 3500000) return "Sweet spot";
  return "The dream";
}
async function liveLineup(env) {
  const now = Date.now();
  if (_lineupCache.cards && now < _lineupCache.exp) return _lineupCache.cards;
  try {
    // High-grade upcoming lots with photos, soonest auctions first.
    const { lots } = await searchLots(env, { gradeMin: 4 });
    const cards = (lots || [])
      .filter((l) => imageUrls(l).medium && l.marka_name && l.year)
      .slice(0, 3)
      .map((l) => liveCard(l));
    _lineupCache = { cards, exp: now + LINEUP_TTL };
    return cards;
  } catch (e) {
    console.error("liveLineup failed:", e.message);
    return _lineupCache.cards || [];
  }
}
// A lineup card built from a real feed lot. Reuses the vcard styling; only
// fields the feed actually provides are rendered (no invented sheet marks).
function liveCard(lot) {
  const img = imageUrls(lot).medium;
  const name = `${esc(lot.year)} ${esc(String(lot.marka_name || "").trim())} ${esc(String(lot.model_name || "").trim())}`.replace(/\s+/g, " ").trim();
  const sub = [lot.kuzov, lot.grade].map((x) => esc(String(x || "").trim())).filter(Boolean).join(" &middot; ");
  const odo = Number(lot.mileage) > 0 ? Number(lot.mileage).toLocaleString("en-US") + " km" : "-";
  const closes = String(lot.auction_date || "").slice(0, 10);
  // Carry the card's car into the request wizard so the enquiry doesn't start
  // from a blank form (launch audit).
  const reqHref = "/request?" + new URLSearchParams({
    make: String(lot.marka_name || "").trim(), model: String(lot.model_name || "").trim(),
    year: String(lot.year || ""), chassis: String(lot.kuzov || "").trim(),
  }).toString();
  return `
  <a class="vcard rv" href="${esc(reqHref)}">
    <div class="vc-photo">
      <img src="/assets/lot-img?u=${encodeURIComponent(img)}" alt="${name}" loading="lazy" width="800" height="600" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"><div class="scrim"></div>
      <span class="vc-lot">Lot ${esc(lot.lot || "-")}</span>
      <span class="vc-tier">${lineupTier(lot)}</span>
    </div>
    <div class="vc-sheet">
      <div class="vc-chassis"><span>${esc(String(lot.kuzov || "").trim()) || "&nbsp;"}</span></div>
      <div class="vc-grade-row">
        <div class="vc-oval">
          <div class="o"><span class="g">${esc(displayGrade(lot.rate))}</span><span class="gl">GRADE</span></div>
        </div>
        <div class="vc-meta">
          <div class="nm">${name}</div>
          <div class="sb">${sub || esc(String(lot.auction || "").trim())}</div>
        </div>
      </div>
    </div>
    <div class="vc-foot">
      <div class="vc-data">
        <div class="c"><div class="k">Year</div><div class="v">${esc(lot.year)}</div></div>
        <div class="c"><div class="k">Odo</div><div class="v">${odo}</div></div>
        <div class="c"><div class="k">House</div><div class="v">${esc(String(lot.auction || "").trim()) || "-"}</div></div>
        <div class="c"><div class="k">Closes</div><div class="v">${esc(closes) || "-"}</div></div>
      </div>
      <div class="vc-watch"><span class="wk">Start a search</span><span class="card-cta">&rarr;</span></div>
    </div>
  </a>`;
}

// --- Recent finds (public /finds page) --------------------------------------
// Importer-style social proof (the Prestige Motorsport / Iron Chef pattern):
// real cars recently found and SENT to buyers, straight from the review queue,
// so nothing unvetted or invented ever shows. Client identity is reduced to a
// first name + state; the car itself is public auction data. Lots whose linked
// request has advanced past deposit render a "Secured" ribbon.
const SECURED_STAGES = new Set(["purchased", "shipping", "compliance", "ready_delivery", "delivered"]);
// Cache keyed by the D1 binding (not module-global) so two envs - e.g. tests,
// or a future preview binding - can never serve each other's finds.
const _findsCache = new WeakMap();
const FINDS_TTL = 10 * 60 * 1000;

async function recentFinds(env) {
  const now = Date.now();
  const hit = _findsCache.get(env.DB);
  if (hit && now < hit.exp) return hit.finds;
  const rows = (await env.DB.prepare(
    `SELECT q.lot_json, q.sent_at, c.name AS client_name, c.state AS client_state, w.status AS req_status
       FROM queue q JOIN clients c ON c.id = q.client_id
       LEFT JOIN wishlists w ON w.id = q.wishlist_id
      WHERE q.sent_at IS NOT NULL AND c.archived = 0
      ORDER BY q.sent_at DESC LIMIT 80`
  ).all()).results || [];
  const seen = new Set();
  const finds = [];
  for (const r of rows) {
    let lot = null; try { lot = JSON.parse(r.lot_json); } catch (e) {}
    if (!lot || !lot.marka_name || !lot.year) continue;
    const img = imageUrls(lot).medium;
    if (!img) continue;
    const key = String(lot.id || `${lot.lot || ""}@${lot.auction || ""}`);
    if (seen.has(key)) continue;
    seen.add(key);
    finds.push({
      lot, img,
      sentAt: String(r.sent_at || ""),
      first: String(r.client_name || "").trim().split(/\s+/)[0] || "a buyer",
      state: String(r.client_state || "").trim(),
      secured: SECURED_STAGES.has(String(r.req_status || "")),
    });
    if (finds.length >= 12) break;
  }
  _findsCache.set(env.DB, { finds, exp: now + FINDS_TTL });
  return finds;
}

function findMonth(sentAt) {
  const t = Date.parse(sentAt);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleDateString("en-AU", { month: "short", year: "numeric" });
}

function findCard(f) {
  const lot = f.lot;
  const name = `${esc(lot.year)} ${esc(String(lot.marka_name || "").trim())} ${esc(String(lot.model_name || "").trim())}`.replace(/\s+/g, " ").trim();
  const sub = [lot.kuzov, lot.grade].map((x) => esc(String(x || "").trim())).filter(Boolean).join(" &middot; ");
  const odo = Number(lot.mileage) > 0 ? Number(lot.mileage).toLocaleString("en-US") + " km" : "-";
  const landed = f.lot._landed && Number(f.lot._landed.grandTotal) > 0
    ? "A$" + Number(f.lot._landed.grandTotal).toLocaleString("en-AU") : null;
  const who = `${esc(f.first)}${f.state ? " &middot; " + esc(f.state) : ""}`;
  // The card funnels into the wizard pre-filled with THIS car's shape, so
  // "find me one of those" is one tap, not a blank form.
  const reqHref = "/request?" + new URLSearchParams({
    make: String(lot.marka_name || "").trim(), model: String(lot.model_name || "").trim(),
    year: String(lot.year || ""), chassis: String(lot.kuzov || "").trim(),
  }).toString();
  return `
  <a class="vcard rv" href="${esc(reqHref)}">
    <div class="vc-photo">
      <img src="/assets/lot-img?u=${encodeURIComponent(f.img)}" alt="${name}" loading="lazy" width="800" height="600" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" onerror="this.closest('.vcard').style.display='none'"><div class="scrim"></div>
      <span class="vc-lot">${esc(findMonth(f.sentAt)) || "Recent"}</span>
      <span class="vc-tier">${f.secured ? "Secured" : "Found"}</span>
    </div>
    <div class="vc-sheet">
      <div class="vc-chassis"><span>${esc(String(lot.kuzov || "").trim()) || "&nbsp;"}</span></div>
      <div class="vc-grade-row">
        <div class="vc-oval">
          <div class="o"><span class="g">${esc(displayGrade(lot.rate))}</span><span class="gl">GRADE</span></div>
        </div>
        <div class="vc-meta">
          <div class="nm">${name}</div>
          <div class="sb">${sub || esc(String(lot.auction || "").trim())}</div>
        </div>
      </div>
    </div>
    <div class="vc-foot">
      <div class="vc-data">
        <div class="c"><div class="k">Found for</div><div class="v">${who}</div></div>
        <div class="c"><div class="k">Odo</div><div class="v">${odo}</div></div>
        <div class="c"><div class="k">${landed ? "Landed est." : "House"}</div><div class="v">${landed || esc(String(lot.auction || "").trim()) || "-"}</div></div>
      </div>
      <div class="vc-watch"><span class="wk">Find me one</span><span class="card-cta">&rarr;</span></div>
    </div>
  </a>`;
}

// Standalone public page: /finds. Same .jf design language as the landing.
export async function findsPage(env) {
  const finds = await recentFinds(env).catch(() => []);
  const cards = finds.map((f) => findCard(f)).join("");
  const body = `
  <style>${landingCss}</style>
  <div class="jf">
    <header class="jf-nav" id="jdmNav">
      <div class="jf-nav-in">
        <a class="jf-brand" href="/" aria-label="JDM Connect Finder home">${LOGO}<span class="jf-tag">Finder</span></a>
        <div class="jf-nav-right">
          <nav class="jf-nav-links" aria-label="Primary"><a href="/">Home</a><a href="/login">Sign in</a></nav>
          <a class="jf-gold" href="/request">Start free</a>
        </div>
      </div>
    </header>
    <main id="main">
      <section class="sec" style="padding-top:140px">
        <div class="sec-in">
          <div class="list-head">
            <div>
              ${eyebrow("Recent finds")}
              <h2 class="rv rv-d1">Real cars, found for real buyers.</h2>
            </div>
            <p class="note rv rv-d2">Every car here was pulled from a live Japanese auction by our team for a JDM Connect buyer. Tell us what you're chasing and yours joins the list.</p>
          </div>
          ${cards
            ? `<div class="cards">${cards}</div>`
            : `<p class="note rv" style="max-width:none;text-align:center;padding:48px 0">Fresh finds are on their way to this page. Tell us what you're chasing and we'll start the search today.</p>`}
          <div class="final-btns rv" style="justify-content:center;margin-top:48px">
            <a class="jf-gold" href="/request">Start your search, free <span class="ar">&rarr;</span></a>
          </div>
        </div>
      </section>
    </main>
    <footer class="jf-foot">
      <div class="jf-foot-in">
        <a class="jf-brand" href="/" aria-label="JDM Connect home">${LOGO}<span class="jf-tag">Finder</span></a>
        <div class="fmid">Connecting JDM &middot; ジェー・ディー・エムをつなぐ</div>
        <nav class="flinks" aria-label="Legal and contact">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="mailto:hello@jdmconnect.com.au">hello@jdmconnect.com.au</a>
        </nav>
        <div class="fcopy">&copy; 2026 JDM Connect. Find it. We&rsquo;ll handle the rest.</div>
      </div>
    </footer>
  </div>`;
  return brandDoc(body, "Recent finds - JDMFinder", {
    analytics: true,
    description: "Real JDM cars recently found at Japanese auction for JDM Connect buyers, with grades and landed-cost estimates. Yours could be next.",
    canonical: "https://jdmfinder.com.au/finds",
  });
}

// Auction-sheet card. Photo is a placeholder until licensed auction imagery is
// wired in; the whole card links to /request so any tap starts a search.
const lineupCard = (c) => `
  <a class="vcard rv" href="/request">
    <div class="vc-photo">
      ${c.photo ? photo(c.photo, c.name) : placeholder()}<div class="scrim"></div>
      <span class="vc-lot">Lot ${c.lot}</span>
      <span class="vc-sevs">SEVS Eligible</span>
      <span class="vc-tier">${c.tier}</span>
    </div>
    <div class="vc-sheet">
      <div class="vc-chassis"><span>${c.chassis}</span></div>
      <div class="vc-grade-row">
        <div class="vc-oval">
          <div class="o"><span class="g">${c.grade}</span><span class="gl">GRADE</span></div>
          <span class="int">INT &middot; ${c.intGrade}</span>
        </div>
        <div class="vc-meta">
          <div class="nm">${c.name}</div>
          <div class="sb">${c.sub}</div>
          <div class="vc-equip">${c.equip.map((e) => `<span>${e}</span>`).join("")}</div>
        </div>
      </div>
      <div class="vc-marks">
        <span class="lab">Marks</span>
        <div class="mk">${c.marks.map((m) => `<span>${m}</span>`).join("")}</div>
        <span class="dot"></span>
      </div>
    </div>
    <div class="vc-foot">
      <div class="vc-data">
        <div class="c"><div class="k">Year</div><div class="v">${c.year}</div></div>
        <div class="c"><div class="k">Odo</div><div class="v">${c.odo}</div></div>
        <div class="c"><div class="k">Engine</div><div class="v">${c.engine}</div></div>
        <div class="c"><div class="k">Trans</div><div class="v">${c.trans}</div></div>
      </div>
      <div class="vc-watch"><span class="wk">Watch this lot</span><span class="card-cta">&rarr;</span></div>
    </div>
  </a>`;

const costLine = (ln) =>
  `<div class="cl" data-costline><span class="lab">${ln.label}</span><span class="amt">${ln.amount}</span></div>`;

const numberStat = (m) => `
  <div class="num rv">
    <div class="v"><span data-count-to="${m.to}" data-pre="${m.pre}" data-post="${m.post}">${m.start}</span></div>
    <div class="l">${m.label}</div>
  </div>`;

const reviewEl = (r) =>
  `<figure class="review rv"><div class="q">&ldquo;</div><blockquote>${r.quote}</blockquote><figcaption>${r.who}</figcaption></figure>`;

const faqEl = (q, a) =>
  `<details class="faq rv"><summary>${q}<span class="sign">+</span></summary><p>${a}</p></details>`;

// The four in-page anchors used by both the desktop nav and the mobile drawer.
const NAV_LINKS = [
  ["#lineup", "The lineup"],
  ["#cost", "Real cost"],
  ["#how", "How it works"],
  ["#membership", "Membership"],
  ["/finds", "Recent finds"],
  ["/login", "Sign in"],
];

// --- the page --------------------------------------------------------------

export async function landingPage(env) {
  const settings = await getSettings(env).catch(() => ({}));
  const priceNum = settingNum(settings, "membership_monthly_aud", 49);
  const price = `A$${priceNum}`;

  // Live lineup: genuinely upcoming lots only; the strip (and its nav link)
  // disappears entirely when the feed has nothing usable.
  const lineupCards = await liveLineup(env);
  const links = lineupCards.length ? NAV_LINKS : NAV_LINKS.filter(([href]) => href !== "#lineup");
  const navLinks = links.map(([href, label]) => `<a href="${href}">${label}</a>`).join("");
  const menuLinks = links.map(([href, label]) => `<a href="${href}">${label}</a>`).join("");

  const body = `
  <style>${landingCss}</style>

  <div class="jf">

    <header class="jf-nav" id="jdmNav">
      <div class="jf-nav-in">
        <a class="jf-brand" href="/" aria-label="JDM Connect Finder home">${LOGO}<span class="jf-tag">Finder</span></a>
        <div class="jf-nav-right">
          <nav class="jf-nav-links" aria-label="Primary">${navLinks}</nav>
          <a class="jf-gold" href="/request">Start free</a>
          <button id="navBurger" class="nav-burger" type="button" aria-label="Open menu" aria-expanded="false">
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
      <div class="nav-menu" id="navMenu">${menuLinks}<a href="/request">Start free</a></div>
    </header>

    <main id="main">

    <!-- HERO -->
    <section class="hero" id="top" aria-labelledby="hero-h">
      <div class="hero-bg" aria-hidden="true">
        ${photo("hero_r32_garage.jpg", "Nissan Skyline GT-R R32 at a Japanese auction", { id: "heroImg", eager: true })}<div class="scrim"></div>
      </div>
      <div class="hero-wrap">
        <div class="hero-copy">
          <div class="eb rv in"><span class="r"></span><span class="t">Live Japanese auction access</span></div>
          <h1 id="hero-h" class="rv in rv-d1">Your dream car is at auction in Japan <em>right now.</em></h1>
          <p class="hero-sub rv in rv-d2">Tell us what you&rsquo;re after and start free. Or unlock full auction access for ${price} a month and watch the floor yourself, with the real landed price and import eligibility on every lot.</p>
          <div class="hero-btns rv in rv-d3">
            <a class="jf-gold" href="/request">Start your search, free <span class="ar">&rarr;</span></a>
            <a class="jf-dark" href="#lineup">See what&rsquo;s landing</a>
          </div>
          <div class="hero-fine rv in rv-d4">No card to start &middot; Cancel anytime &middot; Membership credits toward your import fee</div>
        </div>
      </div>
      <div class="scroll-cue" aria-hidden="true"><span class="l">Scroll</span><span class="b"></span></div>
      <div class="ticker" aria-hidden="true"><div class="ticker-row"><span>${TICKER}</span><span>${TICKER}</span></div></div>
    </section>

    <!-- FEATURE PIN -->
    <section class="feat" id="features" aria-label="Under the hood">
      <div class="feat-pin" id="featPin">
        <div class="feat-stage">
          <div class="feat-bg" aria-hidden="true">
            ${photo("s14_garage.jpg", "JDMFinder scanning the Japanese auctions", { id: "featImg" })}<div class="scrim"></div>
          </div>
          <div class="feat-in">
            <div class="feat-eb">Under the hood</div>
            <div class="feat-deck">${FEATURES.map(featureCallout).join("")}</div>
            <div class="feat-dots">${FEATURES.map(() => `<span data-featdot></span>`).join("")}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- PROBLEM MOMENT -->
    <section class="moment" aria-label="The way it's usually done">
      <div class="moment-bg bw" aria-hidden="true">
        ${photo("r34_highway_bw.jpg", "Nissan Skyline R34 on the highway at night")}<div class="scrim"></div>
      </div>
      <div class="moment-in">
        <div class="box">
          ${eyebrow("The way it&rsquo;s usually done")}
          <h2 class="rv rv-d1">Most import agents want <span class="g">a hefty deposit</span> up front, before you&rsquo;ve seen a single car that&rsquo;s actually yours.</h2>
          <p class="rv rv-d2">You commit the big money, then start looking. We think that&rsquo;s backwards. Look first, for ${price} a month, and commit only when you&rsquo;ve found the one.</p>
        </div>
      </div>
    </section>

    <!-- HOW IT WORKS -->
    <section class="sec lp-cream how" id="how">
      <div class="sec-in" style="max-width:1180px">
        ${eyebrow("How it works")}
        <h2 class="rv rv-d1">Find your car first. Commit when you&rsquo;re ready.</h2>
        <div class="steps">${STEPS.map(stepEl).join("")}</div>
      </div>
    </section>

    <!-- LINEUP (live upcoming lots; hidden when the feed has none) -->
    ${lineupCards.length ? `
    <section class="sec" id="lineup">
      <div class="sec-in">
        <div class="list-head">
          <div>
            ${eyebrow("Live from the floor")}
            <h2 class="rv rv-d1">A car for every budget, not just the halo cars.</h2>
          </div>
          <p class="note rv rv-d2">Every lot checked for SEVS and age eligibility before it reaches you. No guessing, no surprises later.</p>
        </div>
        <div class="marks-legend rv rv-d2">
          <span>Sheet marks</span><span class="ln"></span>
          <span><b>A</b> scratch</span><span><b>U</b> dent</span><span><b>1-3</b> severity</span>
        </div>
        <div class="cards">${lineupCards.join("")}</div>
      </div>
    </section>` : ""}

    <!-- PINNED LANDED COST -->
    <section class="cost" id="cost" aria-label="Real landed cost">
      <div class="cost-pin" id="costPin">
        <div class="cost-sticky">
          <div class="cost-bg" aria-hidden="true">
            ${photo("tokyo_r34_night.jpg", "Tokyo at night")}<div class="scrim"></div>
          </div>
          <div class="cost-grid">
            <div class="cost-copy">
              ${eyebrow("The bit nobody shows you", " in")}
              <h2>The auction price is not the price.</h2>
              <p>The bid, Japan-side fees, shipping, GST, compliance and on-road costs, all the way to your door. We show the real number before you bid. Here&rsquo;s a worked example.</p>
              <div class="ex">Worked example &middot; &yen;5,000,000 bid &middot; landed Fremantle, WA</div>
            </div>
            <div class="cost-card">
              <span class="ck">Landed, to your door</span>
              <div class="cost-num" id="costNum">A$0</div>
              <div class="cost-lines">${COST_LINES.map(costLine).join("")}</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- DIVISION OF LABOUR -->
    <section class="divlab" aria-label="We handle it">
      <div class="divlab-bg" aria-hidden="true">
        ${photo("s15_enginebay.jpg", "Engine bay, compliance and prep")}<div class="scrim"></div>
      </div>
      <div class="divlab-in">
        <div class="box">
          ${eyebrow("The division of labour")}
          <h2 class="rv rv-d1">You find it. We handle the scary part.</h2>
          <p class="rv rv-d2">Finding your car is the fun part, enjoy it. Winning the bid, compliance and asbestos, shipping, customs and rego on a car you&rsquo;ve never seen in person? That&rsquo;s the part you want handled by people who do it <span class="g">20-plus times a month.</span></p>
          <div class="dl-split rv rv-d3">
            <span class="ln">JDMFinder lets you look.</span>
            <span class="dot" aria-hidden="true"></span>
            <span class="ln">JDM Connect does the doing.</span>
          </div>
        </div>
      </div>
    </section>

    <!-- CULTURE BAND -->
    <section class="moment culture" aria-label="On the floor">
      <div class="moment-bg" aria-hidden="true">
        ${photo("shibuya_night.jpg", "Shibuya at night, Japan auction culture")}<div class="scrim"></div>
      </div>
      <div class="moment-in">
        <h2 class="rv">We&rsquo;re on the auction floor in Japan, every week.</h2>
        <p class="rv rv-d1">USS, TAA and ASNET, the same feeds, the same people, the same relationships we&rsquo;ve built over 15 years. <span class="jp">入庫 &middot; arrival.</span></p>
      </div>
    </section>

    <!-- NUMBERS STRIP -->
    <section class="sec numbers" aria-label="By the numbers">
      <div class="sec-in" style="max-width:1180px">
        ${eyebrow("By the numbers")}
        <div class="num-grid">${NUMBERS.map(numberStat).join("")}</div>
      </div>
    </section>

    <!-- TRUST -->
    <section class="sec lp-cream" id="trust">
      <div class="sec-in">
        ${eyebrow("Why trust us")}
        <div class="reviews">${REVIEWS.map(reviewEl).join("")}</div>
      </div>
    </section>

    <!-- MEMBERSHIP -->
    <section class="sec price" id="membership">
      <div class="price-glow" aria-hidden="true"></div>
      <div class="price-in">
        ${eyebrow("Membership")}
        <div class="tiers">
          <div class="tier rv">
            <div class="tlabel">Browse</div>
            <div class="tprice"><span class="amt">Free</span></div>
            <div class="tsub">No card. Two minutes to set up.</div>
            <div class="trule"></div>
            <ul>
              <li><span class="tk">&#10003;</span>Submit a vehicle request</li>
              <li><span class="tk">&#10003;</span>Your own dashboard</li>
              <li><span class="tk">&#10003;</span>Hand-picked matches</li>
              <li><span class="tk">&#10003;</span>Email alerts when a car comes up</li>
            </ul>
            <a class="jf-dark" href="/request">Start free</a>
          </div>
          <div class="tier feat rv rv-d1">
            <div class="tpill">Full access</div>
            <div class="tlabel">Member</div>
            <div class="tprice"><span class="amt">${price}</span><span class="per">/ month</span></div>
            <div class="tsub">Cancel anytime, one click. No lock-in.</div>
            <div class="trule"></div>
            <ul>
              <li><span class="tk">&#10003;</span>Live auction access</li>
              <li><span class="tk">&#10003;</span>Unlimited searches</li>
              <li><span class="tk">&#10003;</span>Real landed cost on every car</li>
              <li><span class="tk">&#10003;</span>More matches every scan</li>
              <li><span class="tk">&#10003;</span>Priority sourcing</li>
            </ul>
            <a class="jf-gold" href="/login?next=subscribe">Start membership</a>
          </div>
        </div>
        <div class="price-callout rv">
          <span class="co-tag">The bit that matters</span>
          <div class="co-body">
            <p class="co-h">Up to <span class="g">six months</span> of membership, credited back.</p>
            <p>Go ahead with us and that comes straight off your import fee. So looking around basically pays for itself the moment you commit.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section class="sec" style="background:var(--jf-bg2)">
      <div class="faq-wrap">
        ${eyebrow("Questions")}
        ${FAQS.map((f) => faqEl(f.q.replaceAll("{price}", price), f.a.replaceAll("{price}", price))).join("")}
        <div class="faq-end"></div>
      </div>
    </section>

    <!-- FINAL CTA -->
    <section class="final" id="start">
      <div class="final-bg" aria-hidden="true">
        ${photo("hero_r32_garage.jpg", "Nissan Skyline GT-R R32")}<div class="scrim"></div>
      </div>
      <div class="final-in">
        <h2 class="rv">Find your car first. Commit when you&rsquo;re ready.</h2>
        <p class="rv rv-d1">Tell us what you&rsquo;re after and start watching the auctions today. Free, no card.</p>
        <div class="final-btns rv rv-d2">
          <a class="jf-gold" href="/request">Start your search, free <span class="ar">&rarr;</span></a>
          <a class="jf-dark" href="#membership">See membership</a>
        </div>
      </div>
    </section>

    </main>

    <!-- FOOTER -->
    <footer class="jf-foot">
      <div class="jf-foot-in">
        <a class="jf-brand" href="/" aria-label="JDM Connect home">${LOGO}<span class="jf-tag">Finder</span></a>
        <div class="fmid">Connecting JDM &middot; ジェー・ディー・エムをつなぐ</div>
        <nav class="flinks" aria-label="Legal and contact">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="mailto:hello@jdmconnect.com.au">hello@jdmconnect.com.au</a>
          <a href="https://wa.me/61415111221" target="_blank" rel="noopener">+61 415 111 221</a>
        </nav>
        <div class="fcopy">&copy; 2026 JDM Connect. Find it. We&rsquo;ll handle the rest.</div>
      </div>
    </footer>

  </div>
  ${landingMotionScript(COST_TOTAL)}`;

  // Preload the hero (the mobile LCP element) so its fetch starts before the
  // parser reaches the <img> deep in the body; imagesrcset keeps phones on the
  // small variant.
  const hero = photoSrcset("hero_r32_garage.jpg");
  const heroPreload = `<link rel="preload" as="image" href="${hero.src}" imagesrcset="${hero.srcset}" imagesizes="100vw" fetchpriority="high">`;
  return brandDoc(body, "JDMFinder, find your dream JDM car at Japanese auction", {
    analytics: true,
    headExtra: heroPreload,
    description: "Tell us the JDM car you want. We search every live Japanese auction, hand-review the matches and handle bidding, shipping and compliance to Australia. Free to start.",
    canonical: "https://jdmfinder.com.au/",
  });
}
