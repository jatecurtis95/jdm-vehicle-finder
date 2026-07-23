# UI & Visual Consistency Audit — jdm-vehicle-finder

**Date:** 2026-07-21 · **Scope:** read-only audit of every UI surface in `src/` · **No code was changed.**

---

## 0. Corrections and build results

**Stack correction.** This repo is **not** React/Vite/Tailwind. It is a Cloudflare Worker that server-renders
HTML from JS template strings. CSS lives in three places: `src/theme.js` (customer/portal/login brand shell),
a large `CSS` constant in `src/admin.js` (~lines 215–950, staff app) plus **8 further scoped `<style>` blocks**
inside admin.js (`DASH2_CSS` 2277, `REQ_CSS` 2836, `RD_CSS` 3564, `TASKS_CSS` 3770, `CRM_CSS` 5044,
`CLV_STYLE` 5988, `ALOT_CSS` 6250, `PLV_STYLE` 6280), and `src/landing-css.js` for the marketing page.
Client-side behaviour is inline `<script>` IIFEs in the same template strings.

**Build.** `npx wrangler deploy --dry-run --outdir <scratchpad>` completes **clean** — no CSS, bundle, or
compatibility warnings. Total upload 1075.64 KiB (304.59 KiB gzip). Only notice: wrangler 4.101.0 has an
update available (4.112.0). There is no Tailwind/PostCSS pipeline to warn.

**Architecture context that explains most findings.** `theme.js:1–10` states the class names *deliberately
mirror the staff app* so markup re-themes without churn. In practice the two systems (plus the 8 scoped
blocks) each redeclare `.btn-primary`, `.chip`, `.pill`, `.card`, `--gold` etc. independently, and they have
drifted. Nothing lints this. Almost every finding below is a symptom of that mechanism.

---

## 1. The known example, diagnosed: grey "Send all" vs gold "Approve & send"

**Verdict: hardcoded CSS scoping bug. Not conditional on paused emails, not a disabled state.**

- Per-item button: `<a class="btn-primary btn-sm" …>Approve &amp; send</a>` — `admin.js:3926`.
  `.btn-primary` is globally gold: `background:var(--gold)` — `admin.js:332`.
- Bulk button: `<button type="button" class="bap gh-send" …>Send all ${rows.length} to ${esc(first)}</button>`
  — `admin.js:4198`, rendered inside `<div class="ghead2">` (`admin.js:4191`).
- `.bap` is **only** styled under two container-scoped selectors:
  `.actionbar .bap{background:var(--gold);…}` (`admin.js:403`) and
  `.bulkbar2 .bap{background:var(--gold);…}` (`admin.js:598`).
  `.ghead2` is neither container. The only rule that reaches the button is
  `.gh-send{white-space:nowrap}` (`admin.js:4240`), and there is **no global `button` base rule anywhere in
  `src/`** — so the button falls through to the browser's default grey chrome.
- The paused-emails state exists (`sendOff` → `.pausebar`, `admin.js:4106–4108`) but only renders a banner;
  it never touches button colour.
- Bonus defects on the same button: no hover feedback (`.bap` has no bare `:hover` anywhere), and
  `white-space:nowrap` with no `max-width`/ellipsis under the page-level `html{overflow-x:clip}`
  (`admin.js:272`, `theme.js:98`) means a long client first name silently clips at 320–375 px.

This is the representative failure mode for the whole app: a class that *looks* shared is actually scoped to
one container or one file, and reuse elsewhere silently loses its styling.

---

## 2. Component reuse

| Element | Shared? | Reality |
|---|---|---|
| Buttons | ✗ | `.btn-primary` defined **3×** with different values: `theme.js:176` (padding 12px 22px, radius 8px, weight 700, 14px, hardcoded `#15120A`), `admin.js:332` (12px 24px, `var(--r-ctl)`, weight 600, `var(--fs-sec)`=13px), `request-wizard.js:159–162` (14px 24px, radius 10px, 15px, hardcoded hover `#D9B45F`). Plus a parallel one-letter system (`.bap/.bsk/.bdel/.bcl`) for bulk bars only. |
| Cards | ~ | `.card` in both shells but `theme.js:142` pads 26px 28px vs `admin.js:311` `var(--pad-card)` (20px). |
| Inputs/selects | ✗ | Radius **8px** (`admin.js:323`) vs **7px** (`theme.js:164`) vs **10px** (`request-wizard.js:149`) for the same base text field. |
| Badges/pills | ✗ | `.chip` is gold-tinted by default in `theme.js:194` but neutral grey in `admin.js:357` (gold only via `.chip-gold`, `admin.js:365`). `.pill` (lot-number badge on photos) is a 5px-radius rectangle in `theme.js:217` but a 9999px capsule in `admin.js:417`. Import-eligibility has **three incompatible renderings** of the same `auctionEligibility()` output: `.elig` filled pill (`theme.js:201–204`), `.chip-good/-warn/-bad` (`admin.js:357–366`), and `.ac-elig` borderless dot+text (`auction-ui.js:416–419`); a fourth (`.badge.ok/.warn/.no`, `theme.js:196–200`) is unused. |
| Toasts | ~ | One canonical component (`window.jdmToast`, `admin.js:6489`, commented "The ONE toast") — but a hand-rolled DOM-toast fallback at `admin.js:4537` (hardcoded radius 8px, no `role="status"`, no safe-area inset, `sans-serif`) and three more local `alert()`-fallback wrappers (`admin.js:4296, 4735, 7905`). |
| Confirm dialog | ✓ | Single `window.jdmConfirm` (`admin.js:6499`); three local `conf()` wrappers are consistent copies. |
| Modals/drawers | ✓ | One drawer implementation (`drawerChrome`, `admin.js:6592–6644`) — a model dialog. Lightbox is separate and weaker (§7). |
| Bulk bars | ✗ | Two full parallel implementations posting to the same `/matches/bulk`: `.bulkbar2` (`admin.js:4155–4163`, CSS 594–602) and `clientBulkBar()`/`.actionbar` (`admin.js:4717–4750`, CSS 394–404). Acknowledged in-code ("the main Matches controller isn't loaded here"). |
| Banners/flashes | ✗ | Generic `.banner`/`.flash` exist (`theme.js:207, 209`) but admin accumulates one-offs per view: `.reqerr` (463), `.dupnote` (464), `.login-err` (455), `.pausebar` (593), `.nocontact` (620), `.watch-alert` (`auction-ui.js:232`), `.rd-lost` (`admin.js:3638`). |
| Match-card action script | ✗ | Two near-duplicate approve/skip handlers: `matchesScript()` (`admin.js:4292`, handler 4506–4515) and `matchActionScript()` (`admin.js:4524–4539`). Loading behaviour is consistent; only the toast fallback drifted. |

---

## 3. Visual consistency — "these should match but don't"

1. `.btn-primary` ×3 (padding/weight/size/radius) — `theme.js:176` vs `admin.js:332` vs `request-wizard.js:159`.
2. `.chip` gold vs grey default — `theme.js:194` vs `admin.js:357`; weight 600 vs 500.
3. `.pill` 5px rectangle vs 9999px capsule — `theme.js:217` vs `admin.js:417` (also different rgba/blur/gap).
4. Eligibility badge: `.elig` vs `.chip-good/-warn/-bad` vs `.ac-elig` (three shapes for one component) —
   `theme.js:201`, `admin.js:357–366`, `auction-ui.js:416–419`.
5. Input radius 8/7/10px — `admin.js:323` / `theme.js:164` / `request-wizard.js:149`.
6. **A fourth gold.** Brand gold is `#CAA34C` / hover `#D9B45F` / text `#E6C879` consistently in
   `theme.js:62`, `landing-css.js:20`, `admin.js:227` — but the customer-facing share page redefines
   `--gold:#C39A3D; --gold-hover:#B08A31; --gold-txt:#7a5e1c` (`admin.js:5995`, `CLV_STYLE`). Deliberate per
   its comment, but customers see a visibly more muted gold on shared links than on every other surface.
7. Token system exists only in admin: `admin.js:236–246` defines `--sp-*`, `--fs-*`, `--r-ctl`, `--r-card`
   etc.; `theme.js` defines **none of them** (verified zero matches). Shared files hedge with fallbacks
   (`var(--r-ctl,8px)`, `var(--fs-sec,13px)` — `auction-ui.js:355, 428`), so the *same markup* computes
   different padding/size depending on which shell wraps it.
8. `.btn-secondary` padding/size drift — `theme.js:179` (11px 18px, 14px) vs `admin.js:306` (12px 16px, 13px).
9. Hardcoded hex bypassing tokens: `#15120A` (`theme.js:176`, `request-wizard.js:159`), `#D9B45F` hover
   (`request-wizard.js:162`), `#B11226` error (`request-wizard.js:157` — because `.ob` never defines `--bad`).
10. Hand-rolled toast at `admin.js:4537` vs canonical `.jdm-toast` (`admin.js:6474`): radius 8 vs
    `var(--r-card,10px)`, bottom 24px vs safe-area-aware, `sans-serif` vs inherited font.

---

## 4. Conditional styling logic

| State | Trigger | Consistent? |
|---|---|---|
| Loading (anchors) | `.is-loading` (`admin.js:339`, opacity .7 + pointer-events none) + text swap "Sending…/Skipping…" | ✓ in both card handlers (`admin.js:4509, 4529`). ✗ `#mMore` "Load more" (`admin.js:4485–4502`) swaps text but never adds `.is-loading` — breaks the app's own anchor pattern. |
| Loading (buttons) | native `disabled` + shared `:disabled{opacity:.55}` (`admin.js:338`, `theme.js:191`) | ✓ only for the enumerated classes (`.btn-*`, `.bap/.bsk/.bdel`). ✗ everything outside the list (next row). |
| Disabled, no visual change | JS/server sets `disabled` but no CSS rule covers the class | `#qFix` "Fix photos with AI" (`admin.js:4141`, no class; `.quick button` at 591 has hover but no `:disabled`); `#triStale`/`#triPoss` (`admin.js:4139–4140`, class `tri-skip`, server-rendered `disabled` at zero count looks identical to enabled); wizard submit — `.ob .btn-primary` (`request-wizard.js:159–163`) has **no `:disabled` rule** yet is disabled on submit (`request-wizard.js:550`); mobile nav `<select>` (`admin.js:81–82`). |
| Group busy | `.mgroup.ldg .gh-fold{opacity:.45}` (`admin.js:4233`) | A third loading idiom, dims only the chevron. |
| Paused (global) | `sendOff` → `.pausebar` banner (`admin.js:593, 4042, 4106–4108`) | ✓ single mechanism; informational only. |
| Paused (wishlist) | `<span class="chip muted">paused</span>` (`admin.js:4677`) vs plain text `" · paused"` (`admin.js:1113`) | ✗ two renderings of the same semantic state. |
| Selected | `.msel` → `.picked` via `syncBulk()` (`admin.js:4300–4304`), reveal rules `admin.js:783–784` | ✓ consistent. Generic `.on` is reused by ~15 unrelated components, each styling it locally — a convention, not a component. |
| Folded | `.mgroup.folded` (`admin.js:4231–4232`) with paired `aria-expanded` (`admin.js:4331`) | ✓ clean. |
| Empty | `.empty` near-identical in `theme.js:258` and `admin.js:441`; `#mEmpty` toggled by inline `style.display` | ✓ minor accent-colour diff only. |
| Error field | `.field-err` identical in `theme.js:286`/`admin.js:465`; wizard re-declares with hardcoded `#B11226` (`request-wizard.js:157`) | ~ works today, breaks future palette changes. |

---

## 5. Interaction states (coverage table)

| Class | Hover | Focus-visible | Active | Disabled |
|---|---|---|---|---|
| `.btn-primary` / `.btn-secondary` | ✓ | ✓ | ✓ | ✓ |
| `.btn-tertiary` | ✓ | ✓ | ✗ | ✓ |
| `.btn-danger` | ✓ | ✓ (red ring) | ✗ | ✓ |
| `.btn-toggle` | admin ✓ / theme ✗ | ✓ | ✗ | ✗ |
| `.bap` / `.bsk` | **✗ no hover** | ✓ | ✓ | ✓ |
| `.bdel` | only inside `.bulkbar2` (601) | ✓ | ✗ | ✓ |
| `.bcl` (Clear) | ✗ | ✗ | ✗ | ✗ — zero interactive CSS (`admin.js:602`) |
| `.gh-send` | ✗ | ✓ | ✓ | ✓ |
| `.gh-fold` | ✗ | **✗ not in focus list** | ✗ | n/a |
| `.fchip` | **✗ confirmed none** | ✓ | ✗ | n/a |
| `.clink` (client links) | ✓ | ✗ | ✗ | n/a |
| `.bx` (dismiss) | ✗ | ✗ | ✗ | n/a — wired in JS (`admin.js:4382`) but zero visual feedback |
| `.rowmenu-btn` (real kebab) | ✓ + `[open]` | **✗** (`admin.js:6398–6401`) | n/a | n/a |
| `.kebab` | *dead CSS — class never rendered* (`admin.js:755–757`; focus rule 335 styles nothing) | | | |
| auction-ui (`.ac-fav`, `.av`, `.atab`) | ✓ | **✗ — file has zero `:focus-visible` rules** | partial | n/a |
| `.ob .btn-primary` (wizard) | ✓ | generic (`request-wizard.js:147`) | ✓ | **✗** |
| Landing CTAs (`.jf-*`) | ✓ | ✓ blanket rule (`landing-css.js:35`) | `.jf-gold` only | n/a |
| `<summary>` disclosures (admin) | inconsistent (~half have hover) | browser default only — admin has no generic `summary:focus-visible` | n/a | n/a |

**Dead buttons:** none found — a full cross-check of 47 `getElementById` refs vs 159 rendered ids in admin.js
surfaced no orphaned buttons (`jdmConfirm` is dynamically created; `#qFix`/`#triStale`/`#triPoss` are wired
via `wireTriage`, `admin.js:4479`). The dead artefacts are CSS-side (§10), not dead clickables.

---

## 6. State coverage per view

Baseline: every **admin** view gets `uxGuardScript()` (`admin.js:6468–6581` — toast, confirm dialog, global
submit-lock) via `shell()` (`admin.js:6583`). **Public and portal pages do not** — they use static `?ok=/?err=`
banners with no auto-dismiss and no submit locking (`index.js:1590–1601`).

| View | Loading | Empty | Error | Success |
|---|---|---|---|---|
| Dashboard (`admin.js:2051`) | n/a | ✓ 7/8; **✗ `topMakesCard` vanishes silently** (`admin.js:2108–2113`) | n/a | n/a |
| Clients list (`admin.js:2368`) | ✓ | ✓ | ✓ | ✓ |
| Client detail (`admin.js:5132`) | ✓ | ~ some sections omit silently | **3 parallel mechanisms** (toast / inline flash / custom try-catch) | same 3 mechanisms |
| Intake (`admin.js:2307`) | ~ submit-lock only | n/a | ✓ inline, preserves input | ✓ |
| **Matches/triage** (`admin.js:4032`) | ✓ extensive | ✓ | Generic "Could not action, try again"; **✗ silent delivery failure: `applyBulkDecisions` (`index.js:2178–2189`) swallows per-client send exceptions (rows marked `status='failed'`) and the success toast still shows. No UI ever surfaces failed sends.** | ✓ specific toasts |
| Agents (`admin.js:1410`) | ~ | ✓ | ✓ | ~ generic "updated" copy |
| Dealers / submissions (`admin.js:8858, 8894`) | ~ | ✓ | ✓ | ✓ but **✗ no confirm on Approve/Reject** (`admin.js:8906`) |
| Payments (`admin.js:1655`) | ~ | ✓ | ✓ | ~ toast is the app-wide "Status updated" (`index.js:999`), not payments-specific; **✗ no confirm on Mark paid** (`admin.js:1694`) |
| Settings (`admin.js:1469`) | ~ | n/a | ✓ | ✓ + dirty-check (`admin.js:1631–1640`) |
| Admin search (`admin.js:1050`) | ✗ | ✓ | **✗ no try/catch (`admin.js:1020–1047`) → raw Worker error page** | n/a |
| Requests / detail (`admin.js:2719, 3397`) | ✗ status-select gives no feedback | ✓ | ✓ (note-save preserves text) | ✓ (+ unreachable `.flash` at `admin.js:3547`) |
| Tasks (`admin.js:3692`) | ✗ | ✓ | ✗ generic only; toggle has no confirm | ✓ |
| Admin auctions (`admin.js:8051`) | ✓ bulk; ✗ search forms; **✗ model-refill fails silently** (`auction-ui.js:209–212`) | ✓ distinguishes empty vs feed-down (`feedDownCard`, `auction-ui.js:278`) | ✓ strongest in app | ✗ two mechanisms for one action (inline flash `admin.js:8254` vs toast for bulk) |
| Auction history | ~ cosmetic `.ahx-loading` | ✓ excellent (3 variants) | ✓ | n/a — but paywall/members gate renders in `.empty`, indistinguishable from "no data" |
| Market intel (`market.js`) | n/a | ✓ | **✗ outage returns `null` (`market.js:222–225`) → panel silently disappears** | n/a |
| Landing (`landing.js`) | n/a | ✓ `/finds`; **✗ `#lineup` vanishes silently** (`landing.js:479–495`) | n/a | n/a |
| Login / MFA (`admin.js:1729–1766`) | **✗ no submit feedback** | n/a | ✓ inline | n/a |
| Forgot/set password (`admin.js:1791–1827`) | **✗** | n/a | ✓ | ✓ (anti-enumeration copy) |
| Request wizard (`request-wizard.js`) | ✓ step 4 ("Starting your search…", 550) — the only public form with real loading; ✗ recent-searches panel has invisible loading and **conflates fetch-error with empty** (439–459) | ✓ steps 1–3; ✗ recent-searches empty shows nothing | ✓ | ✓ best confirmation page in app (`admin.js:5555–5583`) |
| Portal home (`admin.js:8344–8420`) | **✗ zero loading/disable anywhere** | ✓ | ~ static banner, never dismisses, params linger | same |
| Dealer portal (`admin.js:8837`, `index.js:1997–2004`) | **✗** | ✓ | ~ raw `"Error: " + err` double-wording (`index.js:2003`) | ✓ |

---

## 7. Responsive & layout

- ✓ Card grids already fixed for phones (`theme.js:353–354`, `auction-ui.js:449`); all tables wrapped in
  `overflow-x:auto` with `min-width:560px` scroll behaviour (`admin.js:578–581, 1055, 1460, 1698, 1723, 2829`);
  `.bulkbar2` becomes a fixed bottom sheet on mobile (`admin.js:4263`).
- ✗ `.gh-send` clipping risk (see §1) — dynamic text + `nowrap` + `overflow-x:clip`.
- ✗ Breakpoint drift, no shared token: 640 (`admin.js:510`/`theme.js:351`), **759** (`admin.js:4244`) vs
  **760** (`landing-css.js:365`) — a 1px mismatch —, 900 (`auction-ui.js:438`), 1050/680
  (`auction-history.js:467, 488`), 920/760/420 (`landing-css.js`), 560/640/800 (`request-wizard.js`).
- ✓ No sub-400px overflow found beyond the `.gh-send` case; `.atabs` horizontal-scroll fix already in place
  (`auction-ui.js:374`).

## 8. Accessibility

- ✓ **All `<img>` tags carry `alt`** (decorative ones correctly `alt=""`). No violations.
- ✓ All icon-only buttons checked have `aria-label` (`.gh-fold` 4192, `.bx` 4112, row menu 6367, drawer close
  6595, lightbox 5962, `.ac-fav` auction-ui 108/306, burger 6585).
- ✗ Unlabelled controls: quick-preset `<select>` (`admin.js:169–170`, label has no `for`, select no `id`);
  customers-table row checkbox (`admin.js:2469`, contrast with the correct `aria-label` at 3905); select-all
  header checkbox uses `title` only (`admin.js:2517`).
- ✗ Focus visibility is an **allow-list** (`admin.js:335–336`, `theme.js:189–190`) — misses `.gh-fold`,
  `.clink`, `.rowmenu-btn`, `.bx`, all disclosure `<summary>`s, and **all of auction-ui.js** (zero
  focus-visible rules in that file). Browser default outline still shows (not a WCAG failure) but the branded
  ring is the minority case. `landing-css.js:35`'s blanket rule is the model to port.
- ✓ All 7 `outline:none` uses pair with a replacement `box-shadow` ring in the same rule (e.g. `theme.js:167`).
- Modals: drawer (`admin.js:6592–6644`) is fully correct (role/aria-modal, focus-in, tab trap, Escape, focus
  restore). `jdmConfirm` (`admin.js:6499–6519`) has focus-in/Escape/restore but **no tab trap**. Photo
  lightbox (`admin.js:5960–5973`) has role/Escape/arrows but **never moves focus in and has no tab trap** —
  the one real modal gap.
- Contrast: computed from actual hex values — **no failing pair found**. Thinnest margins: light-theme `--t3`
  `#6b7079` on `#f4f4f1` = **4.51:1** (exactly at AA, zero headroom, used widely for secondary text) and dark
  placeholder 4.69:1 (matches the code comment claiming it, `theme.js:63`).

## 9. Microcopy

- Same action, five phrasings: "Approve & send" (3926) / "Mark done" (watch variant, 3926) / "Send all N to
  {name}" (4198) / "Send it" (4982) / confirm-dialog "Approve and send this car…" (4969).
- Generic-error drift: "Sorry, that did not save. Please try again." (`index.js:828`) vs "Could not action,
  try again" (no period, `admin.js:4514`) vs "Could not action the selection, please try again" (4434) vs
  "Sorry, we couldn't add that lot. Please try again." (8256) vs dealer portal's `"Error: " + err` producing
  "Error: Please enter a valid price in AUD." (`index.js:2003`) — the only labelled-prefix error in the app.
- Reused generic success: "Status updated" (`index.js:999`) fires for **every** request-status transition
  including Payments "Mark paid" — paying an invoice and moving a pipeline stage read identically.
- Terminology drift: client / customer / member-buyer for the same person (routes vs sidebar `admin.js:987`
  vs `portal-shell.js:18` + render.js emails); lot / car / vehicle for the same object; queue vs pipeline vs
  matches with no explained boundary. "ALL" vs "all" capitalisation between parallel delete confirms
  (`admin.js:1430` vs 2480s).
- ✓ Empty-state copy is the most consistent voice in the app ("No X yet. {reassuring next step}").

## 10. Dead UI

- **Dead modules: none.** Every `src/*.js` file is imported and reachable (portal-shell, assets, render all
  verified in use).
- Dead function: `engagementCell()` — `admin.js:2613`, zero call sites.
- Confirmed dead CSS (defined, zero markup anywhere): `.reqok/.reqok-badge/.reqok-ref` — defined **twice**
  (`theme.js:279–284` and `admin.js:457–462`); `.pricegrid` (`theme.js:301`); `.gate/.gs/.gn`
  (`theme.js:315–317`); `.cta-import/.ci-t/.ci-s` (`theme.js:320–322`); `.ghead/.gh-n/.gh-sel`
  (`admin.js:603–605` — superseded by `.ghead2`); `.kebab` (`admin.js:755–757` + focus rule 335 — real menu
  is `.rowmenu-btn`); `.badge.ok/.warn/.no` unused in admin (`theme.js:196–200`).
- Dead sub-block: the login/reqok CSS inside admin's staff shell (`admin.js:447–462`) — login pages render
  via `brandDoc()`/theme.js, never via `shell()`, so this duplicated block styles nothing.
- Likely dead: `theme.js:302–312` `.tier*` — landing always emits `landing-css.js:282–297`'s own `.tier`
  later in the document, which wins the cascade.
- **Unstyled markup (inverse dead CSS):** `.bap.gh-send` (§1) and `class="btn-outline"` used at
  `admin.js:8838, 8888, 8908` (dealer portal sign-out, "Review submitted stock", "Manage dealers") with
  **no `.btn-outline` rule anywhere in the codebase** — three fully unstyled bare links on dealer pages.

---

# A. Plain-English summary

The app is in better shape than "AI-built iteratively" usually implies: accessibility fundamentals are
genuinely good (alt text, aria-labels, a model focus-trapped drawer, no failing contrast pair), empty states
are well-written almost everywhere, the matches queue has rich loading feedback, and earlier audit passes
visibly fixed the worst mobile overflow and table problems. The build is clean.

What hurts it is not missing craft but **drift between parallel copies of the same thing**. The three things
hurting it most:

1. **No single source of truth for components.** Two full CSS systems plus 8 scoped blocks each redeclare
   "shared" classes (`.btn-primary` ×3, `.chip`, `.pill`, four golds, three eligibility badges, two bulk
   bars, four toasts). The grey "Send all" button and the three unstyled `.btn-outline` dealer links are the
   visible tip: styling scoped to one container silently evaporates when the class is reused elsewhere.
2. **Disabled/loading feedback is an allow-list, not a default.** Anything outside the enumerated
   `:disabled` selector (triage buttons, "Fix photos", the wizard submit) disables with zero visual change,
   and public/portal pages get no submit-lock or toast system at all — forms feel dead exactly where
   customers touch them.
3. **Failure states that lie or vanish.** Bulk match-send shows "Sent N" even when some deliveries failed
   (`index.js:2178–2189`); market intel and the landing lineup silently disappear on outage; admin search can
   surface a raw Worker error page. These are the moments the app actually "feels broken".

# B. Ranked cleanup plan

Sorted: highest-impact, lowest-risk quick wins first. Effort S/M/L · Risk to live app · Polish impact.

| # | What to do | Why | Effort | Risk | Impact |
|---|---|---|---|---|---|
| 1 | Restyle the "Send all N" button: replace `class="bap gh-send"` with the existing `.btn-primary btn-sm` (or add a bare `.bap{…}` base rule), and add max-width + ellipsis for long names (`admin.js:4198, 4240`) | The reported bug; most-clicked bulk action renders browser-grey and can clip on phones | S | Low | High |
| 2 | Add a `.btn-outline` rule (or swap to `.btn-secondary`) for the three dealer links (`admin.js:8838, 8888, 8908`) | Three fully unstyled bare links on live dealer pages | S | Low | High |
| 3 | Extend the shared `:disabled` treatment to `.quick button`, `.tri-skip`, and `.ob .btn-primary`; add `.is-loading` to `#mMore` (`admin.js:338, 591, 4139–4141, 4489`; `request-wizard.js:159`) | Disabled buttons currently look enabled; dead-feeling clicks | S | Low | High |
| 4 | Replace the per-class `:focus-visible` allow-list with blanket rules per shell, modelled on `landing-css.js:35`; covers `.gh-fold`, `.clink`, `.bx`, `.rowmenu-btn`, all of auction-ui | One rule per shell fixes ~15 gaps at once | S | Low | Med |
| 5 | Delete confirmed-dead CSS/function: `.reqok*` (both copies), `.pricegrid`, `.gate*`, `.cta-import*`, `.ghead`, `.kebab`, admin's dead login block 447–462, `engagementCell` | Pure deletion of verified-unreferenced code; shrinks the files everyone edits | S | Low | Med |
| 6 | Collapse the four toast fallbacks onto one helper; make the `admin.js:4537` hand-rolled version delegate to `.jdm-toast` styling with `role="status"` | One toast look everywhere; removes the drifted copy | S | Low | Med |
| 7 | Add hover feedback to `.bap/.bsk/.bcl/.bx/.fchip/.gh-fold` and normalise `<summary>` hover | The bulk bar — a primary surface — has zero hover response | S | Low | Med |
| 8 | Surface failed bulk-match deliveries: after `applyBulkDecisions`, report `status='failed'` rows in the toast and/or a queue filter (`index.js:2178–2189`) | Staff currently get success toasts for sends that failed — worst trust bug found | M | Med | High |
| 9 | Show designed fallbacks instead of silent omission: market-intel outage (`market.js:222`), dashboard `topMakesCard` (`admin.js:2108`), landing `#lineup` (`landing.js:479`); split wizard recent-searches "error" from "empty" (`request-wizard.js:459`); wrap `adminSearch` in try/catch (`admin.js:1020`) | Silent disappearance reads as broken | M | Low | Med |
| 10 | Unify the generic error/success strings (one sentence pattern, fix `"Error: " + err` at `index.js:2003`) and pick one term each for client/car/decline | Cheap, app-wide tone lift | S | Low | Med |
| 11 | Fix the three unlabelled controls (`admin.js:169–170, 2469, 2517`) and add focus-in + tab trap to the lightbox (`admin.js:5960–5973`, copy the drawer pattern at 6635–6639) | Rounds out an otherwise strong a11y story | S | Low | Med |
| 12 | Port the admin token block (`admin.js:236–246`) into `theme.js` so `--r-ctl/--fs-*/--sp-*` resolve identically under both shells; then remove per-file fallback values | Removes the mechanism behind "same markup, different size per shell" | M | Med | High |
| 13 | Converge duplicated components one at a time: single `.btn-primary` definition, one `.chip`/`.pill`, one eligibility badge, one bulk-bar module, shared banner variants | The structural fix; do it after #12 so tokens exist to converge onto | L | Med | High |
| 14 | Consolidate breakpoints onto shared constants (fix 759 vs 760) | Prevents future drift; little visible change today | M | Med | Low |
| 15 | Give portal/public pages the submit-lock + dismissible-notice treatment (extract a slim `uxGuardScript` subset into the brand shell) | Customer-facing forms currently have no feedback at all | M | Med | Med |

### Handle carefully — payment, auth, and email/webhook-adjacent UI

Do these deliberately, behind manual testing; they touch money, sign-in, or outbound email paths:

| What to do | Why careful | Effort | Risk | Impact |
|---|---|---|---|---|
| Payments view: add a confirm dialog to "Mark paid" (`admin.js:1694`) and a payments-specific success toast instead of the shared "Status updated" (`index.js:999`) | Shares the `/request/status` route used app-wide; wrong scoping changes every status toast | S | Med | Med |
| Login / MFA / forgot-password: add submit loading state ("Signing in…" + disable) (`admin.js:1729–1827`) | Auth flow; double-submit and lockout logic (rate limiting) interact with retries | S | Med | Med |
| Item #8 above (failed-delivery surfacing) if extended to retry/resend actions | Resending touches the live client email path (`notify.js`/relay) — display-only reporting is safe, resend is not | M | High | High |
| Dealer submission Approve/Reject confirm dialog (`admin.js:8906`) | Approve publishes stock and can trigger notifications | S | Med | Med |
| Share-page gold (`admin.js:5995`) — decide whether the muted `#C39A3D` is intentional brand or drift before "fixing" | Customer-facing page linked from live emails; the divergence is commented as deliberate | S | Low | Low |

*(No Stripe-webhook UI exists to audit — `src/stripe.js` and the webhook route are server-side only; the only
payment-facing UI is the Payments admin view above.)*

---

*Method: five parallel read-only audit passes (component reuse/visual consistency, conditional & interaction
states, per-view state coverage & microcopy, responsive & accessibility, dead UI & duplication) over
`src/*.js`, plus a clean `wrangler deploy --dry-run` build check. Every claim above was verified against
current file contents; line numbers are as of 2026-07-21.*
