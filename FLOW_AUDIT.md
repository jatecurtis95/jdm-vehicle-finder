# JDMFinder Flow / Integration Audit

Audit date: 2026-07-21  
Scope: current working tree at baseline commit `ec9030c8` plus uncommitted changes

## Test baseline

`npm test` currently runs 490 tests: 461 pass and 29 fail. Flow conclusions below distinguish implementation evidence from current test health. Key existing suites include:

- Stripe: `test/stripe.test.mjs`, `test/subscription.test.mjs`
- Matcher/delivery: `test/matcher-race.test.mjs`, `test/send-flow.test.mjs`, `test/welcome-match.test.mjs`
- Bulk/matches: `test/matches-triage.test.mjs`, `test/launch-backend-regressions.test.mjs`
- Request: `test/signup.test.mjs`, `test/dedup.test.mjs`, `test/validation-limits.test.mjs`, `test/ratelimit.test.mjs`
- Auth: `test/auth-flows.test.mjs`, `test/token-hashing.test.mjs`, `test/session-revocation.test.mjs`

The rate-limit suite currently contributes seven failures. Two missing-migration set-password tests and multiple dealer/public tests also fail.

## Flow 1 — Stripe checkout → webhook → provisioning

**Verdict: Works but has a gap**

### Call chain

Deposit:

1. Authenticated buyer POST route dispatches to `startDepositCheckout` (`src/index.js:1583`, `1684-1715`).
2. Settings supply `stripe_deposit_aud` and currency (`src/index.js:1686-1703`).
3. Queue ownership is checked by `queue.id + client_id` (`src/index.js:1693-1697`).
4. `createCheckoutSession` inserts a `payments` row, posts exact `unit_amount` to Stripe, then stores `stripe_session` (`src/stripe.js:50-76`).
5. Stripe POSTs `/webhooks/stripe` (`src/index.js:713-745`).
6. `verifyAndParseEvent` validates HMAC and a five-minute timestamp window (`src/stripe.js:141-154`).
7. `applyStripeEvent` claims `event.id` in `stripe_events` (`src/stripe.js:164-182`).
8. `applyStripeEventInner` changes the payment to `paid` with a status guard and advances the related request best-effort (`src/stripe.js:222-272`).

Membership follows the same webhook entry, using `createSubscriptionCheckout` (`src/index.js:1640-1661`; `src/stripe.js:83-105`) and the subscription branches at `src/stripe.js:194-219`.

### Handoff assessment

- **Amount:** correct at creation. The numeric settings value is converted once to integer cents and used both in the local payment row and Stripe `unit_amount`. Changing settings after checkout creation does not change that session or payment row.
- **Identity:** deposit metadata includes `payment_id`, `client_id`, and optional `queue_id`; the webhook primarily resolves by `payment_id`. Membership uses `client_reference_id` plus metadata.
- **Browser redirect:** does not mark payment paid; the success path reads webhook-confirmed state.
- **Duplicate webhook:** the event ledger suppresses the same `event.id`, and row updates are also idempotent. Duplicate delivery does not double-provision in covered cases.
- **Mid-flow throw:** on a propagated error, the ledger row is deleted so Stripe can retry. Existing tests simulate this. The statements are not one transaction, but current business updates are status assignments rather than additive credits.
- **Push side effect:** payment chime occurs after `applyStripeEvent`; duplicate statuses do not chime. If push fails and propagates, the route returns 500 after the event is already committed; Stripe retries and receives `duplicate`, avoiding a double-ping but losing the original ping. This is acceptable for a best-effort chime but should be documented.

### Real gaps

1. Only `amountCents > 0` is validated. There is no upper bound or strict currency allow-list.
2. An extreme editable setting can create an extreme Checkout session.
3. The ledger/business updates are not an explicit transaction/outbox. Safe today, but future non-idempotent side effects would be hazardous.
4. Subscription completion returns `subscribed` even if `clientId` is missing or the update changes zero rows.

### Coverage

Covered: signature verification, completed deposit, replay idempotency, expiry, subscription lifecycle, unrelated-client isolation, duplicate event ledger, failed-event retry, Checkout parameter shapes.  
Not fully covered: route-level editable-setting bounds, unsupported currency, zero-row provisioning, crash boundary after business update/before response, push failure behavior.

## Flow 2 — Cron matcher → queue → client delivery

**Verdict: Works but has a gap; auto-delivery failures can also strand rows**

### Call chain

1. Wrangler cron (`0 */6 * * *`) invokes the Worker's scheduled handler.
2. `runAll` selects a bounded rotating slice of active wishlists with joined client/agent fields (`src/matcher.js:294-405`).
3. `runWishlist` builds provider SQL, queries lots, scores/refines, loads seen IDs, enriches landed costs, budget-filters, and transactionally batches queue + seen claims (`src/matcher.js:158-241`).
4. Manual-review matches are returned in `summary`; `auto_notify` matches call `autoDeliver` (`src/matcher.js:368-375`, `485-503`).
5. `deliverToClient` loads settings, honors `send_to_client`, sends email, then best-effort WhatsApp (`src/notify.js:194-230`).

### Handoff assessment

- Wishlist/client IDs are selected together and used consistently when queue rows are inserted.
- Queue/seen race protection uses a D1 batch and `NOT EXISTS`/`INSERT OR IGNORE`; `test/matcher-race.test.mjs` covers concurrency behavior.
- One wishlist failure is caught and does not abort other wishlists. A cursor is checkpointed even for failures, preventing starvation.
- `send_to_client` is honored inside both single and multi delivery functions.
- WhatsApp failure does not abort successful email.
- Landed cost failure behavior differs: `runWishlist` calls `attachLanded` without a local catch, so a calculator failure can fail that wishlist; welcome delivery catches estimation failure; bulk email may throw during sequential estimate calculation.

### Real gaps

1. `autoDeliver` marks a row `sent` whenever `deliverToClient` resolves—even when `send_to_client` is off or the client has no usable channel. That makes “sent” mean “handled,” not necessarily delivered.
2. If auto-delivery throws, the row becomes `failed`; the admin review view selects only `pending`, so it is stranded just like manual failures.
3. `deliverManyToClient` computes landed estimates sequentially, increasing bulk latency.
4. There is no durable attempt/error metadata or retry queue for provider/mail failures.

### Coverage

Covered: SQL/scoring/refinement, budget behavior, race deduplication, send-once paths, settings behavior in several unit tests, welcome fallback.  
Not fully covered: cron entry through digest/delivery as one integration test, one-client failure while later clients continue, paused delivery state semantics, failed-row visibility/retry, landed calculator timeout in bulk/cron.

## Flow 3 — Bulk approve/reject

**Verdict: Has a real bug**

### Call chain

1. Matches UI posts `/matches/bulk` with action and IDs (`src/index.js:1122`; client code around `src/admin.js:4128-4172`).
2. `applyBulkDecisions` handles reject per ID or prepares approvals per ID (`src/index.js:2027-2087`).
3. Approval loads queue row, checks `pending`, verifies agent access, loads wishlist, parses lot JSON, and groups rows by `client_id` (`2042-2064`).
4. Watch-only rows are marked sent without delivery (`2066-2073`).
5. Each client's group is sent once via `deliverManyToClient`; D1 batch updates every group row to `sent` or `failed` (`2075-2085`).

### Handoff assessment

- The queue `client_id` is used to load the client; the queue `wishlist_id` loads the search. Shapes passed to `deliverManyToClient` match `{lot, wishlist}`.
- Agent access is checked per item.
- Reapplying to a `sent`, `failed`, or `rejected` row is skipped because preparation requires `pending`. Reject is assignment-idempotent.
- A failure on ID 30 during preparation is caught and IDs 31+ continue. A delivery failure for one client does not prevent later client groups.
- Partial commits are intentional but not observable to the caller.

### Real bugs

1. **False success:** the function returns no outcome. The browser reports selected count as sent after an HTTP success even when groups failed.
2. **Stranded failed rows:** failures are marked `failed`, removed from the pending view, and not retryable because decision handling accepts only `pending`.
3. **Ambiguous paused/no-channel result:** `deliverManyToClient` can resolve with `{email:false, whatsapp:false}`; the group is still marked `sent`.
4. **Prep failure invisibility:** malformed JSON, a missing client, access rejection, or a query error is logged but absent from the response.
5. **Reject outcome invisibility:** individual errors are swallowed and the route cannot report partial failure.

### Coverage

Existing matches/send tests cover rendering, individual decisions, and several send behaviors. There is no comprehensive failure-injection test proving the result for a mixed 50-ID batch, no retry test for `failed`, and no assertion that the UI toast matches persisted outcomes.

## Flow 4 — Public request wizard → persistence → notifications

**Verdict: Works but currently has a failing rate-limit subsystem**

### Call chain

1. `/request` parses a size-limited form (`src/index.js:388-411`).
2. `requestRateLimited` consumes IP, normalized email, and normalized phone buckets (`src/index.js:77-124`, call at `412-416`).
3. `createRequest` performs honeypot/validation/deduplication and persists client/wishlist data (`src/admin.js`; exported request creation path).
4. Every non-spam validation error re-renders with input preserved (`src/index.js:477-485`). Honeypot spam receives generic success (`487-488`).
5. Successful persistence may send an invite/reset link, alerts staff, confirms the buyer, and optionally runs a welcome match (`425-475`). Notification failures are generally isolated from persistence.

### Handoff assessment

- Bad field input is returned as a validation result rather than thrown; tests cover numerous limits and required fields.
- Honeypot behavior deliberately fakes success without persistence.
- Rate limiting happens before persistence and consumes all applicable dimensions even if one is already limited.
- Contact normalization uses lowercase email and normalized phone.
- Notifications happen after persistence; their failure does not roll back the request, which is appropriate for lead capture but requires operational retry/visibility.

### Current gap

Seven rate-limit tests fail in the current tree: under-limit increment, IP cap, contact across IPs, phone normalization, short-phone handling, concurrent increments, and expiry reset. Because the implementation was recently changed to D1-backed atomic buckets, this is a release blocker until implementation/test fixtures agree. The code comment at `src/index.js:399` still says “fails open if KV is unavailable,” while the current function uses D1 and fails closed when DB is unavailable (`src/index.js:77-80`), demonstrating documentation drift.

### Coverage

Covered: successful signup, validation, honeypot/non-persistence, deduplication, request size, many field limits, invite/sign-in behavior.  
Currently failing: rate-limit behavior and concurrency.  
Not fully covered: notification retry/visibility after persistence, a single route-level test proving no writes across every rejection dimension, DB outage UX.

## Flow 5 — Set password → login → session revocation

**Verdict: Solid in design; current missing-migration regressions must be resolved**

### Call chain

1. `/set-password` resolves an agent, dealer, or client token using isolated lookups (`src/index.js:652-676`).
2. POST validates body size and confirmation, dispatches to the role-specific setter, and issues a session cookie on success (`677-705`).
3. Token helpers in `src/auth.js` hash tokens, check expiry/unused state, write the password hash, and consume the invite/reset token.
4. `/login` applies lockout checks, calls `authenticate`, touches last-seen, and creates a session cookie (`src/index.js:556-575`).
5. Session cookies carry role/id/session version; session lookup compares the stored `session_ver`. Revocation bumps the stored version so old cookies fail.

### Handoff assessment

- Raw invite/reset tokens are bearer inputs but are stored/queried as hashes.
- Expired and used tokens are rejected.
- Successful set-password immediately signs in with the correct role home.
- Lookup failures in one role are isolated so a broken dealer table does not block client/agent onboarding.
- Session revocation uses version mismatch rather than attempting a server-side cookie blacklist.

### Current gaps

1. Two current tests fail for client and agent set-password when migration 0010/session-version columns are missing. The working-tree compatibility changes are not yet satisfying the intended drift-tolerance contract.
2. Token consumption and password update should remain atomic. Confirm role-specific setters use a batch/transactional update in the final implementation; a crash between password write and token consumption could otherwise permit reuse.
3. Operational admin TOTP configuration cannot be verified from code.

### Coverage

Covered: role invites, token expiry/unknown token, password reset, field limits, hashing, session revocation, role isolation, single-use behavior.  
Currently failing: two schema-drift tolerance cases.  
Not fully covered: concurrent double-submit of the same token against real D1 serialization, admin TOTP configuration in deployed environment.

## Per-flow verdict summary

| Flow | Verdict | Key reason |
|---|---|---|
| Stripe checkout/webhook/provisioning | Works but has a gap | Strong idempotency; missing business amount bounds/zero-row checks |
| Matcher/cron/delivery | Works but has a gap | Good isolation/dedup; delivery-state semantics and recovery are incomplete |
| Bulk approve/reject | Has a real bug | False success plus permanently hidden failed rows |
| Public request | Works but has a gap | Validation is strong; current rate-limit suite has seven failures |
| Password/login/revocation | Solid, with current regression | Sound token/session design; two migration-drift tests fail |

## Ranked integration tests to add

### 1. Mixed bulk approval returns truthful structured outcomes — M

Protects: bulk decisions/delivery.

```js
test("bulk approve reports sent and failed groups and keeps failures retryable", async () => {
  // Seed two clients with pending rows. Make the first mail send succeed and
  // the second throw. POST /matches/bulk as AJAX.
  // Assert response: { sent: [...], failed: [...] }.
  // Assert successful rows are sent; failed rows remain visible in the failed
  // recovery view and can transition back through one retry.
});
```

### 2. Paused/no-channel approval never claims “sent” — S/M

Protects: matcher and bulk decisions.

```js
test("approval while client delivery is paused records handled-not-delivered", async () => {
  // Disable send_to_client; approve a pending row.
  // Assert no provider call, an explicit handled/paused state (or retained
  // pending state per product decision), and UI copy that does not say Sent.
});
```

### 3. Failed single delivery can be retried exactly once — M

Protects: individual decision flow.

```js
test("failed approval remains visible and a successful retry sends once", async () => {
  // First provider call throws, second succeeds.
  // Assert failure state is visible, retry is authorized, status becomes sent,
  // and a third/replayed retry does not send again.
});
```

### 4. Test-email route uses saved recipient then env fallback — S

Protects: settings integration.

```js
test("test email resolves digest recipient with settings first", async () => {
  // Save digest_email, POST /settings/test-email, assert provider recipient.
  // Clear saved value and assert DIGEST_EMAIL fallback.
});
```

### 5. Stripe settings bounds and snapshot — S/M

Protects: checkout/payment.

```js
test("checkout rejects out-of-range settings and preserves the created amount", async () => {
  // Assert negative/zero/extreme values and unsupported currencies do not call Stripe.
  // Create a valid checkout, then change settings; assert payment row and Stripe
  // unit_amount remain the original cents and webhook marks only that row paid.
});
```

### 6. Stripe zero-row subscription event is not reported provisioned — S

Protects: membership provisioning.

```js
test("subscription completion for an unknown client is not reported subscribed", async () => {
  // Apply a signed-shaped event for a missing client; assert explicit ignored/error
  // outcome and no membership row changes.
});
```

### 7. One matcher client's failure does not block later clients — M

Protects: cron/delivery.

```js
test("matcher continues after one client delivery fails", async () => {
  // Seed multiple auto-notify wishlists; fail delivery for the first only.
  // Assert later client is delivered and first failure is visible/retryable.
});
```

### 8. Public request atomic rate-limit matrix — M

Protects: signup abuse controls.

```js
test("request limiter atomically consumes IP, email and normalized phone buckets", async () => {
  // Run concurrent requests at the boundary across rotating IPs and reformatted
  // phones. Assert exact allowed count, no lost increments, short-phone omission,
  // expiry reset, and zero client/wishlist rows for blocked requests.
});
```

### 9. Concurrent set-password token consumption — M

Protects: onboarding/auth.

```js
test("two simultaneous submissions of one invite token produce one success", async () => {
  // Submit the same valid token concurrently with different passwords.
  // Assert exactly one succeeds, token is consumed, and only the winning password authenticates.
});
```

### 10. Revocation across every role — S

Protects: session security.

```js
test("session version bump invalidates existing admin, agent, client and dealer cookies", async () => {
  // Issue cookies, bump each stored session version/revoke access, and assert
  // protected requests reject every old cookie while a new login succeeds.
});
```

## Recommended execution order

1. Repair the current rate-limit and missing-migration auth failures.
2. Implement structured bulk outcomes and failed-delivery recovery with tests 1–3.
3. Add the test-email regression test and fix.
4. Add Stripe bounds/zero-row tests before changing payment code.
5. Add cron continuation and concurrency tests before structural refactoring.

## Overall verdict

The critical security-oriented flows are generally better built than the UI state machine: Stripe signature verification/idempotency and hashed expiring auth tokens have meaningful tests and sensible safeguards. The most urgent integration defect is delivery recovery and truthfulness. The current red rate-limit and schema-drift tests are also release blockers. Fix those flow contracts before undertaking the large structural cleanup described in `CODE_AUDIT.md`.
