// Email rendering - table-based, inline-styled, Outlook-hardened HTML.
//
// Outlook (Windows) uses Word's rendering engine, so this file deliberately:
//   * uses only SOLID hex colours (no rgba, which Word renders as black/none),
//   * builds every CTA as a bulletproof VML roundrect + <a> fallback,
//   * sizes hero images to their container (Word obeys the width attribute),
//   * adds a preheader, the mso DPI fix and the VML namespaces.
// Brand: light theme, gold accent, system/Arial stack (mail clients don't load
// web fonts, so we never depend on Inter being present).

import { imageUrls } from "./avtonet.js";

// Indicative JPY->AUD and landed multiplier for the client email's estimate.
const JPY_AUD = 0.0103;       // A$ per ¥1
const LANDED_MULT = 1.9;      // auction+export+shipping+duties+GST, indicative

const FONT = `-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif`;
// Core palette - all solid so Outlook renders them correctly.
const INK = "#1A1A1A", BODY = "#5A5E62", MUTE = "#9A9DA1", GOLD = "#CAA34C", GOLDTXT = "#896B2D";
// Pre-blended tints (the old rgba values flattened onto their backgrounds).
const HAIR = "#EAEAEA";       // was rgba(0,0,0,0.06)
const OUTLINE = "#CFCFCF";    // was rgba(0,0,0,0.20)
const GOLD_TINT = "#FAF6EC";  // gold 10% on white
const GOLD_BORDER = "#E7D4A6";// gold ~40% on white
const GOLD_LINE = "#E2CC9D";  // gold 55% on white (header rule)
const OFF = "#FAFAF8", AVATAR = "#F0E9D7", PAGE = "#DEDFE1";

const LOGO_URL = "https://jdm-vehicle-finder.jate-curtis.workers.dev/assets/logo-gold.png";

export function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
export function yen(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return "-";
  return "¥" + v.toLocaleString("en-US");
}
export function aud(jpy) {
  const v = Number(jpy);
  if (!Number.isFinite(v) || v <= 0) return "-";
  return "A$" + (Math.round((v * JPY_AUD * LANDED_MULT) / 50) * 50).toLocaleString("en-AU");
}
export function km(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return "-";
  return v.toLocaleString("en-US") + " km";
}
// Map a raw feed grade to something a human reads (Fix 11). Auction grades run
// 1-6 (plus letter grades like S/R/RA/A); the feed encodes "no grade yet" as 99
// (and occasionally 0, "---", "*"). Show those as "ungraded" rather than raw.
export function displayGrade(rate) {
  const s = String(rate ?? "").trim();
  if (!s || s === "---" || s === "*" || s === "-") return "ungraded";
  const n = Number(s);
  if (Number.isFinite(n) && (n < 1 || n > 6)) return "ungraded";
  return s;
}
function initials(name) {
  return String(name || "?").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

// Wider hero image (~680px) for emails. Mobile clients scale images down to fit
// but not up, so a too-small source leaves a gap beside the photo; this fills it.
function heroSrc(lot) {
  const f = imageUrls(lot).full;
  if (!f) return null;
  return f + (f.indexOf("?") >= 0 ? "&" : "?") + "w=680";
}

// Bulletproof button: VML roundrect for Outlook, styled <a> for everyone else.
// opts: { bg, color, border, w } - fixed width keeps Outlook honest.
function btn(href, label, opts = {}) {
  const bg = opts.bg || GOLD;
  const color = opts.color || INK;
  const border = opts.border || null;
  const w = opts.w || 210;
  const h = 46;
  const L = esc(label);
  const stroke = border ? `strokecolor="${border}" strokeweight="1pt"` : `stroke="f"`;
  return `<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${esc(href)}" style="height:${h}px;v-text-anchor:middle;width:${w}px;" arcsize="16%" ${stroke} fillcolor="${bg}"><w:anchorlock/><center style="color:${color};font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">${L}</center></v:roundrect><![endif]--><!--[if !mso]><!--><a href="${esc(href)}" style="display:inline-block;width:${w}px;background:${bg};color:${color};font-family:${FONT};font-size:14px;font-weight:700;line-height:${border ? h - 2 : h}px;text-align:center;text-decoration:none;border-radius:8px;${border ? `border:1px solid ${border};` : ""}-webkit-text-size-adjust:none;">${L}</a><!--<![endif]-->`;
}

// Hidden preview text shown in the inbox list (premium polish).
function preheader(text) {
  return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${PAGE};opacity:0;">${esc(text)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>`;
}

// Shared 600px shell: mso ghost-table for centring, DPI fix, VML namespaces.
function shell(inner, pre) {
  return `<!doctype html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<style>
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0;mso-table-rspace:0}
  img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none}
  a{text-decoration:none}
  body{margin:0;padding:0;width:100%!important;background:${PAGE}}
</style>
</head>
<body style="margin:0;padding:0;background:${PAGE};">
${pre ? preheader(pre) : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAGE};"><tr><td align="center" style="padding:28px 12px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#FFFFFF;border-radius:10px;overflow:hidden;">
  <tr><td style="padding:30px 36px 0;">
    <img src="${esc(LOGO_URL)}" width="178" height="19" alt="JDM Connect" style="display:block;width:178px;height:auto;border:0;">
    <div style="height:1px;line-height:1px;font-size:0;background:${GOLD_LINE};margin:18px 0 0;">&nbsp;</div>
  </td></tr>
  ${inner}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body></html>`;
}

function footer(extra) {
  return `<tr><td style="background:${OFF};border-top:1px solid ${HAIR};padding:26px 36px;">
    <img src="${LOGO_URL}" width="142" alt="JDM Connect" style="display:block;border:0;outline:none;height:auto;margin:0 0 11px;">
    <div style="font-family:${FONT};font-size:12px;line-height:1.5;color:${MUTE};">Japanese vehicle imports &middot; Australia-wide</div>
    ${extra || ""}
    <div style="font-family:${FONT};font-size:12px;line-height:1.7;color:${BODY};margin-top:13px;">
      <a href="mailto:hello@jdmconnect.com.au" style="color:${GOLDTXT};text-decoration:none;">hello@jdmconnect.com.au</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;<a href="https://jdmconnect.com.au" style="color:${GOLDTXT};text-decoration:none;">jdmconnect.com.au</a>
    </div>
    <div style="font-family:${FONT};font-size:11px;line-height:1.5;color:${MUTE};margin-top:14px;">&copy; ${new Date().getFullYear()} JDM Connect &middot; Japanese performance &amp; classic vehicle imports, Australia-wide.</div>
  </td></tr>`;
}

// Solid-colour strength tag (square corners on Outlook, which is fine).
function strengthTag(lot) {
  const label = lot._strength || "Possible";
  const dot = lot._strengthColor || "#B6B9BC";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="background:${GOLD_TINT};border:1px solid ${GOLD_BORDER};border-radius:6px;padding:5px 11px;">
      <span style="display:inline-block;width:7px;height:7px;border-radius:7px;background:${dot};vertical-align:middle;font-size:0;line-height:0;">&nbsp;</span>
      <span style="font-family:${FONT};font-size:11px;font-weight:600;line-height:1;letter-spacing:0.06em;text-transform:uppercase;color:${GOLDTXT};vertical-align:middle;margin-left:6px;">${esc(label)}</span>
    </td></tr></table>`;
}

// ---------------------------------------------------------------------------
// INTERNAL digest (staff): "N new auction matches to review"
// ---------------------------------------------------------------------------
function internalCard(lot, wishlist, token, publicUrl) {
  const img = imageUrls(lot);
  const title = `${esc(lot.year || "")} ${esc(lot.marka_name || "")} ${esc(lot.model_name || "")}`.trim();
  const approve = `${publicUrl}/decide?token=${token}&action=approve`;
  const reject = `${publicUrl}/decide?token=${token}&action=reject`;
  const sub = [esc(lot.auction || ""), esc((lot.auction_date || "").slice(0, 10))].filter(Boolean).join(" &middot; ");
  const landed = lot._landed ? "A$" + Number(lot._landed.grandTotal).toLocaleString("en-AU") : "-";
  const landedLabel = lot._landed ? `Est. landed &middot; ${esc(lot._landed.state)}` : "Est. landed";
  const spec = (label, value) => `<td width="50%" style="padding:10px 0;vertical-align:top;">
      <div style="font-family:${FONT};font-size:10px;font-weight:600;line-height:1;letter-spacing:0.1em;text-transform:uppercase;color:${MUTE};">${esc(label)}</div>
      <div style="font-family:${FONT};font-size:14px;font-weight:600;line-height:1.3;color:${INK};margin-top:5px;">${value}</div></td>`;

  return `<tr><td style="padding:22px 30px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${HAIR};border-radius:14px;overflow:hidden;">
      <tr><td bgcolor="#15171A" style="background:#15171A;font-size:0;line-height:0;">${heroSrc(lot)
        ? `<img src="${esc(heroSrc(lot))}" width="538" alt="${title}" style="display:block;width:100%;max-width:100%;height:auto;border:0;">`
        : `<div style="height:150px;text-align:center;color:#9A854F;font-family:${FONT};font-size:12px;font-weight:600;line-height:150px;letter-spacing:0.12em;text-transform:uppercase;">Photo on request</div>`}</td></tr>
      <tr><td style="padding:20px 22px 2px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="font-family:${FONT};font-size:19px;font-weight:700;line-height:1.25;color:${INK};">${title}</td>
          <td align="right" style="vertical-align:top;white-space:nowrap;">${strengthTag(lot)}</td>
        </tr></table>
        <div style="font-family:${FONT};font-size:12px;line-height:1.4;color:${MUTE};margin-top:6px;">Lot ${esc(lot.lot || "-")}${sub ? " &middot; " + sub : ""}</div>
      </td></tr>

      <tr><td style="padding:16px 22px 2px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="50%" style="padding-right:6px;vertical-align:top;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${GOLD_TINT};border:1px solid ${GOLD_BORDER};border-radius:11px;"><tr><td style="padding:13px 15px;">
              <div style="font-family:${FONT};font-size:10px;font-weight:600;line-height:1;letter-spacing:0.1em;text-transform:uppercase;color:${GOLDTXT};">Auction estimate</div>
              <div style="font-family:${FONT};font-size:18px;font-weight:700;line-height:1.2;color:${INK};margin-top:6px;">${yen(lot.avg_price || lot.start)}</div>
            </td></tr></table>
          </td>
          <td width="50%" style="padding-left:6px;vertical-align:top;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${INK};border-radius:11px;"><tr><td style="padding:13px 15px;">
              <div style="font-family:${FONT};font-size:10px;font-weight:600;line-height:1;letter-spacing:0.1em;text-transform:uppercase;color:${GOLD};">${landedLabel}</div>
              <div style="font-family:${FONT};font-size:18px;font-weight:700;line-height:1.2;color:#FFFFFF;margin-top:6px;">${landed}</div>
            </td></tr></table>
          </td>
        </tr></table>
      </td></tr>

      <tr><td style="padding:4px 22px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>${spec("Grade", esc(displayGrade(lot.rate)))}${spec("Mileage", km(lot.mileage))}</tr>
          <tr>${spec("Engine", (lot.eng_v ? esc(lot.eng_v) + "cc" : "-"))}${spec("Chassis", esc(lot.kuzov || "-"))}</tr>
          <tr>${spec("Trim", esc(lot.grade || "-"))}${spec("Colour", esc(lot.color || "-"))}</tr>
        </table>
      </td></tr>

      <tr><td style="padding:16px 22px 20px;border-top:1px solid ${HAIR};">
        <div style="margin-bottom:14px;">
          <span style="display:inline-block;width:26px;height:26px;border-radius:13px;background:${AVATAR};color:${GOLDTXT};font-family:${FONT};font-size:11px;font-weight:700;line-height:26px;text-align:center;vertical-align:middle;">${esc(initials(wishlist.client_name))}</span>
          <span style="vertical-align:middle;margin-left:9px;font-family:${FONT};font-size:13px;font-weight:600;line-height:1.3;color:${INK};">${esc(wishlist.client_name)}</span>
          <span style="vertical-align:middle;font-family:${FONT};font-size:12px;line-height:1.3;color:${MUTE};"> &middot; ${esc(wishlist.label || "wishlist")}</span>
        </div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="padding-right:10px;">${btn(approve, "Approve & send", { bg: GOLD, color: INK, w: 168 })}</td>
          <td>${btn(reject, "Skip", { bg: "#FFFFFF", color: BODY, border: OUTLINE, w: 96 })}</td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>`;
}

export function digestHtml(summary, publicUrl) {
  let total = 0;
  const cards = summary.map(({ wishlist, queued }) =>
    queued.map(({ lot, token }) => { total++; return internalCard(lot, wishlist, token, publicUrl); }).join("")
  ).join("");

  const intro = `<tr><td style="padding:26px 36px 0;">
    <div style="font-family:${FONT};font-size:11px;font-weight:600;line-height:1;letter-spacing:0.12em;text-transform:uppercase;color:${GOLDTXT};">Auction matches</div>
    <h1 style="margin:10px 0 6px;font-family:${FONT};font-size:25px;font-weight:600;line-height:1.15;color:${INK};">${total} new auction match${total === 1 ? "" : "es"}</h1>
    <p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.5;color:${BODY};">Reviewed and approved cars are sent to the client. Skip the rest.</p>
  </td></tr>`;

  const bulk = `<tr><td style="padding:26px 36px 30px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${INK};border-radius:10px;"><tr>
      <td style="padding:16px 22px;font-family:${FONT};font-size:14px;font-weight:500;line-height:1.4;color:#FFFFFF;">${total} awaiting your review</td>
      <td align="right" style="padding:12px 18px 12px 0;">${btn(`${publicUrl}/admin?view=matches`, "Open Vehicle Finder", { bg: "#FFFFFF", color: INK, w: 180 })}</td>
    </tr></table>
  </td></tr>`;

  return shell(intro + cards + bulk + footer(), `${total} new auction match${total === 1 ? "" : "es"} to review`);
}

// ---------------------------------------------------------------------------
// ADMIN alert: a customer submitted the public "Request a vehicle" form
// ---------------------------------------------------------------------------
export function requestAlertHtml(req, publicUrl) {
  const row = (label, value) => value
    ? `<tr><td style="padding:7px 0;border-top:1px solid ${HAIR};font-family:${FONT};font-size:13px;line-height:1.3;color:#7B7E82;">${esc(label)}</td>
         <td style="padding:7px 0;border-top:1px solid ${HAIR};font-family:${FONT};font-size:13px;font-weight:600;line-height:1.3;color:${INK};text-align:right;">${esc(value)}</td></tr>`
    : "";
  const vehicle = [req.marka_name, req.model_name].filter(Boolean).join(" ") || "Any vehicle";
  const years = [req.year_min, req.year_max].filter(Boolean).join("-");
  const budget = req.price_max ? "¥" + Number(req.price_max).toLocaleString("en-US") : "";
  const maxKm = req.mileage_max ? Number(req.mileage_max).toLocaleString("en-US") + " km" : "";
  const inner = `
  <tr><td style="padding:26px 36px 0;">
    <div style="font-family:${FONT};font-size:11px;font-weight:600;line-height:1;letter-spacing:0.12em;text-transform:uppercase;color:${GOLDTXT};">New vehicle request</div>
    <h1 style="margin:10px 0 6px;font-family:${FONT};font-size:23px;font-weight:600;line-height:1.2;color:${INK};">${esc(req.name || "New enquiry")}</h1>
    <p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.5;color:${BODY};">A new request just came in through the Vehicle Finder.</p>
  </td></tr>
  <tr><td style="padding:18px 36px 0;">
    <div style="font-family:${FONT};font-size:10px;font-weight:600;line-height:1;letter-spacing:0.1em;text-transform:uppercase;color:${MUTE};margin-bottom:2px;">Contact</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${row("Name", req.name)}${row("Email", req.email)}${row("WhatsApp", req.whatsapp)}${row("State", req.state)}
    </table>
  </td></tr>
  <tr><td style="padding:18px 36px 0;">
    <div style="font-family:${FONT};font-size:10px;font-weight:600;line-height:1;letter-spacing:0.1em;text-transform:uppercase;color:${MUTE};margin-bottom:2px;">Looking for</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${row("Vehicle", vehicle)}${row("Years", years)}${row("Max budget", budget)}${row("Max mileage", maxKm)}${row("Min grade", req.rate_min)}${row("Chassis", req.kuzov)}${row("Keyword", req.grade_kw)}${row("Notes", req.label)}
    </table>
  </td></tr>
  ${publicUrl ? `<tr><td style="padding:24px 36px 0;">${btn(`${publicUrl}/admin?view=clients`, "Open in Vehicle Finder", { bg: GOLD, color: INK, w: 210 })}</td></tr>` : ""}`;
  return shell(inner + `<tr><td style="height:24px;font-size:0;line-height:0;">&nbsp;</td></tr>` + footer(), `New request from ${req.name || "a customer"}`);
}

// ---------------------------------------------------------------------------
// CLIENT confirmation: "we have your request" receipt (Fix 7)
// ---------------------------------------------------------------------------
export function requestConfirmationHtml(req, ref, publicUrl) {
  const first = String(req?.name || "there").trim().split(/\s+/)[0] || "there";
  const row = (label, value) => value
    ? `<tr><td style="padding:7px 0;border-top:1px solid ${HAIR};font-family:${FONT};font-size:13px;line-height:1.3;color:#7B7E82;">${esc(label)}</td>
         <td style="padding:7px 0;border-top:1px solid ${HAIR};font-family:${FONT};font-size:13px;font-weight:600;line-height:1.3;color:${INK};text-align:right;">${esc(value)}</td></tr>`
    : "";
  const vehicle = [req.marka_name, req.model_name].filter(Boolean).join(" ") || "Open to suggestions";
  const years = [req.year_min, req.year_max].filter(Boolean).join("-");
  const budget = Number(req.price_max) > 0 ? yen(req.price_max) : "";
  const maxKm = Number(req.mileage_max) > 0 ? km(req.mileage_max) : "";

  const inner = `
  <tr><td style="padding:26px 36px 0;">
    <div style="font-family:${FONT};font-size:11px;font-weight:600;line-height:1;letter-spacing:0.12em;text-transform:uppercase;color:${GOLDTXT};">Request received</div>
    <h1 style="margin:10px 0 6px;font-family:${FONT};font-size:24px;font-weight:600;line-height:1.2;color:${INK};">Thanks, ${esc(first)} - we're on it.</h1>
    <p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.6;color:${BODY};">Your request is in and we're now watching the Japanese auctions for it. We'll email you the moment a matching car comes up - that can take days or weeks depending on what's listed, so quiet for a little while is completely normal.</p>
  </td></tr>
  <tr><td style="padding:18px 36px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${GOLD_TINT};border:1px solid ${GOLD_BORDER};border-radius:10px;"><tr><td style="padding:14px 16px;">
      <div style="font-family:${FONT};font-size:10px;font-weight:600;line-height:1;letter-spacing:0.1em;text-transform:uppercase;color:${GOLDTXT};">Your reference</div>
      <div style="font-family:${FONT};font-size:20px;font-weight:700;line-height:1.2;color:${INK};margin-top:6px;letter-spacing:0.02em;">${esc(ref)}</div>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:18px 36px 0;">
    <div style="font-family:${FONT};font-size:10px;font-weight:600;line-height:1;letter-spacing:0.1em;text-transform:uppercase;color:${MUTE};margin-bottom:2px;">What we have</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${row("Vehicle", vehicle)}${row("Years", years)}${row("Max budget", budget)}${row("Max mileage", maxKm)}${row("State", req.state)}
    </table>
  </td></tr>
  <tr><td style="padding:20px 36px 0;">
    <p style="margin:0;font-family:${FONT};font-size:13px;line-height:1.6;color:${BODY};">Need to add detail or change something? Just reply to this email - it reaches us directly.</p>
  </td></tr>`;
  return shell(inner + `<tr><td style="height:24px;font-size:0;line-height:0;">&nbsp;</td></tr>` + footer(), `We have your JDM request - ref ${ref}`);
}

// ---------------------------------------------------------------------------
// AGENT invite: "set your password" welcome email
// ---------------------------------------------------------------------------
export function agentInviteHtml(name, link) {
  const first = String(name || "").trim().split(/\s+/)[0];
  const inner = `
  <tr><td style="padding:26px 36px 0;">
    <div style="font-family:${FONT};font-size:11px;font-weight:600;line-height:1;letter-spacing:0.12em;text-transform:uppercase;color:${GOLDTXT};">Vehicle Finder</div>
    <h1 style="margin:10px 0 6px;font-family:${FONT};font-size:24px;font-weight:600;line-height:1.2;color:${INK};">Welcome${first ? ", " + esc(first) : ""}</h1>
    <p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.6;color:${BODY};">You've been added to the JDM Connect Vehicle Finder. Set your password to start finding cars for your clients. You'll see only your own clients and matches.</p>
  </td></tr>
  <tr><td style="padding:22px 36px 0;">
    ${btn(link, "Set your password", { bg: GOLD, color: INK, w: 210 })}
    <p style="margin:18px 0 0;font-family:${FONT};font-size:12px;line-height:1.5;color:${MUTE};">Or paste this link into your browser:<br><span style="color:${GOLDTXT};word-break:break-all;">${esc(link)}</span></p>
    <p style="margin:14px 0 0;font-family:${FONT};font-size:12px;line-height:1.5;color:${MUTE};">This link expires in 7 days. If you weren't expecting this, you can ignore this email.</p>
  </td></tr>`;
  return shell(inner + `<tr><td style="height:24px;font-size:0;line-height:0;">&nbsp;</td></tr>` + footer(), "Set up your Vehicle Finder login");
}

// ---------------------------------------------------------------------------
// CLIENT portal invite: "set your password" welcome email for a buyer
// ---------------------------------------------------------------------------
export function clientPortalInviteHtml(name, link) {
  const first = String(name || "").trim().split(/\s+/)[0];
  const inner = `
  <tr><td style="padding:26px 36px 0;">
    <div style="font-family:${FONT};font-size:11px;font-weight:600;line-height:1;letter-spacing:0.12em;text-transform:uppercase;color:${GOLDTXT};">Your buyer portal</div>
    <h1 style="margin:10px 0 6px;font-family:${FONT};font-size:24px;font-weight:600;line-height:1.2;color:${INK};">Welcome${first ? ", " + esc(first) : ""}</h1>
    <p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.6;color:${BODY};">JDM Connect has set up a portal where you can track your search, see the cars we find for you, and tell us which ones to chase. Set a password to sign in.</p>
  </td></tr>
  <tr><td style="padding:22px 36px 0;">
    ${btn(link, "Set your password", { bg: GOLD, color: INK, w: 210 })}
    <p style="margin:18px 0 0;font-family:${FONT};font-size:12px;line-height:1.5;color:${MUTE};">Or paste this link into your browser:<br><span style="color:${GOLDTXT};word-break:break-all;">${esc(link)}</span></p>
    <p style="margin:14px 0 0;font-family:${FONT};font-size:12px;line-height:1.5;color:${MUTE};">This link expires in 7 days. If you weren't expecting this, you can ignore this email.</p>
  </td></tr>`;
  return shell(inner + `<tr><td style="height:24px;font-size:0;line-height:0;">&nbsp;</td></tr>` + footer(), "Set up your JDM Connect portal login");
}

// ---------------------------------------------------------------------------
// STAFF alert: a client asked us (from the portal) to action/translate a car
// ---------------------------------------------------------------------------
export function clientRequestAlertHtml(client, lot, wishlist, publicUrl) {
  const title = `${esc(lot.year || "")} ${esc(lot.marka_name || "")} ${esc(lot.model_name || "")}`.trim();
  const row = (label, value) => value
    ? `<tr><td style="padding:7px 0;border-top:1px solid ${HAIR};font-family:${FONT};font-size:13px;line-height:1.3;color:#7B7E82;">${esc(label)}</td>
         <td style="padding:7px 0;border-top:1px solid ${HAIR};font-family:${FONT};font-size:13px;font-weight:600;line-height:1.3;color:${INK};text-align:right;">${esc(value)}</td></tr>`
    : "";
  const inner = `
  <tr><td style="padding:26px 36px 0;">
    <div style="font-family:${FONT};font-size:11px;font-weight:600;line-height:1;letter-spacing:0.12em;text-transform:uppercase;color:${GOLDTXT};">Client request</div>
    <h1 style="margin:10px 0 6px;font-family:${FONT};font-size:23px;font-weight:600;line-height:1.2;color:${INK};">${esc(client?.name || "A client")} wants this car</h1>
    <p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.5;color:${BODY};">They asked from the portal - pull the auction sheet, translate it, and follow up.</p>
  </td></tr>
  ${heroSrc(lot) ? `<tr><td style="padding:18px 36px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${HAIR};border-radius:10px;overflow:hidden;"><tr><td bgcolor="#15171A" style="background:#15171A;font-size:0;line-height:0;"><img src="${esc(heroSrc(lot))}" width="526" alt="${title}" style="display:block;width:100%;max-width:100%;height:auto;border:0;"></td></tr></table></td></tr>` : ""}
  <tr><td style="padding:18px 36px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${row("Vehicle", title)}${row("Lot", lot.lot)}${row("Auction", lot.auction)}${row("Auction date", (lot.auction_date || "").slice(0, 10))}${row("Grade", displayGrade(lot.rate))}${row("Chassis", lot.kuzov)}${row("Search", wishlist?.label)}${row("Client email", client?.email)}${row("Client WhatsApp", client?.whatsapp)}
    </table>
  </td></tr>
  ${publicUrl ? `<tr><td style="padding:24px 36px 0;">${btn(`${publicUrl}/admin?view=clients`, "Open in Vehicle Finder", { bg: GOLD, color: INK, w: 210 })}</td></tr>` : ""}`;
  return shell(inner + `<tr><td style="height:24px;font-size:0;line-height:0;">&nbsp;</td></tr>` + footer(), `${client?.name || "A client"} requested ${title}`);
}

// ---------------------------------------------------------------------------
// CLIENT email: a single approved match, warm second-person voice
// ---------------------------------------------------------------------------
function chip(text) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-block;margin:0 6px 8px 0;"><tr><td style="background:${GOLD_TINT};border:1px solid ${GOLD_BORDER};border-radius:6px;padding:5px 12px;font-family:${FONT};font-size:12px;font-weight:500;line-height:1.2;color:${GOLDTXT};">&#10003; ${esc(text)}</td></tr></table>`;
}
function keySpec(label, value) {
  return `<td width="50%" style="padding:10px 0;">
    <div style="font-family:${FONT};font-size:11px;font-weight:600;line-height:1;letter-spacing:0.1em;text-transform:uppercase;color:${MUTE};">${esc(label)}</div>
    <div style="font-family:${FONT};font-size:15px;font-weight:600;line-height:1.3;color:${INK};margin-top:4px;">${value}</div>
  </td>`;
}

export function clientHtml(lot, client, wishlist, publicUrl, landed, showLanded = true) {
  const img = imageUrls(lot);
  const title = `${esc(lot.year || "")} ${esc(lot.marka_name || "")} ${esc(lot.model_name || "")}`.trim();
  const landedStr = landed && Number.isFinite(Number(landed.grandTotal))
    ? "A$" + Number(landed.grandTotal).toLocaleString("en-AU")
    : aud(lot.avg_price || lot.start);
  const first = String(client?.name || "there").trim().split(/\s+/)[0];
  const want = [wishlist?.marka_name, wishlist?.model_name].filter(Boolean).join(" ") || "your search";
  const carRef = [lot.year, lot.marka_name, lot.model_name].filter(Boolean).join(" ").trim() + (lot.lot ? ` (Lot ${lot.lot})` : "");
  const interestedHref = `mailto:hello@jdmconnect.com.au?subject=${encodeURIComponent("I'm interested in this " + carRef)}`;
  const questionHref = `mailto:hello@jdmconnect.com.au?subject=${encodeURIComponent("Question about " + carRef)}`;

  const chips = [];
  if (wishlist?.rate_min) chips.push(`Matches your grade ${wishlist.rate_min}+ requirement`);
  if (wishlist?.price_max) chips.push("Within your budget");
  if (wishlist?.kuzov) chips.push(`Correct chassis (${wishlist.kuzov})`);
  if (wishlist?.grade_kw) chips.push(`${wishlist.grade_kw} grade`);
  if (chips.length === 0) chips.push("Matches your saved search");

  const inner = `
  <tr><td style="padding:26px 36px 0;">
    <div style="font-family:${FONT};font-size:11px;font-weight:600;line-height:1;letter-spacing:0.12em;text-transform:uppercase;color:${GOLDTXT};">A match for your search</div>
    <h1 style="margin:10px 0 6px;font-family:${FONT};font-size:25px;font-weight:600;line-height:1.2;color:${INK};">Hi ${esc(first)}, we think this one's for you.</h1>
    <p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.5;color:${BODY};">A ${esc(want)} just came up at a Japanese auction that lines up with what you're after.</p>
  </td></tr>

  <tr><td style="padding:20px 36px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${HAIR};border-radius:10px;overflow:hidden;">
      ${heroSrc(lot) ? `<tr><td bgcolor="#15171A" style="background:#15171A;font-size:0;line-height:0;"><img src="${esc(heroSrc(lot))}" width="526" alt="${title}" style="display:block;width:100%;max-width:100%;height:auto;border:0;"></td></tr>` : ""}
      <tr><td style="padding:16px 18px;">
        <div style="font-family:${FONT};font-size:19px;font-weight:600;line-height:1.2;color:${INK};">${title}</div>
        <div style="font-family:${FONT};font-size:12px;line-height:1.3;color:${MUTE};margin-top:4px;">${esc(lot.auction || "")}${lot.auction_date ? " &middot; " + esc((lot.auction_date || "").slice(0, 10)) : ""}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">
          <tr>${keySpec("Year", esc(lot.year || "-"))}${keySpec("Auction grade", esc(displayGrade(lot.rate)))}</tr>
          <tr>${keySpec("Mileage", km(lot.mileage))}${keySpec("Chassis", esc(lot.kuzov || "-"))}</tr>
          <tr>${keySpec("Transmission", esc(lot.kpp || "-"))}${keySpec("Colour", esc(lot.color || "-"))}</tr>
        </table>
        <div style="margin-top:14px;">${chips.map(chip).join("")}</div>
      </td></tr>
    </table>
  </td></tr>

  ${showLanded ? `<tr><td style="padding:18px 36px 0;">
    <p style="margin:0 0 10px;font-family:${FONT};font-size:13px;line-height:1.5;color:${BODY};">Left is the car's likely auction price in Japan. Right is the estimated total to your door in Australia (car, export, shipping, duties and GST).</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="50%" style="padding-right:8px;vertical-align:top;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${OFF};border:1px solid ${HAIR};border-radius:10px;"><tr><td style="padding:14px 16px;">
          <div style="font-family:${FONT};font-size:11px;font-weight:600;line-height:1;letter-spacing:0.1em;text-transform:uppercase;color:${MUTE};">Auction estimate</div>
          <div style="font-family:${FONT};font-size:18px;font-weight:600;line-height:1.2;color:${INK};margin-top:5px;">${yen(lot.avg_price || lot.start)}</div>
        </td></tr></table>
      </td>
      <td width="50%" style="padding-left:8px;vertical-align:top;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${INK};border-radius:10px;"><tr><td style="padding:14px 16px;">
          <div style="font-family:${FONT};font-size:11px;font-weight:600;line-height:1;letter-spacing:0.1em;text-transform:uppercase;color:${GOLD};">Indicative landed &middot; AUD</div>
          <div style="font-family:${FONT};font-size:18px;font-weight:600;line-height:1.2;color:#FFFFFF;margin-top:5px;">${landedStr}</div>
        </td></tr></table>
      </td>
    </tr></table>
    <p style="margin:10px 0 0;font-family:${FONT};font-size:11px;line-height:1.5;color:${MUTE};">Indicative only. Landed cost includes auction, export, shipping and duties, and is confirmed before you proceed. No obligation to bid.</p>
  </td></tr>` : `<tr><td style="padding:18px 36px 0;">
    <p style="margin:0 0 10px;font-family:${FONT};font-size:13px;line-height:1.5;color:${BODY};">This is the car's likely auction price in Japan, before import costs. We'll confirm the full landed cost to your door before you commit.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="vertical-align:top;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${OFF};border:1px solid ${HAIR};border-radius:10px;"><tr><td style="padding:14px 16px;">
          <div style="font-family:${FONT};font-size:11px;font-weight:600;line-height:1;letter-spacing:0.1em;text-transform:uppercase;color:${MUTE};">Auction estimate</div>
          <div style="font-family:${FONT};font-size:18px;font-weight:600;line-height:1.2;color:${INK};margin-top:5px;">${yen(lot.avg_price || lot.start)}</div>
        </td></tr></table>
      </td>
    </tr></table>
  </td></tr>`}

  <tr><td style="padding:22px 36px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="padding-right:10px;">${btn(interestedHref, "I'm interested", { bg: GOLD, color: INK, w: 180 })}</td>
      <td>${btn(questionHref, "Ask a question", { bg: "#FFFFFF", color: GOLDTXT, border: GOLD_BORDER, w: 178 })}</td>
    </tr></table>
  </td></tr>

  <tr><td style="padding:26px 36px 4px;">
    <div style="font-family:${FONT};font-size:11px;font-weight:600;line-height:1;letter-spacing:0.1em;text-transform:uppercase;color:${MUTE};">How it works</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;">
      ${["Tell us you're interested", "We bid on your behalf", "We handle the rest"].map((t, i) => `
        <tr><td style="padding:6px 0;font-family:${FONT};font-size:14px;line-height:1.4;color:#3A3C3F;">
          <span style="display:inline-block;width:26px;height:26px;border-radius:13px;background:${GOLD_TINT};border:1px solid ${GOLD_BORDER};color:${GOLDTXT};font-family:${FONT};font-size:13px;font-weight:700;line-height:26px;text-align:center;vertical-align:middle;">${i + 1}</span>
          <span style="vertical-align:middle;margin-left:10px;">${esc(t)}</span>
        </td></tr>`).join("")}
    </table>
  </td></tr>`;

  const ft = footer(`<div style="font-family:${FONT};font-size:11px;line-height:1.5;color:${MUTE};margin-top:8px;">Eligibility subject to SEVS/RAWS. We'll confirm import compliance before you commit.</div>`);
  return shell(inner + `<tr><td style="height:24px;font-size:0;line-height:0;">&nbsp;</td></tr>` + ft, `${title} - a match for your search`);
}

// ---------------------------------------------------------------------------
// CLIENT email: several approved matches in ONE email (bulk approve)
// ---------------------------------------------------------------------------
function clientCarBlock(lot, wishlist, landed, showLanded = true) {
  const title = `${esc(lot.year || "")} ${esc(lot.marka_name || "")} ${esc(lot.model_name || "")}`.trim();
  const landedStr = landed && Number.isFinite(Number(landed.grandTotal))
    ? "A$" + Number(landed.grandTotal).toLocaleString("en-AU")
    : aud(lot.avg_price || lot.start);
  const carRef = [lot.year, lot.marka_name, lot.model_name].filter(Boolean).join(" ").trim() + (lot.lot ? ` (Lot ${lot.lot})` : "");
  const interestedHref = `mailto:hello@jdmconnect.com.au?subject=${encodeURIComponent("I'm interested in this " + carRef)}`;
  const priceRow = showLanded
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;"><tr>
          <td width="50%" style="padding-right:8px;vertical-align:top;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${OFF};border:1px solid ${HAIR};border-radius:10px;"><tr><td style="padding:12px 14px;">
              <div style="font-family:${FONT};font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:${MUTE};">Auction est.</div>
              <div style="font-family:${FONT};font-size:16px;font-weight:600;color:${INK};margin-top:4px;">${yen(lot.avg_price || lot.start)}</div>
            </td></tr></table>
          </td>
          <td width="50%" style="padding-left:8px;vertical-align:top;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${INK};border-radius:10px;"><tr><td style="padding:12px 14px;">
              <div style="font-family:${FONT};font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:${GOLD};">Indicative landed</div>
              <div style="font-family:${FONT};font-size:16px;font-weight:600;color:#FFFFFF;margin-top:4px;">${landedStr}</div>
            </td></tr></table>
          </td>
        </tr></table>`
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;"><tr>
          <td style="vertical-align:top;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${OFF};border:1px solid ${HAIR};border-radius:10px;"><tr><td style="padding:12px 14px;">
              <div style="font-family:${FONT};font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:${MUTE};">Auction est. &middot; before import costs</div>
              <div style="font-family:${FONT};font-size:16px;font-weight:600;color:${INK};margin-top:4px;">${yen(lot.avg_price || lot.start)}</div>
            </td></tr></table>
          </td>
        </tr></table>`;
  return `<tr><td style="padding:18px 36px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${HAIR};border-radius:10px;overflow:hidden;">
      ${heroSrc(lot) ? `<tr><td bgcolor="#15171A" style="background:#15171A;font-size:0;line-height:0;"><img src="${esc(heroSrc(lot))}" width="526" alt="${title}" style="display:block;width:100%;max-width:100%;height:auto;border:0;"></td></tr>` : ""}
      <tr><td style="padding:16px 18px;">
        <div style="font-family:${FONT};font-size:18px;font-weight:600;line-height:1.2;color:${INK};">${title}</div>
        <div style="font-family:${FONT};font-size:12px;line-height:1.3;color:${MUTE};margin-top:4px;">${esc(lot.auction || "")}${lot.auction_date ? " &middot; " + esc((lot.auction_date || "").slice(0, 10)) : ""}${lot.lot ? " &middot; Lot " + esc(lot.lot) : ""}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;">
          <tr>${keySpec("Year", esc(lot.year || "-"))}${keySpec("Grade", esc(displayGrade(lot.rate)))}</tr>
          <tr>${keySpec("Mileage", km(lot.mileage))}${keySpec("Chassis", esc(lot.kuzov || "-"))}</tr>
        </table>
        ${priceRow}
        <div style="margin-top:14px;">${btn(interestedHref, "I'm interested in this one", { bg: GOLD, color: INK, w: 230 })}</div>
      </td></tr>
    </table>
  </td></tr>`;
}

// items: [{ lot, wishlist, landed }]. Used when several cars are approved for one
// client at once, so they receive a single email instead of one per car.
export function clientMultiHtml(client, items, publicUrl, showLanded = true) {
  const first = String(client?.name || "there").trim().split(/\s+/)[0];
  const n = items.length;
  const intro = `<tr><td style="padding:26px 36px 0;">
    <div style="font-family:${FONT};font-size:11px;font-weight:600;line-height:1;letter-spacing:0.12em;text-transform:uppercase;color:${GOLDTXT};">Matches for your search</div>
    <h1 style="margin:10px 0 6px;font-family:${FONT};font-size:25px;font-weight:600;line-height:1.2;color:${INK};">Hi ${esc(first)}, we found ${n} ${n === 1 ? "car" : "cars"} for you.</h1>
    <p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.5;color:${BODY};">These just came up at Japanese auctions and line up with what you're after. Reply about any one you'd like us to chase.</p>
  </td></tr>`;
  const blocks = items.map((it) => clientCarBlock(it.lot, it.wishlist, it.landed, showLanded)).join("");
  const ft = footer(`<div style="font-family:${FONT};font-size:11px;line-height:1.5;color:${MUTE};margin-top:8px;">${showLanded ? "Indicative landed cost includes auction, export, shipping and duties, confirmed before you commit. " : ""}Eligibility subject to SEVS/RAWS.</div>`);
  return shell(intro + blocks + `<tr><td style="height:24px;font-size:0;line-height:0;">&nbsp;</td></tr>` + ft, `${n} ${n === 1 ? "car" : "cars"} matched to your search`);
}

// Plain-text version for WhatsApp / fallback.
export function carText(lot) {
  const lines = [
    `${lot.year || ""} ${lot.marka_name || ""} ${lot.model_name || ""}`.trim(),
    `Auction: ${lot.auction || "-"} (${(lot.auction_date || "").slice(0, 10)})`,
    `Grade: ${displayGrade(lot.rate)} · Mileage: ${km(lot.mileage)}`,
    `Chassis: ${lot.kuzov || "-"} · ${lot.eng_v || "-"}cc`,
  ];
  if (Number(lot.avg_price || lot.start) > 0) lines.push(`Auction estimate: ${yen(lot.avg_price || lot.start)}`);
  return lines.join("\n");
}
