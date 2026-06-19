// Email rendering — table-based, inline-styled HTML for mail clients.
// Follows the JDM Connect design handoff (light theme, gold accent, Inter
// fallback stack). Logos are rendered as a text wordmark because mail clients
// don't reliably render SVG; swap for a hosted PNG lockup if desired.

import { imageUrls } from "./avtonet.js";

// Indicative JPY->AUD and landed multiplier for the client email's estimate.
// Rough guide only (clearly labelled). Tune to your real costs/rate.
const JPY_AUD = 0.0103;       // A$ per ¥1
const LANDED_MULT = 1.9;      // auction+export+shipping+duties+GST, indicative

const FONT = `-apple-system,"Helvetica Neue",Helvetica,Arial,sans-serif`;
const INK = "#1A1A1A", BODY = "#5A5E62", MUTE = "#9A9DA1", GOLD = "#CAA34C", GOLDTXT = "#896B2D";
const HAIR = "rgba(0,0,0,0.06)";
// Logo served from the stable workers.dev host (the custom domain can be flaky
// for mail-client image proxies), so the email logo always loads.
const LOGO_URL = "https://jdm-vehicle-finder.jate-curtis.workers.dev/assets/logo-gold.png";

export function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
export function yen(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return "—";
  return "¥" + v.toLocaleString("en-US");
}
export function aud(jpy) {
  const v = Number(jpy);
  if (!Number.isFinite(v) || v <= 0) return "—";
  return "A$" + Math.round((v * JPY_AUD * LANDED_MULT) / 50) * 50;
}
export function km(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return "—";
  return v.toLocaleString("en-US") + " km";
}
function initials(name) {
  return String(name || "?").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}
function strengthPill(lot) {
  const label = lot._strength || "Possible";
  const color = lot._strengthColor || "#B6B9BC";
  return `<table cellpadding="0" cellspacing="0" role="presentation"><tr>
    <td style="background:rgba(202,163,76,0.10);border:1px solid rgba(202,163,76,0.40);border-radius:9999px;padding:4px 11px;">
      <span style="display:inline-block;width:7px;height:7px;border-radius:9999px;background:${color};vertical-align:middle;"></span>
      <span style="font:600 11px/1 ${FONT};letter-spacing:0.08em;text-transform:uppercase;color:${GOLDTXT};vertical-align:middle;margin-left:6px;">${esc(label)}</span>
    </td></tr></table>`;
}

// Shared 600px email shell. logoUrl is an absolute PNG served by the Worker.
function shell(inner, logoUrl) {
  const logo = logoUrl
    ? `<img src="${esc(logoUrl)}" width="184" alt="JDM Connect" style="display:block;width:184px;height:auto;border:0;">`
    : `<div style="font:800 italic 22px/1 ${FONT};letter-spacing:-1px;color:${INK};">JDM<span style="font-style:normal;font-weight:800;background:${INK};color:#fff;padding:2px 8px;border-radius:3px;font-size:13px;letter-spacing:1px;margin-left:6px;">CONNECT</span></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#DEDFE1;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#DEDFE1;"><tr><td align="center" style="padding:28px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#FFFFFF;border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,0.10);overflow:hidden;">
      <tr><td style="padding:30px 36px 0;">
        ${logo}
        <div style="height:1px;background:rgba(202,163,76,0.55);margin:18px 0 0;"></div>
      </td></tr>
      ${inner}
    </table>
  </td></tr></table>
  </body></html>`;
}

function footer(extra) {
  return `<tr><td style="background:#FAFAF8;border-top:1px solid ${HAIR};padding:22px 36px;">
    <div style="font:600 14px/1.3 ${FONT};color:${INK};">JDM Connect</div>
    <div style="font:400 12px/1.5 ${FONT};color:${MUTE};margin-top:3px;">Japanese vehicle imports &middot; Melbourne, Australia</div>
    ${extra || ""}
    <div style="font:400 12px/1.5 ${FONT};color:${MUTE};margin-top:10px;">
      <a href="https://jdmconnect.com.au" style="color:${GOLDTXT};text-decoration:none;">jdmconnect.com.au</a>
    </div>
  </td></tr>`;
}

// ---------------------------------------------------------------------------
// INTERNAL digest (staff): "N new auction matches to review"
// ---------------------------------------------------------------------------
function specRow(label, value, bold) {
  return `<tr>
    <td style="padding:8px 0;border-top:1px solid ${HAIR};font:400 13px/1.3 ${FONT};color:#7B7E82;">${esc(label)}</td>
    <td style="padding:8px 0;border-top:1px solid ${HAIR};font:${bold ? 600 : 400} 13px/1.3 ${FONT};color:${bold ? INK : "#3A3C3F"};text-align:right;">${value}</td>
  </tr>`;
}

function internalCard(lot, wishlist, token, publicUrl) {
  const img = imageUrls(lot);
  const title = `${esc(lot.year || "")} ${esc(lot.marka_name || "")} ${esc(lot.model_name || "")}`.trim();
  const approve = `${publicUrl}/decide?token=${token}&action=approve`;
  const reject = `${publicUrl}/decide?token=${token}&action=reject`;
  const sub = [esc(lot.auction || ""), esc((lot.auction_date || "").slice(0, 10))].filter(Boolean).join(" · ");
  const landed = lot._landed ? "A$" + Number(lot._landed.grandTotal).toLocaleString("en-AU") : "—";
  const landedLabel = lot._landed ? `Est. landed · ${esc(lot._landed.state)}` : "Est. landed";
  const spec = (label, value) => `<td width="50%" style="padding:10px 0;vertical-align:top;">
      <div style="font:600 10px/1 ${FONT};letter-spacing:0.1em;text-transform:uppercase;color:${MUTE};">${esc(label)}</div>
      <div style="font:600 14px/1.3 ${FONT};color:${INK};margin-top:5px;">${value}</div></td>`;

  return `<tr><td style="padding:22px 30px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${HAIR};border-radius:14px;overflow:hidden;">
      <tr><td style="background:#1a1a1a;">${img.medium
        ? `<img src="${esc(img.medium)}" width="600" alt="${title}" style="display:block;width:100%;max-width:600px;height:auto;background:#1a1a1a;">`
        : `<div style="height:170px;text-align:center;color:#9a854f;font:600 12px/170px ${FONT};letter-spacing:0.12em;text-transform:uppercase;">Photo on request</div>`}</td></tr>
      <tr><td style="padding:20px 22px 2px;">
        <table role="presentation" width="100%"><tr>
          <td style="font:700 19px/1.25 ${FONT};color:${INK};letter-spacing:-0.01em;">${title}</td>
          <td align="right" style="vertical-align:top;white-space:nowrap;">${strengthPill(lot)}</td>
        </tr></table>
        <div style="font:400 12px/1.4 ${FONT};color:${MUTE};margin-top:5px;">Lot ${esc(lot.lot || "—")}${sub ? " &middot; " + sub : ""}</div>
      </td></tr>

      <tr><td style="padding:16px 22px 2px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td width="50%" style="padding-right:6px;vertical-align:top;">
            <table role="presentation" width="100%" style="background:#FAF6EC;border:1px solid rgba(202,163,76,0.30);border-radius:11px;"><tr><td style="padding:13px 15px;">
              <div style="font:600 10px/1 ${FONT};letter-spacing:0.1em;text-transform:uppercase;color:${GOLDTXT};">Auction estimate</div>
              <div style="font:700 18px/1.2 ${FONT};color:${INK};margin-top:6px;">${yen(lot.avg_price || lot.start)}</div>
            </td></tr></table>
          </td>
          <td width="50%" style="padding-left:6px;vertical-align:top;">
            <table role="presentation" width="100%" style="background:${INK};border-radius:11px;"><tr><td style="padding:13px 15px;">
              <div style="font:600 10px/1 ${FONT};letter-spacing:0.1em;text-transform:uppercase;color:${GOLD};">${landedLabel}</div>
              <div style="font:700 18px/1.2 ${FONT};color:#ffffff;margin-top:6px;">${landed}</div>
            </td></tr></table>
          </td>
        </tr></table>
      </td></tr>

      <tr><td style="padding:4px 22px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>${spec("Grade", esc(lot.rate || "—"))}${spec("Mileage", km(lot.mileage))}</tr>
          <tr>${spec("Engine", esc(lot.eng_v || "—") + "cc")}${spec("Chassis", esc(lot.kuzov || "—"))}</tr>
          <tr>${spec("Trim", esc(lot.grade || "—"))}${spec("Colour", esc(lot.color || "—"))}</tr>
        </table>
      </td></tr>

      <tr><td style="padding:16px 22px 20px;border-top:1px solid ${HAIR};">
        <div style="margin-bottom:14px;">
          <span style="display:inline-block;width:26px;height:26px;border-radius:9999px;background:#F0E9D7;color:${GOLDTXT};font:700 11px/26px ${FONT};text-align:center;vertical-align:middle;">${esc(initials(wishlist.client_name))}</span>
          <span style="vertical-align:middle;margin-left:9px;font:600 13px/1.3 ${FONT};color:${INK};">${esc(wishlist.client_name)}</span>
          <span style="vertical-align:middle;font:400 12px/1.3 ${FONT};color:${MUTE};"> &middot; ${esc(wishlist.label || "wishlist")}</span>
        </div>
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="background:${GOLD};border-radius:8px;mso-padding-alt:14px 28px;">
            <a href="${esc(approve)}" style="display:inline-block;padding:14px 28px;border-radius:8px;text-decoration:none;"><span style="font-family:${FONT};font-size:14px;font-weight:700;line-height:1.2;color:#1A1A1A;text-decoration:none;">Approve &amp; send</span></a>
          </td>
          <td style="padding-left:10px;">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border:1px solid rgba(0,0,0,0.20);border-radius:8px;mso-padding-alt:13px 22px;">
              <a href="${esc(reject)}" style="display:inline-block;padding:13px 22px;border-radius:8px;text-decoration:none;"><span style="font-family:${FONT};font-size:14px;font-weight:600;line-height:1.2;color:#5A5E62;text-decoration:none;">Skip</span></a>
            </td></tr></table>
          </td>
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
    <div style="font:600 11px/1 ${FONT};letter-spacing:0.12em;text-transform:uppercase;color:${GOLDTXT};">Auction matches</div>
    <h1 style="margin:10px 0 6px;font:600 25px/1.15 ${FONT};letter-spacing:-0.015em;color:${INK};">${total} new auction match${total === 1 ? "" : "es"}</h1>
    <p style="margin:0;font:400 14px/1.5 ${FONT};color:${BODY};">Reviewed and approved cars are sent to the client. Skip the rest.</p>
  </td></tr>`;

  const bulk = `<tr><td style="padding:26px 36px 30px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${INK};border-radius:8px;"><tr>
      <td style="padding:18px 22px;font:500 14px/1.4 ${FONT};color:#fff;">${total} awaiting your review</td>
      <td align="right" style="padding:18px 22px;"><a href="${esc(publicUrl)}/admin?view=matches" style="background:#fff;color:${INK};font:600 13px/1 ${FONT};text-decoration:none;padding:10px 16px;border-radius:6px;display:inline-block;">Open Vehicle Finder</a></td>
    </tr></table>
  </td></tr>`;

  return shell(intro + cards + bulk + footer(), LOGO_URL);
}

// ---------------------------------------------------------------------------
// CLIENT email: a single approved match, warm second-person voice
// ---------------------------------------------------------------------------
function chip(text) {
  return `<span style="display:inline-block;background:rgba(202,163,76,0.10);border:1px solid rgba(202,163,76,0.40);border-radius:9999px;padding:5px 12px;font:500 12px/1.2 ${FONT};color:${GOLDTXT};margin:0 6px 8px 0;">✓ ${esc(text)}</span>`;
}
function keySpec(label, value) {
  return `<td width="50%" style="padding:10px 0;">
    <div style="font:600 11px/1 ${FONT};letter-spacing:0.1em;text-transform:uppercase;color:${MUTE};">${esc(label)}</div>
    <div style="font:600 15px/1.3 ${FONT};color:${INK};margin-top:4px;">${value}</div>
  </td>`;
}

export function clientHtml(lot, client, wishlist, publicUrl, landed) {
  const img = imageUrls(lot);
  const title = `${esc(lot.year || "")} ${esc(lot.marka_name || "")} ${esc(lot.model_name || "")}`.trim();
  // Prefer the real calculator landed figure; fall back to the rough multiplier.
  const landedStr = landed && Number.isFinite(Number(landed.grandTotal))
    ? "A$" + Number(landed.grandTotal).toLocaleString("en-AU")
    : aud(lot.avg_price || lot.start);
  const first = String(client?.name || "there").trim().split(/\s+/)[0];
  const want = [wishlist?.marka_name, wishlist?.model_name].filter(Boolean).join(" ") || "your search";

  // "Why it matches" chips, built from the wishlist criteria actually met.
  const chips = [];
  if (wishlist?.rate_min) chips.push(`Matches your grade ${wishlist.rate_min}+ requirement`);
  if (wishlist?.price_max) chips.push("Within your budget");
  if (wishlist?.kuzov) chips.push(`Correct chassis (${wishlist.kuzov})`);
  if (wishlist?.grade_kw) chips.push(`${wishlist.grade_kw} grade`);
  if (chips.length === 0) chips.push("Matches your saved search");

  const inner = `
  <tr><td style="padding:26px 36px 0;">
    <div style="font:600 11px/1 ${FONT};letter-spacing:0.12em;text-transform:uppercase;color:${GOLDTXT};">A match for your search</div>
    <h1 style="margin:10px 0 6px;font:600 25px/1.2 ${FONT};letter-spacing:-0.015em;color:${INK};">Hi ${esc(first)}, we think this one's for you.</h1>
    <p style="margin:0;font:400 14px/1.5 ${FONT};color:${BODY};">A ${esc(want)} just came up at a Japanese auction that lines up with what you're after.</p>
  </td></tr>

  <tr><td style="padding:20px 36px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${HAIR};border-radius:8px;overflow:hidden;">
      ${img.medium ? `<tr><td><img src="${esc(img.medium)}" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;background:#eee;"></td></tr>` : ""}
      <tr><td style="padding:16px 18px;">
        <div style="font:600 19px/1.2 ${FONT};color:${INK};">${title}</div>
        <div style="font:400 12px/1.3 ${FONT};color:${MUTE};margin-top:3px;">${esc(lot.auction || "")} · ${esc((lot.auction_date || "").slice(0, 10))}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
          <tr>${keySpec("Year", esc(lot.year || "—"))}${keySpec("Auction grade", esc(lot.rate || "—"))}</tr>
          <tr>${keySpec("Mileage", km(lot.mileage))}${keySpec("Chassis", esc(lot.kuzov || "—"))}</tr>
          <tr>${keySpec("Transmission", esc(lot.kpp || "—"))}${keySpec("Colour", esc(lot.color || "—"))}</tr>
        </table>
        <div style="margin-top:14px;">${chips.map(chip).join("")}</div>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:18px 36px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="50%" style="padding-right:8px;vertical-align:top;">
        <table role="presentation" width="100%" style="background:#FAFAF8;border-radius:8px;"><tr><td style="padding:14px 16px;">
          <div style="font:600 11px/1 ${FONT};letter-spacing:0.1em;text-transform:uppercase;color:${MUTE};">Auction estimate</div>
          <div style="font:600 18px/1.2 ${FONT};color:${INK};margin-top:5px;">${yen(lot.avg_price || lot.start)}</div>
        </td></tr></table>
      </td>
      <td width="50%" style="padding-left:8px;vertical-align:top;">
        <table role="presentation" width="100%" style="background:${INK};border-radius:8px;"><tr><td style="padding:14px 16px;">
          <div style="font:600 11px/1 ${FONT};letter-spacing:0.1em;text-transform:uppercase;color:${GOLD};">Indicative landed · AUD</div>
          <div style="font:600 18px/1.2 ${FONT};color:#fff;margin-top:5px;">${landedStr}</div>
        </td></tr></table>
      </td>
    </tr></table>
    <p style="margin:10px 0 0;font:400 11px/1.5 ${FONT};color:${MUTE};">Indicative only. Landed cost includes auction, export, shipping and duties, and is confirmed before you proceed. No obligation to bid.</p>
  </td></tr>

  <tr><td style="padding:20px 36px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="background:${GOLD};border-radius:8px;mso-padding-alt:14px 28px;">
        <a href="https://jdmconnect.com.au" style="display:inline-block;padding:14px 28px;border-radius:8px;text-decoration:none;"><span style="font-family:${FONT};font-size:15px;font-weight:700;line-height:1.2;color:#1A1A1A;text-decoration:none;">I'm interested</span></a>
      </td>
      <td style="padding-left:8px;">
        <a href="https://jdmconnect.com.au" style="display:inline-block;padding:14px 16px;text-decoration:none;"><span style="font-family:${FONT};font-size:14px;font-weight:600;line-height:1.2;color:${GOLDTXT};text-decoration:none;">View full auction sheet</span></a>
      </td>
    </tr></table>
  </td></tr>

  <tr><td style="padding:24px 36px 4px;">
    <div style="font:600 11px/1 ${FONT};letter-spacing:0.1em;text-transform:uppercase;color:${MUTE};">How it works</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;">
      ${["Tell us you're interested", "We bid on your behalf", "We handle the rest"].map((t, i) => `
        <tr><td style="padding:6px 0;font:400 14px/1.4 ${FONT};color:#3A3C3F;">
          <span style="display:inline-block;width:24px;height:24px;border-radius:9999px;border:1px solid ${GOLD};color:${GOLDTXT};font:600 12px/24px ${FONT};text-align:center;vertical-align:middle;">${i + 1}</span>
          <span style="vertical-align:middle;margin-left:10px;">${esc(t)}</span>
        </td></tr>`).join("")}
    </table>
  </td></tr>`;

  const ft = footer(`<div style="font:400 11px/1.5 ${FONT};color:${MUTE};margin-top:8px;">Eligibility subject to SEVS/RAWS. We'll confirm import compliance before you commit.</div>`);
  return shell(inner + `<tr><td style="height:20px;"></td></tr>` + ft, LOGO_URL);
}

// Plain-text version for WhatsApp / fallback.
export function carText(lot) {
  const lines = [
    `${lot.year || ""} ${lot.marka_name || ""} ${lot.model_name || ""}`.trim(),
    `Auction: ${lot.auction || "—"} (${(lot.auction_date || "").slice(0, 10)})`,
    `Grade: ${lot.rate || "—"} · Mileage: ${km(lot.mileage)}`,
    `Chassis: ${lot.kuzov || "—"} · ${lot.eng_v || "—"}cc`,
  ];
  if (Number(lot.avg_price || lot.start) > 0) lines.push(`Auction estimate: ${yen(lot.avg_price || lot.start)}`);
  return lines.join("\n");
}
