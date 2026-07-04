-- 0011_client_category.sql
-- Client category: who this client is commercially. 'private' (default, the
-- retail buyer everyone starts as) or 'dealer' (a trade buyer we sell to/for).
-- Shown as a chip on the client page and customers list, filterable there, and
-- editable from the client's Edit details form.
-- Apply to prod with `wrangler d1 execute jdm-vehicle-finder --remote --file`
-- (NEVER `migrations apply` - the tracking table is out of sync; see README).
ALTER TABLE clients ADD COLUMN category TEXT NOT NULL DEFAULT 'private';
