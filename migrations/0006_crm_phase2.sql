-- 0006_crm_phase2.sql
-- Phase 2: turn the finder into a vehicle-import CRM. A "request" is an existing
-- `wishlists` row (a customer's search for one vehicle), so no data backfill is
-- needed - every current search becomes a request. This migration only adds the
-- pipeline/tracking fields and the two new operational tables. All additive and
-- non-destructive; existing rows take sensible defaults.

-- Request pipeline on each search.
ALTER TABLE wishlists ADD COLUMN status TEXT NOT NULL DEFAULT 'new';
ALTER TABLE wishlists ADD COLUMN owner_id INTEGER;               -- request owner (defaults to the client's agent)
ALTER TABLE wishlists ADD COLUMN last_activity TEXT;             -- ISO timestamp of the most recent activity
ALTER TABLE wishlists ADD COLUMN deposit_status TEXT NOT NULL DEFAULT 'none'; -- none | requested | paid
CREATE INDEX IF NOT EXISTS idx_wishlists_status ON wishlists(status);
CREATE INDEX IF NOT EXISTS idx_wishlists_owner ON wishlists(owner_id);

-- Internal tasks (Priority 3), optionally tied to a request/customer.
CREATE TABLE IF NOT EXISTS tasks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT NOT NULL,
  type         TEXT,
  wishlist_id  INTEGER,
  client_id    INTEGER,
  assigned_to  INTEGER,
  due_date     TEXT,
  priority     TEXT NOT NULL DEFAULT 'normal',   -- low | normal | high
  status       TEXT NOT NULL DEFAULT 'todo',      -- todo | doing | done
  created_at   TEXT DEFAULT (datetime('now')),
  done_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_wishlist ON tasks(wishlist_id);

-- Activity timeline (Priority 8): one row per recorded event on a request.
CREATE TABLE IF NOT EXISTS activity (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  wishlist_id  INTEGER,
  client_id    INTEGER,
  type         TEXT NOT NULL,     -- created | status | owner | match_sent | viewed | note | deposit | task | ...
  detail       TEXT,
  actor        TEXT,              -- who did it (admin / agent name)
  created_at   TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_activity_wishlist ON activity(wishlist_id);
CREATE INDEX IF NOT EXISTS idx_activity_client ON activity(client_id);

-- Match engagement tracking (Priority 5). queue.status already exists; add the
-- sent/viewed/response detail so a sent vehicle is trackable after "Approve & Send".
ALTER TABLE queue ADD COLUMN sent_at TEXT;
ALTER TABLE queue ADD COLUMN viewed_at TEXT;
ALTER TABLE queue ADD COLUMN response TEXT;   -- interested | not_interested | (null)
