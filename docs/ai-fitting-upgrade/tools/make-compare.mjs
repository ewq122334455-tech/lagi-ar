// Side-by-side crops (V1 | V2 | V3) of the same product on the same recorded hand clip, plus an amplified difference.
// Usage: node make-compare.mjs <shots dir> <product> <clip> <crop l,t,w,h> <out.png> [engines]
import { createRequire } from 'node:module';
const sharp = createRequire('/home/user/lagi-ar/package.json')('sharp');
import fs from 'node:fs';
const [dir, product, clip, crop, out, engArg] = process.argv.slice(2);
const [l, t, w, h] = crop.split(',').map(Number);
const engines = (engArg ?? 'v1,v2,v3').split(',').filter((e) => fs.existsSync(`${dir}/${product}-${clip}-${e}.png`));
const S = 2.2;
const tiles = [];
for (const e of engines) tiles.push(await sharp(`${dir}/${product}-${clip}-${e}.png`).extract({ left: l, top: t, width: w, height: h }).resize(Math.round(w * S), Math.round(h * S), { kernel: 'lanczos3' }).toBuffer());
const label = (txt) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w * S)}" height="34"><rect width="100%" height="100%" fill="#111"/><text x="10" y="24" fill="#fff" font-family="sans-serif" font-size="20">${txt}</text></svg>`);
const tw = Math.round(w * S), th = Math.round(h * S);
const comps = [];
for (let i = 0; i < tiles.length; i++) { comps.push({ input: await sharp(label(engines[i].toUpperCase())).png().toBuffer(), left: i * (tw + 8), top: 0 }, { input: tiles[i], left: i * (tw + 8), top: 34 }); }
await sharp({ create: { width: engines.length * (tw + 8) - 8, height: th + 34, channels: 3, background: '#fff' } }).composite(comps).png().toFile(out);
console.log(out, engines.join(','));
