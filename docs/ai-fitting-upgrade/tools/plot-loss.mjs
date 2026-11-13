// Plot of the loss/recovery trace: where the hand really is vs where each engine draws the bag (horizontal position, px).
import fs from 'node:fs'; import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url.replace('file://', '').replace(/docs\/.*/, 'package.json'))('sharp');
const [inp, out] = process.argv.slice(2);
const d = JSON.parse(fs.readFileSync(inp));
const W = 1100, H = 520, L = 70, R = 20, T = 40, B = 60;
const all = [...d.truth.map((p) => p.cx), ...Object.values(d.engines).flatMap((e) => e.map((p) => p.cx).filter((v) => v != null))];
const y0 = Math.min(...all) - 20, y1 = Math.max(...all) + 20; const t0 = d.truth[0].t, t1 = d.truth.at(-1).t;
const X = (t) => L + ((t - t0) / (t1 - t0)) * (W - L - R), Y = (v) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
const path = (pts) => { let s = '', pen = false; for (const p of pts) { if (p.cx == null) { pen = false; continue; } s += `${pen ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.cx).toFixed(1)} `; pen = true; } return s; };
const col = { truth: '#111', v1: '#c0392b', v2: '#e08a00', v3: '#1a56db' };
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="sans-serif" font-size="14"><rect width="100%" height="100%" fill="#fff"/>`;
svg += `<rect x="${X(d.gap[0])}" y="${T}" width="${X(d.gap[1]) - X(d.gap[0])}" height="${H - T - B}" fill="#eee"/><text x="${X(d.gap[0]) + 6}" y="${T + 18}" fill="#666">detection lost (600 ms)</text>`;
svg += `<line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" stroke="#999"/><line x1="${L}" y1="${T}" x2="${L}" y2="${H - B}" stroke="#999"/>`;
svg += `<path d="${path(d.truth)}" fill="none" stroke="${col.truth}" stroke-width="2.5" stroke-dasharray="6 4"/>`;
for (const e of ['v1', 'v2', 'v3']) svg += `<path d="${path(d.engines[e])}" fill="none" stroke="${col[e]}" stroke-width="2.5"/>`;
svg += `<text x="${L}" y="24" font-size="16" font-weight="bold">Bag x-position during a 600 ms tracking loss (moving hand, recorded tracker output)</text>`;
let lx = L + 10; for (const [k, n] of [['truth', 'real hand (no loss)'], ['v1', 'V1'], ['v2', 'V2'], ['v3', 'V3 (hidden where the line stops)']]) { svg += `<rect x="${lx}" y="${H - 38}" width="22" height="4" fill="${col[k]}"/><text x="${lx + 28}" y="${H - 32}">${n}</text>`; lx += 200; }
svg += `<text x="${L}" y="${H - 8}" fill="#666">time (ms) →   y axis: px   (a line that stops = the bag is hidden in that engine)</text></svg>`;
await sharp(Buffer.from(svg)).png().toFile(out);
