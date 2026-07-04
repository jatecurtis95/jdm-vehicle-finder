# JDMFinder admin: product and layout audit (IA-AUDIT)

Audited 4 July 2026 against local dev with seed/seed-worstcase.sql applied on top
of seed-dev.sql (client 9010, 55 character name and email, 12 pending matches with
long titles and full spec lines). Every page was loaded live in Chrome at 375px
and 1440px; positions below are measured document pixel offsets from those
sessions, not guesses. The fold at 375 is roughly the first 900px. No code was
changed for this audit.

The yardstick, from how JDM Connect actually works:

- Core staff job: find auction lots for a client's wishlist, then send matches
  for approval. Flow is find, scan, select, send. Anything on the path of that
  flow earns prime placement; anything else does not.
- Auctions close on deadlines. What closes soonest is what matters first.
- Leads are hot for about an hour and buyers then deliberate for weeks. Speed
  to first contact, and resurfacing quiet buyers, beat every other signal.
- The team is five people (Jate, Ben, Lachlan, Anthony, Vince) working mostly
  on phones. Mobile fold economics matter more than desktop polish.

Reference registers cited below: Attio's record layout (identity and comms in a
left rail, the timeline and next action always visible, details collapsed) and
Linear's list layout (one quiet toolbar band, dense rows, filters live in the
URL, summaries instead of horizontal scroll).

---

## 1. Dashboard (/admin)

### Section A, placement audit

What works:

- The "Needs attention today" framing with question-format sections ("Who needs
  attention today?", "Who owes money?", "Which requests are stalled?") is the
  right mental model for a daily standup page.
- The Stalled requests tile picks up a red accent only when non-zero, and
  Matches to review carries a gold border: state-driven emphasis done right.
- The fixed Search auctions button (bottom of sidebar at 1440, floating at 375)
  keeps the entry to the find flow one tap away from everywhere. Keep it.
- Role scoping already exists in dashboardData, so agents see their own world.

Flagged:

- At 375 the first 440px is spent before any operational data: icon row,
  kicker, a two-line 65px greeting, then the Team overview strip (Active
  clients, Active agents, Open requests, Sent this week, Members). Team
  overview is a vanity register, it changes weekly at best, yet it outranks
  "Needs attention today" (tiles start at 439).
- The seven attention tiles stack two-up and run 439 to 793, so the first
  question card lands at 937, below the fold. On a phone the page's actual
  content (the lists) is a full screen of scrolling away.
- Tile order does not match decision order. Measured order: Follow-ups due,
  Overdue tasks, Tasks due today, Deposits outstanding, Stalled requests,
  Closing in 48h, Matches to review. The two tiles that feed the core flow
  (Closing in 48h, Matches to review) render last, and at 1440 Matches to
  review wraps alone onto a second row as an orphan.
- Six identical gold Open and Review buttons sit in view at once at 1440.
  Gold is supposed to mark the primary action; six primaries is zero
  primaries.
- Duplicate encodings: "Who owes money?" duplicates the Deposits outstanding
  tile; My tasks, Overdue tasks and Tasks due today triple-represent the same
  queue; the sidebar counts (Requests 4, Matches 13) repeat the tiles.
- The pipeline strip (New, Qualified, Searching, ...) scrolls horizontally at
  375 with a visible scrollbar; most stages are zero.

### Section B, placement recommendations

- Reorder tiles by decision priority: Closing in 48h, Matches to review,
  Follow-ups due, Stalled requests in the first four slots; Deposits
  outstanding and the task tiles after. Rationale: deadline first, then the
  send queue, then contact obligations, then money.
- At 375, compress the greeting to one line and move Team overview below the
  attention band (or into the Manage page). This puts the tiles at the top of
  the first screen and the first question card inside the fold.
- Keep the two-column question grid at 1440 but order the first row as "Which
  auctions close today?" and "Who needs attention today?", tasks and money in
  the second row: the flow decides first what closes, then who to talk to.
- Gold diet: a question card's button is gold only when its count is non-zero;
  zero-count cards get the ghost or outline treatment. One glance then shows
  where the work is.
- Replace the horizontally scrolling pipeline strip at 375 with the non-zero
  stages only, plus a "view pipeline" link into Requests (Linear summarises,
  it does not side-scroll).

### Section C, what is missing

- A hot-lead ticker: new requests with minutes-since-created and a one-tap
  contact affordance (deep link to WhatsApp or the phone dialer). Solves: the
  one-hour window is the highest-value moment in the funnel and the dashboard
  currently only exposes New counts inside the pipeline strip; a new lead that
  arrives while staff are on the road is invisible until someone opens
  Requests. Helps: whoever is on triage duty that hour, in practice everyone.
- A "gone quiet" list: clients with prior engagement (opened or interested),
  no touch in 14 or more days, and a request that is not lost. Solves: the
  long deliberation cycle means real buyers vanish for weeks; today nothing
  resurfaces them unless a follow-up happened to be scheduled. Helps: Ben and
  the sales side hitting warm re-contact instead of cold lists.
- Tile drill-through everywhere: every tile should be a link into its filtered
  list (Closing in 48h into Matches with soon=1, Deposits outstanding into
  Payments). Some cards link, the tiles are inert. Solves: the tile tells you
  there are 4, then makes you find them again.

---

## 2. Matches (/admin?view=matches)

### Section A, placement audit

What works, and it is the strongest list page in the product:

- The default filter is Strong plus Good, ordered closing soonest first, with
  a banner narrating exactly that. This is precisely the business rule (what
  closes soonest matters first) baked into a default. Keep it exactly.
- Ticker tiles double as filters, filter state lives in the URL and survives
  the round trip into a lot and back (ret param). This is the Linear pattern
  done properly.
- Grouped by client matches the real unit of work (staff triage one client's
  batch, then send one combined email). The group header carries count,
  wishlist label, strength mix and "closes in N days".
- Bulk triage power tools (Select all Strong, Select all closing soon, Skip
  Possible older than 7 days) hide behind one quiet disclosure: right register.
- Per-row money (landed A$) is right-aligned and loudest on the row, Stripe
  style. Skip is a quiet outline next to a gold Approve & send.

Flagged:

- At 375 the pre-list chrome costs the whole first screen: ticker tiles 162 to
  412, banner to about 690, search at 552, chips to about 860, and the first
  card lands at 1075. Zero cars visible on screen one of the page whose job is
  scanning cars. At 1440 the same chrome compresses to 510px and three cards
  fit in the fold, so this is purely a mobile stacking problem.
- The filter state is triple-encoded (highlighted ticker tile, highlighted
  chip, narrating banner). Redundancy that costs 250px at 375.
- The sticky bulk bar (bulkbar2) pins to the top on selection. On a phone the
  thumb lives at the bottom; the staffSendBar variant already solves this at
  the bottom on the auctions page, so the two bulk surfaces disagree.
- "Search again" (top right, dark button) reads ambiguously next to the list
  search input; one filters the list, the other re-runs the auction hunt.

### Section B, placement recommendations

- At 375, collapse the five ticker tiles into one single-row count strip
  (Awaiting 13, Strong 5, Good 4, Possible 4, 48h 0, each tappable) and fold
  the banner's message into that strip ("9 shown, 4 hidden, Show all"). Target:
  first match card visibly starts inside the first 900px. Do not touch 1440.
- Move the selection bulk bar to bottom-sticky on small screens, same family
  and variant behaviour as the send bar on Auctions. One consistent rule:
  selection bars live at the thumb.
- Rename "Search again" to "New auction search" (or move it into the fixed
  Search auctions affordance entirely) so "search" on this page means only
  filtering the queue.

### Section C, what is missing

- Last-sent context in the client group header: "last sent 3 cars, 2 days ago,
  1 opened". Solves: over-sending to the same client in the same week is the
  quickest way to train buyers to ignore emails; today staff cannot see send
  recency without opening the client. Helps: everyone approving sends.
- A snooze on a match. Skip is terminal and Approve sends now; there is no
  "revisit tomorrow when the client answers". With closing dates a natural
  variant is "snooze until 24h before close". Solves: staff currently leave
  matches sitting in Awaiting review as an improvised snooze, polluting the
  count that the dashboard treats as workload.
- Per-group select-all. The triage tools select globally (all Strong, all
  closing soon) but the working unit is one client's group; a small select-all
  checkbox on the group header would make bulk skip of one client's Possibles
  a two-tap job.

---

## 3. Client detail, matches section (/admin?view=client&id=N, "Live matches")

Audited as its own surface because it is the send flow's second home.

### Section A, placement audit

What works:

- The bulk bar (Select all, count, Approve & send, Skip) sits directly above
  the grid on the one action bar family, and the two CTAs go full-width at
  375 with nothing clipped (verified with the worst-case seed at 375 and
  1440 in the previous session and re-verified today).
- Cards carry the decision data: strength badge, closing signal, landed
  figure, spec line, per-card Skip and Approve & send at 44px.

Flagged:

- The section starts at 3647 at 375 and 1742 at 1440. Staff open a client to
  review and send cars, and the send surface is four phone screens down.
  (What pushes it down is audited in section 5.)
- Every card repeats "for Bartholomew Constantine-Featherstonehaugh · Land
  Cruiser Prado TX Limited low kilometre sunroof preferred" on the client's
  own page. With the worst-case name and label that echo costs three lines
  per card, twelve times, at 375.
- The match strength legend (a 190px card explaining Strong, Good, Possible)
  renders above the bulk bar on every visit, pushing actions down; the same
  explanation exists behind the "How it's scored" link.

### Section B, placement recommendations

- Suppress the "for {client} · {wishlist}" line on cards rendered inside the
  client's own page (matchCard already takes options; the context is implied
  by the page). Reclaims roughly a full screen of scrolling across 12 cards.
- Collapse the legend to the "How it's scored" link on this page; keep the
  legend card on first-run or behind the link.
- The bigger fix is ordering (see section 5B): matches directly under the
  header makes this bar and grid the second thing a staff member touches.

### Section C, what is missing

- A sent-history strip above the grid: "2 sent this week, 1 opened, none
  interested". Solves: send-pacing decisions happen here, blind.
- Quick chips above the grid: "Select all Strong", "Select closing this week".
  The Matches page has these as global triage; here they would act on one
  client and feed the exact send batch.

---

## 4. Customers (/admin?view=clients)

### Section A, placement audit

What works:

- The table at 1440 has the right skeleton for an Attio-style directory:
  Client (name, email, state), Searches, Last contact, Owner, Shared with,
  sortable headers, kebab for row actions, count-labelled segment chips (All,
  Private 4, Dealers 0), Show archived out of the way.
- Last contact exists as a first-class column. This is the single most
  valuable CRM signal for this business and it is already in the schema and
  the view.
- At 375 rows render as clean stacked cards inside the viewport (no overflow
  with the worst-case email, re-verified).

Flagged:

- The bulk action bar ("With selected clients: Assign owner, Apply, Delete
  selected") is permanently visible at 1440 with zero selected, and Apply is
  the most prominent gold element on the page while being a no-op. Delete
  selected, a destructive action, sits one click away at all times. Compare
  Matches, where the bulk bar appears only on selection.
- Every seeded row shows the same red "no activity" dot. When every row is
  red, red means nothing: alarm fatigue on the page's best signal.
- Export CSV outranks the list itself at 375 (a 33px control above the first
  card) for an action used monthly at best.
- Row actions hide two taps deep in the kebab while the row surface itself is
  inert except the name link.

### Section B, placement recommendations

- Show the bulk bar only when selection is non-zero, bottom-sticky on mobile,
  matching the one-family rule. Gold Apply only when an action is chosen.
- Make "Last contact" state-aware: neutral "never" for prospects with no
  history, amber past 7 days, red past 14 with prior engagement. The dot then
  carries the quiet-buyer signal instead of ambient alarm.
- Move Export CSV into the header overflow (kebab next to Add client). Keep
  Add client top right, it is placed correctly.
- Default sort by most recent activity, not name, so the working set floats
  up (Attio's default of last-touched, not alphabetical).

### Section C, what is missing

- A "Matches waiting" column (live match count per client). Solves: the
  directory currently cannot answer "who has cars sitting unsent or unseen",
  which is the question that converts to sends. One number per row, links to
  the client's matches section. Helps: daily triage.
- Stage context per row: the client's furthest-along request stage as a chip
  (Searching, Deposit paid). Solves: scanning who is close to money without
  opening each record.
- Row-level quick contact on mobile: tap-and-hold or a trailing WhatsApp
  icon. Solves: speed to contact; today it takes card, then profile, then
  WhatsApp, three screens on a phone.
- Next follow-up column: the date already exists on requests; surfacing it
  here makes the directory a working queue instead of an address book.

---

## 5. Client detail (/admin?view=client&id=N)

### Section A, placement audit

What works:

- The record header is genuinely Attio-grade: avatar, name, status chips
  (member, portal, state), wrapped contact line (worst-case email verified),
  44px WhatsApp, Call, Email, Find a car CTAs, then a seven-stat engagement
  strip (Search, Live matches, Examples sent, Opened, Interested, Last
  viewed, Last login).
- The rail at 1440 (Activity, Buyer portal, Edit details collapsed) is the
  right rail content, and Edit details defaulting closed is correct.

Flagged:

- Main column order at both widths is: search definition (with "Edit what
  they're chasing" arriving expanded, about 1100px of form at 375), then Add
  another search, then the full Find a car form (another 800 to 900px), then
  matches at 3647 (375) or 1742 (1440), then Activity dead last at 7811 on a
  8319px page. The page is form-first, action-last; staff flow is the
  reverse. The two forms are creation and edit tools used occasionally; the
  matches grid is the daily surface.
- Three routes to the same job on one screen: header "Find a car" CTA, the
  mid-page Find a car form, and the global floating Search auctions button.
  The mid-page form is the expensive one (real estate), the other two are
  cheap.
- The Activity card sits at the top of the rail at 1440 and is nearly always
  empty ("No activity yet"), so the page's best rail slot is spent on
  emptiness while the rail runs out at 904px against a 4105px main column.
- The engagement strip mixes two registers: match engagement (sent, opened,
  interested) and portal auth (last login). Minor, but it blurs the question
  the strip should answer ("are they responding?").

### Section B, placement recommendations

Attio's record rule: identity and comms stay pinned, the timeline and the
next action are always in reach, everything editable is collapsed until asked.
Concretely here:

- Order the main column: header, engagement strip, Live matches (bulk bar and
  grid), then searches as one-line summary rows (label, criteria digest,
  On/Off toggle) with the edit form behind its disclosure closed by default at
  every width, then the Find a car form collapsed behind the header CTA (the
  CTA scrolls or expands it). Add another search stays with the search rows.
- Rail at 1440: Buyer portal and Edit details first while Activity is empty;
  Activity earns the top slot once a contact log exists (see C). At 375 keep
  rail content after matches, before the forms.
- Keep exactly one prominent Find a car affordance (the header CTA);
  demote the floating Search auctions on this page if both remain.

### Section C, what is missing

- Last contacted, front and centre in the header ("Last contacted 9 days ago
  by Ben, WhatsApp"). The directory has the column; the record does not show
  it. Solves: the quiet-buyer problem at the exact moment staff are looking
  at the person. Helps: everyone, and it feeds the dashboard gone-quiet list.
- One-tap contact logging: after tapping WhatsApp or Call, drop a pre-filled
  "log this touch" toast (who, channel, timestamp, optional note). Solves:
  the Activity card is empty because logging requires navigating to the
  request's note form; an empty timeline makes every other recommendation
  weaker. This is the keystone missing feature of the CRM side.
- Next follow-up on the client record (read and set). It exists only on
  request detail today; a client with two searches has no single "when do we
  touch them next".
- Client-level notes. Notes are request-scoped (rd-note); relationship facts
  ("partner approves in August", "prefers calls after 5pm") have no home.

---

## 6. Requests (/admin?view=requests)

### Section A, placement audit

What works:

- Rows are ordered by last activity descending, which is the correct working
  order, and each row carries client, REQ id, vehicle, stage chip and an
  activity dot.
- The dots-and-chips legend hides in a details element at the bottom: right
  register, out of the way.
- Search spans customer, vehicle and stage.

Flagged:

- Twelve pipeline stage cards stack two-up from 155 to 627 at 375. With the
  seed, ten of twelve read zero. The first actual request appears around 910,
  at the fold line. The filter bank outweighs the content 5 to 1 on screen
  one.
- Twelve stages is a heavyweight pipeline for a five-person team; as layout,
  it guarantees the zero-card problem on mobile forever.
- New requests show no age. A row that has been New for 40 minutes looks
  identical to one from last Tuesday. Given the one-hour window, this is the
  most important absent pixel in the product (see C).
- The same red "no activity" dot fatigue as Customers.

### Section B, placement recommendations

- At 375, render only non-zero stages as a single wrapping chip row (New 3,
  Searching 1), with an "All stages" affordance opening the full set. Linear
  treats board columns the same way: summarise the empties. At 1440 the
  twelve cards fit one band and can stay.
- Keep list order last-activity descending, but pin never-touched New
  requests above the fold regardless of activity order (a New request with no
  activity is by definition at the bottom of an activity sort, which is
  upside down for hot leads).

### Section C, what is missing

- Age on every New row ("14m", "3h", "2d"), red once past one hour
  untouched. Solves: speed to first contact becomes visible and shameable;
  today the page cannot answer "did anyone call the lead from lunchtime".
  Helps: whoever owns triage, and Jate auditing response discipline. This is
  the single highest impact-to-effort item in this audit.
- Time-in-stage on every row ("Searching for 11 days"). The dashboard already
  computes stalled; the list should show the number that definition uses.
- Claim control: "assign to me" on the row. With five people and shared
  triage, the failure mode is two people calling the same lead or nobody
  calling. Owner exists; a one-tap claim makes it fast enough to use.
- Lead source on the row (site finder, manual, referral). Solves: Lachlan's
  ad spend conversations need to know which sources produce requests that
  reach Searching.

---

## 7. Request detail (/admin?view=request&id=N)

### Section A, placement audit

What works, and at 1440 this is the best-structured page in the admin:

- Three true columns, Attio-shaped: identity, owner and deposit left (288px);
  the request spec, a gold "Find a vehicle for Bartholomew" CTA and VEHICLES
  & ENGAGEMENT centre (445px); STATUS, NEXT ACTION, notes, tasks and activity
  right (340px). Everything a call requires is one screen at 1440.
- VEHICLES & ENGAGEMENT is the correct single source for what was sent and
  what state it is in (In review, awaiting review chips).
- Quick-add task with due date, note logging and the follow-up form all live
  on this page: the write-side of the CRM is here and it works.

Flagged:

- At 375 the columns stack left to centre to right, which buries the two
  things staff change after a call: STATUS lands at 3104 and NEXT ACTION at
  3616 on a 4492px page. The after-call workflow is four screens of thumb
  scrolling.
- "Back to requests" is duplicated: a topbar button and a backlink 100px
  below it.
- The status stepper renders all twelve stages as a 312px vertical list at
  375, duplicating the adjacent status select. Two encodings of the same
  state, half a screen of cost on mobile.
- Prominence mismatch on first screen at 375: the gold action visible in the
  fold is "Mark deposit paid" while the request is in Searching and no
  deposit has been requested. The eye-catching action is one nobody should
  take yet.

### Section B, placement recommendations

- Mobile stack order: identity and contact, then STATUS and NEXT ACTION, then
  VEHICLES & ENGAGEMENT and the find CTA, then deposit, owner, notes, tasks,
  activity. Rationale: after a call you set the stage and the next touch;
  those two cards are the page's write-path.
- Remove the backlink; the topbar button stays (it survives sticky).
- On mobile, compress the stepper to "Stage 3 of 12, Searching" with the
  select as the control (Linear compresses the same way); keep the full
  stepper at 1440 where it reads at a glance.
- Deposit card: neutral until the stage makes it live (gold "Mark deposit
  paid" only once a deposit is requested; before that a quiet "Request
  deposit" is the primary).

### Section C, what is missing

- Last contacted, distinct from "last activity" (portal opens are activity;
  a phone call is contact). Belongs on the identity card next to the red dot.
- A log-a-call action that writes to Activity in one tap (same keystone as
  the client page; the note textarea exists but is three scrolls away at
  375).
- WhatsApp template shortcuts on the contact CTAs ("status update", "deposit
  reminder") since the message content is formulaic at each stage.

---

## 8. Auctions (/admin?view=auctions)

### Section A, placement audit

What works:

- Search-first layout matches the find flow: query, make, model, house, More
  filters behind a disclosure, then tabs (Live auctions, Watchlist, Sold
  auctions, Sold prices), then the feed with a lot count.
- The floating send bar (sendbar family) appears on selection at the bottom,
  with a client picker in staff mode, remembers the last-used client
  (sessionStorage), warns when the chosen client has no contact channel, and
  turns the flow into select, choose client, send. This is the strongest
  mobile interaction in the product.
- Cards disable selection once a car is already sent to the chosen client
  (queueState), preventing double-sends.

Flagged:

- At 375 the form plus filter selects occupy the first 460px before the tabs
  (494) and feed bar (576); with the empty dev feed nothing else was
  assessable, but at most one card can start inside the fold. The form does
  not collapse after a search is run, so scanning results means scrolling
  past the form every time.
- Watchlist is a plain tab with a count; nothing distinguishes a watched lot
  closing tonight from one closing in two weeks.

### Section B, placement recommendations

- Collapse the search form to a one-line summary bar after a search executes
  ("HIACE, 1999 to 2004, USS Nagoya, edit"), the pattern every flight-search
  mobile UI uses. The first result card then starts inside the fold.
- Default the live feed sort to closing soonest, mirroring Matches, and say
  so in the feed bar ("142 lots, closing soonest first").

### Section C, what is missing

- Closing alerts on watchlist lots: a dashboard tile or ticker entry when a
  watched lot enters its final 24h. Solves: the watchlist exists but nothing
  pulls staff back to it in time to bid or send; deadline work should page
  you, not wait for you.
- "Run this client's wishlist here" quick action: the client page pre-fills a
  find form, but from the Auctions page a staff member starting from the car
  side has to rebuild criteria by memory. A client picker that loads wishlist
  criteria into the search closes the loop from both directions.

---

## 9. Lot detail (/admin?view=lot&id=N)

### Section A, placement audit

What works, this page has the best decision ordering in the product:

- The right rail leads with exactly the decision stack: auction grade, EST
  LANDED (the money number), AUCTION IN 16 DAYS (the deadline), then Skip and
  Approve & send at 292 (1440) and 826 (375), then the spec rows, then
  auction house and lot logistics, then "Match for {client}" with the
  wishlist label. Decision data above the action, action above the detail.
- The ret param restores the exact Matches filter state on back: staff never
  lose their triage position.
- Share is a quiet disclosure with a gold WhatsApp path inside: correct
  register for a secondary action.
- The approve confirms are contact-aware ("no email or WhatsApp on file...").

Flagged:

- The client context block ("Match for Bartholomew", wishlist label) renders
  at the bottom of the rail; the send decision is made on behalf of that
  client and their budget, which sits off-screen at the moment of decision.
- The Auction notes explainer card (how grades work) occupies the left column
  above the fold at 1440 while actual translated notes are often absent; the
  explainer outranks the content it explains.

### Section B, placement recommendations

- Move the client block directly under the landed figure: who it is for and
  what they asked for belongs beside what it costs. One rail, one story:
  price, deadline, client fit, action.
- Collapse the grade explainer behind the existing "How it's scored" style
  link; give translated auction sheet content (when present) the card.

### Section C, what is missing

- Budget delta on the client block: "A$48,750 landed vs ¥4,500,000 budget,
  about A$3,000 under". Solves: the strength badge encodes this opaquely;
  the number is what staff quote on the phone. Cheap to compute, both values
  are already on the page's data.
- Comparable sold prices: avg_price exists in the lot data and a Sold prices
  tab exists on Auctions; one line here ("similar sold A$2.4m to 2.9m at
  auction") arms the negotiation and the client message.
- AI sheet read trigger on the page when the reader is configured and the
  sheet is unread (Settings has the global mode; the per-car button belongs
  where staff look at the car).

---

## 10. Payments (/admin?view=payments)

### Section A, placement audit

What works:

- Stat tiles (Collected, Paid payments, Deposits outstanding) then the table;
  amounts are the loudest element per row, right-aligned tabular, status is a
  quiet chip (paid, created, expired, failed), Stripe session ids truncate
  with a copy button. This is the measured Stripe register from the design
  audit, applied.
- The empty state explains the setup path ("Add your Stripe key in Settings").

Flagged:

- Deposits outstanding appears here, on the dashboard tile, and as a
  dashboard question card: three surfaces, none of which lists who owes what
  with a chase affordance.
- Payment rows reference the Stripe session; the request they secure is one
  join away but not shown (verify: with live data, the row shows client and
  amount; the request stage at payment time is absent).

### Section B, placement recommendations

- Give the outstanding list primacy over the historical list: outstanding
  deposits with age at the top (the money you can act on), the paid ledger
  below. Tiles stay.

### Section C, what is missing

- A chase action on outstanding deposits: WhatsApp deep link with a deposit
  reminder template, and "mark chased" writing to activity. Solves: "Who owes
  money?" currently answers who, then abandons the user before how.
- Link each payment row to its request detail so a payment dispute or
  question starts from context, not from a Stripe id.

---

## 11. Settings (/admin?view=settings)

### Section A, placement audit

What works:

- Six numbered cards (Notifications, WhatsApp, Client-facing visibility,
  Payments Stripe, Membership, AI auction-sheet reader), a sticky bottom save
  bar on the shared action bar family, and an unsaved-changes guard on
  navigation. Disclosure copy ("How auto-read works") sits inside details
  elements. For an admin-only page this is in good shape.

Flagged:

- One 3160px form at 375 with no in-page navigation; reaching the AI section
  is six cards of scrolling with a sticky save bar you do not yet need.
- Cost-sensitive controls (AI model choice at cents per read) sit at the same
  visual weight as notification toggles.

### Section B, placement recommendations

- Add an anchor chip row under the h1 at 375 (Notifications, WhatsApp,
  Visibility, Stripe, Membership, AI) jumping to each card. No structural
  change at 1440.

### Section C, what is missing

- Test-send buttons beside the channel configs ("send me a test WhatsApp",
  "send a test email"). Solves: WhatsApp provider changes are currently
  verified by sending a real client a message or tailing logs.
- A settings change log (who changed auto-send mode and when), given
  auto-send can email clients unattended and five people share the admin.

---

## 12. Tasks (/admin?view=tasks)

### Section A, placement audit

What works:

- The bucket model (Overdue, Due today, This week, Later, No due date) is the
  right cut for follow-up work, and completing a task keeps a 7-day undo
  window ("Recently completed").
- Tasks are created in context on request detail (with due date), which is
  where next steps are decided.

Flagged:

- The "What is the Tasks board?" explainer card occupies the entire first
  screen at 375 (roughly 215 to 800) on every visit until dismissed, ahead of
  the stat tiles (635) and the list itself. Onboarding copy outranks the work.
- There is no quick-add on the Tasks page itself; adding requires navigating
  to a request, which is backwards when the thought is "remind me to call
  Sam Thursday".
- Stats sit below the explainer, so even the zero counts (the reassurance)
  are below the fold.

### Section B, placement recommendations

- Persist the explainer dismissal (it should be one Hide, forever, per
  browser at minimum) and collapse it to a single "What is this?" link line
  once dismissed. Stats row to the top, list directly under it.

### Section C, what is missing

- Quick-add with client autocomplete on this page ("call Sam re finance,
  Thu"). Solves: follow-up capture at the moment of thought; every skipped
  capture is a quiet buyer later.
- An assignee filter defaulting to "mine" (Ben, Lachlan, Anthony, Vince),
  admin seeing all. Five people sharing one undifferentiated list stops
  scaling at exactly five people.

---

## 13. Agents (/admin?view=agents)

### Section A, placement audit

What works:

- The invite flow (create, send invite link, agent sets password) is simple
  and the table carries search and CSV export consistent with Customers.

Flagged:

- The "+ New agent" creation form (roughly 172 to 611 at 375) renders above
  the agent list. Creating an agent happens a handful of times a year; seeing
  the team happens weekly. Form-first is the same inversion as the client
  page, at lower stakes.

### Section B, placement recommendations

- List first; "New agent" becomes a top-right button matching Customers' Add
  client, opening the form (inline expand or intake-style page).

### Section C, what is missing

- Workload columns on the list: open requests owned, matches awaiting review
  for their clients, last active. Solves: "who has capacity for this new
  lead" is currently answered from memory; the dashboard leaderboard shows
  sends, not load.

---

## Cross-page priority list

Ranked by impact against build effort. Impact is judged against the two
business levers: speed to contact (hot leads, deadlines) and not losing quiet
buyers. Effort assumes the existing codebase patterns (server-rendered views,
existing columns and families).

| # | Item | Pages | Impact | Effort |
|---|------|-------|--------|--------|
| 1 | Age on New requests, red past 1h untouched, plus pin never-touched New rows to top | Requests, Dashboard | High: directly attacks the one-hour window | Low: created_at exists, render change |
| 2 | Requests mobile: non-zero stage chips instead of twelve stacked cards | Requests | High: unburies the list on the phone where triage happens | Low |
| 3 | One-tap contact logging (log the touch after WhatsApp or Call) writing to Activity | Client detail, Request detail | High: keystone that makes last-contact real instead of empty | Medium |
| 4 | Last-contacted in the client header and request identity card (column already exists on Customers) | Client detail, Request detail | High: quiet-buyer visibility at the record | Low once item 3 exists |
| 5 | Client detail reorder: matches under header, wishlist edit and Find-a-car forms collapsed | Client detail | High: puts the send surface one swipe from open | Medium: reordering plus disclosure defaults |
| 6 | Dashboard: tile reorder (48h and Matches first), greeting and team overview demoted at 375, gold only on non-zero | Dashboard | Medium-high: first screen of every session becomes operational | Low |
| 7 | Gone-quiet list (engaged, no touch 14d, not lost) | Dashboard | High: recovers deliberating buyers | Medium: needs item 3's data to be honest |
| 8 | Matches mobile: single-row count strip replacing ticker plus banner, first card inside fold | Matches | Medium: faster scan start on the best page | Low-medium |
| 9 | Request detail mobile reorder (STATUS and NEXT ACTION after identity), remove duplicate backlink, compress stepper | Request detail | Medium: after-call write path reachable | Low |
| 10 | Customers: bulk bar only on selection, activity-aware dot states, matches-waiting and stage columns, activity-desc default sort | Customers | Medium: directory becomes a queue | Medium |
| 11 | Lot detail: client block under the landed figure plus budget delta line | Lot detail | Medium: better send decisions at the point of decision | Low-medium |
| 12 | Match snooze (including snooze to 24h before close) | Matches, Client detail | Medium: honest queue counts, deadline-aware deferral | Medium |
| 13 | Sent-recency context (group headers on Matches, strip on client matches) | Matches, Client detail | Medium: prevents over-sending | Medium |
| 14 | Deposit chase: outstanding-first Payments layout with WhatsApp reminder action | Payments, Dashboard | Medium: money page becomes actionable | Medium |
| 15 | Auctions: collapse search form after search, closing-soonest feed default, watchlist closing alerts | Auctions, Dashboard | Medium: find flow faster on phone | Medium |
| 16 | Tasks: persist explainer dismissal, stats first, quick-add with client autocomplete, mine-first filter | Tasks | Low-medium | Low |
| 17 | Agents: list before form, workload columns | Agents | Low | Low |
| 18 | Settings: mobile anchor chips, channel test-sends | Settings | Low | Low |

Nothing in this document changes code. Items 1, 2, 6 and 9 are candidates for a
first pass: all four are render-layer changes with existing data. Items 3 and 4
together unlock 7 and are the highest-leverage product addition. I recommend
approving items individually; several (5, 10, 12) change daily muscle memory
and deserve a look at the current flow with the team before building.
