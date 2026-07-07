# Dealer Network: product and UI spec

Two-sided B2B feature. Dealers get their own portal to submit stock and
lodge requests for vehicles they are chasing. Admin gets a Dealers
section showing, per dealer, what they are chasing, their matches from
the auction feed, and their stock submissions.

Companion docs: ADMIN-REDESIGN.md and COLOUR-AUDIT.md define the design
system every surface below must sit on. UX-AUDIT.md patterns apply.

## 0. Architecture decision (read first, do not deviate)

DO NOT build a parallel request/matching pipeline for dealers. The
engine already exists: clients -> wishlist -> matcher -> queue, and
clients.category already supports "dealer" (migration 0011).

- Add `client_id INTEGER` to the `dealers` table. Creating a dealer
  account creates (or links to) a client record with category=dealer,
  company stored on the client, dealer's email/name mirrored.
- A dealer request ("chasing an R34 GT-R, budget 120k") is a normal
  wishlist row on that linked client, created from the dealer portal.
- The matcher, scoring, seen_lots, queue, digest and approve/skip flow
  then work for dealers with ZERO engine changes. Matching logic and
  matcher tests must pass unchanged.
- Dealer stock submissions stay in the existing `dealer_vehicles`
  table and review flow (already built and working).

## 1. Dealer portal (dealer-facing panel at /dealer/portal)

Register: the buyer portal shell (dark rail, light main, brandShell),
so dealers get the same premium chrome as clients, not a bare page.
The current dealerPortalPage standalone HTML is replaced entirely.

Navigation (portal rail): Dashboard, Requests, My stock, Account.

### 1.1 Dashboard
- Greeting header, then two attention cards on the standard card
  pattern: "Requests" (active request count + new match count since
  last visit) and "My stock" (pending / approved counts).
- Recent activity list: latest matches sent, latest submission status
  changes. Dense rows, 36 to 40px, hairline separated.

### 1.2 Requests (what they are chasing)
- Primary gold button: "Request a vehicle". Opens a form matching the
  staff intake pattern: Make (feed-backed select), Model, Year range,
  Budget (AUD), Notes. Posts to a new /dealer/request endpoint that
  writes a wishlist row on the linked client.
- List of their requests: label, spec summary, status chip, match
  count. Each expands to show matches the ADMIN HAS APPROVED for them
  (same visibility rule as the buyer portal: dealers never see the raw
  unapproved queue).
- Approved match row: photo thumb, title, one spec line, landed or
  auction estimate as the money element (14px semibold tabular ink),
  auction close date. Reuse the portal vehicle card components.

### 1.3 My stock (existing submission flow, restyled)
- "Submit a vehicle" gold button opening the existing form, rebuilt on
  tokens (feed-backed make select, AUD price, photo upload when photo
  handling lands).
- Their submissions as dense rows with quiet status chips (Pending
  ok-neutral, Approved ok tint, Rejected bad tint) and admin notes
  shown under rejected rows. No coloured border-left strips.

### 1.4 Account
- Name, company, state, email, change password. Standard settings
  section rhythm.

## 2. Admin Dealers section (staff admin)

One sidebar item: **Dealers**, admin gated like Agents, directly after
Customers. Badge = pending stock submissions + new dealer requests
needing review. Registered in the page meta map like every other view.

The section is rendered INSIDE the admin shell as content fragments,
exactly like clientsView/agentsView. The current standalone-HTML
dealersPage and dealerSubmissionsPage are deleted and rebuilt.

Tabs across the top (existing chip-on tab treatment):
Directory | Requests | Stock submissions

### 2.1 Directory (register: Attio, mirror Customers)
- Standard shell header, one gold "Add dealer" button opening a
  collapsed inline create panel (Name, Email, Company, State select).
  On create: makes the dealer login AND the linked client record,
  sends the invite, jdmToast confirms.
- Table: 36 to 40px rows, hairline separation. Columns: Dealer (name
  600 ink + company muted), State, Chasing (active request count),
  Matches (pending for that dealer, links into Matches filtered),
  Stock (pending submissions), Status chip, kebab.
- Kebab actions: Open, Resend invite, Activate/Deactivate, Delete
  (jdmConfirm, spells out that submissions are removed; the linked
  client is archived, not deleted, so history survives).
- Row click opens the dealer detail.

### 2.2 Dealer detail (register: client detail page)
Reuse the client detail layout on the linked client record with a
dealer header treatment: name, company chip (neutral outlined, per the
colour audit Dealer chip resolution), state, contact.
- Left rail: identity + engagement.
- Main: Requests (their wishlists, same components as request rows),
  then Matches track for this dealer, then Stock submissions strip.
- All existing client-detail actions (find a car, notes, timeline)
  work because it IS a client record.

### 2.3 Requests tab
- All wishlists belonging to dealer-category clients, one dense table:
  Dealer, Request (label + spec), Budget (money treatment), Status,
  Matches, Created. Same row anatomy as the Requests view, fewer
  columns. Links through to the request detail page (already exists).

### 2.4 Stock submissions tab
- The existing review queue rebuilt per the register: status filter
  chips Pending/Approved/Rejected/Archived with counts, dense rows,
  title 13-14px 600, one muted spec+dealer line, price right aligned
  14px semibold tabular ink as the loudest element, Approve gold
  primary (only gold on the row), Reject as quiet ghost opening a
  jdmConfirm dialog with an optional notes textarea. Details and
  photos behind a per-row disclosure. Approve/reject clear the row in
  place with jdmToast, matching the Matches surface behaviour.

### 2.5 Matches integration
- Dealer matches flow through the ONE existing Matches queue; do not
  fork a second triage surface. Add a "Dealers" filter chip to Matches
  and show the neutral Dealer chip on dealer-client match cards.
- Delivery: CONFIRMED. Approving a dealer match delivers it to the
  dealer automatically through the existing client delivery path
  (email/WhatsApp), identical to buyer behaviour. No manual-send
  buffer, no dealer margin step. The match also appears under the
  request in their portal.

## 3. Look and feel contract (applies to every surface above)

- Content fragments inside the existing shells only. No standalone
  HTML documents, no local <head>, no local font stacks.
- Zero hardcoded hex values. Kill #4CAF50 #f44336 #FF9800 #999 #333
  #f5f5f5 and the border-left status strips from the current build.
  All colour via tokens (--ink, --t2/--t3, --hair, ok/warn/bad tint
  families, --gold).
- Status is quiet: tint background, 1px border, dark text, weight 500,
  radius 8, via the shared chip component. Never saturated fill with
  white text.
- Gold budget: one gold element per surface region. Add dealer,
  Request a vehicle, Submit a vehicle, Approve. Nothing else.
- Money: AUD figures 14px weight 600 tabular, right aligned in tables,
  ink. Money is the loudest element on any row that has it.
- Rows: 36 to 40px, hairline or hover separation, never card-per-row.
  Titles 13 to 14px weight 500 to 600, secondary 400 muted, heads 12px
  weight 500. Nothing in a list row at weight 700.
- Dialogs and toasts: window.jdmConfirm and window.jdmToast only.
  Native confirm() is banned.
- Type/spacing/radius on the token scale (12/13/15/17 type,
  4/8/12/16/24/32 spacing, radius 10/8). Shell header owns titles.
- No em or en dashes anywhere in copy or comments (house rule).
- Mobile: reuse the .mcl-* card-row swap; verify at 375px with the
  worstcase seed per ADMIN-REDESIGN.md. scrollWidth must equal 375.

## 4. Build order

1. Migration: dealers.client_id + backfill (create dealer-category
   client per existing dealer). Link on create going forward.
2. /dealer/request endpoint writing wishlists on the linked client.
3. Admin Dealers section: nav item, meta entries, Directory,
   Stock submissions rebuild, Requests tab, detail reuse.
4. Dealer portal rebuild on the portal shell: Dashboard, Requests,
   My stock, Account.
5. Matches queue: Dealers filter chip + neutral Dealer chip on cards.
6. Later, separate commits: photo upload on submissions, approval
   emails to dealers, dashboard attention card for dealer activity.

## 5. Acceptance checklist

- [ ] Dealers nav item (admin only) with live badge; both admin tabs
      render inside the shell at 1440 and 375.
- [ ] Creating a dealer creates the linked dealer-category client;
      dealer requests appear as wishlists; matcher picks them up with
      no matcher.js changes; matcher tests pass untouched.
- [ ] Dealer portal uses the portal shell; dealers see only approved
      matches, never the raw queue.
- [ ] Zero hardcoded hexes in new/rebuilt view code (grep the diff).
- [ ] One gold element per region; money right aligned semibold
      tabular ink; quiet tint status chips everywhere.
- [ ] Delete/Reject via jdmConfirm; success via jdmToast; row clears
      in place on approve/reject.
- [ ] Deleting a dealer archives the linked client (history kept) and
      removes submissions, with the consequence spelled out.
- [ ] Mobile worstcase-seed pass; npm test green.
