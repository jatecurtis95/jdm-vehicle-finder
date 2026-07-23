// Regenerate the local perf-measurement scaffolding:
//   - public/assets/perf-placeholder.svg : a ~28KB grey placeholder image so
//     the 24 card photos are realistically weighted and load from the dev
//     origin (no external CDN dependency).
//   - audit/perf/fixture-24.xml : a 24-row auction feed fixture whose image
//     URLs point at the placeholder (with a ? so &w=320 appends cleanly).
// Paste fixture-24.xml (single line) into .dev.vars as AUCTION_FIXTURE, then
// `npm run db:migrate:local && npm run db:seed:local`, set client 9001
// member=1, `npm run dev`, and run measure.mjs. The placeholder lives under
// public/assets only for local runs and is NOT committed.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const pad = "x".repeat(28000);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="214"><rect width="320" height="214" fill="#c9ccd1"/><text x="160" y="110" font-size="16" text-anchor="middle" fill="#6b7079">car photo</text><!-- ${pad} --></svg>`;
writeFileSync(resolve(ROOT, "public/assets/perf-placeholder.svg"), svg);

const makes = [
  ["NISSAN", "SKYLINE", "BNR34", "GT-R V-SPEC", "4.5"],
  ["TOYOTA", "SUPRA", "JZA80", "RZ", "4"],
  ["MAZDA", "RX-7", "FD3S", "TYPE R", "4"],
  ["HONDA", "NSX", "NA1", "COUPE", "4.5"],
  ["SUBARU", "IMPREZA", "GC8", "WRX STI", "4"],
  ["MITSUBISHI", "LANCER", "CN9A", "EVO IV", "3.5"],
];
let rows = "";
for (let i = 0; i < 24; i++) {
  const m = makes[i % makes.length];
  const yr = 1994 + (i % 8);
  const img = `/assets/perf-placeholder.svg?lot=${i}`;
  rows += `  <row><id>perf-${i}</id><lot>${5000 + i}</lot><auction>USS Tokyo</auction><auction_date>2099-02-${String(1 + (i % 27)).padStart(2, "0")}T02:00:00</auction_date><marka_name>${m[0]}</marka_name><model_name>${m[1]}</model_name><year>${yr}</year><kuzov>${m[2]}</kuzov><grade>${m[3]}</grade><color>White</color><mileage>${50000 + i * 1000}</mileage><rate>${m[4]}</rate><eng_v>2600</eng_v><kpp>F6</kpp><priv>4WD</priv><start>${8000000 + i * 10000}</start><avg_price>0</avg_price><finish>${7000000 + i * 10000}</finish><lhdrive>0</lhdrive><images>${img}</images></row>\n`;
}
writeFileSync(resolve(ROOT, "audit/perf/fixture-24.xml"), `<aj>\n${rows}</aj>\n`);
console.log("wrote public/assets/perf-placeholder.svg and audit/perf/fixture-24.xml");
