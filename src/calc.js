// Landed-cost estimate via the live JDM Connect calculator.
//
// Rather than duplicate the pricing tables (shipping lines, LCT, stamp duty,
// rego, GST…), the finder calls the calculator's own server function at
// /api/calc — so the numbers here always match calculator.jdmconnect.com.au.
// The API is CORS-locked to JDM domains, so we send an allowed Origin header
// on the server-to-server call. All figures are indicative estimates.

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

// The lot's working purchase price in JPY (starting bid, else market estimate).
function lotJpy(lot) {
  const s = Number(lot?.start);
  const a = Number(lot?.avg_price);
  if (s > 0) return s;
  if (a > 0) return a;
  return 0;
}

// Rough size bucket: kei (<=660cc) ships smaller; everything else mid-size.
function vehicleSizeIdx(lot) {
  const cc = Number(lot?.eng_v);
  if (cc > 0 && cc <= 660) return 0; // Kei
  return 1;                          // Sedan/Coupe default
}

// Estimate the full landed + on-road cost (AUD) for one lot, for a client in a
// given state. Returns null if there's no price or the calculator is
// unreachable — callers treat null as "no estimate available" and degrade.
export async function estimateLanded(env, lot, client) {
  const jpy = lotJpy(lot);
  if (!jpy) return null;

  const state = normalizeState(client?.state) || normalizeState(env.CALC_DEFAULT_STATE) || "VIC";
  const port = STATE_TO_PORT[state] || "MELBOURNE";
  const fx = envNum(env.CALC_FX, 95);

  const payload = {
    jpyPrice: jpy,
    fxRate: fx > 0 ? fx : 95,
    vehicleSizeIdx: vehicleSizeIdx(lot),
    destinationPort: port,
    regState: state,
    includeOnRoad: true,
    includeDelivery: true,
    includeDaff: true,
    isFuelEfficient: false,
    bmsbSeason: false,
    isNonJapanOrigin: false,
    complianceCost: envNum(env.CALC_COMPLIANCE, 4000),
    agencyFee: envNum(env.CALC_AGENCY, 0),
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
    const gt = Number(data?.calc?.grandTotal);
    if (!Number.isFinite(gt) || gt <= 0) return null; // guard against A$NaN
    return {
      grandTotal: gt,                                  // landed + on-road, AUD
      landedAtPort: Number(data.calc.landedAtPort) || null,
      purchaseAUD: Number(data.calc.purchaseAUD) || null,
      line: data.activeLineName || null,
      port,
      state,
    };
  } catch (e) {
    console.error("Landed estimate failed:", e.message);
    return null;
  }
}

// Attach `_landed` to each lot, best-effort, with bounded concurrency so a big
// batch never bursts past the calculator's rate limit. `pairs` is an array of
// { lot, client }. Mutates each lot with lot._landed (or leaves it unset).
export async function attachLanded(env, pairs, concurrency = 6) {
  let i = 0;
  async function worker() {
    while (i < pairs.length) {
      const { lot, client } = pairs[i++];
      const est = await estimateLanded(env, lot, client);
      if (est) lot._landed = est;
    }
  }
  const n = Math.max(1, Math.min(concurrency, pairs.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
}
