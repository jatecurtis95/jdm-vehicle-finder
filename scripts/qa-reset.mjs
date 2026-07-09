#!/usr/bin/env node
// Reusable local QA reset (QA follow-up item 7). Wipes the local wrangler state
// (D1 + KV), re-applies every migration to a fresh local D1, and loads the dev
// seed - so an end-to-end QA run always starts from a known, disposable state.
// Cross-platform (the team runs on Windows), local-only, never touches remote.
//
//   npm run qa:reset                # migrations + seed-dev.sql (default)
//   npm run qa:reset -- --worstcase # seed-worstcase.sql instead
//   npm run qa:reset -- --no-seed   # migrations only, empty data
//
// After it finishes, start the app with `npm run dev`. Test logins are printed
// below and documented in QA.md.
import { rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const DB_NAME = "jdm-vehicle-finder";
const argv = process.argv.slice(2);

function run(cmd, args) {
  console.log(`\n$ ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, { cwd: ROOT, stdio: "inherit" });
}

// 1) Wipe local wrangler state (local D1 database + KV). This lives entirely
//    under .wrangler/state; removing it is what makes the reset "disposable".
const state = resolve(ROOT, ".wrangler", "state");
if (existsSync(state)) {
  rmSync(state, { recursive: true, force: true });
  console.log("✓ Cleared local wrangler state (D1 + KV) at .wrangler/state");
} else {
  console.log("• No existing .wrangler/state to clear (fresh checkout).");
}

// 2) Re-apply all migrations to a fresh local D1. On a fresh database the
//    runner applies 0001..N cleanly in order (the prod tracking-table drift
//    documented in migrations/README.md is a remote-only concern).
run("npx", ["wrangler", "d1", "migrations", "apply", DB_NAME, "--local"]);

// 3) Load a seed unless asked not to.
if (!argv.includes("--no-seed")) {
  const seedFile = argv.includes("--worstcase") ? "seed/seed-worstcase.sql" : "seed/seed-dev.sql";
  run("npx", ["wrangler", "d1", "execute", DB_NAME, "--local", "--file", seedFile]);
  console.log(`\n✓ Loaded ${seedFile}`);
}

console.log(`
✓ Local QA state reset.

  Start the app:   npm run dev
  Admin:           blank email + your ADMIN_PASSWORD (.dev.vars, e.g. "devadmin")
  Agent:           demo.agent@example.com / demo1234
  Buyer portal:    demo.buyer@example.com / demo1234   (sign in at /portal)

  Deterministic auction data: set AUCTION_FIXTURE in .dev.vars to the contents
  of seed/auction-fixture.example.xml (see QA.md).
`);
