// JDM Connect - Vehicle Finder staff app (hi-fi redesign) + public request page.
// Light theme, gold single accent, Inter, hairline borders (per design handoff).

import { esc, yen, km, displayGrade } from "./render.js";
import { imageUrls, distinctMakers } from "./avtonet.js";
import { attachLanded, auStates, normalizeState } from "./calc.js";
import { hashPassword, randomToken } from "./auth.js";
import { getSettings, settingOn } from "./settings.js";
import { brandDoc, brandShell, risingSun } from "./theme.js";

// Maker field: a <select> of real feed makers, so the criteria always match the
// auction naming. Falls back to a free-text input if the feed lookup is down.
function makerField(makers, id) {
  if (!makers || !makers.length) return `<input name="marka_name" id="${id}" placeholder="e.g. TOYOTA">`;
  return `<select name="marka_name" id="${id}"><option value="">Any maker</option>` +
    makers.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join("") + `</select>`;
}

// Model field: free-text input backed by a <datalist> of the chosen maker's real
// models (filled by modelScript on maker change). Free text still works - it's
// matched as "contains", so "S400" or "SKYLINE" partials are fine.
function modelField(listId) {
  return `<input name="model_name" list="${listId}" placeholder="pick a maker, then choose or type"><datalist id="${listId}"></datalist>`;
}

// Inline JS: when the maker <select> changes, load that maker's models into the
// datalist via /api/models. No-op if the maker fell back to a text input.
function modelScript(makerId, listId) {
  return `<script>(function(){var mk=document.getElementById(${JSON.stringify(makerId)}),dl=document.getElementById(${JSON.stringify(listId)});if(!mk||!dl||mk.tagName!=="SELECT")return;mk.addEventListener("change",function(){dl.innerHTML="";if(!mk.value)return;fetch("/api/models?maker="+encodeURIComponent(mk.value)).then(function(r){return r.json();}).then(function(l){(l||[]).forEach(function(m){var o=document.createElement("option");o.value=m;dl.appendChild(o);});}).catch(function(){});});})();</script>`;
}

// Curated wishlist presets: pick one and it auto-fills make/model/code/year for a
// known model. EDIT THIS LIST to add or refine presets - especially tricky ones
// like the E55 (listed under "Mercedes AMG", not Mercedes-Benz). Make uses
// best-match, so the brand word alone is enough. Verify values against the feed.
const WL_PRESETS = [
  { name: "Mercedes E55 AMG (W211)", make: "MERCEDES", model: "E-Class", year_min: 2003, year_max: 2006, label: "E55 AMG" },
  { name: "Mercedes E63 AMG (W211)", make: "MERCEDES", model: "E-Class", year_min: 2006, year_max: 2009, label: "E63 AMG" },
  { name: "Nissan Skyline GT-R (R34)", make: "NISSAN", model: "SKYLINE", kuzov: "BNR34", year_min: 1999, year_max: 2002, label: "R34 GT-R" },
  { name: "Nissan Skyline GT-R (R33)", make: "NISSAN", model: "SKYLINE", kuzov: "BCNR33", year_min: 1995, year_max: 1998, label: "R33 GT-R" },
  { name: "Toyota Supra (A80 / JZA80)", make: "TOYOTA", model: "SUPRA", kuzov: "JZA80", year_min: 1993, year_max: 2002, label: "A80 Supra" },
  { name: "Honda NSX", make: "HONDA", model: "NSX", year_min: 1990, year_max: 2005, label: "NSX" },
  { name: "Mazda RX-7 (FD3S)", make: "MAZDA", model: "RX-7", kuzov: "FD3S", year_min: 1991, year_max: 2002, label: "FD RX-7" },
  { name: "Subaru WRX STI (GDB)", make: "SUBARU", model: "IMPREZA", kuzov: "GDB", year_min: 2000, year_max: 2007, label: "GDB STI" },
];

// Dropdown that fills a wishlist form from a preset. Works on any wishlist form
// (matches inputs by name, relative to the form).
function presetSelect() {
  return `<div style="margin-bottom:14px;max-width:430px"><label>QUICK PRESET <span class="opt">(auto-fills the fields for a known model)</span></label>
    <select onchange="jdmPreset(this)"><option value="">Choose a preset…</option>${WL_PRESETS.map((p, i) => `<option value="${i}">${esc(p.name)}</option>`).join("")}</select></div>`;
}
function presetScript() {
  return `<script>var WL_PRESETS=${JSON.stringify(WL_PRESETS)};function jdmPreset(sel){var p=WL_PRESETS[sel.value];if(!p){return;}var form=sel.closest("form")||document;function set(n,v){var el=form.querySelector('[name="'+n+'"]');if(el&&v!=null&&v!=="")el.value=v;}var mk=form.querySelector('[name="marka_name"]');if(mk){if(mk.tagName==="SELECT"){var want=(p.make||"").toUpperCase();var tok=want.split(/[\\s-]+/)[0];var opt=null;for(var i=0;i<mk.options.length;i++){var ov=(mk.options[i].value||"").toUpperCase();if(ov===want){opt=mk.options[i];break;}if(!opt&&tok&&ov.indexOf(tok)>=0){opt=mk.options[i];}}mk.value=opt?opt.value:"";try{mk.dispatchEvent(new Event("change"));}catch(e){}}else{mk.value=p.make||"";}}set("model_name",p.model);set("kuzov",p.kuzov);set("year_min",p.year_min);set("year_max",p.year_max);set("label",p.label);}</script>`;
}

// <option> list of Australian states for the client forms.
function stateOptions(selected) {
  return `<option value="">Select a state</option>` +
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
    --ink:#1A1A1A;--t2:#4C5055;--t3:#6F7378;--faint:#6B7178;--bg:#E9EAEB;--card:#fff;--off:#FAFAFB;--hair:rgba(0,0,0,0.08);}
  *{box-sizing:border-box}
  body{margin:0;font-family:${FONT};color:var(--ink);background:var(--card);font-variant-numeric:tabular-nums}
  a{color:inherit;text-decoration:none}
  .wrap{display:flex;min-height:100vh}
  .side{width:256px;flex:0 0 256px;border-right:1px solid var(--hair);display:flex;flex-direction:column;padding:26px 20px;background:#fff;position:sticky;top:0;align-self:flex-start;height:100vh;overflow-y:auto}
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
  .topbar.unstick{position:static}
  .kicker{display:flex;align-items:center;gap:10px;color:var(--gold-txt);font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase}
  .kicker:before{content:"";width:24px;height:1px;background:var(--gold);display:inline-block}
  h1{font-size:33px;font-weight:600;letter-spacing:-0.015em;margin:12px 0 6px;line-height:1.05}
  .subline{color:var(--t3);font-size:15px;margin:0}
  .btn-dark{background:var(--ink);color:#fff;font-weight:600;padding:12px 20px;border-radius:6px;font-size:14px;white-space:nowrap}
  .btn-dark:hover{background:#333436}
  .content{padding:32px 40px 60px;max-width:1180px}
  .content.wide,.topbar.wide{width:100%;max-width:1640px;margin-left:auto;margin-right:auto}
  .card{background:#fff;border:1px solid var(--hair);border-radius:8px;padding:24px 26px;margin-bottom:24px}
  .card>h2{font-size:16px;font-weight:600;margin:0 0 20px;display:flex;align-items:center;gap:11px;border-bottom:1px solid var(--hair);padding-bottom:16px}
  .card>h2 .num{color:var(--gold);font-weight:700}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px 22px}
  label{display:block;font-size:12px;color:var(--t2);margin-bottom:7px;font-weight:600;letter-spacing:0.02em}
  label .opt{color:var(--faint);font-weight:400;text-transform:none;letter-spacing:0}
  input,select{width:100%;padding:11px 13px;border:1px solid rgba(0,0,0,0.14);border-radius:5px;font-size:14px;background:#FBFBFC;color:var(--ink);font-family:${FONT}}
  input::placeholder{color:#9AA0A6}
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
  .btn-link{background:transparent;border:0;color:var(--gold-txt);font-size:12px;font-weight:600;padding:7px 8px;cursor:pointer;font-family:${FONT}}
  .btn-link:hover{text-decoration:underline}
  .chip{display:inline-block;background:var(--gold-tint);border:1px solid rgba(202,163,76,0.35);color:var(--gold-txt);font-size:11px;font-weight:600;padding:4px 9px;border-radius:9999px;font-family:${FONT}}
  button.chip{cursor:pointer}
  button.chip:hover{background:rgba(177,18,38,0.08);border-color:rgba(177,18,38,0.35);color:#B11226}
  .chip.muted{background:#f3f4f6;border-color:var(--hair);color:var(--t3)}
  .share-pick{font-size:12px;padding:5px 8px;border:1px solid var(--hair);border-radius:6px;background:#fff;color:var(--t2);cursor:pointer;font-family:${FONT}}
  .bulkbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:#fff;border:1px solid var(--hair);border-radius:10px;padding:12px 14px;margin-bottom:14px}
  .bulk-label{font-size:13px;font-weight:600;color:var(--t2)}
  .toggles{margin-top:22px;display:flex;flex-direction:column;gap:8px}
  .toggle{display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border:1px solid var(--hair);border-radius:8px;cursor:pointer}
  .toggle:hover{background:#fafafb}
  .toggle input{width:18px;height:18px;padding:0;margin:2px 0 0;accent-color:var(--gold);cursor:pointer;flex:0 0 auto}
  .toggle .tg-txt{display:flex;flex-direction:column;gap:2px}
  .toggle .tg-title{font-size:14px;font-weight:600;color:var(--ink)}
  .toggle .tg-desc{font-size:12px;color:var(--t3);line-height:1.4}
  .banner{display:flex;align-items:center;gap:12px;margin-bottom:24px;padding:16px 22px;background:#fff;border:1px solid var(--hair);border-left:3px solid var(--gold);border-radius:6px}
  .banner .reddot{width:6px;height:6px;border-radius:9999px;background:#B11226;display:inline-block}
  .banner .txt{font-size:14px;color:var(--t2)}
  .mgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:22px}
  .mcard{background:#fff;border:1px solid var(--hair);border-radius:8px;overflow:hidden;display:flex;flex-direction:column}
  .mphoto{position:relative;height:188px;flex:0 0 auto;background:#15171a;background-size:cover;background-position:center}
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
  .whoami{display:flex;flex-direction:column;align-items:center;gap:1px;padding:2px 0}
  .whoami .who-name{font-size:13px;font-weight:600;color:var(--ink)}
  .whoami .who-role{font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--gold-txt)}
  .login-screen{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);padding:24px}
  .login-card{width:100%;max-width:380px;background:#fff;border:1px solid var(--hair);border-radius:12px;padding:34px 32px 30px;box-shadow:0 14px 44px rgba(0,0,0,0.07)}
  .login-card .login-logo{display:flex;justify-content:center;padding-bottom:20px;margin-bottom:24px;border-bottom:1px solid var(--hair)}
  .login-card h1{font-size:21px;font-weight:600;margin:0 0 6px;text-align:center;letter-spacing:-0.01em}
  .login-card .login-sub{color:var(--t3);font-size:14px;text-align:center;margin:0 0 22px;line-height:1.45}
  .login-card label{margin-bottom:8px}
  .login-card .btn-gold{width:100%;margin-top:18px;padding:13px;font-size:15px;display:block}
  .login-err{background:rgba(177,18,38,0.06);border:1px solid rgba(177,18,38,0.25);color:#B11226;font-size:13px;padding:10px 12px;border-radius:6px;margin-bottom:16px;text-align:center}
  /* Public request: bold success receipt + inline error (Fix 1 / Fix 7) */
  .reqok{border:1px solid var(--gold);border-left:4px solid var(--gold);background:linear-gradient(180deg,#FBF7EC,#fff)}
  .reqok .reqok-badge{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--gold-txt)}
  .reqok .reqok-badge .tick{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:9999px;background:var(--gold);color:var(--ink);font-size:13px}
  .reqok .reqok-ref{margin-top:12px;font-size:15px;color:var(--ink)}
  .reqok .reqok-ref strong{font-weight:700;letter-spacing:.02em}
  .reqok p{margin:12px 0 0;color:var(--t2);font-size:14px;line-height:1.55}
  .reqerr{margin-bottom:18px;padding:13px 16px;background:rgba(177,18,38,.06);border:1px solid rgba(177,18,38,.3);border-left:4px solid #B11226;border-radius:6px;color:#9F1020;font-size:14px;line-height:1.45}
  .field-err{display:none;color:#B11226;font-size:13px;line-height:1.45;margin-top:9px;font-weight:500}
  /* Client portal */
  .reqbadge{display:inline-flex;align-items:center;gap:6px;background:rgba(70,177,122,.12);border:1px solid rgba(70,177,122,.4);color:#1F7A4D;font-size:12.5px;font-weight:600;padding:8px 13px;border-radius:9999px}
  .paybadge{display:inline-flex;align-items:center;gap:6px;background:var(--gold-tint);border:1px solid rgba(202,163,76,.4);color:var(--gold-txt);font-size:11.5px;font-weight:600;padding:4px 9px;border-radius:9999px;margin-left:8px}
  .portal-acct{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  .portal-acct .pa-k{font-size:12px;color:var(--t3)}
  .pwrap{display:flex;gap:9px;align-items:center;flex-wrap:wrap}
  @media(max-width:920px){.wrap{flex-direction:column}.side{width:auto;flex:none;flex-direction:row;flex-wrap:wrap;align-items:center;gap:10px;position:static;height:auto;overflow:visible}.nav{flex-direction:row;margin-top:0;flex-wrap:wrap}.side-foot{margin:0 0 0 auto;flex-direction:row;padding-top:0}}
  @media(max-width:640px){
    .grid{grid-template-columns:1fr}
    .topbar,.content{padding-left:20px;padding-right:20px}
    /* M3: tighten the stacked header so the form starts higher */
    .side{padding:12px 20px}.topbar{padding-top:22px;padding-bottom:20px}
    /* M1: >=16px controls stop iOS Safari auto-zooming on focus */
    input,select,textarea{font-size:16px}
    /* M2: comfortable 48px tap targets, full-width primary CTA */
    input,select,textarea{min-height:48px}
    .actions{flex-wrap:wrap}
    .actions .btn-gold{width:100%;min-height:48px;padding:14px 22px}
  }
  /* Matches review (v2) */
  .mtools{position:sticky;top:0;z-index:5;background:var(--bg);padding:4px 0 12px;margin-bottom:6px;border-bottom:1px solid var(--hair)}
  .triage{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px}
  .tstat{background:#fff;border:1px solid var(--hair);border-radius:10px;padding:11px 15px;min-width:96px}
  .tstat .k{font-size:10.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--t3);display:flex;align-items:center;gap:6px}
  .tstat .v{font-size:22px;font-weight:700;margin-top:3px}
  .tstat .d{width:8px;height:8px;border-radius:9999px;display:inline-block}
  .tstat.urgent{border-color:rgba(177,18,38,.3);background:rgba(177,18,38,.04)}
  .tstat.urgent .v{color:#B11226}
  .crow{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:11px}
  .msearch{position:relative;flex:1;min-width:200px;display:block;margin:0}
  .msearch input{width:100%;padding:10px 12px;border:1px solid rgba(0,0,0,.14);border-radius:7px;font-size:14px;background:#fff;font-family:inherit;color:var(--ink)}
  .msearch input:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 3px rgba(202,163,76,.16)}
  select.mctl{padding:9px 11px;border:1px solid rgba(0,0,0,.14);border-radius:7px;font-size:13.5px;background:#fff;color:var(--t2);cursor:pointer;font-family:inherit}
  .fchips{display:flex;gap:7px;flex-wrap:wrap;align-items:center}
  .fchip{border:1px solid rgba(0,0,0,.14);background:#fff;color:var(--t2);font-size:12.5px;font-weight:600;padding:7px 13px;border-radius:9999px;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:7px}
  .fchip .sd{width:8px;height:8px;border-radius:9999px;display:inline-block}
  .fchip.on{background:var(--ink);color:#fff;border-color:var(--ink)}
  .fchip.on.urgent{background:#B11226;border-color:#B11226;color:#fff}
  .quick{margin-left:auto;display:flex;gap:7px;flex-wrap:wrap}
  .quick button{font-family:inherit;font-size:12px;font-weight:600;color:var(--gold-txt);background:var(--gold-tint);border:1px solid rgba(202,163,76,.35);border-radius:9999px;padding:6px 12px;cursor:pointer}
  .pausebar{display:flex;align-items:center;gap:10px;margin-bottom:16px;padding:12px 16px;background:rgba(177,18,38,.05);border:1px solid rgba(177,18,38,.25);border-left:3px solid #B11226;border-radius:6px;font-size:13.5px;color:var(--t2)}
  .bulkbar2{position:sticky;top:60px;z-index:6;display:none;align-items:center;gap:12px;background:var(--ink);color:#fff;border-radius:10px;padding:10px 15px;margin:0 0 16px}
  .bulkbar2.show{display:flex}
  .bulkbar2 .bc{font-weight:600;font-size:14px}.bulkbar2 .bsp{flex:1}
  .bulkbar2 button{font-family:inherit;font-weight:600;font-size:13px;border-radius:6px;padding:9px 14px;cursor:pointer;border:0}
  .bulkbar2 .bap{background:var(--gold);color:var(--ink)}
  .bulkbar2 .bsk{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.3)}
  .bulkbar2 .bcl{background:transparent;color:#cfd0d2;border:0;font-size:12.5px}
  .ghead{display:flex;align-items:center;gap:10px;grid-column:1/-1;padding:8px 2px 2px;border-bottom:1px solid var(--hair);margin-top:8px}
  .ghead .gh-n{font-size:14px;font-weight:600}
  .ghead .gh-sel{margin-left:auto;font-size:12px;font-weight:600;color:var(--gold-txt);background:var(--gold-tint);border:1px solid rgba(202,163,76,.35);border-radius:6px;padding:5px 10px;cursor:pointer;font-family:inherit}
  .mgrid .mcard{position:relative}
  .mcard .msel{position:absolute;top:10px;left:10px;z-index:4;width:21px;height:21px;accent-color:var(--gold);cursor:pointer;display:none}
  .mcard:hover .msel,.mcard.picked .msel{display:block}
  .mcard:hover .pill.lot,.mcard.picked .pill.lot{opacity:0}
  .mcard.picked{border-color:var(--gold);box-shadow:0 0 0 2px var(--gold-tint)}
  .specline{padding:2px 16px 0;font-size:11.5px;color:var(--t3);display:flex;gap:6px;flex-wrap:wrap}
  .specline b{color:var(--t2);font-weight:600}
  .why{padding:9px 16px 0;display:flex;gap:6px;flex-wrap:wrap}
  .why .wc{font-size:10.5px;font-weight:600;color:var(--gold-txt);background:var(--gold-tint);border:1px solid rgba(202,163,76,.3);border-radius:9999px;padding:3px 9px}
  .urg{display:inline-flex;align-items:center;gap:4px;background:#B11226;color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;margin-right:6px}
  .urg.soon{background:#C9821f}
  .nocontact{margin:10px 16px 0;padding:7px 10px;background:rgba(202,163,76,.1);border:1px solid rgba(202,163,76,.4);border-radius:6px;font-size:11px;color:var(--gold-txt);font-weight:600}
  .mempty{color:var(--faint);padding:40px 0;text-align:center;grid-column:1/-1}
  .clink{color:var(--ink);font-weight:500;border-bottom:1px solid transparent}
  .clink:hover{border-bottom-color:var(--gold)}
  .cd-head{display:flex;align-items:center;gap:16px}
  .cd-owner{text-align:right}
  .cd-owner .k{font-size:10.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--faint)}
  .cd-owner .v{font-size:14px;font-weight:600;color:var(--gold-txt);margin-top:3px}
  .wlrow{border:1px solid var(--hair);border-radius:8px;margin-bottom:12px;overflow:hidden}
  .wlhead{display:flex;align-items:center;gap:12px;padding:14px 16px}
  .wlsum{flex:1;min-width:0}
  .wlsum .wln{font-size:14px;font-weight:600}
  .wlsum .wlc{font-size:12.5px;color:var(--t3);margin-top:2px}
  .wlacts{display:flex;align-items:center;gap:8px}
  .wledit{border-top:1px solid var(--hair);background:var(--off)}
  .wledit summary{cursor:pointer;padding:11px 16px;font-size:13px;font-weight:600;color:var(--gold-txt);list-style:none}
  .wledit summary::-webkit-details-marker{display:none}
  .wledit summary:hover{background:#f6f6f7}
  .wledit form{padding:4px 16px 18px}
  .slegend{background:#fff;border:1px solid var(--hair);border-radius:10px;padding:11px 16px;margin-bottom:16px}
  .sl-row{display:flex;align-items:center;gap:16px;flex-wrap:wrap;font-size:12.5px;color:var(--t2)}
  .sl-t{font-size:10.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--faint)}
  .sl-item{display:inline-flex;align-items:center;gap:7px}
  .sl-item b{font-weight:600;color:var(--ink)}
  .sl-dot{width:9px;height:9px;border-radius:9999px;display:inline-block}
  .sl-more{margin-top:8px}
  .sl-more summary{cursor:pointer;color:var(--gold-txt);font-weight:600;font-size:12px;list-style:none}
  .sl-more summary::-webkit-details-marker{display:none}
  .sl-detail{margin-top:6px;color:var(--t3);line-height:1.5;font-size:12.5px;max-width:720px}
`;

function initials(name) {
  return String(name || "?").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function sidebar(active, counts, session = { role: "admin" }) {
  const isAdmin = session.role === "admin";
  const item = (id, label, count) =>
    `<a class="${active === id ? "active" : ""}" href="/admin?view=${id}">
      <span class="bar"></span><span class="lbl">${label}</span><span class="ct">${count ?? ""}</span></a>`;
  const whoLabel = isAdmin ? "JDM Connect" : esc(session.name || "Agent");
  const whoSub = isAdmin ? "Admin" : "Agent";
  return `<aside class="side">
    <div class="brand">${LOGO}</div>
    <nav class="nav">
      ${item("intake", "Add client", "")}
      ${item("clients", "Clients", counts.clients)}
      ${item("wishlists", "Wishlists", counts.wishlists)}
      ${item("matches", "Matches", counts.matches || "")}
      ${isAdmin ? item("agents", "Agents", counts.agents || "") : ""}
      ${isAdmin ? item("payments", "Payments", counts.payments || "") : ""}
      ${isAdmin ? item("settings", "Settings", "") : ""}
    </nav>
    <div class="side-foot">
      <a class="btn-search" href="/run"><span class="dot"></span>Search auctions</a>
      <div class="whoami"><span class="who-name">${whoLabel}</span><span class="who-role">${whoSub}</span></div>
      <a class="signout" href="/logout">Sign out</a>
    </div>
  </aside>`;
}

const HEADERS = {
  intake: { kicker: "Vehicle Finder", title: "Add a client", sub: "Add a client and the vehicles they're looking for.", btn: "Search auctions" },
  clients: { kicker: "Vehicle Finder", title: "Clients", sub: "Your buyer directory.", btn: "Add client" },
  wishlists: { kicker: "Vehicle Finder", title: "Wishlists", sub: "Search criteria matched against the live auction feed.", btn: "Add client" },
  matches: { kicker: "Vehicle Finder", title: "Matches", sub: "Auction lots matched to your clients' wishlists.", btn: "Search again" },
  agents: { kicker: "Vehicle Finder", title: "Agents", sub: "Logins that find cars for their own clients.", btn: "Search auctions" },
  payments: { kicker: "Vehicle Finder", title: "Payments", sub: "Deposits taken through the buyer portal via Stripe.", btn: "" },
  settings: { kicker: "Vehicle Finder", title: "Settings", sub: "Alert email, notifications and payments.", btn: "" },
};

export async function adminPage(env, view = "intake", session = { role: "admin", id: 0 }, opts = {}) {
  const isAgent = session.role === "agent";
  if (!HEADERS[view]) view = "intake";
  if (["agents", "settings", "payments"].includes(view) && isAgent) view = "intake"; // admin-only areas

  // Rows this session may see: all for admin, owned-or-shared for an agent.
  const acc = accessScope(session);
  const run = (sql) => { const s = env.DB.prepare(sql); return acc.binds.length ? s.bind(...acc.binds) : s; };

  const clients = (await run(`SELECT * FROM clients c WHERE ${acc.sql} ORDER BY name`).all()).results || [];
  const wishlists = (await run(
    `SELECT w.*, c.name AS client_name FROM wishlists w JOIN clients c ON c.id = w.client_id WHERE ${acc.sql} ORDER BY c.name, w.id`
  ).all()).results || [];
  const pending = (await run(
    `SELECT q.*, c.name AS client_name, c.state AS client_state,
            c.email AS client_email, c.whatsapp AS client_whatsapp,
            w.label AS wlabel, w.marka_name AS w_marka, w.model_name AS w_model,
            w.rate_min AS w_rate, w.price_max AS w_price, w.kuzov AS w_kuzov, w.grade_kw AS w_kw
       FROM queue q
       JOIN clients c ON c.id = q.client_id
       LEFT JOIN wishlists w ON w.id = q.wishlist_id
      WHERE q.status = 'pending' AND ${acc.sql} ORDER BY q.created_at DESC LIMIT 400`
  ).all()).results || [];

  // For the Clients view: active agents (for the Share picker) and existing
  // shares (chips), so owners can share/unshare.
  let shareAgents = [], sharesByClient = {};
  if (view === "clients") {
    shareAgents = (await env.DB.prepare("SELECT id, name, company FROM agents WHERE active = 1 ORDER BY name").all()).results || [];
    const sh = (await env.DB.prepare(
      "SELECT cs.client_id, cs.agent_id, a.name AS agent_name FROM client_shares cs JOIN agents a ON a.id = cs.agent_id"
    ).all()).results || [];
    for (const r of sh) (sharesByClient[r.client_id] = sharesByClient[r.client_id] || []).push({ id: r.agent_id, name: r.agent_name });
  }

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
      // Cap calculator calls per load so a large queue still loads fast; the rest
      // self-heal on later loads.
      const calcBatch = needCalc.slice(0, 40);
      await attachLanded(env, calcBatch.map(({ q, lot }) => ({ lot, client: { state: q.client_state } })));
      const ups = [];
      for (const { q, lot } of calcBatch) {
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

  // Admin-only: agent list (for the Agents view) and the logged-in agent's name.
  const agents = (!isAgent && view === "agents")
    ? (await env.DB.prepare(
        `SELECT a.*, (SELECT COUNT(*) FROM clients c WHERE c.agent_id = a.id) AS client_count FROM agents a ORDER BY a.name`
      ).all()).results || []
    : [];
  const settings = (!isAgent && view === "settings") ? await getSettings(env) : null;
  const payments = (!isAgent && view === "payments")
    ? (await env.DB.prepare(
        "SELECT p.*, c.name AS client_name FROM payments p LEFT JOIN clients c ON c.id = p.client_id ORDER BY p.created_at DESC LIMIT 200"
      ).all()).results || []
    : [];
  const matchSettings = view === "matches" ? await getSettings(env) : null;
  if (isAgent) {
    const me = await env.DB.prepare("SELECT name FROM agents WHERE id = ?").bind(session.id).first();
    session = { ...session, name: me ? me.name : "Agent" };
  }

  const counts = { clients: clients.length, wishlists: wishlists.length, matches: pending.length };
  const h = HEADERS[view];
  const primary = view === "matches" || view === "intake"
    ? `<a class="btn-dark" href="/run">${esc(h.btn)}</a>`
    : ["agents", "settings", "payments"].includes(view)
    ? ""
    : `<a class="btn-dark" href="/admin?view=intake">${esc(h.btn)}</a>`;

  const makers = view === "intake" ? await distinctMakers(env) : [];
  let body = "";
  if (view === "intake") body = intakeView(clients, makers, { err: opts.err });
  else if (view === "clients") body = clientsView(clients, wishlists, { session, agents: shareAgents, shares: sharesByClient });
  else if (view === "wishlists") body = wishlistsView(wishlists);
  else if (view === "matches") body = matchesView(pending, { settings: matchSettings });
  else if (view === "agents") body = agentsView(agents);
  else if (view === "payments") body = paymentsView(payments, { stripeSecret: !!env.STRIPE_SECRET_KEY });
  else if (view === "settings") body = settingsView(settings, { stripeSecret: !!env.STRIPE_SECRET_KEY, publicUrl: env.PUBLIC_URL });

  const main = `
    <div class="topbar${view === "matches" ? " unstick wide" : ""}">
      <div>
        <div class="kicker">${esc(h.kicker)}</div>
        <h1>${esc(h.title)}</h1>
        <p class="subline">${esc(h.sub)}</p>
      </div>
      ${primary}
    </div>
    <div class="content${view === "matches" ? " wide" : ""}">${body}</div>`;

  return shell(sidebar(view, counts, session), main, esc(h.title) + " - JDM Connect");
}

// Admin-only: manage agent logins.
function agentsView(agents) {
  const rows = agents.map((a) => {
    const invited = !a.pass_hash;
    return `<tr>
      <td><span class="avatar">${esc(initials(a.name))}</span>${esc(a.name)}${invited ? ` <span class="chip muted">invited</span>` : ""}</td>
      <td>${esc(a.email)}</td>
      <td>${esc(a.company || "-")}</td>
      <td style="text-align:right">${a.client_count}</td>
      <td><form method="POST" action="/agent/alerts" style="display:inline"><input type="hidden" name="id" value="${a.id}"><button class="btn-toggle ${a.alerts ? "on" : "off"}" type="submit">${a.alerts ? "Alerts on" : "Alerts off"}</button></form></td>
      <td><form method="POST" action="/agent/toggle" style="display:inline"><input type="hidden" name="id" value="${a.id}"><button class="btn-toggle ${a.active ? "on" : "off"}" type="submit">${a.active ? "Active" : "Paused"}</button></form></td>
      <td style="text-align:right;white-space:nowrap">
        <form method="POST" action="/agent/invite" style="display:inline"><input type="hidden" name="id" value="${a.id}"><button class="btn-link" type="submit">${invited ? "Resend invite" : "Reset password"}</button></form>
        <form method="POST" action="/agent/delete" style="display:inline" onsubmit="return confirm('Delete this agent and ALL their clients, wishlists and matches? This cannot be undone.')"><input type="hidden" name="id" value="${a.id}"><button class="btn-del" type="submit">Delete</button></form>
      </td>
    </tr>`;
  }).join("") || `<tr><td colspan="7" class="empty">No agents yet</td></tr>`;
  return `
    <div class="card">
      <h2><span class="num">+</span> New agent</h2>
      <form method="POST" action="/agent">
        <div class="grid">
          <div><label>NAME</label><input name="name" placeholder="Agent name" required></div>
          <div><label>EMAIL <span class="opt">(login + alerts)</span></label><input name="email" type="email" placeholder="agent@email.com" required></div>
          <div><label>COMPANY <span class="opt">(optional)</span></label><input name="company" placeholder="e.g. Ofuka"></div>
        </div>
        <div class="actions"><button class="btn-gold" type="submit">Create &amp; send invite</button>
          <span class="help">They get an email to set their own password, then see only their own clients and matches.</span></div>
      </form>
    </div>
    <div class="card" style="padding:0;overflow:hidden">
      <table><tr><th>Agent</th><th>Email</th><th>Company</th><th style="text-align:right">Clients</th><th>Alerts</th><th>Status</th><th></th></tr>${rows}</table></div>`;
}

// Admin-only: editable alert email + notification toggles.
function toggleRow(name, title, desc, on) {
  return `<label class="toggle"><input type="checkbox" name="${name}"${on ? " checked" : ""}><span class="tg-txt"><span class="tg-title">${esc(title)}</span><span class="tg-desc">${esc(desc)}</span></span></label>`;
}
function settingsView(settings, opts = {}) {
  const s = settings || {};
  const stripeSecret = !!opts.stripeSecret;
  const webhookUrl = (opts.publicUrl || "") + "/webhooks/stripe";
  return `
    <div class="card">
      <h2><span class="num">✱</span> Notifications &amp; payments</h2>
      <form method="POST" action="/settings">
        <div style="max-width:560px">
          <label>ALERT EMAIL <span class="opt">(where new-match alerts are sent)</span></label>
          <input name="digest_email" type="email" value="${esc(s.digest_email || "")}" placeholder="support@jdmconnect.com.au">
          <div class="toggles">
            ${toggleRow("request_alerts", "Email me new vehicle requests", "When someone submits the public request form, email me their details.", settingOn(s, "request_alerts"))}
            ${toggleRow("email_alerts", "Email me match alerts", "Send a digest email when new matches are found.", settingOn(s, "email_alerts"))}
            ${toggleRow("send_to_client", "Email matches to clients on approval", "When you press “Approve & send” on a match, actually email that car to the client. Off = approving just files the match without emailing anyone.", settingOn(s, "send_to_client"))}
            ${toggleRow("client_landed", "Show landed (AUD) price to clients", "Show the indicative AUD landed price in client emails and the buyer portal. Off = clients see only the Japanese auction price; staff always see landed cost.", settingOn(s, "client_landed"))}
          </div>

          <div style="margin-top:30px;border-top:1px solid var(--hair);padding-top:22px">
            <div style="font-size:15px;font-weight:600;margin-bottom:4px">Payments (Stripe)</div>
            <p class="help" style="margin:0 0 16px">Take a deposit from buyers in their portal. ${stripeSecret ? "Stripe key detected." : "<strong>No Stripe key set yet</strong> - deposits stay off until the <code>STRIPE_SECRET_KEY</code> secret is added."}</p>
            <div class="toggles" style="margin-top:0">
              ${toggleRow("stripe_enabled", "Enable deposits in the buyer portal", "Show a “Pay deposit” button on cars a client has asked us to chase.", settingOn(s, "stripe_enabled"))}
            </div>
            <div class="grid" style="grid-template-columns:repeat(2,1fr);margin-top:16px">
              <div><label>DEPOSIT AMOUNT <span class="opt">(AUD)</span></label><input name="stripe_deposit_aud" type="number" min="0" step="50" value="${esc(s.stripe_deposit_aud || "")}" placeholder="e.g. 500"></div>
              <div><label>CURRENCY</label><input name="stripe_currency" value="${esc(s.stripe_currency || "aud")}" placeholder="aud"></div>
            </div>
            <p class="help" style="margin-top:14px;font-size:12px;line-height:1.55">Stripe webhook endpoint: <strong>${esc(webhookUrl)}</strong> - add it in your Stripe dashboard for the <code>checkout.session.completed</code> event, then set its signing secret as <code>STRIPE_WEBHOOK_SECRET</code>.</p>
          </div>

          <div class="actions"><button class="btn-gold" type="submit">Save settings</button></div>
        </div>
      </form>
    </div>`;
}

// Admin-only: list of Stripe deposits taken through the buyer portal.
function paymentsView(payments, opts = {}) {
  const money = (cents, cur) => {
    const v = Number(cents) / 100;
    return (cur || "aud").toLowerCase() === "aud"
      ? "A$" + v.toLocaleString("en-AU")
      : v.toLocaleString() + " " + String(cur || "").toUpperCase();
  };
  const badge = (st) => {
    const m = { paid: ["#1F7A4D", "rgba(70,177,122,.14)"], created: ["#896B2D", "rgba(202,163,76,.14)"], expired: ["#6F7378", "#f3f4f6"], failed: ["#B11226", "rgba(177,18,38,.08)"] };
    const [c, bg] = m[st] || m.created;
    return `<span style="display:inline-block;padding:4px 10px;border-radius:9999px;font-size:11px;font-weight:600;color:${c};background:${bg}">${esc(st || "-")}</span>`;
  };
  const rows = payments.map((p) => `<tr>
    <td>${esc(String(p.created_at || "").slice(0, 16))}</td>
    <td>${esc(p.client_name || ("#" + p.client_id))}</td>
    <td style="font-weight:600;color:var(--ink)">${money(p.amount_cents, p.currency)}</td>
    <td>${esc(p.description || "-")}</td>
    <td>${badge(p.status)}</td>
    <td style="font-size:11px;color:var(--t3)">${esc(p.stripe_session || "-")}</td>
  </tr>`).join("") || `<tr><td colspan="6" class="empty">No payments yet.${opts.stripeSecret ? "" : " Add your Stripe key and turn on deposits in Settings to start taking them."}</td></tr>`;
  const totalPaid = payments.filter((p) => p.status === "paid").reduce((n, p) => n + Number(p.amount_cents || 0), 0);
  return `<div class="triage">
      <div class="tstat"><div class="k">Collected</div><div class="v">A$${(totalPaid / 100).toLocaleString("en-AU")}</div></div>
      <div class="tstat"><div class="k">Payments</div><div class="v">${payments.length}</div></div>
    </div>
    <div class="card" style="padding:0;overflow:hidden">
      <table><tr><th>When</th><th>Client</th><th>Amount</th><th>For</th><th>Status</th><th>Stripe session</th></tr>${rows}</table>
    </div>`;
}

// Styled login screen shown when there's no valid session.
export function loginPage(opts = {}) {
  const err = opts.error ? `<div class="login-err">Incorrect email or password. Please try again.</div>` : "";
  const body = `<div class="login-screen">
    ${risingSun({ size: 520, tone: "faint" })}
    <form class="login-card" method="POST" action="/login">
      <div class="login-logo">${LOGO}</div>
      <h1>Vehicle Finder</h1>
      <p class="login-sub">Sign in to manage clients, wishlists and auction matches.</p>
      ${err}
      <label>EMAIL <span class="opt">(agents and clients)</span></label>
      <input type="email" name="email" autocomplete="username" placeholder="you@email.com">
      <div class="login-note">Agents and clients: sign in with your email and password. JDM Connect admin: leave the email blank and enter the admin password.</div>
      <label style="margin-top:14px">PASSWORD</label>
      <input type="password" name="password" autocomplete="current-password" autofocus required>
      <button class="btn-gold" type="submit">Sign in</button>
    </form>
  </div>`;
  return brandDoc(body, "Sign in - JDM Connect");
}

// Agent set-password screen (reached from the emailed invite link).
export function setPasswordPage(opts = {}) {
  const { token, name, error, invalid } = opts;
  let card;
  if (invalid) {
    card = `<div class="login-card"><div class="login-logo">${LOGO}</div><h1>Link expired</h1>
      <p class="login-sub">This set-password link is invalid or has expired. Ask JDM Connect to resend your invite.</p></div>`;
  } else {
    const err = error ? `<div class="login-err">${esc(error)}</div>` : "";
    card = `<form class="login-card" method="POST" action="/set-password">
      <div class="login-logo">${LOGO}</div>
      <h1>Set your password</h1>
      <p class="login-sub">Welcome${name ? ", " + esc(name) : ""}. Choose a password to access the Vehicle Finder.</p>
      ${err}
      <input type="hidden" name="token" value="${esc(token || "")}">
      <label>NEW PASSWORD</label>
      <input type="password" name="password" autocomplete="new-password" autofocus required minlength="6">
      <label style="margin-top:14px">CONFIRM PASSWORD</label>
      <input type="password" name="confirm" autocomplete="new-password" required minlength="6">
      <button class="btn-gold" type="submit">Set password and sign in</button>
    </form>`;
  }
  return brandDoc(`<div class="login-screen">${risingSun({ size: 520, tone: "faint" })}${card}</div>`, "Set password - JDM Connect");
}

function intakeView(clients, makers, opts = {}) {
  const clientOptions = clients.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")
    || `<option value="">(add a client first)</option>`;
  const errBanner = opts.err === "contact"
    ? `<div class="reqerr">Add an email or a WhatsApp number so we can reach this client. A client with no contact cannot be sent matches.</div>`
    : opts.err === "name"
    ? `<div class="reqerr">Please enter the client's name.</div>`
    : "";
  return `
    <div class="card">
      <h2><span class="num">01</span> New client</h2>
      <form method="POST" action="/client">
        ${errBanner}
        <div class="grid">
          <div><label>NAME</label><input name="name" placeholder="Jane Citizen" required></div>
          <div><label>EMAIL <span class="opt">(email or WhatsApp required)</span></label><input name="email" type="email" placeholder="name@email.com"></div>
          <div><label>WHATSAPP <span class="opt">(email or WhatsApp required)</span></label><input name="whatsapp" placeholder="+61 4XX XXX XXX"></div>
          <div><label>STATE <span class="opt">(for landed cost)</span></label><select name="state">${stateOptions("")}</select></div>
        </div>
        <div class="actions"><button class="btn-gold" type="submit">Add client</button>
          <span class="help">Name plus a way to reach them (email or WhatsApp) is required.</span></div>
      </form>
    </div>
    <div class="card">
      <h2><span class="num">02</span> New wishlist</h2>
      <form method="POST" action="/wishlist">
        ${presetSelect()}
        <div class="grid">
          <div><label>CLIENT</label><select name="client_id" required>${clientOptions}</select></div>
          <div><label>LABEL</label><input name="label" placeholder="e.g. under 1.5M daily"></div>
          <div><label>MAKE</label>${makerField(makers, "wl-maker")}</div>
          <div><label>MODEL <span class="opt">(pick or type)</span></label>${modelField("wl-models")}</div>
          <div><label>YEAR MIN</label><input name="year_min" type="number" placeholder="1990"></div>
          <div><label>YEAR MAX</label><input name="year_max" type="number" placeholder="2002"></div>
          <div><label>MAX PRICE (JPY)</label><input name="price_max" type="number" placeholder="1,500,000"></div>
          <div><label>MAX MILEAGE (KM)</label><input name="mileage_max" type="number" placeholder="80,000"></div>
          <div><label>MIN GRADE</label><input name="rate_min" type="number" step="0.5" placeholder="e.g. 4"></div>
          <div><label>CHASSIS / MODEL CODE <span class="opt">(contains, best match)</span></label><input name="kuzov" placeholder="e.g. JZA80 or 211"></div>
          <div><label>GRADE KEYWORD <span class="opt">(contains)</span></label><input name="grade_kw" placeholder="e.g. RS"></div>
        </div>
        <label style="display:flex;align-items:flex-start;gap:9px;margin-top:14px;font-size:13px;color:#3A3C3F;cursor:pointer"><input type="checkbox" name="watch_only" value="1" style="width:auto;margin-top:2px"><span><strong>Watch only (lead).</strong> Surface matches for a follow-up call, but never auto-email this client. Good for buyers who aren't ready yet, especially rare cars.</span></label>
        <div class="actions"><button class="btn-gold" type="submit">Add wishlist</button>
          <span class="help">Add at least a make, model or chassis/model code. Blank fields match anything.</span></div>
      </form>
    </div>
    ${modelScript("wl-maker", "wl-models")}${presetScript()}`;
}

function clientsView(clients, wishlists, opts = {}) {
  const session = opts.session || { role: "admin" };
  const agents = opts.agents || [];
  const shares = opts.shares || {};
  const countFor = (id) => wishlists.filter((w) => w.client_id === id).length;
  const canManage = (c) => session.role === "admin" || Number(c.agent_id) === Number(session.id);

  const shareCell = (c) => {
    const shared = shares[c.id] || [];
    const chips = shared.map((a) =>
      canManage(c)
        ? `<form method="POST" action="/share/remove" style="display:inline" title="Remove ${esc(a.name)}"><input type="hidden" name="client_id" value="${c.id}"><input type="hidden" name="agent_id" value="${a.id}"><button class="chip chip-on" type="submit">${esc(a.name)} ✕</button></form>`
        : `<span class="chip">${esc(a.name)}</span>`
    ).join(" ");
    if (!canManage(c)) return chips || `<span class="chip muted">shared with you</span>`;
    const sharedIds = new Set(shared.map((a) => Number(a.id)));
    const opts2 = agents
      .filter((a) => Number(a.id) !== Number(c.agent_id) && !sharedIds.has(Number(a.id)))
      .map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join("");
    const picker = opts2
      ? `<form method="POST" action="/share" style="display:inline"><input type="hidden" name="client_id" value="${c.id}"><select name="agent_id" class="share-pick" onchange="if(this.value)this.form.submit()"><option value="">+ share…</option>${opts2}</select></form>`
      : "";
    return `${chips} ${picker}`;
  };

  // Admin only: who owns this client (NULL = JDM Connect). Reassigning hands the
  // client - its wishlists, matches and alerts - to that agent's dashboard.
  const isAdmin = session.role === "admin";
  const ownerCell = (c) => {
    const opts = `<option value=""${!c.agent_id ? " selected" : ""}>JDM Connect</option>` +
      agents.map((a) => `<option value="${a.id}"${Number(c.agent_id) === Number(a.id) ? " selected" : ""}>${esc(a.name)}${a.company ? " · " + esc(a.company) : ""}</option>`).join("");
    return `<form method="POST" action="/client/assign" style="display:inline"><input type="hidden" name="client_id" value="${c.id}"><select name="agent_id" class="share-pick" onchange="this.form.submit()">${opts}</select></form>`;
  };

  const rows = clients.map((c) =>
    `<tr>
      ${isAdmin ? `<td><input type="checkbox" name="ids" value="${c.id}" form="bulkform"></td>` : ""}
      <td><span class="avatar">${esc(initials(c.name))}</span><a class="clink" href="/admin?view=client&id=${c.id}">${esc(c.name)}</a></td>
      <td>${esc(c.email || "-")}</td><td>${esc(c.state || "-")}</td>
      <td style="text-align:right">${countFor(c.id)}</td>
      ${isAdmin ? `<td>${ownerCell(c)}</td>` : ""}
      <td>${shareCell(c)}</td>
      <td style="text-align:right">${canManage(c)
        ? `<form method="POST" action="/client/delete" style="display:inline" onsubmit="return confirm('Delete this client and all their wishlists? This cannot be undone.')"><input type="hidden" name="id" value="${c.id}"><button class="btn-del" type="submit">Delete</button></form>`
        : ""}</td>
    </tr>`
  ).join("") || `<tr><td colspan="${isAdmin ? 8 : 6}" class="empty">No clients yet. <a href="/admin?view=intake" style="color:#9a7b2e;font-weight:600;text-decoration:underline">Add your first client</a>.</td></tr>`;

  const bulkBar = (isAdmin && agents.length)
    ? `<form id="bulkform" method="POST" action="/clients/bulk" class="bulkbar">
        <span class="bulk-label">With selected clients:</span>
        <select name="action" class="share-pick"><option value="assign">Assign owner</option><option value="share">Share with</option></select>
        <select name="agent_id" class="share-pick"><option value="">JDM Connect</option>${agents.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join("")}</select>
        <button class="btn-gold" type="submit">Apply</button>
        <span class="help" style="margin-left:4px">Tick clients on the left, then apply.</span>
      </form>`
    : "";

  const headCheck = isAdmin ? `<th style="width:30px"><input type="checkbox" onclick="for(const b of document.querySelectorAll('input[name=ids]'))b.checked=this.checked" title="Select all"></th>` : "";
  const headOwner = isAdmin ? `<th>Owner</th>` : "";
  return `${bulkBar}<div class="card" style="padding:0;overflow:hidden">
    <table><tr>${headCheck}<th>Client</th><th>Email</th><th>State</th><th style="text-align:right">Wishlists</th>${headOwner}<th>Shared with</th><th></th></tr>${rows}</table></div>${isAdmin ? `<p class="help" style="margin:10px 2px 0;font-size:12px">Owner = whose dashboard a client lives on, and who gets their match alerts. Shared with = other agents who can also see and action them.</p>` : ""}`;
}

// Fix 10: bounded/half-open year ranges instead of a bare leading-dash "-2009".
function yearRange(min, max) {
  const a = Number(min) || null, b = Number(max) || null;
  if (a && b) return `${a} to ${b}`;
  if (b) return `up to ${b}`;
  if (a) return `from ${a}`;
  return "any year";
}
// Fix 10: tidy ALL-CAPS feed names for display without mangling acronyms or
// chassis codes. Title-cases clearly-a-word caps tokens (TOYOTA→Toyota,
// SKYLINE→Skyline) but leaves short acronyms (NSX, BMW, GT-R) and codes (JZA80)
// untouched. Display only - matching still uses the raw stored values.
function tcWord(w) {
  return /^[A-Z]{4,}$/.test(w) ? w[0] + w.slice(1).toLowerCase() : w;
}
function displayName(s) {
  return String(s || "").split(/\s+/).map(tcWord).join(" ").trim();
}

function wishlistsView(wishlists) {
  const rows = wishlists.map((w) => {
    const vehicle = `${displayName(w.marka_name) || "Any maker"} ${displayName(w.model_name)}`.trim();
    return `<tr>
      <td><span class="avatar">${esc(initials(w.client_name))}</span>${esc(w.client_name)}${w.needs_detail ? ` <span class="chip muted">needs detail</span>` : ""}</td>
      <td>${esc(w.label || "-")}</td>
      <td>${esc(vehicle)}</td>
      <td>${esc(yearRange(w.year_min, w.year_max))}</td>
      <td>${w.price_max ? "¥" + Number(w.price_max).toLocaleString() : "-"}</td>
      <td>${w.mileage_max ? Number(w.mileage_max).toLocaleString() + "km" : "-"}</td>
      <td>${esc(w.rate_min || "-")}</td>
      <td><form method="POST" action="/wishlist/toggle" style="display:inline"><input type="hidden" name="id" value="${w.id}"><button class="btn-toggle ${w.active ? "on" : "off"}" type="submit">${w.active ? "On" : "Off"}</button></form></td>
      <td style="text-align:right"><form method="POST" action="/wishlist/delete" style="display:inline" onsubmit="return confirm('Delete this wishlist? This cannot be undone.')"><input type="hidden" name="id" value="${w.id}"><button class="btn-del" type="submit">Delete</button></form></td>
    </tr>`;
  }).join("") || `<tr><td colspan="9" class="empty">No wishlists yet. <a href="/admin?view=clients" style="color:#9a7b2e;font-weight:600;text-decoration:underline">Open a client</a> to add what they're chasing.</td></tr>`;
  return `<div class="card" style="padding:0;overflow:hidden">
    <table><tr><th>Client</th><th>Label</th><th>Vehicle</th><th>Years</th><th>Max ¥</th><th>Max km</th><th>Grade</th><th>Active</th><th></th></tr>${rows}</table></div>`;
}

// Whole days until an auction date string (negative = past). 999 if unparseable,
// so undated lots sort last and never count as "closing soon".
const daysUntil = (s) => { const t = Date.parse(s); return Number.isFinite(t) ? Math.round((t - Date.now()) / 86400000) : 999; };

// Number of photos encoded in the feed's "#"-separated images field.
function photoCount(lot) {
  const raw = String(lot.images || "").trim();
  if (!raw) return 0;
  return raw.split("#").filter((u) => u.trim()).length;
}

// "Why it matched" chips, built from the wishlist criteria that were actually set.
function whyChips(q) {
  const out = [];
  if (q.w_rate) out.push(`Grade ${esc(q.w_rate)}+`);
  if (q.w_price) out.push("Within budget");
  if (q.w_kuzov) out.push(`Chassis ${esc(q.w_kuzov)}`);
  if (q.w_kw) out.push(esc(q.w_kw));
  return out.slice(0, 3);
}

function matchCard(q) {
  let lot = {};
  try { lot = JSON.parse(q.lot_json); } catch (e) {}
  const img = imageUrls(lot).medium;
  const title = `${esc(lot.year || "")} ${esc(lot.marka_name || "")} ${esc(lot.model_name || "")}`.trim();
  const strengthLabel = lot._strength || "Possible";
  const strKey = strengthLabel === "Strong" ? "strong" : strengthLabel === "Good" ? "good" : "poss";
  const sColor = lot._strengthColor || "#B6B9BC";
  const bid = Number(lot.start) > 0 ? yen(lot.start) : yen(lot.avg_price);
  const approve = `/decide?token=${esc(q.token)}&action=approve`;
  const skip = `/decide?token=${esc(q.token)}&action=reject`;
  const days = daysUntil(lot.auction_date);
  const auc = esc(lot.auction || "");
  const aucDate = esc((lot.auction_date || "").slice(0, 10));
  const sub = (days >= 0 && days <= 1)
    ? `<span class="urg">Auction ${days === 0 ? "today" : "1d"}</span>${auc}`
    : days === 2
    ? `<span class="urg soon">Auction 2d</span>${auc}`
    : `${auc}${aucDate ? " · " + aucDate : ""}`;
  const landedNum = q._landed ? Number(q._landed.grandTotal) : 0;
  const hasContact = !!(q.client_email || q.client_whatsapp);
  const chips = whyChips(q);
  const specs = [
    lot.kpp ? `<b>${esc(lot.kpp)}</b>` : "",
    lot.color ? esc(lot.color) : "",
    lot.kuzov ? `<b>${esc(lot.kuzov)}</b>` : "",
    lot.eng_v ? esc(lot.eng_v) + "cc" : "",
    photoCount(lot) ? photoCount(lot) + " photos" : "",
  ].filter(Boolean).join(" · ");
  const haystack = esc(`${lot.year || ""} ${lot.marka_name || ""} ${lot.model_name || ""} ${q.client_name || ""} ${q.wlabel || ""} ${lot.kuzov || ""} ${lot.lot || ""}`.toLowerCase());
  return `<div class="mcard" data-qid="${q.id}" data-str="${strKey}" data-days="${days}" data-landed="${landedNum}" data-client="${esc(q.client_name || "")}" data-make="${esc(lot.marka_name || "")}" data-auction="${auc}" data-search="${haystack}">
    <input type="checkbox" class="msel" name="ids" value="${q.id}" form="bulkForm" aria-label="Select this match">
    <div class="mphoto" style="${img ? `background-image:url('${esc(img)}')` : ""}">
      <div class="grad"></div>
      <span class="pill lot">Lot ${esc(lot.lot || "-")}</span>
      <span class="pill str"><span class="sd" style="background:${sColor}"></span>${esc(strengthLabel)}</span>
      <div class="ttl"><div class="t">${title}</div><div class="a">${sub}</div></div>
    </div>
    <div class="mstats">
      <div class="s"><div class="k">Year</div><div class="v">${esc(lot.year || "-")}</div></div>
      <div class="s gold"><div class="k">Grade</div><div class="v">${esc(displayGrade(lot.rate))}</div></div>
      <div class="s"><div class="k">Odometer</div><div class="v">${lot.mileage ? Math.round(Number(lot.mileage) / 1000) + "k" : "-"}</div></div>
      <div class="s gold"><div class="k">Bid</div><div class="v">${bid}</div></div>
    </div>
    ${specs ? `<div class="specline">${specs}</div>` : ""}
    ${(lot._watch || chips.length) ? `<div class="why">${lot._watch ? `<span class="wc" style="background:#E8F0FE;color:#2E6BE6;border-color:#BCD2FB">Lead &middot; follow-up call</span>` : ""}${chips.map((c) => `<span class="wc">${c}</span>`).join("")}</div>` : ""}
    ${q._landed ? `<div class="mland"><span class="ml-k">Est. landed · ${esc(q._landed.state)}</span><span class="ml-v">A$${Number(q._landed.grandTotal).toLocaleString("en-AU")}</span></div>` : ""}
    ${(!hasContact && !lot._watch) ? `<div class="nocontact">No email or WhatsApp on file. Approving won't reach this client.</div>` : ""}
    <div class="mfoot">
      <span class="avatar">${esc(initials(q.client_name))}</span>
      <div class="who"><div class="n">${esc(q.client_name)}</div><div class="w">${esc(q.wlabel || "wishlist")}</div></div>
      <a class="btn-skip" href="${skip}">Skip</a>
      <a class="btn-notify" href="${approve}">${lot._watch ? "Mark done" : "Approve &amp; send"}</a>
    </div>
  </div>`;
}

function matchesView(pending, opts = {}) {
  if (pending.length === 0) {
    return `<div class="card"><div class="empty"><div class="rule"></div>
      No matches awaiting review. Press <strong>Search again</strong> to score the latest lots against every wishlist.</div></div>` + ranToast();
  }
  const sendOff = opts.settings && !settingOn(opts.settings, "send_to_client");
  let strong = 0, good = 0, poss = 0, soon = 0;
  for (const q of pending) {
    let lot = {}; try { lot = JSON.parse(q.lot_json); } catch (e) {}
    const s = lot._strength || "Possible";
    if (s === "Strong") strong++; else if (s === "Good") good++; else poss++;
    if (daysUntil(lot.auction_date) <= 2) soon++;
  }
  const triage = `<div class="triage">
    <div class="tstat"><div class="k">Awaiting review</div><div class="v">${pending.length}</div></div>
    <div class="tstat"><div class="k"><span class="d" style="background:#46B17A"></span>Strong</div><div class="v">${strong}</div></div>
    <div class="tstat"><div class="k"><span class="d" style="background:#CAA34C"></span>Good</div><div class="v">${good}</div></div>
    <div class="tstat"><div class="k"><span class="d" style="background:#B6B9BC"></span>Possible</div><div class="v">${poss}</div></div>
    <div class="tstat urgent"><div class="k">Closing in 48h</div><div class="v">${soon}</div></div>
  </div>`;
  const pause = sendOff
    ? `<div class="pausebar"><span><strong>Client emails are paused</strong> in Settings, so “Approve &amp; send” will mark a match handled without emailing the client.</span></div>`
    : "";
  const controls = `<div class="mtools">
    <div class="crow">
      <label class="msearch"><input id="mq" type="search" placeholder="Search car, chassis, lot or client…" autocomplete="off"></label>
      <select id="msort" class="mctl" aria-label="Sort matches">
        <option value="priority">Sort: Priority</option>
        <option value="soonest">Sort: Auction soonest</option>
        <option value="strength">Sort: Strength</option>
        <option value="landed">Sort: Lowest landed</option>
        <option value="new">Sort: Newest</option>
      </select>
      <select id="mgroup" class="mctl" aria-label="Group matches">
        <option value="none">Group: None</option>
        <option value="client">Group: Client</option>
        <option value="make">Group: Make</option>
        <option value="auction">Group: Auction</option>
      </select>
    </div>
    <div class="fchips">
      <button type="button" class="fchip on" data-str="all">All</button>
      <button type="button" class="fchip" data-str="strong"><span class="sd" style="background:#46B17A"></span>Strong</button>
      <button type="button" class="fchip" data-str="good"><span class="sd" style="background:#CAA34C"></span>Good</button>
      <button type="button" class="fchip" data-str="poss"><span class="sd" style="background:#B6B9BC"></span>Possible</button>
      <button type="button" class="fchip urgent" id="mSoon">Closing in 48h</button>
      <span class="quick">
        <button type="button" id="qStrong">Select all Strong</button>
        <button type="button" id="qSoon">Select all closing soon</button>
      </span>
    </div>
  </div>`;
  const bulk = `<form id="bulkForm" method="POST" action="/matches/bulk"><input type="hidden" name="action" id="bulkAction"></form>
    <div class="bulkbar2" id="bulkBar">
      <span class="bc"><span id="selCount">0</span> selected</span>
      <span class="bsp"></span>
      <button type="submit" form="bulkForm" class="bap" id="bApprove">Approve &amp; send</button>
      <button type="submit" form="bulkForm" class="bsk" id="bSkip">Skip</button>
      <button type="button" class="bcl" id="bClear">Clear</button>
    </div>`;
  const grid = `<div class="mgrid" id="mGrid">${pending.map((q) => matchCard(q)).join("")}<div class="mempty" id="mEmpty" style="display:none">No matches fit these filters.</div></div>`;
  return triage + strengthLegend() + pause + controls + bulk + grid + matchesScript() + ranToast();
}

// Client-side controller for the Matches view: search, strength + closing-soon
// filters, sort, grouping with headers, and multi-select bulk actions. Cards are
// server-rendered, so if this script ever fails the cards and their per-card
// Approve/Skip links still work. No template literals or ${} inside this string.
// Shows a one-off "Found N new matches" / "No new matches" toast after a search,
// reading the ?ran=N the /run redirect adds, then cleans it from the URL.
function ranToast() {
  return `<script>(function(){try{var p=new URLSearchParams(location.search);if(!p.has("ran"))return;var n=parseInt(p.get("ran"),10)||0;var msg=n>0?("Found "+n+" new match"+(n===1?"":"es")):"No new matches this time";var d=document.createElement("div");d.textContent=msg;d.style.cssText="position:fixed;left:50%;top:18px;transform:translateX(-50%);background:#1A1A1A;color:#fff;padding:11px 18px;border-radius:9px;font:600 14px/1 -apple-system,Segoe UI,Arial;z-index:9999;box-shadow:0 6px 20px rgba(0,0,0,.22)";document.body.appendChild(d);setTimeout(function(){d.style.transition="opacity .4s";d.style.opacity="0";setTimeout(function(){d.remove();},420);},3200);history.replaceState(null,"",location.pathname+"?view=matches");}catch(e){}})();</script>`;
}

function matchesScript() {
  return `<script>(function(){
  var grid=document.getElementById('mGrid'); if(!grid) return;
  var cards=[].slice.call(grid.getElementsByClassName('mcard'));
  var st={q:'',str:'all',soon:false,sort:'priority',group:'none'};
  function gv(c,k){return c.getAttribute('data-'+k)||''}
  function gn(c,k){var n=parseFloat(c.getAttribute('data-'+k));return isNaN(n)?0:n}
  function rank(c){var s=gv(c,'str');return s==='strong'?3:s==='good'?2:1}
  function grpKey(c){return st.group==='make'?gv(c,'make'):st.group==='auction'?gv(c,'auction'):gv(c,'client')}
  function cmp(a,b){
    if(st.sort==='priority')return (rank(b)*1000-gn(b,'days'))-(rank(a)*1000-gn(a,'days'));
    if(st.sort==='soonest')return gn(a,'days')-gn(b,'days');
    if(st.sort==='strength')return rank(b)-rank(a);
    if(st.sort==='landed')return (gn(a,'landed')||1e12)-(gn(b,'landed')||1e12);
    return gn(b,'qid')-gn(a,'qid');
  }
  function syncBulk(){
    var n=0;
    cards.forEach(function(c){var cb=c.querySelector('.msel'); if(cb&&cb.checked){n++; c.classList.add('picked');} else c.classList.remove('picked');});
    var sc=document.getElementById('selCount'); if(sc)sc.textContent=n;
    var bar=document.getElementById('bulkBar'); if(bar)bar.className=n?'bulkbar2 show':'bulkbar2';
  }
  function headEl(name){
    var d=document.createElement('div'); d.className='ghead';
    var s=document.createElement('span'); s.className='gh-n'; s.textContent=name; d.appendChild(s);
    var b=document.createElement('button'); b.type='button'; b.className='gh-sel'; b.textContent='Select all';
    b.addEventListener('click',function(){cards.forEach(function(c){ if(c.__show&&grpKey(c)===name){var cb=c.querySelector('.msel'); if(cb)cb.checked=true;} }); syncBulk();});
    d.appendChild(b); return d;
  }
  function apply(){
    try{
      var ql=st.q.toLowerCase(), shown=0;
      cards.forEach(function(c){
        var ok=true;
        if(st.str!=='all'&&gv(c,'str')!==st.str)ok=false;
        if(st.soon&&gn(c,'days')>2)ok=false;
        if(ql&&gv(c,'search').indexOf(ql)<0)ok=false;
        c.__show=ok; if(ok)shown++;
      });
      var vis=cards.filter(function(c){return c.__show}); vis.sort(cmp);
      var olds=grid.getElementsByClassName('ghead'); while(olds.length)olds[0].remove();
      var frag=document.createDocumentFragment(), last=null;
      vis.forEach(function(c){
        if(st.group!=='none'){var g=grpKey(c)||'Other'; if(g!==last){frag.appendChild(headEl(g)); last=g;}}
        c.style.display=''; frag.appendChild(c);
      });
      cards.forEach(function(c){ if(!c.__show){c.style.display='none'; frag.appendChild(c);} });
      var empty=document.getElementById('mEmpty'); if(empty){empty.style.display=shown?'none':''; frag.appendChild(empty);}
      grid.appendChild(frag);
      syncBulk();
    }catch(e){}
  }
  var mq=document.getElementById('mq'); if(mq)mq.addEventListener('input',function(e){st.q=e.target.value;apply();});
  var ms=document.getElementById('msort'); if(ms)ms.addEventListener('change',function(e){st.sort=e.target.value;apply();});
  var mg=document.getElementById('mgroup'); if(mg)mg.addEventListener('change',function(e){st.group=e.target.value;apply();});
  [].slice.call(document.querySelectorAll('.fchip[data-str]')).forEach(function(ch){ch.addEventListener('click',function(){st.str=ch.getAttribute('data-str');[].slice.call(document.querySelectorAll('.fchip[data-str]')).forEach(function(x){x.classList.remove('on')});ch.classList.add('on');apply();});});
  var soonBtn=document.getElementById('mSoon'); if(soonBtn)soonBtn.addEventListener('click',function(){st.soon=!st.soon;soonBtn.classList.toggle('on');apply();});
  grid.addEventListener('change',function(e){if(e.target&&e.target.classList&&e.target.classList.contains('msel'))syncBulk();});
  var qs=document.getElementById('qStrong'); if(qs)qs.addEventListener('click',function(){cards.forEach(function(c){if(c.__show&&gv(c,'str')==='strong'){var cb=c.querySelector('.msel');if(cb)cb.checked=true;}});syncBulk();});
  var qn=document.getElementById('qSoon'); if(qn)qn.addEventListener('click',function(){cards.forEach(function(c){if(c.__show&&gn(c,'days')<=2){var cb=c.querySelector('.msel');if(cb)cb.checked=true;}});syncBulk();});
  var bcl=document.getElementById('bClear'); if(bcl)bcl.addEventListener('click',function(){cards.forEach(function(c){var cb=c.querySelector('.msel');if(cb)cb.checked=false;});syncBulk();});
  var ba=document.getElementById('bApprove'); if(ba)ba.addEventListener('click',function(ev){if(!confirm('Approve and send the selected matches to their clients?')){ev.preventDefault();return;}document.getElementById('bulkAction').value='approve';});
  var bs=document.getElementById('bSkip'); if(bs)bs.addEventListener('click',function(ev){if(!confirm('Skip the selected matches?')){ev.preventDefault();return;}document.getElementById('bulkAction').value='reject';});
  grid.addEventListener('click',function(e){
    var a=e.target&&e.target.closest?e.target.closest('a.btn-notify, a.btn-skip'):null; if(!a)return;
    var card=a.closest('.mcard'); if(!card)return; e.preventDefault();
    var approve=a.classList.contains('btn-notify'); a.textContent=approve?'Sending…':'Skipping…';
    fetch(a.getAttribute('href')+'&ajax=1').then(function(r){ if(!r.ok)throw 0;
      var i=cards.indexOf(card); if(i>=0)cards.splice(i,1);
      if(card.parentNode)card.parentNode.removeChild(card);
      toast(approve?'Sent to client':'Skipped'); apply();
    }).catch(function(){ a.textContent=approve?'Approve & send':'Skip'; toast('Could not action, try again'); });
  });
  function toast(m){var t=document.createElement('div');t.textContent=m;t.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#1A1A1A;color:#fff;padding:12px 18px;border-radius:8px;font:600 13px sans-serif;z-index:99';document.body.appendChild(t);setTimeout(function(){t.remove();},2200);}
  apply();
})();<\/script>`;
}

// Standalone approve/skip handler for pages that render match cards without the
// Matches grid controller (the client detail page). Sends the action in the
// background and fades the card out, no reload.
function matchActionScript() {
  return `<script>(function(){
  document.addEventListener('click',function(e){
    var a=e.target&&e.target.closest?e.target.closest('a.btn-notify, a.btn-skip'):null; if(!a)return;
    var card=a.closest('.mcard'); if(!card)return; e.preventDefault();
    var approve=a.classList.contains('btn-notify'); a.textContent=approve?'Sending…':'Skipping…';
    fetch(a.getAttribute('href')+'&ajax=1').then(function(r){ if(!r.ok)throw 0;
      card.style.transition='opacity .2s'; card.style.opacity='0';
      setTimeout(function(){ if(card.parentNode)card.parentNode.removeChild(card); },200);
      toast(approve?'Sent to client':'Skipped');
    }).catch(function(){ a.textContent=approve?'Approve & send':'Skip'; toast('Could not action, try again'); });
  });
  function toast(m){var t=document.createElement('div');t.textContent=m;t.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#1A1A1A;color:#fff;padding:12px 18px;border-radius:8px;font:600 13px sans-serif;z-index:99';document.body.appendChild(t);setTimeout(function(){t.remove();},2200);}
  })();<\/script>`;
}

// Plain-English key for the Strong / Good / Possible labels, shown on the
// Matches view and client pages so agents know what each strength means.
function strengthLegend() {
  return `<div class="slegend">
    <div class="sl-row">
      <span class="sl-t">Match strength</span>
      <span class="sl-item"><span class="sl-dot" style="background:#46B17A"></span><b>Strong</b> well under budget and a clear step above the grade asked for</span>
      <span class="sl-item"><span class="sl-dot" style="background:#CAA34C"></span><b>Good</b> a solid fit on budget and grade</span>
      <span class="sl-item"><span class="sl-dot" style="background:#B6B9BC"></span><b>Possible</b> meets the basics, less margin</span>
    </div>
    <details class="sl-more"><summary>How it's scored</summary><div class="sl-detail">Strength blends four things: how far under the client's max budget the lot sits, how far its auction grade beats the minimum grade asked for, an exact chassis-code or keyword match, and a bonus for top-condition lots (grade 4.5 or higher). Strong is a clear all-round fit; Possible just meets the basics and is lower priority.</div></details>
  </div>`;
}

// Mark pending matches whose auction has already ended as 'expired', so the
// review queue only ever shows lots you can still bid on. Safe to call often.
export async function expirePast(env) {
  try {
    await env.DB.prepare(
      "UPDATE queue SET status = 'expired', decided_at = datetime('now') WHERE status = 'pending' AND json_extract(lot_json,'$.auction_date') < datetime('now')"
    ).run();
  } catch (e) {
    console.error("expirePast failed:", e.message);
  }
}

// Update an existing wishlist's criteria (the "edit what they're chasing" flow).
export async function editWishlist(env, form, session) {
  const id = Number(form.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;
  if (!(await wishlistAccessibleBy(env, id, session))) return;
  await env.DB.prepare(
    `UPDATE wishlists SET label = ?, marka_name = ?, model_name = ?, year_min = ?, year_max = ?,
       price_max = ?, mileage_max = ?, rate_min = ?, kuzov = ?, grade_kw = ?, watch_only = ? WHERE id = ?`
  ).bind(
    str(form, "label"), str(form, "marka_name"), str(form, "model_name"),
    num(form, "year_min"), num(form, "year_max"), num(form, "price_max"), num(form, "mileage_max"),
    num(form, "rate_min"), str(form, "kuzov"), str(form, "grade_kw"), form.get("watch_only") ? 1 : 0, id
  ).run();
}

// Inline editor for one wishlist (native <details>, no JS), plus toggle/delete.
// opts.base prefixes the form actions ("" = staff routes, "/portal" = buyer).
// opts.portal hides the staff-only "watch only" lead control.
function wishlistEditor(w, opts = {}) {
  const base = opts.base || "";
  const field = (label, name, type, opt) =>
    `<div><label>${label}${opt ? ` <span class="opt">${opt}</span>` : ""}</label><input name="${name}"${type ? ` type="${type}"` : ""} value="${esc(w[name] ?? "")}"></div>`;
  const summary = `${esc(displayName(w.marka_name)) || "Any maker"} ${esc(displayName(w.model_name))}`.trim()
    + (w.year_min || w.year_max ? ` · ${esc(yearRange(w.year_min, w.year_max))}` : "")
    + (w.price_max ? ` · ¥${Number(w.price_max).toLocaleString()}` : "")
    + (w.rate_min ? ` · grade ${esc(w.rate_min)}+` : "");
  return `<div class="wlrow">
    <div class="wlhead">
      <div class="wlsum">
        <div class="wln">${esc(w.label || "Wishlist")} ${w.active ? "" : `<span class="chip muted">paused</span>`}</div>
        <div class="wlc">${summary || "Matches anything"}</div>
      </div>
      <div class="wlacts">
        <form method="POST" action="${base}/wishlist/toggle" style="display:inline"><input type="hidden" name="id" value="${w.id}"><button class="btn-toggle ${w.active ? "on" : "off"}" type="submit">${w.active ? "On" : "Off"}</button></form>
        <form method="POST" action="${base}/wishlist/delete" style="display:inline" onsubmit="return confirm('Delete this wishlist? This cannot be undone.')"><input type="hidden" name="id" value="${w.id}"><button class="btn-del" type="submit">Delete</button></form>
      </div>
    </div>
    <details class="wledit">
      <summary>${opts.portal ? "Edit this search" : "Edit what they're chasing"}</summary>
      <form method="POST" action="${base}/wishlist/edit">
        <input type="hidden" name="id" value="${w.id}">
        <div class="grid">
          ${field("LABEL", "label")}
          ${field("MAKE", "marka_name")}
          ${field("MODEL", "model_name")}
          ${field("YEAR MIN", "year_min", "number")}
          ${field("YEAR MAX", "year_max", "number")}
          ${field("MAX PRICE (JPY)", "price_max", "number")}
          ${field("MAX MILEAGE (KM)", "mileage_max", "number")}
          ${field("MIN GRADE", "rate_min", "number")}
          ${field("CHASSIS / MODEL CODE", "kuzov", null, "(contains, best match)")}
          ${field("GRADE KEYWORD", "grade_kw", null, "(contains)")}
        </div>
        ${opts.portal ? "" : `<label style="display:flex;align-items:flex-start;gap:9px;margin-top:12px;font-size:13px;color:#3A3C3F;cursor:pointer"><input type="checkbox" name="watch_only" value="1" style="width:auto;margin-top:2px"${w.watch_only ? " checked" : ""}><span><strong>Watch only (lead).</strong> Surface matches for a follow-up call, never auto-email this client.</span></label>`}
        <div class="actions"><button class="btn-gold" type="submit">Save changes</button>
          <span class="help">Blank fields match anything.</span></div>
      </form>
    </details>
  </div>`;
}

// Self-contained bulk bar for the client page (the main Matches controller isn't
// loaded here). Select-all + Approve/Skip the ticked matches, then return here.
function clientBulkBar(cid) {
  return `<form id="bulkForm" method="POST" action="/matches/bulk"><input type="hidden" name="action" id="bulkAction"><input type="hidden" name="back" value="/admin?view=client&amp;id=${cid}"></form>
    <div style="display:flex;align-items:center;gap:14px;margin:0 0 14px;flex-wrap:wrap">
      <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-weight:600;font-size:13px"><input type="checkbox" id="cdAll" style="width:auto"> Select all</label>
      <span style="color:#9A9DA1;font-size:13px"><span id="cdCount">0</span> selected</span>
      <span style="flex:1"></span>
      <button type="submit" form="bulkForm" class="bap" onclick="document.getElementById('bulkAction').value='approve'">Approve &amp; send</button>
      <button type="submit" form="bulkForm" class="bsk" onclick="document.getElementById('bulkAction').value='reject'">Skip</button>
    </div>
    <script>(function(){var all=document.getElementById('cdAll'),cnt=document.getElementById('cdCount');function boxes(){return document.querySelectorAll('.mgrid .msel');}function upd(){var n=0,t=boxes().length;boxes().forEach(function(b){if(b.checked)n++;});if(cnt)cnt.textContent=n;if(all)all.checked=t>0&&n===t;}if(all)all.addEventListener('change',function(){boxes().forEach(function(b){b.checked=all.checked;});upd();});document.addEventListener('change',function(e){if(e.target&&e.target.classList&&e.target.classList.contains('msel'))upd();});upd();})();</script>`;
}

// Client detail page: contact, owner, their wishlists (editable) and their live
// matches. Reached by clicking a client name in the Clients list.
export async function clientDetailPage(env, clientId, session = { role: "admin", id: 0 }) {
  const cid = Number(clientId);
  const notFound = () => shell(sidebar("clients", {}, session),
    `<div class="topbar"><div><div class="kicker">Vehicle Finder</div><h1>Client</h1></div><a class="btn-dark" href="/admin?view=clients">Back to clients</a></div>
     <div class="content"><div class="card"><div class="empty">Client not found.</div></div></div>`,
    "Client - JDM Connect");
  if (!Number.isInteger(cid) || cid <= 0) return notFound();
  if (!(await clientAccessibleBy(env, cid, session))) return notFound();
  const c = await env.DB.prepare("SELECT * FROM clients WHERE id = ?").bind(cid).first();
  if (!c) return notFound();

  const wls = (await env.DB.prepare("SELECT * FROM wishlists WHERE client_id = ? ORDER BY id").bind(cid).all()).results || [];
  await expirePast(env);
  const matches = (await env.DB.prepare(
    `SELECT q.*, c.name AS client_name, c.email AS client_email, c.whatsapp AS client_whatsapp,
            w.label AS wlabel, w.rate_min AS w_rate, w.price_max AS w_price, w.kuzov AS w_kuzov, w.grade_kw AS w_kw
       FROM queue q JOIN clients c ON c.id = q.client_id LEFT JOIN wishlists w ON w.id = q.wishlist_id
      WHERE q.client_id = ? AND q.status = 'pending' ORDER BY q.created_at DESC LIMIT 60`
  ).bind(cid).all()).results || [];

  // Cars this client has asked us to action/translate from their portal.
  const requested = (await env.DB.prepare(
    `SELECT q.*, w.label AS wlabel FROM queue q LEFT JOIN wishlists w ON w.id = q.wishlist_id
      WHERE q.client_id = ? AND q.client_request = 1 ORDER BY q.client_request_at DESC LIMIT 40`
  ).bind(cid).all()).results || [];

  const owner = c.agent_id ? await env.DB.prepare("SELECT name, company FROM agents WHERE id = ?").bind(c.agent_id).first() : null;
  const ownerLabel = owner ? esc(owner.name) + (owner.company ? " · " + esc(owner.company) : "") : "JDM Connect";
  const contact = [c.email && `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`, c.whatsapp && esc(c.whatsapp), c.state && esc(c.state)].filter(Boolean).join(" &middot; ") || "No contact on file";
  const canManage = session.role === "admin" || Number(c.agent_id) === Number(session.id);

  const head = `<div class="card">
    <div class="cd-head">
      <span class="avatar" style="width:46px;height:46px;font-size:16px">${esc(initials(c.name))}</span>
      <div style="flex:1">
        <h2 style="border:0;padding:0;margin:0 0 4px">${esc(c.name)}</h2>
        <div class="help">${contact}</div>
      </div>
      <div class="cd-owner"><div class="k">Owner</div><div class="v">${ownerLabel}</div></div>
    </div>
  </div>`;

  // Buyer-portal access control (owner/admin only).
  const portalState = c.portal_enabled ? (c.pass_hash ? "Active - client can sign in" : "Invited - awaiting password") : "Not enabled";
  const portalCard = canManage ? `<div class="card">
    <div class="portal-acct">
      <div style="flex:1">
        <div class="pa-k">BUYER PORTAL</div>
        <div style="font-weight:600;margin-top:3px">${portalState}</div>
      </div>
      <div class="pwrap">
        ${c.email
          ? `<form method="POST" action="/client/portal-invite" style="display:inline"><input type="hidden" name="id" value="${c.id}"><button class="btn-gold" type="submit">${c.portal_enabled ? "Resend set-password link" : "Give portal access"}</button></form>`
          : `<span class="help">Add an email to enable portal access.</span>`}
        ${c.portal_enabled ? `<form method="POST" action="/client/portal-revoke" style="display:inline" onsubmit="return confirm('Revoke this client&#39;s portal access and clear their password?')"><input type="hidden" name="id" value="${c.id}"><button class="btn-del" type="submit">Revoke</button></form>` : ""}
      </div>
    </div>
  </div>` : "";

  const reqSection = requested.length ? `<div class="card">
    <h2><span class="num">${requested.length}</span> Cars ${esc(c.name)} asked us to action</h2>
    <p class="help" style="margin:-8px 0 16px">Requested from their portal - pull the auction sheet, translate, and follow up.</p>
    <div class="mgrid">${requested.map((q) => requestedCard(q)).join("")}</div>
  </div>` : "";

  const newWl = `<div class="card">
    <h2><span class="num">+</span> New wishlist for ${esc(c.name)}</h2>
    <form method="POST" action="/wishlist">
      <input type="hidden" name="client_id" value="${c.id}">
      ${presetSelect()}
      <div class="grid">
        <div><label>LABEL</label><input name="label" placeholder="e.g. weekend project"></div>
        <div><label>MAKE</label><input name="marka_name" placeholder="e.g. TOYOTA"></div>
        <div><label>MODEL <span class="opt">(contains)</span></label><input name="model_name" placeholder="e.g. SUPRA"></div>
        <div><label>YEAR MIN</label><input name="year_min" type="number" placeholder="1990"></div>
        <div><label>YEAR MAX</label><input name="year_max" type="number" placeholder="2002"></div>
        <div><label>MAX PRICE (JPY)</label><input name="price_max" type="number" placeholder="1,500,000"></div>
        <div><label>MAX MILEAGE (KM)</label><input name="mileage_max" type="number" placeholder="80,000"></div>
        <div><label>MIN GRADE</label><input name="rate_min" type="number" step="0.5" placeholder="e.g. 4"></div>
        <div><label>CHASSIS / MODEL CODE <span class="opt">(contains, best match)</span></label><input name="kuzov" placeholder="e.g. JZA80 or 211"></div>
      </div>
      <label style="display:flex;align-items:flex-start;gap:9px;margin-top:14px;font-size:13px;color:#3A3C3F;cursor:pointer"><input type="checkbox" name="watch_only" value="1" style="width:auto;margin-top:2px"><span><strong>Watch only (lead).</strong> Surface matches for a follow-up call, but never auto-email this client.</span></label>
      <div class="actions"><button class="btn-gold" type="submit">Add wishlist</button>
        <span class="help">Add at least a make, model or chassis/model code.</span></div>
    </form>${presetScript()}
  </div>`;

  const wlSection = `<div class="card">
    <h2><span class="num">${wls.length}</span> Wishlists</h2>
    ${wls.map((w) => wishlistEditor(w)).join("") || `<div class="empty">No wishlists yet. Add one below.</div>`}
  </div>`;

  const matchSection = `<div class="card">
    <h2><span class="num">${matches.length}</span> Live matches</h2>
    ${matches.length ? strengthLegend() + clientBulkBar(cid) + `<div class="mgrid">${matches.map((q) => matchCard(q)).join("")}</div>` : `<div class="empty">No live matches right now.</div>`}
  </div>`;

  const main = `
    <div class="topbar">
      <div>
        <div class="kicker">Vehicle Finder · Client</div>
        <h1>${esc(c.name)}</h1>
        <p class="subline">What they're chasing, and the lots that match.</p>
      </div>
      <a class="btn-dark" href="/admin?view=clients">Back to clients</a>
    </div>
    <div class="content">${head}${portalCard}${reqSection}${wlSection}${newWl}${matchSection}</div>${matchActionScript()}`;
  return shell(sidebar("clients", { matches: matches.length }, session), main, esc(c.name) + " - JDM Connect");
}

// ---------------------------------------------------------------------------
// Public request page
// ---------------------------------------------------------------------------
export async function requestPage(env, opts = {}) {
  const ok = opts.submitted;
  const ref = opts.ref;
  const req = opts.req || {};
  const firstName = String(req.name || "").trim().split(/\s+/)[0];
  const vals = opts.vals || {};
  const v = (k) => esc(vals[k] ?? "");
  const makers = await distinctMakers(env);
  const yMax = new Date().getFullYear() + 1; // allow next year's models in the feed

  const success = ok ? `<div class="card reqok" id="reqOk">
        <div class="reqok-badge"><span class="tick">&#10003;</span> Request received</div>
        ${ref ? `<div class="reqok-ref">Your reference: <strong>${esc(ref)}</strong></div>` : ""}
        <p>Thanks${firstName ? " " + esc(firstName) : ""}. Your request is in and we're now watching the Japanese auctions for it. We'll ${req.email ? "email" : "be in touch"} the moment a matching car comes up. That can take days or weeks depending on what's listed, so a quiet little while is completely normal.${req.email ? ` A confirmation is on its way to <strong>${esc(req.email)}</strong>.` : ""}</p>
        ${req.portal ? `<p style="margin-top:10px;color:var(--t2);font-size:14px;line-height:1.55"><strong>Your account is ready.</strong> <a href="/login" style="color:var(--gold-txt);font-weight:600;text-decoration:underline">Sign in</a> any time with your email and the password you chose to track your search and see the cars we find.</p>` : ""}
      </div>
      <script>(function(){try{var el=document.getElementById('reqOk');if(el&&el.scrollIntoView)el.scrollIntoView({behavior:'smooth',block:'center'});}catch(e){}})();</script>` : "";

  const contactBanner = opts.error === "contact"
    ? `<div class="reqerr">Please add an email or a WhatsApp number so we can reach you when a match comes up.</div>`
    : "";

  const main = `
    <div class="topbar">
      <div style="position:absolute;right:-50px;top:-90px">${risingSun({ size: 320, tone: "soft" })}</div>
      <div class="topbar-in">
        <div class="kicker">Vehicle Finder</div>
        <h1>Request a vehicle</h1>
        <p class="subline">Tell us what you're after and we'll search the Japanese auctions for it.</p>
      </div>
    </div>
    <div class="content">
      ${success}
      <div class="card">
        ${contactBanner}
        <h2><span class="num">01</span> Your details</h2>
        <form id="requestForm" method="POST" action="/request" novalidate>
          <input type="text" name="company_website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0" />
          <div class="grid">
            <div><label for="rq-name">NAME</label><input id="rq-name" name="name" value="${v("name")}" placeholder="Jane Citizen" required></div>
            <div><label for="rq-email">EMAIL</label><input id="rq-email" name="email" type="email" value="${v("email")}" placeholder="name@email.com"></div>
            <div><label for="rq-whatsapp">WHATSAPP <span class="opt">(+61…)</span></label><input id="rq-whatsapp" name="whatsapp" type="tel" inputmode="tel" value="${v("whatsapp")}" placeholder="+61 4XX XXX XXX"></div>
            <div><label for="rq-state">STATE <span class="opt">(where it'll be registered)</span></label><select id="rq-state" name="state">${stateOptions(vals.state || "")}</select></div>
            <div><label for="rq-pass">CREATE A PASSWORD <span class="opt">(optional, to log in and track your search)</span></label><input id="rq-pass" name="portal_password" type="password" autocomplete="new-password" minlength="6" placeholder="at least 6 characters"></div>
          </div>
          <p id="rq-contact-error" class="field-err">Please add an email or a WhatsApp number so we can reach you when a match comes up.</p>
          <h2 style="margin-top:26px"><span class="num">02</span> What you're looking for</h2>
          ${presetSelect()}
          <div class="grid">
            <div><label>MAKE</label>${makerField(makers, "rq-maker")}</div>
            <div><label>MODEL <span class="opt">(pick or type)</span></label>${modelField("rq-models")}</div>
            <div><label>NICKNAME <span class="opt">(optional, for your reference)</span></label><input name="label" value="${v("label")}" placeholder="e.g. weekend project"></div>
            <div><label>YEAR FROM</label><input name="year_min" type="number" min="1960" max="${yMax}" value="${v("year_min")}" placeholder="1990"></div>
            <div><label>YEAR TO</label><input name="year_max" type="number" min="1960" max="${yMax}" value="${v("year_max")}" placeholder="2002"></div>
            <div><label>MAX BUDGET <span class="opt">(in Japanese yen, the auction price)</span></label><input name="price_max" type="number" min="0" step="10000" value="${v("price_max")}" placeholder="3,000,000"></div>
            <div><label>MAX MILEAGE <span class="opt">(km)</span></label><input name="mileage_max" type="number" min="0" step="1000" value="${v("mileage_max")}" placeholder="100,000"></div>
            <div><label>MIN AUCTION GRADE <span class="opt">(1 to 6 condition score, leave blank if unsure)</span></label><input name="rate_min" type="number" min="1" max="6" step="0.5" value="${v("rate_min")}" placeholder="e.g. 4"></div>
            <div><label>CHASSIS CODE <span class="opt">(only if you know it, e.g. JZA80)</span></label><input name="kuzov" value="${v("kuzov")}" placeholder="e.g. JZA80"></div>
          </div>
          <p id="rq-year-error" class="field-err">“Year from” can't be later than “Year to”. Please check the years.</p>
          <div class="actions"><button class="btn-gold" type="submit">Submit request</button>
            <span class="help">We need your name and a way to reach you (email or WhatsApp). Tell us as much about the car as you can - the more detail, the better the match. We review every match before sending you anything.</span></div>
          <p class="help" style="margin-top:14px;font-size:12px;line-height:1.5;opacity:.85">We use the details above only to search for and contact you about matching vehicles. We never share them with third parties.</p>
        </form>
      </div>
    </div>
    ${modelScript("rq-maker", "rq-models")}${presetScript()}${requestFormScript()}`;
  const sb = `<aside class="side"><div class="brand">${LOGO}</div>
    <nav class="nav"><a class="active"><span class="bar"></span><span class="lbl">Request a vehicle</span></a></nav>
    </aside>`;
  return brandShell(sb, main, "Request a vehicle - JDM Connect");
}

// Client-side guard for the public request form: require a contact method
// (Fix 1), sanity-check the year range (Fix 4), and disable the button after a
// valid submit so a fast double-tap can't create two leads (Fix 9). The server
// re-checks all of this - these are UX only. No ${} interpolation inside.
function requestFormScript() {
  return `<script>(function(){
    var form=document.getElementById('requestForm'); if(!form) return;
    var cErr=document.getElementById('rq-contact-error');
    var yErr=document.getElementById('rq-year-error');
    var btn=form.querySelector('button[type=submit]');
    function val(n){var el=form.querySelector('[name="'+n+'"]');return el?String(el.value||'').trim():'';}
    form.addEventListener('submit',function(e){
      var noContact=!val('email') && !val('whatsapp');
      if(cErr) cErr.style.display=noContact?'block':'none';
      var yf=parseInt(val('year_min'),10), yt=parseInt(val('year_max'),10);
      var badYear=!!(yf && yt && yf>yt);
      if(yErr) yErr.style.display=badYear?'block':'none';
      if(noContact||badYear){
        e.preventDefault();
        var first=noContact?cErr:yErr;
        if(first&&first.scrollIntoView)first.scrollIntoView({behavior:'smooth',block:'center'});
        return;
      }
      if(btn){btn.disabled=true;btn.textContent='Sending…';}
    });
  })();</script>`;
}

function shell(side, main, title) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${CSS}</style></head>
    <body><div class="wrap">${side}<div class="main">${main}</div></div></body></html>`;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

// Owner guard (strict): admin, or the agent who created the client. Used for
// destructive/management actions (delete client, manage sharing).
export async function clientOwnedBy(env, clientId, session) {
  if (!session || session.role === "admin") return true;
  const c = await env.DB.prepare("SELECT agent_id FROM clients WHERE id = ?").bind(Number(clientId)).first();
  return !!c && Number(c.agent_id) === Number(session.id);
}

// Access guard: the agent owns the client OR it has been shared with them.
// Used for view / add-wishlist / search / approve-skip ("help search").
export async function clientAccessibleBy(env, clientId, session) {
  if (!session || session.role === "admin") return true;
  if (await clientOwnedBy(env, clientId, session)) return true;
  const s = await env.DB.prepare(
    "SELECT 1 FROM client_shares WHERE client_id = ? AND agent_id = ?"
  ).bind(Number(clientId), Number(session.id)).first();
  return !!s;
}

async function wishlistAccessibleBy(env, wishlistId, session) {
  if (!session || session.role === "admin") return true;
  const w = await env.DB.prepare("SELECT client_id FROM wishlists WHERE id = ?").bind(Number(wishlistId)).first();
  return !!w && (await clientAccessibleBy(env, w.client_id, session));
}

// SQL predicate (alias c = clients) + bind values for "rows this session may
// see": all for admin, owned-or-shared for an agent.
function accessScope(session) {
  if (!session || session.role === "admin") return { sql: "1=1", binds: [] };
  return {
    sql: "(c.agent_id = ? OR c.id IN (SELECT client_id FROM client_shares WHERE agent_id = ?))",
    binds: [session.id, session.id],
  };
}

export async function createClient(env, form, session) {
  const name = String(form.get("name") || "").trim();
  const email = String(form.get("email") || "").trim();
  const whatsapp = String(form.get("whatsapp") || "").trim();
  // A client must be reachable, or any match we find can never be sent. Require
  // a name plus at least one contact channel (email or WhatsApp).
  if (!name) return { ok: false, error: "name" };
  if (!email && !whatsapp) return { ok: false, error: "contact" };
  const state = normalizeState(form.get("state"));
  const agentId = session && session.role === "agent" ? session.id : null;
  const r = await env.DB.prepare("INSERT INTO clients (name, email, whatsapp, state, agent_id) VALUES (?, ?, ?, ?, ?)")
    .bind(name, email || null, whatsapp || null, state, agentId).run();
  return { ok: true, id: r.meta?.last_row_id };
}

const num = (form, k) => { const v = form.get(k); return v === null || v === "" ? null : Number(v); };
const str = (form, k) => { const v = form.get(k); return v === null || v === "" ? null : v; };

export async function createWishlist(env, form, clientIdOverride, session) {
  const clientId = clientIdOverride ?? num(form, "client_id");
  if (!clientId) return;
  // An agent can add a wishlist to any client they own or that's shared to them.
  if (!(await clientAccessibleBy(env, clientId, session))) return;
  // Don't save a whole-feed wishlist: require at least one narrowing term.
  if (!(str(form, "marka_name") || str(form, "model_name") || str(form, "kuzov") || str(form, "grade_kw"))) return;
  await env.DB.prepare(
    `INSERT INTO wishlists
      (client_id, label, marka_name, model_name, year_min, year_max, price_max, mileage_max, rate_min, kuzov, grade_kw, watch_only)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    clientId, str(form, "label"), str(form, "marka_name"), str(form, "model_name"),
    num(form, "year_min"), num(form, "year_max"), num(form, "price_max"), num(form, "mileage_max"),
    num(form, "rate_min"), str(form, "kuzov"), str(form, "grade_kw"), form.get("watch_only") ? 1 : 0
  ).run();
}

// Delete a client and everything attached to them - their wishlists, queued
// matches, and seen-lot history - in one batch.
export async function deleteClient(env, id, session) {
  const cid = Number(id);
  if (!Number.isInteger(cid) || cid <= 0) return;
  if (!(await clientOwnedBy(env, cid, session))) return; // delete is owner-only
  const wls = (await env.DB.prepare("SELECT id FROM wishlists WHERE client_id = ?").bind(cid).all()).results || [];
  const stmts = [env.DB.prepare("DELETE FROM queue WHERE client_id = ?").bind(cid)];
  for (const w of wls) stmts.push(env.DB.prepare("DELETE FROM seen_lots WHERE wishlist_id = ?").bind(w.id));
  stmts.push(env.DB.prepare("DELETE FROM wishlists WHERE client_id = ?").bind(cid));
  stmts.push(env.DB.prepare("DELETE FROM client_shares WHERE client_id = ?").bind(cid));
  stmts.push(env.DB.prepare("DELETE FROM clients WHERE id = ?").bind(cid));
  await env.DB.batch(stmts);
}

// Delete a single wishlist plus its queued matches and seen-lot history.
export async function deleteWishlist(env, id, session) {
  const wid = Number(id);
  if (!Number.isInteger(wid) || wid <= 0) return;
  if (!(await wishlistAccessibleBy(env, wid, session))) return;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM queue WHERE wishlist_id = ?").bind(wid),
    env.DB.prepare("DELETE FROM seen_lots WHERE wishlist_id = ?").bind(wid),
    env.DB.prepare("DELETE FROM wishlists WHERE id = ?").bind(wid),
  ]);
}

// Flip a wishlist active/paused. Paused wishlists are skipped by the matcher.
export async function toggleWishlist(env, id, session) {
  const wid = Number(id);
  if (!Number.isInteger(wid) || wid <= 0) return;
  if (!(await wishlistAccessibleBy(env, wid, session))) return;
  await env.DB.prepare(
    "UPDATE wishlists SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END WHERE id = ?"
  ).bind(wid).run();
}

// --- Agent management (admin only; the route layer enforces the admin role) ---
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Create an agent with no password - they set their own via the emailed invite.
// Returns { ok, token, email, name } so the route can send the welcome email.
export async function createAgent(env, form) {
  const name = String(form.get("name") || "").trim();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const company = String(form.get("company") || "").trim() || null;
  if (!name || !email) return { ok: false, error: "missing fields" };
  const token = randomToken();
  const exp = Date.now() + INVITE_TTL_MS;
  try {
    await env.DB.prepare(
      "INSERT INTO agents (email, name, company, pass_salt, pass_hash, invite_token, invite_exp) VALUES (?, ?, ?, '', '', ?, ?)"
    ).bind(email, name, company, token, exp).run();
    return { ok: true, token, email, name };
  } catch (e) {
    console.error("createAgent failed:", e.message);
    return { ok: false, error: "email already in use" };
  }
}

// Re-issue an invite / set-password link (resend invite or reset password).
export async function resendInvite(env, id) {
  const a = await env.DB.prepare("SELECT id, name, email FROM agents WHERE id = ?").bind(Number(id)).first();
  if (!a) return null;
  const token = randomToken();
  const exp = Date.now() + INVITE_TTL_MS;
  await env.DB.prepare("UPDATE agents SET invite_token = ?, invite_exp = ? WHERE id = ?").bind(token, exp, a.id).run();
  return { token, email: a.email, name: a.name };
}

export async function toggleAgentAlerts(env, id) {
  const aid = Number(id);
  if (!Number.isInteger(aid) || aid <= 0) return;
  await env.DB.prepare("UPDATE agents SET alerts = CASE WHEN alerts = 1 THEN 0 ELSE 1 END WHERE id = ?").bind(aid).run();
}

export async function deleteAgent(env, id) {
  const aid = Number(id);
  if (!Number.isInteger(aid) || aid <= 0) return;
  const clients = (await env.DB.prepare("SELECT id FROM clients WHERE agent_id = ?").bind(aid).all()).results || [];
  const stmts = [];
  for (const c of clients) {
    const wls = (await env.DB.prepare("SELECT id FROM wishlists WHERE client_id = ?").bind(c.id).all()).results || [];
    stmts.push(env.DB.prepare("DELETE FROM queue WHERE client_id = ?").bind(c.id));
    for (const w of wls) stmts.push(env.DB.prepare("DELETE FROM seen_lots WHERE wishlist_id = ?").bind(w.id));
    stmts.push(env.DB.prepare("DELETE FROM wishlists WHERE client_id = ?").bind(c.id));
    stmts.push(env.DB.prepare("DELETE FROM client_shares WHERE client_id = ?").bind(c.id));
  }
  stmts.push(env.DB.prepare("DELETE FROM client_shares WHERE agent_id = ?").bind(aid)); // shares received
  stmts.push(env.DB.prepare("DELETE FROM clients WHERE agent_id = ?").bind(aid));
  stmts.push(env.DB.prepare("DELETE FROM agents WHERE id = ?").bind(aid));
  await env.DB.batch(stmts);
}

// Share / unshare a client with another agent - owner (or admin) only.
export async function shareClient(env, clientId, agentId, session) {
  const cid = Number(clientId), aid = Number(agentId);
  if (!cid || !aid) return;
  if (!(await clientOwnedBy(env, cid, session))) return; // only the owner shares
  const owner = await env.DB.prepare("SELECT agent_id FROM clients WHERE id = ?").bind(cid).first();
  if (owner && Number(owner.agent_id) === aid) return; // don't share with the owner
  const agent = await env.DB.prepare("SELECT id FROM agents WHERE id = ? AND active = 1").bind(aid).first();
  if (!agent) return;
  await env.DB.prepare("INSERT OR IGNORE INTO client_shares (client_id, agent_id) VALUES (?, ?)").bind(cid, aid).run();
}

export async function unshareClient(env, clientId, agentId, session) {
  const cid = Number(clientId), aid = Number(agentId);
  if (!cid || !aid) return;
  if (!(await clientOwnedBy(env, cid, session))) return;
  await env.DB.prepare("DELETE FROM client_shares WHERE client_id = ? AND agent_id = ?").bind(cid, aid).run();
}

// Reassign a client's owner - admin only. Empty/0 agentId returns it to JDM
// Connect (admin). The client's wishlists, matches and alerts follow the owner.
export async function assignClient(env, clientId, agentId, session) {
  if (!session || session.role !== "admin") return;
  const cid = Number(clientId);
  if (!Number.isInteger(cid) || cid <= 0) return;
  const aid = Number(agentId);
  const owner = Number.isInteger(aid) && aid > 0 ? aid : null;
  if (owner) {
    const agent = await env.DB.prepare("SELECT id FROM agents WHERE id = ? AND active = 1").bind(owner).first();
    if (!agent) return;
  }
  await env.DB.prepare("UPDATE clients SET agent_id = ? WHERE id = ?").bind(owner, cid).run();
  if (owner) await env.DB.prepare("DELETE FROM client_shares WHERE client_id = ? AND agent_id = ?").bind(cid, owner).run();
}

// Bulk allocate selected clients - admin only. action "assign" sets the owner
// (empty agent = JDM Connect); "share" adds the agent as a co-searcher.
export async function bulkAllocate(env, action, agentId, ids, session) {
  if (!session || session.role !== "admin") return;
  const list = (ids || []).map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (!list.length) return;
  const aid = Number(agentId);
  const owner = Number.isInteger(aid) && aid > 0 ? aid : null;
  if (owner) {
    const agent = await env.DB.prepare("SELECT id FROM agents WHERE id = ? AND active = 1").bind(owner).first();
    if (!agent) return;
  }
  const stmts = [];
  if (action === "share") {
    if (!owner) return; // can't share with JDM Connect
    for (const cid of list) stmts.push(env.DB.prepare("INSERT OR IGNORE INTO client_shares (client_id, agent_id) VALUES (?, ?)").bind(cid, owner));
  } else {
    for (const cid of list) {
      stmts.push(env.DB.prepare("UPDATE clients SET agent_id = ? WHERE id = ?").bind(owner, cid));
      if (owner) stmts.push(env.DB.prepare("DELETE FROM client_shares WHERE client_id = ? AND agent_id = ?").bind(cid, owner));
    }
  }
  if (stmts.length) await env.DB.batch(stmts);
}

export async function toggleAgent(env, id) {
  const aid = Number(id);
  if (!Number.isInteger(aid) || aid <= 0) return;
  await env.DB.prepare(
    "UPDATE agents SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END WHERE id = ?"
  ).bind(aid).run();
}

// Hardening for the PUBLIC /request form (createClient/createWishlist are also
// used by the admin-only flows, so the spam controls live here, not there).
const REQ_MAX = { name: 120, email: 160, whatsapp: 40, label: 120, marka_name: 60, model_name: 60, kuzov: 40, grade_kw: 40 };
const REQ_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clipField(form, key, max) {
  const v = String(form.get(key) ?? "").trim().slice(0, max);
  form.set(key, v);
  return v;
}

// Handle a public request submission. Returns a tagged result the route acts on:
//   { ok:true, req, ref, clientId }        → stored; alert + confirm + receipt
//   { ok:false, error:"contact", vals }    → no contact method; re-render w/ error
//   { ok:false, error:"spam" }             → honeypot; pretend success, store nothing
export async function createRequest(env, form) {
  // Honeypot: a hidden field real visitors never see. Bots fill it - pretend
  // success and store nothing, so they get no signal.
  if (String(form.get("company_website") ?? "").trim()) return { ok: false, error: "spam" };

  // Clip every free-text field so a bot can't store huge payloads.
  clipField(form, "name", REQ_MAX.name);
  clipField(form, "whatsapp", REQ_MAX.whatsapp);
  clipField(form, "label", REQ_MAX.label);
  clipField(form, "marka_name", REQ_MAX.marka_name);
  clipField(form, "model_name", REQ_MAX.model_name);
  clipField(form, "kuzov", REQ_MAX.kuzov);
  clipField(form, "grade_kw", REQ_MAX.grade_kw);

  // Drop a malformed email rather than storing junk that breaks alert delivery.
  let email = clipField(form, "email", REQ_MAX.email).toLowerCase();
  if (email && !REQ_EMAIL_RE.test(email)) email = "";
  form.set("email", email);

  const g = (k) => String(form.get(k) || "").trim();
  const whatsapp = g("whatsapp");

  // Fix 1 (server backstop): block a lead we could never reach. The form guards
  // this client-side too, but never trust the client. Preserve the input so the
  // re-rendered form keeps what they typed.
  if (!email && !whatsapp) {
    return {
      ok: false,
      error: "contact",
      vals: {
        name: g("name"), email: g("email"), whatsapp, state: g("state"), label: g("label"),
        year_min: g("year_min"), year_max: g("year_max"), price_max: g("price_max"),
        mileage_max: g("mileage_max"), rate_min: g("rate_min"), kuzov: g("kuzov"),
      },
    };
  }

  // Fix 6: reuse an existing staff-scoped client with this email rather than
  // spawning a duplicate on every submission.
  const clientId = await upsertPublicClient(env, form, email, whatsapp);
  // Fix 2: ALWAYS create a searchable wishlist (broad ones are flagged for staff).
  await createRequestWishlist(env, clientId, form);

  // Portal self-signup: if the buyer chose a password (and gave an email), turn
  // on their portal login immediately. Never overwrites an existing account.
  let portal = false;
  const selfPw = String(form.get("portal_password") || "");
  if (selfPw && email) portal = await enablePortalSelfSignup(env, clientId, selfPw);

  // Fix 7: a human-readable reference, stable per client.
  const ref = `JDM-${new Date().getFullYear()}-${String(clientId).padStart(5, "0")}`;

  const req = {
    portal,
    name: g("name") || "-", email, whatsapp, state: g("state"),
    label: g("label"), marka_name: g("marka_name"), model_name: g("model_name"),
    year_min: g("year_min"), year_max: g("year_max"), price_max: g("price_max"),
    mileage_max: g("mileage_max"), rate_min: g("rate_min"), kuzov: g("kuzov"), grade_kw: g("grade_kw"),
  };
  return { ok: true, req, ref, clientId };
}

// Upsert a public (staff-scoped) client by email so repeat submissions update
// one record instead of creating duplicates (Fix 6). Agent-owned and dealer
// clients are never touched. With no email there's nothing to match on, so a
// fresh client is inserted.
async function upsertPublicClient(env, form, email, whatsapp) {
  const name = String(form.get("name") || "").trim() || "Website enquiry";
  const state = normalizeState(form.get("state"));
  if (email) {
    const existing = await env.DB.prepare(
      "SELECT id FROM clients WHERE agent_id IS NULL AND dealer_username IS NULL AND lower(email) = ? LIMIT 1"
    ).bind(email).first();
    if (existing) {
      // Backfill newly-supplied contact details without clobbering existing ones.
      await env.DB.prepare(
        `UPDATE clients SET name = ?,
            whatsapp = COALESCE(NULLIF(?, ''), whatsapp),
            state = COALESCE(NULLIF(?, ''), state)
          WHERE id = ?`
      ).bind(name, whatsapp || "", state || "", existing.id).run();
      return existing.id;
    }
  }
  const r = await env.DB.prepare(
    "INSERT INTO clients (name, email, whatsapp, state) VALUES (?, ?, ?, ?)"
  ).bind(name, email || null, whatsapp || null, state).run();
  return r.meta?.last_row_id;
}

// Always-create wishlist for the public request path (Fix 2). A request with no
// make/model/chassis/keyword is still saved, flagged needs_detail so staff can
// follow up; the matcher skips it until a narrowing term is added. Fix 6: skip
// an obvious duplicate (same maker + model) for the same client.
async function createRequestWishlist(env, clientId, form) {
  if (!clientId) return;
  const marka = str(form, "marka_name");
  const model = str(form, "model_name");
  const kuzov = str(form, "kuzov");
  const gradeKw = str(form, "grade_kw");
  const needsDetail = !(marka || model || kuzov || gradeKw) ? 1 : 0;

  const dupe = await env.DB.prepare(
    `SELECT id FROM wishlists
       WHERE client_id = ?
         AND lower(COALESCE(marka_name,'')) = lower(?)
         AND lower(COALESCE(model_name,'')) = lower(?)
         AND COALESCE(needs_detail,0) = ?
       LIMIT 1`
  ).bind(clientId, marka || "", model || "", needsDetail).first();
  if (dupe) return;

  // Fix 4 (server side): clamp the numbers the client checks are advisory only.
  let yMin = num(form, "year_min"), yMax = num(form, "year_max");
  if (yMin !== null && yMax !== null && yMin > yMax) { const t = yMin; yMin = yMax; yMax = t; }
  const priceMax = clampMin(num(form, "price_max"), 0);
  const mileageMax = clampMin(num(form, "mileage_max"), 0);
  const rateMin = clampRange(num(form, "rate_min"), 1, 6);

  await env.DB.prepare(
    `INSERT INTO wishlists
      (client_id, label, marka_name, model_name, year_min, year_max, price_max, mileage_max, rate_min, kuzov, grade_kw, watch_only, needs_detail)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
  ).bind(
    clientId, str(form, "label"), marka, model,
    yMin, yMax, priceMax, mileageMax, rateMin, kuzov, gradeKw, needsDetail
  ).run();
}

const clampMin = (v, min) => (v === null ? null : Math.max(min, v));
const clampRange = (v, lo, hi) => (v === null ? null : Math.min(hi, Math.max(lo, v)));

// Self-signup: turn on a client's portal login from the public request form.
// Never overwrites an existing password (prevents account takeover by re-using
// someone else's email). Returns true only if a fresh login was created.
async function enablePortalSelfSignup(env, clientId, password) {
  if (!clientId || typeof password !== "string" || password.length < 6) return false;
  const c = await env.DB.prepare("SELECT pass_hash FROM clients WHERE id = ?").bind(clientId).first();
  if (!c || c.pass_hash) return false; // missing, or already has a password
  const { salt, hash } = await hashPassword(password);
  await env.DB.prepare(
    "UPDATE clients SET portal_enabled = 1, pass_salt = ?, pass_hash = ?, invite_token = NULL, invite_exp = NULL WHERE id = ?"
  ).bind(salt, hash, clientId).run();
  return true;
}

// ===========================================================================
// CLIENT PORTAL (buyer self-service: see their cars, edit their searches, ask
// us to action a car). All data is strictly scoped to session.id (the client).
// ===========================================================================
const PORTAL_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function portalSidebar(c) {
  return `<aside class="side">
    <div class="brand">${LOGO}</div>
    <nav class="nav"><a class="active" href="/portal"><span class="bar"></span><span class="lbl">Your garage</span></a></nav>
    <div class="side-foot">
      <div class="whoami"><span class="who-name">${esc(c?.name || "You")}</span><span class="who-role">Client</span></div>
      <a class="signout" href="/logout">Sign out</a>
    </div>
  </aside>`;
}

// One car the buyer sees in their portal. opts.stripe shows a "Pay deposit"
// button; opts.depositLabel is the formatted amount.
function clientCarCard(q, opts = {}) {
  let lot = {}; try { lot = JSON.parse(q.lot_json); } catch (e) {}
  const img = imageUrls(lot).medium;
  const title = `${esc(lot.year || "")} ${esc(displayName(lot.marka_name))} ${esc(displayName(lot.model_name))}`.trim();
  const requested = !!q.client_request;
  const bid = Number(lot.start) > 0 ? yen(lot.start) : yen(lot.avg_price);
  const chips = whyChips(q);
  const landed = q._landed ? `A$${Number(q._landed.grandTotal).toLocaleString("en-AU")}` : null;
  const payBtn = (opts.stripe && requested)
    ? `<form method="POST" action="/portal/pay" style="display:inline"><input type="hidden" name="queue_id" value="${q.id}"><button class="btn-dark" type="submit">Pay ${esc(opts.depositLabel)} deposit</button></form>`
    : "";
  const action = requested
    ? `<span class="reqbadge">&#10003; Requested - we're on it</span>`
    : `<form method="POST" action="/portal/approve" style="display:inline"><input type="hidden" name="queue_id" value="${q.id}"><button class="btn-notify" type="submit">Ask us to get this</button></form>`;
  return `<div class="mcard">
    <div class="mphoto" style="${img ? `background-image:url('${esc(img)}')` : ""}">
      <div class="grad"></div>
      <span class="pill lot">Lot ${esc(lot.lot || "-")}</span>
      <div class="ttl"><div class="t">${title}</div><div class="a">${esc(lot.auction || "")}${lot.auction_date ? " · " + esc((lot.auction_date || "").slice(0, 10)) : ""}</div></div>
    </div>
    <div class="mstats">
      <div class="s"><div class="k">Year</div><div class="v">${esc(lot.year || "-")}</div></div>
      <div class="s gold"><div class="k">Grade</div><div class="v">${esc(displayGrade(lot.rate))}</div></div>
      <div class="s"><div class="k">Odometer</div><div class="v">${lot.mileage ? Math.round(Number(lot.mileage) / 1000) + "k" : "-"}</div></div>
      <div class="s gold"><div class="k">Auction est.</div><div class="v">${bid}</div></div>
    </div>
    ${chips.length ? `<div class="why">${chips.map((cc) => `<span class="wc">${cc}</span>`).join("")}</div>` : ""}
    ${landed ? `<div class="mland"><span class="ml-k">Indicative landed · ${esc(q._landed.state)}</span><span class="ml-v">${landed}</span></div>` : ""}
    <div class="mfoot">
      <div class="who" style="flex:1"><div class="w">${esc(q.wlabel || "Your search")}</div></div>
      ${payBtn}${action}
    </div>
  </div>`;
}

// Compact card for the admin client page: a car the buyer requested (read-only).
function requestedCard(q) {
  let lot = {}; try { lot = JSON.parse(q.lot_json); } catch (e) {}
  const img = imageUrls(lot).medium;
  const title = `${esc(lot.year || "")} ${esc(displayName(lot.marka_name))} ${esc(displayName(lot.model_name))}`.trim();
  const when = q.client_request_at ? esc(String(q.client_request_at).slice(0, 10)) : "-";
  return `<div class="mcard">
    <div class="mphoto" style="${img ? `background-image:url('${esc(img)}')` : ""}">
      <div class="grad"></div>
      <span class="pill lot">Lot ${esc(lot.lot || "-")}</span>
      <div class="ttl"><div class="t">${title}</div><div class="a">${esc(lot.auction || "")}</div></div>
    </div>
    <div class="mstats">
      <div class="s gold"><div class="k">Grade</div><div class="v">${esc(displayGrade(lot.rate))}</div></div>
      <div class="s"><div class="k">Auction est.</div><div class="v">${Number(lot.start) > 0 ? yen(lot.start) : yen(lot.avg_price)}</div></div>
      <div class="s"><div class="k">Chassis</div><div class="v">${esc(lot.kuzov || "-")}</div></div>
      <div class="s"><div class="k">Requested</div><div class="v">${when}</div></div>
    </div>
    <div class="mfoot"><span class="reqbadge">&#10003; Client wants this</span></div>
  </div>`;
}

// The buyer portal dashboard. opts.flash shows a one-line confirmation banner.
export async function portalPage(env, session, opts = {}) {
  const cid = Number(session.id);
  const c = await env.DB.prepare("SELECT * FROM clients WHERE id = ? AND portal_enabled = 1").bind(cid).first();
  if (!c) {
    return brandShell(portalSidebar(null),
      `<div class="topbar"><div><div class="kicker">Buyer portal</div><h1>Access ended</h1></div><a class="btn-dark" href="/logout">Sign out</a></div>
       <div class="content"><div class="card"><div class="empty">Your portal access isn't active right now. Please contact JDM Connect.</div></div></div>`,
      "Portal - JDM Connect");
  }
  await expirePast(env);

  const wls = (await env.DB.prepare("SELECT * FROM wishlists WHERE client_id = ? ORDER BY id").bind(cid).all()).results || [];
  const cars = (await env.DB.prepare(
    `SELECT q.*, w.label AS wlabel, w.rate_min AS w_rate, w.price_max AS w_price, w.kuzov AS w_kuzov, w.grade_kw AS w_kw
       FROM queue q LEFT JOIN wishlists w ON w.id = q.wishlist_id
      WHERE q.client_id = ? AND q.status = 'sent' AND COALESCE(w.watch_only, 0) = 0
      ORDER BY q.client_request DESC, q.decided_at DESC LIMIT 60`
  ).bind(cid).all()).results || [];

  const settings = await getSettings(env);
  // Respect the "show landed cost to clients" toggle in the portal too.
  if (settingOn(settings, "client_landed")) {
    for (const q of cars) { try { const lot = JSON.parse(q.lot_json); if (lot._landed) q._landed = lot._landed; } catch (e) {} }
  }
  const depositAud = Number(settings.stripe_deposit_aud || 0);
  const stripeOn = settingOn(settings, "stripe_enabled") && !!env.STRIPE_SECRET_KEY && depositAud > 0;
  const cardOpts = { stripe: stripeOn, depositLabel: `A$${depositAud.toLocaleString("en-AU")}` };
  const makers = await distinctMakers(env);
  const yMax = new Date().getFullYear() + 1;

  const carsBody = cars.length
    ? `<div class="mgrid">${cars.map((q) => clientCarCard(q, cardOpts)).join("")}</div>`
    : `<div class="empty"><div class="rule"></div>No cars yet. As soon as we find and review a match for your search, it'll appear here.</div>`;

  const wlBody = wls.length
    ? wls.map((w) => wishlistEditor(w, { base: "/portal", portal: true })).join("")
    : `<div class="empty">You don't have any searches yet - add one below.</div>`;

  const addForm = `<div class="card">
    <h2><span class="num">+</span> Add a search</h2>
    <form method="POST" action="/portal/wishlist">
      ${presetSelect()}
      <div class="grid">
        <div><label>LABEL <span class="opt">(your reference)</span></label><input name="label" placeholder="e.g. weekend project"></div>
        <div><label>MAKE</label>${makerField(makers, "pl-maker")}</div>
        <div><label>MODEL <span class="opt">(pick or type)</span></label>${modelField("pl-models")}</div>
        <div><label>YEAR FROM</label><input name="year_min" type="number" min="1960" max="${yMax}" placeholder="1990"></div>
        <div><label>YEAR TO</label><input name="year_max" type="number" min="1960" max="${yMax}" placeholder="2002"></div>
        <div><label>MAX BUDGET (JPY)</label><input name="price_max" type="number" min="0" step="10000" placeholder="3,000,000"></div>
        <div><label>MAX MILEAGE (KM)</label><input name="mileage_max" type="number" min="0" step="1000" placeholder="100,000"></div>
        <div><label>MIN GRADE</label><input name="rate_min" type="number" min="1" max="6" step="0.5" placeholder="e.g. 4"></div>
        <div><label>CHASSIS CODE <span class="opt">(if known)</span></label><input name="kuzov" placeholder="e.g. JZA80"></div>
      </div>
      <div class="actions"><button class="btn-gold" type="submit">Add search</button>
        <span class="help">Add at least a make, model or chassis code so we know what to look for.</span></div>
    </form>${modelScript("pl-maker", "pl-models")}${presetScript()}
  </div>`;

  const flash = opts.flash ? `<div class="banner"><span class="txt">${esc(opts.flash)}</span></div>` : "";
  const main = `
    <div class="topbar">
      <div>
        <div class="kicker">Your garage</div>
        <h1>Welcome${c.name ? ", " + esc(String(c.name).trim().split(/\s+/)[0]) : ""}</h1>
        <p class="subline">The cars we've found for you, and the searches we're running.</p>
      </div>
      <a class="btn-dark" href="/logout">Sign out</a>
    </div>
    <div class="content">
      ${flash}
      <div class="psec"><h2>Cars we've found for you</h2><p class="psub">Hand-reviewed by our team and matched to your search. Tap “Ask us to get this” and we'll pull the auction sheet, translate it, and come back to you${stripeOn ? " with next steps" : ""}.</p></div>
      ${carsBody}
      <div class="psec" style="margin-top:34px"><h2>What you're searching for</h2><p class="psub">Edit a search or add another - changes apply on the next auction sweep.</p></div>
      ${wlBody}
      ${addForm}
    </div>`;
  return brandShell(portalSidebar(c), main, "Your garage - JDM Connect");
}

// --- Portal handlers (every one scoped to the signed-in client's own id) -----
async function portalWishlistOwned(env, id, cid) {
  const w = await env.DB.prepare("SELECT * FROM wishlists WHERE id = ?").bind(Number(id)).first();
  return w && Number(w.client_id) === Number(cid) ? w : null;
}

// True only while this client still exists and has portal access. Re-checked on
// every write so a revoked client (or a stale tab) can't keep making changes.
async function portalClientActive(env, cid) {
  const c = await env.DB.prepare("SELECT 1 FROM clients WHERE id = ? AND portal_enabled = 1").bind(Number(cid)).first();
  return !!c;
}

export async function portalAddWishlist(env, form, session) {
  const cid = Number(session.id);
  if (!cid || !(await portalClientActive(env, cid))) return;
  const marka = str(form, "marka_name"), model = str(form, "model_name");
  const kuzov = str(form, "kuzov"), gradeKw = str(form, "grade_kw");
  if (!(marka || model || kuzov || gradeKw)) return; // need something to search on
  let yMin = num(form, "year_min"), yMax = num(form, "year_max");
  if (yMin !== null && yMax !== null && yMin > yMax) { const t = yMin; yMin = yMax; yMax = t; }
  await env.DB.prepare(
    `INSERT INTO wishlists (client_id, label, marka_name, model_name, year_min, year_max, price_max, mileage_max, rate_min, kuzov, grade_kw, watch_only, needs_detail)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`
  ).bind(
    cid, str(form, "label"), marka, model, yMin, yMax,
    clampMin(num(form, "price_max"), 0), clampMin(num(form, "mileage_max"), 0), clampRange(num(form, "rate_min"), 1, 6),
    kuzov, gradeKw
  ).run();
}

export async function portalEditWishlist(env, form, session) {
  const cid = Number(session.id);
  if (!(await portalClientActive(env, cid))) return;
  const w = await portalWishlistOwned(env, form.get("id"), cid);
  if (!w) return;
  let yMin = num(form, "year_min"), yMax = num(form, "year_max");
  if (yMin !== null && yMax !== null && yMin > yMax) { const t = yMin; yMin = yMax; yMax = t; }
  await env.DB.prepare(
    `UPDATE wishlists SET label = ?, marka_name = ?, model_name = ?, year_min = ?, year_max = ?,
       price_max = ?, mileage_max = ?, rate_min = ?, kuzov = ?, grade_kw = ? WHERE id = ? AND client_id = ?`
  ).bind(
    str(form, "label"), str(form, "marka_name"), str(form, "model_name"), yMin, yMax,
    clampMin(num(form, "price_max"), 0), clampMin(num(form, "mileage_max"), 0), clampRange(num(form, "rate_min"), 1, 6),
    str(form, "kuzov"), str(form, "grade_kw"), w.id, cid
  ).run();
}

export async function portalToggleWishlist(env, form, session) {
  const cid = Number(session.id);
  if (!(await portalClientActive(env, cid))) return;
  const w = await portalWishlistOwned(env, form.get("id"), cid);
  if (!w) return;
  await env.DB.prepare("UPDATE wishlists SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END WHERE id = ? AND client_id = ?").bind(w.id, cid).run();
}

export async function portalDeleteWishlist(env, form, session) {
  const cid = Number(session.id);
  if (!(await portalClientActive(env, cid))) return;
  const w = await portalWishlistOwned(env, form.get("id"), cid);
  if (!w) return;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM queue WHERE wishlist_id = ? AND client_id = ?").bind(w.id, cid),
    env.DB.prepare("DELETE FROM seen_lots WHERE wishlist_id = ?").bind(w.id),
    env.DB.prepare("DELETE FROM wishlists WHERE id = ? AND client_id = ?").bind(w.id, cid),
  ]);
}

// Buyer asks us to action/translate a car. Marks it and returns the context so
// the route can email staff. Idempotent: alreadyDone=true means no new request.
export async function portalApprove(env, queueId, session) {
  const cid = Number(session.id);
  const qid = Number(queueId);
  if (!qid || !(await portalClientActive(env, cid))) return { ok: false };
  const item = await env.DB.prepare("SELECT * FROM queue WHERE id = ? AND client_id = ?").bind(qid, cid).first();
  if (!item || item.status !== "sent") return { ok: false };
  const alreadyDone = !!item.client_request;
  if (!alreadyDone) {
    await env.DB.prepare("UPDATE queue SET client_request = 1, client_request_at = datetime('now') WHERE id = ? AND client_id = ?").bind(qid, cid).run();
  }
  const client = await env.DB.prepare("SELECT * FROM clients WHERE id = ?").bind(cid).first();
  let lot = {}; try { lot = JSON.parse(item.lot_json); } catch (e) {}
  // Pin the wishlist to this client too, so a stale/cross wishlist_id can never
  // pull another client's search into the staff alert.
  const wishlist = await env.DB.prepare("SELECT * FROM wishlists WHERE id = ? AND client_id = ?").bind(item.wishlist_id, cid).first();
  return { ok: true, alreadyDone, client, lot, wishlist, queueId: qid };
}

// --- Staff: enable / revoke a client's portal access (owner or admin) --------
export async function inviteClientPortal(env, clientId, session) {
  const cid = Number(clientId);
  if (!Number.isInteger(cid) || cid <= 0) return { ok: false };
  if (!(await clientOwnedBy(env, cid, session))) return { ok: false };
  const c = await env.DB.prepare("SELECT id, name, email FROM clients WHERE id = ?").bind(cid).first();
  if (!c || !c.email) return { ok: false, error: "no-email" };
  const token = randomToken();
  const exp = Date.now() + PORTAL_INVITE_TTL_MS;
  await env.DB.prepare("UPDATE clients SET portal_enabled = 1, invite_token = ?, invite_exp = ? WHERE id = ?").bind(token, exp, cid).run();
  return { ok: true, token, email: c.email, name: c.name };
}

export async function revokeClientPortal(env, clientId, session) {
  const cid = Number(clientId);
  if (!Number.isInteger(cid) || cid <= 0) return;
  if (!(await clientOwnedBy(env, cid, session))) return;
  await env.DB.prepare(
    "UPDATE clients SET portal_enabled = 0, pass_salt = NULL, pass_hash = NULL, invite_token = NULL, invite_exp = NULL WHERE id = ?"
  ).bind(cid).run();
}
