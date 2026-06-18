-- JDM Vehicle Finder: D1 schema
-- Load with: npx wrangler d1 execute jdm-vehicle-finder --remote --file schema.sql

-- Clients (the end buyers, or a dealer's own clients)
CREATE TABLE IF NOT EXISTS clients (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  email           TEXT,
  whatsapp        TEXT,                   -- E.164 format, e.g. +61400000000 (Phase 2)
  notes           TEXT,
  dealer_username TEXT,                   -- portal dealer who created this (NULL = staff-entered)
  created_at      TEXT DEFAULT (datetime('now'))
);

-- Wishlists: what each client is chasing. One client can have several.
CREATE TABLE IF NOT EXISTS wishlists (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id     INTEGER NOT NULL REFERENCES clients(id),
  label         TEXT,                      -- free label, e.g. "Daily driver under 1.5M"
  marka_name    TEXT,                      -- maker, e.g. TOYOTA (matched case-insensitively)
  model_name    TEXT,                      -- model contains, e.g. COROLLA (optional)
  year_min      INTEGER,
  year_max      INTEGER,
  price_max     INTEGER,                   -- JPY; matched against the lot's market estimate (avg_price)
  mileage_max   INTEGER,                   -- km
  rate_min      REAL,                      -- minimum auction grade, e.g. 3.5, 4, 4.5
  kuzov         TEXT,                      -- chassis code contains, e.g. ZRE212
  grade_kw      TEXT,                      -- grade text contains, e.g. RS, Type R
  active        INTEGER DEFAULT 1,
  auto_notify   INTEGER NOT NULL DEFAULT 0, -- 1 = skip review, deliver matches immediately
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wishlists_active ON wishlists(active);
CREATE INDEX IF NOT EXISTS idx_wishlists_client ON wishlists(client_id);

-- Lots already surfaced for a wishlist, so a client is never sent the same car twice.
CREATE TABLE IF NOT EXISTS seen_lots (
  wishlist_id  INTEGER NOT NULL,
  lot_id       TEXT NOT NULL,
  seen_at      TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (wishlist_id, lot_id)
);

-- Approval queue: every new match lands here for you to approve before a client is contacted.
CREATE TABLE IF NOT EXISTS queue (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  wishlist_id  INTEGER NOT NULL,
  client_id    INTEGER NOT NULL,
  lot_id       TEXT NOT NULL,
  lot_json     TEXT NOT NULL,              -- snapshot of the lot at match time
  status       TEXT DEFAULT 'pending',     -- pending | approved | rejected | sent | failed
  token        TEXT NOT NULL,              -- random token used in approve/reject links
  created_at   TEXT DEFAULT (datetime('now')),
  decided_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_queue_status ON queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_token ON queue(token);
