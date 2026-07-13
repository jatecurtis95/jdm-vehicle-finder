-- 0013_dealer_system.sql
-- Dealer system: separate logins for vehicle suppliers (dealers). Dealers submit
-- vehicles which admins review & approve before they become available. Separate
-- from client.category='dealer' which is a buyer tag. These dealers are sellers.
-- Historical production installs used d1 execute; see README.md for the
-- backup-first one-time ledger reconciliation.

CREATE TABLE IF NOT EXISTS dealers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  company         TEXT,
  state           TEXT,
  pass_salt       TEXT NOT NULL,
  pass_hash       TEXT NOT NULL,
  active          INTEGER NOT NULL DEFAULT 1,
  invite_token    TEXT,
  invite_exp      INTEGER,
  session_ver     INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT DEFAULT (datetime('now')),
  last_seen       TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dealers_email ON dealers(email);

-- Dealer vehicle submissions: inventory a dealer wants to sell. Status gates visibility:
-- 'pending' = awaiting admin review, 'approved' = live/available to buyers,
-- 'rejected' = dealer can resubmit, 'archived' = old/withdrawn.
CREATE TABLE IF NOT EXISTS dealer_vehicles (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  dealer_id       INTEGER NOT NULL REFERENCES dealers(id),
  make            TEXT NOT NULL,
  model           TEXT NOT NULL,
  year            INTEGER,
  grade           TEXT,
  mileage_km      INTEGER,
  price_aud       INTEGER,
  location        TEXT,
  description     TEXT,
  photos          TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  admin_notes     TEXT,
  created_at      TEXT DEFAULT (datetime('now')),
  approved_at     TEXT,
  approved_by     INTEGER
);
CREATE INDEX IF NOT EXISTS idx_dealer_vehicles_dealer ON dealer_vehicles(dealer_id);
CREATE INDEX IF NOT EXISTS idx_dealer_vehicles_status ON dealer_vehicles(status);
CREATE INDEX IF NOT EXISTS idx_dealer_vehicles_created ON dealer_vehicles(created_at);
