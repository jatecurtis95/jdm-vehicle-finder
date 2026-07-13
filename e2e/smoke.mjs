import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";

const baseUrl = String(process.env.E2E_BASE_URL || "").replace(/\/$/, "");
const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find(existsSync);

test("critical mobile flows render without the stabilization regressions", { skip: !baseUrl }, async () => {
  assert.ok(executablePath && existsSync(executablePath), "Chrome/Chromium is required for the CI smoke test");
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 1 });

    await page.goto(`${baseUrl}/request`, { waitUntil: "networkidle0" });
    const wizard = await page.evaluate(() => ({
      scrollY: window.scrollY,
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      heading: document.querySelector("h1")?.textContent?.trim(),
    }));
    assert.ok(wizard.scrollY < 10, `request wizard starts at the top (actual scrollY ${wizard.scrollY})`);
    assert.equal(wizard.pageWidth, wizard.viewportWidth, "request wizard has no page-level horizontal overflow");
    assert.match(wizard.heading || "", /What vehicle are you looking for/i);

    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle0" });
    const login = await page.evaluate(() => ({
      hasMain: document.querySelector("main#main") !== null,
      skipTargetExists: document.querySelector('.skip-link[href="#main"]') !== null && document.getElementById("main") !== null,
      passwordAutofocus: document.querySelector('input[name="password"]')?.hasAttribute("autofocus") || false,
    }));
    assert.equal(login.hasMain, true, "login has a semantic main landmark");
    assert.equal(login.skipTargetExists, true, "login skip link has a real target");
    assert.equal(login.passwordAutofocus, false, "login does not summon the mobile keyboard automatically");

    const missing = await page.goto(`${baseUrl}/not-a-real-page`, { waitUntil: "networkidle0" });
    assert.equal(missing?.status(), 404, "unknown public pages return HTTP 404");
    assert.match(await page.$eval("h1", (el) => el.textContent || ""), /Page not found/i);

    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle0" });
    await page.type('input[name="password"]', process.env.E2E_ADMIN_PASSWORD || "e2e-admin");
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0" }),
      page.click('button[type="submit"]'),
    ]);
    await page.goto(`${baseUrl}/admin?view=dealers`, { waitUntil: "networkidle0" });
    const dealers = await page.evaluate(() => ({
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      hasSidebar: !!document.querySelector("aside.side"),
      hasDealerHeading: /Dealers/i.test(document.querySelector("h1")?.textContent || ""),
    }));
    assert.equal(dealers.pageWidth, dealers.viewportWidth, "dealer management has no page-level horizontal overflow");
    assert.equal(dealers.hasSidebar, true, "dealer management stays inside the shared admin shell");
    assert.equal(dealers.hasDealerHeading, true);
  } finally {
    await browser.close();
  }
});
