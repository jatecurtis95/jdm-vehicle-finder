// IA-AUDIT item 14: "Who owes money?" answered who, then abandoned the user
// before how. Outstanding deposits lead the Payments page with a WhatsApp
// chase action (pre-filled reminder, and the tap logs to activity via the
// existing data-clog beacon = "mark chased" for free). The dashboard's owes
// list gets the same affordance, and ledger rows link to the client.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { adminPage } from "../src/admin.js";

const ADMIN = { role: "admin", id: 0 };

function seed() {
  return `
    INSERT INTO users (id, name, email, whatsapp) VALUES
      (1, 'Amy Owes', 'amy@x.com', '+61400111222'),
      (2, 'Ben NoPhone', 'ben@x.com', NULL);
    INSERT INTO searches (id, client_id, label, marka_name, model_name, deposit_status, status) VALUES
      (1, 1, 'R34', 'NISSAN', 'SKYLINE', 'requested', 'deposit_requested'),
      (2, 2, 'Supra', 'TOYOTA', 'SUPRA', 'requested', 'deposit_requested');
    INSERT INTO payments (client_id, amount_cents, currency, status, description, created_at) VALUES
      (1, 100000, 'aud', 'paid', 'Deposit', datetime('now'));
  `;
}

test("outstanding deposits lead the Payments page with a WhatsApp chase", async () => {
  const env = makeEnv(seed());
  const html = await adminPage(env, "payments", ADMIN);
  const outstanding = html.indexOf("Deposits outstanding<");
  const ledger = html.indexOf("Payments<span");
  assert.ok(outstanding > -1 && ledger > -1 && outstanding < ledger, "the money you can act on comes first");
  assert.match(html, /href="https:\/\/wa\.me\/61400111222\?text=[^"]*deposit[^"]*"/, "pre-filled reminder deep link");
  assert.match(html, /data-clog="1:whatsapp"/, "the chase tap logs to activity (mark chased)");
});

test("no WhatsApp on file: no chase link, Mark paid stays", async () => {
  const env = makeEnv(seed());
  const html = await adminPage(env, "payments", ADMIN);
  const benRow = html.slice(html.indexOf("Ben NoPhone"), html.indexOf("</tr>", html.indexOf("Ben NoPhone")));
  assert.doesNotMatch(benRow, /wa\.me/, "no dead chase affordance");
  assert.match(benRow, /Mark paid/, "the paid path is always there");
});

test("the dashboard owes list carries the same chase affordance", async () => {
  const env = makeEnv(seed());
  const html = await adminPage(env, "dashboard", ADMIN);
  const owes = html.slice(html.indexOf("Who owes money?"), html.indexOf("Who's closest to buying?"));
  assert.match(owes, /wa\.me\/61400111222/, "chase from the dashboard too");
  assert.match(owes, /data-clog="1:whatsapp"/, "logged as a touch");
});

test("ledger rows link the client to their record", async () => {
  const env = makeEnv(seed());
  const html = await adminPage(env, "payments", ADMIN);
  const ledger = html.slice(html.indexOf('id="paymentsTbl"'));
  assert.match(ledger, /<a class="clink" href="\/admin\?view=client&id=1"[^>]*>Amy Owes<\/a>/, "payment context starts from the client, not a Stripe id");
});
