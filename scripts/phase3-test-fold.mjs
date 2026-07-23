// One-off Phase 3 test-fixture fold: the agents table is gone (folded into
// users WHERE type='agent'). Test seeds and helper queries still name it.
// This converts, in test/*.mjs only:
//   1. INSERT INTO agents (COLS) VALUES <rows>;  ->  INSERT INTO users
//      (COLS, type) VALUES <each row + ,'agent'>;   so seeded agents are typed.
//   2. remaining keyword-context `agents` (FROM/JOIN/UPDATE/INTO) -> users, so
//      helper lookups resolve. Test data uses isolated emails/ids, so the
//      type='agent' filter that src carries is not needed for these reads.
// Run once, then delete.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

function fold(src) {
  let n = 0;
  src = src.replace(/INSERT INTO agents\s*\(([^)]*)\)\s*VALUES([\s\S]*?);/g, (m, cols, vals) => {
    n++;
    const newCols = cols.replace(/\s+$/, "") + ", type";
    // Append , 'agent' before each row-closing ) (one followed by a comma, and
    // the final one at the end of the captured VALUES text). The ) inside a
    // ${Date.now()} template is followed by " + ..." so it is never matched.
    const newVals = vals.replace(/\)(\s*)(,|$)/g, ", 'agent')$1$2");
    return `INSERT INTO users (${newCols}) VALUES${newVals};`;
  });
  src = src.replace(/\b(FROM|JOIN|UPDATE|INTO)\s+agents\b/g, (m, kw) => { n++; return `${kw} users`; });
  return { src, n };
}

let total = 0, files = 0;
for (const f of readdirSync("test")) {
  if (!/\.mjs$/.test(f)) continue;
  const p = join("test", f);
  const orig = readFileSync(p, "utf8");
  if (!/\bagents\b/.test(orig)) continue;
  const { src, n } = fold(orig);
  if (n > 0 && src !== orig) { writeFileSync(p, src); console.log(`${n}\t${f}`); total += n; files++; }
}
console.log(`TOTAL ${total} across ${files} files`);
