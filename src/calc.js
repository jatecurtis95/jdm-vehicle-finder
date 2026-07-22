// Landed-cost estimate via the live JDM Connect calculator.
//
// Rather than duplicate the pricing tables (shipping lines, LCT, stamp duty,
// rego, GST…), the finder calls the calculator's own server function at
// /api/calc - so the numbers here always match calculator.jdmconnect.com.au.
// The API is CORS-locked to JDM domains, so we send an allowed Origin header
// on the server-to-server call. All figures are indicative estimates.

import { getSettings } from "./settings.js";

// Australian state -> shipping port the calculator supports.
const STATE_TO_PORT = {
  WA: "FREMANTLE",
  VIC: "MELBOURNE",
  QLD: "BRISBANE",
  NSW: "PORT_KEMBLA",
  SA: "ADELAIDE",
  ACT: "PORT_KEMBLA", // nearest supported port
  TAS: "MELBOURNE",   // mainland leg; sea freight to TAS is extra
  NT: "FREMANTLE",    // no northern port in the table; closest supported
};

const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];

export function isAuState(s) {
  return typeof s === "string" && AU_STATES.includes(s.toUpperCase());
}

export function auStates() {
  return AU_STATES.slice();
}

const STATE_FULL_NAME = {
  "NEW SOUTH WALES": "NSW", "VICTORIA": "VIC", "QUEENSLAND": "QLD",
  "WESTERN AUSTRALIA": "WA", "SOUTH AUSTRALIA": "SA", "TASMANIA": "TAS",
  "AUSTRALIAN CAPITAL TERRITORY": "ACT", "NORTHERN TERRITORY": "NT",
};

// Normalise any user/dealer-entered state to a valid code, or null if unknown.
// Accepts codes ("vic"), and common full names ("Victoria").
export function normalizeState(s) {
  if (typeof s !== "string") return null;
  const t = s.trim().toUpperCase();
  if (!t) return null;
  if (AU_STATES.includes(t)) return t;
  return STATE_FULL_NAME[t] || null;
}

// Read a numeric env var with a finite fallback (handles unset/empty/NaN and
// allows a legitimate 0 without the `Number(x) || fallback` foot-gun).
function envNum(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// Live JPY-per-AUD rate (the calculator's fxRate), cached per isolate for 6h.
// Falls back to the fixed CALC_FX (default 95) if the FX service is unreachable.
let _fxCache = { rate: 0, exp: 0 };
export async function getLiveFx(env) {
  const fallback = (() => { const f = envNum(env.CALC_FX, 95); return f > 0 ? f : 95; })();
  const now = Date.now();
  if (_fxCache.rate > 0 && now < _fxCache.exp) return _fxCache.rate;
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=AUD&to=JPY", {
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = await res.json();
      const rate = Number(data?.rates?.JPY);
      if (Number.isFinite(rate) && rate > 0) {
        _fxCache = { rate, exp: now + 6 * 60 * 60 * 1000 };
        return rate;
      }
    }
  } catch (e) {
    console.error("Live FX fetch failed, using fallback:", e.message);
  }
  return fallback;
}

// Turn a buyer's maximum all-in AUD budget (car landed to their door) into an
// approximate JPY auction-price ceiling, for the matcher's price_max. This is a
// deliberately simple inverse of the landed model - a soft filter, not a quote -
// so the public signup path never has to call the calculator. We back out a flat
// import-overhead allowance and the on-value taxes, then convert at the FX rate.
// Exported so the wizard can mirror this exact inverse client-side: the yen
// figure it previews must equal the price_max the server stores.
export const IMPORT_OVERHEAD_AUD = 9000; // shipping + compliance + on-road + duties allowance
export const ON_VALUE_TAX = 1.13;        // GST + duties applied to the car's value
export const MIN_CAR_VALUE_AUD = 2000;   // floor so a low budget still matches cheap lots
export function audBudgetToYen(audBudget, fx) {
  const aud = Number(audBudget);
  const rate = Number(fx) > 0 ? Number(fx) : 95;
  if (!Number.isFinite(aud) || aud <= 0) return null;
  const carValueAud = Math.max((aud - IMPORT_OVERHEAD_AUD) / ON_VALUE_TAX, MIN_CAR_VALUE_AUD);
  return Math.round(carValueAud * rate);
}

// The forward direction of the same model: a rough all-in landed AUD for a car of
// the given AUD auction value. Used by the onboarding Market Snapshot so its
// "estimated landed" tracks exactly the assumptions the matcher filters on. Not a
// quote; the real calculator is used once a specific lot is in hand.
export function carAudToLanded(carAud) {
  const v = Number(carAud);
  if (!Number.isFinite(v) || v <= 0) return null;
  return Math.round(v * ON_VALUE_TAX + IMPORT_OVERHEAD_AUD);
}

// The lot's working purchase price in JPY for landed estimates. Prefer the
// recent market average: start prices are teaser bids (often 1 yen) and
// systematically understate what the car will hammer for. Fall back to the
// starting bid only when no market average exists. Scoring's lotPrice keeps
// its own start-first rule; that one asks affordability, this one asks cost.
export function lotJpy(lot) {
  const a = Number(lot?.avg_price);
  const s = Number(lot?.start);
  if (a > 0) return a;
  if (s > 0) return s;
  return 0;
}

// Rough size bucket: kei (<=660cc) ships smaller; everything else mid-size.
function vehicleSizeIdx(lot) {
  const cc = Number(lot?.eng_v);
  if (cc > 0 && cc <= 660) return 0; // Kei
  return 1;                          // Sedan/Coupe default
}

// Per-isolate estimate cache (Phase 2). One calculator POST per distinct
// (lot, price, state, assumptions) per isolate lifetime: repeat page loads,
// the deferred page fill, the matcher and notify all reuse the same figure
// instead of re-asking the calculator. Bounded so a busy isolate can't grow
// without limit; entries expire with the FX cache horizon.
const EST_TTL_MS = 6 * 60 * 60 * 1000;
const EST_CACHE_MAX = 500;
const _estCache = new Map(); // key -> { est, exp }
const cfgKey = (cfg) => cfg ? `${cfg.compliance ?? ""}|${cfg.agency ?? ""}|${cfg.fx ?? ""}|${cfg.bias ?? ""}` : "d";
export function _resetLandedCache() { _estCache.clear(); } // test hook

// Estimate the full landed + on-road cost (AUD) for one lot, for a client in a
// given state. Returns null if there's no price or the calculator is
// unreachable - callers treat null as "no estimate available" and degrade.
export async function estimateLanded(env, lot, client, cfg = null) {
  const jpy = lotJpy(lot);
  if (!jpy) return null;

  const state = normalizeState(client?.state) || normalizeState(env.CALC_DEFAULT_STATE) || "VIC";
  const port = STATE_TO_PORT[state] || "MELBOURNE";
  const fx = (cfg && cfg.fx) || await getLiveFx(env);

  const cacheKey = lot?.id ? `${lot.id}|${jpy}|${state}|${cfgKey(cfg)}` : null;
  if (cacheKey) {
    const hit = _estCache.get(cacheKey);
    if (hit && Date.now() < hit.exp) return hit.est;
  }

  const payload = {
    jpyPrice: jpy,
    fxRate: fx,
    vehicleSizeIdx: vehicleSizeIdx(lot),
    destinationPort: port,
    regState: state,
    includeOnRoad: true,
    includeDelivery: true,
    includeDaff: true,
    isFuelEfficient: false,
    bmsbSeason: false,
    isNonJapanOrigin: false,
    // Settings-editable assumptions (V1.3 Phase B); env defaults as fallback.
    complianceCost: (cfg && cfg.compliance != null) ? cfg.compliance : envNum(env.CALC_COMPLIANCE, 4000),
    agencyFee: (cfg && cfg.agency != null) ? cfg.agency : envNum(env.CALC_AGENCY, 0),
  };

  try {
    const res = await fetch(env.CALC_API || "https://calculator.jdmconnect.com.au/api/calc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": env.CALC_ORIGIN || "https://jdmconnect.com.au",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(envNum(env.CALC_TIMEOUT_MS, 6000)),
    });
    if (!res.ok) return null;
    const data = await res.json();
    let gt = Number(data?.calc?.grandTotal);
    if (!Number.isFinite(gt) || gt <= 0) return null; // guard against A$NaN
    // Settings-tunable bias (Phase 2): a signed percentage on the headline
    // figure so estimates can be aimed 5 to 10% under (or over) actuals once
    // back-testing says which way the raw calculator runs.
    const bias = Number(cfg?.bias);
    if (Number.isFinite(bias) && bias !== 0) gt = Math.round(gt * (1 + bias / 100));
    const est = {
      grandTotal: gt,                                  // landed + on-road, AUD
      landedAtPort: Number(data.calc.landedAtPort) || null,
      purchaseAUD: Number(data.calc.purchaseAUD) || null,
      line: data.activeLineName || null,
      port,
      state,
    };
    if (cacheKey) {
      if (_estCache.size >= EST_CACHE_MAX) {
        // Drop the oldest insertion; Map preserves insertion order.
        _estCache.delete(_estCache.keys().next().value);
      }
      _estCache.set(cacheKey, { est, exp: Date.now() + EST_TTL_MS });
    }
    return est;
  } catch (e) {
    console.error("Landed estimate failed:", e.message);
    return null;
  }
}

// The admin-editable landed-cost assumptions (Settings page), read once per
// batch. null fields mean "no override, use env/live defaults".
export async function landedConfig(env) {
  try {
    const s = await getSettings(env);
    const numOrNull = (k) => {
      const v = String(s[k] ?? "").trim();
      const n = Number(v);
      return v && Number.isFinite(n) && n >= 0 ? n : null;
    };
    // Bias is the one signed field: negative aims under actuals.
    const bias = (() => {
      const v = String(s.calc_bias_pct ?? "").trim();
      const n = Number(v);
      return v && Number.isFinite(n) && n >= -50 && n <= 50 ? n : null;
    })();
    return { compliance: numOrNull("calc_compliance_aud"), agency: numOrNull("calc_agency_aud"), fx: numOrNull("calc_fx_jpy_aud"), bias };
  } catch (e) {
    return null;
  }
}

// Attach `_landed` to each lot, best-effort, with bounded concurrency so a big
// batch never bursts past the calculator's rate limit. `pairs` is an array of
// { lot, client }. Mutates each lot with lot._landed (or leaves it unset).
export async function attachLanded(env, pairs, concurrency = 6) {
  // Read the settings-editable cost assumptions once per batch, not per lot.
  const cfg = await landedConfig(env);
  let i = 0;
  async function worker() {
    while (i < pairs.length) {
      const { lot, client } = pairs[i++];
      const est = await estimateLanded(env, lot, client, cfg);
      if (est) lot._landed = est;
    }
  }
  const n = Math.max(1, Math.min(concurrency, pairs.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
}

// One deferred page fill (Phase 2): real landed figures for up to a page of
// lots in a single call from the browser, after first paint. `items` is
// [{ id, jpy, cc }] (already validated by the route); returns
// { [lotId]: grandTotalAUD } with misses simply absent. Estimates only - the
// pseudo-lot carries just the fields estimateLanded reads (price + engine
// size), and the per-isolate cache absorbs repeats across page loads.
export const LANDED_BATCH_MAX = 24; // one results page
export async function estimateLandedBatch(env, items, state) {
  const lots = (items || []).slice(0, LANDED_BATCH_MAX).map((it) => ({
    id: String(it.id),
    avg_price: Number(it.jpy),
    eng_v: Number(it.cc) || 0,
  }));
  const client = { state: state || null };
  await attachLanded(env, lots.map((lot) => ({ lot, client })));
  const out = {};
  for (const lot of lots) {
    if (lot._landed && Number(lot._landed.grandTotal) > 0) out[lot.id] = lot._landed.grandTotal;
  }
  return out;
}
