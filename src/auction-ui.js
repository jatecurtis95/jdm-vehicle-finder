// Auction search UI (Stage 2 redesign).
//
// The app-style search experience shared by the member Auction search page and
// the staff Auctions workspace: a search-bar-first header with make / model /
// house filters, Live / Watchlist tabs, a results toolbar with a grid/list
// toggle, and richer result cards (grade badge, favourite heart, date, chassis,
// a 2x2 spec grid with auction house + import eligibility, and a Recent-avg
// price with a Sheet + primary action). The Watchlist is client-side only
// (localStorage), so it needs no schema and works identically on both surfaces.
//
// Copy rule for this codebase: no em dashes or en dashes. Use commas or hyphens.

import { esc, yen, displayGrade } from "./render.js";
import { imageUrls, splitImages } from "./avtonet.js";

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

// Tidy an ALL-CAPS feed token for display without mangling short acronyms or
// chassis codes (mirrors admin.js displayName; kept local to avoid a cycle).
function tcWord(w) { return /^[A-Z]{4,}$/.test(w) ? w[0] + w.slice(1).toLowerCase() : w; }
export function displayMaker(s) { return String(s || "").split(/\s+/).map(tcWord).join(" ").trim(); }

// "2026-07-02" -> "02 July". Parsed by hand so a timezone never shifts the day.
function shortDate(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ""));
  if (!m) return "";
  const mi = Number(m[2]) - 1;
  return `${m[3]} ${MONTHS[mi] || ""}`.trim();
}

// Import eligibility signal for a lot. The 25-year age rule is clear-cut and
// needs no register lookup; anything newer is "Check eligibility" (may still be
// SEVS-listed). Deliberately honest, not a guarantee. Returns { cls, label }.
export function auctionEligibility(lot, nowYear) {
  const yr = parseInt(lot && lot.year, 10);
  const year = nowYear || new Date().getFullYear();
  if (Number.isFinite(yr) && yr > 1950 && (year - yr) >= 25) return { cls: "ok", label: "Eligible" };
  return { cls: "check", label: "Check eligibility" };
}

// The Recent-avg / Start-price line. Prefers a sold average when present, else
// the start price, else POA. Returns { pk, price, aud }.
function priceLine(lot, fx) {
  const avg = Number(lot.avg_price), start = Number(lot.start);
  let pk = "Start price", jpy = 0;
  if (avg > 0) { pk = "Recent avg"; jpy = avg; }
  else if (start > 0) { pk = "Start price"; jpy = start; }
  const price = jpy > 0 ? yen(jpy) : "POA";
  const aud = (jpy > 0 && fx > 0) ? "≈ A$" + Math.round(jpy / fx).toLocaleString("en-AU") : "";
  return { pk, price, aud };
}

const HEART = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-10-9.2C.6 9 1.7 5.5 5 4.6 7 4 9 4.9 12 8c3-3.1 5-4 7-3.4 3.3.9 4.4 4.4 3 7.2C19.5 16.4 12 21 12 21z"/></svg>`;
const SEARCH_IC = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3" stroke-linecap="round"/></svg>`;
const GRID_IC = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>`;
const LIST_IC = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>`;

// A Sheet button: opens the inspection-sheet image if the auction house has
// uploaded it, otherwise a disabled placeholder (upcoming lots often lack one).
function sheetBtn(lot) {
  const sheet = splitImages(lot).sheet;
  return sheet
    ? `<a class="ac-sheet" target="_blank" rel="noopener" href="${esc(sheet + "&w=1400")}">Sheet</a>`
    : `<span class="ac-sheet dis" title="Sheet not uploaded yet">Sheet</span>`;
}

// One rich auction card. opts:
//   fx       JPY-per-AUD rate for the A$ estimate (0 hides it)
//   fav      show the favourite heart (default true)
//   actions  HTML injected into the card foot after the price (the primary
//            action: a Request form for buyers, a client picker for staff)
//   nowYear  current year (passed once per page so cards don't each call Date)
//   soldPrice  when set (JPY), the card shows a "Sold price" line and no heart
export function auctionCardV2(lot, opts = {}) {
  const fx = Number(opts.fx) || 0;
  const sold = Number(opts.soldPrice) > 0;
  const fav = opts.fav !== false && !sold;
  const img = imageUrls(lot).medium || "";
  const name = `${String(lot.marka_name || "").trim()} ${String(lot.model_name || "").trim()}`.replace(/\s+/g, " ").trim() || "Vehicle";
  const code = String(lot.kuzov || "").trim();
  const grade = displayGrade(lot.rate);
  const house = String(lot.auction || "").trim();
  const date = shortDate(lot.auction_date);
  const mileage = Number(lot.mileage) > 0 ? Number(lot.mileage).toLocaleString("en-US") + " km" : "-";
  const elig = auctionEligibility(lot, opts.nowYear);
  const pr = sold
    ? { pk: "Sold price", price: yen(opts.soldPrice), aud: fx > 0 ? "≈ A$" + Math.round(opts.soldPrice / fx).toLocaleString("en-AU") : "" }
    : priceLine(lot, fx);
  const sheet = splitImages(lot).sheet;
  const sheetUrl = sheet ? `${sheet}&w=1400` : "";

  const favData = fav ? ` data-id="${esc(lot.id)}" data-name="${esc(name)}" data-code="${esc(code)}" data-img="${esc(img)}" data-grade="${esc(grade)}" data-house="${esc(house)}" data-date="${esc(date)}" data-pk="${esc(pr.pk)}" data-price="${esc(pr.price)}" data-aud="${esc(pr.aud)}" data-mileage="${esc(mileage)}" data-elig="${esc(elig.label)}" data-eligcls="${esc(elig.cls)}" data-sheet="${esc(sheetUrl)}"` : "";
  const heart = fav ? `<button type="button" class="ac-fav"${favData} aria-pressed="false" aria-label="Save to watchlist">${HEART}</button>` : "";
  // When a detail route is supplied, the card opens a full lot page (gallery,
  // inspection report, specs, actions). The link is a stretched overlay UNDER
  // the heart/grade (z-index), so those stay clickable; the title is also a
  // link for keyboard/screen-reader users.
  const detailHref = opts.detailBase ? `${opts.detailBase}${encodeURIComponent(lot.id)}` : "";
  const photoLink = detailHref ? `<a class="ac-link" href="${esc(detailHref)}" aria-label="View ${esc(name)} details"></a>` : "";
  const nameHtml = detailHref ? `<a class="ac-name-link" href="${esc(detailHref)}">${esc(name)}</a>` : esc(name);

  return `<div class="acard">
    <div class="ac-photo"${img ? ` style="background-image:url('${esc(img)}')"` : ""}>
      <span class="ac-grade">Grade ${esc(grade)}</span>
      ${heart}
      ${date ? `<span class="ac-date${sold ? " sold" : ""}"><i></i>${sold ? "Sold " : ""}${esc(date)}</span>` : ""}
      <div class="ac-grad"></div>
      ${photoLink}
    </div>
    <div class="ac-body"><div class="ac-name">${nameHtml}</div>${code ? `<div class="ac-code">${esc(code)}</div>` : ""}</div>
    <div class="ac-stats">
      <div class="st"><div class="k">Auction house</div><div class="v">${esc(house) || "-"}</div></div>
      <div class="st"><div class="k">Grade</div><div class="v">${esc(grade)}</div></div>
      <div class="st"><div class="k">Eligibility</div><div class="v"><span class="ac-elig ${elig.cls}"><span class="dot"></span>${esc(elig.label)}</span></div></div>
      <div class="st"><div class="k">Mileage</div><div class="v">${esc(mileage)}</div></div>
    </div>
    <div class="ac-foot">
      <div class="ac-price"><div class="pk">${esc(pr.pk)}</div><div class="pv">${esc(pr.price)}</div>${pr.aud ? `<div class="pa">${esc(pr.aud)}</div>` : ""}</div>
      ${sheetBtn(lot)}
      ${opts.actions || ""}
    </div>
  </div>`;
}

// The search card: label + live counts, a big search bar, and make / model /
// house selects with a "More filters" dropdown for year, price and grade.
//   action   form GET target ("/portal/auctions" or "/admin")
//   hidden   extra hidden inputs (e.g. view=auctions for the staff route)
//   p        the current search params (echoed back into the fields)
//   makers/models/houses  option lists (models only when a make is chosen)
//   bidCount / showBid    the member's live bid-request count
export function auctionSearchHeader(o = {}) {
  const p = o.p || {};
  const v = (k) => esc(p[k] ?? "");
  const opt = (list, sel, tc) => (list || []).map((x) =>
    `<option value="${esc(x)}"${String(x) === String(sel) ? " selected" : ""}>${esc(tc ? displayMaker(x) : x)}</option>`).join("");
  const advOpen = ["yearMin", "yearMax", "priceMax", "gradeMin", "kuzov"].some((k) => String(p[k] || "").trim());
  const counts = `<span class="asrch-counts">Watchlist <b data-watch-count>0</b>${o.showBid ? ` <span class="sep">&middot;</span> Bid requests <b>${Number(o.bidCount) || 0}</b>` : ""}</span>`;
  return `<div class="asrch">
    <div class="asrch-top"><span class="asrch-label">${esc(o.label || "Search live Japanese auctions")}</span>${counts}</div>
    <form class="asrch-form" method="GET" action="${esc(o.action || "")}" role="search">
      ${o.hidden || ""}
      <div class="asrch-bar">
        <span class="asrch-ic" aria-hidden="true">${SEARCH_IC}</span>
        <input type="search" name="q" value="${v("q")}" placeholder="Search make, model, chassis code or lot number..." aria-label="Search auctions" autocomplete="off">
        <button class="asrch-go" type="submit">Search</button>
      </div>
      <div class="asrch-filters">
        <select name="make" aria-label="Make" onchange="this.form.submit()"><option value="">All makes</option>${opt(o.makers, p.make, true)}</select>
        <select name="model" aria-label="Model" onchange="this.form.submit()"><option value="">All models</option>${opt(o.models, p.model, true)}</select>
        <select name="house" aria-label="Auction house" onchange="this.form.submit()"><option value="">All houses</option>${opt(o.houses, p.house)}</select>
        <details class="asrch-more"${advOpen ? " open" : ""}>
          <summary>More filters</summary>
          <div class="asrch-adv">
            <div class="asrch-adv-grid">
              <label>Year from<input name="yearMin" type="number" min="1960" value="${v("yearMin")}" placeholder="1990"></label>
              <label>Year to<input name="yearMax" type="number" min="1960" value="${v("yearMax")}" placeholder="2002"></label>
              <label>Max price <span class="opt">(JPY)</span><input name="priceMax" type="number" min="0" step="any" value="${v("priceMax")}" placeholder="3,000,000"></label>
              <label>Min grade<input name="gradeMin" type="number" min="1" max="6" step="any" value="${v("gradeMin")}" placeholder="4"></label>
              <label>Chassis code<input name="kuzov" value="${v("kuzov")}" placeholder="GDB"></label>
            </div>
            <div class="asrch-adv-act"><button class="btn-gold" type="submit">Apply filters</button></div>
          </div>
        </details>
      </div>
    </form>
  </div>`;
}

// Live / Watchlist (and, for staff, Sold prices) pill tabs. `href` builds a URL
// for a given tab, preserving the current query.
export function auctionTabs(active, href, { sold = false, stats = false } = {}) {
  const tab = (id, label, extra = "") =>
    `<a class="atab${active === id ? " on" : ""}"${active === id ? ' aria-current="page"' : ""} href="${esc(href(id))}">${label}${extra}</a>`;
  return `<div class="atabs">
    ${tab("live", "Live auctions")}
    ${tab("watch", "Watchlist", ` <b data-watch-count>0</b>`)}
    ${sold ? tab("sold", "Sold auctions") : ""}
    ${stats ? tab("prices", "Sold prices") : ""}
  </div>`;
}

// Results toolbar: the feed label + a count, and a grid/list view toggle.
// `viewHref(mode)` builds a URL that swaps only the view.
export function auctionToolbar({ count = 0, hasMore = false, page = 1, view = "grid", viewHref, label = "Live auction feed" }) {
  const av = (mode, ic, lbl) =>
    `<a class="av${view === mode ? " on" : ""}" href="${esc(viewHref(mode))}" title="${lbl}" aria-label="${lbl}">${ic}</a>`;
  return `<div class="atbar">
    <div class="atbar-l">${esc(label)}${page > 1 ? ` <span class="sep">&middot;</span> page ${page}` : ""}</div>
    <div class="atbar-r">
      <span class="atbar-count">${count} lot${count === 1 ? "" : "s"}${hasMore ? "+" : ""}</span>
      <div class="aview">${av("grid", GRID_IC, "Grid view")}${av("list", LIST_IC, "List view")}</div>
    </div>
  </div>`;
}

// Client-side Watchlist: toggles favourites in localStorage, keeps the header
// counts live, marks favourited cards, and (on the Watchlist tab) renders saved
// lots into #watchGrid. opts.request => include a Request form on watch cards.
export function auctionWatchScript(opts = {}) {
  const REQUEST = opts.request ? "true" : "false";
  return `<script>(function(){
  var REQUEST=${REQUEST},KEY='jdmWatch';
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
  function load(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(e){return {};}}
  function save(m){try{localStorage.setItem(KEY,JSON.stringify(m));}catch(e){}}
  function paint(){var n=Object.keys(load()).length,e=document.querySelectorAll('[data-watch-count]');for(var i=0;i<e.length;i++){e[i].textContent=n;}}
  function mark(){var m=load(),b=document.querySelectorAll('.ac-fav[data-id]');for(var i=0;i<b.length;i++){var on=!!m[b[i].getAttribute('data-id')];b[i].classList.toggle('on',on);b[i].setAttribute('aria-pressed',on?'true':'false');b[i].setAttribute('aria-label',on?'Remove from watchlist':'Save to watchlist');}}
  function snap(el){var d=el.dataset;return {id:d.id,name:d.name,code:d.code,img:d.img,grade:d.grade,house:d.house,date:d.date,pk:d.pk,price:d.price,aud:d.aud,mileage:d.mileage,elig:d.elig,eligcls:d.eligcls,sheet:d.sheet};}
  function attrs(v){var k=['id','name','code','img','grade','house','date','pk','price','aud','mileage','elig','eligcls','sheet'],o='';for(var i=0;i<k.length;i++){o+=' data-'+k[i]+'="'+esc(v[k[i]])+'"';}return o;}
  var HEART='${HEART}';
  function card(v){
    var h='<div class="acard"><div class="ac-photo" data-bg="'+esc(v.img)+'">';
    h+='<span class="ac-grade">Grade '+esc(v.grade)+'</span>';
    h+='<button type="button" class="ac-fav on" aria-pressed="true" aria-label="Remove from watchlist"'+attrs(v)+'>'+HEART+'</button>';
    h+=(v.date?'<span class="ac-date"><i></i>'+esc(v.date)+'</span>':'')+'<div class="ac-grad"></div></div>';
    h+='<div class="ac-body"><div class="ac-name">'+esc(v.name)+'</div>'+(v.code?'<div class="ac-code">'+esc(v.code)+'</div>':'')+'</div>';
    h+='<div class="ac-stats"><div class="st"><div class="k">Auction house</div><div class="v">'+(esc(v.house)||'-')+'</div></div>';
    h+='<div class="st"><div class="k">Grade</div><div class="v">'+esc(v.grade)+'</div></div>';
    h+='<div class="st"><div class="k">Eligibility</div><div class="v"><span class="ac-elig '+(v.eligcls==='ok'?'ok':'check')+'"><span class="dot"></span>'+esc(v.elig)+'</span></div></div>';
    h+='<div class="st"><div class="k">Mileage</div><div class="v">'+(esc(v.mileage)||'-')+'</div></div></div>';
    h+='<div class="ac-foot"><div class="ac-price"><div class="pk">'+(esc(v.pk)||'Price')+'</div><div class="pv">'+esc(v.price)+'</div>'+(v.aud?'<div class="pa">'+esc(v.aud)+'</div>':'')+'</div>';
    h+=(v.sheet?'<a class="ac-sheet" target="_blank" rel="noopener" href="'+esc(v.sheet)+'">Sheet</a>':'<span class="ac-sheet dis">Sheet</span>');
    if(REQUEST){h+='<form method="POST" action="/portal/auctions/request" style="margin:0"><input type="hidden" name="id" value="'+esc(v.id)+'"><button class="btn-notify ac-req" type="submit">Request bid</button></form>';}
    h+='</div></div>';return h;
  }
  function renderWatch(){var g=document.getElementById('watchGrid');if(!g)return;var m=load(),ids=Object.keys(m);
    if(!ids.length){g.innerHTML='<div class="awatch-empty"><div class="rule"></div>No cars saved yet. Tap the heart on any lot to add it to your watchlist.</div>';return;}
    var out='';for(var i=0;i<ids.length;i++){out+=card(m[ids[i]]);}g.innerHTML=out;
    var ph=g.querySelectorAll('.ac-photo[data-bg]');for(var j=0;j<ph.length;j++){var u=ph[j].getAttribute('data-bg');if(u)ph[j].style.backgroundImage="url('"+u+"')";}}
  document.addEventListener('click',function(ev){var t=ev.target,b=t&&t.closest?t.closest('.ac-fav'):null;if(!b)return;ev.preventDefault();var m=load(),id=b.getAttribute('data-id');if(m[id]){delete m[id];}else{m[id]=snap(b);}save(m);mark();paint();renderWatch();});
  mark();paint();renderWatch();
})();</script>`;
}

// One stylesheet for the whole experience, injected into both the buyer portal
// (light .main on the dark brand shell) and the staff admin (same light .main),
// which share design-token variable names. Eligibility colours are hardcoded for
// the light content area both surfaces use.
export const AUCTION_CSS = `<style>
  .asrch{background:var(--card);border:1px solid var(--hair);border-radius:14px;padding:20px 22px;margin-bottom:20px}
  .asrch-top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}
  .asrch-label{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--faint)}
  .asrch-counts{font-size:12.5px;color:var(--t3)}
  .asrch-counts b{color:var(--ink);font-weight:700;font-variant-numeric:tabular-nums}
  .asrch-counts .sep{opacity:.5;margin:0 2px}
  .asrch-bar{position:relative;display:flex;align-items:center;gap:10px}
  .asrch-ic{position:absolute;left:15px;top:50%;transform:translateY(-50%);display:flex;color:var(--faint);pointer-events:none}
  .asrch-ic svg{width:19px;height:19px}
  .asrch-bar input[type=search]{flex:1;width:100%;padding:15px 15px 15px 46px;border:1px solid var(--field-line);border-radius:11px;background:var(--field);color:var(--ink);font-size:15px;font-family:inherit}
  .asrch-bar input[type=search]:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 3px var(--gold-tint)}
  .asrch-go{flex:0 0 auto;background:var(--gold);color:#15120A;font-weight:700;border:0;padding:14px 22px;border-radius:11px;font-size:14px;cursor:pointer;font-family:inherit}
  .asrch-go:hover{background:var(--gold-hover)}
  .asrch-filters{position:relative;display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}
  .asrch-filters select{flex:1 1 170px;min-width:0;padding:11px 34px 11px 13px;border-radius:9px}
  .asrch-more{flex:0 0 auto;position:static}
  .asrch-more>summary{list-style:none;cursor:pointer;display:inline-flex;align-items:center;gap:8px;background:var(--soft,rgba(0,0,0,0.04));color:var(--ink);border:1px solid var(--hair);border-radius:9px;padding:11px 18px;font-size:14px;font-weight:600}
  .asrch-more>summary::-webkit-details-marker{display:none}
  .asrch-more>summary:after{content:"+";color:var(--gold);font-weight:700;font-size:17px;line-height:1}
  .asrch-more[open]>summary:after{content:"-"}
  .asrch-adv{position:absolute;top:calc(100% + 8px);left:0;right:0;z-index:8;background:var(--card);border:1px solid var(--hair);border-radius:12px;padding:18px;box-shadow:0 20px 55px rgba(0,0,0,.16)}
  .asrch-adv-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px 16px}
  .asrch-adv-grid label{display:block;font-size:12px;color:var(--t2);font-weight:600;margin:0}
  .asrch-adv-grid label .opt{color:var(--faint);font-weight:400}
  .asrch-adv-grid input{margin-top:7px;padding:11px 13px;border-radius:8px}
  .asrch-adv-act{display:flex;justify-content:flex-end;margin-top:16px}

  .atabs{display:inline-flex;gap:4px;background:var(--card);border:1px solid var(--hair);border-radius:11px;padding:5px;margin-bottom:16px}
  .atab{display:inline-flex;align-items:center;gap:7px;padding:9px 17px;border-radius:8px;font-size:13.5px;font-weight:600;color:var(--t2)}
  .atab:hover{color:var(--ink)}
  .atab.on{background:var(--ink);color:var(--bg-2)}
  .atab b{font-weight:700;font-variant-numeric:tabular-nums;opacity:.75}
  .atab.on b{opacity:.85}

  .atbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:2px 0 16px}
  .atbar-l{font-size:12px;font-weight:600;letter-spacing:.02em;color:var(--gold-txt);text-transform:uppercase}
  .atbar-l .sep{opacity:.5;margin:0 3px}
  .atbar-r{display:flex;align-items:center;gap:14px}
  .atbar-count{font-size:13px;font-weight:600;color:var(--t2);font-variant-numeric:tabular-nums}
  .aview{display:inline-flex;gap:3px;background:var(--card);border:1px solid var(--hair);border-radius:9px;padding:3px}
  .av{display:inline-flex;align-items:center;justify-content:center;width:32px;height:30px;border-radius:6px;color:var(--faint)}
  .av svg{width:17px;height:17px}
  .av:hover{color:var(--ink)}
  .av.on{background:var(--gold-tint);color:var(--gold-txt)}

  .acgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px}
  .acard{background:var(--card);border:1px solid var(--hair);border-radius:13px;overflow:hidden;display:flex;flex-direction:column;transition:border-color .15s,transform .15s,box-shadow .15s;content-visibility:auto;contain-intrinsic-size:auto 420px}
  .acard:hover{border-color:var(--gold-line);transform:translateY(-3px);box-shadow:0 14px 34px rgba(0,0,0,.12)}
  .ac-photo{position:relative;height:168px;flex:0 0 auto;background:#0B0D10;background-size:cover;background-position:center;border-bottom:2px solid var(--gold)}
  .ac-grad{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.55) 0%,rgba(0,0,0,0) 42%)}
  .ac-link{position:absolute;inset:0;z-index:1;display:block}
  .ac-name-link{color:inherit;text-decoration:none}
  .ac-name-link:hover{color:var(--gold-txt)}
  .ac-grade{position:absolute;top:10px;left:10px;z-index:2;background:rgba(0,0,0,.62);backdrop-filter:blur(3px);color:#fff;font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:5px 9px;border-radius:6px}
  .ac-fav{position:absolute;top:9px;right:9px;z-index:2;width:33px;height:33px;display:inline-flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);border:0;border-radius:9px;color:#fff;cursor:pointer;padding:0;-webkit-tap-highlight-color:transparent;transition:background .15s,color .15s,transform .1s}
  .ac-fav svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2}
  .ac-fav:hover{background:rgba(0,0,0,.68)}
  .ac-fav:active{transform:scale(.9)}
  .ac-fav.on{color:var(--gold)}
  .ac-fav.on svg{fill:currentColor;stroke:currentColor}
  .ac-date{position:absolute;left:11px;bottom:10px;z-index:2;display:inline-flex;align-items:center;gap:6px;color:#fff;font-size:11.5px;font-weight:600}
  .ac-date i{width:6px;height:6px;border-radius:50%;background:#E2607A;display:inline-block}
  .ac-date.sold i{background:#9aa3a0}
  .ac-body{padding:13px 15px 2px}
  .ac-name{font-size:15px;font-weight:700;color:var(--ink);letter-spacing:.01em;line-height:1.25;text-transform:uppercase}
  .ac-code{font-size:12px;color:var(--t3);margin-top:2px;font-family:var(--mono,ui-monospace,monospace);letter-spacing:.02em}
  .ac-stats{display:grid;grid-template-columns:1fr 1fr;gap:11px 14px;padding:13px 15px;margin-top:11px;border-top:1px solid var(--hair)}
  .ac-stats .k{font-size:9.5px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--faint)}
  .ac-stats .v{font-size:12.5px;font-weight:600;margin-top:4px;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ac-elig{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600}
  .ac-elig .dot{width:7px;height:7px;border-radius:50%;display:inline-block}
  .ac-elig.ok{color:#1F7A4D}.ac-elig.ok .dot{background:#1F7A4D}
  .ac-elig.check{color:#8a5e10}.ac-elig.check .dot{background:#C9A34C}
  .ac-foot{border-top:1px solid var(--hair);padding:12px 15px;display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-top:auto}
  .ac-price{flex:1;min-width:96px}
  .ac-price .pk{font-size:9.5px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--faint)}
  .ac-price .pv{font-size:15px;font-weight:700;color:var(--ink);margin-top:2px;font-variant-numeric:tabular-nums}
  .ac-price .pa{font-size:11px;color:var(--t3)}
  .ac-sheet{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;background:transparent;color:var(--ink);border:1px solid var(--hair);border-radius:8px;padding:9px 13px;font-size:13px;font-weight:600;cursor:pointer}
  .ac-sheet:hover{border-color:var(--gold-line);color:var(--gold-txt)}
  .ac-sheet.dis{opacity:.42;pointer-events:none}
  .ac-req,.acard .btn-notify{flex:0 0 auto;font-size:13px;padding:9px 15px;border-radius:8px}
  .ac-picker{display:flex;gap:8px;width:100%;margin-top:2px}
  .ac-picker select{flex:1;min-width:0}

  .acgrid.list{display:flex;flex-direction:column;gap:12px}
  .acgrid.list .acard{flex-direction:row;align-items:stretch;contain-intrinsic-size:auto 150px}
  .acgrid.list .ac-photo{width:210px;height:auto;flex:0 0 210px;border-bottom:0;border-right:2px solid var(--gold)}
  .acgrid.list .ac-body{flex:0 0 auto;padding:14px 16px 4px;align-self:center;width:210px}
  .acgrid.list .ac-stats{flex:1;border-top:0;margin-top:0;align-content:center;grid-template-columns:1fr 1fr}
  .acgrid.list .ac-foot{flex:0 0 auto;border-top:0;flex-direction:column;align-items:stretch;justify-content:center;width:210px;margin:0}
  @media(max-width:900px){.acgrid.list .acard{flex-direction:column}.acgrid.list .ac-photo{width:100%;flex-basis:168px;border-right:0;border-bottom:2px solid var(--gold)}.acgrid.list .ac-body,.acgrid.list .ac-foot{width:auto}.acgrid.list .ac-stats{border-top:1px solid var(--hair)}}

  .awatch-empty{color:var(--faint);padding:52px 0;text-align:center;font-size:14px}
  .awatch-empty .rule{width:42px;height:1px;background:var(--gold);opacity:.7;margin:0 auto 16px}

  @media(max-width:640px){
    .acgrid{grid-template-columns:1fr}
    .asrch{padding:16px 16px}
    .asrch-go{padding:14px 16px}
    /* 2-up filter selects (not full-width-stacked) so the search header stays
       compact and results are visible without a long scroll. */
    .asrch-filters{gap:8px}
    .asrch-filters select{flex:1 1 calc(50% - 4px);min-width:0}
    .asrch-more{flex-basis:100%}
    .asrch-more>summary{width:100%;justify-content:center}
  }
</style>`;
