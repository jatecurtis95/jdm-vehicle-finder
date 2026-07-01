-- 0005_client_archive.sql
-- Adds a soft "archived" flag to clients so a customer can be hidden from the
-- default list (via the row menu / bulk bar) without a destructive delete.
-- Additive and non-destructive: every existing row defaults to 0 (active).
ALTER TABLE clients ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_clients_archived ON clients(archived);
