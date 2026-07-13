-- 0011_client_category.sql
-- Client category: who this client is commercially. 'private' (default, the
-- retail buyer everyone starts as) or 'dealer' (a trade buyer we sell to/for).
-- Shown as a chip on the client page and customers list, filterable there, and
-- editable from the client's Edit details form.
-- Historical production installs used d1 execute. The one-time ledger
-- reconciliation in README.md records that already-live application safely.
ALTER TABLE clients ADD COLUMN category TEXT NOT NULL DEFAULT 'private';
