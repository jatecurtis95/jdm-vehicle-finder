// IA-AUDIT items 17 + 18. Agents: the existing team renders before the
// invite form (which folds away) and the table answers workload - clients
// AND open requests per agent. Settings: channel test-sends, so a WhatsApp
// provider change is verified by a button, not by messaging a real client.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { adminPage } from "../src/admin.js";

const ADMIN = { role: "admin", id: 0 };

function seed() {
  return `
    INSERT INTO agents (id, email, name, pass_salt, pass_hash, active, alerts) VALUES
      (5, 'ben@x.com', 'Ben Broker', 's', 'h', 1, 1);
    INSERT INTO clients (id, name, email, agent_id) VALUES
      (1, 'Alice Apple', 'a@x.com', 5), (2, 'Bob Banana', 'b@x.com', 5);
    INSERT INTO wishlists (id, client_id, label, marka_name, status) VALUES
      (1, 1, 'R34', 'NISSAN', 'searching'),
      (2, 1, 'R32', 'NISSAN', 'new'),
      (3, 2, 'Supra', 'TOYOTA', 'delivered');
  `;
}

test("agents: the team list renders before the folded invite form", async () => {
  const env = makeEnv(seed());
  const html = await adminPage(env, "agents", ADMIN);
  const table = html.indexOf('id="agentsTbl"');
  const form = html.indexOf('id="newAgent"');
  assert.ok(table > -1 && form > -1 && table < form, "the daily read outranks the occasional tool");
  assert.match(html, /<details class="card foldcard" id="newAgent"(?![^>]*\bopen\b)/, "the form folds by default");
});

test("agents: a validation bounce springs the invite form open", async () => {
  const env = makeEnv(seed());
  const html = await adminPage(env, "agents", ADMIN, { vals: { name: "Half Typed" } });
  assert.match(html, /<details class="card foldcard" id="newAgent" open/, "typed values are never hidden");
});

test("agents: workload columns show clients and open requests", async () => {
  const env = makeEnv(seed());
  const html = await adminPage(env, "agents", ADMIN);
  assert.match(html, /<th[^>]*>Open requests<\/th>/, "the workload column exists");
  const row = html.slice(html.indexOf("Ben Broker", html.indexOf('id="agentsTbl"')));
  assert.match(row.slice(0, row.indexOf("</tr>")), /<td style="text-align:right">2<\/td>\s*<td style="text-align:right">2<\/td>/, "2 clients, 2 open requests (delivered excluded)");
});

test("settings: channel test-sends live outside the main form", async () => {
  const env = makeEnv("");
  const html = await adminPage(env, "settings", ADMIN);
  assert.match(html, /form="tsEmail"[^>]*>Send me a test email|type="submit" form="tsEmail"/, "email test button");
  assert.match(html, /<form id="tsEmail" method="POST" action="\/settings\/test-email"><\/form>/, "email test form is its own form (no nesting)");
  assert.match(html, /name="to" form="tsWa"|form="tsWa"[^>]*name="to"/, "the WhatsApp test number rides the external form");
  assert.match(html, /<form id="tsWa" method="POST" action="\/settings\/test-whatsapp"><\/form>/, "WhatsApp test form is its own form");
});
