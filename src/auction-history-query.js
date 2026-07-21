// Auction History query layer: validated filters over the historical `stats`
// table (sold auction results) on the AVTONET relay.
//
// Every public value is validated/coerced here before it can reach SQL, and
// every query is filtered + LIMITed per the provider rules (never mirror the
// table, never ship the dataset to the browser). See docs/auction-history.md
// for the full filter -> column mapping and its caveats.

import { query, sqlLike, sqlInt } from "./avtonet.js";

export const HISTORY_PER_PAGE = 24;
// Bounds the relay's OFFSET scan; nobody browses 200 pages of comparables.
export const HISTORY_MAX_PAGE = 200;

// Auction-date shortcuts. Ordered; label renders on the pill and the chip.
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
// "(listed)" in the UI. Petrol = none of the listed fuel keywords.
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

// Auction grade (`rate`) scores, multi-selectable. Key = URL token, value =
// the exact feed spelling matched with UPPER(rate) IN (...). Ordered; the
// order is canonical for the `rates` param and the pill row.
export const HISTORY_RATES = {
  "3": "3",
  "3.5": "3.5",
  "4": "4",
  "4.5": "4.5",
  "5": "5",
  r: "R",
  ra: "RA",
};

// Sort whitelist -> ORDER BY. Anything else falls back to `newest`.
export const HISTORY_SORTS = {
  newest: { orderBy: "auction_date DESC", label: "Newest" },
  price_asc: { orderBy: "finish ASC", label: "Price: low to high" },
  price_desc: { orderBy: "finish DESC", label: "Price: high to low" },
  mileage_asc: { orderBy: "mileage ASC", label: "Lowest mileage" },
  year_desc: { orderBy: "year DESC, auction_date DESC", label: "Newest build year" },
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

// `rates` arrives as one comma-separated value (our URLs) or a repeated-param
// array (native checkbox submits, joined by the routes). Unknown scores drop;
// the result is deduped in the canonical HISTORY_RATES order.
function normalizeRates(raw) {
  const picked = (Array.isArray(raw) ? raw : String(raw ?? "").split(","))
    .map((v) => String(v).trim().toLowerCase());
  return Object.keys(HISTORY_RATES).filter((k) => picked.includes(k)).join(",");
}

// Coerce one raw query-string bag into a fully validated filter object. Every
// key is whitelisted or bounds-checked; anything unrecognised is dropped, so
// nothing user-controlled reaches SQL un-coerced.
export function validateHistoryParams(raw = {}) {
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
  return {
    make: str(raw.make, 40),
    model: str(raw.model, 60),
    house: str(raw.house, 40),
    // Upper-cased so it compares cleanly against distinctModelCodes() output
    // (always upper) in the form's select and chip labels.
    kuzov: str(raw.kuzov, 20).toUpperCase(),
    variant: str(raw.variant, 60),
    rates: normalizeRates(raw.rates),
    yearMin,
    yearMax,
    mileageMin,
    priceMin,
    priceMax,
    range: pick(raw.range, HISTORY_RANGES),
    transmission: pick(raw.transmission, KPP_GROUPS),
    drivetrain: ["4wd", "2wd"].includes(String(raw.drivetrain ?? "").trim().toLowerCase())
      ? String(raw.drivetrain).trim().toLowerCase() : "",
    body: pick(raw.body, BODY_KEYWORDS),
    fuel: pick(raw.fuel, FUEL_KEYWORDS),
    colour: pick(raw.colour, HISTORY_COLOURS),
    eligibility: String(raw.eligibility ?? "").trim().toLowerCase() === "eligible" ? "eligible" : "",
    mileageMax,
    engineMin,
    engineMax,
    sort: pick(raw.sort, HISTORY_SORTS) || "newest",
    page: pageRaw !== null ? Math.min(HISTORY_MAX_PAGE, Math.max(1, pageRaw)) : 1,
  };
}

const likeAny = (column, tokens) =>
  tokens.map((t) => `UPPER(${column}) LIKE '%${sqlLike(t).toUpperCase()}%'`);
const notLikeAll = (column, tokens) =>
  tokens.map((t) => `UPPER(${column}) NOT LIKE '%${sqlLike(t).toUpperCase()}%'`);

function kppClause(key) {
  const g = KPP_GROUPS[key];
  const parts = likeAny("kpp", g.like);
  if (g.exact.length) {
    parts.push(`UPPER(kpp) IN (${g.exact.map((t) => `'${t}'`).join(", ")})`);
  }
  return `(${parts.join(" OR ")})`;
}

function privClause(key) {
  if (key === "4wd") return `(${likeAny("priv", PRIV_4WD_TOKENS).join(" OR ")})`;
  return `(priv IS NULL OR priv = '' OR (${notLikeAll("priv", PRIV_4WD_TOKENS).join(" AND ")}))`;
}

function fuelClause(key) {
  if (key === "petrol") return `(${notLikeAll("grade", FUEL_ALL_TOKENS).join(" AND ")})`;
  return `(${likeAny("grade", FUEL_KEYWORDS[key].tokens).join(" OR ")})`;
}

function bodyClause(key) {
  const tokens = BODY_KEYWORDS[key].tokens;
  return `(${[...likeAny("model_name", tokens), ...likeAny("grade", tokens)].join(" OR ")})`;
}

// WHERE clauses for a validated filter object. Exported for the SQL tests.
// `nowMs` is injectable so date-derived clauses are deterministic under test.
export function buildHistoryWhere(p, nowMs = Date.now()) {
  const where = ["finish > 0"]; // sold results only: finish is the hammer price
  if (p.make) {
    const mk = sqlLike(p.make).toUpperCase().split(/[\s-]+/).filter(Boolean)[0];
    if (mk) where.push(`UPPER(marka_name) LIKE '%${mk}%'`);
  }
  if (p.model) where.push(`UPPER(model_name) LIKE '%${sqlLike(p.model).toUpperCase()}%'`);
  if (p.kuzov) where.push(`UPPER(kuzov) LIKE '%${sqlLike(p.kuzov).toUpperCase()}%'`);
  if (p.variant) where.push(`UPPER(grade) LIKE '%${sqlLike(p.variant).toUpperCase()}%'`);
  if (p.rates) {
    const tokens = p.rates.split(",").map((k) => `'${HISTORY_RATES[k]}'`);
    where.push(`UPPER(rate) IN (${tokens.join(", ")})`);
  }
  if (p.yearMin !== null) where.push(`year >= ${p.yearMin}`);
  // Feed encodes an unknown build year as 0; a ceiling must not sweep those in.
  if (p.yearMax !== null) where.push(`(year > 0 AND year <= ${p.yearMax})`);
  if (p.priceMin !== null) where.push(`finish >= ${p.priceMin}`);
  if (p.priceMax !== null) where.push(`finish <= ${p.priceMax}`);
  if (p.mileageMin !== null) where.push(`mileage >= ${p.mileageMin}`);
  if (p.range) {
    const cutoff = new Date(nowMs - HISTORY_RANGES[p.range].days * 86400000).toISOString().slice(0, 10);
    where.push(`auction_date >= '${cutoff}'`);
  }
  if (p.transmission) where.push(kppClause(p.transmission));
  if (p.drivetrain) where.push(privClause(p.drivetrain));
  // Feed encodes an unknown odometer as 0; those rows only drop out while a
  // mileage ceiling (or the mileage sort, below) makes them meaningless.
  if (p.mileageMax !== null) where.push(`(mileage > 0 AND mileage <= ${p.mileageMax})`);
  else if (p.sort === "mileage_asc") where.push("mileage > 0");
  if (p.engineMin !== null) where.push(`eng_v >= ${p.engineMin}`);
  if (p.engineMax !== null) where.push(`eng_v <= ${p.engineMax}`);
  if (p.house) where.push(`UPPER(auction) LIKE '%${sqlLike(p.house).toUpperCase()}%'`);
  if (p.body) where.push(bodyClause(p.body));
  if (p.fuel) where.push(fuelClause(p.fuel));
  if (p.colour) where.push(`(${likeAny("color", HISTORY_COLOURS[p.colour].tokens).join(" OR ")})`);
  if (p.eligibility === "eligible") {
    const maxYear = new Date(nowMs).getUTCFullYear() - ELIGIBLE_MIN_AGE_YEARS;
    where.push(`(year > 1950 AND year <= ${maxYear})`);
  }
  return where;
}

// Run one Auction History search: a real COUNT(*) for the result total plus
// the page of rows. Returns:
//   { lots, total, page, perPage, pageCount, hasMore, ok }
// total/pageCount are null when the count query fails (the pager falls back
// to prev/next); ok:false marks a relay outage so the page renders the error
// state instead of a misleading "0 results".
export async function searchHistory(env, p, nowMs = Date.now()) {
  const where = buildHistoryWhere(p, nowMs).join(" AND ");
  const orderBy = HISTORY_SORTS[p.sort]?.orderBy || HISTORY_SORTS.newest.orderBy;
  const offset = (p.page - 1) * HISTORY_PER_PAGE;
  let lots = [], ok = true, total = null;
  try {
    const [countRows, rows] = await Promise.all([
      // Count failure alone must not take the page down - it only costs the
      // numbered pager. The gateway aliases unnamed aggregates as tag0.
      query(env, `select count(*) from stats where ${where}`).catch(() => null),
      query(env, `select * from stats where ${where} order by ${orderBy} limit ${offset}, ${HISTORY_PER_PAGE}`),
    ]);
    lots = rows;
    const n = countRows && countRows[0] ? sqlInt(countRows[0].tag0) : null;
    if (n !== null && n >= 0) total = n;
  } catch (e) {
    ok = false;
    console.error("searchHistory failed:", e.message);
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
