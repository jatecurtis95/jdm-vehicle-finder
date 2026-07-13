// Re-encode the landing page photography for the web (launch audit: ~2.75MB of
// full-resolution JPEGs was the main cause of the ~6s mobile LCP).
//
// For every public/assets/photo/web/*.jpg this writes two WebP variants next to
// it - <base>-1280.webp (desktop) and <base>-720.webp (phones) - and prints the
// PHOTO_DIMS map that src/landing.js bakes in for correct width/height attrs.
// The original JPEGs stay in the repo as the editing source; only the WebP
// files are referenced by the page. Rerun after adding or replacing a photo:
//   node scripts/optimize-landing-images.mjs
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "assets", "photo", "web");
const WIDTHS = [1280, 720];
const QUALITY = { 1280: 74, 720: 72 };

const jpgs = readdirSync(dir).filter((f) => f.endsWith(".jpg")).sort();
if (!jpgs.length) { console.error(`no .jpg sources found in ${dir}`); process.exit(1); }

const dims = {};
for (const file of jpgs) {
  const base = file.replace(/\.jpg$/, "");
  for (const w of WIDTHS) {
    const out = join(dir, `${base}-${w}.webp`);
    const info = await sharp(join(dir, file))
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: QUALITY[w] })
      .toFile(out);
    if (w === WIDTHS[0]) dims[file] = [info.width, info.height];
    console.log(`${base}-${w}.webp  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)}KB`);
  }
}

console.log("\n// PHOTO_DIMS for src/landing.js (width/height of the -1280 variant):");
console.log("const PHOTO_DIMS = " + JSON.stringify(dims, null, 2)
  .replace(/"([^"]+\.jpg)"/g, '"$1"').replace(/\[\s+(\d+),\s+(\d+)\s+\]/g, "[$1, $2]") + ";");
