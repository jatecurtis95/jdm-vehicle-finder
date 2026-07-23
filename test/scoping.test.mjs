// Multi-tenant isolation. An agent may see only their own clients plus clients
// explicitly shared with them; an admin sees everything. These tests exercise
// the real guards against an in-memory database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { clientOwnedBy, clientAccessibleBy, accessScope } from "../src/admin.js";

const FIXTURE = `
  INSERT INTO users (id,email,name,pass_salt,pass_hash, type) VALUES (1,'a1@x','A1','','', 'agent'),(2,'a2@x','A2','','', 'agent');
  INSERT INTO users (id,name,email,agent_id) VALUES
    (10,'Owned by A1','a@x',1),
    (20,'Owned by A2','b@x',2),
    (30,'Owned by A2, shared to A1','c@x',2);
  INSERT INTO client_shares (client_id,agent_id) VALUES (30,1);
`;

const A1 = { role: "agent", id: 1 };
const A2 = { role: "agent", id: 2 };
const ADMIN = { role: "admin", id: 0 };

test("clientOwnedBy: an agent owns only the clients they created", async () => {
  const env = makeEnv(FIXTURE);
  assert.equal(await clientOwnedBy(env, 10, A1), true);
  assert.equal(await clientOwnedBy(env, 20, A1), false);
  assert.equal(await clientOwnedBy(env, 30, A1), false, "a shared client is not owned");
});

test("clientOwnedBy: admin owns everything", async () => {
  const env = makeEnv(FIXTURE);
  assert.equal(await clientOwnedBy(env, 20, ADMIN), true);
});

test("clientAccessibleBy: owner or share grants access, nothing else", async () => {
  const env = makeEnv(FIXTURE);
  assert.equal(await clientAccessibleBy(env, 10, A1), true, "owned");
  assert.equal(await clientAccessibleBy(env, 30, A1), true, "shared to A1");
  assert.equal(await clientAccessibleBy(env, 20, A1), false, "neither owned nor shared");
  assert.equal(await clientAccessibleBy(env, 10, A2), false, "A2 cannot see A1's client");
});

test("accessScope predicate filters list queries to owned + shared rows", async () => {
  const env = makeEnv(FIXTURE);
  const scope = accessScope(A1);
  const rows = env.DB.prepare(`SELECT c.id FROM users c WHERE ${scope.sql} ORDER BY c.id`).bind(...scope.binds).all().results;
  assert.deepEqual(rows.map((r) => r.id), [10, 30], "A1 sees only owned (10) + shared (30)");
});

test("accessScope for admin is unrestricted", async () => {
  const env = makeEnv(FIXTURE);
  const scope = accessScope(ADMIN);
  assert.equal(scope.sql, "1=1");
  assert.deepEqual(scope.binds, []);
  const rows = env.DB.prepare(`SELECT c.id FROM users c WHERE ${scope.sql} ORDER BY c.id`).all().results;
  assert.deepEqual(rows.map((r) => r.id), [10, 20, 30]);
});
