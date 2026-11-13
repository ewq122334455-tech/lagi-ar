/**
 * Display copies of the product photos for the published site.
 *
 * Reads every JPEG/PNG under public/products and writes WebP copies at a few widths to
 * dist/_img/<same path>-<width>.webp. The originals are never touched: the AI fitting, the 3D models
 * and product.json keep using them. Pages only *offer* these copies through srcset (src stays the
 * original), so a browser that cannot use them still shows the original.
 *
 * Every copy must exist (the page names them without checking), so any failure stops the build.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'public', 'products');
const OUT = path.join(ROOT, 'dist', '_img', 'products');
export const WIDTHS = [480, 960, 1600];

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(jpe?g|png)$/i.test(e.name)) files.push(p);
  }
})(SRC);

let made = 0;
let before = 0;
let after = 0;
for (const file of files) {
  const rel = path.relative(SRC, file).replace(/\.(jpe?g|png)$/i, '');
  const img = sharp(file, { failOn: 'error' });
  const { width } = await img.metadata();
  before += fs.statSync(file).size;
  for (const w of WIDTHS) {
    const out = path.join(OUT, `${rel}-${w}.webp`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    // Never enlarge: a photo narrower than w is written at its own width under the same name.
    await sharp(file).rotate().resize({ width: Math.min(w, width), withoutEnlargement: true }).webp({ quality: 78 }).toFile(out);
    if (w === 960) after += fs.statSync(out).size;
    made++;
  }
}
const missing = files.flatMap((f) => WIDTHS.map((w) => path.join(OUT, `${path.relative(SRC, f).replace(/\.(jpe?g|png)$/i, '')}-${w}.webp`))).filter((p) => !fs.existsSync(p));
if (missing.length) {
  console.error(`build-images: ${missing.length} copies missing, e.g. ${missing[0]}`);
  process.exit(1);
}
console.log(`build-images: ${files.length} photos → ${made} WebP copies (originals ${(before / 1e6).toFixed(1)} MB; 960px copies ${(after / 1e6).toFixed(1)} MB)`);
