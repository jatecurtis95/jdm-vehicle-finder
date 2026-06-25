// Settings: boolean/number helpers and the founding-pricing defaults.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { getSettings, settingOn, settingNum } from "../src/settings.js";

test("settingOn treats only \"1\"/true as on", () => {
  assert.equal(settingOn({ x: "1" }, "x"), true);
  assert.equal(settingOn({ x: true }, "x"), true);
  assert.equal(settingOn({ x: "0" }, "x"), false);
  assert.equal(settingOn({}, "x"), false);
});

test("settingNum parses numbers and falls back cleanly", () => {
  assert.equal(settingNum({ n: "19" }, "n"), 19);
  assert.equal(settingNum({ n: "0" }, "n", 5), 0, "a real zero is kept");
  assert.equal(settingNum({ n: "" }, "n", 7), 7);
  assert.equal(settingNum({}, "n", 3), 3);
});

test("getSettings returns the founding-pricing defaults on an empty database", async () => {
  const env = makeEnv();
  const s = await getSettings(env);
  assert.equal(s.importer_monthly_aud, "19");
  assert.equal(s.importer_annual_aud, "190");
  assert.equal(s.founding_monthly_aud, "12");
  assert.equal(s.founding_seats, "100");
  assert.equal(s.free_result_limit, "1");
  assert.equal(s.founding_claimed, "0");
  assert.equal(s.stripe_enabled, "0", "deposits default off");
});

test("getSettings lets stored rows override defaults", async () => {
  const env = makeEnv(`INSERT INTO settings (key,value) VALUES ('founding_monthly_aud','15'),('free_result_limit','3');`);
  const s = await getSettings(env);
  assert.equal(s.founding_monthly_aud, "15");
  assert.equal(s.free_result_limit, "3");
  assert.equal(s.importer_monthly_aud, "19", "untouched keys keep their default");
});
