# Finder V1.3 fixes (Ben's notes, 07/07/2026)

Tester feedback on the admin auction search, portal free tier, the
interested-to-requests flow, and sitewide copy. House rules: no em or
en dashes anywhere, Australian English, all UI on the token system per
ADMIN-REDESIGN.md and COLOUR-AUDIT.md.

## Phase A: Admin auction search behaviour

- Selecting a Make or Model must NOT instantly fire the search and
  collapse the filter panel. Filter changes update results in the
  background (debounced) or wait for an explicit search action; the
  panel stays open while the user is still refining. No page-refresh
  feel.
- Remove the free-text smart search bar for now. It breaks when a
  year is typed before the car name and currently does nothing
  useful. Park it as a future feature (natural language parsing of
  year, make, model, grade) in a PARKED section at the bottom of this
  file. Do not attempt to build the parser now.
- Add chassis code (model code) search to the admin auction filters,
  labelled with the vehicle name next to each code, consistent with
  the V12 Phase 4 work. Reuse the same reviewed association data.
- Auction house filter: currently does not work and the list is
  missing houses that exist in the feed (example: USS JAA). Populate
  the list from the feed data itself, not a hardcoded list, and fix
  filtering.
- Rename the search trigger button to "Run Searches" (or equally
  obvious wording) so its purpose is clear.
- Homepage/landing vehicle tiles show auctions that have already
  passed. Show genuinely upcoming lots only, or remove the strip.

## Phase B: Listing cards and comparable sales

- There is a greyed-out control on every unit card that does nothing.
  Identify what it was meant to be. If it has no wired behaviour,
  remove it; if it is half-built, either finish it or remove it.
  State which in the commit message.
- "Show sold prices" button does nothing. Either wire it to a
  properly filtered comparable sales view (see next item) or remove
  it.
- "Recent comparable sales" must show make, model, auction score
  (what we call grade, e.g. 4), variant grade (e.g. S450), mileage
  and auction date per row, and must compare genuinely similar
  vehicles (same model code or close spec), not every recent sale of
  that model line. A Honda Civic Type R should not be compared
  against every Civic.
- Auction condition scores must display in full as listed, e.g.
  "3.5/B" and "3.5/B/C", not truncated.
- Landed price estimate on listings is inaccurate. Replace with a
  stripped-down version of the landed cost calculator producing an
  Australia-wide estimate, and add an admin Settings section where
  the cost assumptions (compliance, agency fee, shipping, etc.) can
  be edited without a deploy. If an accurate estimate is not feasible
  per listing, hide the figure entirely; a wrong number is worse than
  none.
- Auction sheet and higher quality photos: expose whatever the feed
  provides per lot (auction sheet image, full resolution photos) on
  the listing detail. If the feed does not provide them, state that
  finding in the commit message.
- Add-to-client tick on listing cards: the tick must not overlap the
  Add control, its popup opens only when the tick itself is clicked,
  and clicking anywhere else on the card that is not a button opens
  the auction listing detail.
- Watch List: add a Watch List tab within the auction search area so
  watching lots is consistent with the rest of the admin.
- The Model field on the watch/request form is a free text input.
  Make it the same feed-backed dropdown used by the auction filter,
  with the model code refinement from V12 Phase 4.

## Phase C: Portal, free tier and requests flow

- Fix /portal/subscribe: currently returns a 303 and just refreshes
  /portal. The subscribe flow must land on a working page.
- The two header/footer links that currently dead-end at the login
  page should point somewhere useful. Until a proper landing page
  exists, point them at the signup/search entry. Add a PARKED note
  for a proper jdmfinder.com.au info/landing page.
- Free accounts can currently create multiple saved searches. Enforce
  a limit of one active saved search for free accounts, server side,
  with a friendly upgrade message. Make the limit a config value so
  tiers can change it later.
- The lead form budget field: if it currently filters matching the
  way the auction search does, stop it filtering and store the value
  on the lead record only, until filtering can be done properly.
- Clicking "I'm interested" in the customer portal must create or
  update a row in the admin Requests page in real time. Currently it
  records on the customer profile but never reaches Requests. Fix
  the sync in both directions so status changes show on the customer
  profile too.
- The portal matches page has no way to open the auction listing.
  Add click-through to the listing detail.
- Admin Requests page overhaul, keep it stupid simple: most recent
  requests at the top, each row shows customer name and the auction
  listing, click through to the customer profile. Fold the content
  of the per-customer request detail page into the customer profile
  in simplified form. Follow the register patterns in
  ADMIN-REDESIGN.md.

## Phase D: Copy pass (sitewide, human tone)

- Fix the typo "A your search..." in the match email.
- Rewrite the match email to be concise and human. Short sentences,
  Australian English, no filler, no AI-sounding phrasing.
- Sweep all customer-facing copy (portal, emails, wizard, dashboard)
  for wordy or weird AI-sounding text and rewrite in the same tone.
  Ben's bar: it should read like a person from the business wrote
  it.
- Fix the copy claiming search timing that is untrue for free
  accounts (free accounts currently receive results immediately on
  signup). Copy must match actual behaviour, whichever way the
  behaviour decision lands.

## Decisions needed from Jate (do not guess, leave TODO markers)

- Free accounts: are matches auto-sent or manually reviewed before
  sending? If manually reviewed, do not auto-send the initial match
  on signup. Implement behind a config flag defaulting to manual
  review, and mark the flag clearly.
- Whether "Run Searches" should include free-tier customers' searches
  or paid only. Implement behind the same tier config.

## PARKED (do not build yet, keep for planning)

- Natural language smart search bar (parse year, make, model, grade
  from plain text). Removed from the admin auction search in Phase A;
  it broke when a year was typed before the car name and did nothing
  useful. Rebuild only as a proper parser.
- Proper marketing landing page on jdmfinder.com.au.
- Feed timing gap: our feed surfaces some upcoming lots up to a day
  later than AUCRS (e.g. USS JAA lots appearing on auction day).
  Data source limitation to raise with the feed provider, not a code
  fix.
