// AI auction-sheet reader.
//
// Sends a lot's photos to the Anthropic Messages API (vision) and asks Claude to
// find the Japanese auction inspection sheet among them and extract structured
// data: overall grade, exterior (外装) and interior (内装) letters, repair marks,
// mileage and a translated condition summary. Raw `fetch` (no SDK) to stay
// dependency-free in the Worker, matching how the rest of the app calls APIs.
//
// Output is constrained with output_config.format (JSON schema) so the reply is
// always valid JSON. The result is cached onto the lot (lot._sheet) by the caller
// so each car is only read once.

import { refreshLotImages } from "./avtonet.js";

export const SHEET_MODELS = {
  "claude-opus-4-8": "Opus 4.8 - most accurate (~5¢)",
  "claude-sonnet-4-6": "Sonnet 4.6 - balanced (~2.5¢)",
  "claude-haiku-4-5": "Haiku 4.5 - cheapest (~1¢)",
};
export const DEFAULT_SHEET_MODEL = "claude-opus-4-8";

// When to run the reader. Background modes (strong/all) are capped per sweep so a
// search run can't fire off dozens of paid reads at once.
export const SHEET_AUTO_MODES = {
  off: "Manual - click the button on each car",
  open: "Auto when I open a car's page",
  strong: "Auto for Strong matches (background)",
  all: "Auto for every match (background)",
};
const SWEEP_CAP = 6;

const SCHEMA = {
  type: "json_schema",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      found: { type: "boolean", description: "true only if an auction inspection/grading sheet is visible in the images" },
      overall_grade: { type: "string", description: "overall auction grade, e.g. 4.5, R, RA, S; empty if not shown" },
      exterior: { type: "string", description: "exterior (外装) grade, a single letter A-D (A best); empty if not shown" },
      interior: { type: "string", description: "interior (内装) grade, a single letter A-E (A best); empty if not shown" },
      mileage_km: { type: "string", description: "odometer reading in km if shown on the sheet, else empty" },
      repairs: { type: "array", items: { type: "string" }, description: "notable repair, rust, dent or damage marks from the condition diagram, in plain English" },
      equipment: { type: "array", items: { type: "string" }, description: "notable equipment/options listed on the sheet, in plain English" },
      notes_en: { type: "string", description: "a concise English summary (2-4 sentences) of the inspector's condition comments" },
      sheet_index: { type: "integer", description: "0-based position, in the order the images were given, of the image that IS the inspection/grading sheet; -1 if no sheet is present" },
      cover_index: { type: "integer", description: "0-based position of the best photo to use as the listing cover - prefer a clear front three-quarter view of the whole car; never the inspection sheet, interior, engine bay or close-ups; -1 if no suitable exterior photo" },
    },
    required: ["found", "overall_grade", "exterior", "interior", "mileage_km", "repairs", "equipment", "notes_en", "sheet_index", "cover_index"],
  },
};

const PROMPT = `These photos are from a Japanese used-car auction listing, given to you in order (the first image is index 0). One of them is usually the auction inspection (grading) sheet - a form with a car condition diagram, an overall grade, exterior (外装) and interior (内装) letter grades, the odometer, and handwritten Japanese condition notes.

Do three things:
1. Find the inspection sheet and report its index as sheet_index (-1 if none).
2. Choose the best exterior photo for a listing cover and report its index as cover_index - prefer a clear front three-quarter shot of the whole car; never pick the inspection sheet, an interior, engine-bay or close-up shot.
3. Extract the sheet's data, translating Japanese to clear English. The exterior grade is the 外装 letter and the interior grade is the 内装 letter (A is best). List repair/rust/dent marks from the condition diagram.

If no inspection sheet is visible in any image, set found=false, sheet_index=-1 and leave the text fields empty (still set cover_index if there's a usable exterior photo). Report only what is actually on the sheet - do not guess.`;

// Clean full-res URLs to send to the vision model. The inspection sheet is, by
// feed convention, the FIRST image - so take the first `max`, which always
// includes the sheet even on lots with many photos.
function cleanImageUrls(images, max = 5) {
  return String(images || "")
    .split("#")
    .map((u) => u.trim().replace(/[?&][hw]=\d+$/i, ""))
    .filter(Boolean)
    .slice(0, max);
}

const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const ALLOWED_MEDIA = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // Anthropic per-image limit

// Base64-encode bytes in chunks (avoids blowing the call stack on big buffers).
function bytesToBase64(bytes) {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}

// Build a vision image block for a URL. Fetches the image server-side (browser
// UA) and sends it as base64 - many JDM auction image hosts block hotlinking /
// non-browser fetches, so handing Anthropic the raw URL often fails. Falls back
// to a URL block if our own fetch doesn't work.
async function imageBlock(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": BROWSER_UA, "Accept": "image/avif,image/webp,image/*,*/*" } });
    if (res.ok) {
      const ct = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      const media = ALLOWED_MEDIA.includes(ct) ? ct : "image/jpeg";
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length > 0 && bytes.length <= MAX_IMAGE_BYTES) {
        return { type: "image", source: { type: "base64", media_type: media, data: bytesToBase64(bytes) } };
      }
    }
  } catch (e) {
    // fall through to the URL block
  }
  return { type: "image", source: { type: "url", url } };
}

// Read the inspection sheet from a lot's images. Returns the parsed object on
// success, or { error } on failure. Never throws.
export async function readAuctionSheet(env, images, model = DEFAULT_SHEET_MODEL) {
  const key = env.ANTHROPIC_API_KEY;
  if (!key) return { error: "AI is not configured. Set the ANTHROPIC_API_KEY secret." };
  const urls = cleanImageUrls(images);
  if (!urls.length) return { error: "This lot has no photos to read." };

  const content = await Promise.all(urls.map(imageBlock));
  content.push({ type: "text", text: PROMPT });
  const body = {
    model: SHEET_MODELS[model] ? model : DEFAULT_SHEET_MODEL,
    max_tokens: 1500,
    messages: [{ role: "user", content }],
    output_config: { format: SCHEMA },
  };

  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { error: "Could not reach the AI service: " + e.message };
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) return { error: `AI error ${res.status}: ${(data && data.error && data.error.message) || "request failed"}` };
  if (!data) return { error: "The AI returned an empty response." };
  if (data.stop_reason === "refusal") return { error: "The AI declined to read this image." };
  const textBlock = (data.content || []).find((b) => b.type === "text" && b.text);
  if (!textBlock) return { error: "The AI returned no readable data." };
  let parsed;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch (e) {
    return { error: "Could not parse the AI response." };
  }
  return parsed;
}

// Background "catch up" sweep: read the inspection sheet for up to SWEEP_CAP
// pending matches that qualify for the auto mode and haven't been read yet, then
// cache the result onto each lot. Capped + concurrent so it stays well within the
// Worker's background-task budget. Called from ctx.waitUntil after a search run.
export async function sweepUnreadSheets(env, mode, model, cap = SWEEP_CAP) {
  if (!env.ANTHROPIC_API_KEY || (mode !== "strong" && mode !== "all")) return 0;
  let rows;
  try {
    rows = (await env.DB.prepare(
      "SELECT id, lot_json FROM queue WHERE status = 'pending' ORDER BY created_at DESC LIMIT 80"
    ).all()).results || [];
  } catch (e) {
    console.error("sweepUnreadSheets query failed:", e.message);
    return 0;
  }
  const targets = [];
  for (const r of rows) {
    let lot;
    try { lot = JSON.parse(r.lot_json); } catch (e) { continue; }
    if (lot._sheet) continue;                                   // already read
    if (mode === "strong" && lot._strength !== "Strong") continue;
    if (!String(lot.images || "").trim()) continue;             // no photos to read
    targets.push({ id: r.id, lot });
    if (targets.length >= cap) break;
  }
  await Promise.all(targets.map(async ({ id, lot }) => {
    const imagesChanged = await refreshLotImages(env, lot);   // pick up a sheet added since we matched
    const result = await readAuctionSheet(env, lot.images, model);
    const ok = result && !result.error;
    if (ok) lot._sheet = { ...result, read_at: new Date().toISOString() };
    if (ok || imagesChanged) {
      try {
        await env.DB.prepare("UPDATE queue SET lot_json = ? WHERE id = ?").bind(JSON.stringify(lot), id).run();
      } catch (e) {
        console.error("sweepUnreadSheets update failed for", id, e.message);
      }
    }
  }));
  return targets.length;
}

// One-click "fix all photos": read every un-read pending match, in bounded
// concurrent batches, up to `max` per click. Reading a car also tags its cover
// photo + sheet, so the cards heal. Runs in the background (ctx.waitUntil).
export async function fixAllPhotos(env, model, max = 30, batch = SWEEP_CAP) {
  if (!env.ANTHROPIC_API_KEY) return 0;
  let done = 0;
  while (done < max) {
    const n = await sweepUnreadSheets(env, "all", model, Math.min(batch, max - done));
    if (!n) break;       // no more un-read candidates
    done += n;
  }
  return done;
}

// Parse a /messages response body (already-decoded JSON) into the sheet object or
// an { error }. Exposed for unit testing the response handling without a network.
export function parseSheetResponse(res, data) {
  if (!res.ok) return { error: `AI error ${res.status}: ${(data && data.error && data.error.message) || "request failed"}` };
  if (!data) return { error: "The AI returned an empty response." };
  if (data.stop_reason === "refusal") return { error: "The AI declined to read this image." };
  const textBlock = (data.content || []).find((b) => b.type === "text" && b.text);
  if (!textBlock) return { error: "The AI returned no readable data." };
  try {
    return JSON.parse(textBlock.text);
  } catch (e) {
    return { error: "Could not parse the AI response." };
  }
}
