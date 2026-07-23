// One-off Phase 3 agents-fold: agents table is gone; agent rows now live in
// users with type='agent'. Each SQL site becomes a users query filtered on
// type='agent' (ids were already remapped to 1000+ by migration 0020, and the
// agent-id reference columns with them, so no id logic changes here). Precise
// string replacements only; run once, then delete.
import { readFileSync, writeFileSync } from "node:fs";

const edits = {
  "src/admin.js": [
    ["FROM agents WHERE active = 1 ORDER BY name", "FROM users WHERE active = 1 AND type = 'agent' ORDER BY name"],
    ["JOIN agents a ON a.id = cs.agent_id", "JOIN users a ON a.id = cs.agent_id AND a.type = 'agent'"],
    ["FROM agents a ORDER BY a.name", "FROM users a WHERE a.type = 'agent' ORDER BY a.name"],
    ["LEFT JOIN agents ow ON ow.id = w.owner_id", "LEFT JOIN users ow ON ow.id = w.owner_id AND ow.type = 'agent'"],
    ["FROM agents a ORDER BY a.created_at DESC LIMIT 6", "FROM users a WHERE a.type = 'agent' ORDER BY a.created_at DESC LIMIT 6"],
    ["INSERT INTO agents (email, name, company, pass_salt, pass_hash, invite_token, invite_exp) VALUES (?, ?, ?, '', '', ?, ?)", "INSERT INTO users (email, name, company, pass_salt, pass_hash, invite_token, invite_exp, type, portal_enabled) VALUES (?, ?, ?, '', '', ?, ?, 'agent', 0)"],
    ["UPDATE agents SET invite_token = ?, invite_exp = ? WHERE id = ?", "UPDATE users SET invite_token = ?, invite_exp = ? WHERE id = ? AND type = 'agent'"],
    ["UPDATE agents SET alerts = CASE WHEN alerts = 1 THEN 0 ELSE 1 END WHERE id = ?", "UPDATE users SET alerts = CASE WHEN alerts = 1 THEN 0 ELSE 1 END WHERE id = ? AND type = 'agent'"],
    ["UPDATE agents SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END, session_ver = session_ver + 1 WHERE id = ?", "UPDATE users SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END, session_ver = session_ver + 1 WHERE id = ? AND type = 'agent'"],
    ["UPDATE agents SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END WHERE id = ?", "UPDATE users SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END WHERE id = ? AND type = 'agent'"],
    ["FROM agents WHERE id = ?", "FROM users WHERE id = ? AND type = 'agent'"],
    ["FROM agents WHERE active = 1", "FROM users WHERE active = 1 AND type = 'agent'"],
  ],
  "src/auth.js": [
    ["FROM agents WHERE email = ?", "FROM users WHERE email = ? AND type = 'agent'"],
    ["FROM agents WHERE invite_token IN (?, ?)", "FROM users WHERE invite_token IN (?, ?) AND type = 'agent'"],
    ["UPDATE agents SET pass_salt = ?, pass_hash = ?, invite_token = NULL, invite_exp = NULL, active = 1, session_ver = session_ver + 1 WHERE id = ?", "UPDATE users SET pass_salt = ?, pass_hash = ?, invite_token = NULL, invite_exp = NULL, active = 1, session_ver = session_ver + 1 WHERE id = ? AND type = 'agent'"],
    ["UPDATE agents SET pass_salt = ?, pass_hash = ?, invite_token = NULL, invite_exp = NULL, active = 1 WHERE id = ?", "UPDATE users SET pass_salt = ?, pass_hash = ?, invite_token = NULL, invite_exp = NULL, active = 1 WHERE id = ? AND type = 'agent'"],
    ["FROM agents WHERE lower(email) = ?", "FROM users WHERE lower(email) = ? AND type = 'agent'"],
    ["FROM agents WHERE id = ?", "FROM users WHERE id = ? AND type = 'agent'"],
  ],
  "src/matcher.js": [
    ["LEFT JOIN agents ag ON ag.id = c.agent_id", "LEFT JOIN users ag ON ag.id = c.agent_id AND ag.type = 'agent'"],
  ],
};

for (const [file, reps] of Object.entries(edits)) {
  let s = readFileSync(file, "utf8");
  for (const [from, to] of reps) {
    if (!s.includes(from)) { console.log(`MISS ${file}: ${from.slice(0, 55)}`); continue; }
    s = s.split(from).join(to);
  }
  writeFileSync(file, s);
  console.log(`done ${file}`);
}
