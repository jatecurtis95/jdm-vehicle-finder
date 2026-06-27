-- 0003_client_subscription.sql
-- Stripe subscription state for the "Full access" membership (A$/month).
-- The member flag (0002) is now driven automatically by these columns: an
-- active subscription sets member = 1; a cancellation or failed payment clears
-- it. Staff can still comp a membership manually (member stays 1 with no
-- subscription attached).
ALTER TABLE clients ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE clients ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE clients ADD COLUMN sub_status TEXT;
