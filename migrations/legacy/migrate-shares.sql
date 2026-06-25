-- Client sharing: a client can be shared with extra agents (additive to the
-- owner) so they can help search. Apply with:
--   npx wrangler d1 execute jdm-vehicle-finder --remote --file migrate-shares.sql
CREATE TABLE IF NOT EXISTS client_shares (
  client_id  INTEGER NOT NULL,
  agent_id   INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (client_id, agent_id)
);
CREATE INDEX IF NOT EXISTS idx_shares_agent ON client_shares(agent_id);
