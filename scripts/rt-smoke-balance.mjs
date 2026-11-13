#!/usr/bin/env node
/**
 * Records the Decart credit balance and concurrent-session quota BEFORE and AFTER the one paid smoke session.
 * Both calls are read-only GETs (GET /v1/credits, GET /v1/realtime/quota); they start no session and generate nothing.
 * The key is read from server/tryon-worker/.dev.vars and is never printed or written to the result file.
 *
 *   node scripts/rt-smoke-balance.mjs before
 *   (run the one 10-second session)
 *   node scripts/rt-smoke-balance.mjs after
 */
import fs from 'node:fs';
import path from 'node:path';
const when = process.argv[2];
if (!['before', 'after'].includes(when)) { console.log('usage: node scripts/rt-smoke-balance.mjs before|after'); process.exit(2); }
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const vars = path.join(root, 'server', 'tryon-worker', '.dev.vars');
const env = fs.existsSync(vars) ? Object.fromEntries(fs.readFileSync(vars, 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])) : {};
if (!env.DECART_API_KEY) { console.log('DECART_API_KEY is not in server/tryon-worker/.dev.vars'); process.exit(3); }
const base = process.env.DECART_BASE_URL || 'https://api.decart.ai';
const outDir = path.join(root, 'docs', 'ai-video-production', 'results');
const file = path.join(outDir, 'smoke-run.json');
fs.mkdirSync(outDir, { recursive: true });
const get = async (p) => { const r = await fetch(base + p, { headers: { 'x-api-key': env.DECART_API_KEY } }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { /* keep text */ } return { status: r.status, body: j ?? t.slice(0, 300) }; };
const run = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
run[when] = { at: new Date().toISOString(), credits: await get('/v1/credits'), quota: await get('/v1/realtime/quota') };
const num = (o) => { if (typeof o === 'number') return o; if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) if (/credit|balance|remain/i.test(k) && typeof v === 'number') return v; return null; };
if (run.before && run.after) {
  const b = num(run.before.credits.body); const a = num(run.after.credits.body);
  run.difference = b !== null && a !== null ? { credits: Math.round((b - a) * 1000) / 1000, usd: Math.round(((b - a) / 100) * 10000) / 10000, note: '1 USD = 100 credits (Decart pricing FAQ)' } : { note: 'balance field not recognised; compare run.before.credits and run.after.credits by hand' };
}
fs.writeFileSync(file, JSON.stringify(run, null, 2));
console.log(`${when}: credits HTTP ${run[when].credits.status}, quota HTTP ${run[when].quota.status}`);
console.log('credits:', JSON.stringify(run[when].credits.body));
console.log('quota  :', JSON.stringify(run[when].quota.body));
if (run.difference) console.log('difference:', JSON.stringify(run.difference));
console.log('saved ->', path.relative(root, file));
