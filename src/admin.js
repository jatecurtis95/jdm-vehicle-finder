// JDM Connect - Vehicle Finder staff app (hi-fi redesign) + public request page.
// Light theme, gold single accent, Inter, hairline borders (per design handoff).

import { esc, yen, km, displayGrade, fullGrade } from "./render.js";
import { imageUrls, splitImages, distinctMakers, distinctModels, distinctGrades, refreshLotImages, searchLots, searchSold, fetchLot } from "./avtonet.js";
import { AUCTION_CSS, auctionCardV2, auctionTabs, auctionToolbar, auctionWatchScript, auctionEligibility, watchAlertBlock, feedDownCard } from "./auction-ui.js";
import { attachLanded, auStates, normalizeState, getLiveFx, audBudgetToYen, lotJpy, carAudToLanded, IMPORT_OVERHEAD_AUD, ON_VALUE_TAX, MIN_CAR_VALUE_AUD } from "./calc.js";
import { marketIntel, marketPanel, DEFAULT_WINDOW_DAYS } from "./market.js";
import { hashPassword, randomToken, hashToken, makeShareToken, passwordPolicyError, runWithSessionVerFallback, PW_MIN, PW_MAX, EMAIL_MAX } from "./auth.js";
import { getSettings, settingOn, settingNum } from "./settings.js";
import { whatsappConfigured } from "./whatsapp.js";
import { googleConfigured } from "./oauth.js";
import { brandDoc, brandShell, risingSun, FONT_FACE_CSS, FONT_PRELOADS } from "./theme.js";
import { SHEET_MODELS, DEFAULT_SHEET_MODEL, SHEET_AUTO_MODES } from "./sheet.js";
import { onboardingCss, wizardScript, popularCards, recentExamplesShell, budgetChips, testimonialPanel, whyUs, whatHappensNext, successTimeline, supportBlock } from "./request-wizard.js";
import { portalSidebar, dealerSidebar } from "./portal-shell.js";
import { auctionHistoryContent, HISTORY_SURFACES, liveSearchBlock, landedFillScript } from "./auction-history.js";
export { portalSidebar };

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
// Client categories: who the client is commercially. A deliberately small,
// fixed set: 'private' (default retail buyer) or 'dealer' (a trade buyer we
// sell to/for). Stored on clients.category (migration 0011); extend this list
// if a new relationship type becomes real.
const CLIENT_CATEGORIES = [
  { id: "private", label: "Private buyer" },
  { id: "dealer", label: "Dealer" },
];
const CLIENT_CATEGORY_IDS = new Set(CLIENT_CATEGORIES.map((c) => c.id));
export const isDealer = (c) => !!c && c.category === "dealer";
const categorySelect = (id, current) => `<select id="${id}" name="category">${CLIENT_CATEGORIES.map((k) =>
  `<option value="${k.id}"${(current || "private") === k.id ? " selected" : ""}>${esc(k.label)}</option>`).join("")}</select>`;

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
// the model <select> via /api/models, clearing any previous selection AND the
// chassis-code field (a code belongs to the old make; leaving it made stale
// preset codes stick, V1.2 Phase 2). Exposes window.jdmLoadModels(want) so
// presets can load + select a model. If the models feed is unreachable the
// select degrades to a free-text input so the form is never bricked; when the
// feed answers, the model stays strictly select-only.
function modelScript(makerId, listId, emptyLabel = "Any model") {
  return `<script>(function(){
    var mk=document.getElementById(${JSON.stringify(makerId)}),sel=document.getElementById(${JSON.stringify(listId)});
    if(!mk||!sel)return;
    var EMPTY=${JSON.stringify(emptyLabel)};
    function degrade(){
      if(sel.tagName!=="SELECT")return;
      var inp=document.createElement("input");
      inp.name=sel.name;inp.id=sel.id;inp.placeholder="e.g. SUPRA";
      if(sel.getAttribute("aria-describedby"))inp.setAttribute("aria-describedby",sel.getAttribute("aria-describedby"));
      sel.parentNode.replaceChild(inp,sel);sel=inp;
    }
    function fill(want){
      if(sel.tagName!=="SELECT"){if(want)sel.value=want;return;}
      if(mk.tagName!=="SELECT"||!mk.value){sel.innerHTML='<option value="">Select a make to see models</option>';sel.disabled=true;return;}
      sel.disabled=false;sel.innerHTML='<option value="">Loading models…</option>';
      fetch("/api/models?maker="+encodeURIComponent(mk.value)).then(function(r){return r.json();}).then(function(l){
        if(!l||!l.length){degrade();if(want)sel.value=want;return;}
        sel.innerHTML='<option value="">'+EMPTY+'</option>';
        l.forEach(function(m){var o=document.createElement("option");o.value=m;o.textContent=m;sel.appendChild(o);});
        if(want){var f=false;for(var i=0;i<sel.options.length;i++){if(sel.options[i].value===want){f=true;break;}}if(!f){var o=document.createElement("option");o.value=want;o.textContent=want;sel.appendChild(o);}sel.value=want;}
      }).catch(function(){degrade();if(want)sel.value=want;});
    }
    mk.addEventListener("change",function(){
      fill("");
      // Chassis code depends on the make/model that was just discarded.
      var form=mk.closest("form"),kz=form&&form.querySelector('[name="kuzov"]');
      if(kz)kz.value="";
    });
    window.jdmLoadModels=function(want){fill(want||"");};
    if(mk.tagName==="SELECT"&&mk.value){fill(sel.getAttribute("data-want")||"");}
    else if(mk.tagName!=="SELECT"){degrade();}
  })();</script>`;
}

// Model code + Grade refinement selects (V1.2 Phase 4). Watches the make and
// model controls, fills the Model code select from /api/codes (labelled with
// the reviewed association) and the Grade multi-select from /api/grades (the
// pre-search over current and recent listings, spelling variants included).
// Degrades quietly: if the feed is down the selects keep only their current
// value and the fields stay optional.
function codeGradeScript(makerId, modelId, codeId, gradesId) {
  return `<script>(function(){
    var mk=document.getElementById(${JSON.stringify(makerId)}),md=document.getElementById(${JSON.stringify(modelId)});
    var cd=document.getElementById(${JSON.stringify(codeId)}),gr=document.getElementById(${JSON.stringify(gradesId)});
    if(!mk||!cd)return;
    function opt(sel,val,txt,selected){var o=document.createElement("option");o.value=val;o.textContent=txt;if(selected)o.selected=true;sel.appendChild(o);}
    function fillGrades(){
      if(!gr||gr.tagName!=="SELECT")return;
      var want=(gr.getAttribute("data-want")||"").split(",").map(function(s){return s.trim();}).filter(Boolean);
      if(!mk.value){gr.innerHTML="";return;}
      fetch("/api/grades?maker="+encodeURIComponent(mk.value)+"&model="+encodeURIComponent((md&&md.value)||"")+"&code="+encodeURIComponent(cd.value||""))
        .then(function(r){return r.json();}).then(function(l){
          gr.innerHTML="";
          (l||[]).forEach(function(g){opt(gr,g,g,want.indexOf(g)>-1);});
          want.forEach(function(w){for(var i=0;i<gr.options.length;i++){if(gr.options[i].value===w)return;}opt(gr,w,w,true);});
        }).catch(function(){});
    }
    function fillCodes(){
      if(cd.tagName!=="SELECT")return;
      var want=cd.getAttribute("data-want")||cd.value||"";
      if(!mk.value){cd.innerHTML='<option value="">Any model code</option>';fillGrades();return;}
      fetch("/api/codes?maker="+encodeURIComponent(mk.value)+"&model="+encodeURIComponent((md&&md.value)||""))
        .then(function(r){return r.json();}).then(function(l){
          cd.innerHTML='<option value="">Any model code</option>';
          (l||[]).forEach(function(c){opt(cd,c.code,c.label,c.code===want);});
          if(want&&cd.value!==want){opt(cd,want,want,true);}
          fillGrades();
        }).catch(function(){fillGrades();});
    }
    mk.addEventListener("change",function(){cd.setAttribute("data-want","");if(gr)gr.setAttribute("data-want","");fillCodes();});
    if(md)md.addEventListener("change",function(){fillCodes();});
    cd.addEventListener("change",fillGrades);
    fillCodes();
  })();</script>`;
}

// Curated wishlist presets: pick one and it auto-fills make/model/code/year for
// a known model. INTENTIONALLY EMPTY (V1.2 Phase 2 preset data pass): every
// preset shipped here must be SEVS-eligible with correct year ranges, and the
// vetted list is to be supplied by Jate/Ben. "Ship empty rather than wrong."
// The dropdown hides itself while this list is empty; add entries of the shape
//   { group, name, make, model, kuzov?, year_min?, year_max?, label }
// (make/model must be real feed values; model matches as "contains").
const WL_PRESETS = [];

// Dropdown that fills a wishlist form from a preset. Works on any wishlist form
// (matches inputs by name, relative to the form). Renders nothing while the
// preset list is empty (see WL_PRESETS above).
function presetSelect() {
  if (!WL_PRESETS.length) return "";
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
  return `<div style="margin-bottom:16px;max-width:430px"><label>Quick preset <span class="opt">(optional shortcut for a known model)</span></label>
    <select onchange="jdmPreset(this)"><option value="">No preset</option>${opts}</select></div>`;
}
function presetScript() {
  if (!WL_PRESETS.length) return "";
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
  /* Phase 5 design tokens. Every spacing, type and radius value in the admin
     sits on these scales; anything off-scale is a bug.
       Spacing: 4 8 12 16 24 32 (card padding 16 mobile / 20 desktop,
                grid gaps 12 / 20, section gaps 32)
       Type:    12 uppercase labels, 13 secondary, 15 body, 17 section titles,
                20 mobile page titles, 28 desktop page titles
       Radius:  10 cards, 8 controls (9999 pills, 50% dots)
       Colour:  gold ONLY for primary actions, money figures and brand chrome;
                green / amber / red ONLY for health and urgency; blue = info. */
  :root{--gold:#CAA34C;--gold-hover:#D9B45F;--gold-txt:#E6C879;--gold-tint:rgba(202,163,76,0.14);--gold-line:rgba(202,163,76,0.34);--gold-on:#15120A;--avatar:rgba(202,163,76,0.16);
    --ink:#F4F4F0;--t2:#CBD1DB;--t3:#99A1AE;--faint:#7F8894;--ph:#7F8894;--bg:#0F1115;--bg-2:#090A0D;--card:#171A20;--card-2:#1C2027;--off:#13161B;--hair:rgba(255,255,255,0.08);--hair-2:rgba(255,255,255,0.05);
    --on-solid:#F7F8F8;--media:#15171A;
    --field:#1B1F26;--field-line:rgba(255,255,255,0.14);--field-focus:#20242C;--hover:rgba(255,255,255,0.05);--soft:rgba(255,255,255,0.06);--bad:#E2607A;--bad-bg:rgba(226,96,122,0.12);--bad-line:rgba(226,96,122,0.34);
    --good:#5BC08C;--warn-c:#E0A94B;
    --ok-bg:rgba(91,192,140,0.14);--ok-fg:#7FD3A6;--warn-bg:rgba(224,169,75,0.16);--warn-fg:#E9BE6B;--neu-bg:rgba(255,255,255,0.06);--neu-fg:#C9CCD1;
    --str-bg:rgba(91,192,140,0.14);--str-fg:#7FD3A6;--good-bg:rgba(224,169,75,0.16);--good-fg:#E9BE6B;--pos-bg:rgba(255,255,255,0.06);--pos-fg:#AEB3BA;
    --elig-bg:rgba(91,192,140,0.14);--elig-fg:#7FD3A6;--echk-bg:rgba(224,169,75,0.16);--echk-fg:#E9BE6B;--eno-bg:rgba(226,96,122,0.13);--eno-fg:#E2607A;
    --info:#9FB4D2;--info-bg:rgba(111,134,166,0.2);
    --sp-1:4px;--sp-2:8px;--sp-3:12px;--sp-4:16px;--sp-5:24px;--sp-6:32px;
    --pad-card:20px;--gap-grid:20px;
    --fs-label:12px;--fs-sec:13px;--fs-body:15px;--fs-sect:17px;--fs-page:28px;
    /* Typography treatment: premium lives in weight, tracking and leading.
       Labels are light (500) with positive tracking; the values they describe
       are semibold ink. Titles and numerals track tight; body and dense list
       rows breathe. Exact values recorded in ADMIN-REDESIGN.md. */
    --w-label:500;--w-value:600;
    --ls-label:0.06em;--ls-title:-0.01em;--ls-num:-0.02em;
    --lh-body:1.5;--lh-list:1.45;
    --r:8px;--r-ctl:8px;--r-card:10px;}
  .skip-link{position:absolute;left:-9999px;top:0}
  .skip-link:focus{left:8px;top:8px;z-index:100;background:#fff;color:#111;padding:8px 12px;border-radius:var(--r-ctl)}
  /* Light workspace: the sidebar (.side) keeps the dark brand from :root, while
     the main content area runs a light palette. Only tokens that differ from the
     dark root are overridden here; gold, radii and the scales are shared. */
  .main{
    color:var(--ink);
    --ink:#1A1D21;--t2:#545C68;--t3:#6E7684;--faint:#6E7684;--ph:#8A92A0;
    --bg:#F5F6F7;--bg-2:#ffffff;--card:#ffffff;--card-2:#ffffff;--off:#F8F9FA;
    --hair:rgba(0,0,0,0.08);--hair-2:rgba(0,0,0,0.05);
    --field:#FBFCFD;--field-line:rgba(0,0,0,0.14);--field-focus:#ffffff;
    --hover:rgba(0,0,0,0.04);--soft:#EFF1F3;
    --gold-txt:#7A5E1C;--avatar:#F0E9D7;
    --bad:#B11226;--bad-bg:rgba(177,18,38,0.06);--bad-line:rgba(177,18,38,0.3);
    --good:#1F7A4D;--warn-c:#9A6C00;
    --ok-bg:#E1F5EE;--ok-fg:#04342C;--warn-bg:#FAF1DE;--warn-fg:#633806;--neu-bg:#EFF1F3;--neu-fg:#4A5260;
    --str-bg:#EAF3DE;--str-fg:#27500A;--good-bg:#FAEEDA;--good-fg:#633806;--pos-bg:#F1EFE8;--pos-fg:#444441;
    --elig-bg:#E1F5EE;--elig-fg:#04342C;--echk-bg:#FAEEDA;--echk-fg:#633806;--eno-bg:#FCEBEB;--eno-fg:#501313;
    --info:#3B5E96;--info-bg:rgba(59,115,172,0.1);
  }
  *{box-sizing:border-box}
  /* Page-level guard (same as the landing shell): the workspace is light on a
     dark brand canvas, so any stray too-wide element would let the page pan
     sideways into a black void on phones. clip (not hidden) keeps every
     position:sticky element working - it never creates a scroll container. */
  html{overflow-x:clip}
  body{margin:0;font-family:${FONT};color:var(--ink);background:var(--bg);font-variant-numeric:tabular-nums;line-height:var(--lh-body);-webkit-font-smoothing:antialiased}
  /* ONE data numeral: every 20px stat figure (triage, tasks, pipeline,
     client-detail) shares this treatment instead of five local copies. */
  .stat-n{font-size:20px;font-weight:700;letter-spacing:var(--ls-num);line-height:1;color:var(--ink);font-variant-numeric:tabular-nums}
  a{color:inherit;text-decoration:none}
  .wrap{display:flex;min-height:100vh}
  .side{width:256px;flex:0 0 256px;border-right:1px solid var(--hair);display:flex;flex-direction:column;padding:26px 20px;background:var(--bg-2);position:sticky;top:0;align-self:flex-start;height:100vh;overflow-y:auto}
  .side .brand{padding:4px 6px 20px;margin-bottom:18px;border-bottom:1px solid var(--hair)}
  .brand svg path,.brand svg polygon,.login-logo svg path,.login-logo svg polygon{fill:var(--ink)}
  .side-search{position:relative;margin-bottom:16px}
  .side-search .ss-ic{position:absolute;left:11px;top:50%;transform:translateY(-50%);display:flex;color:var(--faint);pointer-events:none}
  .side-search .ss-ic svg{width:15px;height:15px}
  .side-search input[type=search]{width:100%;padding:8px 12px 8px 34px;border:1px solid var(--hair);border-radius:var(--r-ctl);background:var(--card);color:var(--ink);font-size:var(--fs-sec);font-family:inherit}
  .side-search input[type=search]:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 3px var(--gold-tint)}
  .nav{margin-top:0;display:flex;flex-direction:column;gap:2px}
  .nav a,.nav span.active{display:flex;align-items:center;gap:12px;padding:12px;border-radius:var(--r-ctl);font-size:var(--fs-body);color:var(--t2)}
  .nav a .bar,.nav span.active .bar{width:3px;height:16px;border-radius:9999px;background:transparent}
  .nav a .lbl,.nav span.active .lbl{flex:1}
  .nav a .ct{font-size:var(--fs-sec);color:var(--faint);font-weight:500}
  .nav a.active,.nav span.active{background:var(--gold-tint);color:var(--ink);font-weight:600}
  .nav a.active .bar,.nav span.active .bar{background:var(--gold)}
  .nav a.active .ct{color:var(--gold-txt)}
  .nav a:hover:not(.active){background:var(--hover)}
  .side-foot{margin-top:auto;display:flex;flex-direction:column;gap:16px;padding-top:20px}
  .run-btn{width:100%;padding:12px;font-size:var(--fs-body)}
  .run-btn .dot{width:7px;height:7px;border-radius:9999px;background:var(--gold-on);display:inline-block}
  .main{flex:1;background:var(--bg);display:flex;flex-direction:column}
  .topbar{position:sticky;top:0;z-index:5;background:var(--bg-2);padding:24px 32px;display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid var(--hair)}
  .topbar.unstick{position:static}
  .kicker{display:flex;align-items:center;gap:8px;color:var(--gold-txt);font-size:var(--fs-label);font-weight:600;letter-spacing:0.14em;text-transform:uppercase}
  .kicker:before{content:"";width:24px;height:1px;background:var(--gold);display:inline-block}
  h1{font-size:var(--fs-page);font-weight:600;letter-spacing:-0.015em;margin:12px 0 4px;line-height:1.1}
  .subline{color:var(--t3);font-size:var(--fs-sec);margin:0}
  .btn-secondary{background:var(--soft);color:var(--ink);border:1px solid var(--hair);font-weight:600;padding:12px 16px;border-radius:var(--r-ctl);font-size:var(--fs-sec);white-space:nowrap;cursor:pointer;font-family:inherit}
  .btn-secondary:hover{background:var(--hover)}
  .content{padding:var(--sp-6) var(--sp-6) 64px;max-width:1180px}
  .content.wide,.topbar.wide{width:100%;max-width:1640px;margin-left:auto;margin-right:auto}
  .content.dash{width:100%;max-width:2040px;margin-left:auto;margin-right:auto}
  .card{background:var(--card);border:1px solid var(--hair);border-radius:var(--r-card);padding:var(--pad-card);margin-bottom:var(--sp-5)}
  .card h2{font-size:var(--fs-sect);font-weight:600;letter-spacing:var(--ls-title);margin:0 0 var(--sp-4);display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--hair);padding-bottom:var(--sp-4)}
  .card h2 .num{color:var(--t3);font-weight:700}
  details.foldcard>summary{font-size:var(--fs-sect);font-weight:600;letter-spacing:var(--ls-title);display:flex;align-items:center;gap:12px;cursor:pointer;list-style:none;margin:0}
  details.foldcard>summary::-webkit-details-marker{display:none}
  details.foldcard>summary::after{content:"+";margin-left:auto;color:var(--gold);font-weight:700;font-size:20px;line-height:1;transition:transform .15s}
  details.foldcard[open]>summary{border-bottom:1px solid var(--hair);padding-bottom:var(--sp-4);margin-bottom:var(--sp-4)}
  details.foldcard[open]>summary::after{transform:rotate(45deg)}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px var(--gap-grid)}
  .grid2{display:grid;grid-template-columns:repeat(2,1fr);gap:16px var(--gap-grid)}
  label{display:block;font-size:var(--fs-label);color:var(--t2);margin-bottom:8px;font-weight:var(--w-label);letter-spacing:0.02em}
  label .opt{color:var(--faint);font-weight:400;text-transform:none;letter-spacing:0}
  input,select{width:100%;padding:12px;border:1px solid var(--field-line);border-radius:var(--r-ctl);font-size:var(--fs-body);background:var(--field);color:var(--ink);font-family:${FONT}}
  input::placeholder{color:var(--ph)}
  input:focus,select:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 3px var(--gold-tint);background:var(--field-focus)}
  select{appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236F7378' stroke-width='1.6' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px}
  .actions{display:flex;align-items:center;gap:16px;margin-top:var(--sp-5)}
  /* Action buttons are a four-tier system (one gold primary per scope,
     quiet secondary, text tertiary, destructive danger) plus the .btn-sm
     row-action size. .btn-toggle is the stateful on/off chip, and bap/bsk/
     bdel are the compact bulk/action-bar variants - both outside the tiers. */
  .btn-primary{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--gold);color:var(--gold-on);font-weight:600;border:0;padding:12px 24px;border-radius:var(--r-ctl);font-size:var(--fs-sec);cursor:pointer;font-family:${FONT}}
  .btn-primary:hover{background:var(--gold-hover)}
  .btn-sm{padding:8px 16px;font-size:var(--fs-sec)}
  .btn-primary:focus-visible,.btn-secondary:focus-visible,.btn-tertiary:focus-visible,.btn-toggle:focus-visible,.bap:focus-visible,.bsk:focus-visible,.kebab:focus-visible,.nav a:focus-visible,.fchip:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
  .btn-danger:focus-visible,.bdel:focus-visible{outline:2px solid var(--bad);outline-offset:2px}
  /* Shared button states: any button variant can carry disabled / .is-loading. */
  .btn-primary:disabled,.btn-secondary:disabled,.btn-tertiary:disabled,.btn-danger:disabled,.bap:disabled,.bsk:disabled,.bdel:disabled{opacity:.55;cursor:default;pointer-events:none}
  .is-loading{opacity:.7;pointer-events:none;position:relative}
  .help{color:var(--faint);font-size:var(--fs-sec)}
  table{width:100%;border-collapse:collapse;font-size:var(--fs-sec)}
  th{text-align:left;padding:12px 8px;background:var(--off);color:var(--t3);font-weight:var(--w-label);font-size:var(--fs-label);letter-spacing:.01em;border-bottom:1px solid var(--hair)}
  td{padding:16px 8px;border-bottom:1px solid var(--hair-2);color:var(--t2);line-height:var(--lh-list)}
  .avatar{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;background:var(--soft);color:var(--t2);font-size:var(--fs-label);font-weight:600;vertical-align:middle;margin-right:8px}
  .yes{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:9999px;background:var(--soft);color:var(--t2);font-size:var(--fs-label)}
  .btn-danger{background:transparent;border:1px solid var(--bad-line);color:var(--bad);font-size:var(--fs-sec);font-weight:600;padding:8px 12px;border-radius:var(--r-ctl);cursor:pointer;font-family:${FONT}}
  .btn-danger:hover{background:var(--bad-bg)}
  .btn-toggle{border:1px solid var(--hair);font-size:var(--fs-label);font-weight:600;padding:8px 12px;border-radius:9999px;cursor:pointer;background:transparent;color:var(--t2);font-family:${FONT}}
  .btn-toggle.on{background:var(--gold-tint);border-color:var(--gold);color:var(--gold-txt)}
  .btn-toggle.off{background:var(--soft);color:var(--t3)}
  .btn-toggle:hover{filter:brightness(0.98)}
  .btn-tertiary{background:transparent;border:0;color:var(--t3);font-size:var(--fs-sec);font-weight:600;padding:8px;cursor:pointer;font-family:${FONT}}
  .btn-tertiary:hover{color:var(--ink)}
  /* ONE chip component. Neutral by default; tone classes carry the signal:
     chip-good / chip-warn / chip-bad = health and urgency,
     chip-info = engagement (viewed), chip-gold = member / brand only. */
  .chip{display:inline-block;background:var(--soft);border:1px solid var(--hair);color:var(--t2);font-size:var(--fs-label);font-weight:500;padding:4px 10px;border-radius:9999px;font-family:${FONT};white-space:nowrap}
  button.chip{cursor:pointer}
  button.chip:hover{background:var(--bad-bg);border-color:var(--bad-line);color:var(--bad)}
  .chip.muted{background:var(--soft);border-color:var(--hair);color:var(--t3)}
  .chip-good{background:var(--ok-bg);border-color:transparent;color:var(--ok-fg)}
  .chip-warn{background:var(--warn-bg);border-color:transparent;color:var(--warn-fg)}
  .chip-bad{background:var(--bad-bg);border-color:transparent;color:var(--bad)}
  .chip-info{background:var(--info-bg);border-color:transparent;color:var(--info)}
  .chip-gold{background:var(--gold-tint);border-color:transparent;color:var(--gold-txt)}
  .chip-on{background:var(--card);border-color:var(--ink);color:var(--ink)}
  /* Row-level selects read as quiet text until pointed at (Attio register:
     fields in a record row look inert until you interact). */
  .share-pick{font-size:var(--fs-label);padding:4px 8px;border:1px solid transparent;border-radius:var(--r-ctl);background:transparent;color:var(--t2);cursor:pointer;font-family:${FONT}}
  .share-pick:hover,.share-pick:focus{border-color:var(--field-line);background:var(--field);color:var(--ink)}
  .bulkbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:var(--card);border:1px solid var(--hair);border-radius:var(--r-card);padding:12px 16px;margin-bottom:16px}
  /* In the bulk FORM the selects are the controls, not row metadata, so they
     keep the field affordance the quiet row treatment removes. */
  .bulkbar select.share-pick{width:auto;border-color:var(--field-line);background:var(--field);color:var(--ink)}
  .bulk-label{font-size:var(--fs-sec);font-weight:600;color:var(--t2)}
  .bulk-inc{display:inline-flex;align-items:center;gap:6px;font-size:var(--fs-label);color:var(--t2);cursor:pointer;margin-left:auto}
  .bulk-inc input{width:auto}
  .toggles{margin-top:var(--sp-5);display:flex;flex-direction:column;gap:8px}
  .toggle{display:flex;align-items:flex-start;gap:12px;padding:16px;border:1px solid var(--hair);border-radius:var(--r-ctl);cursor:pointer}
  .toggle:hover{background:var(--hover)}
  .toggle input{width:18px;height:18px;padding:0;margin:2px 0 0;accent-color:var(--gold);cursor:pointer;flex:0 0 auto}
  .toggle .tg-txt{display:flex;flex-direction:column;gap:2px}
  .toggle .tg-title{font-size:var(--fs-sec);font-weight:600;color:var(--ink)}
  .toggle .tg-desc{font-size:var(--fs-label);color:var(--t3);line-height:1.4}
  .toggle:has(input:checked){background:var(--gold-tint);border-color:var(--gold-line)}
  .set-nav{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:var(--sp-5)}
  .set-nav a{font-size:var(--fs-label);font-weight:600;color:var(--t2);background:var(--field);border:1px solid var(--field-line);border-radius:9999px;padding:8px 12px;text-decoration:none}
  .set-nav a:hover{color:var(--ink);border-color:var(--gold-line)}
  .set-card{scroll-margin-top:24px}
  .set-disc{margin-top:16px;font-size:var(--fs-sec)}
  .set-disc summary{cursor:pointer;color:var(--gold-txt);font-weight:600;list-style:none}
  .set-disc summary::-webkit-details-marker{display:none}
  /* ONE sticky action bar. Variants: .actionbar-end right-aligns (settings
     save bar), .actionbar-inline sits in the flow above a grid (client page
     bulk bar). The matches .bulkbar2 is the floating top-pinned variant. */
  .actionbar{position:sticky;bottom:0;z-index:6;display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:var(--bg);border-top:1px solid var(--hair);padding:12px 0}
  .actionbar-end{justify-content:flex-end}
  .actionbar-inline{position:static;border-top:0;background:transparent;padding:0;margin:0 0 16px}
  .actionbar .ab-check{display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600;font-size:var(--fs-sec);margin:0}
  .actionbar .ab-check input{width:auto;min-height:0}
  .actionbar .ab-count{color:var(--t3);font-size:var(--fs-sec)}
  .actionbar .ab-spring{flex:1}
  .actionbar .bap{background:var(--gold);color:var(--gold-on);border:0;font-family:inherit;font-weight:600;font-size:var(--fs-sec);border-radius:var(--r-ctl);padding:8px 16px;cursor:pointer}
  .actionbar .bsk{background:transparent;color:var(--t2);border:1px solid var(--hair);font-family:inherit;font-weight:600;font-size:var(--fs-sec);border-radius:var(--r-ctl);padding:8px 16px;cursor:pointer}
  .banner{display:flex;align-items:center;gap:12px;margin-bottom:var(--sp-5);padding:16px 20px;background:var(--card);border:1px solid var(--hair);border-left:3px solid var(--gold);border-radius:var(--r-ctl)}
  .banner .reddot{width:6px;height:6px;border-radius:9999px;background:var(--bad);display:inline-block}
  .banner .txt{font-size:var(--fs-sec);color:var(--t2)}
  /* min(330px,100%) lets columns shrink inside a padded mobile card; a hard
     330px minimum overflowed the 375px viewport and clipped the card CTAs.
     min-width:0 on the items stops nowrap spec lines re-inflating the track
     past the viewport (grid items default to min-width:auto). */
  .mgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(330px,100%),1fr));gap:var(--gap-grid)}
  .mgrid>*{min-width:0}
  .mcard{background:var(--card);border:1px solid var(--hair);border-radius:var(--r-card);overflow:hidden;display:flex;flex-direction:column;content-visibility:auto;contain-intrinsic-size:auto 430px}
  .mphoto{position:relative;height:188px;flex:0 0 auto;background:var(--media);background-size:cover;background-position:center}
  .mphoto .grad{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.78) 0%,rgba(0,0,0,0) 55%)}
  .pill{position:absolute;top:12px;display:inline-flex;align-items:center;gap:4px;background:rgba(0,0,0,0.55);backdrop-filter:blur(2px);border-radius:9999px;padding:4px 8px;font-size:var(--fs-label);font-weight:600;color:var(--on-solid);letter-spacing:0.04em}
  .pill.lot{left:12px}
  .pill.str{right:12px;background:rgba(0,0,0,0.55)}
  .pill.str .sd{width:7px;height:7px;border-radius:9999px;display:inline-block}
  .mphoto .ttl{position:absolute;left:16px;right:16px;bottom:12px;color:var(--on-solid);z-index:2}
  .mphoto .ttl .t{font-size:var(--fs-sect);font-weight:600;letter-spacing:-0.01em}
  .mphoto .ttl .t a{color:inherit;text-decoration:none}
  .mphoto .ttl .t a:hover{text-decoration:underline;text-decoration-color:var(--gold)}
  /* Stretched photo link to the full lot page; pills and the title sit above
     it, and the bulk-select checkbox keeps its higher z-index. */
  .mphoto .mp-link{position:absolute;inset:0;z-index:1}
  .mphoto .pill{z-index:2}
  .mphoto .ttl .a{font-size:var(--fs-label);color:#E6E7E8;margin-top:4px}
  .mstats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:16px}
  .mstats .s .k{font-size:var(--fs-label);font-weight:var(--w-label);letter-spacing:var(--ls-label);text-transform:uppercase;color:var(--faint)}
  .mstats .s .v{font-size:var(--fs-sec);font-weight:600;margin-top:4px;color:var(--ink)}
  .mstats .s.gold .v{color:var(--ink);font-weight:700}
  .mland{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--gold-tint);border-top:1px solid var(--hair)}
  .mland .ml-k{font-size:var(--fs-label);font-weight:var(--w-label);letter-spacing:var(--ls-label);text-transform:uppercase;color:var(--gold-txt)}
  .mland .ml-v{font-size:var(--fs-body);font-weight:var(--w-value);color:var(--gold-txt);font-variant-numeric:tabular-nums}
  .mfoot{border-top:1px solid var(--hair);padding:16px;display:flex;align-items:center;gap:8px}
  .mfoot .who{flex:1;min-width:0}
  .mfoot .who .n{font-size:var(--fs-sec);font-weight:600;color:var(--ink)}
  .mfoot .who .w{font-size:var(--fs-label);color:var(--t3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .empty{color:var(--faint);padding:32px 0;text-align:center}
  .empty .rule{width:40px;height:1px;background:var(--hair);margin:0 auto 16px}
  .signout{display:block;text-align:center;color:var(--t3);font-size:var(--fs-sec);padding:8px;border-radius:var(--r-ctl)}
  .signout:hover{background:var(--hover);color:var(--ink)}
  .whoami{display:flex;flex-direction:column;align-items:center;gap:1px;padding:2px 0}
  .whoami .who-name{font-size:var(--fs-sec);font-weight:600;color:var(--ink)}
  .whoami .who-role{font-size:var(--fs-label);font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--gold-txt)}
  .login-screen{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);padding:24px}
  .login-card{width:100%;max-width:380px;background:var(--card);border:1px solid var(--hair);border-radius:var(--r-card);padding:32px;box-shadow:0 18px 50px rgba(0,0,0,0.45)}
  .login-card .login-logo{display:flex;justify-content:center;padding-bottom:20px;margin-bottom:24px;border-bottom:1px solid var(--hair)}
  .login-card h1{font-size:20px;font-weight:600;margin:0 0 4px;text-align:center;letter-spacing:-0.01em}
  .login-card .login-sub{color:var(--t3);font-size:var(--fs-sec);text-align:center;margin:0 0 24px;line-height:1.45}
  .login-card label{margin-bottom:8px}
  .login-card .btn-primary{width:100%;margin-top:16px;padding:12px;font-size:var(--fs-body);display:block}
  .login-err{background:var(--bad-bg);border:1px solid var(--bad-line);color:var(--bad);font-size:var(--fs-sec);padding:8px 12px;border-radius:var(--r-ctl);margin-bottom:16px;text-align:center}
  /* Public request: bold success receipt + inline error (Fix 1 / Fix 7) */
  .reqok{border:1px solid var(--gold);border-left:4px solid var(--gold);background:linear-gradient(180deg,var(--gold-tint),var(--card))}
  .reqok .reqok-badge{display:inline-flex;align-items:center;gap:8px;font-size:var(--fs-sec);font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--gold-txt)}
  .reqok .reqok-badge .tick{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:9999px;background:var(--gold);color:var(--gold-on);font-size:var(--fs-sec)}
  .reqok .reqok-ref{margin-top:12px;font-size:var(--fs-body);color:var(--ink)}
  .reqok .reqok-ref strong{font-weight:700;letter-spacing:.02em}
  .reqok p{margin:12px 0 0;color:var(--t2);font-size:var(--fs-sec);line-height:1.55}
  .reqerr{margin-bottom:16px;padding:12px 16px;background:var(--bad-bg);border:1px solid var(--bad-line);border-left:4px solid var(--bad);border-radius:var(--r-ctl);color:var(--bad);font-size:var(--fs-sec);line-height:1.45}
  .dupnote{margin-bottom:16px;padding:12px 16px;background:var(--card);border:1px solid var(--hair);border-left:4px solid var(--t3);border-radius:var(--r-ctl);color:var(--ink);font-size:var(--fs-sec);line-height:1.45}
  .field-err{display:none;color:var(--bad);font-size:var(--fs-sec);line-height:1.45;margin-top:8px;font-weight:500}
  /* Client portal */
  .reqbadge{display:inline-flex;align-items:center;gap:4px;background:rgba(91,192,140,.13);border:1px solid rgba(91,192,140,.4);color:var(--str-fg);font-size:var(--fs-label);font-weight:600;padding:8px 12px;border-radius:9999px}
  .paybadge{display:inline-flex;align-items:center;gap:4px;background:var(--gold-tint);border:1px solid rgba(202,163,76,.4);color:var(--gold-txt);font-size:var(--fs-label);font-weight:600;padding:4px 8px;border-radius:9999px;margin-left:8px}
  .portal-acct{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  .portal-acct .pa-k{font-size:var(--fs-label);color:var(--t3)}
  .pwrap{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  /* Mobile nav: off-canvas drawer toggled by a CSS checkbox (works without JS;
     a link click loads a new page, which resets the toggle). */
  .nav-cb{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
  .nav-burger{display:none}
  .nav-scrim{display:none}
  @media(max-width:920px){
    .wrap{flex-direction:column}
    .nav-burger{display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:50;height:52px;padding:0 16px;background:var(--bg-2);border-bottom:1px solid var(--hair);color:var(--ink);font-weight:600;font-size:var(--fs-sec);cursor:pointer;-webkit-tap-highlight-color:transparent}
    .nav-burger svg{width:22px;height:22px}
    /* visibility:hidden (delayed until the slide ends) keeps the closed
       drawer's links out of the tab order - same fix as the portal shell. */
    .side{position:fixed;top:0;left:0;height:100dvh;width:min(82vw,300px);transform:translateX(-100%);visibility:hidden;transition:transform .28s cubic-bezier(.2,.7,.3,1),visibility 0s .28s;z-index:60;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.55);overflow-y:auto}
    .nav{flex-direction:column}
    .side-foot{flex-direction:column;margin-top:auto;padding-top:20px}
    .nav-cb:checked ~ .wrap .side{transform:none;visibility:visible;transition:transform .28s cubic-bezier(.2,.7,.3,1)}
    .nav-scrim{display:block;position:fixed;inset:0;background:rgba(0,0,0,.55);opacity:0;visibility:hidden;transition:opacity .28s;z-index:55}
    .nav-cb:checked ~ .wrap .nav-scrim{opacity:1;visibility:visible}
    .topbar{top:52px}
    .mtools{top:52px}
  }
  /* Health dots (last-contact recency) - shared by Requests, Customers and
     the drawer. Green under 7 days, amber 7 to 14, red 14+ or never. */
  .health{display:inline-block;width:9px;height:9px;border-radius:9999px;margin-right:8px;vertical-align:middle}
  .health-green{background:#1F7A4D}.health-amber{background:#C98A00}.health-red{background:#B11226}
  .health-neutral{background:transparent;border:1.5px solid var(--faint)}
  /* Mobile card lists: below 640px the wide tables (Requests, Customers,
     Agents, Payments) swap for these server-rendered card rows. Both are in
     the HTML; CSS decides which shows, so desktop keeps the tables. */
  .mcl{display:none}
  .mcl-row{display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--hair);border-radius:var(--r-card);padding:12px 16px;text-decoration:none;color:var(--ink);min-height:44px}
  a.mcl-row:active{background:var(--hover)}
  .mcl-b{flex:1;min-width:0}
  .mcl-t{font-size:var(--fs-body);font-weight:600;color:var(--ink);display:flex;align-items:center;gap:8px;flex-wrap:wrap;line-height:1.3;overflow-wrap:anywhere}
  /* overflow-wrap:anywhere: a worst-case unbroken token (long email, VIN-ish
     label) must wrap inside the card, never widen the page (375px rule). */
  .mcl-m{font-size:var(--fs-label);color:var(--t3);margin-top:4px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;line-height:var(--lh-list);overflow-wrap:anywhere}
  .mcl-r{text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex:0 0 auto}
  .mcl-rs{font-size:var(--fs-label);color:var(--t3);white-space:nowrap;display:inline-flex;align-items:center}
  @media(max-width:640px){
    :root{--pad-card:16px;--gap-grid:12px;--fs-page:20px}
    .main{--pad-card:16px;--gap-grid:12px;--fs-page:20px}
    .grid{grid-template-columns:1fr}
    .grid2{grid-template-columns:1fr}
    .topbar,.content{padding-left:16px;padding-right:16px}
    /* One-row mobile page header: 20px title + the primary action; the kicker
       and subline stack is desktop-only. The 33px mobile h1 is gone. */
    .side{padding:12px 16px}
    .topbar{padding-top:12px;padding-bottom:12px;align-items:center}
    .topbar .kicker{display:none}
    .topbar .subline{display:none}
    .topbar h1{font-size:20px}
    /* M1: >=16px controls stop iOS Safari auto-zooming on focus (functional
       exception to the type scale, documented in DESIGN-AUDIT.md) */
    input,select,textarea{font-size:16px}
    /* M2: comfortable tap targets, full-width primary CTA */
    input,select,textarea{min-height:48px}
    .btn-primary,.btn-secondary,.btn-tertiary,.btn-danger,.btn-toggle,.bap,.bsk,.bdel,.rd-cta{min-height:44px}
    /* Action bars stack their buttons full width on phones (same rule the
       .bulkbar2 variant already has), so a pair of CTAs never clips. */
    .actionbar .bap,.actionbar .bsk{flex:1 1 auto}
    .cd-cta,.dw-cta-b,.mt-btn{min-height:44px;display:inline-flex;align-items:center;justify-content:center}
    .actions{flex-wrap:wrap}
    .actions .btn-primary{width:100%;min-height:48px;padding:12px 24px}
    /* Tables become card lists on the list-heavy views. */
    .mcl{display:flex;flex-direction:column;gap:8px}
    .tbl-desk{display:none}
    .bulkbar{display:none} /* bulk allocation is a desktop tool */
    /* Decision pages: Approve/Skip stay reachable without scrolling past the
       gallery. */
    .ld-actions{position:fixed;left:0;right:0;bottom:0;z-index:140;margin:0;background:var(--bg-2);border-top:1px solid var(--hair);padding:12px 16px calc(12px + env(safe-area-inset-bottom));display:flex;gap:8px}
    .ld-actions form{flex:1;display:flex}
    .ld-actions form button{width:100%;min-height:46px}
    .ld-grid{padding-bottom:96px}
    .plv-picker{position:fixed;left:0;right:0;bottom:0;z-index:140;margin:0;background:var(--bg-2);border-top:1px solid var(--hair);padding:12px 16px calc(12px + env(safe-area-inset-bottom));display:flex;gap:8px}
    .plv-picker select{flex:1;min-width:0}
    .plv-grid{padding-bottom:110px}
  }
  /* Matches review (v2) */
  .mtools{position:sticky;top:0;z-index:5;background:var(--bg);padding:4px 0 12px;margin-bottom:8px;border-bottom:1px solid var(--hair)}
  .triage{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px}
  .tstat{background:var(--card);border:1px solid var(--hair);border-radius:var(--r-card);padding:12px 16px;min-width:96px}
  .tstat .k{font-size:var(--fs-label);font-weight:var(--w-label);letter-spacing:var(--ls-label);text-transform:uppercase;color:var(--t3);display:flex;align-items:center;gap:8px}
  .tstat .v{font-size:20px;font-weight:700;letter-spacing:var(--ls-num);font-variant-numeric:tabular-nums;margin-top:4px}
  .tstat .v.money{color:var(--gold-txt)}
  .tstat .d{width:8px;height:8px;border-radius:9999px;display:inline-block}
  .tstat.urgent{border-color:var(--bad-line);background:var(--bad-bg)}
  .tstat.urgent .v{color:var(--bad)}
  .crow{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
  .msearch{position:relative;flex:1;min-width:200px;display:block;margin:0}
  .msearch input{width:100%;padding:8px 12px;border:1px solid var(--field-line);border-radius:var(--r-ctl);font-size:var(--fs-sec);background:var(--field);font-family:inherit;color:var(--ink)}
  .msearch input:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 3px var(--gold-tint)}
  select.mctl{width:auto;padding:8px 28px 8px 12px;border:1px solid var(--field-line);border-radius:var(--r-ctl);font-size:var(--fs-sec);background:var(--field);color:var(--t2);cursor:pointer;font-family:inherit}
  /* Mobile: the filter selects used to each go full-width, stacking into ~5 tall
     rows and eating ~40% of the viewport before any cars showed. Sit them 2-up
     and keep the strength chips on one horizontally-scrollable row instead. */
  @media(max-width:640px){
    .crow{gap:8px}
    select.mctl{flex:1 1 calc(50% - 4px);min-width:0;width:auto}
    /* Scoped to .mtools so this outranks the later base .fchips{flex-wrap:wrap}
       (equal specificity let the base win and the chips stacked three rows
       deep on phones instead of scrolling on one). */
    .mtools .fchips{flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px;scrollbar-width:none;min-width:0;flex-basis:100%}
    .mtools .fchips::-webkit-scrollbar{display:none}
    .mtools .fchips .fchip,.mtools .fchips .quick{flex:0 0 auto}
    .mtools{padding-bottom:8px}
  }
  /* Mobile QA pass: wide data tables scroll (not clip) on phones; match cards'
     multi-select checkbox works on touch (no hover); the match bulk bar and the
     client-detail header wrap instead of overflowing on small screens. */
  @media(max-width:640px){.sortable{min-width:560px}}
  @media(max-width:920px){.scard .msel{opacity:1;width:24px;height:24px}}
  @media(max-width:560px){.bulkbar2{flex-wrap:wrap;gap:8px}.bulkbar2 .bsp{display:none}.bulkbar2 .bap,.bulkbar2 .bsk,.bulkbar2 .bdel{flex:1 1 auto}}
  @media(max-width:560px){.cd-head{flex-wrap:wrap}.cd-owner{text-align:left;flex-basis:100%;margin-top:8px}}
  .fchips{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  .fchip{border:1px solid var(--field-line);background:var(--field);color:var(--t2);font-size:var(--fs-label);font-weight:600;padding:8px 12px;border-radius:9999px;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:8px}
  .fchip .sd{width:8px;height:8px;border-radius:9999px;display:inline-block}
  .fchip.on{background:var(--ink);color:var(--bg-2);border-color:var(--ink)}
  .fchip.on.urgent{background:var(--bad-bg);border-color:var(--bad-line);color:var(--bad)}
  .quick{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap}
  .quick button{font-family:inherit;font-size:var(--fs-label);font-weight:600;color:var(--t2);background:var(--card);border:1px solid var(--hair);border-radius:9999px;padding:8px 12px;cursor:pointer}
  .quick button:hover{color:var(--ink);border-color:var(--field-line)}
  .pausebar{display:flex;align-items:center;gap:8px;margin-bottom:16px;padding:12px 16px;background:var(--bad-bg);border:1px solid var(--bad-line);border-left:3px solid var(--bad);border-radius:var(--r-ctl);font-size:var(--fs-sec);color:var(--t2)}
  .bulkbar2{position:sticky;top:60px;z-index:6;display:none;align-items:center;gap:12px;background:var(--card-2);color:var(--on-solid);border:1px solid var(--gold-line);border-radius:var(--r-card);padding:8px 16px;margin:0 0 16px}
  .bulkbar2.show{display:flex}
  .bulkbar2 .bc{font-weight:600;font-size:var(--fs-sec)}.bulkbar2 .bsp{flex:1}
  .bulkbar2 button{font-family:inherit;font-weight:600;font-size:var(--fs-sec);border-radius:var(--r-ctl);padding:8px 16px;cursor:pointer;border:0}
  .bulkbar2 .bap{background:var(--gold);color:var(--gold-on)}
  .bulkbar2 .bsk{background:transparent;color:var(--on-solid);border:1px solid rgba(255,255,255,.3)}
  .bulkbar2 .bdel{background:transparent;color:#ff9a9a;border:1px solid rgba(255,120,120,.4)}
  .bulkbar2 .bdel:hover{background:rgba(177,18,38,.25);color:var(--on-solid);border-color:rgba(255,120,120,.7)}
  .bulkbar2 .bcl{background:transparent;color:#cfd0d2;border:0;font-size:var(--fs-label)}
  .ghead{display:flex;align-items:center;gap:8px;grid-column:1/-1;padding:8px 2px 2px;border-bottom:1px solid var(--hair);margin-top:8px}
  .ghead .gh-n{font-size:var(--fs-sec);font-weight:600}
  .ghead .gh-sel{margin-left:auto;font-size:var(--fs-label);font-weight:600;color:var(--t2);background:var(--card);border:1px solid var(--hair);border-radius:var(--r-ctl);padding:4px 8px;cursor:pointer;font-family:inherit}
  .mgrid .mcard{position:relative}
  .mcard .msel{position:absolute;top:10px;left:10px;z-index:4;width:21px;height:21px;accent-color:var(--gold);cursor:pointer;display:none}
  .mcard:hover .msel,.mcard.picked .msel{display:block}
  .mcard:hover .pill.lot,.mcard.picked .pill.lot{opacity:0}
  .mcard.picked{border-color:var(--gold);box-shadow:0 0 0 2px var(--gold-tint)}
  .specline{padding:2px 16px 0;font-size:var(--fs-label);color:var(--t3);display:flex;gap:8px;flex-wrap:wrap}
  .specline b{color:var(--t2);font-weight:600}
  .why{padding:8px 16px 0;display:flex;gap:8px;flex-wrap:wrap}
  .why .wc{font-size:var(--fs-label);font-weight:600;color:var(--t2);background:var(--soft);border:1px solid var(--hair);border-radius:9999px;padding:4px 8px}
  .why .wc.lead{color:var(--info);background:var(--info-bg);border-color:transparent}
  /* Urgency register (measured, Stripe "Blocked"): pale tint, saturated dark
     text. Solid traffic-light fills with white text are off register. */
  .urg{display:inline-flex;align-items:center;gap:4px;background:var(--bad-bg);color:var(--bad);font-size:var(--fs-label);font-weight:600;padding:2px 8px;border-radius:9999px;margin-right:6px}
  .urg.soon{background:var(--warn-bg);color:var(--warn-fg)}
  .nocontact{margin:8px 16px 0;padding:8px 12px;background:var(--warn-bg);border:1px solid transparent;border-radius:var(--r-ctl);font-size:var(--fs-label);color:var(--warn-fg);font-weight:600}
  .mempty{color:var(--faint);padding:40px 0;text-align:center;grid-column:1/-1}
  .clink{color:var(--ink);font-weight:500;border-bottom:1px solid transparent}
  .clink:hover{border-bottom-color:var(--gold)}
  /* Identity cell (Attio register): name on top, one muted 12px meta line
     under it, so a record needs one column instead of three. */
  .idcell{display:inline-flex;flex-direction:column;vertical-align:middle;min-width:0}
  .idcell .clink{align-self:flex-start}
  .idsub{font-size:var(--fs-label);color:var(--t3);line-height:1.4}
  /* Money / numeric cell (Stripe register): right-aligned semibold tabular. */
  td.tnum{text-align:right;font-variant-numeric:tabular-nums;font-weight:var(--w-value);color:var(--ink);white-space:nowrap}
  .cd-head{display:flex;align-items:center;gap:16px}
  .cd-owner{text-align:right}
  .cd-owner .k{font-size:var(--fs-label);font-weight:var(--w-label);letter-spacing:var(--ls-label);text-transform:uppercase;color:var(--faint)}
  .cd-owner .v{font-size:var(--fs-sec);font-weight:600;color:var(--ink);margin-top:4px}
  .wlrow{border:1px solid var(--hair);border-radius:var(--r-card);margin-bottom:12px;overflow:hidden}
  .wlhead{display:flex;align-items:center;gap:12px;padding:16px}
  .wlsum{flex:1;min-width:0}
  .wlsum .wln{font-size:var(--fs-sec);font-weight:600}
  .wlsum .wlc{font-size:var(--fs-label);color:var(--t3);margin-top:2px}
  .wlreq{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px}
  .wlreq-k{font-size:var(--fs-label);color:var(--t3);font-weight:500}
  .wlreq-btn{font-size:var(--fs-label);padding:4px 10px}
  .wlreq-na{font-size:var(--fs-label);color:var(--warn-c);font-weight:600}
  .wlacts{display:flex;align-items:center;gap:8px}
  /* Same wrap the portal shell already applies: with the quick Edit button a
     search row carries four actions, which must drop to a second line instead
     of squeezing the summary (375px rule). */
  @media(max-width:640px){.wlhead{flex-wrap:wrap}.wlacts{flex-wrap:wrap}}
  .wledit{border-top:1px solid var(--hair);background:var(--off)}
  .wledit summary{cursor:pointer;padding:12px 16px;font-size:var(--fs-sec);font-weight:600;color:var(--gold-txt);list-style:none}
  .wledit summary::-webkit-details-marker{display:none}
  .wledit summary:hover{background:var(--hover)}
  .wledit form{padding:4px 16px 16px}
  .slegend{background:var(--card);border:1px solid var(--hair);border-radius:var(--r-card);padding:12px 16px;margin-bottom:16px}
  .sl-row{display:flex;align-items:center;gap:16px;flex-wrap:wrap;font-size:var(--fs-label);color:var(--t2)}
  .sl-t{font-size:var(--fs-label);font-weight:var(--w-label);letter-spacing:var(--ls-label);text-transform:uppercase;color:var(--faint)}
  .sl-item{display:inline-flex;align-items:center;gap:8px}
  .sl-item b{font-weight:600;color:var(--ink)}
  .sl-dot{width:9px;height:9px;border-radius:9999px;display:inline-block}
  .sl-more{margin-top:8px}
  .sl-more summary{cursor:pointer;color:var(--gold-txt);font-weight:600;font-size:var(--fs-label);list-style:none}
  .sl-more summary::-webkit-details-marker{display:none}
  .sl-detail{margin-top:8px;color:var(--t3);line-height:1.5;font-size:var(--fs-label);max-width:720px}
  /* --- Shared design system: dashboard + reusable components --- */
  .avatar.lg{width:38px;height:38px;font-size:13px;margin-right:0}
  .nav a svg{width:18px;height:18px;flex:0 0 auto;color:var(--t3)}
  .nav a:hover:not(.active) svg{color:var(--ink)}
  .nav a.active svg{color:var(--gold)}
  .dtop{display:flex;justify-content:flex-end;align-items:center;gap:16px;margin-bottom:16px}
  .dtop a{color:var(--t3);display:inline-flex}
  .dtop a:hover{color:var(--ink)}
  .dtop svg{width:20px;height:20px}
  .dkick{display:flex;align-items:center;gap:8px;color:var(--t2);font-size:var(--fs-label);margin-bottom:12px}
  .dkick .live{width:8px;height:8px;border-radius:9999px;background:var(--good);animation:livepulse 1.8s ease-in-out infinite}
  @keyframes livepulse{0%,100%{opacity:1}50%{opacity:.4}}
  /* Deliberate hero exception to the type scale (see DESIGN-AUDIT.md deferrals). */
  .greet{font-size:42px;font-weight:700;letter-spacing:-.02em;line-height:1.08;margin:0 0 24px;color:var(--ink)}
  .greet .nm{color:var(--gold-txt)}
  .ovwrap{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
  .ovwrap .ovlbl{font-size:var(--fs-sec);color:var(--t2)}
  .ovwrap a{display:inline-flex;align-items:center;gap:4px;font-size:var(--fs-sec);color:var(--t2);font-weight:600}
  .ovwrap a:hover{color:var(--ink)}
  .ovwrap a svg{width:14px;height:14px}
  .overview{display:flex;flex-wrap:wrap;margin:0 0 var(--sp-6)}
  .ov{padding:0 24px;border-left:1px solid var(--hair)}
  .ov:first-child{padding-left:0;border-left:0}
  .ov .num{font-size:var(--fs-page);font-weight:700;letter-spacing:-.02em;line-height:1;color:var(--ink);font-variant-numeric:tabular-nums}
  .ov.gold .num{color:var(--ink)}
  .ov .cap{font-size:var(--fs-sec);color:var(--t2);margin-top:8px}
  .acards{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin:0 0 var(--sp-6)}
  .acard{background:var(--card);border:1px solid var(--hair);border-radius:var(--r-card);overflow:hidden}
  .acard .ah{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--off);color:var(--t2);font-weight:600;font-size:var(--fs-sec)}
  .acard .ah svg{width:18px;height:18px}
  .acard .ab{padding:16px;font-size:var(--fs-sec);color:var(--t2);line-height:1.5}
  .acard .ab .big{font-weight:700;font-size:20px;color:var(--ink);font-variant-numeric:tabular-nums}
  .acard .ab .link{display:inline-flex;align-items:center;gap:4px;margin-top:12px;color:var(--gold-txt);font-weight:600;font-size:var(--fs-sec)}
  .acard .ab .link svg{width:14px;height:14px}
  .charts{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin:0 0 var(--sp-6)}
  @media(max-width:620px){.charts{grid-template-columns:1fr}}
  .chart-card{background:var(--card);border:1px solid var(--hair);border-radius:var(--r-card);padding:var(--pad-card)}
  .chart-h{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:16px}
  .chart-h .ct-t{font-size:var(--fs-sec);font-weight:600;color:var(--t2)}
  .chart-h .ct-s{font-size:var(--fs-label);color:var(--faint);font-variant-numeric:tabular-nums}
  .bars-x{display:flex;justify-content:space-between;margin-top:8px;font-size:var(--fs-label);color:var(--faint)}
  .donutwrap{display:flex;align-items:center;gap:24px}
  .donut{position:relative;width:120px;height:120px;flex:0 0 auto}
  .donut-mid{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .donut-mid .dm-n{font-size:var(--fs-page);font-weight:700;color:var(--ink);line-height:1;font-variant-numeric:tabular-nums}
  .donut-mid .dm-k{font-size:var(--fs-label);font-weight:var(--w-label);letter-spacing:var(--ls-label);text-transform:uppercase;color:var(--faint);margin-top:4px}
  .legend{display:flex;flex-direction:column;gap:8px;flex:1;min-width:0}
  .legend .lg{display:flex;align-items:center;gap:8px;font-size:var(--fs-sec)}
  .legend .lg-d{width:9px;height:9px;border-radius:50%;flex:0 0 auto}
  .legend .lg-l{color:var(--t2);flex:1}
  .legend .lg-v{color:var(--ink);font-weight:700;font-variant-numeric:tabular-nums}
  .abars{display:flex;flex-direction:column;gap:12px}
  .abar{display:flex;align-items:center;gap:8px;font-size:var(--fs-sec)}
  .abar-n{width:80px;color:var(--t2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:0 0 auto}
  .abar-t{flex:1;height:8px;background:var(--hair);border-radius:9999px;overflow:hidden}
  .abar-f{display:block;height:100%;background:var(--gold);border-radius:9999px}
  .abar-v{width:26px;text-align:right;color:var(--ink);font-weight:700;font-variant-numeric:tabular-nums;flex:0 0 auto}
  a.ov-link{text-decoration:none;color:inherit;cursor:pointer}
  a.ov-link:hover .num{text-decoration:underline;text-decoration-color:var(--gold);text-underline-offset:4px}
  a.ov-link:hover .cap{color:var(--ink)}
  .sec-h{display:flex;align-items:center;justify-content:space-between;margin:0 0 12px}
  .sec-h h2{font-size:var(--fs-sect);font-weight:600;letter-spacing:var(--ls-title);margin:0}
  .sec-h h2 .ct{color:var(--faint);font-weight:400}
  .sec-h .btn-primary{display:inline-flex;align-items:center;gap:8px}
  .sec-h .btn-primary svg{width:15px;height:15px}
  .dcols{display:grid;grid-template-columns:1fr;gap:8px 24px;align-items:start}
  @media(min-width:1100px){.dcols{grid-template-columns:1fr 1fr}}
  /* Card-list row: the ONE list row used by every dashboard and detail list. */
  .list{background:var(--card);border:1px solid var(--hair);border-radius:var(--r-card);overflow:hidden;margin-bottom:var(--sp-6)}
  a.lrow{text-decoration:none;color:inherit}
  .lrow{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--hair)}
  .lrow:last-child{border-bottom:0}
  .lrow:hover{background:var(--hover)}
  .lrow .avatar{margin-right:0;width:38px;height:38px;font-size:var(--fs-sec);flex:0 0 auto}
  .lrow .who{flex:1;min-width:0}
  .lrow .who .nm{font-weight:500;color:var(--ink);font-size:var(--fs-sec)}
  .lrow .who .nm small{color:var(--faint);font-weight:400}
  .lrow .who .sub{font-size:var(--fs-label);color:var(--t3);margin-top:2px;line-height:var(--lh-list);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .lrow .meta{margin-left:auto;display:flex;align-items:center;gap:8px;flex:0 0 auto}
  .b{display:inline-flex;align-items:center;gap:4px;font-size:var(--fs-label);font-weight:500;padding:4px 8px;border-radius:9999px;white-space:nowrap}
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
  .kebab{width:32px;height:32px;border-radius:var(--r-ctl);border:1px solid transparent;background:transparent;color:var(--faint);cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
  .kebab svg{width:18px;height:18px}
  .kebab:hover{background:var(--hover);color:var(--ink)}
  /* One-line greeting on phones: the two-line 30px greet spent ~90px of the
     first screen on a pleasantry before any operational data. */
  @media(max-width:640px){.greet{font-size:24px;margin-bottom:16px}.greet br{display:none}.greet .nm::before{content:" "}.overview{display:grid;grid-template-columns:repeat(3,1fr);gap:16px 0}.ov{padding:0 12px 0 0;border-left:0}.ov .num{font-size:20px}.ov .cap{margin-top:4px}}
  /* Motion: hover lift + button press, compositor-friendly transforms only. */
  .acard,.chart-card{transition:transform .16s ease,border-color .15s}
  .acard:hover,.chart-card:hover{transform:translateY(-2px)}
  .btn-primary:active,.btn-secondary:active,.bap:active,.bsk:active,.sc-actions a:active{transform:translateY(1px) scale(.99)}
  @media(prefers-reduced-motion:reduce){*{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}}
  /* --- Matches: Linear-register queue. Measured targets in ADMIN-REDESIGN.md:
     dense hairline rows inside one panel, quiet 13px type, colour only for
     urgency and strength, one gold action per row. --- */
  .mticker{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:var(--hair);border:1px solid var(--hair);border-radius:var(--r-card);overflow:hidden;margin-bottom:16px}
  @media(min-width:760px){.mticker{grid-template-columns:repeat(5,1fr)}}
  .mtk{background:var(--card);padding:16px}
  .mtk.urgent{background:var(--bad-bg)}
  .mtk-k{font-size:var(--fs-label);font-weight:var(--w-label);letter-spacing:var(--ls-label);text-transform:uppercase;color:var(--t3)}
  .mtk-row{display:flex;align-items:flex-end;justify-content:space-between;margin-top:12px}
  .mtk-n{font-size:20px;font-weight:700;letter-spacing:var(--ls-num);line-height:1;color:var(--ink);font-variant-numeric:tabular-nums}
  .mtk-n.str{color:var(--str-fg)}.mtk-n.bad{color:var(--bad)}
  .mtk-dot{width:8px;height:8px;border-radius:9999px;display:inline-block;margin-bottom:4px}
  .scards{display:flex;flex-direction:column;background:var(--card);border:1px solid var(--hair);border-radius:var(--r-card);overflow:hidden}
  .scard{position:relative;display:flex;flex-direction:row;align-items:center;gap:var(--sp-4);background:transparent;border:0;border-top:1px solid var(--hair-2);border-radius:0;padding:var(--sp-3) var(--sp-4);overflow:visible;transition:background .12s;content-visibility:auto;contain-intrinsic-size:auto 112px}
  .scard:first-child{border-top:0}
  .scard:hover{background:var(--hover)}
  .scard.picked{background:var(--gold-tint)}
  .scard .msel{position:static;width:16px;height:16px;margin:0;accent-color:var(--gold);cursor:pointer;flex:0 0 auto;opacity:0;transition:opacity .12s;display:block}
  .scard:hover .msel,.scard.picked .msel,.scard .msel:focus-visible,.scard .msel:checked{opacity:1}
  .sc-img{position:relative;flex:0 0 auto;width:148px;height:84px;border-radius:var(--r-ctl);background-color:var(--media);background-size:cover;background-position:center;overflow:hidden}
  a.sc-img{cursor:pointer}
  .sc-body{flex:1;min-width:0;display:flex;align-items:center;gap:var(--sp-4)}
  .sc-main{flex:1;min-width:0}
  .sc-head{display:flex;align-items:baseline;justify-content:space-between;gap:var(--sp-3)}
  .sc-title{font-size:var(--fs-body);font-weight:var(--w-value);letter-spacing:var(--ls-title);margin:0;color:var(--ink);line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
  .sc-title a{color:inherit;text-decoration:none}
  .sc-title a:hover{text-decoration:underline;text-decoration-color:var(--gold);text-underline-offset:2px}
  .sc-landed{flex:0 0 auto;display:flex;align-items:baseline;gap:var(--sp-2)}
  .sc-landed-k{font-size:var(--fs-label);font-weight:var(--w-label);letter-spacing:var(--ls-label);text-transform:uppercase;color:var(--t3)}
  .sc-landed-v{font-size:var(--fs-body);font-weight:var(--w-value);color:var(--gold-txt);letter-spacing:var(--ls-num);font-variant-numeric:tabular-nums}
  .sc-sub{font-size:var(--fs-sec);color:var(--t3);margin:var(--sp-1) 0 0;line-height:var(--lh-list);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sc-meta{display:flex;align-items:center;gap:var(--sp-2) var(--sp-3);margin-top:var(--sp-2);flex-wrap:wrap;font-size:var(--fs-label);color:var(--t3);line-height:1.4}
  .sc-close{font-weight:500}
  .sc-close.urgent{color:var(--bad);font-weight:600}
  .sc-close.soon{color:var(--warn-c);font-weight:600}
  .sc-src{color:var(--faint)}
  .sc-for a{color:var(--ink);font-weight:500;border-bottom:1px solid transparent}
  .sc-for a:hover{border-bottom-color:var(--gold)}
  .scard .nocontact{margin:var(--sp-2) 0 0;padding:var(--sp-1) var(--sp-2)}
  .sc-actions{display:flex;gap:var(--sp-2);border:0;flex:0 0 auto}
  .sc-actions a{display:inline-flex;align-items:center;justify-content:center;padding:var(--sp-2) var(--sp-3);font-size:var(--fs-sec);font-weight:600;line-height:1;border-radius:var(--r-ctl);white-space:nowrap;text-decoration:none}
  .sc-actions .btn-tertiary{color:var(--t2);background:transparent;border:1px solid var(--field-line)}
  .sc-actions .btn-tertiary:hover{background:var(--hover);color:var(--ink)}
  .sc-actions .btn-primary{color:var(--gold-on);background:var(--gold);border:1px solid transparent}
  .sc-actions .btn-primary:hover{background:var(--gold-hover)}
  /* Snooze: the quiet third action. The summary reads like a text button; the
     open state reveals the two deferral options inline. */
  .sc-snz{display:inline-flex;align-items:center}
  .sc-snz summary{list-style:none;cursor:pointer;color:var(--t3);font-size:var(--fs-sec);font-weight:600;padding:var(--sp-2) var(--sp-2);border-radius:var(--r-ctl)}
  .sc-snz summary::-webkit-details-marker{display:none}
  .sc-snz summary:hover{color:var(--ink);background:var(--hover)}
  .sc-snz[open] summary{color:var(--ink)}
  .sc-snz-menu{display:inline-flex;gap:var(--sp-1);flex-wrap:wrap}
  .sc-snz-opt{font-family:inherit;font-size:var(--fs-label);font-weight:600;color:var(--t2);background:var(--off);border:1px solid var(--hair);border-radius:9999px;padding:6px 10px;cursor:pointer;white-space:nowrap}
  .sc-snz-opt:hover{background:var(--hover);color:var(--ink)}
  .sc-snz-until{font-size:var(--fs-label);color:var(--t3);align-self:center;white-space:nowrap}
  /* Client-page 3-up grid (.mgrid) keeps the stacked card shape. */
  .mgrid .scard{flex-direction:column;align-items:stretch;gap:0;background:var(--card);border:1px solid var(--hair);border-radius:var(--r-card);padding:0;contain-intrinsic-size:auto 300px}
  .mgrid .scard .msel{position:absolute;top:12px;right:12px;width:20px;height:20px}
  .mgrid .scard .sc-img{width:auto;height:160px;border-radius:0}
  .mgrid .scard .sc-body{flex-direction:column;align-items:stretch;gap:var(--sp-3);padding:var(--sp-4)}
  .mgrid .scard .sc-actions a{flex:1}
  @media(max-width:700px){
    /* Queue rows only: on a stacked .mgrid card (flex COLUMN) a wrapping
       container lays lines out horizontally, each line as wide as its
       content, which blew the card out past the viewport. */
    .scards .scard{gap:var(--sp-3);flex-wrap:wrap}
    .sc-img{width:104px;height:72px}
    /* Queue rows only: flatten the body so the thumb and text share the first
       line and the actions drop to a full-width 44px line below (the two
       buttons cannot fit beside a 104px thumb at 375px). The client-page
       .mgrid cards keep their stacked sc-body. */
    .scards .sc-body{display:contents}
    .scards .sc-main{flex:1;min-width:0}
    .scards .sc-actions{flex-basis:100%}
    .sc-actions a{flex:1;min-height:44px}
    .sc-head{flex-wrap:wrap}
    .sc-title{white-space:normal}
  }
  .ld-ai{font-size:var(--fs-label);font-weight:700;letter-spacing:.04em;color:var(--t3);background:var(--soft);border:1px solid var(--hair);border-radius:9999px;padding:1px 4px;margin-left:6px;vertical-align:middle}
  .ld-grid{display:grid;grid-template-columns:1fr;gap:var(--gap-grid)}
  @media(min-width:920px){.ld-grid{grid-template-columns:minmax(0,1fr) minmax(340px,420px);align-items:start}}
  .ld-left{min-width:0}
  .ld-gallery{margin-bottom:var(--sp-5)}
  .ld-hero{height:420px;border-radius:var(--r-card);background:var(--media);background-size:cover;background-position:center;border:1px solid var(--hair)}
  .ld-hero.ld-noimg{display:flex;align-items:center;justify-content:center;color:var(--faint);font-size:var(--fs-sec);background:var(--off)}
  .ld-thumbs{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
  .ld-th{width:88px;height:62px;border-radius:var(--r-ctl);border:2px solid transparent;background:var(--media);background-size:cover;background-position:center;cursor:pointer;padding:0;opacity:.65;transition:opacity .15s,border-color .15s}
  .ld-th:hover{opacity:1}
  .ld-th.on{opacity:1;border-color:var(--gold)}
  .ld-right{position:sticky;top:84px}
  @media(max-width:920px){.ld-right{position:static}.ld-hero{height:280px}}
  .ld-top{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px}
  .ld-grade-n{font-size:var(--fs-page);font-weight:700;color:var(--ink);line-height:1;font-variant-numeric:tabular-nums}
  .ld-grade-k{font-size:var(--fs-label);font-weight:var(--w-label);letter-spacing:var(--ls-label);text-transform:uppercase;color:var(--faint);margin-top:4px}
  .ld-landed{text-align:right}
  .ld-landed-k{font-size:var(--fs-label);font-weight:var(--w-label);letter-spacing:var(--ls-label);text-transform:uppercase;color:var(--faint)}
  .ld-landed-v{font-size:20px;font-weight:700;color:var(--gold-txt);font-variant-numeric:tabular-nums;margin-top:2px}
  .ld-when-row{margin-bottom:16px}
  .ld-when{font-size:var(--fs-label);font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--warn-fg);background:var(--warn-bg);border:1px solid transparent;padding:4px 8px;border-radius:var(--r-ctl)}
  .ld-when.urgent{color:var(--bad);background:var(--bad-bg);border-color:var(--bad-line)}
  .ld-rows{display:flex;flex-direction:column}
  .ld-row{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--hair-2);font-size:var(--fs-sec)}
  .ld-row:last-child{border-bottom:0}
  .ld-k{color:var(--t3)}
  .ld-v{color:var(--ink);font-weight:600;text-align:right}
  .ld-sec{font-size:var(--fs-label);font-weight:var(--w-label);letter-spacing:var(--ls-label);text-transform:uppercase;color:var(--faint);margin:16px 0 4px}
  .ld-client{display:flex;align-items:center;gap:12px;padding:16px 0;margin-top:8px;border-top:1px solid var(--hair)}
  .ld-cl-n{font-size:var(--fs-sec);font-weight:600;color:var(--ink)}
  .ld-cl-b{font-size:var(--fs-label);color:var(--t2);margin-top:4px}
  .ld-cl-b.over{color:var(--bad);font-weight:600}
  .ld-cl-w{font-size:var(--fs-label);color:var(--t3);margin-top:1px}
  .ld-actions{display:flex;gap:8px;margin:16px 0 var(--sp-4)}
  .ld-actions .btn-tertiary{flex:1;display:flex;align-items:center;justify-content:center;border:1px solid var(--hair);border-radius:var(--r-ctl);color:var(--t2);font-weight:600;padding:12px}
  .ld-actions .btn-tertiary:hover{background:var(--hover);color:var(--ink)}
  .ld-actions .btn-primary{flex:2;display:flex;align-items:center;justify-content:center;background:var(--gold);color:var(--gold-on);font-weight:700;border-radius:var(--r-ctl);padding:12px}
  .ld-actions .btn-primary:hover{background:var(--gold-hover)}
  .ld-status{margin-top:16px;padding:12px;background:var(--off);border:1px solid var(--hair);border-radius:var(--r-ctl);font-size:var(--fs-sec);color:var(--t2);text-align:center}
  .ld-similar{display:flex;justify-content:center;margin-top:12px;white-space:normal;text-align:center}
  .ld-notes{font-size:var(--fs-sec);color:var(--t2);line-height:1.6;margin:0 0 8px}
  .ld-ai-read{background:var(--off);border:1px solid var(--hair);border-radius:var(--r-card);padding:16px;margin:0 0 16px}
  .ld-ai-head{font-size:var(--fs-label);font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--t3);margin-bottom:8px}
  .ld-ai-read .ld-notes:last-child{margin-bottom:0}
  .ld-ai-form{margin-top:16px}
  .ld-ai-form button:disabled{opacity:.7;cursor:default}
  .ld-feed{margin:0 0 var(--sp-5);font-size:var(--fs-sec)}
  .ld-feed summary{cursor:pointer;color:var(--t3);font-weight:600;list-style:none;padding:8px 0}
  .ld-feed summary::-webkit-details-marker{display:none}
  .ld-feed summary:hover{color:var(--ink)}
  .ld-raw{white-space:pre-wrap;word-break:break-all;font-size:var(--fs-label);line-height:1.5;color:var(--t2);background:var(--off);border:1px solid var(--hair);border-radius:var(--r-ctl);padding:12px 16px;margin:0;font-family:var(--mono,ui-monospace,Menlo,Consolas,monospace)}
  .ld-sheet h2{margin-bottom:16px}
  .ld-sheet-link{position:relative;display:block;border-radius:var(--r-card);overflow:hidden;border:1px solid var(--hair);background:var(--off);line-height:0;aspect-ratio:3/2}
  .ld-sheet-img{display:block;width:100%;height:100%;object-fit:contain}
  .ld-sheet-open{position:absolute;top:8px;right:8px;background:rgba(20,20,22,.72);color:var(--on-solid);font-size:var(--fs-label);font-weight:600;padding:4px 8px;border-radius:var(--r-ctl);letter-spacing:.02em;line-height:1}
  .ld-sheet-link:hover .ld-sheet-open{background:rgba(20,20,22,.92)}
  .ld-topbtns{display:flex;gap:8px;align-items:center}
  .ld-share{position:relative}
  .ld-share>summary{list-style:none;cursor:pointer;display:inline-flex}
  .ld-share>summary::-webkit-details-marker{display:none}
  .ld-share-pop{position:absolute;right:0;top:calc(100% + 8px);z-index:30;width:300px;background:var(--card);border:1px solid var(--hair);border-radius:var(--r-card);padding:16px;box-shadow:0 18px 50px rgba(0,0,0,.18);text-align:left}
  .ld-share-h{font-weight:700;font-size:var(--fs-sec);color:var(--ink)}
  .ld-share-p{font-size:var(--fs-label);color:var(--t3);margin:4px 0 12px;line-height:1.5}
  .ld-share-row{display:flex;gap:8px;margin-bottom:8px}
  .ld-share-row input{flex:1;min-width:0;font-size:var(--fs-label);padding:8px;border:1px solid var(--field-line);border-radius:var(--r-ctl);background:var(--field);color:var(--ink)}
  .ld-share-row .btn-secondary{padding:8px 12px;font-size:var(--fs-sec)}
  .ld-share-wa{display:block;text-align:center;width:100%}
  .ld-share-form{display:flex;flex-direction:column;gap:6px;margin-top:12px;padding-top:12px;border-top:1px solid var(--hair)}
  .ld-share-form label{font-size:var(--fs-label);font-weight:600;color:var(--t3)}
  .ld-share-form label .opt{font-weight:400}
  .ld-share-form input,.ld-share-form textarea{font-size:var(--fs-label);padding:8px;border:1px solid var(--field-line);border-radius:var(--r-ctl);background:var(--field);color:var(--ink);font-family:inherit;resize:vertical}
  .ld-share-form .btn-primary{margin-top:4px}
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
  matches: svgIcon(`<path d="M4 13h4l2 3h4l2-3h4"/><path d="M5 13l1.6-7a2 2 0 0 1 2-1.6h6.8a2 2 0 0 1 2 1.6L19 13v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z"/>`),
  auctions: svgIcon(`<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>`),
  "auction-history": svgIcon(`<path d="M12.6 3H20v7.4L11.4 19a2 2 0 0 1-2.8 0L4 14.4a2 2 0 0 1 0-2.8Z"/><circle cx="15.5" cy="7.5" r="1.5"/>`),
  trash: svgIcon(`<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/>`),
  agents: svgIcon(`<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7"/><path d="M3 12h18"/>`),
  dealers: svgIcon(`<path d="M3 9h18l-2-5H5L3 9Z"/><path d="M5 9v11h14V9M9 20v-6h6v6"/>`),
  "dealer-submissions": svgIcon(`<path d="M4 5h16v15H4z"/><path d="M8 3h8v4H8zM8 11h8M8 15h5"/>`),
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
  // Tasks folded into the Dashboard and Agents under Settings > Team: both
  // views stay routable, so highlight the nav item they now live under.
  if (active === "tasks") active = "dashboard";
  if (active === "agents") active = "settings";
  const item = (id, label, count, href = `/admin?view=${id}`) =>
    `<a class="${active === id ? "active" : ""}" href="${esc(href)}">
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
      ${item("matches", "Matches", counts.matches || "")}
      ${item("clients", "Customers", counts.clients)}
      ${item("auctions", "Auctions", "")}
      ${item("auction-history", "Auction history", "", "/admin?view=auctions&tab=history")}
      ${isAdmin && counts.dealersOn ? item("dealers", "Dealers", counts.dealers || "") : ""}
      ${isAdmin && counts.dealersOn ? item("dealer-submissions", "Dealer stock", counts.dealerSubmissions || "") : ""}
      ${isAdmin ? item("payments", "Payments", counts.payments || "") : ""}
      ${isAdmin ? item("settings", "Settings", "") : ""}
    </nav>
    <div class="side-foot">
      <form method="POST" action="/run" data-confirm="Run the auction search for every active customer search now? New matches on auto-notify searches are emailed or WhatsApped to clients immediately."><button type="submit" class="btn-primary run-btn"><span class="dot"></span>Run Searches</button></form>
      <div class="whoami"><span class="who-name">${whoLabel}</span><span class="who-role">${whoSub}</span></div>
      <a class="signout" href="/logout">Sign out</a>
    </div>
  </aside>`;
}

const HEADERS = {
  dashboard: { kicker: "Vehicle Finder", title: "Dashboard", sub: "Your desk at a glance.", btn: "" },
  intake: { kicker: "Vehicle Finder", title: "New request", sub: "Log a customer and the car they want in one step.", btn: "" },
  clients: { kicker: "Vehicle Finder", title: "Customers", sub: "The relationship list: contact, portal access and billing. Open anyone to see all their requests.", btn: "New request" },
  requests: { kicker: "Vehicle Finder", title: "Requests", sub: "The pipeline worklist: every active search, grouped by customer.", btn: "New request" },
  tasks: { kicker: "Vehicle Finder", title: "Tasks", sub: "What needs doing today, and what's overdue.", btn: "" },
  matches: { kicker: "Vehicle Finder", title: "Matches", sub: "Auction lots matched to your clients' searches.", btn: "New auction search" },
  auctions: { kicker: "Vehicle Finder", title: "Auctions", sub: "Search live lots and look up sold-price history.", btn: "" },
  agents: { kicker: "Vehicle Finder", title: "Agents", sub: "Logins that find cars for their own clients.", btn: "Search auctions" },
  dealers: { kicker: "Vehicle Finder", title: "Dealers", sub: "Dealer accounts, invitations and access.", btn: "" },
  "dealer-submissions": { kicker: "Vehicle Finder", title: "Dealer stock", sub: "Review vehicles submitted by dealer accounts.", btn: "" },
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
    `SELECT q.id, q.lot_id, q.status, q.lot_json, c.id AS client_id, c.name AS client_name
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
  const matchRows = res.matches.map((m) => {
    // Lead with the car (year make model); the raw internal id is never shown.
    let lot = {}; try { lot = JSON.parse(m.lot_json || "{}"); } catch (e) {}
    const title = displayName([lot.year, lot.marka_name, lot.model_name].filter(Boolean).join(" ")) || (lot.lot ? `Lot ${lot.lot}` : `Lot ${m.lot_id}`);
    // view=lot resolves by queue.id (the row's primary key), not the external
    // auction lot_id - linking lot_id 404s every time.
    return `<tr><td><a class="clink" href="/admin?view=lot&id=${esc(m.id)}">${esc(title)}</a></td><td>${esc(m.client_name)}</td><td>${chip(m.status)}</td></tr>`;
  }).join("");
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
  // Derived last-contacted: newest of any sent vehicle, note or contact tap.
  const lc = (await env.DB.prepare(
    `SELECT MAX(ts) AS t FROM (
        SELECT sent_at AS ts FROM queue WHERE client_id = ?1 AND sent_at IS NOT NULL
        UNION ALL SELECT created_at FROM activity WHERE client_id = ?1 AND type IN ('note','contact')
      )`
  ).bind(id).first()) || {};

  const info = [
    ["Email", c.email], ["Phone", c.whatsapp], ["State", c.state],
    ["Category", isDealer(c) ? "Dealer" : "Private buyer"],
    ["Member", c.member ? "Yes &middot; auction access" : "No"],
    ["Portal", c.portal_enabled ? "Enabled" : "Not enabled"],
    ["Last contacted", `${healthDot(lc.t)}${esc(lastActivityLabel(lc.t))}`],
    ["Examples sent", Number(eng.sent) ? `${eng.sent}${Number(eng.viewed) ? ` &middot; ${eng.viewed} viewed` : " &middot; none opened yet"}` : null],
    ["Last viewed", eng.last_viewed ? String(eng.last_viewed).slice(0, 10) : null],
    ["Last login", c.last_seen ? String(c.last_seen).slice(0, 10) : null],
  ].filter(([, v]) => v).map(([k, v]) => `<div class="dw-row"><span class="dw-k">${k}</span><span class="dw-v">${v}</span></div>`).join("");

  const wlList = wls.length
    ? wls.map((w) => `<div class="dw-item"><div class="dw-item-t">${esc(displayName([w.marka_name, w.model_name].filter(Boolean).join(" ")) || w.label || "Search")}</div><div class="dw-item-s">${esc(yearRange(w.year_min, w.year_max))}${w.active ? "" : " &middot; paused"}</div></div>`).join("")
    : `<div class="dw-empty-sm">No searches yet.</div>`;
  // Per-match: show the match strength (how good a fit) and the engagement stage
  // (sent / viewed / interested), the two things that help close the client.
  const mList = matches.length
    ? matches.map((m) => {
        let lot = {}; try { lot = JSON.parse(m.lot_json || "{}"); } catch (e) {}
        const strTone = { strong: "b-str", good: "b-good", possible: "b-pos" }[String(lot._strength || "").toLowerCase()] || "muted";
        const strength = lot._strength ? `<span class="chip ${strTone}">${esc(lot._strength)} match</span>` : "";
        // Interested and Viewed used to render identically; now green vs blue.
        const stage = m.response === "interested" ? `<span class="chip chip-good">Interested</span>`
          : m.viewed_at ? `<span class="chip chip-info">Viewed</span>`
          : m.sent_at ? `<span class="chip chip-warn">Sent</span>`
          : `<span class="chip muted">${esc(m.status)}</span>`;
        // V1.2 Phase 5: the row leads with the car, never a raw internal id.
        const title = displayName([lot.year, lot.marka_name, lot.model_name].filter(Boolean).join(" ")) || (lot.lot ? `Lot ${lot.lot}` : `Lot ${m.lot_id}`);
        const landed = m._landed || (lot._landed && lot._landed.grandTotal) || null;
        // view=lot resolves by queue.id, not the external auction lot_id.
        return `<div class="dw-item"><div class="dw-item-t"><a class="clink" href="/admin?view=lot&id=${esc(m.id)}">${esc(title)}</a></div><div class="dw-item-s">${stage}${strength}${landed ? ` &middot; <b>A$${Number(landed).toLocaleString("en-AU")}</b>` : ""} &middot; ${esc(String(m.created_at || "").slice(0, 10))}</div></div>`;
      }).join("")
    : `<div class="dw-empty-sm">No matches yet.</div>`;
  const pList = pays.length
    ? pays.map((p) => `<div class="dw-item"><div class="dw-item-t">${String(p.currency || "aud").toUpperCase()} $${(Number(p.amount_cents || 0) / 100).toLocaleString("en-AU", { minimumFractionDigits: 2 })}</div><div class="dw-item-s"><span class="chip muted">${esc(p.status)}</span> &middot; ${esc(String(p.created_at || "").slice(0, 10))}</div></div>`).join("")
    : `<div class="dw-empty-sm">No payments.</div>`;

  return `
    <div class="dw-head">
      <div class="dw-id">${avatar(c.name)}<div><div class="dw-name">${esc(c.name)}</div><div class="dw-sub">Customer #${c.id}</div></div></div>
      <a class="btn-primary dw-open" href="/admin?view=client&id=${c.id}">Open full profile</a>
    </div>
    ${c.email || c.whatsapp ? `<div class="dw-cta">${c.whatsapp ? `<a class="dw-cta-b" data-clog="${c.id}:whatsapp" href="https://wa.me/${esc(String(c.whatsapp).replace(/[^0-9]/g, ""))}" target="_blank" rel="noopener">WhatsApp</a><a class="dw-cta-b" data-clog="${c.id}:call" href="tel:${esc(String(c.whatsapp).replace(/[^0-9+]/g, ""))}">Call</a>` : ""}${c.email ? `<a class="dw-cta-b" data-clog="${c.id}:email" href="mailto:${esc(c.email)}">Email</a>` : ""}</div>` : ""}
    ${info ? `<div class="dw-card">${info}</div>` : ""}
    <div class="dw-sec">Requests <span class="ct">${wls.length}</span></div><div class="dw-list">${wlList}</div>
    <div class="dw-sec">Recent matches <span class="ct">${matches.length}</span></div><div class="dw-list">${mList}</div>
    <div class="dw-sec">Payments <span class="ct">${pays.length}</span></div><div class="dw-list">${pList}</div>`;
}

// Pending review queue, scoped to the session. Shared by the admin page shell
// (sidebar badge + Matches view) and the Matches "Load more" chunk endpoint.
async function queryPendingMatches(env, session) {
  const acc = accessScope(session);
  const stmt = env.DB.prepare(
    `SELECT q.*, c.name AS client_name, c.state AS client_state,
            c.email AS client_email, c.whatsapp AS client_whatsapp,
            w.label AS wlabel, w.marka_name AS w_marka, w.model_name AS w_model,
            w.rate_min AS w_rate, w.price_max AS w_price, w.kuzov AS w_kuzov, w.grade_kw AS w_kw
       FROM queue q
       JOIN clients c ON c.id = q.client_id
       LEFT JOIN wishlists w ON w.id = q.wishlist_id
      WHERE q.status = 'pending' AND ${SNOOZE_LIVE} AND ${acc.sql} ORDER BY q.created_at DESC LIMIT 400`
  );
  return ((await (acc.binds.length ? stmt.bind(...acc.binds) : stmt).all()).results) || [];
}

// IA-AUDIT item 12: a snoozed match is invisible to every pending surface
// until due. NULL or a past timestamp = live. The fragment assumes the queue
// table is aliased q.
const SNOOZE_LIVE = "(q.snoozed_until IS NULL OR q.snoozed_until <= datetime('now'))";

// Defer a pending match: "1d" = revisit tomorrow, "close" = wake 24h before
// the auction, "clear" = wake now. Throws on bad input or no access, so the
// router's act() helper surfaces the standard failure notice.
export async function snoozeMatch(env, queueId, until, session = {}) {
  const qid = Number(queueId);
  if (!Number.isInteger(qid) || qid <= 0) throw new Error("bad id");
  const q = await env.DB.prepare("SELECT id, client_id, status, lot_json FROM queue WHERE id = ?").bind(qid).first();
  if (!q) throw new Error("not found");
  if (!(await clientAccessibleBy(env, q.client_id, session))) throw new Error("no access");
  if (until === "clear") {
    await env.DB.prepare("UPDATE queue SET snoozed_until = NULL WHERE id = ?").bind(qid).run();
    return { ok: true };
  }
  if (q.status !== "pending") throw new Error("not pending");
  if (until === "close") {
    let lot = {}; try { lot = JSON.parse(q.lot_json); } catch (e) {}
    const t = tsMs(lot.auction_date);
    if (!Number.isFinite(t)) throw new Error("no auction date");
    const wake = t - 24 * 3600 * 1000;
    if (wake <= Date.now()) throw new Error("closes too soon");
    const iso = new Date(wake).toISOString().replace("T", " ").slice(0, 19);
    await env.DB.prepare("UPDATE queue SET snoozed_until = ? WHERE id = ?").bind(iso, qid).run();
    return { ok: true };
  }
  await env.DB.prepare("UPDATE queue SET snoozed_until = datetime('now','+1 day') WHERE id = ?").bind(qid).run();
  return { ok: true };
}

export async function adminPage(env, view = "dashboard", session = { role: "admin", id: 0 }, opts = {}) {
  const isAgent = session.role === "agent";
  if (view === "wishlists") view = "clients"; // legacy URL: searches now live inside the client
  if (!HEADERS[view]) view = "dashboard";
  if (["agents", "dealers", "dealer-submissions", "settings", "payments"].includes(view) && isAgent) view = "dashboard"; // admin-only areas

  // Launch audit: the dealer feature ships hidden until it's finished (approved
  // stock never reaches buyers yet). One settings load serves the gate, the
  // Matches view and the Settings page alike.
  const appSettings = await getSettings(env);
  const dealersOn = settingOn(appSettings, "dealer_portal_enabled");
  if (["dealers", "dealer-submissions"].includes(view) && !dealersOn) view = "dashboard";

  // Rows this session may see: all for admin, owned-or-shared for an agent.
  const acc = accessScope(session);
  const run = (sql) => { const s = env.DB.prepare(sql); return acc.binds.length ? s.bind(...acc.binds) : s; };

  const showArchived = !!opts.showArchived;
  const clients = (await run(`SELECT * FROM clients c WHERE ${acc.sql}${showArchived ? "" : " AND c.archived = 0"} ORDER BY name`).all()).results || [];
  const wishlists = (await run(
    `SELECT w.*, c.name AS client_name FROM wishlists w JOIN clients c ON c.id = w.client_id WHERE ${acc.sql} ORDER BY c.name, w.id`
  ).all()).results || [];
  const pending = await queryPendingMatches(env, session);

  // For the Clients view: active agents (for the Share picker) and existing
  // shares (chips), so owners can share/unshare.
  let shareAgents = [], sharesByClient = {}, lastContact = {}, pendingCounts = {}, engagedClients = new Set();
  if (view === "clients") {
    shareAgents = (await env.DB.prepare("SELECT id, name, company FROM agents WHERE active = 1 ORDER BY name").all()).results || [];
    const sh = (await env.DB.prepare(
      "SELECT cs.client_id, cs.agent_id, a.name AS agent_name FROM client_shares cs JOIN agents a ON a.id = cs.agent_id"
    ).all()).results || [];
    for (const r of sh) (sharesByClient[r.client_id] = sharesByClient[r.client_id] || []).push({ id: r.agent_id, name: r.agent_name });
    // Derived last-contacted per client: the newest of any sent vehicle, note
    // or logged contact tap. Read-only aggregation, no manual upkeep.
    try {
      const lc = (await env.DB.prepare(
        `SELECT client_id, MAX(ts) AS t FROM (
            SELECT client_id, sent_at AS ts FROM queue WHERE sent_at IS NOT NULL
            UNION ALL SELECT client_id, created_at FROM activity WHERE type IN ('note','contact')
          ) GROUP BY client_id`
      ).all()).results || [];
      for (const r of lc) lastContact[r.client_id] = r.t;
    } catch (e) { console.error("last-contact rollup failed:", e.message); }
    // IA-AUDIT item 10: live match count per client ("who has cars sitting
    // unsent?") and who has engaged (opened or said interested) - engagement
    // decides whether a long silence reads as alarm red or cooling amber.
    try {
      const pc = (await env.DB.prepare("SELECT client_id, COUNT(*) AS n FROM queue WHERE status = 'pending' AND (snoozed_until IS NULL OR snoozed_until <= datetime('now')) GROUP BY client_id").all()).results || [];
      for (const r of pc) pendingCounts[r.client_id] = r.n;
      const en = (await env.DB.prepare("SELECT DISTINCT client_id FROM queue WHERE viewed_at IS NOT NULL OR response = 'interested'").all()).results || [];
      for (const r of en) engagedClients.add(r.client_id);
    } catch (e) { console.error("clients queue rollup failed:", e.message); }
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
        `SELECT a.*, (SELECT COUNT(*) FROM clients c WHERE c.agent_id = a.id) AS client_count,
                (SELECT COUNT(*) FROM wishlists w JOIN clients c2 ON c2.id = w.client_id
                  WHERE c2.agent_id = a.id AND COALESCE(w.status, 'new') NOT IN ('delivered','lost')) AS open_requests
           FROM agents a ORDER BY a.name`
      ).all()).results || []
    : [];
  const dealers = (!isAgent && view === "dealers")
    ? ((await env.DB.prepare("SELECT * FROM dealers ORDER BY created_at DESC").all()).results || [])
    : [];
  const dealerStatus = ["pending", "approved", "rejected", "archived"].includes(opts.dealerStatus)
    ? opts.dealerStatus : "pending";
  const dealerSubmissions = (!isAgent && view === "dealer-submissions")
    ? await getDealerVehicleSubmissions(env, dealerStatus, 100, 0)
    : [];
  const settings = (!isAgent && view === "settings") ? appSettings : null;
  const payments = (!isAgent && view === "payments")
    ? (await env.DB.prepare(
        "SELECT p.*, c.name AS client_name FROM payments p LEFT JOIN clients c ON c.id = p.client_id ORDER BY p.created_at DESC LIMIT 200"
      ).all()).results || []
    : [];
  // Deposits outstanding: requests whose deposit is requested but not yet paid.
  const deposits = (view === "payments" && !isAgent)
    ? (await env.DB.prepare(
        `SELECT w.id, w.deposit_status, w.status, w.last_activity, w.marka_name, w.model_name, c.name AS client_name, c.id AS client_id, c.whatsapp AS client_whatsapp
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
            (SELECT COUNT(*) FROM queue q WHERE q.wishlist_id = w.id AND q.viewed_at IS NOT NULL) AS viewed_count,
            (SELECT q.id FROM queue q WHERE q.wishlist_id = w.id ORDER BY q.created_at DESC LIMIT 1) AS last_queue_id,
            (SELECT q.lot_json FROM queue q WHERE q.wishlist_id = w.id ORDER BY q.created_at DESC LIMIT 1) AS last_lot_json
       FROM wishlists w JOIN clients c ON c.id = w.client_id
       LEFT JOIN agents ow ON ow.id = w.owner_id
      WHERE ${acc.sql}
      ORDER BY (SELECT MAX(COALESCE(w2.last_activity, w2.created_at))
                  FROM wishlists w2 WHERE w2.client_id = w.client_id) DESC,
               w.client_id,
               COALESCE(w.last_activity, w.created_at) DESC
      LIMIT 500`
  ).all()).results || []) : [];
  const matchSettings = view === "matches" ? appSettings : null;
  if (isAgent) {
    const me = await env.DB.prepare("SELECT name FROM agents WHERE id = ?").bind(session.id).first();
    session = { ...session, name: me ? me.name : "Agent" };
  }

  // Tasks and Agents left the sidebar (they live under Dashboard / Settings
  // now), so their old badge queries are gone with their nav items.
  const dealerTotal = (!isAgent && dealersOn) ? ((await env.DB.prepare("SELECT COUNT(*) AS n FROM dealers WHERE active = 1").first())?.n || 0) : 0;
  const dealerPending = (!isAgent && dealersOn) ? ((await env.DB.prepare("SELECT COUNT(*) AS n FROM dealer_vehicles WHERE status = 'pending'").first())?.n || 0) : 0;
  const counts = { clients: clients.length, requests: wishlists.length, matches: pending.length, dealers: dealerTotal, dealerSubmissions: dealerPending, dealersOn };
  const h = HEADERS[view];
  const primary = view === "matches"
    ? `<form method="POST" action="/run" style="display:inline" data-confirm="Run the auction search for every active customer search now? New matches on auto-notify searches are emailed or WhatsApped to clients immediately."><button type="submit" class="btn-secondary">${esc(h.btn)}</button></form>`
    : ["agents", "dealers", "dealer-submissions", "settings", "payments", "auctions", "intake"].includes(view)
    ? ""
    : h.btn ? `<a class="btn-secondary" href="/admin?view=intake">${esc(h.btn)}</a>` : "";

  const makers = view === "intake" ? await distinctMakers(env) : [];
  let body = "";
  if (view === "dashboard") body = dashboardView(session, await dashboardData(env, session));
  else if (view === "intake") body = intakeView(makers, { err: opts.err, vals: opts.vals });
  else if (view === "clients") body = clientsView(clients, wishlists, { session, agents: shareAgents, shares: sharesByClient, showArchived, cat: opts.cat, src: opts.src, lastContact, pendingCounts, engagedClients });
  else if (view === "matches") {
    // Parked matches for the Snoozed chip/filter - same joins as the live
    // queue, waking soonest first. Nothing snoozed can vanish irrecoverably.
    const acc2 = accessScope(session);
    const snzStmt = env.DB.prepare(
      `SELECT q.*, c.name AS client_name, c.state AS client_state,
              c.email AS client_email, c.whatsapp AS client_whatsapp,
              w.label AS wlabel, w.rate_min AS w_rate, w.price_max AS w_price, w.kuzov AS w_kuzov, w.grade_kw AS w_kw
         FROM queue q JOIN clients c ON c.id = q.client_id LEFT JOIN wishlists w ON w.id = q.wishlist_id
        WHERE q.status = 'pending' AND q.snoozed_until > datetime('now') AND ${acc2.sql}
        ORDER BY q.snoozed_until ASC LIMIT 100`
    );
    const snoozedRows = ((await (acc2.binds.length ? snzStmt.bind(...acc2.binds) : snzStmt).all()).results) || [];
    // IA-AUDIT item 13: send recency per client for the group headers, so
    // over-sending in the same week is visible at the moment of approval.
    const srStmt = env.DB.prepare(
      `SELECT q.client_id, COUNT(*) AS n, MAX(q.sent_at) AS t,
              SUM(CASE WHEN q.viewed_at IS NOT NULL THEN 1 ELSE 0 END) AS v
         FROM queue q JOIN clients c ON c.id = q.client_id
        WHERE q.sent_at >= datetime('now','-7 days') AND ${acc2.sql} GROUP BY q.client_id`
    );
    const sentRecency = {};
    for (const r of ((await (acc2.binds.length ? srStmt.bind(...acc2.binds) : srStmt).all()).results) || []) sentRecency[r.client_id] = r;
    body = matchesView(pending, { settings: matchSettings, aiEnabled: !!env.ANTHROPIC_API_KEY, isAdmin: session.role === "admin", query: opts.matchQuery || {}, snoozedRows, sentRecency });
  }
  else if (view === "agents") body = agentsView(agents, { vals: opts.vals });
  else if (view === "dealers") body = dealersPage(dealers);
  else if (view === "dealer-submissions") body = dealerSubmissionsPage(dealerSubmissions, dealerStatus);
  else if (view === "auctions") body = await adminAuctionsPage(env, session, opts);
  else if (view === "payments") body = paymentsView(payments, { stripeSecret: !!env.STRIPE_SECRET_KEY, deposits });
  else if (view === "settings") body = settingsView(settings, { stripeSecret: !!env.STRIPE_SECRET_KEY, publicUrl: env.PUBLIC_URL, aiKey: !!env.ANTHROPIC_API_KEY, waConfigured: whatsappConfigured(env) });
  else if (view === "search") body = searchView(await adminSearch(env, session, opts.q || ""));
  else if (view === "requests") body = requestsView(requests, { layout: opts.reqLayout });
  else if (view === "tasks") body = tasksView(tasks, { clients, session, mine: !!opts.taskMine });

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

  // The sold-data tabs (history / prices, plus the old "sold" alias) belong
  // to the dedicated Auction history sidebar item; live/watch stay Auctions.
  const sideActive = view === "auctions" && ["history", "prices", "sold"].includes(opts.tab)
    ? "auction-history" : view;
  return shell(sidebar(sideActive, counts, session), main, esc(h.title) + " - JDM Connect");
}

// Admin-only: manage agent logins.
function agentsView(agents, opts = {}) {
  const vals = opts.vals || {};
  const vv = (k) => esc(vals[k] || "");
  const rows = agents.map((a) => {
    const invited = !a.pass_hash;
    return `<tr>
      <td>${avatar(a.name)}${esc(a.name)}${invited ? ` <span class="chip muted">invited</span>` : ""}</td>
      <td>${esc(a.email)}</td>
      <td>${esc(a.company || "-")}</td>
      <td style="text-align:right">${a.client_count}</td>
      <td style="text-align:right">${a.open_requests || 0}</td>
      <td style="white-space:nowrap">${a.last_seen ? esc(relTime(a.last_seen)) : `<span class="chip muted">never</span>`}</td>
      <td><form method="POST" action="/agent/alerts" style="display:inline"><input type="hidden" name="id" value="${a.id}"><button class="btn-toggle ${a.alerts ? "on" : "off"}" type="submit">${a.alerts ? "Alerts on" : "Alerts off"}</button></form></td>
      <td><form method="POST" action="/agent/toggle" style="display:inline"><input type="hidden" name="id" value="${a.id}"><button class="btn-toggle ${a.active ? "on" : "off"}" type="submit">${a.active ? "Active" : "Paused"}</button></form></td>
      <td style="text-align:right;white-space:nowrap">
        ${rowMenu([
          invited
            ? { label: "Resend invite", action: "/agent/invite", id: a.id }
            : { label: "Send password reset", action: "/send-reset", id: a.id, extra: { kind: "agent" } },
          { sep: true },
          { label: "Delete", action: "/agent/delete", id: a.id, confirm: "Delete this agent and ALL their clients, searches and matches? This cannot be undone.", icon: ICONS.trash, danger: true },
        ])}
      </td>
    </tr>`;
  }).join("") || `<tr><td colspan="9" class="empty">No agents yet</td></tr>`;
  // IA-AUDIT item 17: the team list is the daily read, the invite form the
  // occasional tool - list first, form folded. A validation bounce (vals
  // carries what was typed) or an empty team springs it open.
  const formOpen = Object.values(vals).some(Boolean) || !agents.length;
  const newAgent = `<details class="card foldcard" id="newAgent"${formOpen ? " open" : ""}>
      <summary>Invite a new agent</summary>
      <form method="POST" action="/agent">
        <div class="grid">
          <div><label for="ag-name">Name</label><input id="ag-name" name="name" maxlength="120" placeholder="Agent name" value="${vv("name")}" required></div>
          <div><label for="ag-email">Email <span class="opt">(login + alerts)</span></label><input id="ag-email" name="email" type="email" maxlength="254" spellcheck="false" placeholder="agent@email.com" value="${vv("email")}" required></div>
          <div><label for="ag-company">Company <span class="opt">(optional)</span></label><input id="ag-company" name="company" maxlength="120" placeholder="e.g. Ofuka" value="${vv("company")}"></div>
        </div>
        <div class="actions"><button class="btn-primary" type="submit">Create &amp; send invite</button>
          <span class="help">They get an email to set their own password, then see only their own clients and matches.</span></div>
      </form>
    </details>`;
  return `
    ${tableToolbar("agentsTbl", "Search agents by name, email or company…", "jdm-agents")}
    <div class="mcl">${agents.map((a) => mobileCardRow({
      name: a.name,
      title: `${esc(a.name)}${a.pass_hash ? "" : ` <span class="chip muted">invited</span>`}`,
      meta: [esc(a.email), esc(a.company || ""), `${a.client_count} client${a.client_count === 1 ? "" : "s"}`, `${a.open_requests || 0} open request${(a.open_requests || 0) === 1 ? "" : "s"}`, a.last_seen ? `last login ${esc(relTime(a.last_seen))}` : "never logged in"].filter(Boolean).join(" &middot; "),
      right: `<span class="chip${a.active ? "" : " muted"}">${a.active ? "Active" : "Paused"}</span>`,
      rightSub: a.alerts ? "Alerts on" : "Alerts off",
    })).join("") || `<div class="empty">No agents yet</div>`}</div>
    <div class="card tbl-desk" style="padding:0;overflow-x:auto;-webkit-overflow-scrolling:touch">
      <table id="agentsTbl" class="sortable"><tr><th>Agent</th><th>Email</th><th>Company</th><th style="text-align:right">Clients</th><th style="text-align:right">Open requests</th><th>Last login</th><th>Alerts</th><th>Status</th><th></th></tr>${rows}</table></div>
    ${newAgent}`;
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
        <a href="#set-freetier">Free tier</a>
        <a href="#set-landed">Landed cost</a>
        <a href="#set-ai">AI reader</a>
        <a href="#set-team">Team</a>
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
          <div class="actions" style="margin-top:12px"><button class="btn-secondary" type="submit" form="tsEmail">Send me a test email</button>
            <span class="help">Verifies the channel end to end, to the alert email above (save first if you changed it).</span></div>
        </div>
      </div>

      <div class="card set-card" id="set-whatsapp">
        <h2><span class="num">2</span> WhatsApp <span class="opt" style="font-weight:400">&middot; auto-send matches</span></h2>
        <div style="max-width:640px">
          <p class="help" style="margin:0 0 16px">Also deliver approved matches over WhatsApp (on top of email) to clients who left a number. ${waConfigured ? "Provider detected." : "<strong>No provider configured yet</strong> -add the Twilio or Meta secrets first, then turn this on."} Automated matches send via your approved message template.</p>
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
            <div><label for="set-wa-test">Test number <span class="opt">(yours, +61…)</span></label>
              <div style="display:flex;gap:8px">
                <input id="set-wa-test" name="to" form="tsWa" type="tel" inputmode="tel" placeholder="+61 4XX XXX XXX" style="flex:1"${waConfigured ? "" : " disabled"}>
                <button class="btn-secondary" type="submit" form="tsWa" style="white-space:nowrap"${waConfigured ? "" : " disabled"}>Send a test WhatsApp</button>
              </div>
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
          <p class="help" style="margin:0 0 16px">Take a deposit from buyers in their portal. ${stripeSecret ? "Stripe key detected." : "<strong>No Stripe key set yet</strong> -deposits stay off until the <code>STRIPE_SECRET_KEY</code> secret is added."}</p>
          <div class="toggles" style="margin-top:0">
            ${toggleRow("stripe_enabled", "Enable deposits in the buyer portal", "Show a “Pay deposit” button on cars a client asked us to chase.", settingOn(s, "stripe_enabled"))}
          </div>
          <div class="grid2" style="margin-top:16px">
            <div><label for="set-deposit">Deposit amount <span class="opt">(AUD)</span></label><input id="set-deposit" name="stripe_deposit_aud" type="number" min="0" step="any" value="${esc(s.stripe_deposit_aud || "")}" placeholder="e.g. 500"></div>
            <div><label for="set-currency">Currency</label><input id="set-currency" name="stripe_currency" value="${esc(s.stripe_currency || "aud")}" placeholder="aud"></div>
          </div>
          <details class="set-disc"><summary>Webhook setup</summary>
            <p class="help" style="margin-top:8px;font-size:var(--fs-label);line-height:var(--lh-list)">Add this endpoint in your Stripe dashboard for the <code>checkout.session.completed</code>, <code>customer.subscription.updated</code> and <code>customer.subscription.deleted</code> events, then set its signing secret as <code>STRIPE_WEBHOOK_SECRET</code>:<br><strong>${esc(webhookUrl)}</strong><br>For memberships, also enable the Customer Portal in Stripe so members can manage their plan.</p>
          </details>
        </div>
      </div>

      <div class="card set-card" id="set-pricing">
        <h2><span class="num">5</span> Membership</h2>
        <div style="max-width:640px">
          <p class="help" style="margin:0 0 16px">The “Full access” plan, billed monthly via Stripe. Turn it on to show a Subscribe button in the buyer portal${stripeSecret ? "" : " (needs the <code>STRIPE_SECRET_KEY</code> secret first)"}. An active subscription makes the client a member automatically.</p>
          <div class="toggles" style="margin-top:0">
            ${toggleRow("membership_enabled", "Sell Full access in the portal", "Show the “Get full access” subscribe button to non-members.", settingOn(s, "membership_enabled"))}
          </div>
          <div class="grid2" style="margin-top:16px">
            <div><label for="set-price">Full access <span class="opt">(A$/month)</span></label><input id="set-price" name="membership_monthly_aud" type="number" min="0" step="any" value="${esc(s.membership_monthly_aud || "49")}"></div>
            <div><label for="set-free">Free result limit <span class="opt">(reserved)</span></label><input id="set-free" name="free_result_limit" type="number" min="0" step="any" value="${esc(s.free_result_limit || "1")}"></div>
          </div>
        </div>
      </div>

      <div class="card set-card" id="set-dealers">
        <h2><span class="num">5d</span> Dealer network</h2>
        <div style="max-width:640px">
          <p class="help" style="margin:0 0 16px">The dealer stock pipeline (dealer accounts, submissions and the review queue). It ships hidden until approved dealer stock is actually shown to buyers; already-invited dealers keep their portal access either way.</p>
          <div class="toggles" style="margin-top:0">
            ${toggleRow("dealer_portal_enabled", "Enable the dealer network", "Show the Dealers and Dealer stock admin views and allow inviting new dealers.", settingOn(s, "dealer_portal_enabled"))}
          </div>
        </div>
      </div>

      <div class="card set-card" id="set-freetier">
        <h2><span class="num">5c</span> Free tier &amp; search runs</h2>
        <div style="max-width:640px">
          <p class="help" style="margin:0 0 16px">How free accounts behave, and whose searches "Run Searches" covers. Change these any time, no deploy needed.</p>
          <div class="toggles" style="margin-top:0">
            ${toggleRow("free_auto_send", "Auto-send the first match to free signups", "On: a free account gets an example match emailed the instant they sign up. Off (recommended): staff review matches before they are sent.", settingOn(s, "free_auto_send"))}
            ${toggleRow("run_includes_free", "Run Searches includes free accounts", "On (recommended): the matcher runs every active search, free or paid. Off: it runs paid members' searches only.", settingOn(s, "run_includes_free"))}
            ${toggleRow("budget_filter", "Hide matches that land over budget", "On (recommended): a match is only surfaced when its real all-in landed price fits the customer's stated budget (plus the headroom below). Off: budget is stored on the lead but never filters matches.", settingOn(s, "budget_filter"))}
          </div>
          <div class="grid2" style="margin-top:16px">
            <div><label for="set-freesearch">Active searches per free account</label><input id="set-freesearch" name="free_search_limit" type="number" min="1" step="1" value="${esc(s.free_search_limit || "1")}"></div>
            <div><label for="set-headroom">Budget headroom <span class="opt">(%, how far over budget still shows)</span></label><input id="set-headroom" name="budget_headroom_pct" type="number" min="0" step="1" value="${esc(s.budget_headroom_pct || "10")}"></div>
          </div>
        </div>
      </div>

      <div class="card set-card" id="set-landed">
        <h2><span class="num">5b</span> Landed cost assumptions</h2>
        <div style="max-width:640px">
          <p class="help" style="margin:0 0 16px">The figures behind every landed-price estimate on listings and emails. Change them here and new estimates use them straight away, no deploy needed. Leave a field blank to use the built-in default.</p>
          <div class="grid2">
            <div><label for="set-compliance">Compliance <span class="opt">(A$, SEVS/RAWS)</span></label><input id="set-compliance" name="calc_compliance_aud" type="number" min="0" step="any" value="${esc(s.calc_compliance_aud || "")}" placeholder="4,000"></div>
            <div><label for="set-agency">Agency fee <span class="opt">(A$, per import)</span></label><input id="set-agency" name="calc_agency_aud" type="number" min="0" step="any" value="${esc(s.calc_agency_aud || "")}" placeholder="0"></div>
            <div><label for="set-fx">FX override <span class="opt">(JPY per A$1, blank = live rate)</span></label><input id="set-fx" name="calc_fx_jpy_aud" type="number" min="0" step="any" value="${esc(s.calc_fx_jpy_aud || "")}" placeholder="live"></div>
            <div><label for="set-bias">Estimate bias <span class="opt">(%, negative aims under actuals)</span></label><input id="set-bias" name="calc_bias_pct" type="number" min="-50" max="50" step="any" value="${esc(s.calc_bias_pct || "")}" placeholder="0"></div>
          </div>
          <p class="help" style="margin-top:12px;font-size:var(--fs-label)">Shipping, duties and on-road costs come from the live landed-cost calculator per state and port. When an estimate can't be produced for a lot, the figure is hidden rather than guessed. Bias adjusts the final figure by a percentage: after back-testing against real invoices, set it so estimates aim 5 to 10% under actuals (e.g. -8).</p>
        </div>
      </div>

      <div class="card set-card" id="set-ai">
        <h2><span class="num">6</span> AI auction-sheet reader</h2>
        <div style="max-width:640px">
          <p class="help" style="margin:0 0 16px">Reads the Japanese inspection sheet from a car's photos. ${opts.aiKey ? "API key detected." : "<strong>No API key set yet</strong> -the reader stays off until the <code>ANTHROPIC_API_KEY</code> secret is added."}</p>
          <div class="grid2">
            <div><label for="set-when">When to read</label><select id="set-when" name="ai_sheet_auto">${aiOpts(s.ai_sheet_auto, SHEET_AUTO_MODES, "off")}</select></div>
            <div><label for="set-model">Model <span class="opt">(cached per car)</span></label><select id="set-model" name="ai_sheet_model">${aiOpts(s.ai_sheet_model, SHEET_MODELS, DEFAULT_SHEET_MODEL)}</select></div>
          </div>
          <details class="set-disc"><summary>How auto-read works</summary>
            <p class="help" style="margin-top:8px;font-size:var(--fs-label)">Auto modes read in the background after a search and cache the result, so each car is read once. “Strong”/“every match” are capped at 6 reads per search to control cost.</p>
          </details>
        </div>
      </div>

      <div class="actionbar actionbar-end"><button class="btn-primary" type="submit">Save settings</button></div>
    </form>
    <div class="card set-card" id="set-team">
      <h2><span class="num">7</span> Team</h2>
      <div style="max-width:640px">
        <p class="help" style="margin:0 0 16px">Agent logins that find cars for their own clients - invites, passwords, alerts and access.</p>
        <a class="btn-secondary" href="/admin?view=agents">Manage agents</a>
      </div>
    </div>
    <form id="tsEmail" method="POST" action="/settings/test-email"></form>
    <form id="tsWa" method="POST" action="/settings/test-whatsapp"></form>
    <script>(function(){
      // Unsaved-changes warning: leaving the page with edited, unsaved settings
      // asks first. Cleared on submit so saving never triggers it.
      var f=document.querySelector('form[action="/settings"]'); if(!f)return;
      var dirty=false;
      f.addEventListener('input',function(){dirty=true;});
      f.addEventListener('change',function(){dirty=true;});
      f.addEventListener('submit',function(){dirty=false;});
      window.addEventListener('beforeunload',function(e){ if(dirty){e.preventDefault();e.returnValue='';} });
    })();</script>`;
}

// Admin-only: list of Stripe deposits taken through the buyer portal.
// IA-AUDIT item 14: the chase affordance. A WhatsApp deep link with a
// pre-filled deposit reminder; the data-clog beacon logs the tap to activity,
// so "mark chased" happens as a side effect of actually chasing.
function chaseWaLink(clientId, whatsapp, name, veh) {
  const digits = String(whatsapp || "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  const first = firstNameOf(name || "") || "there";
  const msg = `Hi ${first}, just a friendly reminder about the deposit for your ${veh} import - once it lands we can secure the car. Any questions, just reply here.`;
  return `<a class="b b-warn" data-clog="${clientId}:whatsapp" href="https://wa.me/${digits}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener" style="text-decoration:none">Chase on WhatsApp</a>`;
}

function paymentsView(payments, opts = {}) {
  const money = (cents, cur) => {
    const v = Number(cents) / 100;
    return (cur || "aud").toLowerCase() === "aud"
      ? "A$" + v.toLocaleString("en-AU")
      : v.toLocaleString() + " " + String(cur || "").toUpperCase();
  };
  // Status pill on the ONE chip component (was a fully inline-styled span).
  const badge = (st) => {
    const tone = { paid: "chip-good", created: "chip-warn", expired: "muted", failed: "chip-bad" }[st] || "chip-warn";
    return `<span class="chip ${tone}">${esc(st || "-")}</span>`;
  };
  // Stripe session ids are long enough to blow the table out; truncate with a
  // copy button for the full id.
  const sessCell = (p) => p.stripe_session
    ? `<span style="font-family:var(--mono,ui-monospace,monospace)" title="${esc(p.stripe_session)}">${esc(String(p.stripe_session).slice(0, 18))}&hellip;</span> <button type="button" class="tbl-export" style="padding:4px 8px;font-size:var(--fs-label)" data-sess="${esc(p.stripe_session)}" onclick="var b=this;(navigator.clipboard?navigator.clipboard.writeText(b.getAttribute('data-sess')):Promise.reject()).then(function(){if(window.jdmToast)jdmToast('Session id copied');},function(){prompt('Copy the session id:',b.getAttribute('data-sess'));})">Copy</button>`
    : "-";
  // Stripe register (measured): the amount is the loudest thing on the row,
  // 14px semibold tabular right-aligned ink; status stays the quietest.
  const rows = payments.map((p) => `<tr>
    <td>${esc(String(p.created_at || "").slice(0, 16))}</td>
    <td>${p.client_id ? `<a class="clink" href="/admin?view=client&id=${p.client_id}">${esc(p.client_name || ("#" + p.client_id))}</a>` : esc(p.client_name || "-")}</td>
    <td class="tnum">${money(p.amount_cents, p.currency)}</td>
    <td>${esc(p.description || "-")}</td>
    <td>${badge(p.status)}</td>
    <td style="font-size:var(--fs-label);color:var(--t3);white-space:nowrap">${sessCell(p)}</td>
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
      <td style="white-space:nowrap">${chaseWaLink(d.client_id, d.client_whatsapp, d.client_name, veh)}</td>
      <td style="text-align:right"><form method="POST" action="/request/status" style="display:inline"><input type="hidden" name="id" value="${d.id}"><input type="hidden" name="status" value="deposit_paid"><input type="hidden" name="back" value="/admin?view=payments"><button class="btn-toggle on" type="submit">Mark paid</button></form></td>
    </tr>`;
  }).join("");
  const depositsSection = deposits.length ? `<div class="psec"><h2>Deposits outstanding<span class="ct">${deposits.length}</span></h2></div>
    <div class="card" style="padding:0;overflow-x:auto;-webkit-overflow-scrolling:touch">
      <table><tr><th>Request</th><th>Customer</th><th>Vehicle</th><th>Requested</th><th></th><th></th></tr>${depRows}</table>
    </div>` : "";
  // The trust surface: Collected is the one gold money headline; the section
  // headers are a real rhythm class (32px above, 12px below), not bare h2s.
  return `<style>
    .psec{margin:var(--sp-6) 0 var(--sp-3)}
    .psec h2{font-size:var(--fs-sect);font-weight:600;letter-spacing:var(--ls-title);margin:0;display:flex;align-items:baseline;gap:var(--sp-2)}
    .psec .ct{font-size:var(--fs-sec);font-weight:500;color:var(--t3)}
    .triage+.psec,.psec:first-child{margin-top:0}
  </style>
    <div class="triage">
      <div class="tstat"><div class="k">Collected</div><div class="v money">A$${(totalPaid / 100).toLocaleString("en-AU")}</div></div>
      <div class="tstat"><div class="k">Paid payments</div><div class="v">${paidCount}</div></div>
      <div class="tstat"><div class="k">Deposits outstanding</div><div class="v">${deposits.length}</div></div>
    </div>
    ${depositsSection}
    ${payments.length ? `<div class="psec"><h2>Payments<span class="ct">${payments.length}</span></h2></div>${tableToolbar("paymentsTbl", "Search payments by client, status or description…", "jdm-payments")}` : ""}
    <div class="mcl">${payments.map((p) => mobileCardRow({
      name: p.client_name || "?",
      title: esc(p.client_name || ("#" + p.client_id)),
      meta: [esc(p.description || ""), esc(String(p.created_at || "").slice(0, 16))].filter(Boolean).join(" &middot; "),
      right: `<span style="font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums">${money(p.amount_cents, p.currency)}</span>`,
      rightSub: badge(p.status),
    })).join("") || `<div class="empty">No payments yet.${opts.stripeSecret ? "" : " Add your Stripe key and turn on deposits in Settings to start taking them."}</div>`}</div>
    <div class="card tbl-desk" style="padding:0;overflow-x:auto;-webkit-overflow-scrolling:touch">
      <table id="paymentsTbl" class="sortable"><tr><th>When</th><th>Client</th><th style="text-align:right">Amount</th><th>For</th><th>Status</th><th>Stripe session</th></tr>${rows}</table>
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
    <form class="login-card" method="POST" action="/login${opts.next === "subscribe" ? "?next=subscribe" : ""}">
      <div class="login-logo"><a href="/" aria-label="JDM Connect home">${LOGO}</a></div>
      <h1>Welcome back</h1>
      <p class="login-sub">Sign in to track your searches and the matches we find for you.</p>
      ${err}
      ${googleBlock}
      <label for="lg-email">Email</label>
      <input id="lg-email" type="email" name="email" autocomplete="username" spellcheck="false" placeholder="you@email.com" maxlength="${EMAIL_MAX}" value="${esc(opts.email || "")}">
      <label for="lg-pass" style="margin-top:16px">Password</label>
      <input id="lg-pass" type="password" name="password" autocomplete="current-password" required maxlength="128">
      <p class="login-sub" style="margin:8px 0 0;text-align:right"><a href="/forgot-password" style="color:var(--gold-txt)">Forgot password?</a></p>
      <button class="btn-primary" type="submit">Sign in</button>
      <p class="login-sub" style="margin:16px 0 0">New here? <a href="/request" style="color:var(--gold-txt);font-weight:700;text-decoration:underline;text-underline-offset:3px">Sign up to start searching</a></p>
    </form>
  </div>`;
  return brandDoc(body, "Sign in - JDM Connect");
}

// Second step of the admin sign-in when MFA is enabled (ADMIN_TOTP_SECRET is
// set): the password was correct, now ask for the current authenticator code.
// Reached only with the short-lived pending-MFA cookie set by /login.
export function mfaPage(opts = {}) {
  const err = opts.error
    ? `<div class="login-err">That code didn't match. Enter the current 6-digit code from your authenticator app.</div>`
    : "";
  const body = `<div class="login-screen">
    ${risingSun({ size: 520, tone: "faint" })}
    <form class="login-card" method="POST" action="/login${opts.next === "subscribe" ? "?next=subscribe" : ""}">
      <div class="login-logo"><a href="/" aria-label="JDM Connect home">${LOGO}</a></div>
      <h1>Two-step verification</h1>
      <p class="login-sub">Enter the 6-digit code from your authenticator app to finish signing in.</p>
      ${err}
      <label for="lg-totp">Authenticator code</label>
      <input id="lg-totp" type="text" name="totp" inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code" spellcheck="false" required maxlength="6" autofocus>
      <button class="btn-primary" type="submit">Verify and sign in</button>
      <p class="login-sub" style="margin:16px 0 0"><a href="/login" style="color:var(--gold-txt)">Back to sign in</a></p>
    </form>
  </div>`;
  return brandDoc(body, "Verify sign-in - JDM Connect");
}

// Self-serve "Forgot password?" screen. The confirmation is intentionally the
// same whether or not the email matched an account (no enumeration signal).
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
      <input id="sp-pass" type="password" name="password" autocomplete="new-password" required minlength="${PW_MIN}" maxlength="${PW_MAX}" title="${PW_MIN} to ${PW_MAX} characters, including a letter and a number. Long passphrases are welcome.">
      <label for="sp-confirm" style="margin-top:16px">Confirm password</label>
      <input id="sp-confirm" type="password" name="confirm" autocomplete="new-password" required minlength="${PW_MIN}" maxlength="${PW_MAX}">
      <button class="btn-primary" type="submit">Set password and sign in</button>
    </form>`;
  }
  return brandDoc(`<div class="login-screen">${risingSun({ size: 520, tone: "faint" })}${card}</div>`, "Set password - JDM Connect");
}

// "Forgot password?" screen. The sent state is the SAME whether or not the
// email has an account (no enumeration): we only ever say a link is on its way
// if the address is registered.
export function forgotPasswordPage(opts = {}) {
  const card = opts.sent
    ? `<div class="login-card"><div class="login-logo">${LOGO}</div><h1>Check your email</h1>
      <p class="login-sub">If <strong>${esc(opts.email || "that address")}</strong> has a JDM Connect login, a password reset link is on its way. The link works for 1 hour - check your spam folder if it doesn't arrive.</p>
      <p class="login-sub" style="margin-top:16px"><a href="/login" style="color:var(--gold-txt);font-weight:600">Back to sign in</a></p></div>`
    : `<form class="login-card" method="POST" action="/forgot-password">
      <div class="login-logo">${LOGO}</div>
      <h1>Reset your password</h1>
      <p class="login-sub">Enter the email you sign in with and we'll send you a link to choose a new password.</p>
      <label for="fp-email">Email</label>
      <input id="fp-email" type="email" name="email" autocomplete="username" spellcheck="false" placeholder="you@email.com" maxlength="${EMAIL_MAX}" required>
      <button class="btn-primary" type="submit">Email me a reset link</button>
      <p class="login-sub" style="margin:16px 0 0"><a href="/login" style="color:var(--gold-txt)">Back to sign in</a></p>
    </form>`;
  return brandDoc(`<div class="login-screen">${risingSun({ size: 520, tone: "faint" })}${card}</div>`, "Reset password - JDM Connect");
}

// Time-aware greeting (client local time) + count-up on the dashboard numbers.
// Honours prefers-reduced-motion by showing final values immediately.
// Stat tiles server-render their REAL numbers; there is no count-up any more
// (launch audit: tiles rendered a literal 0 and animated toward the truth, so
// the dashboard lied for over a second - or forever with JS off). Any number
// shown is always the actual value. Only the greeting is scripted.
function dashScript() {
  return `<script>(function(){
    var h=new Date().getHours();
    var g=h<12?'Good morning':h<18?'Good afternoon':'Good evening';
    var t=document.getElementById('greetTime'); if(t) t.textContent=g;
  })();</script>`;
}

// ---------------------------------------------------------------------------
// Dashboard charts: dependency-free inline SVG, themed via CSS custom props.
// No chart library, keeps the page lightweight and CSP-clean.
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
  const pending = (await run(`SELECT COUNT(*) AS n FROM queue q JOIN clients c ON c.id = q.client_id WHERE q.status='pending' AND ${SNOOZE_LIVE} AND ${acc.sql}`).first())?.n || 0;
  const closing = (await run(`SELECT COUNT(*) AS n FROM queue q JOIN clients c ON c.id = q.client_id WHERE q.status='pending' AND ${SNOOZE_LIVE} AND ${acc.sql} AND json_extract(q.lot_json,'$.auction_date') BETWEEN datetime('now') AND datetime('now','+48 hours')`).first())?.n || 0;
  const strRows = (await run(`SELECT json_extract(q.lot_json,'$._strength') AS s, COUNT(*) AS n FROM queue q JOIN clients c ON c.id = q.client_id WHERE q.status='pending' AND ${SNOOZE_LIVE} AND ${acc.sql} GROUP BY s`).all()).results || [];
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
  const requests = (await run(`SELECT COUNT(*) AS n FROM queue q JOIN clients c ON c.id = q.client_id WHERE q.client_request=1 AND q.status='pending' AND ${SNOOZE_LIVE} AND ${acc.sql}`).first())?.n || 0;
  const members = (await run(`SELECT COUNT(*) AS n FROM clients c WHERE c.member=1 AND ${acc.sql}`).first())?.n || 0;
  // Most-wanted makes in the live review queue, a quick read on demand.
  const makeRows = (await run(`SELECT json_extract(q.lot_json,'$.marka_name') AS mk, COUNT(*) AS n FROM queue q JOIN clients c ON c.id = q.client_id WHERE q.status='pending' AND ${SNOOZE_LIVE} AND ${acc.sql} GROUP BY mk ORDER BY n DESC LIMIT 6`).all()).results || [];
  const topMakes = makeRows.filter((r) => r.mk).map((r) => ({ name: displayName(r.mk), n: r.n }));
  // Pending lots whose auction closes within 48h, the work that can't wait.
  const closingList = (await run(`SELECT q.id, q.lot_json, c.name AS client_name FROM queue q JOIN clients c ON c.id = q.client_id WHERE q.status='pending' AND ${SNOOZE_LIVE} AND ${acc.sql} AND json_extract(q.lot_json,'$.auction_date') BETWEEN datetime('now') AND datetime('now','+48 hours') ORDER BY json_extract(q.lot_json,'$.auction_date') ASC LIMIT 6`).all()).results || [];

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

  // Hot leads: New requests nobody has touched yet. hot counts the ones past
  // the one-hour contact window, which flips the dashboard tile red.
  const newLeadsRow = (await run(
    `SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN w.created_at <= datetime('now','-1 hour') THEN 1 ELSE 0 END), 0) AS hot
       FROM wishlists w JOIN clients c ON c.id = w.client_id
      WHERE ${acc.sql} AND c.archived = 0 AND COALESCE(w.status, 'new') = 'new' AND w.last_activity IS NULL`
  ).first()) || {};
  const newUntouched = newLeadsRow.n || 0;
  const newHot = newLeadsRow.hot || 0;

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

  // Gone quiet (IA-AUDIT item 7): clients who ENGAGED (opened a sent car or
  // said interested), still have an active request, and have had no touch
  // (sent vehicle, note or logged contact tap) in 14+ days. This is the warm
  // re-contact list for the long deliberation cycle, distinct from Stalled,
  // which is request-activity based and blind to engagement.
  const gqCore = `
     FROM clients c
     JOIN (SELECT client_id, sent_at AS ts FROM queue WHERE sent_at IS NOT NULL
           UNION ALL SELECT client_id, created_at FROM activity WHERE type IN ('note','contact')) t ON t.client_id = c.id
    WHERE ${acc.sql} AND c.archived = 0
      AND EXISTS (SELECT 1 FROM queue qe WHERE qe.client_id = c.id AND (qe.viewed_at IS NOT NULL OR qe.response = 'interested'))
      AND EXISTS (SELECT 1 FROM wishlists we WHERE we.client_id = c.id AND COALESCE(we.status, 'new') NOT IN ('lost','delivered'))
    GROUP BY c.id, c.name
   HAVING MAX(t.ts) < datetime('now','-14 days')`;
  const goneQuietList = (await run(
    `SELECT c.id AS client_id, c.name AS client_name, MAX(t.ts) AS last_touch,
            (SELECT COUNT(*) FROM queue q3 WHERE q3.client_id = c.id AND q3.viewed_at IS NOT NULL) AS opened,
            (SELECT COUNT(*) FROM queue q4 WHERE q4.client_id = c.id AND q4.response = 'interested') AS interested
     ${gqCore} ORDER BY MAX(t.ts) ASC LIMIT 6`
  ).all()).results || [];
  const goneQuiet = (await run(`SELECT COUNT(*) AS n FROM (SELECT c.id ${gqCore})`).first())?.n || 0;

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

  // Scheduled follow-ups due (or overdue) today, "who needs attention today?".
  const nextActionList = (await run(
    `SELECT w.id, w.status, w.next_action_date, w.next_action_note, w.marka_name, w.model_name, c.name AS client_name, c.id AS client_id
       FROM wishlists w JOIN clients c ON c.id = w.client_id
      WHERE ${acc.sql} AND c.archived = 0 AND w.status NOT IN (${inTerminal})
        AND w.next_action_date IS NOT NULL AND w.next_action_date <= date('now')
      ORDER BY w.next_action_date ASC LIMIT 8`
  ).all()).results || [];
  const nextActionDue = nextActionList.length;

  // Who owes money, deposits requested but not paid (the list, for the panel).
  const depositsList = (await run(
    `SELECT w.id, w.status, w.price_max, w.marka_name, w.model_name, c.name AS client_name, c.id AS client_id, c.whatsapp AS client_whatsapp
       FROM wishlists w JOIN clients c ON c.id = w.client_id
      WHERE w.deposit_status = 'requested' AND ${acc.sql} AND c.archived = 0
      ORDER BY COALESCE(w.last_activity, w.created_at) ASC LIMIT 6`
  ).all()).results || [];

  // Closest to buying, interested / deposit stages, most-committed first.
  const closestList = (await run(
    `SELECT w.id, w.status, w.deposit_status, w.marka_name, w.model_name, c.name AS client_name, c.id AS client_id
       FROM wishlists w JOIN clients c ON c.id = w.client_id
      WHERE ${acc.sql} AND c.archived = 0
        AND w.status IN ('interested','deposit_requested','deposit_paid')
      ORDER BY CASE w.status WHEN 'deposit_paid' THEN 3 WHEN 'deposit_requested' THEN 2 ELSE 1 END DESC,
               COALESCE(w.last_activity, w.created_at) DESC LIMIT 6`
  ).all()).results || [];

  return { clients, agents, pending, closing, strength, people, reviewed, found, spend, sentWeek, requests, members, topMakes, closingList,
    stageCounts, openRequests, depositsOut, newUntouched, newHot, stalled, stalledList, tasksOverdue, tasksToday, tasksDueList,
    nextActionList, nextActionDue, depositsList, closestList, goneQuiet, goneQuietList };
}

// Dashboard home: time-aware greeting, animated overview, action cards, list.
function dashboardView(session, data) {
  const isAdmin = session.role === "admin";
  const who = isAdmin ? "Jate" : esc((session.name || "there").split(/\s+/)[0]);
  const ovLabel = isAdmin ? "Team overview" : "Your overview";
  // A KPI cell; when href is given it becomes a clickable shortcut to that view.
  // The real number renders server-side (never a 0 placeholder - launch audit).
  const metric = (n, label, gold, href) => {
    const v = Number(n) || 0;
    const inner = `<div class="num" data-count="${v}">${v.toLocaleString("en-AU")}</div><div class="cap">${label}</div>`;
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
    { label: "Strong", value: data.strength.Strong || 0, color: "var(--good)" },
    { label: "Good", value: data.strength.Good || 0, color: "var(--warn-c)" },
    { label: "Possible", value: data.strength.Possible || 0, color: "var(--t3)" },
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
      ${barsSvg(found, "var(--info)")}
      <div class="bars-x"><span>${dayLbl(found[0] && found[0].d)}</span><span>today</span></div>
    </div>`;
  // Most-wanted makes in the queue, a small horizontal bar list.
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
        ${barsSvg(rev, "var(--t3)")}
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
  // Real numbers server-side, same as metric() above (launch audit).
  const ac = (n, label, href, alert) => {
    const v = Number(n) || 0;
    const tone = v > 0 ? alert : "calm";
    return `<a class="acard acard-${tone}" href="${href}"><div class="ac-n" data-count="${v}">${v.toLocaleString("en-AU")}</div><div class="ac-l">${label}</div></a>`;
  };
  // Decision order, not category order: who to call this hour, what closes,
  // what to send, who to chase, then money and tasks. The hot-lead tile goes
  // red the moment an untouched New request passes the one-hour window.
  const attention = `<div class="attn">
    <div class="attn-h">Needs attention today</div>
    <div class="acards">
      ${ac(data.newUntouched, "New leads to contact", "/admin?view=requests", data.newHot > 0 ? "bad" : "warn")}
      ${ac(data.closing, "Closing in 48h", "/admin?view=matches", "warn")}
      ${ac(data.pending, "Matches to review", "/admin?view=matches", "gold")}
      ${ac(data.nextActionDue, "Follow-ups due", "/admin?view=requests", "warn")}
      ${ac(data.stalled, "Stalled requests", "/admin?view=requests", "bad")}
      ${ac(data.depositsOut, "Deposits outstanding", isAdmin ? "/admin?view=payments" : "/admin?view=requests", "warn")}
      ${ac(data.tasksOverdue, "Overdue tasks", "/admin?view=tasks", "bad")}
      ${ac(data.tasksToday, "Tasks due today", "/admin?view=tasks", "warn")}
    </div>
  </div>`;

  const JOURNEY = ["new", "qualified", "searching", "vehicles_sent", "interested", "deposit_paid", "purchased", "delivered"];
  const pipelineStrip = `<div class="pipestrip">${JOURNEY.map((id) => {
    const s = RSTATUS[id] || { label: id };
    return `<a class="ps-c" href="/admin?view=requests" title="${esc(s.label)}"><span class="ps-n">${(data.stageCounts && data.stageCounts[id]) || 0}</span><span class="ps-l">${esc(s.label)}</span></a>`;
  }).join('<span class="ps-arrow">&rsaquo;</span>')}</div>`;

  // My tasks due (overdue + today), from the scoped list.
  const dueColor = (t) => t === "over" ? "var(--bad)" : t === "today" ? "var(--warn-c)" : "var(--t3)";
  const taskRows = (data.tasksDueList || []).map((t) => {
    const d = taskDue(t.due_date);
    return `<a class="lrow" href="${t.wishlist_id ? `/admin?view=request&id=${t.wishlist_id}` : "/admin?view=tasks"}">
        <div class="who"><div class="nm">${esc(t.title)}</div><div class="sub">${t.client_name ? esc(t.client_name) + " · " : ""}<span style="color:${dueColor(d.tone)};font-weight:600">${esc(d.label)}</span></div></div>
      </a>`;
  }).join("") || `<div class="lrow"><div class="who"><div class="sub">Nothing due today. Nice.</div></div></div>`;
  // Each dashboard section is ONE grid item (heading above its own list). As
  // two loose siblings, the .dcols two-column grid auto-placed every heading
  // into column 1 and every list into column 2, which shattered the layout.
  const dsec = (head, list) => `<div class="dsec">${head}${list}</div>`;
  // Gold marks a primary action; a zero-count section has nothing to act on,
  // so its button drops to the quiet outline until the count returns.
  const secBtn = (n, href, label) => `<a class="${Number(n) > 0 ? "btn-primary" : "btn-secondary"}" href="${href}">${label} ${ICONS.arrow}</a>`;
  const tasksSection = dsec(`<div class="sec-h"><h2>My tasks <span class="ct">(${(data.tasksOverdue || 0) + (data.tasksToday || 0)})</span></h2>${secBtn((data.tasksOverdue || 0) + (data.tasksToday || 0), "/admin?view=tasks", "Open")}</div>`, `<div class="list">${taskRows}</div>`);

  // Stalled requests, no movement in 14 days.
  const stalledRows = (data.stalledList || []).map((w) => {
    const veh = displayName([w.marka_name, w.model_name].filter(Boolean).join(" ")) || "Any vehicle";
    return `<a class="lrow" href="/admin?view=request&id=${w.id}">
        ${avatar(w.client_name)}
        <div class="who"><div class="nm">${esc(veh)}</div><div class="sub">${esc(w.client_name)} · ${esc(lastActivityLabel(w.last_activity))}</div></div>
        <div class="meta"><span class="b b-warn">${esc((RSTATUS[w.status] || {}).label || w.status)}</span></div>
      </a>`;
  }).join("") || `<div class="lrow"><div class="who"><div class="sub">No stalled requests. Everything's moving.</div></div></div>`;
  const stalledSection = dsec(`<div class="sec-h"><h2>Which requests are stalled? <span class="ct">(${data.stalled || 0})</span></h2>${secBtn(data.stalled, "/admin?view=requests", "Review")}</div>`, `<div class="list">${stalledRows}</div>`);

  // Reframe the closing-soon list as a question to match the rest of the board.
  // The list and count deliberately look 48h ahead ("the work that can't
  // wait"), so the heading must say so (launch audit: it claimed "today").
  const closingQ = dsec(`<div class="sec-h"><h2>Which auctions close within 48h? <span class="ct">(${data.closing || 0})</span></h2>${secBtn(data.closing, "/admin?view=matches", "Review")}</div>`, `<div class="list">${closingRows}</div>`);

  // Who needs attention today, scheduled follow-ups due (or overdue).
  const naRows = (data.nextActionList || []).map((w) => {
    const veh = displayName([w.marka_name, w.model_name].filter(Boolean).join(" ")) || "Any vehicle";
    const d = taskDue(w.next_action_date);
    return `<a class="lrow" href="/admin?view=request&id=${w.id}">
        ${avatar(w.client_name)}
        <div class="who"><div class="nm">${esc(w.client_name)}</div><div class="sub">${esc(veh)}${w.next_action_note ? " · " + esc(w.next_action_note) : ""}</div></div>
        <div class="meta"><span class="b ${d.tone === "over" ? "b-warn" : "b-neu"}">${esc(d.label)}</span></div>
      </a>`;
  }).join("") || `<div class="lrow"><div class="who"><div class="sub">Nothing scheduled for today. You're clear.</div></div></div>`;
  const attentionSection = dsec(`<div class="sec-h"><h2>Who needs attention today? <span class="ct">(${data.nextActionDue || 0})</span></h2>${secBtn(data.nextActionDue, "/admin?view=requests", "Open")}</div>`, `<div class="list">${naRows}</div>`);

  // Who owes money, deposits requested, not yet paid.
  // IA-AUDIT item 14: the owes list answers "how", not just "who" - a chase
  // deep link with the logged-touch beacon sits where the badge was. A div
  // row (not an anchor) so the chase link can nest validly.
  const owesRows = (data.depositsList || []).map((w) => {
    const veh = displayName([w.marka_name, w.model_name].filter(Boolean).join(" ")) || "Any vehicle";
    const chase = chaseWaLink(w.client_id, w.client_whatsapp, w.client_name, veh);
    return `<div class="lrow">
        ${avatar(w.client_name)}
        <div class="who"><div class="nm"><a class="clink" href="/admin?view=request&id=${w.id}">${esc(w.client_name)}</a></div><div class="sub">${esc(veh)}</div></div>
        <div class="meta">${chase || `<span class="b b-warn">Deposit requested</span>`}</div>
      </div>`;
  }).join("") || `<div class="lrow"><div class="who"><div class="sub">No deposits outstanding.</div></div></div>`;
  const owesSection = dsec(`<div class="sec-h"><h2>Who owes money? <span class="ct">(${data.depositsOut || 0})</span></h2>${secBtn(data.depositsOut, `/admin?view=${isAdmin ? "payments" : "requests"}`, "Open")}</div>`, `<div class="list">${owesRows}</div>`);

  // Who's closest to buying, interested / deposit stages, most-committed first.
  const closeRows = (data.closestList || []).map((w) => {
    const veh = displayName([w.marka_name, w.model_name].filter(Boolean).join(" ")) || "Any vehicle";
    const lbl = (RSTATUS[w.status] || {}).label || w.status;
    return `<a class="lrow" href="/admin?view=request&id=${w.id}">
        ${avatar(w.client_name)}
        <div class="who"><div class="nm">${esc(w.client_name)}</div><div class="sub">${esc(veh)}</div></div>
        <div class="meta"><span class="b ${w.status === "deposit_paid" ? "b-ok" : "b-warn"}">${esc(lbl)}</span></div>
      </a>`;
  }).join("") || `<div class="lrow"><div class="who"><div class="sub">No one at the deposit stage yet.</div></div></div>`;
  const closestSection = dsec(`<div class="sec-h"><h2>Who's closest to buying? <span class="ct">(${(data.closestList || []).length})</span></h2>${secBtn((data.closestList || []).length, "/admin?view=requests", "Open")}</div>`, `<div class="list">${closeRows}</div>`);

  // Who's gone quiet: engaged buyers with no touch in 14+ days (IA-AUDIT
  // item 7). The deliberation cycle means these are warm, not dead; oldest
  // silence first because it is closest to going cold for good.
  const gqRows = (data.goneQuietList || []).map((g) => `<a class="lrow" href="/admin?view=client&id=${g.client_id}">
      ${avatar(g.client_name)}
      <div class="who"><div class="nm">${esc(g.client_name)}</div><div class="sub">${[g.opened ? `${g.opened} opened` : "", g.interested ? `${g.interested} interested` : ""].filter(Boolean).join(" · ") || "engaged"}</div></div>
      <div class="meta"><span class="b b-warn">Quiet ${esc(relTime(g.last_touch))}</span></div>
    </a>`).join("") || `<div class="lrow"><div class="who"><div class="sub">No engaged buyers have gone quiet. All warm leads are being worked.</div></div></div>`;
  const goneQuietSection = dsec(`<div class="sec-h"><h2>Who's gone quiet? <span class="ct">(${data.goneQuiet || 0})</span></h2>${secBtn(data.goneQuiet, "/admin?view=clients", "Open")}</div>`, `<div class="list">${gqRows}</div>`);

  // Hierarchy (top → bottom): what needs action today → pipeline → business
  // snapshot → detail lists → trend charts. The attention band leads because
  // it is the operational read (hot leads, deadlines, the send queue); the
  // team roll-up is a weekly-changing vanity register, so it sits below the
  // actionable bands rather than spending the first phone screen (IA-AUDIT
  // item 6, approved 4 July).
  return `<div class="dash">
      ${topbar}
      <div class="dkick"><span class="live"></span> JDM Connect, vehicle finder</div>
      <h1 class="greet"><span id="greetTime">Good morning</span>,<br><span class="nm">${who}</span></h1>
      ${watchAlertBlock("/admin?view=auctions&tab=watch")}
      ${attention}
      ${pipelineStrip}
      ${overview}
      <div class="dcols">${attentionSection}${closingQ}</div>
      <div class="dcols">${goneQuietSection}${stalledSection}</div>
      <div class="dcols">${owesSection}${closestSection}</div>
      <div class="dcols">${tasksSection}</div>
      ${charts}
    </div>${DASH2_CSS}${dashScript()}`;
}

const DASH2_CSS = `<style>
  /* One grid item per Q&A section: heading sits above its own list. */
  .dsec{min-width:0}
  /* Quiet outline for a zero-count section button (gold is earned by a count;
     six identical gold Opens meant no primary at all). Same alias as the
     record pages' btn-secondary. */
  .sec-h a.btn-secondary{display:inline-flex;align-items:center;text-decoration:none;font-size:var(--fs-sec);font-weight:600;padding:8px 16px;border-radius:var(--r-ctl);background:transparent;border:1px solid var(--hair);color:var(--t2);white-space:nowrap}
  .sec-h a.btn-secondary:hover{border-color:var(--field-line);color:var(--ink)}
  /* Snapshot roll-up now leads the dashboard; tighten the rhythm so it sits as
     a compact band above the attention cards instead of floating mid-page. */
  .dash .overview{margin-bottom:var(--sp-5)}
  .attn{margin:0 0 4px}
  .attn-h{font-size:var(--fs-label);font-weight:var(--w-label);letter-spacing:var(--ls-label);text-transform:uppercase;color:var(--t3);margin:0 0 12px}
  .acards{display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:12px}
  .acard{display:block;text-decoration:none;background:var(--card);border:1px solid var(--hair);border-radius:var(--r-card);padding:16px;transition:border-color .15s,transform .15s}
  .acard:hover{transform:translateY(-2px)}
  .ac-n{font-size:var(--fs-page);font-weight:700;letter-spacing:var(--ls-num);line-height:1;color:var(--ink);font-variant-numeric:tabular-nums}
  .ac-l{font-size:var(--fs-label);color:var(--t3);margin-top:8px}
  .acard-bad{border-color:var(--bad-line,var(--bad-bg))}.acard-bad .ac-n{color:var(--bad)}
  .acard-warn{border-color:var(--warn-c)}.acard-warn .ac-n{color:var(--warn-c)}
  .acard-gold{border-color:var(--gold-line)}.acard-gold .ac-n{color:var(--ink)}
  .acard-calm .ac-n{color:var(--t2)}
  .pipestrip{display:flex;align-items:center;gap:2px;flex-wrap:nowrap;background:var(--card);border:1px solid var(--hair);border-radius:var(--r-card);padding:12px;margin:16px 0 4px;overflow-x:auto}
  .ps-c{display:flex;flex-direction:column;align-items:center;gap:4px;text-decoration:none;padding:4px 8px;border-radius:var(--r-ctl);min-width:62px}
  .ps-c:hover{background:var(--hover,rgba(0,0,0,.04))}
  .ps-n{font-size:var(--fs-sect);font-weight:700;letter-spacing:var(--ls-num);color:var(--ink);font-variant-numeric:tabular-nums}
  .ps-l{font-size:var(--fs-label);color:var(--t3);text-align:center;line-height:1.2}
  .ps-arrow{color:var(--faint);font-size:var(--fs-body);flex:none}
</style>`;

function intakeView(makers, opts = {}) {
  // One-step new request: the customer AND the car in a single form. On submit
  // (/request/new -> createAdminRequest) we match an existing customer by email
  // or phone and attach the request, or create a new customer - no more "add
  // the client, then add their search" double-handling. After a validation
  // error the submitted values come back via opts.vals, so the fix is one field.
  const vals = opts.vals || {};
  const vv = (k) => esc(vals[k] || "");
  const errBanner = opts.err === "contact"
    ? `<div class="reqerr">Add an email or a WhatsApp number so we can reach this customer. A customer with no contact cannot be sent matches.</div>`
    : opts.err === "name"
    ? `<div class="reqerr">Please enter the customer's name.</div>`
    : opts.err === "email"
    ? `<div class="reqerr">That email address doesn't look right. Please check it and try again.</div>`
    : opts.err === "whatsapp"
    ? `<div class="reqerr">That phone number doesn't look right. Use the full number with area code, e.g. +61 4XX XXX XXX.</div>`
    : opts.err === "limit"
    ? `<div class="reqerr">This customer already has the maximum number of active searches. Pause or delete one from their profile first.</div>`
    : opts.err
    ? `<div class="reqerr">Sorry, that could not be saved. Please try again.</div>`
    : "";
  return `
    <style>.intake-sub{font-size:var(--fs-label);font-weight:var(--w-label);letter-spacing:var(--ls-label);text-transform:uppercase;color:var(--t3);margin:24px 0 12px}.intake-sub:first-of-type{margin-top:8px}.intake-sub .opt{text-transform:none;letter-spacing:0}</style>
    <div class="card">
      <h2>New request</h2>
      <p class="help" style="margin:-4px 0 20px">One form for the customer and the car they want. We match an existing customer by email or phone and attach this request to them, or create a new customer if they're new. Leave the car blank to save the customer now and add their search later.</p>
      <form method="POST" action="/request/new">
        ${errBanner}
        <h3 class="intake-sub">Customer</h3>
        <div class="grid">
          <div><label for="ic-name">Name</label><input id="ic-name" name="name" maxlength="120" placeholder="Jane Citizen" value="${vv("name")}" required></div>
          <div><label for="ic-email">Email <span class="opt">(email or WhatsApp required)</span></label><input id="ic-email" name="email" type="email" maxlength="254" spellcheck="false" placeholder="name@email.com" value="${vv("email")}"></div>
          <div><label for="ic-whatsapp">WhatsApp <span class="opt">(email or WhatsApp required)</span></label><input id="ic-whatsapp" name="whatsapp" maxlength="40" placeholder="+61 4XX XXX XXX" value="${vv("whatsapp")}"></div>
          <div><label for="ic-state">State <span class="opt">(for landed cost)</span></label><select id="ic-state" name="state">${stateOptions(vals.state || "")}</select></div>
          <div><label for="ic-category">Category <span class="opt">(dealer = trade buyer)</span></label>${categorySelect("ic-category", vals.category)}</div>
        </div>
        <h3 class="intake-sub">The car they're chasing <span class="opt">(optional - add it now or later)</span></h3>
        ${presetSelect()}
        <div class="grid">
          <div><label>Label<input name="label" placeholder="e.g. under 1.5M daily" value="${vv("label")}"></label></div>
          <div><label for="wl-maker">Make</label>${makerField(makers, "wl-maker", "Any maker", vals.marka_name || "")}</div>
          <div><label>Model${modelField("wl-models", vals.model_name || "")}</label></div>
          <div><label>Year min<input name="year_min" type="number" placeholder="1990" value="${vv("year_min")}"></label></div>
          <div><label>Year max<input name="year_max" type="number" placeholder="2002" value="${vv("year_max")}"></label></div>
          <div><label>Max price (JPY)<input name="price_max" type="number" placeholder="1,500,000" value="${vv("price_max")}"></label></div>
          <div><label>Min mileage (km)<input name="mileage_min" type="number" placeholder="0" value="${vv("mileage_min")}"></label></div>
          <div><label>Max mileage (km)<input name="mileage_max" type="number" placeholder="80,000" value="${vv("mileage_max")}"></label></div>
          <div><label>Min grade<input name="rate_min" type="number" step="any" placeholder="e.g. 4" value="${vv("rate_min")}"></label></div>
          <div><label>Chassis / model code <span class="opt">(contains, best match)</span><input name="kuzov" placeholder="e.g. JZA80 or 211" value="${vv("kuzov")}"></label></div>
          <div><label>Grade keyword <span class="opt">(contains)</span><input name="grade_kw" placeholder="e.g. RS" value="${vv("grade_kw")}"></label></div>
          <div><label for="wl-code">Model code <span class="opt">(exact variant)</span></label><select id="wl-code" name="model_code"><option value="">Any model code</option></select></div>
          <div><label for="wl-grades">Grades <span class="opt">(pick every spelling)</span></label><select id="wl-grades" name="grades" multiple size="4"></select></div>
        </div>
        <label style="display:flex;align-items:flex-start;gap:8px;margin-top:16px;font-size:var(--fs-sec);color:var(--t2);cursor:pointer"><input type="checkbox" name="watch_only" value="1" style="width:auto;margin-top:2px"><span><strong>Watch only (lead).</strong> Surface matches for a follow-up call, but never auto-email this customer. Good for buyers who aren't ready yet, especially rare cars.</span></label>
        <div class="actions"><button class="btn-primary" type="submit">Add request</button>
          <span class="help">Name plus a way to reach them (email or WhatsApp) is required. The car can be filled in later.</span></div>
      </form>
    </div>
    ${modelScript("wl-maker", "wl-models")}${codeGradeScript("wl-maker", "wl-models", "wl-code", "wl-grades")}${presetScript()}`;
}

function clientsView(clients, wishlists, opts = {}) {
  const session = opts.session || { role: "admin" };
  const agents = opts.agents || [];
  const shares = opts.shares || {};
  // Two orthogonal filters, applied in-memory (the list is already loaded, and
  // the tabs need every count regardless):
  //   ?cat = private | dealer          (trade vs retail)
  //   ?src = jdm | public              (who added them)
  // A client's source is 'public' only when they submitted the request form or
  // signed in themselves; everything else (staff/agent added, or legacy NULL
  // rows) counts as "Added by JDM".
  const cat = opts.cat || "";
  const src = opts.src || "";
  const isPublic = (c) => c.source === "public";
  const matchCat = (c) => !cat || (c.category || "private") === cat;
  const matchSrc = (c) => !src || (src === "public" ? isPublic(c) : !isPublic(c));
  const catCount = (id) => clients.filter((c) => (c.category || "private") === id && matchSrc(c)).length;
  const srcCount = (id) => clients.filter((c) => (id === "public" ? isPublic(c) : !isPublic(c)) && matchCat(c)).length;
  const filteredList = clients.filter((c) => matchCat(c) && matchSrc(c));
  // IA-AUDIT item 10: the working set floats up - most recent contact first,
  // never-contacted prospects last (Attio's last-touched default, not A-Z).
  const lastContact = opts.lastContact || {};
  const list = [...filteredList].sort((a, b) => {
    const ta = tsMs(lastContact[a.id]) || 0, tb = tsMs(lastContact[b.id]) || 0;
    return (tb - ta) || String(a.name || "").localeCompare(String(b.name || ""));
  });
  const countFor = (id) => wishlists.filter((w) => w.client_id === id).length;
  const canManage = (c) => session.role === "admin" || Number(c.agent_id) === Number(session.id);
  const pendingCounts = opts.pendingCounts || {};
  const engagedClients = opts.engagedClients || new Set();
  // Furthest-along pipeline stage across the client's requests (lost only when
  // everything is lost), so "who is close to money" reads without opening rows.
  const stageIdx = Object.fromEntries(REQUEST_STATUSES.map((s, i) => [s.id, i]));
  const stageFor = (id) => {
    const sts = wishlists.filter((w) => w.client_id === id).map((w) => w.status || "new");
    if (!sts.length) return "";
    const live = sts.filter((s) => s !== "lost");
    if (!live.length) return "lost";
    return live.reduce((best, s) => ((stageIdx[s] ?? 0) > (stageIdx[best] ?? 0) ? s : best), live[0]);
  };
  const mwCell = (id) => {
    const n = pendingCounts[id] || 0;
    return n ? `<a class="mw-link" href="/admin?view=client&id=${id}" title="${n} live match${n === 1 ? "" : "es"} awaiting review">${n}</a>` : `<span class="mw-zero">0</span>`;
  };
  // State-aware contact dot (replaces ambient alarm): neutral when never
  // contacted, green fresh, amber cooling, red only past 14d with prior
  // engagement - red then MEANS a warm buyer going cold.
  const contactDot = (c) => {
    const t = tsMs(lastContact[c.id]);
    if (!Number.isFinite(t)) return `<span class="health health-neutral" title="Never contacted" aria-label="Never contacted"></span>`;
    const days = (Date.now() - t) / 86400000;
    const tone = days <= 7 ? "green" : (days > 14 && engagedClients.has(c.id)) ? "red" : "amber";
    const title = `Last contacted ${Math.floor(days)} day${Math.floor(days) === 1 ? "" : "s"} ago${tone === "red" ? ", engaged buyer going quiet" : ""}`;
    return `<span class="health health-${tone}" title="${title}" aria-label="${title}"></span>`;
  };

  const shareCell = (c) => {
    const shared = shares[c.id] || [];
    const chips = shared.map((a) =>
      canManage(c)
        ? `<form method="POST" action="/share/remove" style="display:inline" title="Remove ${esc(a.name)}" data-confirm="Stop sharing this client with ${esc(a.name)}? They lose access to the client's searches and matches."><input type="hidden" name="client_id" value="${c.id}"><input type="hidden" name="agent_id" value="${a.id}"><button class="chip chip-on" type="submit">${esc(a.name)} ✕</button></form>`
        : `<span class="chip">${esc(a.name)}</span>`
    ).join(" ");
    if (!canManage(c)) return chips || `<span class="chip muted">shared with you</span>`;
    const sharedIds = new Set(shared.map((a) => Number(a.id)));
    const opts2 = agents
      .filter((a) => Number(a.id) !== Number(c.agent_id) && !sharedIds.has(Number(a.id)))
      .map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join("");
    const picker = opts2
      ? `<form method="POST" action="/share" style="display:inline"><input type="hidden" name="client_id" value="${c.id}"><select name="agent_id" class="share-pick" aria-label="Share ${esc(c.name)} with an agent" onchange="if(this.value)jdmConfirmSelect(this,'Share this client with the selected agent? They can see and action the client, but not delete or reassign them.')"><option value="">+ share…</option>${opts2}</select></form>`
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
    // matches), so confirm and revert on cancel, never a silent stray-click write.
    return `<form method="POST" action="/client/assign" style="display:inline"><input type="hidden" name="client_id" value="${c.id}"><select name="agent_id" class="share-pick" aria-label="Owner for ${esc(c.name)}" onfocus="this.dataset.prev=this.value" onchange="jdmConfirmSelect(this,'Reassign this client to the selected owner? They get the client and all their searches, matches and alerts.')">${opts}</select></form>`;
  };

  // Derived last-contacted (sent vehicles + notes + logged contact taps).
  const contactCell = (c) => {
    const t = lastContact[c.id];
    return `${contactDot(c)}${esc(t ? lastActivityLabel(t) : "never")}`;
  };
  // Portal sign-in recency (clients.last_seen, stamped on every login). A dash
  // for clients with no portal access - "never" only means something when a
  // login actually exists to use.
  const lastLoginCell = (c) => c.last_seen
    ? `<span style="white-space:nowrap">${esc(relTime(c.last_seen))}</span>`
    : (c.portal_enabled ? `<span class="chip muted">never</span>` : `<span class="mw-zero">&mdash;</span>`);
  // Attio register: one identity cell (name over a muted email/state line,
  // Dealer marked with the neutral chip) instead of Type / Email / State
  // columns. Search still matches email and state; they live in the cell.
  const rows = list.map((c) =>
    `<tr>
      ${isAdmin ? `<td><input type="checkbox" name="ids" value="${c.id}" form="bulkform"></td>` : ""}
      <td>${avatar(c.name)}<span class="idcell"><span><a class="clink" href="/admin?view=client&id=${c.id}" data-drawer="/admin/drawer?id=${c.id}">${esc(c.name)}</a>${isDealer(c) ? ` <span class="chip">Dealer</span>` : ""}${isPublic(c) ? ` <span class="chip muted">Public</span>` : ""}</span><span class="idsub">${[esc(c.email || ""), esc(c.state || "")].filter(Boolean).join(" &middot; ")}</span></span></td>
      <td style="text-align:right">${countFor(c.id)}</td>
      <td style="text-align:right">${mwCell(c.id)}</td>
      <td>${stageFor(c.id) ? statusBadge(stageFor(c.id)) : `<span class="chip muted">&mdash;</span>`}</td>
      <td style="white-space:nowrap">${contactCell(c)}</td>
      <td>${lastLoginCell(c)}</td>
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
  ).join("") || `<tr><td colspan="${isAdmin ? 10 : 8}" class="empty">${cat ? `No ${cat === "dealer" ? "dealer" : "private"} clients${opts.showArchived ? " in the archive" : ""} yet.` : `No clients yet. <a href="/admin?view=intake" style="color:var(--gold-txt);font-weight:600;text-decoration:underline">Add your first client</a>.`}</td></tr>`;

  // Admin bulk bar. "Delete selected" is its own red button (not buried in a
  // dropdown) so it's obvious; assign/share only appear when there are agents.
  // Each button checks something is ticked; delete also confirms with the count.
  // IA-AUDIT item 10: the bar appears only when something is ticked (the
  // Matches rule), so a destructive Delete and a no-op gold Apply are not the
  // page's most prominent chrome at rest.
  const bulkBar = isAdmin
    ? `<form id="bulkform" method="POST" action="/clients/bulk" class="bulkbar">
        <span class="bulk-label"><span id="bulkSel">0</span> selected:</span>
        <select name="action" class="share-pick">${agents.length ? `<option value="assign">Assign owner</option><option value="share">Share with</option>` : ""}<option value="${opts.showArchived ? "unarchive" : "archive"}">${opts.showArchived ? "Restore" : "Archive"}</option></select>
        ${agents.length ? `<select name="agent_id" class="share-pick"><option value="">JDM Connect</option>${agents.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join("")}</select>` : ""}
        <button class="btn-primary" type="submit" name="do" value="apply" onclick="return jdmBulkApply(this)">Apply</button>
        <label class="bulk-inc" title="Off by default, customers owned by an agent are protected from a bulk delete. Tick this to remove them too."><input type="checkbox" name="confirm_agents" value="1"> Include agents' customers</label>
        <button class="btn-danger bulk-del" type="submit" name="do" value="delete" onclick="return jdmBulkDelete(this)">${ICONS.trash || ""}Delete selected</button>
      </form>
      <script>function jdmBulkTicked(f){var n=0,e=f.elements;for(var i=0;i<e.length;i++){if(e[i].name==='ids'&&e[i].checked)n++;}return n;}
      document.addEventListener('change',function(e){var t=e.target;if(!t||t.type!=='checkbox')return;setTimeout(function(){var f=document.getElementById('bulkform');if(!f)return;var n=jdmBulkTicked(f);f.classList.toggle('show',n>0);var s=document.getElementById('bulkSel');if(s)s.textContent=n;},0);});
      function jdmBulkApply(btn){var f=btn.form;if(!jdmBulkTicked(f)){jdmToast('Tick the clients you want first, then Apply.');return false;}return true;}
      function jdmBulkDelete(btn){var f=btn.form;if(f.dataset.jdmConfirmed==='1'){f.dataset.jdmConfirmed='';return true;}var n=jdmBulkTicked(f);if(!n){jdmToast('Tick the clients you want to delete first.');return false;}
        var inc=f.elements['confirm_agents']&&f.elements['confirm_agents'].checked;
        var guard=inc?' This includes any that belong to an agent.':' Customers owned by an agent are protected and will be skipped.';
        jdmConfirm('Delete '+n+' selected customer'+(n===1?'':'s')+' and ALL their searches, matches and history?'+guard+' This cannot be undone.',{danger:true,okLabel:'Delete'}).then(function(ok){if(ok){f.dataset.jdmConfirmed='1';if(f.requestSubmit){f.requestSubmit(btn);}else{f.submit();}}});
        return false;}</script>`
    : "";

  const headCheck = isAdmin ? `<th style="width:30px"><input type="checkbox" onclick="jdmSelectAllVisible(this,'ids')" title="Select all"></th>` : "";
  const headOwner = isAdmin ? `<th>Owner</th>` : "";
  // Build a clients URL that keeps the OTHER active filters when one changes, so
  // switching category doesn't drop the source filter (and vice versa).
  const clientsUrl = (over = {}) => {
    const c = over.cat !== undefined ? over.cat : cat;
    const s = over.src !== undefined ? over.src : src;
    const ar = over.archived !== undefined ? over.archived : opts.showArchived;
    const p = ["view=clients"];
    if (c) p.push(`cat=${c}`);
    if (s) p.push(`src=${s}`);
    if (ar) p.push("archived=1");
    return `/admin?${p.join("&")}`;
  };
  const archToggle = isAdmin ? `<a href="${clientsUrl({ archived: !opts.showArchived })}" style="font-size:var(--fs-label);font-weight:600;color:var(--t3);text-decoration:none;white-space:nowrap">${opts.showArchived ? "&larr; Hide archived" : "Show archived"}</a>` : "";
  // Two filter rows. Category (trade vs retail) and source (who added them),
  // each with live counts that respect the other active filter.
  const catTabs = `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${[["", "All"], ["private", "Private"], ["dealer", "Dealers"]].map(([id, label]) =>
    `<a class="chip ${cat === id ? "chip-on" : "muted"}" style="text-decoration:none" href="${clientsUrl({ cat: id })}">${label}${id ? ` (${catCount(id)})` : ""}</a>`).join("")}</div>`;
  const srcTabs = `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${[["", "Everyone"], ["jdm", "Added by JDM"], ["public", "Public sign-ups"]].map(([id, label]) =>
    `<a class="chip ${src === id ? "chip-on" : "muted"}" style="text-decoration:none" href="${clientsUrl({ src: id })}">${label}${id ? ` (${srcCount(id)})` : ""}</a>`).join("")}</div>`;
  // Mobile card list: name, contact, searches and owner without the 560px-wide
  // table's horizontal scroll. Bulk allocation stays a desktop tool.
  const ownerName = (c) => {
    if (!c.agent_id) return "JDM Connect";
    const a = agents.find((x) => Number(x.id) === Number(c.agent_id));
    return a ? a.name : "JDM Connect";
  };
  const mobile = `<div class="mcl">${list.map((c) => mobileCardRow({
    href: `/admin?view=client&id=${c.id}`,
    name: c.name,
    title: esc(c.name),
    meta: [esc(c.email || ""), esc(c.state || ""), `${countFor(c.id)} search${countFor(c.id) === 1 ? "" : "es"}`, pendingCounts[c.id] ? `<b>${pendingCounts[c.id]} match${pendingCounts[c.id] === 1 ? "" : "es"} waiting</b>` : "", c.last_seen ? `last login ${esc(relTime(c.last_seen))}` : "", isAdmin ? esc(ownerName(c)) : ""].filter(Boolean).join(" &middot; "),
    right: `${stageFor(c.id) ? statusBadge(stageFor(c.id)) : ""}${isDealer(c) ? `<span class="chip">Dealer</span>` : ""}${isPublic(c) ? `<span class="chip muted">Public</span>` : ""}${c.archived ? `<span class="chip muted">archived</span>` : ""}`,
    rightSub: contactCell(c),
  })).join("") || `<div class="empty">No clients yet. <a href="/admin?view=intake" style="color:var(--gold-txt);font-weight:600;text-decoration:underline">Add your first client</a>.</div>`}</div>`;
  return `${opts.showArchived ? `<div class="dupnote" style="margin-bottom:16px">Showing archived customers. <a href="/admin?view=clients" style="color:var(--gold-txt);font-weight:600">Back to active</a></div>` : ""}${bulkBar}<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:var(--sp-3)"><div style="flex:1;min-width:220px">${tableToolbar("clientsTbl", "Search clients by name, email or state…", "jdm-clients")}</div><div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">${catTabs}<span style="width:1px;height:20px;background:var(--hair)"></span>${srcTabs}</div>${archToggle}</div>${mobile}<div class="card tbl-desk" style="padding:0;overflow-x:auto;-webkit-overflow-scrolling:touch">
    <table id="clientsTbl" class="sortable"><tr>${headCheck}<th>Client</th><th style="text-align:right">Searches</th><th style="text-align:right">Matches waiting</th><th>Stage</th><th>Last contact</th><th>Last login</th>${headOwner}<th>Shared with</th><th></th></tr>${rows}</table></div>${isAdmin ? `<p class="help" style="margin:var(--sp-3) 0 0;font-size:var(--fs-label)">Owner = whose dashboard a client lives on, and who gets their match alerts. Shared with = other agents who can also see and action them.</p>` : ""}<style>
    .bulkbar{display:none}
    .bulkbar.show{display:flex}
    .mw-link{font-weight:700;color:var(--gold-txt);text-decoration:none;letter-spacing:var(--ls-num)}
    .mw-link:hover{text-decoration:underline}
    .mw-zero{color:var(--faint)}
    .mcl-m b{color:var(--gold-txt);font-weight:600}
  </style>`;
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
// Map a status tone onto the ONE chip component's tone classes. Green / amber /
// red carry health and urgency; info blue = actively being worked; neutral =
// not started. Gold is never a status colour.
const CHIP_TONE = { pending: "muted", active: "chip-info", warn: "chip-warn", good: "chip-good", win: "chip-good", bad: "chip-bad" };
function statusBadge(id) {
  const s = RSTATUS[id] || RSTATUS.new;
  return `<span class="chip ${CHIP_TONE[s.tone] || "muted"}">${esc(s.label)}</span>`;
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
// "Have we sent this client examples, and did they open them?", derived from
// queue.sent_at / queue.viewed_at (no login tracking needed). Viewed is the
// strongest buying signal, so it reads gold; sent-but-unopened reads amber;
// nothing sent stays muted. Powers the Requests "Examples" column.
function engagementCell(sent, viewed) {
  const s = Number(sent) || 0, v = Number(viewed) || 0;
  if (s === 0) return `<span class="chip muted" title="No vehicle examples sent yet">Not sent</span>`;
  if (v > 0) return `<span class="chip chip-info" title="${v} of ${s} sent example${s === 1 ? "" : "s"} opened by the client">Sent &middot; viewed</span>`;
  return `<span class="chip chip-warn" title="${s} example${s === 1 ? "" : "s"} sent, not opened yet">Sent &middot; unopened</span>`;
}

// Requests list: the operational pipeline. Each row is a customer's search, with
// a health dot, live status change, owner and last-activity. Pipeline cards along
// the top show the count at each stage and filter the table on click.
// One row of the mobile card list that replaces a table below 640px. Values
// arriving here are already HTML (escaped by the caller).
function mobileCardRow({ href, drawer, name, title, meta, right, rightSub, attrs = "" }) {
  const tag = href ? "a" : "div";
  const link = href ? ` href="${esc(href)}"${drawer ? ` data-drawer="${esc(drawer)}"` : ""}` : "";
  return `<${tag} class="mcl-row"${link}${attrs}>
    ${avatar(name || "?")}
    <div class="mcl-b">
      <div class="mcl-t">${title}</div>
      ${meta ? `<div class="mcl-m">${meta}</div>` : ""}
    </div>
    <div class="mcl-r">${right || ""}${rightSub ? `<span class="mcl-rs">${rightSub}</span>` : ""}</div>
  </${tag}>`;
}

// List | Board layout switch shared by both renderings of the Requests view.
function reqLayoutToggle(layout) {
  return `<div class="lay-row"><div class="lay-toggle" role="tablist" aria-label="Pipeline layout">
    <a href="/admin?view=requests" class="${layout === "board" ? "" : "on"}" role="tab" aria-selected="${layout !== "board"}">List</a>
    <a href="/admin?view=requests&layout=board" class="${layout === "board" ? "on" : ""}" role="tab" aria-selected="${layout === "board"}">Board</a>
  </div></div>`;
}

// Pipedrive-style kanban: one column per stage, requests as draggable cards.
// Dragging a card to another column POSTs /request/status (the same endpoint
// the list's dropdowns use); the compact select on each card is the fallback
// for touch and no-JS, so the board never loses the ability to move a deal.
function requestsBoard(requests) {
  const back = "/admin?view=requests&layout=board";
  const ordered = [...requests].sort((a, b) => (tsMs(b.last_activity || b.created_at) || 0) - (tsMs(a.last_activity || a.created_at) || 0));
  const card = (r) => {
    const veh = displayName([r.marka_name, r.model_name].filter(Boolean).join(" ")) || r.label || "Any vehicle";
    const dep = (r.deposit_status === "requested" || r.deposit_status === "paid") ? depositBadge(r.deposit_status) : "";
    return `<div class="kbn-card" draggable="true" data-id="${r.id}" data-st="${esc(r.status || "new")}">
      <div class="kbn-cl">${healthDot(r.last_activity)}<a class="clink" href="/admin?view=client&id=${r.client_id}" data-drawer="/admin/drawer?id=${r.client_id}">${esc(r.client_name)}</a></div>
      <div class="kbn-veh">${esc(veh)}${r.kuzov ? ` <span class="chip muted">${esc(r.kuzov)}</span>` : ""}</div>
      <div class="kbn-meta"><span class="reqid">REQ-${r.id}</span><span>${esc(lastActivityLabel(r.last_activity))}</span>${dep}</div>
      ${statusSelect(r.id, r.status, back)}
    </div>`;
  };
  const cols = REQUEST_STATUSES.map((s) => {
    const items = ordered.filter((r) => (r.status || "new") === s.id);
    return `<div class="kbn-col${s.tone === "bad" ? " kbn-lost" : ""}" data-st="${s.id}">
      <div class="kbn-head"><span>${esc(s.label)}</span><span class="kbn-n">${items.length}</span></div>
      <div class="kbn-cards">${items.map(card).join("") || `<div class="kbn-empty">Drop here</div>`}</div>
    </div>`;
  }).join("");
  const dnd = `<script>(function(){
    var drag=null;
    document.querySelectorAll('.kbn-card').forEach(function(c){
      c.addEventListener('dragstart',function(e){drag=c;c.classList.add('kbn-drag');e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',c.getAttribute('data-id'));}catch(err){}});
      c.addEventListener('dragend',function(){c.classList.remove('kbn-drag');drag=null;});
    });
    function count(col){if(col)col.querySelector('.kbn-n').textContent=col.querySelectorAll('.kbn-card').length;}
    document.querySelectorAll('.kbn-col').forEach(function(col){
      col.addEventListener('dragover',function(e){if(!drag)return;e.preventDefault();e.dataTransfer.dropEffect='move';col.classList.add('kbn-over');});
      col.addEventListener('dragleave',function(){col.classList.remove('kbn-over');});
      col.addEventListener('drop',function(e){
        if(!drag)return;e.preventDefault();col.classList.remove('kbn-over');
        var st=col.getAttribute('data-st');var cardEl=drag;
        if(cardEl.getAttribute('data-st')===st)return;
        var fromCol=cardEl.closest('.kbn-col');
        col.querySelector('.kbn-cards').prepend(cardEl);
        cardEl.setAttribute('data-st',st);
        var sel=cardEl.querySelector('select[name=status]');if(sel)sel.value=st;
        count(col);count(fromCol);
        var fd=new FormData();fd.set('id',cardEl.getAttribute('data-id'));fd.set('status',st);fd.set('back',${JSON.stringify(back)});
        fetch('/request/status',{method:'POST',body:fd,credentials:'same-origin'}).then(function(r){if(!r.ok)throw new Error('save failed');}).catch(function(){location.reload();});
      });
    });
  })();</script>`;
  return `<div class="kbn">${cols}</div>${dnd}`;
}

// Cluster the flat request rows by customer for the grouped Requests list.
// Returns [{ clientId, name, items }] where the clusters are ordered by each
// customer's most recent activity and the requests inside a cluster by their
// own activity. requestsView groups here (not only in SQL) so the view is
// correct no matter what order the rows arrive in.
function clusterRequestsByClient(requests) {
  const recencyOf = (r) => tsMs(r.last_activity || r.created_at) || 0;
  const byClient = new Map();
  for (const r of requests) {
    if (!byClient.has(r.client_id)) byClient.set(r.client_id, []);
    byClient.get(r.client_id).push(r);
  }
  const clusters = [];
  for (const [clientId, items] of byClient) {
    items.sort((a, b) => recencyOf(b) - recencyOf(a));
    const recency = items.reduce((m, r) => Math.max(m, recencyOf(r)), 0);
    clusters.push({ clientId, name: items[0].client_name, items, recency });
  }
  clusters.sort((a, b) => b.recency - a.recency);
  return clusters;
}

function requestsView(requests, opts = {}) {
  if (opts.layout === "board") {
    return `${REQ_CSS}${reqLayoutToggle("board")}${requestsBoard(requests)}`;
  }
  const counts = {};
  REQUEST_STATUSES.forEach((s) => (counts[s.id] = 0));
  requests.forEach((r) => { const st = r.status || "new"; counts[st] = (counts[st] || 0) + 1; });
  // Zero-count stages hide at phone widths (a five-person pipeline is mostly
  // zeros, and twelve stacked cards pushed the list a full screen down); the
  // All-stages toggle brings them back. Desktop always shows the full band.
  const cards = REQUEST_STATUSES.filter((s) => s.tone !== "bad").map((s) =>
    `<button type="button" class="pipe-card${counts[s.id] ? "" : " pipe-zero"}" data-st="${s.id}" onclick="jdmPipe(this,'${s.id}')"><div class="pc-n">${counts[s.id] || 0}</div><div class="pc-l">${esc(s.label)}</div></button>`
  ).join("") + `<button type="button" class="pipe-more" aria-expanded="false" onclick="var p=this.closest('.pipe');var on=p.classList.toggle('all');this.setAttribute('aria-expanded',on?'true':'false');this.textContent=on?'Fewer stages':'All stages'">All stages</button>`;

  const isUntouchedNew = (r) => (r.status || "new") === "new" && !r.last_activity;
  // Age label for an untouched New row; hot once past the one-hour window.
  const newAge = (r) => {
    if (!isUntouchedNew(r)) return null;
    const t = tsMs(r.created_at);
    if (!Number.isFinite(t)) return null;
    const hot = Date.now() - t >= 3600000;
    return `<span class="req-age${hot ? " req-age-hot" : ""}">New ${esc(relTime(r.created_at))}</span>`;
  };

  // V1.3 Phase C + customer clustering: the customer is the record, so a
  // returning buyer's several searches read as ONE block, not scattered rows.
  // clusterRequestsByClient groups by customer, orders the clusters by each
  // customer's most recent activity (a portal "I'm interested" tap floats their
  // whole cluster up), and orders the requests inside a cluster by their own
  // activity. Each request keeps its REQ ref, status and last-activity, and the
  // row still opens the customer profile - the one source of truth for a person.
  const clusters = clusterRequestsByClient(requests);
  // Small badge that marks a returning customer (more than one active search).
  const repeatBadge = (n) => n > 1
    ? `<span class="req-repeat" title="${n} active requests from this customer">${n} requests</span>`
    : "";

  // Attio register: the row leads with one identity cell (health dot, name,
  // muted REQ reference). On a repeat customer the cluster head carries the
  // count badge; the follow-on rows dim the repeated name and mark it with a
  // return arrow, so the searches read as one customer's block. Destination
  // folds into the vehicle cell as a chip only in the unusual (overseas) case.
  const requestRow = (r, cluster, head) => {
    const veh = displayName([r.marka_name, r.model_name].filter(Boolean).join(" ")) || r.label || "Any vehicle";
    const dest = String(r.destination_country || "").trim();
    // The latest car queued for this request, linked to its listing detail.
    // view=lot resolves by queue.id, so the link must carry the queue row's
    // primary key, never the external auction lot_id.
    let lastLot = null; try { lastLot = r.last_lot_json ? JSON.parse(r.last_lot_json) : null; } catch (e) {}
    const lastCar = lastLot
      ? `<a class="clink" href="/admin?view=lot&id=${esc(r.last_queue_id)}">${esc(displayName([lastLot.year, lastLot.marka_name, lastLot.model_name].filter(Boolean).join(" ")) || `Lot ${lastLot.lot || ""}`)}</a>`
      : `<span class="chip muted">none yet</span>`;
    const grp = cluster.items.length > 1;
    const idCell = head
      ? `<span class="idcell"><a class="clink" href="/admin?view=client&id=${r.client_id}" data-drawer="/admin/drawer?id=${r.client_id}">${esc(r.client_name)}</a>${repeatBadge(cluster.items.length)}<a class="reqid" href="/admin?view=client&id=${r.client_id}">REQ-${r.id}</a></span>`
      : `<span class="idcell idcont"><span class="cont-mark" aria-hidden="true">&#8627;</span><a class="clink cont-name" href="/admin?view=client&id=${r.client_id}" data-drawer="/admin/drawer?id=${r.client_id}">${esc(r.client_name)}</a><a class="reqid" href="/admin?view=client&id=${r.client_id}">REQ-${r.id}</a></span>`;
    return `<tr class="req-row${head ? " req-head" : " req-cont"}${grp ? " req-grp" : ""}" data-st="${r.status || "new"}" data-client="${r.client_id}"${grp ? ` style="--band:${avatarColor(r.client_name).bg}"` : ""}>
      <td style="white-space:nowrap">${healthDot(r.last_activity)}${idCell}</td>
      <td class="req-veh"><a class="clink" href="/admin?view=client&id=${r.client_id}">${esc(veh)}</a>${r.kuzov ? ` <span class="chip muted">${esc(r.kuzov)}</span>` : ""}${dest ? ` <span class="chip chip-info" title="Overseas destination">${esc(dest)}</span>` : ""}</td>
      <td class="req-veh">${lastCar}</td>
      <td class="req-status">${statusSelect(r.id, r.status)}</td>
      <td style="white-space:nowrap">${newAge(r) || esc(lastActivityLabel(r.last_activity))}</td>
      <td style="text-align:right">${rowMenu([
        { label: "Open customer profile", href: `/admin?view=client&id=${r.client_id}` },
        { label: "Open request detail", href: `/admin?view=request&id=${r.id}` },
      ])}</td>
    </tr>`;
  };
  const rows = clusters.map((cluster) =>
    cluster.items.map((r, i) => requestRow(r, cluster, i === 0)).join("")
  ).join("") || `<tr><td colspan="6" class="empty">No requests yet. <a href="/admin?view=intake" style="color:var(--gold-txt);font-weight:600;text-decoration:underline">Log the first request</a>, or they appear here as customers submit searches.</td></tr>`;

  // Plain-English key so staff aren't guessing what the dots / REQ / badges
  // mean (client asked "what do the green and red dots mean?"). Lives behind a
  // quiet disclosure below the list (Attio register: no permanent legend card
  // competing with the data).
  const legend = `<details class="req-legend"><summary>Key to the dots and chips</summary><div class="lg-body">
    <span><span class="health health-green"></span> Active (contacted in the last 7 days)</span>
    <span><span class="health health-amber"></span> Cooling (7 to 14 days)</span>
    <span><span class="health health-red"></span> Stalled (14+ days, or never)</span>
    <span><b class="reqid">REQ-###</b> Request reference; the row opens the customer's profile, where you manage the request</span>
    <span><span class="req-repeat">2 requests</span> A returning customer, with all their searches grouped together</span>
    <span><b>Last activity</b> When this request was last touched (status, note, send or view)</span>
  </div></details>`;

  // Mobile card list: REQ ref, customer, vehicle, stage chip, last-activity
  // dot + relative time (or the hot-lead age on an untouched New request).
  // Grouped by customer like the desktop table; the cluster head carries the
  // returning-customer badge, the follow-on cards dim the repeated name.
  const mobile = `<div class="mcl">${clusters.map((cluster) => cluster.items.map((r, i) => {
    const head = i === 0;
    const veh = displayName([r.marka_name, r.model_name].filter(Boolean).join(" ")) || r.label || "Any vehicle";
    const title = head
      ? `${esc(r.client_name)} <span class="reqid">REQ-${r.id}</span>${repeatBadge(cluster.items.length)}`
      : `<span class="cont-mark" aria-hidden="true">&#8627;</span> <span class="cont-name">${esc(r.client_name)}</span> <span class="reqid">REQ-${r.id}</span>`;
    return mobileCardRow({
      href: `/admin?view=client&id=${r.client_id}`,
      name: r.client_name,
      title,
      meta: esc(veh),
      right: statusBadge(r.status || "new"),
      rightSub: `${healthDot(r.last_activity)}${newAge(r) || esc(lastActivityLabel(r.last_activity))}`,
      attrs: ` data-st="${esc(r.status || "new")}"`,
    });
  }).join("")).join("") || `<div class="empty">No requests yet. <a href="/admin?view=intake" style="color:var(--gold-txt);font-weight:600;text-decoration:underline">Log the first request</a>, or they appear here as customers submit searches.</div>`}</div>`;

  return `${REQ_CSS}
    <div class="req-tools">${tableSearch("reqTbl", "Search requests by customer, vehicle, state or country…")}${reqLayoutToggle("")}</div>
    <div class="pipe">${cards}</div>
    ${mobile}
    <div class="card tbl-desk" style="padding:0;overflow-x:auto;-webkit-overflow-scrolling:touch">
      <table id="reqTbl"><tr><th>Customer</th><th class="req-veh">Request</th><th class="req-veh">Latest car</th><th class="req-status">Status</th><th>Last activity</th><th></th></tr>${rows}</table>
    </div>
    ${legend}
    <script>function jdmPipe(btn,st){var on=btn.classList.contains('on');document.querySelectorAll('.pipe-card').forEach(function(c){c.classList.remove('on');});var t=document.getElementById('reqTbl');var rows=t.rows;for(var i=0;i<rows.length;i++){var r=rows[i];if(r.getElementsByTagName('th').length)continue;r.style.display=(on||r.getAttribute('data-st')===st)?'':'none';}document.querySelectorAll('.mcl-row[data-st]').forEach(function(r){r.style.display=(on||r.getAttribute('data-st')===st)?'':'none';});if(!on)btn.classList.add('on');}</script>`;
}

const REQ_CSS = `<style>
  /* One toolbar band: search (the actionable tool) plus the layout switch on
     a single row, so the first request card sits higher on a phone (IA-AUDIT:
     three stacked bands pushed it below the 375px fold). */
  .req-tools{display:flex;align-items:center;gap:12px;margin-bottom:12px}
  .req-tools .tbl-tools{flex:1;margin-bottom:0}
  .req-tools .lay-row{margin-bottom:0}
  /* List | Board switch (Pipedrive register: quiet segmented control). */
  .lay-row{display:flex;justify-content:flex-end;margin-bottom:12px}
  .lay-toggle{display:inline-flex;border:1px solid var(--hair);border-radius:var(--r-ctl);overflow:hidden;background:var(--card)}
  .lay-toggle a{padding:8px 16px;font-size:var(--fs-label);font-weight:600;color:var(--t2);text-decoration:none}
  .lay-toggle a.on{background:var(--gold-tint);color:var(--gold-txt)}
  .lay-toggle a:not(.on):hover{background:var(--hover);color:var(--ink)}
  /* Kanban board: one horizontally-scrolling row of stage columns. */
  .kbn{display:flex;gap:12px;align-items:flex-start;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:16px}
  .kbn-col{flex:0 0 260px;display:flex;flex-direction:column;background:var(--off);border:1px solid var(--hair);border-radius:var(--r-card);max-height:72vh}
  .kbn-col.kbn-lost{opacity:.75}
  .kbn-col.kbn-over{border-color:var(--gold);box-shadow:0 0 0 1px var(--gold)}
  .kbn-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 12px 8px;font-size:var(--fs-label);font-weight:var(--w-label);letter-spacing:var(--ls-label);text-transform:uppercase;color:var(--t3)}
  .kbn-n{background:var(--soft);border-radius:9999px;padding:1px 8px;color:var(--t2);font-weight:600;font-variant-numeric:tabular-nums}
  .kbn-cards{flex:1;display:flex;flex-direction:column;gap:8px;padding:4px 8px 12px;overflow-y:auto;min-height:44px}
  .kbn-card{background:var(--card);border:1px solid var(--hair);border-radius:var(--r-ctl);padding:12px;cursor:grab}
  .kbn-card.kbn-drag{opacity:.5}
  .kbn-cl{font-size:var(--fs-sec);font-weight:600;color:var(--ink)}
  .kbn-veh{font-size:var(--fs-label);color:var(--t2);margin-top:4px;line-height:1.4}
  .kbn-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px;font-size:var(--fs-label);color:var(--t3)}
  .kbn-empty{font-size:var(--fs-label);color:var(--faint);text-align:center;padding:12px 0;border:1px dashed var(--hair);border-radius:var(--r-ctl)}
  /* The card's stage select doubles as the touch / no-JS way to move a deal. */
  .kbn-card .rstat-sel{width:100%;margin-top:8px;border-color:var(--hair);background:var(--card);min-width:0}
  .pipe{display:grid;grid-template-columns:repeat(auto-fit,minmax(116px,1fr));gap:12px;margin-bottom:16px}
  .pipe-card{text-align:left;background:var(--card);border:1px solid var(--hair);border-radius:var(--r-card);padding:12px 16px;cursor:pointer;font-family:inherit;transition:border-color .15s,box-shadow .15s}
  .pipe-card:hover{border-color:var(--field-line)}
  .pipe-card.on{border-color:var(--ink);box-shadow:0 0 0 1px var(--ink)}
  .pipe-card .pc-n{font-size:20px;font-weight:700;letter-spacing:var(--ls-num);color:var(--ink);line-height:1;font-variant-numeric:tabular-nums}
  .pipe-card .pc-l{font-size:var(--fs-label);color:var(--t3);margin-top:8px;line-height:1.25}
  .pipe-more{display:none;font-family:inherit;font-size:var(--fs-label);font-weight:600;color:var(--t2);background:var(--card);border:1px dashed var(--hair);border-radius:var(--r-card);padding:12px 16px;cursor:pointer;text-align:center;min-height:44px}
  @media(max-width:700px){.pipe .pipe-zero{display:none}.pipe.all .pipe-zero{display:block}.pipe .pipe-zero.on{display:block}.pipe-more{display:block}}
  .reqid{font-size:var(--fs-label);font-weight:400;color:var(--t3);text-decoration:none}
  a.reqid:hover{color:var(--ink)}
  /* Customer clustering: a returning buyer's searches share a coloured left
     band (keyed to their avatar colour) and read as one block. The cluster head
     carries the count badge; follow-on rows dim the repeated name behind a
     return arrow so the group is obvious without a separate header row. */
  .req-repeat{display:inline-block;margin-left:8px;padding:1px 8px;border-radius:9999px;background:var(--gold-tint);color:var(--gold-txt);font-size:var(--fs-label);font-weight:600;vertical-align:middle;font-variant-numeric:tabular-nums}
  tr.req-grp>td:first-child{box-shadow:inset 3px 0 0 var(--band,transparent)}
  tr.req-cont>td{border-top:0}
  .cont-mark{color:var(--faint);margin-right:6px}
  .cont-name{color:var(--t2)}
  .mcl-row .cont-mark{margin-right:2px}
  .health{display:inline-block;width:9px;height:9px;border-radius:9999px;margin-right:8px;vertical-align:middle}
  .health-green{background:var(--good)}.health-amber{background:var(--warn-c)}.health-red{background:var(--bad)}
  .health-neutral{background:transparent;border:1.5px solid var(--faint)}
  .rstat-sel{padding:8px 24px 8px 8px;font-size:var(--fs-sec);border:1px solid transparent;border-radius:var(--r-ctl);background:transparent;color:var(--ink);font-family:inherit;cursor:pointer}
  .rstat-sel:hover,.rstat-sel:focus{border-color:var(--field-line);background:var(--field)}
  /* Keep the Status column wide enough for the full label and select on every
     row (a long vehicle name used to squeeze it to "Ne"), and cap the Vehicle
     column so a long car name wraps instead of stealing that width. */
  .req-status{white-space:nowrap}
  .req-status .rstat-sel{min-width:156px}
  .req-veh{max-width:240px}
  .req-veh .clink{overflow-wrap:anywhere}
  .req-legend{margin:var(--sp-4) 0 0;font-size:var(--fs-label);color:var(--t2)}
  .req-legend summary{display:inline-flex;align-items:center;gap:var(--sp-2);font-size:var(--fs-label);font-weight:var(--w-label);letter-spacing:var(--ls-label);text-transform:uppercase;color:var(--t3);cursor:pointer;list-style:none;padding:var(--sp-1) 0}
  .req-legend summary::-webkit-details-marker{display:none}
  .req-legend summary:after{content:"";width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:5px solid currentColor;transition:transform .15s}
  .req-legend[open] summary:after{transform:rotate(180deg)}
  .req-legend .lg-body{display:flex;flex-wrap:wrap;align-items:center;gap:var(--sp-2) var(--sp-4);background:var(--card);border:1px solid var(--hair);border-radius:var(--r-card);padding:var(--sp-3) var(--sp-4);margin-top:var(--sp-2);line-height:1.5}
  .req-legend .health{margin-right:4px}
  @media(max-width:640px){.req-legend summary{min-height:44px;align-items:center}}
</style>`;

// Record one timeline event (Priority 8). Best-effort; never throws into a handler.
export async function logActivity(env, { wishlist_id = null, client_id = null, type, detail = null, actor = null }) {
  try {
    await env.DB.prepare("INSERT INTO activity (wishlist_id, client_id, type, detail, actor) VALUES (?,?,?,?,?)")
      .bind(wishlist_id, client_id, type, detail, actor).run();
  } catch (e) { console.error("logActivity failed:", e.message); }
}

// Log a WhatsApp / Call / Email button tap as a lightweight contact event, so
// "when did we last talk?" answers itself without anyone typing anything.
// Access-checked; best-effort (a failed log never blocks the tap's navigation).
export async function logContactTap(env, clientId, channel, session) {
  const cid = Number(clientId);
  if (!Number.isInteger(cid) || cid <= 0) return { ok: false };
  if (!(await clientAccessibleBy(env, cid, session))) return { ok: false };
  const label = channel === "whatsapp" ? "WhatsApp" : channel === "call" ? "Call" : channel === "email" ? "Email" : "Contact";
  const actor = await actorName(env, session);
  await logActivity(env, { client_id: cid, type: "contact", detail: `${label} opened from the app`, actor });
  return { ok: true };
}

// Newest touch for ONE client: a sent vehicle, a note or a logged contact tap,
// the same union the Customers "Last contact" column aggregates. Returns
// { t, how } for the header line ("WhatsApp by Ben"), or null when never
// contacted. Best-effort: a failed read renders as never, it never throws.
async function lastContacted(env, clientId) {
  try {
    const r = await env.DB.prepare(
      `SELECT ts, src, actor FROM (
          SELECT sent_at AS ts, 'sent' AS src, NULL AS actor FROM queue WHERE client_id = ?1 AND sent_at IS NOT NULL
          UNION ALL
          SELECT created_at, COALESCE(detail, type), actor FROM activity WHERE client_id = ?1 AND type IN ('note','contact')
        ) ORDER BY ts DESC LIMIT 1`
    ).bind(Number(clientId)).first();
    if (!r || !r.ts) return null;
    const src = String(r.src || "");
    const channel = src === "sent" ? "vehicles sent"
      : /^whatsapp/i.test(src) ? "WhatsApp"
      : /^call/i.test(src) ? "Call"
      : /^email/i.test(src) ? "Email"
      : "note";
    return { t: r.ts, how: channel + (r.actor ? " by " + r.actor : "") };
  } catch (e) { console.error("lastContacted failed:", e.message); return null; }
}

// Deposit state on a request (Priority 6): none -> requested -> paid.
const DEPOSIT_LABELS = { none: "No deposit", requested: "Deposit requested", paid: "Deposit paid" };
const validDeposit = (s) => s === "none" || s === "requested" || s === "paid";
function depositBadge(status) {
  const s = status || "none";
  const tone = s === "paid" ? "chip-good" : s === "requested" ? "chip-warn" : "muted";
  return `<span class="chip ${tone}">${esc(DEPOSIT_LABELS[s] || DEPOSIT_LABELS.none)}</span>`;
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
  contact: "gold", login: "blue",
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
  const curIdx = Math.max(0, flow.findIndex((s) => s.id === cur));
  // On the stacked layout the twelve-step list costs ~312px, so it compresses
  // to one stage-of-total line; the full stepper stays on wide screens.
  return `<div class="rd-stage-line">Stage ${curIdx + 1} of ${flow.length}: <b>${esc(flow[curIdx].label)}</b></div>
  <ol class="rd-steps">${flow.map((s, i) => {
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
      <div class="tk-t">${esc(t.title)}${t.priority === "high" && !done ? ` <span class="chip chip-bad">High</span>` : ""}</div>
      ${ctx ? `<div class="tk-c">${ctx}</div>` : ""}
    </div>
    <div class="tk-r">
      ${done ? `<span class="tk-due tk-none">Done ${esc(relTime(t.done_at))}</span>` : `<span class="tk-due tk-${due.tone}">${esc(due.label)}</span>`}
      <form method="POST" action="/task/delete" class="tk-del" data-confirm="Delete this task? This cannot be undone." data-danger><input type="hidden" name="id" value="${t.id}"><input type="hidden" name="back" value="${esc(back)}"><button type="submit" aria-label="Delete task">&times;</button></form>
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
  // Interested (green, a buying signal) and Viewed (info blue) are distinct.
  const tone = stage === "Interested" ? "chip-good" : stage === "Passed" ? "chip-bad" : stage === "Viewed" ? "chip-info" : stage === "Sent" ? "chip-warn" : "muted";
  const when = sent && q.sent_at ? `sent ${esc(relTime(q.sent_at))}` : q.status === "pending" ? "awaiting review" : "";
  const acts = sent ? `<div class="mt-acts">
      <form method="POST" action="/match/response" style="display:inline"><input type="hidden" name="id" value="${q.id}"><input type="hidden" name="response" value="interested"><input type="hidden" name="back" value="${esc(back)}"><button class="mt-btn mt-yes" type="submit"${q.response === "interested" ? " disabled" : ""}>Interested</button></form>
      <form method="POST" action="/match/response" style="display:inline"><input type="hidden" name="id" value="${q.id}"><input type="hidden" name="response" value="not_interested"><input type="hidden" name="back" value="${esc(back)}"><button class="mt-btn mt-no" type="submit"${q.response === "not_interested" ? " disabled" : ""}>Pass</button></form>
    </div>` : "";
  // The variant and vitals, so staff can tell WHICH car this was; a bare
  // "Mercedes Benz S Class" title hides whether it was the right trim/chassis.
  const specs = [
    lot.grade ? esc(String(lot.grade)) : "",
    lot.kuzov ? `Chassis ${esc(String(lot.kuzov))}` : "",
    Number(lot.mileage) > 0 ? `${Number(lot.mileage).toLocaleString("en-US")} km` : "",
    displayGrade(lot.rate) !== "ungraded" ? `Grade ${esc(fullGrade(lot))}` : "",
    lot.auction_date ? esc(String(lot.auction_date).slice(0, 10)) : "",
    lot._landed && Number(lot._landed.grandTotal) > 0 ? `A$${Number(lot._landed.grandTotal).toLocaleString("en-AU")} landed` : "",
  ].filter(Boolean).join(" &middot; ");
  const thumb = imageUrls(lot).medium;
  return `<div class="mt">
    <div class="mt-row">
      ${thumb ? `<a href="/admin?view=lot&id=${q.id}" tabindex="-1" aria-hidden="true"><img class="mt-img" src="${esc(thumb)}" alt="" loading="lazy" width="76" height="57"></a>` : ""}
      <div class="mt-main">
        <a class="mt-v" href="/admin?view=lot&id=${q.id}">${esc(veh)}</a>
        ${specs ? `<div class="mt-specs">${specs}</div>` : ""}
        <div class="mt-meta"><span class="chip ${tone}">${esc(stage)}</span>${when ? `<span class="mt-when">${when}</span>` : ""}</div>
      </div>
    </div>
    ${acts}
  </div>`;
}

// ---- Quick-action + task + match mutation handlers -------------------------

// Who did it, for the activity timeline. Sessions only carry {role,id}, so an
// agent's display name is looked up, without this every agent action was
// logged as the anonymous "Agent" (audit: shared-agent actions unattributable).
async function actorName(env, session) {
  if (!session || session.role === "admin") return "JDM Connect";
  const a = await env.DB.prepare("SELECT name FROM agents WHERE id = ?").bind(Number(session.id)).first();
  return (a && a.name) || "Agent";
}

// Add a free-text note to a request's timeline. Shared (co-search) agents may
// add notes, additive, and attributed to them by name in the timeline.
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
  } else if (form.get("client_name")) {
    // Quick-add types a name (IA-AUDIT item 16). Link only on an unambiguous,
    // access-scoped, case-insensitive exact match; otherwise the task is
    // created unlinked rather than guessed onto the wrong buyer.
    const nm = String(form.get("client_name")).trim();
    if (nm) {
      const acc = accessScope(session);
      const st = env.DB.prepare(`SELECT c.id FROM clients c WHERE ${acc.sql} AND c.archived = 0 AND LOWER(c.name) = LOWER(?) LIMIT 2`);
      const hits = (await (acc.binds.length ? st.bind(...acc.binds, nm) : st.bind(nm)).all()).results || [];
      if (hits.length === 1) cid = hits[0].id;
    }
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
    // Autopilot: the first lot sent moves an early-stage request to "Vehicles
    // sent" (which also seeds the 3-day follow-up task). A manually chosen
    // later stage always wins because only early stages advance.
    if (q.wishlist_id) {
      const w = await env.DB.prepare("SELECT status FROM wishlists WHERE id = ?").bind(q.wishlist_id).first();
      if (w && ["new", "qualified", "searching"].includes(w.status || "new")) {
        await updateRequestStatus(env, q.wishlist_id, "vehicles_sent", session);
      }
    }
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

// --- Share-link management (staff) ------------------------------------------
// The staff-authored content on a public share page (suggested price band +
// plain-English condition notes) and the link lifecycle. Every entry point
// re-checks the caller can see the row's client (same gate as the lot page).
const SHARE_PRICE_MAX = 200;
const SHARE_NOTES_MAX = 2000;
async function shareRowFor(env, queueId, session) {
  const qid = Number(queueId);
  if (!Number.isInteger(qid) || qid <= 0) return null;
  const q = await env.DB.prepare("SELECT id, client_id FROM queue WHERE id = ?").bind(qid).first();
  if (!q || !(await clientAccessibleBy(env, q.client_id, session))) return null;
  return q;
}
export async function updateShareDetails(env, queueId, { priceNote, conditionNotes }, session) {
  const q = await shareRowFor(env, queueId, session);
  if (!q) throw new Error("share row not accessible");
  const price = String(priceNote || "").trim().slice(0, SHARE_PRICE_MAX);
  const notes = String(conditionNotes || "").trim().slice(0, SHARE_NOTES_MAX);
  await env.DB.prepare("UPDATE queue SET share_price_note = ?, share_condition_notes = ? WHERE id = ?")
    .bind(price || null, notes || null, q.id).run();
}
export async function setShareRevoked(env, queueId, revoked, session) {
  const q = await shareRowFor(env, queueId, session);
  if (!q) throw new Error("share row not accessible");
  await env.DB.prepare(`UPDATE queue SET share_revoked_at = ${revoked ? "datetime('now')" : "NULL"} WHERE id = ?`).bind(q.id).run();
}
// A fresh nonce invalidates every previously issued link for this row (legacy
// nonce-less ones included) and re-enables a revoked link in the same action.
export async function regenerateShareLink(env, queueId, session) {
  const q = await shareRowFor(env, queueId, session);
  if (!q) throw new Error("share row not accessible");
  await env.DB.prepare("UPDATE queue SET share_nonce = ?, share_revoked_at = NULL WHERE id = ?").bind(randomToken(), q.id).run();
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
    `<div class="topbar"><div><div class="kicker">Vehicle Finder</div><h1>Request</h1></div><a class="btn-secondary" href="/admin?view=requests">Back to requests</a></div>
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
  // Last contacted is client-level and distinct from the request's last
  // activity: a portal view is activity, a phone call is contact.
  const lastc = await lastContacted(env, w.client_id);

  // -- Left column: customer + contact + deposit -----------------------------
  const contactRows = [
    ["Email", w.client_email ? `<a href="mailto:${esc(w.client_email)}">${esc(w.client_email)}</a>` : ""],
    ["Phone", w.client_whatsapp ? esc(w.client_whatsapp) : ""],
    ["State", w.client_state ? esc(w.client_state) : ""],
    ["Destination", w.destination_country ? `<span class="chip chip-info">${esc(w.destination_country)}</span>` : ""],
    ["Portal", w.portal_enabled ? "Enabled" : "Not enabled"],
  ].filter(([, v]) => v).map(([k, v]) => `<div class="rd-row"><span class="rd-k">${k}</span><span class="rd-v">${v}</span></div>`).join("");
  const contactBtns = [
    waNum ? `<a class="rd-cta" data-clog="${w.client_id}:whatsapp" href="https://wa.me/${waNum}" target="_blank" rel="noopener">WhatsApp</a>` : "",
    w.client_whatsapp ? `<a class="rd-cta" data-clog="${w.client_id}:call" href="tel:${esc(w.client_whatsapp)}">Call</a>` : "",
    w.client_email ? `<a class="rd-cta" data-clog="${w.client_id}:email" href="mailto:${esc(w.client_email)}">Email</a>` : "",
  ].filter(Boolean).join("");
  const customerCol = `<div class="rdcol">
    <div class="rdcard rd-c-client">
      <div class="rd-cust">${avatar(w.client_name)}<div><div class="rd-name">${esc(w.client_name)} ${healthDot(w.last_activity)}</div><div class="rd-sub">Customer #${w.client_id} &middot; last activity ${esc(lastActivityLabel(w.last_activity))} &middot; last contacted ${lastc ? esc(relTime(lastc.t)) : "never"}</div></div></div>
      ${contactRows ? `<div class="rd-rows">${contactRows}</div>` : ""}
      ${contactBtns ? `<div class="rd-ctas">${contactBtns}</div>` : ""}
      <a class="rd-open" href="/admin?view=client&id=${w.client_id}">Open full customer profile &rarr;</a>
    </div>
    <div class="rdcard rd-c-owner">
      <div class="rd-h">Owner</div>
      <div class="rd-ownerline">${ownerLabel}</div>
      ${session.role === "admin" ? `<form method="POST" action="/request/owner" class="rd-owner">
        <input type="hidden" name="id" value="${wid}"><input type="hidden" name="back" value="${esc(back)}">
        <select name="owner_id" class="rstat-sel" onchange="this.form.submit()">
          <option value=""${!w.owner_id ? " selected" : ""}>JDM Connect</option>
          ${agents.map((a) => `<option value="${a.id}"${Number(w.owner_id) === Number(a.id) ? " selected" : ""}>${esc(a.name)}${a.company ? " · " + esc(a.company) : ""}</option>`).join("")}
        </select></form>` : ""}
    </div>
    <div class="rdcard rd-c-deposit">
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
    ["Min mileage", w.mileage_min ? Number(w.mileage_min).toLocaleString() + " km" : "Any"],
    ["Max mileage", w.mileage_max ? Number(w.mileage_max).toLocaleString() + " km" : "Any"],
    ["Min grade", w.rate_min ? esc(w.rate_min) : "Any"],
    ["Chassis / code", w.kuzov ? esc(w.kuzov) : "-"],
  ].map(([k, v]) => `<div class="rd-spec"><span class="rd-sk">${k}</span><span class="rd-sv">${v}</span></div>`).join("");
  const sentCount = matches.filter((m) => m.status === "sent").length;
  const matchList = matches.length
    ? matches.map((m) => matchTrackRow(m, back)).join("")
    : `<div class="rd-empty">No vehicles matched or sent yet.</div>`;
  const requirementsCol = `<div class="rdcol">
    <div class="rdcard rd-c-request">
      <div class="rd-toph"><div class="rd-h" style="margin:0">Request REQ-${wid}</div>${statusBadge(w.status)}</div>
      <div class="rd-specs">${reqRows}</div>
      <a class="rd-find" href="/admin?view=client&id=${w.client_id}#find">Find a vehicle for ${esc(first)} &rarr;</a>
    </div>
    <div class="rdcard rd-c-vehicles">
      <div class="rd-h">Vehicles &amp; engagement <span class="rd-ct">${sentCount} sent</span></div>
      <div class="rd-matches">${matchList}</div>
    </div>
  </div>`;

  // -- Right column: workflow (pipeline + quick actions + tasks + timeline) ---
  const openTasks = tasks.filter((t) => t.status !== "done");
  const workflowCol = `<div class="rdcol">
    <div class="rdcard rd-c-status">
      <div class="rd-h">Status</div>
      ${statusSelect(wid, w.status, back)}
      <div class="rd-quick">
        ${w.status !== "purchased" ? `<form method="POST" action="/request/status"><input type="hidden" name="id" value="${wid}"><input type="hidden" name="status" value="purchased"><input type="hidden" name="back" value="${esc(back)}"><button class="rd-cta" type="submit">Mark purchased</button></form>` : ""}
        ${w.status !== "lost" ? `<form method="POST" action="/request/status" data-confirm="Mark this request as lost? It leaves the active pipeline. You can reopen it any time from the status select." data-danger><input type="hidden" name="id" value="${wid}"><input type="hidden" name="status" value="lost"><input type="hidden" name="back" value="${esc(back)}"><button class="rd-cta rd-cta-bad" type="submit">Mark lost</button></form>` : ""}
      </div>
      ${statusPipeline(w.status)}
    </div>
    <div class="rdcard rd-c-next">
      <div class="rd-h">Next action</div>
      ${w.next_action_date
        ? `<div class="rd-na-cur"><span class="tk-due tk-${taskDue(w.next_action_date).tone}">${esc(taskDue(w.next_action_date).label)}</span>${w.next_action_note ? ` <span class="rd-na-note">${esc(w.next_action_note)}</span>` : ""}</div>`
        : `<div class="rd-empty">No follow-up scheduled.</div>`}
      <form method="POST" action="/request/next-action" class="rd-na">
        <input type="hidden" name="id" value="${wid}"><input type="hidden" name="back" value="${esc(back)}">
        <input type="date" name="next_action_date" value="${esc(opts.naDate || w.next_action_date || "")}" aria-label="Next action date">
        <input name="next_action_note" value="${esc(opts.naNote || w.next_action_note || "")}" placeholder="What's the next step?" maxlength="160">
        <div class="rd-naact"><button class="rd-cta rd-cta-gold" type="submit">Set follow-up</button>${w.next_action_date ? `<button class="rd-cta rd-cta-bad" type="submit" name="clear" value="1">Clear</button>` : ""}</div>
      </form>
    </div>
    <div class="rdcard rd-c-note">
      <div class="rd-h">Add a note</div>
      <form method="POST" action="/request/note">
        <input type="hidden" name="id" value="${wid}"><input type="hidden" name="back" value="${esc(back)}">
        <textarea name="note" rows="2" class="rd-note" placeholder="Call notes, next step, anything worth logging…" maxlength="500">${esc(opts.note || "")}</textarea>
        <div class="rd-noteact"><button class="rd-cta rd-cta-gold" type="submit">Log note</button></div>
      </form>
    </div>
    <div class="rdcard rd-c-tasks">
      <div class="rd-h">Tasks <span class="rd-ct">${openTasks.length} open</span></div>
      <div class="rd-tasks">${tasks.length ? tasks.map((t) => taskRow(t, { back })).join("") : `<div class="rd-empty">No tasks. Add one below.</div>`}</div>
      <form method="POST" action="/task/create" class="rd-newtask">
        <input type="hidden" name="wishlist_id" value="${wid}"><input type="hidden" name="client_id" value="${w.client_id}"><input type="hidden" name="back" value="${esc(back)}">
        <input name="title" placeholder="New task…" maxlength="160" required>
        <input name="due_date" type="date" aria-label="Due date">
        <button class="rd-cta rd-cta-gold" type="submit">Add</button>
      </form>
    </div>
    <div class="rdcard rd-c-activity">
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
      <a class="btn-secondary" href="/admin?view=requests">Back to requests</a>
    </div>
    <div class="content wide">${flash}
      ${RD_CSS}
      <div class="rd">${customerCol}${requirementsCol}${workflowCol}</div>
    </div>`;
  return shell(sidebar("requests", { matches: matches.length }, session), main, `REQ-${wid} · ${esc(w.client_name)} - JDM Connect`);
}

const RD_CSS = `<style>
  .rd{display:grid;grid-template-columns:288px minmax(0,1fr) 340px;gap:16px;align-items:start;margin-top:8px}
  .rdcol{display:flex;flex-direction:column;gap:16px}
  .rd-stage-line{display:none;font-size:var(--fs-sec);color:var(--t2);margin-top:12px}
  .rd-stage-line b{color:var(--ink)}
  /* Stacked layout: the columns dissolve (display:contents) so the cards
     re-order for the after-call flow, status and next action directly under
     the client card instead of four screens down (IA-AUDIT item 9). Must sit
     AFTER the base .rdcol / .rd-stage-line rules: same specificity, so source
     order decides inside the media query. */
  @media(max-width:1180px){
    .rd{grid-template-columns:1fr}
    .rdcol{display:contents}
    .rd-c-client{order:1}.rd-c-status{order:2}.rd-c-next{order:3}.rd-c-request{order:4}.rd-c-vehicles{order:5}.rd-c-deposit{order:6}.rd-c-owner{order:7}.rd-c-note{order:8}.rd-c-tasks{order:9}.rd-c-activity{order:10}
    .rd-steps{display:none}
    .rd-stage-line{display:block}
  }
  .rdcard{background:var(--card);border:1px solid var(--hair);border-radius:var(--r-card);padding:var(--pad-card)}
  .rd-h{font-size:var(--fs-label);font-weight:var(--w-label);letter-spacing:var(--ls-label);text-transform:uppercase;color:var(--t3);margin:0 0 12px}
  .rd-ct{background:var(--soft);color:var(--t2);border-radius:9999px;padding:1px 8px;font-size:var(--fs-label);margin-left:8px;letter-spacing:0}
  .rd-toph{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:16px}
  .rd-cust{display:flex;align-items:center;gap:12px;margin-bottom:16px}
  .rd-name{font-size:var(--fs-sect);font-weight:700;color:var(--ink)}
  .rd-sub{font-size:var(--fs-label);color:var(--t3);margin-top:4px}
  .rd-rows{border-top:1px solid var(--hair);padding-top:8px}
  .rd-row{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--hair-2)}
  .rd-row:last-child{border-bottom:0}
  .rd-k{font-size:var(--fs-label);color:var(--t3)}.rd-v{font-size:var(--fs-label);font-weight:600;color:var(--ink);text-align:right;word-break:break-word}
  .rd-ctas{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0 8px}
  /* rd-cta aliases the secondary button; -gold is the in-card primary. */
  .rd-cta{display:inline-block;background:var(--card);border:1px solid var(--hair);border-radius:var(--r-ctl);padding:8px 12px;font-size:var(--fs-sec);font-weight:600;color:var(--ink);cursor:pointer;font-family:inherit;text-decoration:none;transition:border-color .15s,background .15s}
  .rd-cta:hover{border-color:var(--field-line);background:var(--hover)}
  .rd-cta-gold{background:var(--gold);border-color:var(--gold);color:var(--gold-on)}
  .rd-cta-gold:hover{background:var(--gold-hover);border-color:var(--gold-hover)}
  .rd-cta-bad{color:var(--bad);border-color:var(--bad-line)}
  .rd-cta-bad:hover{background:var(--bad-bg);border-color:var(--bad-line)}
  .rd-open{display:inline-block;margin-top:4px;font-size:var(--fs-sec);font-weight:600;color:var(--gold-txt);text-decoration:none}
  .rd-open:hover{text-decoration:underline}
  .rd-ownerline{font-size:var(--fs-sec);font-weight:600;color:var(--ink);margin-bottom:8px}
  .rd-owner select,.rstat-sel{width:100%}
  .rd-dep{margin-bottom:12px}
  .rd-depbtns{display:flex;gap:8px;flex-wrap:wrap}
  .rd-specs{display:flex;flex-direction:column}
  .rd-spec{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--hair-2)}
  .rd-spec:last-of-type{border-bottom:0}
  .rd-sk{font-size:var(--fs-label);color:var(--t3)}.rd-sv{font-size:var(--fs-sec);font-weight:600;color:var(--ink);text-align:right}
  .rd-find{display:inline-block;margin-top:16px;background:var(--gold);border:1px solid var(--gold);color:var(--gold-on);border-radius:var(--r-ctl);padding:8px 16px;font-size:var(--fs-sec);font-weight:700;text-decoration:none}
  .rd-find:hover{background:var(--gold-hover)}
  .rd-matches{display:flex;flex-direction:column;gap:8px}
  .mt{border:1px solid var(--hair);border-radius:var(--r-card);padding:12px}
  .mt-row{display:flex;gap:12px;align-items:flex-start}
  .mt-img{display:block;width:76px;height:57px;object-fit:cover;border-radius:var(--r-ctl);background:var(--soft)}
  .mt-main{flex:1;min-width:0}
  .mt-specs{font-size:var(--fs-label);color:var(--t2);margin-top:4px;line-height:var(--lh-list)}
  .mt-v{display:block;font-size:var(--fs-sec);font-weight:600;color:var(--ink);text-decoration:none}
  .mt-v:hover{color:var(--gold-txt)}
  .mt-meta{display:flex;align-items:center;gap:8px;margin-top:8px}
  .mt-when{font-size:var(--fs-label);color:var(--t3)}
  .mt-acts{display:flex;gap:8px;margin-top:8px}
  .mt-btn{background:var(--card);border:1px solid var(--hair);border-radius:var(--r-ctl);padding:4px 12px;font-size:var(--fs-label);font-weight:600;color:var(--ink);cursor:pointer;font-family:inherit}
  .mt-btn:hover{border-color:var(--field-line)}
  .mt-yes:hover{border-color:var(--good);color:var(--good)}.mt-no:hover{border-color:var(--bad);color:var(--bad)}
  .mt-btn:disabled{opacity:.5;cursor:default}
  .rd-quick{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
  .rd-quick form{display:inline}
  .rd-steps{list-style:none;margin:16px 0 0;padding:0;position:relative}
  .rd-step{display:flex;align-items:center;gap:12px;padding:4px 0;position:relative}
  .rd-step:not(:last-child)::before{content:"";position:absolute;left:5px;top:20px;bottom:-4px;width:2px;background:var(--hair)}
  .rd-sd{width:12px;height:12px;border-radius:9999px;border:2px solid var(--hair);background:var(--card);flex:none;z-index:1}
  .rd-sl{font-size:var(--fs-label);color:var(--t3)}
  .rd-done .rd-sd{background:var(--gold);border-color:var(--gold)}
  .rd-done .rd-sl{color:var(--t2)}
  .rd-now .rd-sd{background:var(--gold);border-color:var(--gold);box-shadow:0 0 0 3px var(--gold-tint)}
  .rd-now .rd-sl{color:var(--ink);font-weight:700}
  .rd-lost{background:var(--bad-bg);color:var(--bad);border-radius:var(--r-card);padding:12px 16px;font-size:var(--fs-sec);margin-top:12px}
  .rd-note{width:100%;background:var(--field,var(--card));border:1px solid var(--hair);border-radius:var(--r-ctl);padding:8px 12px;font-family:inherit;font-size:var(--fs-sec);color:var(--ink);resize:vertical}
  .rd-noteact{margin-top:8px}
  .rd-na-cur{font-size:var(--fs-label);color:var(--t2);margin-bottom:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .rd-na-note{color:var(--ink)}
  .rd-na{display:flex;flex-direction:column;gap:8px}
  .rd-na input{background:var(--field,var(--card));border:1px solid var(--hair);border-radius:var(--r-ctl);padding:8px 12px;font-family:inherit;font-size:var(--fs-label);color:var(--ink);width:100%}
  .rd-naact{display:flex;gap:8px}
  .rd-tasks{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}
  .rd-newtask{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  .rd-newtask input[name=title]{flex:1;min-width:120px}
  .rd-newtask input{background:var(--field,var(--card));border:1px solid var(--hair);border-radius:var(--r-ctl);padding:8px;font-family:inherit;font-size:var(--fs-label);color:var(--ink)}
  .tk{display:flex;align-items:flex-start;gap:8px;border:1px solid var(--hair);border-radius:var(--r-card);padding:8px 12px}
  .tk-done{opacity:.6}
  .tk-box{width:20px;height:20px;border:1.5px solid var(--hair);border-radius:var(--r-ctl);background:var(--card);cursor:pointer;color:var(--gold-on);font-size:var(--fs-label);line-height:1;flex:none;margin-top:1px}
  .tk-box.on{background:var(--gold);border-color:var(--gold)}
  .tk-b{flex:1;min-width:0}
  .tk-t{font-size:var(--fs-sec);font-weight:600;color:var(--ink);line-height:1.35}
  .tk-done .tk-t{text-decoration:line-through}
  .tk-c{font-size:var(--fs-label);color:var(--t3);margin-top:4px}
  .tk-r{display:flex;align-items:center;gap:8px;flex:none}
  .tk-due{font-size:var(--fs-label);font-weight:600;white-space:nowrap}
  .tk-over{color:var(--bad)}.tk-today{color:var(--warn-c)}.tk-soon{color:var(--t2)}.tk-none{color:var(--t3)}
  .tk-del button{border:0;background:none;color:var(--t3);font-size:var(--fs-body);cursor:pointer;line-height:1;padding:0 2px}
  .tk-del button:hover{color:var(--bad)}
  .tk-check{display:inline}
  .tl{list-style:none;margin:0;padding:0}
  .tl-i{display:flex;gap:12px;padding:0 0 16px;position:relative}
  .tl-i:not(:last-child)::before{content:"";position:absolute;left:4px;top:16px;bottom:0;width:2px;background:var(--hair)}
  .tl-dot{width:10px;height:10px;border-radius:9999px;flex:none;margin-top:4px;z-index:1}
  .tl-neu{background:var(--t3)}.tl-gold{background:var(--gold)}.tl-blue{background:var(--info)}.tl-good{background:var(--good)}.tl-warn{background:var(--warn-c)}
  .tl-d{font-size:var(--fs-label);color:var(--ink);line-height:1.4}
  .tl-m{font-size:var(--fs-label);color:var(--t3);margin-top:2px}
  .rd-empty{font-size:var(--fs-label);color:var(--t3);padding:4px 2px}
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
  // IA-AUDIT item 16: an assigned-to-me filter. Agents already only see their
  // scope; Mine narrows to explicit assignments so five people sharing the
  // board stop reading one undifferentiated list.
  const mine = !!opts.mine;
  const sid = Number(opts.session && opts.session.id);
  if (mine) rows = rows.filter((t) => Number(t.assigned_to) === sid);
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
  // What is this page?, the client asked for instructions. IA-AUDIT item 16:
  // closed on the server; a script opens it for first-time browsers only and
  // remembers the dismissal in localStorage, so onboarding copy never again
  // outranks the work.
  const help = `<details class="tks-help" id="tksHelp">
    <summary><span class="tks-help-t">What is the Tasks board?</span><span class="tks-help-x">Hide</span></summary>
    <div class="tks-help-b">
      <p>Your shared to-do list for moving deals forward. A task is a single next
      step tied to a customer or request, like "call Lee about the Laurel", "chase
      the deposit", "translate the auction sheet".</p>
      <ul>
        <li><b>Where tasks come from:</b> some are created automatically when you
        move a request to a new stage (e.g. marking a request <i>Interested</i>
        adds a follow-up); you can also add your own from any request's page.</li>
        <li><b>Buckets:</b> tasks sort into <b>Overdue</b>, <b>Due today</b>,
        <b>This week</b>, <b>Later</b> and <b>No due date</b> by their due date.</li>
        <li><b>Completing:</b> tick the box on the left to mark a task done. It
        moves to "Recently completed" for 7 days in case you need to undo.</li>
        <li><b>Who sees what:</b> you see tasks assigned to you and tasks on the
        customers you own or are shared on. Admins see everything.</li>
      </ul>
    </div>
  </details>`;
  // Quick-add (IA-AUDIT item 16): follow-up capture at the moment of thought.
  // The client field autocompletes from the visible directory; the server
  // links only an unambiguous name match, never a guess.
  const quickAdd = `<form class="card tk-add" method="POST" action="/task/create">
    <input type="hidden" name="back" value="/admin?view=tasks${mine ? "&mine=1" : ""}">
    <input class="tk-add-t" name="title" placeholder="Add a task, e.g. call Sam re finance" required maxlength="160" aria-label="Task title">
    <input class="tk-add-c" name="client_name" list="tkClients" placeholder="Client (optional)" aria-label="Client" autocomplete="off">
    <datalist id="tkClients">${(opts.clients || []).map((c) => `<option value="${esc(c.name)}">`).join("")}</datalist>
    <input class="tk-add-d" type="date" name="due_date" aria-label="Due date">
    <button class="btn-primary" type="submit">Add task</button>
  </form>`;
  const chips = `<div class="fchips" style="margin:0 0 var(--sp-4)">
    <a class="fchip${mine ? "" : " on"}" href="/admin?view=tasks"${mine ? "" : ' aria-current="true"'}>${(opts.session && opts.session.role) === "admin" ? "Everyone" : "All my tasks"}</a>
    <a class="fchip${mine ? " on" : ""}" href="/admin?view=tasks&mine=1"${mine ? ' aria-current="true"' : ""}>Assigned to me</a>
  </div>`;
  const helpScript = `<script>(function(){var d=document.getElementById('tksHelp');if(!d)return;var KEY='jdmTasksHelpHidden';
    try{if(!localStorage.getItem(KEY))d.open=true;}catch(e){d.open=true;}
    d.addEventListener('toggle',function(){try{if(d.open){localStorage.removeItem(KEY);}else{localStorage.setItem(KEY,'1');}}catch(e){}});
  })();</script>`;
  return `${TASKS_CSS}
    <div class="tk-strip">
      <div class="tk-stat${buckets.over.length ? " bad" : ""}"><div class="n">${buckets.over.length}</div><div class="l">Overdue</div></div>
      <div class="tk-stat${buckets.today.length ? " warn" : ""}"><div class="n">${buckets.today.length}</div><div class="l">Due today</div></div>
      <div class="tk-stat"><div class="n">${buckets.soon.length}</div><div class="l">This week</div></div>
      <div class="tk-stat"><div class="n">${open.length}</div><div class="l">Open total</div></div>
    </div>
    ${quickAdd}
    ${chips}
    ${body}${doneSec}
    ${help}${helpScript}`;
}
const TASKS_CSS = `<style>
  .tk-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:var(--sp-5)}
  .tk-add{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:12px 16px;margin-bottom:var(--sp-4)}
  .tk-add input{width:auto}
  .tk-add .tk-add-t{flex:2 1 240px}
  .tk-add .tk-add-c{flex:1 1 160px}
  .tk-add .tk-add-d{flex:0 1 150px}
  @media(max-width:640px){
    .tk-add .tk-add-t,.tk-add .tk-add-c,.tk-add .tk-add-d{flex:1 1 100%}
    .tk-add button{width:100%;min-height:44px}
  }
  .tk-stat{background:var(--card);border:1px solid var(--hair);border-radius:var(--r-card);padding:16px}
  .tk-stat.bad{border-color:var(--bad-line)}.tk-stat.warn{border-color:var(--warn-c)}
  .tk-stat .n{font-size:20px;font-weight:700;letter-spacing:var(--ls-num);color:var(--ink);line-height:1;font-variant-numeric:tabular-nums}
  .tk-stat.bad .n{color:var(--bad)}.tk-stat.warn .n{color:var(--warn-c)}
  .tk-stat .l{font-size:var(--fs-label);color:var(--t3);margin-top:8px}
  .tks{margin-bottom:var(--sp-5)}
  .tks-h{font-size:var(--fs-label);font-weight:var(--w-label);letter-spacing:var(--ls-label);text-transform:uppercase;color:var(--t3);margin:0 0 8px;display:flex;align-items:center;gap:8px}
  .tks-over{color:var(--bad)}.tks-today{color:var(--warn-c)}
  .tks-n{background:var(--soft,rgba(0,0,0,.06));border-radius:9999px;padding:1px 8px;font-size:var(--fs-label);color:var(--t2)}
  .tks-l{display:flex;flex-direction:column;gap:8px}
  .tks-done{margin-top:8px}
  .tks-done summary{font-size:var(--fs-label);color:var(--t3);cursor:pointer;padding:8px 0}
  .tks-done .tks-l{margin-top:8px}
  .tks-help{background:var(--card);border:1px solid var(--hair);border-radius:var(--r-card);margin-bottom:16px;overflow:hidden}
  .tks-help summary{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:16px;cursor:pointer;list-style:none}
  .tks-help summary::-webkit-details-marker{display:none}
  .tks-help-t{font-size:var(--fs-sec);font-weight:700;color:var(--ink)}
  .tks-help-x{font-size:var(--fs-label);font-weight:600;color:var(--gold-txt)}
  .tks-help[open] .tks-help-x::after{content:""}
  .tks-help-b{padding:0 16px 16px;font-size:var(--fs-sec);color:var(--t2);line-height:1.55}
  .tks-help-b p{margin:0 0 8px}
  .tks-help-b ul{margin:0;padding-left:16px;display:flex;flex-direction:column;gap:8px}
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

// Whole days until an auction date string (negative = past). 999 if unparseable,
// so undated lots sort last and never count as "closing soon".
const daysUntil = (s) => { const t = Date.parse(s); return Number.isFinite(t) ? Math.round((t - Date.now()) / 86400000) : 999; };

// Number of photos encoded in the feed's "#"-separated images field.
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
function matchCard(q, cardOpts = {}) {
  let lot = {};
  try { lot = JSON.parse(q.lot_json); } catch (e) {}
  const img = imageUrls(lot).medium;
  const title = `${esc(lot.year || "")} ${esc(lot.marka_name || "")} ${esc(lot.model_name || "")}`.trim();
  const strengthLabel = lot._strength || "Possible";
  const strKey = strengthLabel === "Strong" ? "strong" : strengthLabel === "Good" ? "good" : "poss";
  const strBadge = strengthLabel === "Strong" ? "b-str" : strengthLabel === "Good" ? "b-good" : "b-pos";
  const bid = Number(lot.start) > 0 ? yen(lot.start) : yen(lot.avg_price);
  // cardOpts.ret: the /admin path to come back to (current filters included),
  // threaded through the lot links and the decide fallback so filter state
  // survives the round trip.
  const ret = (cardOpts.ret && String(cardOpts.ret).startsWith("/admin")) ? String(cardOpts.ret) : "";
  const lotHref = `/admin?view=lot&id=${q.id}${ret ? `&ret=${encodeURIComponent(ret)}` : ""}`;
  // Fallback hrefs go to the GET confirmation page (/decide is POST-only, so a
  // bare GET there is a dead 405). The AJAX click handlers read token/action
  // from the query string and POST to /decide directly.
  const retQ = ret ? `&return=${encodeURIComponent(ret)}` : "";
  const approve = `/decide/confirm?token=${esc(q.token)}&action=approve${retQ}`;
  const skip = `/decide/confirm?token=${esc(q.token)}&action=reject${retQ}`;
  const days = daysUntil(lot.auction_date);
  const auc = esc(lot.auction || "");
  const aucDate = esc((lot.auction_date || "").slice(0, 10));
  // Closing signal: red text inside 24h, amber inside 48h, quiet otherwise.
  // Register rule: colour appears in a row only when it means urgency.
  const when = (days <= 0) ? `<span class="sc-close urgent">Closes today</span>`
    : (days === 1) ? `<span class="sc-close soon">Closes tomorrow</span>`
    : (days === 2) ? `<span class="sc-close soon">Closes in 2 days</span>`
    : (days > 2) ? `<span class="sc-close">Closes in ${days} days</span>`
    : aucDate ? `<span class="sc-close">${aucDate}</span>` : "";
  const landedNum = q._landed ? Number(q._landed.grandTotal) : 0;
  const hasContact = !!(q.client_email || q.client_whatsapp);
  // One muted spec line replaces the four-cell grid, the condition chips and
  // the why chips (all still on lot detail): Linear register, one line only.
  const cond = conditionScores(lot);
  const grade = fullGrade(lot);
  const spec = [
    (grade && grade !== "-") ? "Grade " + esc(grade) : "",
    lot.mileage ? Math.round(Number(lot.mileage) / 1000) + "k km" : "",
    lot.kuzov ? esc(lot.kuzov) : "",
    lot.eng_v ? esc(lot.eng_v) + "cc" : "",
    lot.kpp ? esc(lot.kpp) : "",
    cond ? [cond.ext ? "Ext " + esc(cond.ext) : "", cond.int ? "Int " + esc(cond.int) : ""].filter(Boolean).join(" / ") : "",
    bid ? "Bid " + bid : "",
  ].filter(Boolean).join(" · ");
  const haystack = esc(`${lot.year || ""} ${lot.marka_name || ""} ${lot.model_name || ""} ${q.client_name || ""} ${q.wlabel || ""} ${lot.kuzov || ""} ${lot.lot || ""}`.toLowerCase());
  return `<div class="mcard scard" data-qid="${q.id}" data-cid="${q.client_id}" data-str="${strKey}" data-days="${days}" data-landed="${landedNum}" data-client="${esc(q.client_name || "")}" data-make="${esc(lot.marka_name || "")}" data-color="${esc((lot.color || "").toLowerCase().replace(/\b[a-z]/g, (m) => m.toUpperCase()))}" data-auction="${auc}" data-search="${haystack}">
    <input type="checkbox" class="msel" name="ids" value="${q.id}" form="bulkForm" aria-label="Select this match">
    <a class="sc-img" href="${lotHref}" aria-label="View details" style="${img ? `background-image:url('${esc(img)}')` : ""}"></a>
    <div class="sc-body">
      <div class="sc-main">
        <div class="sc-head">
          <h3 class="sc-title"><a href="${lotHref}">${title}</a></h3>
          ${q._landed ? `<div class="sc-landed"><span class="sc-landed-k">Landed ${esc(q._landed.state)}</span><span class="sc-landed-v">A$${Number(q._landed.grandTotal).toLocaleString("en-AU")}</span></div>` : ""}
        </div>
        ${spec ? `<p class="sc-sub">${spec}</p>` : ""}
        <div class="sc-meta">
          <span class="b ${strBadge}"><span class="bd"></span>${esc(strengthLabel)}</span>
          ${lot._watch ? `<span class="b b-pos">Lead</span>` : ""}
          ${when}
          ${(auc || lot.lot) ? `<span class="sc-src">${[auc, lot.lot ? "Lot " + esc(lot.lot) : ""].filter(Boolean).join(" &middot; ")}</span>` : ""}
          <span class="sc-for">for <a class="clink" href="/admin?view=client&id=${q.client_id}" data-drawer="/admin/drawer?id=${q.client_id}" title="See this client's engagement and history to help close them">${esc(q.client_name)}</a>${q.wlabel ? ` &middot; ${esc(q.wlabel)}` : ""}</span>
        </div>
        ${(!hasContact && !lot._watch) ? `<div class="nocontact">No email or WhatsApp on file. Approving won't reach this client.</div>` : ""}
      </div>
      <div class="sc-actions">
        ${snoozeCtl(q, lot, ret)}
        <a class="btn-tertiary" href="${skip}">Skip</a>
        <a class="btn-primary btn-sm" href="${approve}">${lot._watch ? "Mark done" : "Approve &amp; send"}</a>
      </div>
    </div>
  </div>`;
}

// IA-AUDIT item 12: the quiet third action between Skip (terminal) and
// Approve (sends now). A snoozed card - visible only under the Snoozed
// filter - swaps the menu for a Wake now button.
function snoozeCtl(q, lot, ret) {
  const back = ret || "/admin?view=matches";
  const form = (until, label) => `<form method="POST" action="/matches/snooze" style="display:inline"><input type="hidden" name="id" value="${q.id}"><input type="hidden" name="until" value="${until}"><input type="hidden" name="back" value="${esc(back)}"><button class="sc-snz-opt" type="submit">${label}</button></form>`;
  const snoozed = q.snoozed_until && (tsMs(q.snoozed_until) || 0) > Date.now();
  if (snoozed) {
    return `<span class="sc-snz-until">Snoozed until ${esc(String(q.snoozed_until).slice(0, 10))}</span>${form("clear", "Wake now")}`;
  }
  const canClose = Number.isFinite(tsMs(lot.auction_date)) && tsMs(lot.auction_date) - 24 * 3600 * 1000 > Date.now();
  return `<details class="sc-snz"><summary>Snooze</summary><span class="sc-snz-menu">${form("1d", "Tomorrow")}${canClose ? form("close", "24h before close") : ""}</span></details>`;
}

// ---- Matches triage helpers (server-side filter, group, page) ---------------
// The Matches queue regularly holds 200+ cards, so the server does the heavy
// lifting: strength/closing filters, group-by-client and paging all live in the
// URL query (surviving a round trip to lot detail), and only a page of cards is
// rendered per response.
const MATCH_PAGE = 30;

// Canonical filter state from the ?f/&soon/&group/&shown params.
function matchQueryState(sp = {}) {
  const f = ["all", "strong", "good", "poss", "sg", "snoozed"].includes(sp.f) ? sp.f : "sg";
  return {
    f, // sg = Strong + Good (the triage default)
    soon: sp.soon === "1",
    group: sp.group === "none" ? "none" : "client",
    shown: Math.min(400, Math.max(1, parseInt(sp.shown, 10) || MATCH_PAGE)),
  };
}

// Decorate pending queue rows once with the parsed lot, a strength key, days to
// auction and age, so filter/group/sort never re-parse lot_json.
function decorateMatches(pending) {
  for (const q of pending) {
    if (q._lot) continue;
    let lot = {}; try { lot = JSON.parse(q.lot_json); } catch (e) {}
    q._lot = lot;
    if (!q._landed && lot._landed) q._landed = lot._landed;
    const s = lot._strength || "Possible";
    q._str = s === "Strong" ? "strong" : s === "Good" ? "good" : "poss";
    q._days = daysUntil(lot.auction_date);
    const t = tsMs(q.created_at);
    q._ageDays = Number.isFinite(t) ? Math.floor((Date.now() - t) / 86400000) : 0;
  }
  return pending;
}

function filterMatches(pending, st) {
  return pending.filter((q) => {
    // Snoozed mode receives the snoozed rows as its source; strength filters
    // don't apply, only the closing-soon toggle.
    if (st.f === "snoozed") return !(st.soon && q._days > 2);
    if (st.f === "sg" && q._str === "poss") return false;
    if ((st.f === "strong" || st.f === "good" || st.f === "poss") && q._str !== st.f) return false;
    if (st.soon && q._days > 2) return false;
    return true;
  });
}

// Order the filtered rows soonest-closing first. In group mode rows are grouped
// per client (groups ordered by their soonest-closing lot); `flat` is the final
// render order either way, so paging is a simple slice of it.
function orderMatches(filtered, st) {
  const byDays = (a, b) => (a._days - b._days) || (b.id - a.id);
  if (st.group === "none") return { groups: null, flat: [...filtered].sort(byDays) };
  const by = new Map();
  for (const q of filtered) {
    if (!by.has(q.client_id)) by.set(q.client_id, []);
    by.get(q.client_id).push(q);
  }
  const groups = [...by.values()];
  for (const rows of groups) rows.sort(byDays);
  groups.sort((A, B) => byDays(A[0], B[0]));
  return { groups, flat: groups.flat() };
}

// The next page of cards for the current filters (the "Load 30 more" fetch),
// or every card for one client when sp.cid is set (expanding a group whose
// cards sit beyond the current page). Session-scoped exactly like the full view.
export async function matchesChunk(env, session, sp = {}) {
  const st = matchQueryState(sp);
  const offset = Math.max(0, parseInt(sp.offset, 10) || 0);
  const pending = decorateMatches(await queryPendingMatches(env, session));
  const { flat } = orderMatches(filterMatches(pending, st), st);
  const p = new URLSearchParams({ view: "matches" });
  if (st.f !== "sg") p.set("f", st.f);
  if (st.soon) p.set("soon", "1");
  if (st.group === "none") p.set("group", "none");
  if (sp.cid) {
    p.set("shown", String(st.shown));
    const ret = "/admin?" + p.toString();
    return flat.filter((q) => String(q.client_id) === String(sp.cid)).map((q) => matchCard(q, { ret })).join("");
  }
  p.set("shown", String(offset + MATCH_PAGE));
  const ret = "/admin?" + p.toString();
  return flat.slice(offset, offset + MATCH_PAGE).map((q) => matchCard(q, { ret })).join("");
}

function matchesView(pending, opts = {}) {
  const snoozedRows = opts.snoozedRows || [];
  if (pending.length === 0 && snoozedRows.length === 0) {
    return `<div class="card"><div class="empty"><div class="rule"></div>
      No matches awaiting review.
      <form method="POST" action="/run" style="margin-top:16px" data-confirm="Run the auction search for every active customer search now? New matches on auto-notify searches are emailed or WhatsApped to clients immediately."><button type="submit" class="btn-primary">Run the auction search</button></form></div></div>` + ranToast();
  }
  decorateMatches(pending);
  decorateMatches(snoozedRows);
  const st = matchQueryState(opts.query || {});
  const sendOff = opts.settings && !settingOn(opts.settings, "send_to_client");

  // Whole-queue counts (pre-filter) for the ticker.
  let strong = 0, good = 0, poss = 0, soon = 0;
  for (const q of pending) {
    if (q._str === "strong") strong++; else if (q._str === "good") good++; else poss++;
    if (q._days <= 2) soon++;
  }
  // The Strong + Good default would render an empty page when the queue holds
  // no Strong or Good at all; fall back to everything in that case.
  if (st.f === "sg" && strong + good === 0) st.f = "all";

  // URL builder: every filter control is a link, so the chosen filter lives in
  // the URL and survives navigating into a lot and back.
  const params = (over = {}) => {
    const f = over.f !== undefined ? over.f : st.f;
    const soonV = over.soon !== undefined ? over.soon : st.soon;
    const groupV = over.group !== undefined ? over.group : st.group;
    const p = new URLSearchParams({ view: "matches" });
    if (f !== "sg") p.set("f", f);
    if (soonV) p.set("soon", "1");
    if (groupV === "none") p.set("group", "none");
    return p.toString();
  };
  const linkTo = (over) => "/admin?" + params(over);
  const retPath = "/admin?" + params({}) + (st.shown !== MATCH_PAGE ? "&shown=" + st.shown : "");

  // Snoozed mode renders the parked rows; every count above still reads from
  // the live queue, so the ticker never lies about workload.
  const filtered = filterMatches(st.f === "snoozed" ? snoozedRows : pending, st);
  const { groups, flat } = orderMatches(filtered, st);
  const shownRows = flat.slice(0, st.shown);
  const shownSet = new Set(shownRows.map((q) => q.id));
  const remaining = flat.length - shownRows.length;

  // Stat tiles double as filters: tap Strong / Good / Possible / Closing 48h
  // to filter, tap Awaiting review for everything.
  const tk = (k, n, ncls, dot, urgent, href, on) =>
    `<a class="mtk${urgent ? " urgent" : ""}${on ? " on" : ""}" href="${href}"><div class="mtk-k">${k}</div><div class="mtk-row"><span class="mtk-n${ncls ? " " + ncls : ""}">${n}</span><span class="mtk-dot" style="background:${dot}"></span></div></a>`;
  const ticker = `<div class="mticker">
    ${tk("Awaiting review", pending.length, "", "var(--t3)", false, linkTo({ f: "all", soon: false }), st.f === "all" && !st.soon)}
    ${tk("Strong", strong, "str", "var(--str-fg)", false, linkTo({ f: "strong" }), st.f === "strong")}
    ${tk("Good", good, "", "var(--good-fg)", false, linkTo({ f: "good" }), st.f === "good")}
    ${tk("Possible", poss, "", "var(--pos-fg)", false, linkTo({ f: "poss" }), st.f === "poss")}
    ${tk("Closing in 48h", soon, "bad", "var(--bad)", true, linkTo({ soon: !st.soon }), st.soon)}
  </div>`;

  // IA-AUDIT item 8: at 375 the 2x3 ticker grid plus the banner pushed the
  // first car to ~1075px. This single-row strip replaces BOTH at mobile (CSS
  // swaps them); each count is the same tappable filter, and the banner's
  // shown/hidden message folds into a one-line note. 1440 is untouched.
  const sk = (label, n, href, on, urgent) =>
    `<a class="msk${on ? " on" : ""}${urgent && n ? " urgent" : ""}" href="${href}">${label}<b>${n}</b></a>`;
  const strip = `<div class="mstrip">
    <div class="ms-row">
      ${sk("Awaiting", pending.length, linkTo({ f: "all", soon: false }), st.f === "all" && !st.soon)}
      ${sk("Strong", strong, linkTo({ f: "strong" }), st.f === "strong")}
      ${sk("Good", good, linkTo({ f: "good" }), st.f === "good")}
      ${sk("Possible", poss, linkTo({ f: "poss" }), st.f === "poss")}
      ${sk("48h", soon, linkTo({ soon: !st.soon }), st.soon, true)}
    </div>
    ${st.f === "sg" && poss > 0 ? `<div class="ms-note">${filtered.length} shown, ${poss} hidden <a href="${linkTo({ f: "all" })}">Show all</a></div>` : ""}
  </div>`;

  const pause = sendOff
    ? `<div class="pausebar"><span><strong>Client emails are paused</strong> in Settings, so “Approve &amp; send” will mark a match handled without emailing the client.</span></div>`
    : "";

  // Default-filter banner: the queue opens on Strong + Good, closing soonest.
  const banner = (st.f === "sg" && poss > 0)
    ? `<div class="mbanner" id="mBanner"><span>Showing ${filtered.length} Strong and Good match${filtered.length === 1 ? "" : "es"}, closing soonest first. ${poss} Possible hidden.</span><a href="${linkTo({ f: "all" })}">Show all</a><button type="button" class="bx" id="mBanX" aria-label="Dismiss">&times;</button></div>`
    : "";

  const chip = (label, over, on, extraCls = "", dot = "") =>
    `<a class="fchip${on ? " on" : ""}${extraCls}" href="${linkTo(over)}"${on ? ' aria-current="true"' : ""}>${dot}${label}</a>`;
  const chips = `<div class="fchips">
    ${chip("Strong + Good", { f: "sg" }, st.f === "sg")}
    ${chip("All", { f: "all" }, st.f === "all")}
    ${chip("Strong", { f: "strong" }, st.f === "strong", "", `<span class="sd" style="background:var(--str-fg)"></span>`)}
    ${chip("Good", { f: "good" }, st.f === "good", "", `<span class="sd" style="background:var(--good-fg)"></span>`)}
    ${chip("Possible", { f: "poss" }, st.f === "poss", "", `<span class="sd" style="background:var(--pos-fg)"></span>`)}
    ${chip("Closing in 48h", { soon: !st.soon }, st.soon, " urgent")}
    ${(snoozedRows.length || st.f === "snoozed") ? chip(`Snoozed (${snoozedRows.length})`, { f: "snoozed" }, st.f === "snoozed") : ""}
    <span class="bsp" style="flex:1"></span>
    ${chip("Grouped by client", { group: "client" }, st.group === "client")}
    ${chip("Flat list", { group: "none" }, st.group === "none")}
  </div>`;

  // Triage tools live behind one quiet disclosure (Linear register: a single
  // toolbar band above the list). The skip buttons act on ALL matching queue
  // rows (loaded or not); their id lists are computed here.
  const stale = pending.filter((q) => q._str === "poss" && q._ageDays >= 7);
  const allPoss = pending.filter((q) => q._str === "poss");
  const triage = `<details class="mtriage"><summary>Select &amp; bulk triage</summary><span class="quick">
      <button type="button" id="qAll">Select all shown</button>
      <button type="button" id="qStrong">Select all Strong</button>
      <button type="button" id="qSoon">Select all closing soon</button>
      ${opts.isAdmin ? `<button type="button" class="tri-skip" id="triStale" data-ids="${stale.map((q) => q.id).join(",")}" data-base="Skip Possible older than 7 days" data-noun="Possible match${stale.length === 1 ? "" : "es"} older than 7 days"${stale.length ? "" : " disabled"}>Skip Possible older than 7 days (${stale.length})</button>` : ""}
      ${opts.isAdmin ? `<button type="button" class="tri-skip" id="triPoss" data-ids="${allPoss.map((q) => q.id).join(",")}" data-base="Skip all Possible" data-noun="Possible match${allPoss.length === 1 ? "" : "es"}"${allPoss.length ? "" : " disabled"}>Skip all Possible (${allPoss.length})</button>` : ""}
      ${opts.aiEnabled ? `<form method="POST" action="/lot/fix-photos" style="display:inline" onsubmit="var b=this.querySelector('button');b.disabled=true;b.textContent='Starting…';"><button type="submit" id="qFix" title="AI-reads every car not read yet to fix cover photos and pull the inspection sheet (about 1 to 5 cents each)">Fix photos with AI</button></form>` : ""}
    </span></details>`;

  const controls = `<div class="mtools">
    <div class="crow">
      <label class="msearch"><input id="mq" type="search" placeholder="Search car, chassis, lot or client…" autocomplete="off"></label>
      ${chips}
    </div>
    ${triage}
  </div>`;

  // "Delete" hard-removes the selected matches from the queue (client asked for
  // a bulk delete "to start fresh"), distinct from "Skip", which keeps the row
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

  // Grid. Group headers always render (with accurate whole-group counts and a
  // summary strip) even when their cards are beyond the current page.
  let gridInner;
  if (groups) {
    gridInner = groups.map((rows) => {
      const q0 = rows[0];
      const cid = q0.client_id;
      const name = q0.client_name || "Client";
      const first = firstNameOf(name);
      const gs = rows.filter((q) => q._str === "strong").length;
      const gg = rows.filter((q) => q._str === "good").length;
      const gp = rows.filter((q) => q._str === "poss").length;
      const labels = [...new Set(rows.map((r) => r.wlabel).filter(Boolean))].slice(0, 2).join(" · ");
      const minDays = rows[0]._days;
      const closes = minDays <= 0 ? "closes today" : minDays === 1 ? "closes tomorrow" : `closes in ${minDays} days`;
      const strengthBits = [gs ? `${gs} Strong` : "", gg ? `${gg} Good` : "", gp ? `${gp} Possible` : ""].filter(Boolean).join(", ");
      // Send-pacing read (IA-AUDIT item 13): sent volume this week, whether it
      // landed, and how fresh - "nothing sent this week" is the green light.
      const sr = (opts.sentRecency || {})[cid];
      const pacing = sr ? `sent ${sr.n} this week (${sr.v || 0} opened), last ${relTime(sr.t)}` : "nothing sent this week";
      const ids = rows.map((r) => r.id).join(",");
      const loaded = rows.filter((r) => shownSet.has(r.id));
      // Groups whose cards sit beyond the current page render folded, so they
      // read as closed dropdowns; expanding one fetches its cards on demand.
      const folded = loaded.length === 0;
      return `<section class="mgroup${folded ? " folded" : ""}" data-cid="${cid}">
        <div class="ghead2">
          <button type="button" class="gh-fold" aria-expanded="${folded ? "false" : "true"}" aria-label="${folded ? "Expand" : "Collapse"} ${esc(name)}'s matches" data-name="${esc(name)}"></button>
          ${avatar(name)}
          <div class="gh-id">
            <div class="gh-name"><a class="clink" href="/admin?view=client&id=${cid}" data-drawer="/admin/drawer?id=${cid}">${esc(name)}</a> <span class="gh-count" data-n="${rows.length}">${rows.length} match${rows.length === 1 ? "" : "es"}</span></div>
            <div class="gh-sub">${[esc(labels), strengthBits, closes, pacing].filter(Boolean).join(" · ")}</div>
          </div>
          <button type="button" class="bap gh-send" data-ids="${ids}" data-name="${esc(first)}">Send all ${rows.length} to ${esc(first)}</button>
        </div>
        <div class="scards gh-cards" data-cards="${cid}">${loaded.map((q) => matchCard(q, { ret: retPath })).join("")}</div>
      </section>`;
    }).join("");
    gridInner += `<div class="mempty" id="mEmpty" style="display:${groups.length ? "none" : ""}">No matches fit these filters.</div>`;
  } else {
    gridInner = `<div class="scards" data-cards="flat">${shownRows.map((q) => matchCard(q, { ret: retPath })).join("")}</div>
      <div class="mempty" id="mEmpty" style="display:${flat.length ? "none" : ""}">No matches fit these filters.</div>`;
  }
  const grid = `<div id="mGrid" data-group="${st.group}" data-qs="${esc(params({}))}">${gridInner}</div>`;

  const more = remaining > 0
    ? `<div class="mmore"><a class="btn-secondary" id="mMore" href="${linkTo({})}&shown=${st.shown + MATCH_PAGE}" data-offset="${st.shown}" data-total="${flat.length}" data-qs="${esc(params({}))}">Load ${Math.min(MATCH_PAGE, remaining)} more (${remaining} left)</a></div>`
    : "";

  const css = `<style>
    a.mtk{text-decoration:none;color:inherit;cursor:pointer}
    .mtk.on{outline:2px solid var(--ink);outline-offset:-2px}
    .mbanner{display:flex;align-items:center;gap:12px;background:var(--off);border:1px solid var(--hair);color:var(--t2);border-radius:var(--r-card);padding:var(--sp-3) var(--sp-4);margin:0 0 var(--sp-4);font-size:var(--fs-sec);flex-wrap:wrap}
    .mbanner a{color:var(--gold-txt);font-weight:600;text-decoration:none;white-space:nowrap}
    .mbanner .bx{margin-left:auto;background:transparent;border:0;font-size:20px;line-height:1;color:var(--t3);cursor:pointer;padding:var(--sp-1) var(--sp-2)}
    a.fchip{text-decoration:none;display:inline-flex;align-items:center;gap:8px}
    .mtriage{margin-top:var(--sp-2)}
    .mtriage summary{display:inline-flex;align-items:center;gap:var(--sp-2);font-size:var(--fs-label);font-weight:var(--w-label);letter-spacing:var(--ls-label);text-transform:uppercase;color:var(--t3);cursor:pointer;list-style:none;padding:var(--sp-1) 0}
    .mtriage summary::-webkit-details-marker{display:none}
    .mtriage summary:after{content:"";width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:5px solid currentColor;transition:transform .15s}
    .mtriage[open] summary:after{transform:rotate(180deg)}
    .mtriage .quick{margin:var(--sp-2) 0 0;display:flex;gap:var(--sp-2);flex-wrap:wrap}
    .mgroup{margin:0 0 var(--sp-6)}
    .ghead2{display:flex;align-items:center;gap:12px;padding:var(--sp-3) var(--sp-1);flex-wrap:wrap}
    .gh-fold{width:28px;height:28px;border:1px solid var(--hair);border-radius:var(--r-ctl);background:var(--card);cursor:pointer;color:var(--t2);display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto}
    .gh-fold:after{content:"";width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid currentColor;transition:transform .15s}
    .mgroup.folded .gh-fold:after{transform:rotate(-90deg)}
    .mgroup.folded .gh-cards{display:none}
    .mgroup.ldg .gh-fold{opacity:.45;pointer-events:none}
    .gh-id{flex:1;min-width:180px}
    .gh-name{font-size:var(--fs-body);font-weight:var(--w-value)}
    .gh-name a{color:inherit;text-decoration:none}
    .gh-name a:hover{color:var(--gold-txt)}
    .gh-count{font-size:var(--fs-label);font-weight:var(--w-label);color:var(--t3);margin-left:var(--sp-2)}
    .gh-sub{font-size:var(--fs-label);color:var(--t3);margin-top:var(--sp-1)}
    .gh-send{white-space:nowrap}
    .scards.gh-cards{margin-top:var(--sp-2)}
    .mmore{display:flex;justify-content:center;margin:var(--sp-5) 0 var(--sp-2)}
    .mstrip{display:none}
    @media(max-width:759px){
      .mticker{display:none}
      .mbanner{display:none}
      .mstrip{display:block;margin:0 0 var(--sp-3)}
      .ms-row{display:flex;gap:var(--sp-2);overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:2px}
      .msk{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;min-height:40px;padding:6px 12px;border:1px solid var(--hair);border-radius:9999px;background:var(--card);color:var(--t2);font-size:var(--fs-sec);text-decoration:none}
      .msk b{font-weight:700;color:var(--ink);letter-spacing:var(--ls-num)}
      .msk.on{border-color:var(--gold);background:var(--gold-tint);color:var(--gold-txt)}
      .msk.on b{color:var(--gold-txt)}
      .msk.urgent b{color:var(--bad)}
      .ms-note{margin-top:var(--sp-2);font-size:var(--fs-sec);color:var(--t3)}
      .ms-note a{color:var(--gold-txt);font-weight:600;text-decoration:none;margin-left:4px}
    }
    @media(max-width:640px){
      .gh-fold{width:44px;height:44px}
      .mtriage summary{min-height:44px;align-items:center}
      .mtriage .quick button{min-height:44px}
      /* Selection bars live at the thumb (same rule as the Auctions send bar).
         Overrides the top-sticky default from the shared admin CSS. */
      .bulkbar2{position:fixed;top:auto;bottom:0;left:0;right:0;z-index:30;margin:0;border-radius:var(--r-card) var(--r-card) 0 0;padding:12px 16px;box-shadow:0 -8px 24px rgba(0,0,0,.35)}
    }
  </style>`;

  return css + ticker + strip + pause + banner + controls + bulk + grid + more + matchesScript() + ranToast() + fixToast();
}

// One-off toast after the "Fix photos with AI" button kicks off a background
// run. Uses the shared jdmToast from the shell's uxGuardScript.
function fixToast() {
  return `<script>(function(){function go(){try{var p=new URLSearchParams(location.search);if(!p.has("fixing"))return;if(window.jdmToast)window.jdmToast("Reading auction photos in the background. Refresh in a minute to see the covers update.",false,5200);p.delete("fixing");var qs=p.toString();history.replaceState(null,"",location.pathname+(qs?"?"+qs:""));}catch(e){}}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",go);else go();})();</script>`;
}

// Client-side controller for the Matches view: search, strength + closing-soon
// filters, sort, grouping with headers, and multi-select bulk actions. Cards are
// server-rendered, so if this script ever fails the cards and their per-card
// Approve/Skip links still work. No template literals or ${} inside this string.
// Shows a one-off "Found N new matches" / "No new matches" toast after a search,
// reading the ?ran=N the /run redirect adds, then cleans it from the URL.
function ranToast() {
  return `<script>(function(){function go(){try{var p=new URLSearchParams(location.search);if(!p.has("ran"))return;var n=parseInt(p.get("ran"),10)||0;var msg=n>0?("Found "+n+" new match"+(n===1?"":"es")):"No new matches this time";if(window.jdmToast)window.jdmToast(msg);p.delete("ran");var qs=p.toString();history.replaceState(null,"",location.pathname+(qs?"?"+qs:""));}catch(e){}}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",go);else go();})();</script>`;
}

// Client-side controller for the reorganised Matches view. The server owns
// filtering, grouping and paging (all in the URL); this script handles the
// loaded cards only: search-as-you-type, selection + bulk actions, per-group
// send-all, the stale-Possible triage buttons, collapsible groups (fetching a
// group's cards on demand when they sit beyond the current page) and the
// Load-more chunk fetch. No template literals or ${} inside this string.
function matchesScript() {
  return `<script>(function(){
  var grid=document.getElementById('mGrid'); if(!grid) return;
  var grouped=grid.getAttribute('data-group')!=='none';
  function toast(m,err){if(window.jdmToast){window.jdmToast(m,err);return;}alert(m);}
  function conf(m,go){if(window.jdmConfirm){window.jdmConfirm(m).then(function(ok){if(ok)go();});}else if(confirm(m))go();}
  function cards(){return [].slice.call(grid.querySelectorAll('.mcard'));}
  function visCards(){return cards().filter(function(c){return c.style.display!=='none';});}
  function syncBulk(){
    var n=0;
    cards().forEach(function(c){var cb=c.querySelector('.msel'); if(cb&&cb.checked){n++; c.classList.add('picked');} else c.classList.remove('picked');});
    var sc=document.getElementById('selCount'); if(sc)sc.textContent=n;
    var bar=document.getElementById('bulkBar'); if(bar)bar.className=n?'bulkbar2 show':'bulkbar2';
  }
  document.addEventListener('change',function(e){if(e.target&&e.target.classList&&e.target.classList.contains('msel'))syncBulk();});

  // Search over the loaded cards (strength / closing / grouping are server
  // filters in the URL, so they survive a round trip to lot detail).
  var mq=document.getElementById('mq');
  function applySearch(){
    var q=(mq&&mq.value?mq.value:'').toLowerCase(), shown=0;
    cards().forEach(function(c){var ok=!q||(c.getAttribute('data-search')||'').indexOf(q)>=0;c.style.display=ok?'':'none';if(ok)shown++;});
    [].slice.call(grid.querySelectorAll('.mgroup')).forEach(function(g){
      var any=[].slice.call(g.querySelectorAll('.mcard')).some(function(c){return c.style.display!=='none';});
      g.style.display=(any||!q)?'':'none';
    });
    var e=document.getElementById('mEmpty'); if(e)e.style.display=shown?'none':'';
  }
  if(mq)mq.addEventListener('input',applySearch);

  // Collapsible client groups; the collapsed set is remembered per tab session.
  // Groups whose cards sit beyond the current page arrive folded and empty;
  // expanding one fetches its cards from the chunk endpoint on demand.
  var FOLD='jdmMGrpFold';
  function foldMap(){try{return JSON.parse(sessionStorage.getItem(FOLD)||'{}')||{};}catch(e){return {};}}
  function setFold(cid,on){try{var m=foldMap();if(on)m[cid]=1;else delete m[cid];sessionStorage.setItem(FOLD,JSON.stringify(m));}catch(e){}}
  function applyFold(g,on){
    g.classList.toggle('folded',on);
    var b=g.querySelector('.gh-fold'); if(!b)return;
    b.setAttribute('aria-expanded',on?'false':'true');
    var n=b.getAttribute('data-name'); if(n)b.setAttribute('aria-label',(on?'Expand ':'Collapse ')+n+"'s matches");
  }
  (function(){var m=foldMap();[].slice.call(grid.querySelectorAll('.mgroup')).forEach(function(g){if(m[g.getAttribute('data-cid')])applyFold(g,true);});})();

  // Slot server-rendered cards into their groups (or the flat list), skipping
  // any already on the page so a group fetch and Load more can overlap safely.
  // In-order (Load more) chunks also clear the out-of-band mark on cards they
  // cover, so the load-more offset - a count of in-order cards - stays honest.
  function appendChunk(html,oob){
    var t=document.createElement('template'); t.innerHTML=html;
    var list=[].slice.call(t.content.querySelectorAll('.mcard')), added=0;
    list.forEach(function(c){
      var ex=grid.querySelector('.mcard[data-qid="'+c.getAttribute('data-qid')+'"]');
      if(ex){ if(!oob)ex.removeAttribute('data-oob'); return; }
      var target=grouped?grid.querySelector('[data-cards="'+c.getAttribute('data-cid')+'"]'):grid.querySelector('[data-cards="flat"]');
      if(target){ if(oob)c.setAttribute('data-oob','1'); target.appendChild(c); added++; }
    });
    return {count:list.length,added:added};
  }
  function loadGroup(g){
    var box=g.querySelector('.gh-cards'); if(!box||g.getAttribute('data-busy'))return;
    var el=g.querySelector('.gh-count');
    var want=el?(parseInt(el.getAttribute('data-n'),10)||0):0;
    if(box.querySelectorAll('.mcard').length>=want)return;
    g.setAttribute('data-busy','1'); g.classList.add('ldg');
    var qs=grid.getAttribute('data-qs')||'';
    fetch('/admin/matches/chunk?'+qs+'&cid='+encodeURIComponent(g.getAttribute('data-cid')||''))
      .then(function(r){ if(!r.ok)throw 0; return r.text(); })
      .then(function(html){
        g.removeAttribute('data-busy'); g.classList.remove('ldg');
        appendChunk(html,true);
        applySearch(); syncBulk();
      })
      .catch(function(){
        g.removeAttribute('data-busy'); g.classList.remove('ldg');
        applyFold(g,true); setFold(g.getAttribute('data-cid'),true);
        toast('Could not load those matches, please try again',true);
      });
  }
  grid.addEventListener('click',function(e){
    var b=e.target&&e.target.closest?e.target.closest('.gh-fold'):null; if(!b)return;
    var g=b.closest('.mgroup'); if(!g)return;
    var on=!g.classList.contains('folded'); applyFold(g,on); setFold(g.getAttribute('data-cid'),on);
    if(!on)loadGroup(g);
  });

  // Dismissible default-filter banner.
  var ban=document.getElementById('mBanner');
  if(ban){
    try{if(sessionStorage.getItem('jdmMBanHide')==='1')ban.style.display='none';}catch(e){}
    var bx=document.getElementById('mBanX');
    if(bx)bx.addEventListener('click',function(){ban.style.display='none';try{sessionStorage.setItem('jdmMBanHide','1');}catch(e){}});
  }

  function pick(list){list.forEach(function(c){var cb=c.querySelector('.msel');if(cb)cb.checked=true;});syncBulk();}
  var qa=document.getElementById('qAll'); if(qa)qa.addEventListener('click',function(){pick(visCards());});
  var qs2=document.getElementById('qStrong'); if(qs2)qs2.addEventListener('click',function(){pick(visCards().filter(function(c){return c.getAttribute('data-str')==='strong';}));});
  var qn=document.getElementById('qSoon'); if(qn)qn.addEventListener('click',function(){pick(visCards().filter(function(c){var d=parseFloat(c.getAttribute('data-days'));return !isNaN(d)&&d<=2;}));});
  var bcl=document.getElementById('bClear'); if(bcl)bcl.addEventListener('click',function(){cards().forEach(function(c){var cb=c.querySelector('.msel');if(cb)cb.checked=false;});syncBulk();});

  // Remove a card in place, keeping its group header count honest. The count is
  // the whole group (loaded or not), so it just decrements by one.
  function bumpGroup(g,delta){
    var el=g.querySelector('.gh-count'); if(!el)return;
    var n=Math.max(0,(parseInt(el.getAttribute('data-n'),10)||0)+delta);
    el.setAttribute('data-n',n); el.textContent=n+(n===1?' match':' matches');
    var send=g.querySelector('.gh-send');
    if(send)send.textContent='Send all '+n+' to '+(send.getAttribute('data-name')||'client');
    if(n<=0&&g.parentNode)g.parentNode.removeChild(g);
  }
  function dropCard(c){
    var g=c.closest('.mgroup');
    c.style.transition='opacity .25s ease, transform .25s ease';
    c.style.opacity='0'; c.style.transform='scale(.96)';
    setTimeout(function(){ if(c.parentNode)c.parentNode.removeChild(c); if(g)bumpGroup(g,-1); },240);
  }
  function removeByIds(ids){
    var set={}; ids.forEach(function(i){set[String(i)]=1;});
    cards().forEach(function(c){ if(set[c.getAttribute('data-qid')])dropCard(c); });
  }
  function postBulk(action,ids){
    var body=new URLSearchParams(); body.set('action',action);
    ids.forEach(function(id){body.append('ids',id);});
    return fetch('/matches/bulk',{method:'POST',body:body}).then(function(r){ if(!r.ok)throw 0; });
  }

  // Bulk bar: validate, confirm the consequence, lock while in flight.
  function selIds(){var out=[];cards().forEach(function(c){var cb=c.querySelector('.msel');if(cb&&cb.checked)out.push(cb.value);});return out;}
  function bulkGo(ev,btn,action,busy,msg){
    ev.preventDefault();
    var ids=selIds();
    if(!ids.length){toast('Select at least one match first',true);return;}
    conf(msg(ids.length),function(){
      var btns=['bApprove','bSkip','bDelete'].map(function(id){return document.getElementById(id);});
      var orig=btn.textContent; btn.textContent=busy;
      btns.forEach(function(b){if(b)b.disabled=true;});
      postBulk(action,ids).then(function(){
        removeByIds(ids);
        toast(action==='approve'?'Sent '+ids.length+' (one combined email per client)':action==='reject'?'Skipped '+ids.length:'Deleted '+ids.length);
        btn.textContent=orig; btns.forEach(function(b){if(b)b.disabled=false;}); syncBulk();
      }).catch(function(){
        btn.textContent=orig; btns.forEach(function(b){if(b)b.disabled=false;});
        toast('Could not action the selection, please try again',true);
      });
    });
  }
  var ba=document.getElementById('bApprove'); if(ba)ba.addEventListener('click',function(ev){bulkGo(ev,ba,'approve','Sending…',function(n){return 'Send the '+n+' selected match'+(n===1?'':'es')+' now? Each client gets one combined email.';});});
  var bs=document.getElementById('bSkip'); if(bs)bs.addEventListener('click',function(ev){bulkGo(ev,bs,'reject','Skipping…',function(n){return 'Skip the '+n+' selected match'+(n===1?'':'es')+'? The clients will not be contacted about these cars.';});});
  var bd=document.getElementById('bDelete'); if(bd)bd.addEventListener('click',function(ev){bulkGo(ev,bd,'delete','Deleting…',function(n){return 'Permanently delete the '+n+' selected match'+(n===1?'':'es')+' from the queue? This cannot be undone.';});});

  // Per-group "Send all N to [name]": one combined email via the same bulk
  // path. Acts on every match in the group, loaded or not.
  document.addEventListener('click',function(e){
    var b=e.target&&e.target.closest?e.target.closest('.gh-send'):null; if(!b||b.disabled)return;
    var ids=(b.getAttribute('data-ids')||'').split(',').filter(Boolean);
    var name=b.getAttribute('data-name')||'the client';
    if(!ids.length)return;
    conf('Send all '+ids.length+' match'+(ids.length===1?'':'es')+' to '+name+'? This emails '+(ids.length===1?'this car':'these '+ids.length+' cars')+' in one message.',function(){
      var orig=b.textContent; b.textContent='Sending…'; b.disabled=true;
      var g=b.closest('.mgroup');
      postBulk('approve',ids).then(function(){
        if(g&&g.parentNode)g.parentNode.removeChild(g);
        toast('Sent '+ids.length+' to '+name+' in one combined message');
        syncBulk();
      }).catch(function(){ b.textContent=orig; b.disabled=false; toast('Could not send, please try again',true); });
    });
  });

  // Stale-Possible triage buttons: id lists are server-computed (loaded or
  // not), the confirm states exactly how many will be skipped.
  function wireTriage(id){
    var btn=document.getElementById(id); if(!btn)return;
    btn.addEventListener('click',function(){
      var ids=(btn.getAttribute('data-ids')||'').split(',').filter(Boolean);
      if(!ids.length){toast('Nothing to skip',true);return;}
      conf('Skip '+ids.length+' '+(btn.getAttribute('data-noun')||'matches')+'? The clients will not be contacted about these cars.',function(){
        var orig=btn.textContent; btn.textContent='Skipping…'; btn.disabled=true;
        postBulk('reject',ids).then(function(){
          removeByIds(ids);
          btn.setAttribute('data-ids','');
          btn.textContent=(btn.getAttribute('data-base')||'Skip')+' (0)';
          toast('Skipped '+ids.length);
          syncBulk();
        }).catch(function(){ btn.textContent=orig; btn.disabled=false; toast('Could not skip, please try again',true); });
      });
    });
  }
  wireTriage('triStale'); wireTriage('triPoss');

  // Load more: fetch the next server-rendered chunk and slot each card into its
  // group (the plain href is the no-JS fallback). The next offset is how many
  // in-order cards are loaded now - out-of-band group loads don't count until a
  // chunk covers them - which stays correct after in-place removals too.
  var more=document.getElementById('mMore');
  if(more)more.addEventListener('click',function(e){
    e.preventDefault();
    if(more.getAttribute('data-busy'))return;
    more.setAttribute('data-busy','1');
    var orig=more.textContent; more.textContent='Loading…';
    var off=cards().filter(function(c){return !c.hasAttribute('data-oob');}).length;
    var total=parseInt(more.getAttribute('data-total'),10)||0;
    var qs=more.getAttribute('data-qs')||'';
    fetch('/admin/matches/chunk?'+qs+'&offset='+off).then(function(r){ if(!r.ok)throw 0; return r.text(); }).then(function(html){
      var res=appendChunk(html,false);
      more.removeAttribute('data-busy');
      var now=cards().length, left=Math.max(0,total-now);
      if(!res.count||left<=0){var w=more.parentNode;if(w&&w.parentNode)w.parentNode.removeChild(w);}
      else{more.textContent='Load '+Math.min(30,left)+' more ('+left+' left)';}
      try{var u=new URL(location.href);u.searchParams.set('shown',now);history.replaceState(null,'',u.toString());}catch(e2){}
      applySearch(); syncBulk();
    }).catch(function(){ more.removeAttribute('data-busy'); more.textContent=orig; toast('Could not load more, please try again',true); });
  });

  // Per-card Approve / Skip without leaving the page.
  grid.addEventListener('click',function(e){
    var a=e.target&&e.target.closest?e.target.closest('a.btn-primary, a.btn-tertiary'):null; if(!a)return;
    var card=a.closest('.mcard'); if(!card)return; e.preventDefault();
    var approve=a.classList.contains('btn-primary'); a.classList.add('is-loading'); a.textContent=approve?'Sending…':'Skipping…';
    var u=new URL(a.getAttribute('href'),location.href),body=new URLSearchParams(u.search);body.set('ajax','1');
    fetch('/decide',{method:'POST',body:body}).then(function(r){ if(!r.ok)throw 0;
      toast(approve?'Sent to client':'Skipped');
      dropCard(card); syncBulk();
    }).catch(function(){ a.textContent=approve?'Approve & send':'Skip'; toast('Could not action, try again',true); });
  });

  syncBulk();
})();<\/script>`;
}

// Standalone approve/skip handler for pages that render match cards without the
// Matches grid controller (the client detail page). Sends the action in the
// background and fades the card out, no reload.
function matchActionScript() {
  return `<script>(function(){
  document.addEventListener('click',function(e){
    var a=e.target&&e.target.closest?e.target.closest('a.btn-primary, a.btn-tertiary'):null; if(!a)return;
    var card=a.closest('.mcard'); if(!card)return; e.preventDefault();
    var approve=a.classList.contains('btn-primary'); a.classList.add('is-loading'); a.textContent=approve?'Sending…':'Skipping…';
    var u=new URL(a.getAttribute('href'),location.href),body=new URLSearchParams(u.search);body.set('ajax','1');
    fetch('/decide',{method:'POST',body:body}).then(function(r){ if(!r.ok)throw 0;
      card.style.transition='opacity .2s'; card.style.opacity='0';
      setTimeout(function(){ if(card.parentNode)card.parentNode.removeChild(card); },200);
      toast(approve?'Sent to client':'Skipped');
    }).catch(function(){ a.textContent=approve?'Approve & send':'Skip'; toast('Could not action, try again',true); });
  });
  function toast(m,err){if(window.jdmToast){window.jdmToast(m,err);return;}var t=document.createElement('div');t.textContent=m;t.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:'+(err?'var(--bad)':'var(--card-2)')+';color:var(--on-solid);border:1px solid rgba(255,255,255,0.12);padding:12px 18px;border-radius:8px;font:600 13px sans-serif;z-index:9999';document.body.appendChild(t);setTimeout(function(){t.remove();},2200);}
  })();<\/script>`;
}

// Plain-English key for the Strong / Good / Possible labels, shown on the
// Matches view and client pages so agents know what each strength means.
function strengthLegend() {
  return `<div class="slegend">
    <div class="sl-row">
      <span class="sl-t">Match strength</span>
      <span class="sl-item"><span class="sl-dot" style="background:var(--good)"></span><b>Strong</b> well under budget and a clear step above the grade asked for</span>
      <span class="sl-item"><span class="sl-dot" style="background:var(--warn-c)"></span><b>Good</b> a solid fit on budget and grade</span>
      <span class="sl-item"><span class="sl-dot" style="background:var(--t3)"></span><b>Possible</b> meets the basics, less margin</span>
    </div>
    <details class="sl-more"><summary>How it's scored</summary><div class="sl-detail">Strength blends four things: how far under the client's max budget the lot sits, how far its auction grade beats the minimum grade asked for, an exact chassis-code or keyword match, and a bonus for top-condition lots (grade 4.5 or higher). Strong is a clear all-round fit; Possible just meets the basics and is lower priority.</div></details>
  </div>`;
}

// Follow-up autopilot (cron): when a request's sent cars have sat unopened for
// 3 days with no response, seed one follow-up task through the existing task
// path so the dashboard attention panel surfaces it. Idempotent: skips any
// request with an open follow-up task, or one created in the last 3 days.
export async function autoFollowUps(env) {
  try {
    const rows = (await env.DB.prepare(
      `SELECT q.wishlist_id, q.client_id, c.name AS client_name, w.owner_id, c.agent_id
         FROM queue q
         JOIN clients c ON c.id = q.client_id
         LEFT JOIN wishlists w ON w.id = q.wishlist_id
        WHERE q.status = 'sent' AND q.sent_at IS NOT NULL AND q.sent_at <= datetime('now','-3 days')
          AND q.viewed_at IS NULL AND q.response IS NULL AND q.wishlist_id IS NOT NULL
        GROUP BY q.wishlist_id`
    ).all()).results || [];
    let created = 0;
    for (const r of rows) {
      const first = String(r.client_name || "this client").trim().split(/\s+/)[0] || "this client";
      const dupe = await env.DB.prepare(
        "SELECT id FROM tasks WHERE wishlist_id = ? AND type = 'follow_up' AND (status != 'done' OR created_at >= datetime('now','-3 days'))"
      ).bind(r.wishlist_id).first();
      if (dupe) continue;
      await insertTask(env, {
        title: `Follow up with ${first}, sent cars unopened for 3 days`,
        type: "follow_up", wishlist_id: r.wishlist_id, client_id: r.client_id,
        assigned_to: r.owner_id || r.agent_id || null, due: new Date(), priority: "normal",
      });
      created++;
    }
    return created;
  } catch (e) { console.error("autoFollowUps failed:", e.message); return 0; }
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
  const marka = sstr(form, "marka_name"), model = sstr(form, "model_name");
  const kuzov = sstr(form, "kuzov"), gradeKw = sstr(form, "grade_kw");
  const modelCode = sstr(form, "model_code", FIELD_MAX.kuzov);
  // The create-time rule holds on edit too: blanking every narrowing term
  // would turn a saved search into a whole-feed match-everything (V1.3).
  if (!(marka || model || kuzov || gradeKw || modelCode)) return { ok: false, error: "term" };
  const { yMin, yMax } = yearPair(form);
  await updateWishlistDrift(env, [
    ["label", sstr(form, "label")], ["marka_name", marka], ["model_name", model],
    ["year_min", yMin], ["year_max", yMax], ["price_max", sint(form, "price_max", PRICE_MAX_CAP)],
    ["mileage_max", sint(form, "mileage_max", MILEAGE_MAX_CAP)], ["mileage_min", sint(form, "mileage_min", MILEAGE_MAX_CAP)], ["rate_min", clampRange(num(form, "rate_min"), 1, 6)],
    ["kuzov", kuzov], ["grade_kw", gradeKw], ["watch_only", form.get("watch_only") ? 1 : 0],
    ["model_code", modelCode], ["grades", sgrades(form)],
  ], "WHERE id = ?", [id]);
  return { ok: true };
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
    + ((w.mileage_min || w.mileage_max)
        ? ` · ${w.mileage_min ? Number(w.mileage_min).toLocaleString() + "km" : "0"}${w.mileage_max ? ` to ${Number(w.mileage_max).toLocaleString()}km` : "+ km"}`
        : "")
    + (w.rate_min ? ` · grade ${esc(w.rate_min)}+` : "")
    + (w.model_code ? ` · ${esc(w.model_code)}` : "")
    + (gradesText(w.grades) ? ` · ${esc(gradesText(w.grades))}` : "");
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
        return `<a class="btn-primary wl-search" href="/admin?view=client&id=${w.client_id}&${p.toString()}#find">${ICONS.auctions}Search</a>`;
      })()
    : "";
  // V1.3 Phase C fold: on the staff client profile, each search IS a request, so
  // show its pipeline stage + deposit inline and let staff advance it right here
  // (the standalone request page's core, folded into the profile in simplified
  // form). Portal buyers and system rows never see these controls.
  const back = `/admin?view=client&id=${w.client_id}`;
  const reqStrip = (opts.requestControls && !opts.portal && !SYSTEM_WISHLIST_LABELS.has(w.label))
    ? `<div class="wlreq">
        <span class="wlreq-k">Stage</span>${statusSelect(w.id, w.status, back)}
        <span class="wlreq-k">Deposit</span>${depositBadge(w.deposit_status)}
        ${(w.deposit_status || "none") === "none"
          ? `<form method="POST" action="/request/status" style="display:inline"><input type="hidden" name="id" value="${w.id}"><input type="hidden" name="status" value="deposit_requested"><input type="hidden" name="back" value="${esc(back)}"><button class="btn-secondary wlreq-btn" type="submit">Request deposit</button></form>`
          : (w.deposit_status || "none") !== "paid"
            ? `<form method="POST" action="/request/status" style="display:inline"><input type="hidden" name="id" value="${w.id}"><input type="hidden" name="status" value="deposit_paid"><input type="hidden" name="back" value="${esc(back)}"><button class="btn-secondary wlreq-btn" type="submit">Mark paid</button></form>`
            : ""}
        ${w.next_action_date ? `<span class="wlreq-na" title="Next follow-up">Follow up ${esc(String(w.next_action_date).slice(0, 10))}${w.next_action_note ? " · " + esc(w.next_action_note) : ""}</span>` : ""}
      </div>`
    : "";
  return `<div class="wlrow">
    <div class="wlhead">
      <div class="wlsum">
        <div class="wln">${esc(w.label || "Search")} ${w.active ? "" : `<span class="chip muted">paused</span>`} ${opts.requestControls && !SYSTEM_WISHLIST_LABELS.has(w.label) ? `<span class="reqid">REQ-${w.id}</span>` : ""}</div>
        <div class="wlc">${summary || "Matches anything"}</div>
        ${reqStrip}
      </div>
      <div class="wlacts">
        ${searchBtn}
        <button type="button" class="btn-toggle wl-editbtn" onclick="var d=this.closest('.wlrow').querySelector('.wledit');d.open=!d.open;if(d.open)d.scrollIntoView({block:'nearest'})">Edit</button>
        <form method="POST" action="${base}/wishlist/toggle" style="display:inline"><input type="hidden" name="id" value="${w.id}"><button class="btn-toggle ${w.active ? "on" : "off"}" type="submit">${w.active ? "On" : "Off"}</button></form>
        ${(w.active && !w.watch_only && !SYSTEM_WISHLIST_LABELS.has(w.label))
          ? (opts.portal
            ? `<form method="POST" action="${base}/wishlist/run" style="display:inline"><input type="hidden" name="id" value="${w.id}"><button class="btn-toggle" type="submit" title="Check the latest auctions for this search now">Check now</button></form>`
            : `<form method="POST" action="/admin/run-search/${w.id}" style="display:inline"><button class="btn-toggle" type="submit" title="Run the matcher for this search now">Run match</button></form>`)
          : ""}
        ${opts.portal
          ? `<form method="POST" action="${base}/wishlist/delete" style="display:inline" onsubmit="return confirm('Delete this search? This cannot be undone.')"><input type="hidden" name="id" value="${w.id}"><button class="btn-danger" type="submit">Delete</button></form>`
          : `<form method="POST" action="${base}/wishlist/delete" style="display:inline" data-confirm="Delete this search? Its pending matches are removed and it stops matching new auction lots. This cannot be undone." data-danger data-confirm-ok="Delete search"><input type="hidden" name="id" value="${w.id}"><button class="btn-danger" type="submit">Delete</button></form>`}
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
          ${field("Min mileage (km)", "mileage_min", "number")}
          ${field("Max mileage (km)", "mileage_max", "number")}
          ${field("Min grade", "rate_min", "number")}
          ${field("Chassis or model code", "kuzov", null, "(contains, best match)")}
          ${field("Grade keyword", "grade_kw", null, "(contains)")}
          ${field("Model code", "model_code", null, "(exact variant)")}
          <div><label>Grades <span class="opt">(comma separated, any spelling matches)</span><input name="grades" value="${esc(gradesText(w.grades))}" placeholder="e.g. S450, S450 EXCLUSIVE"></label></div>
        </div>
        ${opts.portal ? "" : `<label style="display:flex;align-items:flex-start;gap:8px;margin-top:12px;font-size:13px;color:var(--t2);cursor:pointer"><input type="checkbox" name="watch_only" value="1" style="width:auto;margin-top:2px"${w.watch_only ? " checked" : ""}><span><strong>Watch only (lead).</strong> Surface matches for a follow-up call, never auto-email this client.</span></label>`}
        <div class="actions"><button class="btn-primary" type="submit">Save changes</button>
          <span class="help">Blank fields match anything.</span></div>
      </form>
    </details>
  </div>`;
}

// Self-contained bulk bar for the client page (the main Matches controller isn't
// loaded here). Select-all + Approve/Skip the ticked matches, then return here.
function clientBulkBar(cid, qs = "") {
  // The no-JS fallback posts with a `back` that carries the current find query,
  // so a native bulk action never wipes the search results off the page.
  const back = `/admin?view=client&id=${cid}${qs ? "&" + qs : ""}`;
  return `<form id="bulkForm" method="POST" action="/matches/bulk"><input type="hidden" name="action" id="bulkAction"><input type="hidden" name="back" value="${esc(back)}"></form>
    <div class="actionbar actionbar-inline">
      <label class="ab-check"><input type="checkbox" id="cdAll"> Select all</label>
      <span class="ab-count"><span id="cdCount">0</span> selected</span>
      <span class="ab-spring"></span>
      <button type="submit" form="bulkForm" class="bap" id="cdApprove" onclick="document.getElementById('bulkAction').value='approve'">Approve &amp; send</button>
      <button type="submit" form="bulkForm" class="bsk" id="cdSkip" onclick="document.getElementById('bulkAction').value='reject'">Skip</button>
    </div>
    <script>(function(){
      var all=document.getElementById('cdAll'),cnt=document.getElementById('cdCount');
      function boxes(){return [].slice.call(document.querySelectorAll('.mgrid .msel'));}
      function upd(){var bs=boxes(),n=0;bs.forEach(function(b){if(b.checked)n++;});if(cnt)cnt.textContent=n;if(all)all.checked=bs.length>0&&n===bs.length;}
      function toast(m,err){if(window.jdmToast){window.jdmToast(m,err);return;}alert(m);}
      function conf(m,go2){if(window.jdmConfirm){window.jdmConfirm(m).then(function(ok){if(ok)go2();});}else if(confirm(m))go2();}
      function go(ev,btn,action,busy,msg){
        ev.preventDefault();
        var picked=boxes().filter(function(b){return b.checked;});
        if(!picked.length){toast('Select at least one match first',true);return;}
        conf(msg(picked.length),function(){
          var btns=[document.getElementById('cdApprove'),document.getElementById('cdSkip')];
          var orig=btn.textContent;btn.textContent=busy;btns.forEach(function(b){if(b)b.disabled=true;});
          var body=new URLSearchParams();body.set('action',action);
          picked.forEach(function(b){body.append('ids',b.value);});
          fetch('/matches/bulk',{method:'POST',body:body}).then(function(r){if(!r.ok)throw 0;
            picked.forEach(function(b){var card=b.closest('.mcard');if(card){card.style.transition='opacity .25s ease, transform .25s ease';card.style.opacity='0';card.style.transform='scale(.96)';setTimeout(function(){if(card.parentNode)card.parentNode.removeChild(card);upd();},240);}});
            toast(action==='approve'?'Sent '+picked.length+' in one combined message':'Skipped '+picked.length);
            btn.textContent=orig;btns.forEach(function(b){if(b)b.disabled=false;});
          }).catch(function(){
            btn.textContent=orig;btns.forEach(function(b){if(b)b.disabled=false;});
            toast('Could not action the selection, please try again',true);
          });
        });
      }
      var bap=document.getElementById('cdApprove');if(bap)bap.addEventListener('click',function(ev){go(ev,bap,'approve','Sending…',function(n){return 'Send the '+n+' selected match'+(n===1?'':'es')+' now? The client gets one combined email.';});});
      var bsk=document.getElementById('cdSkip');if(bsk)bsk.addEventListener('click',function(ev){go(ev,bsk,'reject','Skipping…',function(n){return 'Skip the '+n+' selected match'+(n===1?'':'es')+'? The client will not be contacted about '+(n===1?'this car':'these cars')+'.';});});
      if(all)all.addEventListener('change',function(){boxes().forEach(function(b){b.checked=all.checked;});upd();});
      document.addEventListener('change',function(e){if(e.target&&e.target.classList&&e.target.classList.contains('msel'))upd();});
      upd();
    })();</script>`;
}

// Client detail page: contact, owner, their wishlists (editable) and their live
// matches. Reached by clicking a client name in the Clients list.
// Full detail + auction report for one matched lot (queue row). Renders entirely
// from the lot_json snapshot taken at match time, every spec, photo, the
// equipment/info notes and the landed-cost estimate are already captured, so the
// page makes no extra auction-feed calls.
function lotGalleryScript() {
  return `<script>(function(){var hero=document.getElementById('ldHero');if(!hero)return;document.querySelectorAll('.ld-th').forEach(function(b){b.addEventListener('click',function(){var f=b.getAttribute('data-full');if(f)hero.style.backgroundImage="url('"+f+"')";document.querySelectorAll('.ld-th').forEach(function(x){x.classList.remove('on')});b.classList.add('on');});});})();</script>`;
}

export async function lotDetailPage(env, queueId, session = { role: "admin", id: 0 }, opts = {}) {
  const qid = Number(queueId);
  // Honour a ?ret= path (same-app only) so the back link restores the exact
  // Matches filters, grouping and page the user came from.
  const retPath = (opts.ret && String(opts.ret).startsWith("/admin")) ? String(opts.ret) : "/admin?view=matches";
  const back = `<a class="btn-secondary" href="${esc(retPath)}">Back to matches</a>`;
  const notFound = () => shell(sidebar("matches", {}, session),
    `<div class="topbar"><div><div class="kicker">Vehicle Finder</div><h1>Vehicle</h1></div>${back}</div>
     <div class="content"><div class="card"><div class="empty">This vehicle is no longer in your queue.</div></div></div>`,
    "Vehicle - JDM Connect");
  if (!Number.isInteger(qid) || qid <= 0) return notFound();
  const q = await env.DB.prepare(
    `SELECT q.*, c.name AS client_name, c.email AS client_email, c.whatsapp AS client_whatsapp,
            w.label AS wlabel, w.rate_min AS w_rate,
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
  // the inspection sheet added closer to the sale, so heal the cached snapshot
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
  // WhatsApp. The token can only VIEW, never approve/skip. Staff author the
  // page's suggested price + condition notes here (notes pre-fill from the AI
  // sheet read), and can revoke or regenerate the link per car.
  const shareTitle = `${lot.year || ""} ${lot.marka_name || ""} ${lot.model_name || ""}`.replace(/\s+/g, " ").trim();
  const shareRevoked = !!q.share_revoked_at;
  const shareToken = shareRevoked ? null : await makeShareToken(env, q.id, q.share_nonce || null);
  const sheetPrefill = lot._sheet
    ? [lot._sheet.notes_en, (lot._sheet.repairs || []).length ? "Marks: " + lot._sheet.repairs.join("; ") + "." : ""].filter(Boolean).join(" ")
    : "";
  const shareNotesVal = String(q.share_condition_notes || sheetPrefill || "").slice(0, 2000);
  const shareWaText = [shareTitle, q.share_price_note ? String(q.share_price_note) : ""].filter(Boolean).join(" - ");
  const shareViews = Number(q.share_view_count) > 0
    ? `<p class="ld-share-p" style="margin-top:8px">Opened ${q.share_view_count} time${Number(q.share_view_count) === 1 ? "" : "s"}${q.share_last_viewed_at ? " &middot; last " + esc(relTime(q.share_last_viewed_at)) : ""}</p>`
    : "";
  const shareLifecycle = `<div class="ld-share-row" style="margin:8px 0 0">
        ${shareRevoked ? "" : `<form method="POST" action="/share/revoke" style="flex:1;display:flex"><input type="hidden" name="id" value="${q.id}"><input type="hidden" name="back" value="${esc(retPath)}"><button class="btn-secondary" type="submit" style="flex:1">Revoke link</button></form>`}
        <form method="POST" action="/share/regenerate" style="flex:1;display:flex"><input type="hidden" name="id" value="${q.id}"><input type="hidden" name="back" value="${esc(retPath)}"><button class="btn-secondary" type="submit" style="flex:1">${shareRevoked ? "Issue a new link" : "New link"}</button></form>
      </div>`;
  const shareBody = shareRevoked
    ? `<div class="ld-share-h">Link revoked</div>
       <p class="ld-share-p">Anyone opening an old link sees an &ldquo;expired&rdquo; page. Issue a new link to share this car again.</p>
       ${shareLifecycle}`
    : `<div class="ld-share-h">Share with a client</div>
       <p class="ld-share-p">A view-only link to this car. No login needed.</p>
       <div class="ld-share-row"><input id="shareUrl" readonly value="${esc(`/v?t=${encodeURIComponent(shareToken || "")}`)}" aria-label="Share link"><button type="button" id="shareCopy" class="btn-secondary">Copy</button></div>
       <a id="shareWa" href="https://wa.me/?text=${encodeURIComponent(shareWaText + " - /v?t=" + encodeURIComponent(shareToken || ""))}" target="_blank" rel="noopener" class="btn-primary ld-share-wa">Share on WhatsApp</a>
       ${shareViews}
       <form method="POST" action="/share/details" class="ld-share-form">
         <input type="hidden" name="id" value="${q.id}"><input type="hidden" name="back" value="${esc(retPath)}">
         <label for="sharePrice">Suggested price <span class="opt">(shown on the page)</span></label>
         <input id="sharePrice" name="price_note" maxlength="200" placeholder="e.g. Suggest 16-17k landed" value="${esc(q.share_price_note || "")}">
         <label for="shareNotes">Condition notes <span class="opt">(pre-filled from the sheet read)</span></label>
         <textarea id="shareNotes" name="condition_notes" rows="4" maxlength="2000" placeholder="Plain-English condition summary for the client">${esc(shareNotesVal)}</textarea>
         <button class="btn-primary" type="submit">Save to share page</button>
       </form>
       ${shareLifecycle}`;
  const shareBtn = `<details class="ld-share">
      <summary class="btn-secondary">Share${shareRevoked ? " (revoked)" : ""}</summary>
      <div class="ld-share-pop">${shareBody}</div>
    </details>`;
  // JSON.stringify doesn't escape "<", so a "</script>" in the staff-entered
  // price note could otherwise break out of this inline script.
  const scriptJson = (v) => JSON.stringify(v).replace(/</g, "\\u003c");
  const shareScript = shareToken ? `<script>(function(){var t=${scriptJson(shareToken)},ti=${scriptJson(shareWaText)};var url=location.origin+"/v?t="+encodeURIComponent(t);var i=document.getElementById('shareUrl');if(i)i.value=url;var w=document.getElementById('shareWa');if(w)w.href="https://wa.me/?text="+encodeURIComponent(ti+" - "+url);var c=document.getElementById('shareCopy');if(c)c.addEventListener('click',function(){if(navigator.clipboard){navigator.clipboard.writeText(url).then(function(){c.textContent='Copied';setTimeout(function(){c.textContent='Copy';},1500);});}else{var el=document.getElementById('shareUrl');el.focus();el.select();try{document.execCommand('copy');}catch(e){}}});})();</script>` : "";

  // Images. The inspection sheet (first image, by feed convention) goes in its
  // own box; the rest are the car-photo gallery. Shared with the cards/emails via
  // splitImages so they all agree on which image is the sheet. `bases` (all
  // images) is kept for the admin "Feed image data" diagnostic below.
  const bases = String(lot.images || "").split("#").map((u) => u.trim().replace(/[?&][hw]=\d+$/i, "")).filter(Boolean);
  const { sheet: sheetBase, photos: photoBases } = splitImages(lot);
  // Market intelligence (sold comparables) + live FX, in parallel. Both are
  // cached and degrade to null/fallback, so the page never blocks on them.
  const [market, fx] = await Promise.all([
    marketIntel(env, lot.marka_name, lot.model_name, Date.now(), { kuzov: lot.kuzov, grade: lot.grade, year: lot.year, mileage: lot.mileage }).catch(() => null),
    getLiveFx(env).catch(() => 0),
  ]);
  const marketBox = marketPanel(market);
  // The image proxy only serves the plain (full) URL or the &w=320 / &h=50
  // transforms, arbitrary widths return nothing. Hero = full, thumbs = &w=320.
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
  // IA-AUDIT item 11: the budget delta is the number staff quote on the phone.
  // The gap is computed in JPY (budget cap vs the lot's market price) and
  // expressed in AUD via the landed estimate's own implied rate
  // (purchaseAUD / lot JPY), so it never disagrees with the landed figure.
  const budgetLine = (() => {
    const budget = Number(q.w_price) || 0;
    if (!budget) return "";
    const jpy = lotJpy(lot);
    if (!jpy) return `<div class="ld-cl-b">Budget ¥${budget.toLocaleString()}</div>`;
    const diff = budget - jpy;
    const audPerJpy = q._landed && Number(q._landed.purchaseAUD) > 0 ? Number(q._landed.purchaseAUD) / jpy : 0;
    const amount = audPerJpy ? `about A$${Math.round(Math.abs(diff) * audPerJpy).toLocaleString("en-AU")}` : `¥${Math.abs(diff).toLocaleString()}`;
    const lead = q._landed && Number(q._landed.grandTotal) > 0 ? `A$${Number(q._landed.grandTotal).toLocaleString("en-AU")} landed vs ` : "";
    return `<div class="ld-cl-b${diff < 0 ? " over" : ""}">${lead}¥${budget.toLocaleString()} budget &middot; ${amount} ${diff < 0 ? "over" : "under"}</div>`;
  })();
  const days = daysUntil(lot.auction_date);
  const when = (days === 0) ? `<span class="ld-when urgent">Auction today</span>`
    : (days === 1) ? `<span class="ld-when urgent">Auction in 1 day</span>`
    : (days > 1) ? `<span class="ld-when">Auction in ${days} days</span>` : "";
  const chips = whyChips(q);
  const equip = String(lot.equip || "").trim();
  const info = String(lot.info || "").trim();
  const sheet = lot._sheet;
  const aiBtn = opts.aiEnabled
    ? `<form method="POST" action="/lot/read-sheet" class="ld-ai-form" onsubmit="var b=this.querySelector('button');b.disabled=true;b.classList.add('is-loading');b.textContent='Reading the sheet… (~10s)';"><input type="hidden" name="id" value="${q.id}"><button class="btn-secondary" type="submit">${sheet ? "Re-read auction sheet with AI" : "Read auction sheet with AI"}</button></form>`
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
  // where they came from (the ret path when present, else the client's page).
  const ret = opts.ret && String(opts.ret).startsWith("/admin") ? String(opts.ret) : `/admin?view=client&id=${q.client_id}`;
  // The confirm states the consequence, including the contactless case the
  // match cards already warn about.
  const hasContact = !!(q.client_email || q.client_whatsapp);
  const approveConfirm = lot._watch
    ? `Mark this lead match as done? ${esc(q.client_name || "The client")} is watch-only and will not be contacted.`
    : hasContact
      ? `Approve and send this car to ${esc(q.client_name || "the client")}? They get one message with this car.`
      : `${esc(q.client_name || "This client")} has no email or WhatsApp on file. Approving will mark this handled but nothing will reach them. Continue?`;
  const contactWarn = (!hasContact && !lot._watch && q.status === "pending")
    ? `<div class="nocontact" style="margin:12px 0 0">No email or WhatsApp on file. Approving won't reach this client.</div>`
    : "";
  const actions = q.status === "pending"
    ? `${contactWarn}<div class="ld-actions">
        <form method="POST" action="/decide">
          <input type="hidden" name="token" value="${esc(q.token)}">
          <input type="hidden" name="action" value="reject">
          <input type="hidden" name="return" value="${esc(ret)}">
          <button class="btn-tertiary" type="submit">Skip</button>
        </form>
        <form method="POST" action="/decide" data-confirm="${approveConfirm}" data-confirm-ok="${lot._watch ? "Mark done" : "Send it"}">
          <input type="hidden" name="token" value="${esc(q.token)}">
          <input type="hidden" name="action" value="approve">
          <input type="hidden" name="return" value="${esc(ret)}">
          <button class="btn-primary btn-sm" type="submit">${lot._watch ? "Mark done" : "Approve &amp; send"}</button>
        </form>
      </div>`
    : `<div class="ld-status">This match is <strong>${esc(q.status || "filed")}</strong>.</div>`;

  // One tap from ANY match (live or already actioned) back into the hunt:
  // pre-fills the client's Find-a-car search with this exact car's shape.
  // Most valuable when a car sold or was passed on and staff need the next one.
  const firstNm = String(q.client_name || "").trim().split(/\s+/)[0] || "client";
  const simQs = new URLSearchParams({ view: "client", id: String(q.client_id) });
  if (lot.marka_name) simQs.set("make", String(lot.marka_name).trim());
  if (lot.model_name) simQs.set("model", String(lot.model_name).trim());
  if (lot.kuzov) simQs.set("kuzov", String(lot.kuzov).trim().split("-")[0]);
  const findSimilar = `<a class="btn-secondary ld-similar" href="/admin?${simQs.toString()}#find">Find similar live cars for ${esc(firstNm)}</a>`;

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
      ${opts.err ? `<div class="reqerr" style="margin-bottom:16px">${esc(opts.err)}</div>` : ""}
      <div class="ld-grid">
        <div class="ld-left">
          ${gallery}
          ${sheetBox}
          ${marketBox}
          ${session.role === "admin" ? `<details class="ld-feed"><summary>Feed image data (${bases.length} image${bases.length === 1 ? "" : "s"} from the auction feed)</summary>
            <p class="help" style="margin:12px 0 8px">Raw <code>images</code> field we received for this lot (this is everything the feed sent, so if the inspection sheet isn't here, the feed didn't include it):</p>
            <pre class="ld-raw">${esc(lot.images || "(empty, the feed sent no images for this lot)")}</pre>
          </details>` : ""}
          ${notes}
        </div>
        <aside class="ld-right">
          <div class="card ld-card">
            <div class="ld-top"><div class="ld-grade"><div class="ld-grade-n">${esc(fullGrade(lot))}</div><div class="ld-grade-k">Auction grade</div></div>${landed}</div>
            ${when ? `<div class="ld-when-row">${when}</div>` : ""}
            <div class="ld-client">${avatar(q.client_name)}<div class="ld-cl"><div class="ld-cl-n">Match for ${esc(q.client_name)}</div><div class="ld-cl-w">${esc(q.wlabel || "search")}</div>${budgetLine}</div></div>
            ${actions}
            ${findSimilar}
            <div class="ld-rows">${specRows}</div>
            <div class="ld-sec">Auction</div>
            <div class="ld-rows">${auctionRows}</div>
            ${chips.length ? `<div class="why" style="padding:16px 0 0">${chips.map((c) => `<span class="wc">${c}</span>`).join("")}</div>` : ""}
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
  /* Attio record rhythm: the record header spans full width, then the work
     (searches, find, matches) runs in a primary column with the quieter
     record-keeping (activity, portal, edit) in a 340px side rail whose card
     titles sit one type tier down. */
  .cd-grid{display:grid;grid-template-columns:minmax(0,1fr);align-items:start}
  @media(min-width:1100px){.cd-grid{grid-template-columns:minmax(0,1fr) 340px;column-gap:var(--gap-grid)}}
  .cd-rail .card h2{font-size:var(--fs-body)}
  /* Edit details lives in the ~340px rail, so its fields stack full-width
     instead of using the 3-up .grid (which squeezed each field to ~100px and
     wrapped every label). State + Category are short, so they pair on one row. */
  .cd-edit-grid{display:grid;grid-template-columns:1fr;gap:14px}
  .cd-edit-pair{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  @media(max-width:400px){.cd-edit-pair{grid-template-columns:1fr}}
  .cd-edit-grid label{white-space:normal}
  .cd-edit-grid .opt{display:inline}
  .cd-head .avatar{width:44px;height:44px;font-size:var(--fs-body);margin-right:0}
  /* Long unbroken contact strings (55 char emails) must wrap, not push the
     record header past a 375px viewport. */
  .cd-head .help{overflow-wrap:anywhere}
  /* Last contacted: the quiet register carries the quiet-buyer signal; the
     health dot supplies the urgency tone (green fresh, amber cooling, red
     stale or never). */
  .cd-lastc{margin-top:8px;font-size:var(--fs-sec);color:var(--t2)}
  .cd-lastc b{color:var(--ink);font-weight:600}
  .cd-chips{display:flex;flex-wrap:wrap;gap:8px}
  .cd-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
  .cd-cta{text-decoration:none;font-size:var(--fs-sec);font-weight:600;padding:8px 12px;border-radius:var(--r-ctl);background:var(--card);border:1px solid var(--hair);color:var(--ink)}
  .cd-cta:hover{border-color:var(--field-line);background:var(--hover)}
  /* Quick message templates: a quiet disclosure under the contact buttons. */
  .qmsg{margin-top:16px;border-top:1px solid var(--hair);padding-top:12px}
  .qmsg summary{cursor:pointer;list-style:none;font-size:var(--fs-sec);font-weight:600;color:var(--gold-txt)}
  .qmsg summary::-webkit-details-marker{display:none}
  .qmsg summary:hover{text-decoration:underline}
  .qm-row{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;padding:12px 0;border-bottom:1px solid var(--hair-2)}
  .qm-row:last-child{border-bottom:0;padding-bottom:0}
  .qm-main{flex:1;min-width:220px}
  .qm-l{font-size:var(--fs-sec);font-weight:600;color:var(--ink)}
  .qm-t{font-size:var(--fs-label);color:var(--t3);margin-top:4px;line-height:1.5;overflow-wrap:anywhere}
  .qm-acts{display:flex;gap:8px;flex-wrap:wrap}
  .qm-act{font-size:var(--fs-label);padding:6px 10px;cursor:pointer;font-family:inherit}
  .cd-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(88px,1fr));gap:12px;margin-top:16px;padding-top:16px;border-top:1px solid var(--hair)}
  .cd-stat-n{font-size:20px;font-weight:700;letter-spacing:var(--ls-num);color:var(--ink);line-height:1;font-variant-numeric:tabular-nums}
  .cd-stat-n.cd-stat-sm{font-size:var(--fs-body);font-weight:700}
  .cd-stat-l{font-size:var(--fs-label);color:var(--t3);margin-top:8px}
</style>`;

// Canned outreach templates (the Pipedrive/HubSpot template library, sized for
// a small shop): the four moments that cover most manual follow-up. Each opens
// WhatsApp or email PREFILLED, or copies to the clipboard, so the words are one
// tap away but staff can still edit before sending. {car} comes from the
// client's primary saved search so the message never reads like a mail merge.
function quickMsgTemplates(c, primaryWl) {
  const first = String(c.name || "").trim().split(/\s+/)[0] || "there";
  const w = primaryWl || {};
  const car = displayName([w.marka_name, w.model_name].filter(Boolean).join(" ")) || "JDM";
  return [
    { id: "intro", label: "New cars on the way", subject: "Cars we found for you at auction",
      text: `Hi ${first}, JDM Connect here. We've spotted some ${car} examples at auction this week that fit your search, sending them through now. Tell us which ones you'd like a closer look at.` },
    { id: "followup", label: "Follow up on sent cars", subject: "Did you see the cars we sent?",
      text: `Hi ${first}, JDM Connect here. Just checking you saw the cars we sent through. Happy to pull the auction sheet translation or extra photos on any of them.` },
    { id: "deposit", label: "Deposit nudge", subject: "Ready to bid when you are",
      text: `Hi ${first}, JDM Connect here. To bid at auction we hold a refundable deposit, so we can move the moment the right ${car} comes up. Want me to send the payment link?` },
    { id: "requiet", label: "Re-engage a quiet buyer", subject: "Still chasing that " + car + "?",
      text: `Hi ${first}, JDM Connect here. Fresh ${car} listings keep coming through the Japanese auctions every week. Want us to keep the search running, or adjust what we're looking for?` },
  ];
}

// The template picker on the client record: a quiet disclosure under the
// contact buttons. Rendered only when there is a channel to send through.
function quickMsgMenu(c, primaryWl) {
  const waDigits = String(c.whatsapp || "").replace(/[^0-9]/g, "");
  if (!waDigits && !c.email) return "";
  const rows = quickMsgTemplates(c, primaryWl).map((t) => {
    const wa = waDigits ? `<a class="cd-cta qm-act" data-clog="${c.id}:whatsapp" target="_blank" rel="noopener" href="${esc(`https://wa.me/${waDigits}?text=${encodeURIComponent(t.text)}`)}">WhatsApp</a>` : "";
    const mail = c.email ? `<a class="cd-cta qm-act" data-clog="${c.id}:email" href="${esc(`mailto:${c.email}?subject=${encodeURIComponent(t.subject)}&body=${encodeURIComponent(t.text)}`)}">Email</a>` : "";
    return `<div class="qm-row">
      <div class="qm-main"><div class="qm-l">${esc(t.label)}</div><div class="qm-t">${esc(t.text)}</div></div>
      <div class="qm-acts">${wa}${mail}<button type="button" class="cd-cta qm-act" data-copy="${esc(t.text)}">Copy</button></div>
    </div>`;
  }).join("");
  return `<details class="qmsg">
    <summary>Quick message templates</summary>
    <div class="qm-menu">${rows}</div>
    <script>document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-copy]');if(!b)return;var t=b.getAttribute('data-copy');(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){var was=b.textContent;b.textContent='Copied';setTimeout(function(){b.textContent=was;},1200);}).catch(function(){window.prompt('Copy the message:',t);});});</script>
  </details>`;
}

export async function clientDetailPage(env, clientId, session = { role: "admin", id: 0 }, opts = {}) {
  const cid = Number(clientId);
  const notFound = () => shell(sidebar("clients", {}, session),
    `<div class="topbar"><div><div class="kicker">Vehicle Finder</div><h1>Client</h1></div><a class="btn-secondary" href="/admin?view=clients">Back to clients</a></div>
     <div class="content"><div class="card"><div class="empty">Client not found.</div></div></div>${CRM_CSS}`,
    "Client - JDM Connect");
  if (!Number.isInteger(cid) || cid <= 0) return notFound();
  if (!(await clientAccessibleBy(env, cid, session))) return notFound();
  const c = await env.DB.prepare("SELECT * FROM clients WHERE id = ?").bind(cid).first();
  if (!c) return notFound();

  const wls = (await env.DB.prepare("SELECT * FROM wishlists WHERE client_id = ? ORDER BY id").bind(cid).all()).results || [];
  const lastc = await lastContacted(env, cid);
  await expirePast(env);
  const matches = (await env.DB.prepare(
    `SELECT q.*, c.name AS client_name, c.email AS client_email, c.whatsapp AS client_whatsapp,
            w.label AS wlabel, w.rate_min AS w_rate, w.price_max AS w_price, w.kuzov AS w_kuzov, w.grade_kw AS w_kw
       FROM queue q JOIN clients c ON c.id = q.client_id LEFT JOIN wishlists w ON w.id = q.wishlist_id
      WHERE q.client_id = ? AND q.status = 'pending' AND ${SNOOZE_LIVE} ORDER BY q.created_at DESC LIMIT 60`
  ).bind(cid).all()).results || [];
  const snoozedN = (await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM queue WHERE client_id = ? AND status = 'pending' AND snoozed_until > datetime('now')"
  ).bind(cid).first())?.n || 0;
  // IA-AUDIT item 13: send pacing for THIS client - the decision to send more
  // is made on this page, so the week's volume and its reception sit above the
  // grid.
  const sentWk = (await env.DB.prepare(
    `SELECT COUNT(*) AS n, MAX(sent_at) AS t,
            SUM(CASE WHEN viewed_at IS NOT NULL THEN 1 ELSE 0 END) AS v,
            SUM(CASE WHEN response = 'interested' THEN 1 ELSE 0 END) AS i
       FROM queue WHERE client_id = ? AND sent_at >= datetime('now','-7 days')`
  ).bind(cid).first()) || {};

  // Cars this client has asked us to action/translate from their portal.
  const requested = (await env.DB.prepare(
    `SELECT q.*, w.label AS wlabel FROM queue q LEFT JOIN wishlists w ON w.id = q.wishlist_id
      WHERE q.client_id = ? AND q.client_request = 1 ORDER BY q.client_request_at DESC LIMIT 40`
  ).bind(cid).all()).results || [];

  // Sent-lot history: everything already actioned (sent Tue, opened Wed,
  // passed), so the page answers "what did we send and what happened?".
  const history = (await env.DB.prepare(
    `SELECT q.*, w.label AS wlabel FROM queue q LEFT JOIN wishlists w ON w.id = q.wishlist_id
      WHERE q.client_id = ? AND q.status != 'pending' ORDER BY COALESCE(q.decided_at, q.created_at) DESC LIMIT 20`
  ).bind(cid).all()).results || [];

  // Unified activity feed: notes, sends, views, responses and contact taps all
  // land in `activity`; fold in payments and the latest portal login. Data the
  // app already records - nothing here needs manual upkeep.
  const actsRaw = (await env.DB.prepare(
    "SELECT type, detail, actor, created_at FROM activity WHERE client_id = ? ORDER BY created_at DESC, id DESC LIMIT 30"
  ).bind(cid).all()).results || [];
  const payEvents = (await env.DB.prepare(
    "SELECT amount_cents, currency, status, COALESCE(paid_at, created_at) AS created_at FROM payments WHERE client_id = ? ORDER BY created_at DESC LIMIT 10"
  ).bind(cid).all()).results || [];
  const feed = [
    ...actsRaw,
    ...payEvents.map((p) => ({ type: "deposit", detail: `Payment ${p.status}: A$${(Number(p.amount_cents || 0) / 100).toLocaleString("en-AU")}`, actor: "Stripe", created_at: p.created_at })),
    ...(c.last_seen ? [{ type: "login", detail: "Signed in to the portal", actor: c.name, created_at: c.last_seen }] : []),
  ].sort((a, b) => (tsMs(b.created_at) || 0) - (tsMs(a.created_at) || 0)).slice(0, 25);

  // Engagement roll-up across ALL of this client's matches (not just pending) so
  // the CRM header can show at a glance: examples sent, how many they opened,
  // and when they last looked, the numbers that tell staff how warm they are.
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
  // editable Searches list, they're plumbing, not searches staff manage.
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
    isDealer(c) ? `<span class="chip">Dealer</span>` : "",
    c.member ? `<span class="chip chip-gold">Member</span>` : `<span class="chip muted">Not a member</span>`,
    c.portal_enabled ? `<span class="chip chip-good">Portal ${c.pass_hash ? "active" : "invited"}</span>` : "",
    c.destination_country ? `<span class="chip muted">${esc(c.destination_country)}</span>` : (c.state ? `<span class="chip muted">${esc(c.state)}</span>` : ""),
  ].filter(Boolean).join("");
  const contactBtns = [
    waDigits ? `<a class="cd-cta" data-clog="${c.id}:whatsapp" href="https://wa.me/${esc(waDigits)}" target="_blank" rel="noopener">WhatsApp</a><a class="cd-cta" data-clog="${c.id}:call" href="tel:${esc(telDigits)}">Call</a>` : "",
    c.email ? `<a class="cd-cta" data-clog="${c.id}:email" href="mailto:${esc(c.email)}">Email</a>` : "",
    `<a class="cd-cta" href="#find">Find a car</a>`,
    // Quick edit: the Edit-details card lives at the bottom of the side rail
    // (below the fold on phones), so surface it as a header action that jumps
    // to the card and springs it open.
    canManage ? `<a class="cd-cta" href="#edit-details">Edit details</a>` : "",
  ].filter(Boolean).join("");
  const stat = (n, label) => `<div class="cd-stat"><div class="cd-stat-n">${Number(n) || 0}</div><div class="cd-stat-l">${label}</div></div>`;
  const lastViewed = eng.last_viewed ? String(eng.last_viewed).slice(0, 10) : "-";
  const msgMenu = quickMsgMenu(c, searchWls[0]);
  const head = `<div class="card cd-card">
    <div class="cd-head">
      <span class="avatar" style="width:46px;height:46px;font-size:var(--fs-body)">${esc(initials(c.name))}</span>
      <div style="flex:1;min-width:0">
        <h2 style="border:0;padding:0;margin:0 0 4px">${esc(c.name)}</h2>
        <div class="cd-chips">${statusChips}</div>
        <div class="help" style="margin-top:8px">${contact}</div>
        <div class="cd-lastc">${healthDot(lastc && lastc.t)}${lastc ? `Last contacted <b>${esc(relTime(lastc.t))}</b> &middot; ${esc(lastc.how)}` : "Never contacted"}</div>
      </div>
      <div class="cd-owner"><div class="k">Owner</div><div class="v">${ownerLabel}</div></div>
    </div>
    ${contactBtns ? `<div class="cd-actions">${contactBtns}</div>` : ""}
    ${msgMenu}
    <div class="cd-stats">
      ${stat(searchWls.length, searchWls.length === 1 ? "Search" : "Searches")}
      ${stat(matches.length, "Live matches")}
      ${stat(eng.sent, "Examples sent")}
      ${stat(eng.viewed, "Opened")}
      ${stat(eng.interested, "Interested")}
      <div class="cd-stat"><div class="cd-stat-n cd-stat-sm">${lastViewed}</div><div class="cd-stat-l">Last viewed</div></div>
      <div class="cd-stat"><div class="cd-stat-n cd-stat-sm">${c.last_seen ? String(c.last_seen).slice(0, 10) : "-"}</div><div class="cd-stat-l">Last login</div></div>
    </div>
  </div>${CRM_CSS}`;

  // Edit core contact details (owner/admin only). Folded away by default, but
  // springs open if the last save failed so the error and the form are visible.
  const editCard = canManage ? `<details class="card foldcard" id="edit-details" style="scroll-margin-top:80px"${opts.cerr ? " open" : ""}>
    <summary>Edit details</summary>
    ${opts.cerr ? `<div class="dupnote">${esc(clientEditErrorMessage(opts.cerr))}</div>` : ""}
    <form method="POST" action="/client/update">
      <input type="hidden" name="id" value="${c.id}">
      <div class="cd-edit-grid">
        <div><label for="ec-name">Name</label><input id="ec-name" name="name" maxlength="120" value="${esc(c.name || "")}" required></div>
        <div><label for="ec-email">Email <span class="opt">(email or WhatsApp required)</span></label><input id="ec-email" name="email" type="email" maxlength="254" spellcheck="false" value="${esc(c.email || "")}" placeholder="name@email.com"></div>
        <div><label for="ec-whatsapp">WhatsApp <span class="opt">(+61…)</span></label><input id="ec-whatsapp" name="whatsapp" type="tel" inputmode="tel" maxlength="40" value="${esc(c.whatsapp || "")}" placeholder="+61 4XX XXX XXX"></div>
        <div class="cd-edit-pair">
          <div><label for="ec-state">State <span class="opt">(landed-cost estimates)</span></label><select id="ec-state" name="state">${stateOptions(normalizeState(c.state) || "")}</select></div>
          <div><label for="ec-category">Category <span class="opt">(dealer = trade)</span></label>${categorySelect("ec-category", c.category)}</div>
        </div>
      </div>
      <div class="actions"><button class="btn-primary" type="submit">Save changes</button>
        <span class="help">Updates this client's contact details across the app.</span></div>
    </form>
    <script>(function(){var d=document.getElementById('edit-details');if(!d)return;document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href="#edit-details"]');if(a)d.open=true;});if(location.hash==='#edit-details')d.open=true;})();</script>
  </details>` : "";

  // Buyer-portal access control (owner/admin only).
  const portalState = c.portal_enabled ? (c.pass_hash ? "Active - client can sign in" : "Invited - awaiting password") : "Not enabled";
  const portalCard = canManage ? `<div class="card">
    <div class="portal-acct">
      <div style="flex:1">
        <div class="pa-k">BUYER PORTAL</div>
        <div style="font-weight:600;margin-top:4px">${portalState}</div>
      </div>
      <div class="pwrap">
        ${c.email
          ? `<form method="POST" action="/client/portal-invite" style="display:inline"><input type="hidden" name="id" value="${c.id}"><button class="btn-primary" type="submit">${c.portal_enabled ? "Resend set-password link" : "Give portal access"}</button></form>`
          : `<span class="help">Add an email to enable portal access.</span>`}
        ${session.role === "admin" && c.portal_enabled && c.pass_hash
          ? `<form method="POST" action="/send-reset" style="display:inline"><input type="hidden" name="kind" value="client"><input type="hidden" name="id" value="${c.id}"><button class="btn-toggle" type="submit">Send password reset</button></form>`
          : ""}
        ${c.portal_enabled ? `<form method="POST" action="/client/portal-revoke" style="display:inline" data-confirm="Revoke this client's portal access? Their password is cleared and any signed-in session stops working." data-danger><input type="hidden" name="id" value="${c.id}"><button class="btn-danger" type="submit">Revoke</button></form>` : ""}
      </div>
    </div>
    ${c.portal_enabled ? `<div class="portal-acct" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--hair)">
      <div style="flex:1">
        <div class="pa-k">MEMBERSHIP</div>
        <div style="font-weight:600;margin-top:4px">${c.member ? "Member &middot; can use Auction search" : "Not a member"}</div>
      </div>
      <div class="pwrap">
        ${session.role === "admin"
          ? `<form method="POST" action="/client/member" style="display:inline"><input type="hidden" name="id" value="${c.id}"><input type="hidden" name="member" value="${c.member ? "0" : "1"}"><button class="${c.member ? "btn-danger" : "btn-primary"}" type="submit">${c.member ? "Remove member access" : "Make member"}</button></form>`
          : `<span class="help">Managed by JDM Connect (paid membership).</span>`}
      </div>
    </div>` : ""}
  </div>` : "";

  // Manage the record itself: archive (soft-hide) or delete (hard-remove). These
  // also live on each Customers-list row, but were not discoverable from the
  // detail page during QA, so surface them here too for admin/owner. Same
  // confirmation pattern (data-confirm / data-danger) as every other destructive
  // action. Delete is owner-only server-side; archive/restore is owner or admin.
  const manageCard = canManage ? `<div class="card">
    <div class="pa-k">MANAGE CUSTOMER</div>
    <p class="help" style="margin:4px 0 12px">Archiving hides ${esc(c.name)} from the active list but keeps their history. Deleting removes them and all their searches for good.</p>
    <div class="pwrap">
      ${c.archived
        ? `<form method="POST" action="/client/unarchive" style="display:inline"><input type="hidden" name="id" value="${c.id}"><button class="btn-primary" type="submit">Restore from archive</button></form>`
        : `<form method="POST" action="/client/archive" style="display:inline" data-confirm="Archive ${esc(c.name)}? They move to the archive and drop out of the active list, matcher runs and dashboards. You can restore them any time." data-confirm-ok="Archive"><input type="hidden" name="id" value="${c.id}"><button class="btn-toggle" type="submit">Archive</button></form>`}
      <form method="POST" action="/client/delete" style="display:inline" data-confirm="Delete ${esc(c.name)} and ALL their searches, matches and history? This cannot be undone." data-danger data-confirm-ok="Delete customer"><input type="hidden" name="id" value="${c.id}"><button class="btn-danger" type="submit">Delete</button></form>
    </div>
  </div>` : "";

  const reqSection = requested.length ? `<div class="card">
    <h2><span class="num">${requested.length}</span> Cars ${esc(c.name)} asked us to action</h2>
    <p class="help" style="margin:0 0 var(--sp-4)">Requested from their portal - pull the auction sheet, translate, and follow up.</p>
    <div class="mgrid">${requested.map((q) => requestedCard(q)).join("")}</div>
  </div>` : "";

  // Maker list shared by the add-search form and (for managers) the find card.
  const findMakers = await distinctMakers(env);
  const newWl = `<details class="card foldcard"${searchWls.length ? "" : " open"}>
    <summary>${searchWls.length ? "Add another search" : "Add a search"} for ${esc(c.name)}</summary>
    <form method="POST" action="/wishlist">
      <input type="hidden" name="client_id" value="${c.id}">
      ${presetSelect()}
      <div class="grid">
        <div><label for="as-label">Label</label><input id="as-label" name="label" placeholder="e.g. weekend project"></div>
        <div><label for="as-make">Make</label>${makerField(findMakers, "as-make")}</div>
        <div><label for="as-model">Model</label>${modelField("as-model")}</div>
        <div><label for="as-yearmin">Year min</label><input id="as-yearmin" name="year_min" type="number" placeholder="1990"></div>
        <div><label for="as-yearmax">Year max</label><input id="as-yearmax" name="year_max" type="number" placeholder="2002"></div>
        <div><label for="as-pricemax">Max price (JPY)</label><input id="as-pricemax" name="price_max" type="number" placeholder="1,500,000"></div>
        <div><label for="as-mileagemin">Min mileage (km)</label><input id="as-mileagemin" name="mileage_min" type="number" placeholder="0"></div>
        <div><label for="as-mileagemax">Max mileage (km)</label><input id="as-mileagemax" name="mileage_max" type="number" placeholder="80,000"></div>
        <div><label for="as-grademin">Min grade</label><input id="as-grademin" name="rate_min" type="number" step="any" placeholder="e.g. 4"></div>
        <div><label for="as-chassis">Chassis / model code <span class="opt">(contains, best match)</span></label><input id="as-chassis" name="kuzov" placeholder="e.g. JZA80 or 211"></div>
        <div><label for="as-code">Model code <span class="opt">(exact variant)</span></label><select id="as-code" name="model_code"><option value="">Any model code</option></select></div>
        <div><label for="as-grades">Grades <span class="opt">(pick every spelling)</span></label><select id="as-grades" name="grades" multiple size="4"></select></div>
      </div>
      <label style="display:flex;align-items:flex-start;gap:8px;margin-top:16px;font-size:var(--fs-sec);color:var(--t2);cursor:pointer"><input type="checkbox" name="watch_only" value="1" style="width:auto;margin-top:2px"><span><strong>Watch only (lead).</strong> Surface matches for a follow-up call, but never auto-email this client.</span></label>
      <div class="actions"><button class="btn-primary" type="submit">Add search</button>
        <span class="help">Add at least a make, model or chassis/model code.</span></div>
    </form>${modelScript("as-make", "as-model")}${codeGradeScript("as-make", "as-model", "as-code", "as-grades")}${presetScript()}
  </details>`;

  // IA-AUDIT item 5: searches render as one-line summary rows (label, digest,
  // On/Off) with the edit form behind its disclosure at EVERY width - the
  // ~1100px expanded form was burying the daily surface (matches) below it.
  const wlSection = `<div class="card">
    <h2><span class="num">${searchWls.length}</span> ${searchWls.length === 1 ? "Search" : "Searches"} <span style="font-size:var(--fs-label);font-weight:400;color:var(--t3)">&middot; each is a request you can move through the pipeline</span></h2>
    ${searchWls.map((w) => wishlistEditor(w, { requestControls: true })).join("") || `<div class="empty">No search yet, add what ${esc(c.name)} is chasing below.</div>`}
  </div>`;

  // Manual auction search for this client. Shown to EVERY staff viewer of this
  // page (owner, admin, or an agent the client is shared with): shared access
  // is for co-searching, and the add-to-queue endpoints behind this form
  // already accept it (clientAccessibleBy). Only edit/portal stay owner-only.
  // Hits the live feed only when a query is present, so a normal page load
  // stays cheap.
  const firstName = String(c.name || "").trim().split(/\s+/)[0] || "this client";
  const sp = opts.search || {};
  const findKeys = ["make", "model", "yearMin", "yearMax", "priceMax", "gradeMin", "kuzov"];
  const findHasQuery = findKeys.some((k) => String(sp[k] || "").trim());
  // The current find query as a query string, threaded through the POST round
  // trips (add-to-queue, bulk approve) so the search results survive redirects.
  const findQs = (() => {
    const qs = new URLSearchParams();
    for (const k of findKeys) { const v = String(sp[k] || "").trim(); if (v) qs.set(k, v); }
    return qs.toString();
  })();
  let findResults = "";
  if (findHasQuery) {
    const { lots } = await searchLots(env, sp);
    if (lots.length) {
      // Landed cost is now DEFERRED and BATCHED (perf pass 2), like the auction
      // tabs: the card renders a rough placeholder instantly and one batched
      // POST to /admin/landed-batch?client=<id> fills the real figures after
      // first paint, instead of blocking this page on 24 per-row calculator
      // calls. fx powers the instant placeholder; the client's state is
      // resolved server-side by the endpoint.
      const fx = await getLiveFx(env).catch(() => 0);
      // Cheap existence check: which of these lots are already in this client's
      // queue? Renders a Queued / Sent badge on the card instead of a dead-end
      // add-reload-duplicate loop.
      const queueStates = await lotQueueStates(env, cid, lots.map((lot) => lot.id));
      findResults = `<div class="mgrid" style="margin-top:16px">${lots.map((lot) => staffFindCard(lot, c.id, firstName, findQs, queueStates.get(String(lot.id)), { state: c.state, fx })).join("")}</div>${landedFillScript(`/admin/landed-batch?client=${cid}`)}`;
    } else {
      findResults = `<div class="empty" style="margin-top:16px">No upcoming lots match that search. Try fewer filters, or a broader make/model.</div>`;
    }
  }
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
    ? `<div class="flash" style="margin-top:16px">Added to ${esc(c.name)}'s review queue, it's waiting in <strong>Live matches</strong> above, Approve &amp; send when ready.</div>`
    : opts.found === "dup" ? `<div class="dupnote" style="margin-top:16px">That car is already in ${esc(c.name)}'s queue.</div>`
    : opts.found === "err" ? `<div class="dupnote" style="margin-top:16px">Sorry, we couldn't add that lot, please try again.</div>` : "";
  // IA-AUDIT item 5: the 800-900px find form folds away; the header CTA is the
  // one prominent affordance and expands it. It springs open whenever there is
  // something to show inside (results, or an add-to-queue flash).
  const findOpen = findHasQuery || !!opts.found;
  const findCard = `<details class="card foldcard" id="find"${findOpen ? " open" : ""} style="scroll-margin-top:80px">
    <summary>Find a car for ${esc(firstName)}</summary>
    <p class="help" style="margin:0 0 var(--sp-4)">${prefilledFromWl ? `Pre-filled from ${esc(firstName)}'s saved search, tweak it or just hit Search. ` : ""}Search the live Japanese auctions and add any lot straight to ${esc(firstName)}'s review queue, then Approve &amp; send it like any match.</p>
    <form method="GET" action="/admin">
      <input type="hidden" name="view" value="client"><input type="hidden" name="id" value="${c.id}">
      <div class="grid">
        <div><label>Make<input name="make" list="find-makers" value="${fv("make")}" placeholder="e.g. NISSAN"></label><datalist id="find-makers">${findMakers.map((m) => `<option value="${esc(m)}">`).join("")}</datalist></div>
        <div><label>Model <span class="opt">(contains)</span><input name="model" value="${fv("model")}" placeholder="e.g. SKYLINE"></label></div>
        <div><label>Year from<input name="yearMin" type="number" min="1960" value="${fv("yearMin")}" placeholder="1990"></label></div>
        <div><label>Year to<input name="yearMax" type="number" min="1960" value="${fv("yearMax")}" placeholder="2002"></label></div>
        <div><label>Max price <span class="opt">(JPY)</span><input name="priceMax" type="number" min="0" step="any" value="${fv("priceMax")}" placeholder="3,000,000"></label></div>
        <div><label>Min grade<input name="gradeMin" type="number" min="1" max="6" step="any" value="${fv("gradeMin")}" placeholder="e.g. 4"></label></div>
        <div><label>Chassis / model code <span class="opt">(contains)</span><input name="kuzov" value="${fv("kuzov")}" placeholder="e.g. GDB"></label></div>
      </div>
      <div class="actions"><button class="btn-primary" type="submit">Search auctions</button>
        <a class="btn-secondary" href="${esc(`/admin?view=auctions&tab=prices${findPrefill.make ? `&make=${encodeURIComponent(findPrefill.make)}` : ""}${findPrefill.model ? `&model=${encodeURIComponent(findPrefill.model)}` : ""}`)}">Sold price history</a>
        <span class="help">Searches upcoming Japanese auctions live. Blank fields match anything.</span></div>
    </form>${foundFlash}${findResults}
    <script>(function(){var d=document.getElementById('find');if(!d)return;document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href="#find"]');if(a)d.open=true;});})();</script>
  </details>`;

  const matchSection = `<div class="card">
    <h2><span class="num">${matches.length}</span> Live matches</h2>
    ${Number(sentWk.n) ? `<p class="help sentpace" style="margin:0 0 var(--sp-3)">${sentWk.n} sent this week &middot; ${sentWk.v || 0} opened &middot; ${sentWk.i ? `${sentWk.i} interested` : "none interested"} &middot; last ${esc(relTime(sentWk.t))}</p>` : ""}
    ${snoozedN ? `<p class="help" style="margin:0 0 var(--sp-3)">${snoozedN} snoozed match${snoozedN === 1 ? " is" : "es are"} hidden until due, <a href="/admin?view=matches&f=snoozed" style="color:var(--gold-txt);font-weight:600">see snoozed</a>.</p>` : ""}
    ${matches.length ? strengthLegend() + clientBulkBar(cid, findQs) + `<div class="mgrid">${matches.map((q) => matchCard(q, { ret: `/admin?view=client&id=${cid}` })).join("")}</div>` : `<div class="empty">No live matches right now.</div>`}
  </div>`;

  // Compact history of already-actioned cars, with the Interested / Pass
  // response buttons so replies can be logged from here too.
  const historyCard = history.length ? `<div class="card">
    <h2><span class="num">${history.length}</span> Sent and past cars</h2>
    <p class="help" style="margin:0 0 var(--sp-4)">What ${esc(firstName)} has already been sent, whether they opened it, and their response.</p>
    <div class="rd-matches">${history.map((q) => matchTrackRow(q, `/admin?view=client&id=${cid}`)).join("")}</div>
  </div>` : "";

  const feedCard = `<div class="card">
    <h2><span class="num">&middot;</span> Activity</h2>
    ${activityTimeline(feed)}
  </div>`;

  const main = `
    <div class="topbar wide">
      <div>
        <div class="kicker">Vehicle Finder · Client</div>
        <h1>${esc(c.name)}</h1>
        <p class="subline">What they're chasing, and the lots that match.</p>
      </div>
      <a class="btn-secondary" href="/admin?view=clients">&larr; Back to clients</a>
    </div>
    <div class="content wide">${opts.dup ? `<div class="dupnote">A client with that email or phone already existed, so we opened <strong>${esc(c.name)}</strong> instead of creating a duplicate. Add the new search below, or check their details are right.</div>` : ""}${opts.saved ? `<div class="flash">Client details saved.</div>` : ""}${head}<div class="cd-grid"><div class="cd-main">${matchSection}${reqSection}${historyCard}${wlSection}${newWl}${findCard}</div><aside class="cd-rail">${feed.length ? feedCard + portalCard + editCard + manageCard : portalCard + editCard + manageCard + feedCard}</aside></div></div>${RD_CSS}${matchActionScript()}${(canManage && findHasQuery) ? staffSendBar({ mode: "fixed", clientId: c.id, clientName: firstName, hasContact: !!(c.email || c.whatsapp) }) : ""}${findHasQuery ? `<script>(function(){if(location.hash)return;var el=document.getElementById('find');if(el)el.scrollIntoView();})();</script>` : ""}`;
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
  const moreOpen = ["mileage_max", "rate_min", "kuzov"].some((k) => vals[k]);
  const makers = await distinctMakers(env);
  // Current FX rate for the live yen-equivalent under the budget field; falls
  // back to the configured CALC_FX inside getLiveFx, and 0 only if that throws
  // (the wizard script then uses its own baked-in default).
  const fx = await getLiveFx(env).catch(() => 0);
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
    const bud = req.budget_aud ? `Budget up to A$${Number(req.budget_aud).toLocaleString("en-AU")} on-road` : "";
    const st = req.state ? `Registered in ${esc(req.state)}` : "";
    const summaryRows = [`<b>${car}</b>`, yr, bud, st].filter(Boolean)
      .map((t) => `<li><span class="tick">&#10003;</span><span>${t}</span></li>`).join("");
    // Account line. A brand-new self-signup (password set inline on this form)
    // gets the "account ready" message. Every other case shows ONE neutral,
    // conditional line that never reveals whether this email was already on
    // file (no enumeration): the "if you already have an account" phrasing is
    // true-shaped either way, and the reset/set-password link was emailed to a
    // real account behind the scenes.
    const acct = req.portal
      ? `<strong>Your account is ready.</strong> Sign in any time with your email and password to track your search.`
      : `We've saved your search. If you already have an account with ${req.email ? `<strong>${esc(req.email)}</strong>` : "this email"}, check your inbox, we've sent a link to sign in or set your password. New cars list constantly, so a quiet start is normal.`;
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
        ? `<div class="ob-card"><p class="ob-note-sm" style="margin:0">Your search is running against every live Japanese auction. We review what comes up and email you the strongest matches.</p></div>`
        : "");
    const upsellCard = opts.upsell
      ? `<div class="ob-card" style="border:1px solid var(--gold);background:linear-gradient(180deg,#FFFBEF,#fff)">
          <div class="rk" style="font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-txt);margin-bottom:8px">Want the full picture?</div>
          <div style="font-size:18px;font-weight:800;color:#12131a;margin-bottom:6px">Unlock unlimited searches - A$${Number(opts.upsell.priceAud || 0).toLocaleString("en-AU")}/mo</div>
          <p class="ob-note-sm" style="margin:0 0 16px">Your free account starts you off with one example. Full access lets you search every live Japanese auction yourself and get every match we find, as soon as we've reviewed it.</p>
          <a class="btn-primary" href="/login?next=subscribe">Get full access <span aria-hidden="true">&rarr;</span></a>
        </div>`
      : "";
    const successInner = `<div class="ob">
      ${topnav}
      <main class="ob-main" id="main"><div class="ob-success">
        <div class="ob-badge"><span class="tk">&#10003;</span> Request received</div>
        <h1>Your search is live${firstName ? ", " + esc(firstName) : ""}.</h1>
        <p class="ob-sub">Your search now runs against the Japanese auctions. When a good match comes up, we review it and ${req.email ? `email <strong>${esc(req.email)}</strong>` : "contact you"}. New cars list constantly, so a quiet start is normal.</p>
        ${welcomeCard}
        <div class="ob-card">
          <div class="rk" style="font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-txt);margin-bottom:14px">Searching for</div>
          <ul class="ob-summary">${summaryRows}</ul>
        </div>
        ${upsellCard}
        <div class="ob-meta">
          <div class="c"><div class="k">Request ID</div><div class="v">${esc(ref || "-")}</div></div>
          <div class="c"><div class="k">Search status</div><div class="v"><span class="ok">Active</span>, monitoring auctions</div></div>
          <div class="c"><div class="k">Next update</div><div class="v">As matches come up</div></div>
        </div>
        ${successTimeline()}
        <p class="ob-note-sm">${acct}</p>
        <div class="ob-cta">
          <a class="btn-primary" href="/request">Start another search <span aria-hidden="true">&rarr;</span></a>
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
      : (opts.error === "email" || opts.error === "password" || opts.error === "phone" || opts.error === "name") ? "4"
        : "";
  const bannerMsg = opts.error === "phone"
    ? "Please enter a valid mobile number so we can reach you quickly when a match comes up."
    : opts.error === "limited"
    ? "We've received a lot of requests from your connection just now. Please wait a few minutes and submit again - nothing was saved this time."
    : opts.error === "google"
    ? "We couldn't sign you in with Google. Please try again, or fill in the form below."
    : opts.error === "password"
      ? esc(opts.pwError || `Please choose a password of at least ${PW_MIN} characters, including a letter and a number.`)
      : opts.error === "vehicle"
        ? "Please choose a make and model so we know what car to look for."
        : opts.error === "year"
          ? "Please enter the year range you're after (and make sure 'from' isn't later than 'to')."
          : opts.error === "budget"
            ? "Please enter your maximum on-road budget in AUD (at least A$5,000)."
            : opts.error === "email"
              ? "Please enter your email so we can set up your account and reach you when a match comes up."
              : opts.error === "name"
                ? "Please enter your name so we know who we're searching for."
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
            <div class="ob-eyebrow">Start your search</div>
            <h1>What vehicle are you looking for?</h1>
            <p class="ob-lead">Tell us what you're chasing and we'll search every major Japanese auction house for matching vehicles.</p>
            <div class="ob-sub-h">Popular searches</div>
            ${popularCards()}
            <div style="margin-bottom:18px"><label for="rf-label">Nickname <span class="opt">(optional, for your reference)</span></label><input id="rf-label" name="label" value="${v("label")}" placeholder="e.g. weekend project" maxlength="120"></div>
            <div class="ob-fields">
              <div><label for="rq-maker">Make</label>${makerField(makers, "rq-maker", "Select a make", vals.marka_name).replace('id="rq-maker"', 'id="rq-maker" aria-describedby="rq-vehicle-error"')}</div>
              <div><label for="rq-models">Model</label>${modelField("rq-models", vals.model_name).replace('id="rq-models"', 'id="rq-models" aria-describedby="rq-vehicle-error"')}</div>
              <div><label for="rq-ymin">Year from</label><input id="rq-ymin" name="year_min" type="number" inputmode="numeric" min="1970" max="2050" value="${v("year_min")}" placeholder="1990" required aria-describedby="rq-year-error"></div>
              <div><label for="rq-ymax">Year to</label><input id="rq-ymax" name="year_max" type="number" inputmode="numeric" min="1970" max="2050" value="${v("year_max")}" placeholder="2002" required aria-describedby="rq-year-error"></div>
            </div>
            <p id="rq-vehicle-error" class="field-err" role="alert">Please choose a make and model so we know what to look for.</p>
            <p id="rq-year-error" class="field-err" role="alert">Please enter the year range you're after ("from" can't be later than "to").</p>
            <details class="ob-refine"${moreOpen ? " open" : ""}>
              <summary>Refine my search (optional)</summary>
              <div class="ob-fields">
                <div><label for="rf-mileage">Max mileage <span class="opt">(km)</span></label><input id="rf-mileage" name="mileage_max" type="number" inputmode="numeric" min="0" max="2000000" step="any" value="${v("mileage_max")}" placeholder="100,000"></div>
                <div><label for="rf-grade">Min auction grade <span class="opt">(1 to 6)</span></label><input id="rf-grade" name="rate_min" type="number" min="1" max="6" step="any" value="${v("rate_min")}" placeholder="e.g. 4"></div>
                <div><label for="rf-chassis">Chassis code <span class="opt">(if known)</span></label><input id="rf-chassis" name="kuzov" value="${v("kuzov")}" placeholder="e.g. JZA80" maxlength="40"></div>
                <div><label for="rf-code">Model code <span class="opt">(exact variant)</span></label><select id="rf-code" name="model_code" data-want="${v("model_code")}"><option value="">Any model code</option>${vals.model_code ? `<option value="${v("model_code")}" selected>${v("model_code")}</option>` : ""}</select></div>
                <div><label for="rf-grades">Grade <span class="opt">(pick every spelling you'd take)</span></label><select id="rf-grades" name="grades" multiple size="4" data-want="${esc(gradesText(vals.grades || ""))}"></select></div>
              </div>
            </details>
            ${recentExamplesShell()}
            <div class="ob-nav-btns ob-only">
              <button type="button" class="btn-primary ob-next-btn" data-next>Next: your budget <span aria-hidden="true">&rarr;</span></button>
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
                  <label for="rq-budget">Max budget <span class="opt">(AUD, on-road)</span></label>
                  <div class="in"><span class="cur" aria-hidden="true">A$</span><input id="rq-budget" name="budget_aud" type="number" inputmode="numeric" min="5000" max="1000000" step="any" value="${v("budget_aud")}" placeholder="35,000" required aria-describedby="rq-budget-error rq-yen"></div>
                  <p class="ob-yen" id="rq-yen" aria-live="polite"></p>
                </div>
                <p id="rq-budget-error" class="field-err" role="alert">Please enter your maximum on-road budget in AUD (at least A$5,000).</p>
                <div class="ob-fields" style="margin-top:16px">
                  <div><label for="rq-state">State <span class="opt">(where it&rsquo;ll be registered)</span></label><select id="rq-state" name="state">${stateOptions(vals.state || "")}</select></div>
                  <div><label for="rq-dest">Country</label><input id="rq-dest" name="destination_country" value="${esc(vals.destination_country || "Australia")}" maxlength="60"></div>
                </div>
              </div>
              ${testimonialPanel()}
            </div>
            <div class="ob-nav-btns ob-only">
              <button type="button" class="btn-ghost ob-back" data-back><span aria-hidden="true">&larr;</span> Back</button>
              <button type="button" class="btn-primary ob-next-btn" data-next>See my search summary <span aria-hidden="true">&rarr;</span></button>
            </div>
          </section>

          <section class="ob-step" data-step="3" aria-label="Review your search">
            <div class="ob-eyebrow">Review</div>
            <h1>Great choice.</h1>
            <div class="ob-cols">
              <div>
                <div class="ob-review ob-only" id="obReview"></div>
                <p class="ob-nojs ob-lead">Check your details below, then create your free account to start the search.</p>
                <p class="ob-note">We monitor thousands of Japanese auction listings every week and let you know when a suitable vehicle comes up.</p>
              </div>
              ${whyUs()}
            </div>
            <div class="ob-nav-btns ob-only">
              <button type="button" class="btn-ghost ob-back" data-back><span aria-hidden="true">&larr;</span> Back</button>
              <button type="button" class="btn-primary ob-next-btn" data-next>Create my free account <span aria-hidden="true">&rarr;</span></button>
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
                <p id="rq-whatsapp-error" class="field-err">Please enter a mobile number so we can reach you quickly when a match comes up.</p>
                <div class="ob-human">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 19a6 6 0 0 0-12 0"/><circle cx="9" cy="8" r="4"/><path d="M15.5 11.5l2 2 4-4"/></svg>
                  <span>Every search is reviewed by a JDM Connect specialist before recommendations are sent.</span>
                </div>
                <div class="ob-cta-row">
                  <button type="button" class="btn-ghost ob-back ob-only" data-back><span aria-hidden="true">&larr;</span> Back</button>
                  <button class="btn-primary" type="submit">Start my search</button>
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
                  <div><label for="rq-name">Name</label><input id="rq-name" name="name" autocomplete="name" value="${v("name")}" placeholder="Jane Citizen" maxlength="120" required aria-describedby="rq-name-error"></div>
                  <div><label for="rq-email">Email <span class="opt">(your login)</span></label><input id="rq-email" name="email" type="email" autocomplete="email" spellcheck="false" value="${v("email")}" placeholder="name@email.com" maxlength="160" required aria-describedby="rq-email-error"></div>
                  <div><label for="rq-pass">Create a password</label><input id="rq-pass" name="portal_password" type="password" autocomplete="new-password" minlength="${PW_MIN}" maxlength="${PW_MAX}" title="${PW_MIN} to ${PW_MAX} characters, including a letter and a number. Long passphrases are welcome." placeholder="${PW_MIN}+ characters" required aria-describedby="rq-pass-error"></div>
                  <div><label for="rq-whatsapp">Mobile / WhatsApp</label><input id="rq-whatsapp" name="whatsapp" type="tel" inputmode="tel" autocomplete="tel" value="${v("whatsapp")}" placeholder="+61 4XX XXX XXX" maxlength="40" required></div>
                </div>
                <p id="rq-name-error" class="field-err" role="alert">Please enter your name so we know who we're searching for.</p>
                <p id="rq-email-error" class="field-err" role="alert">Please enter a valid email. This is also your login.</p>
                <p id="rq-pass-error" class="field-err" role="alert">Use at least ${PW_MIN} characters, including a letter and a number. Long passphrases are welcome.</p>
                <p id="rq-whatsapp-error" class="field-err">Please enter a mobile number so we can reach you quickly when a match comes up.</p>
                <div class="ob-human">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 19a6 6 0 0 0-12 0"/><circle cx="9" cy="8" r="4"/><path d="M15.5 11.5l2 2 4-4"/></svg>
                  <span>Every search is reviewed by a JDM Connect specialist before recommendations are sent.</span>
                </div>
                <div class="ob-cta-row">
                  <button type="button" class="btn-ghost ob-back ob-only" data-back><span aria-hidden="true">&larr;</span> Back</button>
                  <button class="btn-primary" type="submit">Start my search</button>
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
    ${modelScript("rq-maker", "rq-models", "Select a model")}${codeGradeScript("rq-maker", "rq-models", "rf-code", "rf-grades")}${wizardScript({ pwMin: PW_MIN, pwMax: PW_MAX, budgetMin: BUDGET_MIN_AUD, signedIn: !!signedIn, fx, overheadAud: IMPORT_OVERHEAD_AUD, onValueTax: ON_VALUE_TAX, minCarAud: MIN_CAR_VALUE_AUD })}`;
  return brandDoc(inner, "Find your car - JDM Connect", {
    analytics: true,
    description: "Tell us the make, model and budget - we search every live Japanese auction and a specialist reviews each match before it reaches you. Free account, two minutes to set up.",
    canonical: "https://jdmfinder.com.au/request",
  });
}

// Read-only public view of a shared car (the "Share" link). No login, no client
// info, no admin actions, just the car, its inspection sheet, the specs and
// (optionally) the market panel, with an enquiry CTA. Self-contained styles so
// it renders on the public brand shell. Access is the signed token alone, so
// the caller must verify it before calling this.
export async function publicLotPage(env, queueId, opts = {}) {
  const sb = `<aside class="side"><div class="brand"><a href="/" aria-label="JDM Connect home">${LOGO}</a></div>
    <nav class="nav">
      <span class="active" aria-current="page"><span class="bar"></span><span class="lbl">Vehicle</span></span>
      <a href="/request"><span class="bar"></span><span class="lbl">Request a car</span></a>
    </nav>
    <div class="side-foot"><a class="signout" href="/">JDM Connect</a></div>
    </aside>`;
  const q = await env.DB.prepare(
    "SELECT id, lot_json, response, share_price_note, share_condition_notes, share_nonce, share_revoked_at FROM queue WHERE id = ?"
  ).bind(queueId).first();
  // A revoked link renders exactly like an unknown one (defence in depth - the
  // route's token check already refuses revoked rows before we get here).
  if (!q || q.share_revoked_at) {
    return brandShell(sb,
      `<div class="topbar"><div class="topbar-in"><div class="kicker">Vehicle Finder</div><h1>Car not found</h1></div></div>
       <div class="content"><div class="card"><div class="empty">This link may have expired. <a href="/request" style="color:var(--gold-txt);font-weight:600">Tell us what you&rsquo;re after</a> and we&rsquo;ll source it for you.</div></div></div>`,
      "Vehicle - JDM Connect");
  }
  let lot = {};
  try { lot = JSON.parse(q.lot_json); } catch (e) {}
  // Heal the cached image set from the live feed (upcoming lots usually gain
  // their inspection sheet closer to sale day), same as the staff lot page, so
  // a link shared early still shows the full gallery + sheet later. Only worth
  // an outbound feed call when something is actually missing - a complete lot
  // (sheet + photos) never triggers a fetch, so a repeatedly-opened link doesn't
  // amplify feed traffic. opts.skipRefresh hard-disables it when the caller is
  // over its per-IP view budget.
  const pre = splitImages(lot);
  if (!opts.skipRefresh && (!pre.sheet || !pre.photos.length)) {
    if (await refreshLotImages(env, lot)) {
      // Persist ONLY the healed images field with json_set, never the whole
      // blob: the AI sheet reader writes lot_json._sheet on its own schedule,
      // and a full-blob overwrite from this public path could clobber a read
      // that landed between our SELECT and this UPDATE.
      try { await env.DB.prepare("UPDATE queue SET lot_json = json_set(lot_json, '$.images', ?) WHERE id = ?").bind(String(lot.images || ""), q.id).run(); } catch (e) {}
    }
  }
  const { sheet: sheetBase, photos } = splitImages(lot);
  const settings = await getSettings(env).catch(() => ({}));
  const [market, fx] = settingOn(settings, "market_for_clients")
    ? await Promise.all([marketIntel(env, lot.marka_name, lot.model_name, Date.now(), { kuzov: lot.kuzov, grade: lot.grade, year: lot.year, mileage: lot.mileage }).catch(() => null), getLiveFx(env).catch(() => 0)])
    : [null, 0];

  const title = `${esc(lot.year || "")} ${esc(lot.marka_name || "")} ${esc(lot.model_name || "")}`.replace(/\s+/g, " ").trim() || "Vehicle";
  const subBits = [lot.kuzov ? "Chassis " + esc(lot.kuzov) : "", lot.lot ? "Lot " + esc(lot.lot) : "", esc(lot.auction || "")].filter(Boolean);
  const sub = subBits.join(" &middot; ");
  const kmTxt = lot.mileage ? Number(lot.mileage).toLocaleString("en-US") + " km" : "";
  const cs = conditionScores(lot);
  const grade = esc(fullGrade(lot));
  const th = (u) => `${u}&w=320`;

  // Dynamic gallery: a real <img> lead (good LCP), a thumbnail strip, and a
  // full-screen lightbox with swipe + arrow-key + prev/next navigation. Falls
  // back to a static first image if JS never runs.
  const gallery = photos.length
    ? `<div class="clv-gallery" id="clvG">
        <div class="clv-stage">
          <img id="clvMain" class="clv-main" src="${esc(photos[0])}" alt="${title}" fetchpriority="high" decoding="async">
          ${photos.length > 1 ? `<button type="button" class="clv-nav clv-prev" data-dir="-1" aria-label="Previous photo">&lsaquo;</button>
          <button type="button" class="clv-nav clv-next" data-dir="1" aria-label="Next photo">&rsaquo;</button>
          <span class="clv-count"><span id="clvIdx">1</span> / ${photos.length}</span>` : ""}
          <button type="button" class="clv-zoom" id="clvZoom" aria-label="View full screen">${EXPAND_ICON}</button>
        </div>
        ${photos.length > 1 ? `<div class="clv-strip" role="listbox" aria-label="Photos">${photos.map((u, i) => `<button type="button" role="option" class="clv-th${i === 0 ? " on" : ""}" data-i="${i}" data-full="${esc(u)}" aria-label="Photo ${i + 1}"${i === 0 ? ' aria-selected="true"' : ""}><img src="${esc(th(u))}" alt="" loading="lazy" decoding="async"></button>`).join("")}</div>` : ""}
      </div>`
    : `<div class="clv-gallery"><div class="clv-noimg">Photos coming soon</div></div>`;

  const sheetBox = sheetBase
    ? `<section class="clv-card clv-sheet"><h2>Auction inspection sheet</h2><a href="${esc(sheetBase)}" target="_blank" rel="noopener noreferrer" class="clv-sheet-link"><img src="${esc(sheetBase)}" alt="Auction inspection sheet" loading="lazy" decoding="async"><span class="clv-sheet-open">${EXPAND_ICON} Open full</span></a><p class="clv-fine">The original Japanese auction house grading, exactly as issued.</p></section>`
    : "";

  // Bento key-facts: the four numbers a buyer scans first, big and glanceable.
  const tiles = [
    ["Year", esc(lot.year || "") || "&mdash;"],
    ["Odometer", kmTxt ? esc(String(Math.round(Number(lot.mileage) / 1000)) + "k km") : "&mdash;"],
    ["Auction grade", grade || "&mdash;"],
    ["Transmission", esc(lot.kpp || lot.kpp_type || "") || "&mdash;"],
  ].map(([k, v]) => `<div class="clv-tile"><div class="clv-tile-v">${v}</div><div class="clv-tile-k">${k}</div></div>`).join("");

  const specRows = [
    ["Chassis", esc(lot.kuzov || "")], ["Grade / trim", esc(lot.grade || "")],
    ["Exterior", cs && cs.ext ? esc(cs.ext) : ""], ["Interior", cs && cs.int ? esc(cs.int) : ""],
    ["Engine", lot.eng_v ? esc(lot.eng_v) + "cc" : ""], ["Mileage", esc(kmTxt)],
    ["Colour", esc(lot.color || "")], ["Drivetrain", esc(lot.priv || "")],
    ["Auction house", esc(lot.auction || "")], ["Lot number", esc(lot.lot || "")],
    ["Auction date", esc((lot.auction_date || "").slice(0, 16).replace("T", " "))],
    ["Start price", Number(lot.start) > 0 ? yen(lot.start) : ""],
  ].filter(([, v]) => v).map(([k, v]) => `<div class="clv-row"><span class="clv-k">${k}</span><span class="clv-v">${v}</span></div>`).join("");

  // Staff-authored guidance: the price band + condition notes that used to be
  // hand-typed into WhatsApp next to the link now live ON the page.
  const priceNote = String(q.share_price_note || "").trim();
  const priceBox = priceNote
    ? `<div class="clv-price"><span class="clv-price-k">Our price guidance</span><span class="clv-price-v">${esc(priceNote)}</span></div>`
    : "";
  const condNotes = String(q.share_condition_notes || "").trim();
  const notesBox = condNotes
    ? `<section class="clv-card clv-notes"><h2>Condition notes</h2>${condNotes.split(/\n+/).map((p) => `<p>${esc(p)}</p>`).join("")}<p class="clv-fine">Written by JDM Connect from the auction inspection sheet.</p></section>`
    : "";

  // "I'm interested" one-tap. The share token itself is the capability - the
  // POST re-verifies it, so the form never exposes the raw queue id.
  const interested = q.response === "interested" || !!opts.thanks;
  const shareTok = await makeShareToken(env, q.id, q.share_nonce || null);
  const enquireHref = esc("/request?" + new URLSearchParams({ make: String(lot.marka_name || "").trim(), model: String(lot.model_name || "").trim(), year: String(lot.year || ""), chassis: String(lot.kuzov || "").trim() }).toString());
  const interestForm = (cls) => interested
    ? `<div class="clv-thanks">&#10003; JDM Connect knows you&rsquo;re interested</div>`
    : shareTok
      ? `<form method="POST" action="/v/interest" class="${cls}"><input type="hidden" name="t" value="${esc(shareTok)}"><button class="btn-secondary" type="submit">I&rsquo;m interested</button></form>`
      : "";
  // Primary actions, rendered twice: in the desktop info rail, and in the
  // mobile sticky bar (CSS shows exactly one set per breakpoint).
  const ctaBlock = (ctx) => `<a class="btn-primary clv-enquire" href="${enquireHref}">Enquire about this car</a>${interestForm("clv-int-" + ctx)}`;

  const gradeBadge = grade ? `<span class="clv-badge" title="Auction grade">Grade ${grade}</span>` : "";
  const importLine = `<div class="clv-trust">${SHIELD_ICON}<span>Sourced &amp; imported to Australia by JDM Connect &mdash; we handle bidding, purchase, shipping and compliance.</span></div>`;

  const nav = `<header class="clv-top"><div class="clv-top-in"><a class="clv-logo" href="/" aria-label="JDM Connect home">${LOGO}</a><nav class="clv-topnav" aria-label="Primary"><span class="clv-cur" aria-current="page">Vehicle</span><a href="/request">Request a car</a></nav></div></header>`;

  const inner = `<div class="clv-page">${nav}
    <main id="main" class="clv-wrap">
      ${opts.thanks ? `<div class="clv-flash" role="status">Thanks &mdash; we&rsquo;ve let JDM Connect know you&rsquo;re interested. We&rsquo;ll be in touch shortly.</div>` : ""}
      <div class="clv-head">
        <div class="clv-head-l"><div class="clv-kicker">JDM Connect &middot; Auction vehicle</div><h1 class="clv-title">${title}</h1>${sub ? `<p class="clv-sub">${sub}</p>` : ""}</div>
        ${gradeBadge}
      </div>
      <div class="plv-grid clv-grid">
        <div class="clv-left">
          ${gallery}
          <div class="clv-tiles">${tiles}</div>
          ${notesBox}
          ${sheetBox}
          ${marketPanel(market)}
          ${importLine}
        </div>
        <aside class="clv-right">
          <div class="clv-card clv-info">
            ${priceBox}
            <div class="clv-rows">${specRows}</div>
            <div class="clv-cta">${ctaBlock("d")}</div>
            <p class="clv-fine">Start price shown is the Japanese auction price. Ask us for a full landed cost to your state &mdash; on-road, all-in.</p>
          </div>
        </aside>
      </div>
    </main>
    <footer class="clv-foot"><div class="clv-foot-in"><div>${LOGO}</div><nav class="clv-foot-nav" aria-label="Footer"><a href="/request">Request a car</a><a href="/finds">Recent finds</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav><p class="clv-foot-fine">&copy; JDM Connect. Japanese vehicle sourcing &amp; import to Australia.</p></div></footer>
    <div class="clv-bar" aria-hidden="false">${ctaBlock("m")}</div></div>
    ${CLV_STYLE}${clvGalleryScript()}`;

  // Shared links unfurl with the actual car (launch audit: social meta). Grade,
  // mileage and the staff price guidance ride along, so a WhatsApp / LINE
  // preview already answers "what is it, how good, how much".
  const ogBits = [grade ? `Grade ${grade}` : "", kmTxt].filter(Boolean).join(" — ");
  return brandDoc(inner, title + (ogBits ? " — " + ogBits : "") + " - JDM Connect", {
    analytics: true,
    description: [
      priceNote,
      [`${title} at Japanese auction`, lot.kuzov ? `chassis ${lot.kuzov}` : "", lot.auction ? `via ${lot.auction}` : ""].filter(Boolean).join(", ") + ".",
      "Sourced and imported to Australia by JDM Connect.",
    ].filter(Boolean).join(" "),
    ogImage: photos[0] || undefined,
  });
}

// Dynamic gallery for the client share page: thumb/arrow/keyboard/swipe photo
// switching plus a full-screen lightbox. Dependency-free; if it never runs the
// server-rendered lead image and thumbnail links still show every photo.
function clvGalleryScript() {
  return `<script>(function(){
  var g=document.getElementById('clvG');if(!g)return;
  var main=document.getElementById('clvMain'),idxEl=document.getElementById('clvIdx');
  var ths=[].slice.call(g.querySelectorAll('.clv-th'));
  var urls=ths.map(function(b){return b.getAttribute('data-full');});
  if(!urls.length&&main)urls=[main.getAttribute('src')];
  var i=0;
  function show(n){if(!urls.length)return;i=(n+urls.length)%urls.length;if(main)main.src=urls[i];if(idxEl)idxEl.textContent=(i+1);ths.forEach(function(b,k){b.classList.toggle('on',k===i);b.setAttribute('aria-selected',k===i?'true':'false');});if(lbImg)lbImg.src=urls[i];}
  ths.forEach(function(b){b.addEventListener('click',function(){show(+b.getAttribute('data-i'));});});
  g.querySelectorAll('.clv-nav').forEach(function(b){b.addEventListener('click',function(){show(i+ +b.getAttribute('data-dir'));});});
  // Lightbox
  var lb=document.createElement('div');lb.className='clv-lb';lb.setAttribute('role','dialog');lb.setAttribute('aria-modal','true');lb.setAttribute('aria-label','Photo viewer');
  lb.innerHTML='<button class="clv-lb-x" aria-label="Close">&times;</button><button class="clv-lb-nav clv-lb-prev" aria-label="Previous">&lsaquo;</button><img class="clv-lb-img" alt=""><button class="clv-lb-nav clv-lb-next" aria-label="Next">&rsaquo;</button>';
  document.body.appendChild(lb);
  var lbImg=lb.querySelector('.clv-lb-img');
  function open(){if(!urls.length)return;lbImg.src=urls[i];lb.classList.add('on');document.body.style.overflow='hidden';}
  function close(){lb.classList.remove('on');document.body.style.overflow='';}
  var zoom=document.getElementById('clvZoom');if(zoom)zoom.addEventListener('click',open);
  if(main)main.addEventListener('click',open);
  lb.querySelector('.clv-lb-x').addEventListener('click',close);
  lb.addEventListener('click',function(e){if(e.target===lb)close();});
  lb.querySelector('.clv-lb-prev').addEventListener('click',function(){show(i-1);});
  lb.querySelector('.clv-lb-next').addEventListener('click',function(){show(i+1);});
  document.addEventListener('keydown',function(e){if(!lb.classList.contains('on'))return;if(e.key==='Escape')close();else if(e.key==='ArrowLeft')show(i-1);else if(e.key==='ArrowRight')show(i+1);});
  // Swipe (stage + lightbox)
  function swipe(el){var x=0,active=false;el.addEventListener('touchstart',function(e){x=e.touches[0].clientX;active=true;},{passive:true});el.addEventListener('touchend',function(e){if(!active)return;active=false;var dx=e.changedTouches[0].clientX-x;if(Math.abs(dx)>40)show(i+(dx<0?1:-1));});}
  swipe(g.querySelector('.clv-stage'));swipe(lb);
  })();</script>`;
}

const EXPAND_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>`;
const SHIELD_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>`;

// Client-facing share page styles (light-luxury listing). Scoped to .clv-* so
// it is fully independent of the staff PLV_STYLE it replaced. The whole surface
// re-defines the theme tokens to a warm-white palette on .clv-page, so every
// var(--ink)/(--card)/(--hair) below resolves light without touching the dark
// :root the rest of the app uses.
const CLV_STYLE = `<style>
  body{background:#f2f0ea}
  .clv-page{
    --ink:#1c1a15;--t2:#514d45;--t3:#6f6a60;--faint:#938d81;
    --bg:#f2f0ea;--bg-2:#ffffff;--card:#ffffff;--off:#eae6dd;
    --hair:rgba(28,24,14,0.11);--hair-2:rgba(28,24,14,0.06);
    --field:#fbfaf7;--field-line:rgba(28,24,14,0.16);
    --gold:#C39A3D;--gold-hover:#B08A31;--gold-txt:#7a5e1c;
    --gold-tint:rgba(195,154,61,0.13);--gold-line:rgba(195,154,61,0.36);
    --good-bg:#e7f4ec;--good-line:rgba(31,122,77,0.32);
    --shadow-card:0 1px 2px rgba(28,24,14,.05),0 10px 30px rgba(28,24,14,.07);
    background:var(--bg);min-height:100vh;color:var(--ink)}
  /* Logo art defaults to black fill; on this light ground tint it to ink. */
  .clv-logo svg path,.clv-logo svg polygon,.clv-foot-in svg path,.clv-foot-in svg polygon{fill:var(--ink)}
  /* Secondary button needs a solid light face here (its dark-theme base is a
     near-transparent white that vanishes on white). */
  .clv-page .btn-secondary{background:#fff;border:1px solid var(--hair);color:var(--ink)}
  .clv-page .btn-secondary:hover{background:#faf8f3;border-color:var(--gold-line)}
  .clv-card,.clv-tile{box-shadow:var(--shadow-card)}
  .clv-top{position:sticky;top:0;z-index:40;background:rgba(250,248,243,.82);backdrop-filter:saturate(140%) blur(12px);border-bottom:1px solid var(--hair)}
  .clv-top-in{max-width:1180px;margin:0 auto;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;gap:16px}
  .clv-logo svg{width:150px}
  .clv-topnav{display:flex;align-items:center;gap:20px;font-size:14px;font-weight:600}
  .clv-cur{color:var(--gold-txt)}
  .clv-topnav a{color:var(--t2);text-decoration:none;transition:color .15s}
  .clv-topnav a:hover{color:var(--ink)}
  .clv-wrap{max-width:1180px;margin:0 auto;padding:24px 20px 40px}
  .clv-flash{display:flex;gap:10px;margin-bottom:20px;padding:14px 18px;background:var(--good-bg);border:1px solid var(--good-line);border-radius:12px;color:var(--ink);font-size:14px;font-weight:500}
  .clv-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:22px}
  .clv-kicker{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--gold-txt);margin-bottom:8px}
  .clv-title{font-size:clamp(26px,3.4vw,42px);font-weight:800;line-height:1.05;letter-spacing:-.02em;color:var(--ink);margin:0}
  .clv-sub{margin:8px 0 0;color:var(--t3);font-size:14px}
  .clv-badge{flex:none;align-self:center;display:inline-flex;align-items:center;padding:8px 16px;border-radius:999px;background:var(--gold-tint);border:1px solid var(--gold-line);color:var(--gold-txt);font-weight:700;font-size:15px;white-space:nowrap}
  .clv-grid{display:grid;grid-template-columns:1fr;gap:24px}
  @media(min-width:920px){.clv-grid{grid-template-columns:minmax(0,1fr) 380px;align-items:start}}
  .clv-left{min-width:0;display:flex;flex-direction:column;gap:20px}
  .clv-gallery{display:flex;flex-direction:column;gap:10px}
  .clv-stage{position:relative;border-radius:16px;overflow:hidden;border:1px solid var(--hair);background:var(--off);aspect-ratio:4/3}
  .clv-main{display:block;width:100%;height:100%;object-fit:cover;cursor:zoom-in}
  .clv-noimg{aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;border-radius:16px;border:1px solid var(--hair);background:var(--off);color:var(--faint);font-size:14px}
  .clv-nav{position:absolute;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;border:0;background:rgba(10,12,15,.55);color:#fff;font-size:26px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s;backdrop-filter:blur(4px)}
  .clv-nav:hover{background:rgba(10,12,15,.8)}
  .clv-prev{left:12px}.clv-next{right:12px}
  .clv-count{position:absolute;left:14px;bottom:12px;padding:5px 11px;border-radius:999px;background:rgba(10,12,15,.6);color:#fff;font-size:12.5px;font-weight:600;font-variant-numeric:tabular-nums;backdrop-filter:blur(4px)}
  .clv-zoom{position:absolute;right:12px;bottom:12px;width:38px;height:38px;border-radius:10px;border:0;background:rgba(10,12,15,.6);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);transition:background .15s}
  .clv-zoom:hover{background:rgba(10,12,15,.85)}
  .clv-strip{display:grid;grid-auto-flow:column;grid-auto-columns:88px;gap:8px;overflow-x:auto;scrollbar-width:thin;padding-bottom:4px;scroll-snap-type:x proximity}
  .clv-th{scroll-snap-align:start;padding:0;border:2px solid transparent;border-radius:10px;overflow:hidden;background:var(--off);cursor:pointer;aspect-ratio:4/3;opacity:.62;transition:opacity .15s,border-color .15s}
  .clv-th img{width:100%;height:100%;object-fit:cover;display:block}
  .clv-th:hover{opacity:1}
  .clv-th.on{opacity:1;border-color:var(--gold)}
  .clv-tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
  @media(max-width:560px){.clv-tiles{grid-template-columns:repeat(2,1fr)}}
  .clv-tile{background:var(--card);border:1px solid var(--hair);border-radius:14px;padding:16px 14px;text-align:center}
  .clv-tile-v{font-size:clamp(18px,2.2vw,24px);font-weight:800;color:var(--ink);letter-spacing:-.01em;line-height:1.1}
  .clv-tile-k{margin-top:6px;font-size:11.5px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--faint)}
  .clv-card{background:var(--card);border:1px solid var(--hair);border-radius:16px;padding:22px}
  .clv-card h2{font-size:16px;font-weight:700;color:var(--ink);margin:0 0 14px}
  .clv-notes p{font-size:15px;line-height:1.65;color:var(--t2);margin:0 0 12px}
  .clv-notes p:last-of-type{margin-bottom:0}
  .clv-fine{font-size:12.5px;color:var(--faint);line-height:1.5;margin:8px 0 0}
  .clv-sheet-link{display:block;position:relative;border-radius:12px;overflow:hidden;border:1px solid var(--hair);background:var(--off);line-height:0}
  .clv-sheet-link img{width:100%;height:auto;display:block}
  .clv-sheet-open{position:absolute;right:12px;bottom:12px;display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:8px;background:rgba(10,12,15,.7);color:#fff;font-size:12.5px;font-weight:600;backdrop-filter:blur(4px)}
  .clv-trust{display:flex;align-items:center;gap:12px;padding:16px 18px;border-radius:14px;background:var(--gold-tint);border:1px solid var(--gold-line);color:var(--gold-txt);font-size:13.5px;line-height:1.5;font-weight:500}
  .clv-trust svg{flex:none}
  .clv-right{min-width:0}
  @media(min-width:920px){.clv-right{position:sticky;top:80px}}
  .clv-info{padding:20px}
  .clv-price{display:flex;flex-direction:column;gap:4px;background:linear-gradient(135deg,var(--gold-tint),transparent);border:1px solid var(--gold-line);border-radius:12px;padding:14px 16px;margin-bottom:18px}
  .clv-price-k{font-size:11.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--gold-txt)}
  .clv-price-v{font-size:19px;font-weight:800;color:var(--gold-txt);line-height:1.25}
  .clv-rows{display:flex;flex-direction:column}
  .clv-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:11px 0;border-bottom:1px solid var(--hair-2);font-size:14px}
  .clv-row:last-child{border-bottom:0}
  .clv-k{color:var(--t3)}
  .clv-v{font-weight:700;color:var(--ink);text-align:right}
  .clv-cta{display:flex;flex-direction:column;gap:10px;margin-top:18px}
  .clv-cta .btn-primary,.clv-cta .btn-secondary,.clv-cta form{width:100%}
  .clv-cta form{display:flex}
  .clv-cta .btn-secondary{width:100%;justify-content:center}
  .clv-enquire{justify-content:center}
  .clv-thanks{margin-top:4px;padding:12px 14px;border-radius:10px;background:var(--good-bg);border:1px solid var(--good-line);color:var(--ink);font-size:13.5px;font-weight:600;text-align:center}
  .clv-foot{border-top:1px solid var(--hair);margin-top:16px}
  .clv-foot-in{max-width:1180px;margin:0 auto;padding:32px 20px calc(32px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:16px}
  .clv-foot-in svg{width:140px;opacity:.85}
  .clv-foot-nav{display:flex;flex-wrap:wrap;gap:18px;font-size:13.5px}
  .clv-foot-nav a{color:var(--t3);text-decoration:none}
  .clv-foot-nav a:hover{color:var(--ink)}
  .clv-foot-fine{font-size:12.5px;color:var(--faint);margin:0}
  .clv-bar{display:none}
  @media(max-width:919px){
    .clv-cta{display:none}
    .clv-bar{display:flex;gap:10px;position:fixed;left:0;right:0;bottom:0;z-index:45;padding:12px 16px calc(12px + env(safe-area-inset-bottom));background:rgba(255,255,255,.94);backdrop-filter:blur(12px);border-top:1px solid var(--hair);box-shadow:0 -6px 24px rgba(28,24,14,.08)}
    .clv-bar .btn-primary{flex:1;justify-content:center}
    .clv-bar form{flex:1;display:flex}
    .clv-bar .btn-secondary{flex:1;justify-content:center}
    .clv-wrap{padding-bottom:96px}
  }
  .clv-lb{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;background:rgba(5,6,8,.94);padding:20px}
  .clv-lb.on{display:flex}
  .clv-lb-img{max-width:96vw;max-height:90vh;object-fit:contain;border-radius:8px}
  .clv-lb-x{position:absolute;top:16px;right:18px;width:44px;height:44px;border:0;border-radius:50%;background:rgba(255,255,255,.12);color:#fff;font-size:28px;line-height:1;cursor:pointer}
  .clv-lb-nav{position:absolute;top:50%;transform:translateY(-50%);width:52px;height:52px;border:0;border-radius:50%;background:rgba(255,255,255,.12);color:#fff;font-size:32px;line-height:1;cursor:pointer}
  .clv-lb-prev{left:18px}.clv-lb-next{right:18px}
  .clv-lb-x:hover,.clv-lb-nav:hover{background:rgba(255,255,255,.22)}
  @media(prefers-reduced-motion:reduce){.clv-nav,.clv-zoom,.clv-topnav a{transition:none}}
</style>`;

// Full detail page for a single LIVE-feed auction lot, reached by clicking a
// card on the staff Auctions workspace or the member Auction search. Reuses the
// public lot layout (gallery, inspection sheet, spec rows, market panel) and
// adds role-appropriate actions: staff get an "Add to a client" picker; members
// get "Request bid" + watchlist. Answers the client's "I cannot click onto a
// vehicle", every lot now opens its full details and auction report.
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

  // A feed outage must read differently from a lot that genuinely left the
  // feed (launch audit): "not found" implies the car is gone; an outage isn't
  // about this car at all.
  let lot = null, feedDown = false;
  try { lot = await fetchLot(env, lotId); } catch (e) { feedDown = true; }
  // Client context (staff only): arriving from a client's find results makes
  // that client the Add target and points Back at the search they came from.
  const ctxClient = (!member && opts.clientId && await clientAccessibleBy(env, opts.clientId, session))
    ? await env.DB.prepare("SELECT * FROM clients WHERE id = ?").bind(Number(opts.clientId)).first()
    : null;
  const ctxFirst = ctxClient ? (String(ctxClient.name || "").trim().split(/\s+/)[0] || "client") : "";
  const backHref = member ? "/portal/auctions"
    : (opts.back && String(opts.back).startsWith("/admin")) ? String(opts.back)
    : "/admin?view=auctions";
  const backLabel = ctxClient ? `Back to ${esc(ctxFirst)}'s search` : "Back to auctions";
  if (!lot || !lot.id) {
    const title = feedDown ? "Feed unavailable" : "Lot not found";
    const copy = feedDown
      ? `We can't reach the live auction feed right now, so this lot can't be loaded. Please try again in a few minutes.`
      : `This lot may have closed or left the live feed.`;
    const notFoundBody = `<div class="topbar"><div class="topbar-in"><div class="kicker">Auction vehicle</div><h1>${title}</h1></div>${member ? "" : `<a class="btn-secondary" href="${backHref}">&larr; Back to auctions</a>`}</div>
       <div class="content"><div class="card"><div class="empty">${copy} <a href="${backHref}" style="color:var(--gold-txt);font-weight:600">Back to auction search</a>.</div></div></div>${CRM_CSS}`;
    return member
      ? brandShell(portalSidebar(client, "auctions"), notFoundBody, `${title} - JDM Connect`)
      : shell(sidebar("auctions", {}, session), notFoundBody, `${title} - JDM Connect`);
  }

  const nowYear = new Date().getFullYear();
  // With client context, price the car for THEM: the landed estimate for their
  // state sits right next to the Add button, so the decision is made here.
  if (ctxClient) { try { await attachLanded(env, [{ lot, client: { state: ctxClient.state } }]); } catch (e) {} }
  const { sheet: sheetBase, photos } = splitImages(lot);
  const settings = await getSettings(env).catch(() => ({}));
  const showMarket = member ? settingOn(settings, "market_for_clients") : true;
  const [market, fx] = showMarket
    ? await Promise.all([marketIntel(env, lot.marka_name, lot.model_name, Date.now(), { kuzov: lot.kuzov, grade: lot.grade, year: lot.year, mileage: lot.mileage }).catch(() => null), getLiveFx(env).catch(() => 0)])
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
  // A row with a hammer price is a historical sold record (fetchLot fell back
  // to the stats table). The Auction History page links members here, so the
  // page must read as a sold record, never as a biddable live lot.
  const sold = Number(lot.finish) > 0;
  const kmTxt = lot.mileage ? Number(lot.mileage).toLocaleString("en-US") + " km" : "";
  const specRows = [
    ["Year", esc(lot.year || "")], ["Chassis", esc(lot.kuzov || "")], ["Grade", esc(lot.grade || "")],
    ["Auction grade", esc(fullGrade(lot))], ["Engine", lot.eng_v ? esc(lot.eng_v) + "cc" : ""],
    ["Transmission", esc(lot.kpp || lot.kpp_type || "")], ["Mileage", esc(kmTxt)], ["Colour", esc(lot.color || "")],
    ["Auction house", esc(lot.auction || "")], ["Lot number", esc(lot.lot || "")],
    ["Auction date", esc((lot.auction_date || "").slice(0, 16).replace("T", " "))],
    ["Sold price", sold ? yen(lot.finish) : ""],
    ["Start price", Number(lot.start) > 0 ? yen(lot.start) : ""],
  ].filter(([, v]) => v).map(([k, v]) => `<div class="plv-row"><span class="plv-k">${k}</span><span class="plv-v">${v}</span></div>`).join("");

  const elig = auctionEligibility(lot, nowYear);
  const eligLine = `<div class="alot-elig ${elig.cls}"><span class="dot"></span>${esc(elig.label)}${elig.cls === "ok" ? " for import (25+ years)" : elig.boundary ? " (the build month decides the exact date)" : ", ask us to confirm SEVS/age"}</div>`;
  const landedLine = lot._landed && Number(lot._landed.grandTotal) > 0
    ? `<div class="plv-landed"><span class="pl-k">Est. landed${lot._landed.state ? " · " + esc(lot._landed.state) : ""}${ctxClient ? ` for ${esc(ctxFirst)}` : ""}</span><span class="pl-v">A$${Number(lot._landed.grandTotal).toLocaleString("en-AU")}</span></div>`
    : "";

  // Actions differ by surface. Members can request a bid and watch; staff can
  // add the lot to any client they can see (reuses the /client/find flow).
  let actions;
  if (member && sold) {
    // Already sold: no bid form, no watchlist heart. The record is a price
    // guide, so the action is finding the next one like it.
    const liveHref = `/portal/auctions?${new URLSearchParams({ make: lot.marka_name || "", model: lot.model_name || "" })}`;
    actions = `<a class="btn-primary plv-cta" href="${esc(liveHref)}">Find one like this live</a>
      <p class="plv-fine">This car has already sold at auction. Use its result as a price guide, then search the live feed and we'll chase the next one.</p>`;
  } else if (member) {
    const name = `${String(lot.marka_name || "").trim()} ${String(lot.model_name || "").trim()}`.replace(/\s+/g, " ").trim() || "Vehicle";
    const heartData = `data-id="${esc(lot.id)}" data-name="${esc(name)}" data-code="${esc(lot.kuzov || "")}" data-img="${esc(imageUrls(lot).medium || "")}" data-grade="${esc(fullGrade(lot))}" data-house="${esc(lot.auction || "")}" data-date="${esc((lot.auction_date || "").slice(0, 10))}" data-elig="${esc(elig.label)}" data-eligcls="${esc(elig.cls)}" data-sheet="${esc(sheetBase ? sheetBase + "&w=1400" : "")}"`;
    actions = `<form method="POST" action="/portal/auctions/request" style="margin:0"><input type="hidden" name="id" value="${esc(lot.id)}"><button class="btn-primary plv-cta" type="submit">Request a bid on this car</button></form>
      <button type="button" class="ac-fav plv-watch" ${heartData} aria-pressed="false">Save to watchlist</button>
      <p class="plv-fine">Requesting a bid sends this lot to JDM Connect to action on your behalf. No payment is taken at this step.</p>`;
  } else {
    const acc = accessScope(session);
    const cstmt = env.DB.prepare(`SELECT id, name FROM clients c WHERE ${acc.sql} ORDER BY name`);
    const clients = ((await (acc.binds.length ? cstmt.bind(...acc.binds) : cstmt).all()).results) || [];
    const options = clients.map((cl) => `<option value="${cl.id}"${ctxClient && Number(cl.id) === Number(ctxClient.id) ? " selected" : ""}>${esc(cl.name)}</option>`).join("");
    // With client context the primary action is ONE tap: add to that client.
    // The picker stays underneath for the "actually, this suits someone else"
    // case; without context it is the only action, as before.
    const oneTap = ctxClient
      ? `<form method="POST" action="/client/find" style="margin:0 0 8px"><input type="hidden" name="lot_id" value="${esc(lot.id)}"><input type="hidden" name="client_id" value="${ctxClient.id}"><input type="hidden" name="back" value="${esc(backHref)}"><button class="btn-primary plv-cta" type="submit">Add to ${esc(ctxFirst)}'s queue</button></form>`
      : "";
    const pickerLabel = ctxClient ? "Or add to a different client..." : "Add to a client...";
    actions = clients.length
      ? `${oneTap}<form method="POST" action="/client/find" class="plv-picker"><input type="hidden" name="lot_id" value="${esc(lot.id)}"><input type="hidden" name="back" value="${esc(backHref)}"><select name="client_id" required aria-label="Add this car to a client"><option value="">${pickerLabel}</option>${ctxClient ? options.replace(` selected`, "") : options}</select><button class="btn-${ctxClient ? "secondary" : "primary"}" type="submit">Add</button></form>
         <p class="plv-fine">Adds this lot to the client's review queue as a manual find, ready to Approve &amp; send.</p>`
      : `<p class="plv-fine">Add a client first to queue cars for them.</p>`;
  }

  const topRight = member ? "" : `<a class="btn-secondary" href="${backHref}">&larr; ${backLabel}</a>`;
  const main = `
    <div class="topbar"><div class="topbar-in"><div class="kicker">${member ? "Members &middot; Auction vehicle" : "Vehicle Finder &middot; Auction vehicle"}</div><h1>${title}</h1>${sub ? `<p class="subline">${sub}</p>` : ""}</div>${topRight}</div>
    <div class="content">
      ${member ? "" : `<a class="backlink" href="${backHref}">&larr; ${backLabel}</a>`}
      <div class="plv-grid">
        <div class="plv-left">
          <div class="plv-gallery">${gallery}</div>
          ${sheetBox}
          ${showMarket ? marketPanel(market) : ""}
        </div>
        <aside class="plv-right">
          <div class="card plv-spec">
            <div class="plv-top"><div class="plv-grade"><div class="plv-grade-n">${esc(displayGrade(lot.rate))}</div><div class="plv-grade-k">Auction grade</div></div>${sold ? `<div class="plv-price"><div class="plv-price-k">Sold price</div><div class="plv-price-v">${yen(lot.finish)}</div></div>` : Number(lot.start) > 0 ? `<div class="plv-price"><div class="plv-price-k">Start price</div><div class="plv-price-v">${yen(lot.start)}</div></div>` : ""}</div>
            ${eligLine}
            ${landedLine}
            <div class="plv-actions">${actions}</div>
            <div class="plv-rows">${specRows}</div>
          </div>
        </aside>
      </div>
    </div>
    ${PLV_STYLE}${ALOT_CSS}${plvGalleryScript()}${auctionWatchScript({ request: false, sync: member })}`;
  return member
    ? brandShell(portalSidebar(client, "auctions"), main, title + " - JDM Connect")
    : shell(sidebar("auctions", {}, session), main, title + " - JDM Connect");
}

// Extra styles for the lot-detail action column (on top of PLV_STYLE).
const ALOT_CSS = `<style>
  .plv-top{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px}
  .plv-grade-n{font-size:var(--fs-page);font-weight:700;color:var(--ink);line-height:1}
  .plv-grade-k,.plv-price-k{font-size:var(--fs-label);color:var(--faint);text-transform:uppercase;letter-spacing:.06em;margin-top:4px}
  .plv-price{text-align:right}
  .plv-price-v{font-size:20px;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums}
  /* Landed-for-this-client strip: same register as the match cards' .mland. */
  .plv-landed{display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--gold-tint);border-radius:var(--r-ctl);padding:10px 12px;margin-bottom:16px}
  .plv-landed .pl-k{font-size:var(--fs-label);font-weight:var(--w-label);letter-spacing:var(--ls-label);text-transform:uppercase;color:var(--gold-txt)}
  .plv-landed .pl-v{font-size:var(--fs-body);font-weight:700;color:var(--gold-txt);font-variant-numeric:tabular-nums}
  .alot-elig{display:flex;align-items:center;gap:8px;font-size:var(--fs-sec);font-weight:600;padding:8px 0 16px;border-bottom:1px solid var(--hair);margin-bottom:16px}
  .alot-elig .dot{width:8px;height:8px;border-radius:50%;flex:none}
  .alot-elig.ok{color:var(--good)}.alot-elig.ok .dot{background:var(--good)}
  .alot-elig.check{color:var(--warn-fg)}.alot-elig.check .dot{background:var(--warn-c)}
  .plv-actions{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}
  .plv-cta{width:100%;text-align:center}
  .plv-picker{display:flex;gap:8px}
  .plv-picker select{flex:1;min-width:0;padding:12px;border-radius:var(--r-ctl)}
  .plv-watch{width:100%;justify-content:center;gap:8px;padding:12px 16px;border:1px solid var(--hair);border-radius:var(--r-ctl);background:var(--card);color:var(--ink);font-size:var(--fs-sec);font-weight:600;cursor:pointer}
  .plv-watch svg{display:none}
  .plv-watch.on{border-color:var(--field-line);color:var(--ink)}
  .plv-fine{font-size:var(--fs-label);color:var(--t3);margin:2px 0 0;line-height:1.45}
</style>`;

// Simple thumb-swap gallery for the staff/member lot page (auctionLotPage). The
// client share page has its own richer clvGalleryScript.
function plvGalleryScript() {
  return `<script>(function(){var hero=document.getElementById('plvHero');if(!hero)return;document.querySelectorAll('.plv-th').forEach(function(b){b.addEventListener('click',function(){hero.style.backgroundImage="url('"+b.getAttribute('data-full')+"')";document.querySelectorAll('.plv-th').forEach(function(x){x.classList.remove('on');});b.classList.add('on');});});})();</script>`;
}

const PLV_STYLE = `<style>
  .plv-grid{display:grid;grid-template-columns:1fr;gap:var(--gap-grid,20px)}
  @media(min-width:920px){.plv-grid{grid-template-columns:minmax(0,1fr) minmax(300px,380px);align-items:start}}
  .plv-left{min-width:0}
  .plv-gallery{margin-bottom:24px}
  .plv-hero{height:440px;border-radius:var(--r-card,10px);background:var(--media);background-size:cover;background-position:center;border:1px solid var(--hair)}
  .plv-noimg{display:flex;align-items:center;justify-content:center;color:var(--faint);font-size:var(--fs-sec,13px)}
  .plv-thumbs{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
  .plv-th{width:84px;height:60px;border-radius:var(--r-ctl,8px);border:1px solid var(--hair);background-size:cover;background-position:center;cursor:pointer;opacity:.7;transition:opacity .15s,border-color .15s;padding:0}
  .plv-th:hover{opacity:1}
  .plv-th.on{opacity:1;border-color:var(--gold);box-shadow:0 0 0 1px var(--gold)}
  .plv-sheet{margin-bottom:24px}
  .plv-sheet h2{font-size:var(--fs-body,15px);margin-bottom:16px}
  .plv-sheet-link{display:block;border-radius:var(--r-card,10px);overflow:hidden;border:1px solid var(--hair);background:var(--off);line-height:0;aspect-ratio:3/2}
  .plv-sheet-link img{display:block;width:100%;height:100%;object-fit:contain}
  .plv-right{position:sticky;top:24px}
  .plv-rows{display:flex;flex-direction:column}
  .plv-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid var(--hair-2);font-size:var(--fs-sec,13px)}
  .plv-row:last-of-type{border-bottom:0}
  .plv-k{color:var(--t3)}
  .plv-v{font-weight:700;color:var(--ink);text-align:right}
  .plv-cta{display:flex;width:100%;margin-top:16px}
  .plv-fine{font-size:var(--fs-label,12px);color:var(--t3);margin-top:12px;line-height:1.5;text-align:center}
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
    // Immediate first pass: anything already in (or near) the viewport stays
    // visible on first paint, so short pages never look broken while waiting
    // for a scroll event. Only genuinely below-fold cards animate in later.
    var vh=window.innerHeight||document.documentElement.clientHeight||0;
    var below=[];
    els.forEach(function(el){
      var r=el.getBoundingClientRect();
      if(r.top<vh+40)return;
      el.style.opacity='0';el.style.transform='translateY(14px)';below.push(el);
    });
    if(!below.length)return;
    function show(el){
      el.style.transition='opacity .5s ease, transform .5s cubic-bezier(.2,.7,.3,1)';
      requestAnimationFrame(function(){el.style.opacity='';el.style.transform='';});
    }
    var io=new IntersectionObserver(function(ents,obs){
      ents.forEach(function(en){ if(!en.isIntersecting)return; show(en.target); obs.unobserve(en.target); });
    },{rootMargin:'0px 0px -6% 0px',threshold:0.04});
    below.forEach(function(el){io.observe(el);});
    // Failsafe: never leave content hidden if the observer misses (zoom,
    // resize, dynamically removed nodes).
    setTimeout(function(){below.forEach(function(el){if(el.style.opacity==='0'){io.unobserve(el);show(el);}});},4000);
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
    const conf = it.confirm ? ` data-confirm="${esc(it.confirm)}"${it.danger ? " data-danger" : ""}` : "";
    const extras = Object.entries(it.extra || {}).map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join("");
    return `<form method="POST" action="${it.action}" class="rowmenu-form"${conf}><input type="hidden" name="id" value="${it.id}">${extras}<button type="submit" class="${cls}">${ic}${esc(it.label)}</button></form>`;
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
    .tbl-tools{display:flex;align-items:center;gap:8px;margin-bottom:12px}
    .tbl-tools .tbl-ic{display:flex;color:var(--faint)}.tbl-tools .tbl-ic svg{width:16px;height:16px}
    .tbl-search{flex:0 1 340px;max-width:340px;padding:8px 12px;border:1px solid var(--hair);border-radius:var(--r-ctl);background:var(--card);color:var(--ink);font-size:var(--fs-sec)}
    .tbl-search:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 3px var(--gold-tint)}
    .tbl-count{font-size:var(--fs-label);color:var(--t3);font-variant-numeric:tabular-nums}
    .bulk-del{display:inline-flex;align-items:center;gap:8px}
    .bulk-del svg{width:16px;height:16px;flex:0 0 auto}
    .wl-search{display:inline-flex;align-items:center;gap:8px;text-decoration:none}
    .wl-search svg{width:15px;height:15px;flex:0 0 auto}
    .backlink{display:inline-flex;align-items:center;gap:8px;color:var(--t2);font-size:var(--fs-sec);font-weight:600;text-decoration:none;margin-bottom:8px}
    .backlink:hover{color:var(--ink)}
    /* Reusable row action menu (kebab dropdown). */
    .rowmenu{position:relative;display:inline-block}
    .rowmenu>summary{list-style:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:var(--r-ctl);border:1px solid transparent;color:var(--t3)}
    .rowmenu>summary::-webkit-details-marker{display:none}
    .rowmenu>summary:hover{background:var(--hover);color:var(--ink)}
    .rowmenu[open]>summary{background:var(--hover);border-color:var(--hair);color:var(--ink)}
    .rowmenu>summary svg{width:18px;height:18px}
    .rowmenu-pop{position:fixed;z-index:1000;min-width:184px;background:var(--card);border:1px solid var(--hair);border-radius:var(--r-card);box-shadow:0 14px 34px rgba(0,0,0,0.14);padding:4px}
    .rowmenu-form{margin:0}
    .rowmenu-item{display:flex;align-items:center;gap:8px;width:100%;text-align:left;background:transparent;border:0;padding:8px 12px;border-radius:var(--r-ctl);font-size:var(--fs-sec);font-weight:500;color:var(--ink);cursor:pointer;font-family:inherit;white-space:nowrap;text-decoration:none}
    .rowmenu-item:hover{background:var(--hover)}
    .rowmenu-item svg{width:15px;height:15px;color:var(--t3);flex:0 0 auto}
    .rowmenu-item.danger{color:var(--bad)}
    .rowmenu-item.danger svg{color:var(--bad)}
    .rowmenu-item.danger:hover{background:var(--bad-bg)}
    .rowmenu-sep{height:1px;background:var(--hair);margin:4px}
    /* On phones the kebab dropdown becomes a bottom sheet, so it can never be
       clipped or land under a thumb. The JS positions with inline styles, so
       these override with !important. */
    @media(max-width:640px){
      .rowmenu-pop{left:12px!important;right:12px!important;top:auto!important;bottom:calc(12px + env(safe-area-inset-bottom))!important;min-width:0;border-radius:var(--r-card);box-shadow:0 -12px 40px rgba(0,0,0,.3);padding:8px}
      .rowmenu-item{padding:16px;font-size:var(--fs-body);min-height:44px}
    }
    /* Reusable table toolbar Export button (secondary button alias). */
    .tbl-export{display:inline-flex;align-items:center;gap:8px;font-size:var(--fs-label);font-weight:600;color:var(--t2);background:var(--card);border:1px solid var(--hair);border-radius:var(--r-ctl);padding:8px 12px;cursor:pointer;font-family:inherit;white-space:nowrap}
    .tbl-export:hover{border-color:var(--field-line);color:var(--ink)}
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

// Shell-level UX guard, shared by every admin page:
//  * window.jdmToast(message, isError): the single toast used by all AJAX
//    handlers and flash messages. Bottom-center, success and error variants.
//  * Renders the one-shot ?notice= / ?notice_err= params that the POST routes
//    append to their redirects, then cleans them from the URL.
//  * Disables a form's submit buttons while a native (non-AJAX) post is in
//    flight so a slow Worker response cannot collect double-submits; restores
//    them on pageshow so bfcache back-navigation never leaves dead buttons.
function uxGuardScript() {
  return `<style>
    /* The ONE toast and the ONE confirm dialog, on the same tokens they guard.
       Both render against the dark root palette (appended to body), a calm
       dark surface over either workspace, in the Linear dialog register:
       hairline cancel, single gold confirm, red outline for danger. */
    .jdm-toast{position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom));transform:translateX(-50%);max-width:min(92vw,480px);background:var(--card-2,#1C2027);color:var(--ink,#F4F2EC);border:1px solid var(--hair,rgba(255,255,255,0.14));padding:12px 16px;border-radius:var(--r-card,10px);font-family:inherit;font-size:var(--fs-sec,13px);font-weight:600;line-height:var(--lh-list,1.45);z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,.28);text-align:center}
    .jdm-toast.err{background:var(--bad);color:var(--on-solid)}
    .jdmc-scrim{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9997}
    .jdmc-card{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:9998;background:var(--card,#171A20);color:var(--ink,#F4F2EC);border:1px solid var(--hair,rgba(255,255,255,.08));border-radius:var(--r-card,10px);padding:var(--pad-card,20px);width:min(92vw,420px);box-shadow:0 24px 60px rgba(0,0,0,.35)}
    .jdmc-m{font-size:var(--fs-body,15px);line-height:var(--lh-body,1.5);font-weight:500;white-space:pre-line}
    .jdmc-b{display:flex;gap:12px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap}
    .jdmc-b button{font-family:inherit;font-size:var(--fs-sec,13px);font-weight:600;border-radius:var(--r-ctl,8px);padding:10px 16px;cursor:pointer;min-height:44px}
    .jdmc-cancel{background:transparent;border:1px solid var(--hair,rgba(255,255,255,.18));color:var(--ink,#F4F2EC)}
    .jdmc-cancel:hover{background:var(--hover,rgba(255,255,255,.05))}
    .jdmc-ok{background:var(--gold,#CAA34C);border:0;color:var(--gold-on,#15120A)}
    .jdmc-ok:hover{background:var(--gold-hover,#D9B45F)}
    .jdmc-ok.danger{background:transparent;border:1px solid var(--bad-line,rgba(226,96,122,.55));color:var(--bad,#E2607A)}
    .jdmc-ok.danger:hover{background:var(--bad-bg,rgba(226,96,122,.12))}
  </style><script>(function(){
  var live=null;
  window.jdmToast=function(m,err,ms){
    try{
      if(live&&live.parentNode)live.parentNode.removeChild(live);
      var t=document.createElement('div');t.className='jdm-toast'+(err?' err':'');t.setAttribute('role','status');t.textContent=m;
      document.body.appendChild(t);live=t;
      setTimeout(function(){t.style.transition='opacity .35s';t.style.opacity='0';setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t);if(live===t)live=null;},360);},ms||(err?4200:2600));
    }catch(e){}
  };
  // The one styled confirm dialog (replaces native confirm()). Returns a
  // Promise<boolean>; falls back to native confirm if the DOM path fails.
  window.jdmConfirm=function(msg,opts){
    opts=opts||{};
    return new Promise(function(resolve){
      try{
        var prev=document.getElementById('jdmConfirm'); if(prev)prev.remove();
        var wrap=document.createElement('div'); wrap.id='jdmConfirm';
        wrap.innerHTML='<div class="jdmc-scrim"></div><div class="jdmc-card" role="alertdialog" aria-modal="true" aria-label="Please confirm"><div class="jdmc-m"></div><div class="jdmc-b"><button type="button" class="jdmc-cancel">Cancel</button><button type="button" class="jdmc-ok'+(opts.danger?' danger':'')+'"></button></div></div>';
        wrap.querySelector('.jdmc-m').textContent=String(msg||'Are you sure?');
        var okBtn=wrap.querySelector('.jdmc-ok'); okBtn.textContent=opts.okLabel||'Confirm';
        var last=document.activeElement;
        function done(v){ if(wrap.parentNode)wrap.parentNode.removeChild(wrap); document.removeEventListener('keydown',onKey); if(last&&last.focus){try{last.focus();}catch(e){}} resolve(v); }
        function onKey(e){ if(e.key==='Escape')done(false); }
        wrap.querySelector('.jdmc-cancel').addEventListener('click',function(){done(false);});
        okBtn.addEventListener('click',function(){done(true);});
        wrap.querySelector('.jdmc-scrim').addEventListener('click',function(){done(false);});
        document.addEventListener('keydown',onKey);
        document.body.appendChild(wrap);
        okBtn.focus();
      }catch(e){ resolve(confirm(msg)); }
    });
  };
  // Confirm-on-change for destructive select pickers (share / reassign): keeps
  // the previous value (from data-prev, set on focus) when the user cancels.
  window.jdmConfirmSelect=function(sel,msg){
    var prevVal=sel.dataset.prev||'';
    window.jdmConfirm(msg).then(function(ok){
      if(ok&&sel.form){ if(sel.form.requestSubmit)sel.form.requestSubmit(); else sel.form.submit(); }
      else if(!ok)sel.value=prevVal;
    });
  };
  // Declarative confirms: a form with data-confirm shows the styled dialog and
  // only submits on Confirm. data-danger styles the confirm button red.
  document.addEventListener('submit',function(e){
    var f=e.target; if(!f||!f.getAttribute)return;
    var msg=f.getAttribute('data-confirm');
    if(msg&&!f.__jdmOk){
      e.preventDefault();
      window.jdmConfirm(msg,{danger:f.hasAttribute('data-danger'),okLabel:f.getAttribute('data-confirm-ok')||''}).then(function(ok){
        if(!ok)return;
        f.__jdmOk=true;
        if(f.requestSubmit)f.requestSubmit(); else f.submit();
      });
    }
  },true);
  try{
    var p=new URLSearchParams(location.search),ok=p.get('notice'),bad=p.get('notice_err');
    if(ok||bad){
      window.jdmToast(bad||ok,!!bad);
      p.delete('notice');p.delete('notice_err');
      var qs=p.toString();
      history.replaceState(null,'',location.pathname+(qs?'?'+qs:'')+location.hash);
    }
  }catch(e){}
  var locked=[];
  document.addEventListener('submit',function(e){
    var f=e.target; if(!f||!f.tagName||f.tagName!=='FORM'||f.hasAttribute('data-noguard'))return;
    // Defer so (a) AJAX handlers can preventDefault first and (b) the browser
    // snapshots the form data before any submit button is disabled.
    setTimeout(function(){
      if(e.defaultPrevented)return;
      var btns=[].slice.call(f.querySelectorAll('button[type=submit],button:not([type]),input[type=submit]'));
      if(f.id){btns=btns.concat([].slice.call(document.querySelectorAll('button[form="'+f.id+'"],input[type=submit][form="'+f.id+'"]')));}
      btns.forEach(function(b){if(!b.disabled){b.disabled=true;locked.push(b);}});
    },0);
  },true);
  window.addEventListener('pageshow',function(){locked.forEach(function(b){b.disabled=false;});locked=[];});
  // Contact-tap logging: WhatsApp / Call / Email buttons carry
  // data-clog="clientId:channel"; a beacon records the touch without ever
  // blocking the tel:/mailto:/wa.me navigation.
  document.addEventListener('click',function(e){
    var el=e.target&&e.target.closest?e.target.closest('[data-clog]'):null; if(!el)return;
    try{
      var v=(el.getAttribute('data-clog')||'').split(':');
      var fd=new FormData(); fd.append('id',v[0]||''); fd.append('channel',v[1]||'other');
      if(navigator.sendBeacon)navigator.sendBeacon('/client/contact-log',fd);
      else fetch('/client/contact-log',{method:'POST',body:fd,keepalive:true});
      // Confirm the touch was recorded, so last-contacted is trusted data.
      var ch=(v[1]||'contact'); ch=ch==='whatsapp'?'WhatsApp':ch.charAt(0).toUpperCase()+ch.slice(1);
      if(window.jdmToast)jdmToast(ch+' touch logged to the timeline');
    }catch(err){}
  });
})();</script>`;
}

function shell(side, main, title) {
  // Inter self-hosted and preloaded, shared with brandDoc via theme.js exports:
  // no third-party origin, ready by first paint (no swap flash). The staff CSS
  // uses weight 800, which the old Google URL omitted (so it was faux-bolded);
  // the self-hosted set includes it. @font-face is prepended to the stylesheet.
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0F1115"><meta name="color-scheme" content="dark"><title>${title}</title>${FONT_PRELOADS}<style>${FONT_FACE_CSS}${CSS}</style></head>
    <body><a class="skip-link" href="#admin-main">Skip to content</a><input type="checkbox" id="navToggle" class="nav-cb" aria-hidden="true" tabindex="-1"><div class="wrap">${side}<label for="navToggle" class="nav-scrim" aria-hidden="true"></label><div class="main" role="main" id="admin-main"><label for="navToggle" class="nav-burger" role="button" tabindex="0" aria-expanded="false" aria-label="Open menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg><span>Menu</span></label>${main}</div></div>${drawerChrome()}${uxGuardScript()}${revealScript()}${tableToolsScript()}<script>(function(){var cb=document.getElementById('navToggle'),b=document.querySelector('.nav-burger');if(!cb||!b)return;function sync(){b.setAttribute('aria-expanded',cb.checked?'true':'false');}b.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '||e.key==='Spacebar'){e.preventDefault();cb.checked=!cb.checked;sync();}});cb.addEventListener('change',sync);})();</script></body></html>`;
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
    .dw-close{position:absolute;top:16px;right:16px;width:32px;height:32px;border:0;background:var(--hover);border-radius:var(--r-ctl);font-size:20px;line-height:1;color:var(--t2);cursor:pointer;z-index:2}
    .dw-close:hover{background:var(--soft);color:var(--ink)}
    .dw-content{padding:var(--sp-5) var(--sp-5) 44px}
    .dw-loading,.dw-empty{padding:44px 4px;color:var(--faint);font-size:var(--fs-sec)}
    .dw-empty-sm{padding:4px 2px;color:var(--faint);font-size:var(--fs-label)}
    .dw-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin:0 0 16px;padding-right:32px}
    .dw-id{display:flex;align-items:center;gap:12px}
    .dw-name{font-size:var(--fs-sect);font-weight:700;color:var(--ink)}
    .dw-sub{font-size:var(--fs-label);color:var(--t3);margin-top:2px}
    .dw-open{font-size:var(--fs-label);padding:8px 12px;white-space:nowrap}
    .dw-card{background:var(--card);border:1px solid var(--hair);border-radius:var(--r-card);padding:4px 16px;margin-bottom:8px}
    .dw-row{display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--hair-2)}
    .dw-row:last-child{border-bottom:0}
    .dw-k{font-size:var(--fs-label);color:var(--t3)}
    .dw-v{font-size:var(--fs-sec);font-weight:600;color:var(--ink);text-align:right}
    .dw-sec{font-size:var(--fs-label);font-weight:var(--w-label);letter-spacing:var(--ls-label);text-transform:uppercase;color:var(--t3);margin:var(--sp-4) 0 8px;display:flex;align-items:center;gap:8px}
    .dw-sec .ct{background:var(--soft);color:var(--t2);border-radius:9999px;padding:1px 8px;font-size:var(--fs-label)}
    .dw-list{display:flex;flex-direction:column;gap:8px}
    .dw-item{background:var(--card);border:1px solid var(--hair);border-radius:var(--r-card);padding:12px 16px}
    .dw-item-t{font-size:var(--fs-sec);font-weight:600;color:var(--ink)}
    .dw-item-s{font-size:var(--fs-label);color:var(--t3);margin-top:4px;display:flex;flex-wrap:wrap;align-items:center;gap:8px}
    .dw-cta{display:flex;gap:8px;margin:16px 0 4px}
    .dw-cta-b{flex:1;text-align:center;text-decoration:none;font-size:var(--fs-sec);font-weight:600;padding:8px 12px;border-radius:var(--r-ctl);background:var(--card);border:1px solid var(--hair);color:var(--ink)}
    .dw-cta-b:hover{border-color:var(--field-line);background:var(--hover)}
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
// client. Shared access is for co-searching (view/add matches), it must never
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

// Schema-drift-tolerant client INSERT. `cols` is an object of column -> value.
// If the live DB is missing the migration-gated `source` column (0016), the
// insert would throw "no column named source"; we strip it and retry, so a
// lagging migration degrades to "stored without that field" rather than
// blocking client creation. Mirrors the wishlist drift helpers. Returns the run
// result (so callers can read meta.last_row_id).
const CLIENT_DRIFT = /source/i;
async function insertClientDrift(env, cols) {
  let entries = Object.entries(cols);
  for (;;) {
    const names = entries.map(([k]) => k);
    try {
      return await env.DB.prepare(
        `INSERT INTO clients (${names.join(", ")}) VALUES (${names.map(() => "?").join(", ")})`
      ).bind(...entries.map(([, v]) => v)).run();
    } catch (e) {
      const m = String(e && e.message).match(CLIENT_DRIFT);
      const missing = m && m[0].toLowerCase();
      if (!missing || !entries.some(([k]) => k.toLowerCase() === missing)) throw e;
      console.error(`insertClientDrift: ${missing} column missing (apply migration 0016); storing without it`);
      entries = entries.filter(([k]) => k.toLowerCase() !== missing);
    }
  }
}

export async function createClient(env, form, session) {
  const name = sstr(form, "name") || "";
  const email = String(form.get("email") || "").trim().slice(0, FIELD_MAX.email);
  const whatsappRaw = String(form.get("whatsapp") || "").trim();
  // A client must be reachable, or any match we find can never be sent. Require
  // a name plus at least one contact channel (email or WhatsApp).
  if (!name) return { ok: false, error: "name" };
  if (!email && !whatsappRaw) return { ok: false, error: "contact" };
  if (email && !REQ_EMAIL_RE.test(email)) return { ok: false, error: "email" };
  // Store phones in canonical E.164 so matching and wa.me links always work.
  const whatsapp = whatsappRaw ? phoneE164(whatsappRaw) : "";
  if (whatsappRaw && !whatsapp) return { ok: false, error: "whatsapp" };
  const state = normalizeState(form.get("state"));
  // Unknown category values fall back to 'private' rather than erroring; the
  // select only offers valid ids, so anything else is a stale/hand-built form.
  const rawCategory = String(form.get("category") || "");
  const category = CLIENT_CATEGORY_IDS.has(rawCategory) ? rawCategory : "private";
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

  const r = await insertClientDrift(env, {
    name, email: email || null, whatsapp: whatsapp || null, state,
    agent_id: agentId, category, source: "jdm",
  });
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

  const name = sstr(form, "name") || "";
  const email = String(form.get("email") || "").trim().slice(0, FIELD_MAX.email);
  const whatsappRaw = String(form.get("whatsapp") || "").trim();
  const whatsapp = whatsappRaw ? phoneE164(whatsappRaw) : "";
  if (email && !REQ_EMAIL_RE.test(email)) return { ok: false, error: "email" };
  if (whatsappRaw && !whatsapp) return { ok: false, error: "whatsapp" };
  const state = normalizeState(form.get("state"));
  // Absent field = a caller that doesn't know about categories (keep what's
  // stored); an unknown value = a mangled form (fall back to private).
  const rawCategory = form.get("category");
  const category = rawCategory === null
    ? (c.category || "private")
    : (CLIENT_CATEGORY_IDS.has(String(rawCategory)) ? String(rawCategory) : "private");
  if (!name) return { ok: false, error: "name" };
  // Require a contact channel only if the client already had one: this guards
  // against an edit STRIPPING the last way to reach them. A client who never
  // had contact details (e.g. imported without them) can still have their
  // state, name or category corrected without being forced to invent an email
  // - the "no email or WhatsApp on file" warnings elsewhere already flag the
  // gap, so nothing is hidden by allowing the save.
  const hadContact = !!(c.email || c.whatsapp);
  if (hadContact && !email && !whatsapp) return { ok: false, error: "contact" };
  // Portal sign-in and invite links are keyed to the email, so don't let it be
  // stripped while the client still has portal access.
  if (c.portal_enabled && !email) return { ok: false, error: "portal_email" };

  // Refuse a contact change that would duplicate another client in this client's
  // scope. Self-match is expected (unchanged email/phone) and allowed.
  const dup = await findClientByContact(env, { email, whatsapp, ...clientDedupeScope(c.agent_id) });
  if (dup && Number(dup.id) !== cid) return { ok: false, error: "duplicate", id: dup.id, name: dup.name };

  await env.DB.prepare("UPDATE clients SET name = ?, email = ?, whatsapp = ?, state = ?, category = ? WHERE id = ?")
    .bind(name, email || null, whatsapp || null, state, category, cid).run();
  return { ok: true, id: cid };
}

// Map an updateClient() error code to a plain-English message for the UI.
export function clientEditErrorMessage(code) {
  return ({
    name: "Please enter the client's name.",
    contact: "Add an email or a WhatsApp number so we can still reach them.",
    email: "That email address doesn't look right. Please check it and try again.",
    whatsapp: "That phone number doesn't look right. Use the full number with area code, e.g. +61 4XX XXX XXX.",
    portal_email: "This client has buyer-portal access, which needs an email. Revoke portal access first if you really need to remove the email.",
    duplicate: "Another client already uses that email or phone number, so the change was not saved.",
    forbidden: "Only the client's owner (or an admin) can edit their details.",
    notfound: "That client no longer exists.",
  })[code] || "Sorry, those changes could not be saved.";
}

const num = (form, k) => { const v = form.get(k); return v === null || v === "" ? null : Number(v); };
const str = (form, k) => { const v = form.get(k); return v === null || v === "" ? null : v; };

// --- V1.2 Phase 3: shared server-side sanitisers ------------------------------
// Every mutation handler funnels user input through these, so a hand-built
// POST can't store oversized junk or out-of-range numbers regardless of which
// form it claims to come from. Client-side maxlength is advisory only.
const FIELD_MAX = {
  name: 120, email: 254, whatsapp: 40, label: 120, marka_name: 60,
  model_name: 60, kuzov: 40, grade_kw: 60, company: 120, note: 2000, state: 40,
};
// Active searches per client, staff and portal alike. Stops one record fanning
// out into dozens of match-all searches that hammer the matcher.
export const WISHLIST_ACTIVE_CAP = 10;
const PRICE_MAX_CAP = 100000000;   // JPY auction ceiling
const MILEAGE_MAX_CAP = 2000000;   // km
const sstr = (form, k, max) => {
  const v = String(form.get(k) ?? "").trim().slice(0, max || FIELD_MAX[k] || 200);
  return v || null;
};
// Years must be a real 4-digit year in the range the feed can contain.
const syear = (form, k) => {
  const v = String(form.get(k) ?? "").trim();
  return /^\d{4}$/.test(v) && Number(v) >= 1970 && Number(v) <= 2050 ? Number(v) : null;
};
// Positive integer capped at a sane ceiling; anything else stores as null.
const sint = (form, k, cap) => {
  const v = String(form.get(k) ?? "").trim().replace(/[,\s]/g, "");
  if (!/^\d{1,12}$/.test(v)) return null;
  const n = Math.min(Number(v), cap);
  return n > 0 ? n : null;
};
// E.164-ish phone: optional +, 8 to 15 digits once spacing is stripped. AU
// local 04xx / 0x formats rewrite to +61. Returns the canonical +digits form,
// or null when the input can't be a reachable number.
export function phoneE164(raw) {
  let s = String(raw || "").replace(/[\s().-]/g, "");
  if (!s) return null;
  if (/^0\d{8,9}$/.test(s)) s = "+61" + s.slice(1);
  else if (/^61\d{9}$/.test(s)) s = "+" + s;
  if (!/^\+?\d{8,15}$/.test(s)) return null;
  return s.startsWith("+") ? s : "+" + s;
}
// Grade values from either a multi-select (repeated "grades" keys) or a plain
// comma-separated text input: each clipped, up to 8, stored as a JSON array
// string, or null when none chosen (V1.2 Phase 4).
function sgrades(form) {
  const list = (form.getAll ? form.getAll("grades") : [])
    .flatMap((v) => String(v || "").split(","))
    .map((g) => g.trim().slice(0, FIELD_MAX.grade_kw))
    .filter(Boolean).slice(0, 8);
  return list.length ? JSON.stringify(list) : null;
}
// Render a stored grades JSON list back to editable comma-separated text.
export function gradesText(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  try { const l = JSON.parse(s); return Array.isArray(l) ? l.join(", ") : ""; } catch (e) { return s; }
}
async function activeWishlistCount(env, clientId) {
  const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM wishlists WHERE client_id = ? AND active = 1").bind(Number(clientId)).first();
  return Number(r?.n) || 0;
}
// Shared year pair: both valid 4-digit years, swapped into order.
function yearPair(form) {
  let yMin = syear(form, "year_min"), yMax = syear(form, "year_max");
  if (yMin !== null && yMax !== null && yMin > yMax) { const t = yMin; yMin = yMax; yMax = t; }
  return { yMin, yMax };
}

// Migration-gated wishlist columns: added by 0014 (budget_aud) and 0015
// (model_code, grades). If a production DB is running new code before its
// migration has been applied, a plain INSERT/UPDATE naming these columns throws
// "no column named ..." and the whole save fails. The two helpers below strip
// whichever such column the error names and retry, so a lagging migration
// degrades to "stored without that field" instead of a hard failure. This
// mirrors the pattern createRequestWishlist already uses for the public form,
// extended to every staff/portal write so no save path can hard-break again.
const DRIFT_COLS = /budget_aud|model_code|grades|mileage_min/i;
async function insertWishlistDrift(env, pairs) {
  let cols = pairs.slice();
  for (;;) {
    const names = cols.map((c) => c[0]);
    try {
      const ins = await env.DB.prepare(
        `INSERT INTO wishlists (${names.join(", ")}) VALUES (${names.map(() => "?").join(", ")})`
      ).bind(...cols.map((c) => c[1])).run();
      return ins?.meta?.last_row_id ?? null;
    } catch (e) {
      const m = String(e && e.message).match(DRIFT_COLS);
      const missing = m && m[0].toLowerCase();
      if (!missing || !cols.some((c) => c[0].toLowerCase() === missing)) throw e;
      console.error(`insertWishlistDrift: ${missing} column missing (apply the matching migration); storing without it`);
      cols = cols.filter((c) => c[0].toLowerCase() !== missing);
    }
  }
}
async function updateWishlistDrift(env, sets, where, whereVals) {
  let cols = sets.slice();
  for (;;) {
    try {
      await env.DB.prepare(
        `UPDATE wishlists SET ${cols.map((c) => `${c[0]} = ?`).join(", ")} ${where}`
      ).bind(...cols.map((c) => c[1]), ...whereVals).run();
      return;
    } catch (e) {
      const m = String(e && e.message).match(DRIFT_COLS);
      const missing = m && m[0].toLowerCase();
      if (!missing || !cols.some((c) => c[0].toLowerCase() === missing)) throw e;
      console.error(`updateWishlistDrift: ${missing} column missing (apply the matching migration); skipping it`);
      cols = cols.filter((c) => c[0].toLowerCase() !== missing);
    }
  }
}

export async function createWishlist(env, form, clientIdOverride, session) {
  const clientId = clientIdOverride ?? num(form, "client_id");
  if (!clientId) return { ok: false, error: "client" };
  // An agent can add a wishlist to any client they own or that's shared to them.
  if (!(await clientAccessibleBy(env, clientId, session))) return { ok: false, error: "forbidden" };
  const marka = sstr(form, "marka_name"), model = sstr(form, "model_name");
  const kuzov = sstr(form, "kuzov"), gradeKw = sstr(form, "grade_kw");
  const modelCode = sstr(form, "model_code", FIELD_MAX.kuzov);
  // Don't save a whole-feed wishlist: require at least one narrowing term.
  if (!(marka || model || kuzov || gradeKw || modelCode)) return { ok: false, error: "term" };
  // Guardrail: cap active searches per client so one record can't fan out into
  // dozens of match-all searches.
  if ((await activeWishlistCount(env, clientId)) >= WISHLIST_ACTIVE_CAP) return { ok: false, error: "limit" };
  const { yMin, yMax } = yearPair(form);
  await insertWishlistDrift(env, [
    ["client_id", clientId], ["label", sstr(form, "label")], ["marka_name", marka], ["model_name", model],
    ["year_min", yMin], ["year_max", yMax], ["price_max", sint(form, "price_max", PRICE_MAX_CAP)],
    ["mileage_max", sint(form, "mileage_max", MILEAGE_MAX_CAP)], ["mileage_min", sint(form, "mileage_min", MILEAGE_MAX_CAP)], ["rate_min", clampRange(num(form, "rate_min"), 1, 6)],
    ["kuzov", kuzov], ["grade_kw", gradeKw], ["watch_only", form.get("watch_only") ? 1 : 0],
    ["model_code", modelCode], ["grades", sgrades(form)],
  ]);
  return { ok: true };
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
  const name = sstr(form, "name") || "";
  const email = String(form.get("email") || "").trim().toLowerCase().slice(0, FIELD_MAX.email);
  const company = sstr(form, "company");
  if (!name || !email) return { ok: false, error: "missing fields" };
  if (!REQ_EMAIL_RE.test(email)) return { ok: false, error: "invalid email" };
  const token = randomToken();
  const exp = Date.now() + INVITE_TTL_MS;
  try {
    await env.DB.prepare(
      "INSERT INTO agents (email, name, company, pass_salt, pass_hash, invite_token, invite_exp) VALUES (?, ?, ?, '', '', ?, ?)"
    ).bind(email, name, company, await hashToken(token), exp).run();
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
  await env.DB.prepare("UPDATE agents SET invite_token = ?, invite_exp = ? WHERE id = ?").bind(await hashToken(token), exp, a.id).run();
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
export async function bulkAllocate(env, action, agentId, ids, session, includeAgents = false) {
  if (!session || session.role !== "admin") return;
  const list = (ids || []).map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (!list.length) return;

  // Bulk delete: cascade each client (matches, seen-lots, searches, shares) then
  // the client itself - same order as the single deleteClient. Admin-only.
  // Safety: a select-all delete must never sweep up an agent's book by accident.
  // By default any selected customer OWNED by an agent (agent_id set) is skipped;
  // the admin has to opt in (the "Include agents' customers" checkbox ->
  // includeAgents) to remove those. Shared-but-unowned customers belong to JDM
  // Connect, so they stay in scope. Returns { deleted, skipped } for the notice.
  if (action === "delete") {
    let deletable = list, skipped = 0;
    if (!includeAgents) {
      const owned = new Set(
        (((await env.DB.prepare("SELECT id FROM clients WHERE agent_id IS NOT NULL").all()).results) || [])
          .map((r) => Number(r.id))
      );
      deletable = list.filter((cid) => !owned.has(cid));
      skipped = list.length - deletable.length;
    }
    const stmts = [];
    for (const cid of deletable) {
      stmts.push(env.DB.prepare("DELETE FROM queue WHERE client_id = ?").bind(cid));
      stmts.push(env.DB.prepare("DELETE FROM seen_lots WHERE wishlist_id IN (SELECT id FROM wishlists WHERE client_id = ?)").bind(cid));
      stmts.push(env.DB.prepare("DELETE FROM wishlists WHERE client_id = ?").bind(cid));
      stmts.push(env.DB.prepare("DELETE FROM client_shares WHERE client_id = ?").bind(cid));
      stmts.push(env.DB.prepare("DELETE FROM activity WHERE client_id = ?").bind(cid));
      stmts.push(env.DB.prepare("DELETE FROM tasks WHERE client_id = ?").bind(cid));
      stmts.push(env.DB.prepare("DELETE FROM clients WHERE id = ?").bind(cid));
    }
    if (stmts.length) await env.DB.batch(stmts);
    return { deleted: deletable.length, skipped };
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
  // Bump session_ver too: deactivating an agent should end their live sessions
  // immediately, not just block the next login. Falls back to the legacy
  // update if migration 0010 has not reached this database yet.
  await runWithSessionVerFallback(env,
    "UPDATE agents SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END, session_ver = session_ver + 1 WHERE id = ?",
    "UPDATE agents SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END WHERE id = ?",
    [aid], "toggleAgent");
}

// Hardening for the PUBLIC /request form (createClient/createWishlist are also
// used by the admin-only flows, so the spam controls live here, not there).
const REQ_MAX = { name: 120, email: 160, whatsapp: 40, label: 120, marka_name: 60, model_name: 60, kuzov: 40, grade_kw: 40 };
const REQ_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Minimum realistic all-in import budget (AUD). Below this, an import isn't viable
//, it's the hard floor that catches junk/lowball input; the on-form note does the
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

    // The form promises "Name is required" - enforce it server side too, or a
    // hand-built POST (or the novalidate wizard) creates a nameless account
    // that upsertPublicClient silently labels "Website enquiry" (launch audit).
    if (!displayName) return { ok: false, error: "name", vals };

    // Email-uniqueness (V1.2 Phase 3): an email that already has a login never
    // opens a second account, but the response must not reveal the account
    // exists either. The enquiry folds into the existing record (the upsert
    // below matches by email/phone), the typed password is ignored (it can
    // never overwrite an existing login), and the route emails the existing
    // account a sign-in link. The confirmation page is the same either way.

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

  // A year range is required and must be sane, JDM generations and SEVS
  // eligibility are year-bound, so an open-ended request isn't searchable.
  const yMinReq = Number(g("year_min")), yMaxReq = Number(g("year_max"));
  if (!Number.isFinite(yMinReq) || !Number.isFinite(yMaxReq) || yMinReq < 1970 || yMaxReq > 2050 || yMinReq > yMaxReq) {
    return { ok: false, error: "year", vals };
  }

  // Budget is mandatory: a realistic all-in AUD figure qualifies the lead and
  // weeds out time-wasters. V1.3 Phase C: the budget is stored on the lead
  // record (wishlists.budget_aud) but NO LONGER converted into the matcher's
  // price_max filter. A rough FX conversion was silently excluding cars the
  // buyer could afford; staff see the stated budget and judge fit until
  // filtering can be done properly (landed-cost aware).
  const audBudget = Number(g("budget_aud"));
  if (!Number.isFinite(audBudget) || audBudget < BUDGET_MIN_AUD) {
    return { ok: false, error: "budget", vals };
  }
  form.delete("price_max");

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
  let clientId, portal, existing, wishlistId, inviteNeeded = false, signinNeeded = false;
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
      // so we never nag them for a password. A staff-revoked client never gets
      // one either: the resulting inviteClientPortal call would clear the
      // portal_revoked veto, letting them self-invite straight back in.
      const exi = await env.DB.prepare("SELECT pass_hash, google_sub, COALESCE(portal_revoked, 0) AS portal_revoked FROM clients WHERE id = ?").bind(clientId).first();
      if (exi && !exi.pass_hash && !exi.google_sub && !exi.portal_revoked) inviteNeeded = true;
      // Existing record WITH a login: the typed password was ignored, so email
      // a sign-in link instead (neutral "check your email to continue" flow).
      else if (exi && (exi.pass_hash || exi.google_sub)) signinNeeded = true;
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
  return { ok: true, req, ref, clientId, wishlistId, inviteNeeded, signinNeeded };
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

  const res = await insertClientDrift(env, {
    name, email, portal_enabled: 1, google_sub: sub, source: "public",
  });
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
  const r = await insertClientDrift(env, {
    name, email: email || null, whatsapp: whatsapp || null, state, source: "public",
  });
  return { id: r.meta?.last_row_id, created: true };
}

// Always-create wishlist for the public request path (Fix 2). A request with no
// make/model/chassis/keyword is still saved, flagged needs_detail so staff can
// follow up; the matcher skips it until a narrowing term is added. Fix 6: skip
// an obvious duplicate (same maker + model) for the same client.
// Same make+model already on this customer (in the same needs-detail state)?
// Returns the existing wishlist id, or null. Shared by the public request path
// and the staff one-step path so a repeat car refreshes the one request instead
// of duplicating it - and so the staff cap can exempt a refresh from the count.
async function sameCarWishlistId(env, clientId, form) {
  const marka = str(form, "marka_name"), model = str(form, "model_name");
  const kuzov = str(form, "kuzov"), gradeKw = str(form, "grade_kw");
  const modelCode = sstr(form, "model_code", FIELD_MAX.kuzov);
  const needsDetail = !(marka || model || kuzov || gradeKw || modelCode) ? 1 : 0;
  const row = await env.DB.prepare(
    `SELECT id FROM wishlists
       WHERE client_id = ?
         AND lower(COALESCE(marka_name,'')) = lower(?)
         AND lower(COALESCE(model_name,'')) = lower(?)
         AND COALESCE(needs_detail,0) = ?
       LIMIT 1`
  ).bind(clientId, marka || "", model || "", needsDetail).first();
  return row ? row.id : null;
}

async function createRequestWishlist(env, clientId, form) {
  if (!clientId) return null;
  const marka = str(form, "marka_name");
  const model = str(form, "model_name");
  const kuzov = str(form, "kuzov");
  const gradeKw = str(form, "grade_kw");
  const modelCode = sstr(form, "model_code", FIELD_MAX.kuzov);
  const gradesJson = sgrades(form);
  const needsDetail = !(marka || model || kuzov || gradeKw || modelCode) ? 1 : 0;

  const dupe = await sameCarWishlistId(env, clientId, form);
  if (dupe) return dupe;

  // Fix 4 (server side): clamp the numbers - the client checks are advisory only.
  let yMin = clampRange(num(form, "year_min"), 1970, 2050), yMax = clampRange(num(form, "year_max"), 1970, 2050);
  if (yMin !== null && yMax !== null && yMin > yMax) { const t = yMin; yMin = yMax; yMax = t; }
  const priceMax = clampRange(num(form, "price_max"), 0, 100000000);
  const budgetAud = clampRange(num(form, "budget_aud"), 0, 10000000);
  const mileageMax = clampRange(num(form, "mileage_max"), 0, MILEAGE_MAX_CAP);
  const mileageMin = clampRange(num(form, "mileage_min"), 0, MILEAGE_MAX_CAP);
  const rateMin = clampRange(num(form, "rate_min"), 1, 6);
  // Staff can flag a request "watch only" (surface matches for a follow-up call,
  // never auto-email). The public request form has no such field, so this stays
  // 0 there. Reading it here is what makes the staff one-step form honour it.
  const watchOnly = form.get("watch_only") ? 1 : 0;

  // Overseas flag: any non-Australia country value marks the request for manual,
  // non-AU handling. "Australia"/"AU" is treated as the default (no flag).
  let dest = str(form, "destination_country");
  if (dest && /^(australia|aus|au)$/i.test(dest.trim())) dest = null;

  // Schema-drift-tolerant insert: budget_aud (0014), model_code/grades (0015)
  // and mileage_min (0017) ride along when their columns exist. A production DB
  // that hasn't applied a migration yet still stores the search (without that
  // column) rather than failing the signup - the catch strips whichever column
  // the error names and retries.
  const optional = { budget_aud: budgetAud, model_code: modelCode, grades: gradesJson, mileage_min: mileageMin };
  let extraCols = Object.keys(optional);
  for (;;) {
    const cols = ["client_id", "label", "marka_name", "model_name", "year_min", "year_max", "price_max", "mileage_max", "rate_min", "kuzov", "grade_kw", "watch_only", "needs_detail", "destination_country", ...extraCols];
    const vals = [clientId, str(form, "label"), marka, model, yMin, yMax, priceMax, mileageMax, rateMin, kuzov, gradeKw, watchOnly, needsDetail, dest, ...extraCols.map((c) => optional[c])];
    try {
      const ins = await env.DB.prepare(
        `INSERT INTO wishlists (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`
      ).bind(...vals).run();
      return ins?.meta?.last_row_id ?? null;
    } catch (e) {
      const m = String(e && e.message).match(/budget_aud|model_code|grades|mileage_min/i);
      if (!m || !extraCols.length) throw e;
      const missing = m[0].toLowerCase();
      console.error(`createRequestWishlist: ${missing} column missing (apply the matching migration); storing without it`);
      extraCols = extraCols.filter((c) => c !== missing);
    }
  }
}

// One-step staff "new request": capture the customer AND the car they want in a
// single submit, so staff no longer create a customer and then a request as two
// separate chores. Reuses the public request path's mechanics - match an
// existing customer by email/phone and ATTACH (never a duplicate), else create
// one tagged source 'jdm' - then add the wishlist through createRequestWishlist,
// so the same-car refresh (no duplicate REQ) and the migration-drift tolerance
// apply here too. The car fields are optional: a blank search stores flagged
// (needs_detail) for staff to complete later, exactly like the public form.
// Staff-only; the route already gates admin/agent. Returns
// { ok, clientId, wishlistId, created, attached } or { ok:false, error }.
export async function createAdminRequest(env, form, session) {
  const name = sstr(form, "name") || "";
  const email = String(form.get("email") || "").trim().slice(0, FIELD_MAX.email).toLowerCase();
  const whatsappRaw = String(form.get("whatsapp") || "").trim();
  // A customer must be reachable, or any match we find can never be sent. Same
  // rule as createClient: a name plus at least one contact channel.
  if (!name) return { ok: false, error: "name" };
  if (!email && !whatsappRaw) return { ok: false, error: "contact" };
  if (email && !REQ_EMAIL_RE.test(email)) return { ok: false, error: "email" };
  const whatsapp = whatsappRaw ? phoneE164(whatsappRaw) : "";
  if (whatsappRaw && !whatsapp) return { ok: false, error: "whatsapp" };

  const state = normalizeState(form.get("state"));
  const rawCategory = String(form.get("category") || "");
  const category = CLIENT_CATEGORY_IDS.has(rawCategory) ? rawCategory : "private";
  const agentId = session && session.role === "agent" ? session.id : null;

  // Attach to the existing customer (matched by email, then phone) instead of
  // spawning a duplicate; otherwise create one, tagged 'jdm' (staff-added).
  const match = await findClientByContact(env, { email, whatsapp, ...clientDedupeScope(agentId) });
  let clientId, created = false;
  if (match) {
    clientId = match.id;
    // Backfill newly-supplied contact details without clobbering existing ones
    // (mirrors createClient's duplicate branch and upsertPublicClient).
    await env.DB.prepare(
      `UPDATE clients SET
          email = COALESCE(NULLIF(?, ''), email),
          whatsapp = COALESCE(NULLIF(?, ''), whatsapp),
          state = COALESCE(NULLIF(?, ''), state)
        WHERE id = ?`
    ).bind(email || "", whatsapp || "", state || "", clientId).run();
  } else {
    const ins = await insertClientDrift(env, {
      name, email: email || null, whatsapp: whatsapp || null, state,
      agent_id: agentId, category, source: "jdm",
    });
    clientId = ins?.meta?.last_row_id;
    created = true;
  }
  if (!clientId) return { ok: false, error: "save" };

  // Store the car through the same helper the public form uses (same-car
  // refresh + drift tolerance). Clip the free-text fields to their column
  // limits first, since createRequestWishlist reads them straight off the form.
  for (const k of ["marka_name", "model_name", "kuzov", "grade_kw", "label"]) {
    form.set(k, sstr(form, k) || "");
  }
  form.set("model_code", sstr(form, "model_code", FIELD_MAX.kuzov) || "");

  // Cap active searches per customer (the guardrail createWishlist enforces
  // everywhere else in the staff UI), but let a same-car refresh through: it
  // reuses the existing row, so it never adds to the count.
  if ((await sameCarWishlistId(env, clientId, form)) == null &&
      (await activeWishlistCount(env, clientId)) >= WISHLIST_ACTIVE_CAP) {
    return { ok: false, error: "limit", clientId, created, attached: !created };
  }
  const wishlistId = await createRequestWishlist(env, clientId, form);
  return { ok: true, clientId, wishlistId, created, attached: !created };
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

// portalSidebar moved to portal-shell.js so the Auction History module can
// share it without a dependency cycle; re-exported here for existing callers.

const DIRECT_REQUESTS_LABEL = "Direct requests";
// Lots staff add to a client from the in-client auction search land here.
const MANUAL_FINDS_LABEL = "Manual finds";
// Internal catch-all searches that are plumbing, not staff-managed wishlists,
// hidden from the client page's Searches list.
const SYSTEM_WISHLIST_LABELS = new Set([DIRECT_REQUESTS_LABEL, MANUAL_FINDS_LABEL]);

// Member-only auction search page (the "Auction page"): search the live feed and
// request any lot. Gated on clients.member.
export async function portalAuctionsPage(env, session, params = {}) {
  const cid = Number(session.id);
  const c = await env.DB.prepare("SELECT * FROM clients WHERE id = ? AND portal_enabled = 1").bind(cid).first();
  if (!c) {
    return brandShell(portalSidebar(null),
      `<div class="topbar"><div><div class="kicker">Buyer portal</div><h1>Access ended</h1></div><a class="btn-secondary" href="/logout">Sign out</a></div>
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
  const [fx, bidCountRow] = await Promise.all([
    getLiveFx(env).catch(() => 0),
    env.DB.prepare("SELECT COUNT(*) n FROM queue WHERE client_id = ? AND client_request = 1").bind(cid).first(),
  ]);
  const bidCount = bidCountRow?.n || 0;

  // The shared filter panel + engine (Phase 1): Live filters exactly like
  // Auction History. The block owns validation, the panel, chips, the results
  // bar and the pager; this page owns the tabs, cards and request actions.
  const topBar = `<div class="ahx-top"><span class="ahx-toplabel">Search live Japanese auctions</span><span class="ahx-counts">Watchlist <b data-watch-count>0</b> <span class="sep">&middot;</span> Bid requests <b>${bidCount}</b></span></div>`;
  const b = await liveSearchBlock(env, params, "member", {
    extras: view === "list" ? { view: "list" } : {},
    topBar,
    viewParam: "view",
    viewMode: view,
    skipSearch: tab === "watch",
  });
  const tabs = auctionTabs(tab, (id) => (id === "live" ? b.urlFor({}) : b.urlFor({ tab: id })), {});

  let body = "";
  if (tab === "watch") {
    body = `${tabs}<div id="watchGrid" class="acgrid"></div>`;
  } else {
    const r = b.r;
    const reqForm = (lot) => `<form method="POST" action="/portal/auctions/request" style="margin:0"><input type="hidden" name="id" value="${esc(lot.id)}"><button class="btn-primary btn-sm ac-req" type="submit">Request bid</button></form>`;
    let grid;
    if (r.lots.length) {
      grid = `<div class="acgrid${view === "list" ? " list" : ""}">${r.lots.map((lot) => auctionCardV2(lot, { fx, nowYear, actions: reqForm(lot), detailBase: "/portal/auctions/lot?id=" })).join("")}</div>`;
    } else if (!r.ok) {
      grid = feedDownCard();
    } else {
      const filtered = Object.keys(b.clean).length > 0;
      grid = `<div class="card"><div class="empty"><div class="rule"></div>${filtered ? `No upcoming lots match that search. Try fewer filters, or <a href="${esc(b.clearUrl)}" style="color:var(--gold-txt);font-weight:600;text-decoration:underline">clear the filters</a>.` : "No live lots in the feed right now. Check back shortly."}</div></div>`;
    }
    body = `${tabs}${b.chips}<section id="ahxResults" class="ahx-live" aria-label="Live auction results">${b.resultsBar}${grid}${b.pagerHtml}</section>${b.loading}`;
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
    <div class="content">${flash}${b.form}${body}${auctionWatchScript({ request: true, sync: true })}${AUCTION_CSS}${b.css}</div>`;
  return brandShell(portalSidebar(c, "auctions"), main, "Auction search - JDM Connect");
}

// Member requests a lot found via auction search. Files it against a per-client
// "Direct requests" catch-all search so it shows in the admin client page, and
// won't be re-surfaced by the matcher. Returns { ok, lot, already? } | { ok:false }.
export async function requestAuctionLot(env, clientId, lotId) {
  let lot = null;
  try { lot = await fetchLot(env, lotId); } catch (e) {}
  if (!lot || !lot.id) return { ok: false, error: "not_found" };
  // A hammer price means the car already sold (a stats-table record, reachable
  // from Auction History). The UI never offers the bid form on a sold lot, but
  // a replayed/hand-built POST must not queue a bid on a car that's gone.
  if (Number(lot.finish) > 0) return { ok: false, error: "sold" };
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
  if (existing) return { ok: true, already: true, lot, queueId: existing.id };

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

  const ins = await env.DB.prepare(
    "INSERT INTO queue (wishlist_id, client_id, lot_id, lot_json, status, token, reason) VALUES (?, ?, ?, ?, 'pending', ?, 'Added by staff from auction search')"
  ).bind(wishlistId, cid, String(lot.id), JSON.stringify(lot), randomToken()).run();
  try { await env.DB.prepare("INSERT OR IGNORE INTO seen_lots (wishlist_id, lot_id) VALUES (?, ?)").bind(wishlistId, String(lot.id)).run(); } catch (e) {}
  return { ok: true, lot, queueId: ins.meta?.last_row_id };
}

// Bulk form of addLotToClient for the send-selected flow: queue every lot for
// one client and, in send mode, approve them via the same bulk-decision path
// so the client receives ONE combined email. One failure never stops the rest.
export async function addLotsToClient(env, clientId, lotIds, session) {
  const ids = [...new Set((lotIds || []).map(String).filter(Boolean))].slice(0, 40);
  const queued = [];
  let failed = 0;
  for (const lotId of ids) {
    try {
      const r = await addLotToClient(env, clientId, lotId, session);
      if (r.ok && r.queueId) queued.push(Number(r.queueId));
      else if (!r.ok) failed++;
    } catch (e) {
      console.error(`addLotsToClient failed (lot ${lotId}):`, e.message);
      failed++;
    }
  }
  return { queued, failed, requested: ids.length };
}

// A live-auction search result on the admin client page, with an "Add to queue"
// action that files it as a pending match for this client. qsBack preserves the
// current search so the result list survives the add.
// Which of these lot ids are already in a client's queue, and in what state.
// Read-only; returns Map(lot_id -> queue status). Used to badge search-result
// cards so staff can see at a glance what has already been queued or sent.
async function lotQueueStates(env, clientId, lotIds) {
  const out = new Map();
  const ids = [...new Set((lotIds || []).map((x) => String(x)).filter(Boolean))].slice(0, 100);
  if (!ids.length || !clientId) return out;
  try {
    const marks = ids.map(() => "?").join(",");
    const rows = (await env.DB.prepare(
      `SELECT lot_id, status FROM queue WHERE client_id = ? AND lot_id IN (${marks})`
    ).bind(Number(clientId), ...ids).all()).results || [];
    for (const r of rows) out.set(String(r.lot_id), r.status);
  } catch (e) { console.error("lotQueueStates failed:", e.message); }
  return out;
}

// Badge for a lot that is already in a client's queue. `status` is the queue
// row's status; anything already actioned reads as Sent, a live row as Queued.
function queueStateBadge(status, name) {
  if (!status) return "";
  const label = status === "sent" ? `Sent${name ? " to " + esc(name) : ""}`
    : status === "pending" ? `Queued${name ? " for " + esc(name) : ""}`
    : "";
  if (!label) return "";
  // Status is a chip, never gold: sent = good tone, queued = neutral.
  return status === "sent"
    ? `<span class="chip chip-good qbadge">&#10003; ${label}</span>`
    : `<span class="chip muted qbadge">${label}</span>`;
}

// Sticky bottom send bar for the auction-search surfaces (client-page find
// results and the Auctions live tab). Slides up when 1+ result cards are
// selected. "Send N to [name]" queues the lots and approves them through the
// bulk-decision path (ONE combined email); "Queue for review" just queues.
// opts.mode: "fixed" (client known: clientId/clientName/hasContact) or
// "picker" (opts.clients = [{id, name, hasContact}]). opts.back: no-JS return.
function staffSendBar(opts = {}) {
  const picker = opts.mode === "picker";
  const options = picker
    ? (opts.clients || []).map((c) => `<option value="${c.id}" data-contact="${c.hasContact ? 1 : 0}">${esc(c.name)}</option>`).join("")
    : "";
  return `<div class="sendbar" id="sendBar" data-client="${opts.clientId || ""}" data-name="${esc(opts.clientName || "")}" data-contact="${opts.hasContact ? 1 : 0}">
    <span class="sb-count"><b id="sbN">0</b> selected</span>
    ${picker ? `<select id="sbClient" aria-label="Send the selected cars to which client"><option value="">Choose client…</option>${options}</select>` : ""}
    <button type="button" class="btn-primary" id="sbSend">Send to ${esc(opts.clientName || "client")}</button>
    <button type="button" class="btn-secondary" id="sbQueue">Queue for review</button>
  </div>
  <style>
    .selcard{cursor:pointer;position:relative}
    .selcard .fsel{position:absolute;top:12px;right:12px;z-index:3;width:24px;height:24px;margin:0;accent-color:var(--gold);cursor:pointer}
    /* V1.3 Phase B: the tick lives under the grade chip on the photo, clear of
       the heart (top right) and the Add controls in the card foot. */
    .acard.selcard .fsel{top:52px;left:12px;right:auto;bottom:auto}
    .selcard.picked{outline:2px solid var(--gold);outline-offset:2px;border-radius:var(--r-card)}
    /* The floating variant of the ONE action bar family (.actionbar /
       .bulkbar2 / .sendbar): dark card surface on the shared tokens. */
    .sendbar{position:fixed;left:50%;bottom:0;transform:translate(-50%,130%);display:flex;gap:12px;align-items:center;flex-wrap:wrap;justify-content:center;background:var(--card-2,#1C2027);color:#F4F2EC;border:1px solid rgba(255,255,255,.16);border-radius:var(--r-card);padding:12px 16px;padding-bottom:calc(12px + env(safe-area-inset-bottom));margin-bottom:12px;z-index:300;transition:transform .25s cubic-bezier(.2,.8,.2,1);max-width:min(94vw,640px);box-shadow:0 12px 34px rgba(0,0,0,.35)}
    .sendbar.show{transform:translate(-50%,0)}
    .sendbar .sb-count{font-size:var(--fs-sec);font-weight:600;color:#cfd3d8;white-space:nowrap}
    .sendbar .sb-count b{color:var(--on-solid)}
    .sendbar select{background:#1F242B;color:var(--on-solid);border:1px solid rgba(255,255,255,.2);border-radius:var(--r-ctl);padding:8px 28px 8px 12px;font-size:var(--fs-sec);max-width:180px}
    .sendbar button{min-height:44px}
    @media(max-width:640px){.sendbar{left:8px;right:8px;transform:translate(0,130%);max-width:none;margin-bottom:8px}.sendbar.show{transform:translate(0,0)}}
  </style>
  <script>(function(){
    var bar=document.getElementById('sendBar'); if(!bar)return;
    function toast(m,err){if(window.jdmToast){window.jdmToast(m,err);return;}alert(m);}
    function sel(){return [].slice.call(document.querySelectorAll('.selcard.picked'));}
    var pickerEl=document.getElementById('sbClient');
    if(pickerEl){try{var last=sessionStorage.getItem('jdmLastClient');if(last&&pickerEl.querySelector('option[value="'+last+'"]'))pickerEl.value=last;}catch(e){}}
    function clientName(){ if(!pickerEl)return bar.getAttribute('data-name')||''; var o=pickerEl.options[pickerEl.selectedIndex]; return (o&&o.value)?o.textContent:''; }
    function clientId(){ return pickerEl?pickerEl.value:(bar.getAttribute('data-client')||''); }
    function hasContact(){ if(!pickerEl)return bar.getAttribute('data-contact')==='1'; var o=pickerEl.options[pickerEl.selectedIndex]; return !!(o&&o.getAttribute('data-contact')==='1'); }
    function firstName(n){return String(n||'').trim().split(' ')[0]||'client';}
    function upd(){
      var n=sel().length;
      var el=document.getElementById('sbN'); if(el)el.textContent=n;
      var send=document.getElementById('sbSend');
      if(send&&!send.disabled)send.textContent='Send '+n+' to '+firstName(clientName()||'client');
      bar.classList.toggle('show',n>0);
    }
    if(pickerEl)pickerEl.addEventListener('change',upd);
    document.addEventListener('click',function(e){
      var card=e.target&&e.target.closest?e.target.closest('.selcard'):null;
      if(!card)return;
      // V1.3 Phase B: the tick toggles ONLY when the tick itself is clicked.
      if(e.target.classList&&e.target.classList.contains('fsel')){
        card.classList.toggle('picked',e.target.checked);
        upd();
        return;
      }
      if(e.target.closest('a,button,form,select,input,label'))return;
      // Anywhere else on the card that is not a control opens the listing.
      var link=card.querySelector('.ac-name-link,.ac-link');
      if(link&&link.href)window.location.href=link.href;
    });
    function conf(m,go2){if(window.jdmConfirm){window.jdmConfirm(m).then(function(ok){if(ok)go2();});}else if(confirm(m))go2();}
    function go(send){
      var cards=sel();
      if(!cards.length){toast('Select at least one car first',true);return;}
      var cid=clientId();
      if(!cid){toast('Choose a client first',true);if(pickerEl)pickerEl.focus();return;}
      var name=firstName(clientName());
      var n=cards.length;
      if(send){
        var msg=hasContact()
          ? 'This emails '+n+' car'+(n===1?'':'s')+' to '+name+' in one message.'
          : name+' has no email or WhatsApp on file, so sending will mark these handled but nothing will reach them. Continue?';
        conf(msg,function(){run(true,cards,cid,name);});
        return;
      }
      run(false,cards,cid,name);
    }
    function run(send,cards,cid,name){
      var body=new URLSearchParams();
      body.set('client_id',cid); body.set('do',send?'send':'queue'); body.set('ajax','1');
      cards.forEach(function(c){body.append('lot_ids',c.getAttribute('data-lot')||'');});
      var sendBtn=document.getElementById('sbSend'),qBtn=document.getElementById('sbQueue');
      var busy=send?sendBtn:qBtn; var orig=busy?busy.textContent:'';
      if(busy)busy.textContent=send?'Sending…':'Queueing…';
      if(sendBtn)sendBtn.disabled=true; if(qBtn)qBtn.disabled=true;
      fetch('/client/find/bulk',{method:'POST',body:body}).then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(j){
        if(!j||!j.ok)throw 0;
        try{sessionStorage.setItem('jdmLastClient',cid);}catch(e){}
        cards.forEach(function(c){
          c.classList.remove('picked');
          var cb=c.querySelector('.fsel'); if(cb){cb.checked=false;cb.disabled=true;}
          var f2=c.querySelector('form[action="/client/find"]');
          var badge=document.createElement('span');
          badge.className='chip '+(send?'chip-good':'muted');
          badge.textContent=(send?'Sent to ':'Queued for ')+name;
          if(f2&&f2.parentNode)f2.parentNode.replaceChild(badge,f2);
        });
        if(sendBtn)sendBtn.disabled=false; if(qBtn){qBtn.disabled=false;qBtn.textContent='Queue for review';}
        toast(send?('Sent '+j.queued+' to '+name+' in one combined message'):('Queued '+j.queued+' for review'));
        upd();
      }).catch(function(){
        if(sendBtn){sendBtn.disabled=false;}
        if(qBtn){qBtn.disabled=false;}
        if(busy)busy.textContent=orig;
        toast('Could not '+(send?'send':'queue')+' those cars, please try again',true);
        upd();
      });
    }
    var sb=document.getElementById('sbSend'); if(sb)sb.addEventListener('click',function(){go(true);});
    var qb=document.getElementById('sbQueue'); if(qb)qb.addEventListener('click',function(){go(false);});
  })();</script>`;
}

function staffFindCard(lot, clientId, firstName, qsBack, queueState, opts = {}) {
  // Selectable for the bulk send bar unless it has already gone to the client.
  const selectable = queueState !== "sent";
  const img = imageUrls(lot).medium;
  const title = `${esc(lot.year || "")} ${esc(displayName(lot.marka_name))} ${esc(displayName(lot.model_name))}`.replace(/\s+/g, " ").trim() || "Vehicle";
  const bid = Number(lot.start) > 0 ? yen(lot.start) : (Number(lot.avg_price) > 0 ? yen(lot.avg_price) : "-");
  const when = lot.auction_date ? esc(String(lot.auction_date).slice(0, 10)) : "";
  // Deferred landed cost (perf pass 2): render a rough placeholder (local
  // arithmetic, no network) tagged as a fill slot; the page's batched fill
  // swaps in the real calculator figure after first paint. Falls back to any
  // pre-attached lot._landed if a caller still supplies one.
  const clientState = opts.state ? String(opts.state) : "";
  const fx = Number(opts.fx) || 0;
  const jpy = lotJpy(lot);
  const audVal = jpy > 0 && fx > 0 ? Math.round(jpy / fx) : 0;
  const rough = audVal > 0 ? carAudToLanded(audVal) : null;
  const cc = Number(lot.eng_v) > 0 ? Math.round(Number(lot.eng_v)) : 0;
  const landedState = (lot._landed && lot._landed.state) || clientState;
  const landedText = lot._landed
    ? `A$${Number(lot._landed.grandTotal).toLocaleString("en-AU")}`
    : (rough ? `≈A$${rough.toLocaleString("en-AU")}` : "-");
  const landedSlot = jpy > 0
    ? ` data-landed-slot data-lot="${esc(lot.id)}" data-jpy="${esc(String(jpy))}" data-cc="${esc(String(cc))}"`
    : "";
  const landed = jpy > 0 ? landedText : null;
  // Full lot page (gallery, inspection report, market history), carrying the
  // client context so its Add button targets THIS client and Back returns to
  // these results. Before this, staff had to queue a car blind to see more
  // than the hero photo.
  const back = `/admin?view=client&id=${clientId}${qsBack ? "&" + qsBack : ""}#find`;
  const detailHref = `/admin?view=auctionlot&lot=${encodeURIComponent(lot.id)}&client=${clientId}&back=${encodeURIComponent(back)}`;
  const sheet = splitImages(lot).sheet;
  const elig = auctionEligibility(lot);
  const eligChip = `<span class="chip ${elig.cls === "ok" ? "chip-good" : "chip-warn"}" style="margin-top:4px">${esc(elig.label)}</span>`;
  return `<div class="mcard${selectable ? " selcard" : ""}"${selectable ? ` data-lot="${esc(lot.id)}"` : ""}>
    ${selectable ? `<input type="checkbox" class="fsel" aria-label="Select this car for bulk send">` : ""}
    <div class="mphoto" style="${img ? `background-image:url('${esc(img)}')` : ""}">
      <div class="grad"></div>
      <a class="mp-link" href="${esc(detailHref)}" aria-label="View ${title} details"></a>
      <span class="pill lot">Lot ${esc(lot.lot || "-")}</span>
      <div class="ttl"><div class="t"><a href="${esc(detailHref)}">${title}</a></div><div class="a">${esc(lot.auction || "")}${when ? " · " + when : ""}</div></div>
    </div>
    <div class="mstats">
      <div class="s"><div class="k">Year</div><div class="v">${esc(lot.year || "-")}</div></div>
      <div class="s gold"><div class="k">Grade</div><div class="v">${esc(fullGrade(lot))}</div></div>
      <div class="s"><div class="k">Odo</div><div class="v">${lot.mileage ? Math.round(Number(lot.mileage) / 1000) + "k" : "-"}</div></div>
      <div class="s gold"><div class="k">Auction est.</div><div class="v">${bid}</div></div>
    </div>
    ${landed ? `<div class="mland"><span class="ml-k">Est. landed${landedState ? " · " + esc(landedState) : ""}</span><span class="ml-v"${landedSlot}>${landed}</span></div>` : ""}
    <div class="mfoot">
      <div class="who" style="flex:1"><div class="w">${esc(lot.kuzov || "")}</div>${eligChip}</div>
      ${sheet ? `<a class="btn-tertiary" target="_blank" rel="noopener" href="${esc(sheet + "&w=1400")}">Sheet</a>` : ""}
      <a class="btn-tertiary" href="${esc(detailHref)}">Details</a>
      ${(queueState === "pending" || queueState === "sent")
        ? queueStateBadge(queueState, firstName)
        : `<form method="POST" action="/client/find" style="display:inline"><input type="hidden" name="client_id" value="${clientId}"><input type="hidden" name="lot_id" value="${esc(lot.id)}"><input type="hidden" name="q" value="${esc(qsBack)}"><button class="btn-primary btn-sm" type="submit">Add to ${esc(firstName || "queue")}</button></form>`}
    </div>
  </div>`;
}

// Staff Auctions workspace: a standalone live-auction search and a sold-price
// history lookup. Live results carry an "Add to client" picker (reuses the same
// /client/find flow as the in-client search); sold history reuses marketIntel +
// marketPanel. Hits the live feed only when a query is present.
// Time-window choices for the Sold prices lookup. Days feed marketIntel's
// windowDays and searchSold's cutoff; 0 means no date cutoff. The 12-week
// default stays in lockstep with marketIntel's own DEFAULT_WINDOW_DAYS.
const SOLD_WINDOWS = {
  "12w": { days: DEFAULT_WINDOW_DAYS, label: "Last 12 weeks" },
  "6m": { days: 183, label: "Last 6 months" },
  "12m": { days: 366, label: "Last 12 months" },
  all: { days: 0, label: "All time" },
};
// One-tap lookups for the tab's first load, so it never opens blank.
const POPULAR_SOLD_LOOKUPS = [
  ["NISSAN", "SKYLINE"], ["TOYOTA", "SUPRA"], ["TOYOTA", "CHASER"],
  ["MAZDA", "RX-7"], ["TOYOTA", "LAND CRUISER"], ["NISSAN", "SILVIA"],
  ["HONDA", "CIVIC"], ["MITSUBISHI", "LANCER"],
];

export async function adminAuctionsPage(env, session, opts = {}) {
  // "sold" folded into "prices" (one Sold prices tab: averages + the sold
  // lots); the alias keeps old bookmarks and deep links working.
  const requested = opts.tab === "sold" ? "prices" : opts.tab;
  const tab = ["prices", "watch", "history"].includes(requested) ? requested : "live";
  const sp = opts.search || {};
  const layout = sp.layout === "list" ? "list" : "grid";
  const nowYear = new Date().getFullYear();

  // Preserve the active search + layout across tabs and paging. On /admin the
  // `view` param selects the page, so the grid/list toggle uses `layout`.
  // rawQuery carries the multi-selects pre-joined (rates, houses), so the
  // shared filters survive a hop between Live and History.
  const bag = { ...sp, ...(opts.rawQuery || {}) };
  const clean = { view: "auctions" };
  for (const k of ["q", "make", "model", "yearMin", "yearMax", "priceMin", "priceMax", "gradeMin", "grade", "window", "kuzov", "house", "houses", "rates", "variant", "transmission", "drivetrain", "mileageMin", "mileageMax", "engineMin", "engineMax", "body", "fuel", "colour", "eligibility", "sort", "layout"]) {
    const val = String(bag[k] ?? "").trim(); if (val) clean[k] = val;
  }
  // Include-unspecified defaults ON; only the explicit opt-out rides along.
  const uv = [].concat(bag.unspec ?? []).map(String);
  if (uv.length && uv.includes("0") && !uv.includes("1")) clean.unspec = "0";
  const buildUrl = (over) => "/admin?" + new URLSearchParams({ ...clean, ...over }).toString();
  const tabs = auctionTabs(tab, (id) => buildUrl({ tab: id }), { stats: true, history: true });

  // The full-filter Auction History experience, shared with the member page
  // (auction-history.js). Staff sessions are already authenticated, so it
  // carries no membership gate here.
  if (tab === "history") {
    return `${tabs}${await auctionHistoryContent(env, opts.rawQuery || {}, HISTORY_SURFACES.staff)}`;
  }

  // Sold prices: ONE home for sold history. The averages panel (marketIntel)
  // renders on top and the individual sold lots (searchSold) below, both
  // driven by the same filters. Pure JPY - hammer prices, never converted.
  if (tab === "prices") {
    const sv = (k) => esc(sp[k] || "");
    const make = String(sp.make || "").trim();
    const model = String(sp.model || "").trim();
    const windowKey = Object.prototype.hasOwnProperty.call(SOLD_WINDOWS, sp.window) ? sp.window : "12w";
    const windowDays = SOLD_WINDOWS[windowKey].days;
    const page = Math.max(1, parseInt(sp.page, 10) || 1);
    const hasQuery = !!(make && model);

    const [makers, models, grades] = await Promise.all([
      distinctMakers(env),
      make ? distinctModels(env, make) : [],
      hasQuery ? distinctGrades(env, make, model, "").catch(() => []) : [],
    ]);
    const dl = (id, list) => `<datalist id="${id}">${(list || []).map((x) => `<option value="${esc(x)}">`).join("")}</datalist>`;
    const datalists = dl("auc-makers", makers) + dl("auc-models", models) + dl("auc-grades", grades);

    // One filter set drives both halves. kuzov has no field on this tab but
    // can arrive preserved from a Live / Auction History link; passing it to
    // both keeps the averages and the sold lots over the same population.
    const filters = { yearMin: sp.yearMin, yearMax: sp.yearMax, grade: sp.grade, kuzov: sp.kuzov };
    const [m, soldRes] = await Promise.all([
      hasQuery
        ? marketIntel(env, make, model, Date.now(), { ...filters, windowDays }).catch(() => null)
        : null,
      searchSold(env, hasQuery ? { make, model, ...filters, windowDays, page } : { page }),
    ]);

    const windowOpts = Object.entries(SOLD_WINDOWS)
      .map(([k, w]) => `<option value="${k}"${k === windowKey ? " selected" : ""}>${w.label}</option>`).join("");
    const form = `<div class="card">
      <form method="GET" action="/admin">
        <input type="hidden" name="view" value="auctions"><input type="hidden" name="tab" value="prices">
        <div class="grid">
          <div><label>Make<input name="make" list="auc-makers" value="${sv("make")}" placeholder="e.g. NISSAN" autocomplete="off" required></label></div>
          <div><label>Model<input name="model" list="auc-models" value="${sv("model")}" placeholder="e.g. SKYLINE" autocomplete="off" required></label></div>
          <div><label>Grade / trim <span class="opt">(optional)</span><input name="grade" list="auc-grades" value="${sv("grade")}" placeholder="e.g. GT-R" autocomplete="off"></label></div>
          <div><label>Year from<input name="yearMin" type="number" min="1960" max="2100" value="${sv("yearMin")}" placeholder="1995"></label></div>
          <div><label>Year to<input name="yearMax" type="number" min="1960" max="2100" value="${sv("yearMax")}" placeholder="2002"></label></div>
          <div><label>Sold within<select name="window">${windowOpts}</select></label></div>
        </div>
        <div class="actions"><button class="btn-primary" type="submit">Show sold prices</button>
          <span class="help">Average, median, range and trend for the filters above, with every matching sold car below. Prices are JPY hammer prices.</span></div>
      </form>${datalists}
      <script>(function(){
        var card=document.currentScript.closest(".card"),f=card?card.querySelector("form"):null;if(!f)return;
        var mk=f.querySelector('input[name="make"]'),dlm=document.getElementById("auc-models");
        if(!mk||!dlm)return;
        mk.addEventListener("change",function(){
          dlm.innerHTML="";if(!mk.value)return;
          fetch("/api/models?maker="+encodeURIComponent(mk.value)).then(function(r){return r.json();}).then(function(list){
            (list||[]).forEach(function(x){var o=document.createElement("option");o.value=x;dlm.appendChild(o);});
          }).catch(function(){});
        });
      })();</script>
    </div>`;

    // First load: one-tap popular lookups instead of a blank page.
    const chips = hasQuery ? "" : `<div class="spx-pop"><span class="spx-pop-k">Popular lookups</span>${POPULAR_SOLD_LOOKUPS.map(([pmk, pmd]) =>
      `<a class="chip" href="${esc(buildUrl({ tab: "prices", make: pmk, model: pmd }))}">${esc(displayName(pmk))} ${esc(displayName(pmd))}</a>`).join("")}</div>`;

    // Averages panel, gated on marketIntel's OWN outcome (a separate feed
    // call from the sold-lot browse): a real panel renders whenever it has
    // data, even if searchSold happened to fail. The "no sold records"
    // empty-state only shows when marketIntel actually returned zero, not on
    // an outage - so a relay failure never reads as "no sold records"
    // (launch-audit rule). m === null means marketIntel itself threw/timed out.
    let intel = "";
    if (hasQuery) {
      intel = (m && m.count)
        ? marketPanel(m)
        : (m /* succeeded with zero rows */
          ? `<div class="card"><div class="empty"><div class="rule"></div>No sold records for ${esc(displayName(make))} ${esc(displayName(model))}${sp.grade ? " (" + sv("grade") + ")" : ""} with those filters yet. Try a wider year range or time window, or a broader model name.</div></div>`
          : "");
    }

    // The matching sold lots, newest first (site-wide latest on first load).
    const { lots, hasMore, ok } = soldRes;
    const toolbar = auctionToolbar({ count: lots.length, hasMore, page, view: layout, viewHref: (mode) => buildUrl({ tab: "prices", layout: mode }), label: hasQuery ? "Sold at auction" : "Latest sold results", feedDown: !ok });
    const findLive = (lot) => `<a class="btn-secondary btn-sm ac-req" href="/admin?${new URLSearchParams({ view: "auctions", tab: "live", make: lot.marka_name || "", model: lot.model_name || "" }).toString()}">Find live</a>`;
    let grid;
    if (lots.length) {
      grid = `<div class="acgrid${layout === "list" ? " list" : ""}">${lots.map((lot) => auctionCardV2(lot, { nowYear, soldPrice: Number(lot.finish) || 0, actions: findLive(lot), detailBase: "/admin?view=auctionlot&lot=" })).join("")}</div>`;
    } else if (!ok) {
      grid = feedDownCard();
    } else {
      grid = `<div class="card"><div class="empty"><div class="rule"></div>${hasQuery ? `No individual sold lots match those filters. Try a wider year range or time window, or <a href="/admin?view=auctions&tab=prices" style="color:var(--gold-txt);font-weight:600;text-decoration:underline">clear the filters</a>.` : "No sold results to show right now. Check back shortly."}</div></div>`;
    }
    const prev = page > 1 ? `<a class="btn-secondary" href="${esc(buildUrl({ tab: "prices", page: page - 1 }))}">&larr; More recent</a>` : "";
    const next = hasMore ? `<a class="btn-secondary" href="${esc(buildUrl({ tab: "prices", page: page + 1 }))}">Older &rarr;</a>` : "";
    const pager = (prev || next) ? `<div style="display:flex;gap:8px;justify-content:center;margin-top:24px">${prev}${next}</div>` : "";
    return `${tabs}${form}${chips}${intel}${toolbar}${grid}${pager}${AUCTION_CSS}`;
  }

  // Live and Watchlist share the filter panel: the History engine runs both
  // Live tabs now (Phase 1), so filters and results match everywhere. This
  // page keeps the tabs, cards, add-to-client picker and send bar.
  const topBar = `<div class="ahx-top"><span class="ahx-toplabel">Search live Japanese auctions</span><span class="ahx-counts">Watchlist <b data-watch-count>0</b></span></div>`;
  const [b, fx] = await Promise.all([
    liveSearchBlock(env, opts.rawQuery || sp, "staff", {
      extras: layout === "list" ? { layout: "list" } : {},
      topBar,
      viewParam: "layout",
      viewMode: layout,
      skipSearch: tab === "watch",
    }),
    getLiveFx(env).catch(() => 0),
  ]);

  if (tab === "watch") {
    return `${b.form}${tabs}<div id="watchGrid" class="acgrid"></div>${auctionWatchScript({ request: false })}${AUCTION_CSS}${b.css}`;
  }

  const acc = accessScope(session);
  const cstmt = env.DB.prepare(`SELECT id, name, email, whatsapp FROM clients c WHERE ${acc.sql} ORDER BY name`);
  const clients = ((await (acc.binds.length ? cstmt.bind(...acc.binds) : cstmt).all()).results) || [];
  const options = clients.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");

  const { lots, ok } = b.r;
  // IA-AUDIT item 15: the live feed reads closing soonest first, mirroring
  // Matches (within the fetched page; dateless lots sink to the end). The
  // engine already orders by the selected sort; this only settles dateless
  // rows under the default closing sort.
  if (b.p.sort === "closing") {
    lots.sort((x, y) => (tsMs(x.auction_date) || Infinity) - (tsMs(y.auction_date) || Infinity));
  }
  const back = b.urlFor({}); // return to this exact page after adding

  // Which of these lots are already queued for one of this session's clients?
  // A Queued / Sent badge on the card stops the add-reload-duplicate loop.
  const queuedByLot = new Map();
  try {
    const ids = [...new Set(lots.map((l) => String(l.id)).filter(Boolean))].slice(0, 100);
    if (ids.length) {
      const marks = ids.map(() => "?").join(",");
      const qstmt = env.DB.prepare(
        `SELECT q.lot_id, q.status, c.name AS client_name FROM queue q JOIN clients c ON c.id = q.client_id WHERE q.lot_id IN (${marks}) AND ${acc.sql}`
      ).bind(...ids, ...acc.binds);
      const rows = (await qstmt.all()).results || [];
      for (const r of rows) {
        if (!queuedByLot.has(String(r.lot_id)) || r.status === "sent") queuedByLot.set(String(r.lot_id), r);
      }
    }
  } catch (e) { console.error("auction queue badges failed:", e.message); }

  const pickerFor = (lot) => {
    const q = queuedByLot.get(String(lot.id));
    const badge = (q && (q.status === "pending" || q.status === "sent"))
      ? queueStateBadge(q.status, String(q.client_name || "").trim().split(/\s+/)[0])
      : "";
    return clients.length
      ? `${badge}<form method="POST" action="/client/find" class="ac-picker"><input type="hidden" name="lot_id" value="${esc(lot.id)}"><input type="hidden" name="back" value="${esc(back)}"><select name="client_id" required aria-label="Add this car to a client"><option value="">Add to client...</option>${options}</select><button class="btn-secondary btn-sm" type="submit">Add</button></form>`
      : `<span class="help">Add a client first to queue cars.</span>`;
  };

  // Remember the last client a lot was added to (this tab only, client-side) and
  // default every picker to them, so queueing a run of cars is one tap each.
  const lastClientScript = `<script>(function(){var KEY='jdmLastClient';
    document.addEventListener('submit',function(e){var f=e.target;if(!f||!f.classList||!f.classList.contains('ac-picker'))return;var s=f.querySelector('select[name=client_id]');if(s&&s.value){try{sessionStorage.setItem(KEY,s.value);}catch(err){}}},true);
    try{var v=sessionStorage.getItem(KEY);if(v){[].slice.call(document.querySelectorAll('.ac-picker select[name=client_id]')).forEach(function(s){if(!s.value&&s.querySelector('option[value="'+v+'"]'))s.value=v;});}}catch(e){}
  })();</script>`;

  let grid;
  if (lots.length) {
    // Cards are selectable (checkbox + tap outside the links) so a run of cars
    // can go to one client via the sticky send bar in one combined email.
    const selectable = (lot) => {
      const q = queuedByLot.get(String(lot.id));
      return clients.length > 0 && !(q && q.status === "sent");
    };
    grid = `<div class="acgrid${layout === "list" ? " list" : ""}">${lots.map((lot) => auctionCardV2(lot, { fx, nowYear, actions: pickerFor(lot), detailBase: "/admin?view=auctionlot&lot=", select: selectable(lot) })).join("")}</div>`;
  } else if (!ok) {
    grid = feedDownCard();
  } else {
    const filtered = Object.keys(b.clean).length > 0;
    grid = `<div class="card"><div class="empty"><div class="rule"></div>${filtered ? `No upcoming lots match that search. Try fewer filters, or <a href="${esc(b.clearUrl)}" style="color:var(--gold-txt);font-weight:600;text-decoration:underline">clear the filters</a>.` : "No live lots in the feed right now. Check back shortly."}</div></div>`;
  }
  const flash = opts.found === "added" ? `<div class="flash">Added to the client's review queue. It's under their Live matches, ready to Approve and send.</div>`
    : opts.found === "dup" ? `<div class="dupnote">That car is already in that client's queue.</div>`
    : opts.found === "err" ? `<div class="dupnote">Sorry, we couldn't add that lot. Please try again.</div>` : "";
  const sendBar = clients.length
    ? staffSendBar({ mode: "picker", clients: clients.map((c) => ({ id: c.id, name: c.name, hasContact: !!(c.email || c.whatsapp) })) })
    : "";
  return `${flash}${watchAlertBlock(b.urlFor({ tab: "watch" }))}${b.form}${tabs}${b.chips}<section id="ahxResults" class="ahx-live" aria-label="Live auction results">${b.resultsBar}${grid}${b.pagerHtml}</section>${b.loading}${auctionWatchScript({ request: false })}${lastClientScript}${sendBar}${AUCTION_CSS}${b.css}`;
}

// Admin: flip a client's paid-member flag (gates the auction page).
export async function setClientMember(env, clientId, on, session) {
  const id = Number(clientId);
  if (!Number.isInteger(id) || id <= 0) return;
  // Admin only (defence in depth alongside the route guard): membership is a
  // paid feature, the Stripe webhook is the only other writer of this flag.
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
    ? `<form method="POST" action="/portal/pay" style="display:inline"><input type="hidden" name="queue_id" value="${q.id}"><button class="btn-secondary" type="submit">Pay ${esc(opts.depositLabel)} deposit</button></form>`
    : "";
  const action = requested
    ? `<span class="reqbadge">&#10003; Requested - we're on it</span>`
    : `<form method="POST" action="/portal/approve" style="display:inline"><input type="hidden" name="queue_id" value="${q.id}"><button class="btn-primary btn-sm" type="submit">Ask us to get this</button></form>`;
  return `<div class="mcard">
    <div class="mphoto" style="${img ? `background-image:url('${esc(img)}')` : ""}">
      ${q._href ? `<a href="${esc(q._href)}" aria-label="View this car's full listing" style="position:absolute;inset:0;z-index:1"></a>` : ""}
      <div class="grad"></div>
      <span class="pill lot">Lot ${esc(lot.lot || "-")}</span>
      <div class="ttl"><div class="t">${q._href ? `<a href="${esc(q._href)}" style="color:inherit;text-decoration:none">${title}</a>` : title}</div><div class="a">${esc(lot.auction || "")}${lot.auction_date ? " · " + esc((lot.auction_date || "").slice(0, 10)) : ""}</div></div>
    </div>
    <div class="mstats">
      <div class="s"><div class="k">Year</div><div class="v">${esc(lot.year || "-")}</div></div>
      <div class="s gold"><div class="k">Grade</div><div class="v">${esc(fullGrade(lot))}</div></div>
      <div class="s"><div class="k">Odometer</div><div class="v">${lot.mileage ? Math.round(Number(lot.mileage) / 1000) + "k" : "-"}</div></div>
      <div class="s gold"><div class="k">Auction est.</div><div class="v">${bid}</div></div>
    </div>
    ${chips.length ? `<div class="why">${chips.map((cc) => `<span class="wc">${cc}</span>`).join("")}</div>` : ""}
    ${landed ? `<div class="mland"><span class="ml-k">Indicative landed · ${esc(q._landed.state)}</span><span class="ml-v">${landed}</span></div>` : ""}
    ${mktAvg}
    <div class="mfoot">
      <div class="who" style="flex:1"><div class="w">${esc(q.wlabel || "Your search")}</div></div>
      ${q._href ? `<button type="button" class="btn-tertiary btn-sm mshare" data-href="${esc(q._href)}" data-title="${esc(title)}">Share</button>` : ""}
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
      <div class="s gold"><div class="k">Grade</div><div class="v">${esc(fullGrade(lot))}</div></div>
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
      `<div class="topbar"><div><div class="kicker">Buyer portal</div><h1>Access ended</h1></div><a class="btn-secondary" href="/logout">Sign out</a></div>
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

  // V1.3 Phase C: every match card links through to the read-only listing
  // detail (the same signed view-only page the Share button produces), so a
  // buyer can open the full gallery and specs from their garage. A revoked
  // share link gets no href at all (the card still renders, just not linked).
  for (const q of cars) {
    if (q.share_revoked_at) continue;
    try { q._href = `/v?t=${await makeShareToken(env, q.id, q.share_nonce || null)}`; } catch (e) { /* card still renders */ }
  }
  // Members can pass their matched car around (partner, mate, group chat) with
  // the same view-only link staff share: native share sheet where available,
  // clipboard copy otherwise.
  const memberShareScript = `<script>(function(){document.querySelectorAll('.mshare').forEach(function(b){b.addEventListener('click',function(){var url=location.origin+b.getAttribute('data-href');var title=b.getAttribute('data-title')||'Vehicle';if(navigator.share){navigator.share({title:title,text:title,url:url}).catch(function(){});}else if(navigator.clipboard){navigator.clipboard.writeText(url).then(function(){var t=b.textContent;b.textContent='Link copied';setTimeout(function(){b.textContent=t;},1500);});}});});})();</script>`;
  const carsBody = cars.length
    ? `<div class="mgrid">${cars.map((q) => clientCarCard(q, cardOpts)).join("")}</div>${memberShareScript}`
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
        <div><label>Model${modelField("pl-models")}</label></div>
        <div><label>Year from<input name="year_min" type="number" min="1960" max="${yMax}" placeholder="1990"></label></div>
        <div><label>Year to<input name="year_max" type="number" min="1960" max="${yMax}" placeholder="2002"></label></div>
        <div><label>Max budget (JPY)<input name="price_max" type="number" min="0" step="any" placeholder="3,000,000"></label></div>
        <div><label>Min mileage (km)<input name="mileage_min" type="number" min="0" step="any" placeholder="0"></label></div>
        <div><label>Max mileage (km)<input name="mileage_max" type="number" min="0" step="any" placeholder="100,000"></label></div>
        <div><label>Min grade<input name="rate_min" type="number" min="1" max="6" step="any" placeholder="e.g. 4"></label></div>
        <div><label>Chassis code <span class="opt">(if known)</span><input name="kuzov" placeholder="e.g. JZA80"></label></div>
        <div><label for="pl-code">Model code <span class="opt">(exact variant)</span></label><select id="pl-code" name="model_code"><option value="">Any model code</option></select></div>
        <div><label for="pl-grades">Grades <span class="opt">(pick every spelling)</span></label><select id="pl-grades" name="grades" multiple size="4"></select></div>
      </div>
      <div class="actions"><button class="btn-primary" type="submit">Add search</button>
        <span class="help">Add at least a make, model or chassis code so we know what to look for.</span></div>
    </form>${modelScript("pl-maker", "pl-models")}${codeGradeScript("pl-maker", "pl-models", "pl-code", "pl-grades")}${presetScript()}
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
        ${c.stripe_customer_id ? `<form method="POST" action="/portal/billing"><button class="btn-secondary" type="submit">Manage billing</button></form>` : ""}
      </div>`
    : membershipOn
    ? `<div class="memcard">
        <div class="mem-main"><div class="mem-tag">Upgrade</div><div class="mem-h">Full access - ${memberPrice}/month</div><div class="mem-s">Unlimited active searches, priority sourcing, and a landed-cost estimate on every car. Cancel anytime.</div></div>
        <form method="POST" action="/portal/subscribe"><button class="btn-primary" type="submit">Get full access</button></form>
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
      <a class="btn-secondary" href="/logout">Sign out</a>
    </div>
    <div class="content">
      ${flash}
      ${statsRow}
      ${memberCard}
      <div class="psec"><h2>Cars we've found for you${cars.length ? ` <span class="ct">${cars.length}</span>` : ""}</h2><p class="psub">Hand-reviewed by our team and matched to your search. Tap “Ask us to get this” and we'll pull the auction sheet, translate it, and come back to you${stripeOn ? " with next steps" : ""}.</p></div>
      ${carsBody}
      <div class="psec" style="margin-top:32px"><h2>What you're searching for${wls.length ? ` <span class="ct">${activeSearches}/${wls.length}</span>` : ""}</h2><p class="psub">Edit a search or add another - changes apply on the next auction sweep.</p></div>
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
  if (!cid || !(await portalClientActive(env, cid))) return { ok: false };
  const marka = sstr(form, "marka_name"), model = sstr(form, "model_name");
  const kuzov = sstr(form, "kuzov"), gradeKw = sstr(form, "grade_kw");
  const modelCode = sstr(form, "model_code", FIELD_MAX.kuzov);
  if (!(marka || model || kuzov || gradeKw || modelCode)) return { ok: false, error: "term" }; // need something to search on
  // V1.3 Phase C: free accounts get a configurable number of ACTIVE saved
  // searches (Settings -> free_search_limit, default 1). Members keep the
  // general anti-fanout cap only. Enforced here, server side, so a hand-built
  // POST can't bypass the portal UI.
  const active = await activeWishlistCount(env, cid);
  const me = await env.DB.prepare("SELECT member FROM clients WHERE id = ?").bind(cid).first();
  if (!(me && me.member)) {
    const settings = await getSettings(env);
    const freeLimit = settingNum(settings, "free_search_limit", 1);
    if (active >= freeLimit) return { ok: false, error: "free_limit" };
  }
  if (active >= WISHLIST_ACTIVE_CAP) return { ok: false, error: "limit" };
  const { yMin, yMax } = yearPair(form);
  await insertWishlistDrift(env, [
    ["client_id", cid], ["label", sstr(form, "label")], ["marka_name", marka], ["model_name", model],
    ["year_min", yMin], ["year_max", yMax], ["price_max", sint(form, "price_max", PRICE_MAX_CAP)],
    ["mileage_max", sint(form, "mileage_max", MILEAGE_MAX_CAP)], ["mileage_min", sint(form, "mileage_min", MILEAGE_MAX_CAP)], ["rate_min", clampRange(num(form, "rate_min"), 1, 6)],
    ["kuzov", kuzov], ["grade_kw", gradeKw], ["watch_only", 0], ["needs_detail", 0],
    ["model_code", modelCode], ["grades", sgrades(form)],
  ]);
  return { ok: true };
}

export async function portalEditWishlist(env, form, session) {
  const cid = Number(session.id);
  if (!(await portalClientActive(env, cid))) return { ok: false };
  const w = await portalWishlistOwned(env, form.get("id"), cid);
  if (!w) return { ok: false };
  const marka = sstr(form, "marka_name"), model = sstr(form, "model_name");
  const kuzov = sstr(form, "kuzov"), gradeKw = sstr(form, "grade_kw");
  const modelCode = sstr(form, "model_code", FIELD_MAX.kuzov);
  // Same server-side rule as portalAddWishlist: an edit can't blank every
  // narrowing term and leave a match-everything search behind (V1.3).
  if (!(marka || model || kuzov || gradeKw || modelCode)) return { ok: false, error: "term" };
  const { yMin, yMax } = yearPair(form);
  await updateWishlistDrift(env, [
    ["label", sstr(form, "label")], ["marka_name", marka], ["model_name", model],
    ["year_min", yMin], ["year_max", yMax], ["price_max", sint(form, "price_max", PRICE_MAX_CAP)],
    ["mileage_max", sint(form, "mileage_max", MILEAGE_MAX_CAP)], ["mileage_min", sint(form, "mileage_min", MILEAGE_MAX_CAP)], ["rate_min", clampRange(num(form, "rate_min"), 1, 6)],
    ["kuzov", kuzov], ["grade_kw", gradeKw],
    ["model_code", modelCode], ["grades", sgrades(form)],
  ], "WHERE id = ? AND client_id = ?", [w.id, cid]);
  return { ok: true };
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
    await env.DB.prepare("UPDATE queue SET client_request = 1, client_request_at = datetime('now'), response = 'interested' WHERE id = ? AND client_id = ?").bind(qid, cid).run();
    // V1.3 Phase C: an interested tap must surface on the admin Requests page
    // in real time, not just on the customer profile. Advance the parent
    // request to 'interested' (never regress a request that's already further
    // along) and bump last_activity so it sorts to the top; log the activity
    // so the profile timeline shows it in both directions.
    if (item.wishlist_id) {
      await env.DB.prepare(
        `UPDATE wishlists SET
            status = CASE WHEN COALESCE(status,'new') IN ('new','qualified','searching','vehicles_sent') THEN 'interested' ELSE status END,
            last_activity = datetime('now')
          WHERE id = ? AND client_id = ?`
      ).bind(item.wishlist_id, cid).run();
    }
    try {
      let lotT = {}; try { lotT = JSON.parse(item.lot_json); } catch (e2) {}
      const title = [lotT.year, lotT.marka_name, lotT.model_name].filter(Boolean).join(" ") || `lot ${item.lot_id}`;
      await logActivity(env, { wishlist_id: item.wishlist_id, client_id: cid, type: "note", detail: `Client asked us to get: ${title}`, actor: "Portal" });
    } catch (e2) { /* timeline is best effort */ }
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
  await env.DB.prepare("UPDATE clients SET portal_enabled = 1, portal_revoked = 0, invite_token = ?, invite_exp = ? WHERE id = ?").bind(await hashToken(token), exp, cid).run();
  return { ok: true, token, email: c.email, name: c.name };
}

export async function revokeClientPortal(env, clientId, session) {
  const cid = Number(clientId);
  if (!Number.isInteger(cid) || cid <= 0) return;
  if (!(await clientOwnedBy(env, cid, session))) return;
  // portal_revoked = 1 is the durable staff veto: without it, Google sign-in
  // and request-form self-signup would silently re-enable this client.
  // Bump session_ver so any cookie the client still holds stops validating now.
  // Falls back to the legacy update if migration 0010 is not applied yet.
  await runWithSessionVerFallback(env,
    "UPDATE clients SET portal_enabled = 0, portal_revoked = 1, pass_salt = NULL, pass_hash = NULL, invite_token = NULL, invite_exp = NULL, session_ver = session_ver + 1 WHERE id = ?",
    "UPDATE clients SET portal_enabled = 0, portal_revoked = 1, pass_salt = NULL, pass_hash = NULL, invite_token = NULL, invite_exp = NULL WHERE id = ?",
    [cid], "revokeClientPortal");
}

// ============================================================================
// DEALER SYSTEM - separate login for vehicle suppliers (sellers).
// Dealers submit vehicles → admin reviews → approved vehicles go live.
// ============================================================================

// Create a dealer account (admin only). Returns {ok, error?, token?, email?, name?}
export async function createDealer(env, form) {
  const name = String(form.get("name") || "").trim();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const company = String(form.get("company") || "").trim() || null;
  const state = String(form.get("state") || "").trim() || null;
  if (!name || !email) return { ok: false, error: "missing fields" };
  const token = randomToken();
  const exp = Date.now() + INVITE_TTL_MS;
  try {
    await env.DB.prepare(
      "INSERT INTO dealers (email, name, company, state, pass_salt, pass_hash, invite_token, invite_exp) VALUES (?, ?, ?, ?, '', '', ?, ?)"
    ).bind(email, name, company, state, await hashToken(token), exp).run();
    return { ok: true, token, email, name };
  } catch (e) {
    console.error("createDealer failed:", e.message);
    return { ok: false, error: "email already in use" };
  }
}

// Re-issue invite / set-password link for a dealer (admin only).
export async function resendDealerInvite(env, id) {
  const d = await env.DB.prepare("SELECT id, name, email FROM dealers WHERE id = ?").bind(Number(id)).first();
  if (!d) return null;
  const token = randomToken();
  const exp = Date.now() + INVITE_TTL_MS;
  await env.DB.prepare("UPDATE dealers SET invite_token = ?, invite_exp = ? WHERE id = ?").bind(await hashToken(token), exp, d.id).run();
  return { token, email: d.email, name: d.name };
}

// Toggle dealer active/inactive status (admin only).
export async function toggleDealer(env, id) {
  const did = Number(id);
  if (!Number.isInteger(did) || did <= 0) return;
  await env.DB.prepare("UPDATE dealers SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END WHERE id = ?").bind(did).run();
}

// Delete a dealer and all their vehicle submissions (admin only).
export async function deleteDealer(env, id) {
  const did = Number(id);
  if (!Number.isInteger(did) || did <= 0) return;
  const stmts = [
    env.DB.prepare("DELETE FROM dealer_vehicles WHERE dealer_id = ?").bind(did),
    env.DB.prepare("DELETE FROM dealers WHERE id = ?").bind(did),
  ];
  await env.DB.batch(stmts);
}

// Server-side caps/ranges for a dealer vehicle submission. Client-side maxlength
// and min/max are advisory only, so every field is re-validated here regardless
// of what a hand-built POST sends. Text is length-capped; numerics are held to a
// sane range for a real, roadworthy car so junk or overflow can't be stored.
export const DEALER_VEHICLE_LIMITS = {
  make: 60, model: 60, grade: 40, location: 120, description: 2000,
  yearMin: 1950, yearMax: 2035,      // classics through near-future model years
  mileageMax: 2000000,               // km
  priceMin: 1, priceMax: 100000000,  // AUD
};

// Dealer submits a vehicle for admin review. Returns {ok, error?, id?, vehicle?}.
// `error` is a friendly, display-ready sentence (surfaced in the portal flash).
export async function submitDealerVehicle(env, form, session) {
  if (!session || session.role !== "dealer") return { ok: false, error: "You are not signed in as a dealer." };
  const dealer = await env.DB.prepare("SELECT id FROM dealers WHERE id = ? AND active = 1").bind(session.id).first();
  if (!dealer) return { ok: false, error: "Your dealer account is inactive. Please contact JDM Connect." };

  const L = DEALER_VEHICLE_LIMITS;
  const make = String(form.get("make") || "").trim();
  const model = String(form.get("model") || "").trim();
  // Required text.
  if (!make) return { ok: false, error: "Make is required." };
  if (!model) return { ok: false, error: "Model is required." };
  if (make.length > L.make) return { ok: false, error: `Make must be ${L.make} characters or fewer.` };
  if (model.length > L.model) return { ok: false, error: `Model must be ${L.model} characters or fewer.` };

  // Optional text: clip-and-cap. Empty stores as null.
  const grade = String(form.get("grade") || "").trim();
  if (grade.length > L.grade) return { ok: false, error: `Grade must be ${L.grade} characters or fewer.` };
  const location = String(form.get("location") || "").trim();
  if (location.length > L.location) return { ok: false, error: `Location must be ${L.location} characters or fewer.` };
  const description = String(form.get("description") || "").trim();
  if (description.length > L.description) return { ok: false, error: `Description must be ${L.description} characters or fewer.` };

  // Price is required and must land in a sane AUD range.
  const priceRaw = String(form.get("price_aud") || "").trim().replace(/[,\s$]/g, "");
  const price = Number(priceRaw);
  if (!priceRaw || !Number.isFinite(price) || !Number.isInteger(price) || price < L.priceMin || price > L.priceMax) {
    return { ok: false, error: "Please enter a valid price in AUD." };
  }

  // Year is optional; when given it must be a real 4-digit model year.
  const yearRaw = String(form.get("year") || "").trim();
  let year = null;
  if (yearRaw) {
    const y = Number(yearRaw);
    if (!/^\d{4}$/.test(yearRaw) || y < L.yearMin || y > L.yearMax) {
      return { ok: false, error: `Year must be between ${L.yearMin} and ${L.yearMax}.` };
    }
    year = y;
  }

  // Mileage is optional; when given it must be a non-negative km value under the cap.
  const mileageRaw = String(form.get("mileage_km") || "").trim().replace(/[,\s]/g, "");
  let mileage = null;
  if (mileageRaw) {
    const m = Number(mileageRaw);
    if (!Number.isFinite(m) || !Number.isInteger(m) || m < 0 || m > L.mileageMax) {
      return { ok: false, error: `Mileage must be a whole number of km between 0 and ${L.mileageMax.toLocaleString()}.` };
    }
    mileage = m;
  }

  try {
    const photos = form.get("photos") || "[]"; // JSON array
    const result = await env.DB.prepare(
      "INSERT INTO dealer_vehicles (dealer_id, make, model, year, grade, mileage_km, price_aud, location, description, photos, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')"
    ).bind(session.id, make, model, year, grade || null, mileage, price, location || null, description || null, photos).run();

    return {
      ok: true,
      id: result.meta.last_row_id,
      vehicle: { make, model, year, price, status: "pending" },
    };
  } catch (e) {
    console.error("submitDealerVehicle failed:", e.message);
    return { ok: false, error: "Sorry, we couldn't save that vehicle. Please try again." };
  }
}

// Admin approves a dealer vehicle submission.
export async function approveDealerVehicle(env, vehicleId, session) {
  if (!session || session.role !== "admin") return { ok: false, error: "unauthorized" };
  const vid = Number(vehicleId);
  if (!Number.isInteger(vid) || vid <= 0) return { ok: false, error: "invalid id" };

  try {
    await env.DB.prepare(
      "UPDATE dealer_vehicles SET status = 'approved', approved_at = datetime('now'), approved_by = ? WHERE id = ?"
    ).bind(0, vid).run();
    return { ok: true };
  } catch (e) {
    console.error("approveDealerVehicle failed:", e.message);
    return { ok: false, error: "database error" };
  }
}

// Admin rejects a dealer vehicle submission.
export async function rejectDealerVehicle(env, vehicleId, notes, session) {
  if (!session || session.role !== "admin") return { ok: false, error: "unauthorized" };
  const vid = Number(vehicleId);
  if (!Number.isInteger(vid) || vid <= 0) return { ok: false, error: "invalid id" };

  try {
    const adminNotes = String(notes || "").trim();
    await env.DB.prepare(
      "UPDATE dealer_vehicles SET status = 'rejected', admin_notes = ? WHERE id = ?"
    ).bind(adminNotes, vid).run();
    return { ok: true };
  } catch (e) {
    console.error("rejectDealerVehicle failed:", e.message);
    return { ok: false, error: "database error" };
  }
}

// Get dealer vehicle submissions for admin review, optionally filtered by status.
export async function getDealerVehicleSubmissions(env, status = null, limit = 100, offset = 0) {
  try {
    let sql = "SELECT dv.*, d.name as dealer_name, d.company as dealer_company, d.email as dealer_email FROM dealer_vehicles dv JOIN dealers d ON dv.dealer_id = d.id";
    const binds = [];
    if (status && status !== "all") {
      sql += " WHERE dv.status = ?";
      binds.push(status);
    }
    sql += " ORDER BY dv.created_at DESC LIMIT ? OFFSET ?";
    binds.push(limit, offset);
    const result = await env.DB.prepare(sql).bind(...binds).all();
    return result.results || [];
  } catch (e) {
    console.error("getDealerVehicleSubmissions failed:", e.message);
    return [];
  }
}

// Get a specific dealer's vehicle submissions.
export async function getDealerVehicles(env, dealerId, status = "pending") {
  try {
    let sql = "SELECT * FROM dealer_vehicles WHERE dealer_id = ?";
    const binds = [dealerId];
    if (status && status !== "all") {
      sql += " AND status = ?";
      binds.push(status);
    }
    sql += " ORDER BY created_at DESC";
    const result = await env.DB.prepare(sql).bind(...binds).all();
    return result.results || [];
  } catch (e) {
    console.error("getDealerVehicles failed:", e.message);
    return [];
  }
}

// ============================================================================
// DEALER UI PAGES - rendering functions for dealer portal and admin views
// ============================================================================

// Dealer portal page: vehicle submission form + list of dealer's submissions
export async function dealerPortalPage(env, dealer, flash = "") {
  const submissions = await getDealerVehicles(env, dealer.id, "all");
  const first = (dealer.name || "").split(/\s+/)[0];
  const side = dealerSidebar(dealer, "stock");
  const badge = (status) => status === "approved" ? `<span class="chip chip-good">Approved</span>`
    : status === "rejected" ? `<span class="chip chip-bad">Rejected</span>`
    : `<span class="chip chip-warn">Pending review</span>`;
  const list = submissions.length ? submissions.map((v) => `<article class="card dealer-own-card"><div class="dealer-own-head"><div><h3>${esc(v.make)} ${esc(v.model)}${v.year ? ` (${v.year})` : ""}</h3><p>${v.created_at ? `Submitted ${esc(new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(new Date(v.created_at)))}` : ""}</p></div>${badge(v.status)}</div><div class="dealer-own-meta"><strong>A$${Number(v.price_aud || 0).toLocaleString("en-AU")}</strong>${v.mileage_km ? `<span>${Number(v.mileage_km).toLocaleString("en-AU")} km</span>` : ""}${v.location ? `<span>${esc(v.location)}</span>` : ""}</div>${v.admin_notes ? `<p class="reqerr"><strong>Review note:</strong> ${esc(v.admin_notes)}</p>` : ""}</article>`).join("") : `<div class="card"><div class="empty">No submissions yet. Add your first vehicle above.</div></div>`;
  const main = `<div class="topbar"><div><div class="kicker">Dealer portal</div><h1>Welcome${first ? `, ${esc(first)}` : ""}</h1><p class="subline">Submit inventory for the JDM Connect team to review.</p></div><a class="btn-outline" href="/logout">Sign out</a></div><div class="content">
    ${flash ? `<div class="dealer-flash ${/^error/i.test(flash) ? "err" : ""}" role="status">${esc(flash)}</div>` : ""}
    <div class="card dealer-submit"><h2>Submit a vehicle</h2><form method="POST" action="/dealer/vehicle/submit" class="dealer-form-grid">
      <div><label for="dealer-make">Make</label><input id="dealer-make" name="make" maxlength="${DEALER_VEHICLE_LIMITS.make}" required></div>
      <div><label for="dealer-model">Model</label><input id="dealer-model" name="model" maxlength="${DEALER_VEHICLE_LIMITS.model}" required></div>
      <div><label for="dealer-year">Year <span class="opt">(optional)</span></label><input id="dealer-year" name="year" type="number" inputmode="numeric" min="1950" max="${new Date().getFullYear() + 1}"></div>
      <div><label for="dealer-grade">Grade <span class="opt">(optional)</span></label><input id="dealer-grade" name="grade" maxlength="${DEALER_VEHICLE_LIMITS.grade}"></div>
      <div><label for="dealer-mileage">Mileage (km) <span class="opt">(optional)</span></label><input id="dealer-mileage" name="mileage_km" type="number" inputmode="numeric" min="0" max="${DEALER_VEHICLE_LIMITS.mileageMax}"></div>
      <div><label for="dealer-price">Price (AUD)</label><input id="dealer-price" name="price_aud" type="number" inputmode="numeric" min="1" max="${DEALER_VEHICLE_LIMITS.priceMax}" required></div>
      <div class="dealer-wide"><label for="dealer-location">Location <span class="opt">(optional)</span></label><input id="dealer-location" name="location" maxlength="${DEALER_VEHICLE_LIMITS.location}"></div>
      <div class="dealer-wide"><label for="dealer-description">Description <span class="opt">(optional)</span></label><textarea id="dealer-description" name="description" rows="4" maxlength="${DEALER_VEHICLE_LIMITS.description}"></textarea></div>
      <div class="dealer-wide"><button type="submit" class="btn-primary">Submit for review</button></div>
    </form></div><div class="psec"><h2>Your submissions <span class="ct">${submissions.length}</span></h2></div>${list}</div>
    <style>.dealer-submit{margin-bottom:var(--sp-5)}.dealer-submit h2{margin:0 0 var(--sp-4)}.dealer-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--sp-4)}.dealer-form-grid input,.dealer-form-grid textarea{width:100%}.dealer-wide{grid-column:1/-1}.dealer-flash{padding:12px 16px;margin-bottom:var(--sp-4);border:1px solid var(--ok-fg);background:var(--ok-bg);color:var(--ok-fg);border-radius:var(--r-card)}.dealer-flash.err{border-color:var(--bad-line);background:var(--bad-bg);color:var(--bad)}.dealer-own-card{margin-bottom:var(--sp-3)}.dealer-own-head{display:flex;justify-content:space-between;gap:var(--sp-3)}.dealer-own-head h3{margin:0}.dealer-own-head p{margin:4px 0 0;color:var(--t3);font-size:var(--fs-label)}.dealer-own-meta{display:flex;gap:var(--sp-4);flex-wrap:wrap;margin-top:var(--sp-3);font-size:var(--fs-sec);color:var(--t2)}@media(max-width:640px){.dealer-form-grid{grid-template-columns:1fr}.dealer-own-head{align-items:flex-start}}</style>`;
  return brandShell(side, main, "Dealer portal - JDM Connect");
}

// Admin dealer management body. It is rendered by adminPage inside the shared
// shell, so navigation, responsive cards, dialogs and design tokens stay aligned
// with every other staff view.
export function dealersPage(list = []) {
  const rows = list.map((d) => `<tr>
    <td>${avatar(d.name)}<span class="idcell"><strong>${esc(d.name)}</strong><span class="idsub">${esc(d.email)}</span></span></td>
    <td>${esc(d.company || "-")}</td><td>${esc(d.state || "-")}</td>
    <td>${d.active ? `<span class="chip chip-good">Active</span>` : `<span class="chip muted">Inactive</span>`}</td>
    <td>${d.created_at ? esc(new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(new Date(d.created_at))) : "-"}</td>
    <td style="text-align:right">${rowMenu([
      { label: d.pass_hash ? "Send password reset" : "Resend invite", action: d.pass_hash ? "/send-reset" : "/dealer/invite", id: d.id, extra: d.pass_hash ? { kind: "dealer" } : {} },
      { label: d.active ? "Deactivate" : "Activate", action: "/dealer/toggle", id: d.id },
      { sep: true },
      { label: "Delete dealer", action: "/dealer/delete", id: d.id, danger: true, confirm: `Delete ${d.name} and all their submissions?` },
    ])}</td>
  </tr>`).join("");
  const cards = list.map((d) => mobileCardRow({
    name: d.name,
    title: esc(d.name),
    meta: [esc(d.company || ""), esc(d.email || ""), esc(d.state || "")].filter(Boolean).join(" &middot; "),
    right: `${d.active ? `<span class="chip chip-good">Active</span>` : `<span class="chip muted">Inactive</span>`}${rowMenu([
      { label: d.pass_hash ? "Send password reset" : "Resend invite", action: d.pass_hash ? "/send-reset" : "/dealer/invite", id: d.id, extra: d.pass_hash ? { kind: "dealer" } : {} },
      { label: d.active ? "Deactivate" : "Activate", action: "/dealer/toggle", id: d.id },
      { sep: true }, { label: "Delete dealer", action: "/dealer/delete", id: d.id, danger: true, confirm: `Delete ${d.name} and all their submissions?` },
    ])}`,
  })).join("");
  return `<div class="card dealer-add"><h2>Add dealer</h2><form method="POST" action="/dealer" class="form-grid">
      <div><label for="dealer-name">Name</label><input id="dealer-name" name="name" autocomplete="name" maxlength="120" required></div>
      <div><label for="dealer-email">Email</label><input id="dealer-email" name="email" type="email" autocomplete="email" spellcheck="false" maxlength="254" required></div>
      <div><label for="dealer-company">Company <span class="opt">(optional)</span></label><input id="dealer-company" name="company" autocomplete="organization" maxlength="120"></div>
      <div><label for="dealer-state">State <span class="opt">(optional)</span></label><input id="dealer-state" name="state" maxlength="40"></div>
      <div class="form-actions"><button type="submit" class="btn-primary">Add &amp; invite dealer</button></div>
    </form></div>
    <div class="psec"><h2>Dealer accounts <span class="ct">${list.length}</span></h2><a class="btn-outline" href="/admin?view=dealer-submissions">Review submitted stock</a></div>
    ${list.length ? `<div class="card table-card tbl-desk"><table class="sortable"><thead><tr><th>Dealer</th><th>Company</th><th>State</th><th>Status</th><th>Created</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="mcl">${cards}</div>` : `<div class="card"><div class="empty">No dealer accounts yet. Add the first dealer above.</div></div>`}
    <style>.dealer-add{margin-bottom:var(--sp-5)}.dealer-add h2{margin:0 0 var(--sp-4)}.dealer-add .form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--sp-4)}.dealer-add .form-actions{grid-column:1/-1}.dealer-add input{width:100%}@media(max-width:640px){.dealer-add .form-grid{grid-template-columns:1fr}}</style>`;
}

// Admin dealer-submission review body inside the shared admin shell.
export function dealerSubmissionsPage(submissions = [], status = "pending") {
  const tabs = ["pending", "approved", "rejected", "archived"];
  const badge = (s) => s === "approved" ? `<span class="chip chip-good">Approved</span>`
    : s === "rejected" ? `<span class="chip chip-bad">Rejected</span>`
    : s === "archived" ? `<span class="chip muted">Archived</span>`
    : `<span class="chip chip-warn">Pending</span>`;
  const filters = `<div class="fchips dealer-tabs">${tabs.map((t) => `<a class="${status === t ? "on" : ""}" href="/admin?view=dealer-submissions&amp;status=${t}">${t.charAt(0).toUpperCase() + t.slice(1)}${status === t ? ` <span>${submissions.length}</span>` : ""}</a>`).join("")}</div>`;
  const cards = submissions.map((v) => `<article class="card dealer-stock-card">
    <div class="dealer-stock-head"><div><h2>${esc(v.make)} ${esc(v.model)}${v.year ? ` (${v.year})` : ""}</h2><p>${esc(v.dealer_name)}${v.dealer_company ? ` &middot; ${esc(v.dealer_company)}` : ""}</p></div>${badge(v.status)}</div>
    <dl class="dealer-stock-meta"><div><dt>Price</dt><dd>A$${Number(v.price_aud || 0).toLocaleString("en-AU")}</dd></div>${v.mileage_km ? `<div><dt>Mileage</dt><dd>${Number(v.mileage_km).toLocaleString("en-AU")} km</dd></div>` : ""}${v.grade ? `<div><dt>Grade</dt><dd>${esc(v.grade)}</dd></div>` : ""}${v.location ? `<div><dt>Location</dt><dd>${esc(v.location)}</dd></div>` : ""}</dl>
    ${v.description ? `<p class="dealer-stock-copy">${esc(v.description)}</p>` : ""}
    ${v.admin_notes ? `<p class="reqerr"><strong>Review note:</strong> ${esc(v.admin_notes)}</p>` : ""}
    ${v.status === "pending" ? `<div class="dealer-stock-actions"><form method="POST" action="/dealer-vehicle/approve"><input type="hidden" name="id" value="${v.id}"><button type="submit" class="btn-primary">Approve</button></form><form method="POST" action="/dealer-vehicle/reject" class="dealer-reject"><input type="hidden" name="id" value="${v.id}"><label for="dealer-note-${v.id}">Rejection note <span class="opt">(optional)</span></label><div><textarea id="dealer-note-${v.id}" name="notes" rows="2" maxlength="500"></textarea><button type="submit" class="btn-danger">Reject</button></div></form></div>` : ""}
  </article>`).join("");
  return `<div class="psec"><div>${filters}</div><a class="btn-outline" href="/admin?view=dealers">Manage dealers</a></div>${cards || `<div class="card"><div class="empty">No ${esc(status)} dealer submissions.</div></div>`}
  <style>.dealer-tabs{margin:0}.dealer-stock-card{margin-bottom:var(--sp-4)}.dealer-stock-head{display:flex;justify-content:space-between;gap:var(--sp-4);align-items:flex-start}.dealer-stock-head h2{margin:0;font-size:var(--fs-sect)}.dealer-stock-head p{margin:4px 0 0;color:var(--t3);font-size:var(--fs-sec)}.dealer-stock-meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:var(--sp-3);margin:var(--sp-4) 0}.dealer-stock-meta div{background:var(--off);padding:var(--sp-3);border-radius:var(--r-ctl)}.dealer-stock-meta dt{font-size:var(--fs-label);color:var(--t3)}.dealer-stock-meta dd{margin:4px 0 0;font-weight:700}.dealer-stock-copy{color:var(--t2);line-height:1.6}.dealer-stock-actions{display:flex;gap:var(--sp-4);align-items:flex-end;border-top:1px solid var(--hair);padding-top:var(--sp-4)}.dealer-reject{flex:1}.dealer-reject>div{display:flex;gap:var(--sp-2)}.dealer-reject textarea{flex:1;min-width:0}@media(max-width:640px){.dealer-stock-actions,.dealer-reject>div{flex-direction:column;align-items:stretch}.dealer-stock-actions form,.dealer-stock-actions button{width:100%}}</style>`;
}
// (Phase 5 design pass touched only presentation code above.)
