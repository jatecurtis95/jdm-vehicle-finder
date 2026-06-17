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

// Build the three image sizes from the base image URL stored in `images`.
// Provider rule: thumb = &h=50, medium = &w=320, full = plain URL.
export function imageUrls(lot) {
  // The images field is one or more URLs separated by "#", sometimes already
  // carrying a size suffix (&h=50). Take the first and strip any size suffix.
  let base = (lot.images || "").split("#")[0].trim().replace(/[?&][hw]=\d+$/i, "");
  if (!base) return { thumb: null, medium: null, full: null };
  return {
    thumb: `${base}&h=50`,
    medium: `${base}&w=320`,
    full: base,
  };
}

// Best-effort numeric auction grade. Grades are usually numeric ("4", "4.5")
// but can be letters ("R", "RA", "S", "A"). Returns a number or null.
export function gradeValue(rate) {
  if (rate === null || rate === undefined) return null;
  const n = Number.parseFloat(String(rate));
  return Number.isFinite(n) ? n : null;
}
