# JDM Finder admin redesign: forensic audit and register targets

Scope: the staff admin rendered by `src/admin.js` plus `src/auction-ui.js` (the
Auctions workspace). This document drives the overhaul; DESIGN-AUDIT.md remains
the Phase 5 record and this file audits what exists AFTER that phase, at commit
eac40b8 (all line numbers below refer to that commit).

Reference register: Linear (Matches, Requests: calm dense lists, one accent,
no noise), Attio (Customers, client detail: premium CRM list and record),
Stripe (Payments and every money figure). Brand gold #CAA34C and the dark
sidebar stay. Section "Measured reference targets" is filled from real
screenshots before any flagship work; every flagship decision cites a measured
target, not a vibe.

State of play: the Phase 5 token system exists and largely holds
(`src/admin.js:208-219`: spacing 4/8/12/16/24/32, card padding 20/16, gaps
20/12, type 12/13/15/17/28 with 20 mobile, radius 10/8, hairlines 0.08, one
chip, one action bar family, `window.jdmToast` + `window.jdmConfirm`). The
audit below is the delta: what the origin/main merge (e0a968b) and the dealer
category commit (eac40b8) reintroduced, plus everything that separates
"consistent" from "premium".

---

## Per page

### Dashboard (`dashboardView` 1678, DASH2_CSS 1874)
- Purpose: morning triage; answer "what needs me today" and jump there.
- Core task: open the most urgent queue. 1 tap (attention card link), 1 load.
- Spacing: on scale; `.attn` margin 0 0 4px, `.pipestrip` margin 16px 0 4px.
- Type: 42px `.greet` (deliberate hero, kept), 28px `.ac-n` numerals, rest on
  tokens.
- Gold: `.acard-gold` border on the Matches attention card (status-ish but
  reads as brand emphasis on the primary queue, keep), sidebar active, links
  `.ovwrap a` gold text (metadata link, demote to ink on hover per Linear).
- Chips: none rendered directly; stat numerals only.
- Worst problem: three stacked band types (overview strip, attention cards,
  pipeline strip) each with their own numeral treatment; the page reads as
  three designs. One `.stat-n` treatment fixes it.

### Matches (`matchesView` 3247, `matchCard` 3089, shell scard styles 677-749)
- Purpose: review scored auction lots and approve/skip, the money surface.
- Core task: approve one match. 1 tap (AJAX to /decide, card clears in place;
  no JS: 2 loads via /decide/confirm). Bulk approve: select N + 1 tap + dialog.
- Spacing: card internals on tokens, but the control stack is four bands
  (search row, fchips, quick triage row, sticky bulkbar2) before any car shows.
- Type: `.tstat .v` 20px numeral; card carries FOUR uppercase micro-label rows
  (sc-grid cells, specline, sc-scores, why chips) all at 12px caps.
- Gold misuse: filter chip "Good" dot hardcoded #CAA34C (3314) while the
  ticker "Good" dot is var(--warn-c) (3294): the same strength is gold in one
  control and amber in the next. Strong/Possible dots hardcode #46B17A /
  #B6B9BC (3313, 3315). Gold correctly on Approve and landed cost.
- Chips: strength `.b` pills, urgency `.sc-when`, why `.wc`, scores
  `.sc-score`, lead `.wc.lead`: five chip families on one card.
- Worst problem: element density. A card stacks image tags + title + sub +
  4-cell spec grid + scores + view-details link + why chips + client strip +
  no-contact warning + 2-CTA row: eleven visual clusters. Linear register
  demands one spec line and three signals (strength, landed, close date).

### Requests (`requestsView` 2141, REQ_CSS 2208)
- Purpose: pipeline of customer requests (wishlist rows) by stage.
- Core task: change a request's stage. 1 interaction (row select onchange
  posts), 1 load. Open a request: 1 tap.
- Spacing: on scale.
- Type: `.pc-n` 20px numerals; table on tokens.
- Gold: none stray (statusSelect is neutral). Good.
- Chips: statusBadge (one chip, tones), engagementCell chip-info, deposit
  chips, `chip muted` placeholders, health dots. Coherent.
- Worst problem: an 11-column table (Request, Customer, Vehicle, Destination,
  Budget, Status select, Examples, Deposit, Owner, Last activity, kebab) plus
  a permanent 6-item legend card. Attio register: fewer columns, quieter row,
  legend behind a disclosure.

### Request detail (`requestDetailPage` 2652, RD_CSS 2815)
- Purpose: single request workspace: status, deposit, tasks, matches, timeline.
- Core task: log a note / advance status. 1 interaction + 1 load.
- Spacing/type: on tokens; three-column 288/1fr/340 grid.
- Gold: `.rd-cta-gold`, `.rd-find` primaries (correct); step dots
  `.rd-done/.rd-now` gold (progress state, not action: acceptable as brand
  chrome, keep singular); `.rd-open` gold link.
- Chips: statusBadge + depositBadge + task priority via `.chip`; match track
  rows use chip tones. Coherent.
- Worst problem: dense but coherent; weakest part is the match-track rows
  (`.mt`) which are a sixth list-row pattern. Move to `.lrow` metrics.

### Tasks (`tasksView` 2930, TASKS_CSS 2979)
- Purpose: follow-up task board (overdue / today / upcoming / done).
- Core task: tick a task done. 1 tap (form post), 1 load.
- Spacing/type: on tokens; `.tk-stat .n` 20px numeral.
- Gold: `.tk-box.on` gold tick (state, but singular and brand-consistent,
  keep), `.tks-help-x` gold disclosure.
- Worst problem: none structural; inherits `.stat-n` and typography treatment.

### Customers (`clientsView` 1952)
- Purpose: the CRM list; find a client, see warmth, manage ownership.
- Core task: open a client. 1 tap (or drawer preview via avatar link).
  Reassign owner: select + styled confirm, 1 load.
- Spacing: header row margin-bottom:2px, archived note 14px, help 10px 2px 0:
  orphans.
- Type: archived toggle 12.5px (2044), footer help 12px inline.
- Gold: hardcoded #9a7b2e empty-state links (2021, 2062).
- Chips: Dealer = chip-info blue (2003), colliding with engagement blue;
  `chip chip-on` class rendered for shares/cat tabs but `.chip-on` is NOT
  DEFINED in any stylesheet (1968, 2047): active category tab and share chips
  silently render as default chips.
- Worst problem: two live select forms per row (Owner, Share) make every row
  a form cluster; 10 columns. Attio register: identity + a few quiet columns,
  management actions in the row menu and drawer.

### Client detail (`clientDetailPage` 4082, CRM_CSS 4068)
- Purpose: the customer record: identity, engagement, searches, cars, feed.
- Core task: send/find a car for this client. 1 tap to #find + search.
- Spacing: inline margin-top:18px (4294), margin:-8px pulls (4241, 4318,
  4344), scroll-margin-top:80px (4316); avatar inline 46px/15px (4172).
- Type: `.cd-stat-n` 20px numeral (fifth independent definition).
- Gold: Member chip-gold (brand, correct); engagement strip numerals neutral.
- Chips: header uses Dealer chip-info (same collision), Member chip-gold,
  Portal chip-good, destination muted.
- Worst problem: the record header is close to Attio but everything below is
  cards-of-cards with equal visual weight; no clear primary column vs side
  rail rhythm like the request detail has.

### Auctions workspace (`adminAuctionsPage` 6352, `staffFindCard` 6317,
`staffSendBar` 6211, auction-ui.js)
- Purpose: live auction search, sold-price history, watches; queue/send lots.
- Core task: send selected lots to a client. Select N + 1 tap + dialog.
- Spacing: sendbar has its own gap 10 / padding 9-30-9-11 / margin 10 system.
- Type: 11.5px qbadge (6202, 6227), 13px/13.5px sendbar text (6231-6233).
- Gold misuse: "Queued" status badge in gold tint (6201): status, not action.
- Chips: qbadge/qbadge-js are a parallel inline-styled chip family.
- Worst problem: `staffSendBar` is a fifth action bar: hardcoded #15181D
  pill, radius 14, its own select styling, unrelated to `.actionbar` and
  `.bulkbar2`. Rebuild on tokens, keep ids/behaviour (tests hook sendBar).
- auction-ui.js is near-clean: 16px title (263), 6px gaps (305, 314), 3px
  toggle internals (284, documented nested exception), 52px empty padding
  (338).

### Payments (`paymentsView` 1366)
- Purpose: money collected, deposits outstanding; the trust surface.
- Core task: mark a deposit paid. 1 tap + 1 load.
- Spacing: `margin-top:26px` (1415, off scale), section headers via `.psec`
  (a class with no CSS definition on this page, renders as bare h2).
- Type: session-id copy button inline 11px (1381).
- Gold: none stray. Money figures are ink weight-600 (1386) not the money
  treatment; "Amount" column is LEFT aligned (Stripe register: right-aligned
  tabular figures).
- Chips: status via the one chip component (correct).
- Worst problem: the money column does not read as money: left-aligned,
  no tabular alignment down the column, currency and figure identical weight.
  Stat tiles reuse the generic triage look rather than a money treatment.

### Settings / Agents (`settingsView` 1250, `agentsView` 1200)
- Purpose: config; agent management.
- Core task: toggle a setting + Save (sticky save bar). 1 tap + save.
- Spacing: inline margins 0 0 16px / margin-top 16px repeated 12 times
  (1283-1346) instead of a section rhythm class; help notes 12px inline.
- Gold: `.btn-toggle.on` gold (on/off state, not action: acceptable as the
  single toggle affordance, keep but confirm contrast).
- Worst problem: settings sections are hand-spaced with inline styles; the
  save bar is correct (`.actionbar-end`).

### Shell, drawer, login, uxGuard kit
- uxGuard toast/dialog off token: toast 13.5px radius 9 hardcoded #1C2027 /
  #571622 and its own font stack (5043-5044); dialog radius 14, 14.5px
  message, 13.5px buttons radius 9, gap 10, margin-top 18, hardcoded #15120A
  and #B11226 (5046-5052). The kit must exemplify the system it enforces.
- Mobile card rows `.mcl-*`: 14.5 / 12.5 / 11.5px, radius 12, 3/5/6px gaps
  (441-447).
- Login/set-password: margin-top 14px (1451, 1478), 12.5px help (1477),
  h1 20px hardcoded (394, correct value, should be a token reference).
- Em dashes back in copy/comments: admin.js 30, 1956, 2433, 5314;
  matcher.js 144. House rule: none, anywhere.
- `.chip-on` referenced but undefined (1968, 2047).
- nav-burger 14px label (422), `.pwrap` gap 9px (414), `.portal-acct .pa-k`
  12px hardcoded (413).

---

## Cross-cutting resolutions

1. One strength palette. Strong / Good / Possible each get exactly one colour
   token used by ticker dots, filter chips, card badges, legend and the
   matcher display map. matcher.js changes are limited to the display colour
   constant (line 96) and the em dash in a comment (line 144); matching logic
   is untouched and matching tests must pass unchanged, else the matcher.js
   edit is reverted entirely.
2. Gold only for: primary actions, money figures, focus rings, brand chrome
   (logo, sidebar active, kicker, request-detail progress dots, task tick).
   Removed from: Queued status badge, "Good" strength dot, empty-state link
   hexes.
3. Blue (--info) only for engagement/info. Dealer becomes a neutral outlined
   chip. Define the missing `.chip-on` as the selected-tab treatment (ink
   border, ink text) used by category tabs and share chips.
4. One 20px data numeral rule `.stat-n` replaces the five per-page
   definitions (tstat, tk-stat, pipe-card, cd-stat, dw counts keep 20px).
5. One action bar family: `.actionbar` (sticky bottom) / `-end` / `-inline` /
   `.bulkbar2` (top-pinned) / new floating variant for `staffSendBar`, all on
   tokens.
6. qbadge family folds into the chip component.
7. All off-scale inline values in section A above move onto the scale.

## Typography treatment layer (values; calibrated against measured targets)

Premium lives in weight, spacing and leading, not the size scale alone.
Tokens added to :root and consumed site-wide:

- `--w-label:500` `--ls-label:0.06em`: 12px uppercase labels drop from mixed
  600/700 to 500, slightly positive tracking, colour --t3.
- `--w-value:600`: the value a label describes is semibold ink. Label-light /
  value-semibold is the core contrast.
- `--ls-title:-0.01em` on 17px section titles (weight 600);
  page titles stay 600 at -0.015em, line-height 1.1.
- `--ls-num:-0.02em` weight 700 tabular-nums on 20/28px numerals (.stat-n).
- `--lh-body:1.5` for 15px body; `--lh-list:1.45` for 13px dense list rows.
- Chips drop to weight 500.

## Measured reference targets (measured in Chrome, 3 July session)

Probed with getComputedStyle on live DOM: the Linear app demo issue list
(dark), the Attio product data page (light), and the real JDM Connect Stripe
Transactions table (light, read only). Raw probe JSON is preserved in the
session transcript; values below are the design-driving subset.

### Linear issue list (register for Matches)

- Row: 40px tall, no border, transparent background, padding 0 24px 0 32px,
  zero gap between rows. Separation is hover only.
- Issue id: 13px, weight 400, muted rgb(138,143,152), tracking -0.13px.
- Title: 13px, weight 510, ink rgb(208,214,224), tracking -0.13px.
- Property labels (status, priority): 12px, weight 510, muted.
- Elements per row: about 14 leaves total, of which one id, one title,
  3 leading icons, 4 trailing property icons, one date. One line, no wraps.
- Sidebar rows 28px at 13px/510, padding 0 6px; active row background
  rgba(255,255,255,0.04) only.
- Group headers 12px, weight 510.
- Detail title: 20px, weight 590, tracking -0.24px, line-height 1.33.
- Accent frequency in the list body: zero. Colour appears only inside status
  and priority glyphs.

### Attio records and record card (register for Customers, Requests)

- Card: white, 1px hairline border (approx #EBEDF0), radius 12px, flat
  (no shadow of consequence).
- Card title: 14px, weight 600, tracking -0.22px.
- Attribute rows: 30px tall, 12px weight 500, padding 6px 12px 5px, 1px
  bottom hairline per row.
- Table heads: 12px, weight 500, muted slate (approx #4A5563).
- Chip anatomy: 12px weight 500, radius 8, padding 1px 5px, tinted fill
  #E5EEFF with 1px border #D6E5FF and dark text #183C81. Tint plus border
  plus dark text at weight 500; never a saturated fill, never bold.
- Sidebar rows 28px at 14px/500, tracking -0.28px.

### Stripe payments table (register for Payments and all money)

- Row: 36px tall.
- Amount cells: 14px, weight 600, tabular-nums, right aligned, ink
  rgb(26,44,68).
- Amount column head: 12px, weight 600 to 700, right aligned to match, muted
  slate rgb(60,79,105).
- Status text: 14px, weight 400, muted slate rgb(60,79,105), sitting in a
  soft tint pill. Status is the quietest thing on the row; the amount is the
  loudest.
- Not captured before the session ended: exact cell horizontal padding and
  hover background (Chrome session lost). Derived working values, marked as
  derived: vertical padding approx (36 - 19) / 2 = 8px; hover treated as a
  2 to 4 percent ink wash per the Linear measurement.

### Cross-register conclusions the flagships must obey

1. Dense rows are 36 to 40px, separated by hover or a single hairline,
   never card-per-row.
2. Titles are 13 to 14px at weight 500 to 600 with slight negative tracking;
   ids and secondary text are weight 400 muted. Nothing in a list row is 700.
3. Meta and heads are 12px weight 500 (600 max for table heads).
4. Money is 14px semibold tabular right aligned in near-black ink; money is
   the visual peak of a payments row.
5. Status is quiet: weight 400 to 500, tint plus dark text, no saturated
   fills, no bold caps.
6. Accent (gold) frequency in any list body: at most one accent element per
   row, and only when it is the primary action or money.

## Money integrity checklist (verified alongside the Stripe treatment)

Every rendered money figure and the input that must feed it:

- Payments amounts (1386): `payments.amount_cents` (Stripe source of truth).
- Landed figures `sc-landed-v` / `mland .ml-v` / `ld-landed-v`: snapshotted
  `lot._landed.grandTotal`, which must be computed from expected/average
  price, never `lot.start` or a placeholder.
  RESOLVED 4 July: calc.js lotJpy preferred the start bid; it now prefers
  the market average with start as the only fallback (fix commit, separate
  from styling). Scoring's lotPrice is untouched.
- Card "Bid" (matchCard 3097) uses `lot.start` falling back to `avg_price`;
  staffFindCard "Auction est." (6322) the same. These are bid displays, not
  landed inputs, but the landed pipeline input is verified in calc.js.
- Sanity check: three real cars (cheap / mid / expensive) rendered and
  compared against JPY value x configured rate. Wrong inputs are reported and
  fixed as fix commits, separate from styling.
