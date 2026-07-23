// Matcher engine: turn a wishlist into a filtered SQL query against the live
// `main` feed, fetch candidates, refine in code, dedupe, and queue new matches.

import { query, sqlLike, sqlInt, sqlNum, gradeValue } from "./avtonet.js";
import { deliverToClient } from "./notify.js";
import { attachLanded } from "./calc.js";
import { getSettings, settingNum } from "./settings.js";

// Parse a wishlist's stored grades list: a JSON array string (the canonical
// form) or a legacy pipe-separated string. Returns up to 8 trimmed entries.
export function parseGrades(raw) {
  const s = String(raw || "").trim();
  if (!s) return [];
  let list = [];
  if (s.startsWith("[")) {
    try { list = JSON.parse(s); } catch (e) { list = []; }
  } else {
    list = s.split("|");
  }
  return (Array.isArray(list) ? list : [])
    .map((g) => String(g || "").trim()).filter(Boolean).slice(0, 8);
}

// Build the SQL for one wishlist. Only upcoming auctions, filtered by the
// numeric/text criteria we can express in SQL. Grade is refined in code
// afterwards because grades can be non-numeric.
export function buildSql(w) {
  const where = [];

  // Only lots whose auction is still in the future.
  where.push("auction_date >= NOW()");

  // RHD as standard: Australia-bound imports must be right-hand drive, so
  // left-hand-drive lots (lhdrive = 1) never match. The feed marks RHD as '0'
  // (or leaves the field empty), both of which pass this test.
  where.push("(lhdrive IS NULL OR lhdrive <> 1)");

  if (w.marka_name) {
    // Best-match on the primary brand word so "Mercedes" / "Mercedes-Benz" both
    // catch the feed's "MERCEDES BENZ" AND "MERCEDES AMG" (where cars like the
    // E55 live). Falls back to the whole string if it's a single token.
    const mk = sqlLike(w.marka_name).toUpperCase().split(/[\s\-]+/).filter(Boolean)[0];
    if (mk) where.push(`UPPER(marka_name) LIKE '%${mk}%'`);
  }
  if (w.model_name) {
    // Match the model term against the trim/grade column too. Feed models are
    // broad family names ("S CLASS" covers every variant), so a wishlist for a
    // specific variant ("S400", "GT-R NISMO") lives in the feed's `grade` trim
    // string, not model_name. OR-ing keeps broad terms working unchanged.
    const md = sqlLike(w.model_name).toUpperCase();
    where.push(`(UPPER(model_name) LIKE '%${md}%' OR UPPER(grade) LIKE '%${md}%')`);
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
  const mileageMin = sqlInt(w.mileage_min);
  if (mileageMin !== null && mileageMin > 0) where.push(`(mileage >= ${mileageMin})`);

  if (w.kuzov) {
    where.push(`UPPER(kuzov) LIKE '%${sqlLike(w.kuzov).toUpperCase()}%'`);
  }
  if (w.grade_kw) {
    where.push(`UPPER(grade) LIKE '%${sqlLike(w.grade_kw).toUpperCase()}%'`);
  }
  // V1.2 Phase 4: model_code narrows on the feed's chassis/model-code column
  // (same contains-match as kuzov); grades is a stored list of grade spellings
  // OR-ed together, because auction houses write the same real grade many
  // ways. Both are additive: wishlists without them build identical SQL.
  if (w.model_code) {
    where.push(`UPPER(kuzov) LIKE '%${sqlLike(w.model_code).toUpperCase()}%'`);
  }
  const gradeList = parseGrades(w.grades);
  if (gradeList.length) {
    where.push(`(${gradeList.map((g) => `UPPER(grade) LIKE '%${sqlLike(g).toUpperCase()}%'`).join(" OR ")})`);
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
  if (w.grade_kw || w.kuzov || w.model_code || parseGrades(w.grades).length) score += 0.6;
  if (grade !== null && grade >= 4.5) score += 0.4;
  return score;
}

// Bucket a score into a labelled strength with its brand colour.
export function strengthFor(score) {
  if (score >= 1.3) return { label: "Strong", color: "#46B17A" };
  if (score >= 0.6) return { label: "Good", color: "#C98A00" };
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

// V1.3: landed-cost-aware budget filter. Runs AFTER attachLanded, so each lot
// carries a REAL all-in landed estimate (_landed.grandTotal, in AUD) rather than
// the rough JPY conversion we deliberately never store. Drops matches that land
// clearly over the customer's stated AUD budget, keeping a headroom margin so
// borderline-affordable cars still surface. Two safety rails: it is a no-op when
// the wishlist has no budget, and any lot WITHOUT a computed estimate is always
// kept (an unknown cost is never treated as over budget).
export function withinBudget(lots, budgetAud, headroomPct = 10) {
  const budget = Number(budgetAud) || 0;
  if (budget <= 0) return lots;
  const pct = Number(headroomPct);
  const ceiling = budget * (1 + (Number.isFinite(pct) ? pct : 10) / 100);
  return lots.filter((lot) => {
    const landed = lot._landed && Number(lot._landed.grandTotal);
    return !(landed > 0) || landed <= ceiling;
  });
}

// Run one wishlist end to end. Returns the list of newly-queued lot ids.
// opts.budgetFilter (default true) and opts.budgetHeadroom (default 10, percent)
// tune the landed-cost budget filter; runAll passes the live Settings values.
export async function runWishlist(env, wishlist, opts = {}) {
  // Safety: a wishlist with no make / model / chassis / grade term would match
  // the whole feed, so skip it. The create form also blocks saving one this broad.
  if (!(wishlist.marka_name || wishlist.model_name || wishlist.kuzov || wishlist.grade_kw || wishlist.model_code)) return [];
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

  // Anti-flood: never let one wishlist sit on more than 40 pending matches.
  // (Keeps a broad search from burying the review queue over many runs.)
  const pendingRow = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM queue WHERE wishlist_id = ? AND status = 'pending'"
  ).bind(wishlist.id).first();
  const room = Math.max(0, 40 - (pendingRow?.n || 0));
  if (room <= 0) return [];
  // Estimate every fresh candidate before applying the queue-capacity slice.
  // If we sliced first, a partially full queue could repeatedly inspect the same
  // over-budget leaders and permanently starve affordable candidates behind them.
  // The feed query caps this batch at 25, so the calculator work remains bounded.
  await attachLanded(env, fresh.map((lot) => ({ lot, client: { state: wishlist.client_state } })));
  const eligible = opts.budgetFilter === false
    ? fresh
    : withinBudget(fresh, wishlist.budget_aud, opts.budgetHeadroom);
  const affordable = eligible.slice(0, room);
  // Tag watch-only "lead" matches: they surface for a follow-up call but the
  // client is never auto-emailed, even on approval.
  for (const lot of affordable) lot._watch = wishlist.watch_only ? 1 : 0;

  const candidatesToQueue = [];
  const stmts = [];
  for (const lot of affordable) {
    const token = crypto.randomUUID().replace(/-/g, "");
    // Enqueue-and-claim in one transaction so two concurrent matcher runs can
    // never queue the same lot twice. `getSeen` above filters lots this run
    // already knows about, but a second run that started before this one wrote
    // its seen_lots row would still see the lot as fresh. The queue insert is
    // therefore gated on the lot NOT already being claimed in seen_lots, and the
    // seen_lots claim (PRIMARY KEY (wishlist_id, lot_id)) is written in the SAME
    // batch. D1 batches run as a serialized transaction, so the losing run's
    // queue insert finds the winner's committed seen_lots row and no-ops.
    stmts.push(
      env.DB.prepare(
        `INSERT INTO queue (wishlist_id, client_id, lot_id, lot_json, token)
         SELECT ?, ?, ?, ?, ?
         WHERE NOT EXISTS (SELECT 1 FROM seen_lots WHERE wishlist_id = ? AND lot_id = ?)`
      ).bind(wishlist.id, wishlist.client_id, lot.id, JSON.stringify(lot), token, wishlist.id, lot.id)
    );
    stmts.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO seen_lots (wishlist_id, lot_id) VALUES (?, ?)`
      ).bind(wishlist.id, lot.id)
    );
    candidatesToQueue.push({ lot, token });
  }
  // One batched round-trip instead of many writes. Each lot contributes two
  // statements (queue insert, then seen claim); the queue insert's `changes`
  // tells us whether THIS run actually queued the lot or lost the race, so the
  // digest and auto-delivery only ever act on rows we truly inserted.
  const queued = [];
  if (stmts.length) {
    const results = await env.DB.batch(stmts);
    candidatesToQueue.forEach((item, i) => {
      const changes = Number(results?.[i * 2]?.meta?.changes) || 0;
      if (changes > 0) queued.push(item);
    });
  }
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
export async function runAll(env, session) {
  const isAgent = session && session.role === "agent";
  // V1.3 (decided): Run Searches covers free-tier customers' searches by
  // default (run_includes_free = "1"). Set it to "0" in Settings to run
  // members' searches only. Wishlist SELECTION only; the matching logic below
  // is untouched either way.
  let membersOnly = false;
  let budgetFilter = true;
  let budgetHeadroom = 10;
  try {
    const s = await getSettings(env);
    membersOnly = s.run_includes_free === "0";
    budgetFilter = s.budget_filter !== "0";
    budgetHeadroom = settingNum(s, "budget_headroom_pct", 10);
  } catch (e) { /* defaults: include free, filter on, 10% headroom */ }
  const stmt = env.DB.prepare(
    `SELECT w.*, c.name AS client_name, c.email AS client_email, c.whatsapp AS client_whatsapp, c.state AS client_state,
            c.agent_id AS client_agent_id, ag.email AS agent_email, ag.name AS agent_name, ag.alerts AS agent_alerts, ag.active AS agent_active
     FROM searches w JOIN users c ON c.id = w.client_id
     LEFT JOIN users ag ON ag.id = c.agent_id AND ag.type = 'agent'
     WHERE w.active = 1${membersOnly ? " AND c.member = 1" : ""}${isAgent ? " AND (c.agent_id = ? OR c.id IN (SELECT client_id FROM client_shares WHERE agent_id = ?))" : ""}`
  );
  const wl = await (isAgent ? stmt.bind(session.id, session.id) : stmt).all();

  const summary = [];
  for (const w of wl.results || []) {
    try {
      const queued = await runWishlist(env, w, { budgetFilter, budgetHeadroom });
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

// Run a SINGLE active wishlist on demand (manual per-search trigger, Phase 5).
// Reuses runAll's client/agent joins so autoDeliver/digest fields are present.
// ownerClientId, when set, scopes to that client's own searches (portal button);
// staff pass none. watch_only rows are watchlist bookmarks, not match searches,
// so they are refused. Returns { ok, queued, wishlist, notFound?, watchOnly? }.
export async function runOneWishlist(env, wishlistId, { ownerClientId = null } = {}) {
  let budgetFilter = true;
  let budgetHeadroom = 10;
  try {
    const s = await getSettings(env);
    budgetFilter = s.budget_filter !== "0";
    budgetHeadroom = settingNum(s, "budget_headroom_pct", 10);
  } catch (e) { /* defaults: filter on, 10% headroom */ }
  const stmt = env.DB.prepare(
    `SELECT w.*, c.name AS client_name, c.email AS client_email, c.whatsapp AS client_whatsapp, c.state AS client_state,
            c.agent_id AS client_agent_id, ag.email AS agent_email, ag.name AS agent_name, ag.alerts AS agent_alerts, ag.active AS agent_active
     FROM searches w JOIN users c ON c.id = w.client_id
     LEFT JOIN users ag ON ag.id = c.agent_id AND ag.type = 'agent'
     WHERE w.id = ? AND w.active = 1${ownerClientId ? " AND w.client_id = ?" : ""}`
  );
  const w = await (ownerClientId ? stmt.bind(wishlistId, ownerClientId) : stmt.bind(wishlistId)).first();
  if (!w) return { ok: false, notFound: true, queued: 0 };
  if (w.watch_only) return { ok: false, watchOnly: true, queued: 0 };
  let queued = [];
  try {
    queued = await runWishlist(env, w, { budgetFilter, budgetHeadroom });
  } catch (err) {
    console.error(`Manual run wishlist ${w.id} failed:`, err.message);
    return { ok: false, error: true, queued: 0, wishlist: w };
  }
  if (queued.length && w.auto_notify) {
    try { await autoDeliver(env, w, queued); } catch (e) { console.error(`autoDeliver ${w.id}:`, e.message); }
  }
  return { ok: true, queued: queued.length, wishlist: w };
}

// Free-tier welcome: the moment a buyer signs up, find their best live match(es)
// and send them straight away as a first taste of the service. The count is
// capped by the `free_result_limit` setting (default 1); the paywall/upsell for
// unlimited lives on the confirmation page and in the portal. Best-effort - it
// never throws, so a signup always completes even if the search or send fails.
// Returns { found, emailed, count, lot } for the confirmation page to render.
export async function sendWelcomeMatch(env, wishlistId) {
  const none = { found: false, emailed: false, count: 0, lot: null };
  try {
    const w = await env.DB.prepare(
      `SELECT w.*, c.id AS client_id, c.name AS client_name, c.email AS client_email,
              c.whatsapp AS client_whatsapp, c.state AS client_state
         FROM searches w JOIN users c ON c.id = w.client_id
        WHERE w.id = ?`
    ).bind(wishlistId).first();
    // A wishlist with no real search term would match the whole feed, so skip it.
    if (!w || !(w.marka_name || w.model_name || w.kuzov || w.grade_kw || w.model_code)) return none;

    const candidates = refine(await query(env, buildSql(w)), w).filter((l) => l.id);
    if (!candidates.length) return none;
    for (const lot of candidates) lot._score = scoreMatch(lot, w);
    candidates.sort((a, b) => b._score - a._score);

    const settings = await getSettings(env);
    const limit = Math.max(1, settingNum(settings, "free_result_limit", 1));
    // Landed-cost estimate is a nice-to-have; never let it abort the welcome.
    // Attach it before the budget gate so the same real all-in figure the cron
    // uses also keeps the welcome match inside the customer's stated budget.
    try {
      await attachLanded(env, candidates.map((lot) => ({ lot, client: { state: w.client_state } })));
    } catch (e) { /* estimate unavailable - send without it */ }
    const affordable = settings.budget_filter === "0"
      ? candidates
      : withinBudget(candidates, w.budget_aud, settingNum(settings, "budget_headroom_pct", 10));
    if (!affordable.length) return none;
    const picks = affordable.slice(0, limit);
    for (const lot of picks) {
      const st = strengthFor(lot._score);
      lot._strength = st.label; lot._strengthColor = st.color; lot._watch = 0;
    }

    const client = { id: w.client_id, name: w.client_name, email: w.client_email, whatsapp: w.client_whatsapp, state: w.client_state };
    let emailed = 0;
    for (const lot of picks) {
      const token = crypto.randomUUID().replace(/-/g, "");
      // Gate on seen_lots so a double-submitted signup (or a cron run firing at
      // the same moment) can't queue or email the same welcome match twice.
      const ins = await env.DB.prepare(
        `INSERT INTO queue (wishlist_id, client_id, lot_id, lot_json, token)
         SELECT ?, ?, ?, ?, ?
         WHERE NOT EXISTS (SELECT 1 FROM seen_lots WHERE wishlist_id = ? AND lot_id = ?)`
      ).bind(w.id, w.client_id, lot.id, JSON.stringify(lot), token, w.id, lot.id).run();
      if (!(Number(ins?.meta?.changes) > 0)) continue;
      await env.DB.prepare(`INSERT OR IGNORE INTO seen_lots (wishlist_id, lot_id) VALUES (?, ?)`).bind(w.id, lot.id).run();
      let sent = false;
      try {
        const r = await deliverToClient(env, client, lot, w);
        sent = !!(r && r.email);
      } catch (e) {
        console.error(`Welcome match send failed (wishlist ${w.id}, lot ${lot.id}):`, e.message);
      }
      // Mark sent only if it actually went out; otherwise it stays 'pending' in
      // the normal staff review queue so the lead is never lost.
      if (sent) {
        emailed++;
        await env.DB.prepare("UPDATE queue SET status = 'sent', decided_at = datetime('now') WHERE token = ?").bind(token).run();
      }
    }
    return { found: true, emailed: emailed > 0, count: picks.length, lot: picks[0] };
  } catch (e) {
    console.error(`sendWelcomeMatch failed (wishlist ${wishlistId}):`, e.message);
    return none;
  }
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
