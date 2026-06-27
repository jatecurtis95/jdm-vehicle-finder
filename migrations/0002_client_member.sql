-- 0002_client_member.sql
-- Paid-member flag on a client. Gates member-only features (the auction search
-- page). Defaults 0 (not a member); flipped per client from the admin client
-- page. Will be set automatically by Stripe once membership billing is live.
ALTER TABLE clients ADD COLUMN member INTEGER NOT NULL DEFAULT 0;
