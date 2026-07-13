import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { repoRoot } from "./helpers/d1.mjs";

const read = (file) => readFileSync(resolve(repoRoot, file), "utf8");

test("the Worker ships with current compatibility and first-party observability", () => {
  const wrangler = read("wrangler.toml");
  const date = wrangler.match(/^compatibility_date\s*=\s*"(\d{4}-\d{2}-\d{2})"/m)?.[1];
  assert.ok(date && date >= "2026-01-01", `compatibility_date is stale: ${date || "missing"}`);
  assert.match(wrangler, /\[observability\][\s\S]*?enabled\s*=\s*true/);
});

test("production migration reconciliation is dry-run by default and backs up before apply", () => {
  const path = resolve(repoRoot, "scripts/reconcile-migration-ledger.mjs");
  assert.ok(existsSync(path), "safe migration-ledger reconciliation script is missing");
  const script = readFileSync(path, "utf8");
  assert.match(script, /--apply/, "live writes require an explicit apply flag");
  assert.match(script, /d1[\s\S]*export/, "the script exports a production backup before writing");
  assert.match(script, /diffSchema|schema/i, "the live schema is verified before baselining the ledger");
  assert.match(script, /INSERT\s+OR\s+IGNORE\s+INTO\s+d1_migrations/i);
  assert.match(script, /0004_stripe_events\.sql/);
  assert.match(script, /0017_wishlist_mileage_min\.sql/);
});

test("migration documentation has one safe production workflow", () => {
  const docs = read("migrations/README.md");
  const pkg = JSON.parse(read("package.json"));
  assert.doesNotMatch(docs, /tracking table was never adopted/i);
  assert.doesNotMatch(docs, /NEVER\s+`?migrations apply/i);
  assert.match(docs, /reconcile-migration-ledger/i);
  assert.equal(pkg.scripts["db:reconcile:remote"], "node scripts/reconcile-migration-ledger.mjs");
});

test("the production deploy is serialized, pinned, bounded, and smoke-tested", () => {
  const workflow = read(".github/workflows/deploy.yml");
  assert.match(workflow, /^concurrency:/m);
  assert.match(workflow, /environment:\s*production/);
  assert.match(workflow, /timeout-minutes:/);

  const actionRefs = [...workflow.matchAll(/^\s*uses:\s*[^\s#]+@([^\s#]+)/gm)].map((m) => m[1]);
  assert.ok(actionRefs.length >= 3, "expected checkout, setup-node, and deploy actions");
  for (const ref of actionRefs) assert.match(ref, /^[a-f0-9]{40}$/, `mutable action ref: ${ref}`);

  const deployAt = workflow.indexOf("Deploy Worker");
  const smokeAt = workflow.indexOf("Production smoke");
  assert.ok(deployAt >= 0 && smokeAt > deployAt, "production smoke test must run after deploy");
  assert.match(workflow.slice(smokeAt), /npm run test:prod:smoke/);
});

test("a repeatable production smoke script covers the critical public entry points", () => {
  const path = resolve(repoRoot, "scripts/production-smoke.mjs");
  assert.ok(existsSync(path), "production smoke script is missing");
  const script = readFileSync(path, "utf8");
  for (const route of ["/", "/request", "/login", "/robots.txt", "/sitemap.xml", "/.well-known/security.txt"]) {
    assert.ok(script.includes(route), `production smoke omits ${route}`);
  }
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts["test:prod:smoke"], "node scripts/production-smoke.mjs");
});
