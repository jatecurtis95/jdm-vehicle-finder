-- Adds the client's Australian state, used to estimate landed cost per client
-- (maps to shipping port + stamp duty + rego in the calculator).
-- Apply with:
--   npx wrangler d1 execute jdm-vehicle-finder --remote --file migrate-state.sql
ALTER TABLE clients ADD COLUMN state TEXT;
