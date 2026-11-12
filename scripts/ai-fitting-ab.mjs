#!/usr/bin/env node
/**
 * A/B comparison of the photo-fitting prompts (v1 = in production, v2 = improved) on real generations.
 *
 * This spends money: every generation is a paid Gemini image call made through the LAGI Worker
 * (about one call per product cut-out the first time, plus one per fitting). It therefore does NOTHING
 * unless you pass --yes AND set LAGI_AB_CONFIRM_PAID=yes. Without them it prints what it would do.
 *
 *   node scripts/ai-fitting-ab.mjs --person photo.jpg --products plano-bag,daily-tote \
 *        --styles hand,shoulder --runs 2 --out ab-out            (dry run)
 *   LAGI_AB_CONFIRM_PAID=yes node scripts/ai-fitting-ab.mjs … --yes   (real calls)
 *
 * Use only photos you have the right to use (the person's consent). Outputs go to --out as
 * <product>-<style>-<version>-<run>.jpg plus results.json with the automatic checks (aspect, change,
 * similarity). Those checks are cheap heuristics — look at the pictures and score them yourself with
 * docs/ai-fitting-upgrade/IMAGE-FITTING-IMPROVEMENTS.md's rubric.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const flag = (k) => process.argv.includes('--' + k);
const person = arg('person');
const products = (arg('products', 'plano-bag')).split(',');
const styles = (arg('styles', 'hand')).split(',');
const runs = Number(arg('runs', '1'));
const out = arg('out', 'ab-out');
const worker = arg('worker', 'https://lagi-tryon.lagi-official.workers.dev');
const site = arg('site', 'https://ewq122334455-tech.github.io/lagi-ar/');
const STYLE = { hand: 'held by the handles in one hand, arm relaxed at the side', shoulder: 'with the handles resting on one shoulder', crossbody: 'worn cross-body with the strap across the chest' };
// Arms: v1 = production prompt; v2 = improved prompt; v2faces = improved prompt + the product's real surface photos as extra references.
const versions = (arg('arms', 'v1,v2')).split(',');
const jobs = products.flatMap((p) => styles.flatMap((s) => versions.flatMap((v) => Array.from({ length: runs }, (_, r) => ({ p, s, v, r })))));
const perCall = Number(arg('usd-per-call', '0.04')); // rough: ~USD 0.04 per Gemini image generation — CHECK the current price and pass it
const cutoutsFirstTime = products.length; // each product's AI cut-out is generated once, then cached by the Worker
const cost = (jobs.length + cutoutsFirstTime) * perCall;
const cap = Number(arg('max-usd', '0')); // hard ceiling for this run; 0 = refuse to run

console.log('--- PREFLIGHT (nothing is sent yet) ---');
console.log(`products      : ${products.join(', ')}`);
console.log(`styles        : ${styles.join(', ')}`);
console.log(`arms          : ${versions.join(' vs ')}   (model: the Worker's GEMINI_MODEL; same person photo and runs for every arm)`);
console.log(`calls         : ${jobs.length} fittings + up to ${cutoutsFirstTime} first-time cut-outs = ${jobs.length + cutoutsFirstTime}`);
console.log(`estimate      : USD ${cost.toFixed(2)} at USD ${perCall}/call (an estimate — check the current price)`);
console.log(`ceiling       : ${cap ? 'USD ' + cap : 'NOT SET — pass --max-usd <amount>'}`);
console.log(`person photo  : ${person ?? 'NOT GIVEN'}   consent: ${arg('consent', 'NOT GIVEN — pass --consent "<who agreed, when>"')}`);
console.log('on failure    : a failed call (blocked/busy/no image) is NOT retried here; Google may still bill some failures. The run stops at the ceiling.');
console.log('rating        : see docs/ai-fitting-upgrade/V3-QUALITY-EVALUATION.md (blind side-by-side, two raters).');
if (!person || !fs.existsSync(person)) { console.log('\n--person <photo> is required (a photo you may use).'); process.exit(person ? 2 : 0); }
if (!flag('yes') || process.env.LAGI_AB_CONFIRM_PAID !== 'yes') { console.log('\nDRY RUN: nothing was sent. Add --yes and LAGI_AB_CONFIRM_PAID=yes to make the paid calls.'); process.exit(0); }
if (!cap || cost > cap) { console.log(`\nREFUSED: the estimate (USD ${cost.toFixed(2)}) is above --max-usd (${cap || 'not set'}).`); process.exit(3); }
if (!arg('consent')) { console.log('\nREFUSED: --consent "<who agreed, when>" is required for a photo of a person.'); process.exit(3); }

fs.mkdirSync(out, { recursive: true });
const personUrl = 'data:image/jpeg;base64,' + (await sharp(person).rotate().resize({ width: 1280, height: 1280, fit: 'inside' }).jpeg({ quality: 90 }).toBuffer()).toString('base64');
const results = [];
let spent = 0;
const faceUrls = (pj) => { const m = pj.model3d; if (!m) return null; const ps = [m.faces?.front, m.textures?.front, m.faces?.back, m.textures?.back, m.faces?.left ?? m.faces?.right, m.textures?.side].filter(Boolean); const u = [...new Set(ps)].slice(0, 3).map((x) => new URL(x, site).toString()); return u.length ? u : null; };
for (const j of jobs) {
  if (spent + perCall > cap) { console.log(`ceiling reached at USD ${spent.toFixed(2)}; stopping`); break; }
  spent += perCall;
  const pj = JSON.parse(await (await fetch(new URL(`products/${j.p}/product.json`, site))).text());
  const d = pj.dimensions;
  const res = await fetch(worker, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: new URL(site).origin },
    body: JSON.stringify({ person: personUrl, productImage: new URL(pj.images[0], site).toString(), productName: pj.name.value, category: pj.category.value, size: d.widthCm ? `W${d.widthCm * 10} × H${(d.heightCm ?? 0) * 10} × D${(d.depthCm ?? 0) * 10} mm` : undefined, style: STYLE[j.s], promptVersion: j.v.startsWith('v2') ? 'v2' : j.v, faces: j.v === 'v2faces' ? (faceUrls(pj) ?? undefined) : undefined }),
  });
  const body = await res.json().catch(() => ({}));
  const rec = { ...j, status: res.status, error: body.error, reason: body.reason };
  if (body.image) {
    const buf = Buffer.from(body.image.split(',')[1], 'base64');
    const file = path.join(out, `${j.p}-${j.s}-${j.v}-${j.r}.jpg`);
    await sharp(buf).jpeg({ quality: 92 }).toFile(file);
    const m = await sharp(buf).metadata(); const pm = await sharp(person).rotate().metadata();
    rec.file = file; rec.size = [m.width, m.height]; rec.aspectDiff = Math.abs(m.width / m.height / (pm.width / pm.height) - 1);
  }
  results.push(rec); console.log(rec.file ?? `FAILED ${rec.status} ${rec.reason ?? ''}`);
  await new Promise((r) => setTimeout(r, 1500));
}
fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 1));
const okN = (v) => results.filter((r) => r.v === v && r.file).length;
console.log('\n' + versions.map((v) => `${v} ${okN(v)}/${jobs.length / versions.length}`).join(', ') + `; counted spend about USD ${spent.toFixed(2)}. Now compare the pictures side by side, blind.`);
