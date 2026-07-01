-- 0004_stripe_events.sql
-- Idempotency ledger for incoming Stripe webhook events. Stripe delivers each
-- event at-least-once and retries on any non-2xx, so the same event can arrive
-- more than once. We record every event id the first time it is applied and
-- skip any repeat, so a side effect (for example a future import-fee credit)
-- can never run twice. Insert-or-ignore on the primary key is the dedup; the
-- row is rolled back if applying the event throws, so a retry can re-run it.
-- Additive and idempotent: safe to deploy independently of the Worker.
CREATE TABLE IF NOT EXISTS stripe_events (
  id         TEXT PRIMARY KEY,
  type       TEXT,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
