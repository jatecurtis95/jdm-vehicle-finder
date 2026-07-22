#!/usr/bin/env node
// Phase 1 feed check (audit decision): verify how auction grades actually
// appear in the feed's `rate` column BEFORE trusting the grade pills, because
// grades match by exact string. Specifically:
//   - do 6 and S occur, and with exactly those spellings?
//   - does RA2 occur, and are there any other compound / non-standard values
//     (R1, RA3, A, B, whitespace or case variants) that no pill would match?
// Any value this script lists as UNMATCHED would silently vanish from both
// the Live Auctions and Auction History filters when any grade pill is
// ticked. Fix by extending the `match` lists in HISTORY_RATES
// (src/auction-history-query.js), never by guessing.
//
// Also samples the structured columns the docs recommend (kpp, priv, color)
// so their reliability for the transmission / drivetrain / colour filters can
// be judged from real data.
//
// Usage:
//   AVTONET_CODE=... [API_BASE=...] node scripts/check-feed-grades.mjs
//   (falls back to .dev.vars for AVTONET_CODE and wrangler.toml's API_BASE;
//    read-only SELECTs, a handful of small queries, no writes anywhere)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { query } from "../src/avtonet.js";
import { HISTORY_RATES, RATE_ORDER } from "../src/auction-history-query.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

function devVar(name) {
  try {
    const text = readFileSync(resolve(ROOT, ".dev.vars"), "utf8");
    const m = text.match(new RegExp(`^\\s*${name}\\s*=\\s*"?([^"\\n]*)"?\\s*$`, "m"));
    return m ? m[1].trim() : "";
  } catch (e) {
    return "";
  }
}

function tomlVar(name) {
  try {
    const text = readFileSync(resolve(ROOT, "wrangler.toml"), "utf8");
    const m = text.match(new RegExp(`^\\s*${name}\\s*=\\s*"([^"]*)"`, "m"));
    return m ? m[1].trim() : "";
  } catch (e) {
    return "";
  }
}

const env = {
  API_BASE: process.env.API_BASE || tomlVar("API_BASE"),
  AVTONET_CODE: process.env.AVTONET_CODE || devVar("AVTONET_CODE"),
};
if (!env.API_BASE || !env.AVTONET_CODE) {
  console.error("Missing feed credentials: set AVTONET_CODE (and optionally API_BASE) in the environment or .dev.vars.");
  process.exit(2);
}

// Every spelling a pill answers for, upper-cased for comparison.
const MATCHED = new Set(RATE_ORDER.flatMap((k) => HISTORY_RATES[k].match.map((s) => s.toUpperCase())));

// GROUP BY through the relay: the gateway aliases unnamed aggregates (tag0),
// so read the count from whichever key is not `rate`.
async function rateCounts(table) {
  const rows = await query(env, `select rate, count(*) from ${table} group by rate order by rate`);
  return rows.map((r) => {
    const countKey = Object.keys(r).find((k) => k !== "rate");
    return { rate: String(r.rate ?? ""), count: Number(r[countKey]) || 0 };
  });
}

async function sampleColumn(table, column, limit = 40) {
  const rows = await query(env, `select distinct ${column} from ${table} where ${column} <> '' order by ${column} limit ${limit}`);
  return rows.map((r) => String(r[column] ?? "").trim()).filter(Boolean);
}

function report(table, counts) {
  console.log(`\n=== ${table}.rate (${counts.length} distinct values) ===`);
  const unmatched = [];
  for (const { rate, count } of counts) {
    const norm = rate.trim().toUpperCase();
    const blank = norm === "";
    const hit = MATCHED.has(norm);
    const exact = hit && MATCHED.has(rate); // flag case/whitespace variants
    const tag = blank ? "ungraded (blank)" : hit ? (exact ? "matched" : "MATCHED VIA UPPER() ONLY") : "UNMATCHED";
    console.log(`  ${JSON.stringify(rate).padEnd(12)} x ${String(count).padStart(7)}  ${tag}`);
    if (!blank && !hit) unmatched.push({ rate, count });
  }
  return unmatched;
}

const mainCounts = await rateCounts("main");
const statsCounts = await rateCounts("stats");
const unmatched = [...report("main", mainCounts), ...report("stats", statsCounts)];

console.log("\n=== Verification targets (audit decision) ===");
for (const target of ["6", "S", "RA2"]) {
  const inMain = mainCounts.find((c) => c.rate.trim().toUpperCase() === target);
  const inStats = statsCounts.find((c) => c.rate.trim().toUpperCase() === target);
  console.log(`  ${target.padEnd(4)} live: ${inMain ? inMain.count : 0}  sold: ${inStats ? inStats.count : 0}${inMain || inStats ? "" : "  (not sighted in the feed)"}`);
}

console.log("\n=== Structured-column samples (filter reliability) ===");
for (const col of ["kpp", "priv", "color"]) {
  try {
    const vals = await sampleColumn("main", col);
    console.log(`  main.${col}: ${vals.join(", ") || "(all blank)"}`);
  } catch (e) {
    console.log(`  main.${col}: sample failed (${e.message})`);
  }
}

if (unmatched.length) {
  console.error(`\n✗ ${unmatched.length} grade value(s) match NO pill and would vanish when any grade filter is on:`);
  for (const u of unmatched) console.error(`    - ${JSON.stringify(u.rate)} (x ${u.count})`);
  console.error("  Extend the match lists in HISTORY_RATES (src/auction-history-query.js) to cover them.");
  process.exit(1);
}
console.log("\n✓ Every non-blank grade value in the feed is covered by a pill.");
