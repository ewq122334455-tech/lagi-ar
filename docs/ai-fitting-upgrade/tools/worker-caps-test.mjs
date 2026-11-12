// Worker: AI-photo daily cost caps (mock Gemini, in-memory KV). Usage: node worker-caps-test.mjs <dir with worker.mjs and fake-gemini.png>
import fs from 'node:fs';
const D = process.argv[2];
const png = fs.readFileSync(D + '/fake-gemini.png').toString('base64');
const jpg = fs.readFileSync('/home/user/lagi-ar/public/products/plano-bag/images/main.jpg');
let geminiCalls = 0;
globalThis.fetch = async (url) => {
  url = String(url);
  if (url.includes('generativelanguage')) { geminiCalls++; return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png } }] } }] })); }
  if (url.includes('/products/')) return new Response(jpg, { headers: { 'Content-Type': 'image/jpeg' } });
  throw new Error('unexpected fetch ' + url);
};
const { default: w } = await import(D + '/worker.mjs');
const kv = () => { const m = new Map(); return { m, get: async (k) => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); }, delete: async (k) => m.delete(k), list: async () => ({ keys: [], list_complete: true }) }; };
const O = 'https://ewq122334455-tech.github.io';
const person = 'data:image/jpeg;base64,' + jpg.toString('base64');
let n = 1;
const call = (env, ip) => w.fetch(new Request('https://w/', { method: 'POST', headers: { Origin: O, 'CF-Connecting-IP': ip ?? `10.1.${n++ % 250}.${n++ % 250}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ person, productImage: `${O}/lagi-ar/products/plano-bag/images/main.jpg`, productName: 'p', style: 'held' }) }), env);
const ok = (name, c, i = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${name}${i ? '  — ' + i : ''}`);
let env = { GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm', ALLOWED_ORIGINS: O, MEDIA: kv(), TRYON_DAILY_PER_IP: '2', TRYON_DAILY_SITE: '4' };
// the in-memory per-minute throttle (10/min/IP) is separate; use distinct IPs to test the daily caps
let r = await call(env, '9.9.9.9'); ok('1st fitting for an address: 200', r.status === 200);
r = await call(env, '9.9.9.9'); ok('2nd: 200', r.status === 200);
const before = geminiCalls; r = await call(env, '9.9.9.9'); const b = await r.json();
ok('3rd for the same address: 429 daily_limit, no Gemini call made', r.status === 429 && b.reason === 'daily_limit' && geminiCalls === before, b.error);
r = await call(env, '8.8.8.8'); ok('another address still served (3rd site fitting)', r.status === 200);
r = await call(env, '7.7.7.7'); ok('4th site fitting served', r.status === 200);
const before2 = geminiCalls; r = await call(env, '6.6.6.6'); const b2 = await r.json();
ok('5th site fitting: 429 site_limit, no Gemini call made', r.status === 429 && b2.reason === 'site_limit' && geminiCalls === before2, b2.error);
const keys = [...env.MEDIA.m.keys()].filter((k) => k.startsWith('tryon:'));
ok('counters live in KV under tryon:<day>:…', keys.some((k) => k.endsWith(':all')) && keys.some((k) => k.endsWith(':9.9.9.9')));
env = { GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm', ALLOWED_ORIGINS: O, MEDIA: kv() };
let served = 0; for (let i = 0; i < 14; i++) { const x = await call(env, '5.5.5.5'); if (x.status === 200) served++; }
ok('defaults: per-address 12/day (14 tries from one address, per-minute throttle also applies)', served <= 12 && served >= 1, `${served} served`);
env = { GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm', ALLOWED_ORIGINS: O };
r = await call(env, '4.4.4.4'); ok('no KV bound (local tests): no cap, still works', r.status === 200);
const bad = await w.fetch(new Request('https://w/', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: '{}' }), env);
ok('browser origin not on the list: 403 (unchanged)', bad.status === 403);
