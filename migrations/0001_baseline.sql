-- 0001_baseline.sql
-- Cumulative baseline schema for the JDM Vehicle Finder D1 database.
--
-- This is the full end-state of the database as it exists in production today,
-- folded together from the historical loose migrate-*.sql files (now archived
-- under migrations/legacy/). Every statement is idempotent (CREATE ... IF NOT
-- EXISTS), so applying this against the live database is a safe no-op: it never
-- drops or rewrites existing data.
--
-- From here on, every schema change ships as a new numbered migration
-- (0002_*.sql, 0003_*.sql, ...) applied with `wrangler d1 migrations apply`.
-- See migrations/README.md for the workflow and the production-safety rule.

-- Agents: separate logins that find cars for their own clients (data-isolated).
CREATE TABLE IF NOT EXISTS agents (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  email        TEXT NOT NULL,
  name         TEXT NOT NULL,
  pass_salt    TEXT NOT NULL,
  pass_hash    TEXT NOT NULL,
  active       INTEGER NOT NULL DEFAULT 1,
  invite_token TEXT,
  invite_exp   INTEGER,
  alerts       INTEGER NOT NULL DEFAULT 1,
  company      TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_email ON agents(email);

-- Clients (the end buyers, or an agent's own clients).
CREATE TABLE IF NOT EXISTS clients (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  email           TEXT,
  whatsapp        TEXT,
  state           TEXT,
  notes           TEXT,
  dealer_username TEXT,
  agent_id        INTEGER,
  portal_enabled  INTEGER NOT NULL DEFAULT 0,
  pass_salt       TEXT,
  pass_hash       TEXT,
  invite_token    TEXT,
  invite_exp      INTEGER,
  created_at      TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_clients_agent ON clients(agent_id);

-- Client sharing: extra agents (besides the owner) who can help search a client.
CREATE TABLE IF NOT EXISTS client_shares (
  client_id  INTEGER NOT NULL,
  agent_id   INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (client_id, agent_id)
);
CREATE INDEX IF NOT EXISTS idx_shares_agent ON client_shares(agent_id);

-- Wishlists: what each client is chasing. One client can have several.
CREATE TABLE IF NOT EXISTS wishlists (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id     INTEGER NOT NULL REFERENCES clients(id),
  label         TEXT,
  marka_name    TEXT,
  model_name    TEXT,
  year_min      INTEGER,
  year_max      INTEGER,
  price_max     INTEGER,
  mileage_max   INTEGER,
  rate_min      REAL,
  kuzov         TEXT,
  grade_kw      TEXT,
  active        INTEGER DEFAULT 1,
  auto_notify   INTEGER NOT NULL DEFAULT 0,
  watch_only    INTEGER NOT NULL DEFAULT 0,
  needs_detail  INTEGER NOT NULL DEFAULT 0,
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

-- Approval queue: every new match lands here for review before a client is contacted.
CREATE TABLE IF NOT EXISTS queue (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  wishlist_id  INTEGER NOT NULL,
  client_id    INTEGER NOT NULL,
  lot_id       TEXT NOT NULL,
  lot_json     TEXT NOT NULL,
  status       TEXT DEFAULT 'pending',
  token        TEXT NOT NULL,
  reason       TEXT,
  client_request    INTEGER NOT NULL DEFAULT 0,
  client_request_at TEXT,
  created_at   TEXT DEFAULT (datetime('now')),
  decided_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_queue_status ON queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_token ON queue(token);

-- Editable settings (key/value) so behaviour can be toggled from the UI.
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Stripe payments. One row per Checkout Session the buyer is sent to.
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
