-- Client share links, phase 1 (AUCRS-style shareable vehicle pages, but better):
-- staff-authored price guidance + condition notes shown ON the public page, a
-- per-row nonce so one link can be revoked/regenerated without rotating the
-- app-wide ADMIN_TOKEN, and lightweight view tracking.
--
-- All columns are additive and nullable/defaulted, so the deploy and this
-- migration can go out independently. `share_nonce` NULL means the row still
-- verifies legacy tokens (signed without a nonce), so links already sent to
-- clients keep working until staff regenerate.
ALTER TABLE queue ADD COLUMN share_price_note TEXT;
ALTER TABLE queue ADD COLUMN share_condition_notes TEXT;
ALTER TABLE queue ADD COLUMN share_nonce TEXT;
ALTER TABLE queue ADD COLUMN share_revoked_at TEXT;
ALTER TABLE queue ADD COLUMN share_view_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE queue ADD COLUMN share_last_viewed_at TEXT;
