-- 0008_client_google_oauth.sql
-- Social login (Google). A client can now be identified by their Google account
-- as well as by email/password:
--  * google_sub: Google's stable, unique user id ("sub" claim). Durable link so a
--    later email change on the Google side still maps to the same client. NULL for
--    everyone who has never used Google sign-in.
-- Matching is by google_sub first, then by verified email, so existing
-- email/password clients fold into the same record when they first use Google.
-- Additive and non-destructive; existing rows default to NULL.
ALTER TABLE clients ADD COLUMN google_sub TEXT;
CREATE INDEX IF NOT EXISTS idx_clients_google_sub ON clients(google_sub);
