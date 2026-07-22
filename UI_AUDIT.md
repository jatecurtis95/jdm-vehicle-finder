# JDMFinder UI / Visual Consistency Audit

Audit date: 2026-07-21  
Scope: static inspection of the current working tree. No authenticated browser screenshot pass was performed.

## Executive summary

The UI has a recognizable design language—dark brand surfaces, a light operational workspace, gold primary actions, compact chips, responsive cards, and a shared confirm/toast system. The inconsistency comes from implementing that language several times. Staff admin, shared brand pages, request wizard, auction UI, landing page, buyer portal, and dealer views each carry overlapping CSS and markup conventions. The result is not uniformly poor; it is locally polished but globally drifted.

The three most visible problems are:

1. **Button families and states are fragmented.** The grey “Send all” button and undefined dealer `.btn-outline` links are concrete examples.
2. **Focus/disabled/loading coverage is maintained by allow-lists.** New controls easily miss feedback because every class must be remembered.
3. **Some error/empty/confirmation states are either absent or misleading.** Bulk delivery is the most serious: the toast can say everything was sent when persisted rows are `failed`.

## Build and test context

Wrangler's dry build succeeds with a 1005.01 KiB raw/283.99 KiB gzip Worker bundle. There are no CSS compiler warnings because CSS is emitted from JavaScript strings rather than processed by a CSS build pipeline. The current suite has 29 failures, including dealer-shell, dashboard, public route, landing, and auction UI expectations. Those failures materially limit any claim that all screens are currently polished.

## Core component inventory

| Element | Current implementation | Assessment |
|---|---|---|
| Primary buttons | `.btn-gold`, `.btn-notify`, `.bap`, `.rd-cta-gold`, landing/wizard variants | Multiple overlapping implementations |
| Secondary buttons | `.btn-dark`, `.btn-line`, `.bsk`, `.btn-toggle`, `.btn-outline` usages | Fragmented; `.btn-outline` undefined |
| Destructive buttons | `.btn-del`, `.bdel`, dialog danger button | Mostly coherent but not universal |
| Cards | `.card` in theme and admin plus `scard`, `rd-*`, dealer, auction and landing cards | Shared concept, many one-off layouts |
| Inputs/selects | Global theme rules plus admin and feature-scoped overrides | Generally usable, state drift possible |
| Badges | `.chip`, `.pill`, status/eligibility/dealer-specific badges | Too many parallel variants |
| Dialogs | Central `jdmConfirm` plus browser-native confirmation remnants | Good shared base, incomplete adoption |
| Toasts | Shared `jdmToast` plus query-string flash messages and inline success text | Multiple delivery mechanisms |
| Loading states | Per-control text/class mutations and disabled allow-list | Inconsistent |
| Empty/error states | `.empty`, `infoPage`, route flashes, silent omissions | Coverage varies by view |

## Findings

### U1 — Group “Send all” uses the wrong visual component

**Impact:** High  
**Effort:** Small

The group control renders as `class="bap gh-send"` (`src/admin.js:3947`). `.bap` is a bulk-bar action style, while the per-card send action uses `.btn-notify`. `.gh-send` adds only `white-space: nowrap` (`src/admin.js:3988`). The grey appearance is therefore not a client-email-paused condition and not inherently a disabled state; it is class selection/cascade drift.

Long client names can also expand the button because it lacks a maximum width and text overflow behavior.

Recommendation: use one deliberate primary small-button variant and constrain the label with `max-width`, `overflow:hidden`, `text-overflow:ellipsis`, and an accessible full-name label/title.

### U2 — Three `.btn-outline` links have no definition

**Impact:** High  
**Effort:** Small

The dealer portal sign-out, dealer account review link, and submission-management link use `.btn-outline` at `src/admin.js:8090`, `8140`, and `8160`. No matching CSS rule was found. They render as plain inherited links and can appear broken.

Recommendation: replace with the established secondary variant appropriate to each shell or define one tokenized outline component once.

### U3 — Shared class names do not guarantee shared appearance

**Impact:** High  
**Effort:** Medium

Examples:

- `.btn-gold`: theme uses weight 700, `12px 22px`, radius 8; admin uses weight 600, `12px 24px`, token radius.
- `.btn-dark`: theme combines it with `.btn-notify`; admin defines a separate soft button.
- `.chip`: theme defaults gold; admin defaults neutral soft gray.
- `.pill`: theme uses radius 5 and blur 3; admin uses a fully rounded pill and blur 2.
- `.card` and `.empty` use different padding/radius/color conventions.

These differences may be valid shell variants, but using identical global class names makes the differences accidental and hard to reason about.

Recommendation: centralize tokens, then name intentional variants (`button--primary`, `button--secondary`, `chip--status`) or scope shell-specific rules explicitly.

### U4 — Focus visibility uses a brittle class allow-list

**Impact:** Medium/High  
**Effort:** Small

Admin focus styling enumerates `.btn-gold`, `.btn-dark`, `.btn-toggle`, `.btn-link`, `.kebab`, `.nav a`, and `.fchip` (`src/admin.js:323`). This omits controls such as `.btn-notify`, `.btn-skip`, `.btn-line`, `.btn-del`, `.bap`, `.bsk`, `.bdel`, `.bx`, `.gh-fold`, row-menu summaries, and feature-specific buttons unless they receive another rule.

Recommendation: add shell-level `:where(a,button,input,select,textarea,summary):focus-visible` rules, then override only where necessary.

### U5 — Disabled/loading feedback is also an allow-list

**Impact:** Medium/High  
**Effort:** Small

The disabled selector includes a subset of control classes (`src/admin.js:325`). Client scripts add `disabled` or loading text to more controls than this list covers. A new button can become inert without looking inert.

Recommendation: establish default `button:disabled`, `[aria-disabled="true"]`, and `.is-loading` behavior per shell, including opacity, cursor, pointer events, and a non-color cue. Preserve the control width when text changes to “Sending…”.

### U6 — Bulk success feedback is visually and factually misleading

**Impact:** Critical  
**Effort:** Medium

Bulk client JavaScript announces `Sent N` based on selection count. The server swallows per-client failures and returns no result, while failed rows are written as `failed`. This is a combined flow/UI defect: the confirmation state can contradict the database.

Recommendation: return structured results, display sent/failed counts, keep failed cards visible, and offer retry. Never remove a card based only on request completion.

### U7 — Hover/active coverage is uneven

**Impact:** Medium  
**Effort:** Small

Primary and some standard controls have hover/active feedback. Bulk controls have active styling but not a complete shared hover treatment; `.gh-fold`, `.bx`, and several local controls rely on local or browser defaults. The result is uneven perceived clickability.

Recommendation: define a state matrix for primary, secondary, quiet, and destructive controls: default, hover, focus-visible, active, disabled, loading.

### U8 — Confirmation adoption is incomplete

**Impact:** Medium  
**Effort:** Small

The shared `jdmConfirm` dialog is a good foundation and many forms use `data-confirm`. However:

- the Payments table “Mark paid” form at `src/admin.js:1637` has no confirmation;
- dealer Approve/Reject forms at `src/admin.js:8158` have no confirmation;
- at least one buyer-search delete form still uses native `confirm()` (`src/admin.js:4394`).

Recommendation: route all consequential actions through the shared dialog and add manual keyboard/focus verification.

### U9 — The shared confirm dialog needs explicit focus-management verification

**Impact:** Medium  
**Effort:** Small/Medium

The dialog uses `role="alertdialog"` and `aria-modal="true"` (`src/admin.js:5808`), which is good. Static inspection alone does not prove that focus is trapped, initial focus is sensible, Escape closes, and focus returns to the triggering control for every invocation.

The customer drawer has stronger dialog semantics, including `tabindex`, `hidden`, and `inert` (`src/admin.js:5918`). Gallery/lightbox behavior should use the same rigor.

### U10 — Empty/error/loading coverage varies by screen

**Impact:** Medium  
**Effort:** Medium

Strong coverage exists for many tables and forms through `.empty`, flash messages, `infoPage`, and top-level branded exception handling. Gaps or concerns include:

- failed matches are omitted rather than shown as a designed recoverable state;
- some dashboard sections disappear when queries return nothing, making “no data” indistinguishable from “failed to load”;
- admin search and provider-backed auction pages depend on catch behavior rather than consistently scoped error panels;
- asynchronous chunks/drawers need explicit loading and retry states, not only empty HTML.

Recommendation: document four states per main view—loading, empty, error, success—and render a visible, non-technical outcome for each.

### U11 — Dealer UI currently has regression evidence

**Impact:** High  
**Effort:** Medium

The suite currently fails tests for dealer navigation, photo/lifecycle support, public visibility, review evidence/confirmation, approval email behavior, missing-submission handling, and the shared branded shell. These are not merely subjective visual differences.

Recommendation: settle the intended dealer route/shell first, update implementation or tests deliberately, and do not polish CSS over a broken lifecycle.

### U12 — Responsive foundations are good, but long labels remain risky

**Impact:** Medium  
**Effort:** Small

The code contains numerous responsive grids, `min-width:0`, mobile card alternatives, and 44/48px target sizes. Remaining risks include nowrap action labels, long client names, dense dealer action rows, and fixed sidebar/topbar patterns. The group-send control is the confirmed overflow example.

Recommendation: use `min-width:0` on flex children, ellipsis for variable labels, and test at 320, 375, 768, and 1280px with long names and translated-length copy.

### U13 — Accessibility is better than the original notes imply, but incomplete

**Impact:** Medium  
**Effort:** Small/Medium

Positive evidence includes skip links, many `aria-label`s, labeled dealer controls, dialog roles, minimum touch heights, and reduced-motion handling. Remaining work:

- blanket focus-visible coverage;
- dialog/lightbox focus trapping and return;
- confirm all icon-only controls have names after rendered composition;
- ensure background-image vehicle photos have meaningful adjacent text/labels;
- verify contrast for faint text in both light and dark shells with a tool.

### U14 — Dead UI candidates should be verified, not assumed

**Impact:** Low  
**Effort:** Small

`.reqok*`, `.pricegrid`, `.gate*`, `.cta-import*`, and `.ghead*` appear definition-only in current source. Delete them only after generated-page searches/tests. Earlier blanket lists included `.kebab`; the kebab icon remains part of row actions, so selector-level and component-level liveness must be distinguished.

### U15 — Microcopy mixes client/customer, car/vehicle, and sent/approved

**Impact:** Low/Medium  
**Effort:** Small

The product uses “customer” in the staff directory, “client” in delivery copy and code, and both “car” and “vehicle” across actions. More importantly, “Approved and sent” can be emitted when delivery is disabled or the client has no usable channel.

Recommendation: choose staff-facing and buyer-facing terminology deliberately. Reserve “sent” for a confirmed accepted channel; otherwise say “approved” or “marked handled.”

## View-state matrix

| View family | Empty | Error | Success | Loading | Main concern |
|---|---:|---:|---:|---:|---|
| Dashboard | Partial | Partial | N/A | Server-rendered | Current tests fail; silent section omission |
| Customers/requests | Good | Mostly branded | Flash/toast | Server/chunk mixed | Multiple local action variants |
| Matches | Good for pending | Failed state hidden | Misleading bulk toast | Local button states | Delivery recovery |
| Payments | Good | Generic | Stripe state chips | Server-rendered | Unconfirmed “Mark paid” |
| Settings | Good | Flash/action wrapper | Flash | Per-button | Test email is functionally broken |
| Auctions | Provider fallbacks exist | Mixed | Add/request feedback | Provider-backed | Current rendering tests fail |
| Buyer portal | Good | Query flags/info pages | Redirect/flash | Server-rendered | Terminology and CTA regressions |
| Dealer portal/admin | Basic empty states | Mixed | Flash | Server-rendered | Multiple current test failures |
| Landing/request | Designed | Wizard errors | Confirmation page | Client enrichment | Current public/landing tests fail |

## Ranked cleanup plan

| Rank | What to do | Why | Effort | Break risk | Visual impact |
|---:|---|---|:---:|:---:|:---:|
| 1 | Fix dealer/dashboard/public UI regressions represented by failing tests | Current UI baseline is not trustworthy | M | Low/Med | High |
| 2 | Make bulk delivery results truthful and failed rows recoverable | Prevents a false-success experience | M | Med | High |
| 3 | Replace/fix the three undefined `.btn-outline` usages | Confirmed visibly broken controls | S | Low | High |
| 4 | Replace `bap gh-send` with the intended primary variant and ellipsis | Fixes the known grey-button/overflow defect | S | Low | High |
| 5 | Add blanket focus-visible and disabled/loading defaults | Closes many state gaps at once | S | Low | High |
| 6 | Complete adoption of the shared confirm dialog | Removes inconsistent dangerous actions | S | Low/Med | Med |
| 7 | Define a four-variant control state matrix | Prevents new one-off buttons | S/M | Low | High |
| 8 | Render explicit empty/error states for hidden dashboard/provider sections | Stops “nothing happened” ambiguity | M | Low | Med |
| 9 | Consolidate shared tokens and intentionally scoped component variants | Permanent drift reduction | M/L | Med | High |
| 10 | Remove proven-dead CSS in small batches | Reduces noise after behavior stabilizes | S | Low | Low/Med |

## Handle carefully

- Payment actions and “Mark paid” copy/confirmation.
- Login/MFA submit states, because disabling controls can interact with password-manager submission.
- Dealer approval/rejection, because UI state must correspond to email and public-visibility state.
- Any broad replacement of `.card`, `.chip`, or `.btn-*`, because identical names currently carry different shell semantics.

## Overall verdict

The UI is more mature than a collection of raw templates: it has a design system in practice, but not one authoritative implementation. Fix current behavior regressions and false-success states first. Then centralize interaction states and tokens before attempting a broad component convergence. A rendered Playwright screenshot/accessibility pass remains recommended after the static defects are fixed.
