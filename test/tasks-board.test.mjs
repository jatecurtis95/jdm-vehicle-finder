// IA-AUDIT item 16: the Tasks board leads with the work. Stats first, the
// explainer follows the list and its dismissal persists per browser, a
// quick-add with client autocomplete captures follow-ups at the moment of
// thought, and an assigned-to-me filter stops five people sharing one
// undifferentiated list.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { adminPage, createTask } from "../src/admin.js";

const ADMIN = { role: "admin", id: 0 };

function seed() {
  return `
    INSERT INTO agents (id, email, name, pass_salt, pass_hash, active) VALUES (5, 'ben@x.com', 'Ben', '', '', 1);
    INSERT INTO clients (id, name, email, agent_id) VALUES (1, 'Alice Apple', 'a@x.com', 5), (2, 'Bob Banana', 'b@x.com', 5);
    INSERT INTO tasks (id, title, client_id, assigned_to, due_date, status) VALUES
      (1, 'Call Alice re finance', 1, 5, date('now'), 'todo'),
      (2, 'Chase the deposit', 2, NULL, date('now'), 'todo');
  `;
}

test("stats lead the page and the explainer follows the work, dismissal persisted", async () => {
  const env = makeEnv(seed());
  const html = await adminPage(env, "tasks", ADMIN);
  const strip = html.indexOf('class="tk-strip"');
  const help = html.indexOf('class="tks-help"');
  assert.ok(strip > -1 && help > -1 && strip < help, "onboarding copy no longer outranks the work");
  assert.doesNotMatch(html, /<details class="tks-help" id="tksHelp" open>/, "the server never forces it open");
  assert.match(html, /jdmTasksHelpHidden/, "dismissal persists per browser");
});

test("quick-add renders with client autocomplete and a due date", async () => {
  const env = makeEnv(seed());
  const html = await adminPage(env, "tasks", ADMIN);
  assert.match(html, /<form class="card tk-add" method="POST" action="\/task\/create">/, "capture at the moment of thought");
  assert.match(html, /list="tkClients"/, "client field autocompletes");
  assert.match(html, /<option value="Alice Apple">/, "client names feed the datalist");
  assert.match(html, /type="date" name="due_date"/, "due date on the spot");
});

test("quick-add resolves a typed client name to the record", async () => {
  const env = makeEnv(seed());
  const form = new Map([["title", "Call Sam re finance"], ["client_name", "alice apple"]]);
  const r = await createTask(env, form, ADMIN);
  assert.equal(r.ok, true);
  const t = await env.DB.prepare("SELECT client_id FROM tasks WHERE title = 'Call Sam re finance'").first();
  assert.equal(t.client_id, 1, "case-insensitive exact match links the client");
});

test("ambiguous or unknown names leave the task unlinked, never guessed", async () => {
  const env = makeEnv(seed() + `INSERT INTO clients (id, name, email) VALUES (3, 'Alice Apple', 'a2@x.com');`);
  const r = await createTask(env, new Map([["title", "Ring re shipping"], ["client_name", "Alice Apple"]]), ADMIN);
  assert.equal(r.ok, true);
  const t = await env.DB.prepare("SELECT client_id FROM tasks WHERE title = 'Ring re shipping'").first();
  assert.equal(t.client_id, null, "two Alices means no link, not a coin flip");
});

test("the assigned-to-me filter narrows the board", async () => {
  const env = makeEnv(seed());
  const agent = { role: "agent", id: 5 };
  const all = await adminPage(env, "tasks", agent);
  assert.match(all, /Call Alice re finance/, "own assignment shows");
  assert.match(all, /Chase the deposit/, "client task shows by default");
  const mine = await adminPage(env, "tasks", agent, { taskMine: true });
  assert.match(mine, /Call Alice re finance/, "assigned to me stays");
  assert.doesNotMatch(mine, /Chase the deposit/, "unassigned client work filters out");
  assert.match(all, /view=tasks&mine=1/, "the Mine chip links the filter");
});
