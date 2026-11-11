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
const versions = ['v1', 'v2'];
const jobs = products.flatMap((p) => styles.flatMap((s) => versions.flatMap((v) => Array.from({ length: runs }, (_, r) => ({ p, s, v, r })))));
const cost = jobs.length * 0.04; // rough: ~USD 0.04 per Gemini image generation (check current pricing)

console.log(`${jobs.length} generations (${products.length} products × ${styles.length} styles × 2 prompts × ${runs} runs), about USD ${cost.toFixed(2)} (estimate; cut-outs cost extra the first time)`);
if (!person || !fs.existsSync(person)) { console.log('--person <photo> is required (a photo you may use).'); process.exit(person ? 2 : 0); }
if (!flag('yes') || process.env.LAGI_AB_CONFIRM_PAID !== 'yes') { console.log('DRY RUN: nothing was sent. Add --yes and LAGI_AB_CONFIRM_PAID=yes to make the paid calls.'); process.exit(0); }

fs.mkdirSync(out, { recursive: true });
const personUrl = 'data:image/jpeg;base64,' + (await sharp(person).rotate().resize({ width: 1280, height: 1280, fit: 'inside' }).jpeg({ quality: 90 }).toBuffer()).toString('base64');
const results = [];
for (const j of jobs) {
  const pj = JSON.parse(await (await fetch(new URL(`products/${j.p}/product.json`, site))).text());
  const d = pj.dimensions;
  const res = await fetch(worker, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: new URL(site).origin },
    body: JSON.stringify({ person: personUrl, productImage: new URL(pj.images[0], site).toString(), productName: pj.name.value, category: pj.category.value, size: d.widthCm ? `W${d.widthCm * 10} × H${(d.heightCm ?? 0) * 10} × D${(d.depthCm ?? 0) * 10} mm` : undefined, style: STYLE[j.s], promptVersion: j.v }),
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
console.log(`\nsuccess v1 ${okN('v1')}/${jobs.length / 2}, v2 ${okN('v2')}/${jobs.length / 2}. Now compare the pictures side by side.`);
