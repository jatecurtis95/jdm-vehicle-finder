import { brandDoc, escHtml, LOGO } from "./theme.js";

const CARS = [
  { id: "h1", make: "NISSAN", model: "SKYLINE", variant: "GT-R V-SPEC", code: "BNR34", year: 2000, km: 62000, grade: 4.5, house: "USS Tokyo", date: "2026-07-09", jpy: 12850000, aud: 135263, landed: 158900, image: "/assets/photo/web/hero_r32_garage.jpg", eligible: "25-year rule" },
  { id: "h2", make: "NISSAN", model: "SKYLINE", variant: "GT-T", code: "ER34", year: 1999, km: 88000, grade: 4, house: "TAA Kinki", date: "2026-07-04", jpy: 4280000, aud: 45053, landed: 61200, image: "/assets/photo/web/r34_highway_bw.jpg", eligible: "25-year rule" },
  { id: "h3", make: "TOYOTA", model: "SUPRA", variant: "RZ-S", code: "JZA80", year: 1997, km: 71000, grade: 4.5, house: "USS Nagoya", date: "2026-06-28", jpy: 9650000, aud: 101579, landed: 122400, image: "/assets/photo/web/tokyo_r34_night.jpg", eligible: "25-year rule" },
  { id: "h4", make: "MAZDA", model: "RX-7", variant: "Type RS", code: "FD3S", year: 1999, km: 95000, grade: 4, house: "USS Osaka", date: "2026-06-21", jpy: 5820000, aud: 61263, landed: 78200, image: "/assets/photo/web/s14_garage.jpg", eligible: "25-year rule" },
  { id: "h5", make: "HONDA", model: "CIVIC", variant: "Type R", code: "EK9", year: 1998, km: 110000, grade: 3.5, house: "USS Tokyo", date: "2026-06-14", jpy: 3410000, aud: 35895, landed: 50900, image: "/assets/photo/web/s15_enginebay.jpg", eligible: "25-year rule" },
  { id: "h6", make: "TOYOTA", model: "CROWN", variant: "Royal Saloon G", code: "JZS155", year: 1998, km: 83000, grade: 4, house: "JU Tokyo", date: "2026-06-08", jpy: 1180000, aud: 12421, landed: 26100, image: "/assets/photo/web/shibuya_night.jpg", eligible: "25-year rule" },
];

const money = (n) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);
const yen = (n) => `¥${new Intl.NumberFormat("en-AU").format(n)}`;
const num = (n) => new Intl.NumberFormat("en-AU").format(n);
const esc = escHtml;

function filters(params) {
  const q = String(params.q || "").trim().toUpperCase();
  const make = String(params.make || "").trim().toUpperCase();
  const yearMin = Number(params.yearMin) || 0;
  const yearMax = Number(params.yearMax) || 9999;
  const gradeMin = Number(params.gradeMin) || 0;
  return CARS.filter((car) => {
    const haystack = `${car.make} ${car.model} ${car.variant} ${car.code}`.toUpperCase();
    return (!q || haystack.includes(q)) && (!make || car.make === make) && car.year >= yearMin && car.year <= yearMax && car.grade >= gradeMin;
  });
}

function chip(label, key, params) {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (k !== key && String(v || "").trim()) next.set(k, String(v));
  return `<a class="ah-chip" href="/auction-history-example${next.size ? `?${next}` : ""}" aria-label="Remove ${esc(label)} filter">${esc(label)} <span aria-hidden="true">×</span></a>`;
}

function resultRow(car) {
  const title = `${car.year} ${car.make} ${car.model}`;
  return `<tr>
    <td><div class="ah-car"><img src="${car.image}" width="112" height="76" loading="lazy" alt="${esc(title)}"><div><strong>${esc(title)}</strong><span>${esc(car.code)} · ${esc(car.variant)}</span><small>${esc(car.eligible)}</small></div></div></td>
    <td><strong>${num(car.km)} km</strong><span>Grade ${car.grade}</span></td>
    <td><strong>${esc(car.house)}</strong><span>${new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(new Date(`${car.date}T00:00:00Z`))}</span></td>
    <td><strong>${yen(car.jpy)}</strong><span>Hammer price</span></td>
    <td><strong>${money(car.aud)}</strong><span>Approx. conversion</span></td>
    <td><strong class="ah-landed">${money(car.landed)}</strong><span>Est. landed</span></td>
    <td><a class="ah-action" href="/request">Find one like this</a></td>
  </tr>`;
}

function resultCard(car) {
  const title = `${car.year} ${car.make} ${car.model}`;
  return `<article class="ah-result-card">
    <img src="${car.image}" width="640" height="420" loading="lazy" alt="${esc(title)}">
    <div class="ah-rc-body"><div class="ah-rc-head"><div><span>${esc(car.code)}</span><h2>${esc(title)}</h2><p>${esc(car.variant)}</p></div><b>${car.grade}</b></div>
    <dl><div><dt>Odometer</dt><dd>${num(car.km)} km</dd></div><div><dt>Auction</dt><dd>${esc(car.house)}</dd></div><div><dt>Hammer</dt><dd>${yen(car.jpy)}</dd></div><div><dt>Est. landed</dt><dd class="ah-landed">${money(car.landed)}</dd></div></dl>
    <div class="ah-rc-foot"><span>${esc(car.eligible)}</span><a href="/request">Find one like this</a></div></div>
  </article>`;
}

export function auctionHistoryExamplePage(params = {}) {
  const rows = filters(params);
  const prices = rows.map((x) => x.aud).sort((a, b) => a - b);
  const median = prices.length ? prices[Math.floor(prices.length / 2)] : 0;
  const min = prices[0] || 0;
  const max = prices.at(-1) || 0;
  const active = [];
  if (params.q) active.push(chip(`Search: ${params.q}`, "q", params));
  if (params.make) active.push(chip(params.make, "make", params));
  if (params.yearMin) active.push(chip(`From ${params.yearMin}`, "yearMin", params));
  if (params.yearMax) active.push(chip(`To ${params.yearMax}`, "yearMax", params));
  if (params.gradeMin) active.push(chip(`Grade ${params.gradeMin}+`, "gradeMin", params));
  const option = (value, label, selected) => `<option value="${value}"${String(selected || "") === String(value) ? " selected" : ""}>${label}</option>`;

  const content = `<style>${CSS}</style><div class="ah-shell">
    <header class="ah-nav"><a href="/" aria-label="JDM Connect home">${LOGO}</a><span>Auction intelligence</span><a href="/request">Start a search</a></header>
    <main id="main">
      <section class="ah-hero"><div><span class="ah-kicker">Japanese auction results · Example</span><h1>Auction history</h1><p>See what comparable cars actually sold for—and what they may cost landed in Australia.</p></div><div class="ah-rate"><span>Indicative FX</span><strong>¥95 = A$1</strong><small>Updated for this example</small></div></section>

      <form class="ah-filter" action="/auction-history-example" method="GET">
        <label class="ah-query"><span>Search make, model or chassis</span><input type="search" name="q" value="${esc(params.q || "")}" placeholder="e.g. Skyline BNR34…" autocomplete="off"></label>
        <label><span>Make</span><select name="make">${option("", "All makes", params.make)}${["NISSAN", "TOYOTA", "MAZDA", "HONDA"].map((m) => option(m, m, params.make)).join("")}</select></label>
        <label><span>Year from</span><input type="number" name="yearMin" min="1980" max="2026" value="${esc(params.yearMin || "")}" placeholder="1995"></label>
        <label><span>Year to</span><input type="number" name="yearMax" min="1980" max="2026" value="${esc(params.yearMax || "")}" placeholder="2002"></label>
        <label><span>Minimum grade</span><select name="gradeMin">${option("", "Any grade", params.gradeMin)}${option("3.5", "3.5+", params.gradeMin)}${option("4", "4.0+", params.gradeMin)}${option("4.5", "4.5+", params.gradeMin)}</select></label>
        <button type="submit">Search history</button>
      </form>
      ${active.length ? `<div class="ah-chips"><span>Filters</span>${active.join("")}<a href="/auction-history-example">Clear all</a></div>` : ""}

      <section class="ah-snapshot" aria-labelledby="snapshot-title"><div><span class="ah-kicker">Recent market snapshot</span><h2 id="snapshot-title">${rows.length} comparable sale${rows.length === 1 ? "" : "s"}</h2><p>Demo results based on the filters above. Production would use the live sold-auction feed.</p></div>
        <dl><div><dt>Median hammer</dt><dd>${money(median)}</dd></div><div><dt>Observed range</dt><dd>${rows.length ? `${money(min)}–${money(max)}` : "—"}</dd></div><div><dt>Typical grade</dt><dd>${rows.length ? (rows.reduce((s, x) => s + x.grade, 0) / rows.length).toFixed(1) : "—"}</dd></div></dl>
      </section>

      <section class="ah-results" aria-labelledby="results-title"><div class="ah-results-head"><div><span class="ah-kicker">Sold at auction</span><h2 id="results-title">Results</h2></div><div><button type="button" class="active">Newest</button><button type="button">Price</button></div></div>
        ${rows.length ? `<div class="ah-table"><table><thead><tr><th>Vehicle</th><th>Condition</th><th>Auction details</th><th>Hammer price</th><th>Approx. AUD</th><th>Est. landed</th><th></th></tr></thead><tbody>${rows.map(resultRow).join("")}</tbody></table></div><div class="ah-mobile">${rows.map(resultCard).join("")}</div>` : `<div class="ah-empty"><h3>No comparable sales</h3><p>Try removing a filter or widening the year range.</p><a href="/auction-history-example">Clear filters</a></div>`}
      </section>
      <p class="ah-note">Example only. Currency conversions and landed estimates are indicative and would be recalculated using the live JDM Connect landed-cost service.</p>
    </main>
  </div>`;
  return brandDoc(content, "Auction history example - JDM Connect");
}

const CSS = `
  :root{--ah-gold:#CAA34C;--ah-ink:#17191d;--ah-muted:#676c74;--ah-line:#e4e2dc;--ah-paper:#f4f3ef;--ah-card:#fff}
  body{background:var(--ah-paper);color:var(--ah-ink)}.ah-shell{min-height:100vh}.ah-nav{height:76px;padding:0 clamp(20px,5vw,72px);display:flex;align-items:center;gap:24px;background:#0d0f13;color:#fff;border-bottom:1px solid rgba(255,255,255,.1)}.ah-nav svg{width:210px;height:auto}.ah-nav>span{font-size:11px;text-transform:uppercase;letter-spacing:.16em;color:#9ca0a8;border-left:1px solid #333740;padding-left:24px}.ah-nav>a:last-child{margin-left:auto;background:var(--ah-gold);color:#17130a;padding:11px 18px;border-radius:7px;font-weight:700;font-size:13px}
  .ah-shell main{max-width:1500px;margin:auto;padding:48px clamp(20px,5vw,72px) 80px}.ah-hero{display:flex;justify-content:space-between;align-items:flex-end;gap:32px;margin-bottom:32px}.ah-kicker{display:block;color:#8a6a22;font-size:11px;font-weight:800;letter-spacing:.15em;text-transform:uppercase;margin-bottom:9px}.ah-hero h1{font-size:clamp(38px,5vw,66px);line-height:.95;margin:0;letter-spacing:-.055em}.ah-hero p{font-size:17px;color:var(--ah-muted);max-width:650px;margin:16px 0 0}.ah-rate{background:#17191d;color:#fff;border-left:4px solid var(--ah-gold);padding:18px 22px;min-width:210px}.ah-rate span,.ah-rate small{display:block;color:#aeb1b7;font-size:11px}.ah-rate strong{display:block;font-size:21px;margin:3px 0}
  .ah-filter{display:grid;grid-template-columns:minmax(260px,2fr) repeat(4,minmax(115px,1fr)) auto;gap:12px;align-items:end;background:var(--ah-card);border:1px solid var(--ah-line);padding:18px;border-radius:12px;box-shadow:0 8px 24px rgba(20,22,25,.05)}.ah-filter label span{display:block;font-size:11px;font-weight:700;color:#555a62;margin:0 0 7px}.ah-filter input,.ah-filter select{height:44px;width:100%;border:1px solid #d8d6d0;background:#fbfbfa;color:var(--ah-ink);border-radius:7px;padding:0 12px;font:inherit}.ah-filter button{height:44px;border:0;border-radius:7px;padding:0 20px;background:var(--ah-gold);color:#18140b;font-weight:800;cursor:pointer}.ah-filter input:focus-visible,.ah-filter select:focus-visible,.ah-filter button:focus-visible,.ah-chip:focus-visible{outline:3px solid rgba(202,163,76,.35);outline-offset:2px}
  .ah-chips{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:14px 2px}.ah-chips>span{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--ah-muted);font-weight:800}.ah-chip{background:#ebe6d8;border:1px solid #d6c9a8;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:700}.ah-chips>a:last-child{font-size:12px;text-decoration:underline;color:var(--ah-muted)}
  .ah-snapshot{display:grid;grid-template-columns:1fr 1.4fr;gap:32px;background:#17191d;color:#fff;margin:28px 0;border-radius:12px;padding:26px 30px}.ah-snapshot h2{margin:0;font-size:25px}.ah-snapshot p{margin:8px 0 0;color:#aaadb3;font-size:13px}.ah-snapshot dl{display:grid;grid-template-columns:repeat(3,1fr);margin:0}.ah-snapshot dl div{padding:5px 22px;border-left:1px solid #34373d}.ah-snapshot dt{font-size:11px;color:#a8abb1;margin-bottom:6px}.ah-snapshot dd{margin:0;font-size:20px;font-weight:750;color:#f0d48e}
  .ah-results{background:var(--ah-card);border:1px solid var(--ah-line);border-radius:12px;overflow:hidden}.ah-results-head{display:flex;justify-content:space-between;align-items:end;padding:24px 26px 18px}.ah-results-head h2{margin:0;font-size:26px}.ah-results-head button{border:1px solid #d9d7d1;background:#fff;padding:8px 12px;color:var(--ah-muted)}.ah-results-head button:first-child{border-radius:6px 0 0 6px}.ah-results-head button:last-child{border-radius:0 6px 6px 0}.ah-results-head button.active{background:#17191d;color:#fff;border-color:#17191d}
  .ah-table{overflow-x:auto}.ah-table table{border-collapse:collapse;width:100%;min-width:1120px}.ah-table th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:#777b82;background:#f7f6f3;padding:11px 16px;border-top:1px solid var(--ah-line);border-bottom:1px solid var(--ah-line)}.ah-table td{padding:14px 16px;border-bottom:1px solid #eceae5;vertical-align:middle;font-size:13px}.ah-table td>strong,.ah-table td>span{display:block}.ah-table td>span{color:var(--ah-muted);font-size:11px;margin-top:4px}.ah-car{display:flex;align-items:center;gap:13px;min-width:300px}.ah-car img{width:112px;height:76px;object-fit:cover;border-radius:6px}.ah-car strong,.ah-car span,.ah-car small{display:block}.ah-car strong{font-size:14px}.ah-car span{color:#555b64;margin:3px 0}.ah-car small{display:inline-block;color:#31714e;background:#e4f4ea;padding:3px 6px;border-radius:4px}.ah-landed{color:#866319!important}.ah-action{white-space:nowrap;color:#755510;font-weight:800;text-decoration:underline;text-underline-offset:3px}.ah-mobile{display:none}.ah-note{font-size:11px;color:#777b82;max-width:760px;margin:18px 2px}.ah-empty{text-align:center;padding:60px 20px;border-top:1px solid var(--ah-line)}.ah-empty h3{margin:0}.ah-empty p{color:var(--ah-muted)}.ah-empty a{color:#755510;font-weight:700;text-decoration:underline}
  @media(max-width:1050px){.ah-filter{grid-template-columns:2fr repeat(2,1fr)}.ah-filter button{width:100%}.ah-snapshot{grid-template-columns:1fr}.ah-table{display:none}.ah-mobile{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;padding:0 18px 18px}.ah-result-card{border:1px solid var(--ah-line);border-radius:10px;overflow:hidden;background:#fff}.ah-result-card>img{width:100%;height:210px;object-fit:cover}.ah-rc-body{padding:16px}.ah-rc-head{display:flex;justify-content:space-between;gap:12px}.ah-rc-head span{font-size:10px;letter-spacing:.08em;color:#8b6a20}.ah-rc-head h2{font-size:17px;margin:3px 0}.ah-rc-head p{font-size:12px;color:var(--ah-muted);margin:0}.ah-rc-head>b{border:2px solid var(--ah-gold);border-radius:50%;width:42px;height:42px;display:grid;place-items:center}.ah-result-card dl{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:18px 0}.ah-result-card dt{font-size:10px;color:var(--ah-muted)}.ah-result-card dd{font-size:13px;font-weight:700;margin:3px 0 0}.ah-rc-foot{display:flex;justify-content:space-between;gap:12px;align-items:center;border-top:1px solid var(--ah-line);padding-top:13px}.ah-rc-foot span{font-size:10px;color:#31714e}.ah-rc-foot a{font-size:12px;color:#755510;font-weight:800}}
  @media(max-width:680px){.ah-nav{height:64px;padding:0 16px}.ah-nav svg{width:160px}.ah-nav>span{display:none}.ah-nav>a:last-child{padding:9px 11px}.ah-shell main{padding:30px 14px 60px}.ah-hero{align-items:flex-start;flex-direction:column}.ah-rate{width:100%}.ah-filter{grid-template-columns:1fr 1fr;padding:14px}.ah-query,.ah-filter button{grid-column:1/-1}.ah-snapshot{padding:22px 18px}.ah-snapshot dl{grid-template-columns:1fr}.ah-snapshot dl div{border-left:0;border-top:1px solid #34373d;padding:12px 0}.ah-mobile{grid-template-columns:1fr;padding:0 12px 12px}.ah-results-head{padding:20px 16px}.ah-result-card>img{height:190px}}
`;
