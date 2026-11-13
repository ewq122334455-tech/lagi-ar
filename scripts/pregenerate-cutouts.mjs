#!/usr/bin/env node
/**
 * Pre-generates (and thereby caches) the AI cut-out of each real product, so a visitor's first fitting does not pay for it
 * and a burst of first-time visitors cannot spend the day's budget on cut-outs (docs/ai-fitting-upgrade/V5-COST-SAFETY.md).
 * It asks the Worker's POST /cutout, which stores the result in the Worker's KV; asking again is a cache hit (no Gemini call).
 *
 *   node scripts/pregenerate-cutouts.mjs                         (dry run: lists the products and the cost estimate)
 *   LAGI_AB_CONFIRM_PAID=yes node scripts/pregenerate-cutouts.mjs --yes --max-usd 2 --worker <url> --site <url>
 *
 * PAID: each cache miss is one Gemini image attempt (up to 3 on trouble) plus one cheap text call. Nothing is sent without
 * --yes AND LAGI_AB_CONFIRM_PAID=yes AND a --max-usd ceiling that covers the worst case. Only products whose name and
 * price are VERIFIED and that have a local image are listed (no sample or placeholder products).
 */
import fs from 'node:fs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const flag = (k) => process.argv.includes('--' + k);
const site = arg('site', 'https://ewq122334455-tech.github.io/lagi-ar/');
const worker = arg('worker', 'https://lagi-tryon.lagi-official.workers.dev');
const perUnit = Number(arg('usd-per-unit', '0.04'));
const cap = Number(arg('max-usd', '0'));
const local = arg('local-products', ''); // read product data from disk instead of the site (tests)
const only = arg('products', '').split(',').filter(Boolean);
const saveDir = arg('save', ''); // keep the returned cut-out pictures here (for scripts/ai-eval-kit.mjs --cutouts)

const read = async (rel) => (local ? JSON.parse(fs.readFileSync(`${local}/${rel}`, 'utf8')) : await (await fetch(new URL(rel, site))).json());
const manifest = await read('products/manifest.json');
const ids = manifest.products.map((p) => (typeof p === 'string' ? p : p.id));
const items = [];
for (const id of ids) {
  const p = await read(`products/${id}/product.json`);
  if (p.sample || p.name?.status !== 'VERIFIED' || p.price?.status !== 'VERIFIED' || !p.images?.length) continue;
  if (only.length && !only.includes(id)) continue;
  items.push({ id, image: new URL(p.images[0], site).toString() });
}
const best = items.length * (1 + 0.1), worst = items.length * (3 + 0.1);
console.log('--- PREFLIGHT (nothing is sent yet) ---');
console.log(`products : ${items.map((i) => i.id).join(', ') || '(none)'}  (${items.length}; sample and placeholder products are skipped)`);
console.log(`units    : best case ${best.toFixed(1)} (one attempt + description each), worst case ${worst.toFixed(1)} (3 attempts each); already-cached products cost 0`);
console.log(`estimate : USD ${(best * perUnit).toFixed(2)} – ${(worst * perUnit).toFixed(2)} at USD ${perUnit}/unit (an ESTIMATE — check the current price; the attempt count is not a guaranteed dollar ceiling)`);
console.log(`ceiling  : ${cap ? 'USD ' + cap : 'NOT SET — pass --max-usd <amount>'}`);
if (!flag('yes') || process.env.LAGI_AB_CONFIRM_PAID !== 'yes') { console.log('\nDRY RUN: nothing was sent. Add --yes and LAGI_AB_CONFIRM_PAID=yes to make the paid calls.'); process.exit(0); }
if (!cap || worst * perUnit > cap) { console.log(`\nREFUSED: the worst case (USD ${(worst * perUnit).toFixed(2)}) is above --max-usd (${cap || 'not set'}).`); process.exit(3); }
const origin = new URL(site).origin;
const out = [];
for (const it of items) {
  const res = await fetch(new URL(worker.replace(/\/$/, '') + '/cutout'), { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: arg('origin', origin) }, body: JSON.stringify({ productImage: it.image }) });
  const b = await res.json().catch(() => ({}));
  out.push({ id: it.id, status: res.status, cutout: !!b.cutout, reason: b.reason });
  if (saveDir && b.cutout && typeof b.image === 'string') {
    fs.mkdirSync(saveDir, { recursive: true });
    const m = /^data:image\/(\w+);base64,(.+)$/.exec(b.image);
    if (m) fs.writeFileSync(`${saveDir}/${it.id}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`, Buffer.from(m[2], 'base64'));
  }
  console.log(`${it.id.padEnd(24)} ${res.status} cutout=${!!b.cutout}${b.reason ? ' ' + b.reason : ''}`);
  await new Promise((r) => setTimeout(r, 1200));
}
fs.writeFileSync(arg('out', 'cutouts-result.json'), JSON.stringify(out, null, 1));
console.log(`\n${out.filter((o) => o.cutout).length}/${out.length} cut-outs ready. Run again to confirm they are cached (a cache hit makes no Gemini call).`);
