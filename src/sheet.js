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

export const SHEET_MODELS = {
  "claude-opus-4-8": "Opus 4.8 — most accurate (~5¢)",
  "claude-sonnet-4-6": "Sonnet 4.6 — balanced (~2.5¢)",
  "claude-haiku-4-5": "Haiku 4.5 — cheapest (~1¢)",
};
export const DEFAULT_SHEET_MODEL = "claude-opus-4-8";

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
    },
    required: ["found", "overall_grade", "exterior", "interior", "mileage_km", "repairs", "equipment", "notes_en"],
  },
};

const PROMPT = `These photos are from a Japanese used-car auction listing. One of them is usually the auction inspection (grading) sheet — a form with a car condition diagram, an overall grade, exterior (外装) and interior (内装) letter grades, the odometer, and handwritten Japanese condition notes.

Find the inspection sheet among the images and extract its data, translating Japanese to clear English. The exterior grade is the 外装 letter and the interior grade is the 内装 letter (A is best). List repair/rust/dent marks from the condition diagram. If no inspection sheet is visible in any image, set found=false and leave the other fields empty. Report only what is actually on the sheet — do not guess.`;

// Build the {thumb,medium,full} stripping logic inline: take clean full-res URLs.
function cleanImageUrls(images, max = 5) {
  return String(images || "")
    .split("#")
    .map((u) => u.trim().replace(/[?&][hw]=\d+$/i, ""))
    .filter(Boolean)
    .slice(0, max);
}

// Read the inspection sheet from a lot's images. Returns the parsed object on
// success, or { error } on failure. Never throws.
export async function readAuctionSheet(env, images, model = DEFAULT_SHEET_MODEL) {
  const key = env.ANTHROPIC_API_KEY;
  if (!key) return { error: "AI is not configured. Set the ANTHROPIC_API_KEY secret." };
  const urls = cleanImageUrls(images);
  if (!urls.length) return { error: "This lot has no photos to read." };

  const content = urls.map((url) => ({ type: "image", source: { type: "url", url } }));
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
