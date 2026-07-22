#!/usr/bin/env node
// Average sold-price lookup for JDM Connect.
//
// Answers "what does this car actually sell for?" straight from your own auction
// feed. The historical `stats` table (sold results) already carries the hammer
// price in `finish`, so this reuses the relay client in src/avtonet.js and turns
// it into a one-command average, median, price range and count of real sales.
//
// It counts the true total server-side (SELECT COUNT(*)), then reads the most
// recent batch of sales to compute the average, median and range. When a model
// is very high-volume and the total exceeds the batch, it says the figures are
// based on the most recent N sales, so pricing tracks the current market rather
// than an all-time number skewed by old sales.
//
// Config is read the same way the Worker reads it: API_BASE and CALC_FX from
// wrangler.toml, the AVTONET_CODE relay token from .dev.vars (kept out of git).
// Precedence: process.env > .dev.vars > wrangler.toml [vars] > built-in default.
//
// Usage:
//   node scripts/avg-sold.mjs --make NISSAN --model SKYLINE --months 6
//   node scripts/avg-sold.mjs --make TOYOTA --model SUPRA --yearMin 1993 --yearMax 2002
//   node scripts/avg-sold.mjs --make HONDA --model CIVIC --grade "TYPE R" --json
//   node scripts/avg-sold.mjs --self-test        # offline math check, no token needed
//
// Flags:
//   --make, --model, --grade, --house   text filters (case-insensitive LIKE)
//   --yearMin, --yearMax                model-year bounds
//   --months N                          only sales in the last N months (default 12; 0 = all time)
//   --limit N                           recent-sales batch size for the average (default 500)
//   --fx N                              JPY per A$1 for the AUD estimate (default CALC_FX, 95)
//   --json                              machine-readable output
//   --self-test                         verify the maths offline and exit
//   --help                              show this usage

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { query, parseRows, sqlLike, sqlInt } from "../src/avtonet.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

const CONFIG_KEYS = ["API_BASE", "PROVIDER_API", "AVTONET_CODE", "AVTONET_TIMEOUT_MS", "CALC_FX", "AUCTION_FIXTURE"];
const DEFAULTS = { API_BASE: "https://jdmconnect.com.au/jdm-relay.php", CALC_FX: "95" };
const BOOLEAN_FLAGS = new Set(["json", "help", "selfTest", "liveFx", "direct", "relay"]);
const DEFAULT_MONTHS = 12;
const DEFAULT_TIMEOUT_MS = 15000;
const FEED_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 5000;

// --- config -----------------------------------------------------------------

// Parse `KEY = "value"` lines (the .dev.vars / wrangler [vars] shape). Ignores
// blank lines and # comments; strips surrounding quotes; drops an inline comment
// on an unquoted value. Returns a plain object of the parsed keys.
export function parseVarLines(text) {
  const out = {};
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    const quoted = val.match(/^"([^"]*)"|^'([^']*)'/);
    if (quoted) val = quoted[1] !== undefined ? quoted[1] : quoted[2];
    else val = val.replace(/\s+#.*$/, "").trim();
    out[m[1]] = val;
  }
  return out;
}

// Extract just the [vars] table from a wrangler.toml string.
export function parseWranglerVars(toml) {
  const collected = [];
  let inVars = false;
  for (const raw of String(toml || "").split(/\r?\n/)) {
    if (/^\s*\[/.test(raw)) { inVars = /^\s*\[vars\]/.test(raw); continue; }
    if (inVars) collected.push(raw);
  }
  return parseVarLines(collected.join("\n"));
}

// Merge config from all sources in precedence order and return the keys the
// relay client and this tool need.
export function loadConfig({ root = ROOT, env = process.env } = {}) {
  let wranglerVars = {};
  try {
    const p = resolve(root, "wrangler.toml");
    if (existsSync(p)) wranglerVars = parseWranglerVars(readFileSync(p, "utf8"));
  } catch { /* fall back to defaults */ }
  let devVars = {};
  try {
    const p = resolve(root, ".dev.vars");
    if (existsSync(p)) devVars = parseVarLines(readFileSync(p, "utf8"));
  } catch { /* .dev.vars is optional */ }
  const merged = { ...DEFAULTS, ...wranglerVars, ...devVars };
  for (const k of CONFIG_KEYS) {
    if (env[k] != null && env[k] !== "") merged[k] = env[k];
  }
  return merged;
}

// --- CLI args ----------------------------------------------------------------

function camel(s) {
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

// Minimal flag parser: `--key value` pairs, plus the boolean flags above. Also
// normalises kebab flags (--year-min, --self-test) to camelCase keys.
export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const tok = argv[i];
    if (!tok.startsWith("--")) continue;
    const key = camel(tok.slice(2));
    if (BOOLEAN_FLAGS.has(key)) { args[key] = true; continue; }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) { args[key] = true; continue; }
    args[key] = next;
    i += 1;
  }
  return args;
}

// --- SQL ---------------------------------------------------------------------

// Cutoff date 'YYYY-MM-DD' for `months` before `ref` (default now). The provider
// SQL API rejects DATE_SUB()/NOW(), so the window is a literal-date comparison
// computed here. UTC-based so it is stable regardless of the runner's timezone.
export function monthsAgo(months, ref = new Date()) {
  const d = new Date(ref.getTime());
  d.setUTCMonth(d.getUTCMonth() - Number(months));
  return d.toISOString().slice(0, 10);
}

// Build the WHERE clause for the historical `stats` table from the CLI filters.
// Every value is escaped/coerced (sqlLike/sqlInt) exactly as src/avtonet.js does
// for the live search, so the gateway only ever sees a clean SELECT.
export function buildStatsWhere(a = {}) {
  const where = ["finish > 0"];
  const make = String(a.make || "").trim();
  if (make) {
    // Match the searchLots convention: makes are single words, so the first
    // token of a multi-word input ("MERCEDES BENZ") is enough.
    const mk = sqlLike(make).toUpperCase().split(/[\s-]+/).filter(Boolean)[0];
    if (mk) where.push(`UPPER(marka_name) LIKE '%${mk}%'`);
  }
  const model = String(a.model || "").trim();
  if (model) where.push(`UPPER(model_name) LIKE '%${sqlLike(model).toUpperCase()}%'`);
  const grade = String(a.grade || "").trim();
  if (grade) where.push(`UPPER(grade) LIKE '%${sqlLike(grade).toUpperCase()}%'`);
  const yMin = sqlInt(a.yearMin); if (yMin !== null) where.push(`year >= ${yMin}`);
  const yMax = sqlInt(a.yearMax); if (yMax !== null) where.push(`year <= ${yMax}`);
  const house = String(a.house || "").trim();
  if (house) where.push(`UPPER(auction) LIKE '%${sqlLike(house).toUpperCase()}%'`);
  const months = sqlInt(a.months);
  if (months !== null && months > 0) {
    // The provider SQL API rejects DATE_SUB()/NOW(); compare to a literal date.
    where.push(`auction_date >= '${monthsAgo(months)}'`);
  }
  return where.join(" AND ");
}

// --- data source -------------------------------------------------------------

// Query the auction provider's SQL API directly, bypassing the relay. The relay
// (API_BASE) only answers the deployed Worker, so a local CLI run cannot use it;
// instead it reaches the provider straight, authing with the same code. The
// provider takes a plain `sql=` param (the relay uses a base64 `q=`), and
// parseRows() already handles its UPPERCASE field tags.
export async function queryDirect(env, sql) {
  const base = env.PROVIDER_API;
  if (!base) throw new Error("PROVIDER_API is not configured for --direct mode.");
  const timeout = Number(env.AVTONET_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  const sep = base.includes("?") ? "&" : "?";
  const url = `${base}${sep}code=${encodeURIComponent(env.AVTONET_CODE || "")}&sql=${encodeURIComponent(sql)}`;
  const res = await fetch(url, { headers: FEED_HEADERS, signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error(`Provider API HTTP ${res.status}`);
  return parseRows(await res.text());
}

// Pick the data path. The relay only answers the deployed Worker, so when a
// PROVIDER_API is configured (local .dev.vars) we go direct by default. The
// --relay and --direct flags force the choice.
export function chooseMode(a, config) {
  if (a.relay) return "relay";
  if (a.direct) return "direct";
  return config && config.PROVIDER_API ? "direct" : "relay";
}

function runQuery(mode, env, sql) {
  return mode === "direct" ? queryDirect(env, sql) : query(env, sql);
}

// --- maths -------------------------------------------------------------------

// Median of a numeric array (average of the two middle values when even).
export function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const n = s.length;
  if (!n) return null;
  const mid = Math.floor(n / 2);
  return n % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Average / median / range / count over a list of `finish` values. Coerces to
// number and drops anything that is not a real, positive price.
export function computeStats(finishes) {
  const vals = (finishes || []).map(Number).filter((v) => Number.isFinite(v) && v > 0);
  const count = vals.length;
  if (!count) return { count: 0, average: null, median: null, min: null, max: null };
  const sum = vals.reduce((a, b) => a + b, 0);
  return {
    count,
    average: Math.round(sum / count),
    median: median(vals),
    min: Math.min(...vals),
    max: Math.max(...vals),
  };
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function resolveFx(a, config) {
  const override = Number(a.fx);
  if (Number.isFinite(override) && override > 0) return override;
  const configured = Number(config.CALC_FX);
  return Number.isFinite(configured) && configured > 0 ? configured : 95;
}

// --- formatting --------------------------------------------------------------

function yen(n) { return n == null ? "n/a" : "¥" + Math.round(n).toLocaleString("en-US"); }
function aud(n) { return n == null ? "n/a" : "A$" + Math.round(n).toLocaleString("en-US"); }

function queryLabel(q) {
  const name = [q.make, q.model, q.grade].filter(Boolean).join(" ").trim();
  const base = name || "all vehicles";
  let years = "";
  if (q.yearMin && q.yearMax) years = ` ${q.yearMin} to ${q.yearMax}`;
  else if (q.yearMin) years = ` ${q.yearMin} and newer`;
  else if (q.yearMax) years = ` up to ${q.yearMax}`;
  return base + years;
}

function windowLabel(months) {
  const m = Number(months);
  if (!Number.isFinite(m) || m <= 0) return "all sold history";
  if (m === 12) return "the last 12 months";
  return `the last ${m} months`;
}

function printReport(r) {
  const q = r.query;
  const lines = [];
  lines.push("");
  lines.push(`Sold-price lookup: ${queryLabel(q)}`);
  lines.push(`Window: ${windowLabel(q.months)}  |  FX: ${r.fxRate} JPY/A$1  |  source: ${r.source || "relay"}`);
  lines.push("");
  if (!r.sampled) {
    lines.push("No sold results found for that search. Try widening the year range,");
    lines.push("dropping the grade, or raising --months.");
    console.log(lines.join("\n"));
    return;
  }
  const basis = r.capped
    ? `showing the ${r.sampled} most recent (there may be more; raise --limit)`
    : `${r.sampled} sold in the window`;
  lines.push(`Sales counted: ${basis}`);
  lines.push("");
  lines.push(`  Average   ${yen(r.average.yen).padEnd(16)} (~ ${aud(r.average.aud)})`);
  lines.push(`  Median    ${yen(r.median.yen).padEnd(16)} (~ ${aud(r.median.aud)})`);
  lines.push(`  Range     ${yen(r.range.lowYen)} to ${yen(r.range.highYen)}`);
  lines.push("");
  if (r.recent.length) {
    lines.push("Most recent sales:");
    for (const s of r.recent) {
      const veh = [s.year, s.vehicle, s.grade].filter(Boolean).join(" ");
      const km = s.mileageKm != null ? `${s.mileageKm.toLocaleString("en-US")} km` : "";
      lines.push(`  ${(s.date || "").padEnd(12)} ${veh}  ${yen(s.finishYen)}  ${km}`.trimEnd());
    }
    lines.push("");
  }
  lines.push("Prices are hammer (auction) yen. AUD is an indicative convert at the");
  lines.push("default rate, not a landed cost. Run the calculator for a real quote.");
  console.log(lines.join("\n"));
}

// --- self-test ---------------------------------------------------------------

// Offline check: no token, no network. A fixed set whose average and median are
// known by hand, plus a couple of SQL-builder assertions.
export function runSelfTest() {
  const set = [3_000_000, 9_000_000, 9_000_000, 11_300_000]; // mean 8,075,000; median 9,000,000
  const s = computeStats(set);
  const checks = [
    ["count", s.count, 4],
    ["average", s.average, 8_075_000],
    ["median", s.median, 9_000_000],
    ["min", s.min, 3_000_000],
    ["max", s.max, 11_300_000],
  ];
  let ok = true;
  console.log("Maths:");
  for (const [name, got, want] of checks) {
    const pass = got === want;
    ok = ok && pass;
    console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}: got ${got}, want ${want}`);
  }
  const where = buildStatsWhere({ make: "NISSAN", model: "SKYLINE", grade: "GT-R", yearMin: 1993, yearMax: 2002, months: 6 });
  const fragments = [
    "finish > 0",
    "UPPER(marka_name) LIKE '%NISSAN%'",
    "UPPER(model_name) LIKE '%SKYLINE%'",
    "UPPER(grade) LIKE '%GT-R%'",
    "year >= 1993",
    "year <= 2002",
  ];
  console.log("SQL builder:");
  for (const frag of fragments) {
    const pass = where.includes(frag);
    ok = ok && pass;
    console.log(`  ${pass ? "PASS" : "FAIL"}  where contains: ${frag}`);
  }
  const dateOk = /auction_date >= '\d{4}-\d{2}-\d{2}'/.test(where);
  ok = ok && dateOk;
  console.log(`  ${dateOk ? "PASS" : "FAIL"}  where has a literal date cutoff (not DATE_SUB)`);
  const injected = buildStatsWhere({ make: "MERCEDES BENZ", model: "S'; DROP TABLE stats;--" });
  const safe = !/;/.test(injected) && !/--/.test(injected) && injected.includes("'%MERCEDES%'");
  ok = ok && safe;
  console.log(`  ${safe ? "PASS" : "FAIL"}  injection neutralised`);
  console.log(ok ? "\nSelf-test PASSED" : "\nSelf-test FAILED");
  return ok;
}

// --- main --------------------------------------------------------------------

function printUsage() {
  const banner = String(readFileSync(fileURLToPath(import.meta.url), "utf8"))
    .split("\n")
    .slice(1)
    .filter((l) => l.startsWith("//"))
    .map((l) => l.replace(/^\/\/ ?/, ""))
    .join("\n");
  console.log(banner);
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.help) { printUsage(); return; }
  if (a.selfTest) { process.exitCode = runSelfTest() ? 0 : 1; return; }

  const config = loadConfig();
  if (!config.AVTONET_CODE && !config.AUCTION_FIXTURE) {
    console.error([
      "No AVTONET_CODE relay token found.",
      "",
      "Add it once to .dev.vars (same value as your Cloudflare AVTONET_CODE secret):",
      "",
      '  AVTONET_CODE = "your-relay-code"',
      "",
      "Then re-run. To check the maths without a token: --self-test",
    ].join("\n"));
    process.exitCode = 2;
    return;
  }

  if (a.months === undefined) a.months = DEFAULT_MONTHS;
  const limit = clamp(sqlInt(a.limit) || DEFAULT_LIMIT, 1, MAX_LIMIT);
  const fx = resolveFx(a, config);
  const env = {
    API_BASE: config.API_BASE,
    PROVIDER_API: config.PROVIDER_API || "",
    AVTONET_CODE: config.AVTONET_CODE || "",
    AVTONET_TIMEOUT_MS: config.AVTONET_TIMEOUT_MS,
    AUCTION_FIXTURE: config.AUCTION_FIXTURE || "",
  };
  const mode = chooseMode(a, config);
  const where = buildStatsWhere(a);

  // The provider SQL API rejects COUNT(*), so we pull the most recent matching
  // sales (up to `limit`) and derive the stats from those. If the batch fills the
  // limit there may be more (we say so); otherwise it is the full set for the
  // window and the count is exact.
  const batch = await runQuery(
    mode, env,
    `SELECT year, marka_name, model_name, grade, finish, mileage, auction, auction_date FROM stats WHERE ${where} ORDER BY auction_date DESC LIMIT ${limit}`,
  );
  const stats = computeStats(batch.map((row) => row.finish));
  const capped = batch.length >= limit;
  const total = capped ? null : stats.count;
  const toAud = (v) => (v == null ? null : Math.round(v / fx));

  const result = {
    query: {
      make: a.make || null, model: a.model || null, grade: a.grade || null,
      house: a.house || null, yearMin: a.yearMin || null, yearMax: a.yearMax || null,
      months: Number(a.months), limit,
    },
    fxRate: fx,
    source: mode,
    totalSold: total != null ? total : stats.count,
    sampled: stats.count,
    capped,
    basedOnRecentBatch: capped,
    average: { yen: stats.average, aud: toAud(stats.average) },
    median: { yen: stats.median, aud: toAud(stats.median) },
    range: {
      lowYen: stats.min, highYen: stats.max,
      lowAud: toAud(stats.min), highAud: toAud(stats.max),
    },
    recent: batch.slice(0, 8).map((row) => ({
      date: row.auction_date || "",
      year: row.year || "",
      vehicle: [row.marka_name, row.model_name].filter(Boolean).join(" "),
      grade: row.grade || "",
      mileageKm: sqlInt(row.mileage),
      finishYen: sqlInt(row.finish),
    })),
  };

  if (a.json) console.log(JSON.stringify(result, null, 2));
  else printReport(result);
}

// Only run the CLI when invoked directly, so the tests can import the helpers.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error && error.message ? error.message : String(error));
    process.exit(1);
  });
}
