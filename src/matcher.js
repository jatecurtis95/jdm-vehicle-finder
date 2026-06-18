// Matcher engine: turn a wishlist into a filtered SQL query against the live
// `main` feed, fetch candidates, refine in code, dedupe, and queue new matches.

import { query, sqlString, sqlInt, sqlNum, gradeValue } from "./avtonet.js";
import { deliverToClient } from "./notify.js";

// Build the SQL for one wishlist. Only upcoming auctions, filtered by the
// numeric/text criteria we can express in SQL. Grade is refined in code
// afterwards because grades can be non-numeric.
export function buildSql(w) {
  const where = [];

  // Only lots whose auction is still in the future.
  where.push("auction_date >= NOW()");

  if (w.marka_name) {
    where.push(`UPPER(marka_name) = '${sqlString(w.marka_name).toUpperCase()}'`);
  }
  if (w.model_name) {
    where.push(`UPPER(model_name) LIKE '%${sqlString(w.model_name).toUpperCase()}%'`);
  }
  const yearMin = sqlInt(w.year_min);
  if (yearMin !== null) where.push(`year >= ${yearMin}`);
  const yearMax = sqlInt(w.year_max);
  if (yearMax !== null) where.push(`year <= ${yearMax}`);

  // Budget: upcoming lots usually carry a starting price (`start`); the market
  // estimate (`avg_price`) is often 0 until closer to sale. Match on whichever
  // price is known, and don't exclude lots that have neither yet.
  const priceMax = sqlInt(w.price_max);
  if (priceMax !== null) {
    where.push(
      `((start > 0 AND start <= ${priceMax}) OR (start <= 0 AND avg_price > 0 AND avg_price <= ${priceMax}) OR (start <= 0 AND avg_price <= 0))`
    );
  }

  const mileageMax = sqlInt(w.mileage_max);
  if (mileageMax !== null) where.push(`(mileage > 0 AND mileage <= ${mileageMax})`);

  if (w.kuzov) {
    where.push(`UPPER(kuzov) LIKE '%${sqlString(w.kuzov).toUpperCase()}%'`);
  }
  if (w.grade_kw) {
    where.push(`UPPER(grade) LIKE '%${sqlString(w.grade_kw).toUpperCase()}%'`);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  // Soonest auctions first; cap each run so a digest stays manageable. The
  // dedupe step means later runs surface the next batch of new lots.
  return `SELECT * FROM main ${whereClause} ORDER BY auction_date ASC LIMIT 25`;
}

// The lot's working price: starting price if set, else market estimate.
export function lotPrice(lot) {
  const s = Number(lot.start);
  const a = Number(lot.avg_price);
  if (s > 0) return s;
  if (a > 0) return a;
  return 0;
}

// Strength score (from the design handoff): price headroom + grade margin +
// keyword/chassis specificity + a bonus for high-grade lots.
export function scoreMatch(lot, w) {
  let score = 0;
  const maxP = sqlInt(w.price_max);
  const minG = sqlNum(w.rate_min);
  const price = lotPrice(lot);
  const grade = gradeValue(lot.rate);
  if (maxP && price > 0) score += Math.min(1, (maxP - price) / maxP);
  if (minG !== null && grade !== null) score += Math.min(1, (grade - minG) / 2);
  if (w.grade_kw || w.kuzov) score += 0.6;
  if (grade !== null && grade >= 4.5) score += 0.4;
  return score;
}

// Bucket a score into a labelled strength with its brand colour.
export function strengthFor(score) {
  if (score >= 1.3) return { label: "Strong", color: "#46B17A" };
  if (score >= 0.6) return { label: "Good", color: "#CAA34C" };
  return { label: "Possible", color: "#B6B9BC" };
}

// Code-side refinement that SQL can't express cleanly.
export function refine(lots, w) {
  const rateMin = sqlNum(w.rate_min);
  if (rateMin === null) return lots;
  return lots.filter((lot) => {
    const g = gradeValue(lot.rate);
    // Keep lots that meet the grade, plus lots with a non-numeric grade
    // (e.g. brand-new "S") so they aren't silently dropped.
    return g === null ? true : g >= rateMin;
  });
}

// Run one wishlist end to end. Returns the list of newly-queued lot ids.
export async function runWishlist(env, wishlist) {
  const sql = buildSql(wishlist);
  const candidates = refine(await query(env, sql), wishlist);
  if (candidates.length === 0) return [];

  // Score each candidate (strength) and sort strongest first.
  for (const lot of candidates) {
    lot._score = scoreMatch(lot, wishlist);
    const st = strengthFor(lot._score);
    lot._strength = st.label;
    lot._strengthColor = st.color;
  }
  candidates.sort((a, b) => b._score - a._score);

  // Which of these have we already surfaced for this wishlist?
  const seen = await getSeen(env, wishlist.id);
  const fresh = candidates.filter((l) => l.id && !seen.has(l.id));
  if (fresh.length === 0) return [];

  const queued = [];
  const stmts = [];
  for (const lot of fresh) {
    const token = crypto.randomUUID().replace(/-/g, "");
    stmts.push(
      env.DB.prepare(
        `INSERT INTO queue (wishlist_id, client_id, lot_id, lot_json, token) VALUES (?, ?, ?, ?, ?)`
      ).bind(wishlist.id, wishlist.client_id, lot.id, JSON.stringify(lot), token)
    );
    stmts.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO seen_lots (wishlist_id, lot_id) VALUES (?, ?)`
      ).bind(wishlist.id, lot.id)
    );
    queued.push({ lot, token });
  }
  // One batched round-trip instead of many writes.
  if (stmts.length) await env.DB.batch(stmts);
  return queued;
}

// Fetch the lot ids already seen for this wishlist. Uses a single bound
// parameter (not a big IN clause) to stay under D1's 100-parameter limit.
async function getSeen(env, wishlistId) {
  const set = new Set();
  const rows = await env.DB.prepare(
    `SELECT lot_id FROM seen_lots WHERE wishlist_id = ?`
  )
    .bind(wishlistId)
    .all();
  for (const r of rows.results || []) set.add(r.lot_id);
  return set;
}

// Run every active wishlist. Returns a summary for logging/the digest.
export async function runAll(env) {
  const wl = await env.DB.prepare(
    `SELECT w.*, c.name AS client_name, c.email AS client_email, c.whatsapp AS client_whatsapp
     FROM wishlists w JOIN clients c ON c.id = w.client_id
     WHERE w.active = 1`
  ).all();

  const summary = [];
  for (const w of wl.results || []) {
    try {
      const queued = await runWishlist(env, w);
      if (!queued.length) continue;
      // auto_notify wishlists (e.g. a dealer who opted out of review) get their
      // matches delivered immediately and skip the digest. Everything else lands
      // in the manual approval queue, as before.
      if (w.auto_notify) {
        await autoDeliver(env, w, queued);
      } else {
        summary.push({ wishlist: w, queued });
      }
    } catch (err) {
      console.error(`Wishlist ${w.id} failed:`, err.message);
    }
  }
  return summary;
}

// Deliver each fresh match for an auto-notify wishlist now, marking the queued
// row sent/failed. The client fields are already joined onto the wishlist row.
async function autoDeliver(env, w, queued) {
  const client = { id: w.client_id, name: w.client_name, email: w.client_email, whatsapp: w.client_whatsapp };
  for (const { lot, token } of queued) {
    try {
      await deliverToClient(env, client, lot, w);
      await env.DB.prepare(
        "UPDATE queue SET status = 'sent', decided_at = datetime('now') WHERE token = ?"
      ).bind(token).run();
    } catch (err) {
      console.error(`Auto-notify delivery failed (wishlist ${w.id}, lot ${lot.id}):`, err.message);
      await env.DB.prepare(
        "UPDATE queue SET status = 'failed', decided_at = datetime('now') WHERE token = ?"
      ).bind(token).run();
    }
  }
}
