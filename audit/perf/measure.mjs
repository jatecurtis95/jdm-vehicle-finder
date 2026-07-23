// Perf capture harness for the Auction History and Live Auctions pages.
// Uses the pre-installed Chromium via puppeteer-core. Measures, per page:
//   FCP, total transfer weight, request count, image-request count,
//   slowest three requests, external (cross-origin) request count.
// Loads at a fixed 1280x900 viewport and does NOT scroll, so the numbers
// reflect the INITIAL load (which is exactly where lazy loading helps).
import puppeteer from "puppeteer-core";

const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://127.0.0.1:8787";
const LABEL = process.argv[2] || "run";

const TARGETS = [
  ["live",    `${BASE}/portal/auctions?make=NISSAN`],
  ["history", `${BASE}/portal/history?make=NISSAN`],
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle0", timeout: 30000 });
  await page.type('input[name="email"]', "demo.buyer@example.com");
  await page.type('input[name="password"]', "demo1234");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0", timeout: 30000 }),
    page.click('button[type="submit"], input[type="submit"]'),
  ]);
}

async function measure(page, url) {
  // Fresh cache each load so weight/requests are cold-load figures.
  const client = await page.target().createCDPSession();
  await client.send("Network.clearBrowserCache");
  await page.goto(url, { waitUntil: "networkidle0", timeout: 45000 });
  // Give lazy-load / async bits a beat to settle without scrolling.
  await new Promise((r) => setTimeout(r, 500));
  return page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] || {};
    const res = performance.getEntriesByType("resource");
    const fcpE = performance.getEntriesByName("first-contentful-paint")[0];
    const origin = location.origin;
    const rows = res.map((r) => ({
      name: r.name,
      type: r.initiatorType,
      ms: Math.round(r.duration),
      bytes: r.transferSize || 0,
      external: !r.name.startsWith(origin) && !r.name.startsWith("/"),
    }));
    const navBytes = nav.transferSize || 0;
    const total = navBytes + rows.reduce((a, r) => a + r.bytes, 0);
    const imgs = rows.filter((r) => /perf-placeholder\.svg/.test(r.name));
    const external = rows.filter((r) => r.external);
    const slowest = [...rows].sort((a, b) => b.ms - a.ms).slice(0, 3)
      .map((r) => ({ ms: r.ms, bytes: r.bytes, name: r.name.replace(origin, "") }));
    return {
      fcp_ms: fcpE ? Math.round(fcpE.startTime) : null,
      dom_ms: Math.round(nav.domContentLoadedEventEnd || 0),
      load_ms: Math.round(nav.loadEventEnd || 0),
      requests: rows.length + 1,
      total_bytes: total,
      html_bytes: navBytes,
      image_requests: imgs.length,
      image_bytes: imgs.reduce((a, r) => a + r.bytes, 0),
      external_requests: external.length,
      external_names: [...new Set(external.map((r) => r.name.replace(/\?.*$/, "")))],
      slowest,
    };
  });
}

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
await login(page);

const out = { label: LABEL, pages: {} };
for (const [name, url] of TARGETS) {
  // Two loads; keep the second (first can carry login-warmup noise).
  await measure(page, url);
  out.pages[name] = await measure(page, url);
}
await browser.close();
console.log(JSON.stringify(out, null, 2));
