// JDM Connect - Vehicle Finder staff app (hi-fi redesign) + public request page.
// Light theme, gold single accent, Inter, hairline borders (per design handoff).

import { esc, yen, km, displayGrade } from "./render.js";
import { imageUrls, splitImages, distinctMakers, refreshLotImages } from "./avtonet.js";
import { attachLanded, auStates, normalizeState, getLiveFx } from "./calc.js";
import { marketIntel, marketPanel } from "./market.js";
import { hashPassword, randomToken, makeShareToken } from "./auth.js";
import { getSettings, settingOn } from "./settings.js";
import { brandDoc, brandShell, risingSun } from "./theme.js";
import { SHEET_MODELS, DEFAULT_SHEET_MODEL, SHEET_AUTO_MODES } from "./sheet.js";

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
  return `<div style="margin-bottom:14px;max-width:430px"><label>Quick preset <span class="opt">(auto-fills the fields for a known model)</span></label>
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
  /* Inter is loaded via preconnected <link> tags in the document head (see shell()),
     so it no longer render-blocks behind this stylesheet's @import. */
  :root{--gold:#CAA34C;--gold-hover:#D9B45F;--gold-txt:#E6C879;--gold-tint:rgba(202,163,76,0.14);--gold-line:rgba(202,163,76,0.34);--gold-on:#15120A;--avatar:rgba(202,163,76,0.16);
    --ink:#F4F2EC;--t2:#C9CCD1;--t3:#9BA0A7;--faint:#888D95;--bg:#0F1115;--bg-2:#0A0C0F;--card:#171A20;--card-2:#1C2027;--off:#13161B;--hair:rgba(255,255,255,0.08);--hair-2:rgba(255,255,255,0.05);
    --field:#1B1F26;--field-line:rgba(255,255,255,0.14);--field-focus:#20242C;--hover:rgba(255,255,255,0.05);--soft:rgba(255,255,255,0.06);--bad:#E2607A;--bad-bg:rgba(226,96,122,0.12);--bad-line:rgba(226,96,122,0.34);
    --ok-bg:rgba(91,192,140,0.14);--ok-fg:#7FD3A6;--warn-bg:rgba(224,169,75,0.16);--warn-fg:#E9BE6B;--neu-bg:rgba(255,255,255,0.06);--neu-fg:#C9CCD1;
    --str-bg:rgba(91,192,140,0.14);--str-fg:#7FD3A6;--good-bg:rgba(224,169,75,0.16);--good-fg:#E9BE6B;--pos-bg:rgba(255,255,255,0.06);--pos-fg:#AEB3BA;
    --elig-bg:rgba(91,192,140,0.14);--elig-fg:#7FD3A6;--echk-bg:rgba(224,169,75,0.16);--echk-fg:#E9BE6B;--eno-bg:rgba(226,96,122,0.13);--eno-fg:#E2607A;
    --r:8px;--r-card:12px;}
  /* Light workspace: the sidebar (.side) keeps the dark brand from :root, while
     the main content area runs a light palette. Only tokens that differ from the
     dark root are overridden here; gold and radii are shared. */
  .main{
    color:var(--ink);
    --ink:#1b1c1e;--t2:#5b606a;--t3:#6b7079;--faint:#656a73;
    --bg:#f4f4f1;--bg-2:#ffffff;--card:#ffffff;--card-2:#ffffff;--off:#f7f7f5;
    --hair:rgba(0,0,0,0.10);--hair-2:rgba(0,0,0,0.06);
    --field:#fbfbfc;--field-line:rgba(0,0,0,0.14);--field-focus:#ffffff;
    --hover:rgba(0,0,0,0.04);--soft:#f1f0ec;
    --gold-txt:#7A5E1C;--avatar:#F0E9D7;
    --bad:#B11226;--bad-bg:rgba(177,18,38,0.06);--bad-line:rgba(177,18,38,0.3);
    --ok-bg:#E1F5EE;--ok-fg:#04342C;--warn-bg:#FAEEDA;--warn-fg:#633806;--neu-bg:#F1EFE8;--neu-fg:#444441;
    --str-bg:#EAF3DE;--str-fg:#27500A;--good-bg:#FAEEDA;--good-fg:#633806;--pos-bg:#F1EFE8;--pos-fg:#444441;
    --elig-bg:#E1F5EE;--elig-fg:#04342C;--echk-bg:#FAEEDA;--echk-fg:#633806;--eno-bg:#FCEBEB;--eno-fg:#501313;
  }
  *{box-sizing:border-box}
  body{margin:0;font-family:${FONT};color:var(--ink);background:var(--bg);font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased}
  a{color:inherit;text-decoration:none}
  .wrap{display:flex;min-height:100vh}
  .side{width:256px;flex:0 0 256px;border-right:1px solid var(--hair);display:flex;flex-direction:column;padding:26px 20px;background:var(--bg-2);position:sticky;top:0;align-self:flex-start;height:100vh;overflow-y:auto}
  .side .brand{padding:4px 6px 20px;margin-bottom:18px;border-bottom:1px solid var(--hair)}
  .brand svg path,.brand svg polygon,.login-logo svg path,.login-logo svg polygon{fill:var(--ink)}
  .nav{margin-top:0;display:flex;flex-direction:column;gap:2px}
  .nav a{display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:6px;font-size:15px;color:var(--t2)}
  .nav a .bar{width:3px;height:17px;border-radius:2px;background:transparent}
  .nav a .lbl{flex:1}
  .nav a .ct{font-size:13px;color:var(--faint);font-weight:500}
  .nav a.active{background:var(--gold-tint);color:var(--ink);font-weight:600}
  .nav a.active .bar{background:var(--gold)}
  .nav a.active .ct{color:var(--gold-txt)}
  .nav a:hover:not(.active){background:var(--hover)}
  .side-foot{margin-top:auto;display:flex;flex-direction:column;gap:16px;padding-top:20px}
  .btn-search{display:flex;align-items:center;justify-content:center;gap:9px;background:var(--gold);color:var(--gold-on);font-weight:600;padding:13px;border-radius:8px;font-size:15px}
  .btn-search:hover{background:var(--gold-hover)}
  .btn-search .dot{width:7px;height:7px;border-radius:9999px;background:var(--gold-on);display:inline-block}
  .main{flex:1;background:var(--bg);display:flex;flex-direction:column}
  .topbar{position:sticky;top:0;z-index:5;background:var(--bg-2);padding:30px 40px 26px;display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid var(--hair)}
  .topbar.unstick{position:static}
  .kicker{display:flex;align-items:center;gap:10px;color:var(--gold-txt);font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase}
  .kicker:before{content:"";width:24px;height:1px;background:var(--gold);display:inline-block}
  h1{font-size:33px;font-weight:600;letter-spacing:-0.015em;margin:12px 0 6px;line-height:1.05}
  .subline{color:var(--t3);font-size:15px;margin:0}
  .btn-dark{background:var(--soft);color:var(--ink);border:1px solid var(--hair);font-weight:600;padding:12px 20px;border-radius:6px;font-size:14px;white-space:nowrap}
  .btn-dark:hover{background:var(--hover)}
  .content{padding:32px 40px 60px;max-width:1180px}
  .content.wide,.topbar.wide{width:100%;max-width:1640px;margin-left:auto;margin-right:auto}
  .card{background:var(--card);border:1px solid var(--hair);border-radius:8px;padding:24px 26px;margin-bottom:24px}
  .card>h2{font-size:16px;font-weight:600;margin:0 0 20px;display:flex;align-items:center;gap:11px;border-bottom:1px solid var(--hair);padding-bottom:16px}
  .card>h2 .num{color:var(--gold);font-weight:700}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px 22px}
  label{display:block;font-size:12px;color:var(--t2);margin-bottom:7px;font-weight:600;letter-spacing:0.02em}
  label .opt{color:var(--faint);font-weight:400;text-transform:none;letter-spacing:0}
  input,select{width:100%;padding:11px 13px;border:1px solid var(--field-line);border-radius:5px;font-size:14px;background:var(--field);color:var(--ink);font-family:${FONT}}
  input::placeholder{color:#8A909A}
  input:focus,select:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 3px var(--gold-tint);background:var(--field-focus)}
  select{appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236F7378' stroke-width='1.6' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 13px center;padding-right:34px}
  .actions{display:flex;align-items:center;gap:14px;margin-top:22px}
  .btn-gold{background:var(--gold);color:var(--gold-on);font-weight:600;border:0;padding:11px 22px;border-radius:8px;font-size:14px;cursor:pointer;font-family:${FONT}}
  .btn-gold:hover{background:var(--gold-hover)}
  .btn-gold:focus-visible,.btn-dark:focus-visible,.btn-toggle:focus-visible,.btn-link:focus-visible,.kebab:focus-visible,.nav a:focus-visible,.fchip:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
  .help{color:var(--faint);font-size:13px}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th{text-align:left;padding:12px 10px;background:var(--off);color:var(--t3);font-weight:600;font-size:12px;letter-spacing:.01em;border-bottom:1px solid var(--hair)}
  td{padding:15px 10px;border-bottom:1px solid var(--hair-2);color:var(--t2)}
  .avatar{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;background:var(--avatar);color:var(--gold-txt);font-size:11px;font-weight:600;vertical-align:middle;margin-right:10px}
  .yes{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:9999px;background:var(--gold-tint);color:var(--gold-txt);font-size:12px}
  .btn-del{background:transparent;border:1px solid var(--bad-line);color:var(--bad);font-size:12px;font-weight:600;padding:7px 12px;border-radius:5px;cursor:pointer;font-family:${FONT}}
  .btn-del:hover{background:var(--bad-bg)}
  .btn-toggle{border:1px solid var(--hair);font-size:12px;font-weight:600;padding:7px 14px;border-radius:9999px;cursor:pointer;background:transparent;color:var(--t2);font-family:${FONT}}
  .btn-toggle.on{background:var(--gold-tint);border-color:var(--gold);color:var(--gold-txt)}
  .btn-toggle.off{background:var(--soft);color:var(--t3)}
  .btn-toggle:hover{filter:brightness(0.98)}
  .btn-link{background:transparent;border:0;color:var(--gold-txt);font-size:12px;font-weight:600;padding:7px 8px;cursor:pointer;font-family:${FONT}}
  .btn-link:hover{text-decoration:underline}
  .chip{display:inline-block;background:var(--gold-tint);border:1px solid rgba(202,163,76,0.35);color:var(--gold-txt);font-size:11px;font-weight:600;padding:4px 9px;border-radius:9999px;font-family:${FONT}}
  button.chip{cursor:pointer}
  button.chip:hover{background:var(--bad-bg);border-color:var(--bad-line);color:var(--bad)}
  .chip.muted{background:var(--soft);border-color:var(--hair);color:var(--t3)}
  .share-pick{font-size:12px;padding:5px 8px;border:1px solid var(--hair);border-radius:6px;background:var(--field);color:var(--t2);cursor:pointer;font-family:${FONT}}
  .bulkbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:var(--card);border:1px solid var(--hair);border-radius:10px;padding:12px 14px;margin-bottom:14px}
  .bulk-label{font-size:13px;font-weight:600;color:var(--t2)}
  .toggles{margin-top:22px;display:flex;flex-direction:column;gap:8px}
  .toggle{display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border:1px solid var(--hair);border-radius:8px;cursor:pointer}
  .toggle:hover{background:var(--hover)}
  .toggle input{width:18px;height:18px;padding:0;margin:2px 0 0;accent-color:var(--gold);cursor:pointer;flex:0 0 auto}
  .toggle .tg-txt{display:flex;flex-direction:column;gap:2px}
  .toggle .tg-title{font-size:14px;font-weight:600;color:var(--ink)}
  .toggle .tg-desc{font-size:12px;color:var(--t3);line-height:1.4}
  .banner{display:flex;align-items:center;gap:12px;margin-bottom:24px;padding:16px 22px;background:var(--card);border:1px solid var(--hair);border-left:3px solid var(--gold);border-radius:6px}
  .banner .reddot{width:6px;height:6px;border-radius:9999px;background:var(--bad);display:inline-block}
  .banner .txt{font-size:14px;color:var(--t2)}
  .mgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:22px}
  .mcard{background:var(--card);border:1px solid var(--hair);border-radius:8px;overflow:hidden;display:flex;flex-direction:column;content-visibility:auto;contain-intrinsic-size:auto 430px}
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
  .mland{display:flex;align-items:center;justify-content:space-between;padding:11px 16px;background:var(--gold-tint);border-top:1px solid var(--hair)}
  .mland .ml-k{font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:var(--gold-txt)}
  .mland .ml-v{font-size:15px;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums}
  .mfoot{border-top:1px solid var(--hair);padding:14px 16px;display:flex;align-items:center;gap:10px}
  .mfoot .who{flex:1;min-width:0}
  .mfoot .who .n{font-size:13px;font-weight:600;color:var(--ink)}
  .mfoot .who .w{font-size:11px;color:var(--t3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .btn-notify{background:var(--gold);color:var(--gold-on);font-weight:600;font-size:13px;padding:9px 14px;border-radius:5px;white-space:nowrap}
  .btn-notify:hover{background:var(--gold-hover)}
  .btn-skip{color:var(--t3);font-size:13px;padding:9px 8px}
  .empty{color:var(--faint);padding:30px 0;text-align:center}
  .empty .rule{width:40px;height:1px;background:rgba(202,163,76,0.7);margin:0 auto 16px}
  .signout{display:block;text-align:center;color:var(--t3);font-size:13px;padding:10px;border-radius:6px}
  .signout:hover{background:var(--hover);color:var(--ink)}
  .whoami{display:flex;flex-direction:column;align-items:center;gap:1px;padding:2px 0}
  .whoami .who-name{font-size:13px;font-weight:600;color:var(--ink)}
  .whoami .who-role{font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--gold-txt)}
  .login-screen{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);padding:24px}
  .login-card{width:100%;max-width:380px;background:var(--card);border:1px solid var(--hair);border-radius:12px;padding:34px 32px 30px;box-shadow:0 18px 50px rgba(0,0,0,0.45)}
  .login-card .login-logo{display:flex;justify-content:center;padding-bottom:20px;margin-bottom:24px;border-bottom:1px solid var(--hair)}
  .login-card h1{font-size:21px;font-weight:600;margin:0 0 6px;text-align:center;letter-spacing:-0.01em}
  .login-card .login-sub{color:var(--t3);font-size:14px;text-align:center;margin:0 0 22px;line-height:1.45}
  .login-card label{margin-bottom:8px}
  .login-card .btn-gold{width:100%;margin-top:18px;padding:13px;font-size:15px;display:block}
  .login-err{background:var(--bad-bg);border:1px solid var(--bad-line);color:var(--bad);font-size:13px;padding:10px 12px;border-radius:6px;margin-bottom:16px;text-align:center}
  /* Public request: bold success receipt + inline error (Fix 1 / Fix 7) */
  .reqok{border:1px solid var(--gold);border-left:4px solid var(--gold);background:linear-gradient(180deg,var(--gold-tint),var(--card))}
  .reqok .reqok-badge{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--gold-txt)}
  .reqok .reqok-badge .tick{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:9999px;background:var(--gold);color:var(--gold-on);font-size:13px}
  .reqok .reqok-ref{margin-top:12px;font-size:15px;color:var(--ink)}
  .reqok .reqok-ref strong{font-weight:700;letter-spacing:.02em}
  .reqok p{margin:12px 0 0;color:var(--t2);font-size:14px;line-height:1.55}
  .reqerr{margin-bottom:18px;padding:13px 16px;background:var(--bad-bg);border:1px solid var(--bad-line);border-left:4px solid var(--bad);border-radius:6px;color:var(--bad);font-size:14px;line-height:1.45}
  .field-err{display:none;color:var(--bad);font-size:13px;line-height:1.45;margin-top:9px;font-weight:500}
  /* Client portal */
  .reqbadge{display:inline-flex;align-items:center;gap:6px;background:rgba(91,192,140,.13);border:1px solid rgba(91,192,140,.4);color:var(--str-fg);font-size:12.5px;font-weight:600;padding:8px 13px;border-radius:9999px}
  .paybadge{display:inline-flex;align-items:center;gap:6px;background:var(--gold-tint);border:1px solid rgba(202,163,76,.4);color:var(--gold-txt);font-size:11.5px;font-weight:600;padding:4px 9px;border-radius:9999px;margin-left:8px}
  .portal-acct{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  .portal-acct .pa-k{font-size:12px;color:var(--t3)}
  .pwrap{display:flex;gap:9px;align-items:center;flex-wrap:wrap}
  /* Mobile nav: off-canvas drawer toggled by a CSS checkbox (works without JS;
     a link click loads a new page, which resets the toggle). */
  .nav-cb{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
  .nav-burger{display:none}
  .nav-scrim{display:none}
  @media(max-width:920px){
    .wrap{flex-direction:column}
    .nav-burger{display:flex;align-items:center;gap:10px;position:sticky;top:0;z-index:50;height:52px;padding:0 16px;background:var(--bg-2);border-bottom:1px solid var(--hair);color:var(--ink);font-weight:600;font-size:14px;cursor:pointer;-webkit-tap-highlight-color:transparent}
    .nav-burger svg{width:22px;height:22px}
    .side{position:fixed;top:0;left:0;height:100dvh;width:min(82vw,300px);transform:translateX(-100%);transition:transform .28s cubic-bezier(.2,.7,.3,1);z-index:60;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.55);overflow-y:auto}
    .nav{flex-direction:column}
    .side-foot{flex-direction:column;margin-top:auto;padding-top:20px}
    .nav-cb:checked ~ .wrap .side{transform:none}
    .nav-scrim{display:block;position:fixed;inset:0;background:rgba(0,0,0,.55);opacity:0;visibility:hidden;transition:opacity .28s;z-index:55}
    .nav-cb:checked ~ .wrap .nav-scrim{opacity:1;visibility:visible}
    .topbar{top:52px}
    .mtools{top:52px}
  }
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
  .tstat{background:var(--card);border:1px solid var(--hair);border-radius:10px;padding:11px 15px;min-width:96px}
  .tstat .k{font-size:10.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--t3);display:flex;align-items:center;gap:6px}
  .tstat .v{font-size:22px;font-weight:700;margin-top:3px}
  .tstat .d{width:8px;height:8px;border-radius:9999px;display:inline-block}
  .tstat.urgent{border-color:var(--bad-line);background:var(--bad-bg)}
  .tstat.urgent .v{color:var(--bad)}
  .crow{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:11px}
  .msearch{position:relative;flex:1;min-width:200px;display:block;margin:0}
  .msearch input{width:100%;padding:10px 12px;border:1px solid var(--field-line);border-radius:7px;font-size:14px;background:var(--field);font-family:inherit;color:var(--ink)}
  .msearch input:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 3px rgba(202,163,76,.16)}
  select.mctl{padding:9px 11px;border:1px solid var(--field-line);border-radius:7px;font-size:13.5px;background:var(--field);color:var(--t2);cursor:pointer;font-family:inherit}
  .fchips{display:flex;gap:7px;flex-wrap:wrap;align-items:center}
  .fchip{border:1px solid var(--field-line);background:var(--field);color:var(--t2);font-size:12.5px;font-weight:600;padding:7px 13px;border-radius:9999px;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:7px}
  .fchip .sd{width:8px;height:8px;border-radius:9999px;display:inline-block}
  .fchip.on{background:var(--gold);color:var(--gold-on);border-color:var(--gold)}
  .fchip.on.urgent{background:#B11226;border-color:#B11226;color:#fff}
  .quick{margin-left:auto;display:flex;gap:7px;flex-wrap:wrap}
  .quick button{font-family:inherit;font-size:12px;font-weight:600;color:var(--gold-txt);background:var(--gold-tint);border:1px solid rgba(202,163,76,.35);border-radius:9999px;padding:6px 12px;cursor:pointer}
  .pausebar{display:flex;align-items:center;gap:10px;margin-bottom:16px;padding:12px 16px;background:var(--bad-bg);border:1px solid var(--bad-line);border-left:3px solid var(--bad);border-radius:6px;font-size:13.5px;color:var(--t2)}
  .bulkbar2{position:sticky;top:60px;z-index:6;display:none;align-items:center;gap:12px;background:#1C2027;color:#F4F2EC;border:1px solid var(--gold-line);border-radius:10px;padding:10px 15px;margin:0 0 16px}
  .bulkbar2.show{display:flex}
  .bulkbar2 .bc{font-weight:600;font-size:14px}.bulkbar2 .bsp{flex:1}
  .bulkbar2 button{font-family:inherit;font-weight:600;font-size:13px;border-radius:6px;padding:9px 14px;cursor:pointer;border:0}
  .bulkbar2 .bap{background:var(--gold);color:var(--gold-on)}
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
  .wledit summary:hover{background:var(--hover)}
  .wledit form{padding:4px 16px 18px}
  .slegend{background:var(--card);border:1px solid var(--hair);border-radius:10px;padding:11px 16px;margin-bottom:16px}
  .sl-row{display:flex;align-items:center;gap:16px;flex-wrap:wrap;font-size:12.5px;color:var(--t2)}
  .sl-t{font-size:10.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--faint)}
  .sl-item{display:inline-flex;align-items:center;gap:7px}
  .sl-item b{font-weight:600;color:var(--ink)}
  .sl-dot{width:9px;height:9px;border-radius:9999px;display:inline-block}
  .sl-more{margin-top:8px}
  .sl-more summary{cursor:pointer;color:var(--gold-txt);font-weight:600;font-size:12px;list-style:none}
  .sl-more summary::-webkit-details-marker{display:none}
  .sl-detail{margin-top:6px;color:var(--t3);line-height:1.5;font-size:12.5px;max-width:720px}
  /* --- Shared design system: dashboard + reusable components --- */
  .avatar.lg{width:38px;height:38px;font-size:13px;margin-right:0}
  .nav a svg{width:18px;height:18px;flex:0 0 auto;color:var(--t3)}
  .nav a:hover:not(.active) svg{color:var(--ink)}
  .nav a.active svg{color:var(--gold)}
  .dtop{display:flex;justify-content:flex-end;align-items:center;gap:18px;margin-bottom:14px}
  .dtop a{color:var(--t3);display:inline-flex}
  .dtop a:hover{color:var(--ink)}
  .dtop svg{width:20px;height:20px}
  .dkick{display:flex;align-items:center;gap:8px;color:var(--t2);font-size:12px;margin-bottom:12px}
  .dkick .live{width:8px;height:8px;border-radius:9999px;background:#2faf6a;animation:livepulse 1.8s ease-in-out infinite}
  @keyframes livepulse{0%,100%{opacity:1}50%{opacity:.4}}
  .greet{font-size:42px;font-weight:700;letter-spacing:-.02em;line-height:1.08;margin:0 0 26px;color:var(--ink)}
  .greet .nm{color:var(--gold-txt)}
  .ovwrap{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
  .ovwrap .ovlbl{font-size:13px;color:var(--t2)}
  .ovwrap a{display:inline-flex;align-items:center;gap:5px;font-size:13px;color:var(--gold-txt);font-weight:600}
  .ovwrap a svg{width:14px;height:14px}
  .overview{display:flex;flex-wrap:wrap;margin:0 0 32px}
  .ov{padding:0 26px;border-left:1px solid var(--hair)}
  .ov:first-child{padding-left:0;border-left:0}
  .ov .num{font-size:38px;font-weight:700;letter-spacing:-.02em;line-height:1;color:var(--ink);font-variant-numeric:tabular-nums}
  .ov.gold .num{color:var(--gold-txt)}
  .ov .cap{font-size:13px;color:var(--t2);margin-top:8px}
  .acards{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin:0 0 32px}
  .acard{background:var(--card);border:1px solid var(--hair);border-radius:var(--r-card);overflow:hidden}
  .acard .ah{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--gold-tint);color:var(--gold-txt);font-weight:600;font-size:14px}
  .acard .ah svg{width:18px;height:18px}
  .acard .ab{padding:15px 16px;font-size:14px;color:var(--t2);line-height:1.5}
  .acard .ab .big{font-weight:700;font-size:22px;color:var(--ink);font-variant-numeric:tabular-nums}
  .acard .ab .link{display:inline-flex;align-items:center;gap:5px;margin-top:11px;color:var(--gold-txt);font-weight:600;font-size:13px}
  .acard .ab .link svg{width:14px;height:14px}
  .charts{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin:0 0 32px}
  @media(max-width:620px){.charts{grid-template-columns:1fr}}
  .chart-card{background:var(--card);border:1px solid var(--hair);border-radius:var(--r-card);padding:18px 20px}
  .chart-h{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px}
  .chart-h .ct-t{font-size:13px;font-weight:600;color:var(--t2)}
  .chart-h .ct-s{font-size:12px;color:var(--faint);font-variant-numeric:tabular-nums}
  .bars-x{display:flex;justify-content:space-between;margin-top:7px;font-size:10.5px;color:var(--faint)}
  .donutwrap{display:flex;align-items:center;gap:24px}
  .donut{position:relative;width:120px;height:120px;flex:0 0 auto}
  .donut-mid{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .donut-mid .dm-n{font-size:27px;font-weight:700;color:var(--ink);line-height:1;font-variant-numeric:tabular-nums}
  .donut-mid .dm-k{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);margin-top:3px}
  .legend{display:flex;flex-direction:column;gap:10px;flex:1;min-width:0}
  .legend .lg{display:flex;align-items:center;gap:10px;font-size:13px}
  .legend .lg-d{width:9px;height:9px;border-radius:3px;flex:0 0 auto}
  .legend .lg-l{color:var(--t2);flex:1}
  .legend .lg-v{color:var(--ink);font-weight:700;font-variant-numeric:tabular-nums}
  .abars{display:flex;flex-direction:column;gap:12px}
  .abar{display:flex;align-items:center;gap:10px;font-size:13px}
  .abar-n{width:80px;color:var(--t2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:0 0 auto}
  .abar-t{flex:1;height:8px;background:var(--hair);border-radius:5px;overflow:hidden}
  .abar-f{display:block;height:100%;background:var(--gold);border-radius:5px}
  .abar-v{width:26px;text-align:right;color:var(--ink);font-weight:700;font-variant-numeric:tabular-nums;flex:0 0 auto}
  .ov .spark{display:block;width:100%;max-width:140px;height:30px;margin-top:12px;opacity:.9}
  .sec-h{display:flex;align-items:center;justify-content:space-between;margin:0 0 10px}
  .sec-h h2{font-size:17px;font-weight:600;margin:0}
  .sec-h h2 .ct{color:var(--faint);font-weight:400}
  .sec-h .btn-gold{display:inline-flex;align-items:center;gap:6px}
  .sec-h .btn-gold svg{width:15px;height:15px}
  .list{background:var(--card);border:1px solid var(--hair);border-radius:var(--r-card);overflow:hidden;margin-bottom:30px}
  .lrow{display:flex;align-items:center;gap:13px;padding:13px 16px;border-bottom:1px solid var(--hair)}
  .lrow:last-child{border-bottom:0}
  .lrow:hover{background:var(--hover)}
  .lrow .avatar{margin-right:0;width:38px;height:38px;font-size:13px;flex:0 0 auto}
  .lrow .who{flex:1;min-width:0}
  .lrow .who .nm{font-weight:500;color:var(--ink);font-size:14px}
  .lrow .who .nm small{color:var(--faint);font-weight:400}
  .lrow .who .sub{font-size:12.5px;color:var(--t3);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .lrow .meta{margin-left:auto;display:flex;align-items:center;gap:10px;flex:0 0 auto}
  .b{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:500;padding:3px 9px;border-radius:8px;white-space:nowrap}
  .b svg{width:12px;height:12px}
  .b .bd{width:6px;height:6px;border-radius:9999px;background:currentColor;display:inline-block}
  .b-ok{background:var(--ok-bg);color:var(--ok-fg)}
  .b-warn{background:var(--warn-bg);color:var(--warn-fg)}
  .b-neu{background:var(--neu-bg);color:var(--neu-fg)}
  .b-str{background:var(--str-bg);color:var(--str-fg)}
  .b-good{background:var(--good-bg);color:var(--good-fg)}
  .b-pos{background:var(--pos-bg);color:var(--pos-fg)}
  .b-elig{background:var(--elig-bg);color:var(--elig-fg)}
  .b-echk{background:var(--echk-bg);color:var(--echk-fg)}
  .b-eno{background:var(--eno-bg);color:var(--eno-fg)}
  .kebab{width:30px;height:30px;border-radius:8px;border:1px solid transparent;background:transparent;color:var(--faint);cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
  .kebab svg{width:18px;height:18px}
  .kebab:hover{background:var(--hover);color:var(--ink)}
  @media(max-width:640px){.greet{font-size:30px}.ov{padding:0 16px}.ov .num{font-size:30px}}
  /* Motion: hover lift + button press, compositor-friendly transforms only. */
  .acard,.chart-card,.mcard,.scard{transition:transform .16s ease,border-color .15s}
  .acard:hover,.chart-card:hover,.mcard:hover,.scard:hover{transform:translateY(-2px)}
  .btn-gold:active,.btn-notify:active,.btn-dark:active,.btn-search:active,.bap:active,.bsk:active,.sc-actions a:active{transform:translateY(1px) scale(.99)}
  @media(prefers-reduced-motion:reduce){*{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}}
  /* --- Matches redesign: divided ticker + spec-sheet cards --- */
  .mticker{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:var(--hair);border:1px solid var(--hair);border-radius:10px;overflow:hidden;margin-bottom:16px}
  @media(min-width:760px){.mticker{grid-template-columns:repeat(5,1fr)}}
  .mtk{background:var(--card);padding:15px 18px}
  .mtk.urgent{background:var(--bad-bg)}
  .mtk-k{font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--t3)}
  .mtk-row{display:flex;align-items:flex-end;justify-content:space-between;margin-top:12px}
  .mtk-n{font-size:34px;font-weight:700;line-height:1;color:var(--ink);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
  .mtk-n.gold{color:var(--gold-txt)}.mtk-n.str{color:var(--str-fg)}.mtk-n.bad{color:var(--bad)}
  .mtk-dot{width:8px;height:8px;border-radius:9999px;display:inline-block;margin-bottom:6px}
  .scards{display:grid;grid-template-columns:1fr;gap:16px}
  @media(min-width:1180px){.scards{grid-template-columns:1fr 1fr}}
  .scards .ghead{grid-column:1/-1}
  .scards .mempty{grid-column:1/-1}
  .scard{position:relative;display:flex;flex-direction:column;background:var(--card);border:1px solid var(--hair);border-radius:var(--r-card);overflow:hidden;transition:border-color .15s;content-visibility:auto;contain-intrinsic-size:auto 260px}
  @media(min-width:560px){.scard{flex-direction:row}}
  .scard:hover{border-color:var(--gold-line)}
  .scard.picked{border-color:var(--gold);box-shadow:0 0 0 2px var(--gold-tint)}
  .scard .msel{position:absolute;top:12px;right:12px;left:auto;z-index:4;width:20px;height:20px;accent-color:var(--gold);cursor:pointer;display:none}
  .scard:hover .msel,.scard.picked .msel{display:block}
  .sc-img{position:relative;flex:0 0 auto;height:200px;background:#15171a;background-size:cover;background-position:center}
  @media(min-width:560px){.sc-img{width:40%;height:auto;min-height:236px}}
  /* On the client page these cards live in a narrow 3-up grid, too tight for the
     row layout — keep them stacked so the Year/Grade/Odo/Bid strip never clips. */
  .mgrid .scard{flex-direction:column}
  .mgrid .scard .sc-img{width:auto;height:200px;min-height:0}
  .sc-grad{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.78),rgba(0,0,0,0) 58%)}
  .sc-tags{position:absolute;top:12px;left:12px;display:flex;flex-direction:column;gap:6px;align-items:flex-start}
  .sc-tags .b{box-shadow:0 1px 5px rgba(0,0,0,.3)}
  .sc-lot{background:rgba(0,0,0,.55);backdrop-filter:blur(3px);color:#fff;font-size:10.5px;font-weight:600;letter-spacing:.04em;padding:3px 8px;border-radius:5px}
  .sc-imgfoot{position:absolute;left:12px;right:12px;bottom:12px;z-index:1;display:flex;flex-direction:column;gap:4px;align-items:flex-start}
  .sc-when{font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#fff;background:rgba(255,255,255,.18);padding:3px 8px;border-radius:4px}
  .sc-when.urgent{background:#B11226}.sc-when.soon{background:#C9821f}
  .sc-auc{font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:#E6E7E8}
  .sc-body{flex:1;min-width:0;display:flex;flex-direction:column}
  .sc-main{flex:1;padding:18px}
  .sc-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px}
  .sc-id{min-width:0}
  .sc-title{font-size:19px;font-weight:700;letter-spacing:-.01em;text-transform:uppercase;margin:0;color:var(--ink);line-height:1.12}
  .sc-sub{font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--t3);margin:5px 0 0}
  .sc-landed{text-align:right;flex:0 0 auto}
  .sc-landed-k{font-size:9.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--t3)}
  .sc-landed-v{font-size:18px;font-weight:700;color:var(--gold-txt);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;margin-top:2px}
  .sc-grid{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--hair);border-radius:8px;overflow:hidden;margin-bottom:14px}
  .sc-cell{padding:10px 8px;text-align:center;border-left:1px solid var(--hair)}
  .sc-cell:first-child{border-left:0}
  .sc-k{font-size:9px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--t3);margin-bottom:5px}
  .sc-v{font-size:14px;font-weight:700;color:var(--ink);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
  .sc-v.gold{color:var(--gold-txt)}
  .scard .why{padding:0;margin:0 0 12px}
  .scard .nocontact{margin:0 0 12px}
  .sc-client{display:flex;align-items:center;gap:11px;padding:10px 12px;background:var(--off);border:1px solid var(--hair);border-left:3px solid var(--gold);border-radius:8px}
  .sc-client .avatar{margin-right:0;width:34px;height:34px;font-size:12px;flex:0 0 auto}
  .sc-cl{min-width:0}
  .sc-cl-n{font-size:12px;font-weight:600;color:var(--ink)}
  .sc-cl-n .gold{color:var(--gold-txt)}
  .sc-cl-w{font-size:11px;color:var(--t3);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sc-actions{display:flex;border-top:1px solid var(--hair)}
  .sc-actions a{display:flex;align-items:center;justify-content:center;gap:7px;padding:14px 12px;font-size:13px;line-height:1;border-radius:0;white-space:nowrap}
  .sc-actions .btn-skip{flex:1;color:var(--t2);font-weight:600;background:transparent;border-right:1px solid var(--hair)}
  .sc-actions .btn-skip:hover{background:var(--off);color:var(--ink)}
  .sc-actions .btn-notify{flex:2;color:var(--gold-on);font-weight:700;background:var(--gold);border:0}
  .sc-actions .btn-notify:hover{background:var(--gold-hover)}
  /* Clickable card affordances + lot detail page */
  .sc-title a{color:inherit;text-decoration:none}
  .sc-title a:hover{text-decoration:underline;text-decoration-color:var(--gold);text-underline-offset:2px}
  a.sc-img{cursor:pointer}
  .sc-more{display:inline-block;font-size:12px;font-weight:600;color:var(--gold-txt);margin:0 0 12px;text-decoration:none}
  .sc-more:hover{text-decoration:underline;text-underline-offset:2px}
  .sc-scores{display:flex;gap:7px;margin:0 0 12px;flex-wrap:wrap}
  .sc-score{font-size:11px;font-weight:600;color:var(--t2);background:var(--off);border:1px solid var(--hair);border-radius:6px;padding:3px 9px}
  .sc-score b{color:var(--ink);font-weight:700}
  .sc-score.ai{color:var(--gold-txt);background:var(--gold-tint);border-color:var(--gold-line)}
  .ld-ai{font-size:9px;font-weight:700;letter-spacing:.04em;color:var(--gold-txt);background:var(--gold-tint);border:1px solid var(--gold-line);border-radius:4px;padding:1px 5px;margin-left:6px;vertical-align:middle}
  .ld-grid{display:grid;grid-template-columns:1fr;gap:22px}
  @media(min-width:920px){.ld-grid{grid-template-columns:minmax(0,1fr) minmax(340px,420px);align-items:start}}
  .ld-left{min-width:0}
  .ld-gallery{margin-bottom:22px}
  .ld-hero{height:420px;border-radius:var(--r-card);background:#15171a;background-size:cover;background-position:center;border:1px solid var(--hair)}
  .ld-hero.ld-noimg{display:flex;align-items:center;justify-content:center;color:var(--faint);font-size:14px;background:var(--off)}
  .ld-thumbs{display:flex;gap:10px;margin-top:12px;flex-wrap:wrap}
  .ld-th{width:88px;height:62px;border-radius:8px;border:2px solid transparent;background:#15171a;background-size:cover;background-position:center;cursor:pointer;padding:0;opacity:.65;transition:opacity .15s,border-color .15s}
  .ld-th:hover{opacity:1}
  .ld-th.on{opacity:1;border-color:var(--gold)}
  .ld-right{position:sticky;top:84px}
  @media(max-width:920px){.ld-right{position:static}.ld-hero{height:280px}}
  .ld-top{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px}
  .ld-grade-n{font-size:34px;font-weight:700;color:var(--gold-txt);line-height:1;font-variant-numeric:tabular-nums}
  .ld-grade-k{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);margin-top:5px}
  .ld-landed{text-align:right}
  .ld-landed-k{font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--faint)}
  .ld-landed-v{font-size:20px;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums;margin-top:2px}
  .ld-when-row{margin-bottom:14px}
  .ld-when{font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--gold-txt);background:var(--gold-tint);border:1px solid var(--gold-line);padding:4px 10px;border-radius:6px}
  .ld-when.urgent{color:#fff;background:#B11226;border-color:#B11226}
  .ld-rows{display:flex;flex-direction:column}
  .ld-row{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--hair-2);font-size:13.5px}
  .ld-row:last-child{border-bottom:0}
  .ld-k{color:var(--t3)}
  .ld-v{color:var(--ink);font-weight:600;text-align:right}
  .ld-sec{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);margin:16px 0 2px}
  .ld-client{display:flex;align-items:center;gap:11px;padding:14px 0 0;margin-top:8px;border-top:1px solid var(--hair)}
  .ld-cl-n{font-size:13px;font-weight:600;color:var(--ink)}
  .ld-cl-w{font-size:11.5px;color:var(--t3);margin-top:1px}
  .ld-actions{display:flex;gap:10px;margin-top:18px}
  .ld-actions .btn-skip{flex:1;display:flex;align-items:center;justify-content:center;border:1px solid var(--hair);border-radius:8px;color:var(--t2);font-weight:600;padding:13px}
  .ld-actions .btn-skip:hover{background:var(--hover);color:var(--ink)}
  .ld-actions .btn-notify{flex:2;display:flex;align-items:center;justify-content:center;background:var(--gold);color:var(--gold-on);font-weight:700;border-radius:8px;padding:13px}
  .ld-actions .btn-notify:hover{background:var(--gold-hover)}
  .ld-status{margin-top:16px;padding:12px;background:var(--off);border:1px solid var(--hair);border-radius:8px;font-size:13.5px;color:var(--t2);text-align:center}
  .ld-notes{font-size:14px;color:var(--t2);line-height:1.6;margin:0 0 10px}
  .ld-ai-read{background:var(--gold-tint);border:1px solid var(--gold-line);border-radius:10px;padding:14px 16px;margin:0 0 14px}
  .ld-ai-head{font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--gold-txt);margin-bottom:8px}
  .ld-ai-read .ld-notes:last-child{margin-bottom:0}
  .ld-ai-form{margin-top:14px}
  .ld-ai-form button:disabled{opacity:.7;cursor:default}
  .ld-feed{margin:0 0 22px;font-size:13px}
  .ld-feed summary{cursor:pointer;color:var(--t3);font-weight:600;list-style:none;padding:8px 0}
  .ld-feed summary::-webkit-details-marker{display:none}
  .ld-feed summary:hover{color:var(--ink)}
  .ld-raw{white-space:pre-wrap;word-break:break-all;font-size:11.5px;line-height:1.5;color:var(--t2);background:var(--off);border:1px solid var(--hair);border-radius:8px;padding:12px 14px;margin:0;font-family:var(--mono,ui-monospace,Menlo,Consolas,monospace)}
  .ld-sheet h2{margin-bottom:14px}
  .ld-sheet-link{position:relative;display:block;border-radius:10px;overflow:hidden;border:1px solid var(--hair);background:var(--off);line-height:0}
  .ld-sheet-img{display:block;width:100%;height:auto}
  .ld-sheet-open{position:absolute;top:10px;right:10px;background:rgba(20,20,22,.72);color:#fff;font-size:11px;font-weight:600;padding:5px 10px;border-radius:6px;letter-spacing:.02em;line-height:1}
  .ld-sheet-link:hover .ld-sheet-open{background:rgba(20,20,22,.92)}
  .ld-topbtns{display:flex;gap:10px;align-items:center}
  .ld-share{position:relative}
  .ld-share>summary{list-style:none;cursor:pointer;display:inline-flex}
  .ld-share>summary::-webkit-details-marker{display:none}
  .ld-share-pop{position:absolute;right:0;top:calc(100% + 8px);z-index:30;width:300px;background:var(--card);border:1px solid var(--hair);border-radius:12px;padding:16px;box-shadow:0 18px 50px rgba(0,0,0,.18);text-align:left}
  .ld-share-h{font-weight:700;font-size:14px;color:var(--ink)}
  .ld-share-p{font-size:12px;color:var(--t3);margin:4px 0 12px;line-height:1.5}
  .ld-share-row{display:flex;gap:8px;margin-bottom:10px}
  .ld-share-row input{flex:1;min-width:0;font-size:12px;padding:9px 10px;border:1px solid var(--field-line);border-radius:8px;background:var(--field);color:var(--ink)}
  .ld-share-row .btn-dark{padding:9px 14px;font-size:13px}
  .ld-share-wa{display:block;text-align:center;width:100%}
`;

function initials(name) {
  return String(name || "?").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

// Avatar colour palette (background, initials text). Assigned by hashing the
// person's name so each person keeps a stable colour across the app.
const AVATAR_PALETTE = [
  ["#AFA9EC", "#26215C"], ["#5DCAA5", "#04342C"], ["#F5C4B3", "#4A1B0C"],
  ["#85B7EB", "#042C53"], ["#97C459", "#173404"], ["#EF9F27", "#412402"], ["#ED93B1", "#4B1528"],
];
function avatarColor(name) {
  const s = String(name || "?");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const [bg, fg] = AVATAR_PALETTE[h % AVATAR_PALETTE.length];
  return { bg, fg };
}
// Render a colour-coded initials avatar for a name.
function avatar(name) {
  const { bg, fg } = avatarColor(name);
  return `<span class="avatar" style="background:${bg};color:${fg}">${esc(initials(name))}</span>`;
}

// Inline SVG icon set (no external icon font: lighter, no render-blocking CDN).
const svgIcon = (inner, fill = "none") => `<svg viewBox="0 0 24 24" fill="${fill}" stroke="${fill === "none" ? "currentColor" : "none"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const ICONS = {
  dashboard: svgIcon(`<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>`),
  clients: svgIcon(`<circle cx="9" cy="7" r="3"/><path d="M3 21v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1"/><path d="M16 3.2a3 3 0 0 1 0 7.6"/><path d="M21 21v-1a5 5 0 0 0-3.5-4.8"/>`),
  wishlists: svgIcon(`<path d="M12 21C12 21 4 13.7 4 8.6A4.6 4.6 0 0 1 12 6a4.6 4.6 0 0 1 8 2.6C20 13.7 12 21 12 21Z"/>`),
  matches: svgIcon(`<path d="M4 13h4l2 3h4l2-3h4"/><path d="M5 13l1.6-7a2 2 0 0 1 2-1.6h6.8a2 2 0 0 1 2 1.6L19 13v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z"/>`),
  agents: svgIcon(`<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7"/><path d="M3 12h18"/>`),
  payments: svgIcon(`<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>`),
  settings: svgIcon(`<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="var(--card)"/><circle cx="15" cy="12" r="2" fill="var(--card)"/><circle cx="8" cy="18" r="2" fill="var(--card)"/>`),
  bell: svgIcon(`<path d="M6 9a6 6 0 0 1 12 0c0 5.5 1.8 6.5 1.8 6.5H4.2S6 14.5 6 9Z"/><path d="M10 19a2 2 0 0 0 4 0"/>`),
  help: svgIcon(`<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.4 2.4 0 1 1 3.4 2.3c-.8.4-1 .9-1 1.6"/><path d="M12 16.5h.01"/>`),
  account: svgIcon(`<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.6 18.6a6 6 0 0 1 10.8 0"/>`),
  plus: svgIcon(`<path d="M12 5v14M5 12h14"/>`),
  arrow: svgIcon(`<path d="M5 12h13M13 6l6 6-6 6"/>`),
  kebab: svgIcon(`<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>`, "currentColor"),
};

function sidebar(active, counts, session = { role: "admin" }) {
  const isAdmin = session.role === "admin";
  const item = (id, label, count) =>
    `<a class="${active === id ? "active" : ""}" href="/admin?view=${id}">
      ${ICONS[id] || ""}<span class="lbl">${label}</span><span class="ct">${count ?? ""}</span></a>`;
  const whoLabel = isAdmin ? "JDM Connect" : esc(session.name || "Agent");
  const whoSub = isAdmin ? "Admin" : "Agent";
  return `<aside class="side">
    <div class="brand">${LOGO}</div>
    <nav class="nav">
      ${item("dashboard", "Dashboard", "")}
      ${item("clients", "Clients", counts.clients)}
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
  dashboard: { kicker: "Vehicle Finder", title: "Dashboard", sub: "Your desk at a glance.", btn: "" },
  intake: { kicker: "Vehicle Finder", title: "Add a client", sub: "Add a client and the vehicles they're looking for.", btn: "Search auctions" },
  clients: { kicker: "Vehicle Finder", title: "Clients", sub: "Your buyer directory.", btn: "Add client" },
  wishlists: { kicker: "Vehicle Finder", title: "Wishlists", sub: "Search criteria matched against the live auction feed.", btn: "Add client" },
  matches: { kicker: "Vehicle Finder", title: "Matches", sub: "Auction lots matched to your clients' searches.", btn: "Search again" },
  agents: { kicker: "Vehicle Finder", title: "Agents", sub: "Logins that find cars for their own clients.", btn: "Search auctions" },
  payments: { kicker: "Vehicle Finder", title: "Payments", sub: "Deposits taken through the buyer portal via Stripe.", btn: "" },
  settings: { kicker: "Vehicle Finder", title: "Settings", sub: "Alert email, notifications and payments.", btn: "" },
};

export async function adminPage(env, view = "dashboard", session = { role: "admin", id: 0 }, opts = {}) {
  const isAgent = session.role === "agent";
  if (!HEADERS[view]) view = "dashboard";
  if (view === "wishlists") view = "clients"; // searches now live inside the client
  if (["agents", "settings", "payments"].includes(view) && isAgent) view = "dashboard"; // admin-only areas

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

  const agentTotal = !isAgent ? ((await env.DB.prepare("SELECT COUNT(*) AS n FROM agents WHERE active = 1").first())?.n || 0) : 0;
  const counts = { clients: clients.length, wishlists: wishlists.length, matches: pending.length, agents: agentTotal };
  const h = HEADERS[view];
  const primary = view === "matches" || view === "intake"
    ? `<a class="btn-dark" href="/run">${esc(h.btn)}</a>`
    : ["agents", "settings", "payments"].includes(view)
    ? ""
    : `<a class="btn-dark" href="/admin?view=intake">${esc(h.btn)}</a>`;

  const makers = view === "intake" ? await distinctMakers(env) : [];
  let body = "";
  if (view === "dashboard") body = dashboardView(session, await dashboardData(env, session));
  else if (view === "intake") body = intakeView(clients, makers, { err: opts.err });
  else if (view === "clients") body = clientsView(clients, wishlists, { session, agents: shareAgents, shares: sharesByClient });
  else if (view === "wishlists") body = wishlistsView(wishlists);
  else if (view === "matches") body = matchesView(pending, { settings: matchSettings, aiEnabled: !!env.ANTHROPIC_API_KEY });
  else if (view === "agents") body = agentsView(agents);
  else if (view === "payments") body = paymentsView(payments, { stripeSecret: !!env.STRIPE_SECRET_KEY });
  else if (view === "settings") body = settingsView(settings, { stripeSecret: !!env.STRIPE_SECRET_KEY, publicUrl: env.PUBLIC_URL, aiKey: !!env.ANTHROPIC_API_KEY });

  // The dashboard is its own hero: no standard page header, the greeting leads.
  const main = view === "dashboard"
    ? `<div class="content">${body}</div>`
    : `
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
      <td>${avatar(a.name)}${esc(a.name)}${invited ? ` <span class="chip muted">invited</span>` : ""}</td>
      <td>${esc(a.email)}</td>
      <td>${esc(a.company || "-")}</td>
      <td style="text-align:right">${a.client_count}</td>
      <td><form method="POST" action="/agent/alerts" style="display:inline"><input type="hidden" name="id" value="${a.id}"><button class="btn-toggle ${a.alerts ? "on" : "off"}" type="submit">${a.alerts ? "Alerts on" : "Alerts off"}</button></form></td>
      <td><form method="POST" action="/agent/toggle" style="display:inline"><input type="hidden" name="id" value="${a.id}"><button class="btn-toggle ${a.active ? "on" : "off"}" type="submit">${a.active ? "Active" : "Paused"}</button></form></td>
      <td style="text-align:right;white-space:nowrap">
        <form method="POST" action="/agent/invite" style="display:inline"><input type="hidden" name="id" value="${a.id}"><button class="btn-link" type="submit">${invited ? "Resend invite" : "Reset password"}</button></form>
        <form method="POST" action="/agent/delete" style="display:inline" onsubmit="return confirm('Delete this agent and ALL their clients, searches and matches? This cannot be undone.')"><input type="hidden" name="id" value="${a.id}"><button class="btn-del" type="submit">Delete</button></form>
      </td>
    </tr>`;
  }).join("") || `<tr><td colspan="7" class="empty">No agents yet</td></tr>`;
  return `
    <div class="card">
      <h2><span class="num">+</span> New agent</h2>
      <form method="POST" action="/agent">
        <div class="grid">
          <div><label>Name</label><input name="name" placeholder="Agent name" required></div>
          <div><label>Email <span class="opt">(login + alerts)</span></label><input name="email" type="email" placeholder="agent@email.com" required></div>
          <div><label>Company <span class="opt">(optional)</span></label><input name="company" placeholder="e.g. Ofuka"></div>
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
          <label>Alert email <span class="opt">(where new-match alerts are sent)</span></label>
          <input name="digest_email" type="email" value="${esc(s.digest_email || "")}" placeholder="support@jdmconnect.com.au">
          <div class="toggles">
            ${toggleRow("request_alerts", "Email me new vehicle requests", "When someone submits the public request form, email me their details.", settingOn(s, "request_alerts"))}
            ${toggleRow("email_alerts", "Email me match alerts", "Send a digest email when new matches are found.", settingOn(s, "email_alerts"))}
            ${toggleRow("send_to_client", "Email matches to clients on approval", "When you press “Approve & send” on a match, actually email that car to the client. Off = approving just files the match without emailing anyone.", settingOn(s, "send_to_client"))}
            ${toggleRow("client_landed", "Show landed (AUD) price to clients", "Show the indicative AUD landed price in client emails and the buyer portal. Off = clients see only the Japanese auction price; staff always see landed cost.", settingOn(s, "client_landed"))}
            ${toggleRow("market_for_clients", "Show recent market average to clients", "Show the recent market-average sold price on each car in the buyer portal (a members perk). Staff always see the full market panel on the lot page.", settingOn(s, "market_for_clients"))}
          </div>

          <div style="margin-top:30px;border-top:1px solid var(--hair);padding-top:22px">
            <div style="font-size:15px;font-weight:600;margin-bottom:4px">Payments (Stripe)</div>
            <p class="help" style="margin:0 0 16px">Take a deposit from buyers in their portal. ${stripeSecret ? "Stripe key detected." : "<strong>No Stripe key set yet</strong> - deposits stay off until the <code>STRIPE_SECRET_KEY</code> secret is added."}</p>
            <div class="toggles" style="margin-top:0">
              ${toggleRow("stripe_enabled", "Enable deposits in the buyer portal", "Show a “Pay deposit” button on cars a client has asked us to chase.", settingOn(s, "stripe_enabled"))}
            </div>
            <div class="grid" style="grid-template-columns:repeat(2,1fr);margin-top:16px">
              <div><label>Deposit amount <span class="opt">(AUD)</span></label><input name="stripe_deposit_aud" type="number" min="0" step="50" value="${esc(s.stripe_deposit_aud || "")}" placeholder="e.g. 500"></div>
              <div><label>Currency</label><input name="stripe_currency" value="${esc(s.stripe_currency || "aud")}" placeholder="aud"></div>
            </div>
            <p class="help" style="margin-top:14px;font-size:12px;line-height:1.55">Stripe webhook endpoint: <strong>${esc(webhookUrl)}</strong> - add it in your Stripe dashboard for the <code>checkout.session.completed</code> event, then set its signing secret as <code>STRIPE_WEBHOOK_SECRET</code>.</p>
          </div>

          <div style="margin-top:30px;border-top:1px solid var(--hair);padding-top:22px">
            <div style="font-size:15px;font-weight:600;margin-bottom:4px">Membership pricing</div>
            <p class="help" style="margin:0 0 16px">One paid plan — “Full access”. This is the price shown on the public pricing page. Billing isn't live yet; “Start free” is the only active path, so changing this just updates the advertised price.</p>
            <div class="grid" style="grid-template-columns:repeat(2,1fr);max-width:640px">
              <div><label>Full access <span class="opt">(A$/month)</span></label><input name="membership_monthly_aud" type="number" min="0" step="1" value="${esc(s.membership_monthly_aud || "49")}"></div>
              <div><label>Free result limit <span class="opt">(per search — reserved, not yet enforced)</span></label><input name="free_result_limit" type="number" min="0" step="1" value="${esc(s.free_result_limit || "1")}"></div>
            </div>
          </div>

          <div style="margin-top:30px;border-top:1px solid var(--hair);padding-top:22px">
            <div style="font-size:15px;font-weight:600;margin-bottom:4px">AI auction-sheet reader</div>
            <p class="help" style="margin:0 0 16px">Reads the Japanese inspection sheet from a car's photos and pulls out the exterior/interior grades, repairs and a translated summary. ${opts.aiKey ? "API key detected." : "<strong>No API key set yet</strong> - the “Read auction sheet” button stays hidden until the <code>ANTHROPIC_API_KEY</code> secret is added."}</p>
            <div class="grid" style="grid-template-columns:repeat(2,1fr);max-width:640px">
              <div><label>When to read</label><select name="ai_sheet_auto">${Object.entries(SHEET_AUTO_MODES).map(([id, label]) => `<option value="${id}"${(s.ai_sheet_auto || "off") === id ? " selected" : ""}>${esc(label)}</option>`).join("")}</select></div>
              <div><label>Model <span class="opt">(cached per car)</span></label><select name="ai_sheet_model">${Object.entries(SHEET_MODELS).map(([id, label]) => `<option value="${id}"${(s.ai_sheet_model || DEFAULT_SHEET_MODEL) === id ? " selected" : ""}>${esc(label)}</option>`).join("")}</select></div>
            </div>
            <p class="help" style="margin-top:10px;font-size:12px">Auto modes read in the background after a search and cache the result, so each car is only read once. “Strong”/“every match” are capped at 6 reads per search to control cost.</p>
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
    const m = { paid: ["#7FD3A6", "rgba(91,192,140,.14)"], created: ["#E6C879", "rgba(202,163,76,.16)"], expired: ["#AEB3BA", "rgba(255,255,255,.06)"], failed: ["#E2607A", "rgba(226,96,122,.13)"] };
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
      <div class="login-logo"><a href="/" aria-label="JDM Connect home">${LOGO}</a></div>
      <h1>Welcome back</h1>
      <p class="login-sub">Sign in to your JDM Connect account to track your searches and matches.</p>
      ${err}
      <label>Email <span class="opt">(agents and clients)</span></label>
      <input type="email" name="email" autocomplete="username" placeholder="you@email.com">
      <div class="login-note">Agents and clients: sign in with your email and password. JDM Connect admin: leave the email blank and enter the admin password.</div>
      <label style="margin-top:14px">Password</label>
      <input type="password" name="password" autocomplete="current-password" autofocus required>
      <button class="btn-gold" type="submit">Sign in</button>
      <p class="login-sub" style="margin:18px 0 0">New to JDM Connect? <a href="/request" style="color:var(--gold-txt);font-weight:600">Start a vehicle request</a></p>
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
      <label>New password</label>
      <input type="password" name="password" autocomplete="new-password" autofocus required minlength="6">
      <label style="margin-top:14px">Confirm password</label>
      <input type="password" name="confirm" autocomplete="new-password" required minlength="6">
      <button class="btn-gold" type="submit">Set password and sign in</button>
    </form>`;
  }
  return brandDoc(`<div class="login-screen">${risingSun({ size: 520, tone: "faint" })}${card}</div>`, "Set password - JDM Connect");
}

// Small inline icons for the action-card headers (inherit currentColor).
const ICON_QUEUE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>`;
const ICON_CLOCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`;

// Time-aware greeting (client local time) + count-up on the dashboard numbers.
// Honours prefers-reduced-motion by showing final values immediately.
function dashScript() {
  return `<script>(function(){
    var h=new Date().getHours();
    var g=h<12?'Good morning':h<18?'Good afternoon':'Good evening';
    var t=document.getElementById('greetTime'); if(t) t.textContent=g;
    var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelectorAll('[data-count]').forEach(function(n,i){
      var target=+n.getAttribute('data-count')||0;
      if(reduce){ n.textContent=target.toLocaleString(); return; }
      var dur=1150, start=null;
      function tick(now){ if(start===null)start=now; var p=Math.min((now-start)/dur,1); var e=1-Math.pow(1-p,3); n.textContent=Math.round(target*e).toLocaleString(); if(p<1) requestAnimationFrame(tick); }
      setTimeout(function(){ requestAnimationFrame(tick); }, i*110);
    });
  })();</script>`;
}

// ---------------------------------------------------------------------------
// Dashboard charts: dependency-free inline SVG, themed via CSS custom props.
// No chart library — keeps the page lightweight and CSP-clean.
// ---------------------------------------------------------------------------
function lastNDays(n) {
  const out = [], now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
function fillSeries(rows, days) {
  const map = new Map((rows || []).map((r) => [r.d, Number(r.n) || 0]));
  return days.map((d) => ({ d, n: map.get(d) || 0 }));
}

// Donut for the pipeline quality split. parts: [{label,value,color}].
function donutSvg(parts) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const cx = 60, cy = 60, r = 46, sw = 16, c = 2 * Math.PI * r;
  let off = 0;
  const ring = total
    ? parts.filter((p) => p.value > 0).map((p) => {
        const len = (p.value / total) * c;
        const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${p.color}" stroke-width="${sw}" stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"/>`;
        off += len;
        return seg;
      }).join("")
    : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--hair)" stroke-width="${sw}"/>`;
  const legend = parts.map((p) =>
    `<div class="lg"><span class="lg-d" style="background:${p.color}"></span><span class="lg-l">${p.label}</span><span class="lg-v">${p.value}</span></div>`
  ).join("");
  return `<div class="donutwrap"><div class="donut">
      <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true" style="transform:rotate(-90deg)">${ring}</svg>
      <div class="donut-mid"><div class="dm-n">${total}</div><div class="dm-k">pending</div></div>
    </div><div class="legend">${legend}</div></div>`;
}

// 14-day throughput bars. series: [{d,n}].
function barsSvg(series, color) {
  const max = Math.max(1, ...series.map((s) => s.n));
  const W = 280, H = 80, gap = 3, n = series.length;
  const bw = (W - gap * (n - 1)) / n;
  const bars = series.map((s, i) => {
    const h = s.n ? Math.max(2, (s.n / max) * (H - 6)) : 1.5;
    const x = i * (bw + gap), y = H - h;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${color}"${s.n ? "" : ' opacity="0.35"'}><title>${s.d}: ${s.n}</title></rect>`;
  }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none" aria-hidden="true">${bars}</svg>`;
}

// Tiny trend sparkline for a KPI. values: number[].
function sparklineSvg(values, color) {
  const n = values.length;
  if (!n) return "";
  const max = Math.max(1, ...values), W = 120, H = 30;
  const pts = values.map((v, i) => `${((i / Math.max(1, n - 1)) * W).toFixed(1)},${(H - (v / max) * (H - 4) - 2).toFixed(1)}`).join(" ");
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

// Top agents by client load, for the dashboard activity chart (admin only).
function agentBars(people) {
  const rows = (people || []).filter((p) => p.client_count != null)
    .sort((a, b) => b.client_count - a.client_count).slice(0, 5);
  if (!rows.length) return "";
  const max = Math.max(1, ...rows.map((a) => a.client_count));
  const bars = rows.map((a) =>
    `<div class="abar"><span class="abar-n">${esc((a.name || "").split(/\s+/)[0])}</span><span class="abar-t"><span class="abar-f" style="width:${Math.round((a.client_count / max) * 100)}%"></span></span><span class="abar-v">${a.client_count}</span></div>`
  ).join("");
  return `<div class="chart-card"><div class="chart-h"><span class="ct-t">Clients per agent</span><span class="ct-s">top ${rows.length}</span></div><div class="abars">${bars}</div></div>`;
}

// Real counts for the dashboard, scoped to what this session may see.
async function dashboardData(env, session) {
  const acc = accessScope(session);
  const run = (sql) => { const s = env.DB.prepare(sql); return acc.binds.length ? s.bind(...acc.binds) : s; };
  const clients = (await run(`SELECT COUNT(*) AS n FROM clients c WHERE ${acc.sql}`).first())?.n || 0;
  const agents = session.role === "admin"
    ? ((await env.DB.prepare("SELECT COUNT(*) AS n FROM agents WHERE active = 1").first())?.n || 0)
    : 0;
  const pending = (await run(`SELECT COUNT(*) AS n FROM queue q JOIN clients c ON c.id = q.client_id WHERE q.status='pending' AND ${acc.sql}`).first())?.n || 0;
  const closing = (await run(`SELECT COUNT(*) AS n FROM queue q JOIN clients c ON c.id = q.client_id WHERE q.status='pending' AND ${acc.sql} AND json_extract(q.lot_json,'$.auction_date') BETWEEN datetime('now') AND datetime('now','+48 hours')`).first())?.n || 0;
  const strRows = (await run(`SELECT json_extract(q.lot_json,'$._strength') AS s, COUNT(*) AS n FROM queue q JOIN clients c ON c.id = q.client_id WHERE q.status='pending' AND ${acc.sql} GROUP BY s`).all()).results || [];
  const strength = { Strong: 0, Good: 0, Possible: 0 };
  for (const r of strRows) if (r.s in strength) strength[r.s] = r.n;
  const days14 = lastNDays(14);
  const revRows = (await run(`SELECT substr(q.decided_at,1,10) AS d, COUNT(*) AS n FROM queue q JOIN clients c ON c.id = q.client_id WHERE q.decided_at IS NOT NULL AND ${acc.sql} AND q.decided_at >= date('now','-13 days') GROUP BY d`).all()).results || [];
  const reviewed = fillSeries(revRows, days14);
  const foundRows = (await run(`SELECT substr(q.created_at,1,10) AS d, COUNT(*) AS n FROM queue q JOIN clients c ON c.id = q.client_id WHERE ${acc.sql} AND q.created_at >= date('now','-13 days') GROUP BY d`).all()).results || [];
  const found = fillSeries(foundRows, days14);
  let spend = null;
  if (session.role === "admin") {
    const spendRows = (await env.DB.prepare(`SELECT substr(paid_at,1,10) AS d, SUM(amount_cents) AS n FROM payments WHERE status='paid' AND paid_at IS NOT NULL AND paid_at >= date('now','-13 days') GROUP BY d`).all()).results || [];
    spend = fillSeries(spendRows, days14);
  }
  let people;
  if (session.role === "admin") {
    people = (await env.DB.prepare(`SELECT a.id, a.name, a.company, a.email, a.active, a.alerts, (SELECT COUNT(*) FROM clients c WHERE c.agent_id = a.id) AS client_count FROM agents a ORDER BY a.created_at DESC LIMIT 6`).all()).results || [];
  } else {
    people = (await run(`SELECT c.id, c.name, c.email, c.state FROM clients c WHERE ${acc.sql} ORDER BY c.created_at DESC LIMIT 6`).all()).results || [];
  }
  return { clients, agents, pending, closing, strength, people, reviewed, found, spend };
}

// Dashboard home: time-aware greeting, animated overview, action cards, list.
function dashboardView(session, data) {
  const isAdmin = session.role === "admin";
  const who = isAdmin ? "Jate" : esc((session.name || "there").split(/\s+/)[0]);
  const ovLabel = isAdmin ? "Team overview" : "Your overview";
  const metric = (n, label, gold, spark) => `<div class="ov${gold ? " gold" : ""}"><div class="num" data-count="${Number(n) || 0}">0</div><div class="cap">${label}</div>${spark || ""}</div>`;

  const topbar = `<div class="dtop">
      <a href="/admin?view=matches" aria-label="Review queue">${ICONS.bell}</a>
      <a href="mailto:support@jdmconnect.com.au" aria-label="Get help">${ICONS.help}</a>
      <a href="/logout" aria-label="Sign out">${ICONS.account}</a>
    </div>`;

  const overview = `<div class="ovwrap"><span class="ovlbl">${ovLabel}</span><a href="/admin?view=clients">Manage ${ICONS.arrow}</a></div>
    <div class="overview">
      ${metric(data.clients, "Active clients")}
      ${isAdmin ? metric(data.agents, "Active agents") : ""}
      ${metric(data.pending, "Matches to review", true, sparklineSvg((data.found || []).map((d) => d.n), "var(--gold)"))}
      ${metric(data.closing, "Closing in 48h")}
    </div>`;

  const cards = `<div class="acards">
      <div class="acard"><div class="ah"><span>Review queue</span>${ICON_QUEUE}</div><div class="ab"><span class="big" data-count="${data.pending}">0</span> ${data.pending === 1 ? "car" : "cars"} awaiting your review<br><a class="link" href="/admin?view=matches">Open review queue ${ICONS.arrow}</a></div></div>
      <div class="acard"><div class="ah"><span>Closing soon</span>${ICON_CLOCK}</div><div class="ab"><span class="big" data-count="${data.closing}">0</span> lot${data.closing === 1 ? "" : "s"} closing within 48 hours<br><a class="link" href="/admin?view=matches">View closing soon ${ICONS.arrow}</a></div></div>
    </div>`;

  let section;
  if (isAdmin) {
    const rows = data.people.map((a) => `<div class="lrow">
        ${avatar(a.name)}
        <div class="who"><div class="nm">${esc((a.name || "").split(/\s+/)[0])}${a.company ? ` <small>· ${esc(a.company)}</small>` : ""}</div><div class="sub">${esc(a.email || "")}</div></div>
        <div class="meta">${a.alerts ? `<span class="b b-warn">${ICONS.bell} alerts on</span>` : ""}<span class="b ${a.active ? "b-ok" : "b-neu"}">${a.active ? "active" : "paused"}</span><a class="kebab" href="/admin?view=agents" aria-label="Manage ${esc(a.name)}">${ICONS.kebab}</a></div>
      </div>`).join("") || `<div class="lrow"><div class="who"><div class="sub">No agents yet. Invite one to get started.</div></div></div>`;
    section = `<div class="sec-h"><h2>Agents <span class="ct">(${data.people.length})</span></h2><a class="btn-gold" href="/admin?view=agents">${ICONS.plus} Invite agent</a></div><div class="list">${rows}</div>`;
  } else {
    const rows = data.people.map((c) => `<div class="lrow">
        ${avatar(c.name)}
        <div class="who"><div class="nm"><a class="clink" href="/admin?view=client&id=${c.id}">${esc(c.name)}</a></div><div class="sub">${esc(c.email || c.state || "Client")}</div></div>
      </div>`).join("") || `<div class="lrow"><div class="who"><div class="sub">No clients yet. Add one to get started.</div></div></div>`;
    section = `<div class="sec-h"><h2>Recent clients</h2><a class="btn-gold" href="/admin?view=intake">${ICONS.plus} Add client</a></div><div class="list">${rows}</div>`;
  }

  const strengthParts = [
    { label: "Strong", value: data.strength.Strong || 0, color: "#5BC08C" },
    { label: "Good", value: data.strength.Good || 0, color: "#CAA34C" },
    { label: "Possible", value: data.strength.Possible || 0, color: "#9BA0A7" },
  ];
  const rev = data.reviewed || [];
  const revTotal = rev.reduce((s, r) => s + r.n, 0);
  const dayLbl = (d) => (d ? d.slice(5).replace("-", "/") : "");
  const spend = data.spend;
  const spendCard = spend
    ? `<div class="chart-card">
        <div class="chart-h"><span class="ct-t">Paid revenue</span><span class="ct-s">A$${Math.round(spend.reduce((s, r) => s + r.n, 0) / 100).toLocaleString("en-AU")} in 14 days</span></div>
        ${barsSvg(spend, "var(--str-fg)")}
        <div class="bars-x"><span>${dayLbl(spend[0] && spend[0].d)}</span><span>today</span></div>
      </div>`
    : "";
  const agentCard = isAdmin ? agentBars(data.people) : "";
  const charts = `<div class="charts">
      <div class="chart-card">
        <div class="chart-h"><span class="ct-t">Reviewed per day</span><span class="ct-s">${revTotal} in 14 days</span></div>
        ${barsSvg(rev, "var(--gold)")}
        <div class="bars-x"><span>${dayLbl(rev[0] && rev[0].d)}</span><span>today</span></div>
      </div>
      <div class="chart-card">
        <div class="chart-h"><span class="ct-t">Pipeline quality</span><span class="ct-s">awaiting review</span></div>
        ${donutSvg(strengthParts)}
      </div>
      ${spendCard}
      ${agentCard}
    </div>`;
  return `<div class="dash">
      ${topbar}
      <div class="dkick"><span class="live"></span> JDM Connect, vehicle finder</div>
      <h1 class="greet"><span id="greetTime">Good morning</span>,<br><span class="nm">${who}</span></h1>
      ${overview}
      ${cards}
      ${charts}
      ${section}
    </div>${dashScript()}`;
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
          <div><label>Name</label><input name="name" placeholder="Jane Citizen" required></div>
          <div><label>Email <span class="opt">(email or WhatsApp required)</span></label><input name="email" type="email" placeholder="name@email.com"></div>
          <div><label>WhatsApp <span class="opt">(email or WhatsApp required)</span></label><input name="whatsapp" placeholder="+61 4XX XXX XXX"></div>
          <div><label>State <span class="opt">(for landed cost)</span></label><select name="state">${stateOptions("")}</select></div>
        </div>
        <div class="actions"><button class="btn-gold" type="submit">Add client</button>
          <span class="help">Name plus a way to reach them (email or WhatsApp) is required.</span></div>
      </form>
    </div>
    <div class="card">
      <h2><span class="num">02</span> Their search</h2>
      <form method="POST" action="/wishlist">
        ${presetSelect()}
        <div class="grid">
          <div><label>Client</label><select name="client_id" required>${clientOptions}</select></div>
          <div><label>Label</label><input name="label" placeholder="e.g. under 1.5M daily"></div>
          <div><label>Make</label>${makerField(makers, "wl-maker")}</div>
          <div><label>Model <span class="opt">(pick or type)</span></label>${modelField("wl-models")}</div>
          <div><label>Year min</label><input name="year_min" type="number" placeholder="1990"></div>
          <div><label>Year max</label><input name="year_max" type="number" placeholder="2002"></div>
          <div><label>Max price (JPY)</label><input name="price_max" type="number" placeholder="1,500,000"></div>
          <div><label>Max mileage (km)</label><input name="mileage_max" type="number" placeholder="80,000"></div>
          <div><label>Min grade</label><input name="rate_min" type="number" step="0.5" placeholder="e.g. 4"></div>
          <div><label>Chassis / model code <span class="opt">(contains, best match)</span></label><input name="kuzov" placeholder="e.g. JZA80 or 211"></div>
          <div><label>Grade keyword <span class="opt">(contains)</span></label><input name="grade_kw" placeholder="e.g. RS"></div>
        </div>
        <label style="display:flex;align-items:flex-start;gap:9px;margin-top:14px;font-size:13px;color:#3A3C3F;cursor:pointer"><input type="checkbox" name="watch_only" value="1" style="width:auto;margin-top:2px"><span><strong>Watch only (lead).</strong> Surface matches for a follow-up call, but never auto-email this client. Good for buyers who aren't ready yet, especially rare cars.</span></label>
        <div class="actions"><button class="btn-gold" type="submit">Add search</button>
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
      <td>${avatar(c.name)}<a class="clink" href="/admin?view=client&id=${c.id}">${esc(c.name)}</a></td>
      <td>${esc(c.email || "-")}</td><td>${esc(c.state || "-")}</td>
      <td style="text-align:right">${countFor(c.id)}</td>
      ${isAdmin ? `<td>${ownerCell(c)}</td>` : ""}
      <td>${shareCell(c)}</td>
      <td style="text-align:right">${canManage(c)
        ? `<form method="POST" action="/client/delete" style="display:inline" onsubmit="return confirm('Delete this client and all their searches? This cannot be undone.')"><input type="hidden" name="id" value="${c.id}"><button class="btn-del" type="submit">Delete</button></form>`
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
    <table><tr>${headCheck}<th>Client</th><th>Email</th><th>State</th><th style="text-align:right">Searches</th>${headOwner}<th>Shared with</th><th></th></tr>${rows}</table></div>${isAdmin ? `<p class="help" style="margin:10px 2px 0;font-size:12px">Owner = whose dashboard a client lives on, and who gets their match alerts. Shared with = other agents who can also see and action them.</p>` : ""}`;
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
      <td>${avatar(w.client_name)}${esc(w.client_name)}${w.needs_detail ? ` <span class="chip muted">needs detail</span>` : ""}</td>
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

// Interior / exterior condition letters. The auction feed has no dedicated field,
// so we (1) prefer a structured read stored by the AI sheet reader (lot._sheet),
// then (2) tolerantly parse the free-text fields, which occasionally carry the
// marks. Returns { ext, int, ai } or null.
function conditionScores(lot) {
  if (lot._sheet && (lot._sheet.exterior || lot._sheet.interior)) {
    return { ext: lot._sheet.exterior || null, int: lot._sheet.interior || null, ai: true };
  }
  const hay = `${lot.grade || ""} ${lot.rate || ""} ${lot.info || ""}`;
  if (!hay.trim()) return null;
  let ext = null, int = null, m;
  if ((m = hay.match(/外装\s*[:：]?\s*([A-Ea-e])/))) ext = m[1].toUpperCase();
  if ((m = hay.match(/内装\s*[:：]?\s*([A-Ea-e])/))) int = m[1].toUpperCase();
  if (!ext && (m = hay.match(/\bext(?:erior)?\s*[:.\-]?\s*([A-Ea-e])\b/i))) ext = m[1].toUpperCase();
  if (!int && (m = hay.match(/\bint(?:erior)?\s*[:.\-]?\s*([A-Ea-e])\b/i))) int = m[1].toUpperCase();
  if (!ext && !int && (m = hay.match(/\b\d(?:\.\d)?\s+([A-E])\s*[\/\s]\s*([A-E])\b/))) { ext = m[1]; int = m[2]; }
  return (ext || int) ? { ext, int, ai: false } : null;
}
function scoresChips(lot) {
  const s = conditionScores(lot);
  if (!s) return "";
  return `<div class="sc-scores">${s.ext ? `<span class="sc-score">Ext <b>${esc(s.ext)}</b></span>` : ""}${s.int ? `<span class="sc-score">Int <b>${esc(s.int)}</b></span>` : ""}${s.ai ? `<span class="sc-score ai">AI read</span>` : ""}</div>`;
}

function matchCard(q) {
  let lot = {};
  try { lot = JSON.parse(q.lot_json); } catch (e) {}
  const img = imageUrls(lot).medium;
  const title = `${esc(lot.year || "")} ${esc(lot.marka_name || "")} ${esc(lot.model_name || "")}`.trim();
  const strengthLabel = lot._strength || "Possible";
  const strKey = strengthLabel === "Strong" ? "strong" : strengthLabel === "Good" ? "good" : "poss";
  const strBadge = strengthLabel === "Strong" ? "b-str" : strengthLabel === "Good" ? "b-good" : "b-pos";
  const bid = Number(lot.start) > 0 ? yen(lot.start) : yen(lot.avg_price);
  const approve = `/decide?token=${esc(q.token)}&action=approve`;
  const skip = `/decide?token=${esc(q.token)}&action=reject`;
  const days = daysUntil(lot.auction_date);
  const auc = esc(lot.auction || "");
  const aucDate = esc((lot.auction_date || "").slice(0, 10));
  const when = (days === 0) ? `<span class="sc-when urgent">Auction today</span>`
    : (days === 1) ? `<span class="sc-when urgent">Auction in 1 day</span>`
    : (days === 2) ? `<span class="sc-when soon">Auction in 2 days</span>`
    : (days > 2) ? `<span class="sc-when">Auction in ${days} days</span>`
    : aucDate ? `<span class="sc-when">${aucDate}</span>` : "";
  const landedNum = q._landed ? Number(q._landed.grandTotal) : 0;
  const hasContact = !!(q.client_email || q.client_whatsapp);
  const chips = whyChips(q);
  const sub = [
    lot.kuzov ? esc(lot.kuzov) : "",
    lot.eng_v ? esc(lot.eng_v) + "cc" : "",
    lot.kpp ? esc(lot.kpp) : "",
    photoCount(lot) ? photoCount(lot) + " photos" : "",
  ].filter(Boolean).join(" · ");
  const haystack = esc(`${lot.year || ""} ${lot.marka_name || ""} ${lot.model_name || ""} ${q.client_name || ""} ${q.wlabel || ""} ${lot.kuzov || ""} ${lot.lot || ""}`.toLowerCase());
  const cell = (k, v, gold) => `<div class="sc-cell"><div class="sc-k">${k}</div><div class="sc-v${gold ? " gold" : ""}">${v}</div></div>`;
  return `<div class="mcard scard" data-qid="${q.id}" data-str="${strKey}" data-days="${days}" data-landed="${landedNum}" data-client="${esc(q.client_name || "")}" data-make="${esc(lot.marka_name || "")}" data-color="${esc((lot.color || "").toLowerCase().replace(/\b[a-z]/g, (m) => m.toUpperCase()))}" data-auction="${auc}" data-search="${haystack}">
    <input type="checkbox" class="msel" name="ids" value="${q.id}" form="bulkForm" aria-label="Select this match">
    <a class="sc-img" href="/admin?view=lot&id=${q.id}" aria-label="View details" style="${img ? `background-image:url('${esc(img)}')` : ""}">
      <div class="sc-grad"></div>
      <div class="sc-tags">
        <span class="b ${strBadge}"><span class="bd"></span>${esc(strengthLabel)}</span>
      </div>
      ${(when || auc || lot.lot) ? `<div class="sc-imgfoot">${when}${(auc || lot.lot) ? `<span class="sc-auc">${[auc, lot.lot ? "Lot " + esc(lot.lot) : ""].filter(Boolean).join(" &middot; ")}</span>` : ""}</div>` : ""}
    </a>
    <div class="sc-body">
      <div class="sc-main">
        <div class="sc-head">
          <div class="sc-id">
            <h3 class="sc-title"><a href="/admin?view=lot&id=${q.id}">${title}</a></h3>
            ${sub ? `<p class="sc-sub">${sub}</p>` : ""}
          </div>
          ${q._landed ? `<div class="sc-landed"><div class="sc-landed-k">Est. landed ${esc(q._landed.state)}</div><div class="sc-landed-v">A$${Number(q._landed.grandTotal).toLocaleString("en-AU")}</div></div>` : ""}
        </div>
        <div class="sc-grid">
          ${cell("Year", esc(lot.year || "-"))}
          ${cell("Grade", esc(displayGrade(lot.rate)), true)}
          ${cell("Odo", lot.mileage ? Math.round(Number(lot.mileage) / 1000) + "k" : "-")}
          ${cell("Bid", bid)}
        </div>
        ${scoresChips(lot)}
        <a class="sc-more" href="/admin?view=lot&id=${q.id}">View details &amp; auction report &rarr;</a>
        ${(lot._watch || chips.length) ? `<div class="why">${lot._watch ? `<span class="wc" style="background:rgba(96,143,226,0.16);color:#9FB9F2;border-color:rgba(96,143,226,0.4)">Lead · follow-up call</span>` : ""}${chips.map((c) => `<span class="wc">${c}</span>`).join("")}</div>` : ""}
        <div class="sc-client">
          ${avatar(q.client_name)}
          <div class="sc-cl"><div class="sc-cl-n">Match for: <span class="gold">${esc(q.client_name)}</span></div><div class="sc-cl-w">${esc(q.wlabel || "search")}</div></div>
        </div>
        ${(!hasContact && !lot._watch) ? `<div class="nocontact">No email or WhatsApp on file. Approving won't reach this client.</div>` : ""}
      </div>
      <div class="sc-actions">
        <a class="btn-skip" href="${skip}">Skip</a>
        <a class="btn-notify" href="${approve}">${lot._watch ? "Mark done" : "Approve &amp; send"}</a>
      </div>
    </div>
  </div>`;
}

function matchesView(pending, opts = {}) {
  if (pending.length === 0) {
    return `<div class="card"><div class="empty"><div class="rule"></div>
      No matches awaiting review. Press <strong>Search again</strong> to score the latest lots against every search.</div></div>` + ranToast();
  }
  const sendOff = opts.settings && !settingOn(opts.settings, "send_to_client");
  let strong = 0, good = 0, poss = 0, soon = 0;
  for (const q of pending) {
    let lot = {}; try { lot = JSON.parse(q.lot_json); } catch (e) {}
    const s = lot._strength || "Possible";
    if (s === "Strong") strong++; else if (s === "Good") good++; else poss++;
    if (daysUntil(lot.auction_date) <= 2) soon++;
  }
  const tk = (k, n, ncls, dot, urgent) => `<div class="mtk${urgent ? " urgent" : ""}"><div class="mtk-k">${k}</div><div class="mtk-row"><span class="mtk-n${ncls ? " " + ncls : ""}">${n}</span><span class="mtk-dot" style="background:${dot}"></span></div></div>`;
  const ticker = `<div class="mticker">
    ${tk("Awaiting review", pending.length, "", "var(--t3)")}
    ${tk("Strong", strong, "str", "#2E7D54")}
    ${tk("Good", good, "gold", "var(--gold)")}
    ${tk("Possible", poss, "", "#B6B9BC")}
    ${tk("Closing in 48h", soon, "bad", "#B11226", true)}
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
        <option value="color">Sort: Colour</option>
        <option value="new">Sort: Newest</option>
      </select>
      <select id="mgroup" class="mctl" aria-label="Group matches">
        <option value="none">Group: None</option>
        <option value="client">Group: Client</option>
        <option value="make">Group: Make</option>
        <option value="auction">Group: Auction</option>
        <option value="color">Group: Colour</option>
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
        ${opts.aiEnabled ? `<form method="POST" action="/lot/fix-photos" style="display:inline" onsubmit="var b=this.querySelector('button');b.disabled=true;b.textContent='Starting…';"><button type="submit" id="qFix" title="AI-reads every car not read yet to fix cover photos and pull the inspection sheet (~1–5¢ each)">Fix photos with AI</button></form>` : ""}
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
  const grid = `<div class="scards" id="mGrid">${pending.map((q) => matchCard(q)).join("")}<div class="mempty" id="mEmpty" style="display:none">No matches fit these filters.</div></div>`;
  return ticker + pause + controls + bulk + grid + matchesScript() + ranToast() + fixToast();
}

// One-off toast after the "Fix photos with AI" button kicks off a background run.
function fixToast() {
  return `<script>(function(){try{var p=new URLSearchParams(location.search);if(!p.has("fixing"))return;var d=document.createElement("div");d.textContent="Reading auction photos in the background — refresh in a minute to see the covers update.";d.style.cssText="position:fixed;left:50%;top:18px;transform:translateX(-50%);max-width:90vw;background:#1C2027;color:#fff;border:1px solid rgba(255,255,255,0.12);padding:11px 18px;border-radius:9px;font:600 14px/1.35 -apple-system,Segoe UI,Arial;z-index:9999;box-shadow:0 6px 20px rgba(0,0,0,.22);text-align:center";document.body.appendChild(d);setTimeout(function(){d.style.transition="opacity .4s";d.style.opacity="0";setTimeout(function(){d.remove();},420);},5200);history.replaceState(null,"",location.pathname+"?view=matches");}catch(e){}})();</script>`;
}

// Client-side controller for the Matches view: search, strength + closing-soon
// filters, sort, grouping with headers, and multi-select bulk actions. Cards are
// server-rendered, so if this script ever fails the cards and their per-card
// Approve/Skip links still work. No template literals or ${} inside this string.
// Shows a one-off "Found N new matches" / "No new matches" toast after a search,
// reading the ?ran=N the /run redirect adds, then cleans it from the URL.
function ranToast() {
  return `<script>(function(){try{var p=new URLSearchParams(location.search);if(!p.has("ran"))return;var n=parseInt(p.get("ran"),10)||0;var msg=n>0?("Found "+n+" new match"+(n===1?"":"es")):"No new matches this time";var d=document.createElement("div");d.textContent=msg;d.style.cssText="position:fixed;left:50%;top:18px;transform:translateX(-50%);background:#1C2027;color:#fff;border:1px solid rgba(255,255,255,0.12);padding:11px 18px;border-radius:9px;font:600 14px/1 -apple-system,Segoe UI,Arial;z-index:9999;box-shadow:0 6px 20px rgba(0,0,0,.22)";document.body.appendChild(d);setTimeout(function(){d.style.transition="opacity .4s";d.style.opacity="0";setTimeout(function(){d.remove();},420);},3200);history.replaceState(null,"",location.pathname+"?view=matches");}catch(e){}})();</script>`;
}

function matchesScript() {
  return `<script>(function(){
  var grid=document.getElementById('mGrid'); if(!grid) return;
  var cards=[].slice.call(grid.getElementsByClassName('mcard'));
  var st={q:'',str:'all',soon:false,sort:'priority',group:'none'};
  function gv(c,k){return c.getAttribute('data-'+k)||''}
  function gn(c,k){var n=parseFloat(c.getAttribute('data-'+k));return isNaN(n)?0:n}
  function rank(c){var s=gv(c,'str');return s==='strong'?3:s==='good'?2:1}
  function grpKey(c){return st.group==='make'?gv(c,'make'):st.group==='auction'?gv(c,'auction'):st.group==='color'?(gv(c,'color')||'No colour'):gv(c,'client')}
  function cmp(a,b){
    if(st.sort==='priority')return (rank(b)*1000-gn(b,'days'))-(rank(a)*1000-gn(a,'days'));
    if(st.sort==='soonest')return gn(a,'days')-gn(b,'days');
    if(st.sort==='strength')return rank(b)-rank(a);
    if(st.sort==='landed')return (gn(a,'landed')||1e12)-(gn(b,'landed')||1e12);
    if(st.sort==='color')return gv(a,'color').localeCompare(gv(b,'color'))||(gn(b,'qid')-gn(a,'qid'));
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
      // FLIP: record positions of currently-visible cards before we reorder,
      // then animate each from its old spot to the new one. Reduced-motion skips it.
      var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
      var first=null;
      if(!reduce){ first=[]; cards.forEach(function(c){ if(c.style.display!=='none')first.push([c,c.getBoundingClientRect()]); }); }
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
      if(first){
        first.forEach(function(p){
          var c=p[0]; if(c.style.display==='none')return;
          var o=p[1], r=c.getBoundingClientRect(), dx=o.left-r.left, dy=o.top-r.top;
          if((dx||dy)&&Math.abs(dx)+Math.abs(dy)<2400){
            c.style.transition='none'; c.style.transform='translate('+dx+'px,'+dy+'px)';
            requestAnimationFrame(function(){ c.style.transition='transform .34s cubic-bezier(.2,.7,.3,1)'; c.style.transform=''; });
          }
        });
      }
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
      toast(approve?'Sent to client':'Skipped');
      if(matchMedia('(prefers-reduced-motion: reduce)').matches){
        if(card.parentNode)card.parentNode.removeChild(card); apply();
      }else{
        card.style.transition='opacity .25s ease, transform .25s ease';
        card.style.opacity='0'; card.style.transform='scale(.96)';
        setTimeout(function(){ if(card.parentNode)card.parentNode.removeChild(card); apply(); },240);
      }
    }).catch(function(){ a.textContent=approve?'Approve & send':'Skip'; toast('Could not action, try again'); });
  });
  function toast(m){var t=document.createElement('div');t.textContent=m;t.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#1C2027;color:#fff;border:1px solid rgba(255,255,255,0.12);padding:12px 18px;border-radius:8px;font:600 13px sans-serif;z-index:99';document.body.appendChild(t);setTimeout(function(){t.remove();},2200);}
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
  function toast(m){var t=document.createElement('div');t.textContent=m;t.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#1C2027;color:#fff;border:1px solid rgba(255,255,255,0.12);padding:12px 18px;border-radius:8px;font:600 13px sans-serif;z-index:99';document.body.appendChild(t);setTimeout(function(){t.remove();},2200);}
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
        <div class="wln">${esc(w.label || "Search")} ${w.active ? "" : `<span class="chip muted">paused</span>`}</div>
        <div class="wlc">${summary || "Matches anything"}</div>
      </div>
      <div class="wlacts">
        <form method="POST" action="${base}/wishlist/toggle" style="display:inline"><input type="hidden" name="id" value="${w.id}"><button class="btn-toggle ${w.active ? "on" : "off"}" type="submit">${w.active ? "On" : "Off"}</button></form>
        <form method="POST" action="${base}/wishlist/delete" style="display:inline" onsubmit="return confirm('Delete this search? This cannot be undone.')"><input type="hidden" name="id" value="${w.id}"><button class="btn-del" type="submit">Delete</button></form>
      </div>
    </div>
    <details class="wledit"${opts.open ? " open" : ""}>
      <summary>${opts.portal ? "Edit this search" : "Edit what they're chasing"}</summary>
      <form method="POST" action="${base}/wishlist/edit">
        <input type="hidden" name="id" value="${w.id}">
        <div class="grid">
          ${field("Label", "label")}
          ${field("Make", "marka_name")}
          ${field("Model", "model_name")}
          ${field("Year from", "year_min", "number")}
          ${field("Year to", "year_max", "number")}
          ${field("Max budget (JPY)", "price_max", "number")}
          ${field("Max mileage (km)", "mileage_max", "number")}
          ${field("Min grade", "rate_min", "number")}
          ${field("Chassis or model code", "kuzov", null, "(contains, best match)")}
          ${field("Grade keyword", "grade_kw", null, "(contains)")}
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
// Full detail + auction report for one matched lot (queue row). Renders entirely
// from the lot_json snapshot taken at match time — every spec, photo, the
// equipment/info notes and the landed-cost estimate are already captured, so the
// page makes no extra auction-feed calls.
function lotGalleryScript() {
  return `<script>(function(){var hero=document.getElementById('ldHero');if(!hero)return;document.querySelectorAll('.ld-th').forEach(function(b){b.addEventListener('click',function(){var f=b.getAttribute('data-full');if(f)hero.style.backgroundImage="url('"+f+"')";document.querySelectorAll('.ld-th').forEach(function(x){x.classList.remove('on')});b.classList.add('on');});});})();</script>`;
}

export async function lotDetailPage(env, queueId, session = { role: "admin", id: 0 }, opts = {}) {
  const qid = Number(queueId);
  const back = `<a class="btn-dark" href="/admin?view=matches">Back to matches</a>`;
  const notFound = () => shell(sidebar("matches", {}, session),
    `<div class="topbar"><div><div class="kicker">Vehicle Finder</div><h1>Vehicle</h1></div>${back}</div>
     <div class="content"><div class="card"><div class="empty">This vehicle is no longer in your queue.</div></div></div>`,
    "Vehicle - JDM Connect");
  if (!Number.isInteger(qid) || qid <= 0) return notFound();
  const q = await env.DB.prepare(
    `SELECT q.*, c.name AS client_name, w.label AS wlabel, w.rate_min AS w_rate,
            w.price_max AS w_price, w.kuzov AS w_kuzov, w.grade_kw AS w_kw
       FROM queue q JOIN clients c ON c.id = q.client_id LEFT JOIN wishlists w ON w.id = q.wishlist_id
      WHERE q.id = ?`
  ).bind(qid).first();
  if (!q) return notFound();
  if (!(await clientAccessibleBy(env, q.client_id, session))) return notFound();

  let lot = {};
  try { lot = JSON.parse(q.lot_json); } catch (e) {}
  if (!q._landed && lot._landed) q._landed = lot._landed;
  // Refresh the image set live from the feed (like the dealer portal reads a lot
  // on demand). We snapshot images at match time, but upcoming lots usually get
  // the inspection sheet added closer to the sale — so heal the cached snapshot
  // here so the gallery (and the AI reader) see the sheet once it exists.
  if (await refreshLotImages(env, lot)) {
    try { await env.DB.prepare("UPDATE queue SET lot_json = ? WHERE id = ?").bind(JSON.stringify(lot), q.id).run(); } catch (e) {}
  }
  // "Auto when I open a car" mode: trigger the read on first view (guarded against
  // a reload loop by skipping when an error is already on the URL).
  const settings = await getSettings(env).catch(() => ({}));
  const autoOpen = !!opts.aiEnabled && settings.ai_sheet_auto === "open" && !lot._sheet && !opts.err;

  const title = `${esc(lot.year || "")} ${esc(lot.marka_name || "")} ${esc(lot.model_name || "")}`.trim() || "Vehicle";
  const sub = [lot.kuzov ? "Chassis " + esc(lot.kuzov) : "", lot.lot ? "Lot " + esc(lot.lot) : "", esc(lot.auction || "")].filter(Boolean).join(" &middot; ");

  // Share: a signed, view-only public link to this car (no login), with copy +
  // WhatsApp. The token can only VIEW — never approve/skip.
  const shareTitle = `${lot.year || ""} ${lot.marka_name || ""} ${lot.model_name || ""}`.replace(/\s+/g, " ").trim();
  const shareToken = await makeShareToken(env, q.id);
  const shareBtn = shareToken ? `<details class="ld-share">
      <summary class="btn-dark">Share</summary>
      <div class="ld-share-pop">
        <div class="ld-share-h">Share with a client</div>
        <p class="ld-share-p">A view-only link to this car — no login needed.</p>
        <div class="ld-share-row"><input id="shareUrl" readonly value="" aria-label="Share link"><button type="button" id="shareCopy" class="btn-dark">Copy</button></div>
        <a id="shareWa" target="_blank" rel="noopener" class="btn-gold ld-share-wa">Share on WhatsApp</a>
      </div>
    </details>` : "";
  const shareScript = shareToken ? `<script>(function(){var t=${JSON.stringify(shareToken)},ti=${JSON.stringify(shareTitle)};var url=location.origin+"/v?t="+encodeURIComponent(t);var i=document.getElementById('shareUrl');if(i)i.value=url;var w=document.getElementById('shareWa');if(w)w.href="https://wa.me/?text="+encodeURIComponent(ti+" \\u2014 "+url);var c=document.getElementById('shareCopy');if(c)c.addEventListener('click',function(){if(navigator.clipboard){navigator.clipboard.writeText(url).then(function(){c.textContent='Copied';setTimeout(function(){c.textContent='Copy';},1500);});}else{var el=document.getElementById('shareUrl');el.focus();el.select();try{document.execCommand('copy');}catch(e){}}});})();</script>` : "";

  // Images. The inspection sheet (first image, by feed convention) goes in its
  // own box; the rest are the car-photo gallery. Shared with the cards/emails via
  // splitImages so they all agree on which image is the sheet. `bases` (all
  // images) is kept for the admin "Feed image data" diagnostic below.
  const bases = String(lot.images || "").split("#").map((u) => u.trim().replace(/[?&][hw]=\d+$/i, "")).filter(Boolean);
  const { sheet: sheetBase, photos: photoBases } = splitImages(lot);
  // Market intelligence (sold comparables) + live FX, in parallel. Both are
  // cached and degrade to null/fallback, so the page never blocks on them.
  const [market, fx] = await Promise.all([
    marketIntel(env, lot.marka_name, lot.model_name).catch(() => null),
    getLiveFx(env).catch(() => 0),
  ]);
  const marketBox = marketPanel(market, fx);
  // The image proxy only serves the plain (full) URL or the &w=320 / &h=50
  // transforms — arbitrary widths return nothing. Hero = full, thumbs = &w=320.
  const big = (u) => u;
  const th = (u) => `${u}&w=320`;
  const gallery = photoBases.length
    ? `<div class="ld-gallery">
        <div class="ld-hero" id="ldHero" style="background-image:url('${esc(big(photoBases[0]))}')"></div>
        ${photoBases.length > 1 ? `<div class="ld-thumbs">${photoBases.map((u, i) => `<button type="button" class="ld-th${i === 0 ? " on" : ""}" data-full="${esc(big(u))}" style="background-image:url('${esc(th(u))}')" aria-label="Photo ${i + 1}"></button>`).join("")}</div>` : ""}
      </div>`
    : `<div class="ld-gallery"><div class="ld-hero ld-noimg">No photos on this lot yet</div></div>`;
  // The auction inspection sheet, in its own box (full-res, readable, opens full).
  const sheetBox = sheetBase
    ? `<div class="card ld-sheet">
        <h2><span class="num">&middot;</span> Auction inspection sheet</h2>
        <a href="${esc(big(sheetBase))}" target="_blank" rel="noopener" class="ld-sheet-link">
          <img class="ld-sheet-img" src="${esc(big(sheetBase))}" alt="Auction inspection sheet" loading="lazy">
          <span class="ld-sheet-open">Open full &nearr;</span>
        </a>
      </div>`
    : "";

  const row = (k, v) => v ? `<div class="ld-row"><span class="ld-k">${k}</span><span class="ld-v">${v}</span></div>` : "";
  const km = lot.mileage ? Number(lot.mileage).toLocaleString("en-US") + " km" : "";
  const cs = conditionScores(lot);
  const specRows = [
    row("Year", esc(lot.year || "")),
    row("Chassis", esc(lot.kuzov || "")),
    row("Grade", esc(lot.grade || "")),
    row("Exterior", cs && cs.ext ? esc(cs.ext) + (cs.ai ? ` <span class="ld-ai">AI</span>` : "") : ""),
    row("Interior", cs && cs.int ? esc(cs.int) + (cs.ai ? ` <span class="ld-ai">AI</span>` : "") : ""),
    row("Engine", lot.eng_v ? esc(lot.eng_v) + "cc" : ""),
    row("Transmission", esc(lot.kpp || lot.kpp_type || "")),
    row("Mileage", esc(km)),
    row("Colour", esc(lot.color || "")),
  ].join("");
  const aucDate = esc((lot.auction_date || "").slice(0, 16).replace("T", " "));
  const auctionRows = [
    row("Auction house", esc(lot.auction || "")),
    row("Lot number", esc(lot.lot || "")),
    row("Auction date", aucDate),
    row("Status", esc(lot.status || "")),
    row("Start price", Number(lot.start) > 0 ? yen(lot.start) : ""),
    row("Recent average", Number(lot.avg_price) > 0 ? yen(lot.avg_price) : ""),
  ].join("");

  const landed = q._landed ? `<div class="ld-landed"><div class="ld-landed-k">Est. landed ${esc(q._landed.state || "")}</div><div class="ld-landed-v">A$${Number(q._landed.grandTotal).toLocaleString("en-AU")}</div></div>` : "";
  const days = daysUntil(lot.auction_date);
  const when = (days === 0) ? `<span class="ld-when urgent">Auction today</span>`
    : (days === 1) ? `<span class="ld-when urgent">Auction in 1 day</span>`
    : (days > 1) ? `<span class="ld-when">Auction in ${days} days</span>` : "";
  const chips = whyChips(q);
  const equip = String(lot.equip || "").trim();
  const info = String(lot.info || "").trim();
  const sheet = lot._sheet;
  const aiBtn = opts.aiEnabled
    ? `<form method="POST" action="/lot/read-sheet" class="ld-ai-form" onsubmit="var b=this.querySelector('button');b.disabled=true;b.textContent='Reading the sheet… (~10s)';"><input type="hidden" name="id" value="${q.id}"><button class="btn-dark" type="submit">${sheet ? "Re-read auction sheet with AI" : "Read auction sheet with AI"}</button></form>`
    : "";
  const aiBlock = sheet ? `<div class="ld-ai-read">
      <div class="ld-ai-head">AI reading of the inspection sheet${sheet.overall_grade ? ` &middot; grade ${esc(sheet.overall_grade)}` : ""}</div>
      ${sheet.found === false
        ? `<p class="ld-notes">No inspection sheet was visible in the photos.</p>`
        : `${sheet.notes_en ? `<p class="ld-notes">${esc(sheet.notes_en)}</p>` : ""}
           ${(sheet.repairs && sheet.repairs.length) ? `<p class="ld-notes"><strong>Repairs / marks.</strong> ${esc(sheet.repairs.join("; "))}</p>` : ""}
           ${(sheet.equipment && sheet.equipment.length) ? `<p class="ld-notes"><strong>Equipment.</strong> ${esc(sheet.equipment.join(", "))}</p>` : ""}`}
    </div>` : "";
  const notes = `<div class="card"><h2><span class="num">&middot;</span> Auction notes</h2>
      ${aiBlock}
      ${equip ? `<p class="ld-notes"><strong>Listed equipment.</strong> ${esc(equip)}</p>` : ""}
      ${info ? `<p class="ld-notes">${esc(info)}</p>` : ""}
      ${!sheet ? `<p class="help" style="margin-top:${equip || info ? "12px" : "0"}">Interior and exterior condition grades are on the auction inspection sheet${sheetBase ? " shown above" : ", once the auction house has uploaded it"}. ${opts.aiEnabled ? "Use the button below to have AI read and translate it." : "The number to the right is the overall auction grade."}</p>` : ""}
      ${aiBtn}
    </div>`;

  // Skip/Approve here are full navigations (no AJAX), so send the user back to
  // the client they came from instead of dumping them on the Matches home.
  const ret = `&return=${encodeURIComponent(`/admin?view=client&id=${q.client_id}`)}`;
  const approve = `/decide?token=${esc(q.token)}&action=approve${ret}`;
  const skip = `/decide?token=${esc(q.token)}&action=reject${ret}`;
  const actions = q.status === "pending"
    ? `<div class="ld-actions"><a class="btn-skip" href="${skip}">Skip</a><a class="btn-notify" href="${approve}">${lot._watch ? "Mark done" : "Approve &amp; send"}</a></div>`
    : `<div class="ld-status">This match is <strong>${esc(q.status || "filed")}</strong>.</div>`;

  const main = `
    <div class="topbar wide">
      <div>
        <div class="kicker">Vehicle Finder &middot; Auction report</div>
        <h1>${title}</h1>
        ${sub ? `<p class="subline">${sub}</p>` : ""}
      </div>
      <div class="ld-topbtns">${shareBtn}${back}</div>
    </div>
    <div class="content wide">
      ${opts.err ? `<div class="reqerr" style="margin-bottom:18px">${esc(opts.err)}</div>` : ""}
      <div class="ld-grid">
        <div class="ld-left">
          ${gallery}
          ${sheetBox}
          ${marketBox}
          ${session.role === "admin" ? `<details class="ld-feed"><summary>Feed image data (${bases.length} image${bases.length === 1 ? "" : "s"} from the auction feed)</summary>
            <p class="help" style="margin:10px 0 6px">Raw <code>images</code> field we received for this lot (this is everything the feed sent — if the inspection sheet isn't here, the feed didn't include it):</p>
            <pre class="ld-raw">${esc(lot.images || "(empty — the feed sent no images for this lot)")}</pre>
          </details>` : ""}
          ${notes}
        </div>
        <aside class="ld-right">
          <div class="card ld-card">
            <div class="ld-top"><div class="ld-grade"><div class="ld-grade-n">${esc(displayGrade(lot.rate))}</div><div class="ld-grade-k">Auction grade</div></div>${landed}</div>
            ${when ? `<div class="ld-when-row">${when}</div>` : ""}
            <div class="ld-rows">${specRows}</div>
            <div class="ld-sec">Auction</div>
            <div class="ld-rows">${auctionRows}</div>
            <div class="ld-client">${avatar(q.client_name)}<div class="ld-cl"><div class="ld-cl-n">Match for ${esc(q.client_name)}</div><div class="ld-cl-w">${esc(q.wlabel || "search")}</div></div></div>
            ${chips.length ? `<div class="why" style="padding:14px 0 0">${chips.map((c) => `<span class="wc">${c}</span>`).join("")}</div>` : ""}
            ${actions}
          </div>
        </aside>
      </div>
    </div>${lotGalleryScript()}${shareScript}${autoOpen ? `<script>(function(){var f=document.querySelector('.ld-ai-form');if(!f)return;var b=f.querySelector('button');if(b){b.disabled=true;b.textContent='Reading the sheet… (~10s)';}f.submit();})();</script>` : ""}`;
  return shell(sidebar("matches", {}, session), main, title + " - JDM Connect");
}

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
    <h2><span class="num">+</span> ${wls.length ? "Add another search" : "Add a search"} for ${esc(c.name)}</h2>
    <form method="POST" action="/wishlist">
      <input type="hidden" name="client_id" value="${c.id}">
      ${presetSelect()}
      <div class="grid">
        <div><label>Label</label><input name="label" placeholder="e.g. weekend project"></div>
        <div><label>Make</label><input name="marka_name" placeholder="e.g. TOYOTA"></div>
        <div><label>Model <span class="opt">(contains)</span></label><input name="model_name" placeholder="e.g. SUPRA"></div>
        <div><label>Year min</label><input name="year_min" type="number" placeholder="1990"></div>
        <div><label>Year max</label><input name="year_max" type="number" placeholder="2002"></div>
        <div><label>Max price (JPY)</label><input name="price_max" type="number" placeholder="1,500,000"></div>
        <div><label>Max mileage (km)</label><input name="mileage_max" type="number" placeholder="80,000"></div>
        <div><label>Min grade</label><input name="rate_min" type="number" step="0.5" placeholder="e.g. 4"></div>
        <div><label>Chassis / model code <span class="opt">(contains, best match)</span></label><input name="kuzov" placeholder="e.g. JZA80 or 211"></div>
      </div>
      <label style="display:flex;align-items:flex-start;gap:9px;margin-top:14px;font-size:13px;color:#3A3C3F;cursor:pointer"><input type="checkbox" name="watch_only" value="1" style="width:auto;margin-top:2px"><span><strong>Watch only (lead).</strong> Surface matches for a follow-up call, but never auto-email this client.</span></label>
      <div class="actions"><button class="btn-gold" type="submit">Add search</button>
        <span class="help">Add at least a make, model or chassis/model code.</span></div>
    </form>${presetScript()}
  </div>`;

  const wlSection = `<div class="card">
    <h2><span class="num">${wls.length}</span> ${wls.length === 1 ? "Search" : "Searches"}</h2>
    ${wls.map((w) => wishlistEditor(w, { open: wls.length === 1 })).join("") || `<div class="empty">No search yet — add what ${esc(c.name)} is chasing below.</div>`}
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
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">
          <span class="chip muted">No account needed to start</span>
          <span class="chip muted">Every match reviewed by hand</span>
          <span class="chip muted">Landed cost included</span>
        </div>
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
            <div><label for="rq-name">Name</label><input id="rq-name" name="name" value="${v("name")}" placeholder="Jane Citizen" required></div>
            <div><label for="rq-email">Email</label><input id="rq-email" name="email" type="email" value="${v("email")}" placeholder="name@email.com"></div>
            <div><label for="rq-whatsapp">WhatsApp <span class="opt">(+61…)</span></label><input id="rq-whatsapp" name="whatsapp" type="tel" inputmode="tel" value="${v("whatsapp")}" placeholder="+61 4XX XXX XXX"></div>
            <div><label for="rq-state">State <span class="opt">(where it'll be registered)</span></label><select id="rq-state" name="state">${stateOptions(vals.state || "")}</select></div>
            <div><label for="rq-pass">Create a password <span class="opt">(optional, to log in and track your search)</span></label><input id="rq-pass" name="portal_password" type="password" autocomplete="new-password" minlength="6" placeholder="at least 6 characters"></div>
          </div>
          <p id="rq-contact-error" class="field-err">Please add an email or a WhatsApp number so we can reach you when a match comes up.</p>
          <h2 style="margin-top:26px"><span class="num">02</span> What you're looking for</h2>
          ${presetSelect()}
          <div class="grid">
            <div><label>Make</label>${makerField(makers, "rq-maker")}</div>
            <div><label>Model <span class="opt">(pick or type)</span></label>${modelField("rq-models")}</div>
            <div><label>Nickname <span class="opt">(optional, for your reference)</span></label><input name="label" value="${v("label")}" placeholder="e.g. weekend project"></div>
            <div><label>Year from</label><input name="year_min" type="number" min="1960" max="${yMax}" value="${v("year_min")}" placeholder="1990"></div>
            <div><label>Year to</label><input name="year_max" type="number" min="1960" max="${yMax}" value="${v("year_max")}" placeholder="2002"></div>
            <div><label>Max budget <span class="opt">(in Japanese yen, the auction price)</span></label><input name="price_max" type="number" min="0" step="10000" value="${v("price_max")}" placeholder="3,000,000"></div>
            <div><label>Max mileage <span class="opt">(km)</span></label><input name="mileage_max" type="number" min="0" step="1000" value="${v("mileage_max")}" placeholder="100,000"></div>
            <div><label>Min auction grade <span class="opt">(1 to 6 condition score, leave blank if unsure)</span></label><input name="rate_min" type="number" min="1" max="6" step="0.5" value="${v("rate_min")}" placeholder="e.g. 4"></div>
            <div><label>Chassis code <span class="opt">(only if you know it, e.g. JZA80)</span></label><input name="kuzov" value="${v("kuzov")}" placeholder="e.g. JZA80"></div>
          </div>
          <p id="rq-year-error" class="field-err">“Year from” can't be later than “Year to”. Please check the years.</p>
          <div class="actions"><button class="btn-gold" type="submit">Submit request</button>
            <span class="help">We need your name and a way to reach you (email or WhatsApp). Tell us as much about the car as you can - the more detail, the better the match. We review every match before sending you anything.</span></div>
          <p class="help" style="margin-top:14px;font-size:12px;line-height:1.5;opacity:.85">We use the details above only to search for and contact you about matching vehicles. We never share them with third parties.</p>
        </form>
      </div>
    </div>
    ${modelScript("rq-maker", "rq-models")}${presetScript()}${requestFormScript()}`;
  const sb = `<aside class="side"><div class="brand"><a href="/" aria-label="JDM Connect home">${LOGO}</a></div>
    <nav class="nav">
      <a class="active"><span class="bar"></span><span class="lbl">Request a vehicle</span></a>
      <a href="/login"><span class="bar"></span><span class="lbl">Sign in</span></a>
    </nav>
    <div class="side-foot"><a class="signout" href="/">Back to home</a></div>
    </aside>`;
  return brandShell(sb, main, "Request a vehicle - JDM Connect");
}

// Read-only public view of a shared car (the "Share" link). No login, no client
// info, no admin actions — just the car, its inspection sheet, the specs and
// (optionally) the market panel, with an enquiry CTA. Self-contained styles so
// it renders on the public brand shell. Access is the signed token alone, so
// the caller must verify it before calling this.
export async function publicLotPage(env, queueId) {
  const sb = `<aside class="side"><div class="brand"><a href="/" aria-label="JDM Connect home">${LOGO}</a></div>
    <nav class="nav">
      <a class="active"><span class="bar"></span><span class="lbl">Vehicle</span></a>
      <a href="/request"><span class="bar"></span><span class="lbl">Request a car</span></a>
    </nav>
    <div class="side-foot"><a class="signout" href="/">JDM Connect</a></div>
    </aside>`;
  const q = await env.DB.prepare("SELECT lot_json FROM queue WHERE id = ?").bind(queueId).first();
  if (!q) {
    return brandShell(sb,
      `<div class="topbar"><div class="topbar-in"><div class="kicker">Vehicle Finder</div><h1>Car not found</h1></div></div>
       <div class="content"><div class="card"><div class="empty">This link may have expired. <a href="/request" style="color:var(--gold-txt);font-weight:600">Tell us what you're after</a> and we'll source it for you.</div></div></div>`,
      "Vehicle - JDM Connect");
  }
  let lot = {};
  try { lot = JSON.parse(q.lot_json); } catch (e) {}
  const { sheet: sheetBase, photos } = splitImages(lot);
  const settings = await getSettings(env).catch(() => ({}));
  const [market, fx] = settingOn(settings, "market_for_clients")
    ? await Promise.all([marketIntel(env, lot.marka_name, lot.model_name).catch(() => null), getLiveFx(env).catch(() => 0)])
    : [null, 0];

  const title = `${esc(lot.year || "")} ${esc(lot.marka_name || "")} ${esc(lot.model_name || "")}`.replace(/\s+/g, " ").trim() || "Vehicle";
  const sub = [lot.kuzov ? "Chassis " + esc(lot.kuzov) : "", lot.lot ? "Lot " + esc(lot.lot) : "", esc(lot.auction || "")].filter(Boolean).join(" &middot; ");
  const th = (u) => `${u}&w=320`;
  const gallery = photos.length
    ? `<div class="plv-hero" id="plvHero" style="background-image:url('${esc(photos[0])}')"></div>
       ${photos.length > 1 ? `<div class="plv-thumbs">${photos.map((u, i) => `<button type="button" class="plv-th${i === 0 ? " on" : ""}" data-full="${esc(u)}" style="background-image:url('${esc(th(u))}')" aria-label="Photo ${i + 1}"></button>`).join("")}</div>` : ""}`
    : `<div class="plv-hero plv-noimg">Photos coming soon</div>`;
  const sheetBox = sheetBase
    ? `<div class="card plv-sheet"><h2>Auction inspection sheet</h2><a href="${esc(sheetBase)}" target="_blank" rel="noopener" class="plv-sheet-link"><img src="${esc(sheetBase)}" alt="Auction inspection sheet" loading="lazy"></a></div>`
    : "";
  const kmTxt = lot.mileage ? Number(lot.mileage).toLocaleString("en-US") + " km" : "";
  const specRows = [
    ["Year", esc(lot.year || "")], ["Chassis", esc(lot.kuzov || "")], ["Grade", esc(lot.grade || "")],
    ["Auction grade", esc(displayGrade(lot.rate))], ["Engine", lot.eng_v ? esc(lot.eng_v) + "cc" : ""],
    ["Transmission", esc(lot.kpp || lot.kpp_type || "")], ["Mileage", esc(kmTxt)], ["Colour", esc(lot.color || "")],
    ["Auction house", esc(lot.auction || "")], ["Lot number", esc(lot.lot || "")],
    ["Auction date", esc((lot.auction_date || "").slice(0, 16).replace("T", " "))],
    ["Start price", Number(lot.start) > 0 ? yen(lot.start) : ""],
  ].filter(([, v]) => v).map(([k, v]) => `<div class="plv-row"><span class="plv-k">${k}</span><span class="plv-v">${v}</span></div>`).join("");

  const main = `
    <div class="topbar"><div class="topbar-in"><div class="kicker">JDM Connect &middot; Auction vehicle</div><h1>${title}</h1>${sub ? `<p class="subline">${sub}</p>` : ""}</div></div>
    <div class="content">
      <div class="plv-grid">
        <div class="plv-left">
          <div class="plv-gallery">${gallery}</div>
          ${sheetBox}
          ${marketPanel(market, fx)}
        </div>
        <aside class="plv-right">
          <div class="card plv-spec">
            <div class="plv-rows">${specRows}</div>
            <a class="btn-gold plv-cta" href="/request">Enquire about this car</a>
            <p class="plv-fine">Price shown is the Japanese auction price. Ask us for a full landed cost to your state.</p>
          </div>
        </aside>
      </div>
    </div>
    ${PLV_STYLE}${plvGalleryScript()}`;
  return brandShell(sb, main, title + " - JDM Connect");
}

function plvGalleryScript() {
  return `<script>(function(){var hero=document.getElementById('plvHero');if(!hero)return;document.querySelectorAll('.plv-th').forEach(function(b){b.addEventListener('click',function(){hero.style.backgroundImage="url('"+b.getAttribute('data-full')+"')";document.querySelectorAll('.plv-th').forEach(function(x){x.classList.remove('on');});b.classList.add('on');});});})();</script>`;
}

const PLV_STYLE = `<style>
  .plv-grid{display:grid;grid-template-columns:1fr;gap:22px}
  @media(min-width:920px){.plv-grid{grid-template-columns:minmax(0,1fr) minmax(300px,380px);align-items:start}}
  .plv-left{min-width:0}
  .plv-gallery{margin-bottom:22px}
  .plv-hero{height:440px;border-radius:14px;background:#15171a;background-size:cover;background-position:center;border:1px solid rgba(0,0,0,.10)}
  .plv-noimg{display:flex;align-items:center;justify-content:center;color:#8a8f98;font-size:14px}
  .plv-thumbs{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
  .plv-th{width:84px;height:60px;border-radius:8px;border:1px solid rgba(0,0,0,.10);background-size:cover;background-position:center;cursor:pointer;opacity:.7;transition:opacity .15s,border-color .15s;padding:0}
  .plv-th:hover{opacity:1}
  .plv-th.on{opacity:1;border-color:#CAA34C;box-shadow:0 0 0 1px #CAA34C}
  .plv-sheet{margin-bottom:22px}
  .plv-sheet h2{font-size:15px;margin-bottom:14px}
  .plv-sheet-link{display:block;border-radius:10px;overflow:hidden;border:1px solid rgba(0,0,0,.10);background:#f7f7f5;line-height:0}
  .plv-sheet-link img{display:block;width:100%;height:auto}
  .plv-right{position:sticky;top:24px}
  .plv-rows{display:flex;flex-direction:column}
  .plv-row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:11px 0;border-bottom:1px solid rgba(0,0,0,.06);font-size:13.5px}
  .plv-row:last-of-type{border-bottom:0}
  .plv-k{color:#6b7079}
  .plv-v{font-weight:700;color:#1b1c1e;text-align:right}
  .plv-cta{display:flex;width:100%;margin-top:18px}
  .plv-fine{font-size:11.5px;color:#8a8f98;margin-top:12px;line-height:1.5;text-align:center}
  @media(max-width:920px){.plv-right{position:static}.plv-hero{height:300px}}
</style>`;

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

// Reveal cards on scroll with a staggered fade-up. Dependency-free, respects
// reduced motion, and is a no-op without IntersectionObserver. The pre-reveal
// hidden state is set from JS only, so if this script never runs the
// server-rendered cards stay fully visible (no blank page on JS failure).
function revealScript() {
  return `<script>(function(){try{
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    if(!('IntersectionObserver' in window))return;
    var els=[].slice.call(document.querySelectorAll('.acard,.chart-card,.scard,.mcard,.tstat'));
    if(!els.length)return;
    els.forEach(function(el){el.style.opacity='0';el.style.transform='translateY(14px)';});
    var io=new IntersectionObserver(function(ents,obs){
      ents.forEach(function(en){
        if(!en.isIntersecting)return;
        var el=en.target;
        var sibs=[].slice.call((el.parentNode||document).children).filter(function(x){return els.indexOf(x)>=0});
        var idx=sibs.indexOf(el); if(idx<0)idx=0;
        el.style.transition='opacity .5s ease, transform .5s cubic-bezier(.2,.7,.3,1)';
        el.style.transitionDelay=Math.min(idx,8)*45+'ms';
        requestAnimationFrame(function(){el.style.opacity='';el.style.transform='';});
        obs.unobserve(el);
      });
    },{rootMargin:'0px 0px -6% 0px',threshold:0.04});
    els.forEach(function(el){io.observe(el);});
  }catch(e){}})();<\/script>`;
}

function shell(side, main, title) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"><style>${CSS}</style></head>
    <body><input type="checkbox" id="navToggle" class="nav-cb" aria-hidden="true"><div class="wrap">${side}<label for="navToggle" class="nav-scrim" aria-hidden="true"></label><div class="main"><label for="navToggle" class="nav-burger" aria-label="Open menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg><span>Menu</span></label>${main}</div></div>${revealScript()}</body></html>`;
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
// see": all for admin, owned-or-shared for an agent. Exported so the isolation
// behaviour can be tested directly.
export function accessScope(session) {
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
  const up = await upsertPublicClient(env, form, email, whatsapp);
  const clientId = up.id;
  // Fix 2: ALWAYS create a searchable wishlist (broad ones are flagged for staff).
  await createRequestWishlist(env, clientId, form);

  // Portal self-signup: only when this submission created a BRAND NEW client.
  // If the email already existed we must not set a password from the public
  // form, or anyone who knows a passwordless client's email could take over
  // their portal. Existing clients get portal access via a staff-sent invite.
  let portal = false;
  const selfPw = String(form.get("portal_password") || "");
  if (selfPw && email && up.created) portal = await enablePortalSelfSignup(env, clientId, selfPw);

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
      return { id: existing.id, created: false };
    }
  }
  const r = await env.DB.prepare(
    "INSERT INTO clients (name, email, whatsapp, state) VALUES (?, ?, ?, ?)"
  ).bind(name, email || null, whatsapp || null, state).run();
  return { id: r.meta?.last_row_id, created: true };
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
// The caller only invokes this for a brand-new client. As a second layer, the
// UPDATE is conditional on the password still being unset, so it can never
// overwrite an existing login even under a race. Returns true only if a fresh
// login was actually created.
async function enablePortalSelfSignup(env, clientId, password) {
  if (!clientId || typeof password !== "string" || password.length < 6) return false;
  const { salt, hash } = await hashPassword(password);
  const r = await env.DB.prepare(
    `UPDATE clients SET portal_enabled = 1, pass_salt = ?, pass_hash = ?, invite_token = NULL, invite_exp = NULL
       WHERE id = ? AND (pass_hash IS NULL OR pass_hash = '')`
  ).bind(salt, hash, clientId).run();
  return (r.meta?.changes || 0) > 0;
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
  // Members-only: the recent market-average sold price for this model (from the
  // feed's avg_price), shown when the admin has enabled it for clients.
  const mktAvg = (opts.showMarket && Number(lot.avg_price) > 0)
    ? `<div class="mland"><span class="ml-k">Recent market avg</span><span class="ml-v">${yen(lot.avg_price)}${opts.fx > 0 ? ` <span style="font-weight:600;opacity:.65">≈ A$${Math.round(Number(lot.avg_price) / opts.fx).toLocaleString("en-AU")}</span>` : ""}</span></div>`
    : "";
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
    ${mktAvg}
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
  const showMarket = settingOn(settings, "market_for_clients");
  const fx = showMarket ? await getLiveFx(env).catch(() => 0) : 0;
  const cardOpts = { stripe: stripeOn, depositLabel: `A$${depositAud.toLocaleString("en-AU")}`, showMarket, fx };
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
        <div><label>Label <span class="opt">(your reference)</span></label><input name="label" placeholder="e.g. weekend project"></div>
        <div><label>Make</label>${makerField(makers, "pl-maker")}</div>
        <div><label>Model <span class="opt">(pick or type)</span></label>${modelField("pl-models")}</div>
        <div><label>Year from</label><input name="year_min" type="number" min="1960" max="${yMax}" placeholder="1990"></div>
        <div><label>Year to</label><input name="year_max" type="number" min="1960" max="${yMax}" placeholder="2002"></div>
        <div><label>Max budget (JPY)</label><input name="price_max" type="number" min="0" step="10000" placeholder="3,000,000"></div>
        <div><label>Max mileage (km)</label><input name="mileage_max" type="number" min="0" step="1000" placeholder="100,000"></div>
        <div><label>Min grade</label><input name="rate_min" type="number" min="1" max="6" step="0.5" placeholder="e.g. 4"></div>
        <div><label>Chassis code <span class="opt">(if known)</span></label><input name="kuzov" placeholder="e.g. JZA80"></div>
      </div>
      <div class="actions"><button class="btn-gold" type="submit">Add search</button>
        <span class="help">Add at least a make, model or chassis code so we know what to look for.</span></div>
    </form>${modelScript("pl-maker", "pl-models")}${presetScript()}
  </div>`;

  const flash = opts.flash ? `<div class="banner"><span class="txt">${esc(opts.flash)}</span></div>` : "";
  // At-a-glance summary, all counts scoped to this signed-in client.
  const activeSearches = wls.filter((w) => Number(w.active ?? 1) !== 0).length;
  const inProgress = cars.filter((q) => q.client_request).length;
  const awaiting = cars.length - inProgress;
  const statsRow = `<div class="pstats">
      <div class="pstat lead"><div class="pk">New for you</div><div class="pv" data-count="${awaiting}">0</div><div class="ps">Matches waiting on your go-ahead</div></div>
      <div class="pstat"><div class="pk">Cars found</div><div class="pv" data-count="${cars.length}">0</div><div class="ps">Hand-reviewed for your searches</div></div>
      <div class="pstat"><div class="pk">In progress</div><div class="pv" data-count="${inProgress}">0</div><div class="ps">We're chasing these for you</div></div>
      <div class="pstat"><div class="pk">Active searches</div><div class="pv" data-count="${activeSearches}">0</div><div class="ps">Running on every auction sweep</div></div>
    </div>`;
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
      ${statsRow}
      <div class="psec"><h2>Cars we've found for you${cars.length ? ` <span class="ct">${cars.length}</span>` : ""}</h2><p class="psub">Hand-reviewed by our team and matched to your search. Tap “Ask us to get this” and we'll pull the auction sheet, translate it, and come back to you${stripeOn ? " with next steps" : ""}.</p></div>
      ${carsBody}
      <div class="psec" style="margin-top:34px"><h2>What you're searching for${wls.length ? ` <span class="ct">${activeSearches}/${wls.length}</span>` : ""}</h2><p class="psub">Edit a search or add another - changes apply on the next auction sweep.</p></div>
      ${wlBody}
      ${addForm}
      ${dashScript()}
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
