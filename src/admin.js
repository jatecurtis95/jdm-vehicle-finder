// JDM Connect - Vehicle Finder staff app (hi-fi redesign) + public request page.
// Light theme, gold single accent, Inter, hairline borders (per design handoff).

import { esc, yen, km, displayGrade } from "./render.js";
import { imageUrls, splitImages, distinctMakers, distinctModels, distinctHouses, refreshLotImages, searchLots, searchSold, fetchLot } from "./avtonet.js";
import { AUCTION_CSS, auctionCardV2, auctionSearchHeader, auctionTabs, auctionToolbar, auctionWatchScript, auctionEligibility } from "./auction-ui.js";
import { attachLanded, auStates, normalizeState, getLiveFx, audBudgetToYen } from "./calc.js";
import { marketIntel, marketPanel } from "./market.js";
import { hashPassword, randomToken, makeShareToken, passwordPolicyError, PW_MIN, PW_MAX, PW_SYMBOLS } from "./auth.js";
import { getSettings, settingOn, settingNum } from "./settings.js";
import { whatsappConfigured } from "./whatsapp.js";
import { googleConfigured } from "./oauth.js";
import { brandDoc, brandShell, risingSun } from "./theme.js";
import { SHEET_MODELS, DEFAULT_SHEET_MODEL, SHEET_AUTO_MODES } from "./sheet.js";
import { onboardingCss, wizardScript, popularCards, recentExamplesShell, socialProofStrip, budgetChips, testimonialPanel, whyUs, whatHappensNext, successTimeline, supportBlock } from "./request-wizard.js";

// "Continue with Google" button (social login). The official four-colour G mark,
// a neutral white button, and an "or" divider - shared by the login screen and
// the request wizard's account step. Rendered only when Google is configured.
const GOOGLE_G_SVG = `<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;
const GOOGLE_BTN_CSS = `.btn-google{display:inline-flex;align-items:center;justify-content:center;gap:10px;width:100%;box-sizing:border-box;padding:12px 18px;border:1px solid #dadce0;border-radius:12px;background:#fff;color:#3c4043;font:600 15px/1 Inter,system-ui,-apple-system,sans-serif;text-decoration:none;cursor:pointer;transition:box-shadow .15s ease,background .15s ease,border-color .15s ease}.btn-google:hover{background:#f8faff;border-color:#c6d2ea;box-shadow:0 1px 3px rgba(60,64,67,.16)}.btn-google:focus-visible{outline:2px solid #4285F4;outline-offset:2px}.btn-google svg{flex:0 0 auto}.ob-or{display:flex;align-items:center;gap:14px;margin:18px 0;color:#8a8f98;font-size:12px;letter-spacing:.08em;text-transform:uppercase}.ob-or::before,.ob-or::after{content:"";flex:1;height:1px;background:rgba(0,0,0,.12)}`;
function googleButton(intent, label) {
  const href = `/auth/google?intent=${intent === "login" ? "login" : "signup"}`;
  return `<a class="btn-google" href="${href}" role="button">${GOOGLE_G_SVG}<span>${esc(label)}</span></a>`;
}

// Maker field: a <select> of real feed makers, so the criteria always match the
// auction naming. Falls back to a free-text input if the feed lookup is down.
function makerField(makers, id, placeholder = "Any maker", current = "") {
  if (!makers || !makers.length) return `<input name="marka_name" id="${id}" placeholder="e.g. TOYOTA" value="${esc(current)}">`;
  return `<select name="marka_name" id="${id}"><option value="">${esc(placeholder)}</option>` +
    makers.map((m) => `<option value="${esc(m)}"${m === current ? " selected" : ""}>${esc(m)}</option>`).join("") + `</select>`;
}

// Model field: a real <select> (select-only, no typing) of the chosen maker's
// models, populated by modelScript on maker change. `current` re-selects a value
// after a re-render. Disabled until a maker is picked.
function modelField(listId, current) {
  const want = current ? ` data-want="${esc(current)}"` : "";
  return `<select name="model_name" id="${listId}"${want} disabled><option value="">Select a make to see models</option></select>`;
}

// Inline JS: when the maker <select> changes, (re)load that maker's models into
// the model <select> via /api/models, clearing any previous selection. Exposes
// window.jdmLoadModels(want) so presets can load + select a model. No-op if the
// maker fell back to a text input.
function modelScript(makerId, listId, emptyLabel = "Any model") {
  return `<script>(function(){
    var mk=document.getElementById(${JSON.stringify(makerId)}),sel=document.getElementById(${JSON.stringify(listId)});
    if(!mk||!sel)return;
    var EMPTY=${JSON.stringify(emptyLabel)};
    function fill(want){
      if(mk.tagName!=="SELECT"||!mk.value){sel.innerHTML='<option value="">Select a make to see models</option>';sel.disabled=true;return;}
      sel.disabled=false;sel.innerHTML='<option value="">Loading models…</option>';
      fetch("/api/models?maker="+encodeURIComponent(mk.value)).then(function(r){return r.json();}).then(function(l){
        sel.innerHTML='<option value="">'+EMPTY+'</option>';
        (l||[]).forEach(function(m){var o=document.createElement("option");o.value=m;o.textContent=m;sel.appendChild(o);});
        if(want){var f=false;for(var i=0;i<sel.options.length;i++){if(sel.options[i].value===want){f=true;break;}}if(!f){var o=document.createElement("option");o.value=want;o.textContent=want;sel.appendChild(o);}sel.value=want;}
      }).catch(function(){sel.innerHTML='<option value="">Any model</option>';});
    }
    mk.addEventListener("change",function(){fill("");});
    window.jdmLoadModels=function(want){fill(want||"");};
    if(mk.tagName==="SELECT"&&mk.value){fill(sel.getAttribute("data-want")||"");}
  })();</script>`;
}

// Curated wishlist presets: pick one and it auto-fills make/model/code/year for a
// known model. EDIT THIS LIST to add or refine presets - especially tricky ones
// like the E55 (listed under "Mercedes AMG", not Mercedes-Benz). Make uses
// best-match, so the brand word alone is enough. Verify values against the feed.
// Curated one-tap presets, grouped for scannability. Every make/model below is a
// real value from the live auction feed (verified via /api/models) and the model
// is matched as "contains", so a tap always returns results. Years/chassis narrow
// the common variant; leave them off to keep a preset broad.
const WL_PRESETS = [
  // Sports & performance
  { group: "Sports & performance", name: "Nissan Skyline GT-R (R34)", make: "NISSAN", model: "SKYLINE", kuzov: "BNR34", year_min: 1999, year_max: 2002, label: "R34 GT-R" },
  { group: "Sports & performance", name: "Nissan Skyline GT-R (R33)", make: "NISSAN", model: "SKYLINE", kuzov: "BCNR33", year_min: 1995, year_max: 1998, label: "R33 GT-R" },
  { group: "Sports & performance", name: "Nissan Skyline GT-R (R32)", make: "NISSAN", model: "SKYLINE", kuzov: "BNR32", year_min: 1989, year_max: 1994, label: "R32 GT-R" },
  { group: "Sports & performance", name: "Nissan GT-R (R35)", make: "NISSAN", model: "GT-R", year_min: 2007, year_max: 2024, label: "R35 GT-R" },
  { group: "Sports & performance", name: "Nissan Silvia (S15)", make: "NISSAN", model: "SILVIA", year_min: 1999, year_max: 2002, label: "S15 Silvia" },
  { group: "Sports & performance", name: "Nissan 180SX", make: "NISSAN", model: "180 SX", year_min: 1989, year_max: 1998, label: "180SX" },
  { group: "Sports & performance", name: "Nissan Fairlady Z (350Z)", make: "NISSAN", model: "FAIRLADYZ", year_min: 2002, year_max: 2008, label: "350Z" },
  { group: "Sports & performance", name: "Toyota Supra (A80)", make: "TOYOTA", model: "SUPRA", kuzov: "JZA80", year_min: 1993, year_max: 2002, label: "A80 Supra" },
  { group: "Sports & performance", name: "Toyota GR Supra (A90)", make: "TOYOTA", model: "SUPRA", year_min: 2019, year_max: 2024, label: "A90 Supra" },
  { group: "Sports & performance", name: "Toyota GR Yaris", make: "TOYOTA", model: "GR YARIS", year_min: 2020, year_max: 2024, label: "GR Yaris" },
  { group: "Sports & performance", name: "Toyota 86 / GR86", make: "TOYOTA", model: "86", year_min: 2012, year_max: 2024, label: "86" },
  { group: "Sports & performance", name: "Toyota Chaser (JZX100)", make: "TOYOTA", model: "CHASER", kuzov: "JZX100", year_min: 1996, year_max: 2001, label: "JZX100 Chaser" },
  { group: "Sports & performance", name: "Toyota Mark II (JZX100)", make: "TOYOTA", model: "MARK II", kuzov: "JZX100", year_min: 1996, year_max: 2001, label: "JZX100 Mark II" },
  { group: "Sports & performance", name: "Toyota MR2 (SW20)", make: "TOYOTA", model: "MR2", year_min: 1989, year_max: 1999, label: "SW20 MR2" },
  { group: "Sports & performance", name: "Honda NSX", make: "HONDA", model: "NSX", year_min: 1990, year_max: 2005, label: "NSX" },
  { group: "Sports & performance", name: "Honda S2000", make: "HONDA", model: "S2000", year_min: 1999, year_max: 2009, label: "S2000" },
  { group: "Sports & performance", name: "Honda Integra Type R", make: "HONDA", model: "INTEGRA", year_min: 1995, year_max: 2006, label: "Integra Type R" },
  { group: "Sports & performance", name: "Honda Civic Type R", make: "HONDA", model: "CIVIC", year_min: 2007, year_max: 2023, label: "Civic Type R" },
  { group: "Sports & performance", name: "Mazda RX-7 (FD3S)", make: "MAZDA", model: "RX-7", kuzov: "FD3S", year_min: 1991, year_max: 2002, label: "FD RX-7" },
  { group: "Sports & performance", name: "Mazda RX-8", make: "MAZDA", model: "RX-8", year_min: 2003, year_max: 2012, label: "RX-8" },
  { group: "Sports & performance", name: "Subaru WRX STI (GDB)", make: "SUBARU", model: "IMPREZA", kuzov: "GDB", year_min: 2000, year_max: 2007, label: "GDB STI" },
  { group: "Sports & performance", name: "Subaru WRX STI (VAB)", make: "SUBARU", model: "WRX STI", year_min: 2014, year_max: 2021, label: "VAB STI" },
  { group: "Sports & performance", name: "Mitsubishi Lancer Evo (CT9A)", make: "MITSUBISHI", model: "LANCER", kuzov: "CT9A", year_min: 2001, year_max: 2007, label: "Evo 7-9" },
  { group: "Sports & performance", name: "Mitsubishi GTO", make: "MITSUBISHI", model: "GTO", year_min: 1990, year_max: 2000, label: "GTO" },
  { group: "Sports & performance", name: "Mercedes E55 AMG (W211)", make: "MERCEDES", model: "E-Class", year_min: 2003, year_max: 2006, label: "E55 AMG" },
  { group: "Sports & performance", name: "Mercedes E63 AMG (W211)", make: "MERCEDES", model: "E-Class", year_min: 2006, year_max: 2009, label: "E63 AMG" },
  // SUV, 4x4 & people movers
  { group: "SUV, 4x4 & people movers", name: "Toyota Land Cruiser", make: "TOYOTA", model: "LAND CRUISER", label: "Land Cruiser" },
  { group: "SUV, 4x4 & people movers", name: "Toyota Land Cruiser Prado", make: "TOYOTA", model: "LAND CRUISER PRADO", label: "Prado" },
  { group: "SUV, 4x4 & people movers", name: "Toyota Hilux", make: "TOYOTA", model: "HILUX", label: "Hilux" },
  { group: "SUV, 4x4 & people movers", name: "Toyota Hilux Surf", make: "TOYOTA", model: "HILUX SURF", label: "Hilux Surf" },
  { group: "SUV, 4x4 & people movers", name: "Toyota Harrier", make: "TOYOTA", model: "HARRIER", label: "Harrier" },
  { group: "SUV, 4x4 & people movers", name: "Toyota Alphard", make: "TOYOTA", model: "ALPHARD", label: "Alphard" },
  { group: "SUV, 4x4 & people movers", name: "Nissan Elgrand", make: "NISSAN", model: "ELGRAND", label: "Elgrand" },
  { group: "SUV, 4x4 & people movers", name: "Mitsubishi Delica D5", make: "MITSUBISHI", model: "DELICA D5", label: "Delica D5" },
  { group: "SUV, 4x4 & people movers", name: "Mitsubishi Pajero", make: "MITSUBISHI", model: "PAJERO", label: "Pajero" },
  { group: "SUV, 4x4 & people movers", name: "Subaru Forester", make: "SUBARU", model: "FORESTER", label: "Forester" },
  // Daily, kei & convertible
  { group: "Daily, kei & convertible", name: "Toyota Aqua", make: "TOYOTA", model: "AQUA", label: "Aqua" },
  { group: "Daily, kei & convertible", name: "Toyota Prius", make: "TOYOTA", model: "PRIUS", label: "Prius" },
  { group: "Daily, kei & convertible", name: "Mazda Roadster (MX-5)", make: "MAZDA", model: "ROADSTER", label: "MX-5 Roadster" },
  { group: "Daily, kei & convertible", name: "Honda Beat", make: "HONDA", model: "BEAT", label: "Beat" },
  { group: "Daily, kei & convertible", name: "Suzuki Jimny", make: "SUZUKI", model: "JIMNY", label: "Jimny" },
  { group: "Daily, kei & convertible", name: "Suzuki Cappuccino", make: "SUZUKI", model: "CAPPUCCINO", label: "Cappuccino" },
  { group: "Daily, kei & convertible", name: "Suzuki Swift Sport", make: "SUZUKI", model: "SWIFT SPORTS", label: "Swift Sport" },
];

// Dropdown that fills a wishlist form from a preset. Works on any wishlist form
// (matches inputs by name, relative to the form).
function presetSelect() {
  // Group the presets into <optgroup>s while keeping each option's value as its
  // original index into WL_PRESETS (jdmPreset reads that index).
  const groups = [];
  WL_PRESETS.forEach((p, i) => {
    let g = groups.find((x) => x.name === p.group);
    if (!g) { g = { name: p.group || "Presets", items: [] }; groups.push(g); }
    g.items.push({ p, i });
  });
  const opts = groups.map((g) =>
    `<optgroup label="${esc(g.name)}">${g.items.map(({ p, i }) => `<option value="${i}">${esc(p.name)}</option>`).join("")}</optgroup>`
  ).join("");
  return `<div style="margin-bottom:14px;max-width:430px"><label>Quick preset <span class="opt">(optional shortcut for a known model)</span></label>
    <select onchange="jdmPreset(this)"><option value="">No preset</option>${opts}</select></div>`;
}
function presetScript() {
  return `<script>var WL_PRESETS=${JSON.stringify(WL_PRESETS)};function jdmPreset(sel){
    var form=sel.closest("form")||document;
    function set(n,v){var el=form.querySelector('[name="'+n+'"]');if(el)el.value=(v==null?"":v);}
    var p=WL_PRESETS[sel.value];
    // Clear the search fields first so switching presets (or 'No preset') never
    // leaves stale values behind.
    set("model_name","");set("kuzov","");set("year_min","");set("year_max","");set("label","");
    var mk=form.querySelector('[name="marka_name"]');
    if(!p){if(mk)mk.value="";if(window.jdmLoadModels)window.jdmLoadModels("");return;}
    if(mk){if(mk.tagName==="SELECT"){var want=(p.make||"").toUpperCase();var tok=want.split(/[\\s-]+/)[0];var opt=null;for(var i=0;i<mk.options.length;i++){var ov=(mk.options[i].value||"").toUpperCase();if(ov===want){opt=mk.options[i];break;}if(!opt&&tok&&ov.indexOf(tok)>=0){opt=mk.options[i];}}mk.value=opt?opt.value:"";}else{mk.value=p.make||"";}}
    // Model is a <select> on the public form (load + select) or a text input on
    // the staff form (set directly).
    var modelEl=form.querySelector('[name="model_name"]');
    if(modelEl&&modelEl.tagName==="SELECT"&&window.jdmLoadModels){window.jdmLoadModels(p.model||"");}
    else{set("model_name",p.model);}
    set("kuzov",p.kuzov);set("year_min",p.year_min);set("year_max",p.year_max);set("label",p.label);
  }</script>`;
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
    --ink:#F4F2EC;--t2:#C9CCD1;--t3:#9BA0A7;--faint:#888D95;--ph:#8A909A;--bg:#0F1115;--bg-2:#0A0C0F;--card:#171A20;--card-2:#1C2027;--off:#13161B;--hair:rgba(255,255,255,0.08);--hair-2:rgba(255,255,255,0.05);
    --field:#1B1F26;--field-line:rgba(255,255,255,0.14);--field-focus:#20242C;--hover:rgba(255,255,255,0.05);--soft:rgba(255,255,255,0.06);--bad:#E2607A;--bad-bg:rgba(226,96,122,0.12);--bad-line:rgba(226,96,122,0.34);
    --ok-bg:rgba(91,192,140,0.14);--ok-fg:#7FD3A6;--warn-bg:rgba(224,169,75,0.16);--warn-fg:#E9BE6B;--neu-bg:rgba(255,255,255,0.06);--neu-fg:#C9CCD1;
    --str-bg:rgba(91,192,140,0.14);--str-fg:#7FD3A6;--good-bg:rgba(224,169,75,0.16);--good-fg:#E9BE6B;--pos-bg:rgba(255,255,255,0.06);--pos-fg:#AEB3BA;
    --elig-bg:rgba(91,192,140,0.14);--elig-fg:#7FD3A6;--echk-bg:rgba(224,169,75,0.16);--echk-fg:#E9BE6B;--eno-bg:rgba(226,96,122,0.13);--eno-fg:#E2607A;
    --r:8px;--r-card:12px;}
  .skip-link{position:absolute;left:-9999px;top:0}
  .skip-link:focus{left:8px;top:8px;z-index:100;background:#fff;color:#111;padding:8px 12px;border-radius:8px}
  /* Light workspace: the sidebar (.side) keeps the dark brand from :root, while
     the main content area runs a light palette. Only tokens that differ from the
     dark root are overridden here; gold and radii are shared. */
  .main{
    color:var(--ink);
    --ink:#1b1c1e;--t2:#5b606a;--t3:#6b7079;--faint:#656a73;--ph:#6C727C;
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
  .side-search{position:relative;margin-bottom:16px}
  .side-search .ss-ic{position:absolute;left:11px;top:50%;transform:translateY(-50%);display:flex;color:var(--faint);pointer-events:none}
  .side-search .ss-ic svg{width:15px;height:15px}
  .side-search input[type=search]{width:100%;padding:9px 12px 9px 34px;border:1px solid var(--hair);border-radius:9px;background:var(--card);color:var(--ink);font-size:13px;font-family:inherit}
  .side-search input[type=search]:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 3px var(--gold-tint)}
  .nav{margin-top:0;display:flex;flex-direction:column;gap:2px}
  .nav a,.nav span.active{display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:6px;font-size:15px;color:var(--t2)}
  .nav a .bar,.nav span.active .bar{width:3px;height:17px;border-radius:2px;background:transparent}
  .nav a .lbl,.nav span.active .lbl{flex:1}
  .nav a .ct{font-size:13px;color:var(--faint);font-weight:500}
  .nav a.active,.nav span.active{background:var(--gold-tint);color:var(--ink);font-weight:600}
  .nav a.active .bar,.nav span.active .bar{background:var(--gold)}
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
  .content.dash{width:100%;max-width:2040px;margin-left:auto;margin-right:auto}
  .card{background:var(--card);border:1px solid var(--hair);border-radius:8px;padding:24px 26px;margin-bottom:24px}
  .card h2{font-size:16px;font-weight:600;margin:0 0 20px;display:flex;align-items:center;gap:11px;border-bottom:1px solid var(--hair);padding-bottom:16px}
  .card h2 .num{color:var(--gold);font-weight:700}
  details.foldcard>summary{font-size:16px;font-weight:600;display:flex;align-items:center;gap:11px;cursor:pointer;list-style:none;margin:0}
  details.foldcard>summary::-webkit-details-marker{display:none}
  details.foldcard>summary::after{content:"+";margin-left:auto;color:var(--gold);font-weight:700;font-size:21px;line-height:1;transition:transform .15s}
  details.foldcard[open]>summary{border-bottom:1px solid var(--hair);padding-bottom:16px;margin-bottom:20px}
  details.foldcard[open]>summary::after{transform:rotate(45deg)}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px 22px}
  .grid2{display:grid;grid-template-columns:repeat(2,1fr);gap:18px 22px}
  label{display:block;font-size:12px;color:var(--t2);margin-bottom:7px;font-weight:600;letter-spacing:0.02em}
  label .opt{color:var(--faint);font-weight:400;text-transform:none;letter-spacing:0}
  input,select{width:100%;padding:11px 13px;border:1px solid var(--field-line);border-radius:5px;font-size:14px;background:var(--field);color:var(--ink);font-family:${FONT}}
  input::placeholder{color:var(--ph)}
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
  .toggle:has(input:checked){background:var(--gold-tint);border-color:var(--gold-line)}
  .set-nav{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:22px}
  .set-nav a{font-size:12.5px;font-weight:600;color:var(--t2);background:var(--field);border:1px solid var(--field-line);border-radius:9999px;padding:7px 14px;text-decoration:none}
  .set-nav a:hover{color:var(--ink);border-color:var(--gold-line)}
  .set-card{scroll-margin-top:24px}
  .set-disc{margin-top:14px;font-size:13px}
  .set-disc summary{cursor:pointer;color:var(--gold-txt);font-weight:600;list-style:none}
  .set-disc summary::-webkit-details-marker{display:none}
  .save-bar{position:sticky;bottom:0;background:var(--bg);border-top:1px solid var(--hair);padding:14px 0;display:flex;justify-content:flex-end;z-index:5}
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
  .dupnote{margin-bottom:18px;padding:13px 16px;background:var(--gold-tint);border:1px solid var(--gold-line);border-left:4px solid var(--gold);border-radius:6px;color:var(--ink);font-size:14px;line-height:1.45}
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
    .grid2{grid-template-columns:1fr}
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
  select.mctl{width:auto;padding:9px 28px 9px 11px;border:1px solid var(--field-line);border-radius:7px;font-size:13.5px;background:var(--field);color:var(--t2);cursor:pointer;font-family:inherit}
  /* Mobile: the filter selects used to each go full-width, stacking into ~5 tall
     rows and eating ~40% of the viewport before any cars showed. Sit them 2-up
     and keep the strength chips on one horizontally-scrollable row instead. */
  @media(max-width:640px){
    .crow{gap:8px}
    select.mctl{flex:1 1 calc(50% - 4px);min-width:0;width:auto}
    .fchips{flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px;scrollbar-width:none}
    .fchips::-webkit-scrollbar{display:none}
    .fchips .fchip,.fchips .quick{flex:0 0 auto}
    .mtools{padding-bottom:8px}
  }
  /* Mobile QA pass: wide data tables scroll (not clip) on phones; match cards'
     multi-select checkbox works on touch (no hover); the match bulk bar and the
     client-detail header wrap instead of overflowing on small screens. */
  @media(max-width:640px){.sortable{min-width:560px}}
  @media(max-width:920px){.mcard .msel,.scard .msel{display:block;width:26px;height:26px}}
  @media(max-width:560px){.bulkbar2{flex-wrap:wrap;gap:8px}.bulkbar2 .bsp{display:none}.bulkbar2 .bap,.bulkbar2 .bsk,.bulkbar2 .bdel{flex:1 1 auto}}
  @media(max-width:560px){.cd-head{flex-wrap:wrap}.cd-owner{text-align:left;flex-basis:100%;margin-top:8px}}
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
  .bulkbar2 .bdel{background:transparent;color:#ff9a9a;border:1px solid rgba(255,120,120,.4)}
  .bulkbar2 .bdel:hover{background:rgba(177,18,38,.25);color:#fff;border-color:rgba(255,120,120,.7)}
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
  .why .wc.lead{color:#3B5E96;background:rgba(59,115,172,0.10);border-color:rgba(59,115,172,0.34)}
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
  a.ov-link{text-decoration:none;color:inherit;cursor:pointer}
  a.ov-link:hover .num{text-decoration:underline;text-decoration-color:var(--gold);text-underline-offset:4px}
  a.ov-link:hover .cap{color:var(--ink)}
  .sec-h{display:flex;align-items:center;justify-content:space-between;margin:0 0 10px}
  .sec-h h2{font-size:17px;font-weight:600;margin:0}
  .sec-h h2 .ct{color:var(--faint);font-weight:400}
  .sec-h .btn-gold{display:inline-flex;align-items:center;gap:6px}
  .sec-h .btn-gold svg{width:15px;height:15px}
  .dcols{display:grid;grid-template-columns:1fr;gap:8px 24px;align-items:start}
  @media(min-width:1100px){.dcols{grid-template-columns:1fr 1fr}}
  .list{background:var(--card);border:1px solid var(--hair);border-radius:var(--r-card);overflow:hidden;margin-bottom:30px}
  a.lrow{text-decoration:none;color:inherit}
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
     row layout, so keep them stacked so the Year/Grade/Odo/Bid strip never clips. */
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
  .ld-actions{display:flex;gap:10px;margin:16px 0 20px}
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
  .ld-sheet-link{position:relative;display:block;border-radius:10px;overflow:hidden;border:1px solid var(--hair);background:var(--off);line-height:0;aspect-ratio:3/2}
  .ld-sheet-img{display:block;width:100%;height:100%;object-fit:contain}
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
  requests: svgIcon(`<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3.5h6V6H9z"/><path d="M8.5 11h7M8.5 15h4"/>`),
  tasks: svgIcon(`<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1.2 1.2L7.5 5"/><path d="M4 12l1.2 1.2L7.5 11"/><path d="M4 18l1.2 1.2L7.5 17"/>`),
  wishlists: svgIcon(`<path d="M12 21C12 21 4 13.7 4 8.6A4.6 4.6 0 0 1 12 6a4.6 4.6 0 0 1 8 2.6C20 13.7 12 21 12 21Z"/>`),
  matches: svgIcon(`<path d="M4 13h4l2 3h4l2-3h4"/><path d="M5 13l1.6-7a2 2 0 0 1 2-1.6h6.8a2 2 0 0 1 2 1.6L19 13v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z"/>`),
  auctions: svgIcon(`<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>`),
  trash: svgIcon(`<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/>`),
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
    <form class="side-search" method="GET" action="/admin" role="search">
      <input type="hidden" name="view" value="search">
      <span class="ss-ic" aria-hidden="true">${ICONS.auctions}</span>
      <input type="search" name="q" placeholder="Search customers, vehicles, chassis, lots…" aria-label="Global search" autocomplete="off">
    </form>
    <nav class="nav">
      ${item("dashboard", "Dashboard", "")}
      ${item("requests", "Requests", counts.requests || "")}
      ${item("tasks", "Tasks", counts.tasks || "")}
      ${item("matches", "Matches", counts.matches || "")}
      ${item("clients", "Customers", counts.clients)}
      ${item("auctions", "Auctions", "")}
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
  clients: { kicker: "Vehicle Finder", title: "Customers", sub: "Your buyer directory.", btn: "Add client" },
  requests: { kicker: "Vehicle Finder", title: "Requests", sub: "Every active vehicle search and where it sits in the pipeline.", btn: "" },
  tasks: { kicker: "Vehicle Finder", title: "Tasks", sub: "What needs doing today, and what's overdue.", btn: "" },
  wishlists: { kicker: "Vehicle Finder", title: "Wishlists", sub: "Search criteria matched against the live auction feed.", btn: "Add client" },
  matches: { kicker: "Vehicle Finder", title: "Matches", sub: "Auction lots matched to your clients' searches.", btn: "Search again" },
  auctions: { kicker: "Vehicle Finder", title: "Auctions", sub: "Search live lots and look up sold-price history.", btn: "" },
  agents: { kicker: "Vehicle Finder", title: "Agents", sub: "Logins that find cars for their own clients.", btn: "Search auctions" },
  payments: { kicker: "Vehicle Finder", title: "Payments", sub: "Deposits taken through the buyer portal via Stripe.", btn: "" },
  settings: { kicker: "Vehicle Finder", title: "Settings", sub: "Manage alerts, client-facing pricing, payments and AI reading.", btn: "" },
  search: { kicker: "Vehicle Finder", title: "Search", sub: "Results across customers, requests, matches and payments.", btn: "" },
};

// Global search across the objects a session can see: customers, their requests
// (wishlists), matched lots, and payments. LIKE-based, scoped by accessScope.
async function adminSearch(env, session, q) {
  q = String(q || "").trim();
  const out = { q, clients: [], requests: [], matches: [], payments: [] };
  if (q.length < 2) return out;
  const acc = accessScope(session);
  const like = `%${q.replace(/[%_\\]/g, "")}%`;
  out.clients = (await env.DB.prepare(
    `SELECT c.id, c.name, c.email, c.state FROM clients c WHERE ${acc.sql} AND (c.name LIKE ? OR c.email LIKE ? OR c.whatsapp LIKE ?) ORDER BY c.name LIMIT 25`
  ).bind(...acc.binds, like, like, like).all()).results || [];
  out.requests = (await env.DB.prepare(
    `SELECT w.id, w.label, w.marka_name, w.model_name, w.kuzov, c.id AS client_id, c.name AS client_name
       FROM wishlists w JOIN clients c ON c.id = w.client_id
      WHERE ${acc.sql} AND (w.marka_name LIKE ? OR w.model_name LIKE ? OR w.kuzov LIKE ? OR w.label LIKE ?) ORDER BY c.name LIMIT 25`
  ).bind(...acc.binds, like, like, like, like).all()).results || [];
  out.matches = (await env.DB.prepare(
    `SELECT q.id, q.lot_id, q.status, c.id AS client_id, c.name AS client_name
       FROM queue q JOIN clients c ON c.id = q.client_id
      WHERE ${acc.sql} AND (q.lot_id LIKE ? OR q.lot_json LIKE ?) ORDER BY q.created_at DESC LIMIT 25`
  ).bind(...acc.binds, like, like).all()).results || [];
  if (session.role === "admin") {
    out.payments = (await env.DB.prepare(
      `SELECT p.id, p.amount_cents, p.currency, p.status, p.description, c.name AS client_name
         FROM payments p LEFT JOIN clients c ON c.id = p.client_id
        WHERE (c.name LIKE ? OR p.description LIKE ? OR p.stripe_session LIKE ?) ORDER BY p.created_at DESC LIMIT 25`
    ).bind(like, like, like).all()).results || [];
  }
  return out;
}

// Search results page: grouped, scannable, each row links to the right place.
function searchView(res) {
  const q = res.q || "";
  if (q.length < 2) return `<div class="card"><div class="empty">Type at least two characters to search.</div></div>`;
  const total = res.clients.length + res.requests.length + res.matches.length + res.payments.length;
  if (!total) return `<div class="card"><div class="empty"><div class="rule"></div>No matches for &ldquo;${esc(q)}&rdquo;. Try a name, email, make, model, chassis code or lot number.</div></div>`;
  const grp = (title, n, rowsHtml) => n ? `<div class="psec"><h2>${title}<span class="ct">${n}</span></h2></div><div class="card" style="padding:0;overflow-x:auto;-webkit-overflow-scrolling:touch"><table>${rowsHtml}</table></div>` : "";
  const clientRows = res.clients.map((c) => `<tr><td>${avatar(c.name)}<a class="clink" href="/admin?view=client&id=${c.id}" data-drawer="/admin/drawer?id=${c.id}">${esc(c.name)}</a></td><td>${esc(c.email || "-")}</td><td>${esc(c.state || "-")}</td></tr>`).join("");
  const reqRows = res.requests.map((w) => `<tr><td><a class="clink" href="/admin?view=client&id=${w.client_id}">${esc(displayName([w.marka_name, w.model_name].filter(Boolean).join(" ")) || w.label || "Search")}</a>${w.kuzov ? ` <span class="chip muted">${esc(w.kuzov)}</span>` : ""}</td><td>${esc(w.client_name)}</td></tr>`).join("");
  const chip = (s) => `<span class="chip muted">${esc(s || "-")}</span>`;
  const aud = (cents, cur) => `${String(cur || "aud").toUpperCase()} $${(Number(cents || 0) / 100).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`;
  const matchRows = res.matches.map((m) => `<tr><td><a class="clink" href="/admin?view=lot&id=${esc(m.lot_id)}">Lot ${esc(m.lot_id)}</a></td><td>${esc(m.client_name)}</td><td>${chip(m.status)}</td></tr>`).join("");
  const payRows = res.payments.map((p) => `<tr><td>${esc(p.client_name || "-")}</td><td>${aud(p.amount_cents, p.currency)}</td><td>${esc(p.description || "-")}</td><td>${chip(p.status)}</td></tr>`).join("");
  return `${grp("Customers", res.clients.length, clientRows)}${grp("Requests", res.requests.length, reqRows)}${grp("Matches", res.matches.length, matchRows)}${grp("Payments", res.payments.length, payRows)}`;
}

// Customer drawer fragment: a compact side-panel view of a client (info, request
// summary, recent matches and payments), loaded by the shell's drawer script so
// clicking a customer previews them without leaving the list. Access-scoped:
// returns "not found" for a client this session can't see.
export async function clientDrawerFragment(env, clientId, session = { role: "admin", id: 0 }) {
  const id = Number(clientId);
  const acc = accessScope(session);
  const c = await env.DB.prepare(`SELECT c.* FROM clients c WHERE c.id = ? AND ${acc.sql}`).bind(id, ...acc.binds).first();
  if (!c) return `<div class="dw-empty">Customer not found, or you don't have access.</div>`;
  const wls = (await env.DB.prepare("SELECT * FROM wishlists WHERE client_id = ? ORDER BY active DESC, id DESC").bind(id).all()).results || [];
  const matches = (await env.DB.prepare("SELECT id, lot_id, status, created_at, sent_at, viewed_at, response, lot_json FROM queue WHERE client_id = ? ORDER BY created_at DESC LIMIT 6").bind(id).all()).results || [];
  const pays = (await env.DB.prepare("SELECT amount_cents, currency, status, created_at FROM payments WHERE client_id = ? ORDER BY created_at DESC LIMIT 5").bind(id).all()).results || [];
  // Engagement roll-up across ALL their matches (not just the recent 6) so the
  // panel answers "have we sent examples, and did they open them?" at a glance.
  const eng = (await env.DB.prepare(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN sent_at IS NOT NULL THEN 1 ELSE 0 END) AS sent,
            SUM(CASE WHEN viewed_at IS NOT NULL THEN 1 ELSE 0 END) AS viewed,
            MAX(viewed_at) AS last_viewed
       FROM queue WHERE client_id = ?`
  ).bind(id).first()) || {};

  const info = [
    ["Email", c.email], ["Phone", c.whatsapp], ["State", c.state],
    ["Member", c.member ? "Yes &middot; auction access" : "No"],
    ["Portal", c.portal_enabled ? "Enabled" : "Not enabled"],
    ["Examples sent", Number(eng.sent) ? `${eng.sent}${Number(eng.viewed) ? ` &middot; ${eng.viewed} viewed` : " &middot; none opened yet"}` : null],
    ["Last viewed", eng.last_viewed ? String(eng.last_viewed).slice(0, 10) : null],
    ["Last login", c.last_seen ? String(c.last_seen).slice(0, 10) : null],
  ].filter(([, v]) => v).map(([k, v]) => `<div class="dw-row"><span class="dw-k">${k}</span><span class="dw-v">${v}</span></div>`).join("");

  const wlList = wls.length
    ? wls.map((w) => `<div class="dw-item"><div class="dw-item-t">${esc(displayName([w.marka_name, w.model_name].filter(Boolean).join(" ")) || w.label || "Search")}</div><div class="dw-item-s">${esc(yearRange(w.year_min, w.year_max))}${w.active ? "" : " &middot; paused"}</div></div>`).join("")
    : `<div class="dw-empty-sm">No searches yet.</div>`;
  // Per-match: show the match strength (how good a fit) and the engagement stage
  // (sent / viewed / interested) — the two things that help close the client.
  const mList = matches.length
    ? matches.map((m) => {
        let lot = {}; try { lot = JSON.parse(m.lot_json || "{}"); } catch (e) {}
        const strength = lot._strength ? `<span class="dw-str dw-str-${String(lot._strength).toLowerCase()}">${esc(lot._strength)} match</span>` : "";
        const stage = m.response === "interested" ? `<span class="eng eng-viewed">Interested</span>`
          : m.viewed_at ? `<span class="eng eng-viewed">Viewed</span>`
          : m.sent_at ? `<span class="eng eng-sent">Sent</span>`
          : `<span class="chip muted">${esc(m.status)}</span>`;
        return `<div class="dw-item"><div class="dw-item-t"><a class="clink" href="/admin?view=lot&id=${esc(m.lot_id)}">Lot ${esc(m.lot_id)}</a></div><div class="dw-item-s">${stage}${strength} &middot; ${esc(String(m.created_at || "").slice(0, 10))}</div></div>`;
      }).join("")
    : `<div class="dw-empty-sm">No matches yet.</div>`;
  const pList = pays.length
    ? pays.map((p) => `<div class="dw-item"><div class="dw-item-t">${String(p.currency || "aud").toUpperCase()} $${(Number(p.amount_cents || 0) / 100).toLocaleString("en-AU", { minimumFractionDigits: 2 })}</div><div class="dw-item-s"><span class="chip muted">${esc(p.status)}</span> &middot; ${esc(String(p.created_at || "").slice(0, 10))}</div></div>`).join("")
    : `<div class="dw-empty-sm">No payments.</div>`;

  return `
    <div class="dw-head">
      <div class="dw-id">${avatar(c.name)}<div><div class="dw-name">${esc(c.name)}</div><div class="dw-sub">Customer #${c.id}</div></div></div>
      <a class="btn-gold dw-open" href="/admin?view=client&id=${c.id}">Open full profile</a>
    </div>
    ${c.email || c.whatsapp ? `<div class="dw-cta">${c.whatsapp ? `<a class="dw-cta-b" href="https://wa.me/${esc(String(c.whatsapp).replace(/[^0-9]/g, ""))}" target="_blank" rel="noopener">WhatsApp</a><a class="dw-cta-b" href="tel:${esc(String(c.whatsapp).replace(/[^0-9+]/g, ""))}">Call</a>` : ""}${c.email ? `<a class="dw-cta-b" href="mailto:${esc(c.email)}">Email</a>` : ""}</div>` : ""}
    ${info ? `<div class="dw-card">${info}</div>` : ""}
    <div class="dw-sec">Requests <span class="ct">${wls.length}</span></div><div class="dw-list">${wlList}</div>
    <div class="dw-sec">Recent matches <span class="ct">${matches.length}</span></div><div class="dw-list">${mList}</div>
    <div class="dw-sec">Payments <span class="ct">${pays.length}</span></div><div class="dw-list">${pList}</div>`;
}

export async function adminPage(env, view = "dashboard", session = { role: "admin", id: 0 }, opts = {}) {
  const isAgent = session.role === "agent";
  if (!HEADERS[view]) view = "dashboard";
  if (view === "wishlists") view = "clients"; // searches now live inside the client
  if (["agents", "settings", "payments"].includes(view) && isAgent) view = "dashboard"; // admin-only areas

  // Rows this session may see: all for admin, owned-or-shared for an agent.
  const acc = accessScope(session);
  const run = (sql) => { const s = env.DB.prepare(sql); return acc.binds.length ? s.bind(...acc.binds) : s; };

  const showArchived = !!opts.showArchived;
  const clients = (await run(`SELECT * FROM clients c WHERE ${acc.sql}${showArchived ? "" : " AND c.archived = 0"} ORDER BY name`).all()).results || [];
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
  // Deposits outstanding: requests whose deposit is requested but not yet paid.
  const deposits = (view === "payments" && !isAgent)
    ? (await env.DB.prepare(
        `SELECT w.id, w.deposit_status, w.status, w.last_activity, w.marka_name, w.model_name, c.name AS client_name, c.id AS client_id
           FROM wishlists w JOIN clients c ON c.id = w.client_id
          WHERE w.deposit_status = 'requested' ORDER BY COALESCE(w.last_activity, w.created_at) ASC LIMIT 100`
      ).all()).results || []
    : [];
  // Tasks board, scoped to this session.
  const tasks = (view === "tasks") ? await tasksData(env, session) : [];
  // Requests view: each wishlist as a pipeline request, with its owner's name.
  const requests = (view === "requests") ? ((await run(
    `SELECT w.*, c.name AS client_name, c.state AS client_state, ow.name AS owner_name,
            (SELECT COUNT(*) FROM queue q WHERE q.wishlist_id = w.id AND q.sent_at IS NOT NULL) AS sent_count,
            (SELECT COUNT(*) FROM queue q WHERE q.wishlist_id = w.id AND q.viewed_at IS NOT NULL) AS viewed_count
       FROM wishlists w JOIN clients c ON c.id = w.client_id
       LEFT JOIN agents ow ON ow.id = w.owner_id
      WHERE ${acc.sql} ORDER BY COALESCE(w.last_activity, w.created_at) DESC LIMIT 500`
  ).all()).results || []) : [];
  const matchSettings = view === "matches" ? await getSettings(env) : null;
  if (isAgent) {
    const me = await env.DB.prepare("SELECT name FROM agents WHERE id = ?").bind(session.id).first();
    session = { ...session, name: me ? me.name : "Agent" };
  }

  const agentTotal = !isAgent ? ((await env.DB.prepare("SELECT COUNT(*) AS n FROM agents WHERE active = 1").first())?.n || 0) : 0;
  // Sidebar Tasks badge: open tasks that are overdue or due today, scoped.
  const tsc = taskScope(session);
  const taskBadge = ((await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM tasks t LEFT JOIN clients c ON c.id = t.client_id WHERE t.status != 'done' AND t.due_date IS NOT NULL AND t.due_date <= date('now') AND ${tsc.sql}`
  ).bind(...tsc.binds).first())?.n) || 0;
  const counts = { clients: clients.length, wishlists: wishlists.length, requests: wishlists.length, matches: pending.length, agents: agentTotal, tasks: taskBadge };
  const h = HEADERS[view];
  const primary = view === "matches" || view === "intake"
    ? `<a class="btn-dark" href="/run">${esc(h.btn)}</a>`
    : ["agents", "settings", "payments", "auctions"].includes(view)
    ? ""
    : h.btn ? `<a class="btn-dark" href="/admin?view=intake">${esc(h.btn)}</a>` : "";

  const makers = view === "intake" ? await distinctMakers(env) : [];
  let body = "";
  if (view === "dashboard") body = dashboardView(session, await dashboardData(env, session));
  else if (view === "intake") body = intakeView(clients, makers, { err: opts.err });
  else if (view === "clients") body = clientsView(clients, wishlists, { session, agents: shareAgents, shares: sharesByClient, showArchived });
  else if (view === "wishlists") body = wishlistsView(wishlists);
  else if (view === "matches") body = matchesView(pending, { settings: matchSettings, aiEnabled: !!env.ANTHROPIC_API_KEY });
  else if (view === "agents") body = agentsView(agents);
  else if (view === "auctions") body = await adminAuctionsPage(env, session, opts);
  else if (view === "payments") body = paymentsView(payments, { stripeSecret: !!env.STRIPE_SECRET_KEY, deposits });
  else if (view === "settings") body = settingsView(settings, { stripeSecret: !!env.STRIPE_SECRET_KEY, publicUrl: env.PUBLIC_URL, aiKey: !!env.ANTHROPIC_API_KEY, waConfigured: whatsappConfigured(env) });
  else if (view === "search") body = searchView(await adminSearch(env, session, opts.q || ""));
  else if (view === "requests") body = requestsView(requests);
  else if (view === "tasks") body = tasksView(tasks);

  // The dashboard is its own hero: no standard page header, the greeting leads.
  const wide = view === "matches" || view === "auctions";
  const main = view === "dashboard"
    ? `<div class="content dash">${body}</div>`
    : `
    <div class="topbar${view === "matches" ? " unstick wide" : view === "auctions" ? " wide" : ""}">
      <div>
        <div class="kicker">${esc(h.kicker)}</div>
        <h1>${esc(h.title)}</h1>
        <p class="subline">${esc(h.sub)}</p>
      </div>
      ${primary}
    </div>
    <div class="content${wide ? " wide" : ""}">${body}</div>`;

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
        ${rowMenu([
          { label: invited ? "Resend invite" : "Reset password", action: "/agent/invite", id: a.id },
          { sep: true },
          { label: "Delete", action: "/agent/delete", id: a.id, confirm: "Delete this agent and ALL their clients, searches and matches? This cannot be undone.", icon: ICONS.trash, danger: true },
        ])}
      </td>
    </tr>`;
  }).join("") || `<tr><td colspan="7" class="empty">No agents yet</td></tr>`;
  return `
    <div class="card">
      <h2><span class="num">+</span> New agent</h2>
      <form method="POST" action="/agent">
        <div class="grid">
          <div><label for="ag-name">Name</label><input id="ag-name" name="name" placeholder="Agent name" required></div>
          <div><label for="ag-email">Email <span class="opt">(login + alerts)</span></label><input id="ag-email" name="email" type="email" spellcheck="false" placeholder="agent@email.com" required></div>
          <div><label for="ag-company">Company <span class="opt">(optional)</span></label><input id="ag-company" name="company" placeholder="e.g. Ofuka"></div>
        </div>
        <div class="actions"><button class="btn-gold" type="submit">Create &amp; send invite</button>
          <span class="help">They get an email to set their own password, then see only their own clients and matches.</span></div>
      </form>
    </div>
    ${tableToolbar("agentsTbl", "Search agents by name, email or company…", "jdm-agents")}
    <div class="card" style="padding:0;overflow-x:auto;-webkit-overflow-scrolling:touch">
      <table id="agentsTbl" class="sortable"><tr><th>Agent</th><th>Email</th><th>Company</th><th style="text-align:right">Clients</th><th>Alerts</th><th>Status</th><th></th></tr>${rows}</table></div>`;
}

// Admin-only: editable alert email + notification toggles.
function toggleRow(name, title, desc, on) {
  return `<label class="toggle"><input type="checkbox" name="${name}"${on ? " checked" : ""}><span class="tg-txt"><span class="tg-title">${esc(title)}</span><span class="tg-desc">${esc(desc)}</span></span></label>`;
}
function settingsView(settings, opts = {}) {
  const s = settings || {};
  const stripeSecret = !!opts.stripeSecret;
  const waConfigured = !!opts.waConfigured;
  const webhookUrl = (opts.publicUrl || "") + "/webhooks/stripe";
  const aiOpts = (sel, map, dflt) => Object.entries(map).map(([id, label]) => `<option value="${id}"${(sel || dflt) === id ? " selected" : ""}>${esc(label)}</option>`).join("");
  return `
    <form method="POST" action="/settings">
      <nav class="set-nav" aria-label="Settings sections">
        <a href="#set-notifications">Notifications</a>
        <a href="#set-whatsapp">WhatsApp</a>
        <a href="#set-client">Client-facing</a>
        <a href="#set-payments">Payments</a>
        <a href="#set-pricing">Pricing</a>
        <a href="#set-ai">AI reader</a>
      </nav>

      <div class="card set-card" id="set-notifications">
        <h2><span class="num">1</span> Notifications</h2>
        <div style="max-width:640px">
          <label for="set-digest">Alert email <span class="opt">(where new-match alerts are sent)</span></label>
          <input id="set-digest" name="digest_email" type="email" value="${esc(s.digest_email || "")}" placeholder="support@jdmconnect.com.au">
          <div class="toggles">
            ${toggleRow("request_alerts", "Email me new vehicle requests", "Email me when someone submits the public request form.", settingOn(s, "request_alerts"))}
            ${toggleRow("email_alerts", "Email me match alerts", "Send a digest email when new matches are found.", settingOn(s, "email_alerts"))}
            ${toggleRow("send_to_client", "Email matches to clients on approval", "Email the car to the client when you approve a match.", settingOn(s, "send_to_client"))}
          </div>
        </div>
      </div>

      <div class="card set-card" id="set-whatsapp">
        <h2><span class="num">2</span> WhatsApp <span class="opt" style="font-weight:400">&middot; auto-send matches</span></h2>
        <div style="max-width:640px">
          <p class="help" style="margin:0 0 14px">Also deliver approved matches over WhatsApp (on top of email) to clients who left a number. ${waConfigured ? "Provider detected." : "<strong>No provider configured yet</strong> -add the Twilio or Meta secrets first, then turn this on."} Automated matches send via your approved message template.</p>
          <div class="toggles" style="margin-top:0">
            ${toggleRow("whatsapp_enabled", "Send matches to clients on WhatsApp", "When you approve a match, also WhatsApp it to the client if they gave a number.", settingOn(s, "whatsapp_enabled"))}
          </div>
          <div class="grid2" style="margin-top:16px">
            <div><label for="set-wa-provider">Provider</label>
              <select id="set-wa-provider" name="whatsapp_provider">
                <option value="twilio"${(s.whatsapp_provider || "twilio") === "twilio" ? " selected" : ""}>Twilio</option>
                <option value="meta"${s.whatsapp_provider === "meta" ? " selected" : ""}>Meta (Cloud API)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="card set-card" id="set-client">
        <h2><span class="num">3</span> Client-facing visibility</h2>
        <div class="toggles" style="max-width:640px;margin-top:4px">
          ${toggleRow("client_landed", "Show landed (AUD) price to clients", "Show the indicative AUD landed price to clients.", settingOn(s, "client_landed"))}
          ${toggleRow("market_for_clients", "Show recent market average to clients", "Show the recent market-average price to clients (members).", settingOn(s, "market_for_clients"))}
        </div>
      </div>

      <div class="card set-card" id="set-payments">
        <h2><span class="num">4</span> Payments <span class="opt" style="font-weight:400">&middot; Stripe</span></h2>
        <div style="max-width:640px">
          <p class="help" style="margin:0 0 14px">Take a deposit from buyers in their portal. ${stripeSecret ? "Stripe key detected." : "<strong>No Stripe key set yet</strong> -deposits stay off until the <code>STRIPE_SECRET_KEY</code> secret is added."}</p>
          <div class="toggles" style="margin-top:0">
            ${toggleRow("stripe_enabled", "Enable deposits in the buyer portal", "Show a “Pay deposit” button on cars a client asked us to chase.", settingOn(s, "stripe_enabled"))}
          </div>
          <div class="grid2" style="margin-top:16px">
            <div><label for="set-deposit">Deposit amount <span class="opt">(AUD)</span></label><input id="set-deposit" name="stripe_deposit_aud" type="number" min="0" step="50" value="${esc(s.stripe_deposit_aud || "")}" placeholder="e.g. 500"></div>
            <div><label for="set-currency">Currency</label><input id="set-currency" name="stripe_currency" value="${esc(s.stripe_currency || "aud")}" placeholder="aud"></div>
          </div>
          <details class="set-disc"><summary>Webhook setup</summary>
            <p class="help" style="margin-top:10px;font-size:12px;line-height:1.55">Add this endpoint in your Stripe dashboard for the <code>checkout.session.completed</code>, <code>customer.subscription.updated</code> and <code>customer.subscription.deleted</code> events, then set its signing secret as <code>STRIPE_WEBHOOK_SECRET</code>:<br><strong>${esc(webhookUrl)}</strong><br>For memberships, also enable the Customer Portal in Stripe so members can manage their plan.</p>
          </details>
        </div>
      </div>

      <div class="card set-card" id="set-pricing">
        <h2><span class="num">5</span> Membership</h2>
        <div style="max-width:640px">
          <p class="help" style="margin:0 0 14px">The “Full access” plan, billed monthly via Stripe. Turn it on to show a Subscribe button in the buyer portal${stripeSecret ? "" : " (needs the <code>STRIPE_SECRET_KEY</code> secret first)"}. An active subscription makes the client a member automatically.</p>
          <div class="toggles" style="margin-top:0">
            ${toggleRow("membership_enabled", "Sell Full access in the portal", "Show the “Get full access” subscribe button to non-members.", settingOn(s, "membership_enabled"))}
          </div>
          <div class="grid2" style="margin-top:16px">
            <div><label for="set-price">Full access <span class="opt">(A$/month)</span></label><input id="set-price" name="membership_monthly_aud" type="number" min="0" step="1" value="${esc(s.membership_monthly_aud || "49")}"></div>
            <div><label for="set-free">Free result limit <span class="opt">(reserved)</span></label><input id="set-free" name="free_result_limit" type="number" min="0" step="1" value="${esc(s.free_result_limit || "1")}"></div>
          </div>
        </div>
      </div>

      <div class="card set-card" id="set-ai">
        <h2><span class="num">6</span> AI auction-sheet reader</h2>
        <div style="max-width:640px">
          <p class="help" style="margin:0 0 14px">Reads the Japanese inspection sheet from a car's photos. ${opts.aiKey ? "API key detected." : "<strong>No API key set yet</strong> -the reader stays off until the <code>ANTHROPIC_API_KEY</code> secret is added."}</p>
          <div class="grid2">
            <div><label for="set-when">When to read</label><select id="set-when" name="ai_sheet_auto">${aiOpts(s.ai_sheet_auto, SHEET_AUTO_MODES, "off")}</select></div>
            <div><label for="set-model">Model <span class="opt">(cached per car)</span></label><select id="set-model" name="ai_sheet_model">${aiOpts(s.ai_sheet_model, SHEET_MODELS, DEFAULT_SHEET_MODEL)}</select></div>
          </div>
          <details class="set-disc"><summary>How auto-read works</summary>
            <p class="help" style="margin-top:10px;font-size:12px">Auto modes read in the background after a search and cache the result, so each car is read once. “Strong”/“every match” are capped at 6 reads per search to control cost.</p>
          </details>
        </div>
      </div>

      <div class="save-bar"><button class="btn-gold" type="submit">Save settings</button></div>
    </form>`;
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
  const paidCount = payments.filter((p) => p.status === "paid").length;
  const deposits = opts.deposits || [];
  // Deposits outstanding: requests marked "deposit requested" but not yet paid.
  const depRows = deposits.map((d) => {
    const veh = displayName([d.marka_name, d.model_name].filter(Boolean).join(" ")) || "Vehicle";
    return `<tr>
      <td><a class="clink" href="/admin?view=request&id=${d.id}">REQ-${d.id}</a></td>
      <td><a class="clink" href="/admin?view=client&id=${d.client_id}">${esc(d.client_name)}</a></td>
      <td>${esc(veh)}</td>
      <td style="white-space:nowrap">${esc(lastActivityLabel(d.last_activity))}</td>
      <td style="text-align:right"><form method="POST" action="/request/status" style="display:inline"><input type="hidden" name="id" value="${d.id}"><input type="hidden" name="status" value="deposit_paid"><input type="hidden" name="back" value="/admin?view=payments"><button class="btn-toggle on" type="submit">Mark paid</button></form></td>
    </tr>`;
  }).join("");
  const depositsSection = deposits.length ? `<div class="psec" style="margin-top:26px"><h2>Deposits outstanding<span class="ct">${deposits.length}</span></h2></div>
    <div class="card" style="padding:0;overflow-x:auto;-webkit-overflow-scrolling:touch">
      <table><tr><th>Request</th><th>Customer</th><th>Vehicle</th><th>Requested</th><th></th></tr>${depRows}</table>
    </div>` : "";
  return `<div class="triage">
      <div class="tstat"><div class="k">Collected</div><div class="v">A$${(totalPaid / 100).toLocaleString("en-AU")}</div></div>
      <div class="tstat"><div class="k">Paid payments</div><div class="v">${paidCount}</div></div>
      <div class="tstat"><div class="k">Deposits outstanding</div><div class="v">${deposits.length}</div></div>
    </div>
    ${depositsSection}
    ${payments.length ? `<div class="psec" style="margin-top:26px"><h2>Payments<span class="ct">${payments.length}</span></h2></div>${tableToolbar("paymentsTbl", "Search payments by client, status or description…", "jdm-payments")}` : ""}
    <div class="card" style="padding:0;overflow-x:auto;-webkit-overflow-scrolling:touch">
      <table id="paymentsTbl" class="sortable"><tr><th>When</th><th>Client</th><th>Amount</th><th>For</th><th>Status</th><th>Stripe session</th></tr>${rows}</table>
    </div>`;
}

// Styled login screen shown when there's no valid session.
export function loginPage(opts = {}) {
  const err = opts.locked
    ? `<div class="login-err">Too many sign-in attempts. Please wait about 15 minutes and try again.</div>`
    : opts.googleError
      ? `<div class="login-err">We couldn't sign you in with Google. Please try again or use your email and password.</div>`
      : opts.error
        ? `<div class="login-err">Incorrect email or password. Please try again.</div>`
        : "";
  const googleBlock = opts.googleEnabled
    ? `${googleButton("login", "Continue with Google")}<div class="ob-or">or</div>`
    : "";
  const styleTag = opts.googleEnabled ? `<style>${GOOGLE_BTN_CSS}</style>` : "";
  const body = `${styleTag}<div class="login-screen">
    ${risingSun({ size: 520, tone: "faint" })}
    <form class="login-card" method="POST" action="/login">
      <div class="login-logo"><a href="/" aria-label="JDM Connect home">${LOGO}</a></div>
      <h1>Welcome back</h1>
      <p class="login-sub">Sign in to track your searches and the matches we find for you.</p>
      ${err}
      ${googleBlock}
      <label for="lg-email">Email</label>
      <input id="lg-email" type="email" name="email" autocomplete="username" spellcheck="false" placeholder="you@email.com" maxlength="160">
      <label for="lg-pass" style="margin-top:14px">Password</label>
      <input id="lg-pass" type="password" name="password" autocomplete="current-password" autofocus required maxlength="128">
      <button class="btn-gold" type="submit">Sign in</button>
      <p class="login-sub" style="margin:18px 0 0">New here? <a href="/request" style="color:var(--gold-txt);font-weight:600">Start a vehicle search</a></p>
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
      <label for="sp-pass">New password</label>
      <input id="sp-pass" type="password" name="password" autocomplete="new-password" autofocus required minlength="6">
      <label for="sp-confirm" style="margin-top:14px">Confirm password</label>
      <input id="sp-confirm" type="password" name="confirm" autocomplete="new-password" required minlength="6">
      <button class="btn-gold" type="submit">Set password and sign in</button>
    </form>`;
  }
  return brandDoc(`<div class="login-screen">${risingSun({ size: 520, tone: "faint" })}${card}</div>`, "Set password - JDM Connect");
}

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
  const clients = (await run(`SELECT COUNT(*) AS n FROM clients c WHERE ${acc.sql} AND c.archived = 0`).first())?.n || 0;
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
  // Throughput + demand signals (all role-scoped via run()).
  const sentWeek = (await run(`SELECT COUNT(*) AS n FROM queue q JOIN clients c ON c.id = q.client_id WHERE q.status='sent' AND q.decided_at >= date('now','-6 days') AND ${acc.sql}`).first())?.n || 0;
  const requests = (await run(`SELECT COUNT(*) AS n FROM queue q JOIN clients c ON c.id = q.client_id WHERE q.client_request=1 AND q.status='pending' AND ${acc.sql}`).first())?.n || 0;
  const members = (await run(`SELECT COUNT(*) AS n FROM clients c WHERE c.member=1 AND ${acc.sql}`).first())?.n || 0;
  // Most-wanted makes in the live review queue — a quick read on demand.
  const makeRows = (await run(`SELECT json_extract(q.lot_json,'$.marka_name') AS mk, COUNT(*) AS n FROM queue q JOIN clients c ON c.id = q.client_id WHERE q.status='pending' AND ${acc.sql} GROUP BY mk ORDER BY n DESC LIMIT 6`).all()).results || [];
  const topMakes = makeRows.filter((r) => r.mk).map((r) => ({ name: displayName(r.mk), n: r.n }));
  // Pending lots whose auction closes within 48h — the work that can't wait.
  const closingList = (await run(`SELECT q.id, q.lot_json, c.name AS client_name FROM queue q JOIN clients c ON c.id = q.client_id WHERE q.status='pending' AND ${acc.sql} AND json_extract(q.lot_json,'$.auction_date') BETWEEN datetime('now') AND datetime('now','+48 hours') ORDER BY json_extract(q.lot_json,'$.auction_date') ASC LIMIT 6`).all()).results || [];

  let people;
  if (session.role === "admin") {
    people = (await env.DB.prepare(`SELECT a.id, a.name, a.company, a.email, a.active, a.alerts, (SELECT COUNT(*) FROM clients c WHERE c.agent_id = a.id) AS client_count FROM agents a ORDER BY a.created_at DESC LIMIT 6`).all()).results || [];
  } else {
    people = (await run(`SELECT c.id, c.name, c.email, c.state FROM clients c WHERE ${acc.sql} AND c.archived = 0 ORDER BY c.created_at DESC LIMIT 6`).all()).results || [];
  }

  // --- Phase 2 "needs attention" signals (all role-scoped) -----------------
  // Live pipeline: count per stage across this session's requests.
  const TERMINAL = ["delivered", "lost"];
  const stageRows = (await run(`SELECT w.status AS st, COUNT(*) AS n FROM wishlists w JOIN clients c ON c.id = w.client_id WHERE ${acc.sql} GROUP BY w.status`).all()).results || [];
  const stageCounts = {};
  for (const s of REQUEST_STATUSES) stageCounts[s.id] = 0;
  for (const r of stageRows) if (r.st in stageCounts) stageCounts[r.st] = r.n;
  const openRequests = REQUEST_STATUSES.filter((s) => !TERMINAL.includes(s.id)).reduce((n, s) => n + (stageCounts[s.id] || 0), 0);

  // Deposits requested but not paid.
  const depositsOut = (await run(`SELECT COUNT(*) AS n FROM wishlists w JOIN clients c ON c.id = w.client_id WHERE w.deposit_status = 'requested' AND ${acc.sql}`).first())?.n || 0;

  // Stalled: active-pipeline requests with no activity in 14 days.
  const inTerminal = TERMINAL.map((s) => `'${s}'`).join(",");
  const stalledList = (await run(
    `SELECT w.id, w.status, w.last_activity, w.marka_name, w.model_name, c.name AS client_name, c.id AS client_id
       FROM wishlists w JOIN clients c ON c.id = w.client_id
      WHERE ${acc.sql} AND w.status NOT IN (${inTerminal}) AND c.archived = 0
        AND (w.last_activity IS NULL OR w.last_activity < datetime('now','-14 days'))
      ORDER BY COALESCE(w.last_activity, w.created_at) ASC LIMIT 6`
  ).all()).results || [];
  const stalled = (await run(`SELECT COUNT(*) AS n FROM wishlists w JOIN clients c ON c.id = w.client_id WHERE ${acc.sql} AND w.status NOT IN (${inTerminal}) AND c.archived = 0 AND (w.last_activity IS NULL OR w.last_activity < datetime('now','-14 days'))`).first())?.n || 0;

  // Tasks: overdue + due-today counts and the actual list (scoped to me/my clients).
  const tsc = taskScope(session);
  const tbind = (sql) => { const s = env.DB.prepare(sql); return tsc.binds.length ? s.bind(...tsc.binds) : s; };
  const tasksOverdue = (await tbind(`SELECT COUNT(*) AS n FROM tasks t LEFT JOIN clients c ON c.id = t.client_id WHERE t.status != 'done' AND t.due_date IS NOT NULL AND t.due_date < date('now') AND ${tsc.sql}`).first())?.n || 0;
  const tasksToday = (await tbind(`SELECT COUNT(*) AS n FROM tasks t LEFT JOIN clients c ON c.id = t.client_id WHERE t.status != 'done' AND t.due_date = date('now') AND ${tsc.sql}`).first())?.n || 0;
  const tasksDueList = (await tbind(
    `SELECT t.*, c.name AS client_name FROM tasks t LEFT JOIN clients c ON c.id = t.client_id
      WHERE t.status != 'done' AND t.due_date IS NOT NULL AND t.due_date <= date('now') AND ${tsc.sql}
      ORDER BY t.due_date ASC, t.priority='high' DESC LIMIT 6`
  ).all()).results || [];

  // Scheduled follow-ups due (or overdue) today — "who needs attention today?".
  const nextActionList = (await run(
    `SELECT w.id, w.status, w.next_action_date, w.next_action_note, w.marka_name, w.model_name, c.name AS client_name, c.id AS client_id
       FROM wishlists w JOIN clients c ON c.id = w.client_id
      WHERE ${acc.sql} AND c.archived = 0 AND w.status NOT IN (${inTerminal})
        AND w.next_action_date IS NOT NULL AND w.next_action_date <= date('now')
      ORDER BY w.next_action_date ASC LIMIT 8`
  ).all()).results || [];
  const nextActionDue = nextActionList.length;

  // Who owes money — deposits requested but not paid (the list, for the panel).
  const depositsList = (await run(
    `SELECT w.id, w.status, w.price_max, w.marka_name, w.model_name, c.name AS client_name, c.id AS client_id
       FROM wishlists w JOIN clients c ON c.id = w.client_id
      WHERE w.deposit_status = 'requested' AND ${acc.sql} AND c.archived = 0
      ORDER BY COALESCE(w.last_activity, w.created_at) ASC LIMIT 6`
  ).all()).results || [];

  // Closest to buying — interested / deposit stages, most-committed first.
  const closestList = (await run(
    `SELECT w.id, w.status, w.deposit_status, w.marka_name, w.model_name, c.name AS client_name, c.id AS client_id
       FROM wishlists w JOIN clients c ON c.id = w.client_id
      WHERE ${acc.sql} AND c.archived = 0
        AND w.status IN ('interested','deposit_requested','deposit_paid')
      ORDER BY CASE w.status WHEN 'deposit_paid' THEN 3 WHEN 'deposit_requested' THEN 2 ELSE 1 END DESC,
               COALESCE(w.last_activity, w.created_at) DESC LIMIT 6`
  ).all()).results || [];

  return { clients, agents, pending, closing, strength, people, reviewed, found, spend, sentWeek, requests, members, topMakes, closingList,
    stageCounts, openRequests, depositsOut, stalled, stalledList, tasksOverdue, tasksToday, tasksDueList,
    nextActionList, nextActionDue, depositsList, closestList };
}

// Dashboard home: time-aware greeting, animated overview, action cards, list.
function dashboardView(session, data) {
  const isAdmin = session.role === "admin";
  const who = isAdmin ? "Jate" : esc((session.name || "there").split(/\s+/)[0]);
  const ovLabel = isAdmin ? "Team overview" : "Your overview";
  // A KPI cell; when href is given it becomes a clickable shortcut to that view.
  const metric = (n, label, gold, href) => {
    const inner = `<div class="num" data-count="${Number(n) || 0}">0</div><div class="cap">${label}</div>`;
    return href ? `<a class="ov${gold ? " gold" : ""} ov-link" href="${href}">${inner}</a>` : `<div class="ov${gold ? " gold" : ""}">${inner}</div>`;
  };

  const topbar = `<div class="dtop">
      <a href="/admin?view=matches" aria-label="Review queue">${ICONS.bell}</a>
      <a href="mailto:support@jdmconnect.com.au" aria-label="Get help">${ICONS.help}</a>
      <a href="/logout" aria-label="Sign out">${ICONS.account}</a>
    </div>`;

  // Business roll-up: only the numbers NOT already surfaced as attention cards
  // (matches/closing/deposits live there now), so the dashboard never repeats a
  // figure three times.
  const overview = `<div class="ovwrap"><span class="ovlbl">${ovLabel}</span><a href="/admin?view=clients">Manage ${ICONS.arrow}</a></div>
    <div class="overview">
      ${metric(data.clients, "Active clients", false, "/admin?view=clients")}
      ${isAdmin ? metric(data.agents, "Active agents", false, "/admin?view=agents") : ""}
      ${metric(data.openRequests, "Open requests", false, "/admin?view=requests")}
      ${metric(data.sentWeek, "Sent this week", false, "/admin?view=matches")}
      ${metric(data.members, "Members", false, "/admin?view=clients")}
    </div>`;

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
  // New matches found per day (was computed but never shown).
  const found = data.found || [];
  const foundTotal = found.reduce((s, r) => s + r.n, 0);
  const foundCard = `<div class="chart-card">
      <div class="chart-h"><span class="ct-t">New matches per day</span><span class="ct-s">${foundTotal} in 14 days</span></div>
      ${barsSvg(found, "#6F86A6")}
      <div class="bars-x"><span>${dayLbl(found[0] && found[0].d)}</span><span>today</span></div>
    </div>`;
  // Most-wanted makes in the queue — a small horizontal bar list.
  const maxMake = (data.topMakes || []).reduce((m, r) => Math.max(m, r.n), 0) || 1;
  const topMakesCard = (data.topMakes || []).length
    ? `<div class="chart-card">
        <div class="chart-h"><span class="ct-t">Most-wanted makes</span><span class="ct-s">in the queue</span></div>
        <div class="abars">${data.topMakes.map((r) => `<div class="abar"><span class="abar-n" title="${esc(r.name)}">${esc(r.name)}</span><span class="abar-t"><span class="abar-f" style="width:${Math.round((r.n / maxMake) * 100)}%"></span></span><span class="abar-v">${r.n}</span></div>`).join("")}</div>
      </div>`
    : "";
  const charts = `<div class="charts">
      <div class="chart-card">
        <div class="chart-h"><span class="ct-t">Reviewed per day</span><span class="ct-s">${revTotal} in 14 days</span></div>
        ${barsSvg(rev, "var(--gold)")}
        <div class="bars-x"><span>${dayLbl(rev[0] && rev[0].d)}</span><span>today</span></div>
      </div>
      ${foundCard}
      <div class="chart-card">
        <div class="chart-h"><span class="ct-t">Pipeline quality</span><span class="ct-s">awaiting review</span></div>
        ${donutSvg(strengthParts)}
      </div>
      ${spendCard}
      ${topMakesCard}
      ${agentCard}
    </div>`;

  // Actionable list: lots whose auction closes within 48h.
  const closingRows = (data.closingList || []).map((q) => {
    let lot = {}; try { lot = JSON.parse(q.lot_json); } catch (e) {}
    const title = `${esc(lot.year || "")} ${esc(displayName(lot.marka_name))} ${esc(displayName(lot.model_name))}`.replace(/\s+/g, " ").trim() || "Vehicle";
    const d = daysUntil(lot.auction_date);
    const when = d <= 0 ? "today" : d === 1 ? "1 day" : `${d} days`;
    return `<a class="lrow" href="/admin?view=lot&id=${q.id}">
        ${avatar(q.client_name)}
        <div class="who"><div class="nm">${title}</div><div class="sub">${esc(q.client_name)}${lot.auction ? " · " + esc(lot.auction) : ""}</div></div>
        <div class="meta"><span class="b ${d <= 1 ? "b-warn" : "b-neu"}">Closes ${when}</span></div>
      </a>`;
  }).join("") || `<div class="lrow"><div class="who"><div class="sub">Nothing closing in the next 48h.</div></div></div>`;

  // --- Phase 2: "needs attention today" band + live pipeline strip ----------
  const ac = (n, label, href, alert) => {
    const tone = (Number(n) || 0) > 0 ? alert : "calm";
    return `<a class="acard acard-${tone}" href="${href}"><div class="ac-n" data-count="${Number(n) || 0}">0</div><div class="ac-l">${label}</div></a>`;
  };
  const attention = `<div class="attn">
    <div class="attn-h">Needs attention today</div>
    <div class="acards">
      ${ac(data.nextActionDue, "Follow-ups due", "/admin?view=requests", "warn")}
      ${ac(data.tasksOverdue, "Overdue tasks", "/admin?view=tasks", "bad")}
      ${ac(data.tasksToday, "Tasks due today", "/admin?view=tasks", "warn")}
      ${ac(data.depositsOut, "Deposits outstanding", isAdmin ? "/admin?view=payments" : "/admin?view=requests", "warn")}
      ${ac(data.stalled, "Stalled requests", "/admin?view=requests", "bad")}
      ${ac(data.closing, "Closing in 48h", "/admin?view=matches", "warn")}
      ${ac(data.pending, "Matches to review", "/admin?view=matches", "gold")}
    </div>
  </div>`;

  const JOURNEY = ["new", "qualified", "searching", "vehicles_sent", "interested", "deposit_paid", "purchased", "delivered"];
  const pipelineStrip = `<div class="pipestrip">${JOURNEY.map((id) => {
    const s = RSTATUS[id] || { label: id };
    return `<a class="ps-c" href="/admin?view=requests" title="${esc(s.label)}"><span class="ps-n">${(data.stageCounts && data.stageCounts[id]) || 0}</span><span class="ps-l">${esc(s.label)}</span></a>`;
  }).join('<span class="ps-arrow">&rsaquo;</span>')}</div>`;

  // My tasks due (overdue + today), from the scoped list.
  const dueColor = (t) => t === "over" ? "var(--bad)" : t === "today" ? "#C98A00" : "var(--t3)";
  const taskRows = (data.tasksDueList || []).map((t) => {
    const d = taskDue(t.due_date);
    return `<a class="lrow" href="${t.wishlist_id ? `/admin?view=request&id=${t.wishlist_id}` : "/admin?view=tasks"}">
        <div class="who"><div class="nm">${esc(t.title)}</div><div class="sub">${t.client_name ? esc(t.client_name) + " · " : ""}<span style="color:${dueColor(d.tone)};font-weight:600">${esc(d.label)}</span></div></div>
      </a>`;
  }).join("") || `<div class="lrow"><div class="who"><div class="sub">Nothing due today. Nice.</div></div></div>`;
  const tasksSection = `<div class="sec-h"><h2>My tasks <span class="ct">(${(data.tasksOverdue || 0) + (data.tasksToday || 0)})</span></h2><a class="btn-gold" href="/admin?view=tasks">Open ${ICONS.arrow}</a></div><div class="list">${taskRows}</div>`;

  // Stalled requests — no movement in 14 days.
  const stalledRows = (data.stalledList || []).map((w) => {
    const veh = displayName([w.marka_name, w.model_name].filter(Boolean).join(" ")) || "Any vehicle";
    return `<a class="lrow" href="/admin?view=request&id=${w.id}">
        ${avatar(w.client_name)}
        <div class="who"><div class="nm">${esc(veh)}</div><div class="sub">${esc(w.client_name)} · ${esc(lastActivityLabel(w.last_activity))}</div></div>
        <div class="meta"><span class="b b-warn">${esc((RSTATUS[w.status] || {}).label || w.status)}</span></div>
      </a>`;
  }).join("") || `<div class="lrow"><div class="who"><div class="sub">No stalled requests. Everything's moving.</div></div></div>`;
  const stalledSection = `<div class="sec-h"><h2>Which requests are stalled? <span class="ct">(${data.stalled || 0})</span></h2><a class="btn-gold" href="/admin?view=requests">Review ${ICONS.arrow}</a></div><div class="list">${stalledRows}</div>`;

  // Reframe the closing-soon list as a question to match the rest of the board.
  const closingQ = `<div class="sec-h"><h2>Which auctions close today? <span class="ct">(${data.closing || 0})</span></h2><a class="btn-gold" href="/admin?view=matches">Review ${ICONS.arrow}</a></div><div class="list">${closingRows}</div>`;

  // Who needs attention today — scheduled follow-ups due (or overdue).
  const naRows = (data.nextActionList || []).map((w) => {
    const veh = displayName([w.marka_name, w.model_name].filter(Boolean).join(" ")) || "Any vehicle";
    const d = taskDue(w.next_action_date);
    return `<a class="lrow" href="/admin?view=request&id=${w.id}">
        ${avatar(w.client_name)}
        <div class="who"><div class="nm">${esc(w.client_name)}</div><div class="sub">${esc(veh)}${w.next_action_note ? " · " + esc(w.next_action_note) : ""}</div></div>
        <div class="meta"><span class="b ${d.tone === "over" ? "b-warn" : "b-neu"}">${esc(d.label)}</span></div>
      </a>`;
  }).join("") || `<div class="lrow"><div class="who"><div class="sub">Nothing scheduled for today. You're clear.</div></div></div>`;
  const attentionSection = `<div class="sec-h"><h2>Who needs attention today? <span class="ct">(${data.nextActionDue || 0})</span></h2><a class="btn-gold" href="/admin?view=requests">Open ${ICONS.arrow}</a></div><div class="list">${naRows}</div>`;

  // Who owes money — deposits requested, not yet paid.
  const owesRows = (data.depositsList || []).map((w) => {
    const veh = displayName([w.marka_name, w.model_name].filter(Boolean).join(" ")) || "Any vehicle";
    return `<a class="lrow" href="/admin?view=request&id=${w.id}">
        ${avatar(w.client_name)}
        <div class="who"><div class="nm">${esc(w.client_name)}</div><div class="sub">${esc(veh)}</div></div>
        <div class="meta"><span class="b b-warn">Deposit requested</span></div>
      </a>`;
  }).join("") || `<div class="lrow"><div class="who"><div class="sub">No deposits outstanding.</div></div></div>`;
  const owesSection = `<div class="sec-h"><h2>Who owes money? <span class="ct">(${data.depositsOut || 0})</span></h2><a class="btn-gold" href="/admin?view=${isAdmin ? "payments" : "requests"}">Open ${ICONS.arrow}</a></div><div class="list">${owesRows}</div>`;

  // Who's closest to buying — interested / deposit stages, most-committed first.
  const closeRows = (data.closestList || []).map((w) => {
    const veh = displayName([w.marka_name, w.model_name].filter(Boolean).join(" ")) || "Any vehicle";
    const lbl = (RSTATUS[w.status] || {}).label || w.status;
    return `<a class="lrow" href="/admin?view=request&id=${w.id}">
        ${avatar(w.client_name)}
        <div class="who"><div class="nm">${esc(w.client_name)}</div><div class="sub">${esc(veh)}</div></div>
        <div class="meta"><span class="b ${w.status === "deposit_paid" ? "b-ok" : "b-warn"}">${esc(lbl)}</span></div>
      </a>`;
  }).join("") || `<div class="lrow"><div class="who"><div class="sub">No one at the deposit stage yet.</div></div></div>`;
  const closestSection = `<div class="sec-h"><h2>Who's closest to buying? <span class="ct">(${(data.closestList || []).length})</span></h2><a class="btn-gold" href="/admin?view=requests">Open ${ICONS.arrow}</a></div><div class="list">${closeRows}</div>`;

  // Hierarchy (top → bottom): business snapshot → what needs action today →
  // pipeline → detail lists → trend charts. The roll-up used to sit BELOW the
  // pipeline strip, which read as a stray second row of KPI boxes; it now leads
  // as a compact snapshot strip so the two stat bands are grouped and ordered
  // small-context → big-actionable.
  return `<div class="dash">
      ${topbar}
      <div class="dkick"><span class="live"></span> JDM Connect, vehicle finder</div>
      <h1 class="greet"><span id="greetTime">Good morning</span>,<br><span class="nm">${who}</span></h1>
      ${overview}
      ${attention}
      ${pipelineStrip}
      <div class="dcols">${attentionSection}${tasksSection}</div>
      <div class="dcols">${owesSection}${closestSection}</div>
      <div class="dcols">${stalledSection}${closingQ}</div>
      ${charts}
    </div>${DASH2_CSS}${dashScript()}`;
}

const DASH2_CSS = `<style>
  /* Snapshot roll-up now leads the dashboard; tighten the rhythm so it sits as
     a compact band above the attention cards instead of floating mid-page. */
  .dash .overview{margin-bottom:22px}
  .attn{margin:0 0 4px}
  .attn-h{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--t3);margin:0 0 12px}
  .acards{display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:12px}
  .acard{display:block;text-decoration:none;background:var(--card);border:1px solid var(--hair);border-radius:14px;padding:16px 18px;transition:border-color .15s,transform .15s}
  .acard:hover{transform:translateY(-2px)}
  .ac-n{font-size:28px;font-weight:800;line-height:1;color:var(--ink);font-variant-numeric:tabular-nums}
  .ac-l{font-size:12px;color:var(--t3);margin-top:8px}
  .acard-bad{border-color:var(--bad-line,var(--bad-bg))}.acard-bad .ac-n{color:var(--bad)}
  .acard-warn{border-color:var(--gold-line)}.acard-warn .ac-n{color:#C98A00}
  .acard-gold{border-color:var(--gold-line)}.acard-gold .ac-n{color:var(--gold-txt)}
  .acard-calm .ac-n{color:var(--t2)}
  .pipestrip{display:flex;align-items:center;gap:2px;flex-wrap:nowrap;background:var(--card);border:1px solid var(--hair);border-radius:14px;padding:14px 12px;margin:16px 0 4px;overflow-x:auto}
  .ps-c{display:flex;flex-direction:column;align-items:center;gap:4px;text-decoration:none;padding:4px 10px;border-radius:9px;min-width:62px}
  .ps-c:hover{background:var(--hover,rgba(0,0,0,.04))}
  .ps-n{font-size:19px;font-weight:800;color:var(--ink);font-variant-numeric:tabular-nums}
  .ps-l{font-size:10px;color:var(--t3);text-align:center;line-height:1.2}
  .ps-arrow{color:var(--faint);font-size:15px;flex:none}
</style>`;

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
          <div><label for="ic-name">Name</label><input id="ic-name" name="name" placeholder="Jane Citizen" required></div>
          <div><label for="ic-email">Email <span class="opt">(email or WhatsApp required)</span></label><input id="ic-email" name="email" type="email" spellcheck="false" placeholder="name@email.com"></div>
          <div><label for="ic-whatsapp">WhatsApp <span class="opt">(email or WhatsApp required)</span></label><input id="ic-whatsapp" name="whatsapp" placeholder="+61 4XX XXX XXX"></div>
          <div><label for="ic-state">State <span class="opt">(for landed cost)</span></label><select id="ic-state" name="state">${stateOptions("")}</select></div>
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
          <div><label>Client<select name="client_id" required>${clientOptions}</select></label></div>
          <div><label>Label<input name="label" placeholder="e.g. under 1.5M daily"></label></div>
          <div><label for="wl-maker">Make</label>${makerField(makers, "wl-maker")}</div>
          <div><label>Model <span class="opt">(pick or type)</span>${modelField("wl-models")}</label></div>
          <div><label>Year min<input name="year_min" type="number" placeholder="1990"></label></div>
          <div><label>Year max<input name="year_max" type="number" placeholder="2002"></label></div>
          <div><label>Max price (JPY)<input name="price_max" type="number" placeholder="1,500,000"></label></div>
          <div><label>Max mileage (km)<input name="mileage_max" type="number" placeholder="80,000"></label></div>
          <div><label>Min grade<input name="rate_min" type="number" step="0.5" placeholder="e.g. 4"></label></div>
          <div><label>Chassis / model code <span class="opt">(contains, best match)</span><input name="kuzov" placeholder="e.g. JZA80 or 211"></label></div>
          <div><label>Grade keyword <span class="opt">(contains)</span><input name="grade_kw" placeholder="e.g. RS"></label></div>
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
      ? `<form method="POST" action="/share" style="display:inline"><input type="hidden" name="client_id" value="${c.id}"><select name="agent_id" class="share-pick" aria-label="Share ${esc(c.name)} with an agent" onchange="if(this.value&&confirm('Share this client with the selected agent?')){this.form.submit()}else{this.value=''}"><option value="">+ share…</option>${opts2}</select></form>`
      : "";
    return `${chips} ${picker}`;
  };

  // Admin only: who owns this client (NULL = JDM Connect). Reassigning hands the
  // client - its wishlists, matches and alerts - to that agent's dashboard.
  const isAdmin = session.role === "admin";
  const ownerCell = (c) => {
    const opts = `<option value=""${!c.agent_id ? " selected" : ""}>JDM Connect</option>` +
      agents.map((a) => `<option value="${a.id}"${Number(c.agent_id) === Number(a.id) ? " selected" : ""}>${esc(a.name)}${a.company ? " · " + esc(a.company) : ""}</option>`).join("");
    // Reassigning is destructive (hands over the client + all their searches and
    // matches), so confirm and revert on cancel — never a silent stray-click write.
    return `<form method="POST" action="/client/assign" style="display:inline"><input type="hidden" name="client_id" value="${c.id}"><select name="agent_id" class="share-pick" aria-label="Owner for ${esc(c.name)}" onfocus="this.dataset.prev=this.value" onchange="if(confirm('Reassign this client to the selected owner? They get the client and all their searches, matches and alerts.')){this.form.submit()}else{this.value=this.dataset.prev}">${opts}</select></form>`;
  };

  const rows = clients.map((c) =>
    `<tr>
      ${isAdmin ? `<td><input type="checkbox" name="ids" value="${c.id}" form="bulkform"></td>` : ""}
      <td>${avatar(c.name)}<a class="clink" href="/admin?view=client&id=${c.id}" data-drawer="/admin/drawer?id=${c.id}">${esc(c.name)}</a></td>
      <td>${esc(c.email || "-")}</td><td>${esc(c.state || "-")}</td>
      <td style="text-align:right">${countFor(c.id)}</td>
      ${isAdmin ? `<td>${ownerCell(c)}</td>` : ""}
      <td>${shareCell(c)}</td>
      <td style="text-align:right">${canManage(c)
        ? rowMenu([
            { label: "View", href: `/admin?view=client&id=${c.id}` },
            { label: "Edit", href: `/admin?view=client&id=${c.id}#edit` },
            { sep: true },
            c.archived
              ? { label: "Restore", action: "/client/unarchive", id: c.id }
              : { label: "Archive", action: "/client/archive", id: c.id },
            { label: "Delete", action: "/client/delete", id: c.id, confirm: "Delete this client and all their searches? This cannot be undone.", icon: ICONS.trash, danger: true },
          ])
        : ""}</td>
    </tr>`
  ).join("") || `<tr><td colspan="${isAdmin ? 8 : 6}" class="empty">No clients yet. <a href="/admin?view=intake" style="color:#9a7b2e;font-weight:600;text-decoration:underline">Add your first client</a>.</td></tr>`;

  // Admin bulk bar. "Delete selected" is its own red button (not buried in a
  // dropdown) so it's obvious; assign/share only appear when there are agents.
  // Each button checks something is ticked; delete also confirms with the count.
  const bulkBar = isAdmin
    ? `<form id="bulkform" method="POST" action="/clients/bulk" class="bulkbar">
        <span class="bulk-label">With selected clients:</span>
        <select name="action" class="share-pick">${agents.length ? `<option value="assign">Assign owner</option><option value="share">Share with</option>` : ""}<option value="${opts.showArchived ? "unarchive" : "archive"}">${opts.showArchived ? "Restore" : "Archive"}</option></select>
        ${agents.length ? `<select name="agent_id" class="share-pick"><option value="">JDM Connect</option>${agents.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join("")}</select>` : ""}
        <button class="btn-gold" type="submit" name="do" value="apply" onclick="return jdmBulkApply(this.form)">Apply</button>
        <button class="btn-del bulk-del" type="submit" name="do" value="delete" onclick="return jdmBulkDelete(this.form)">${ICONS.trash || ""}Delete selected</button>
        <span class="help" style="margin-left:4px">Tick clients on the left, then choose an action.</span>
      </form>
      <script>function jdmBulkTicked(f){var n=0,e=f.elements;for(var i=0;i<e.length;i++){if(e[i].name==='ids'&&e[i].checked)n++;}return n;}
      function jdmBulkApply(f){if(!jdmBulkTicked(f)){alert('Tick the clients you want first, then Apply.');return false;}return true;}
      function jdmBulkDelete(f){var n=jdmBulkTicked(f);if(!n){alert('Tick the clients you want to delete first.');return false;}return confirm('Delete '+n+' selected client'+(n===1?'':'s')+' and ALL their searches, matches and history? This cannot be undone.');}</script>`
    : "";

  const headCheck = isAdmin ? `<th style="width:30px"><input type="checkbox" onclick="jdmSelectAllVisible(this,'ids')" title="Select all"></th>` : "";
  const headOwner = isAdmin ? `<th>Owner</th>` : "";
  const archToggle = isAdmin ? `<a href="/admin?view=clients${opts.showArchived ? "" : "&archived=1"}" style="font-size:12.5px;font-weight:600;color:var(--t3);text-decoration:none;white-space:nowrap">${opts.showArchived ? "&larr; Hide archived" : "Show archived"}</a>` : "";
  return `${opts.showArchived ? `<div class="dupnote" style="margin-bottom:14px">Showing archived customers. <a href="/admin?view=clients" style="color:var(--gold-txt);font-weight:600">Back to active</a></div>` : ""}${bulkBar}<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:2px"><div style="flex:1;min-width:220px">${tableToolbar("clientsTbl", "Search clients by name, email or state…", "jdm-clients")}</div>${archToggle}</div><div class="card" style="padding:0;overflow-x:auto;-webkit-overflow-scrolling:touch">
    <table id="clientsTbl" class="sortable"><tr>${headCheck}<th>Client</th><th>Email</th><th>State</th><th style="text-align:right">Searches</th>${headOwner}<th>Shared with</th><th></th></tr>${rows}</table></div>${isAdmin ? `<p class="help" style="margin:10px 2px 0;font-size:12px">Owner = whose dashboard a client lives on, and who gets their match alerts. Shared with = other agents who can also see and action them.</p>` : ""}`;
}

// ===== Phase 2: Requests pipeline (a "request" is a wishlist row) =====
const REQUEST_STATUSES = [
  { id: "new", label: "New", tone: "pending" },
  { id: "qualified", label: "Qualified", tone: "active" },
  { id: "searching", label: "Searching", tone: "active" },
  { id: "vehicles_sent", label: "Vehicles sent", tone: "active" },
  { id: "interested", label: "Interested", tone: "warn" },
  { id: "deposit_requested", label: "Deposit requested", tone: "warn" },
  { id: "deposit_paid", label: "Deposit paid", tone: "good" },
  { id: "purchased", label: "Purchased", tone: "good" },
  { id: "shipping", label: "Shipping", tone: "good" },
  { id: "compliance", label: "Compliance", tone: "good" },
  { id: "ready_delivery", label: "Ready for delivery", tone: "good" },
  { id: "delivered", label: "Delivered", tone: "win" },
  { id: "lost", label: "Lost", tone: "bad" },
];
const RSTATUS = Object.fromEntries(REQUEST_STATUSES.map((s) => [s.id, s]));
const validStatus = (s) => !!RSTATUS[s];
function statusBadge(id) {
  const s = RSTATUS[id] || RSTATUS.new;
  return `<span class="rstat rstat-${s.tone}">${esc(s.label)}</span>`;
}
function statusSelect(reqId, current, back) {
  return `<form method="POST" action="/request/status" style="display:inline"><input type="hidden" name="id" value="${reqId}">${back ? `<input type="hidden" name="back" value="${esc(back)}">` : ""}<select name="status" class="rstat-sel" aria-label="Change status" onchange="this.form.submit()">${
    REQUEST_STATUSES.map((s) => `<option value="${s.id}"${s.id === (current || "new") ? " selected" : ""}>${esc(s.label)}</option>`).join("")
  }</select></form>`;
}
// Customer health from last activity (Priority 4): green <7d, amber 7-14d, red 14d+.
function healthDot(lastActivity) {
  const t = Date.parse(lastActivity || "");
  const days = Number.isFinite(t) ? (Date.now() - t) / 86400000 : 999;
  const tone = days <= 7 ? "green" : days <= 14 ? "amber" : "red";
  const title = days > 900 ? "No activity yet" : `Last activity ${Math.floor(days)} day${Math.floor(days) === 1 ? "" : "s"} ago`;
  return `<span class="health health-${tone}" title="${title}" aria-label="${title}"></span>`;
}
function lastActivityLabel(iso) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return "no activity";
  const days = Math.floor((Date.now() - t) / 86400000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}
// "Have we sent this client examples, and did they open them?" — derived from
// queue.sent_at / queue.viewed_at (no login tracking needed). Viewed is the
// strongest buying signal, so it reads gold; sent-but-unopened reads amber;
// nothing sent stays muted. Powers the Requests "Examples" column.
function engagementCell(sent, viewed) {
  const s = Number(sent) || 0, v = Number(viewed) || 0;
  if (s === 0) return `<span class="chip muted" title="No vehicle examples sent yet">Not sent</span>`;
  if (v > 0) return `<span class="eng eng-viewed" title="${v} of ${s} sent example${s === 1 ? "" : "s"} opened by the client">Sent &middot; viewed</span>`;
  return `<span class="eng eng-sent" title="${s} example${s === 1 ? "" : "s"} sent, not opened yet">Sent &middot; unopened</span>`;
}

// Requests list: the operational pipeline. Each row is a customer's search, with
// a health dot, live status change, owner and last-activity. Pipeline cards along
// the top show the count at each stage and filter the table on click.
function requestsView(requests, opts = {}) {
  const counts = {};
  REQUEST_STATUSES.forEach((s) => (counts[s.id] = 0));
  requests.forEach((r) => { const st = r.status || "new"; counts[st] = (counts[st] || 0) + 1; });
  const cards = REQUEST_STATUSES.filter((s) => s.tone !== "bad").map((s) =>
    `<button type="button" class="pipe-card" data-st="${s.id}" onclick="jdmPipe(this,'${s.id}')"><div class="pc-n">${counts[s.id] || 0}</div><div class="pc-l">${esc(s.label)}</div></button>`
  ).join("");

  const rows = requests.map((r) => {
    const veh = displayName([r.marka_name, r.model_name].filter(Boolean).join(" ")) || r.label || "Any vehicle";
    const budget = r.price_max ? "&yen;" + Number(r.price_max).toLocaleString("en-US") : "-";
    return `<tr data-st="${r.status || "new"}">
      <td>${healthDot(r.last_activity)}<a class="reqid" href="/admin?view=request&id=${r.id}">REQ-${r.id}</a></td>
      <td><a class="clink" href="/admin?view=client&id=${r.client_id}" data-drawer="/admin/drawer?id=${r.client_id}">${esc(r.client_name)}</a></td>
      <td><a class="clink" href="/admin?view=request&id=${r.id}">${esc(veh)}</a>${r.kuzov ? ` <span class="chip muted">${esc(r.kuzov)}</span>` : ""}</td>
      <td>${destinationCell(r.destination_country, r.client_state)}</td>
      <td style="white-space:nowrap">${budget}</td>
      <td>${statusSelect(r.id, r.status)}</td>
      <td>${engagementCell(r.sent_count, r.viewed_count)}</td>
      <td>${(r.deposit_status || "none") === "none" ? '<span class="chip muted">-</span>' : depositBadge(r.deposit_status)}</td>
      <td>${esc(r.owner_name || "JDM Connect")}</td>
      <td style="white-space:nowrap">${esc(lastActivityLabel(r.last_activity))}</td>
      <td style="text-align:right">${rowMenu([
        { label: "Open request", href: `/admin?view=request&id=${r.id}` },
        { label: "Open customer", href: `/admin?view=client&id=${r.client_id}` },
      ])}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="11" class="empty">No requests yet. They appear here as customers submit searches.</td></tr>`;

  // Plain-English key so staff aren't guessing what the dots / REQ / Examples
  // column mean (client asked "what do the green and red dots mean?").
  const legend = `<div class="req-legend">
    <span class="lg-t">Key</span>
    <span><span class="health health-green"></span> Active (contacted in the last 7 days)</span>
    <span><span class="health health-amber"></span> Cooling (7&ndash;14 days)</span>
    <span><span class="health health-red"></span> Stalled (14+ days, or never)</span>
    <span><b class="reqid">REQ-###</b> Request reference &mdash; click to open the full request</span>
    <span><span class="eng eng-viewed">Sent &middot; viewed</span> We sent example cars and the client opened them</span>
    <span><b>Last activity</b> When this request was last touched (status, note, send or view)</span>
  </div>`;

  return `${REQ_CSS}
    <div class="pipe">${cards}</div>
    ${legend}
    ${tableSearch("reqTbl", "Search requests by customer, vehicle, state or country…")}
    <div class="card" style="padding:0;overflow-x:auto;-webkit-overflow-scrolling:touch">
      <table id="reqTbl" class="sortable"><tr><th>Request</th><th>Customer</th><th>Vehicle</th><th>Destination</th><th>Budget</th><th>Status</th><th title="Have we sent example cars, and did the client open them?">Examples</th><th>Deposit</th><th>Owner</th><th>Last activity</th><th></th></tr>${rows}</table>
    </div>
    <script>function jdmPipe(btn,st){var on=btn.classList.contains('on');document.querySelectorAll('.pipe-card').forEach(function(c){c.classList.remove('on');});var t=document.getElementById('reqTbl');var rows=t.rows;for(var i=0;i<rows.length;i++){var r=rows[i];if(r.getElementsByTagName('th').length)continue;r.style.display=(on||r.getAttribute('data-st')===st)?'':'none';}if(!on)btn.classList.add('on');}</script>`;
}

const REQ_CSS = `<style>
  .pipe{display:grid;grid-template-columns:repeat(auto-fit,minmax(116px,1fr));gap:10px;margin-bottom:18px}
  .pipe-card{text-align:left;background:var(--card);border:1px solid var(--hair);border-radius:11px;padding:13px 15px;cursor:pointer;font-family:inherit;transition:border-color .15s,box-shadow .15s}
  .pipe-card:hover{border-color:var(--gold-line)}
  .pipe-card.on{border-color:var(--gold);box-shadow:0 0 0 1px var(--gold)}
  .pipe-card .pc-n{font-size:22px;font-weight:800;color:var(--ink);line-height:1;font-variant-numeric:tabular-nums}
  .pipe-card .pc-l{font-size:11.5px;color:var(--t3);margin-top:6px;line-height:1.25}
  .reqid{font-family:var(--mono,monospace);font-size:12px;font-weight:600;color:var(--t2);text-decoration:none}
  a.reqid:hover{color:var(--gold-txt)}
  .health{display:inline-block;width:9px;height:9px;border-radius:9999px;margin-right:8px;vertical-align:middle}
  .health-green{background:#1F7A4D}.health-amber{background:#C98A00}.health-red{background:#B11226}
  .rstat{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.02em;padding:3px 9px;border-radius:9999px}
  .rstat-pending{background:rgba(0,0,0,.06);color:#5b606a}
  .rstat-active{background:var(--gold-tint);color:var(--gold-txt)}
  .rstat-warn{background:rgba(201,138,0,.14);color:#8a5e10}
  .rstat-good{background:rgba(31,122,77,.14);color:#1F7A4D}
  .rstat-win{background:rgba(31,122,77,.2);color:#155e3a}
  .rstat-bad{background:var(--bad-bg);color:var(--bad)}
  .rstat-sel{padding:6px 26px 6px 10px;font-size:12.5px;border:1px solid var(--hair);border-radius:8px;background:var(--card);color:var(--ink);font-family:inherit}
  .ov-chip{display:inline-flex;align-items:center;gap:5px;background:rgba(59,115,172,.1);border:1px solid rgba(59,115,172,.34);color:#3B5E96;font-size:11px;font-weight:700;padding:3px 9px;border-radius:9999px;white-space:nowrap}
  .ov-chip .ov-d{width:6px;height:6px;border-radius:9999px;background:currentColor}
  .req-legend{display:flex;flex-wrap:wrap;align-items:center;gap:8px 18px;background:var(--card);border:1px solid var(--hair);border-radius:11px;padding:12px 16px;margin-bottom:16px;font-size:12px;color:var(--t2);line-height:1.5}
  .req-legend .lg-t{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--t3)}
  .req-legend .health{margin-right:5px}
  .eng{display:inline-block;font-size:11px;font-weight:700;padding:3px 9px;border-radius:9999px;white-space:nowrap}
  .eng-viewed{background:var(--gold-tint);color:var(--gold-txt)}
  .eng-sent{background:rgba(201,138,0,.14);color:#8a5e10}
</style>`;

// Destination cell for a request: the AU registration state by default, or an
// "Overseas" badge with the country when a non-Australia destination is set.
// Purely a marker - the AU landed-cost / eligibility flow is unchanged.
function destinationCell(country, state) {
  const c = String(country || "").trim();
  if (c) return `<span class="ov-chip" title="Overseas destination"><span class="ov-d"></span>${esc(c)}</span>`;
  return state ? esc(state) : '<span class="chip muted">-</span>';
}

// Record one timeline event (Priority 8). Best-effort; never throws into a handler.
export async function logActivity(env, { wishlist_id = null, client_id = null, type, detail = null, actor = null }) {
  try {
    await env.DB.prepare("INSERT INTO activity (wishlist_id, client_id, type, detail, actor) VALUES (?,?,?,?,?)")
      .bind(wishlist_id, client_id, type, detail, actor).run();
  } catch (e) { console.error("logActivity failed:", e.message); }
}

// Deposit state on a request (Priority 6): none -> requested -> paid.
const DEPOSIT_LABELS = { none: "No deposit", requested: "Deposit requested", paid: "Deposit paid" };
const validDeposit = (s) => s === "none" || s === "requested" || s === "paid";
function depositBadge(status) {
  const s = status || "none";
  const tone = s === "paid" ? "good" : s === "requested" ? "warn" : "pending";
  return `<span class="rstat rstat-${tone}">${esc(DEPOSIT_LABELS[s] || DEPOSIT_LABELS.none)}</span>`;
}

// Moving a request INTO one of these stages seeds a follow-up task so nothing
// stalls silently (Priority 3). title(firstName) builds the human label.
const STATUS_TASKS = {
  vehicles_sent: { title: (n) => `Follow up with ${n} on the vehicles sent`, days: 3, priority: "normal", type: "follow_up" },
  interested: { title: (n) => `Call ${n} to close`, days: 1, priority: "high", type: "call" },
  deposit_requested: { title: (n) => `Chase the deposit from ${n}`, days: 2, priority: "high", type: "deposit" },
  deposit_paid: { title: (n) => `Confirm the purchase plan with ${n}`, days: 2, priority: "normal", type: "purchase" },
  purchased: { title: (n) => `Send ${n} a purchase confirmation`, days: 1, priority: "normal", type: "admin" },
};

// Insert one task. Best-effort; never throws into a handler. due is a Date|null.
async function insertTask(env, { title, type = null, wishlist_id = null, client_id = null, assigned_to = null, due = null, priority = "normal" }) {
  try {
    const dueStr = due instanceof Date ? due.toISOString().slice(0, 10) : (due || null);
    const r = await env.DB.prepare(
      "INSERT INTO tasks (title, type, wishlist_id, client_id, assigned_to, due_date, priority) VALUES (?,?,?,?,?,?,?)"
    ).bind(title, type, wishlist_id, client_id, assigned_to, dueStr, priority).run();
    return r.meta.last_row_id;
  } catch (e) { console.error("insertTask failed:", e.message); return null; }
}

// Move a request along the pipeline: validates the stage, checks access, stamps
// last_activity, applies the deposit side-effect, records the change on the
// timeline and seeds any follow-up task for the new stage.
export async function updateRequestStatus(env, id, status, session) {
  const wid = Number(id);
  if (!validStatus(status)) return { ok: false, error: "status" };
  if (!(await wishlistAccessibleBy(env, wid, session))) return { ok: false, error: "forbidden" };
  const w = await env.DB.prepare(
    "SELECT w.id, w.client_id, w.status, w.owner_id, w.deposit_status, c.name AS client_name, c.agent_id FROM wishlists w JOIN clients c ON c.id = w.client_id WHERE w.id = ?"
  ).bind(wid).first();
  if (!w) return { ok: false, error: "not_found" };
  const prev = w.status || "new";
  if (prev === status) return { ok: true, client_id: w.client_id, unchanged: true };
  const now = new Date().toISOString();
  // Deposit side-effect: keep the deposit flag in step with the pipeline stage.
  let deposit = w.deposit_status || "none";
  if (status === "deposit_requested" && deposit === "none") deposit = "requested";
  if (status === "deposit_paid") deposit = "paid";
  await env.DB.prepare("UPDATE wishlists SET status = ?, last_activity = ?, deposit_status = ? WHERE id = ?")
    .bind(status, now, deposit, wid).run();
  const actor = await actorName(env, session);
  await logActivity(env, { wishlist_id: wid, client_id: w.client_id, type: "status", detail: `${RSTATUS[prev]?.label || prev} to ${RSTATUS[status]?.label || status}`, actor });

  // Seed a follow-up task for the new stage, assigned to the request owner (or
  // the client's agent). Skip if an identical open task already exists so a
  // back-and-forth status change doesn't pile up duplicates.
  const rule = STATUS_TASKS[status];
  if (rule) {
    const firstName = String(w.client_name || "this client").trim().split(/\s+/)[0] || "this client";
    const title = rule.title(firstName);
    const dupe = await env.DB.prepare("SELECT id FROM tasks WHERE wishlist_id = ? AND title = ? AND status != 'done'").bind(wid, title).first();
    if (!dupe) {
      const due = new Date(Date.now() + rule.days * 86400000);
      await insertTask(env, { title, type: rule.type, wishlist_id: wid, client_id: w.client_id, assigned_to: w.owner_id || w.agent_id || null, due, priority: rule.priority });
    }
  }
  return { ok: true, client_id: w.client_id };
}

// ===========================================================================
// Phase 2: request detail, activity timeline, tasks, match tracking, deposits
// ===========================================================================

// Robust relative time for both ISO ("...Z") and SQLite datetime ("YYYY-MM-DD
// HH:MM:SS", treated as UTC) timestamps.
function tsMs(s) {
  if (!s) return NaN;
  const hasTz = /[zZ]|[+-]\d\d:?\d\d$/.test(s);
  return Date.parse(hasTz ? s : s.replace(" ", "T") + "Z");
}
function relTime(s) {
  const t = tsMs(s);
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + "m ago";
  const h = Math.round(m / 60);
  if (h < 24) return h + "h ago";
  const d = Math.round(h / 24);
  if (d < 30) return d + "d ago";
  return new Date(t).toISOString().slice(0, 10);
}
const firstNameOf = (name) => String(name || "").trim().split(/\s+/)[0] || "there";

// Timeline event styling: a coloured dot tone + a short label per activity type.
const ACT_TONE = {
  created: "neu", status: "gold", owner: "neu", match_sent: "blue",
  viewed: "blue", note: "neu", deposit: "warn", task: "gold", interested: "good",
};
function activityTimeline(acts) {
  if (!acts.length) return `<div class="rd-empty">No activity yet.</div>`;
  return `<ol class="tl">${acts.map((a) => `<li class="tl-i">
    <span class="tl-dot tl-${ACT_TONE[a.type] || "neu"}"></span>
    <div class="tl-b">
      <div class="tl-d">${esc(a.detail || a.type)}</div>
      <div class="tl-m">${esc(a.actor || "System")} &middot; ${esc(relTime(a.created_at))}</div>
    </div></li>`).join("")}</ol>`;
}

// Vertical pipeline stepper: past stages ticked, current highlighted.
function statusPipeline(current) {
  const cur = current || "new";
  if (cur === "lost") {
    return `<div class="rd-lost">This request is marked <strong>Lost</strong>. Change the status below to reopen it.</div>`;
  }
  const flow = REQUEST_STATUSES.filter((s) => s.id !== "lost");
  const curIdx = flow.findIndex((s) => s.id === cur);
  return `<ol class="rd-steps">${flow.map((s, i) => {
    const state = i < curIdx ? "done" : i === curIdx ? "now" : "todo";
    return `<li class="rd-step rd-${state}"><span class="rd-sd"></span><span class="rd-sl">${esc(s.label)}</span></li>`;
  }).join("")}</ol>`;
}

// Due-date meta for a task: relative label + tone (overdue red, today amber).
function taskDue(due) {
  if (!due) return { label: "No due date", tone: "none" };
  const t = Date.parse(due + "T00:00:00Z");
  if (!Number.isFinite(t)) return { label: esc(due), tone: "none" };
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const days = Math.round((t - today.getTime()) / 86400000);
  if (days < 0) return { label: days === -1 ? "Yesterday" : `${-days} days overdue`, tone: "over" };
  if (days === 0) return { label: "Today", tone: "today" };
  if (days === 1) return { label: "Tomorrow", tone: "soon" };
  if (days <= 7) return { label: `In ${days} days`, tone: "soon" };
  return { label: due, tone: "none" };
}
function taskRow(t, opts = {}) {
  const done = t.status === "done";
  const due = taskDue(t.due_date);
  const veh = t.marka_name || t.model_name ? displayName([t.marka_name, t.model_name].filter(Boolean).join(" ")) : "";
  const back = opts.back || "/admin?view=tasks";
  const ctx = [
    t.client_name ? `<a class="clink" href="/admin?view=client&id=${t.client_id}">${esc(t.client_name)}</a>` : "",
    t.wishlist_id ? `<a class="clink" href="/admin?view=request&id=${t.wishlist_id}">REQ-${t.wishlist_id}${veh ? " &middot; " + esc(veh) : ""}</a>` : "",
  ].filter(Boolean).join(" &middot; ");
  return `<div class="tk${done ? " tk-done" : ""}">
    <form method="POST" action="/task/toggle" class="tk-check"><input type="hidden" name="id" value="${t.id}"><input type="hidden" name="back" value="${esc(back)}"><button type="submit" class="tk-box${done ? " on" : ""}" aria-label="${done ? "Mark not done" : "Mark done"}">${done ? "&#10003;" : ""}</button></form>
    <div class="tk-b">
      <div class="tk-t">${esc(t.title)}${t.priority === "high" && !done ? ` <span class="tk-pri">High</span>` : ""}</div>
      ${ctx ? `<div class="tk-c">${ctx}</div>` : ""}
    </div>
    <div class="tk-r">
      ${done ? `<span class="tk-due tk-none">Done ${esc(relTime(t.done_at))}</span>` : `<span class="tk-due tk-${due.tone}">${esc(due.label)}</span>`}
      <form method="POST" action="/task/delete" class="tk-del" onsubmit="return confirm('Delete this task?')"><input type="hidden" name="id" value="${t.id}"><input type="hidden" name="back" value="${esc(back)}"><button type="submit" aria-label="Delete task">&times;</button></form>
    </div>
  </div>`;
}

// One sent/pending match row on the request detail, with engagement tracking.
function matchTrackRow(q, back) {
  let lot = {}; try { lot = JSON.parse(q.lot_json); } catch (e) {}
  const veh = [lot.year, displayName(lot.marka_name), displayName(lot.model_name)].filter(Boolean).join(" ") || ("Lot " + (lot.lot || q.id));
  const sent = q.status === "sent";
  // Engagement stage: Not sent -> Sent -> Viewed -> Interested.
  const stage = q.response === "interested" ? "Interested"
    : q.response === "not_interested" ? "Passed"
    : q.viewed_at ? "Viewed"
    : sent ? "Sent"
    : q.status === "pending" ? "In review" : esc(q.status || "-");
  const tone = stage === "Interested" ? "good" : stage === "Passed" ? "bad" : stage === "Viewed" ? "blue" : stage === "Sent" ? "warn" : "pending";
  const when = sent && q.sent_at ? `sent ${esc(relTime(q.sent_at))}` : q.status === "pending" ? "awaiting review" : "";
  const acts = sent ? `<div class="mt-acts">
      <form method="POST" action="/match/response" style="display:inline"><input type="hidden" name="id" value="${q.id}"><input type="hidden" name="response" value="interested"><input type="hidden" name="back" value="${esc(back)}"><button class="mt-btn mt-yes" type="submit"${q.response === "interested" ? " disabled" : ""}>Interested</button></form>
      <form method="POST" action="/match/response" style="display:inline"><input type="hidden" name="id" value="${q.id}"><input type="hidden" name="response" value="not_interested"><input type="hidden" name="back" value="${esc(back)}"><button class="mt-btn mt-no" type="submit"${q.response === "not_interested" ? " disabled" : ""}>Pass</button></form>
    </div>` : "";
  return `<div class="mt">
    <a class="mt-v" href="/admin?view=lot&id=${q.id}">${esc(veh)}</a>
    <div class="mt-meta"><span class="rstat rstat-${tone}">${esc(stage)}</span>${when ? `<span class="mt-when">${when}</span>` : ""}</div>
    ${acts}
  </div>`;
}

// ---- Quick-action + task + match mutation handlers -------------------------

// Who did it, for the activity timeline. Sessions only carry {role,id}, so an
// agent's display name is looked up — without this every agent action was
// logged as the anonymous "Agent" (audit: shared-agent actions unattributable).
async function actorName(env, session) {
  if (!session || session.role === "admin") return "JDM Connect";
  const a = await env.DB.prepare("SELECT name FROM agents WHERE id = ?").bind(Number(session.id)).first();
  return (a && a.name) || "Agent";
}

// Add a free-text note to a request's timeline. Shared (co-search) agents may
// add notes — additive, and attributed to them by name in the timeline.
export async function addRequestNote(env, id, note, session) {
  const wid = Number(id);
  const text = String(note || "").trim().slice(0, 500);
  if (!text) return { ok: false, error: "empty" };
  if (!(await wishlistAccessibleBy(env, wid, session))) return { ok: false, error: "forbidden" };
  const w = await env.DB.prepare("SELECT client_id FROM wishlists WHERE id = ?").bind(wid).first();
  if (!w) return { ok: false, error: "not_found" };
  await env.DB.prepare("UPDATE wishlists SET last_activity = ? WHERE id = ?").bind(new Date().toISOString(), wid).run();
  const actor = await actorName(env, session);
  await logActivity(env, { wishlist_id: wid, client_id: w.client_id, type: "note", detail: text, actor });
  return { ok: true, client_id: w.client_id };
}

// (Re)assign a request's owner. null = JDM Connect (unassigned).
export async function assignRequestOwner(env, id, ownerId, session) {
  const wid = Number(id);
  if (!(await wishlistAccessibleBy(env, wid, session))) return { ok: false, error: "forbidden" };
  const w = await env.DB.prepare("SELECT client_id FROM wishlists WHERE id = ?").bind(wid).first();
  if (!w) return { ok: false, error: "not_found" };
  const oid = Number(ownerId);
  const owner = Number.isInteger(oid) && oid > 0 ? oid : null;
  let name = "JDM Connect";
  if (owner) {
    const a = await env.DB.prepare("SELECT name FROM agents WHERE id = ? AND active = 1").bind(owner).first();
    if (!a) return { ok: false, error: "owner" };
    name = a.name;
  }
  await env.DB.prepare("UPDATE wishlists SET owner_id = ?, last_activity = ? WHERE id = ?").bind(owner, new Date().toISOString(), wid).run();
  const actor = await actorName(env, session);
  await logActivity(env, { wishlist_id: wid, client_id: w.client_id, type: "owner", detail: `Assigned to ${name}`, actor });
  return { ok: true, client_id: w.client_id };
}

// Schedule (or clear) a request's next follow-up. A date drives the dashboard's
// "who needs attention today?" list; the optional note says what the step is.
export async function setNextAction(env, id, { date, note, clear } = {}, session) {
  const wid = Number(id);
  // Owner-only: the follow-up schedule drives the owning agent's pipeline;
  // shared (co-search) agents must not rewrite another agent's calendar.
  if (!(await wishlistOwnedBy(env, wid, session))) return { ok: false, error: "forbidden" };
  const w = await env.DB.prepare("SELECT client_id FROM wishlists WHERE id = ?").bind(wid).first();
  if (!w) return { ok: false, error: "not_found" };
  if (clear) {
    await env.DB.prepare("UPDATE wishlists SET next_action_date = NULL, next_action_note = NULL WHERE id = ?").bind(wid).run();
    return { ok: true, client_id: w.client_id, cleared: true };
  }
  // Accept only a plain ISO date (YYYY-MM-DD); anything else clears the schedule.
  const d = String(date || "").trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
  const n = String(note || "").trim().slice(0, 160) || null;
  await env.DB.prepare("UPDATE wishlists SET next_action_date = ?, next_action_note = ? WHERE id = ?").bind(iso, n, wid).run();
  if (iso) {
    const actor = await actorName(env, session);
    await logActivity(env, { wishlist_id: wid, client_id: w.client_id, type: "note", detail: `Follow-up set for ${iso}${n ? `: ${n}` : ""}`, actor });
  }
  return { ok: true, client_id: w.client_id };
}

// Access guard for a task row: admin, the assignee, or someone who can see its
// client. Unassigned client-less tasks are admin-only.
async function taskAccessible(env, t, session) {
  if (!session || session.role === "admin") return true;
  if (t.assigned_to != null && Number(t.assigned_to) === Number(session.id)) return true;
  if (t.client_id) return await clientAccessibleBy(env, t.client_id, session);
  return false;
}

export async function createTask(env, form, session) {
  const title = String(form.get("title") || "").trim().slice(0, 160);
  if (!title) return { ok: false, error: "title" };
  const wid = form.get("wishlist_id") ? Number(form.get("wishlist_id")) : null;
  let cid = form.get("client_id") ? Number(form.get("client_id")) : null;
  if (wid) {
    if (!(await wishlistAccessibleBy(env, wid, session))) return { ok: false, error: "forbidden" };
    if (!cid) { const w = await env.DB.prepare("SELECT client_id FROM wishlists WHERE id = ?").bind(wid).first(); cid = w ? w.client_id : null; }
  } else if (cid) {
    if (!(await clientAccessibleBy(env, cid, session))) return { ok: false, error: "forbidden" };
  }
  const due = form.get("due_date") ? String(form.get("due_date")).slice(0, 10) : null;
  const priority = ["low", "normal", "high"].includes(form.get("priority")) ? form.get("priority") : "normal";
  // An agent's manual task is theirs; an admin can target an agent via assigned_to.
  const assigned = session.role === "agent" ? session.id : (form.get("assigned_to") ? Number(form.get("assigned_to")) : null);
  const tid = await insertTask(env, { title, type: form.get("type") || "manual", wishlist_id: wid, client_id: cid, assigned_to: assigned, due, priority });
  if (tid && (wid || cid)) {
    const actor = await actorName(env, session);
    await logActivity(env, { wishlist_id: wid, client_id: cid, type: "task", detail: `Task added: ${title}`, actor });
  }
  return { ok: !!tid, client_id: cid, wishlist_id: wid };
}

export async function toggleTask(env, id, session) {
  const tid = Number(id);
  const t = await env.DB.prepare("SELECT * FROM tasks WHERE id = ?").bind(tid).first();
  if (!t) return { ok: false, error: "not_found" };
  if (!(await taskAccessible(env, t, session))) return { ok: false, error: "forbidden" };
  const done = t.status === "done";
  await env.DB.prepare("UPDATE tasks SET status = ?, done_at = ? WHERE id = ?")
    .bind(done ? "todo" : "done", done ? null : new Date().toISOString(), tid).run();
  return { ok: true, wishlist_id: t.wishlist_id, client_id: t.client_id };
}

export async function deleteTask(env, id, session) {
  const tid = Number(id);
  const t = await env.DB.prepare("SELECT * FROM tasks WHERE id = ?").bind(tid).first();
  if (!t) return { ok: false, error: "not_found" };
  if (!(await taskAccessible(env, t, session))) return { ok: false, error: "forbidden" };
  await env.DB.prepare("DELETE FROM tasks WHERE id = ?").bind(tid).run();
  return { ok: true, wishlist_id: t.wishlist_id, client_id: t.client_id };
}

// Match tracking (Priority 5). Called when a match is approved & sent: stamp
// sent_at and drop a "Vehicle sent" event on the request timeline.
export async function recordMatchSent(env, queueId, session) {
  try {
    const q = await env.DB.prepare("SELECT id, client_id, wishlist_id, lot_json, sent_at FROM queue WHERE id = ?").bind(Number(queueId)).first();
    if (!q) return;
    if (!q.sent_at) await env.DB.prepare("UPDATE queue SET sent_at = datetime('now') WHERE id = ?").bind(q.id).run();
    let lot = {}; try { lot = JSON.parse(q.lot_json); } catch (e) {}
    const veh = [lot.year, displayName(lot.marka_name), displayName(lot.model_name)].filter(Boolean).join(" ") || ("Lot " + (lot.lot || q.id));
    if (q.wishlist_id) await env.DB.prepare("UPDATE wishlists SET last_activity = ? WHERE id = ?").bind(new Date().toISOString(), q.wishlist_id).run();
    const actor = await actorName(env, session);
    await logActivity(env, { wishlist_id: q.wishlist_id, client_id: q.client_id, type: "match_sent", detail: `Vehicle sent: ${veh}`, actor });
  } catch (e) { console.error("recordMatchSent failed:", e.message); }
}

// Stamp the first time a sent vehicle is opened on its public link (the client
// viewing it). Best-effort; only fires once per match.
export async function stampMatchViewed(env, queueId) {
  try {
    const q = await env.DB.prepare("SELECT id, client_id, wishlist_id, lot_json, viewed_at, status FROM queue WHERE id = ?").bind(Number(queueId)).first();
    if (!q || q.viewed_at || q.status !== "sent") return;
    await env.DB.prepare("UPDATE queue SET viewed_at = datetime('now') WHERE id = ?").bind(q.id).run();
    let lot = {}; try { lot = JSON.parse(q.lot_json); } catch (e) {}
    const veh = [lot.year, displayName(lot.marka_name), displayName(lot.model_name)].filter(Boolean).join(" ") || ("Lot " + (lot.lot || q.id));
    await logActivity(env, { wishlist_id: q.wishlist_id, client_id: q.client_id, type: "viewed", detail: `Customer viewed ${veh}`, actor: "Customer" });
  } catch (e) { console.error("stampMatchViewed failed:", e.message); }
}

// Record a client's response to a sent vehicle. "Interested" nudges the request
// forward in the pipeline; both responses land on the timeline.
export async function setMatchResponse(env, queueId, response, session) {
  const qid = Number(queueId);
  const resp = response === "interested" ? "interested" : response === "not_interested" ? "not_interested" : null;
  if (!resp) return { ok: false, error: "response" };
  const q = await env.DB.prepare("SELECT id, client_id, wishlist_id, lot_json FROM queue WHERE id = ?").bind(qid).first();
  if (!q) return { ok: false, error: "not_found" };
  if (session && session.role === "agent" && !(await clientAccessibleBy(env, q.client_id, session))) return { ok: false, error: "forbidden" };
  await env.DB.prepare("UPDATE queue SET response = ?, viewed_at = COALESCE(viewed_at, datetime('now')) WHERE id = ?").bind(resp, qid).run();
  let lot = {}; try { lot = JSON.parse(q.lot_json); } catch (e) {}
  const veh = [lot.year, displayName(lot.marka_name), displayName(lot.model_name)].filter(Boolean).join(" ") || ("Lot " + (lot.lot || q.id));
  const actor = await actorName(env, session);
  if (resp === "interested" && q.wishlist_id) {
    const w = await env.DB.prepare("SELECT status FROM wishlists WHERE id = ?").bind(q.wishlist_id).first();
    if (w && ["new", "qualified", "searching", "vehicles_sent"].includes(w.status)) {
      await updateRequestStatus(env, q.wishlist_id, "interested", session); // logs its own event
      await logActivity(env, { wishlist_id: q.wishlist_id, client_id: q.client_id, type: "interested", detail: `Interested in ${veh}`, actor });
      return { ok: true, wishlist_id: q.wishlist_id, client_id: q.client_id };
    }
  }
  if (q.wishlist_id) await env.DB.prepare("UPDATE wishlists SET last_activity = ? WHERE id = ?").bind(new Date().toISOString(), q.wishlist_id).run();
  await logActivity(env, { wishlist_id: q.wishlist_id, client_id: q.client_id, type: resp === "interested" ? "interested" : "note", detail: resp === "interested" ? `Interested in ${veh}` : `Passed on ${veh}`, actor });
  return { ok: true, wishlist_id: q.wishlist_id, client_id: q.client_id };
}

// Soft-archive / restore a customer (Phase 1 deferred item, now wired).
export async function archiveClient(env, id, on, session) {
  const cid = Number(id);
  if (!(await clientOwnedBy(env, cid, session))) return { ok: false, error: "forbidden" };
  await env.DB.prepare("UPDATE clients SET archived = ? WHERE id = ?").bind(on ? 1 : 0, cid).run();
  return { ok: true };
}

// ---- Request detail page (Priority 1 + Priority 9 quick actions) -----------
export async function requestDetailPage(env, wishlistId, session = { role: "admin", id: 0 }, opts = {}) {
  const wid = Number(wishlistId);
  const notFound = () => shell(sidebar("requests", {}, session),
    `<div class="topbar"><div><div class="kicker">Vehicle Finder</div><h1>Request</h1></div><a class="btn-dark" href="/admin?view=requests">Back to requests</a></div>
     <div class="content"><div class="card"><div class="empty">Request not found, or you don't have access.</div></div></div>`,
    "Request - JDM Connect");
  if (!Number.isInteger(wid) || wid <= 0) return notFound();
  if (!(await wishlistAccessibleBy(env, wid, session))) return notFound();
  const w = await env.DB.prepare(
    `SELECT w.*, c.name AS client_name, c.email AS client_email, c.whatsapp AS client_whatsapp, c.state AS client_state, c.agent_id AS client_agent, c.portal_enabled
       FROM wishlists w JOIN clients c ON c.id = w.client_id WHERE w.id = ?`
  ).bind(wid).first();
  if (!w) return notFound();

  const back = `/admin?view=request&id=${wid}`;
  const matches = (await env.DB.prepare(
    `SELECT id, lot_id, lot_json, status, sent_at, viewed_at, response, created_at, decided_at
       FROM queue WHERE wishlist_id = ? ORDER BY (status='sent') DESC, created_at DESC LIMIT 40`
  ).bind(wid).all()).results || [];
  const acts = (await env.DB.prepare("SELECT * FROM activity WHERE wishlist_id = ? ORDER BY created_at DESC, id DESC LIMIT 40").bind(wid).all()).results || [];
  const tasks = (await env.DB.prepare(
    `SELECT t.*, c.name AS client_name FROM tasks t LEFT JOIN clients c ON c.id = t.client_id
      WHERE t.wishlist_id = ? ORDER BY (t.status='done'), COALESCE(t.due_date,'9999-99-99'), t.id DESC LIMIT 30`
  ).bind(wid).all()).results || [];
  const agents = session.role === "admin" ? ((await env.DB.prepare("SELECT id, name, company FROM agents WHERE active = 1 ORDER BY name").all()).results || []) : [];
  const ownerId = w.owner_id || w.client_agent || null;
  const owner = ownerId ? await env.DB.prepare("SELECT name, company FROM agents WHERE id = ?").bind(ownerId).first() : null;
  const ownerLabel = owner ? esc(owner.name) + (owner.company ? " · " + esc(owner.company) : "") : "JDM Connect";

  const first = firstNameOf(w.client_name);
  const veh = displayName([w.marka_name, w.model_name].filter(Boolean).join(" ")) || w.label || "Any vehicle";
  const waNum = String(w.client_whatsapp || "").replace(/[^\d]/g, "");

  // -- Left column: customer + contact + deposit -----------------------------
  const contactRows = [
    ["Email", w.client_email ? `<a href="mailto:${esc(w.client_email)}">${esc(w.client_email)}</a>` : ""],
    ["Phone", w.client_whatsapp ? esc(w.client_whatsapp) : ""],
    ["State", w.client_state ? esc(w.client_state) : ""],
    ["Destination", w.destination_country ? `<span class="ov-chip"><span class="ov-d"></span>${esc(w.destination_country)}</span>` : ""],
    ["Portal", w.portal_enabled ? "Enabled" : "Not enabled"],
  ].filter(([, v]) => v).map(([k, v]) => `<div class="rd-row"><span class="rd-k">${k}</span><span class="rd-v">${v}</span></div>`).join("");
  const contactBtns = [
    waNum ? `<a class="rd-cta" href="https://wa.me/${waNum}" target="_blank" rel="noopener">WhatsApp</a>` : "",
    w.client_whatsapp ? `<a class="rd-cta" href="tel:${esc(w.client_whatsapp)}">Call</a>` : "",
    w.client_email ? `<a class="rd-cta" href="mailto:${esc(w.client_email)}">Email</a>` : "",
  ].filter(Boolean).join("");
  const customerCol = `<div class="rdcol">
    <div class="rdcard">
      <div class="rd-cust">${avatar(w.client_name)}<div><div class="rd-name">${esc(w.client_name)} ${healthDot(w.last_activity)}</div><div class="rd-sub">Customer #${w.client_id} &middot; last activity ${esc(lastActivityLabel(w.last_activity))}</div></div></div>
      ${contactRows ? `<div class="rd-rows">${contactRows}</div>` : ""}
      ${contactBtns ? `<div class="rd-ctas">${contactBtns}</div>` : ""}
      <a class="rd-open" href="/admin?view=client&id=${w.client_id}">Open full customer profile &rarr;</a>
    </div>
    <div class="rdcard">
      <div class="rd-h">Owner</div>
      <div class="rd-ownerline">${ownerLabel}</div>
      ${session.role === "admin" ? `<form method="POST" action="/request/owner" class="rd-owner">
        <input type="hidden" name="id" value="${wid}"><input type="hidden" name="back" value="${esc(back)}">
        <select name="owner_id" class="rstat-sel" onchange="this.form.submit()">
          <option value=""${!w.owner_id ? " selected" : ""}>JDM Connect</option>
          ${agents.map((a) => `<option value="${a.id}"${Number(w.owner_id) === Number(a.id) ? " selected" : ""}>${esc(a.name)}${a.company ? " · " + esc(a.company) : ""}</option>`).join("")}
        </select></form>` : ""}
    </div>
    <div class="rdcard">
      <div class="rd-h">Deposit</div>
      <div class="rd-dep">${depositBadge(w.deposit_status)}</div>
      <div class="rd-depbtns">
        ${(w.deposit_status || "none") === "none" ? `<form method="POST" action="/request/status" style="display:inline"><input type="hidden" name="id" value="${wid}"><input type="hidden" name="status" value="deposit_requested"><input type="hidden" name="back" value="${esc(back)}"><button class="rd-cta" type="submit">Request deposit</button></form>` : ""}
        ${(w.deposit_status || "none") !== "paid" ? `<form method="POST" action="/request/status" style="display:inline"><input type="hidden" name="id" value="${wid}"><input type="hidden" name="status" value="deposit_paid"><input type="hidden" name="back" value="${esc(back)}"><button class="rd-cta rd-cta-gold" type="submit">Mark deposit paid</button></form>` : ""}
      </div>
    </div>
  </div>`;

  // -- Middle column: requirements + matches ---------------------------------
  const reqRows = [
    ["Vehicle", esc(veh)],
    ["Years", esc(yearRange(w.year_min, w.year_max))],
    ["Max price", w.price_max ? "&yen;" + Number(w.price_max).toLocaleString("en-US") : "Any"],
    ["Max mileage", w.mileage_max ? Number(w.mileage_max).toLocaleString() + " km" : "Any"],
    ["Min grade", w.rate_min ? esc(w.rate_min) : "Any"],
    ["Chassis / code", w.kuzov ? esc(w.kuzov) : "-"],
  ].map(([k, v]) => `<div class="rd-spec"><span class="rd-sk">${k}</span><span class="rd-sv">${v}</span></div>`).join("");
  const sentCount = matches.filter((m) => m.status === "sent").length;
  const matchList = matches.length
    ? matches.map((m) => matchTrackRow(m, back)).join("")
    : `<div class="rd-empty">No vehicles matched or sent yet.</div>`;
  const requirementsCol = `<div class="rdcol">
    <div class="rdcard">
      <div class="rd-toph"><div class="rd-h" style="margin:0">Request REQ-${wid}</div>${statusBadge(w.status)}</div>
      <div class="rd-specs">${reqRows}</div>
      <a class="rd-find" href="/admin?view=client&id=${w.client_id}#find">Find a vehicle for ${esc(first)} &rarr;</a>
    </div>
    <div class="rdcard">
      <div class="rd-h">Vehicles &amp; engagement <span class="rd-ct">${sentCount} sent</span></div>
      <div class="rd-matches">${matchList}</div>
    </div>
  </div>`;

  // -- Right column: workflow (pipeline + quick actions + tasks + timeline) ---
  const openTasks = tasks.filter((t) => t.status !== "done");
  const workflowCol = `<div class="rdcol">
    <div class="rdcard">
      <div class="rd-h">Status</div>
      ${statusSelect(wid, w.status, back)}
      <div class="rd-quick">
        ${w.status !== "purchased" ? `<form method="POST" action="/request/status"><input type="hidden" name="id" value="${wid}"><input type="hidden" name="status" value="purchased"><input type="hidden" name="back" value="${esc(back)}"><button class="rd-cta" type="submit">Mark purchased</button></form>` : ""}
        ${w.status !== "lost" ? `<form method="POST" action="/request/status" onsubmit="return confirm('Mark this request as lost?')"><input type="hidden" name="id" value="${wid}"><input type="hidden" name="status" value="lost"><input type="hidden" name="back" value="${esc(back)}"><button class="rd-cta rd-cta-bad" type="submit">Mark lost</button></form>` : ""}
      </div>
      ${statusPipeline(w.status)}
    </div>
    <div class="rdcard">
      <div class="rd-h">Next action</div>
      ${w.next_action_date
        ? `<div class="rd-na-cur"><span class="tk-due tk-${taskDue(w.next_action_date).tone}">${esc(taskDue(w.next_action_date).label)}</span>${w.next_action_note ? ` <span class="rd-na-note">${esc(w.next_action_note)}</span>` : ""}</div>`
        : `<div class="rd-empty">No follow-up scheduled.</div>`}
      <form method="POST" action="/request/next-action" class="rd-na">
        <input type="hidden" name="id" value="${wid}"><input type="hidden" name="back" value="${esc(back)}">
        <input type="date" name="next_action_date" value="${esc(w.next_action_date || "")}" aria-label="Next action date">
        <input name="next_action_note" value="${esc(w.next_action_note || "")}" placeholder="What's the next step?" maxlength="160">
        <div class="rd-naact"><button class="rd-cta rd-cta-gold" type="submit">Set follow-up</button>${w.next_action_date ? `<button class="rd-cta rd-cta-bad" type="submit" name="clear" value="1">Clear</button>` : ""}</div>
      </form>
    </div>
    <div class="rdcard">
      <div class="rd-h">Add a note</div>
      <form method="POST" action="/request/note">
        <input type="hidden" name="id" value="${wid}"><input type="hidden" name="back" value="${esc(back)}">
        <textarea name="note" rows="2" class="rd-note" placeholder="Call notes, next step, anything worth logging…" maxlength="500"></textarea>
        <div class="rd-noteact"><button class="rd-cta rd-cta-gold" type="submit">Log note</button></div>
      </form>
    </div>
    <div class="rdcard">
      <div class="rd-h">Tasks <span class="rd-ct">${openTasks.length} open</span></div>
      <div class="rd-tasks">${tasks.length ? tasks.map((t) => taskRow(t, { back })).join("") : `<div class="rd-empty">No tasks. Add one below.</div>`}</div>
      <form method="POST" action="/task/create" class="rd-newtask">
        <input type="hidden" name="wishlist_id" value="${wid}"><input type="hidden" name="client_id" value="${w.client_id}"><input type="hidden" name="back" value="${esc(back)}">
        <input name="title" placeholder="New task…" maxlength="160" required>
        <input name="due_date" type="date" aria-label="Due date">
        <button class="rd-cta rd-cta-gold" type="submit">Add</button>
      </form>
    </div>
    <div class="rdcard">
      <div class="rd-h">Activity</div>
      ${activityTimeline(acts)}
    </div>
  </div>`;

  const flash = opts.saved ? `<div class="flash">${esc(opts.saved)}</div>` : "";
  const main = `
    <div class="topbar">
      <div>
        <div class="kicker">Vehicle Finder · Request</div>
        <h1>${esc(veh)}</h1>
        <p class="subline">${esc(w.client_name)} &middot; REQ-${wid}</p>
      </div>
      <a class="btn-dark" href="/admin?view=requests">Back to requests</a>
    </div>
    <div class="content wide"><a class="backlink" href="/admin?view=requests">&larr; Back to requests</a>${flash}
      ${RD_CSS}
      <div class="rd">${customerCol}${requirementsCol}${workflowCol}</div>
    </div>`;
  return shell(sidebar("requests", { matches: matches.length }, session), main, `REQ-${wid} · ${esc(w.client_name)} - JDM Connect`);
}

const RD_CSS = `<style>
  .rd{display:grid;grid-template-columns:288px minmax(0,1fr) 340px;gap:18px;align-items:start;margin-top:6px}
  @media(max-width:1180px){.rd{grid-template-columns:1fr}}
  .rdcol{display:flex;flex-direction:column;gap:16px}
  .rdcard{background:var(--card);border:1px solid var(--hair);border-radius:14px;padding:17px 18px}
  .rd-h{font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--t3);margin:0 0 12px}
  .rd-ct{background:var(--gold-tint);color:var(--gold-txt);border-radius:9999px;padding:1px 8px;font-size:10.5px;margin-left:6px;letter-spacing:0}
  .rd-toph{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}
  .rd-cust{display:flex;align-items:center;gap:12px;margin-bottom:14px}
  .rd-name{font-size:16.5px;font-weight:700;color:var(--ink)}
  .rd-sub{font-size:11.5px;color:var(--t3);margin-top:3px}
  .rd-rows{border-top:1px solid var(--hair);padding-top:6px}
  .rd-row{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid rgba(0,0,0,.05)}
  .rd-row:last-child{border-bottom:0}
  .rd-k{font-size:12px;color:var(--t3)}.rd-v{font-size:12.5px;font-weight:600;color:var(--ink);text-align:right;word-break:break-word}
  .rd-ctas{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 8px}
  .rd-cta{display:inline-block;background:var(--card);border:1px solid var(--hair);border-radius:9px;padding:7px 13px;font-size:12.5px;font-weight:600;color:var(--ink);cursor:pointer;font-family:inherit;text-decoration:none;transition:border-color .15s,background .15s}
  .rd-cta:hover{border-color:var(--gold-line)}
  .rd-cta-gold{background:var(--gold-tint);border-color:var(--gold-line);color:var(--gold-txt)}
  .rd-cta-bad{color:var(--bad);border-color:var(--bad-bg)}
  .rd-open{display:inline-block;margin-top:4px;font-size:12.5px;font-weight:600;color:var(--gold-txt);text-decoration:none}
  .rd-open:hover{text-decoration:underline}
  .rd-ownerline{font-size:14px;font-weight:600;color:var(--ink);margin-bottom:10px}
  .rd-owner select,.rstat-sel{width:100%}
  .rd-dep{margin-bottom:12px}
  .rd-depbtns{display:flex;gap:8px;flex-wrap:wrap}
  .rd-specs{display:flex;flex-direction:column}
  .rd-spec{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid rgba(0,0,0,.05)}
  .rd-spec:last-of-type{border-bottom:0}
  .rd-sk{font-size:12px;color:var(--t3)}.rd-sv{font-size:13px;font-weight:600;color:var(--ink);text-align:right}
  .rd-find{display:inline-block;margin-top:14px;background:var(--gold-tint);border:1px solid var(--gold-line);color:var(--gold-txt);border-radius:9px;padding:9px 14px;font-size:12.5px;font-weight:700;text-decoration:none}
  .rd-find:hover{background:var(--gold-line)}
  .rd-matches{display:flex;flex-direction:column;gap:9px}
  .mt{border:1px solid var(--hair);border-radius:11px;padding:11px 13px}
  .mt-v{display:block;font-size:13.5px;font-weight:600;color:var(--ink);text-decoration:none}
  .mt-v:hover{color:var(--gold-txt)}
  .mt-meta{display:flex;align-items:center;gap:9px;margin-top:6px}
  .mt-when{font-size:11.5px;color:var(--t3)}
  .mt-acts{display:flex;gap:7px;margin-top:9px}
  .mt-btn{background:var(--card);border:1px solid var(--hair);border-radius:8px;padding:5px 11px;font-size:12px;font-weight:600;color:var(--ink);cursor:pointer;font-family:inherit}
  .mt-btn:hover{border-color:var(--gold-line)}
  .mt-yes:hover{border-color:#1F7A4D;color:#1F7A4D}.mt-no:hover{border-color:var(--bad);color:var(--bad)}
  .mt-btn:disabled{opacity:.5;cursor:default}
  .rd-quick{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
  .rd-quick form{display:inline}
  .rd-steps{list-style:none;margin:14px 0 0;padding:0;position:relative}
  .rd-step{display:flex;align-items:center;gap:11px;padding:5px 0;position:relative}
  .rd-step:not(:last-child)::before{content:"";position:absolute;left:5px;top:20px;bottom:-5px;width:2px;background:var(--hair)}
  .rd-sd{width:12px;height:12px;border-radius:9999px;border:2px solid var(--hair);background:var(--card);flex:none;z-index:1}
  .rd-sl{font-size:12.5px;color:var(--t3)}
  .rd-done .rd-sd{background:var(--gold);border-color:var(--gold)}
  .rd-done .rd-sl{color:var(--t2)}
  .rd-now .rd-sd{background:var(--gold);border-color:var(--gold);box-shadow:0 0 0 3px var(--gold-tint)}
  .rd-now .rd-sl{color:var(--ink);font-weight:700}
  .rd-lost{background:var(--bad-bg);color:var(--bad);border-radius:10px;padding:12px 14px;font-size:13px;margin-top:12px}
  .rd-note{width:100%;background:var(--field,var(--card));border:1px solid var(--hair);border-radius:10px;padding:10px 12px;font-family:inherit;font-size:13px;color:var(--ink);resize:vertical}
  .rd-noteact{margin-top:9px}
  .rd-na-cur{font-size:12.5px;color:var(--t2);margin-bottom:11px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .rd-na-note{color:var(--ink)}
  .rd-na{display:flex;flex-direction:column;gap:8px}
  .rd-na input{background:var(--field,var(--card));border:1px solid var(--hair);border-radius:9px;padding:9px 11px;font-family:inherit;font-size:12.5px;color:var(--ink);width:100%}
  .rd-naact{display:flex;gap:8px}
  .rd-tasks{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}
  .rd-newtask{display:flex;gap:7px;flex-wrap:wrap;align-items:center}
  .rd-newtask input[name=title]{flex:1;min-width:120px}
  .rd-newtask input{background:var(--field,var(--card));border:1px solid var(--hair);border-radius:9px;padding:8px 10px;font-family:inherit;font-size:12.5px;color:var(--ink)}
  .tk{display:flex;align-items:flex-start;gap:10px;border:1px solid var(--hair);border-radius:10px;padding:10px 12px}
  .tk-done{opacity:.6}
  .tk-box{width:20px;height:20px;border:1.5px solid var(--hair);border-radius:6px;background:var(--card);cursor:pointer;color:var(--gold-on,#fff);font-size:12px;line-height:1;flex:none;margin-top:1px}
  .tk-box.on{background:var(--gold);border-color:var(--gold)}
  .tk-b{flex:1;min-width:0}
  .tk-t{font-size:13px;font-weight:600;color:var(--ink);line-height:1.35}
  .tk-done .tk-t{text-decoration:line-through}
  .tk-pri{font-size:10px;font-weight:700;color:var(--bad);background:var(--bad-bg);border-radius:9999px;padding:1px 7px;margin-left:5px;vertical-align:middle}
  .tk-c{font-size:11.5px;color:var(--t3);margin-top:4px}
  .tk-r{display:flex;align-items:center;gap:8px;flex:none}
  .tk-due{font-size:11px;font-weight:600;white-space:nowrap}
  .tk-over{color:var(--bad)}.tk-today{color:#C98A00}.tk-soon{color:var(--t2)}.tk-none{color:var(--t3)}
  .tk-del button{border:0;background:none;color:var(--t3);font-size:16px;cursor:pointer;line-height:1;padding:0 2px}
  .tk-del button:hover{color:var(--bad)}
  .tk-check{display:inline}
  .tl{list-style:none;margin:0;padding:0}
  .tl-i{display:flex;gap:11px;padding:0 0 14px;position:relative}
  .tl-i:not(:last-child)::before{content:"";position:absolute;left:4px;top:14px;bottom:0;width:2px;background:var(--hair)}
  .tl-dot{width:10px;height:10px;border-radius:9999px;flex:none;margin-top:3px;z-index:1}
  .tl-neu{background:var(--t3)}.tl-gold{background:var(--gold)}.tl-blue{background:#6F86A6}.tl-good{background:#1F7A4D}.tl-warn{background:#C98A00}
  .tl-d{font-size:12.5px;color:var(--ink);line-height:1.4}
  .tl-m{font-size:11px;color:var(--t3);margin-top:2px}
  .rd-empty{font-size:12.5px;color:var(--t3);padding:6px 2px}
</style>`;

// ---- Tasks board (Priority 3) ----------------------------------------------
function taskScope(session) {
  if (!session || session.role === "admin") return { sql: "1=1", binds: [] };
  return {
    sql: "(t.assigned_to = ? OR c.agent_id = ? OR c.id IN (SELECT client_id FROM client_shares WHERE agent_id = ?))",
    binds: [session.id, session.id, session.id],
  };
}
async function tasksData(env, session) {
  const sc = taskScope(session);
  const rows = (await env.DB.prepare(
    `SELECT t.*, c.name AS client_name, w.marka_name, w.model_name
       FROM tasks t LEFT JOIN clients c ON c.id = t.client_id LEFT JOIN wishlists w ON w.id = t.wishlist_id
      WHERE (t.status != 'done' OR t.done_at >= datetime('now','-7 days')) AND ${sc.sql}
      ORDER BY COALESCE(t.due_date,'9999-99-99'), t.priority='high' DESC, t.id DESC LIMIT 400`
  ).bind(...sc.binds).all()).results || [];
  return rows;
}
function tasksView(rows, opts = {}) {
  const open = rows.filter((t) => t.status !== "done");
  const done = rows.filter((t) => t.status === "done");
  const buckets = { over: [], today: [], soon: [], later: [], none: [] };
  for (const t of open) {
    const d = taskDue(t.due_date);
    if (d.tone === "over") buckets.over.push(t);
    else if (d.tone === "today") buckets.today.push(t);
    else if (d.tone === "soon") buckets.soon.push(t);
    else if (d.tone === "none") buckets.none.push(t);
    else buckets.later.push(t);
  }
  const sec = (title, list, cls) => list.length
    ? `<div class="tks"><div class="tks-h ${cls || ""}">${title}<span class="tks-n">${list.length}</span></div><div class="tks-l">${list.map((t) => taskRow(t, { back: "/admin?view=tasks" })).join("")}</div></div>` : "";
  const body = open.length
    ? sec("Overdue", buckets.over, "tks-over") + sec("Due today", buckets.today, "tks-today") + sec("This week", buckets.soon) + sec("Later", buckets.later) + sec("No due date", buckets.none)
    : `<div class="card"><div class="empty">Nothing on your list. Tasks appear here as you move requests through the pipeline, or add them from a request.</div></div>`;
  const doneSec = done.length ? `<details class="tks-done"><summary>Recently completed (${done.length})</summary><div class="tks-l">${done.map((t) => taskRow(t, { back: "/admin?view=tasks" })).join("")}</div></details>` : "";
  // What is this page? — the client asked for instructions. Collapsible so it
  // stays out of the way once staff know it, open by default the first time.
  const help = `<details class="tks-help" open>
    <summary><span class="tks-help-t">What is the Tasks board?</span><span class="tks-help-x">Hide</span></summary>
    <div class="tks-help-b">
      <p>Your shared to-do list for moving deals forward. A task is a single next
      step tied to a customer or request — "call Lee about the Laurel", "chase
      the deposit", "translate the auction sheet".</p>
      <ul>
        <li><b>Where tasks come from:</b> some are created automatically when you
        move a request to a new stage (e.g. marking a request <i>Interested</i>
        adds a follow-up); you can also add your own from any request's page.</li>
        <li><b>Buckets:</b> tasks sort into <b>Overdue</b>, <b>Due today</b>,
        <b>This week</b>, <b>Later</b> and <b>No due date</b> by their due date.</li>
        <li><b>Completing:</b> tick the box on the left to mark a task done — it
        moves to "Recently completed" for 7 days in case you need to undo.</li>
        <li><b>Who sees what:</b> you see tasks assigned to you and tasks on the
        customers you own or are shared on. Admins see everything.</li>
      </ul>
    </div>
  </details>`;
  return `${TASKS_CSS}
    ${help}
    <div class="tk-strip">
      <div class="tk-stat${buckets.over.length ? " bad" : ""}"><div class="n">${buckets.over.length}</div><div class="l">Overdue</div></div>
      <div class="tk-stat${buckets.today.length ? " warn" : ""}"><div class="n">${buckets.today.length}</div><div class="l">Due today</div></div>
      <div class="tk-stat"><div class="n">${buckets.soon.length}</div><div class="l">This week</div></div>
      <div class="tk-stat"><div class="n">${open.length}</div><div class="l">Open total</div></div>
    </div>
    ${body}${doneSec}`;
}
const TASKS_CSS = `<style>
  .tk-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:20px}
  .tk-stat{background:var(--card);border:1px solid var(--hair);border-radius:12px;padding:14px 16px}
  .tk-stat.bad{border-color:var(--bad-bg)}.tk-stat.warn{border-color:var(--gold-line)}
  .tk-stat .n{font-size:24px;font-weight:800;color:var(--ink);line-height:1;font-variant-numeric:tabular-nums}
  .tk-stat.bad .n{color:var(--bad)}.tk-stat.warn .n{color:#C98A00}
  .tk-stat .l{font-size:11.5px;color:var(--t3);margin-top:6px}
  .tks{margin-bottom:22px}
  .tks-h{font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--t3);margin:0 0 10px;display:flex;align-items:center;gap:8px}
  .tks-over{color:var(--bad)}.tks-today{color:#C98A00}
  .tks-n{background:var(--soft,rgba(0,0,0,.06));border-radius:9999px;padding:1px 8px;font-size:11px;color:var(--t2)}
  .tks-l{display:flex;flex-direction:column;gap:8px}
  .tks-done{margin-top:10px}
  .tks-done summary{font-size:12.5px;color:var(--t3);cursor:pointer;padding:8px 0}
  .tks-done .tks-l{margin-top:10px}
  .tks-help{background:var(--card);border:1px solid var(--hair);border-radius:12px;margin-bottom:18px;overflow:hidden}
  .tks-help summary{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 18px;cursor:pointer;list-style:none}
  .tks-help summary::-webkit-details-marker{display:none}
  .tks-help-t{font-size:14px;font-weight:700;color:var(--ink)}
  .tks-help-x{font-size:12px;font-weight:600;color:var(--gold-txt)}
  .tks-help[open] .tks-help-x::after{content:""}
  .tks-help-b{padding:0 18px 16px;font-size:13px;color:var(--t2);line-height:1.55}
  .tks-help-b p{margin:0 0 10px}
  .tks-help-b ul{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px}
  .tks-help-b b{color:var(--ink)}
</style>`;

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
  return `<div class="card" style="padding:0;overflow-x:auto;-webkit-overflow-scrolling:touch">
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
        ${(lot._watch || chips.length) ? `<div class="why">${lot._watch ? `<span class="wc lead">Lead · follow-up call</span>` : ""}${chips.map((c) => `<span class="wc">${c}</span>`).join("")}</div>` : ""}
        <div class="sc-client">
          ${avatar(q.client_name)}
          <div class="sc-cl"><div class="sc-cl-n">Match for: <a class="gold clink" href="/admin?view=client&id=${q.client_id}" data-drawer="/admin/drawer?id=${q.client_id}" title="See this client's engagement and history to help close them">${esc(q.client_name)}</a></div><div class="sc-cl-w">${esc(q.wlabel || "search")}</div></div>
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
  // Distinct clients + makers in the current queue, for the filter dropdowns.
  const clients = [...new Set(pending.map((q) => q.client_name).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
  const makes = [...new Set(pending.map((q) => { try { return JSON.parse(q.lot_json).marka_name; } catch (e) { return ""; } }).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
  const auctions = [...new Set(pending.map((q) => { try { return JSON.parse(q.lot_json).auction; } catch (e) { return ""; } }).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
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
    ${(clients.length > 1 || makes.length > 1 || auctions.length > 1) ? `<div class="crow crow-filters">
      ${clients.length > 1 ? `<select id="mclient" class="mctl" aria-label="Filter by client"><option value="">Client: all</option>${clients.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join("")}</select>` : ""}
      ${makes.length > 1 ? `<select id="mmake" class="mctl" aria-label="Filter by make"><option value="">Make: all</option>${makes.map((n) => `<option value="${esc(n)}">${esc(displayName(n))}</option>`).join("")}</select>` : ""}
      ${auctions.length > 1 ? `<select id="mauction" class="mctl" aria-label="Filter by auction house"><option value="">Auction: all</option>${auctions.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join("")}</select>` : ""}
    </div>` : ""}
    <div class="fchips">
      <button type="button" class="fchip on" data-str="all">All</button>
      <button type="button" class="fchip" data-str="strong"><span class="sd" style="background:#46B17A"></span>Strong</button>
      <button type="button" class="fchip" data-str="good"><span class="sd" style="background:#CAA34C"></span>Good</button>
      <button type="button" class="fchip" data-str="poss"><span class="sd" style="background:#B6B9BC"></span>Possible</button>
      <button type="button" class="fchip urgent" id="mSoon">Closing in 48h</button>
      <span class="quick">
        <button type="button" id="qAll">Select all shown</button>
        <button type="button" id="qStrong">Select all Strong</button>
        <button type="button" id="qSoon">Select all closing soon</button>
        ${opts.aiEnabled ? `<form method="POST" action="/lot/fix-photos" style="display:inline" onsubmit="var b=this.querySelector('button');b.disabled=true;b.textContent='Starting…';"><button type="submit" id="qFix" title="AI-reads every car not read yet to fix cover photos and pull the inspection sheet (~1–5¢ each)">Fix photos with AI</button></form>` : ""}
      </span>
    </div>
  </div>`;
  // "Delete" hard-removes the selected matches from the queue (client asked for
  // a bulk delete "to start fresh") — distinct from "Skip", which keeps the row
  // as rejected. Guarded by a confirm in the controller.
  const bulk = `<form id="bulkForm" method="POST" action="/matches/bulk"><input type="hidden" name="action" id="bulkAction"></form>
    <div class="bulkbar2" id="bulkBar">
      <span class="bc"><span id="selCount">0</span> selected</span>
      <span class="bsp"></span>
      <button type="submit" form="bulkForm" class="bap" id="bApprove">Approve &amp; send</button>
      <button type="submit" form="bulkForm" class="bsk" id="bSkip">Skip</button>
      <button type="submit" form="bulkForm" class="bdel" id="bDelete">Delete</button>
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
  var st={q:'',str:'all',soon:false,sort:'priority',group:'none',client:'',make:'',auction:''};
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
        if(st.client&&gv(c,'client')!==st.client)ok=false;
        if(st.make&&gv(c,'make')!==st.make)ok=false;
        if(st.auction&&gv(c,'auction')!==st.auction)ok=false;
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
  var mc=document.getElementById('mclient'); if(mc)mc.addEventListener('change',function(e){st.client=e.target.value;apply();});
  var mm=document.getElementById('mmake'); if(mm)mm.addEventListener('change',function(e){st.make=e.target.value;apply();});
  var ma=document.getElementById('mauction'); if(ma)ma.addEventListener('change',function(e){st.auction=e.target.value;apply();});
  [].slice.call(document.querySelectorAll('.fchip[data-str]')).forEach(function(ch){ch.addEventListener('click',function(){st.str=ch.getAttribute('data-str');[].slice.call(document.querySelectorAll('.fchip[data-str]')).forEach(function(x){x.classList.remove('on')});ch.classList.add('on');apply();});});
  var soonBtn=document.getElementById('mSoon'); if(soonBtn)soonBtn.addEventListener('click',function(){st.soon=!st.soon;soonBtn.classList.toggle('on');apply();});
  grid.addEventListener('change',function(e){if(e.target&&e.target.classList&&e.target.classList.contains('msel'))syncBulk();});
  var qa=document.getElementById('qAll'); if(qa)qa.addEventListener('click',function(){cards.forEach(function(c){if(c.__show){var cb=c.querySelector('.msel');if(cb)cb.checked=true;}});syncBulk();});
  var qs=document.getElementById('qStrong'); if(qs)qs.addEventListener('click',function(){cards.forEach(function(c){if(c.__show&&gv(c,'str')==='strong'){var cb=c.querySelector('.msel');if(cb)cb.checked=true;}});syncBulk();});
  var qn=document.getElementById('qSoon'); if(qn)qn.addEventListener('click',function(){cards.forEach(function(c){if(c.__show&&gn(c,'days')<=2){var cb=c.querySelector('.msel');if(cb)cb.checked=true;}});syncBulk();});
  var bcl=document.getElementById('bClear'); if(bcl)bcl.addEventListener('click',function(){cards.forEach(function(c){var cb=c.querySelector('.msel');if(cb)cb.checked=false;});syncBulk();});
  var ba=document.getElementById('bApprove'); if(ba)ba.addEventListener('click',function(ev){if(!confirm('Approve and send the selected matches to their clients?')){ev.preventDefault();return;}document.getElementById('bulkAction').value='approve';});
  var bs=document.getElementById('bSkip'); if(bs)bs.addEventListener('click',function(ev){if(!confirm('Skip the selected matches?')){ev.preventDefault();return;}document.getElementById('bulkAction').value='reject';});
  var bd=document.getElementById('bDelete'); if(bd)bd.addEventListener('click',function(ev){var n=document.getElementById('selCount');n=n?n.textContent:'';if(!confirm('Permanently delete the '+n+' selected match'+(n==='1'?'':'es')+' from the queue? This cannot be undone.')){ev.preventDefault();return;}document.getElementById('bulkAction').value='delete';});
  grid.addEventListener('click',function(e){
    var a=e.target&&e.target.closest?e.target.closest('a.btn-notify, a.btn-skip'):null; if(!a)return;
    var card=a.closest('.mcard'); if(!card)return; e.preventDefault();
    var approve=a.classList.contains('btn-notify'); a.textContent=approve?'Sending…':'Skipping…';
    var u=new URL(a.getAttribute('href'),location.href),body=new URLSearchParams(u.search);body.set('ajax','1');
    fetch('/decide',{method:'POST',body:body}).then(function(r){ if(!r.ok)throw 0;
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
    var u=new URL(a.getAttribute('href'),location.href),body=new URLSearchParams(u.search);body.set('ajax','1');
    fetch('/decide',{method:'POST',body:body}).then(function(r){ if(!r.ok)throw 0;
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
// Owner-only: a shared agent silently changing criteria would redirect future
// automated matches without the owner knowing.
export async function editWishlist(env, form, session) {
  const id = Number(form.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;
  if (!(await wishlistOwnedBy(env, id, session))) return;
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
  // Input nested inside the label = implicit association (screen-reader + click
  // to focus), without ids that would collide across multiple search editors.
  const field = (label, name, type, opt) =>
    `<div><label>${label}${opt ? ` <span class="opt">${opt}</span>` : ""}<input name="${name}"${type ? ` type="${type}"` : ""} value="${esc(w[name] ?? "")}"></label></div>`;
  const summary = `${esc(displayName(w.marka_name)) || "Any maker"} ${esc(displayName(w.model_name))}`.trim()
    + (w.year_min || w.year_max ? ` · ${esc(yearRange(w.year_min, w.year_max))}` : "")
    + (w.price_max ? ` · ¥${Number(w.price_max).toLocaleString()}` : "")
    + (w.rate_min ? ` · grade ${esc(w.rate_min)}+` : "");
  // Staff-only: "Search" runs the live auction search for THIS exact vehicle,
  // pre-filling the Find-a-car form from this search's criteria and jumping to it.
  const searchBtn = (!opts.portal && w.client_id && (w.marka_name || w.model_name || w.kuzov))
    ? (() => {
        const p = new URLSearchParams();
        if (w.marka_name) p.set("make", w.marka_name);
        if (w.model_name) p.set("model", w.model_name);
        if (w.year_min) p.set("yearMin", w.year_min);
        if (w.year_max) p.set("yearMax", w.year_max);
        if (w.price_max) p.set("priceMax", w.price_max);
        if (w.rate_min) p.set("gradeMin", w.rate_min);
        if (w.kuzov) p.set("kuzov", w.kuzov);
        return `<a class="btn-gold wl-search" href="/admin?view=client&id=${w.client_id}&${p.toString()}#find">${ICONS.auctions}Search</a>`;
      })()
    : "";
  return `<div class="wlrow">
    <div class="wlhead">
      <div class="wlsum">
        <div class="wln">${esc(w.label || "Search")} ${w.active ? "" : `<span class="chip muted">paused</span>`}</div>
        <div class="wlc">${summary || "Matches anything"}</div>
      </div>
      <div class="wlacts">
        ${searchBtn}
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
        <div class="ld-share-row"><input id="shareUrl" readonly value="${esc(`/v?t=${encodeURIComponent(shareToken)}`)}" aria-label="Share link"><button type="button" id="shareCopy" class="btn-dark">Copy</button></div>
        <a id="shareWa" href="https://wa.me/?text=${encodeURIComponent(shareTitle + " - /v?t=" + encodeURIComponent(shareToken))}" target="_blank" rel="noopener" class="btn-gold ld-share-wa">Share on WhatsApp</a>
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
        <div class="ld-hero" id="ldHero" role="img" aria-label="${title}" style="background-image:url('${esc(big(photoBases[0]))}')"></div>
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
  const ret = `/admin?view=client&id=${q.client_id}`;
  const actions = q.status === "pending"
    ? `<div class="ld-actions">
        <form method="POST" action="/decide">
          <input type="hidden" name="token" value="${esc(q.token)}">
          <input type="hidden" name="action" value="reject">
          <input type="hidden" name="return" value="${esc(ret)}">
          <button class="btn-skip" type="submit">Skip</button>
        </form>
        <form method="POST" action="/decide" onsubmit="return confirm('Approve and send this match to the client?')">
          <input type="hidden" name="token" value="${esc(q.token)}">
          <input type="hidden" name="action" value="approve">
          <input type="hidden" name="return" value="${esc(ret)}">
          <button class="btn-notify" type="submit">${lot._watch ? "Mark done" : "Approve &amp; send"}</button>
        </form>
      </div>`
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
            ${actions}
            <div class="ld-rows">${specRows}</div>
            <div class="ld-sec">Auction</div>
            <div class="ld-rows">${auctionRows}</div>
            <div class="ld-client">${avatar(q.client_name)}<div class="ld-cl"><div class="ld-cl-n">Match for ${esc(q.client_name)}</div><div class="ld-cl-w">${esc(q.wlabel || "search")}</div></div></div>
            ${chips.length ? `<div class="why" style="padding:14px 0 0">${chips.map((c) => `<span class="wc">${c}</span>`).join("")}</div>` : ""}
          </div>
        </aside>
      </div>
    </div>${lotGalleryScript()}${shareScript}${autoOpen ? `<script>(function(){var f=document.querySelector('.ld-ai-form');if(!f)return;var b=f.querySelector('button');if(b){b.disabled=true;b.textContent='Reading the sheet… (~10s)';}f.submit();})();</script>` : ""}`;
  return shell(sidebar("matches", {}, session), main, title + " - JDM Connect");
}

// Styles for the CRM client header (status chips, contact quick-actions,
// engagement stat strip) and the lighter outline "back" button that replaces
// the heavy black one the client flagged. Loaded once with the header.
const CRM_CSS = `<style>
  .cd-chips{display:flex;flex-wrap:wrap;gap:6px}
  .cd-chip{font-size:11px;font-weight:700;padding:3px 9px;border-radius:9999px;background:rgba(0,0,0,.06);color:var(--t2)}
  .cd-chip-gold{background:var(--gold-tint);color:var(--gold-txt)}
  .cd-chip-ok{background:rgba(31,122,77,.14);color:#1F7A4D}
  .cd-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
  .cd-cta{text-decoration:none;font-size:13px;font-weight:600;padding:8px 14px;border-radius:9px;background:var(--card);border:1px solid var(--hair);color:var(--ink)}
  .cd-cta:hover{border-color:var(--gold-line);color:var(--gold-txt)}
  .cd-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(88px,1fr));gap:12px;margin-top:16px;padding-top:16px;border-top:1px solid var(--hair)}
  .cd-stat-n{font-size:24px;font-weight:800;color:var(--ink);line-height:1;font-variant-numeric:tabular-nums}
  .cd-stat-n.cd-stat-sm{font-size:15px;font-weight:700}
  .cd-stat-l{font-size:11px;color:var(--t3);margin-top:6px}
  .btn-line{display:inline-flex;align-items:center;text-decoration:none;font-size:13px;font-weight:600;padding:9px 15px;border-radius:9px;background:transparent;border:1px solid var(--hair);color:var(--t2);white-space:nowrap}
  .btn-line:hover{border-color:var(--gold-line);color:var(--gold-txt)}
</style>`;

export async function clientDetailPage(env, clientId, session = { role: "admin", id: 0 }, opts = {}) {
  const cid = Number(clientId);
  const notFound = () => shell(sidebar("clients", {}, session),
    `<div class="topbar"><div><div class="kicker">Vehicle Finder</div><h1>Client</h1></div><a class="btn-line" href="/admin?view=clients">Back to clients</a></div>
     <div class="content"><div class="card"><div class="empty">Client not found.</div></div></div>${CRM_CSS}`,
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

  // Engagement roll-up across ALL of this client's matches (not just pending) so
  // the CRM header can show at a glance: examples sent, how many they opened,
  // and when they last looked — the numbers that tell staff how warm they are.
  const eng = (await env.DB.prepare(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN sent_at IS NOT NULL THEN 1 ELSE 0 END) AS sent,
            SUM(CASE WHEN viewed_at IS NOT NULL THEN 1 ELSE 0 END) AS viewed,
            SUM(CASE WHEN response = 'interested' THEN 1 ELSE 0 END) AS interested,
            MAX(viewed_at) AS last_viewed
       FROM queue WHERE client_id = ?`
  ).bind(cid).first()) || {};

  // Surface the snapshotted landed cost on each match card (as the Matches view does).
  for (const q of matches) { try { const lot = JSON.parse(q.lot_json); if (lot._landed) q._landed = lot._landed; } catch (e) {} }
  // Hide the internal catch-all searches (Direct requests / Manual finds) from the
  // editable Searches list — they're plumbing, not searches staff manage.
  const searchWls = wls.filter((w) => !SYSTEM_WISHLIST_LABELS.has(w.label));

  const owner = c.agent_id ? await env.DB.prepare("SELECT name, company FROM agents WHERE id = ?").bind(c.agent_id).first() : null;
  const ownerLabel = owner ? esc(owner.name) + (owner.company ? " · " + esc(owner.company) : "") : "JDM Connect";
  const contact = [c.email && `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`, c.whatsapp && esc(c.whatsapp), c.state && esc(c.state)].filter(Boolean).join(" &middot; ") || "No contact on file";
  const canManage = session.role === "admin" || Number(c.agent_id) === Number(session.id);

  // CRM header: identity + status chips + one-tap contact + an engagement stat
  // strip. Replaces the old bare name/contact card (client: "seems bland").
  const waDigits = String(c.whatsapp || "").replace(/[^0-9]/g, "");
  const telDigits = String(c.whatsapp || "").replace(/[^0-9+]/g, "");
  const statusChips = [
    c.member ? `<span class="cd-chip cd-chip-gold">Member</span>` : `<span class="cd-chip">Not a member</span>`,
    c.portal_enabled ? `<span class="cd-chip cd-chip-ok">Portal ${c.pass_hash ? "active" : "invited"}</span>` : "",
    c.destination_country ? `<span class="cd-chip">${esc(c.destination_country)}</span>` : (c.state ? `<span class="cd-chip">${esc(c.state)}</span>` : ""),
  ].filter(Boolean).join("");
  const contactBtns = [
    waDigits ? `<a class="cd-cta" href="https://wa.me/${esc(waDigits)}" target="_blank" rel="noopener">WhatsApp</a><a class="cd-cta" href="tel:${esc(telDigits)}">Call</a>` : "",
    c.email ? `<a class="cd-cta" href="mailto:${esc(c.email)}">Email</a>` : "",
    canManage ? `<a class="cd-cta" href="#find">Find a car</a>` : "",
  ].filter(Boolean).join("");
  const stat = (n, label) => `<div class="cd-stat"><div class="cd-stat-n">${Number(n) || 0}</div><div class="cd-stat-l">${label}</div></div>`;
  const lastViewed = eng.last_viewed ? String(eng.last_viewed).slice(0, 10) : "—";
  const head = `<div class="card cd-card">
    <div class="cd-head">
      <span class="avatar" style="width:46px;height:46px;font-size:16px">${esc(initials(c.name))}</span>
      <div style="flex:1;min-width:0">
        <h2 style="border:0;padding:0;margin:0 0 5px">${esc(c.name)}</h2>
        <div class="cd-chips">${statusChips}</div>
        <div class="help" style="margin-top:7px">${contact}</div>
      </div>
      <div class="cd-owner"><div class="k">Owner</div><div class="v">${ownerLabel}</div></div>
    </div>
    ${contactBtns ? `<div class="cd-actions">${contactBtns}</div>` : ""}
    <div class="cd-stats">
      ${stat(searchWls.length, searchWls.length === 1 ? "Search" : "Searches")}
      ${stat(matches.length, "Live matches")}
      ${stat(eng.sent, "Examples sent")}
      ${stat(eng.viewed, "Opened")}
      ${stat(eng.interested, "Interested")}
      <div class="cd-stat"><div class="cd-stat-n cd-stat-sm">${lastViewed}</div><div class="cd-stat-l">Last viewed</div></div>
      <div class="cd-stat"><div class="cd-stat-n cd-stat-sm">${c.last_seen ? String(c.last_seen).slice(0, 10) : "—"}</div><div class="cd-stat-l">Last login</div></div>
    </div>
  </div>${CRM_CSS}`;

  // Edit core contact details (owner/admin only). Folded away by default, but
  // springs open if the last save failed so the error and the form are visible.
  const editCard = canManage ? `<details class="card foldcard"${opts.cerr ? " open" : ""}>
    <summary>Edit details</summary>
    ${opts.cerr ? `<div class="dupnote">${esc(clientEditErrorMessage(opts.cerr))}</div>` : ""}
    <form method="POST" action="/client/update">
      <input type="hidden" name="id" value="${c.id}">
      <div class="grid">
        <div><label for="ec-name">Name</label><input id="ec-name" name="name" value="${esc(c.name || "")}" required></div>
        <div><label for="ec-email">Email <span class="opt">(email or WhatsApp required)</span></label><input id="ec-email" name="email" type="email" spellcheck="false" value="${esc(c.email || "")}" placeholder="name@email.com"></div>
        <div><label for="ec-whatsapp">WhatsApp <span class="opt">(+61…)</span></label><input id="ec-whatsapp" name="whatsapp" type="tel" inputmode="tel" value="${esc(c.whatsapp || "")}" placeholder="+61 4XX XXX XXX"></div>
        <div><label for="ec-state">State <span class="opt">(for landed-cost estimates)</span></label><input id="ec-state" name="state" value="${esc(c.state || "")}" placeholder="VIC"></div>
      </div>
      <div class="actions"><button class="btn-gold" type="submit">Save changes</button>
        <span class="help">Updates this client's contact details across the app.</span></div>
    </form>
  </details>` : "";

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
    ${c.portal_enabled ? `<div class="portal-acct" style="margin-top:14px;padding-top:14px;border-top:1px solid var(--hair)">
      <div style="flex:1">
        <div class="pa-k">MEMBERSHIP</div>
        <div style="font-weight:600;margin-top:3px">${c.member ? "Member &middot; can use Auction search" : "Not a member"}</div>
      </div>
      <div class="pwrap">
        ${session.role === "admin"
          ? `<form method="POST" action="/client/member" style="display:inline"><input type="hidden" name="id" value="${c.id}"><input type="hidden" name="member" value="${c.member ? "0" : "1"}"><button class="${c.member ? "btn-del" : "btn-gold"}" type="submit">${c.member ? "Remove member access" : "Make member"}</button></form>`
          : `<span class="help">Managed by JDM Connect (paid membership).</span>`}
      </div>
    </div>` : ""}
  </div>` : "";

  const reqSection = requested.length ? `<div class="card">
    <h2><span class="num">${requested.length}</span> Cars ${esc(c.name)} asked us to action</h2>
    <p class="help" style="margin:-8px 0 16px">Requested from their portal - pull the auction sheet, translate, and follow up.</p>
    <div class="mgrid">${requested.map((q) => requestedCard(q)).join("")}</div>
  </div>` : "";

  const newWl = `<details class="card foldcard"${searchWls.length ? "" : " open"}>
    <summary>${searchWls.length ? "Add another search" : "Add a search"} for ${esc(c.name)}</summary>
    <form method="POST" action="/wishlist">
      <input type="hidden" name="client_id" value="${c.id}">
      ${presetSelect()}
      <div class="grid">
        <div><label for="as-label">Label</label><input id="as-label" name="label" placeholder="e.g. weekend project"></div>
        <div><label for="as-make">Make</label><input id="as-make" name="marka_name" placeholder="e.g. TOYOTA"></div>
        <div><label for="as-model">Model <span class="opt">(contains)</span></label><input id="as-model" name="model_name" placeholder="e.g. SUPRA"></div>
        <div><label for="as-yearmin">Year min</label><input id="as-yearmin" name="year_min" type="number" placeholder="1990"></div>
        <div><label for="as-yearmax">Year max</label><input id="as-yearmax" name="year_max" type="number" placeholder="2002"></div>
        <div><label for="as-pricemax">Max price (JPY)</label><input id="as-pricemax" name="price_max" type="number" placeholder="1,500,000"></div>
        <div><label for="as-mileagemax">Max mileage (km)</label><input id="as-mileagemax" name="mileage_max" type="number" placeholder="80,000"></div>
        <div><label for="as-grademin">Min grade</label><input id="as-grademin" name="rate_min" type="number" step="0.5" placeholder="e.g. 4"></div>
        <div><label for="as-chassis">Chassis / model code <span class="opt">(contains, best match)</span></label><input id="as-chassis" name="kuzov" placeholder="e.g. JZA80 or 211"></div>
      </div>
      <label style="display:flex;align-items:flex-start;gap:9px;margin-top:14px;font-size:13px;color:#3A3C3F;cursor:pointer"><input type="checkbox" name="watch_only" value="1" style="width:auto;margin-top:2px"><span><strong>Watch only (lead).</strong> Surface matches for a follow-up call, but never auto-email this client.</span></label>
      <div class="actions"><button class="btn-gold" type="submit">Add search</button>
        <span class="help">Add at least a make, model or chassis/model code.</span></div>
    </form>${presetScript()}
  </details>`;

  const wlSection = `<div class="card">
    <h2><span class="num">${searchWls.length}</span> ${searchWls.length === 1 ? "Search" : "Searches"}</h2>
    ${searchWls.map((w) => wishlistEditor(w, { open: searchWls.length === 1 })).join("") || `<div class="empty">No search yet — add what ${esc(c.name)} is chasing below.</div>`}
  </div>`;

  // Manual auction search for this client (same access as managing them). Hits the
  // live feed only when a query is present, so a normal page load stays cheap.
  const firstName = String(c.name || "").trim().split(/\s+/)[0] || "this client";
  const sp = opts.search || {};
  const findKeys = ["make", "model", "yearMin", "yearMax", "priceMax", "gradeMin", "kuzov"];
  const findHasQuery = findKeys.some((k) => String(sp[k] || "").trim());
  let findResults = "";
  if (canManage && findHasQuery) {
    const { lots } = await searchLots(env, sp);
    if (lots.length) {
      try { await attachLanded(env, lots.map((lot) => ({ lot, client: { state: c.state } }))); } catch (e) {}
      const qs = new URLSearchParams();
      for (const k of findKeys) { const v = String(sp[k] || "").trim(); if (v) qs.set(k, v); }
      findResults = `<div class="mgrid" style="margin-top:18px">${lots.map((lot) => staffFindCard(lot, c.id, firstName, qs.toString())).join("")}</div>`;
    } else {
      findResults = `<div class="empty" style="margin-top:14px">No upcoming lots match that search. Try fewer filters, or a broader make/model.</div>`;
    }
  }
  const findMakers = canManage ? await distinctMakers(env) : [];
  // Pre-fill the search with what this client is already chasing (their first
  // saved search), so staff don't re-type it. Once they actually run a search,
  // show that query instead.
  const primaryWl = searchWls[0] || {};
  const findPrefill = findHasQuery ? sp : {
    make: primaryWl.marka_name || "", model: primaryWl.model_name || "",
    yearMin: primaryWl.year_min || "", yearMax: primaryWl.year_max || "",
    priceMax: primaryWl.price_max || "", gradeMin: primaryWl.rate_min || "",
    kuzov: primaryWl.kuzov || "",
  };
  const prefilledFromWl = !findHasQuery && !!(primaryWl.marka_name || primaryWl.model_name);
  const fv = (k) => esc(findPrefill[k] ?? "");
  const foundFlash = opts.found === "added"
    ? `<div class="flash" style="margin-top:14px">Added to ${esc(c.name)}'s review queue — scroll to <strong>Live matches</strong> below, then Approve &amp; send.</div>`
    : opts.found === "dup" ? `<div class="dupnote" style="margin-top:14px">That car is already in ${esc(c.name)}'s queue.</div>`
    : opts.found === "err" ? `<div class="dupnote" style="margin-top:14px">Sorry, we couldn't add that lot — please try again.</div>` : "";
  const findCard = canManage ? `<div class="card" id="find" style="scroll-margin-top:80px">
    <h2><span class="num" aria-hidden="true">${ICONS.search || "&#9906;"}</span> Find a car for ${esc(firstName)}</h2>
    <p class="help" style="margin:-8px 0 16px">${prefilledFromWl ? `Pre-filled from ${esc(firstName)}'s saved search — tweak it or just hit Search. ` : ""}Search the live Japanese auctions and add any lot straight to ${esc(firstName)}'s review queue — then Approve &amp; send it like any match.</p>
    <form method="GET" action="/admin">
      <input type="hidden" name="view" value="client"><input type="hidden" name="id" value="${c.id}">
      <div class="grid">
        <div><label>Make<input name="make" list="find-makers" value="${fv("make")}" placeholder="e.g. NISSAN"></label><datalist id="find-makers">${findMakers.map((m) => `<option value="${esc(m)}">`).join("")}</datalist></div>
        <div><label>Model <span class="opt">(contains)</span><input name="model" value="${fv("model")}" placeholder="e.g. SKYLINE"></label></div>
        <div><label>Year from<input name="yearMin" type="number" min="1960" value="${fv("yearMin")}" placeholder="1990"></label></div>
        <div><label>Year to<input name="yearMax" type="number" min="1960" value="${fv("yearMax")}" placeholder="2002"></label></div>
        <div><label>Max price <span class="opt">(JPY)</span><input name="priceMax" type="number" min="0" step="10000" value="${fv("priceMax")}" placeholder="3,000,000"></label></div>
        <div><label>Min grade<input name="gradeMin" type="number" min="1" max="6" step="0.5" value="${fv("gradeMin")}" placeholder="e.g. 4"></label></div>
        <div><label>Chassis / model code <span class="opt">(contains)</span><input name="kuzov" value="${fv("kuzov")}" placeholder="e.g. GDB"></label></div>
      </div>
      <div class="actions"><button class="btn-gold" type="submit">Search auctions</button>
        <span class="help">Searches upcoming Japanese auctions live. Blank fields match anything.</span></div>
    </form>${foundFlash}${findResults}
  </div>` : "";

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
      <a class="btn-line" href="/admin?view=clients">&larr; Back to clients</a>
    </div>
    <div class="content">${opts.dup ? `<div class="dupnote">A client with that email or phone already existed, so we opened <strong>${esc(c.name)}</strong> instead of creating a duplicate. Add the new search below, or check their details are right.</div>` : ""}${opts.saved ? `<div class="flash">Client details saved.</div>` : ""}${head}${wlSection}${newWl}${findCard}${matchSection}${reqSection}${portalCard}${editCard}</div>${matchActionScript()}`;
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
  // Keep the form short for cold ad traffic: only Make/Model show by default,
  // the rest fold away. Re-open the extra fields if any came back filled (e.g.
  // a preset, or a re-render after a contact error) so nothing looks lost.
  const moreOpen = ["mileage_max", "rate_min", "kuzov", "label"].some((k) => vals[k]);
  const makers = await distinctMakers(env);
  // Social login: the button shows only when Google is configured. `signedIn`
  // ({name,email}) means the visitor arrived already authenticated, so the
  // account step collapses to a one-tap confirm (no email/password re-entry).
  const googleOn = googleConfigured(env);
  const signedIn = opts.signedIn || null;

  // Focused top nav shared by the wizard and the success page (no sidebar).
  const topnav = `<header class="ob-nav"><div class="ob-nav-in">
        <a class="ob-brand" href="/" aria-label="JDM Connect Finder home">${LOGO}<span class="tag">Finder</span></a>
        <a class="ob-signin" href="/login">Sign in</a>
      </div></header>`;

  // ----- Success page (P9): a launch pad, not a dead end -----
  if (ok) {
    const car = [esc(req.marka_name || ""), esc(req.model_name || "")].filter(Boolean).join(" ") || "Your vehicle";
    const yr = req.year_min && req.year_max ? `${esc(req.year_min)} to ${esc(req.year_max)}` : "";
    const bud = req.budget_aud ? `Budget up to A$${Number(req.budget_aud).toLocaleString("en-AU")} all-in` : "";
    const st = req.state ? `Registered in ${esc(req.state)}` : "";
    const summaryRows = [`<b>${car}</b>`, yr, bud, st].filter(Boolean)
      .map((t) => `<li><span class="tick">&#10003;</span><span>${t}</span></li>`).join("");
    const acct = req.portal
      ? `<strong>Your account is ready.</strong> Sign in any time with your email and password to track your search.`
      : req.existing
        ? `You've enquired before, so we added this to your existing details. Sign in to track it, or check your email for a link to set your password.`
        : `We'll be in touch the moment a match appears.`;
    // Conversion tracking: fire a Meta Pixel "Lead" only on a genuine, server-
    // validated sign-up (a real req with a name) - never on the honeypot / rate-
    // limited generic success, so bots and spam never inflate the conversion.
    // fbq is already initialised in <head> via brandDoc's ANALYTICS_HEAD.
    const isLead = !!(opts.req && opts.req.name);
    const leadPixel = isLead
      ? `<script>try{window.fbq&&fbq('track','Lead',{content_name:'Finder vehicle request',content_category:'vehicle_request'});}catch(e){}try{window.dataLayer&&window.dataLayer.push({event:'finder_signup'});}catch(e){}</script>`
      : "";
    // Free-tier "first example": the moment they sign up we run the search once.
    // Show the live match we already found (or that we're scanning), then the
    // upsell to unlimited. Both are only ever passed in for non-member buyers.
    const wlot = opts.welcome && opts.welcome.found ? opts.welcome.lot : null;
    const welcomeCard = wlot
      ? `<div class="ob-card" style="border:1px solid rgba(70,177,122,.45);background:linear-gradient(180deg,#F2FBF6,#fff)">
          <div class="rk" style="font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#2E9A63;margin-bottom:10px">Good news - we already found ${opts.welcome.count > 1 ? `${opts.welcome.count} live matches` : "a live match"}</div>
          <div style="font-size:19px;font-weight:800;color:#12131a">${esc([wlot.year, wlot.marka_name, wlot.model_name].filter(Boolean).join(" ")) || "A matching vehicle"}</div>
          ${wlot._strength ? `<div style="margin-top:6px;font-size:13px;color:#5b616b"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${esc(wlot._strengthColor || "#46B17A")};margin-right:7px;vertical-align:middle"></span>${esc(wlot._strength)} match, live at auction now</div>` : ""}
          <p class="ob-note-sm" style="margin-top:12px">${opts.welcome.emailed ? `We've emailed ${req.email ? `<strong>${esc(req.email)}</strong>` : "you"} the full details${opts.welcome.count > 1 ? " for each" : ""}.` : "Our team is preparing the full details for you now."}</p>
        </div>`
      : (opts.welcome
        ? `<div class="ob-card"><p class="ob-note-sm" style="margin:0">We're scanning every live Japanese auction for your exact car right now - we'll email you the instant one lists.</p></div>`
        : "");
    const upsellCard = opts.upsell
      ? `<div class="ob-card" style="border:1px solid var(--gold);background:linear-gradient(180deg,#FFFBEF,#fff)">
          <div class="rk" style="font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-txt);margin-bottom:8px">Want the full picture?</div>
          <div style="font-size:18px;font-weight:800;color:#12131a;margin-bottom:6px">Unlock unlimited searches - A$${Number(opts.upsell.priceAud || 0).toLocaleString("en-AU")}/mo</div>
          <p class="ob-note-sm" style="margin:0 0 14px">Your free account starts you off with one example. Full access lets you search every live Japanese auction yourself and receive every match the moment it appears - no waiting.</p>
          <a class="btn-gold" href="/login">Get full access <span aria-hidden="true">&rarr;</span></a>
        </div>`
      : "";
    const successInner = `<div class="ob">
      ${topnav}
      <main class="ob-main" id="main"><div class="ob-success">
        <div class="ob-badge"><span class="tk">&#10003;</span> Request received</div>
        <h1>Your search is live${firstName ? ", " + esc(firstName) : ""}.</h1>
        <p class="ob-sub">We're now monitoring the Japanese auctions for your vehicle and ${req.email ? `will email <strong>${esc(req.email)}</strong>` : "will contact you"} the moment a suitable match appears. New cars list constantly, so a quiet spell at the start is completely normal.</p>
        ${welcomeCard}
        <div class="ob-card">
          <div class="rk" style="font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-txt);margin-bottom:14px">Searching for</div>
          <ul class="ob-summary">${summaryRows}</ul>
        </div>
        ${upsellCard}
        <div class="ob-meta">
          <div class="c"><div class="k">Request ID</div><div class="v">${esc(ref || "-")}</div></div>
          <div class="c"><div class="k">Search status</div><div class="v"><span class="ok">Active</span>, monitoring auctions</div></div>
          <div class="c"><div class="k">Next update</div><div class="v">As soon as a match appears</div></div>
        </div>
        ${successTimeline()}
        <p class="ob-note-sm">${acct}</p>
        <div class="ob-cta">
          <a class="btn-gold" href="/login">View my dashboard <span aria-hidden="true">&rarr;</span></a>
          <a class="btn-ghost" href="/">Browse recent imports</a>
        </div>
        ${supportBlock()}
      </div></main>
    </div>
    <style>${onboardingCss}</style>
    <script>(function(){try{localStorage.removeItem('jdmReqDraft');}catch(e){}})();</script>${leadPixel}`;
    return brandDoc(successInner, "Your search is live - JDM Connect", { analytics: true });
  }

  // Bounce the wizard straight to the step that owns a server-side error, so a
  // re-render never lands the visitor on the wrong screen.
  const errStep = opts.error === "vehicle" || opts.error === "year" ? "1"
    : opts.error === "budget" ? "2"
      : (opts.error === "email" || opts.error === "password" || opts.error === "exists" || opts.error === "phone") ? "4"
        : "";
  const bannerMsg = opts.error === "phone"
    ? "Please enter a valid mobile number so we can reach you the moment a match appears."
    : opts.error === "google"
    ? "We couldn't sign you in with Google. Please try again, or fill in the form below."
    : opts.error === "exists"
    ? 'That email already has an account. <a href="/login" style="color:var(--gold-txt);font-weight:700">Sign in</a> instead.'
    : opts.error === "password"
      ? esc(opts.pwError || `Please choose a password of ${PW_MIN} to ${PW_MAX} characters (letters and numbers).`)
      : opts.error === "vehicle"
        ? "Please choose a make and model so we know what car to look for."
        : opts.error === "year"
          ? "Please enter the year range you're after (and make sure 'from' isn't later than 'to')."
          : opts.error === "budget"
            ? "Please enter your maximum all-in budget in AUD (at least A$5,000)."
            : opts.error === "email"
              ? "Please enter your email so we can set up your account and reach you when a match comes up."
              : "";
  const banner = opts.error
    ? `<div style="background:#FCE9EC;border:1px solid rgba(177,18,38,0.28);color:#8A1020;border-radius:12px;padding:14px 18px;margin-bottom:24px;font-size:14px;line-height:1.5">${bannerMsg}</div>`
    : "";

  const inner = `<div class="ob">
      ${topnav}
      <div class="ob-stepper">
        <ol class="ob-steps" id="obSteps" aria-hidden="true">
          <li class="is-active"><span class="dot">1</span><span class="lbl">Find car</span></li>
          <li><span class="dot">2</span><span class="lbl">Budget</span></li>
          <li><span class="dot">3</span><span class="lbl">Review</span></li>
          <li><span class="dot">4</span><span class="lbl">Account</span></li>
        </ol>
      </div>
      <main class="ob-main" id="main">
        ${banner}
        <form id="requestForm" class="ob-form" method="POST" action="/request" novalidate${errStep ? ` data-error-step="${errStep}"` : ""}>
          <input type="text" name="company_website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0" />

          <section class="ob-step is-active" data-step="1" aria-label="Find your car">
            ${socialProofStrip()}
            <div class="ob-eyebrow">Start your search</div>
            <h1>What vehicle are you looking for?</h1>
            <p class="ob-lead">Tell us what you're chasing and we'll search every major Japanese auction house for matching vehicles.</p>
            <div class="ob-sub-h">Popular searches</div>
            ${popularCards()}
            <div class="ob-fields">
              <div><label for="rq-maker">Make</label>${makerField(makers, "rq-maker", "Select a make", vals.marka_name).replace('id="rq-maker"', 'id="rq-maker" aria-describedby="rq-vehicle-error"')}</div>
              <div><label for="rq-models">Model</label>${modelField("rq-models", vals.model_name).replace('id="rq-models"', 'id="rq-models" aria-describedby="rq-vehicle-error"')}</div>
              <div><label for="rq-ymin">Year from</label><input id="rq-ymin" name="year_min" type="number" inputmode="numeric" min="1970" max="2050" value="${v("year_min")}" placeholder="1990" required aria-describedby="rq-year-error"></div>
              <div><label for="rq-ymax">Year to</label><input id="rq-ymax" name="year_max" type="number" inputmode="numeric" min="1970" max="2050" value="${v("year_max")}" placeholder="2002" required aria-describedby="rq-year-error"></div>
            </div>
            <p id="rq-vehicle-error" class="field-err" role="alert">Please choose a make and model so we know what to look for.</p>
            <p id="rq-year-error" class="field-err" role="alert">Please enter the year range you're after ("from" can't be later than "to").</p>
            ${recentExamplesShell()}
            <div class="ob-nav-btns ob-only">
              <button type="button" class="btn-gold ob-next-btn" data-next>Next: your budget <span aria-hidden="true">&rarr;</span></button>
            </div>
          </section>

          <section class="ob-step" data-step="2" aria-label="Budget and requirements">
            <div class="ob-eyebrow">Your budget</div>
            <h1>What&rsquo;s your budget?</h1>
            <p class="ob-lead">Your total landed budget in AUD, the car plus shipping, duties and on-road costs, delivered to your door. A realistic figure finds the right car faster.</p>
            <div class="ob-cols">
              <div>
                <div class="ob-sub-h">Quick pick</div>
                ${budgetChips()}
                <div class="ob-budget">
                  <label for="rq-budget">Maximum budget <span class="opt">(AUD, all-in)</span></label>
                  <div class="in"><span class="cur" aria-hidden="true">A$</span><input id="rq-budget" name="budget_aud" type="number" inputmode="numeric" min="5000" max="1000000" step="500" value="${v("budget_aud")}" placeholder="35,000" required aria-describedby="rq-budget-error"></div>
                </div>
                <p id="rq-budget-error" class="field-err" role="alert">Please enter your maximum all-in budget in AUD (at least A$5,000).</p>
                <div class="ob-fields" style="margin-top:18px">
                  <div><label for="rq-state">State <span class="opt">(where it&rsquo;ll be registered)</span></label><select id="rq-state" name="state">${stateOptions(vals.state || "")}</select></div>
                  <div><label for="rq-dest">Delivering to <span class="opt">(country, if outside Australia)</span></label><input id="rq-dest" name="destination_country" value="${v("destination_country")}" placeholder="Leave blank for Australia" maxlength="60"></div>
                </div>
                <details class="ob-refine"${moreOpen ? " open" : ""}>
                  <summary>Refine my search (optional)</summary>
                  <div class="ob-fields">
                    <div><label for="rf-mileage">Max mileage <span class="opt">(km)</span></label><input id="rf-mileage" name="mileage_max" type="number" inputmode="numeric" min="0" max="2000000" step="1000" value="${v("mileage_max")}" placeholder="100,000"></div>
                    <div><label for="rf-grade">Min auction grade <span class="opt">(1 to 6)</span></label><input id="rf-grade" name="rate_min" type="number" min="1" max="6" step="0.5" value="${v("rate_min")}" placeholder="e.g. 4"></div>
                    <div><label for="rf-chassis">Chassis code <span class="opt">(if known)</span></label><input id="rf-chassis" name="kuzov" value="${v("kuzov")}" placeholder="e.g. JZA80" maxlength="40"></div>
                    <div><label for="rf-label">Nickname <span class="opt">(for your reference)</span></label><input id="rf-label" name="label" value="${v("label")}" placeholder="e.g. weekend project" maxlength="120"></div>
                  </div>
                </details>
              </div>
              ${testimonialPanel()}
            </div>
            <div class="ob-nav-btns ob-only">
              <button type="button" class="btn-ghost ob-back" data-back><span aria-hidden="true">&larr;</span> Back</button>
              <button type="button" class="btn-gold ob-next-btn" data-next>See my search summary <span aria-hidden="true">&rarr;</span></button>
            </div>
          </section>

          <section class="ob-step" data-step="3" aria-label="Review your search">
            <div class="ob-eyebrow">Review</div>
            <h1>Great choice.</h1>
            <div class="ob-cols">
              <div>
                <div class="ob-review ob-only" id="obReview"></div>
                <p class="ob-nojs ob-lead">Check your details below, then create your free account to start the search.</p>
                <p class="ob-note">We monitor thousands of Japanese auction listings every week and notify you as soon as a suitable vehicle appears.</p>
              </div>
              ${whyUs()}
            </div>
            <div class="ob-nav-btns ob-only">
              <button type="button" class="btn-ghost ob-back" data-back><span aria-hidden="true">&larr;</span> Back</button>
              <button type="button" class="btn-gold ob-next-btn" data-next>Create my free account <span aria-hidden="true">&rarr;</span></button>
            </div>
          </section>

          ${signedIn ? `<section class="ob-step" data-step="4" aria-label="Confirm and start your search">
            <div class="ob-eyebrow">Almost there</div>
            <h1>Confirm your search</h1>
            <p class="ob-lead">You&rsquo;re signed in, so there&rsquo;s nothing else to fill in - just start your search.</p>
            <div class="ob-cols">
              <div>
                <div style="display:flex;align-items:center;gap:14px;padding:16px 18px;border:1px solid rgba(0,0,0,.1);border-radius:14px;background:#f7f9fc;margin-bottom:18px">
                  <span style="display:inline-flex;width:40px;height:40px;align-items:center;justify-content:center;background:#fff;border:1px solid #e3e7ee;border-radius:50%" aria-hidden="true">${GOOGLE_G_SVG}</span>
                  <span style="display:flex;flex-direction:column;line-height:1.35">
                    <span style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#8a8f98">Signed in as</span>
                    <span style="font-weight:700;color:#1b1b1b;word-break:break-all">${esc(signedIn.email || "")}</span>
                  </span>
                </div>
                <div class="ob-fields">
                  <div><label for="rq-whatsapp">Mobile / WhatsApp</label><input id="rq-whatsapp" name="whatsapp" type="tel" inputmode="tel" autocomplete="tel" value="${v("whatsapp") || esc(signedIn.whatsapp || "")}" placeholder="+61 4XX XXX XXX" maxlength="40" required></div>
                </div>
                <p id="rq-whatsapp-error" class="field-err">Please enter a mobile number so we can reach you the moment a match appears.</p>
                <div class="ob-human">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 19a6 6 0 0 0-12 0"/><circle cx="9" cy="8" r="4"/><path d="M15.5 11.5l2 2 4-4"/></svg>
                  <span>Every search is reviewed by a JDM Connect specialist before recommendations are sent.</span>
                </div>
                <div class="ob-cta-row">
                  <button type="button" class="btn-ghost ob-back ob-only" data-back><span aria-hidden="true">&larr;</span> Back</button>
                  <button class="btn-gold" type="submit">Start my search</button>
                </div>
                <p class="ob-note-sm">Not you? <a href="/logout" style="color:var(--gold-txt);font-weight:600">Sign out</a>.</p>
              </div>
              ${whatHappensNext()}
            </div>
          </section>` : `<section class="ob-step" data-step="4" aria-label="Create your account">
            <div class="ob-eyebrow">Almost there</div>
            <h1>Create your free account</h1>
            <p class="ob-lead">This becomes your login, so you can sign in and track your search anytime.</p>
            <div class="ob-cols">
              <div>
                ${googleOn ? `${googleButton("signup", "Continue with Google")}<div class="ob-or">or use your email</div>` : ""}
                <div class="ob-fields">
                  <div><label for="rq-name">Name</label><input id="rq-name" name="name" autocomplete="name" value="${v("name")}" placeholder="Jane Citizen" maxlength="120" required></div>
                  <div><label for="rq-email">Email <span class="opt">(your login)</span></label><input id="rq-email" name="email" type="email" autocomplete="email" spellcheck="false" value="${v("email")}" placeholder="name@email.com" maxlength="160" required aria-describedby="rq-email-error"></div>
                  <div><label for="rq-pass">Create a password</label><input id="rq-pass" name="portal_password" type="password" autocomplete="new-password" minlength="${PW_MIN}" maxlength="${PW_MAX}" title="${PW_MIN} to ${PW_MAX} characters. Letters and numbers, plus ${esc(PW_SYMBOLS)}" placeholder="${PW_MIN}+ characters" required aria-describedby="rq-pass-error"></div>
                  <div><label for="rq-whatsapp">Mobile / WhatsApp</label><input id="rq-whatsapp" name="whatsapp" type="tel" inputmode="tel" autocomplete="tel" value="${v("whatsapp")}" placeholder="+61 4XX XXX XXX" maxlength="40" required></div>
                </div>
                <p id="rq-email-error" class="field-err" role="alert">Please enter a valid email. This is also your login.</p>
                <p id="rq-pass-error" class="field-err" role="alert">Use ${PW_MIN} to ${PW_MAX} characters: letters, numbers and ${esc(PW_SYMBOLS)}, including a letter and a number.</p>
                <p id="rq-whatsapp-error" class="field-err">Please enter a mobile number so we can reach you the moment a match appears.</p>
                <div class="ob-human">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 19a6 6 0 0 0-12 0"/><circle cx="9" cy="8" r="4"/><path d="M15.5 11.5l2 2 4-4"/></svg>
                  <span>Every search is reviewed by a JDM Connect specialist before recommendations are sent.</span>
                </div>
                <div class="ob-cta-row">
                  <button type="button" class="btn-ghost ob-back ob-only" data-back><span aria-hidden="true">&larr;</span> Back</button>
                  <button class="btn-gold" type="submit">Start my search</button>
                </div>
                <p class="ob-note-sm">We collect your name and contact details only to search for and contact you about matching vehicles, and share them only with the providers needed to run the service (see our <a href="/privacy" style="color:var(--gold-txt);font-weight:600">Privacy Policy</a>). You can ask us to access, correct or delete your details any time.</p>
              </div>
              ${whatHappensNext()}
            </div>
          </section>`}
        </form>
      </main>
    </div>
    <style>${onboardingCss}${googleOn ? GOOGLE_BTN_CSS : ""}</style>
    ${modelScript("rq-maker", "rq-models", "Select a model")}${wizardScript({ pwMin: PW_MIN, pwMax: PW_MAX, budgetMin: BUDGET_MIN_AUD, signedIn: !!signedIn })}`;
  return brandDoc(inner, "Find your car - JDM Connect", { analytics: true });
}

// Read-only public view of a shared car (the "Share" link). No login, no client
// info, no admin actions — just the car, its inspection sheet, the specs and
// (optionally) the market panel, with an enquiry CTA. Self-contained styles so
// it renders on the public brand shell. Access is the signed token alone, so
// the caller must verify it before calling this.
export async function publicLotPage(env, queueId) {
  const sb = `<aside class="side"><div class="brand"><a href="/" aria-label="JDM Connect home">${LOGO}</a></div>
    <nav class="nav">
      <span class="active" aria-current="page"><span class="bar"></span><span class="lbl">Vehicle</span></span>
      <a href="/request"><span class="bar"></span><span class="lbl">Request a car</span></a>
    </nav>
    <div class="side-foot"><a class="signout" href="/">JDM Connect</a></div>
    </aside>`;
  const q = await env.DB.prepare("SELECT lot_json FROM queue WHERE id = ?").bind(queueId).first();
  if (!q) {
    return brandShell(sb,
      `<div class="topbar"><div class="topbar-in"><div class="kicker">Vehicle Finder</div><h1>Car not found</h1></div></div>
       <div class="content"><div class="card"><div class="empty">This link may have expired. <a href="/request" style="color:var(--gold-txt);font-weight:600">Tell us what you&rsquo;re after</a> and we&rsquo;ll source it for you.</div></div></div>`,
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
    ? `<div class="plv-hero" id="plvHero" role="img" aria-label="${title}" style="background-image:url('${esc(photos[0])}')"></div>
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

// Full detail page for a single LIVE-feed auction lot, reached by clicking a
// card on the staff Auctions workspace or the member Auction search. Reuses the
// public lot layout (gallery, inspection sheet, spec rows, market panel) and
// adds role-appropriate actions: staff get an "Add to a client" picker; members
// get "Request bid" + watchlist. Answers the client's "I cannot click onto a
// vehicle" — every lot now opens its full details and auction report.
export async function auctionLotPage(env, session, lotId, opts = {}) {
  const member = session && session.role === "client";
  // Members must have an active, member-enabled portal account (same gate as the
  // auction search page). Staff (admin/agent) always pass.
  let client = null;
  if (member) {
    client = await env.DB.prepare("SELECT * FROM clients WHERE id = ? AND portal_enabled = 1").bind(Number(session.id)).first();
    if (!client || !client.member) {
      const sb = portalSidebar(client || null, "auctions");
      return brandShell(sb,
        `<div class="topbar"><div class="topbar-in"><div class="kicker">Members</div><h1>Auction search</h1></div></div>
         <div class="content"><div class="card"><div class="empty">Auction search is a members feature. Ask JDM Connect to enable it on your account.</div></div></div>`,
        "Auction search - JDM Connect");
    }
  }

  let lot = null;
  try { lot = await fetchLot(env, lotId); } catch (e) { /* feed hiccup → not found */ }
  const backHref = member ? "/portal/auctions" : "/admin?view=auctions";
  if (!lot || !lot.id) {
    const notFoundBody = `<div class="topbar"><div class="topbar-in"><div class="kicker">Auction vehicle</div><h1>Lot not found</h1></div>${member ? "" : `<a class="btn-line" href="${backHref}">&larr; Back to auctions</a>`}</div>
       <div class="content"><div class="card"><div class="empty">This lot may have closed or left the live feed. <a href="${backHref}" style="color:var(--gold-txt);font-weight:600">Back to auction search</a>.</div></div></div>${CRM_CSS}`;
    return member
      ? brandShell(portalSidebar(client, "auctions"), notFoundBody, "Lot not found - JDM Connect")
      : shell(sidebar("auctions", {}, session), notFoundBody, "Lot not found - JDM Connect");
  }

  const nowYear = new Date().getFullYear();
  const { sheet: sheetBase, photos } = splitImages(lot);
  const settings = await getSettings(env).catch(() => ({}));
  const showMarket = member ? settingOn(settings, "market_for_clients") : true;
  const [market, fx] = showMarket
    ? await Promise.all([marketIntel(env, lot.marka_name, lot.model_name).catch(() => null), getLiveFx(env).catch(() => 0)])
    : [null, 0];

  const title = `${esc(lot.year || "")} ${esc(lot.marka_name || "")} ${esc(lot.model_name || "")}`.replace(/\s+/g, " ").trim() || "Vehicle";
  const sub = [lot.kuzov ? "Chassis " + esc(lot.kuzov) : "", lot.lot ? "Lot " + esc(lot.lot) : "", esc(lot.auction || "")].filter(Boolean).join(" &middot; ");
  const th = (u) => `${u}&w=320`;
  const gallery = photos.length
    ? `<div class="plv-hero" id="plvHero" role="img" aria-label="${title}" style="background-image:url('${esc(photos[0])}')"></div>
       ${photos.length > 1 ? `<div class="plv-thumbs">${photos.map((u, i) => `<button type="button" class="plv-th${i === 0 ? " on" : ""}" data-full="${esc(u)}" style="background-image:url('${esc(th(u))}')" aria-label="Photo ${i + 1}"></button>`).join("")}</div>` : ""}`
    : `<div class="plv-hero plv-noimg">Photos coming soon</div>`;
  const sheetBox = sheetBase
    ? `<div class="card plv-sheet"><h2>Auction inspection report</h2><a href="${esc(sheetBase)}" target="_blank" rel="noopener" class="plv-sheet-link"><img src="${esc(sheetBase)}" alt="Auction inspection sheet" loading="lazy"></a></div>`
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

  const elig = auctionEligibility(lot, nowYear);
  const eligLine = `<div class="alot-elig ${elig.cls}"><span class="dot"></span>${esc(elig.label)}${elig.cls === "ok" ? " for import (25+ years)" : " — ask us to confirm SEVS/age"}</div>`;

  // Actions differ by surface. Members can request a bid and watch; staff can
  // add the lot to any client they can see (reuses the /client/find flow).
  let actions;
  if (member) {
    const name = `${String(lot.marka_name || "").trim()} ${String(lot.model_name || "").trim()}`.replace(/\s+/g, " ").trim() || "Vehicle";
    const heartData = `data-id="${esc(lot.id)}" data-name="${esc(name)}" data-code="${esc(lot.kuzov || "")}" data-img="${esc(imageUrls(lot).medium || "")}" data-grade="${esc(displayGrade(lot.rate))}" data-house="${esc(lot.auction || "")}" data-date="${esc((lot.auction_date || "").slice(0, 10))}" data-elig="${esc(elig.label)}" data-eligcls="${esc(elig.cls)}" data-sheet="${esc(sheetBase ? sheetBase + "&w=1400" : "")}"`;
    actions = `<form method="POST" action="/portal/auctions/request" style="margin:0"><input type="hidden" name="id" value="${esc(lot.id)}"><button class="btn-gold plv-cta" type="submit">Request a bid on this car</button></form>
      <button type="button" class="ac-fav plv-watch" ${heartData} aria-pressed="false">Save to watchlist</button>
      <p class="plv-fine">Requesting a bid sends this lot to JDM Connect to action on your behalf. No payment is taken at this step.</p>`;
  } else {
    const acc = accessScope(session);
    const cstmt = env.DB.prepare(`SELECT id, name FROM clients c WHERE ${acc.sql} ORDER BY name`);
    const clients = ((await (acc.binds.length ? cstmt.bind(...acc.binds) : cstmt).all()).results) || [];
    const options = clients.map((cl) => `<option value="${cl.id}">${esc(cl.name)}</option>`).join("");
    actions = clients.length
      ? `<form method="POST" action="/client/find" class="plv-picker"><input type="hidden" name="lot_id" value="${esc(lot.id)}"><input type="hidden" name="back" value="${esc(backHref)}"><select name="client_id" required aria-label="Add this car to a client"><option value="">Add to a client...</option>${options}</select><button class="btn-gold" type="submit">Add</button></form>
         <p class="plv-fine">Adds this lot to the client's review queue as a manual find, ready to Approve &amp; send.</p>`
      : `<p class="plv-fine">Add a client first to queue cars for them.</p>`;
  }

  const topRight = member ? "" : `<a class="btn-line" href="${backHref}">&larr; Back to auctions</a>`;
  const main = `
    <div class="topbar"><div class="topbar-in"><div class="kicker">${member ? "Members &middot; Auction vehicle" : "Vehicle Finder &middot; Auction vehicle"}</div><h1>${title}</h1>${sub ? `<p class="subline">${sub}</p>` : ""}</div>${topRight}</div>
    <div class="content">
      ${member ? "" : `<a class="backlink" href="${backHref}">&larr; Back to auction search</a>`}
      <div class="plv-grid">
        <div class="plv-left">
          <div class="plv-gallery">${gallery}</div>
          ${sheetBox}
          ${showMarket ? marketPanel(market, fx) : ""}
        </div>
        <aside class="plv-right">
          <div class="card plv-spec">
            <div class="plv-top"><div class="plv-grade"><div class="plv-grade-n">${esc(displayGrade(lot.rate))}</div><div class="plv-grade-k">Auction grade</div></div>${Number(lot.start) > 0 ? `<div class="plv-price"><div class="plv-price-k">Start price</div><div class="plv-price-v">${yen(lot.start)}</div></div>` : ""}</div>
            ${eligLine}
            <div class="plv-actions">${actions}</div>
            <div class="plv-rows">${specRows}</div>
          </div>
        </aside>
      </div>
    </div>
    ${PLV_STYLE}${ALOT_CSS}${plvGalleryScript()}${auctionWatchScript({ request: false })}`;
  return member
    ? brandShell(portalSidebar(client, "auctions"), main, title + " - JDM Connect")
    : shell(sidebar("auctions", {}, session), main, title + " - JDM Connect");
}

// Extra styles for the lot-detail action column (on top of PLV_STYLE).
const ALOT_CSS = `<style>
  .plv-top{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px}
  .plv-grade-n{font-size:26px;font-weight:800;color:var(--ink);line-height:1}
  .plv-grade-k,.plv-price-k{font-size:11px;color:var(--faint);text-transform:uppercase;letter-spacing:.06em;margin-top:4px}
  .plv-price{text-align:right}
  .plv-price-v{font-size:20px;font-weight:800;color:var(--ink);font-variant-numeric:tabular-nums}
  .alot-elig{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;padding:10px 0 14px;border-bottom:1px solid var(--hair);margin-bottom:14px}
  .alot-elig .dot{width:8px;height:8px;border-radius:50%;flex:none}
  .alot-elig.ok{color:#1F7A4D}.alot-elig.ok .dot{background:#1F7A4D}
  .alot-elig.check{color:#8a5e10}.alot-elig.check .dot{background:#C9A34C}
  .plv-actions{display:flex;flex-direction:column;gap:10px;margin-bottom:16px}
  .plv-cta{width:100%;text-align:center}
  .plv-picker{display:flex;gap:8px}
  .plv-picker select{flex:1;min-width:0;padding:11px 13px;border-radius:9px}
  .plv-watch{width:100%;justify-content:center;gap:8px;padding:11px 14px;border:1px solid var(--hair);border-radius:9px;background:var(--card);color:var(--ink);font-size:13px;font-weight:600;cursor:pointer}
  .plv-watch svg{display:none}
  .plv-watch.on{border-color:var(--gold-line);color:var(--gold-txt)}
  .plv-fine{font-size:11.5px;color:var(--t3);margin:2px 0 0;line-height:1.45}
</style>`;

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
  .plv-sheet-link{display:block;border-radius:10px;overflow:hidden;border:1px solid rgba(0,0,0,.10);background:#f7f7f5;line-height:0;aspect-ratio:3/2}
  .plv-sheet-link img{display:block;width:100%;height:100%;object-fit:contain}
  .plv-right{position:sticky;top:24px}
  .plv-rows{display:flex;flex-direction:column}
  .plv-row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:11px 0;border-bottom:1px solid rgba(0,0,0,.06);font-size:13.5px}
  .plv-row:last-of-type{border-bottom:0}
  .plv-k{color:#6b7079}
  .plv-v{font-weight:700;color:#1b1c1e;text-align:right}
  .plv-cta{display:flex;width:100%;margin-top:18px}
  .plv-fine{font-size:11.5px;color:#6b7079;margin-top:12px;line-height:1.5;text-align:center}
  @media(max-width:920px){.plv-right{position:static}.plv-hero{height:300px}}
</style>`;


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

// A search box that live-filters a table's rows by text (client-side). Pair it
// with a <table id="tableId">; the jdmFilterTable handler lives in shell().
function tableSearch(tableId, placeholder) {
  return `<div class="tbl-tools"><span class="tbl-ic" aria-hidden="true">${ICONS.auctions}</span><input type="search" class="tbl-search" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}" oninput="jdmFilterTable(this,'${tableId}')"><span class="tbl-count" id="${tableId}-count"></span></div>`;
}

// Reusable row action menu: a "three-dot" (kebab) dropdown that replaces the
// scattered per-row buttons (especially the red Delete) with one tidy menu.
// `items` is an ordered list; each entry is one of:
//   { label, href, icon? }                    -> a link
//   { label, action, id, confirm?, icon?, danger? } -> a POST form (hidden id)
//   { sep: true }                              -> a divider (put Delete after one)
// Delete is expected last and marked danger, per the spec. The dropdown is
// positioned with position:fixed by the shared script (see tableToolsScript) so
// it is never clipped by a table card's overflow:hidden.
function rowMenu(items) {
  const body = (items || []).map((it) => {
    if (it.sep) return `<div class="rowmenu-sep"></div>`;
    const ic = it.icon ? it.icon : "";
    const cls = `rowmenu-item${it.danger ? " danger" : ""}`;
    if (it.href) return `<a class="${cls}" href="${it.href}">${ic}${esc(it.label)}</a>`;
    const conf = it.confirm ? ` onsubmit="return confirm('${esc(it.confirm)}')"` : "";
    return `<form method="POST" action="${it.action}" class="rowmenu-form"${conf}><input type="hidden" name="id" value="${it.id}"><button type="submit" class="${cls}">${ic}${esc(it.label)}</button></form>`;
  }).join("");
  return `<details class="rowmenu"><summary class="rowmenu-btn" aria-label="Row actions" title="Actions">${ICONS.kebab}</summary><div class="rowmenu-pop">${body}</div></details>`;
}

// "Export CSV" button for a table (client-side; exports the visible, filtered,
// non-interactive cells). Reused across the admin tables.
const DOWNLOAD_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 11l5 5 5-5M5 21h14"/></svg>`;
function exportBtn(tableId, filename) {
  return `<button type="button" class="tbl-export" onclick="jdmExportCsv('${tableId}','${filename}')">${DOWNLOAD_ICON}Export CSV</button>`;
}
// A toolbar row pairing the live search box with the Export button, right-aligned.
function tableToolbar(tableId, placeholder, filename) {
  return `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">${tableSearch(tableId, placeholder)}${exportBtn(tableId, filename)}</div>`;
}

// Global helpers shared by every admin table: live row-filtering and a
// select-all that only ticks the rows currently visible after a filter.
function tableToolsScript() {
  return `<style>
    .tbl-tools{display:flex;align-items:center;gap:9px;margin-bottom:12px}
    .tbl-tools .tbl-ic{display:flex;color:var(--faint)}.tbl-tools .tbl-ic svg{width:16px;height:16px}
    .tbl-search{flex:0 1 340px;max-width:340px;padding:9px 13px;border:1px solid var(--hair);border-radius:9px;background:var(--card);color:var(--ink);font-size:13.5px}
    .tbl-search:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 3px var(--gold-tint)}
    .tbl-count{font-size:12px;color:var(--t3);font-variant-numeric:tabular-nums}
    .bulk-del{display:inline-flex;align-items:center;gap:6px}
    .bulk-del svg{width:16px;height:16px;flex:0 0 auto}
    .wl-search{display:inline-flex;align-items:center;gap:6px;text-decoration:none}
    .wl-search svg{width:15px;height:15px;flex:0 0 auto}
    .backlink{display:inline-flex;align-items:center;gap:6px;color:var(--t2);font-size:13.5px;font-weight:600;text-decoration:none;margin-bottom:6px}
    .backlink:hover{color:var(--ink)}
    /* Reusable row action menu (kebab dropdown). */
    .rowmenu{position:relative;display:inline-block}
    .rowmenu>summary{list-style:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:7px;border:1px solid transparent;color:var(--t3)}
    .rowmenu>summary::-webkit-details-marker{display:none}
    .rowmenu>summary:hover{background:rgba(0,0,0,0.05);color:var(--ink)}
    .rowmenu[open]>summary{background:rgba(0,0,0,0.05);border-color:var(--hair);color:var(--ink)}
    .rowmenu>summary svg{width:18px;height:18px}
    .rowmenu-pop{position:fixed;z-index:1000;min-width:184px;background:var(--card);border:1px solid var(--hair);border-radius:11px;box-shadow:0 14px 34px rgba(0,0,0,0.14);padding:6px}
    .rowmenu-form{margin:0}
    .rowmenu-item{display:flex;align-items:center;gap:9px;width:100%;text-align:left;background:transparent;border:0;padding:9px 11px;border-radius:7px;font-size:13.5px;font-weight:500;color:var(--ink);cursor:pointer;font-family:inherit;white-space:nowrap;text-decoration:none}
    .rowmenu-item:hover{background:rgba(0,0,0,0.05)}
    .rowmenu-item svg{width:15px;height:15px;color:var(--t3);flex:0 0 auto}
    .rowmenu-item.danger{color:var(--bad)}
    .rowmenu-item.danger svg{color:var(--bad)}
    .rowmenu-item.danger:hover{background:var(--bad-bg)}
    .rowmenu-sep{height:1px;background:var(--hair);margin:5px 3px}
    /* Reusable table toolbar Export button. */
    .tbl-export{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:var(--t2);background:var(--card);border:1px solid var(--hair);border-radius:9px;padding:8px 13px;cursor:pointer;font-family:inherit;white-space:nowrap}
    .tbl-export:hover{border-color:var(--gold-line);color:var(--ink)}
    .tbl-export svg{width:14px;height:14px}
    /* Sortable table headers. */
    table.sortable th.sortcol{cursor:pointer;user-select:none;white-space:nowrap}
    table.sortable th.sortcol:hover{color:var(--ink)}
    table.sortable th.sortcol:after{content:"";display:inline-block;width:0;height:0;margin-left:6px;opacity:.28;border-left:4px solid transparent;border-right:4px solid transparent;border-top:5px solid currentColor;vertical-align:middle}
    table.sortable th.sortcol[data-sort=asc]:after{border-top:0;border-bottom:5px solid currentColor;opacity:.9}
    table.sortable th.sortcol[data-sort=desc]:after{opacity:.9}
  </style><script>
  function jdmFilterTable(inp,id){var t=document.getElementById(id);if(!t)return;var q=(inp.value||'').trim().toLowerCase();var shown=0,total=0,rows=t.rows;for(var i=0;i<rows.length;i++){var r=rows[i];if(r.getElementsByTagName('th').length)continue;total++;var hit=!q||(r.textContent||'').toLowerCase().indexOf(q)>=0;r.style.display=hit?'':'none';if(hit)shown++;}var c=document.getElementById(id+'-count');if(c)c.textContent=q?(shown+' of '+total+' shown'):'';}
  function jdmSelectAllVisible(box,name){var t=box.closest('table');if(!t)return;var rows=t.rows;for(var i=0;i<rows.length;i++){var r=rows[i];if(r.style.display==='none')continue;var b=r.querySelector('input[name="'+name+'"]');if(b)b.checked=box.checked;}}
  // Export a table's visible, non-interactive cells to a CSV download.
  function jdmExportCsv(id,filename){var t=document.getElementById(id);if(!t)return;var rows=t.rows,out=[];for(var i=0;i<rows.length;i++){var r=rows[i];if(r.style.display==='none')continue;var cells=r.cells,line=[];for(var j=0;j<cells.length;j++){var cell=cells[j];if(cell.querySelector&&cell.querySelector('input,button,select,details,form'))continue;var txt=(cell.textContent||'').replace(/\\s+/g,' ').trim();line.push('"'+txt.replace(/"/g,'""')+'"');}if(line.join('').replace(/[",]/g,''))out.push(line.join(','));}var blob=new Blob(['\\ufeff'+out.join('\\r\\n')],{type:'text/csv;charset=utf-8'});var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(filename||'export')+'.csv';document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(a.href);},1000);}
  // Click-to-sort. num() only treats a cell as numeric when it is wholly a number
  // (with optional A$/, / km-style units), so codes like "S15" stay alphabetical.
  function jdmSortNum(s){var m=String(s).replace(/[,\\s]/g,'');if(/^(A\\$|\\$)?-?\\d+(\\.\\d+)?(k|km|%)?$/i.test(m)){var v=parseFloat(m.replace(/[^0-9.\\-]/g,''));return isNaN(v)?null:v;}return null;}
  function jdmSortTable(id,col,th){var t=document.getElementById(id);if(!t)return;var rows=[].slice.call(t.rows).filter(function(r){return !r.getElementsByTagName('th').length;});if(!rows.length)return;var dir=th.getAttribute('data-sort')==='asc'?'desc':'asc';var hs=th.parentNode.getElementsByTagName('th');for(var k=0;k<hs.length;k++)hs[k].removeAttribute('data-sort');th.setAttribute('data-sort',dir);rows.sort(function(a,b){var x=(a.cells[col]?a.cells[col].textContent:'').trim(),y=(b.cells[col]?b.cells[col].textContent:'').trim();var nx=jdmSortNum(x),ny=jdmSortNum(y);if(nx!==null&&ny!==null)return dir==='asc'?nx-ny:ny-nx;return dir==='asc'?x.toLowerCase().localeCompare(y.toLowerCase()):y.toLowerCase().localeCompare(x.toLowerCase());});var p=rows[0].parentNode;rows.forEach(function(r){p.appendChild(r);});}
  (function(){function wire(){[].slice.call(document.querySelectorAll('table.sortable')).forEach(function(t){if(!t.id)return;var hr=t.rows[0];if(!hr)return;var ths=hr.getElementsByTagName('th');for(var i=0;i<ths.length;i++){(function(th,idx){if(th.dataset.wired)return;if(th.querySelector('input')|| !(th.textContent||'').trim())return;th.dataset.wired='1';th.classList.add('sortcol');th.addEventListener('click',function(){jdmSortTable(t.id,idx,th);});})(ths[i],i);}});}if(document.readyState!=='loading')wire();else document.addEventListener('DOMContentLoaded',wire);})();
  (function(){
    // Row action menu: position the dropdown with fixed coords on open (so a
    // table card's overflow:hidden never clips it), and close on outside click,
    // Escape, or scroll.
    function closeAll(except){document.querySelectorAll('details.rowmenu[open]').forEach(function(d){if(d!==except)d.removeAttribute('open');});}
    document.addEventListener('toggle',function(e){
      var d=e.target; if(!d.classList||!d.classList.contains('rowmenu')||!d.open)return;
      closeAll(d);
      var pop=d.querySelector('.rowmenu-pop'), btn=d.querySelector('summary'); if(!pop||!btn)return;
      var r=btn.getBoundingClientRect(), ph=pop.offsetHeight||220, pw=pop.offsetWidth||184;
      pop.style.left='auto'; pop.style.right=Math.max(8,(window.innerWidth-r.right))+'px';
      if(r.bottom+6+ph>window.innerHeight){pop.style.top='auto';pop.style.bottom=(window.innerHeight-r.top+6)+'px';}
      else{pop.style.bottom='auto';pop.style.top=(r.bottom+6)+'px';}
    },true);
    document.addEventListener('click',function(e){document.querySelectorAll('details.rowmenu[open]').forEach(function(d){if(!d.contains(e.target))d.removeAttribute('open');});});
    document.addEventListener('keydown',function(e){if(e.key==='Escape')closeAll(null);});
    window.addEventListener('scroll',function(){closeAll(null);},true);
  })();
  </script>`;
}

function shell(side, main, title) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0F1115"><meta name="color-scheme" content="dark"><title>${title}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"><style>${CSS}</style></head>
    <body><a class="skip-link" href="#admin-main">Skip to content</a><input type="checkbox" id="navToggle" class="nav-cb"><div class="wrap">${side}<label for="navToggle" class="nav-scrim" aria-hidden="true"></label><div class="main" role="main" id="admin-main"><label for="navToggle" class="nav-burger" aria-label="Open menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg><span>Menu</span></label>${main}</div></div>${drawerChrome()}${revealScript()}${tableToolsScript()}</body></html>`;
}

// Slide-in customer drawer: shared chrome (panel + scrim) + a script that
// intercepts clicks on any [data-drawer] link, fetches the fragment and shows it
// without leaving the page. Links keep their href so JS-off users still navigate
// to the full profile (progressive enhancement).
function drawerChrome() {
  return `<div id="dwScrim" class="dw-scrim"></div>
  <aside id="dwPanel" class="dw-panel" role="dialog" aria-modal="true" aria-label="Customer preview" tabindex="-1">
    <button class="dw-close" id="dwClose" type="button" aria-label="Close">&times;</button>
    <div id="dwContent" class="dw-content" aria-live="polite"></div>
  </aside>
  <style>
    .dw-scrim{position:fixed;inset:0;background:rgba(0,0,0,.42);z-index:200;opacity:0;visibility:hidden;transition:opacity .25s}
    .dw-scrim.open{opacity:1;visibility:visible}
    .dw-panel{position:fixed;top:0;right:0;height:100vh;width:min(440px,94vw);background:var(--bg-2);border-left:1px solid var(--hair);box-shadow:-24px 0 60px rgba(0,0,0,.22);z-index:201;transform:translateX(100%);transition:transform .28s cubic-bezier(.2,.8,.2,1);overflow-y:auto;overscroll-behavior:contain}
    .dw-panel.open{transform:none}
    .dw-close{position:absolute;top:14px;right:16px;width:32px;height:32px;border:0;background:rgba(0,0,0,.05);border-radius:8px;font-size:20px;line-height:1;color:var(--t2);cursor:pointer;z-index:2}
    .dw-close:hover{background:rgba(0,0,0,.1);color:var(--ink)}
    .dw-content{padding:22px 24px 44px}
    .dw-loading,.dw-empty{padding:44px 4px;color:var(--faint);font-size:13.5px}
    .dw-empty-sm{padding:6px 2px;color:var(--faint);font-size:12.5px}
    .dw-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin:0 0 18px;padding-right:30px}
    .dw-id{display:flex;align-items:center;gap:12px}
    .dw-name{font-size:18px;font-weight:700;color:var(--ink)}
    .dw-sub{font-size:12px;color:var(--t3);margin-top:2px}
    .dw-open{font-size:12.5px;padding:8px 13px;white-space:nowrap}
    .dw-card{background:var(--card);border:1px solid var(--hair);border-radius:12px;padding:4px 16px;margin-bottom:6px}
    .dw-row{display:flex;justify-content:space-between;gap:12px;padding:11px 0;border-bottom:1px solid rgba(0,0,0,.06)}
    .dw-row:last-child{border-bottom:0}
    .dw-k{font-size:12.5px;color:var(--t3)}
    .dw-v{font-size:13.5px;font-weight:600;color:var(--ink);text-align:right}
    .dw-sec{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--t3);margin:20px 0 10px;display:flex;align-items:center;gap:8px}
    .dw-sec .ct{background:var(--gold-tint);color:var(--gold-txt);border-radius:9999px;padding:1px 8px;font-size:11px}
    .dw-list{display:flex;flex-direction:column;gap:8px}
    .dw-item{background:var(--card);border:1px solid var(--hair);border-radius:10px;padding:11px 14px}
    .dw-item-t{font-size:14px;font-weight:600;color:var(--ink)}
    .dw-item-s{font-size:12px;color:var(--t3);margin-top:4px;display:flex;flex-wrap:wrap;align-items:center;gap:6px}
    .dw-cta{display:flex;gap:8px;margin:14px 0 4px}
    .dw-cta-b{flex:1;text-align:center;text-decoration:none;font-size:13px;font-weight:600;padding:9px 12px;border-radius:9px;background:var(--card);border:1px solid var(--hair);color:var(--ink)}
    .dw-cta-b:hover{border-color:var(--gold-line);color:var(--gold-txt)}
    .eng{display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:9999px;white-space:nowrap}
    .eng-viewed{background:var(--gold-tint);color:var(--gold-txt)}
    .eng-sent{background:rgba(201,138,0,.14);color:#8a5e10}
    .dw-str{display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:9999px}
    .dw-str-strong{background:rgba(31,122,77,.14);color:#1F7A4D}
    .dw-str-good{background:var(--gold-tint);color:var(--gold-txt)}
    .dw-str-possible{background:rgba(0,0,0,.06);color:var(--t2)}
  </style>
  <script>(function(){
    var panel=document.getElementById('dwPanel'),scrim=document.getElementById('dwScrim'),content=document.getElementById('dwContent'),closeBtn=document.getElementById('dwClose');
    if(!panel)return;
    var lastFocus=null;
    var focusable='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    function visible(nodes){return nodes.filter(function(n){return n.offsetWidth||n.offsetHeight||n.getClientRects().length;});}
    function close(){panel.classList.remove('open');scrim.classList.remove('open');if(lastFocus&&lastFocus.focus){try{lastFocus.focus({preventScroll:true});}catch(e){lastFocus.focus();}}}
    function focusPanel(){var f=visible([].slice.call(panel.querySelectorAll(focusable)));try{(f[0]||panel).focus({preventScroll:true});}catch(e){(f[0]||panel).focus();}}
    function open(url){content.innerHTML='<div class="dw-loading">Loading…</div>';panel.classList.add('open');scrim.classList.add('open');
      fetch(url).then(function(r){return r.text();}).then(function(h){content.innerHTML=h;focusPanel();}).catch(function(){content.innerHTML='<div class="dw-empty">Could not load this customer.</div>';focusPanel();});}
    function openDrawer(url,trigger){lastFocus=trigger||document.activeElement;open(url);focusPanel();}
    function trap(e){if(e.key!=='Tab'||!panel.classList.contains('open'))return;var f=visible([].slice.call(panel.querySelectorAll(focusable)));if(!f.length){e.preventDefault();panel.focus();return;}var first=f[0],last=f[f.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
    document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('[data-drawer]');if(a){e.preventDefault();openDrawer(a.getAttribute('data-drawer'),a);}});
    closeBtn&&closeBtn.addEventListener('click',close);
    scrim.addEventListener('click',close);
    document.addEventListener('keydown',function(e){if(e.key==='Escape')close();else trap(e);});
  })();</script>`;
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

// Owner guard for wishlists (strict): admin, or the agent who owns the parent
// client. Shared access is for co-searching (view/add matches) — it must never
// allow destructive or workflow-mutating actions (delete/edit/toggle a search,
// reschedule follow-ups) on another agent's client.
async function wishlistOwnedBy(env, wishlistId, session) {
  if (!session || session.role === "admin") return true;
  const w = await env.DB.prepare("SELECT client_id FROM wishlists WHERE id = ?").bind(Number(wishlistId)).first();
  return !!w && (await clientOwnedBy(env, w.client_id, session));
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

// Normalize an Australian phone number to its national significant number for
// duplicate matching: digits only, then drop a leading 61 (country code) and a
// leading 0. "+61 412 345 678", "0412345678" and "61412345678" all key to the
// same "412345678", so the same person typing it differently still matches.
export function phoneKey(s) {
  let d = String(s || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2); // intl dialing prefix (e.g. 0061...)
  if (d.startsWith("61")) d = d.slice(2); // AU country code
  if (d.startsWith("0")) d = d.slice(1);  // trunk 0
  return d;
}

// Find an existing client matching the given email OR phone within a scope
// (public clients, or one agent's clients). Email match is case-insensitive;
// phone match uses the normalized national number. Returns { id, name } or null.
// This is what stops one person spawning a fresh client on every enquiry.
export async function findClientByContact(env, { email, whatsapp, scopeSql, scopeBinds = [] }) {
  const e = String(email || "").trim().toLowerCase();
  if (e) {
    const row = await env.DB.prepare(
      `SELECT id, name FROM clients WHERE ${scopeSql} AND email IS NOT NULL AND lower(email) = ? LIMIT 1`
    ).bind(...scopeBinds, e).first();
    if (row) return row;
  }
  const key = phoneKey(whatsapp);
  // Require a plausibly-complete number so short/garbage input can't collide.
  if (key.length >= 8) {
    const { results } = await env.DB.prepare(
      `SELECT id, name, whatsapp FROM clients WHERE ${scopeSql} AND whatsapp IS NOT NULL AND whatsapp <> ''`
    ).bind(...scopeBinds).all();
    for (const r of results || []) {
      if (phoneKey(r.whatsapp) === key) return { id: r.id, name: r.name };
    }
  }
  return null;
}

// The scope clause for a session: an agent sees only their own clients; admin
// (and the public request path) operate on the shared, staff-scoped pool.
function clientDedupeScope(agentId) {
  return agentId == null
    ? { scopeSql: "agent_id IS NULL AND dealer_username IS NULL", scopeBinds: [] }
    : { scopeSql: "agent_id = ?", scopeBinds: [agentId] };
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

  // Duplicate guard: fold a repeat into the existing client (matched by email or
  // phone) rather than spawning a second record. Backfill any new contact detail
  // and send staff to that client so they add the new search there. "allow_dupe"
  // lets staff deliberately create a separate record (e.g. shared family email).
  if (!form.get("allow_dupe")) {
    const dup = await findClientByContact(env, { email, whatsapp, ...clientDedupeScope(agentId) });
    if (dup) {
      await env.DB.prepare(
        `UPDATE clients SET
            email = COALESCE(NULLIF(?, ''), email),
            whatsapp = COALESCE(NULLIF(?, ''), whatsapp),
            state = COALESCE(NULLIF(?, ''), state)
          WHERE id = ?`
      ).bind(email || "", whatsapp || "", state || "", dup.id).run();
      return { ok: false, error: "duplicate", id: dup.id, name: dup.name };
    }
  }

  const r = await env.DB.prepare("INSERT INTO clients (name, email, whatsapp, state, agent_id) VALUES (?, ?, ?, ?, ?)")
    .bind(name, email || null, whatsapp || null, state, agentId).run();
  return { ok: true, id: r.meta?.last_row_id };
}

// Edit an existing client's core contact details (name, email, WhatsApp, state).
// Owner/admin only, like delete and reassign. Preserves the "must stay reachable"
// invariant and refuses a change that would collide with another client's
// email/phone in the same scope (so editing can't quietly create a duplicate).
export async function updateClient(env, form, session) {
  const cid = Number(form.get("id"));
  if (!Number.isInteger(cid) || cid <= 0) return { ok: false, error: "notfound" };
  const c = await env.DB.prepare("SELECT * FROM clients WHERE id = ?").bind(cid).first();
  if (!c) return { ok: false, error: "notfound" };
  const canManage = session.role === "admin" || Number(c.agent_id) === Number(session.id);
  if (!canManage) return { ok: false, error: "forbidden" };

  const name = String(form.get("name") || "").trim();
  const email = String(form.get("email") || "").trim();
  const whatsapp = String(form.get("whatsapp") || "").trim();
  const state = normalizeState(form.get("state"));
  if (!name) return { ok: false, error: "name" };
  if (!email && !whatsapp) return { ok: false, error: "contact" };
  // Portal sign-in and invite links are keyed to the email, so don't let it be
  // stripped while the client still has portal access.
  if (c.portal_enabled && !email) return { ok: false, error: "portal_email" };

  // Refuse a contact change that would duplicate another client in this client's
  // scope. Self-match is expected (unchanged email/phone) and allowed.
  const dup = await findClientByContact(env, { email, whatsapp, ...clientDedupeScope(c.agent_id) });
  if (dup && Number(dup.id) !== cid) return { ok: false, error: "duplicate", id: dup.id, name: dup.name };

  await env.DB.prepare("UPDATE clients SET name = ?, email = ?, whatsapp = ?, state = ? WHERE id = ?")
    .bind(name, email || null, whatsapp || null, state, cid).run();
  return { ok: true, id: cid };
}

// Map an updateClient() error code to a plain-English message for the UI.
export function clientEditErrorMessage(code) {
  return ({
    name: "Please enter the client's name.",
    contact: "Add an email or a WhatsApp number so we can still reach them.",
    portal_email: "This client has buyer-portal access, which needs an email. Revoke portal access first if you really need to remove the email.",
    duplicate: "Another client already uses that email or phone number, so the change was not saved.",
    forbidden: "Only the client's owner (or an admin) can edit their details.",
    notfound: "That client no longer exists.",
  })[code] || "Sorry, those changes could not be saved.";
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
  // Clear the free-text CRM trail (activity timeline + tasks hold names, notes
  // and "Vehicle sent: …" detail) so it isn't orphaned after the client is
  // gone (APP 11.2). Payments are intentionally retained for financial records
  // (client_id is NOT NULL and the row holds no name/email/phone).
  stmts.push(env.DB.prepare("DELETE FROM activity WHERE client_id = ?").bind(cid));
  stmts.push(env.DB.prepare("DELETE FROM tasks WHERE client_id = ?").bind(cid));
  stmts.push(env.DB.prepare("DELETE FROM clients WHERE id = ?").bind(cid));
  await env.DB.batch(stmts);
}

// Delete a single wishlist plus its queued matches and seen-lot history.
// Owner-only: destructive, so shared (co-search) access is not enough.
export async function deleteWishlist(env, id, session) {
  const wid = Number(id);
  if (!Number.isInteger(wid) || wid <= 0) return;
  if (!(await wishlistOwnedBy(env, wid, session))) return;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM queue WHERE wishlist_id = ?").bind(wid),
    env.DB.prepare("DELETE FROM seen_lots WHERE wishlist_id = ?").bind(wid),
    env.DB.prepare("DELETE FROM wishlists WHERE id = ?").bind(wid),
  ]);
}

// Flip a wishlist active/paused. Paused wishlists are skipped by the matcher.
// Owner-only: pausing another agent's search would silently stop their matches.
export async function toggleWishlist(env, id, session) {
  const wid = Number(id);
  if (!Number.isInteger(wid) || wid <= 0) return;
  if (!(await wishlistOwnedBy(env, wid, session))) return;
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
    stmts.push(env.DB.prepare("DELETE FROM activity WHERE client_id = ?").bind(c.id));
    stmts.push(env.DB.prepare("DELETE FROM tasks WHERE client_id = ?").bind(c.id));
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

  // Bulk delete: cascade each client (matches, seen-lots, searches, shares) then
  // the client itself - same order as the single deleteClient. Owner selection
  // is irrelevant here. Admin-only, already enforced above.
  if (action === "delete") {
    const stmts = [];
    for (const cid of list) {
      stmts.push(env.DB.prepare("DELETE FROM queue WHERE client_id = ?").bind(cid));
      stmts.push(env.DB.prepare("DELETE FROM seen_lots WHERE wishlist_id IN (SELECT id FROM wishlists WHERE client_id = ?)").bind(cid));
      stmts.push(env.DB.prepare("DELETE FROM wishlists WHERE client_id = ?").bind(cid));
      stmts.push(env.DB.prepare("DELETE FROM client_shares WHERE client_id = ?").bind(cid));
      stmts.push(env.DB.prepare("DELETE FROM activity WHERE client_id = ?").bind(cid));
      stmts.push(env.DB.prepare("DELETE FROM tasks WHERE client_id = ?").bind(cid));
      stmts.push(env.DB.prepare("DELETE FROM clients WHERE id = ?").bind(cid));
    }
    await env.DB.batch(stmts);
    return;
  }

  // Soft archive / restore selected clients.
  if (action === "archive" || action === "unarchive") {
    const on = action === "archive" ? 1 : 0;
    await env.DB.batch(list.map((cid) => env.DB.prepare("UPDATE clients SET archived = ? WHERE id = ?").bind(on, cid)));
    return;
  }

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
// Minimum realistic all-in import budget (AUD). Below this, an import isn't viable
// — it's the hard floor that catches junk/lowball input; the on-form note does the
// rest of the time-waster filtering.
const BUDGET_MIN_AUD = 5000;

function clipField(form, key, max) {
  const v = String(form.get(key) ?? "").trim().slice(0, max);
  form.set(key, v);
  return v;
}

// Handle a public request submission. Returns a tagged result the route acts on:
//   { ok:true, req, ref, clientId }        → stored; alert + confirm + receipt
//   { ok:false, error:"contact", vals }    → no contact method; re-render w/ error
//   { ok:false, error:"spam" }             → honeypot; pretend success, store nothing
export async function createRequest(env, form, session) {
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
  clipField(form, "destination_country", 60);

  // A signed-in buyer (e.g. arrived via Google sign-in) is already a known,
  // verified client. Their identity comes from the session cookie - NEVER from
  // the form - so the request attaches to the right account with no password or
  // email re-entry. `session` is optional; anonymous posts keep the old path.
  let sessionClient = null;
  if (session && session.role === "client" && session.id) {
    sessionClient = await env.DB.prepare(
      "SELECT id, name, email, whatsapp, google_sub FROM clients WHERE id = ?"
    ).bind(session.id).first();
  }

  // Drop a malformed email rather than storing junk that breaks alert delivery.
  let email = clipField(form, "email", REQ_MAX.email).toLowerCase();
  if (email && !REQ_EMAIL_RE.test(email)) email = "";
  // Signed-in: identity is the session client's own email, not the form's.
  if (sessionClient) email = String(sessionClient.email || "").toLowerCase();
  form.set("email", email);

  const g = (k) => String(form.get(k) || "").trim();
  const whatsapp = g("whatsapp");
  const selfPw = String(form.get("portal_password") || "");
  const displayName = sessionClient ? String(sessionClient.name || "").trim() : g("name");

  // Re-render payload, kept so a rejected submission preserves what they typed.
  const vals = {
    name: displayName, email, whatsapp, state: g("state"), label: g("label"),
    marka_name: g("marka_name"), model_name: g("model_name"),
    year_min: g("year_min"), year_max: g("year_max"), budget_aud: g("budget_aud"),
    mileage_max: g("mileage_max"), rate_min: g("rate_min"), kuzov: g("kuzov"),
    destination_country: g("destination_country"),
  };

  // Account identity is only collected and validated for anonymous submissions;
  // a signed-in client already has a verified one.
  if (!sessionClient) {
    // Accounts are mandatory: email is the login identity, so it is required.
    if (!email) return { ok: false, error: "email", vals };

    // Email-uniqueness: an email that already has a login can't open a second
    // account from the public form - send them to sign in. We reveal only that
    // the email is registered (the minimum needed to prevent duplicate
    // accounts), and never any other detail.
    const acct = await env.DB.prepare(
      "SELECT pass_hash FROM clients WHERE agent_id IS NULL AND dealer_username IS NULL AND email IS NOT NULL AND lower(email) = ? LIMIT 1"
    ).bind(email).first();
    if (acct && acct.pass_hash) return { ok: false, error: "exists", vals };

    // A brand-new enquiry (no record by email or phone) must choose a
    // policy-compliant password. A returning record is still captured without
    // forcing one (and gets a secure set-password invite if it has no login).
    const match = await findClientByContact(env, { email, whatsapp, ...clientDedupeScope(null) });
    if (!match) {
      const pwErr = passwordPolicyError(selfPw);
      if (pwErr) return { ok: false, error: "password", pwError: pwErr, vals };
    }
  }

  // Make + model are required so the search is actionable (we can't hunt the
  // auctions for "a car"). The matcher needs at least one of these to run.
  if (!g("marka_name") || !g("model_name")) return { ok: false, error: "vehicle", vals };

  // A year range is required and must be sane — JDM generations and SEVS
  // eligibility are year-bound, so an open-ended request isn't searchable.
  const yMinReq = Number(g("year_min")), yMaxReq = Number(g("year_max"));
  if (!Number.isFinite(yMinReq) || !Number.isFinite(yMaxReq) || yMinReq < 1960 || yMaxReq > 2100 || yMinReq > yMaxReq) {
    return { ok: false, error: "year", vals };
  }

  // Budget is mandatory: a realistic all-in AUD figure qualifies the lead and
  // weeds out time-wasters. Convert it to an approximate JPY auction-price ceiling
  // so it feeds the matcher's price_max (the form no longer collects yen directly).
  const audBudget = Number(g("budget_aud"));
  if (!Number.isFinite(audBudget) || audBudget < BUDGET_MIN_AUD) {
    return { ok: false, error: "budget", vals };
  }
  form.set("price_max", String(audBudgetToYen(audBudget, env.CALC_FX) ?? ""));

  // A mobile number is mandatory: matches move fast at auction and we need a
  // direct way to reach the buyer. Accept the number typed on the form, or fall
  // back to one already on a signed-in client's record. phoneKey() strips
  // formatting/country code; >= 8 national digits is our validity floor.
  const effectivePhone = phoneKey(whatsapp).length >= 8
    ? whatsapp
    : (sessionClient && phoneKey(sessionClient.whatsapp).length >= 8 ? sessionClient.whatsapp : "");
  if (phoneKey(effectivePhone).length < 8) return { ok: false, error: "phone", vals };
  // A signed-in buyer who supplied a new number gets it saved to their record.
  if (sessionClient && phoneKey(whatsapp).length >= 8 && phoneKey(whatsapp) !== phoneKey(sessionClient.whatsapp || "")) {
    await env.DB.prepare("UPDATE clients SET whatsapp = ? WHERE id = ?").bind(whatsapp, sessionClient.id).run();
  }

  // Attach the wishlist to the right client. Signed-in -> their own record;
  // anonymous -> reuse an existing staff-scoped client or create one (Fix 6).
  let clientId, portal, existing, wishlistId, inviteNeeded = false;
  if (sessionClient) {
    clientId = sessionClient.id;
    // Fix 2: ALWAYS create a searchable wishlist (broad ones are flagged).
    wishlistId = await createRequestWishlist(env, clientId, form);
    portal = true;   // already signed in
    existing = true;
  } else {
    const up = await upsertPublicClient(env, form, email, whatsapp);
    clientId = up.id;
    wishlistId = await createRequestWishlist(env, clientId, form);
    existing = !up.created;
    portal = false;
    if (up.created) {
      // New record -> set the chosen password.
      portal = await enablePortalSelfSignup(env, clientId, selfPw);
    } else {
      // Existing passwordless record -> email a set-password link (only the
      // inbox owner can claim it). A Google-linked client already has a way in,
      // so we never nag them for a password.
      const exi = await env.DB.prepare("SELECT pass_hash, google_sub FROM clients WHERE id = ?").bind(clientId).first();
      if (exi && !exi.pass_hash && !exi.google_sub) inviteNeeded = true;
    }
  }

  // Fix 7: a human-readable reference, stable per client.
  const ref = `JDM-${new Date().getFullYear()}-${String(clientId).padStart(5, "0")}`;

  const req = {
    portal, existing,
    name: displayName || "-", email, whatsapp: effectivePhone, state: g("state"),
    label: g("label"), marka_name: g("marka_name"), model_name: g("model_name"),
    year_min: g("year_min"), year_max: g("year_max"), price_max: g("price_max"),
    budget_aud: Math.round(audBudget), // the buyer's stated all-in AUD budget (for staff)
    mileage_max: g("mileage_max"), rate_min: g("rate_min"), kuzov: g("kuzov"), grade_kw: g("grade_kw"),
  };
  return { ok: true, req, ref, clientId, wishlistId, inviteNeeded };
}

// Find or create the (public) client behind a verified Google identity. Matches
// by google_sub first (durable), then by verified email so an existing
// email/password client folds into the same record and gains Google sign-in.
// Only ever touches public, self-serve clients (never agent-owned or dealer
// records), and never elevates anyone above the "client" role. Returns
// {id, created}.
export async function upsertGoogleClient(env, profile) {
  const email = String(profile && profile.email || "").trim().toLowerCase();
  if (!email) return null;
  const name = String(profile.name || "").trim() || "Google user";
  const sub = String(profile.sub || "").trim() || null;

  let existing = null;
  if (sub) {
    existing = await env.DB.prepare(
      "SELECT id, portal_revoked FROM clients WHERE google_sub = ? AND agent_id IS NULL AND dealer_username IS NULL LIMIT 1"
    ).bind(sub).first();
  }
  if (!existing) {
    existing = await env.DB.prepare(
      "SELECT id, portal_revoked FROM clients WHERE agent_id IS NULL AND dealer_username IS NULL AND email IS NOT NULL AND lower(email) = ? ORDER BY id DESC LIMIT 1"
    ).bind(email).first();
  }

  if (existing) {
    // Staff revocation is a hard veto: never let Google sign-in silently
    // re-enable a client staff locked out. The caller bounces to an error
    // page; a staff re-invite is the way back in.
    if (existing.portal_revoked) return null;
    // Link the Google id, enable the portal, and backfill a blank/placeholder
    // name - but never overwrite a real name already on file.
    await env.DB.prepare(
      "UPDATE clients SET portal_enabled = 1, google_sub = COALESCE(google_sub, ?), " +
      "name = CASE WHEN name IS NULL OR name = '' OR name = 'Website enquiry' THEN ? ELSE name END " +
      "WHERE id = ?"
    ).bind(sub, name, existing.id).run();
    return { id: existing.id, created: false };
  }

  const res = await env.DB.prepare(
    "INSERT INTO clients (name, email, portal_enabled, google_sub) VALUES (?, ?, 1, ?)"
  ).bind(name, email, sub).run();
  return { id: res.meta.last_row_id, created: true };
}

// Upsert a public (staff-scoped) client by email so repeat submissions update
// one record instead of creating duplicates (Fix 6). Agent-owned and dealer
// clients are never touched. With no email there's nothing to match on, so a
// fresh client is inserted.
async function upsertPublicClient(env, form, email, whatsapp) {
  const name = String(form.get("name") || "").trim() || "Website enquiry";
  const state = normalizeState(form.get("state"));
  // Match by email OR phone so the same person folds into one record even when
  // they leave the email blank or change it between enquiries (Stephen's case).
  const existing = await findClientByContact(env, { email, whatsapp, ...clientDedupeScope(null) });
  if (existing) {
    // Backfill newly-supplied contact details without clobbering existing ones.
    // Only set the name when the record has none yet (or the default placeholder)
    // so a stranger who knows a client's email/phone can't rename them via the
    // public form. A real name on file is kept.
    await env.DB.prepare(
      `UPDATE clients SET
          name = CASE WHEN name IS NULL OR name = '' OR name = 'Website enquiry' THEN ? ELSE name END,
          email = COALESCE(NULLIF(?, ''), email),
          whatsapp = COALESCE(NULLIF(?, ''), whatsapp),
          state = COALESCE(NULLIF(?, ''), state)
        WHERE id = ?`
    ).bind(name, email || "", whatsapp || "", state || "", existing.id).run();
    return { id: existing.id, created: false };
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
  if (!clientId) return null;
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
  if (dupe) return dupe.id;

  // Fix 4 (server side): clamp the numbers - the client checks are advisory only.
  let yMin = clampRange(num(form, "year_min"), 1970, 2050), yMax = clampRange(num(form, "year_max"), 1970, 2050);
  if (yMin !== null && yMax !== null && yMin > yMax) { const t = yMin; yMin = yMax; yMax = t; }
  const priceMax = clampRange(num(form, "price_max"), 0, 100000000);
  const mileageMax = clampRange(num(form, "mileage_max"), 0, 2000000);
  const rateMin = clampRange(num(form, "rate_min"), 1, 6);

  // Overseas flag: any non-Australia country value marks the request for manual,
  // non-AU handling. "Australia"/"AU" is treated as the default (no flag).
  let dest = str(form, "destination_country");
  if (dest && /^(australia|aus|au)$/i.test(dest.trim())) dest = null;

  const ins = await env.DB.prepare(
    `INSERT INTO wishlists
      (client_id, label, marka_name, model_name, year_min, year_max, price_max, mileage_max, rate_min, kuzov, grade_kw, watch_only, needs_detail, destination_country)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  ).bind(
    clientId, str(form, "label"), marka, model,
    yMin, yMax, priceMax, mileageMax, rateMin, kuzov, gradeKw, needsDetail, dest
  ).run();
  return ins?.meta?.last_row_id ?? null;
}

const clampMin = (v, min) => (v === null ? null : Math.max(min, v));
const clampRange = (v, lo, hi) => (v === null ? null : Math.min(hi, Math.max(lo, v)));

// Self-signup: turn on a client's portal login from the public request form.
// The caller only invokes this for a brand-new client. As a second layer, the
// UPDATE is conditional on the password still being unset, so it can never
// overwrite an existing login even under a race. Returns true only if a fresh
// login was actually created.
async function enablePortalSelfSignup(env, clientId, password) {
  if (!clientId || passwordPolicyError(password)) return false;
  const { salt, hash } = await hashPassword(password);
  // portal_revoked = 0 guard: a revoke clears pass_hash, so without it this
  // "only if no password yet" condition would let a staff-revoked client
  // self-signup straight back into the portal.
  const r = await env.DB.prepare(
    `UPDATE clients SET portal_enabled = 1, pass_salt = ?, pass_hash = ?, invite_token = NULL, invite_exp = NULL
       WHERE id = ? AND (pass_hash IS NULL OR pass_hash = '') AND portal_revoked = 0`
  ).bind(salt, hash, clientId).run();
  return (r.meta?.changes || 0) > 0;
}

// ===========================================================================
// CLIENT PORTAL (buyer self-service: see their cars, edit their searches, ask
// us to action a car). All data is strictly scoped to session.id (the client).
// ===========================================================================
const PORTAL_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function portalSidebar(c, active = "garage") {
  const item = (id, href, label) => `<a class="${active === id ? "active" : ""}"${active === id ? ' aria-current="page"' : ''} href="${href}"><span class="bar" aria-hidden="true"></span><span class="lbl">${label}</span></a>`;
  // The auction search page is a paid-member perk, gated on clients.member.
  const auctions = c && c.member ? item("auctions", "/portal/auctions", "Auction search") : "";
  const sold = c && c.member ? item("sold", "/portal/sold", "Sold auctions") : "";
  return `<aside class="side">
    <div class="brand">${LOGO}</div>
    <nav class="nav">${item("garage", "/portal", "Your garage")}${auctions}${sold}</nav>
    <div class="side-foot">
      <div class="whoami"><span class="who-name">${esc(c?.name || "You")}</span><span class="who-role">${c && c.member ? "Member" : "Client"}</span></div>
      <a class="signout" href="/logout">Sign out</a>
    </div>
  </aside>`;
}

const DIRECT_REQUESTS_LABEL = "Direct requests";
// Lots staff add to a client from the in-client auction search land here.
const MANUAL_FINDS_LABEL = "Manual finds";
// Internal catch-all searches that are plumbing, not staff-managed wishlists —
// hidden from the client page's Searches list.
const SYSTEM_WISHLIST_LABELS = new Set([DIRECT_REQUESTS_LABEL, MANUAL_FINDS_LABEL]);

// Member-only auction search page (the "Auction page"): search the live feed and
// request any lot. Gated on clients.member.
export async function portalAuctionsPage(env, session, params = {}) {
  const cid = Number(session.id);
  const c = await env.DB.prepare("SELECT * FROM clients WHERE id = ? AND portal_enabled = 1").bind(cid).first();
  if (!c) {
    return brandShell(portalSidebar(null),
      `<div class="topbar"><div><div class="kicker">Buyer portal</div><h1>Access ended</h1></div><a class="btn-dark" href="/logout">Sign out</a></div>
       <div class="content"><div class="card"><div class="empty">Your portal access isn't active right now. Please contact JDM Connect.</div></div></div>`,
      "Auction search - JDM Connect");
  }
  if (!c.member) {
    return brandShell(portalSidebar(c, "auctions"),
      `<div class="topbar"><div class="topbar-in"><div class="kicker">Members</div><h1>Auction search</h1><p class="subline">Search every live Japanese auction yourself.</p></div></div>
       <div class="content"><div class="card"><div class="empty">Auction search is a members feature. Ask JDM Connect to upgrade your account and you'll be able to search every live lot from here.</div></div></div>`,
      "Auction search - JDM Connect");
  }

  const nowYear = new Date().getFullYear();
  const tab = params.tab === "watch" ? "watch" : "live";
  const view = params.view === "list" ? "list" : "grid";
  const [makers, houses, fx] = await Promise.all([
    distinctMakers(env), distinctHouses(env), getLiveFx(env).catch(() => 0),
  ]);
  const models = String(params.make || "").trim() ? await distinctModels(env, params.make) : [];
  const bidCount = (await env.DB.prepare(
    "SELECT COUNT(*) n FROM queue WHERE client_id = ? AND client_request = 1"
  ).bind(cid).first())?.n || 0;

  // URL builder that preserves the active search, filters and view across tabs
  // and paging.
  const clean = {};
  for (const k of ["q", "make", "model", "yearMin", "yearMax", "priceMax", "gradeMin", "kuzov", "house", "view"]) {
    const val = String(params[k] ?? "").trim(); if (val) clean[k] = val;
  }
  const buildUrl = (over) => "/portal/auctions?" + new URLSearchParams({ ...clean, ...over }).toString();

  const header = auctionSearchHeader({
    action: "/portal/auctions", hidden: view === "list" ? `<input type="hidden" name="view" value="list">` : "",
    p: params, makers, models, houses, showBid: true, bidCount,
  });
  const tabs = auctionTabs(tab, (id) => (id === "live" ? buildUrl({}) : buildUrl({ tab: id })), { sold: false });

  let body = "";
  if (tab === "watch") {
    body = `${tabs}<div id="watchGrid" class="acgrid"></div>`;
  } else {
    const page = Math.max(1, parseInt(params.page, 10) || 1);
    const { lots, hasMore } = await searchLots(env, { ...params, page });
    const reqForm = (lot) => `<form method="POST" action="/portal/auctions/request" style="margin:0"><input type="hidden" name="id" value="${esc(lot.id)}"><button class="btn-notify ac-req" type="submit">Request bid</button></form>`;
    const toolbar = auctionToolbar({ count: lots.length, hasMore, page, view, viewHref: (mode) => buildUrl({ view: mode }) });
    let grid;
    if (lots.length) {
      grid = `<div class="acgrid${view === "list" ? " list" : ""}">${lots.map((lot) => auctionCardV2(lot, { fx, nowYear, actions: reqForm(lot), detailBase: "/portal/auctions/lot?id=" })).join("")}</div>`;
    } else {
      const filtered = Object.keys(clean).some((k) => k !== "view");
      grid = `<div class="card"><div class="empty"><div class="rule"></div>${filtered ? "No upcoming lots match that search. Try fewer filters, or a broader make and model." : "No live lots in the feed right now. Check back shortly."}</div></div>`;
    }
    const prev = page > 1 ? `<a class="btn-dark" href="${esc(buildUrl({ page: page - 1 }))}">&larr; Newer</a>` : "";
    const next = hasMore ? `<a class="btn-dark" href="${esc(buildUrl({ page: page + 1 }))}">Older &rarr;</a>` : "";
    const pager = (prev || next) ? `<div style="display:flex;gap:10px;justify-content:center;margin-top:26px">${prev}${next}</div>` : "";
    body = `${tabs}${toolbar}${grid}${pager}`;
  }

  const flash = params._flash ? `<div class="flash">${esc(params._flash)}</div>` : "";
  const main = `
    <div class="topbar">
      <div class="topbar-in">
        <div class="kicker">Members</div>
        <h1>Auction search</h1>
        <p class="subline">Search every live Japanese auction, save cars to your watchlist, then ask us to chase any lot.</p>
      </div>
    </div>
    <div class="content">${flash}${header}${body}${auctionWatchScript({ request: true })}${AUCTION_CSS}</div>`;
  return brandShell(portalSidebar(c, "auctions"), main, "Auction search - JDM Connect");
}

// Member-only "Sold auctions" page: browse recent sold-price history from the
// stats feed with the same search UI. Gated on clients.member.
export async function portalSoldPage(env, session, params = {}) {
  const cid = Number(session.id);
  const c = await env.DB.prepare("SELECT * FROM clients WHERE id = ? AND portal_enabled = 1").bind(cid).first();
  if (!c) {
    return brandShell(portalSidebar(null),
      `<div class="topbar"><div><div class="kicker">Buyer portal</div><h1>Access ended</h1></div><a class="btn-dark" href="/logout">Sign out</a></div>
       <div class="content"><div class="card"><div class="empty">Your portal access isn't active right now. Please contact JDM Connect.</div></div></div>`,
      "Sold auctions - JDM Connect");
  }
  if (!c.member) {
    return brandShell(portalSidebar(c, "sold"),
      `<div class="topbar"><div class="topbar-in"><div class="kicker">Members</div><h1>Sold auctions</h1><p class="subline">See what cars actually sold for at recent Japanese auctions.</p></div></div>
       <div class="content"><div class="card"><div class="empty">Sold-price history is a members feature. Ask JDM Connect to upgrade your account and you'll see what every car sells for.</div></div></div>`,
      "Sold auctions - JDM Connect");
  }

  const nowYear = new Date().getFullYear();
  const view = params.view === "list" ? "list" : "grid";
  const [makers, houses, fx] = await Promise.all([
    distinctMakers(env), distinctHouses(env), getLiveFx(env).catch(() => 0),
  ]);
  const models = String(params.make || "").trim() ? await distinctModels(env, params.make) : [];

  const clean = {};
  for (const k of ["q", "make", "model", "yearMin", "yearMax", "priceMax", "gradeMin", "kuzov", "house", "view"]) {
    const val = String(params[k] ?? "").trim(); if (val) clean[k] = val;
  }
  const buildUrl = (over) => "/portal/sold?" + new URLSearchParams({ ...clean, ...over }).toString();

  const header = auctionSearchHeader({
    action: "/portal/sold", hidden: view === "list" ? `<input type="hidden" name="view" value="list">` : "",
    p: params, makers, models, houses, showBid: false, label: "Search sold auction results",
  });

  const page = Math.max(1, parseInt(params.page, 10) || 1);
  const { lots, hasMore } = await searchSold(env, { ...params, page });
  const findLive = (lot) => `<a class="btn-notify ac-req" href="/portal/auctions?${new URLSearchParams({ make: lot.marka_name || "", model: lot.model_name || "" }).toString()}">Find live</a>`;
  const toolbar = auctionToolbar({ count: lots.length, hasMore, page, view, viewHref: (mode) => buildUrl({ view: mode }), label: "Sold at auction" });
  let grid;
  if (lots.length) {
    grid = `<div class="acgrid${view === "list" ? " list" : ""}">${lots.map((lot) => auctionCardV2(lot, { fx, nowYear, soldPrice: Number(lot.finish) || 0, actions: findLive(lot) })).join("")}</div>`;
  } else {
    const filtered = Object.keys(clean).some((k) => k !== "view");
    grid = `<div class="card"><div class="empty"><div class="rule"></div>${filtered ? "No sold results match that search. Try fewer filters, or a broader make and model." : "No sold results to show right now. Check back shortly."}</div></div>`;
  }
  const prev = page > 1 ? `<a class="btn-dark" href="${esc(buildUrl({ page: page - 1 }))}">&larr; More recent</a>` : "";
  const next = hasMore ? `<a class="btn-dark" href="${esc(buildUrl({ page: page + 1 }))}">Older &rarr;</a>` : "";
  const pager = (prev || next) ? `<div style="display:flex;gap:10px;justify-content:center;margin-top:26px">${prev}${next}</div>` : "";

  const main = `
    <div class="topbar">
      <div class="topbar-in">
        <div class="kicker">Members</div>
        <h1>Sold auctions</h1>
        <p class="subline">See what cars actually sold for at recent Japanese auctions, so you know what to bid.</p>
      </div>
    </div>
    <div class="content">${header}${toolbar}${grid}${pager}${auctionWatchScript({ request: false })}${AUCTION_CSS}</div>`;
  return brandShell(portalSidebar(c, "sold"), main, "Sold auctions - JDM Connect");
}

// Member requests a lot found via auction search. Files it against a per-client
// "Direct requests" catch-all search so it shows in the admin client page, and
// won't be re-surfaced by the matcher. Returns { ok, lot, already? } | { ok:false }.
export async function requestAuctionLot(env, clientId, lotId) {
  let lot = null;
  try { lot = await fetchLot(env, lotId); } catch (e) {}
  if (!lot || !lot.id) return { ok: false, error: "not_found" };
  let wl = await env.DB.prepare("SELECT id FROM wishlists WHERE client_id = ? AND label = ? LIMIT 1").bind(clientId, DIRECT_REQUESTS_LABEL).first();
  let wishlistId = wl?.id;
  if (!wishlistId) {
    const ins = await env.DB.prepare("INSERT INTO wishlists (client_id, label, active, watch_only) VALUES (?, ?, 1, 1)").bind(clientId, DIRECT_REQUESTS_LABEL).run();
    wishlistId = ins.meta?.last_row_id;
  }
  const existing = await env.DB.prepare("SELECT id FROM queue WHERE client_id = ? AND lot_id = ? LIMIT 1").bind(clientId, String(lot.id)).first();
  if (existing) {
    await env.DB.prepare("UPDATE queue SET client_request = 1, client_request_at = datetime('now') WHERE id = ?").bind(existing.id).run();
    return { ok: true, already: true, lot };
  }
  await env.DB.prepare(
    "INSERT INTO queue (wishlist_id, client_id, lot_id, lot_json, status, token, client_request, client_request_at, reason) VALUES (?, ?, ?, ?, 'pending', ?, 1, datetime('now'), 'Direct request from auction search')"
  ).bind(wishlistId, clientId, String(lot.id), JSON.stringify(lot), randomToken()).run();
  try { await env.DB.prepare("INSERT OR IGNORE INTO seen_lots (wishlist_id, lot_id) VALUES (?, ?)").bind(wishlistId, String(lot.id)).run(); } catch (e) {}
  return { ok: true, lot };
}

// Staff add a lot they found (via the in-client auction search) to a client. It
// files as a pending match in a per-client "Manual finds" search (watch_only=0,
// so Approve & send emails the client like any normal match), dedupes by
// client+lot, and snapshots the landed cost. Returns { ok, lot, already? } | { ok:false }.
export async function addLotToClient(env, clientId, lotId, session) {
  const cid = Number(clientId);
  if (!Number.isInteger(cid) || cid <= 0) return { ok: false, error: "bad_client" };
  if (!(await clientAccessibleBy(env, cid, session))) return { ok: false, error: "forbidden" };
  let lot = null;
  try { lot = await fetchLot(env, lotId); } catch (e) {}
  if (!lot || !lot.id) return { ok: false, error: "not_found" };

  // Already in this client's queue? Don't add a duplicate.
  const existing = await env.DB.prepare("SELECT id FROM queue WHERE client_id = ? AND lot_id = ? LIMIT 1").bind(cid, String(lot.id)).first();
  if (existing) return { ok: true, already: true, lot };

  let wl = await env.DB.prepare("SELECT id FROM wishlists WHERE client_id = ? AND label = ? LIMIT 1").bind(cid, MANUAL_FINDS_LABEL).first();
  let wishlistId = wl?.id;
  if (!wishlistId) {
    const ins = await env.DB.prepare("INSERT INTO wishlists (client_id, label, active, watch_only) VALUES (?, ?, 1, 0)").bind(cid, MANUAL_FINDS_LABEL).run();
    wishlistId = ins.meta?.last_row_id;
  }
  // Snapshot landed cost (best-effort) and tag the card as a manual find.
  try {
    const client = await env.DB.prepare("SELECT state FROM clients WHERE id = ?").bind(cid).first();
    await attachLanded(env, [{ lot, client: { state: client?.state } }]);
  } catch (e) { /* card just renders without a landed figure */ }
  lot._strength = "Manual";

  await env.DB.prepare(
    "INSERT INTO queue (wishlist_id, client_id, lot_id, lot_json, status, token, reason) VALUES (?, ?, ?, ?, 'pending', ?, 'Added by staff from auction search')"
  ).bind(wishlistId, cid, String(lot.id), JSON.stringify(lot), randomToken()).run();
  try { await env.DB.prepare("INSERT OR IGNORE INTO seen_lots (wishlist_id, lot_id) VALUES (?, ?)").bind(wishlistId, String(lot.id)).run(); } catch (e) {}
  return { ok: true, lot };
}

// A live-auction search result on the admin client page, with an "Add to queue"
// action that files it as a pending match for this client. qsBack preserves the
// current search so the result list survives the add.
function staffFindCard(lot, clientId, firstName, qsBack) {
  const img = imageUrls(lot).medium;
  const title = `${esc(lot.year || "")} ${esc(displayName(lot.marka_name))} ${esc(displayName(lot.model_name))}`.replace(/\s+/g, " ").trim() || "Vehicle";
  const bid = Number(lot.start) > 0 ? yen(lot.start) : (Number(lot.avg_price) > 0 ? yen(lot.avg_price) : "-");
  const when = lot.auction_date ? esc(String(lot.auction_date).slice(0, 10)) : "";
  const landed = lot._landed ? `A$${Number(lot._landed.grandTotal).toLocaleString("en-AU")}` : null;
  return `<div class="mcard">
    <div class="mphoto" style="${img ? `background-image:url('${esc(img)}')` : ""}">
      <div class="grad"></div>
      <span class="pill lot">Lot ${esc(lot.lot || "-")}</span>
      <div class="ttl"><div class="t">${title}</div><div class="a">${esc(lot.auction || "")}${when ? " · " + when : ""}</div></div>
    </div>
    <div class="mstats">
      <div class="s"><div class="k">Year</div><div class="v">${esc(lot.year || "-")}</div></div>
      <div class="s gold"><div class="k">Grade</div><div class="v">${esc(displayGrade(lot.rate))}</div></div>
      <div class="s"><div class="k">Odo</div><div class="v">${lot.mileage ? Math.round(Number(lot.mileage) / 1000) + "k" : "-"}</div></div>
      <div class="s gold"><div class="k">Auction est.</div><div class="v">${bid}</div></div>
    </div>
    ${landed ? `<div class="mland"><span class="ml-k">Est. landed${lot._landed.state ? " · " + esc(lot._landed.state) : ""}</span><span class="ml-v">${landed}</span></div>` : ""}
    <div class="mfoot">
      <div class="who" style="flex:1"><div class="w">${esc(lot.kuzov || "")}</div></div>
      <form method="POST" action="/client/find" style="display:inline"><input type="hidden" name="client_id" value="${clientId}"><input type="hidden" name="lot_id" value="${esc(lot.id)}"><input type="hidden" name="q" value="${esc(qsBack)}"><button class="btn-notify" type="submit">Add to ${esc(firstName || "queue")}</button></form>
    </div>
  </div>`;
}

// Staff Auctions workspace: a standalone live-auction search and a sold-price
// history lookup. Live results carry an "Add to client" picker (reuses the same
// /client/find flow as the in-client search); sold history reuses marketIntel +
// marketPanel. Hits the live feed only when a query is present.
export async function adminAuctionsPage(env, session, opts = {}) {
  const tab = ["sold", "prices", "watch"].includes(opts.tab) ? opts.tab : "live";
  const sp = opts.search || {};
  const layout = sp.layout === "list" ? "list" : "grid";
  const nowYear = new Date().getFullYear();

  // Preserve the active search + layout across tabs and paging. On /admin the
  // `view` param selects the page, so the grid/list toggle uses `layout`.
  const clean = { view: "auctions" };
  for (const k of ["q", "make", "model", "yearMin", "yearMax", "priceMax", "gradeMin", "kuzov", "house", "layout"]) {
    const val = String(sp[k] ?? "").trim(); if (val) clean[k] = val;
  }
  const buildUrl = (over) => "/admin?" + new URLSearchParams({ ...clean, ...over }).toString();
  const tabs = auctionTabs(tab, (id) => buildUrl({ tab: id }), { sold: true, stats: true });

  // Sold prices: the make/model lookup with the market panel (average, median,
  // trend). The browsable Sold auctions grid lives under the "sold" tab below.
  if (tab === "prices") {
    const makers = await distinctMakers(env);
    const datalist = `<datalist id="auc-makers">${makers.map((m) => `<option value="${esc(m)}">`).join("")}</datalist>`;
    const sv = (k) => esc(sp[k] || "");
    const make = String(sp.make || "").trim(), model = String(sp.model || "").trim();
    let intel = "";
    if (make && model) {
      const [m, fx] = await Promise.all([marketIntel(env, make, model).catch(() => null), getLiveFx(env).catch(() => 0)]);
      intel = (m && m.count)
        ? `<div style="margin-top:18px">${marketPanel(m, fx)}</div>`
        : `<div class="empty" style="margin-top:14px">No sold records for ${esc(displayName(make))} ${esc(displayName(model))} yet. Try a broader model name.</div>`;
    }
    const panel = `<div class="card">
      <form method="GET" action="/admin">
        <input type="hidden" name="view" value="auctions"><input type="hidden" name="tab" value="prices">
        <div class="grid2">
          <div><label>Make<input name="make" list="auc-makers" value="${sv("make")}" placeholder="e.g. NISSAN" required></label>${datalist}</div>
          <div><label>Model<input name="model" value="${sv("model")}" placeholder="e.g. SKYLINE" required></label></div>
        </div>
        <div class="actions"><button class="btn-gold" type="submit">Show sold prices</button>
          <span class="help">Recent sold-auction results: average, median, range, a 12-week trend and recent comparables.</span></div>
      </form>${intel}
    </div>`;
    return `${tabs}${panel}${AUCTION_CSS}`;
  }

  // Live, Watchlist and the browsable Sold auctions grid share the search header
  // (and, for live, the client list that powers the add-to-client picker).
  const [makers, houses, fx] = await Promise.all([
    distinctMakers(env), distinctHouses(env), getLiveFx(env).catch(() => 0),
  ]);
  const models = String(sp.make || "").trim() ? await distinctModels(env, sp.make) : [];
  const headerTab = tab === "sold" ? "sold" : "live";
  const hidden = `<input type="hidden" name="view" value="auctions"><input type="hidden" name="tab" value="${headerTab}">${layout === "list" ? `<input type="hidden" name="layout" value="list">` : ""}`;
  const header = auctionSearchHeader({ action: "/admin", hidden, p: sp, makers, models, houses, showBid: false, label: tab === "sold" ? "Search sold auction results" : "Search live Japanese auctions" });

  if (tab === "watch") {
    return `${header}${tabs}<div id="watchGrid" class="acgrid"></div>${auctionWatchScript({ request: false })}${AUCTION_CSS}`;
  }

  // Browsable Sold auctions grid (staff): recent sold lots, each linking through
  // to the Sold prices analytics for that model.
  if (tab === "sold") {
    const page = Math.max(1, parseInt(sp.page, 10) || 1);
    const { lots, hasMore } = await searchSold(env, { ...sp, page });
    const soldAction = (lot) => `<a class="btn-notify ac-req" href="/admin?${new URLSearchParams({ view: "auctions", tab: "prices", make: lot.marka_name || "", model: lot.model_name || "" }).toString()}">Sold prices</a>`;
    const toolbar = auctionToolbar({ count: lots.length, hasMore, page, view: layout, viewHref: (mode) => buildUrl({ tab: "sold", layout: mode }), label: "Sold at auction" });
    let grid;
    if (lots.length) {
      grid = `<div class="acgrid${layout === "list" ? " list" : ""}">${lots.map((lot) => auctionCardV2(lot, { fx, nowYear, soldPrice: Number(lot.finish) || 0, actions: soldAction(lot) })).join("")}</div>`;
    } else {
      const filtered = Object.keys(clean).some((k) => k !== "view" && k !== "layout");
      grid = `<div class="card"><div class="empty"><div class="rule"></div>${filtered ? "No sold results match that search. Try fewer filters, or a broader make and model." : "No sold results to show right now. Check back shortly."}</div></div>`;
    }
    const prev = page > 1 ? `<a class="btn-dark" href="${esc(buildUrl({ tab: "sold", page: page - 1 }))}">&larr; More recent</a>` : "";
    const next = hasMore ? `<a class="btn-dark" href="${esc(buildUrl({ tab: "sold", page: page + 1 }))}">Older &rarr;</a>` : "";
    const pager = (prev || next) ? `<div style="display:flex;gap:10px;justify-content:center;margin-top:26px">${prev}${next}</div>` : "";
    return `${header}${tabs}${toolbar}${grid}${pager}${auctionWatchScript({ request: false })}${AUCTION_CSS}`;
  }

  const acc = accessScope(session);
  const cstmt = env.DB.prepare(`SELECT id, name FROM clients c WHERE ${acc.sql} ORDER BY name`);
  const clients = ((await (acc.binds.length ? cstmt.bind(...acc.binds) : cstmt).all()).results) || [];
  const options = clients.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");

  const page = Math.max(1, parseInt(sp.page, 10) || 1);
  const { lots, hasMore } = await searchLots(env, { ...sp, page });
  const back = buildUrl({ tab: "live", page }); // return to this exact page after adding
  const pickerFor = (lot) => clients.length
    ? `<form method="POST" action="/client/find" class="ac-picker"><input type="hidden" name="lot_id" value="${esc(lot.id)}"><input type="hidden" name="back" value="${esc(back)}"><select name="client_id" required aria-label="Add this car to a client"><option value="">Add to client...</option>${options}</select><button class="btn-notify" type="submit">Add</button></form>`
    : `<span class="help">Add a client first to queue cars.</span>`;

  const toolbar = auctionToolbar({ count: lots.length, hasMore, page, view: layout, viewHref: (mode) => buildUrl({ tab: "live", layout: mode }) });
  let grid;
  if (lots.length) {
    grid = `<div class="acgrid${layout === "list" ? " list" : ""}">${lots.map((lot) => auctionCardV2(lot, { fx, nowYear, actions: pickerFor(lot), detailBase: "/admin?view=auctionlot&lot=" })).join("")}</div>`;
  } else {
    const filtered = Object.keys(clean).some((k) => k !== "view" && k !== "layout");
    grid = `<div class="card"><div class="empty"><div class="rule"></div>${filtered ? "No upcoming lots match that search. Try fewer filters, or a broader make and model." : "No live lots in the feed right now. Check back shortly."}</div></div>`;
  }
  const prev = page > 1 ? `<a class="btn-dark" href="${esc(buildUrl({ tab: "live", page: page - 1 }))}">&larr; Newer</a>` : "";
  const next = hasMore ? `<a class="btn-dark" href="${esc(buildUrl({ tab: "live", page: page + 1 }))}">Older &rarr;</a>` : "";
  const pager = (prev || next) ? `<div style="display:flex;gap:10px;justify-content:center;margin-top:26px">${prev}${next}</div>` : "";
  const flash = opts.found === "added" ? `<div class="flash">Added to the client's review queue. It's under their Live matches, ready to Approve and send.</div>`
    : opts.found === "dup" ? `<div class="dupnote">That car is already in that client's queue.</div>`
    : opts.found === "err" ? `<div class="dupnote">Sorry, we couldn't add that lot. Please try again.</div>` : "";
  return `${flash}${header}${tabs}${toolbar}${grid}${pager}${auctionWatchScript({ request: false })}${AUCTION_CSS}`;
}

// Admin: flip a client's paid-member flag (gates the auction page).
export async function setClientMember(env, clientId, on, session) {
  const id = Number(clientId);
  if (!Number.isInteger(id) || id <= 0) return;
  // Admin only (defence in depth alongside the route guard): membership is a
  // paid feature — the Stripe webhook is the only other writer of this flag.
  if (session?.role !== "admin") return;
  await env.DB.prepare("UPDATE clients SET member = ? WHERE id = ?").bind(on ? 1 : 0, id).run();
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

  const addForm = `<details class="card foldcard"${wls.length ? "" : " open"}>
    <summary>Add a search</summary>
    <form method="POST" action="/portal/wishlist">
      ${presetSelect()}
      <div class="grid">
        <div><label>Label <span class="opt">(your reference)</span><input name="label" placeholder="e.g. weekend project"></label></div>
        <div><label for="pl-maker">Make</label>${makerField(makers, "pl-maker")}</div>
        <div><label>Model <span class="opt">(pick or type)</span>${modelField("pl-models")}</label></div>
        <div><label>Year from<input name="year_min" type="number" min="1960" max="${yMax}" placeholder="1990"></label></div>
        <div><label>Year to<input name="year_max" type="number" min="1960" max="${yMax}" placeholder="2002"></label></div>
        <div><label>Max budget (JPY)<input name="price_max" type="number" min="0" step="10000" placeholder="3,000,000"></label></div>
        <div><label>Max mileage (km)<input name="mileage_max" type="number" min="0" step="1000" placeholder="100,000"></label></div>
        <div><label>Min grade<input name="rate_min" type="number" min="1" max="6" step="0.5" placeholder="e.g. 4"></label></div>
        <div><label>Chassis code <span class="opt">(if known)</span><input name="kuzov" placeholder="e.g. JZA80"></label></div>
      </div>
      <div class="actions"><button class="btn-gold" type="submit">Add search</button>
        <span class="help">Add at least a make, model or chassis code so we know what to look for.</span></div>
    </form>${modelScript("pl-maker", "pl-models")}${presetScript()}
  </details>`;

  const flash = opts.flash ? `<div class="banner"><span class="txt">${esc(opts.flash)}</span></div>` : "";

  // Membership card: an upgrade prompt for non-members (when billing is on), or a
  // status + "manage billing" for members. A manually-comped member (no Stripe
  // customer) sees the status without the billing-portal button.
  const membershipOn = settingOn(settings, "membership_enabled") && !!env.STRIPE_SECRET_KEY && settingNum(settings, "membership_monthly_aud", 0) > 0;
  const memberPrice = `A$${settingNum(settings, "membership_monthly_aud", 49)}`;
  const memberCard = c.member
    ? `<div class="memcard is-member">
        <div class="mem-main"><div class="mem-tag">Full access</div><div class="mem-h">You're a member</div><div class="mem-s">Unlimited searches and priority sourcing on every match. Thank you.</div></div>
        ${c.stripe_customer_id ? `<form method="POST" action="/portal/billing"><button class="btn-dark" type="submit">Manage billing</button></form>` : ""}
      </div>`
    : membershipOn
    ? `<div class="memcard">
        <div class="mem-main"><div class="mem-tag">Upgrade</div><div class="mem-h">Full access - ${memberPrice}/month</div><div class="mem-s">Unlimited active searches, priority sourcing, and a landed-cost estimate on every car. Cancel anytime.</div></div>
        <form method="POST" action="/portal/subscribe"><button class="btn-gold" type="submit">Get full access</button></form>
      </div>`
    : "";
  // At-a-glance summary, all counts scoped to this signed-in client.
  const activeSearches = wls.filter((w) => Number(w.active ?? 1) !== 0).length;
  const inProgress = cars.filter((q) => q.client_request).length;
  const awaiting = cars.length - inProgress;
  const statsRow = `<div class="pstats">
      <div class="pstat lead"><div class="pk">New for you</div><div class="pv" data-count="${awaiting}" aria-live="polite">${awaiting}</div><div class="ps">Matches waiting on your go-ahead</div></div>
      <div class="pstat"><div class="pk">Cars found</div><div class="pv" data-count="${cars.length}" aria-live="polite">${cars.length}</div><div class="ps">Hand-reviewed for your searches</div></div>
      <div class="pstat"><div class="pk">In progress</div><div class="pv" data-count="${inProgress}" aria-live="polite">${inProgress}</div><div class="ps">We're chasing these for you</div></div>
      <div class="pstat"><div class="pk">Active searches</div><div class="pv" data-count="${activeSearches}" aria-live="polite">${activeSearches}</div><div class="ps">Running on every auction sweep</div></div>
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
      ${memberCard}
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
  // A staff re-invite is the one sanctioned way back in after a revoke, so it
  // clears the portal_revoked veto.
  await env.DB.prepare("UPDATE clients SET portal_enabled = 1, portal_revoked = 0, invite_token = ?, invite_exp = ? WHERE id = ?").bind(token, exp, cid).run();
  return { ok: true, token, email: c.email, name: c.name };
}

export async function revokeClientPortal(env, clientId, session) {
  const cid = Number(clientId);
  if (!Number.isInteger(cid) || cid <= 0) return;
  if (!(await clientOwnedBy(env, cid, session))) return;
  // portal_revoked = 1 is the durable staff veto: without it, Google sign-in
  // and request-form self-signup would silently re-enable this client.
  await env.DB.prepare(
    "UPDATE clients SET portal_enabled = 0, portal_revoked = 1, pass_salt = NULL, pass_hash = NULL, invite_token = NULL, invite_exp = NULL WHERE id = ?"
  ).bind(cid).run();
}
