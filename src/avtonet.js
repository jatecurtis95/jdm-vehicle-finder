// AVTONET SQL API client.
//
// The provider exposes the live auction feed as a SQL-over-HTTP gateway:
//   <API_BASE>?code=<CODE>&sql=<SELECT ...>
// It only permits SELECTs against two tables: `main` (live lots) and `stats`
// (historical sold results). It returns XML like:
//   <aj><row><id>..</id><marka_name>TOYOTA</marka_name>...</row></aj>
//
// Provider rules we honour: query with filters each run, never mirror the
// whole table locally. We only cache individual lots and lookup lists.

// Columns confirmed live from `select * from main where id=...`
export const MAIN_COLUMNS = [
  "id", "lot", "auction_type", "auction_date", "auction",
  "marka_id", "model_id", "marka_name", "model_name", "year",
  "town", "eng_v", "pw", "kuzov", "grade", "color",
  "kpp", "kpp_type", "priv", "mileage", "equip", "rate",
  "start", "finish", "status", "time", "avg_price", "avg_string",
  "lhdrive", "images", "serial", "info",
];

// Escape a string value for safe inclusion in a single-quoted SQL literal.
// Doubles single quotes and strips characters that could break out of the
// SELECT context. The gateway only allows SELECT on main/stats, but we keep
// inputs clean regardless.
export function sqlString(value) {
  return String(value)
    .replace(/[;\\]/g, " ")   // no statement separators or escapes
    .replace(/--/g, " ")       // no SQL comments
    .replace(/'/g, "''")       // escape quotes
    .trim();
}

// Coerce to a safe integer or return null.
export function sqlInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

// Coerce to a safe number or return null.
export function sqlNum(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Run a raw SELECT via the relay and return parsed rows (array of objects).
// The SQL is base64-encoded into the `q` param so website firewalls (Wordfence
// etc.) don't see SQL keywords in the URL and block the request.
export async function query(env, sql) {
  const q = btoa(sql);
  const url = `${env.API_BASE}?code=${encodeURIComponent(env.AVTONET_CODE)}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  const text = await res.text();
  if (!res.ok) {
    // Include the body so we can see *why* (e.g. firewall block vs IP block).
    throw new Error(`AVTONET API HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return parseRows(text);
}

// Parse the <aj><row>...</row></aj> XML into plain objects.
// Lightweight regex parser (Workers have no DOMParser); the feed is simple,
// flat, one level of tags inside each <row>.
export function parseRows(xml) {
  if (!xml || typeof xml !== "string") return [];
  // Detect API-level errors returned as plain text.
  const trimmed = xml.trim();
  if (!trimmed.startsWith("<")) {
    throw new Error(`AVTONET API error: ${trimmed.slice(0, 200)}`);
  }
  const rows = [];
  const rowRe = /<row>([\s\S]*?)<\/row>/g;
  let rowMatch;
  while ((rowMatch = rowRe.exec(xml)) !== null) {
    const inner = rowMatch[1];
    const obj = {};
    const fieldRe = /<([a-zA-Z0-9_]+)>([\s\S]*?)<\/\1>/g;
    let f;
    while ((f = fieldRe.exec(inner)) !== null) {
      // Normalise field names to lowercase: the API returns lowercase tags for
      // some queries and UPPERCASE for others. Code reads lowercase keys.
      obj[f[1].toLowerCase()] = decodeEntities(f[2]).trim();
    }
    rows.push(obj);
  }
  return rows;
}

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// Split a lot's images into the inspection sheet and the car photos.
//
// If the AI reader has run (lot._sheet), trust its sheet_index and cover_index
// (positions into the image list) — that's the reliable signal. Otherwise fall
// back to the feed convention that the FIRST image is the inspection sheet.
// photos[0] is the lead/cover photo (the AI's front-3/4 pick when available).
// Returns clean base URLs (any size suffix stripped).
export function splitImages(lot) {
  const bases = String((lot && lot.images) || "")
    .split("#")
    .map((u) => u.trim().replace(/[?&][hw]=\d+$/i, ""))
    .filter(Boolean);
  const ai = lot && lot._sheet;
  const inRange = (n) => Number.isInteger(n) && n >= 0 && n < bases.length;

  // The auction house's initial upload is just [front, rear] (sometimes a third
  // interior shot) — the inspection sheet only arrives later, as part of a fuller
  // set. So image[0] is the FRONT photo on those small snapshots, not a sheet.
  // Blindly treating it as the sheet dropped the front and showed the REAR as the
  // cover. Only fall back to the "first image is the sheet" convention once the
  // set is large enough to plausibly contain one; trust the AI's index otherwise.
  const MIN_IMAGES_FOR_SHEET = 4;

  let sheetIdx = -1;
  if (ai && inRange(ai.sheet_index)) sheetIdx = ai.sheet_index;          // AI-identified
  else if (!(ai && ai.found === false) && bases.length >= MIN_IMAGES_FOR_SHEET) sheetIdx = 0; // convention (full set only)

  const sheet = sheetIdx >= 0 ? bases[sheetIdx] : null;
  let photos = sheetIdx >= 0 ? bases.filter((_, i) => i !== sheetIdx) : bases.slice();

  // Promote the AI's chosen cover (front 3/4) to the front of the gallery.
  if (ai && inRange(ai.cover_index) && ai.cover_index !== sheetIdx) {
    const cover = bases[ai.cover_index];
    photos = [cover, ...photos.filter((u) => u !== cover)];
  }
  return { sheet, photos };
}

// Build the three image sizes for the lot's lead CAR photo — used for card and
// email thumbnails. Skips the inspection sheet so listings show the car, not the
// handwritten form. Provider rule: thumb = &h=50, medium = &w=320, full = plain.
export function imageUrls(lot) {
  const base = splitImages(lot).photos[0] || null;
  if (!base) return { thumb: null, medium: null, full: null };
  return {
    thumb: `${base}&h=50`,
    medium: `${base}&w=320`,
    full: base,
  };
}

// Free-form search over the live `main` feed for the member auction page.
// Returns { lots, page, perPage, hasMore }. Upcoming auctions only, soonest
// first. All inputs are escaped/coerced; the gateway only permits SELECT.
export async function searchLots(env, p = {}) {
  const where = ["auction_date >= NOW()"];
  const make = String(p.make || "").trim();
  if (make) {
    const mk = sqlString(make).toUpperCase().split(/[\s-]+/).filter(Boolean)[0];
    if (mk) where.push(`UPPER(marka_name) LIKE '%${mk}%'`);
  }
  const model = String(p.model || "").trim();
  if (model) where.push(`UPPER(model_name) LIKE '%${sqlString(model).toUpperCase()}%'`);
  const yMin = sqlInt(p.yearMin); if (yMin !== null) where.push(`year >= ${yMin}`);
  const yMax = sqlInt(p.yearMax); if (yMax !== null) where.push(`year <= ${yMax}`);
  const pMax = sqlInt(p.priceMax); if (pMax !== null) where.push(`((start > 0 AND start <= ${pMax}) OR start <= 0)`);
  const gMin = sqlNum(p.gradeMin); if (gMin !== null) where.push(`rate >= ${gMin}`);
  const kuzov = String(p.kuzov || "").trim();
  if (kuzov) where.push(`UPPER(kuzov) LIKE '%${sqlString(kuzov).toUpperCase()}%'`);
  const house = String(p.house || "").trim();
  if (house) where.push(`UPPER(auction) LIKE '%${sqlString(house).toUpperCase()}%'`);
  // Free-text search bar: every whitespace token must match some field, so
  // "nissan skyline" narrows on make AND model; a bare lot number matches lot.
  const qStr = String(p.q || "").trim();
  if (qStr) {
    for (const t of qStr.split(/\s+/).filter(Boolean).slice(0, 4)) {
      const s = sqlString(t).toUpperCase();
      if (!s) continue;
      where.push(`(UPPER(marka_name) LIKE '%${s}%' OR UPPER(model_name) LIKE '%${s}%' OR UPPER(kuzov) LIKE '%${s}%' OR UPPER(lot) LIKE '%${s}%')`);
    }
  }

  const perPage = 24;
  const page = Math.max(1, sqlInt(p.page) || 1);
  const offset = (page - 1) * perPage;
  const sql = `SELECT * FROM main WHERE ${where.join(" AND ")} ORDER BY auction_date ASC LIMIT ${offset}, ${perPage}`;
  let lots = [];
  try {
    lots = await query(env, sql);
  } catch (e) {
    console.error("searchLots failed:", e.message);
  }
  return { lots, page, perPage, hasMore: lots.length === perPage };
}

// Browse the historical `stats` table (sold auction results) for the member
// "Sold auctions" page. Mirrors searchLots but reads sold rows, orders newest
// sold first, and filters the sold-price ceiling on `finish` (the hammer price).
// Returns { lots, page, perPage, hasMore }.
export async function searchSold(env, p = {}) {
  const where = ["finish > 0"];
  const make = String(p.make || "").trim();
  if (make) {
    const mk = sqlString(make).toUpperCase().split(/[\s-]+/).filter(Boolean)[0];
    if (mk) where.push(`UPPER(marka_name) LIKE '%${mk}%'`);
  }
  const model = String(p.model || "").trim();
  if (model) where.push(`UPPER(model_name) LIKE '%${sqlString(model).toUpperCase()}%'`);
  const yMin = sqlInt(p.yearMin); if (yMin !== null) where.push(`year >= ${yMin}`);
  const yMax = sqlInt(p.yearMax); if (yMax !== null) where.push(`year <= ${yMax}`);
  const pMax = sqlInt(p.priceMax); if (pMax !== null) where.push(`finish <= ${pMax}`);
  const gMin = sqlNum(p.gradeMin); if (gMin !== null) where.push(`rate >= ${gMin}`);
  const kuzov = String(p.kuzov || "").trim();
  if (kuzov) where.push(`UPPER(kuzov) LIKE '%${sqlString(kuzov).toUpperCase()}%'`);
  const house = String(p.house || "").trim();
  if (house) where.push(`UPPER(auction) LIKE '%${sqlString(house).toUpperCase()}%'`);
  const qStr = String(p.q || "").trim();
  if (qStr) {
    for (const t of qStr.split(/\s+/).filter(Boolean).slice(0, 4)) {
      const s = sqlString(t).toUpperCase();
      if (!s) continue;
      where.push(`(UPPER(marka_name) LIKE '%${s}%' OR UPPER(model_name) LIKE '%${s}%' OR UPPER(kuzov) LIKE '%${s}%' OR UPPER(lot) LIKE '%${s}%')`);
    }
  }

  const perPage = 24;
  const page = Math.max(1, sqlInt(p.page) || 1);
  const offset = (page - 1) * perPage;
  const sql = `SELECT * FROM stats WHERE ${where.join(" AND ")} ORDER BY auction_date DESC LIMIT ${offset}, ${perPage}`;
  let lots = [];
  try {
    lots = await query(env, sql);
  } catch (e) {
    console.error("searchSold failed:", e.message);
  }
  return { lots, page, perPage, hasMore: lots.length === perPage };
}

// Re-fetch a single lot's live row from the feed: live `main` first, then the
// historical `stats` table (a sold lot moves out of main). Returns the row
// object or null. Throws if the feed is unreachable — callers decide how to
// degrade. Mirrors how the dealer portal reads a single lot on demand.
export async function fetchLot(env, id) {
  const safe = sqlString(id);
  if (!safe) return null;
  let rows = await query(env, `SELECT * FROM main WHERE id='${safe}'`);
  if (!rows.length) rows = await query(env, `SELECT * FROM stats WHERE id='${safe}'`);
  return rows[0] || null;
}

// Refresh a cached lot's image set from the live feed. Upcoming lots are often
// listed before the auction house uploads the inspection sheet, so a snapshot
// taken at match time can be missing it. Mutates lot.images in place and returns
// true if it changed. Never throws — a feed outage just leaves the cached set.
export async function refreshLotImages(env, lot) {
  if (!lot || !lot.id) return false;
  try {
    const fresh = await fetchLot(env, lot.id);
    const next = fresh && String(fresh.images || "").trim();
    if (next && next !== lot.images) {
      lot.images = next;
      return true;
    }
  } catch (e) {
    console.error("refreshLotImages failed:", e.message);
  }
  return false;
}

// --- Lookup lists for the form dropdowns ------------------------------------
// Provider rule explicitly allows caching lookup lists. Cached per isolate so
// the dropdowns don't re-query the feed on every page load.
const LOOKUP_TTL = 12 * 60 * 60 * 1000; // 12h
let _makersCache = { list: null, exp: 0 };
const _modelsCache = new Map(); // makerUpper -> { list, exp }

// Distinct makers currently in the live feed, sorted. Falls back to the last
// good cache (or []) if the feed is unreachable.
export async function distinctMakers(env) {
  const now = Date.now();
  if (_makersCache.list && now < _makersCache.exp) return _makersCache.list;
  try {
    const rows = await query(env, "SELECT DISTINCT marka_name FROM main WHERE marka_name <> '' ORDER BY marka_name");
    const list = [...new Set(rows.map((r) => (r.marka_name || "").trim()).filter(Boolean))];
    if (list.length) {
      _makersCache = { list, exp: now + LOOKUP_TTL };
      return list;
    }
  } catch (e) {
    console.error("distinctMakers failed:", e.message);
  }
  return _makersCache.list || [];
}

// Distinct models for a maker in the live feed, sorted.
export async function distinctModels(env, maker) {
  const key = String(maker || "").trim().toUpperCase();
  if (!key) return [];
  const now = Date.now();
  const cached = _modelsCache.get(key);
  if (cached && now < cached.exp) return cached.list;
  try {
    const rows = await query(
      env,
      `SELECT DISTINCT model_name FROM main WHERE UPPER(marka_name) = '${sqlString(maker).toUpperCase()}' AND model_name <> '' ORDER BY model_name`
    );
    const list = [...new Set(rows.map((r) => (r.model_name || "").trim()).filter(Boolean))];
    _modelsCache.set(key, { list, exp: now + LOOKUP_TTL });
    return list;
  } catch (e) {
    console.error("distinctModels failed:", e.message);
    return (cached && cached.list) || [];
  }
}

// Distinct auction houses in the live feed, sorted. Powers the "All houses"
// filter on the auction search. Cached like the maker/model lookups.
let _housesCache = { list: null, exp: 0 };
export async function distinctHouses(env) {
  const now = Date.now();
  if (_housesCache.list && now < _housesCache.exp) return _housesCache.list;
  try {
    const rows = await query(env, "SELECT DISTINCT auction FROM main WHERE auction <> '' ORDER BY auction");
    const list = [...new Set(rows.map((r) => (r.auction || "").trim()).filter(Boolean))];
    if (list.length) {
      _housesCache = { list, exp: now + LOOKUP_TTL };
      return list;
    }
  } catch (e) {
    console.error("distinctHouses failed:", e.message);
  }
  return _housesCache.list || [];
}

// Best-effort numeric auction grade. Grades are usually numeric ("4", "4.5")
// but can be letters ("R", "RA", "S", "A"). Returns a number or null.
export function gradeValue(rate) {
  if (rate === null || rate === undefined) return null;
  const n = Number.parseFloat(String(rate));
  return Number.isFinite(n) ? n : null;
}
