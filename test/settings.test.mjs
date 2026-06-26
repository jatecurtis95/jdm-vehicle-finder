// Settings: boolean/number helpers and the membership-pricing defaults.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./helpers/d1.mjs";
import { getSettings, settingOn, settingNum, saveSettings } from "../src/settings.js";

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

test("getSettings returns the membership-pricing defaults on an empty database", async () => {
  const env = makeEnv();
  const s = await getSettings(env);
  assert.equal(s.membership_monthly_aud, "49", "single Full-access plan price");
  assert.equal(s.free_result_limit, "1");
  assert.equal(s.stripe_enabled, "0", "deposits default off");
});

test("saveSettings keeps defaults for blank or invalid numeric fields", async () => {
  const env = makeEnv();
  const f = new FormData();
  f.set("free_result_limit", "");         // blank -> default
  f.set("membership_monthly_aud", "abc"); // invalid -> default 49
  f.set("stripe_deposit_aud", "");        // blank deposit stays off (empty)
  await saveSettings(env, f);
  const s = await getSettings(env);
  assert.equal(s.free_result_limit, "1");
  assert.equal(s.membership_monthly_aud, "49");
  assert.equal(s.stripe_deposit_aud, "");
});

test("saveSettings persists a changed membership price", async () => {
  const env = makeEnv();
  const f = new FormData();
  f.set("membership_monthly_aud", "59"); // valid -> kept
  await saveSettings(env, f);
  const s = await getSettings(env);
  assert.equal(s.membership_monthly_aud, "59");
});

test("getSettings lets stored rows override defaults", async () => {
  const env = makeEnv(`INSERT INTO settings (key,value) VALUES ('membership_monthly_aud','39'),('free_result_limit','3');`);
  const s = await getSettings(env);
  assert.equal(s.membership_monthly_aud, "39");
  assert.equal(s.free_result_limit, "3");
  assert.equal(s.stripe_enabled, "0", "untouched keys keep their default");
});
