# JDM Finder admin, design audit (Phase 5, step 1)

Scope: the staff admin rendered by `src/admin.js` plus the shared pieces it pulls in
(`src/auction-ui.js` for the Auctions workspace). Pages walked: dashboard, matches,
requests, request detail, tasks, clients, client detail, auctions (live / sold /
prices / watch / lot detail), payments, settings, plus the shared shell, client
drawer, row menus and table toolbars. This file is the map; nothing is fixed yet.

Line numbers refer to the state of the repo at commit 6f1b0bd.

---

## 1. Spacing

The shell and per-page CSS blocks use almost every integer from 1 to 44. Values
actually in use for padding / margin / gap in the admin surfaces:

1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 30, 32, 34, 40, 44, 60, 64

Conflicts, by area:

- Card padding: `.card` 24/26 (admin.js 248), `.rdcard` 17/18 (2557), `.acard`
  (dashboard) 16/18 (1723), `.chart-card` 18/20 (522), `.tstat` 11/15 (398),
  `.tk-stat` 14/16 (2713), `.pipe-card` 13/15 (1977), `.dw-card` 4/16 (4383),
  `.asrch` 20/22 (auction-ui 242), `.login-card` 34/32/30 (341). Ten different
  paddings for the same "card" idea. Target: 16 mobile / 20 desktop.
- Grid and list gaps: `.grid` 18/22 (256), `.mgrid` 22 (308), `.acards` 12 and 16
  (two different definitions, 512 vs 1722), `.scards` 16 (595), `.charts` 16
  (520), `.acgrid` 20 (auction-ui 287), `.pipe` 10 (1976), `.tk-strip` 12 (2712),
  `.rd` 18 (2554), `.dcols` 8/24 (551). Target: 12 mobile / 20 desktop.
- Section gaps: `.card` margin-bottom 24, `.list` 30, `.overview` 32 then 22 on
  the dashboard override (1719), `.charts` 32, `.tks` 22, `.psec` 30/16, banner
  24, flash 22. Target: 32 for section separation.
- Content padding: `.content` 32/40/60 desktop, 20 at 640px; `.topbar`
  30/40/26 desktop, 22/20 at 640px. Odd values (26, 30) off the scale.
- Micro-spacing: margins of 1, 2, 3, 5, 6, 7, 9, 11, 13 are scattered through
  chips, labels, stat blocks (e.g. label margin-bottom 7, `.mstats .v` margin-top
  5, `.subline` margin 6, h1 margin 12/6, kicker gap 10). None sit on the scale.

Rule for step 2: every spacing value becomes one of 4, 8, 12, 16, 24, 32 (plus
the two context pairs above). Anything else is an orphan and must be mapped.

## 2. Type sizes

Distinct font-size values found across the admin CSS blocks and inline styles:

9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 15, 16, 16.5, 17, 18, 19, 20, 21, 22, 24, 26, 27, 28, 30, 33, 34, 38, 42

That is 29 distinct sizes. Mapping to the new 6-step scale
(12 label / 13 secondary / 15 body / 17 section / 20 mobile title / 28 desktop title):

- 9, 9.5, 10, 10.5, 11, 11.5 (uppercase micro-labels: `.sc-k` 9, `.sc-landed-k`
  9.5, `.mstats .k` 10, `.tstat .k` 10.5, `.kicker` 11, `.mtk-k` 11, etc.)
  -> collapse to 12 uppercase label. Fractional sizes (9.5, 10.5, 11.5, 12.5,
  13.5, 16.5) all disappear.
- 12, 12.5, 13, 13.5 (help text, chips, subtexts, table headers, nav counts)
  -> 12 for uppercase labels and chips, 13 for secondary text.
- 14, 15, 16 (body, inputs, table cells, nav items) -> 15 body (13 where the
  text is clearly secondary).
- 16, 16.5, 17, 18, 19 (card h2 16, `.rd-name` 16.5, `.sec-h h2` 17, `.psec h2`
  18, `.sc-title` 19, `.dw-name` 18) -> 17 section title.
- 20, 21, 22, 24, 26, 27 (login h1 21, `.tstat .v` 22, `.tk-stat .n` 24,
  `.plv-grade-n` 26, donut mid 27) -> 20 (or stay as data numerals, see note).
- 28, 30, 33, 34, 38, 42: `h1` is 33 desktop AND mobile (admin.js 241; the
  640px media block never reduces it, so a phone gets a 33px page title).
  `.greet` 42 (30 mobile), `.ov .num` 38, `.mtk-n` 34, `.ld-grade-n` 34.
  -> page titles become 28 desktop / 20 mobile (the 33px mobile h1 dies).

Note: large data numerals (dashboard KPIs, ticker counts) are display figures,
not headings. They will sit on 28 (the top of the scale) rather than inventing
sizes; the 42px greeting is the one deliberate exception kept as the dashboard
hero and is deferred (see Deferrals).

## 3. Colour, gold used where it is NOT a primary action or a money figure

Legitimate gold (kept): `.btn-gold`, `.btn-notify`, `.btn-search`, `.bap`
(primary actions); `.sc-landed-v`, `.mland .ml-v`, `.ld-landed-v` money figures;
gold focus ring on inputs and buttons (action affordance).

Everything below is gold today without being an action or money:

1. `.nav a.active` gold tint background + gold bar + gold count (228-230).
2. `.kicker` gold text + gold rule (239-240).
3. `.card h2 .num` gold step numerals (250).
4. `.chip` default is a gold pill for arbitrary metadata like chassis codes (282).
5. `.avatar` gold tint + gold initials for every person (272).
6. `.yes` tick chip (273).
7. `.btn-toggle.on` gold (277), used for on/off state, not a primary action.
8. `.btn-link` gold text buttons (280).
9. `.acard .ah` gold header band on dashboard action cards (514).
10. `.acard .ab .link`, `.ovwrap a`, `.ov.gold .num` gold dashboard links/stats.
11. `.eng-viewed` engagement chip gold (2000), also used for BOTH Viewed and
    Interested in the client drawer (904-905), making the two states identical.
12. `.rstat-active` request stage chip gold (1988).
13. `.why .wc` match-reason chips gold (455).
14. `.mstats .s.gold .v`, grade cells `.sc-v.gold` gold for grade values (not money).
15. `.ghead .gh-sel`, `.quick button` gold select-all pills (433, 446).
16. `.rd-cta-gold`, `.rd-find`, `.rd-ct` request-detail quick actions and counts.
17. `.dw-sec .ct`, `.dw-str-good` drawer counts and strength chips.
18. `.cd-chip-gold` Member chip; `.cd-cta:hover`, `.dw-cta-b:hover` gold hovers.
19. `.ld-when`, `.ld-ai-read`, `.ld-ai-head`, `.sc-score.ai`, `.ld-ai` AI badges.
20. `.tks-help-x`, `.wledit summary`, `.sl-more summary`, `.set-disc summary`,
    `.sc-more` gold disclosure/text links.
21. `.mcard.picked` / `.scard.picked` gold selection border, `.msel` /
    checkbox accent-color gold, `.toggle:has(checked)` gold tint.
22. `.ac-photo` 2px gold bottom border on every auction card (auction-ui 290).
23. `.atbar-l` gold uppercase feed label (auction-ui 277).
24. `.av.on` gold view toggle, `.ac-fav.on` gold heart.
25. `.empty .rule`, `.awatch-empty .rule` gold hairline in empty states.
26. `.pausebar` uses bad-red but `.dupnote` uses gold banner for info notices.
27. `paymentsView badge()` inline-styled status pill with hardcoded gold/green/
    red hex values (1233-1235), an entirely ad hoc chip.
28. `#C9A34C` in `auction-ui.js` eligibility dot (314) and ALOT_CSS (4178), a
    TYPO of the brand gold #CAA34C.

Resolution rule for step 2-4: gold stays only on primary actions, money figures,
focus rings and brand chrome (logo, sidebar active state, kicker) where it is
identity rather than signal; every other use above moves to neutral ink/hairline
styling or to the correct signal colour. Green / amber / red are reserved for
health and urgency (health dots, overdue, closing soon, deposit states); an
`--info` blue joins the palette for engagement (Viewed) so it cannot collide
with health greens.

Other colour inconsistencies:

- Hardcoded signal hexes everywhere instead of tokens: #B11226, #C98A00,
  #C9821f, #1F7A4D, #2E7D54, #46B17A, #B6B9BC, #3B5E96, #6F86A6, #8a5e10,
  #15120A, #0B0D10, #15171a, #1C2027 (toasts), rgba(0,0,0,.05/.06/.10) ad hoc
  hairlines inside RD_CSS, drawer, rowmenu.
- Light hairline is rgba(0,0,0,0.10); target is rgba(0,0,0,0.08). Dark hairline
  rgba(255,255,255,0.08) already matches.
- Two parallel token sets for the same greens/ambers (--ok-bg/--ok-fg vs
  --str-bg/--str-fg vs --elig-bg/--elig-fg all define the same colours, 189-191).

## 4. Border radius

Values in use: 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 9999 (pills), 50%.
Tokens `--r:8px` and `--r-card:12px` exist (192) but most rules hardcode their
own number instead:

- Cards: 8 (`.card`, `.mcard`), 10 (`.mticker`, `.slegend`, `.bulkbar`), 11
  (`.pipe-card`, `.req-legend`, `.mt`), 12 (`--r-card`, `.tk-stat`, `.tks-help`,
  `.login-card`, `.dw-card`), 13 (`.acard` auction-ui), 14 (`.rdcard`, `.acard`
  dashboard, `.pipestrip`, `.asrch`, `.plv-hero`).
- Controls: 5 (`input`, `.btn-del`, `.btn-notify`), 6 (`.btn-dark`, `.share-pick`,
  `.signout`, `.nav a`, banners), 7 (`.msearch input`, `.fchip`, `.btn-skip`),
  8 (`.btn-gold`, `.rstat-sel`, toggles), 9 (`.side-search input`, `.rd-cta`,
  `.cd-cta`, `.dw-cta-b`, `.tbl-search`, `.tbl-export`, ranToast), 11
  (`.asrch-bar input`, `.asrch-go`).

Target: 10 for cards and containers, 8 for controls, 9999 stays for true pills,
50% stays for dots/avatars.

## 5. Chip and badge styles (how many visually different status chips exist)

Fifteen visually distinct chip/badge families render across the admin:

1. `.chip` gold metadata pill + `.chip.muted` (282-285), 11px.
2. `.b` + 9 tone classes `.b-ok/.b-warn/.b-neu/.b-str/.b-good/.b-pos/.b-elig/
   .b-echk/.b-eno` (564-575), 12px, radius 8 (not a pill).
3. `.rstat` + 6 tones (REQ_CSS 1986-1992), 11px pill, request stages.
4. `.eng .eng-viewed/.eng-sent` engagement (1999-2001), 11px pill; duplicated
   with different padding in the drawer (4397-4399).
5. `.cd-chip` + gold/ok variants, client-detail header (3448-3451).
6. `.dw-str` + strong/good/possible, drawer strength (4400-4403).
7. `.tk-pri` task priority pill (2626).
8. `.urg` / `.urg.soon` red/amber square tags (457-458).
9. `.sc-when` photo-overlay urgency tag (616-617) and `.ld-when` (678-679).
10. `.wc` / `.wx` why-chips (454-456) plus `.wc.lead`.
11. `.ov-chip` blue overseas chip (1994).
12. `.pill` photo overlay lot pill (312).
13. `.reqbadge` / `.paybadge` portal-style badges (359-360).
14. `paymentsView badge()` fully inline-styled span (1233-1235).
15. `.rd-ct` / `.dw-sec .ct` / `.tks-n` count pills (2559, 4389, 2721).

Critical duplication: `Interested` and `Viewed` in the client drawer both render
as `.eng-viewed` (904-905), so the two most important engagement states look
identical. Request-detail `matchTrackRow` maps Interested to `rstat-good` and
Viewed to `rstat-blue`, but `rstat-blue` IS NOT DEFINED in any stylesheet
(tone "blue" at 2191 has no matching `.rstat-blue` rule), so Viewed silently
renders unstyled there.

Step 3 target: ONE `.chip` component with tone modifiers (neutral, gold-for-
member/brand, good, warn, bad, info) and size handled by the component, covering
stage, engagement and member badges, with Interested (good/green) visually
distinct from Viewed (info/blue).

## 6. Button variants

Distinct interactive button styles found (excluding chips):

`.btn-gold`, `.btn-notify`, `.btn-search`, `.bap` (four gold primaries with
different paddings 11/22, 9/14, 13, 9/14 and radii 8, 5, 8, 6);
`.btn-dark` (radius 6), `.btn-line` (radius 9), `.rd-cta` (radius 9),
`.cd-cta` (radius 9), `.dw-cta-b` (radius 9), `.mt-btn` (radius 8),
`.tbl-export` (radius 9), `.ac-sheet` (radius 8), `.bsk` (radius 6),
`.asrch-go` (radius 11) - nine secondary/hairline styles;
`.btn-del` (radius 5) and `.bdel` destructive;
`.btn-skip`, `.btn-link`, `.bcl`, `.sc-more`, disclosure summaries - text buttons;
`.btn-toggle` (pill), `.fchip` (pill), `.quick button` (pill), `.gh-sel`,
`.plv-watch`, `.tk-box`, `.kebab` / `.rowmenu-btn` - specials.

No built-in loading or disabled states exist anywhere; the AI-read and bulk
forms hand-roll `b.disabled=true;b.textContent='...'` inline (2954, 3367).

Step 3 target: one button component (primary gold fill, secondary hairline,
destructive red text) with `.is-loading` and disabled states; legacy class
names remain as aliases so JS hooks and tests keep working.

## 7. The native confirm() dialogs (and friends)

Twelve distinct confirm sites (plus two alert() calls) ship today:

1. Clients list, share picker onchange: "Share this client with the selected
   agent?" (1807).
2. Clients list, owner reassign onchange: "Reassign this client..." (1820).
3. Clients bulk delete `jdmBulkDelete`: "Delete N selected clients and ALL
   their searches, matches and history?" (1859); plus alert() when nothing is
   ticked (1858, 1859).
4. Task delete (taskRow): "Delete this task?" (2175).
5. Request detail, mark lost: "Mark this request as lost?" (2496).
6. Wishlists view delete: "Delete this wishlist? This cannot be undone." (2769).
7. Matches bulk approve: "Approve and send the selected matches..." (3073).
8. Matches bulk skip: "Skip the selected matches?" (3074).
9. Matches bulk delete: "Permanently delete the N selected matches..." (3075).
10. Wishlist editor delete: "Delete this search? This cannot be undone." (3198).
11. Lot detail approve: "Approve and send this match to the client?" (3396).
12. Portal revoke: "Revoke this client's portal access..." (3580).

Plus the generic `rowMenu` confirm plumbing (4264) which feeds the client
delete (1839) and agent delete (1092) menu items through the same native
confirm(). All of these become one styled dialog component that states the
consequence of the action; the two alert() calls become the shared toast.

## 8. Toasts

Four independent inline toast implementations, no shared component:

1. `fixToast()` top-centre, #1C2027, radius 9, font -apple-system (2976).
2. `ranToast()` top-centre, radius 9, different max-width handling (2986).
3. `matchesScript` bottom toast, radius 8, `font:600 13px sans-serif` (3093).
4. `matchActionScript` bottom toast, duplicate of 3 (3114).

Target: one `jdmToast()` in the shell, used by all four call sites.

## 9. Sticky action bars

- `.save-bar` (settings) sticky bottom (304).
- `.bulkbar2` (matches) sticky top:60px, hardcoded dark #1C2027 even in the
  light content area (435).
- `clientBulkBar` (client detail, 3227) fully inline-styled flex row, NOT
  sticky, reuses `.bap`/`.bsk` without the bar.
- `.bulkbar` (clients list) plain card, not sticky (287).

Target: one sticky action bar component used by all four.

## 10. Miscellaneous inconsistencies

- Mobile header: burger row is 52px + topbar 22/20 padding + 33px h1 + subline;
  on a 375px phone the header eats ~180px before content. Target: 20px mobile
  title, tightened topbar padding on the spacing scale.
- `.topbar` is sticky on most pages but `unstick` on matches; heights vary
  because h1/subline sizes vary.
- Duplicated `.acards`/`.acard` definitions with different radii and gaps
  (513 vs 1722-1723); the dashboard one wins by order, the other is dead-ish.
- `.eng` chip defined twice with different paddings (1999 and drawer 4397).
- `.mcard` defined radius 8 in shell but `.scard` radius `--r-card` 12; cards
  in the same grid can differ.
- Copy contains em/en dashes in several places (`&ndash;`/`&mdash;` in the
  requests legend 1958-1960, literal em dashes in fixToast copy 2976, matches
  pause bar 2918, tasks help 2686-2694 and several comments), violating the
  house copy rule.
- Inline `style="..."` attributes carry orphan spacing values in ~40 places
  (e.g. `margin:-8px 0 16px`, `margin-top:18px`, `scroll-margin-top:80px`).
- Checkbox `label` at 1779 and 3217/3618 hardcodes `color:#3A3C3F`.

## Resolution log (Phase 5, steps 2 to 4)

Every section above is resolved unless it appears under Deferrals below.

1. Spacing: tokens `--sp-1..--sp-6` (4/8/12/16/24/32) plus `--pad-card`
   (20 desktop / 16 mobile) and `--gap-grid` (20 / 12) now drive the shell and
   every per-page CSS block (DASH2, REQ, RD, TASKS, CRM, drawer, table tools,
   ALOT, PLV, AUCTION). All inline style spacing was swept onto the scale; the
   only intentional negatives are -8px pulls that sit on the scale's magnitude.
2. Type: tokens `--fs-label/sec/body/sect/page` (12/13/15/17/28, page drops to
   20 under 640px). The 33px mobile h1 is gone. All 9 to 11.5px micro-labels
   collapsed into the 12px label token; fractional sizes are gone. Large data
   numerals sit on 28 (page token) or 20; the 42px greeting is deferred below.
3. Colour: gold now appears only on primary actions (btn-gold / btn-notify /
   btn-search / bap / rd-cta-gold / rd-find), money figures (landed cost
   values, mland strip, price lines), focus rings, and brand chrome (logo,
   sidebar active, kicker). Status/metadata gold (default chip, engagement,
   rstat-active, why-chips, AI badges, avatars, select-all pills, card header
   bands, auction card gold borders, view toggles) moved to neutral or the
   correct signal tone. Green/amber/red are reserved for health and urgency;
   `--info` blue was added for engagement (Viewed) and overseas markers.
   The #C9A34C typo is gone. Light hairline is rgba(0,0,0,0.08); ad hoc
   rgba(0,0,0,.05/.06/.10) hairlines now use `--hair`/`--hair-2`.
4. Radius: `--r-card:10px` and `--r-ctl:8px` everywhere; tiny overlay tags
   became true pills (9999) and dots use 50%. No 2/3/5/6/7/9/11/13/14 values
   remain in admin CSS (the 6px inner radius of the nested grid/list view
   toggle is the one nested-radius exception, see Deferrals).
5. Chips: ONE `.chip` component (12px, 600, pill) with tone classes
   chip-good / chip-warn / chip-bad / chip-info / chip-gold / muted. It now
   renders: request stages (statusBadge), deposit states, engagement cells,
   drawer stage + strength, client-detail header chips, task priority, the
   payments status pill (was fully inline-styled), overseas markers and the
   requests legend. Interested (green) and Viewed (info blue) are visually
   distinct everywhere. The `.b` dot-chip family shares the same metrics and
   is kept for photo-overlay strength badges.
6. Buttons: primary = gold fill (btn-gold/btn-notify/btn-search/bap),
   secondary = hairline (btn-dark/btn-line/rd-cta/cd-cta/dw-cta-b/mt-btn/
   tbl-export/ac-sheet/bsk, all on 13px/600, radius 8, shared hover),
   destructive = red text/border (btn-del/bdel). Built-in `:disabled` and
   `.is-loading` states ship in the shell and are used by the AI-read, photo
   fix and approve/skip flows. All buttons are 44px minimum on mobile.
7. Dialogs: `window.jdmConfirm` (styled, focus-trapped, Escape/scrim cancel,
   danger variant) replaces all 12 native confirm() sites plus the rowMenu
   plumbing; each message now states the consequence of the action. Forms use
   data-confirm attributes; selects use jdmConfirmSelect; the two alert()
   calls became toasts. The buyer-portal copy of the search-delete form keeps
   a native confirm because the portal shell does not load the admin UI kit.
8. Toasts: `window.jdmToast` is the single implementation; fixToast, ranToast
   and both per-page toast() helpers now delegate to it.
9. Action bars: `.actionbar` (sticky bottom) with `-end` (settings save bar)
   and `-inline` (client-detail bulk bar, which also gained proper confirm
   dialogs) variants; the matches `.bulkbar2` is the top-pinned variant built
   on the same tokens.
10. Copy: no em or en dashes remain anywhere in src/admin.js or
    src/auction-ui.js, in copy or comments (including the &ndash;/&mdash;
    entities in the requests legend and the \\u2014 in the WhatsApp share).
11. Verified in Chrome at 375px and 1440px on dashboard, matches, requests
    and client detail: zero horizontal overflow, 20px mobile / 28px desktop
    titles, 52px burger + ~114px topbar on mobile, 44px touch targets,
    card padding 20px and radius 10px computed at 1440px. npm test: 213 pass.

## Deferrals (explicit, with reasons)

- The 42px dashboard greeting (`.greet`) stays: it is the one intentional hero
  moment on the dashboard, reduced to 30px on mobile already; putting it on the
  28px scale would flatten the page hierarchy the client asked for in Phase 2.
- Brand chrome gold stays: the sidebar active state, the kicker rule and the
  logo are brand identity (the "keep the gold and dark brand" direction), not
  status signals; they are consistent and singular, so they do not fight the
  signal palette.
- Large data numerals (KPI counts) render at 28px, the top token, rather than
  a bespoke display size; the ticker/overview numbers that were 34-38px come
  down to 28.
- `theme.js` (customer-facing portal/brand shell) and the public request wizard
  are out of scope for this phase; only the staff admin surfaces change. Shared
  auction-ui.js is in scope because the staff Auctions workspace renders it.
- Portal-only classes that live in the admin CSS for legacy reasons (.reqbadge,
  .paybadge, .memcard) keep their look where they render on customer surfaces;
  where they appear inside the staff admin they adopt the chip component.
- Mobile inputs stay at 16px (off the type scale) because anything smaller
  makes iOS Safari auto-zoom on focus; this is a functional exception.
- The Google sign-in button (GOOGLE_BTN_CSS) keeps Google's own metrics and
  radius per their brand guidelines; it renders on login/onboarding only.
- The match-strength scale (Strong green / Good amber / Possible neutral)
  deliberately reuses the health palette: strength ranks how healthy a fit a
  lot is, and the same three tones now read identically on cards, chips,
  filter dots, the legend and the dashboard donut.
- The grid/list view toggle keeps a 6px inner radius nested inside its 8px
  container (a nested radius smaller than its parent is correct optics).
- One native confirm() remains in the buyer-portal copy of the search-delete
  form, because the portal runs on the brand shell which does not load the
  admin UI kit; the staff copy of the same form uses the styled dialog.
