-- One-time migration: client portal logins + client-request flag + Stripe payments.
--
-- Run ONCE against the live finder database. Re-running fails on the ADD COLUMN
-- lines (SQLite has no "ADD COLUMN IF NOT EXISTS") — that's expected/harmless;
-- the CREATE TABLE/INDEX lines are idempotent.
--
--   npx wrangler d1 execute jdm-vehicle-finder --remote --file migrate-client-portal.sql

-- Buyer portal login on the clients table (mirrors the agents table).
ALTER TABLE clients ADD COLUMN portal_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE clients ADD COLUMN pass_salt TEXT;
ALTER TABLE clients ADD COLUMN pass_hash TEXT;
ALTER TABLE clients ADD COLUMN invite_token TEXT;
ALTER TABLE clients ADD COLUMN invite_exp INTEGER;

-- The buyer asked us (from the portal) to action/translate a specific matched car.
ALTER TABLE queue ADD COLUMN client_request INTEGER NOT NULL DEFAULT 0;
ALTER TABLE queue ADD COLUMN client_request_at TEXT;

-- Stripe payments (one row per Checkout Session).
CREATE TABLE IF NOT EXISTS payments (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id        INTEGER NOT NULL,
  queue_id         INTEGER,
  stripe_session   TEXT,
  stripe_intent    TEXT,
  amount_cents     INTEGER NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'aud',
  description      TEXT,
  status           TEXT NOT NULL DEFAULT 'created',
  created_at       TEXT DEFAULT (datetime('now')),
  paid_at          TEXT
);
CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_session ON payments(stripe_session);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
