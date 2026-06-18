-- One-time migration: let the JDM Connect dealer portal create vehicle requests.
-- Adds dealer ownership to clients and a per-wishlist auto-notify flag.
-- Run ONCE against the live finder database (re-running fails on the ADD COLUMN
-- lines — SQLite has no "ADD COLUMN IF NOT EXISTS" — which is expected/harmless):
--
--   npx wrangler d1 execute jdm-vehicle-finder --remote --file migrate-portal.sql

-- Which portal dealer created a request (NULL for staff-entered clients).
ALTER TABLE clients ADD COLUMN dealer_username TEXT;

-- 1 = matcher delivers matches immediately and skips the approval queue.
ALTER TABLE wishlists ADD COLUMN auto_notify INTEGER NOT NULL DEFAULT 0;

-- Helps the portal list a dealer's own requests quickly.
CREATE INDEX IF NOT EXISTS idx_clients_dealer ON clients(dealer_username);
