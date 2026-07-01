# Web Interface Guidelines — Remediation Breakdown

**Repo:** jdm-vehicle-finder · **Branch reviewed:** `feat/finder-ux-and-fixes` · **Date:** 2026-07-01
**Standard:** [Vercel Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md)

Review of **all rendered web surfaces**. Email HTML (`render.js`) is excluded (it follows a separate, Outlook-hardened ruleset). `calc.js`, `sheet.js`, `matcher.js`, `whatsapp.js`, `oauth.js` are backend-only (no rendered markup) and passed with no findings.

**Priority:** P0 = broken / blocking · P1 = should fix · P2 = polish.
**Effort:** S ≈ <1h · M ≈ half-day · L ≈ 1–2 days.

> Line numbers reference the state of the branch at review time; they may drift as the files change — search by the described markup if a line no longer matches.

---

## Coverage

| Area | Files / functions | Status |
|---|---|---|
| Public landing | `landing.js`, `landing-css.js`, `landing-motion.js` | Reviewed |
| Sign-up wizard | `admin.js:requestPage`, `request-wizard.js` | Reviewed |
| Login / set-password | `admin.js` 1228–1282 | Reviewed |
| Staff CRM + shell | `adminPage`, `sidebar`, `shell()`, `clientDrawerFragment` | Reviewed |
| Staff detail pages | `requestDetailPage`, `lotDetailPage`, `clientDetailPage`, `adminAuctionsPage` | Reviewed |
| Buyer portal + public | `portalPage`, `portalAuctionsPage`, `publicLotPage`, `notFoundPage`, `infoPage` | Reviewed |
| Market panel | `market.js` | Reviewed |
| Backend (no UI) | `calc.js`, `sheet.js`, `matcher.js`, `whatsapp.js`, `oauth.js` | Pass (no UI) |

---

## P0 — Bugs (actual broken output)

### BUG-1 · Empty button on requests/tasks/search views · S
- `src/admin.js:994` — when `h.btn === ""` the else-branch emits `<a class="btn-dark" href="/admin?view=intake"></a>` (empty, no accessible name).
- **Fix:** guard for empty `btn` — render nothing when there is no button.
- **AC:** no empty bordered button/link on the Requests, Tasks, or Search views.

### BUG-2 · Buyer garage stats show "0" without JS · M
- `src/admin.js:5238-5241` — stat tiles hardcode `"0"`, filled only by JS via `data-count`.
- **Fix:** server-render the real values as the fallback text; add `aria-live="polite"` to the `.pv` count region.
- **AC:** with JS disabled the correct counts render; screen readers announce updates.

### BUG-3 · Non-functional `<a>` markers · S
- `src/admin.js:3779` — active tab is `<a class="active">` with no `href` (not focusable, not a real link).
- `src/admin.js:3153` — `#shareWa` renders with no `href` (JS-populated; dead if the script fails).
- **Fix:** current-page tab → `<span>` or `<a aria-current="page">`; give `#shareWa` a valid default `href`.

---

## P0 — Accessibility (forms & modal)

### A11Y-1 · Associate all form labels · M
Labels are siblings with no `for`/`id` and don't wrap the control (not clickable, not linked for screen readers):
- `src/admin.js:3348-3351` (client edit: Name/Email/WhatsApp/State)
- `src/admin.js:3396-3404` (Add a search: all fields)
- `src/admin.js:3673-3676` (wizard "Refine my search": mileage/grade/chassis/nickname)
- `src/admin.js:1248,1250` (login) · `src/admin.js:1274,1276` (set-password)
- **Fix:** add matching `id`/`for` (or wrap input inside `<label>` as `findCard` at 3458 already does).
- **AC:** clicking each label focuses its control; every input has a programmatic label.

### A11Y-2 · Announce validation errors · M
- `src/admin.js:3645-3646,3665,3721,3747-3749` — `.field-err` messages toggled by JS with no live region; inputs lack `aria-invalid`/`aria-describedby`.
- **Fix:** `role="alert"` or `aria-live="polite"` on each `.field-err`; set `aria-invalid="true"` and `aria-describedby="<errId>"` on the field when invalid (validation logic lives in `src/request-wizard.js`).
- **AC:** SR announces the error when a field fails; field is programmatically linked to its message.

### A11Y-3 · Client drawer modal focus management · M
- `src/admin.js:4020-4055` — no `role="dialog"`/`aria-modal="true"`; focus never enters, no focus trap, no restore on close; `#dwContent` async-filled with no `aria-live`; `aria-hidden="true"` on the focusable `#navToggle` checkbox (`4011`).
- **Fix:** add dialog roles; move focus into the panel on open, trap it, restore to the trigger on close (Esc + scrim already close); add `aria-live` to `#dwContent`; add `overscroll-behavior:contain` to `.dw-panel` (`4027`); remove `aria-hidden` from the interactive checkbox.
- **AC:** keyboard user can open, tab within, and Esc out with focus returned; SR announces loaded content.

---

## P0 — Consequential actions

### ACT-1 · "Approve & send" / "Skip" via GET links · M
- `src/admin.js:3250` — these mutate state (email the client) as GET `<a>` links to `/decide`, with no confirmation.
- **Fix:** convert to POST `<button>` in a form; add a confirm step or undo window for "Approve & send".
- **AC:** action can't fire from a crawler/prefetch; user confirms before an email sends.

---

## P1 — Document head / theming (cross-cutting)

### HEAD-1 · Staff shell head hygiene · S
- `src/admin.js:4010-4011` — add `lang="en"` to `<html>`, `<meta name="theme-color">`, `color-scheme`, a skip link, and make primary content a `<main>` landmark (currently `<div class="main">`).

### HEAD-2 · Public shell head · S
- `src/theme.js:389` (`brandDoc`) — add `<meta name="theme-color">` and a skip-to-`<main>` link.

### HEAD-3 · `color-scheme` mismatch on wizard · S
- `src/theme.js:389` declares `color-scheme:dark` doc-wide, but the wizard `.ob` surface is light → native selects/autofill/scrollbars render dark-on-white.
- **Fix:** scope light `color-scheme` to `.ob` (or wrap the light surface).
- **AC:** state `<select>` dropdown, autofill, and scrollbars match the light form.

---

## P1 — Images (CLS / LCP)

### IMG-1 · Add `width`/`height` to `<img>` · S
- `src/landing.js:42-45` (`photo()` helper — all landing images), `src/admin.js:3186`, `src/admin.js:3807`.
- **AC:** every `<img>` has explicit dimensions; no layout shift on load.

### IMG-2 · Primary product photo as real `<img>` · M
- `src/admin.js:3177` (lot hero), `src/admin.js:3803` (public lot hero) are CSS `background-image` — no `alt`, no dimensions, no LCP priority.
- **Fix:** above-fold `<img>` with `alt`, `width`/`height`, `fetchpriority="high"`.

---

## P1 — Motion & performance

### MOTION-1 · Honor prefers-reduced-motion · S
- `src/landing-motion.js:56-64,78-85` — cost-pin number scrub + feature-callout switching run regardless of `reduce`; under reduced motion snap the number to final and reveal all lines/features immediately.
- `src/request-wizard.js:264` — disable the `obShim` loading pulse under reduced motion.

### MOTION-2 · Compositor-friendly animation · S
- `src/landing-motion.js:83` & `src/landing-css.js:136` animate `width` (nav dots → use `transform:scaleX`); `src/landing-css.js:62` animates `padding` on scroll.

### PERF-1 · Remove scroll-handler layout thrash · M
- `src/landing-motion.js:59,72,75,79` — `getBoundingClientRect()` reads interleaved with writes each scroll frame. Move `.rv` reveals + `[data-count-to]` triggers to `IntersectionObserver`; batch remaining reads.

---

## P1 — Internationalisation

### I18N-1 · Consistent locale + Intl · S
- Hardcoded `en-US`: `src/admin.js:2369,3193,3809`, `src/market.js:230` → use `en-AU`.
- Manual date slicing: `src/admin.js:864,867,3815` → `Intl.DateTimeFormat`.

### I18N-2 · Autocomplete / spellcheck on inputs · S
- `src/admin.js:3742-3743` (name → `autocomplete="name"`; email → `autocomplete="email"` + `spellcheck="false"`), plus filter/code inputs `4803-4809`, `5200-5208`, `1249`.

---

## P2 — Polish

| ID | Item | Locations |
|---|---|---|
| POLISH-1 | Curly apostrophes in admin-authored copy (landing already uses entities) | `admin.js:3636,3655,3656,3564,3708,4769,4791,4812,5189,5193,5248,3788` |
| POLISH-2 | `aria-current="page"` on active tab/nav | `admin.js:4964,4741,3779` |
| POLISH-3 | `aria-hidden` on decorative spans/icons | `admin.js:4741,3779` (`.bar`), h2 search icons `3453,4800` |
| POLISH-4 | `scroll-margin-top` on anchor targets | `landing.js:213,222,240,315`; `admin.js:3452` (`#find`) |
| POLISH-5 | `tabular-nums` on market panel numbers (`.ob` scope doesn't inherit global rule) | `market.js:259,262,278` |
| POLISH-6 | `text-wrap:balance` on headings | `theme.js:129,135,247`; `request-wizard.js:208` |
| POLISH-7 | `overscroll-behavior:contain` + `env(safe-area-inset-*)` | drawers/scrollers `theme.js:332`, `admin.js:4027`, `request-wizard.js:246,267,337`; FAB `theme.js:380` |
| POLISH-8 | Semantic markup: section headers `<div class="rd-h">` → `<h2>/<h3>`; spec sheet → `<dl>`/`<table>` | `admin.js:2380,2394,…`; `admin.js:3810-3817` |
| POLISH-9 | Chart text alternative; `translate="no"` on brand/chassis codes; `touch-action:manipulation` on tap targets; comma placeholders on `type=number`; sign-out as `<button>` | `market.js:217-235`; various; `admin.js:3401-3402,5004-5005`; `admin.js:775` |

---

## Non-guideline note (flag to devs)

- `src/theme.js:426` — `infoPage` `opts.html` branch injects `message` unescaped. Safe while developer-controlled only; guard if it ever carries user input.

---

## Suggested sequencing

1. **Sprint 1 (P0):** BUG-1/2/3, A11Y-1/2/3, ACT-1 — group as two PRs (bugs, a11y).
2. **Sprint 2 (P1):** HEAD-1/2/3, IMG-1/2, MOTION-1/2, PERF-1, I18N-1/2.
3. **Backlog (P2):** POLISH-1…9 — batch into one "UI polish" PR.

Rough total: ~4 P0 (M) + ~9 P1 (mostly S/M) + polish batch ≈ **3–4 dev-days**.

---

## Confirmed passing (no action)

- No `user-scalable=no` / `maximum-scale` (zoom not disabled) · no `transition:all` · no `outline:none` without a focus replacement (rings paired at `theme.js:159`, `admin.js:259` etc.) · no inline-`onclick` navigation · click targets are real `<button>`/`<a>`.
- `tabular-nums` set globally on `body` (`theme.js:96`) — staff/portal inherit it.
- `prefers-reduced-motion` honored globally in staff/portal (`admin.js:562`) and for landing `.rv` reveals, count-ups, and hero/feat parallax.
- Wizard submit stays enabled until submit, then disables + shows a "Starting your search…" spinner label; `novalidate` correctly defers to JS validation across hidden steps.
- URL reflects state on staff tabs/pagination/search and the buyer auction search (GET forms with query params).
- `notFoundPage` and `infoPage` (`theme.js`) pass clean.
