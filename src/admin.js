// JDM Connect — Vehicle Finder staff app (hi-fi redesign) + public request page.
// Light theme, gold single accent, Inter, hairline borders (per design handoff).

import { esc, yen, km } from "./render.js";
import { imageUrls, distinctMakers } from "./avtonet.js";
import { attachLanded, auStates, normalizeState } from "./calc.js";

// Maker field: a <select> of real feed makers, so the criteria always match the
// auction naming. Falls back to a free-text input if the feed lookup is down.
function makerField(makers, id) {
  if (!makers || !makers.length) return `<input name="marka_name" id="${id}" placeholder="e.g. TOYOTA">`;
  return `<select name="marka_name" id="${id}"><option value="">Any maker</option>` +
    makers.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join("") + `</select>`;
}

// Model field: free-text input backed by a <datalist> of the chosen maker's real
// models (filled by modelScript on maker change). Free text still works — it's
// matched as "contains", so "S400" or "SKYLINE" partials are fine.
function modelField(listId) {
  return `<input name="model_name" list="${listId}" placeholder="pick a maker, then choose or type"><datalist id="${listId}"></datalist>`;
}

// Inline JS: when the maker <select> changes, load that maker's models into the
// datalist via /api/models. No-op if the maker fell back to a text input.
function modelScript(makerId, listId) {
  return `<script>(function(){var mk=document.getElementById(${JSON.stringify(makerId)}),dl=document.getElementById(${JSON.stringify(listId)});if(!mk||!dl||mk.tagName!=="SELECT")return;mk.addEventListener("change",function(){dl.innerHTML="";if(!mk.value)return;fetch("/api/models?maker="+encodeURIComponent(mk.value)).then(function(r){return r.json();}).then(function(l){(l||[]).forEach(function(m){var o=document.createElement("option");o.value=m;dl.appendChild(o);});}).catch(function(){});});})();</script>`;
}

// <option> list of Australian states for the client forms.
function stateOptions(selected) {
  return `<option value="">— select —</option>` +
    auStates().map((s) => `<option value="${s}"${s === selected ? " selected" : ""}>${s}</option>`).join("");
}

// Official JDM Connect black horizontal lockup (inline SVG; browser-only).
const LOGO = `<svg viewBox="0 0 431.98 45.66" style="width:190px;height:auto;display:block" xmlns="http://www.w3.org/2000/svg" aria-label="JDM Connect">
<polygon points="133.86 45.51 150.93 .54 169.49 .54 182.2 31.95 215.18 .55 232.49 .54 215.4 45.5 201.57 45.51 213.16 14.41 181.27 45.51 172.35 45.51 159.78 13.79 147.44 45.51 133.86 45.51"></polygon>
<path d="M60.77,45.5L77.84.52h47.87c8.59,0,15.68.61,11.7,11.11-1.04,2.73-5.67,15.91-9.97,23.88-5.23,9.69-10.58,10.02-21.73,10.02l-44.94-.02ZM78.98,37.5h27.61c4.47,0,6.88-1.65,8.81-3.84,2.14-2.43,7.07-14.79,7.97-18.27,1.24-4.84-1.45-6.83-10.08-6.83h-23.43l-.14.44-10.74,28.5Z"></path>
<path d="M68.56.52c-2.18,5.74-4.3,11.29-6.59,17.33-6.74,17.77-8.86,27.67-29.03,27.67H-.05l3.15-7.98,28.65-.03c5.98-.43,8.57-2.77,11.03-8.22,2.93-6.47,4.88-13.89,7.73-20.45h-15.96c.96-2.78,1.76-5.94,3.4-8.32h30.61Z"></path>
<path d="M252.07,21.74h-10.75c-3.68,0-5.88-1.31-6.97-3.44-.94-1.84-1-4.35.05-7.13,1.16-3.06,3.48-5.85,6.25-7.78,2.47-1.72,5.33-2.78,8.65-2.78h10.75l-2.11,5.6h-10.75c-1.85,0-3.21.53-4.41,1.38-1.28.91-2.36,2.22-2.89,3.63-.48,1.28-.45,2.47.01,3.34.5,1,1.57,1.63,3.52,1.63h10.75l-2.1,5.57Z"></path>
<path d="M266.66,21.74c-3.68,0-5.88-1.31-6.97-3.44-.94-1.84-1-4.35.05-7.13,1.16-3.06,3.48-5.85,6.25-7.78,2.47-1.72,5.33-2.78,8.65-2.78h4.31c3.31,0,5.37,1.06,6.54,2.78,1.3,1.94,1.53,4.72.37,7.78-1.05,2.78-3,5.28-5.33,7.13-2.69,2.13-5.89,3.44-9.56,3.44h-4.31ZM272.52,6.2c-1.85,0-3.21.53-4.41,1.38-1.28.91-2.36,2.22-2.89,3.63-.48,1.28-.45,2.47.01,3.34.5,1,1.57,1.63,3.52,1.63h4.31c1.94,0,3.49-.63,4.74-1.63,1.12-.87,2.06-2.06,2.54-3.34.53-1.41.45-2.72-.15-3.63-.56-.84-1.52-1.38-3.37-1.38h-4.31Z"></path>
<path d="M313.83,17.64c-1.2,3.19-3.56,4.53-5.57,4.53-1.73,0-2.85-.5-3.39-1.66l-6.21-13.41c-.08-.19-.2-.28-.38-.28-.27,0-.6.22-.74.59l-5.4,14.32h-5.41l6.29-16.66c1.36-3.6,3.87-4.94,6.63-4.94,1.94,0,2.96.53,3.64,2.09l5.37,12.35c.07.22.24.25.42.25.24,0,.5-.19.64-.56l5.15-13.66h5.38l-6.43,17.04Z"></path>
<path d="M344.64,17.64c-1.2,3.19-3.56,4.53-5.57,4.53-1.73,0-2.85-.5-3.39-1.66l-6.21-13.41c-.08-.19-.2-.28-.38-.28-.27,0-.6.22-.74.59l-5.4,14.32h-5.41l6.29-16.66c1.36-3.6,3.87-4.94,6.63-4.94,1.94,0,2.96.53,3.65,2.09l5.37,12.35c.07.22.24.25.42.25.24,0,.5-.19.64-.56l5.15-13.66h5.38l-6.43,17.04Z"></path>
<path d="M377.95.6l-2.11,5.6h-15.61c-.33,0-.56.19-.69.53l-.91,2.41h16.01l-1.53,4.06h-16.01l-.97,2.56c-.14.38-.06.56.27.56h15.61l-2.04,5.41h-18.71c-1.91,0-2.52-.97-1.78-2.94l5.79-15.35c.72-1.91,2.05-2.85,3.99-2.85h18.68Z"></path>
<path d="M396.04,21.74h-10.75c-3.68,0-5.88-1.31-6.97-3.44-.94-1.84-1-4.35.05-7.13,1.16-3.06,3.48-5.85,6.25-7.78,2.47-1.72,5.33-2.78,8.64-2.78h10.75l-2.11,5.6h-10.75c-1.85,0-3.21.53-4.41,1.38-1.28.91-2.36,2.22-2.89,3.63-.48,1.28-.45,2.47.01,3.34.5,1,1.57,1.63,3.52,1.63h10.75l-2.1,5.57Z"></path>
<path d="M432.03.6l-2.11,5.6h-8.99l-5.86,15.54h-5.53l5.86-15.54h-9.02l2.11-5.6h23.54Z"></path>
</svg>`;

const FONT = `"Inter",-apple-system,BlinkMacSystemFont,"Helvetica Neue",Helvetica,Arial,sans-serif`;

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  :root{--gold:#CAA34C;--gold-hover:#D9B45F;--gold-txt:#896B2D;--gold-tint:rgba(202,163,76,0.12);--avatar:#F0E9D7;
    --ink:#1A1A1A;--t2:#4C5055;--t3:#6F7378;--faint:#B6B9BC;--bg:#E9EAEB;--card:#fff;--off:#FAFAFB;--hair:rgba(0,0,0,0.08);}
  *{box-sizing:border-box}
  body{margin:0;font-family:${FONT};color:var(--ink);background:var(--card);font-variant-numeric:tabular-nums}
  a{color:inherit;text-decoration:none}
  .wrap{display:flex;min-height:100vh}
  .side{width:256px;flex:0 0 256px;border-right:1px solid var(--hair);display:flex;flex-direction:column;padding:26px 20px;background:#fff}
  .side .brand{padding:4px 6px 20px;margin-bottom:18px;border-bottom:1px solid var(--hair)}
  .nav{margin-top:0;display:flex;flex-direction:column;gap:2px}
  .nav a{display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:6px;font-size:15px;color:var(--t2)}
  .nav a .bar{width:3px;height:17px;border-radius:2px;background:transparent}
  .nav a .lbl{flex:1}
  .nav a .ct{font-size:13px;color:var(--faint);font-weight:500}
  .nav a.active{background:var(--gold-tint);color:var(--ink);font-weight:600}
  .nav a.active .bar{background:var(--gold)}
  .nav a.active .ct{color:var(--gold-txt)}
  .nav a:hover:not(.active){background:#f6f6f7}
  .side-foot{margin-top:auto;display:flex;flex-direction:column;gap:16px;padding-top:20px}
  .btn-search{display:flex;align-items:center;justify-content:center;gap:9px;background:var(--gold);color:var(--ink);font-weight:600;padding:13px;border-radius:6px;font-size:15px}
  .btn-search:hover{background:var(--gold-hover)}
  .btn-search .dot{width:7px;height:7px;border-radius:9999px;background:var(--ink);display:inline-block}
  .main{flex:1;background:var(--bg);display:flex;flex-direction:column}
  .topbar{position:sticky;top:0;z-index:5;background:#fff;padding:30px 40px 26px;display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid var(--hair)}
  .kicker{display:flex;align-items:center;gap:10px;color:var(--gold-txt);font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase}
  .kicker:before{content:"";width:24px;height:1px;background:var(--gold);display:inline-block}
  h1{font-size:33px;font-weight:600;letter-spacing:-0.015em;margin:12px 0 6px;line-height:1.05}
  .subline{color:var(--t3);font-size:15px;margin:0}
  .btn-dark{background:var(--ink);color:#fff;font-weight:600;padding:12px 20px;border-radius:6px;font-size:14px;white-space:nowrap}
  .btn-dark:hover{background:#333436}
  .content{padding:32px 40px 60px;max-width:1180px}
  .card{background:#fff;border:1px solid var(--hair);border-radius:8px;padding:24px 26px;margin-bottom:24px}
  .card>h2{font-size:16px;font-weight:600;margin:0 0 20px;display:flex;align-items:center;gap:11px;border-bottom:1px solid var(--hair);padding-bottom:16px}
  .card>h2 .num{color:var(--gold);font-weight:700}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px 22px}
  label{display:block;font-size:12px;color:var(--t2);margin-bottom:7px;font-weight:600;letter-spacing:0.02em}
  label .opt{color:var(--faint);font-weight:400;text-transform:none;letter-spacing:0}
  input,select{width:100%;padding:11px 13px;border:1px solid rgba(0,0,0,0.14);border-radius:5px;font-size:14px;background:#FBFBFC;color:var(--ink);font-family:${FONT}}
  input::placeholder{color:#B6B9BC}
  input:focus,select:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 3px rgba(202,163,76,0.16);background:#fff}
  .actions{display:flex;align-items:center;gap:14px;margin-top:22px}
  .btn-gold{background:var(--gold);color:var(--ink);font-weight:600;border:0;padding:11px 22px;border-radius:6px;font-size:14px;cursor:pointer;font-family:${FONT}}
  .btn-gold:hover{background:var(--gold-hover)}
  .help{color:var(--faint);font-size:13px}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th{text-align:left;padding:12px 10px;background:var(--off);color:var(--t3);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid var(--hair)}
  td{padding:15px 10px;border-bottom:1px solid rgba(0,0,0,0.05);color:var(--t2)}
  .avatar{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;background:var(--avatar);color:var(--gold-txt);font-size:11px;font-weight:600;vertical-align:middle;margin-right:10px}
  .yes{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:9999px;background:var(--gold-tint);color:var(--gold-txt);font-size:12px}
  .btn-del{background:transparent;border:1px solid rgba(177,18,38,0.3);color:#B11226;font-size:12px;font-weight:600;padding:7px 12px;border-radius:5px;cursor:pointer;font-family:${FONT}}
  .btn-del:hover{background:rgba(177,18,38,0.06)}
  .btn-toggle{border:1px solid var(--hair);font-size:12px;font-weight:600;padding:7px 14px;border-radius:9999px;cursor:pointer;background:#fff;font-family:${FONT}}
  .btn-toggle.on{background:var(--gold-tint);border-color:var(--gold);color:var(--gold-txt)}
  .btn-toggle.off{background:#f3f4f6;color:var(--t3)}
  .btn-toggle:hover{filter:brightness(0.98)}
  .banner{display:flex;align-items:center;gap:12px;margin-bottom:24px;padding:16px 22px;background:#fff;border:1px solid var(--hair);border-left:3px solid var(--gold);border-radius:6px}
  .banner .reddot{width:6px;height:6px;border-radius:9999px;background:#B11226;display:inline-block}
  .banner .txt{font-size:14px;color:var(--t2)}
  .mgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:22px}
  .mcard{background:#fff;border:1px solid var(--hair);border-radius:8px;overflow:hidden;display:flex;flex-direction:column}
  .mphoto{position:relative;aspect-ratio:16/10;background:#ddd;background-size:cover;background-position:center}
  .mphoto .grad{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.78) 0%,rgba(0,0,0,0) 55%)}
  .pill{position:absolute;top:12px;display:inline-flex;align-items:center;gap:6px;background:rgba(0,0,0,0.55);backdrop-filter:blur(2px);border-radius:3px;padding:4px 9px;font-size:11px;font-weight:600;color:#fff;letter-spacing:0.04em}
  .pill.lot{left:12px}
  .pill.str{right:12px;background:rgba(0,0,0,0.55)}
  .pill.str .sd{width:7px;height:7px;border-radius:9999px;display:inline-block}
  .mphoto .ttl{position:absolute;left:14px;right:14px;bottom:12px;color:#fff}
  .mphoto .ttl .t{font-size:16px;font-weight:600;letter-spacing:-0.01em}
  .mphoto .ttl .a{font-size:11px;color:#E6E7E8;margin-top:3px}
  .mstats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:16px}
  .mstats .s .k{font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--faint)}
  .mstats .s .v{font-size:13px;font-weight:600;margin-top:5px;color:var(--ink)}
  .mstats .s.gold .v{color:var(--gold-txt)}
  .mland{display:flex;align-items:center;justify-content:space-between;padding:11px 16px;background:#FBF7EC;border-top:1px solid var(--hair)}
  .mland .ml-k{font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:var(--gold-txt)}
  .mland .ml-v{font-size:15px;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums}
  .mfoot{border-top:1px solid var(--hair);padding:14px 16px;display:flex;align-items:center;gap:10px}
  .mfoot .who{flex:1;min-width:0}
  .mfoot .who .n{font-size:13px;font-weight:600;color:var(--ink)}
  .mfoot .who .w{font-size:11px;color:var(--t3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .btn-notify{background:var(--ink);color:#fff;font-weight:600;font-size:13px;padding:9px 14px;border-radius:5px;white-space:nowrap}
  .btn-notify:hover{background:#333436}
  .btn-skip{color:var(--t3);font-size:13px;padding:9px 8px}
  .empty{color:var(--faint);padding:30px 0;text-align:center}
  .empty .rule{width:40px;height:1px;background:rgba(202,163,76,0.7);margin:0 auto 16px}
  .signout{display:block;text-align:center;color:var(--t3);font-size:13px;padding:10px;border-radius:6px}
  .signout:hover{background:#f6f6f7;color:var(--ink)}
  .login-screen{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);padding:24px}
  .login-card{width:100%;max-width:380px;background:#fff;border:1px solid var(--hair);border-radius:12px;padding:34px 32px 30px;box-shadow:0 14px 44px rgba(0,0,0,0.07)}
  .login-card .login-logo{display:flex;justify-content:center;padding-bottom:20px;margin-bottom:24px;border-bottom:1px solid var(--hair)}
  .login-card h1{font-size:21px;font-weight:600;margin:0 0 6px;text-align:center;letter-spacing:-0.01em}
  .login-card .login-sub{color:var(--t3);font-size:14px;text-align:center;margin:0 0 22px;line-height:1.45}
  .login-card label{margin-bottom:8px}
  .login-card .btn-gold{width:100%;margin-top:18px;padding:13px;font-size:15px;display:block}
  .login-err{background:rgba(177,18,38,0.06);border:1px solid rgba(177,18,38,0.25);color:#B11226;font-size:13px;padding:10px 12px;border-radius:6px;margin-bottom:16px;text-align:center}
  @media(max-width:920px){.wrap{flex-direction:column}.side{width:auto;flex:none;flex-direction:row;flex-wrap:wrap;align-items:center;gap:10px}.nav{flex-direction:row;margin-top:0;flex-wrap:wrap}.side-foot{margin:0 0 0 auto;flex-direction:row;padding-top:0}}
  @media(max-width:640px){.grid{grid-template-columns:1fr}.topbar,.content{padding-left:20px;padding-right:20px}}
`;

function initials(name) {
  return String(name || "?").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function sidebar(active, counts) {
  const item = (id, label, count) =>
    `<a class="${active === id ? "active" : ""}" href="/admin?view=${id}">
      <span class="bar"></span><span class="lbl">${label}</span><span class="ct">${count ?? ""}</span></a>`;
  return `<aside class="side">
    <div class="brand">${LOGO}</div>
    <nav class="nav">
      ${item("intake", "Intake", "")}
      ${item("clients", "Clients", counts.clients)}
      ${item("wishlists", "Wishlists", counts.wishlists)}
      ${item("matches", "Matches", counts.matches || "")}
    </nav>
    <div class="side-foot">
      <a class="btn-search" href="/run"><span class="dot"></span>Search auctions</a>
      <a class="signout" href="/logout">Sign out</a>
    </div>
  </aside>`;
}

const HEADERS = {
  intake: { kicker: "Vehicle Finder", title: "Intake", sub: "Add a client and the vehicles they're looking for.", btn: "Search auctions" },
  clients: { kicker: "Vehicle Finder", title: "Clients", sub: "Your buyer directory.", btn: "Add via Intake" },
  wishlists: { kicker: "Vehicle Finder", title: "Wishlists", sub: "Search criteria matched against the live auction feed.", btn: "Add via Intake" },
  matches: { kicker: "Vehicle Finder", title: "Matches", sub: "Auction lots matched to your clients' wishlists.", btn: "Search again" },
};

export async function adminPage(env, view = "intake") {
  if (!HEADERS[view]) view = "intake";
  const clients = (await env.DB.prepare("SELECT * FROM clients ORDER BY name").all()).results || [];
  const wishlists = (await env.DB.prepare(
    `SELECT w.*, c.name AS client_name FROM wishlists w JOIN clients c ON c.id = w.client_id ORDER BY c.name, w.id`
  ).all()).results || [];
  const pending = (await env.DB.prepare(
    `SELECT q.*, c.name AS client_name, c.state AS client_state, w.label AS wlabel FROM queue q
       JOIN clients c ON c.id = q.client_id
       LEFT JOIN wishlists w ON w.id = q.wishlist_id
      WHERE q.status = 'pending' ORDER BY q.created_at DESC LIMIT 60`
  ).all()).results || [];

  // Landed cost per pending match (Matches tab only). Reuse the estimate
  // snapshotted into lot_json at queue time; only legacy rows without one are
  // computed here (bounded), so a page load makes few or no calculator calls.
  if (view === "matches") {
    const needCalc = [];
    for (const q of pending) {
      let lot = {};
      try { lot = JSON.parse(q.lot_json); } catch (e) { console.error("Bad lot_json, queue id", q.id, e.message); }
      if (lot._landed) q._landed = lot._landed;
      else needCalc.push({ q, lot });
    }
    if (needCalc.length) {
      await attachLanded(env, needCalc.map(({ q, lot }) => ({ lot, client: { state: q.client_state } })));
      const ups = [];
      for (const { q, lot } of needCalc) {
        if (lot._landed) {
          q._landed = lot._landed;
          // Persist so this row is never recomputed (self-healing backfill for
          // matches queued before landed-cost existed).
          ups.push(env.DB.prepare("UPDATE queue SET lot_json = ? WHERE id = ?").bind(JSON.stringify(lot), q.id));
        }
      }
      if (ups.length) await env.DB.batch(ups);
    }
  }

  const counts = { clients: clients.length, wishlists: wishlists.length, matches: pending.length };
  const h = HEADERS[view];
  const primary = view === "matches" || view === "intake"
    ? `<a class="btn-dark" href="/run">${esc(h.btn)}</a>`
    : `<a class="btn-dark" href="/admin?view=intake">${esc(h.btn)}</a>`;

  const makers = view === "intake" ? await distinctMakers(env) : [];
  let body = "";
  if (view === "intake") body = intakeView(clients, makers);
  else if (view === "clients") body = clientsView(clients, wishlists);
  else if (view === "wishlists") body = wishlistsView(wishlists);
  else if (view === "matches") body = matchesView(pending);

  const main = `
    <div class="topbar">
      <div>
        <div class="kicker">${esc(h.kicker)}</div>
        <h1>${esc(h.title)}</h1>
        <p class="subline">${esc(h.sub)}</p>
      </div>
      ${primary}
    </div>
    <div class="content">${body}</div>`;

  return shell(sidebar(view, counts), main, esc(h.title) + " — JDM Connect");
}

// Styled login screen shown when there's no valid session.
export function loginPage(opts = {}) {
  const err = opts.error ? `<div class="login-err">Incorrect password — please try again.</div>` : "";
  const body = `<div class="login-screen">
    <form class="login-card" method="POST" action="/login">
      <div class="login-logo">${LOGO}</div>
      <h1>Vehicle Finder</h1>
      <p class="login-sub">Sign in to manage clients, wishlists and auction matches.</p>
      ${err}
      <label>PASSWORD</label>
      <input type="password" name="password" autocomplete="current-password" autofocus required>
      <button class="btn-gold" type="submit">Sign in</button>
    </form>
  </div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in — JDM Connect</title><style>${CSS}</style></head><body>${body}</body></html>`;
}

function intakeView(clients, makers) {
  const clientOptions = clients.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")
    || `<option value="">(add a client first)</option>`;
  return `
    <div class="card">
      <h2><span class="num">01</span> New client</h2>
      <form method="POST" action="/client">
        <div class="grid">
          <div><label>NAME</label><input name="name" placeholder="Jane Citizen" required></div>
          <div><label>EMAIL</label><input name="email" type="email" placeholder="name@email.com"></div>
          <div><label>WHATSAPP <span class="opt">(+61…)</span></label><input name="whatsapp" placeholder="+61 4XX XXX XXX"></div>
          <div><label>STATE <span class="opt">(for landed cost)</span></label><select name="state">${stateOptions("")}</select></div>
        </div>
        <div class="actions"><button class="btn-gold" type="submit">Add client</button>
          <span class="help">Name is required. Email and WhatsApp are optional.</span></div>
      </form>
    </div>
    <div class="card">
      <h2><span class="num">02</span> New wishlist</h2>
      <form method="POST" action="/wishlist">
        <div class="grid">
          <div><label>CLIENT</label><select name="client_id" required>${clientOptions}</select></div>
          <div><label>LABEL</label><input name="label" placeholder="e.g. under 1.5M daily"></div>
          <div><label>MAKER</label>${makerField(makers, "wl-maker")}</div>
          <div><label>MODEL <span class="opt">(pick or type)</span></label>${modelField("wl-models")}</div>
          <div><label>YEAR MIN</label><input name="year_min" type="number" placeholder="1990"></div>
          <div><label>YEAR MAX</label><input name="year_max" type="number" placeholder="2002"></div>
          <div><label>MAX PRICE (JPY)</label><input name="price_max" type="number" placeholder="1,500,000"></div>
          <div><label>MAX MILEAGE (KM)</label><input name="mileage_max" type="number" placeholder="80,000"></div>
          <div><label>MIN GRADE</label><input name="rate_min" type="number" step="0.5" placeholder="e.g. 4"></div>
          <div><label>CHASSIS CODE <span class="opt">(contains)</span></label><input name="kuzov" placeholder="e.g. ZRE212"></div>
          <div><label>GRADE KEYWORD <span class="opt">(contains)</span></label><input name="grade_kw" placeholder="e.g. RS"></div>
        </div>
        <div class="actions"><button class="btn-gold" type="submit">Add wishlist</button>
          <span class="help">Blank fields match anything. Only filled criteria filter the auction feed.</span></div>
      </form>
    </div>
    ${modelScript("wl-maker", "wl-models")}`;
}

function clientsView(clients, wishlists) {
  const countFor = (id) => wishlists.filter((w) => w.client_id === id).length;
  const rows = clients.map((c) =>
    `<tr>
      <td><span class="avatar">${esc(initials(c.name))}</span>${esc(c.name)}</td>
      <td>${esc(c.email || "—")}</td><td>${esc(c.whatsapp || "—")}</td><td>${esc(c.state || "—")}</td>
      <td style="text-align:right">${countFor(c.id)}</td>
      <td style="text-align:right"><form method="POST" action="/client/delete" style="display:inline" onsubmit="return confirm('Delete this client and all their wishlists? This cannot be undone.')"><input type="hidden" name="id" value="${c.id}"><button class="btn-del" type="submit">Delete</button></form></td>
    </tr>`
  ).join("") || `<tr><td colspan="6" class="empty">No clients yet</td></tr>`;
  return `<div class="card" style="padding:0;overflow:hidden">
    <table><tr><th>Client</th><th>Email</th><th>WhatsApp</th><th>State</th><th style="text-align:right">Wishlists</th><th></th></tr>${rows}</table></div>`;
}

function wishlistsView(wishlists) {
  const rows = wishlists.map((w) =>
    `<tr>
      <td><span class="avatar">${esc(initials(w.client_name))}</span>${esc(w.client_name)}</td>
      <td>${esc(w.label || "—")}</td>
      <td>${esc(w.marka_name || "any")} ${esc(w.model_name || "")}</td>
      <td>${esc(w.year_min || "")}–${esc(w.year_max || "")}</td>
      <td>${w.price_max ? "¥" + Number(w.price_max).toLocaleString() : "—"}</td>
      <td>${w.mileage_max ? Number(w.mileage_max).toLocaleString() + "km" : "—"}</td>
      <td>${esc(w.rate_min || "—")}</td>
      <td><form method="POST" action="/wishlist/toggle" style="display:inline"><input type="hidden" name="id" value="${w.id}"><button class="btn-toggle ${w.active ? "on" : "off"}" type="submit">${w.active ? "On" : "Off"}</button></form></td>
      <td style="text-align:right"><form method="POST" action="/wishlist/delete" style="display:inline" onsubmit="return confirm('Delete this wishlist? This cannot be undone.')"><input type="hidden" name="id" value="${w.id}"><button class="btn-del" type="submit">Delete</button></form></td>
    </tr>`
  ).join("") || `<tr><td colspan="9" class="empty">No wishlists yet</td></tr>`;
  return `<div class="card" style="padding:0;overflow:hidden">
    <table><tr><th>Client</th><th>Label</th><th>Vehicle</th><th>Years</th><th>Max ¥</th><th>Max km</th><th>Grade</th><th>Active</th><th></th></tr>${rows}</table></div>`;
}

function matchCard(q) {
  let lot = {};
  try { lot = JSON.parse(q.lot_json); } catch (e) {}
  const img = imageUrls(lot).medium;
  const title = `${esc(lot.year || "")} ${esc(lot.marka_name || "")} ${esc(lot.model_name || "")}`.trim();
  const strength = lot._strength || "Possible";
  const sColor = lot._strengthColor || "#B6B9BC";
  const bid = Number(lot.start) > 0 ? yen(lot.start) : yen(lot.avg_price);
  const approve = `/decide?token=${esc(q.token)}&action=approve`;
  const skip = `/decide?token=${esc(q.token)}&action=reject`;
  return `<div class="mcard">
    <div class="mphoto" style="${img ? `background-image:url('${esc(img)}')` : ""}">
      <div class="grad"></div>
      <span class="pill lot">Lot ${esc(lot.lot || "—")}</span>
      <span class="pill str"><span class="sd" style="background:${sColor}"></span>${esc(strength)}</span>
      <div class="ttl"><div class="t">${title}</div><div class="a">${esc(lot.auction || "")} · ${esc((lot.auction_date || "").slice(0, 10))}</div></div>
    </div>
    <div class="mstats">
      <div class="s"><div class="k">Year</div><div class="v">${esc(lot.year || "—")}</div></div>
      <div class="s gold"><div class="k">Grade</div><div class="v">${esc(lot.rate || "—")}</div></div>
      <div class="s"><div class="k">Odometer</div><div class="v">${lot.mileage ? Math.round(Number(lot.mileage) / 1000) + "k" : "—"}</div></div>
      <div class="s gold"><div class="k">Bid</div><div class="v">${bid}</div></div>
    </div>
    ${q._landed ? `<div class="mland"><span class="ml-k">Est. landed · ${esc(q._landed.state)}</span><span class="ml-v">A$${Number(q._landed.grandTotal).toLocaleString("en-AU")}</span></div>` : ""}
    <div class="mfoot">
      <span class="avatar">${esc(initials(q.client_name))}</span>
      <div class="who"><div class="n">${esc(q.client_name)}</div><div class="w">${esc(q.wlabel || "wishlist")}</div></div>
      <a class="btn-skip" href="${skip}">Skip</a>
      <a class="btn-notify" href="${approve}">Notify client</a>
    </div>
  </div>`;
}

function matchesView(pending) {
  if (pending.length === 0) {
    return `<div class="card"><div class="empty"><div class="rule"></div>
      No matches awaiting review. Press <strong>Search auctions</strong> to score today's lots against every wishlist.</div></div>`;
  }
  return `<div class="banner"><span class="reddot"></span>
      <span class="txt"><strong>${pending.length}</strong> ${pending.length === 1 ? "match" : "matches"} awaiting your review</span></div>
    <div class="mgrid">${pending.map((q) => matchCard(q)).join("")}</div>`;
}

// ---------------------------------------------------------------------------
// Public request page
// ---------------------------------------------------------------------------
export async function requestPage(env, opts = {}) {
  const ok = opts.submitted;
  const makers = await distinctMakers(env);
  const main = `
    <div class="topbar">
      <div>
        <div class="kicker">Vehicle Finder</div>
        <h1>Request a vehicle</h1>
        <p class="subline">Tell us what you're after and we'll search the Japanese auctions for it.</p>
      </div>
    </div>
    <div class="content">
      ${ok ? `<div class="card"><h2><span class="num">✓</span> Request received</h2>
        <p class="help">Thanks. We'll start scanning the auctions and be in touch when matching vehicles come up.</p></div>` : ""}
      <div class="card">
        <h2><span class="num">01</span> Your details</h2>
        <form method="POST" action="/request">
          <div class="grid">
            <div><label>NAME</label><input name="name" placeholder="Jane Citizen" required></div>
            <div><label>EMAIL</label><input name="email" type="email" placeholder="name@email.com"></div>
            <div><label>WHATSAPP <span class="opt">(+61…)</span></label><input name="whatsapp" placeholder="+61 4XX XXX XXX"></div>
            <div><label>STATE <span class="opt">(where it'll be registered)</span></label><select name="state">${stateOptions("")}</select></div>
          </div>
          <h2 style="margin-top:26px"><span class="num">02</span> What you're looking for</h2>
          <div class="grid">
            <div><label>MAKER</label>${makerField(makers, "rq-maker")}</div>
            <div><label>MODEL <span class="opt">(pick or type)</span></label>${modelField("rq-models")}</div>
            <div><label>LABEL <span class="opt">(optional)</span></label><input name="label" placeholder="e.g. weekend project"></div>
            <div><label>YEAR MIN</label><input name="year_min" type="number" placeholder="1990"></div>
            <div><label>YEAR MAX</label><input name="year_max" type="number" placeholder="2002"></div>
            <div><label>MAX PRICE (JPY)</label><input name="price_max" type="number" placeholder="3,000,000"></div>
            <div><label>MAX MILEAGE (KM)</label><input name="mileage_max" type="number" placeholder="100,000"></div>
            <div><label>MIN GRADE</label><input name="rate_min" type="number" step="0.5" placeholder="e.g. 4"></div>
            <div><label>CHASSIS CODE <span class="opt">(contains)</span></label><input name="kuzov" placeholder="e.g. JZA80"></div>
          </div>
          <div class="actions"><button class="btn-gold" type="submit">Submit request</button>
            <span class="help">Leave fields blank to match anything. We review every match before sending.</span></div>
        </form>
      </div>
    </div>
    ${modelScript("rq-maker", "rq-models")}`;
  const sb = `<aside class="side"><div class="brand">${LOGO}</div>
    <nav class="nav"><a class="active"><span class="bar"></span><span class="lbl">Request a vehicle</span></a></nav>
    </aside>`;
  return shell(sb, main, "Request a vehicle — JDM Connect");
}

function shell(side, main, title) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${CSS}</style></head>
    <body><div class="wrap">${side}<div class="main">${main}</div></div></body></html>`;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------
export async function createClient(env, form) {
  const state = normalizeState(form.get("state"));
  const r = await env.DB.prepare("INSERT INTO clients (name, email, whatsapp, state) VALUES (?, ?, ?, ?)")
    .bind(form.get("name"), form.get("email") || null, form.get("whatsapp") || null, state).run();
  return r.meta?.last_row_id;
}

const num = (form, k) => { const v = form.get(k); return v === null || v === "" ? null : Number(v); };
const str = (form, k) => { const v = form.get(k); return v === null || v === "" ? null : v; };

export async function createWishlist(env, form, clientIdOverride) {
  const clientId = clientIdOverride ?? num(form, "client_id");
  await env.DB.prepare(
    `INSERT INTO wishlists
      (client_id, label, marka_name, model_name, year_min, year_max, price_max, mileage_max, rate_min, kuzov, grade_kw)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    clientId, str(form, "label"), str(form, "marka_name"), str(form, "model_name"),
    num(form, "year_min"), num(form, "year_max"), num(form, "price_max"), num(form, "mileage_max"),
    num(form, "rate_min"), str(form, "kuzov"), str(form, "grade_kw")
  ).run();
}

// Delete a client and everything attached to them — their wishlists, queued
// matches, and seen-lot history — in one batch.
export async function deleteClient(env, id) {
  const cid = Number(id);
  if (!Number.isInteger(cid) || cid <= 0) return;
  const wls = (await env.DB.prepare("SELECT id FROM wishlists WHERE client_id = ?").bind(cid).all()).results || [];
  const stmts = [env.DB.prepare("DELETE FROM queue WHERE client_id = ?").bind(cid)];
  for (const w of wls) stmts.push(env.DB.prepare("DELETE FROM seen_lots WHERE wishlist_id = ?").bind(w.id));
  stmts.push(env.DB.prepare("DELETE FROM wishlists WHERE client_id = ?").bind(cid));
  stmts.push(env.DB.prepare("DELETE FROM clients WHERE id = ?").bind(cid));
  await env.DB.batch(stmts);
}

// Delete a single wishlist plus its queued matches and seen-lot history.
export async function deleteWishlist(env, id) {
  const wid = Number(id);
  if (!Number.isInteger(wid) || wid <= 0) return;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM queue WHERE wishlist_id = ?").bind(wid),
    env.DB.prepare("DELETE FROM seen_lots WHERE wishlist_id = ?").bind(wid),
    env.DB.prepare("DELETE FROM wishlists WHERE id = ?").bind(wid),
  ]);
}

// Flip a wishlist active/paused. Paused wishlists are skipped by the matcher.
export async function toggleWishlist(env, id) {
  const wid = Number(id);
  if (!Number.isInteger(wid) || wid <= 0) return;
  await env.DB.prepare(
    "UPDATE wishlists SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END WHERE id = ?"
  ).bind(wid).run();
}

export async function createRequest(env, form) {
  const clientId = await createClient(env, form);
  await createWishlist(env, form, clientId);
}
