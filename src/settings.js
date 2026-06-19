// Editable runtime settings (key/value in D1), so behaviour can be toggled from
// the admin Settings page without a redeploy. Booleans are stored as "1"/"0".

const DEFAULTS = {
  digest_email: "",      // alert recipient; blank = fall back to env.DIGEST_EMAIL
  email_alerts: "1",     // send the staff digest email when matches are found
  send_to_client: "1",   // email the client when a match is approved
  client_landed: "1",    // include the landed-cost figure in client emails
};

export async function getSettings(env) {
  const map = { ...DEFAULTS };
  try {
    const rows = (await env.DB.prepare("SELECT key, value FROM settings").all()).results || [];
    for (const r of rows) if (r.key in map) map[r.key] = r.value;
  } catch (e) {
    console.error("getSettings failed, using defaults:", e.message);
  }
  return map;
}

export function settingOn(settings, key) {
  return settings[key] === "1" || settings[key] === true;
}

// The effective alert recipient: the saved address, else the env fallback.
export function digestRecipient(settings, env) {
  return (settings.digest_email && settings.digest_email.trim()) || env.DIGEST_EMAIL;
}

// Save the Settings form. Checkboxes are "on" when present, off when absent.
export async function saveSettings(env, form) {
  const next = {
    digest_email: String(form.get("digest_email") || "").trim(),
    email_alerts: form.get("email_alerts") ? "1" : "0",
    send_to_client: form.get("send_to_client") ? "1" : "0",
    client_landed: form.get("client_landed") ? "1" : "0",
  };
  const stmts = Object.entries(next).map(([k, v]) =>
    env.DB.prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).bind(k, v)
  );
  await env.DB.batch(stmts);
}
