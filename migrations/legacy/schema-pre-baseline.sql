-- JDM Vehicle Finder: D1 schema
-- Load with: npx wrangler d1 execute jdm-vehicle-finder --remote --file schema.sql

-- Agents: separate logins that find cars for their own clients (data-isolated).
CREATE TABLE IF NOT EXISTS agents (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  email        TEXT NOT NULL,             -- login id + alert address (stored lowercase)
  name         TEXT NOT NULL,
  pass_salt    TEXT NOT NULL,             -- base64 PBKDF2 salt ("" until they set a password)
  pass_hash    TEXT NOT NULL,             -- base64 PBKDF2-SHA256 hash ("" until set)
  active       INTEGER NOT NULL DEFAULT 1,
  invite_token TEXT,                      -- single-use set-password token
  invite_exp   INTEGER,                   -- token expiry (epoch ms)
  alerts       INTEGER NOT NULL DEFAULT 1, -- email this agent their matches
  created_at   TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_email ON agents(email);

-- Clients (the end buyers, or an agent's own clients)
CREATE TABLE IF NOT EXISTS clients (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  email           TEXT,
  whatsapp        TEXT,                   -- E.164 format, e.g. +61400000000 (Phase 2)
  state           TEXT,                   -- AU state (NSW/VIC/QLD/WA/SA/TAS/ACT/NT) for landed-cost estimate
  notes           TEXT,
  dealer_username TEXT,                   -- portal dealer who created this (NULL = staff-entered)
  agent_id        INTEGER,                -- owning agent (NULL = JDM Connect staff/admin)
  -- Client portal login (buyers who can sign in to view their cars + edit their
  -- search). Mirrors the agents table; the client's email is the login id.
  portal_enabled  INTEGER NOT NULL DEFAULT 0, -- 1 = may sign in to the buyer portal
  pass_salt       TEXT,                   -- base64 PBKDF2 salt (NULL/"" until a password is set)
  pass_hash       TEXT,                   -- base64 PBKDF2-SHA256 hash (NULL/"" until set)
  invite_token    TEXT,                   -- single-use set-password token
  invite_exp      INTEGER,                -- token expiry (epoch ms)
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
  watch_only    INTEGER NOT NULL DEFAULT 0, -- 1 = lead/watch: matches surface for staff follow-up, client never auto-emailed
  needs_detail  INTEGER NOT NULL DEFAULT 0, -- 1 = public request had no make/model/chassis; staff must add detail before it can match
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
  client_request    INTEGER NOT NULL DEFAULT 0, -- 1 = the client asked us to action/translate this (from the portal)
  client_request_at TEXT,                  -- when the client requested it
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

-- Stripe payments. One row per Checkout Session the buyer is sent to. Status is
-- advanced by the Stripe webhook (created -> paid/expired). queue_id links the
-- payment to the specific car the deposit is for (NULL = general payment).
CREATE TABLE IF NOT EXISTS payments (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id        INTEGER NOT NULL,
  queue_id         INTEGER,                 -- the matched car this relates to (optional)
  stripe_session   TEXT,                    -- Stripe Checkout Session id (cs_...)
  stripe_intent    TEXT,                    -- Stripe PaymentIntent id (pi_...), set on completion
  amount_cents     INTEGER NOT NULL,        -- amount in the smallest currency unit
  currency         TEXT NOT NULL DEFAULT 'aud',
  description      TEXT,
  status           TEXT NOT NULL DEFAULT 'created', -- created | paid | expired | failed
  created_at       TEXT DEFAULT (datetime('now')),
  paid_at          TEXT
);
CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_session ON payments(stripe_session);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
