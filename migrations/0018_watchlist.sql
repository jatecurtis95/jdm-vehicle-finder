-- Server-side watchlist for signed-in buyers (launch audit: hearts lived only
-- in localStorage, so a member's saved cars vanished on any other device).
-- One row per client+lot; `snapshot` is the same JSON shape the client script
-- stores locally, so the two stay mergeable.
--
-- Apply to prod with `wrangler d1 execute jdm-vehicle-finder --remote --file`
-- until the d1_migrations tracking is adopted (see README "Adopting the
-- runner"); everything here is idempotent either way.
CREATE TABLE IF NOT EXISTS watchlist_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id   INTEGER NOT NULL REFERENCES clients(id),
  lot_id      TEXT NOT NULL,
  snapshot    TEXT NOT NULL,
  created_at  TEXT DEFAULT (datetime('now')),
  UNIQUE (client_id, lot_id)
);
CREATE INDEX IF NOT EXISTS idx_watchlist_client ON watchlist_items(client_id);
