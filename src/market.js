// Market intelligence for a make/model, computed from the historical `stats`
// table (sold auction results) on the same feed the matcher uses. Ported from
// the JDM Connect dealer portal's `market` endpoint.
//
// The vendor SQL gateway aliases unnamed aggregates as TAG0, TAG1, … in SELECT
// order; our parser (avtonet.parseRows) lowercases tag names, so we read
// tag0/tag1/…  Results are cached per isolate so a detail view doesn't re-run
// ~15 feed queries each time.

import { query, sqlString, sqlLike, sqlInt } from "./avtonet.js";
import { esc, yen } from "./render.js";
import { getLiveFx, carAudToLanded } from "./calc.js";

const WEEK_MS = 7 * 86400000;
const CACHE_TTL = 30 * 60 * 1000; // 30 min
const _cache = new Map(); // "MAKE|MODEL" -> { data, exp }

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

function gradeMix(rows) {
  const m = {};
  for (const r of rows) {
    const g = String(r.rate || "").trim() || "-";
    m[g] = (m[g] || 0) + 1;
  }
  return Object.keys(m)
    .map((g) => ({ grade: g, count: m[g] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

const RECENT_COLS = "marka_name,model_name,year,grade,rate,auction_date,finish,mileage,kuzov";

function mapRecent(r) {
  return {
    make: r.marka_name || "",
    model: r.model_name || "",
    year: r.year || "",
    grade: r.grade || "",
    rate: r.rate || "",
    date: r.auction_date || "",
    finish: sqlInt(r.finish) || 0,
    mileage: sqlInt(r.mileage) || 0,
    kuzov: r.kuzov || "",
  };
}

// Compute the market panel data. Returns null when make/model is missing or the
// feed is unreachable (caller just hides the panel). `nowMs` is injectable for
// deterministic tests.
export async function marketIntel(env, make, model, nowMs = Date.now(), opts = {}) {
  const mk = String(make || "").trim().toUpperCase();
  const md = String(model || "").trim().toUpperCase();
  if (!mk || !md) return null;

  // V1.3 Phase B: comparables must be genuinely similar. When the caller knows
  // the lot's model code (kuzov) the whole panel narrows to it; failing that a
  // grade (trim) keyword narrows instead; only then the bare model line. The
  // similarity level used is reported so the panel can say what it compared.
  const kz = String(opts.kuzov || "").trim().toUpperCase();
  const gr = String(opts.grade || "").trim().toUpperCase();

  const key = `${mk}|${md}|${kz}|${gr}`;
  const hit = _cache.get(key);
  if (hit && nowMs < hit.exp) return hit.data;

  try {
    const bare = `MARKA_NAME='${sqlString(mk)}' and MODEL_NAME='${sqlString(md)}' and FINISH>0`;
    const tries = [];
    if (kz) tries.push({ similarity: "model code " + kz, where: `${bare} and UPPER(KUZOV) LIKE '%${sqlLike(kz)}%'` });
    if (gr) tries.push({ similarity: "grade " + gr, where: `${bare} and UPPER(GRADE) LIKE '%${sqlLike(gr)}%'` });
    tries.push({ similarity: "", where: bare });
    let base = bare, similarity = "";
    for (const t of tries) {
      const probe = (await query(env, `select count(*) from stats where ${t.where}`))[0] || {};
      if (sqlInt(probe.tag0) > 0) { base = t.where; similarity = t.similarity; break; }
    }
    const aggSql = (w) => `select avg(FINISH),count(*),min(FINISH),max(FINISH) from stats where ${w}`;
    const cutoff = new Date(nowMs - 84 * 86400000).toISOString().slice(0, 10);

    // Prefer the last ~12 weeks; fall back to all-time for rare models.
    let where = `${base} and AUCTION_DATE >= '${cutoff}'`;
    let windowed = true;
    let a = (await query(env, aggSql(where)))[0] || {};
    if (!(sqlInt(a.tag1) > 0)) {
      windowed = false;
      where = base;
      a = (await query(env, aggSql(where)))[0] || {};
    }
    const count = sqlInt(a.tag1) || 0;
    if (!count) {
      const empty = { make: mk, model: md, count: 0 };
      _cache.set(key, { data: empty, exp: nowMs + CACHE_TTL });
      return empty;
    }

    // Raw recent sample (gateway caps ~250-300) for median + grade mix, the
    // 12-week trend (per-week aggregates, which are uncapped), and comparables -
    // all in parallel.
    const [raw, recent, bars] = await Promise.all([
      query(env, `select FINISH,RATE from stats where ${where} order by AUCTION_DATE desc limit 300`),
      query(env, `select ${RECENT_COLS} from stats where ${base} order by AUCTION_DATE desc limit 6`),
      Promise.all(
        Array.from({ length: 12 }, (_, idx) => {
          const i = 11 - idx; // idx 0 = oldest week
          const start = new Date(nowMs - (i + 1) * WEEK_MS).toISOString().slice(0, 10);
          const end = new Date(nowMs - i * WEEK_MS).toISOString().slice(0, 10);
          return query(env, `select avg(FINISH),count(*) from stats where ${base} and AUCTION_DATE >= '${start}' and AUCTION_DATE < '${end}'`)
            .then((rs) => { const r = rs[0] || {}; return { weeksAgo: i, avg: Math.round(parseFloat(r.tag0) || 0), count: sqlInt(r.tag1) || 0 }; })
            .catch(() => ({ weeksAgo: i, avg: 0, count: 0 }));
        })
      ),
    ]);

    const prices = raw.map((r) => sqlInt(r.finish)).filter((n) => n && n > 0);
    const data = {
      make: mk, model: md, windowed, count, similarity,
      avg: Math.round(parseFloat(a.tag0) || 0),
      median: median(prices),
      low: sqlInt(a.tag2) || 0,
      high: sqlInt(a.tag3) || 0,
      bars,
      gradeMix: gradeMix(raw),
      recent: recent.map(mapRecent),
    };
    _cache.set(key, { data, exp: nowMs + CACHE_TTL });
    return data;
  } catch (e) {
    console.error("marketIntel failed:", e.message);
    return hit ? hit.data : null; // serve stale on error if we have it
  }
}

const FULL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function monthLabel(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})/);
  return m ? `${FULL_MONTHS[Number(m[2]) - 1] || ""} ${m[1]}`.trim() : "";
}
function pct(nums, p) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * p)));
  return s[i];
}

const _snapCache = new Map(); // "MAKE|MODEL|yearW" -> { data, exp }

// A compact, customer-facing snapshot of the market for a make/model (optionally
// narrowed to a year range, which sharpens broad names like "Skyline"). Powers
// the onboarding Step 2 Market Snapshot AND the Step 1 "recent examples" cards.
// Self-contained (a few light queries, not the ~15 of marketIntel) and derived
// entirely from real sold history + live FX + the matcher's landed model, so
// nothing is invented. Returns { ok:false } when the model is too thin on data.
export async function marketSnapshot(env, make, model, yearMin, yearMax, nowMs = Date.now()) {
  const mk = String(make || "").trim().toUpperCase();
  const md = String(model || "").trim().toUpperCase();
  if (!mk || !md) return { ok: false };
  const yMin = parseInt(yearMin, 10), yMax = parseInt(yearMax, 10);
  const yearW = (Number.isFinite(yMin) && Number.isFinite(yMax) && yMin <= yMax) ? ` and YEAR>=${yMin} and YEAR<=${yMax}` : "";
  const key = `${mk}|${md}|${yearW}`;
  const hit = _snapCache.get(key);
  if (hit && nowMs < hit.exp) return hit.data;

  try {
    const base = `MARKA_NAME='${sqlString(mk)}' and MODEL_NAME='${sqlString(md)}' and FINISH>0${yearW}`;
    const aggSql = (w) => `select avg(FINISH),count(*),min(FINISH),max(FINISH) from stats where ${w}`;
    const cutoff = new Date(nowMs - 84 * 86400000).toISOString().slice(0, 10);
    let where = `${base} and AUCTION_DATE >= '${cutoff}'`, windowed = true;
    let a = (await query(env, aggSql(where)))[0] || {};
    if (!(sqlInt(a.tag1) > 0)) { windowed = false; where = base; a = (await query(env, aggSql(where)))[0] || {}; }
    const count = sqlInt(a.tag1) || 0;
    if (!count) { const empty = { ok: false }; _snapCache.set(key, { data: empty, exp: nowMs + CACHE_TTL }); return empty; }

    const [rawRows, recentRows] = await Promise.all([
      query(env, `select FINISH from stats where ${where} order by AUCTION_DATE desc limit 300`),
      query(env, `select ${RECENT_COLS} from stats where ${base} order by AUCTION_DATE desc limit 3`),
    ]);
    const prices = rawRows.map((r) => sqlInt(r.finish)).filter((n) => n > 0);
    const fx = await getLiveFx(env).catch(() => 0);
    const rate = fx > 0 ? fx : 95;
    const med = median(prices) || Math.round(parseFloat(a.tag0) || 0);
    const p25 = pct(prices, 0.25) || Math.round(med * 0.82);
    const p75 = pct(prices, 0.75) || Math.round(med * 1.25);
    const toLanded = (jpy) => carAudToLanded(Math.round(jpy / rate));
    const recent = recentRows.map((r) => ({
      year: r.year || "",
      make: mk, model: md,
      landed: toLanded(sqlInt(r.finish)),
    })).filter((x) => x.landed);

    const data = {
      ok: true, make: mk, model: md,
      typicalCarAud: Math.round(med / rate),
      landed: toLanded(med),
      landedLow: toLanded(p25),
      landedHigh: toLanded(p75),
      monthly: windowed ? Math.max(1, Math.round(count / 2.8)) : null,
      sample: count,
      windowed,
      lastLabel: recentRows[0] ? monthLabel(recentRows[0].auction_date) : "",
      recent,
    };
    _snapCache.set(key, { data, exp: nowMs + CACHE_TTL });
    return data;
  } catch (e) {
    console.error("marketSnapshot failed:", e.message);
    return hit ? hit.data : { ok: false };
  }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function shortDate(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] || ""}`.trim();
}

// JPY → "A$x,xxx" using the live FX rate (JPY per AUD).
function aud(jpy, fx) {
  if (!fx || fx <= 0 || !jpy) return "";
  return "A$" + Math.round(jpy / fx).toLocaleString("en-AU");
}

// Self-contained market panel (carries its own styles so it renders identically
// on the staff detail page and the client portal, which use different global
// stylesheets). Returns "" when there's nothing useful to show.
export function marketPanel(m, fx = 0) {
  if (!m || !m.count) return "";
  const maxBar = Math.max(1, ...m.bars.map((b) => b.avg));
  const trend = m.bars.map((b, i) => {
    const h = b.avg > 0 ? Math.max(8, Math.round((b.avg / maxBar) * 100)) : 4;
    const last = i === m.bars.length - 1;
    const title = b.count ? `${shortWeeks(b.weeksAgo)}: avg ${yen(b.avg)} (${b.count})` : `${shortWeeks(b.weeksAgo)}: no sales`;
    return `<span class="mktp-bar${last ? " on" : ""}${b.avg > 0 ? "" : " empty"}" style="height:${h}%" title="${esc(title)}" aria-hidden="true"></span>`;
  }).join("");
  const barAvgs = m.bars.map((b) => b.avg).filter((v) => v > 0);
  const trendLow = barAvgs.length ? Math.min(...barAvgs) : 0;
  const trendHigh = barAvgs.length ? Math.max(...barAvgs) : 0;
  const trendLabel = `Price trend over the last ${m.bars.length} weeks, low ${yen(trendLow)} to high ${yen(trendHigh)}`;
  const mix = (m.gradeMix || []).map((g) => `<span class="mktp-chip"><b>${esc(g.grade)}</b> ${g.count}</span>`).join("");
  // V1.3 Phase B: each comparable row carries make, model, the auction score
  // (rate, full string), the variant grade (trim), mileage and auction date.
  const comps = (m.recent || []).map((r) => `<div class="mktp-comp">
      <div class="mktp-comp-l"><span class="mktp-comp-t">${esc(displayName(r.make))} ${esc(displayName(r.model))} &middot; ${esc(r.year)}</span><span class="mktp-comp-s">${[
        r.rate ? "Score " + esc(r.rate) : "",
        r.grade ? esc(r.grade) : "",
        r.kuzov ? esc(r.kuzov) : "",
        r.mileage ? Number(r.mileage).toLocaleString("en-US") + " km" : "",
        shortDate(r.date),
      ].filter(Boolean).join(" &middot; ")}</span></div>
      <div class="mktp-comp-r"><span class="mktp-comp-k">SOLD</span><span class="mktp-comp-v">${yen(r.finish)}</span></div>
    </div>`).join("");
  const audAvg = aud(m.avg, fx);
  return `<div class="card mktp">
    <div class="mktp-head"><span class="mktp-kick">Market &middot; ${m.windowed ? "last 12 weeks" : "all time"}${m.similarity ? " &middot; " + esc(m.similarity) : ""}</span><span class="mktp-n">${m.count.toLocaleString("en-AU")} sold</span></div>
    <div class="mktp-top">
      <div class="mktp-stat lead"><div class="mktp-k">Avg sold</div><div class="mktp-v">${yen(m.avg)}</div>${audAvg ? `<div class="mktp-sub">≈ ${esc(audAvg)}</div>` : ""}</div>
      <div class="mktp-stat"><div class="mktp-k">Median</div><div class="mktp-v">${yen(m.median)}</div></div>
      <div class="mktp-stat"><div class="mktp-k">Range</div><div class="mktp-v sm">${yen(m.low)} - ${yen(m.high)}</div></div>
      ${m.bars.some((b) => b.avg > 0) ? `<div class="mktp-trend"><div class="mktp-k">Price trend</div><div class="mktp-bars" role="img" aria-label="${esc(trendLabel)}">${trend}</div></div>` : ""}
    </div>
    ${mix ? `<div class="mktp-mix"><span class="mktp-k">Grade mix</span>${mix}</div>` : ""}
    ${comps ? `<div class="mktp-comps"><div class="mktp-k" style="margin-bottom:6px">Recent comparable sales${m.similarity ? " (" + esc(m.similarity) + ")" : ""}</div>${comps}</div>` : ""}
    ${MKT_CSS}
  </div>`;
}

function shortWeeks(w) {
  return w === 0 ? "this week" : w === 1 ? "1 week ago" : `${w} weeks ago`;
}

// Tidy a SHOUTY feed name to Title Case for display (e.g. "LAND CRUISER").
function displayName(s) {
  return String(s || "").toLowerCase().replace(/\b[a-z]/g, (ch) => ch.toUpperCase());
}

const MKT_CSS = `<style>
  .mktp{padding:22px 24px}
  .mktp-head{display:flex;align-items:baseline;justify-content:space-between;border-bottom:1px solid rgba(0,0,0,.10);padding-bottom:12px;margin-bottom:16px}
  .mktp-kick{font-size:11px;font-weight:700;letter-spacing:.10em;text-transform:uppercase;color:#6b7079}
  .mktp-n{font-size:12px;color:#6b7079}
  .mktp-top{display:flex;flex-wrap:wrap;align-items:flex-end;gap:26px 34px}
  .mktp-k{font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6e727b;margin-bottom:5px}
  .mktp-v{font-size:18px;font-weight:700;color:#1b1c1e;line-height:1;font-variant-numeric:tabular-nums}
  .mktp-v.sm{font-size:13.5px;font-weight:600}
  .mktp-stat.lead .mktp-v{font-size:26px}
  .mktp-sub{font-size:11.5px;color:#7A5E1C;margin-top:4px;font-weight:600;font-variant-numeric:tabular-nums}
  .mktp-trend{margin-left:auto}
  .mktp-bars{display:flex;align-items:flex-end;gap:3px;height:46px}
  .mktp-bar{width:9px;background:#e7e3d6;border-radius:2px 2px 0 0;transition:background .15s}
  .mktp-bar.empty{background:rgba(0,0,0,.06)}
  .mktp-bar.on{background:#CAA34C}
  .mktp-mix{display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin-top:18px;padding-top:16px;border-top:1px solid rgba(0,0,0,.06)}
  .mktp-chip{font-size:11.5px;color:#5b606a;background:#f4f3ef;border:1px solid rgba(0,0,0,.07);border-radius:999px;padding:3px 10px}
  .mktp-chip b{color:#1b1c1e;font-weight:700}
  .mktp-comps{margin-top:18px;padding-top:16px;border-top:1px solid rgba(0,0,0,.06)}
  .mktp-comp{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:9px 0;border-bottom:1px solid rgba(0,0,0,.05)}
  .mktp-comp:last-child{border-bottom:0}
  .mktp-comp-l{min-width:0}
  .mktp-comp-t{display:block;font-size:13px;font-weight:700;color:#1b1c1e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .mktp-comp-s{display:block;font-size:11.5px;color:#6e727b;margin-top:2px}
  .mktp-comp-r{text-align:right;white-space:nowrap}
  .mktp-comp-k{display:block;font-size:9.5px;font-weight:700;letter-spacing:.08em;color:#6e727b}
  .mktp-comp-v{display:block;font-size:14px;font-weight:700;color:#1b1c1e;font-variant-numeric:tabular-nums}
</style>`;
