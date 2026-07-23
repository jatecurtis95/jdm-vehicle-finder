# End-to-End Flow Audit

**Date:** 2026-07-21 (extended same day with Flows 6–7: WhatsApp delivery and automated email sends)
**Scope:** Do the critical flows work correctly *as coordinated wholes* — are the handoffs between functions correct, can a flow silently break or leave inconsistent state, and can a retry double-act?
**Method:** Read-only trace of the current code on `main` (line numbers verified against the working tree on the audit date), plus a full run of the existing test suite.
**Test suite result:** `npm test` — **539 tests, 539 pass, 0 fail** (duration ~1.7s).

A note on the test harness that matters for interpreting coverage claims below: `test/helpers/d1.mjs` applies **every numbered migration** to an in-memory SQLite DB, so tables like `stripe_events` are real in tests. However its `D1.batch()` shim (`test/helpers/d1.mjs:27`) runs statements sequentially **without a transaction**, so any production behaviour that relies on D1 batches being atomic/serialized (the matcher's enqueue-and-claim, `saveSettings`) is *approximated*, not proven, by tests.

---

## Flow 1 — Stripe checkout → webhook → provisioning

### Call chain

**Deposit leg**

1. `POST /portal/pay` — `src/index.js:1727-1730` → `startDepositCheckout(env, session, queueId, here)`
2. `startDepositCheckout` — `src/index.js:1811-1840`
   - reads settings (`getSettings`, `src/settings.js:54`), gates on `stripeConfigured(env) && settingOn(settings, "stripe_enabled") && depositAud > 0` (`src/index.js:1815`)
   - verifies queue-row ownership: `SELECT 1 FROM queue WHERE id = ? AND client_id = ?` (`src/index.js:1823`) — a client cannot attach another client's match to their payment
   - calls `createCheckoutSession` with `amountCents: Math.round(depositAud * 100)` (`src/index.js:1829`)
3. `createCheckoutSession` — `src/stripe.js:50-77`
   - **writes the intent first**: `INSERT INTO payments (... amount_cents ... status) VALUES (..., 'created')` (`src/stripe.js:55-57`)
   - creates the Stripe session with `unit_amount: amountCents` and `metadata: { payment_id, client_id, queue_id }` (`src/stripe.js:61-73`)
   - back-fills `payments.stripe_session = session.id` (`src/stripe.js:75`)
4. Buyer pays on Stripe's hosted page; Stripe POSTs the event.
5. `POST /webhooks/stripe` — `src/index.js:747-771` (sits **above** the session gate and CSRF guard at `src/index.js:789-799`, correctly — it is authenticated by signature, not cookie)
   - no `STRIPE_WEBHOOK_SECRET` → 503 so Stripe keeps retrying (`src/index.js:752-755`)
   - `verifyAndParseEvent(env, raw, header)` — `src/stripe.js:141-155`: HMAC-SHA256 over `t.rawBody`, constant-time compare (`timingSafeEqualHex`, `src/stripe.js:132`), 5-minute replay window. Invalid → 400.
6. `applyStripeEvent` — `src/stripe.js:164-183` — the idempotency ledger:
   ```js
   const rec = await env.DB.prepare(
     "INSERT OR IGNORE INTO stripe_events (id, type) VALUES (?, ?)"
   ).bind(event.id, event.type).run();
   firstSeen = (rec?.meta?.changes ?? 0) > 0;
   ...
   if (!firstSeen) return "duplicate";
   try { return await applyStripeEventInner(env, event); }
   catch (err) {
     try { await env.DB.prepare("DELETE FROM stripe_events WHERE id = ?").bind(event.id).run(); } catch (_) {}
     throw err;
   }
   ```
   (`stripe_events` schema: `migrations/0004_stripe_events.sql`, `id TEXT PRIMARY KEY`.)
7. `applyStripeEventInner` — `src/stripe.js:187-244`
   - deposit branch: `UPDATE payments SET status = 'paid', stripe_intent = ?, paid_at = ... WHERE id = ? AND status <> 'paid'` (`src/stripe.js:226-228`), falling back to lookup by `stripe_session` when `metadata.payment_id` is absent (`src/stripe.js:229-233`)
   - then `advanceDepositPaid(env, obj)` — `src/stripe.js:249-273` — resolves payment → queue row → wishlist (or the client's most recent wishlist) and calls `updateRequestStatus(..., "deposit_paid")` **only if** the wishlist is in an early stage (`src/stripe.js:269`). Wrapped in its own try/catch — "best-effort; never fails the event".
8. Back in the route: `paymentChime(event, status, env.PUBLIC_URL)` (`src/notify.js:151-164`) builds a phone push **only** for first-seen `"paid"`/`"subscribed"` statuses, then `sendPush` (never throws, `src/notify.js:89-145`). Any throw from step 6/7 → 500 → Stripe retries (`src/index.js:766-769`).

**Membership leg** — `POST /portal/subscribe` (`src/index.js:1752-1754`) → `startSubscriptionCheckout` (`src/index.js:1767-1789`, gated on `membership_enabled` + price, skips existing members) → `createSubscriptionCheckout` (`src/stripe.js:83-106`, passes `client_reference_id` and `metadata.client_id`) → webhook → `applyStripeEventInner` membership branch (`src/stripe.js:194-205`): `UPDATE clients SET member = 1, sub_status = 'active', stripe_customer_id = COALESCE(...), stripe_subscription_id = COALESCE(...)`. Lifecycle events (`customer.subscription.updated/deleted`, `src/stripe.js:210-220`) drive `member` off the subscription status, matching by subscription id with a customer-id fallback.

### Handoff verification

| Handoff | Passed | Expected | Verdict |
|---|---|---|---|
| route → `startDepositCheckout` | `session` ({role, id}), `queueId` (Number or null) | client id via `session.id` | ✅ match; ownership re-checked |
| `startDepositCheckout` → `createCheckoutSession` | `client` (full row), `amountCents` int, `currency` | same names | ✅ match |
| `createCheckoutSession` → Stripe → webhook | `metadata.payment_id` = **String(paymentId)** | inner reads `obj.metadata?.payment_id` and re-casts `Number(paymentId)` (`src/stripe.js:228`) | ✅ round-trips correctly |
| membership session → webhook | `client_reference_id` = String(client.id) | `Number(clientId)` in the UPDATE (`src/stripe.js:202`) | ✅ |
| `applyStripeEvent` → route | status string (`"paid"`, `"subscribed"`, `"duplicate"`, `"ignored"`, …) | `paymentChime` gates on exactly `"subscribed"`/`"paid"` | ✅ retries never double-ping |

### The four explicit questions

**Does a duplicate webhook double-provision?** **No — two independent guards.** The `stripe_events` INSERT OR IGNORE returns `changes = 0` on a repeat id → `"duplicate"` and nothing runs. Even if the ledger table were missing (the `catch` at `src/stripe.js:173-175` deliberately fails open), every inner write is idempotent: the payments UPDATE has `AND status <> 'paid'`, `member = 1` is idempotent, and `advanceDepositPaid` only advances early stages.

**Does a throw mid-flow roll back cleanly so Stripe's retry reprocesses?** **Yes, with two small caveats.** On throw, the guard row is deleted and the route returns 500, so Stripe retries and the ledger no longer blocks it. Proven by test (`subscription.test.mjs:90-117`). Caveats:
1. If the compensating `DELETE` itself fails (`src/stripe.js:180` swallows it), the event stays "seen" with its effects unapplied — the retry gets `"duplicate"` → 200 and the event is lost. Two consecutive DB failures on different statements are needed, so it's a narrow window, but it is a permanent-loss path with only a `console.error` for the original throw.
2. Guard-before-effects has the classic concurrent-delivery race: if Stripe delivers the same event twice near-simultaneously, delivery B can get `"duplicate"` → 200 *while* delivery A is still mid-apply. If A then throws and rolls back, Stripe has already seen a 2xx for the event (from B) and may not retry. Extremely unlikely in practice, but the design accepts it.
3. Partial inner state on throw: `applyStripeEventInner` runs multiple statements without a transaction (e.g. payments UPDATE succeeded, then a later statement throws). The rollback deletes only the guard row, not the applied effect. This is *safe here* because every inner write is idempotent — the retry converges — but any future non-idempotent side effect added to `applyStripeEventInner` (the comment at `src/stripe.js:160` mentions "a future import-fee credit") would break this invariant silently.

**Does the amount charged match the amount intended?** **Yes.** The amount is read from settings exactly once, at session creation, snapshotted into both `payments.amount_cents` (`src/stripe.js:56-57`) and the Stripe session's `unit_amount` (`src/stripe.js:69`) in the same function. The webhook never consults settings; it only flips the status of the pre-recorded row. One gap: the webhook does not cross-check `obj.amount_total` against `payments.amount_cents`, so a session created outside this code path (or a Stripe-side amendment) would be marked paid at whatever was recorded. Not reachable via the app's own flows.

**What if the admin edits the settings amount between session creation and webhook arrival?** **Nothing changes for the in-flight payment.** Stripe charges the `unit_amount` fixed at creation; the ledger row was written with the same figure; the webhook touches neither. New checkouts pick up the new setting. This is the correct design (snapshot-at-intent).

### Error/edge paths

- Stripe API failure during `createCheckoutSession` → the `payments` row is left as `'created'` forever (the `UPDATE ... stripe_session` never runs). Harmless — `checkout.session.expired` handling (`src/stripe.js:239-242`) flips genuinely-abandoned sessions to `'expired'`, and orphaned `'created'` rows surface on the Payments page as "outstanding" (`deposit-chase` UI, `src/admin.js:1664`). No cleanup for rows that never got a session; cosmetic only.
- `/portal/pay/success` (`src/index.js:1731`) just flashes "?ok=paid" — provisioning is webhook-driven only, so a user returning before the webhook lands sees "paid" flash while `payments.status` is still `created`. Display-only race, self-heals.

### Test coverage

| Step | Covered by | Gap |
|---|---|---|
| Deposit paid / expired / replays idempotent (inner writes) | `test/stripe.test.mjs` (4 tests) | — |
| Membership provision / cancel / past_due / wrong-client isolation | `test/subscription.test.mjs` | — |
| **Ledger dedup with a real `event.id`** | `test/subscription.test.mjs:75-88` (`evt_dupe`) | ✅ already closed |
| **Rollback-then-retry of the ledger** | `test/subscription.test.mjs:90-117` (`evt_retry`) | ✅ already closed |
| `paymentChime` gating | `test/push.test.mjs` (3 tests) | — |
| Signature verification | only the "no secret configured → null" case (`stripe.test.mjs`) | ❌ **No valid-signature, forged-signature, or stale-timestamp test; the live `/webhooks/stripe` route is never exercised** (only `canonical-domain.test.mjs` touches the path, for redirect exemption) |
| `startDepositCheckout` / `startSubscriptionCheckout` gating and ownership check | none | ❌ untested |
| `createCheckoutSession` payment-row insert + metadata round-trip | none (subscription test seeds the payments row by hand) | ❌ untested |
| `advanceDepositPaid` stage advancement | none directly (crm-autopilot tests cover `updateRequestStatus` semantics) | ❌ untested |

---

## Flow 2 — Matcher cron → match → client delivery

### Call chain

1. Cron (`wrangler.toml:38`, `crons = ["0 */6 * * *"]`) → `scheduled()` — `src/index.js:219-221`:
   ```js
   ctx.waitUntil((async () => { await expirePast(env); await autoFollowUps(env); await runMatcher(env); })());
   ```
   `expirePast` (`src/admin.js:4590`) and `autoFollowUps` (`src/admin.js:4559`) each swallow their own errors, so they cannot prevent `runMatcher` from running.
2. `runMatcher(env)` — `src/index.js:1945-1985` → `runAll(env, session)` — `src/matcher.js:258-300`
   - reads settings once: `run_includes_free`, `budget_filter`, `budget_headroom_pct` (`src/matcher.js:267-272`, defaults on error)
   - selects active wishlists **joined** with client + agent columns (`w.*, c.name AS client_name, c.email AS client_email, c.whatsapp AS client_whatsapp, c.state AS client_state, c.agent_id, ag.email/name/alerts/active`) (`src/matcher.js:273-278`)
   - per-wishlist try/catch: `console.error(\`Wishlist ${w.id} failed\`)` and **continues** (`src/matcher.js:295-297`) — one bad wishlist never aborts the fan-out ✅
3. `runWishlist(env, w, opts)` — `src/matcher.js:161-242`
   - guards no-term wishlists (`:164`), builds SQL (`buildSql`, `:27-95`), `refine` (`:129`), scores/sorts, filters against `seen_lots` (`getSeen`, `:246-255`), caps pending at 40 (`:185-189`)
   - `attachLanded(env, fresh.map((lot) => ({ lot, client: { state: wishlist.client_state } })))` (`:194`) → `src/calc.js:202-215`: bounded-concurrency (6) fan-out to the landed-cost API; `estimateLanded` returns `null` on any HTTP error/timeout (`src/calc.js:165, 177-180`) — a calculator outage degrades to "no estimate", never a throw ✅
   - `withinBudget` (`:147-156`): lots **without** an estimate are always kept — an API outage cannot silently hide matches ✅
   - **enqueue-and-claim** (`:203-240`): per-lot pairs of statements in ONE `env.DB.batch`:
     ```sql
     INSERT INTO queue (...) SELECT ?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM seen_lots WHERE wishlist_id=? AND lot_id=?);
     INSERT OR IGNORE INTO seen_lots (wishlist_id, lot_id) VALUES (?,?);
     ```
     The queue insert's `meta.changes` decides whether *this* run truly queued the lot (`:236-239`), so a lost race yields no digest entry and no delivery. Correct on production D1 (batches are serialized transactions). Race covered by `test/matcher-race.test.mjs`.
4. Fork on `w.auto_notify` (`src/matcher.js:290-294`):
   - **auto**: `autoDeliver(env, w, queued)` (`:379-394`) — per-lot try/catch; success → `UPDATE queue SET status='sent' ... WHERE token = ?`, failure → `status='failed'`. One lot's failure never stops the rest ✅.
   - **manual** (default): entry pushed to `summary`; `runMatcher` groups by owning agent and emails digests (`src/index.js:1951-1983`), each `sendEmail` in its own try/catch (`:1972-1982`) — one digest failure doesn't kill the others ✅. Digest gated on `email_alerts` (admin) / `agent.alerts` (agents) (`:1971`).
5. Staff approve (Flow 3 or single `/decide`) → `deliverToClient` / `deliverManyToClient` — `src/notify.js:194-231 / 236-276`.

### Handoff verification

- **wishlist → client join**: `runAll`'s SELECT aliases client fields onto the wishlist row; `autoDeliver` reconstructs `client = { id: w.client_id, name: w.client_name, email: w.client_email, whatsapp: w.client_whatsapp }` (`src/matcher.js:380`). ✅ ids line up. ⚠️ Two soft mismatches inside `deliverToClient`'s optional paths:
  - the reconstructed client has **no `state`**, so the fallback `estimateLanded(env, lot, client)` (`src/notify.js:205`) would compute a default-port estimate — in practice moot because `lot._landed` was already attached in `runWishlist` and is serialized into `lot_json`;
  - it has **no `member`** field — `upsellFor` handles exactly this by falling back to a DB lookup by `client.id` (`src/notify.js:182-186`). ✅ handled by design.
- **queue insert → later delivery**: `lot_json` snapshots the scored, landed-estimated lot (`_score`, `_strength`, `_landed`, `_watch`), so approval-time rendering matches what staff reviewed. `token` (random UUID hex) is the handle `autoDeliver` uses for its status UPDATE, and the handle `/decide` uses for email links. ✅ consistent.
- **`deliverToClient` → caller**: returns `{ email: bool, whatsapp: bool }`. ⚠️ `autoDeliver` **ignores the return value** — see the pause-setting finding below.

### Is "client emails paused" (`send_to_client`) honoured end-to-end?

The gate itself is single-sourced and honoured at every send site: `deliverToClient` (`src/notify.js:199`) and `deliverManyToClient` (`src/notify.js:240`) both return early with `{email:false, whatsapp:false}` when `send_to_client` is `"0"`. No path emails a client around it. ✅

**But the *status bookkeeping* is inconsistent across the four call sites:**

| Path | With `send_to_client = 0` | Row status afterwards |
|---|---|---|
| `/decide` single approve (`src/index.js:2091-2094`) | no email | `sent` |
| Bulk approve (`src/index.js:2182-2183`) | no email | `sent` |
| Cron `autoDeliver` (`src/matcher.js:383-386`) | no email | `sent` |
| Welcome match (`src/matcher.js:356-368`) | no email (`sent = !!(r && r.email)` is false) | **stays `pending`** |

The first three are documented behaviour ("approving just marks the match handled — you reach out manually", `src/notify.js:197-199`). The welcome-match path deliberately keeps the row pending "so the lead is never lost". Both choices are individually defensible, but "sent" therefore means *"decision recorded"* in three paths and *"actually emailed"* in one. The same divergence bites harder for **auto-notify wishlists while emails are paused**: the cron marks their matches `sent` with nobody notified and no digest entry (auto-notify skips the digest, `src/matcher.js:290-293`) — those matches are silently consumed. If pausing emails is ever used for a real outage window, auto-notify clients permanently miss those cars.

### Error paths

- Feed relay outage: `query()` throws → per-wishlist catch in `runAll` → logged, skipped, next wishlist unaffected. ✅
- Landed-cost API outage: `estimateLanded` catches and returns null; `withinBudget` keeps unestimated lots. ✅
- `autoDeliver` failure marks `failed` — same stranded-state caveat as Flow 3 (below): nothing in the UI resurfaces `failed` rows for retry.

### Test coverage

| Step | Covered by | Gap |
|---|---|---|
| SQL building, refine, scoring, budget | `budget.test.mjs`, `budget-filter.test.mjs`, `scoring.test.mjs`, `mileage-min.test.mjs`, `model-code-grades.test.mjs` | — |
| Enqueue/claim race | `matcher-race.test.mjs` (2 tests) | ⚠️ shim's `batch` is not transactional, so the *atomicity* is asserted only by construction |
| Queue-capacity vs budget ordering | `stabilization-regressions.test.mjs` ("partially full queue still reaches affordable candidates") | — |
| Welcome match (incl. paused-send stays pending implicitly) | `welcome-match.test.mjs` (5 tests) | — |
| `runAll` fan-out isolation (one wishlist throws, others continue) | none | ❌ |
| `autoDeliver` failure → `failed`, success → `sent` | none | ❌ |
| Digest grouping / agent-paused fold-into-admin (`src/index.js:1952-1966`) | none | ❌ |
| `send_to_client` honoured in `deliverToClient`/`deliverManyToClient` | none directly | ❌ |
| Cron `scheduled()` composition | none (unit-level `expirePast`/`autoFollowUps` covered in `crm-autopilot.test.mjs`) | ❌ route/cron composition untested |

---

## Flow 3 — Bulk approve / reject (`applyBulkDecisions`)

### Call chain

1. `POST /matches/bulk` — `src/index.js:1171-1186` — behind the session gate (`:790`) and CSRF origin check (`:797`); ids parsed `Number(...)`, filtered to positive ints; action whitelisted to `approve|reject|delete`.
2. Wrapped in `act()` (`src/index.js:823-830`): a throw from the whole batch is contained and surfaces as an error toast; otherwise a success toast. ⚠️ `act()` shows **"Sent N matches"** based only on "didn't throw" — per-item failures inside the batch are swallowed by inner catches, so the toast can overcount (see below).
3. `applyBulkDecisions(env, action, ids, session)` — `src/index.js:2130-2190`:
   - **reject** (`:2131-2143`): per-id loop, each in try/catch:
     ```js
     const item = await env.DB.prepare("SELECT * FROM queue WHERE id = ?").bind(id).first();
     if (!item || item.status !== "pending") continue;
     if (session && session.role === "agent" && !(await clientAccessibleBy(...))) continue;
     await env.DB.prepare("UPDATE queue SET status = 'rejected', decided_at = ... WHERE id = ?")...
     ```
   - **approve prep** (`:2147-2167`): per-id loop, each in try/catch — loads queue row (skip non-pending), agent access check, loads `wishlist JOIN clients` by `item.wishlist_id`, parses `lot_json` (its own try/catch → `{}` on corrupt JSON), groups rows into `byClient` keyed by `item.client_id`, loading the client row once per client.
   - **watch-only** (`:2169-2176`): marked `sent` + `recordMatchSent`, no email — matches the single-decision behaviour (`src/index.js:2082-2087`). ✅
   - **delivery per client** (`:2178-2189`):
     ```js
     const setStatus = (st) => env.DB.batch(rows.map(({item}) => UPDATE queue SET status=?, decided_at=... WHERE id = item.id));
     try {
       await deliverManyToClient(env, client, rows.map(({lot, wishlist}) => ({lot, wishlist})));
       await setStatus("sent");
       for (const {item} of rows) { try { await recordMatchSent(env, item.id, session); } catch {} }
     } catch (err) {
       console.error(...); try { await setStatus("failed"); } catch {}
     }
     ```
4. `deliverManyToClient` — `src/notify.js:236-276`: one combined email per client (single-car falls back to the rich single template), landed figures from the `_landed` snapshot with a live-estimate fallback, WhatsApp best-effort in its own try/catch.
5. `recordMatchSent` — `src/admin.js:3293-3313`: stamps `sent_at` (guarded `if (!q.sent_at)` — idempotent), timeline activity, auto-advances early-stage requests to `vehicles_sent`. Entirely try/catch-wrapped — can never fail the batch. ✅
6. Second entry point: `POST /client/find/bulk` with `do=send` — `src/index.js:1264-1290` → `addLotsToClient` (`src/admin.js:7818-7833`, returns `{queued: [queueIds], failed, requested}`) → `applyBulkDecisions(env, "approve", r.queued, session)` (`src/index.js:1279`). Handoff is queue ids in both cases. ✅

### The explicit questions

**If id 30 of 50 fails, are the first 29 committed and the rest not?** **No — and the actual behaviour is better than that.** There is no batch transaction; each id (reject) or each client-group (approve) commits independently. A failure at id 30 skips *only* id 30 (or only that client's group) — ids 31-50 still process. Nothing already committed is rolled back, and nothing pending is abandoned. Each row ends in exactly one of: untouched-`pending` (skipped/errored during prep), `rejected`, `sent`, or `failed` — there is no half-state *per row*.

**Is that partial state safe and recoverable?** **Safe: yes. Fully recoverable: no — two gaps.**
1. **`failed` rows are stranded.** Both decision paths require `status === 'pending'` (`src/index.js:2135, 2152` and `:2064`), and the Matches queue only lists `status = 'pending'` rows (`src/admin.js:1162`). A row marked `failed` (delivery threw) is visible only as a status chip on the client detail page (`src/admin.js:1082`) and can never be re-approved from any surface. The matched car is silently lost unless staff notice the chip. Same applies to `autoDeliver` failures in Flow 2.
2. **The success toast lies on partial failure.** `act()` reports "Sent N matches" whenever `applyBulkDecisions` resolves — which it always does, because every failure is caught inside. If 3 of 5 client groups failed delivery, staff still see "Sent 5 matches (one combined email per client)". Combined with gap 1, a partial failure is both invisible and unrecoverable through the UI.
3. One narrower sequencing wrinkle: if the email sends but `setStatus("sent")` then throws, the catch marks the rows `failed` — a *delivered* email recorded as failure. With gap 1 this can't double-send (failed ≠ pending), but the record is wrong.

**Is applying the same decision twice idempotent?** **Sequentially, yes.** The `status !== "pending"` guard makes a re-run skip every already-decided row; `recordMatchSent` re-stamps nothing. **Concurrently, no hard guarantee:** two overlapping bulk approves (double-click, two staff) can both read `pending` before either writes, and both deliver — a duplicate email. Unlike the matcher's enqueue-and-claim, there is no compare-and-swap (`UPDATE ... WHERE status='pending'` with a changes check) claiming the row before delivery. Low likelihood, real window.

### Test coverage

**None of `applyBulkDecisions`, `deliverManyToClient`, or the `/matches/bulk` route is tested at all** — the biggest coverage hole of the five flows. Adjacent coverage: `send-flow.test.mjs` covers `addLotsToClient` (queue + dedupe + counts) and the send-bar UI; `decide-confirm.test.mjs` covers the GET-safety of the single `/decide` path; `bulk-delete.test.mjs` covers *client* bulk-delete, not match bulk actions; `matches-triage.test.mjs` covers the Matches view rendering.

---

## Flow 4 — Public request wizard → `/request`

### Call chain

1. `POST /request` — `src/index.js:389-478` (public; sits above the session gate — a signed-in client session is *optionally* read at `:390-395` to prefill/attach identity).
2. **Throttle first**: `requestRateLimited(env, {ip, email, whatsapp})` — `src/index.js:60-80` — sliding-window in KV, per-IP **and** per-contact (email + normalized phone via `phoneKey`), increments only when allowing, TTL 3600s, fails open without KV. Over the cap → honest 429 page, **nothing stored** (`src/index.js:411-413`). This is a real gate, not decoration — verified by `ratelimit.test.mjs` (7 tests incl. IP-rotation defeat and fail-open).
3. `createRequest(env, form, session)` — `src/admin.js:7247-7402`:
   - **Honeypot** (`:7250`): `if (String(form.get("company_website") ?? "").trim()) return { ok:false, error:"spam" }`. The hidden field genuinely exists in the form (`src/admin.js:5628`: off-screen, `tabindex=-1`, `aria-hidden`), and the route maps `error:"spam"` to a **fake generic success** (`src/index.js:473-478`) — bots get no signal, nothing is stored. Real gate. ✅
   - field clipping (`:7253-7260`), email regex-or-drop (`:7274-7275`), then hard validation gates each returning `{ok:false, error, vals}`: `email` (`:7298`), `name` (`:7303`), password policy for brand-new records (`:7316-7319`), `vehicle` make+model (`:7324`), sane `year` range (`:7328-7331`), minimum `budget` (`:7339-7342`), valid `phone` (`:7349-7352`).
   - persistence: `upsertPublicClient` (`:7453-7478` — folds into an existing record by email/phone, never renames a real name, never touches agent/dealer clients) or session client; `createRequestWishlist` (`:7504`); `inviteNeeded`/`signinNeeded` flags computed with the `portal_revoked` veto respected (`:7382-7386`).
4. Route post-processing (`src/index.js:416-465`) — each side effect individually try/caught so none can 500 the confirmation: portal invite email, sign-in link, staff alert, buyer confirmation email, optional welcome match (`sendWelcomeMatch`, itself never-throw) + upsell.
5. Validation failure → **re-render with error + preserved input** (`src/index.js:473-475`); only `spam` falls through to fake success (`:478`).

### Handoff verification

- Route passes the raw `FormData` and optional session; `createRequest` re-reads everything itself — no shape mismatch possible. ✅
- `createRequest` → route: `{ ok, req, ref, clientId, wishlistId, inviteNeeded, signinNeeded }`; the route consumes exactly these (`:416-465`). `wishlistId` feeds `sendWelcomeMatch(env, result.wishlistId)` which re-joins wishlist→client itself. ✅
- **Bad input cannot 500**: every validation error returns a value, and the last-resort `fetch()` wrapper (`src/index.js:228-239`) converts even an unexpected throw (e.g. D1 outage mid-upsert) into the branded 500 page rather than a raw Worker error. ✅

### Findings

1. **Throttle counts spam and invalid submissions.** The limiter increments *before* the honeypot and validation run. A bot POSTing with the honeypot filled *and a victim's email* burns the victim's per-contact quota (`REQ_RL_CONTACT`), locking a real person out of the form for up to an hour. Small abuse lever; the honest-429 page at least tells the victim something happened.
2. **Two emails on the invite path can double-send on retry-by-user**: resubmitting the same form re-runs `alertNewRequest` + `confirmRequest` (staff get a second alert, buyer a second receipt). Upsert semantics make the *data* idempotent; the *notifications* are not. Cosmetic.
3. Everything else on this path is defensively correct; this is the most battle-hardened flow of the five (it carries the scars of the V1.2 "0.1" fake-success bug and its regression tests).

### Test coverage

| Step | Covered by | Gap |
|---|---|---|
| Rate limiter unit (all caps, rotation, fail-open) | `ratelimit.test.mjs` | ❌ route-level 429 (the honest page + no-store) untested |
| Validation gates + fold-in + policy | `signup.test.mjs` (9 tests), `password-policy.test.mjs` | — |
| Route contract: every error re-renders, no fall-through to success | `auth-flows.test.mjs` ("0.1 route contract") | — |
| Blank-name server rejection | `launch-audit-regressions.test.mjs` | — |
| **Honeypot** (server refusal + fake-success rendering + nothing stored) | none | ❌ untested — the field exists and the branch exists, but no test proves the play-dead behaviour |
| Welcome match hook | `welcome-match.test.mjs` | — |
| Wizard UI contracts | `wizard-phase2.test.mjs` | — |

---

## Flow 5 — Set-password → login → session revocation

### Call chain

1. **Invite/reset token minted**: `inviteClientPortal` / `beginPasswordReset(For)` (`src/auth.js:544-587`) — stores **only `hashToken(token)`** (SHA-256, `src/auth.js:444-449`) in `invite_token` with `invite_exp` (1h for resets, longer for invites); raw token exists only in the email link.
2. `GET/POST /set-password` — `src/index.js:690-744` — public, token-authorized (deliberately above the session/CSRF gates, `src/index.js:42-44`). POST is fully try/caught: any throw re-renders the branded page with an error, never a raw 500 to a first-time customer (`:711-740`), body-size capped (`:717`).
3. `resolveInvite` (`:695-710`) tries agent → dealer → client, each lookup isolated so one broken role table can't 500 the flow.
4. `setClientPassword` (`src/auth.js:508-520`) (and the agent/dealer twins):
   ```js
   const c = await clientByInviteToken(env, token);          // hashed-or-raw match + expiry check
   if (!c) return { ok:false, error:"This link is invalid or has expired." };
   const { salt, hash } = await hashPassword(password);       // PBKDF2 100k (platform cap documented :13-21)
   await runWithSessionVerFallback(env,
     "UPDATE clients SET pass_salt=?, pass_hash=?, invite_token=NULL, invite_exp=NULL, portal_enabled=1, session_ver = session_ver + 1 WHERE id=?", ...);
   ```
   - **Single-use**: the same UPDATE that sets the password NULLs `invite_token` — the token is consumed atomically with its use. A second presentation finds no row → "invalid or expired". ✅
   - **Expiry**: `clientByInviteToken` (`src/auth.js:498-505`) rejects `invite_exp < Date.now()`. ✅
   - **Old sessions killed**: the same UPDATE bumps `session_ver` — a password reset revokes every existing cookie for the account in one statement. ✅ (`runWithSessionVerFallback`, `src/auth.js:470-478`, degrades gracefully if migration 0010 hasn't landed.)
5. On success the route signs the user straight in: `sessionCookie(env, role, r.id)` (`src/index.js:734`) — which reads `currentSessionVer` (`src/auth.js:305-312`) **after** the bump, so the fresh cookie carries the new version and is valid while all pre-reset cookies are dead. Ordering is correct. ✅
6. **Login**: `POST /login` — `src/index.js:555-621` — lockout check (`loginLocked`, KV per-IP/per-email/admin/global, `src/index.js:108-150`) *before* password verification, fixed 1.5s delay on failure, counters cleared on success (except the deliberately sticky global counter, `:142-149`); `authenticate` (`src/auth.js:380-429`) with per-role isolation and length caps; admin MFA two-step via the signed short-lived `fmfa` cookie (`src/auth.js:275-297`).
7. **Session validation on every request**: `sessionFromCookie` (`src/auth.js:341-368`) — HMAC check first, then for 4-part cookies a live `session_ver` comparison against the DB; mismatch or deleted account → null → redirect to login. `bumpSessionVer` (`src/auth.js:315-319`) is called by deactivate/revoke/reset paths.

### The explicit questions

**Can a token be reused?** No — consumed by `invite_token = NULL` in the same UPDATE that sets the password. Proven by `token-hashing.test.mjs` ("the raw token sets the password once") and `auth-flows.test.mjs`. Theoretical footnote: two *simultaneous* POSTs of the same token can both pass the SELECT before either UPDATE lands (no compare-and-swap on `invite_token` in the WHERE clause) — both would set a password for the same account within milliseconds. Same-actor, same-email-holder, no privilege gained; negligible.

**Is an expired token rejected?** Yes — `invite_exp < Date.now()` in every `*ByInviteToken`; covered by `auth-flows.test.mjs` ("expired and unknown invite tokens are refused with a friendly error").

**Does bumping `session_ver` actually kill existing sessions?** Yes — the cookie's 4th field must equal the DB value on every request; covered directly by `session-revocation.test.mjs` ("bumping session_ver invalidates the old cookie", "a deleted account's versioned cookie is rejected"). Two documented soft spots, both deliberate and both test-pinned:
- **Legacy 3-part cookies are grandfathered** (`src/auth.js:351-354`) — a cookie minted before migration 0010 bypasses revocation until its 30-day expiry. By now (0010 long shipped) no such cookies should exist, and the signature prevents an attacker downgrading a 4-part cookie to 3-part.
- **Fail-open on DB error** (`src/auth.js:365`) — a D1 blip lets a revoked cookie through for that request rather than locking everyone out. Availability-over-revocation-latency; reasonable.
- Minor asymmetry: `currentSessionVer` also fails open to 0 (`src/auth.js:311`), so a cookie minted *during* a DB blip gets version 0 and stops validating once the DB recovers — self-healing (user just logs in again).

### Test coverage

The best-covered flow: `auth-flows.test.mjs` (13 tests: signup→login round-trip, invite set-password for all three roles, expiry, role-isolation, reset eligibility/refusals, length caps), `token-hashing.test.mjs` (6 tests: hash-only storage, raw fallback, single-use), `session-revocation.test.mjs` (5 tests), `password-policy.test.mjs` (8 tests incl. full set-then-login round-trip), `csrf.test.mjs` (8 tests), `admin-mfa.test.mjs`, `portal-isolation.test.mjs`, `scoping.test.mjs`. Remaining gaps are thin: the `/set-password` POST route's catch-all re-render (`:737-740`) and the login lockout counters (`loginLocked`/`recordLoginFail`) have no direct tests.

---

## Flow 6 — WhatsApp delivery

### Call chain

1. **Gate at the delivery layer** — both senders apply the identical guard:
   - `deliverToClient` — `src/notify.js:217`: `if (client.whatsapp && settingOn(settings, "whatsapp_enabled")) { try { await sendWhatsApp(...) } catch { /* best-effort */ } }`
   - `deliverManyToClient` — `src/notify.js:266-274`: same shape, with the multi-lot message builder.
   The message payloads come from `waMatchMsg` / `waManyMsg` (`src/notify.js:18-27`): `{ name, summary, url, bodyText }` — first name via `waFirstName` (`:12`), one-line car summary via `waCarSummary` (`:15`), portal URL, and a free-form fallback body built with `carText(lot)`.
2. `sendWhatsApp(env, toNumber, msg, settings)` — `src/whatsapp.js:69-78`
   - `toE164` (`:31-42`) normalizes the stored number (AU-local default `+61`, international preserved); empty → throws `"WhatsApp: no usable number"`.
   - `whatsappProvider(env, settings)` (`:56-63`) picks the provider: honours the `whatsapp_provider` setting **only if that provider's secrets are actually set**, else falls back to whichever is configured, else `null` → throws `"WhatsApp not configured"`.
3. Provider legs:
   - **Twilio** — `sendViaTwilio` (`:81-112`): with `TWILIO_WA_CONTENT_SID` set, sends the approved Content template with numbered `ContentVariables` (`{1: name, 2: summary, 3: url}`); without it, free-form `Body` (sandbox / 24h-window only). Credentials are `.trim()`ed against the documented pasted-newline gotcha. Non-2xx → throw with body excerpt.
   - **Meta** — `sendViaMeta` (`:115-142`): with `META_WA_TEMPLATE_NAME`, a Graph template message with ordered body parameters; without, free-form text. Same trim + throw discipline.
4. Back in the caller: success sets `result.whatsapp = true` and logs the provider message id with the explicit caveat that **accepted ≠ delivered** (`src/notify.js:221, 270`; `waResultId`, `:39-41`); failure is caught and logged — "a failure must not block the email delivery" (`:222-225`).
5. Admin test-send: `POST /settings/test-whatsapp` — `src/index.js:1553-1566` — admin-only, wrapped in `act()`, calls `sendWhatsApp` directly with a typed number.

### Handoff verification

| Handoff | Passed | Expected | Verdict |
|---|---|---|---|
| `deliverToClient` → `sendWhatsApp` | `client.whatsapp` raw stored string | `toE164` accepts any formatting, throws on empty | ✅ (empty can't reach it — gated on truthiness) |
| `waMatchMsg` → provider legs | `{name, summary, url, bodyText}` | template path reads `msg.params \|\| [name, summary, url]`; free-form reads `bodyText \|\| summary` | ✅ both paths satisfied |
| `settings` → provider select | `whatsapp_provider` string | `whatsappProvider` validates against configured secrets | ✅ mis-set preference degrades to the configured provider, never a dead-end |
| provider response → caller | Twilio `{sid}` / Meta `{messages:[{id}]}` | `waResultId` handles both, defaults `"accepted"` | ✅ |

### Findings

1. **The asymmetry is one-directional, and the comment overstates it.** `src/whatsapp.js:68` says a throw lets the caller "treat it as not delivered and fall back to email" — but there is no fallback relationship in either caller: email and WhatsApp are attempted *independently*, email first. A WhatsApp failure never blocks email (correct). But because email is sent **before** the WhatsApp block and an email throw propagates out of `deliverToClient`, **a Resend outage also suppresses the WhatsApp attempt** for a client who has both channels — the row goes `failed` (Flows 2/3) with WhatsApp never tried, even though the WhatsApp channel was healthy. WhatsApp is structurally a bonus channel, never a fallback.
2. **`sent` can mean WhatsApp-accepted-only, and `pending` can hide a delivered WhatsApp.** For an email-less client with WhatsApp on: `/decide`, bulk approve, and `autoDeliver` mark the row `sent` on `{email:false, whatsapp:true}` — reasonable. But `sendWelcomeMatch` keys **only on `r.email`** (`src/matcher.js:359`): a WhatsApp-only welcome delivery leaves the row `pending`, so staff later approving it from the queue **re-delivers the same car by WhatsApp** — the one path where the channel split can double-act.
3. **"Accepted ≠ delivered" is tracked only in logs.** `result.whatsapp = true` (and the `sent` status derived from it) is set on provider acceptance. A templated-but-unapproved or outside-24h free-form message can be accepted then dropped, and nothing in the DB distinguishes that from delivery. The code is honest about this in its own log lines; the data model is not.
4. **Enabled-but-unconfigured is silent-per-send.** With `whatsapp_enabled = "1"` and no provider secrets, every send logs `"WhatsApp send skipped/failed: WhatsApp not configured"` and continues. Correct behaviour, but the only signal is `wrangler tail`; the Settings test-send button (which throws visibly through `act()`) is the intended detection path.

### Test coverage

| Step | Covered by | Gap |
|---|---|---|
| `toE164` normalization | `whatsapp.test.mjs` | — |
| Twilio free-form + template payloads | `whatsapp.test.mjs` | — |
| Meta free-form + template payloads | `whatsapp.test.mjs` | — |
| Provider selection + configured checks | `whatsapp.test.mjs` | — |
| Throw when unconfigured / numberless | `whatsapp.test.mjs` | — |
| `deliverToClient`'s gate (`whatsapp_enabled` + number present) | none | ❌ |
| WhatsApp failure never blocks email / email result unaffected | none | ❌ |
| Email failure suppresses the WhatsApp attempt (current contract) | none | ❌ untested and undocumented outside this report |
| Welcome-match WhatsApp-only leaves `pending` (re-delivery risk) | none | ❌ |
| `/settings/test-whatsapp` route | `agents-settings.test.mjs` covers only page layout | ❌ send path untested |

---

## Flow 7 — Automated email sends

### The one transport

Every email in the system funnels through `sendEmail` — `src/notify.js:45-80`:
- `MAIL_DRY_RUN=1` → logs a masked recipient and returns fake success `{id:"dry-run"}` — flows complete without real mail (`:49-57`).
- No `RESEND_API_KEY` → **throws** (`:58-60`).
- From-address: explicit `from` param, else `MAIL_FROM_INTERNAL` → `MAIL_FROM` → `onboarding@resend.dev` (`:61`). Client-facing sends pass `from: env.MAIL_FROM_CLIENT || env.MAIL_FROM_INTERNAL || env.MAIL_FROM` at the call site; internal alerts omit `from`.
- Resend non-2xx → throws with a body excerpt (`:75-78`).

Because `sendEmail` throws on failure, the correctness of each automated send reduces to one question per call site: **is the throw contained, and does the containment leave the right state behind?**

### Complete call-site inventory (all 13 non-test senders)

| # | Send | Site | Gate | Throw containment | State on failure |
|---|---|---|---|---|---|
| 1 | Match email (single) | `deliverToClient`, `src/notify.js:208` | `send_to_client` setting; `client.email` | **propagates** (by design — caller decides) | `/decide` + bulk + autoDeliver mark `failed` (stranded, Flow 3); welcome stays `pending` |
| 2 | Match email (combined) | `deliverManyToClient`, `src/notify.js:257` | same | **propagates** | bulk marks the whole client group `failed` |
| 3 | Staff/agent digest | `runMatcher`, `src/index.js:1973` | `email_alerts` (admin) / `agent.alerts` + `agent_active` (`:1957, :1971`) | per-group try/catch (`:1972-1982`) | matches stay `pending` in the queue — the digest is a pointer, not the source of truth ✅ |
| 4 | New-request staff alert | `alertNewRequest`, `src/index.js:1902` | `request_alerts` setting (`:1901`) | try/catch (`:1899-1909`) | logged only; push chime still fires independently (`:1916`) |
| 5 | Buyer confirmation receipt | `confirmRequest`, `src/index.js:1929` | has email | try/catch | logged only; request already stored ✅ |
| 6 | Client portal invite | `sendClientPortalInvite`, `src/index.js:1845` | invite token minted | try/catch | ⚠️ token consumed but never delivered — see finding 2 |
| 7 | Sign-in link (fold-in signup) | `src/index.js:434` | `result.signinNeeded` | try/catch (`:431-441`) | same as 6 |
| 8 | Forgot-password reset | `src/index.js:640` | reset rate limiter | try/catch (`:637-650`) — neutral page either way ✅ | same as 6 |
| 9 | Admin "Send reset" | `src/index.js:1330` | admin-only | route try/catch (`:1338-1341`) — **visible error toast** ✅ | token stamped; admin sees failure and can resend ✅ |
| 10 | Agent invite | `sendInvite`, `src/index.js:1874` | invite created | try/catch | ⚠️ silent — "Agent added and invited" toast shows regardless |
| 11 | Dealer invite | `sendDealerInvite`, `src/index.js:1886` | invite created | try/catch | ⚠️ same |
| 12 | Client-request staff alert | `alertClientRequest`, `src/index.js:1861` | portal approve happened | try/catch | logged only ✅ |
| 13 | Settings test email | `src/index.js:1546` | admin-only | `act()` → visible toast ✅ | — but see finding 1 |

### Findings

1. **Real bug — the Settings "Test email" button cannot work: swapped arguments.** `src/index.js:1543`:
   ```js
   const to = digestRecipient(env, settings);
   ```
   but the function is declared `digestRecipient(settings, env)` (`src/settings.js:81-83`):
   ```js
   return (settings.digest_email && settings.digest_email.trim()) || env.DIGEST_EMAIL;
   ```
   With the arguments reversed it evaluates `env.digest_email` (never set — the env var is `DIGEST_EMAIL`) `|| settings.DIGEST_EMAIL` (never set — the settings key is `digest_email`), so `to` is always `undefined`, the handler throws `"no alert email configured"`, and `act()` shows the generic failure toast — **regardless of configuration**. Every other call site (`:1862, :1903, :1970`) passes `(settings, env)` correctly; this is the only swap. Consequence: the one button built to *verify* the email channel always reports failure, which both breaks the verification loop and trains the operator to distrust it. One-argument-swap fix; regression test proposed below (#8).
2. **Invite/reset tokens are consumed even when the email dies.** Sites 6, 7, 8 stamp `invite_token`/`invite_exp` onto the account row *first*, then attempt the email in a try/catch that only logs. On email failure the row now holds a hashed token nobody received. Not a security issue (the old token is simply superseded on the next attempt, and `/forgot-password` must stay neutral by design), and the public paths can retry freely — but on the *signup* path (site 6, `inviteSent` flag `src/index.js:419-425`) the confirmation page's "check your inbox" hint keys off `inviteSent`, which is only true when `sendClientPortalInvite` didn't throw internally… except `sendClientPortalInvite` **swallows its own throw**, so `inviteSent` is set to `true` at `:423` *before* the email is known to have left — actually tracing precisely: `inv.ok && inv.token` guards minting, then `await sendClientPortalInvite(env, inv); inviteSent = true;` — the awaited call never throws (internal catch), so `inviteSent = true` even when Resend refused the message. The customer is told a set-password email is on its way when it provably is not. Cosmetic-to-annoying; the fix is returning a boolean from `sendClientPortalInvite`.
3. **Silent success toasts on invite sends (sites 10, 11).** `POST /agent` and `POST /dealer` show "added and invited" based on row creation, with the email failure visible only in logs. An agent/dealer who never got their link looks like they're ignoring onboarding. (Contrast site 9, which got this right.)
4. **The gates are consistent and correctly scoped.** `send_to_client` governs *only* client match delivery; `email_alerts` only the digest; `request_alerts` only new-request alerts; transactional sends (receipts, invites, resets) are deliberately ungated. No cross-contamination found — pausing client emails does not silence staff alerts, and vice versa. ✅
5. **`MAIL_DRY_RUN` is honoured everywhere by construction** (it lives inside `sendEmail`), and its fake success exercises the same status-marking paths as production — good for staging, but worth knowing: a dry-run environment marks queue rows `sent` exactly like production.

### Test coverage

| Area | Covered by | Gap |
|---|---|---|
| Match email content: hero image proxy, upsell block gating | `email-hero.test.mjs`, `match-email-upsell.test.mjs` (incl. `deliverToClient` member/non-member/off matrix) | — |
| Welcome-match email flow | `welcome-match.test.mjs` | — |
| Settings round-trip for the gates | `settings.test.mjs` | — |
| `sendEmail` itself (dry-run masking, missing-key throw, non-2xx throw, from-address chain) | none | ❌ |
| Digest gating/grouping (`email_alerts`, `agent.alerts`, paused-agent fold-into-admin) | none | ❌ |
| `alertNewRequest` gating on `request_alerts` + `digestRecipient` fallback order | none | ❌ |
| **`/settings/test-email` (the broken button)** | `agents-settings.test.mjs` checks page layout only | ❌ a behavioural test would have caught the arg swap |
| Invite-email failure handling (`inviteSent` honesty, sites 6/10/11) | none | ❌ |

---

# A) Per-flow verdicts

**Flow 1 — Stripe checkout → webhook → provisioning: Solid.**
The handoffs are correct end to end: the amount is snapshotted once at intent time so charge, ledger row, and settings drift can never disagree; `metadata.payment_id`/`client_reference_id` round-trip correctly; the `stripe_events` ledger plus idempotent inner writes mean a duplicate webhook cannot double-provision, and the rollback-on-throw path (proven by test) lets Stripe retries converge. The residual risks are narrow: a failed compensating DELETE permanently strands an event, the guard-before-effects race under concurrent duplicate delivery, and — the one to watch — the inner handler's safety depends entirely on every write staying idempotent, which nothing enforces for future additions. The webhook *route* (signature verification against a live request) has no test at all, which is the flow's real coverage debt.

**Flow 2 — Matcher cron → match → delivery: Works but has a gap.**
The mechanics are genuinely well-engineered: per-wishlist failure isolation, a correctly-designed enqueue-and-claim against concurrent runs, landed-cost outages degrading to "keep the lot", and per-lot/per-digest error containment. The gap is semantic, not mechanical: the `send_to_client` pause is honoured at the send layer everywhere, but three paths mark suppressed sends as `sent` while the welcome path keeps them `pending` — and for auto-notify wishlists during a pause, matches are consumed as `sent` with nobody told and no digest fallback. Additionally, delivery failures mark rows `failed`, and `failed` rows are unreachable from any retry surface.

**Flow 3 — Bulk approve/reject: Has a real bug (recoverability), plus a soft race.**
Per-item isolation and sequential idempotency are correct, and the one-combined-email-per-client grouping hands the right ids through cleanly. But (1) a failed delivery marks rows `failed`, and `failed` rows can never be re-approved — the Matches queue lists only `pending`, and both decision paths refuse non-pending rows — so a transient email outage silently and permanently loses those matches; (2) `act()` reports "Sent N" even when every group failed, hiding the loss; (3) two concurrent approvals of the same rows can double-email because rows aren't claimed with a status-guarded UPDATE before delivery. This is also the only flow of the five with **zero direct test coverage**.

**Flow 4 — Public request wizard → /request: Solid.**
The honeypot and both throttles are real gates with correct fail-open/fail-honest behaviour; every validation error re-renders without a 500 (with regression tests pinning the historical fake-success bug); persistence is fold-into-one-record idempotent; and every post-persist side effect is individually contained. Remaining nits — spam submissions consuming a victim's per-contact quota, duplicate notification emails on user resubmit, and no test on the honeypot branch — don't threaten the flow's integrity.

**Flow 5 — Set-password → login → session revocation: Solid.**
Single-use is enforced atomically (token NULLed in the same UPDATE that sets the password), expiry is checked on every lookup, the session_ver bump revokes all pre-reset cookies while the ordering guarantees the fresh cookie is minted against the *new* version, and the deliberate fail-open/grandfathering trade-offs are documented and test-pinned. This is also the best-tested flow in the repo.

**Flow 6 — WhatsApp delivery: Works but has a gap.**
The provider layer is clean and well unit-tested: normalization, template-vs-free-form, provider selection that degrades to whatever is configured, credential-trim hardening, and throw-on-failure so callers control the outcome. The gaps are at the seams: an email failure suppresses the WhatsApp attempt entirely (channel independence is one-directional), the welcome-match path can re-deliver a WhatsApp because `sent` keys only on the email result, and delivery status records provider *acceptance*, not delivery. None of the caller-side gating or the failure-isolation contract has a test.

**Flow 7 — Automated email sends: Has a real bug (plus honesty gaps).**
The architecture is right — one throwing transport, per-site containment, and cleanly separated gates (`send_to_client` / `email_alerts` / `request_alerts`) with no cross-contamination. But the Settings "Test email" button is broken outright by a swapped-argument call (`digestRecipient(env, settings)` at `src/index.js:1543`) — it always reports failure, defeating the exact verification loop it exists for. Beyond that: the signup confirmation page claims an invite email was sent before knowing it was (`inviteSent` is set even when the send failed inside its own catch), and agent/dealer invite failures hide behind success toasts. The transport itself (`sendEmail`) and every gate around it have zero direct tests.

---

# B) Ranked list of integration tests worth adding

Note on the two tests the prior audit named: **the `stripe_events` ledger with a real `event.id` is already covered** (`test/subscription.test.mjs:75-117` — dedup with `evt_dupe`, rollback-and-retry with `evt_retry`). The **forged-signature test against the live route is not** — it is #1 below. All code below is a proposal; nothing has been added or run.

### 1. Webhook route: forged / valid / stale `Stripe-Signature` (protects Flow 1) — Effort: S

Asserts: a forged signature gets 400 and writes nothing; a correctly signed body is applied end-to-end through the live route (payment flips to paid); a correctly signed but stale (>5 min) timestamp gets 400; a replayed signed event gets 200 with no second effect. This is the only thing standing between the internet and `applyStripeEvent`, and today zero tests exercise it.

```js
// test/stripe-webhook-route.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import worker from "../src/index.js";

const SECRET = "whsec_test";
const enc = new TextEncoder();
async function sigHeader(secret, body, t = Math.floor(Date.now() / 1000)) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${body}`)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `t=${t},v1=${hex}`;
}
function post(body, sig) {
  return new Request("https://jdmconnect.example/webhooks/stripe", {
    method: "POST", body, headers: sig ? { "Stripe-Signature": sig } : {},
  });
}
const ctx = { waitUntil() {} };
function envWith(extra) {
  const env = makeEnv(`INSERT INTO clients (id, name) VALUES (1, 'Buyer');
    INSERT INTO payments (id, client_id, amount_cents, currency, status) VALUES (1, 1, 50000, 'aud', 'created');`);
  return Object.assign(env, { STRIPE_WEBHOOK_SECRET: SECRET, ADMIN_TOKEN: "tok", PUBLIC_URL: "https://x" }, extra);
}
const EVT = JSON.stringify({
  id: "evt_route_1", type: "checkout.session.completed",
  data: { object: { mode: "payment", metadata: { payment_id: "1" }, payment_intent: "pi_1", id: "cs_1" } },
});

test("a forged Stripe-Signature is rejected with 400 and applies nothing", async () => {
  const env = envWith();
  const res = await worker.fetch(post(EVT, await sigHeader("whsec_WRONG", EVT)), env, ctx);
  assert.equal(res.status, 400);
  assert.equal((await env.DB.prepare("SELECT status FROM payments WHERE id=1").first()).status, "created");
  assert.equal((await env.DB.prepare("SELECT COUNT(*) c FROM stripe_events").first()).c, 0);
});

test("a correctly signed event is applied end-to-end through the route", async () => {
  const env = envWith();
  const res = await worker.fetch(post(EVT, await sigHeader(SECRET, EVT)), env, ctx);
  assert.equal(res.status, 200);
  assert.equal((await env.DB.prepare("SELECT status FROM payments WHERE id=1").first()).status, "paid");
  assert.equal((await env.DB.prepare("SELECT COUNT(*) c FROM stripe_events WHERE id='evt_route_1'").first()).c, 1);
});

test("a stale timestamp (replay outside the 5-minute window) is rejected", async () => {
  const env = envWith();
  const stale = Math.floor(Date.now() / 1000) - 600;
  const res = await worker.fetch(post(EVT, await sigHeader(SECRET, EVT, stale)), env, ctx);
  assert.equal(res.status, 400);
});

test("a redelivered signed event returns 200 and does not re-apply", async () => {
  const env = envWith();
  await worker.fetch(post(EVT, await sigHeader(SECRET, EVT)), env, ctx);
  await env.DB.prepare("UPDATE payments SET status='refunded' WHERE id=1").run(); // sentinel
  const res = await worker.fetch(post(EVT, await sigHeader(SECRET, EVT)), env, ctx);
  assert.equal(res.status, 200); // duplicate → acknowledged, not re-applied
  assert.equal((await env.DB.prepare("SELECT status FROM payments WHERE id=1").first()).status, "refunded");
});
```

### 2. `applyBulkDecisions`: partial failure, idempotency, and the stranded-`failed` contract (protects Flow 3) — Effort: M

Asserts: one client's delivery failure marks only that client's rows `failed` while other clients' rows go `sent` and get exactly one combined email each; re-running the same approve is a no-op (no second email); rejected re-run is a no-op; and — pinning the current (buggy) contract so a future fix is visible — `failed` rows are not re-approvable. Requires stubbing `sendEmail` (e.g. `MAIL_DRY_RUN` plus a fetch spy, or exporting a seam); the failure case can drive `deliverManyToClient` to throw by unsetting `RESEND_API_KEY` for one client via a wrapped DB, or more simply by pointing `client.email` at a sentinel and intercepting `fetch`.

```js
// test/bulk-decisions.test.mjs (proposal — sketch of the core cases)
import test from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
// applyBulkDecisions is module-private in src/index.js today; either export it
// for tests (matching how admin.js exports its handlers) or drive it through
// a signed-in POST /matches/bulk request. Exporting is the smaller diff.
import { applyBulkDecisions } from "../src/index.js";

function seed(env) {
  env.db.exec(`
    INSERT INTO clients (id, name, email) VALUES (1,'A','a@x.com'), (2,'B','b@x.com');
    INSERT INTO wishlists (id, client_id, marka_name) VALUES (1,1,'Nissan'), (2,2,'Toyota');
    INSERT INTO queue (id, wishlist_id, client_id, lot_id, lot_json, token, status)
      VALUES (10,1,1,'L1','{}','t10','pending'),
             (11,1,1,'L2','{}','t11','pending'),
             (20,2,2,'L3','{}','t20','pending');`);
}

test("one client's delivery failure marks only their rows failed; others still send", async (t) => {
  const env = makeEnv(); seed(env);
  const sent = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    const body = JSON.parse(init.body);
    if (body.to.includes("b@x.com")) return new Response("boom", { status: 500 });
    sent.push(body.to[0]);
    return new Response(JSON.stringify({ id: "em_1" }), { status: 200 });
  });
  env.RESEND_API_KEY = "re_test"; env.PUBLIC_URL = "https://x";
  await applyBulkDecisions(env, "approve", [10, 11, 20], { role: "admin", id: 0 });
  const st = async (id) => (await env.DB.prepare("SELECT status FROM queue WHERE id=?").bind(id).first()).status;
  assert.equal(await st(10), "sent");
  assert.equal(await st(11), "sent");
  assert.equal(await st(20), "failed");
  assert.deepEqual(sent, ["a@x.com"]); // ONE combined email for client A, none for B
});

test("re-running the same approve is idempotent (no second email)", async (t) => {
  const env = makeEnv(); seed(env);
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; return new Response(JSON.stringify({ id: "em" }), { status: 200 }); });
  env.RESEND_API_KEY = "re_test"; env.PUBLIC_URL = "https://x";
  await applyBulkDecisions(env, "approve", [10, 11], { role: "admin", id: 0 });
  await applyBulkDecisions(env, "approve", [10, 11], { role: "admin", id: 0 });
  assert.equal(calls, 1);
});

test("a failed row cannot currently be re-approved (pins the stranded-state contract)", async (t) => {
  const env = makeEnv(); seed(env);
  await env.DB.prepare("UPDATE queue SET status='failed' WHERE id=10").run();
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; return new Response("{}", { status: 200 }); });
  env.RESEND_API_KEY = "re_test";
  await applyBulkDecisions(env, "approve", [10], { role: "admin", id: 0 });
  assert.equal(calls, 0);
  // If a retry surface is ever added, this test should flip to assert recovery.
});
```

### 3. `send_to_client` pause honoured end-to-end (protects Flows 2+3) — Effort: S

Asserts: with the setting `"0"`, `deliverToClient` and `deliverManyToClient` send nothing and return `{email:false}`; bulk approve and `autoDeliver` still mark rows (pinning the "sent-means-handled" semantics); `sendWelcomeMatch` leaves the row `pending`. This turns today's implicit, divergent semantics into an explicit, documented contract — and will catch anyone "fixing" one path without the others.

```js
// test/send-paused.test.mjs (proposal — core assertions)
test("emails paused: no send anywhere, and each path's row-state contract holds", async (t) => {
  const env = makeEnv(`INSERT INTO settings (key, value) VALUES ('send_to_client','0');
    INSERT INTO clients (id,name,email) VALUES (1,'A','a@x.com');
    INSERT INTO wishlists (id,client_id,marka_name) VALUES (1,1,'Nissan');
    INSERT INTO queue (id,wishlist_id,client_id,lot_id,lot_json,token) VALUES (10,1,1,'L1','{}','t10');`);
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; return new Response("{}", { status: 200 }); });
  env.RESEND_API_KEY = "re_test"; env.PUBLIC_URL = "https://x";

  const r = await deliverToClient(env, { id: 1, email: "a@x.com" }, {}, {});
  assert.deepEqual(r, { email: false, whatsapp: false });
  assert.equal(calls, 0, "the pause must reach the wire: zero outbound calls");

  await applyBulkDecisions(env, "approve", [10], { role: "admin", id: 0 });
  const row = await env.DB.prepare("SELECT status FROM queue WHERE id=10").first();
  assert.equal(row.status, "sent"); // documented: approve-while-paused = handled, not emailed
  assert.equal(calls, 0);
});
```

### 4. Matcher fan-out isolation and `autoDeliver` failure marking (protects Flow 2) — Effort: M

Asserts: with three active wishlists where the middle one's feed query throws, `runAll` still processes wishlists 1 and 3 (summary contains their queued lots); and for an `auto_notify` wishlist whose email send throws, the queued row ends `failed` — not `pending`, not `sent` — while a sibling lot in the same run still lands `sent`. Needs the feed `query()` stubbed (it already routes through `env`-driven fetch, so a fetch mock keyed by the encoded SQL works, or export a seam).

### 5. Request-wizard honeypot and route-level 429 (protects Flow 4) — Effort: S

Asserts: a POST to `/request` with `company_website` filled returns the *generic success page* (HTTP 200, same markup class as a real success), stores no client and no wishlist, and sends no email; a POST from an over-cap contact returns 429 with the honest "limited" page and stores nothing. Both branches exist and are load-bearing anti-abuse gates; neither has a test.

```js
// test/request-honeypot.test.mjs (proposal — core case)
test("honeypot submission plays dead: fake success, nothing stored, nothing sent", async (t) => {
  const env = makeEnv(); env.ADMIN_TOKEN = "tok"; env.PUBLIC_URL = "https://x";
  let mails = 0;
  t.mock.method(globalThis, "fetch", async () => { mails++; return new Response("{}", { status: 200 }); });
  const form = new FormData();
  form.set("company_website", "https://spam.example");   // the hidden trap field
  form.set("email", "bot@spam.example"); form.set("name", "Bot");
  form.set("marka_name", "Nissan"); form.set("model_name", "Skyline");
  form.set("year_min", "1995"); form.set("year_max", "1999");
  form.set("budget_aud", "50000"); form.set("whatsapp", "+61400000000");
  form.set("portal_password", "hunter2hunter2x9");
  const res = await worker.fetch(new Request("https://jdmconnect.example/request", { method: "POST", body: form }), env, { waitUntil() {} });
  assert.equal(res.status, 200);
  assert.equal((await env.DB.prepare("SELECT COUNT(*) c FROM clients").first()).c, 0);
  assert.equal((await env.DB.prepare("SELECT COUNT(*) c FROM wishlists").first()).c, 0);
  assert.equal(mails, 0);
});
```

### 6. Deposit checkout intent: settings snapshot and payment-row round-trip (protects Flow 1) — Effort: M

Asserts: `startDepositCheckout` with `stripe_enabled=1, stripe_deposit_aud=500` posts `unit_amount=50000` to Stripe (fetch mock capturing the form body) and inserts a `payments` row with `amount_cents=50000` and the session id back-filled; that a foreign `queue_id` is stripped (ownership check); and that changing the setting *after* creation does not alter what the (mocked) webhook marks paid. Closes the front half of Flow 1, whose tests today all start from a hand-seeded payments row.

### 7. Concurrent double-approve claim race (protects Flow 3) — Effort: L

Asserts (after a fix): the first of two overlapping approvals claims the row (status-guarded UPDATE with a changes check, the same pattern `runWishlist` uses) and the second sends nothing. Writing this test *before* the fix documents the race: with the current code, two interleaved `applyBulkDecisions` calls (achievable in the shim by pausing between the SELECT and UPDATE via a wrapped DB) both deliver. Recommended to land together with the claim fix rather than as a standalone xfail.

### 8. `/settings/test-email` regression: the swapped `digestRecipient` arguments (protects Flow 7) — Effort: S

Asserts: with `digest_email` saved in Settings (and separately with only `env.DIGEST_EMAIL` set), the admin test-email route actually calls Resend with that recipient and redirects with the success toast. **This test fails against today's code** — `src/index.js:1543` passes `(env, settings)` into a `(settings, env)` function, so `to` is always undefined — making it the rare proposed test that both proves and then pins a live bug. Land it together with the one-line argument fix.

```js
// test/settings-test-email.test.mjs (proposal)
import test from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import worker from "../src/index.js";
import { sessionCookie } from "../src/auth.js";

test("the Settings test email goes to the configured digest address", async (t) => {
  const env = makeEnv(`INSERT INTO settings (key, value) VALUES ('digest_email', 'ops@jdm.example');`);
  Object.assign(env, { ADMIN_TOKEN: "tok", ADMIN_PASSWORD: "pw", RESEND_API_KEY: "re_test", PUBLIC_URL: "https://x" });
  const sent = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    sent.push(JSON.parse(init.body).to);
    return new Response(JSON.stringify({ id: "em_1" }), { status: 200 });
  });
  const cookie = (await sessionCookie(env, "admin", 0)).split(";")[0];
  const res = await worker.fetch(new Request("https://jdmconnect.example/settings/test-email", {
    method: "POST",
    headers: { Cookie: cookie, Origin: "https://jdmconnect.example" },
    body: new FormData(),
  }), env, { waitUntil() {} });
  assert.equal(res.status, 303);
  assert.match(res.headers.get("Location"), /notice=/, "success toast, not notice_err");
  assert.deepEqual(sent, [["ops@jdm.example"]]);
  // Today this fails: digestRecipient(env, settings) resolves to undefined and the
  // route redirects with the generic error toast. Fix: digestRecipient(settings, env).
});
```

### 9. `deliverToClient` channel matrix: WhatsApp gating and failure isolation (protects Flows 2, 3, 6) — Effort: M

Asserts, with a fetch mock that distinguishes Resend from Twilio/Graph calls: (a) `whatsapp_enabled=0` or a missing number → zero WhatsApp calls, email unaffected; (b) both channels configured → both attempted, `{email:true, whatsapp:true}`; (c) a WhatsApp provider 500 → email still sent, `{email:true, whatsapp:false}`, no throw; (d) a Resend 500 → the call throws **and the WhatsApp attempt never happens** — pinning the current one-directional contract so a future "try WhatsApp anyway" change is a conscious one; (e) an email-less, WhatsApp-only client → `{email:false, whatsapp:true}`. Case (e) plus `sendWelcomeMatch` gives the re-delivery regression: a WhatsApp-only welcome must not leave the row `pending` *and* uncontactable-again (whichever way that gets resolved, the test documents the choice).

```js
// test/deliver-channels.test.mjs (proposal — core case (c)/(d))
test("a WhatsApp failure never blocks email; an email failure suppresses WhatsApp (current contract)", async (t) => {
  const env = makeEnv(`INSERT INTO settings (key, value) VALUES ('whatsapp_enabled', '1');`);
  Object.assign(env, { RESEND_API_KEY: "re_test", TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "t", TWILIO_WHATSAPP_FROM: "+614", PUBLIC_URL: "https://x" });
  const calls = [];
  let failEmail = false;
  t.mock.method(globalThis, "fetch", async (url) => {
    const isResend = String(url).includes("resend.com");
    calls.push(isResend ? "email" : "wa");
    if (isResend && failEmail) return new Response("boom", { status: 500 });
    if (!isResend) return new Response("no", { status: 500 });            // WhatsApp always fails here
    return new Response(JSON.stringify({ id: "em" }), { status: 200 });
  });
  const client = { id: 1, email: "a@x.com", whatsapp: "0400000000" };

  const r = await deliverToClient(env, client, { year: 1999 }, {});       // (c)
  assert.deepEqual(r, { email: true, whatsapp: false });
  assert.deepEqual(calls, ["email", "wa"]);

  calls.length = 0; failEmail = true;                                     // (d)
  await assert.rejects(() => deliverToClient(env, client, { year: 1999 }, {}));
  assert.deepEqual(calls, ["email"], "WhatsApp is never attempted after an email failure");
});
```

### 10. Digest and alert gating (protects Flows 2, 7) — Effort: M

Asserts: with matches queued for an agent-owned client and an admin-owned client in one `runMatcher` pass — the active agent with `alerts=1` gets one digest, the admin address gets the rest; a **paused** agent's entries fold into the admin digest instead of vanishing (`src/index.js:1955-1958`); `email_alerts=0` silences only the admin digest (agent digests still send); one group's Resend failure doesn't stop the other group's send; and `alertNewRequest` sends nothing when `request_alerts=0` while the push chime still fires. Together these pin every "who gets told" rule in the automated pipeline, none of which is currently tested.

---

*Report generated by a read-only audit; no source files, tests, or migrations were modified. The only file created is this report.*
