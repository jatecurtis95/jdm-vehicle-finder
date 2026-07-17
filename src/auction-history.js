// Auction History - member page (production version of the reviewed
// /auction-history-example concept, docs/auction-history.md).
//
// Real sold results from the stats feed, rendered in the buyer-portal shell:
// frequently used filters stay visible, specialist filters fold behind "More
// filters", active filters become removable chips, and results render as a
// table on desktop and as cards on mobile (the example's card layout).
//
// Copy rule for this codebase: no em dashes or en dashes. Use commas or hyphens.

import { esc, yen, fullGrade } from "./render.js";
import { imageUrls, distinctMakers, distinctModels, distinctHouses } from "./avtonet.js";
import { getLiveFx, carAudToLanded } from "./calc.js";
import { auctionEligibility, displayMaker, feedDownCard } from "./auction-ui.js";
import { brandShell } from "./theme.js";
import { portalSidebar } from "./portal-shell.js";
import {
  validateHistoryParams, searchHistory, HISTORY_RANGES, HISTORY_SORTS,
  KPP_GROUPS, FUEL_KEYWORDS, BODY_KEYWORDS, HISTORY_COLOURS,
} from "./auction-history-query.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const num = (n) => Number(n).toLocaleString("en-US");
const audFmt = (n) => "A$" + Math.round(Number(n)).toLocaleString("en-AU");

// "2026-06-01T00:00:00" -> "1 Jun 2026". Parsed by hand so a timezone never
// shifts the sale day.
function fmtDate(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ""));
  if (!m) return "";
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] || ""} ${m[1]}`.trim();
}

// Show the feed's raw gearbox code with the mapped group label when one
// matches ("Manual (F5)"), so members aren't left decoding auction shorthand.
function kppDisplay(kpp) {
  const v = String(kpp || "").trim();
  if (!v) return "";
  const U = v.toUpperCase();
  for (const g of Object.values(KPP_GROUPS)) {
    if (g.exact.includes(U) || g.like.some((t) => U.includes(t))) {
      return U === g.label.toUpperCase() ? g.label : `${g.label} (${v})`;
    }
  }
  return v;
}

// The advanced filters live behind "More filters"; any active one re-opens it.
const ADVANCED_KEYS = ["transmission", "drivetrain", "mileageMax", "engineMin", "engineMax", "house", "body", "fuel", "colour", "eligibility"];
// Everything that belongs in a shareable URL, in canonical order.
const URL_KEYS = ["make", "model", "range", ...ADVANCED_KEYS, "sort", "page"];

// The same history experience renders on two surfaces. A surface says where
// the form posts back to (basePath + baseParams carried on every URL) and
// where a result's record / live-search links land for that audience.
export const HISTORY_SURFACES = {
  member: {
    basePath: "/portal/history",
    baseParams: {},
    detailBase: "/portal/auctions/lot?id=",
    liveSearch: (lot) => `/portal/auctions?${new URLSearchParams({ make: lot.marka_name || "", model: lot.model_name || "" })}`,
  },
  staff: {
    basePath: "/admin",
    baseParams: { view: "auctions", tab: "history" },
    detailBase: "/admin?view=auctionlot&lot=",
    liveSearch: (lot) => `/admin?${new URLSearchParams({ view: "auctions", tab: "live", make: lot.marka_name || "", model: lot.model_name || "" })}`,
  },
};

// Compact param bag for URL building: only non-defaults are carried.
function cleanParams(p) {
  const clean = {};
  for (const k of URL_KEYS) {
    const v = p[k];
    if (v === null || v === "" || v === undefined) continue;
    if (k === "sort" && v === "newest") continue;
    if (k === "page" && Number(v) === 1) continue;
    clean[k] = String(v);
  }
  return clean;
}

function historyUrl(surface, clean, over = {}) {
  const merged = { ...surface.baseParams, ...clean, ...over };
  for (const k of Object.keys(merged)) {
    if (merged[k] === null || merged[k] === "" || merged[k] === undefined) delete merged[k];
  }
  const qs = new URLSearchParams(merged).toString();
  return surface.basePath + (qs ? `?${qs}` : "");
}

// ---------------------------------------------------------------------------
// Filter form
// ---------------------------------------------------------------------------

const opt = (value, label, selected) =>
  `<option value="${esc(value)}"${String(value) === String(selected ?? "") ? " selected" : ""}>${esc(label)}</option>`;
const optTable = (table, selected) =>
  Object.entries(table).map(([k, v]) => opt(k, v.label, selected)).join("");

function filterForm(p, { makers, models, houses }, surface) {
  const makerOpts = opt("", "All makes", p.make) +
    makers.map((m) => opt(m, displayMaker(m), p.make)).join("") +
    (p.make && !makers.includes(p.make) ? opt(p.make, displayMaker(p.make), p.make) : "");
  const modelOpts = opt("", "All models", p.model) +
    models.map((m) => opt(m, displayMaker(m), p.model)).join("") +
    (p.model && !models.includes(p.model) ? opt(p.model, displayMaker(p.model), p.model) : "");
  const houseOpts = opt("", "All auction houses", p.house) +
    houses.map((h) => opt(h, h, p.house)).join("") +
    (p.house && !houses.includes(p.house) ? opt(p.house, p.house, p.house) : "");

  const rangePill = (value, label) =>
    `<label><input type="radio" name="range" value="${value}"${p.range === value ? " checked" : ""}><span>${label}</span></label>`;
  const pills = rangePill("", "Any time") +
    Object.entries(HISTORY_RANGES).map(([k, r]) => rangePill(k, r.label)).join("");

  const advancedOpen = ADVANCED_KEYS.some((k) => p[k] !== "" && p[k] !== null);
  const numVal = (v) => (v === null ? "" : String(v));

  const baseHidden = Object.entries(surface.baseParams)
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join("");
  return `<form class="ahx-filter" method="GET" action="${esc(surface.basePath)}" data-ahx-form role="search" aria-label="Search auction history">
    ${baseHidden}${p.sort !== "newest" ? `<input type="hidden" name="sort" value="${esc(p.sort)}">` : ""}
    <div class="ahx-frow">
      <label><span>Make</span><select name="make" data-ahx-make>${makerOpts}</select></label>
      <label><span>Model</span><select name="model" data-ahx-model>${modelOpts}</select></label>
      <button class="btn-primary ahx-go" type="submit" data-ahx-go>Search history</button>
    </div>
    <fieldset class="ahx-range"><legend>Auction held within</legend>${pills}</fieldset>
    <details class="ahx-more"${advancedOpen ? " open" : ""}>
      <summary><span>More filters</span><small>Transmission, drivetrain, mileage, engine, auction house, body, fuel, colour, eligibility</small></summary>
      <div class="ahx-more-grid">
        <label><span>Transmission</span><select name="transmission">${opt("", "Any transmission", p.transmission)}${optTable(KPP_GROUPS, p.transmission)}</select></label>
        <label><span>Drivetrain</span><select name="drivetrain">${opt("", "Any drivetrain", p.drivetrain)}${opt("4wd", "4WD / AWD", p.drivetrain)}${opt("2wd", "2WD", p.drivetrain)}</select></label>
        <label><span>Maximum mileage (km)</span><input type="number" name="mileageMax" min="1" max="1000000" step="1000" value="${numVal(p.mileageMax)}" placeholder="100,000"></label>
        <label><span>Engine from (cc)</span><input type="number" name="engineMin" min="1" max="20000" step="100" value="${numVal(p.engineMin)}" placeholder="1,500"></label>
        <label><span>Engine to (cc)</span><input type="number" name="engineMax" min="1" max="20000" step="100" value="${numVal(p.engineMax)}" placeholder="3,000"></label>
        <label><span>Auction house</span><select name="house">${houseOpts}</select></label>
        <label><span>Body type</span><select name="body">${opt("", "Any body", p.body)}${optTable(BODY_KEYWORDS, p.body)}</select></label>
        <label><span>Fuel</span><select name="fuel">${opt("", "Any fuel", p.fuel)}${optTable(FUEL_KEYWORDS, p.fuel)}</select></label>
        <label><span>Colour</span><select name="colour">${opt("", "Any colour", p.colour)}${optTable(HISTORY_COLOURS, p.colour)}</select></label>
        <label><span>Import eligibility</span><select name="eligibility">${opt("", "Any status", p.eligibility)}${opt("eligible", "Eligible (25-year rule)", p.eligibility)}</select></label>
      </div>
      <div class="ahx-more-act"><button class="btn-primary" type="submit" data-ahx-go>Search history</button></div>
    </details>
    <script>(function(){
      var f=document.currentScript.closest("form");if(!f)return;
      var mk=f.querySelector("[data-ahx-make]"),md=f.querySelector("[data-ahx-model]");
      if(!mk||!md)return;
      mk.addEventListener("change",function(){
        var cur=md.value;md.innerHTML='<option value="">All models</option>';
        if(!mk.value)return;
        fetch("/api/models?maker="+encodeURIComponent(mk.value)).then(function(r){return r.json();}).then(function(list){
          (list||[]).forEach(function(x){var o=document.createElement("option");o.value=x;o.textContent=x;md.appendChild(o);});
          for(var i=0;i<md.options.length;i++){if(md.options[i].value===cur){md.value=cur;break;}}
        }).catch(function(){});
      });
    })();</script>
  </form>`;
}

// ---------------------------------------------------------------------------
// Filter chips
// ---------------------------------------------------------------------------

function chipLabels(p) {
  const labels = [];
  const add = (key, label) => labels.push([key, label]);
  if (p.make) add("make", displayMaker(p.make));
  if (p.model) add("model", displayMaker(p.model));
  if (p.range) add("range", "Last " + HISTORY_RANGES[p.range].label);
  if (p.transmission) add("transmission", KPP_GROUPS[p.transmission].label);
  if (p.drivetrain) add("drivetrain", p.drivetrain === "4wd" ? "4WD / AWD" : "2WD");
  if (p.mileageMax !== null) add("mileageMax", `Under ${num(p.mileageMax)} km`);
  if (p.engineMin !== null) add("engineMin", `Engine from ${num(p.engineMin)} cc`);
  if (p.engineMax !== null) add("engineMax", `Engine to ${num(p.engineMax)} cc`);
  if (p.house) add("house", p.house);
  if (p.body) add("body", BODY_KEYWORDS[p.body].label);
  if (p.fuel) add("fuel", FUEL_KEYWORDS[p.fuel].label);
  if (p.colour) add("colour", HISTORY_COLOURS[p.colour].label);
  if (p.eligibility) add("eligibility", "Eligible for import");
  return labels;
}

function chipsRow(p, clean, surface) {
  const labels = chipLabels(p);
  if (!labels.length) return "";
  const chips = labels.map(([key, label]) =>
    `<a class="ahx-chip" data-ahx-nav href="${esc(historyUrl(surface, clean, { [key]: "", page: "" }))}" aria-label="Remove ${esc(label)} filter">${esc(label)} <span aria-hidden="true">&times;</span></a>`
  ).join("");
  return `<div class="ahx-chips"><span>Filters</span>${chips}<a class="ahx-clear" data-ahx-nav href="${esc(historyUrl(surface, {}))}">Clear all filters</a></div>`;
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

function lotView(lot, fx, nowYear, surface) {
  const title = `${lot.year || ""} ${displayMaker(lot.marka_name)} ${displayMaker(lot.model_name)}`.replace(/\s+/g, " ").trim() || "Vehicle";
  const jpy = Number(lot.finish) || 0;
  const audVal = jpy > 0 && fx > 0 ? Math.round(jpy / fx) : 0;
  const landed = audVal > 0 ? carAudToLanded(audVal) : null;
  const gearbox = [kppDisplay(lot.kpp || lot.kpp_type), String(lot.priv || "").trim()].filter(Boolean).join(" · ") || "-";
  const elig = auctionEligibility(lot, nowYear);
  return {
    title,
    img: imageUrls(lot).medium || "",
    code: String(lot.kuzov || "").trim(),
    variant: String(lot.grade || "").trim(),
    gearbox,
    engine: Number(lot.eng_v) > 0 ? num(lot.eng_v) + " cc" : "-",
    mileage: Number(lot.mileage) > 0 ? num(lot.mileage) + " km" : "-",
    grade: fullGrade(lot),
    house: String(lot.auction || "").trim() || "-",
    lotNo: String(lot.lot || "").trim(),
    date: fmtDate(lot.auction_date),
    jpy: jpy > 0 ? yen(jpy) : "-",
    aud: audVal > 0 ? "≈ " + audFmt(audVal) : "",
    landed: landed ? audFmt(landed) : "",
    elig,
    detailHref: `${surface.detailBase}${encodeURIComponent(lot.id)}`,
    liveHref: surface.liveSearch(lot),
  };
}

function resultRow(v) {
  return `<tr>
    <td><div class="ahx-car">
      ${v.img ? `<img src="${esc(v.img)}" width="112" height="76" loading="lazy" alt="${esc(v.title)}">` : `<span class="ahx-noimg" aria-hidden="true">No photo</span>`}
      <div><a class="ahx-car-t" href="${esc(v.detailHref)}">${esc(v.title)}</a><span>${[esc(v.code), esc(v.variant)].filter(Boolean).join(" · ")}</span><small class="ahx-elig ${v.elig.cls}">${esc(v.elig.label)}</small></div>
    </div></td>
    <td><strong>${esc(v.gearbox)}</strong><span>${esc(v.engine)}</span></td>
    <td><strong>${esc(v.mileage)}</strong><span>Grade ${esc(v.grade)}</span></td>
    <td><strong>${esc(v.house)}</strong><span>${[v.lotNo ? "Lot " + esc(v.lotNo) : "", esc(v.date)].filter(Boolean).join(" · ")}</span></td>
    <td><span class="ahx-sold">Sold</span><strong class="ahx-price">${esc(v.jpy)}</strong>${v.aud ? `<span>${esc(v.aud)}</span>` : ""}</td>
    <td>${v.landed ? `<strong class="ahx-landed">${esc(v.landed)}</strong><span>Est. landed</span>` : "-"}</td>
    <td class="ahx-act"><a href="${esc(v.detailHref)}">View record</a><a href="${esc(v.liveHref)}">Find live</a></td>
  </tr>`;
}

// The mobile result card, preserving the example page's layout: photo, head
// with chassis code / title / variant and the grade roundel, a 2-column spec
// list, and an eligibility + actions foot.
function resultCard(v) {
  const dd = (k, val, cls = "") => `<div><dt>${k}</dt><dd${cls ? ` class="${cls}"` : ""}>${val}</dd></div>`;
  return `<article class="ahx-rcard">
    ${v.img ? `<img src="${esc(v.img)}" width="640" height="420" loading="lazy" alt="${esc(v.title)}">` : `<div class="ahx-noimg-card" aria-hidden="true">No photo</div>`}
    <div class="ahx-rc-body">
      <div class="ahx-rc-head">
        <div>${v.code ? `<span>${esc(v.code)}</span>` : ""}<h3><a href="${esc(v.detailHref)}">${esc(v.title)}</a></h3>${v.variant ? `<p>${esc(v.variant)}</p>` : ""}</div>
        <b aria-label="Auction grade ${esc(v.grade)}">${esc(v.grade)}</b>
      </div>
      <dl>
        ${dd("Sold price", `<span class="ahx-sold">Sold</span> ${esc(v.jpy)}${v.aud ? ` <small>${esc(v.aud)}</small>` : ""}`, "ahx-price")}
        ${dd("Est. landed", v.landed ? esc(v.landed) : "-", "ahx-landed")}
        ${dd("Odometer", esc(v.mileage))}
        ${dd("Gearbox / drive", esc(v.gearbox))}
        ${dd("Engine", esc(v.engine))}
        ${dd("Auction", [esc(v.house), v.lotNo ? "Lot " + esc(v.lotNo) : ""].filter(Boolean).join(" · "))}
        ${dd("Sold on", esc(v.date) || "-")}
      </dl>
      <div class="ahx-rc-foot"><span class="ahx-elig ${v.elig.cls}">${esc(v.elig.label)}</span><a href="${esc(v.detailHref)}">View record &rarr;</a></div>
    </div>
  </article>`;
}

function sortRow(p, clean, countTxt, surface) {
  const links = Object.entries(HISTORY_SORTS).map(([key, s]) =>
    `<a class="ahx-sort${p.sort === key ? " on" : ""}"${p.sort === key ? ' aria-current="true"' : ""} data-ahx-nav href="${esc(historyUrl(surface, clean, { sort: key === "newest" ? "" : key, page: "" }))}">${esc(s.label)}</a>`
  ).join("");
  return `<div class="ahx-tbar"><span class="ahx-count">${countTxt}</span><div class="ahx-sorts" role="navigation" aria-label="Sort results">${links}</div></div>`;
}

function pager(r, clean, surface) {
  const link = (page, label, cls = "", current = false) =>
    `<a class="ahx-pg ${cls}${current ? " on" : ""}"${current ? ' aria-current="page"' : ""} data-ahx-nav href="${esc(historyUrl(surface, clean, { page: page === 1 ? "" : String(page) }))}">${label}</a>`;
  const parts = [];
  if (r.page > 1) parts.push(link(r.page - 1, "&larr; Prev", "nav"));
  if (r.pageCount !== null && r.pageCount > 1) {
    const from = Math.max(1, r.page - 2), to = Math.min(r.pageCount, r.page + 2);
    if (from > 1) parts.push(link(1, "1"), from > 2 ? `<span class="ahx-pg-gap">&hellip;</span>` : "");
    for (let i = from; i <= to; i++) parts.push(link(i, String(i), "", i === r.page));
    if (to < r.pageCount) parts.push(to < r.pageCount - 1 ? `<span class="ahx-pg-gap">&hellip;</span>` : "", link(r.pageCount, String(r.pageCount)));
  }
  if (r.hasMore) parts.push(link(r.page + 1, "Next &rarr;", "nav"));
  const inner = parts.filter(Boolean).join("");
  if (!inner) return "";
  const label = r.pageCount !== null ? `<span class="ahx-pg-label">Page ${r.page} of ${r.pageCount}</span>` : "";
  return `<nav class="ahx-pager" aria-label="Result pages">${inner}${label}</nav>`;
}

// Progressive loading state: submitting the form or following a sort / page /
// chip link dims the results and flips the submit buttons to "Searching...".
const LOADING_SCRIPT = `<script>(function(){
  var res=document.getElementById("ahxResults");
  function busy(){
    if(res){res.classList.add("ahx-loading");res.setAttribute("aria-busy","true");}
    document.querySelectorAll("[data-ahx-go]").forEach(function(b){b.disabled=true;b.textContent="Searching...";});
  }
  var f=document.querySelector("[data-ahx-form]");
  if(f)f.addEventListener("submit",busy);
  document.addEventListener("click",function(e){
    var a=e.target&&e.target.closest?e.target.closest("[data-ahx-nav]"):null;
    if(a)busy();
  });
})();</script>`;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

// The full history experience (filter card, chips, results, pager, states)
// for one surface. Callers own access control and the page chrome: the member
// route gates on portal_enabled + member below; the staff Auctions workspace
// is already behind a staff session.
export async function auctionHistoryContent(env, rawParams = {}, surface = HISTORY_SURFACES.member) {
  const p = validateHistoryParams(rawParams);
  const nowYear = new Date().getFullYear();
  const clean = cleanParams(p);

  const [makers, houses, fx, r] = await Promise.all([
    distinctMakers(env),
    distinctHouses(env),
    getLiveFx(env).catch(() => 0),
    searchHistory(env, p),
  ]);
  const models = p.make ? await distinctModels(env, p.make) : [];

  const filtered = chipLabels(p).length > 0;
  const countTxt = !r.ok
    ? "feed unavailable"
    : r.total !== null
      ? `${r.total.toLocaleString("en-AU")} sold result${r.total === 1 ? "" : "s"}`
      : `${r.lots.length}${r.hasMore ? "+" : ""} sold results`;

  let results;
  if (!r.ok) {
    results = feedDownCard();
  } else if (!r.lots.length) {
    // Past-the-end page (stale bookmark, hand-edited ?page=): results exist,
    // just not this deep - say so instead of the contradictory generic empty.
    const pastEnd = r.total !== null && r.total > 0 && p.page > 1;
    results = `<div class="card"><div class="empty"><div class="rule"></div>${pastEnd
      ? `You've gone past the last page of these results.<br><br><a class="btn-secondary" data-ahx-nav href="${esc(historyUrl(surface, clean, { page: "" }))}">Back to the first page</a>`
      : filtered
      ? `No sold results match those filters. Try removing a filter or widening the date range.<br><br><a class="ahx-clear" href="${esc(historyUrl(surface, {}))}">Clear all filters</a>`
      : "No sold results to show right now. Check back shortly."}</div></div>`;
  } else {
    const views = r.lots.map((lot) => lotView(lot, fx, nowYear, surface));
    results = `<div class="ahx-table"><table>
        <thead><tr><th>Vehicle</th><th>Gearbox / drive</th><th>Condition</th><th>Auction</th><th>Sold price</th><th>Est. landed</th><th><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>${views.map(resultRow).join("")}</tbody>
      </table></div>
      <div class="ahx-mobile">${views.map(resultCard).join("")}</div>`;
  }

  const fine = fx > 0
    ? `<p class="ahx-note">Sold prices are auction hammer prices. A$ conversion uses today's indicative rate (¥${Math.round(fx)} = A$1). Est. landed adds typical shipping, compliance and on-value taxes - a guide, not a quote.</p>`
    : "";

  return `${filterForm(p, { makers, models, houses }, surface)}
      ${chipsRow(p, clean, surface)}
      <section id="ahxResults" class="ahx-results" aria-label="Sold auction results">
        ${sortRow(p, clean, countTxt, surface)}
        ${results}
        ${r.ok && r.lots.length ? pager(r, clean, surface) : ""}
      </section>
      ${fine}
      ${LOADING_SCRIPT}${AHX_CSS}`;
}

export async function auctionHistoryPage(env, session, rawParams = {}) {
  const cid = Number(session.id);
  const c = await env.DB.prepare("SELECT * FROM clients WHERE id = ? AND portal_enabled = 1").bind(cid).first();
  if (!c) {
    return brandShell(portalSidebar(null),
      `<div class="topbar"><div><div class="kicker">Buyer portal</div><h1>Access ended</h1></div><a class="btn-secondary" href="/logout">Sign out</a></div>
       <div class="content"><div class="card"><div class="empty">Your portal access isn't active right now. Please contact JDM Connect.</div></div></div>`,
      "Auction history - JDM Connect");
  }
  if (!c.member) {
    return brandShell(portalSidebar(c, "history"),
      `<div class="topbar"><div class="topbar-in"><div class="kicker">Members</div><h1>Auction history</h1><p class="subline">See what comparable cars actually sold for at Japanese auction.</p></div></div>
       <div class="content"><div class="card"><div class="empty"><div class="rule"></div>Auction history is a members feature. With Full access you can see what every car really sells for before you bid.<br><br><a class="btn-primary" href="/portal/subscribe">See Full access</a></div></div></div>`,
      "Auction history - JDM Connect");
  }

  const main = `
    <div class="topbar">
      <div class="topbar-in">
        <div class="kicker">Members</div>
        <h1>Auction history</h1>
        <p class="subline">See what comparable cars actually sold for at Japanese auction, so you know what to bid.</p>
      </div>
    </div>
    <div class="content">
      ${await auctionHistoryContent(env, rawParams, HISTORY_SURFACES.member)}
    </div>`;
  return brandShell(portalSidebar(c, "history"), main, "Auction history - JDM Connect");
}

const AHX_CSS = `<style>
  .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}
  .ahx-filter{background:var(--card);border:1px solid var(--hair);border-radius:10px;padding:18px;margin-bottom:16px}
  .ahx-filter label span{display:block;font-size:11px;font-weight:700;color:var(--t2);margin:0 0 7px}
  .ahx-frow{display:grid;grid-template-columns:1fr 1fr auto;gap:12px;align-items:end}
  .ahx-go{height:46px;white-space:nowrap}
  .ahx-range{border:0;border-top:1px solid var(--hair);margin:16px 0 0;padding:14px 0 0;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .ahx-range legend{float:left;margin:7px 14px 0 0;font-size:11px;font-weight:700;color:var(--t2)}
  .ahx-range label{position:relative;margin:0;cursor:pointer}
  .ahx-range input{position:absolute;opacity:0;width:1px;height:1px;min-height:0}
  .ahx-filter .ahx-range label span{display:block;margin:0;padding:8px 13px;border:1px solid var(--field-line,#d8d6d0);border-radius:999px;background:var(--field,#fbfbfa);font-size:13px;font-weight:600;color:var(--t2)}
  .ahx-range input:checked+span{background:var(--ink);border-color:var(--ink);color:var(--bg-2)}
  .ahx-range input:focus-visible+span{outline:3px solid var(--gold-line);outline-offset:2px}
  .ahx-more{border-top:1px solid var(--hair);margin-top:14px;padding-top:14px}
  .ahx-more>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:12px;color:var(--ink);font-size:13px;font-weight:700}
  .ahx-more>summary::-webkit-details-marker{display:none}
  .ahx-more>summary:after{content:"+";margin-left:auto;color:var(--gold-txt);font-size:22px;line-height:1}
  .ahx-more[open]>summary:after{content:"-"}
  .ahx-more>summary small{font-weight:500;color:var(--t3)}
  .ahx-more-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-top:16px;padding:16px;background:var(--off);border:1px solid var(--hair-2);border-radius:9px}
  .ahx-more-act{display:flex;justify-content:flex-end;margin-top:14px}
  .ahx-chips{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:2px 2px 14px}
  .ahx-chips>span{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--t3);font-weight:700}
  .ahx-chip{background:var(--gold-tint);border:1px solid var(--gold-line);color:var(--ink);padding:6px 11px;border-radius:999px;font-size:12px;font-weight:600}
  .ahx-chip:hover{filter:brightness(.97)}
  .ahx-clear{font-size:12px;text-decoration:underline;text-underline-offset:3px;color:var(--t2);font-weight:600}
  .ahx-results{background:var(--card);border:1px solid var(--hair);border-radius:10px;overflow:hidden;transition:opacity .2s}
  .ahx-results.ahx-loading{opacity:.45;pointer-events:none}
  .ahx-tbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:16px 18px;border-bottom:1px solid var(--hair)}
  .ahx-count{font-size:13px;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums}
  .ahx-sorts{display:inline-flex;gap:4px;flex-wrap:wrap}
  .ahx-sort{padding:7px 11px;border:1px solid var(--hair);border-radius:8px;font-size:12px;font-weight:600;color:var(--t2)}
  .ahx-sort:hover{color:var(--ink)}
  .ahx-sort.on{background:var(--ink);border-color:var(--ink);color:var(--bg-2)}
  .ahx-table{overflow-x:auto}
  .ahx-table table{border-collapse:collapse;width:100%;min-width:1080px}
  .ahx-table th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:var(--t3);background:var(--off);padding:11px 16px;border-bottom:1px solid var(--hair)}
  .ahx-table td{padding:14px 16px;border-bottom:1px solid var(--hair-2);vertical-align:middle;font-size:13px}
  .ahx-table td>strong,.ahx-table td>span{display:block}
  .ahx-table td>span{color:var(--t3);font-size:11px;margin-top:4px}
  .ahx-table tr:last-child td{border-bottom:0}
  .ahx-car{display:flex;align-items:center;gap:13px;min-width:290px}
  .ahx-car img{width:112px;height:76px;object-fit:cover;border-radius:6px;background:var(--off)}
  .ahx-noimg{display:flex;align-items:center;justify-content:center;width:112px;height:76px;border-radius:6px;background:var(--off);color:var(--faint);font-size:10px;flex:0 0 auto}
  .ahx-car-t{display:block;font-size:14px;font-weight:700;color:var(--ink)}
  .ahx-car-t:hover{text-decoration:underline;text-underline-offset:2px}
  .ahx-car span{display:block;color:var(--t2);font-size:11px;margin:3px 0}
  .ahx-elig{display:inline-block;font-size:10.5px;font-weight:700;padding:3px 7px;border-radius:4px}
  .ahx-elig.ok{color:var(--good,#1F7A4D);background:var(--good-bg,#e4f4ea)}
  .ahx-elig.check{color:var(--warn-fg,#8a5e10);background:var(--warn-bg,#f7efdd)}
  .ahx-sold{display:inline-block;font-size:9.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--good,#1F7A4D);background:var(--good-bg,#e4f4ea);border-radius:4px;padding:2px 6px;margin-bottom:4px}
  .ahx-price{font-variant-numeric:tabular-nums}
  .ahx-landed{color:var(--gold-txt)!important;font-variant-numeric:tabular-nums}
  .ahx-act a{display:block;white-space:nowrap;color:var(--gold-txt);font-weight:700;font-size:12px;text-decoration:underline;text-underline-offset:3px}
  .ahx-act a+a{margin-top:6px;color:var(--t2)}
  .ahx-mobile{display:none}
  .ahx-pager{display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;padding:18px}
  .ahx-pg{min-width:36px;text-align:center;padding:8px 11px;border:1px solid var(--hair);border-radius:8px;font-size:13px;font-weight:600;color:var(--t2)}
  .ahx-pg:hover{color:var(--ink)}
  .ahx-pg.on{background:var(--ink);border-color:var(--ink);color:var(--bg-2)}
  .ahx-pg.nav{padding:8px 14px}
  .ahx-pg-gap{color:var(--faint)}
  .ahx-pg-label{width:100%;text-align:center;font-size:11px;color:var(--t3);margin-top:8px}
  .ahx-note{font-size:11px;color:var(--t3);max-width:760px;margin:16px 2px 0}
  @media(max-width:1050px){
    .ahx-more-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
    .ahx-table{display:none}
    .ahx-mobile{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;padding:16px}
    .ahx-rcard{border:1px solid var(--hair);border-radius:10px;overflow:hidden;background:var(--card-2)}
    .ahx-rcard>img{width:100%;height:200px;object-fit:cover;display:block;background:var(--off)}
    .ahx-noimg-card{display:flex;align-items:center;justify-content:center;width:100%;height:200px;background:var(--off);color:var(--faint);font-size:12px}
    .ahx-rc-body{padding:16px}
    .ahx-rc-head{display:flex;justify-content:space-between;gap:12px}
    .ahx-rc-head span{font-size:10px;letter-spacing:.08em;color:var(--gold-txt);font-family:var(--mono,ui-monospace,monospace)}
    .ahx-rc-head h3{font-size:16px;margin:3px 0;line-height:1.25}
    .ahx-rc-head h3 a{color:var(--ink)}
    .ahx-rc-head p{font-size:12px;color:var(--t3);margin:0}
    .ahx-rc-head>b{flex:0 0 auto;border:2px solid var(--gold);border-radius:50%;width:42px;height:42px;display:grid;place-items:center;font-size:13px;color:var(--ink)}
    .ahx-rcard dl{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}
    .ahx-rcard dt{font-size:10px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--t3)}
    .ahx-rcard dd{font-size:13px;font-weight:700;margin:3px 0 0;color:var(--ink)}
    .ahx-rcard dd small{font-weight:500;color:var(--t3)}
    .ahx-rc-foot{display:flex;justify-content:space-between;align-items:center;gap:12px;border-top:1px solid var(--hair);padding-top:13px}
    .ahx-rc-foot a{font-size:12px;color:var(--gold-txt);font-weight:800}
  }
  @media(max-width:680px){
    .ahx-frow{grid-template-columns:1fr 1fr}
    .ahx-go{grid-column:1/-1;width:100%}
    .ahx-range{display:grid;grid-template-columns:repeat(3,1fr)}
    .ahx-range legend{float:none;grid-column:1/-1;margin:0 0 4px}
    .ahx-range span{text-align:center;padding:8px 5px}
    .ahx-more>summary{align-items:flex-start;flex-direction:column;gap:2px;position:relative;padding-right:24px}
    .ahx-more>summary:after{position:absolute;right:0;top:-7px}
    .ahx-more-grid{grid-template-columns:1fr 1fr;padding:12px}
    .ahx-tbar{padding:14px}
    .ahx-mobile{grid-template-columns:1fr;padding:12px}
    .ahx-rcard>img,.ahx-noimg-card{height:190px}
  }
</style>`;
