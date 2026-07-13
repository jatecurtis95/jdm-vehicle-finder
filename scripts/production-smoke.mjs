#!/usr/bin/env node
// Read-only production smoke test. It is intentionally safe to run after every
// deploy: no authentication, form submission, email, payment, or database write.

const BASE = new URL(process.env.PROD_BASE_URL || "https://jdmfinder.com.au");
const ATTEMPTS = Number(process.env.PROD_SMOKE_ATTEMPTS || 5);
const RETRY_MS = Number(process.env.PROD_SMOKE_RETRY_MS || 2000);

const checks = [
  ["/", /text\/html/i, /JDMFinder/i],
  ["/request", /text\/html/i, /Start your free search|Tell us what you/i],
  ["/login", /text\/html/i, /Sign in/i],
  ["/stock", /text\/html/i, /Dealer stock|Available stock/i],
  ["/privacy", /text\/html/i, /Privacy Policy/i],
  ["/terms", /text\/html/i, /Terms|refund|cancel/i],
  ["/robots.txt", /text\/plain/i, /User-agent:/i],
  ["/sitemap.xml", /(?:application|text)\/xml/i, /<urlset[\s>]/i],
  ["/.well-known/security.txt", /text\/plain/i, /Contact:\s*mailto:/i],
];

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function read(path) {
  const url = new URL(path, BASE);
  const response = await fetch(url, {
    redirect: "manual",
    headers: { "User-Agent": "JDMFinder production smoke/1.0", "Cache-Control": "no-cache" },
    signal: AbortSignal.timeout(10_000),
  });
  return { response, body: await response.text(), url };
}

async function checkRoute([path, contentType, bodyPattern]) {
  let lastError;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const { response, body, url } = await read(path);
      if (response.status !== 200) throw new Error(`${url} returned HTTP ${response.status}`);
      const type = response.headers.get("content-type") || "";
      if (!contentType.test(type)) throw new Error(`${url} returned ${type || "no content type"}`);
      if (!bodyPattern.test(body)) throw new Error(`${url} did not contain its expected marker`);
      if (path === "/") {
        if (!/rel=["']canonical["']/i.test(body)) throw new Error("home page is missing its canonical link");
        if (!/max-age=\d+/i.test(response.headers.get("cache-control") || "")) {
          // Dynamic HTML can be revalidated, but it must state a cache policy.
          if (!(response.headers.get("cache-control") || "").includes("no-store")) {
            throw new Error("home page is missing an explicit cache policy");
          }
        }
      }
      const nosniff = response.headers.get("x-content-type-options");
      if (nosniff !== "nosniff") throw new Error(`${url} is missing X-Content-Type-Options: nosniff`);
      return `${path} (${response.status})`;
    } catch (error) {
      lastError = error;
      if (attempt < ATTEMPTS) await pause(RETRY_MS);
    }
  }
  throw lastError;
}

async function main() {
  const results = [];
  for (const spec of checks) results.push(await checkRoute(spec));

  // Canonical-host smoke: legacy public hosts must never serve duplicate HTML.
  if (BASE.hostname === "jdmfinder.com.au") {
    for (const host of ["www.jdmfinder.com.au", "finder.jdmconnect.com.au"]) {
      const response = await fetch(`https://${host}/`, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
      const location = response.headers.get("location") || "";
      if (![301, 308].includes(response.status) || !location.startsWith("https://jdmfinder.com.au/")) {
        throw new Error(`${host} did not permanently redirect to the canonical host`);
      }
      results.push(`${host} -> canonical (${response.status})`);
    }
  }

  console.log(`Production smoke passed for ${BASE.origin}:`);
  for (const result of results) console.log(`  - ${result}`);
}

main().catch((error) => {
  console.error(`Production smoke failed: ${error.message}`);
  process.exitCode = 1;
});

