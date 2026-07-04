# JDM Finder admin colour audit

Measured against live Linear, Attio and the real JDM Connect Stripe dashboard
in Chrome on 4 July 2026 (getComputedStyle histograms over rendered pages,
not brand guides). Scope: the staff admin (src/admin.js, src/auction-ui.js).
The public wizard, portal theme and Google button are out of scope.

## Step 1: measured reference palettes

### Linear (dark register)

- Text ramp, four steps, cool lean, never pure white for body text:
  #F7F8F8 primary, #D0D6E0 secondary, #8A8F98 muted, #62666D quaternary.
  Literal #FFFFFF appears only on filled buttons and the logo.
- Dark surfaces are layered, not flat: base #08090A (near black, never
  #000), raised steps measured at #0F1011, #101112, #121314, #161718.
  Hover and overlay washes are white alphas at 0.01 to 0.05.
- Accent (indigo #5E6AD2) appeared ONCE in a 4000 element sample of the
  page body. Accent is reserved for the primary action and active nav.
- Semantics are tints, not fills: rgba(39,166,68,0.07) success wash,
  rgba(243,78,82,0.10) danger wash; saturated colour lives only in small
  glyphs and dots.

### Attio (light register)

- Ink is near black with a cool (blue) lean, never #000:
  lab(10.7, -0.1, -1.5), approximately #1B1D20; headings also #242629.
- Muted ramp: #505155, #5C5E63, #75777C, #8F99A8, plus black alphas
  (rgba(0,0,0,0.55), 0.40) for quiet text.
- Backgrounds: cards ARE pure #FFFFFF; the page behind them is a cool
  off-white (#F4F5F6, #FBFBFB). Hairlines cool: about #ECEEF0 and #D6D9DD.
- Semantic tints are soft and pale with dark text: success mint #DDF9E4,
  danger tint #FFEBEB, info tint #E5EEFF with #183C81 text.

### Stripe dashboard (light register, money surface)

- Ink is a deep slate BLUE, not black: #1A2C44 primary (amounts at 600),
  #273951, #414552 headings, #3C4F69 secondary, #545969 and #87909F muted.
- Surfaces: #FFFFFF base, raised panels #F4F7FA and #ECF1F6 (cool).
- Accent violet #533AFD / #625AFA confined to active nav, links and the
  primary button.
- Status register: Succeeded / Refunded / Failed render as PLAIN slate
  text (#3C4F69), no fill at all. Only the danger state (Blocked) gets a
  pill: pale tint #FEF4F6 with saturated dark text #C0123C, radius 4.
  Saturation belongs to the text, not the background.

### Cross-reference conclusions

1. No pure black text anywhere; ink is near black (Attio) or deep slate
   (Stripe). Pure white is fine for CARDS in light mode; body text on dark
   is off-white, not #FFF.
2. Neutrals lean cool in all three products.
3. Dark mode is a surface LADDER (base, raised, overlay, hover wash),
   which the admin already has.
4. Semantics are pale tints with dark saturated text, or plain quiet
   text; solid traffic-light fills with white text appear in none of the
   three references.
5. Accent frequency approaches one per view.

## Step 2: current palette vs targets

Current tokens: src/admin.js :root (dark) and .main override (light).

| Item | Current | Gap vs reference |
|---|---|---|
| Light ink | #1B1C1E neutral | On register (Attio #1B1D20). No pure black anywhere. Pass. |
| Light page bg | #F4F4F1, off #F7F7F5, soft #F1F0EC | WARM (green-yellow) cast. All three references lean cool. The cream cast reads dated next to them; warmth should come from gold, not the chrome. |
| Light cards | #FFFFFF | Matches Attio/Stripe. Pass. |
| Light muted ramp | t2 #5B606A, t3 #6B7079, faint #656A73, ph #6C727C | Four tokens, three nearly identical values doing different jobs (muted text, disabled, placeholder). References use clearly stepped ramps. |
| Dark ink | #F4F2EC warm cream | Linear uses cool #F7F8F8. The cream is a brand signature next to gold; refine only slightly (de-yellow), do not neutralise fully. |
| Dark muted ramp | t2 #C9CCD1, t3 #9BA0A7, faint #888D95, ph #8A909A | faint and ph are near duplicates. Linear's ramp is cooler (#D0D6E0 / #8A8F98 / #62666D). |
| Dark surfaces | bg #0F1115, bg-2 #0A0C0F, card #171A20, card-2 #1C2027, off #13161B, field #1B1F26 | Real six-step ladder, cool lean. On register. bg-2 can drop to #090A0D per the measured Linear base. |
| Pure #FFF as text on dark/saturated fills | 15+ literals: .urg, .fchip.on.urgent, .ld-when.urgent, .bulkbar2 .bsk/.bdel, .pill, .mphoto .ttl, .ld-sheet-open, toasts, sendbar | References never use literal #FFF for text; Linear tops out at #F7F8F8. Needs one token for text on solid fills. |
| Solid semantic fills | .urg (solid red pill, white text), .urg.soon (solid amber), .fchip.on.urgent, .ld-when.urgent | Off register. Stripe's worst state (Blocked) is still a pale tint with dark saturated text. Traffic-light solids are the flat look the brief targets. |
| Semantic tints | ok-bg #E1F5EE, warn-bg #FAEEDA, bad-bg 6% alpha, str/elig family | Already tinted, close to Attio's register. warn-bg and neu-bg carry the same warm cast as the page bg. |
| Semantic text | good #1F7A4D, warn-c #C98A00, bad #B11226 | Saturation fine (Stripe Blocked text is #C0123C). warn-c #C98A00 on white is 3.3:1, below AA for small text where used as text colour. |
| Duplicated greys via hardcodes | #15171A x5 (image placeholder), #1C2027 (toast, duplicates card-2), #571622 x2 (error toast), #1F242B (sendbar select), #CFD0D2, #FF9A9A, #0B0D10 / #9AA3A0 / #8A5E10 etc in auction-ui.js | Token values re-hardcoded at point of use; same grey doing different jobs by copy-paste. Should reference tokens. |
| Gold restraint | 124 gold token refs | Flagship pass already restricted gold to primary actions, money, focus rings and brand chrome (sidebar active, kicker, progress dots, task tick, selection wash). Remaining item to verify at apply time: dashboard .ovwrap links (audit called for demotion to ink). Chip-gold Member stays as brand. |
| Info blue | #3B5E96 / #9FB4D2 | Slate blue, matches the Stripe direction. Pass. |

## Step 3: proposed refined tokens (await approval)

Gold #CAA34C, gold-hover, gold-tint, gold-line, gold-on: UNCHANGED.
Dark surface ladder: unchanged except bg-2. No layout changes.

### Light workspace (.main)

| Token | Current | Proposed | Why |
|---|---|---|---|
| --ink | #1b1c1e | #1A1D21 | one step cooler, matches Attio lab lean |
| --t2 | #5b606a | #545C68 | slate lean per Stripe #545969 |
| --t3 | #6b7079 | #6E7684 | cool step, clearly lighter than t2 |
| --faint | #656a73 | #6E7684 | alias of t3; kills the near-duplicate |
| --ph | #6C727C | #8A92A0 | placeholders one honest step lighter |
| --bg | #f4f4f1 | #F5F6F7 | warm cast out, cool per refs |
| --off | #f7f7f5 | #F8F9FA | same |
| --soft | #f1f0ec | #EFF1F3 | same |
| --field | #fbfbfc | #FBFCFD | hair cooler |
| --neu-bg | #F1EFE8 | #EFF1F3 | neutral chip loses the beige cast |
| --neu-fg | #444441 | #4A5260 | cool slate |
| --warn-c | #C98A00 | #9A6C00 | AA as text on white (4.6:1); dot stays vivid via --warn-dot if needed |
| --warn-bg | #FAEEDA | #FAF1DE | fractionally cooler |
| --good | #1F7A4D | unchanged | already register |
| --bad | #B11226 | unchanged | matches Stripe Blocked text |
| --info | #3B5E96 | unchanged | already register |

### Dark chrome (:root)

| Token | Current | Proposed | Why |
|---|---|---|---|
| --ink | #F4F2EC | #F4F4F0 | halve the yellow cast, keep brand warmth |
| --t2 | #C9CCD1 | #CBD1DB | cool per Linear #D0D6E0 |
| --t3 | #9BA0A7 | #99A1AE | cool step |
| --faint | #888D95 | #7F8894 | real step below t3 |
| --ph | #8A909A | #7F8894 | alias of faint; kills the duplicate |
| --bg-2 | #0A0C0F | #090A0D | toward measured Linear base #08090A |
| surfaces | bg/card/card-2/off/field | unchanged | ladder already on register |

### New shared tokens

| Token | Value | Job |
|---|---|---|
| --on-solid | #F7F8F8 | text on saturated or dark fills; replaces every literal #fff in admin scope |
| --media | #15171A | image placeholder background; replaces five hardcoded copies |

### Treatment changes (colour only, no layout)

1. Solid urgent pills (.urg, .urg.soon, .ld-when.urgent, .fchip.on.urgent)
   move to the Stripe Blocked treatment: pale tint background, saturated
   dark text, hairline border. Solid fills with white text disappear.
2. Toast and dialog hardcodes (#571622, #1C2027 in the fallback toast and
   .jdm-toast.err) move onto tokens (--card-2, --bad family).
3. auction-ui.js hardcoded duplicates (#0B0D10, #9AA3A0, #1F7A4D, #C98A00,
   #8A5E10, #15120A) re-point at tokens.
4. Literal #fff text in admin scope becomes var(--on-solid); light-theme
   card whites stay #FFFFFF by reference (cards are white in Attio and
   Stripe).
5. Verify at apply time: dashboard .ovwrap gold links demote to ink per
   the original audit; msel/scard.picked gold selection stays (brand).

Contrast spot checks for the proposal (computed): ink on bg 15.9:1, t2 on
bg 7.7:1, t3 on card 5.6:1, ph on field 3.4:1 (placeholder only), warn-c
text 4.6:1, on-solid on bad #B11226 6.6:1. All AA for their roles.

## Step 4 (pending approval)

Apply the table above as a token-value change plus the four treatment
changes, verify live at 1440 and 375 in Chrome for contrast regressions,
npm test green, commit locally, no push.
