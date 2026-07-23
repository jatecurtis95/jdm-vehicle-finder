// Shared auction filter engine (Phase 1): validated filters over BOTH relay
// tables - the historical `stats` table (sold auction results) and the live
// `main` table (upcoming lots). One validator and one WHERE builder, so the
// Live Auctions and Auction History tabs filter identically.
//
// Every public value is validated/coerced here before it can reach SQL, and
// every query is filtered + LIMITed per the provider rules (never mirror the
// table, never ship the dataset to the browser). See docs/auction-history.md
// for the full filter -> column mapping and its caveats.

import { query, sqlLike, sqlInt } from "./avtonet.js";

export const HISTORY_PER_PAGE = 24;
// Bounds the relay's OFFSET scan; nobody browses 200 pages of comparables.
export const HISTORY_MAX_PAGE = 200;

// Auction-date shortcuts (history only; live lots are upcoming by
// definition). Ordered; label renders on the pill and the chip.
export const HISTORY_RANGES = {
  "4w": { days: 28, label: "4 weeks" },
  "6w": { days: 42, label: "6 weeks" },
  "3m": { days: 92, label: "3 months" },
  "6m": { days: 183, label: "6 months" },
  "12m": { days: 366, label: "12 months" },
};

// Gearbox (`kpp`) token groups. The feed lists gearboxes the way the auction
// house wrote them (FA, F5, AT, 5MT, CVT...), so the UI-level choices map to
// token sets. Tunable in one place after live QA.
export const KPP_GROUPS = {
  manual: { like: ["MT"], exact: ["F3", "F4", "F5", "F6", "F7", "C4", "C5"], label: "Manual" },
  automatic: { like: ["AT"], exact: ["FA", "CA", "A"], label: "Automatic" },
  cvt: { like: ["CVT"], exact: [], label: "CVT" },
};

// Drivetrain (`priv`) tokens that mean four-wheel drive; everything else
// (including an empty field) is treated as 2WD.
export const PRIV_4WD_TOKENS = ["4WD", "AWD", "4X4"];

// Fuel keywords matched against the variant/trim string (`grade`). The feed
// has no structured fuel column, so these are best-effort and labelled as
// "(as listed)" in the UI. Petrol = none of the listed fuel keywords.
export const FUEL_KEYWORDS = {
  diesel: { tokens: ["DIESEL"], label: "Diesel (listed)" },
  hybrid: { tokens: ["HYBRID", "E-POWER", "PHV"], label: "Hybrid (listed)" },
  electric: { tokens: ["ELECTRIC", "BEV"], label: "Electric (listed)" },
  petrol: { tokens: [], label: "Petrol" },
};
const FUEL_ALL_TOKENS = [...FUEL_KEYWORDS.diesel.tokens, ...FUEL_KEYWORDS.hybrid.tokens, ...FUEL_KEYWORDS.electric.tokens];

// Body-type keywords matched against model + variant text - the feed has no
// structured body column either. Same best-effort caveat as fuel.
export const BODY_KEYWORDS = {
  coupe: { tokens: ["COUPE"], label: "Coupe" },
  sedan: { tokens: ["SEDAN", "SALOON"], label: "Sedan" },
  hatch: { tokens: ["HATCH"], label: "Hatchback" },
  wagon: { tokens: ["WAGON", "TOURING", "ESTATE"], label: "Wagon" },
  van: { tokens: ["VAN"], label: "Van" },
  suv: { tokens: ["SUV", "CROSS"], label: "SUV / crossover" },
  truck: { tokens: ["TRUCK"], label: "Truck / ute" },
  convertible: { tokens: ["CONVERTIBLE", "CABRIOLET", "ROADSTER"], label: "Convertible" },
};

// Colour options: common feed colour words, LIKE-matched so "CHAMPIONSHIP
// WHITE" answers to "White". Grey listings appear under both spellings.
export const HISTORY_COLOURS = {
  white: { tokens: ["WHITE"], label: "White" },
  pearl: { tokens: ["PEARL"], label: "Pearl" },
  black: { tokens: ["BLACK"], label: "Black" },
  silver: { tokens: ["SILVER"], label: "Silver" },
  grey: { tokens: ["GREY", "GRAY"], label: "Grey" },
  blue: { tokens: ["BLUE"], label: "Blue" },
  red: { tokens: ["RED"], label: "Red" },
  green: { tokens: ["GREEN"], label: "Green" },
  yellow: { tokens: ["YELLOW"], label: "Yellow" },
  gold: { tokens: ["GOLD"], label: "Gold" },
  orange: { tokens: ["ORANGE"], label: "Orange" },
  brown: { tokens: ["BROWN"], label: "Brown" },
  purple: { tokens: ["PURPLE"], label: "Purple" },
  beige: { tokens: ["BEIGE"], label: "Beige" },
  pink: { tokens: ["PINK"], label: "Pink" },
};

// Auction grade (`rate`) pills, multi-selectable on both tabs. Key = URL
// token; `match` = the exact feed spellings that pill answers for, compared
// with UPPER(rate) IN (...). RA2 folds under the RA pill: it is an RA-family
// grade (repair history with a condition qualifier), and because matching is
// by exact string an unmapped RA2 lot would match neither RA nor 2 and vanish
// silently (audit decision). Extend the match lists from what
// scripts/check-feed-grades.mjs reports - never from guesswork.
export const HISTORY_RATES = {
  r: { label: "R", match: ["R"] },
  ra: { label: "RA", match: ["RA", "RA2"] },
  "1": { label: "1", match: ["1"] },
  "2": { label: "2", match: ["2"] },
  "3": { label: "3", match: ["3"] },
  "3.5": { label: "3.5", match: ["3.5"] },
  "4": { label: "4", match: ["4"] },
  "4.5": { label: "4.5", match: ["4.5"] },
  "5": { label: "5", match: ["5"] },
  "6": { label: "6", match: ["6"] },
  s: { label: "S", match: ["S"] },
};
// Canonical order for stored/URL/SQL/chip sequencing: letter grades first,
// then ascending numerics. Kept stable (audit-derived) so bookmarks, query
// strings and active-filter chips do not churn. Grade 1 added per the Task 2
// spec. The VISIBLE pill order is separate; see RATE_PILL_ORDER. Explicit
// array because integer-like object keys enumerate before string keys.
export const RATE_ORDER = ["r", "ra", "1", "2", "3", "3.5", "4", "4.5", "5", "6", "s"];

// Visible auction-grade pill order (Task 2 spec): S, 6, 5, 4.5, 4, 3.5, 3, 2,
// 1, R, RA. High-to-low then repair grades. RA2 folds under the RA pill. This
// affects display order only; canonical sequencing stays RATE_ORDER.
export const RATE_PILL_ORDER = ["s", "6", "5", "4.5", "4", "3.5", "3", "2", "1", "r", "ra"];

// Sort whitelists -> ORDER BY. Anything else falls back to the default.
export const HISTORY_SORTS = {
  newest: { orderBy: "auction_date DESC", label: "Newest" },
  price_asc: { orderBy: "finish ASC", label: "Price: low to high" },
  price_desc: { orderBy: "finish DESC", label: "Price: high to low" },
  mileage_asc: { orderBy: "mileage ASC", label: "Lowest mileage" },
  year_desc: { orderBy: "year DESC, auction_date DESC", label: "Newest build year" },
};
// Live lots sort by closing time by default, mirroring the Matches view.
export const LIVE_SORTS = {
  closing: { orderBy: "auction_date ASC", label: "Closing soonest" },
  price_asc: { orderBy: "start ASC", label: "Start price: low to high" },
  price_desc: { orderBy: "start DESC", label: "Start price: high to low" },
  mileage_asc: { orderBy: "mileage ASC", label: "Lowest mileage" },
  year_desc: { orderBy: "year DESC, auction_date ASC", label: "Newest build year" },
};

// "Eligible" means 26+ calendar years old: at exactly 25 years the build
// month decides, so the boundary year is never asserted (launch-audit rule,
// mirrors auctionEligibility in auction-ui.js).
export const ELIGIBLE_MIN_AGE_YEARS = 26;

const ENGINE_CC_MAX = 20000;
const MILEAGE_MAX_CAP = 1000000;
const YEAR_MIN_CAP = 1950;
const YEAR_MAX_CAP = 2100;
const PRICE_JPY_CAP = 999999999;
const HOUSES_MAX = 15;

// `rates` arrives as one comma-separated value (our URLs) or a repeated-param
// array (native checkbox submits, joined by the routes). Unknown scores drop;
// the result is deduped in the canonical RATE_ORDER.
function normalizeRates(raw) {
  const picked = (Array.isArray(raw) ? raw : String(raw ?? "").split(","))
    .map((v) => String(v).trim().toLowerCase());
  return RATE_ORDER.filter((k) => picked.includes(k)).join(",");
}

// Live legacy: old bookmarks carry `gradeMin=N` from the retired number
// input. The feed compared `rate >= N` numerically (letter grades coerce to
// 0 in MySQL and dropped out), so the faithful mapping is every numeric pill
// at or above the floor.
function ratesFromGradeMin(raw) {
  const g = Number.parseFloat(String(raw ?? ""));
  if (!Number.isFinite(g)) return "";
  return RATE_ORDER.filter((k) => {
    const n = Number.parseFloat(k);
    return Number.isFinite(n) && n >= g;
  }).join(",");
}

// `houses` arrives as a comma list (our URLs) or a repeated-param array
// (native checkbox submits); the legacy single `house` param merges in so old
// bookmarks keep working. Deduped case-insensitively, capped, comma-joined.
function normalizeHouses(raw, legacy) {
  const all = [
    ...(Array.isArray(raw) ? raw : String(raw ?? "").split(",")),
    ...(Array.isArray(legacy) ? legacy : String(legacy ?? "").split(",")),
  ];
  const seen = new Set();
  const out = [];
  for (const v of all) {
    const s = String(v).trim().slice(0, 40);
    if (!s) continue;
    const k = s.toUpperCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
    if (out.length >= HOUSES_MAX) break;
  }
  return out.join(",");
}

// The include-unspecified toggle (default ON): lots whose colour / drivetrain
// / fuel source field is blank stay in the results instead of silently
// dropping out of an inference filter. The form submits a hidden "0" plus a
// ticked "1", so: absent entirely = default ON, "1" present = ON, only "0" =
// OFF (the user unticked it).
function normalizeUnspec(raw) {
  const vals = (Array.isArray(raw) ? raw : [raw])
    .map((v) => String(v ?? "").trim()).filter((v) => v !== "");
  if (!vals.length) return true;
  return vals.includes("1");
}

// Coerce one raw query-string bag into a fully validated filter object. Every
// key is whitelisted or bounds-checked; anything unrecognised is dropped, so
// nothing user-controlled reaches SQL un-coerced. `mode` picks the sort
// whitelist and the live-only legacy mappings.
export function validateAuctionParams(raw = {}, mode = "history") {
  const live = mode === "live";
  const str = (v, max) => String(v ?? "").trim().slice(0, max);
  const pick = (v, table) => {
    const k = String(v ?? "").trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(table, k) ? k : "";
  };
  const bounded = (v, lo, hi) => {
    const n = sqlInt(v);
    return n !== null && n >= lo && n <= hi ? n : null;
  };
  // Range pairs share one rule: both ends bounded, swapped when inverted.
  const range2 = (loRaw, hiRaw, lo, hi) => {
    let a = bounded(loRaw, lo, hi);
    let b = bounded(hiRaw, lo, hi);
    if (a !== null && b !== null && a > b) [a, b] = [b, a];
    return [a, b];
  };
  const [engineMin, engineMax] = range2(raw.engineMin, raw.engineMax, 1, ENGINE_CC_MAX);
  const [yearMin, yearMax] = range2(raw.yearMin, raw.yearMax, YEAR_MIN_CAP, YEAR_MAX_CAP);
  const [mileageMin, mileageMax] = range2(raw.mileageMin, raw.mileageMax, 1, MILEAGE_MAX_CAP);
  const [priceMin, priceMax] = range2(raw.priceMin, raw.priceMax, 1, PRICE_JPY_CAP);
  const pageRaw = sqlInt(raw.page);
  let rates = normalizeRates(raw.rates);
  if (live && !rates) rates = ratesFromGradeMin(raw.gradeMin);
  const sorts = live ? LIVE_SORTS : HISTORY_SORTS;
  return {
    mode: live ? "live" : "history",
    make: str(raw.make, 40),
    model: str(raw.model, 60),
    houses: normalizeHouses(raw.houses, raw.house),
    // Upper-cased so it compares cleanly against distinctModelCodes() output
    // (always upper) in the form's select and chip labels.
    kuzov: str(raw.kuzov, 20).toUpperCase(),
    variant: str(raw.variant, 60),
    rates,
    yearMin,
    yearMax,
    mileageMin,
    priceMin,
    priceMax,
    range: live ? "" : pick(raw.range, HISTORY_RANGES),
    transmission: pick(raw.transmission, KPP_GROUPS),
    drivetrain: ["4wd", "2wd"].includes(String(raw.drivetrain ?? "").trim().toLowerCase())
      ? String(raw.drivetrain).trim().toLowerCase() : "",
    body: pick(raw.body, BODY_KEYWORDS),
    fuel: pick(raw.fuel, FUEL_KEYWORDS),
    colour: pick(raw.colour, HISTORY_COLOURS),
    eligibility: String(raw.eligibility ?? "").trim().toLowerCase() === "eligible" ? "eligible" : "",
    unspec: normalizeUnspec(raw.unspec),
    mileageMax,
    engineMin,
    engineMax,
    sort: pick(raw.sort, sorts) || (live ? "closing" : "newest"),
    page: pageRaw !== null ? Math.min(HISTORY_MAX_PAGE, Math.max(1, pageRaw)) : 1,
  };
}

export function validateHistoryParams(raw = {}) {
  return validateAuctionParams(raw, "history");
}
export function validateLiveParams(raw = {}) {
  return validateAuctionParams(raw, "live");
}

// The selected houses as an array, for the form and the chips.
export function houseList(p) {
  return p.houses ? p.houses.split(",") : [];
}

const likeAny = (column, tokens) =>
  tokens.map((t) => `UPPER(${column}) LIKE '%${sqlLike(t).toUpperCase()}%'`);
const notLikeAll = (column, tokens) =>
  tokens.map((t) => `UPPER(${column}) NOT LIKE '%${sqlLike(t).toUpperCase()}%'`);
// Wrap an inference clause so blank source fields stay included while the
// include-unspecified toggle is on.
const orBlank = (column, clause) => `(${column} IS NULL OR ${column} = '' OR ${clause})`;

function kppClause(key) {
  const g = KPP_GROUPS[key];
  const parts = likeAny("kpp", g.like);
  if (g.exact.length) {
    parts.push(`UPPER(kpp) IN (${g.exact.map((t) => `'${t}'`).join(", ")})`);
  }
  return `(${parts.join(" OR ")})`;
}

function privClause(key, unspec) {
  if (key === "4wd") {
    const positive = `(${likeAny("priv", PRIV_4WD_TOKENS).join(" OR ")})`;
    return unspec ? orBlank("priv", positive) : positive;
  }
  const not4wd = `(${notLikeAll("priv", PRIV_4WD_TOKENS).join(" AND ")})`;
  return unspec ? orBlank("priv", not4wd) : `(priv <> '' AND ${not4wd})`;
}

function fuelClause(key, unspec) {
  if (key === "petrol") {
    const none = `(${notLikeAll("grade", FUEL_ALL_TOKENS).join(" AND ")})`;
    return unspec ? orBlank("grade", none) : `(grade <> '' AND ${none})`;
  }
  const positive = `(${likeAny("grade", FUEL_KEYWORDS[key].tokens).join(" OR ")})`;
  return unspec ? orBlank("grade", positive) : positive;
}

// Body stays positive-match only: there is no structured body column, so a
// lot without the keyword is indistinguishable from a different body type -
// an "unspecified" wrapper here would admit nearly everything.
function bodyClause(key) {
  const tokens = BODY_KEYWORDS[key].tokens;
  return `(${[...likeAny("model_name", tokens), ...likeAny("grade", tokens)].join(" OR ")})`;
}

// WHERE clauses for a validated filter object, against `stats` (history mode)
// or `main` (live mode). Exported for the SQL tests. `nowMs` is injectable so
// date-derived clauses are deterministic under test.
export function buildAuctionWhere(p, nowMs = Date.now()) {
  const live = p.mode === "live";
  // History: sold results only (finish is the hammer price). Live: upcoming
  // lots only, and never LHD - AU imports must be right-hand drive (RHD rows
  // carry '0' or an empty field, both pass; mirrors searchLots/buildSql).
  const where = live
    ? ["auction_date >= NOW()", "(lhdrive IS NULL OR lhdrive <> 1)"]
    : ["finish > 0"];
  if (p.make) {
    const mk = sqlLike(p.make).toUpperCase().split(/[\s-]+/).filter(Boolean)[0];
    if (mk) where.push(`UPPER(marka_name) LIKE '%${mk}%'`);
  }
  if (p.model) where.push(`UPPER(model_name) LIKE '%${sqlLike(p.model).toUpperCase()}%'`);
  if (p.kuzov) where.push(`UPPER(kuzov) LIKE '%${sqlLike(p.kuzov).toUpperCase()}%'`);
  if (p.variant) where.push(`UPPER(grade) LIKE '%${sqlLike(p.variant).toUpperCase()}%'`);
  if (p.rates) {
    const spellings = p.rates.split(",").flatMap((k) => HISTORY_RATES[k].match);
    where.push(`UPPER(rate) IN (${spellings.map((s) => `'${s}'`).join(", ")})`);
  }
  if (p.yearMin !== null) where.push(`year >= ${p.yearMin}`);
  // Feed encodes an unknown build year as 0; a ceiling must not sweep those in.
  if (p.yearMax !== null) where.push(`(year > 0 AND year <= ${p.yearMax})`);
  // Live prices are start prices, and POA lots (start <= 0) always stay in: a
  // missing start price is unknown, not zero (mirrors the old live search).
  if (p.priceMin !== null) where.push(live ? `((start > 0 AND start >= ${p.priceMin}) OR start <= 0)` : `finish >= ${p.priceMin}`);
  if (p.priceMax !== null) where.push(live ? `((start > 0 AND start <= ${p.priceMax}) OR start <= 0)` : `finish <= ${p.priceMax}`);
  if (p.mileageMin !== null) where.push(`mileage >= ${p.mileageMin}`);
  if (p.range) {
    const cutoff = new Date(nowMs - HISTORY_RANGES[p.range].days * 86400000).toISOString().slice(0, 10);
    where.push(`auction_date >= '${cutoff}'`);
  }
  if (p.transmission) where.push(kppClause(p.transmission));
  if (p.drivetrain) where.push(privClause(p.drivetrain, p.unspec));
  // Feed encodes an unknown odometer as 0; those rows only drop out while a
  // mileage ceiling (or the mileage sort, below) makes them meaningless.
  if (p.mileageMax !== null) where.push(`(mileage > 0 AND mileage <= ${p.mileageMax})`);
  else if (p.sort === "mileage_asc") where.push("mileage > 0");
  // A start-price sort is meaningless over POA rows, same rule as mileage.
  if (live && (p.sort === "price_asc" || p.sort === "price_desc")) where.push("start > 0");
  if (p.engineMin !== null) where.push(`eng_v >= ${p.engineMin}`);
  if (p.engineMax !== null) where.push(`eng_v <= ${p.engineMax}`);
  if (p.houses) {
    const likes = houseList(p).map((h) => `UPPER(auction) LIKE '%${sqlLike(h).toUpperCase()}%'`);
    where.push(likes.length === 1 ? likes[0] : `(${likes.join(" OR ")})`);
  }
  if (p.body) where.push(bodyClause(p.body));
  if (p.fuel) where.push(fuelClause(p.fuel, p.unspec));
  if (p.colour) {
    const positive = `(${likeAny("color", HISTORY_COLOURS[p.colour].tokens).join(" OR ")})`;
    where.push(p.unspec ? orBlank("color", positive) : positive);
  }
  if (p.eligibility === "eligible") {
    const maxYear = new Date(nowMs).getUTCFullYear() - ELIGIBLE_MIN_AGE_YEARS;
    where.push(`(year > 1950 AND year <= ${maxYear})`);
  }
  return where;
}

// Kept for the SQL tests and any history-only callers.
export function buildHistoryWhere(p, nowMs = Date.now()) {
  return buildAuctionWhere({ ...p, mode: "history" }, nowMs);
}

// Run one search against `stats` (history) or `main` (live): a real COUNT(*)
// for the result total plus the page of rows. Returns:
//   { lots, total, page, perPage, pageCount, hasMore, ok }
// total/pageCount are null when the count query fails (the pager falls back
// to prev/next); ok:false marks a relay outage so the page renders the error
// state instead of a misleading "0 results".
async function runSearch(env, p, table, sorts, fallbackSort, nowMs) {
  const where = buildAuctionWhere(p, nowMs).join(" AND ");
  const orderBy = sorts[p.sort]?.orderBy || sorts[fallbackSort].orderBy;
  const offset = (p.page - 1) * HISTORY_PER_PAGE;
  let lots = [], ok = true, total = null;
  try {
    const [countRows, rows] = await Promise.all([
      // Count failure alone must not take the page down - it only costs the
      // numbered pager. The gateway aliases unnamed aggregates as tag0.
      query(env, `select count(*) from ${table} where ${where}`).catch(() => null),
      query(env, `select * from ${table} where ${where} order by ${orderBy} limit ${offset}, ${HISTORY_PER_PAGE}`),
    ]);
    lots = rows;
    const n = countRows && countRows[0] ? sqlInt(countRows[0].tag0) : null;
    if (n !== null && n >= 0) total = n;
  } catch (e) {
    ok = false;
    console.error(`search ${table} failed:`, e.message);
  }
  const pageCount = total !== null ? Math.max(1, Math.ceil(total / HISTORY_PER_PAGE)) : null;
  return {
    lots,
    total,
    page: p.page,
    perPage: HISTORY_PER_PAGE,
    pageCount,
    hasMore: pageCount !== null ? p.page < pageCount : lots.length === HISTORY_PER_PAGE,
    ok,
  };
}

export async function searchHistory(env, p, nowMs = Date.now()) {
  return runSearch(env, { ...p, mode: "history" }, "stats", HISTORY_SORTS, "newest", nowMs);
}

export async function searchLive(env, p, nowMs = Date.now()) {
  return runSearch(env, { ...p, mode: "live" }, "main", LIVE_SORTS, "closing", nowMs);
}
