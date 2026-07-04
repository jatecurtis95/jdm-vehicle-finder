// IA-AUDIT item 10: the Customers directory becomes a working queue. Bulk bar
// only on selection, a state-aware contact dot (neutral never / green fresh /
// amber cooling / red only past 14d WITH prior engagement), Matches-waiting
// and Stage columns, and most-recent-activity default order.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { adminPage } from "../src/admin.js";

const ADMIN = { role: "admin", id: 0 };

// Amy: contacted 3 days ago, 2 pending matches, deposit_paid request.
// Bea: contacted 20 days ago AND engaged (viewed) - the true gone-quiet red.
// Cal: contacted 20 days ago, never engaged - cooling amber, not alarm red.
// Dee: never contacted at all - neutral, not red.
function seed() {
  return `
    INSERT INTO clients (id, name, email) VALUES
      (1, 'Amy Fresh', 'amy@x.com'), (2, 'Bea Quiet', 'bea@x.com'),
      (3, 'Cal Cold', 'cal@x.com'), (4, 'Dee Prospect', 'dee@x.com');
    INSERT INTO wishlists (id, client_id, label, marka_name, status) VALUES
      (1, 1, 'R34', 'NISSAN', 'deposit_paid'), (2, 1, 'R32', 'NISSAN', 'searching'),
      (3, 2, 'Supra', 'TOYOTA', 'vehicles_sent'), (4, 3, 'RX7', 'MAZDA', 'new'),
      (5, 4, 'Evo', 'MITSUBISHI', 'lost');
    INSERT INTO queue (id, wishlist_id, client_id, lot_id, lot_json, status, token, created_at, sent_at, viewed_at) VALUES
      (1, 1, 1, 'P1', '{"id":"P1"}', 'pending', 't1', datetime('now'), NULL, NULL),
      (2, 1, 1, 'P2', '{"id":"P2"}', 'pending', 't2', datetime('now'), NULL, NULL),
      (3, 3, 2, 'S1', '{"id":"S1"}', 'sent', 't3', datetime('now','-20 days'), datetime('now','-20 days'), datetime('now','-19 days')),
      (4, 4, 3, 'S2', '{"id":"S2"}', 'sent', 't4', datetime('now','-20 days'), datetime('now','-20 days'), NULL);
    INSERT INTO activity (client_id, type, detail, actor, created_at) VALUES
      (1, 'contact', 'WhatsApp tap', 'Staff', datetime('now','-3 days'));
  `;
}

test("matches-waiting and stage columns render on the directory", async () => {
  const env = makeEnv(seed());
  const html = await adminPage(env, "clients", ADMIN);
  assert.match(html, /<th[^>]*>Matches waiting<\/th>/, "matches-waiting column");
  assert.match(html, /<th[^>]*>Stage<\/th>/, "stage column");
  assert.match(html, /class="mw-link"[^>]*href="\/admin\?view=client&id=1"[^>]*>2</, "Amy's two pending matches link to her record");
  assert.match(html, /Deposit paid/, "Amy's furthest stage renders as a chip");
  assert.match(html, /Vehicles sent/, "Bea's stage renders");
});

test("default order is most recent activity first, never-contacted last", async () => {
  const env = makeEnv(seed());
  const html = await adminPage(env, "clients", ADMIN);
  const table = html.slice(html.indexOf('id="clientsTbl"'));
  const amy = table.indexOf("Amy Fresh"), bea = table.indexOf("Bea Quiet"), dee = table.indexOf("Dee Prospect");
  assert.ok(amy > -1 && bea > -1 && dee > -1, "all rows render");
  assert.ok(amy < bea, "3d-ago contact floats above 20d-ago");
  assert.ok(bea < dee, "never-contacted sinks to the bottom");
});

test("the contact dot is state-aware instead of ambient alarm", async () => {
  const env = makeEnv(seed());
  const html = await adminPage(env, "clients", ADMIN);
  const rowOf = (name) => {
    const i = html.indexOf(name);
    return html.slice(i, html.indexOf("</tr>", i));
  };
  assert.match(rowOf("Amy Fresh"), /health-green/, "fresh contact reads green");
  assert.match(rowOf("Bea Quiet"), /health-red/, "20d silent WITH engagement is the true alarm");
  assert.match(rowOf("Cal Cold"), /health-amber/, "20d silent without engagement cools to amber");
  assert.match(rowOf("Dee Prospect"), /health-neutral/, "never contacted is neutral, not red");
});

test("the bulk bar hides until something is selected", async () => {
  const env = makeEnv(seed());
  const html = await adminPage(env, "clients", ADMIN);
  assert.match(html, /id="bulkform"[^>]*class="bulkbar"/, "bar starts without the show class");
  assert.match(html, /\.bulkbar\{display:none\}/, "hidden by default");
  assert.match(html, /\.bulkbar\.show\{display:flex\}/, "selection reveals it");
});
