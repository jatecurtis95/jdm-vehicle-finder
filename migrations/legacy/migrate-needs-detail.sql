-- One-time migration: flag public requests that arrived with no make/model/chassis.
-- The matcher skips a wishlist with no narrowing term, so these "needs detail"
-- wishlists never bury the queue — but they're now SAVED (Fix 2) and surfaced in
-- admin so staff can follow up instead of the lead silently vanishing.
--
-- Run ONCE against the live finder database (re-running fails on the ADD COLUMN
-- line — SQLite has no "ADD COLUMN IF NOT EXISTS" — which is expected/harmless):
--
--   npx wrangler d1 execute jdm-vehicle-finder --remote --file migrate-needs-detail.sql

ALTER TABLE wishlists ADD COLUMN needs_detail INTEGER NOT NULL DEFAULT 0;
