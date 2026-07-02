-- 0010_last_seen_session_ver.sql
-- Two additive columns on both login-bearing tables (agents + clients):
--
--  * last_seen   TEXT  - ISO timestamp of the account's most recent successful
--                        login. Powers the "Last login" line in the CRM. NULL
--                        until the account next signs in (fills forward only).
--
--  * session_ver INTEGER NOT NULL DEFAULT 0 - per-user session version. Embedded
--                        in the signed session cookie; bumped on deactivate /
--                        portal-revoke / password reset so those specific
--                        sessions stop validating without rotating ADMIN_TOKEN
--                        (which would sign EVERYONE out). Security audit Medium #8.
--
-- Additive and non-destructive; existing rows default to NULL / 0.
ALTER TABLE agents  ADD COLUMN last_seen   TEXT;
ALTER TABLE agents  ADD COLUMN session_ver INTEGER NOT NULL DEFAULT 0;
ALTER TABLE clients ADD COLUMN last_seen   TEXT;
ALTER TABLE clients ADD COLUMN session_ver INTEGER NOT NULL DEFAULT 0;
