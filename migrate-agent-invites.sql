-- Agent invites (agent sets their own password) + per-agent match alerts.
-- Apply with:
--   npx wrangler d1 execute jdm-vehicle-finder --remote --file migrate-agent-invites.sql
ALTER TABLE agents ADD COLUMN invite_token TEXT;       -- single-use set-password token
ALTER TABLE agents ADD COLUMN invite_exp   INTEGER;    -- token expiry (epoch ms)
ALTER TABLE agents ADD COLUMN alerts       INTEGER NOT NULL DEFAULT 1; -- email this agent their matches
