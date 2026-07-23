// One-off Phase 3 mechanical table-rename sweep. SAFE by construction: it only
// rewrites table names in SQL-keyword contexts (FROM/JOIN/INTO/UPDATE/REFERENCES/
// TABLE <table>), never bare identifiers, so JS like `clients.map` or `res.wishlists`
// is untouched. `agents` is deliberately EXCLUDED (it folds into users WHERE
// type='agent', a semantic change done by hand). Run once, then delete.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const RENAMES = [["clients", "users"], ["wishlists", "searches"], ["dealers", "suppliers"]];
const KW = "(FROM|JOIN|INTO|UPDATE|REFERENCES|TABLE)";

function sweep(path) {
  let src = readFileSync(path, "utf8");
  let n = 0;
  for (const [from, to] of RENAMES) {
    const re = new RegExp(`\\b${KW}(\\s+)${from}\\b`, "g");
    src = src.replace(re, (m, kw, sp) => { n++; return `${kw}${sp}${to}`; });
  }
  if (n > 0) writeFileSync(path, src);
  return n;
}

const targets = [];
for (const d of ["src", "test", "seed", "scripts"]) {
  for (const f of readdirSync(d)) {
    if (/\.(mjs|js|sql)$/.test(f) && f !== "phase3-sweep.mjs") targets.push(join(d, f));
  }
}
let total = 0;
for (const t of targets) {
  const n = sweep(t);
  if (n > 0) { console.log(`${n}\t${t}`); total += n; }
}
console.log(`TOTAL ${total} keyword-context renames across ${targets.length} files scanned`);
