-- Agent logins: each agent finds cars for their own clients, in isolation.
-- Apply with:
--   npx wrangler d1 execute jdm-vehicle-finder --remote --file migrate-agents.sql
CREATE TABLE IF NOT EXISTS agents (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT NOT NULL,              -- login id + alert address (stored lowercase)
  name        TEXT NOT NULL,
  pass_salt   TEXT NOT NULL,             -- base64 PBKDF2 salt
  pass_hash   TEXT NOT NULL,             -- base64 PBKDF2-SHA256 hash
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_email ON agents(email);

-- Owner of a client: which agent created them (NULL = JDM Connect staff/admin).
ALTER TABLE clients ADD COLUMN agent_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_clients_agent ON clients(agent_id);
