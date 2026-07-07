# Finder V1.2 fixes and feature work order

Source: Ben's Finder Site Notes V1.2 (06/07/2026), including V1.1 and
V1.0 items he re-flagged as still unfixed. Work the phases in order,
one phase per commit (Phase 4 may be several commits). Companion docs
ADMIN-REDESIGN.md and COLOUR-AUDIT.md govern any UI touched along the
way. House rule: no em or en dashes anywhere in copy or comments.

## Phase 0: Blockers (auth is broken and insecure)

### 0.1 Client login fails after signup
Signup works, login with the same credentials fails. Ben reproduced
with bengc2000@gmail.com. Likely a mismatch between the hash written
at signup and the check in authenticate(), or the client role branch.
Reproduce locally, fix, and add a regression test: create account via
the public wizard path, then authenticate with the same email and
password. This blocks every future subscriber. Highest priority.

### 0.2 Set-password links error out
Invite links land on /set-password but submitting shows "Sorry,
something went wrong on our side." Suspected leftover or broken token
flow. Verify token lookup, expiry, and role branches for agents,
clients, and dealers all work end to end. Add tests for each role.

### 0.3 Password reset does not exist
Add a self-serve "Forgot password?" on /login: enter email, receive a
reset link (reuse the invite token machinery, 1 hour expiry). The
response must be identical whether or not the email exists (no
enumeration). Also add an admin-side "Send password reset" action on
client, agent, and dealer records.

### 0.4 Login hardening (flagged in V1.0, V1.1 and V1.2, still open)
- Server-side throttling: fixed 1 to 2 second delay on failed
  attempts, and lockout after 10 consecutive failures per account
  (15 minute cooldown). Track attempts in D1 or KV keyed by
  email + IP. Client-side JS does not count.
- Character limits enforced server side: email max 254, password
  max 32. Reject oversized bodies early.
- Password policy enforced at signup, set-password and reset:
  minimum 10 characters, maximum 32, allowed set is letters, numbers
  and !@#$%^&*()-_=+?<> only. Show the rule as a tooltip or inline
  error only when the user violates it, not permanently.
- Paste must work reliably in both password fields (Ben saw
  intermittent paste failure; remove any handler interfering with
  paste events).

### 0.5 Rotate the admin password after 0.1 to 0.4 land
The current admin password was circulated in a plain-text PDF. Once
throttling is live, rotate it. (Manual step for Jate, listed here so
it is not forgotten.)

## Phase 1: Trust and copy quick wins

- Login: remove "admins can leave this blank" from the email
  placeholder and any admin login instructions from public copy.
  Placeholder is just you@email.com.
- Login: footer link becomes "New here? Sign up to start searching"
  and gets stronger visual weight (underline or button-like link).
- Landing stats strip (500+ vehicles sourced, 15+ years, 100,000+
  listings reviewed): replace with true, defensible numbers or remove
  the strip entirely. Do not ship invented stats.
- Wizard: "Delivering to (country, if outside Australia)" becomes a
  single field labelled "Country", prefilled with Australia.
- Fix the overlapping/garbled confirmation text on the request
  submitted screen (two text layers render on top of each other).
- Popular-search tiles and "Recent examples imported" tiles: make
  them work properly or remove them until they do. Broken imagery
  ships nowhere. If kept, tiles must load real images and the recent
  examples must reflect real imports.

## Phase 2: Request wizard UX fixes (V1.1 carry-overs)

- Changing Make clears the selected Model (and dependent fields).
- Model becomes select-only from the feed list: no free typing,
  remove the "pick or type" hint, and fix the bug where a chosen
  Model cannot be reselected without backspacing.
- Nickname moves to the top of section "02 What you're looking for",
  still optional, not buried in "Add more detail".
- Preset dropdown default text becomes "No preset" so it is obvious
  presets are optional and how to clear one.
- Selecting a new preset (or "No preset") clears ALL fields the
  previous preset set, including Chassis code, which currently
  sticks.
- Preset data pass: every preset must be SEVS-eligible with correct
  year ranges. Build the corrected list with Jate/Ben sign-off
  (they will supply the common models). Ship empty rather than
  wrong.
- Budget: field becomes "Max budget (AUD, on-road)" and shows the
  yen auction-price equivalent inline beneath or beside it, computed
  live with a stripped-down inverse of the landed cost calculator
  (use current configured FX rate, state from the form, sensible
  defaults elsewhere). Store both; the wishlist keeps the yen figure
  the matcher uses today.
- The refine options currently on a later page (Max mileage, Min
  auction grade, Chassis code, Nickname) move onto the Find car
  step with the rest of the search criteria.

## Phase 3: Sitewide validation and limits

- Character limits on every input: name, email, password, WhatsApp,
  nickname, notes, years, mileage, budget, and all admin forms.
- Server-side validation with sensible ranges: Year fields accept
  only 4 digits within 1970 to 2050; mileage and budget positive
  integers with sane caps; WhatsApp validated as E.164.
- Signup email uniqueness: creating an account or a saved search
  with an email that already exists must not silently duplicate.
  Handle it without leaking account existence: respond with a
  neutral "check your email to continue" style flow (send a sign-in
  or reset link to the existing account instead of erroring).
- Wishlist guardrails: cap active wishlists per client and require
  at least a Make (or preset/model code) so an empty match-all
  search cannot return thousands of lots and hammer the matcher.
  Enforce server side; show a friendly limit message.

## Phase 4: Model code and grade search (the core product upgrade)

Problem: Make + Model is not enough to identify many cars. Examples:
Mercedes S Class hides S450 Exclusive AMG Line Plus in Grade; the
E55 lives under Make "MERCEDES AMG" not "MERCEDES BENZ"; Toyota
Crown spans 4cyl, 6cyl, Hybrid G, RS Advance. Sellers also spell the
same grade many different ways per auction house.

Target flow (the AUCRS pattern, which the avto.jp-backed API should
support):
1. User selects Make, then Model (both feed-backed selects).
2. New optional "Model code" select listing the chassis/model codes
   for that model, labelled with a friendly association, e.g.
   "222058 - S450". Selecting one narrows the search precisely.
3. After a model code (or model) is chosen, an optional "Grade"
   multi-select appears, populated by a pre-search of grades on
   current and recent listings for that selection. Multi-select
   because duplicates and spelling variants of the same real grade
   must be selectable together. If the API cannot enumerate grades,
   fall back to a fuzzy contains-match Grade text filter in the
   matcher.
4. Wishlist rows store model_code and grades (new columns), and the
   matcher filters on them when present. Matching behaviour when
   these fields are empty is unchanged; existing matcher tests must
   pass untouched.

Build notes:
- Verify first what the feed/API exposes for model codes and grade
  enumeration; write findings at the top of the PR description.
- The model code to label association list can be generated by
  Claude and checked by Jate/Ben before shipping. Store it as a
  reviewed data file, not a runtime guess.
- Make list correctness: confirm whether the Make list comes from
  the API or a generated list, and ensure entries like MERCEDES AMG
  appear as the auction houses list them. If makes are merged
  upstream, apply a best-match search on Make so E55-style cases
  still surface.
- Same model-code and grade options must appear in the admin intake
  and request edit forms, not only the public wizard.

## Phase 5: Portal polish

- Buyer portal "Recent matches" rows currently show raw internal lot
  ids ("Lot 6ryZINDpTKc2DI"). Replace with useful content per row:
  year make model title, photo thumb if available, strength chip,
  status (sent/viewed/expired), auction close or sent date, and the
  landed estimate as the money element. Link through to the match.
- "Why buyers use JDM Connect" card: leave content as is for now
  (Ben will supply direction later), but ensure it sits on tokens.

## Parked (do not build yet, keep for planning)

- Subscription tiers sketched by Ben: $10/m alerts-only, $50/m saved
  searches + auction search, $499 self-serve + consultation, $1200
  fully managed. Pricing arbitrary. Needs a product decision first.
- Daily rare-car finder feeding Facebook/Instagram story templates
  with AI captions and manual sign-off. Short term alternative:
  staff-run saved searches for rare cars.
- Saved-search lead capture for not-ready-to-pay leads (no client
  notification, used for follow-up calls). Overlaps with the lead
  scoring engine design; decide placement there.

## Acceptance checklist

- [ ] Signup then login round-trips for client, dealer and agent
      roles; regression tests cover each.
- [ ] Set-password and reset flows work for all roles; reset link
      responses do not reveal whether an email exists.
- [ ] Throttling live: 10 rapid failures lock the account, delay on
      every failure; limits and password policy enforced server side.
- [ ] No public copy references admin login. Stats strip gone or
      true. Country field prefilled Australia.
- [ ] Wizard: make change clears model; model select-only; presets
      clear fully and are eligibility-correct or absent; budget in
      AUD with live yen equivalent; refine fields on the Find car
      step.
- [ ] All fields validated and length-limited server side; duplicate
      email flow leaks nothing; wishlist guardrails enforced.
- [ ] Model code select with reviewed labels; grade multi-select or
      fuzzy fallback; wishlists store and matcher honours both;
      existing matcher tests pass unchanged.
- [ ] Portal recent matches show real vehicle info, not lot ids.
- [ ] npm test green; mobile 375px pass on touched surfaces per the
      worstcase-seed rule in ADMIN-REDESIGN.md.
