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
  whatsapp_enabled: "0", // also WhatsApp the match to clients who gave a number
  whatsapp_provider: "twilio", // which provider to send through: twilio | meta
  // SMS delivery channel (Phase 4). Default OFF; wired end to end (schema, staff
  // UI and Twilio send path) so it can be switched on later without a rebuild.
  sms_enabled: "0",      // also SMS the match to clients who gave a number (Twilio)
  client_landed: "1",    // include the landed-cost figure in client emails
  request_alerts: "1",   // email admin when a customer submits the public request form
  stripe_enabled: "0",   // show the "Pay deposit" button in the buyer portal
  stripe_deposit_aud: "", // deposit amount in AUD dollars (e.g. "500"); blank = off
  stripe_currency: "aud", // Checkout currency
  // Membership: one paid plan ("Full access"), billed monthly via Stripe. The
  // price is tunable here without a redeploy; turn membership_enabled on (with a
  // Stripe key set) to show the Subscribe button in the buyer portal.
  membership_enabled: "0",      // show the "Full access" subscribe button in the portal
  membership_monthly_aud: "49", // Full access plan, A$ per month
  free_result_limit: "1",       // (reserved) free-tier result cap, not yet enforced
  free_search_limit: "1",       // active saved searches allowed on a free account (V1.3 Phase C)
  // DECIDED (V1.3, Jate 07/07/2026): free-account matches are MANUALLY REVIEWED
  // before sending, not auto-sent. Quality control was the whole point of the
  // V1.x feedback, so staff vet a match before it reaches a customer. No
  // instant welcome match on signup. Editable in Settings; set "1" to auto-send.
  free_auto_send: "0",
  // DECIDED (V1.3, Jate 07/07/2026): "Run Searches" INCLUDES free-tier
  // customers' searches. Free users are leads to convert, so we run their
  // searches and show them value. Editable in Settings; set "0" for members only.
  run_includes_free: "1",
  // Landed-cost assumptions (V1.3 Phase B): editable without a deploy. Blank
  // falls back to the env defaults (CALC_COMPLIANCE / CALC_AGENCY) and the
  // live FX rate respectively.
  calc_compliance_aud: "",  // typical SEVS/RAWS compliance cost, AUD
  calc_agency_aud: "",      // agency/service fee baked into estimates, AUD
  calc_fx_jpy_aud: "",      // JPY per A$1 override; blank = live rate
  // Phase 2: signed % applied to the calculator's grand total so estimates
  // can be aimed 5 to 10% under (negative) or over actuals after back-testing.
  calc_bias_pct: "",        // e.g. "-8"; blank = no adjustment
  // Budget filtering (V1.3 Phase C, "done properly"): once a match carries a
  // REAL per-lot landed estimate, drop the ones that land clearly over the
  // customer's stated AUD budget. Uses the all-in landed figure, not a rough FX
  // convert. Tunable here: turn it off, or widen the headroom, without a deploy.
  budget_filter: "1",         // 1 = hide matches that land over budget + headroom
  budget_headroom_pct: "10",  // how far above the stated budget a match may still surface (%)
  // Launch audit: the dealer feature is half-built (approved stock never reaches
  // buyers), so it ships hidden. Off = the admin Dealers views and new dealer
  // creation are hidden/blocked; already-invited dealers keep portal access.
  dealer_portal_enabled: "0",
  // Per-tier daily cap on member-submitted car requests, so a self-serve tier
  // cannot flood the review queue (Ben Site Notes). fully_managed is uncapped
  // in code; these bound paid_access and free tiers. Tune without a deploy.
  cap_paid_daily: "10",
  cap_free_daily: "1",
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
    whatsapp_enabled: form.get("whatsapp_enabled") ? "1" : "0",
    whatsapp_provider: form.get("whatsapp_provider") === "meta" ? "meta" : "twilio",
    sms_enabled: form.get("sms_enabled") ? "1" : "0",
    client_landed: form.get("client_landed") ? "1" : "0",
    request_alerts: form.get("request_alerts") ? "1" : "0",
    market_for_clients: form.get("market_for_clients") ? "1" : "0",
    stripe_enabled: form.get("stripe_enabled") ? "1" : "0",
    stripe_deposit_aud: posIntStr(form.get("stripe_deposit_aud"), ""),
    stripe_currency: (String(form.get("stripe_currency") || "aud").trim().toLowerCase()) || "aud",
    membership_enabled: form.get("membership_enabled") ? "1" : "0",
    membership_monthly_aud: posIntStr(form.get("membership_monthly_aud"), "49"),
    free_result_limit: posIntStr(form.get("free_result_limit"), "1"),
    free_search_limit: posIntStr(form.get("free_search_limit"), "1"),
    free_auto_send: form.get("free_auto_send") ? "1" : "0",
    run_includes_free: form.get("run_includes_free") ? "1" : "0",
    calc_compliance_aud: posIntStr(form.get("calc_compliance_aud"), ""),
    calc_agency_aud: posIntStr(form.get("calc_agency_aud"), ""),
    calc_fx_jpy_aud: (() => { const n = Number(String(form.get("calc_fx_jpy_aud") ?? "").trim()); return Number.isFinite(n) && n > 0 ? String(n) : ""; })(),
    // The one signed numeric setting: clamp to a sane band, blank = off.
    calc_bias_pct: (() => { const v = String(form.get("calc_bias_pct") ?? "").trim(); const n = Number(v); return v && Number.isFinite(n) && n >= -50 && n <= 50 ? String(n) : ""; })(),
    budget_filter: form.get("budget_filter") ? "1" : "0",
    budget_headroom_pct: posIntStr(form.get("budget_headroom_pct"), "10"),
    dealer_portal_enabled: form.get("dealer_portal_enabled") ? "1" : "0",
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
