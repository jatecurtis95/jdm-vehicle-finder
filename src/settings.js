// Editable runtime settings (key/value in D1), so behaviour can be toggled from
// the admin Settings page without a redeploy. Booleans are stored as "1"/"0".

import { DEFAULT_SHEET_MODEL, SHEET_MODELS, SHEET_AUTO_MODES } from "./sheet.js";

const DEFAULTS = {
  ai_sheet_model: DEFAULT_SHEET_MODEL, // Claude model for the AI auction-sheet reader
  ai_sheet_auto: "off",  // when to read sheets: off (manual) | open | strong | all
  market_for_clients: "0", // show the recent market-average price to clients in the portal
  digest_email: "",      // alert recipient; blank = fall back to env.DIGEST_EMAIL
  email_alerts: "1",     // send the staff digest email when matches are found
  send_to_client: "1",   // email the client when a match is approved
  client_landed: "1",    // include the landed-cost figure in client emails
  request_alerts: "1",   // email admin when a customer submits the public request form
  stripe_enabled: "0",   // show the "Pay deposit" button in the buyer portal
  stripe_deposit_aud: "", // deposit amount in AUD dollars (e.g. "500"); blank = off
  stripe_currency: "aud", // Checkout currency
  // Membership pricing scaffolding (Stage 0). No live billing yet: these are the
  // numbers the public pricing page and the Stripe subscription products will
  // read in Stage 2, kept here so they are tunable without a redeploy.
  importer_monthly_aud: "19",  // Importer plan, A$ per month
  importer_annual_aud: "190",  // Importer plan, A$ per year
  founding_monthly_aud: "12",  // founding price, locked for life, A$ per month
  founding_seats: "100",       // how many founding memberships exist (seat cap)
  founding_claimed: "0",       // founding seats taken so far (advanced in Stage 2)
  free_result_limit: "1",      // upcoming matches a free/logged-out user sees per search
};

export async function getSettings(env) {
  const map = { ...DEFAULTS };
  try {
    const rows = (await env.DB.prepare("SELECT key, value FROM settings").all()).results || [];
    for (const r of rows) if (r.key in map) map[r.key] = r.value;
  } catch (e) {
    console.error("getSettings failed, using defaults:", e.message);
  }
  return map;
}

export function settingOn(settings, key) {
  return settings[key] === "1" || settings[key] === true;
}

// Read a numeric setting with a finite fallback (handles unset/empty/NaN and
// allows a legitimate 0). Used for pricing, seat caps and the free-result limit.
export function settingNum(settings, key, fallback = 0) {
  const raw = settings?.[key];
  // Treat unset/blank as the fallback. Number("") is 0, which would otherwise
  // turn an empty setting into a real zero.
  if (raw === undefined || raw === null || String(raw).trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

// The effective alert recipient: the saved address, else the env fallback.
export function digestRecipient(settings, env) {
  return (settings.digest_email && settings.digest_email.trim()) || env.DIGEST_EMAIL;
}

// Save the Settings form. Checkboxes are "on" when present, off when absent.
// Coerce a form value to a clean non-negative number string, or a default when
// blank/invalid. Keeps pricing/seat-cap settings tidy. (founding_claimed is
// system-managed and deliberately not written from the settings form.)
function posIntStr(v, dflt) {
  const n = Math.max(0, Math.floor(Number(String(v ?? "").trim())));
  return Number.isFinite(n) && String(v ?? "").trim() !== "" ? String(n) : dflt;
}

export async function saveSettings(env, form) {
  const next = {
    digest_email: String(form.get("digest_email") || "").trim(),
    email_alerts: form.get("email_alerts") ? "1" : "0",
    send_to_client: form.get("send_to_client") ? "1" : "0",
    client_landed: form.get("client_landed") ? "1" : "0",
    request_alerts: form.get("request_alerts") ? "1" : "0",
    market_for_clients: form.get("market_for_clients") ? "1" : "0",
    stripe_enabled: form.get("stripe_enabled") ? "1" : "0",
    stripe_deposit_aud: posIntStr(form.get("stripe_deposit_aud"), ""),
    stripe_currency: (String(form.get("stripe_currency") || "aud").trim().toLowerCase()) || "aud",
    importer_monthly_aud: posIntStr(form.get("importer_monthly_aud"), "19"),
    importer_annual_aud: posIntStr(form.get("importer_annual_aud"), "190"),
    founding_monthly_aud: posIntStr(form.get("founding_monthly_aud"), "12"),
    founding_seats: posIntStr(form.get("founding_seats"), "100"),
    free_result_limit: posIntStr(form.get("free_result_limit"), "1"),
    ai_sheet_model: SHEET_MODELS[form.get("ai_sheet_model")] ? String(form.get("ai_sheet_model")) : DEFAULT_SHEET_MODEL,
    ai_sheet_auto: SHEET_AUTO_MODES[form.get("ai_sheet_auto")] ? String(form.get("ai_sheet_auto")) : "off",
  };
  const stmts = Object.entries(next).map(([k, v]) =>
    env.DB.prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).bind(k, v)
  );
  await env.DB.batch(stmts);
}
