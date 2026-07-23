// Perf capture for the staff in-client "Find a car" flow. Logs in as admin and
// loads a client page with an active find query, so 24 fixture lots render as
// staffFindCards. Reports TTFB (navigation.responseStart, which includes any
// server-side blocking on the calculator) and FCP. Pair with the slowcalc
// stub's /__count to see calculator calls made during the server render.
import puppeteer from "puppeteer-core";

const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://127.0.0.1:8787";
const LABEL = process.argv[2] || "run";
const URL = `${BASE}/admin?view=client&id=9001&make=NISSAN`;

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });

// Admin login.
await page.goto(`${BASE}/login`, { waitUntil: "networkidle0", timeout: 30000 });
await page.type('input[name="password"]', "devadmin");
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle0", timeout: 30000 }),
  page.click('button[type="submit"], input[type="submit"]'),
]);

async function measure() {
  const client = await page.target().createCDPSession();
  await client.send("Network.clearBrowserCache");
  await page.goto(URL, { waitUntil: "networkidle0", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 500));
  return page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] || {};
    const fcp = performance.getEntriesByName("first-contentful-paint")[0];
    const landedShown = [...document.querySelectorAll(".ml-v")].map((e) => e.textContent.trim());
    return {
      ttfb_ms: Math.round(nav.responseStart || 0),
      response_end_ms: Math.round(nav.responseEnd || 0),
      fcp_ms: fcp ? Math.round(fcp.startTime) : null,
      dom_ms: Math.round(nav.domContentLoadedEventEnd || 0),
      landed_lines: landedShown.length,
      landed_sample: landedShown.slice(0, 3),
    };
  });
}

// SINGLE cold load: the Phase 2 per-isolate estimate cache absorbs repeat
// loads, so a warm-up would hide the per-row blocking. Restart wrangler dev
// before each run so the isolate (and its cache) is cold.
const out = { label: LABEL, find: await measure() };
await browser.close();
console.log(JSON.stringify(out, null, 2));
