-- 0020_users_model.sql
-- Phase 3: unified identity model, designed for the pre-launch database
-- (9 clients, 4 agents, 0 portal/dealer/supplier accounts, 12 wishlists).
-- See audit/PHASE3_PLAN_V2.md. Direct cutover: clients -> users (+ type/tier),
-- the agents table folds into users, wishlists -> searches, dealers -> suppliers.
-- dealer_vehicles is NOT renamed (Phase 6 replaces it with submitted_units).

-- 1. clients -> users. RENAME rewrites child REFERENCES clauses automatically,
--    so wishlists.client_id and watchlist_items.client_id keep pointing here.
ALTER TABLE clients RENAME TO users;

-- 2. New identity axes. CHECK constraints are allowed on ADD COLUMN in SQLite.
ALTER TABLE users ADD COLUMN type    TEXT NOT NULL DEFAULT 'customer'
  CHECK (type IN ('customer','dealer','agent'));
ALTER TABLE users ADD COLUMN tier    TEXT NOT NULL DEFAULT 'free'
  CHECK (tier IN ('free','paid_access','fully_managed'));
ALTER TABLE users ADD COLUMN username TEXT;                       -- dealer login key
ALTER TABLE users ADD COLUMN alerts   INTEGER NOT NULL DEFAULT 1; -- carried from agents
ALTER TABLE users ADD COLUMN company  TEXT;                       -- carried from agents
ALTER TABLE users ADD COLUMN active   INTEGER NOT NULL DEFAULT 1; -- carried from agents/suppliers

-- 3. Tier backfill for customer rows. Rule: member=1 -> paid_access;
--    source='public' -> free; else fully_managed. Portal container rows
--    (dealer_username set) are not people, so leave them at the default.
UPDATE users SET tier = CASE
    WHEN member = 1        THEN 'paid_access'
    WHEN source = 'public' THEN 'free'
    ELSE 'fully_managed' END
  WHERE dealer_username IS NULL;

-- 4. Fold the agents table into users with NEW ids (1000 + old id) so they can
--    never collide with preserved customer ids. Credentials carry verbatim
--    (identical PBKDF2 format, so no transform). type='agent'.
INSERT INTO users (id, name, email, pass_salt, pass_hash, invite_token, invite_exp,
                   active, alerts, company, type, tier, portal_enabled, created_at)
  SELECT 1000 + id, name, email, pass_salt, pass_hash, invite_token, invite_exp,
         active, alerts, company, 'agent', 'free', 0, created_at
    FROM agents;

-- 5. Re-point every agent-id reference at the new user ids. Only real agent ids
--    are remapped (admin is id 0 with no row; NULL/stale values left untouched).
UPDATE users         SET agent_id    = 1000 + agent_id    WHERE agent_id    IN (SELECT id FROM agents);
UPDATE client_shares SET agent_id    = 1000 + agent_id    WHERE agent_id    IN (SELECT id FROM agents);
UPDATE wishlists     SET owner_id    = 1000 + owner_id    WHERE owner_id    IN (SELECT id FROM agents);
UPDATE tasks         SET assigned_to = 1000 + assigned_to WHERE assigned_to IN (SELECT id FROM agents);

-- 6. Drop the folded table. The superseded columns (member, category,
--    dealer_username) are DEFERRED to a later cleanup migration rather than
--    dropped here: this Phase-3 cutover's before-live goal is the unified Users
--    model and terminology (Ben's launch plan), and dropping them now forces a
--    large, risky remap across admin.js for no launch benefit (production has 0
--    paid members and 0 dealer/portal rows). `tier` is backfilled from them in
--    step 3 and is the forward source of truth; the legacy columns stay readable
--    so existing code keeps working. A follow-up migration removes them once no
--    code reads them.
DROP TABLE agents;

-- 7. wishlists -> searches (columns, including FK column names, unchanged).
ALTER TABLE wishlists RENAME TO searches;

-- 8. dealers -> suppliers (0 rows; kills the third "dealer" meaning).
ALTER TABLE dealers RENAME TO suppliers;

-- 9. Uniqueness now enforceable (case-insensitive), plus a type lookup index.
CREATE UNIQUE INDEX idx_users_email    ON users(email COLLATE NOCASE)
  WHERE email IS NOT NULL AND email <> '';
CREATE UNIQUE INDEX idx_users_username ON users(username COLLATE NOCASE)
  WHERE username IS NOT NULL;
CREATE UNIQUE INDEX idx_users_google   ON users(google_sub)
  WHERE google_sub IS NOT NULL;
CREATE INDEX idx_users_type ON users(type);
