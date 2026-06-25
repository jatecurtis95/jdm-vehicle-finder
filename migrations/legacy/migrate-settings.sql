-- Editable settings (key/value) so behaviour can be toggled from the UI.
-- Apply with:
--   npx wrangler d1 execute jdm-vehicle-finder --remote --file migrate-settings.sql
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
