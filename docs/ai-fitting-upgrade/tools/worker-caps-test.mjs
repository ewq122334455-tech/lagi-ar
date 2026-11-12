// Worker cost meter. Unit = one paid Gemini ATTEMPT (every HTTP call, retries and product cut-outs included).
// Mock Gemini counts the attempts that actually leave the Worker. NO real Gemini call is ever made.
// Usage: node worker-caps-test.mjs <dir with worker.mjs and fake-gemini.png>
import fs from 'node:fs';
const D = process.argv[2];
const png = fs.readFileSync(D + '/fake-gemini.png').toString('base64');
const jpg = fs.readFileSync('/home/user/lagi-ar/public/products/plano-bag/images/main.jpg');
let attempts = 0, mode = 'ok';
globalThis.fetch = async (url) => {
  url = String(url);
  if (url.includes('generativelanguage')) {
    attempts++;
    if (mode === 'throw') throw new TypeError('network down');
    if (mode === 'text') return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'no image for you' }] } }] }));
    if (mode === 'e503') return new Response('{"error":"busy"}', { status: 503 });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png } }] } }] }));
  }
  if (url.includes('/products/')) return new Response(jpg, { headers: { 'Content-Type': 'image/jpeg' } });
  throw new Error('unexpected fetch ' + url);
};
const { default: w, QuotaCounter } = await import(D + '/worker.mjs');
const O = 'https://ewq122334455-tech.github.io';
const person = 'data:image/jpeg;base64,' + jpg.toString('base64');
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
// A Durable Object namespace mock: ONE request at a time per object (like input gates), storage ops take time, failures injectable.
function makeQuota(opts = {}) {
  const store = new Map(); let chain = Promise.resolve();
  const state = { storage: { get: async (k) => { await delay(2); if (opts.failGet) throw new Error('storage get failed'); return store.get(k); }, put: async (e) => { await delay(2); if (opts.failPut) throw new Error('storage put failed'); for (const [k, v] of Object.entries(e)) store.set(k, v); } } };
  const inst = new QuotaCounter(state);
  const ns = { idFromName: (n) => n, get: () => ({ fetch: (u, init) => { if (opts.unreachable) return Promise.reject(new Error('DO unreachable')); if (opts.garbage) return Promise.resolve(new Response('<html>oops</html>', { status: 200 })); return (chain = chain.then(() => inst.fetch(new Request(u, init)))); } }) };
  return { ns, store };
}
let n = 1;
const env = (over = {}) => ({ GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm', ALLOWED_ORIGINS: O, TRYON_DAILY_UNITS_SITE: '5', TRYON_DAILY_UNITS_PER_IP: '99', ...over });
const call = (e, ip, product = 'plano-bag/images/main.jpg') => w.fetch(new Request('https://w/', { method: 'POST', headers: { Origin: O, 'CF-Connecting-IP': ip ?? `10.1.${n++ % 250}.${n++ % 250}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ person, productImage: `${O}/lagi-ar/products/${product}`, productName: 'p', style: 'held' }) }), e);
const ok = (name, c, i = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${name}${i ? '  — ' + i : ''}`);
const burst = (e, k, tag = 'a') => Promise.all(Array.from({ length: k }, (_, i) => call(e, `10.${tag}.${i}.1`, `plano-bag/images/main.jpg?u=${tag}${i}`)));

// 0. unit = attempt: one request = cut-out (1) + fitting (1) = 2 units when the product is new
{ const q = makeQuota(); attempts = 0; mode = 'ok'; const r = await call(env({ QUOTA: q.ns }), '9.9.9.9', 'plano-bag/images/main.jpg?x=0'); ok('a first-time product costs 2 attempts (cut-out + fitting) and both are metered', r.status === 200 && attempts === 2 && q.store.get('all') === 200, `attempts ${attempts}, metered ${q.store.get('all') / 100} units`); }
// 1. cached cut-out → 1 attempt (second fitting of the same product)
{ const q = makeQuota(); const kv = new Map(); const MEDIA = { get: async (k) => kv.get(k) ?? null, put: async (k, v) => { kv.set(k, v); } }; const e = env({ QUOTA: q.ns, MEDIA }); attempts = 0; await call(e, '9.9.9.9'); const a1 = attempts; await call(e, '9.9.9.9'); ok('the same product again: cut-out cached, only the fitting is metered (1 attempt)', a1 === 2 && attempts - a1 === 1, `${a1} then +${attempts - a1}`); }
// 2. burst: 40 simultaneous requests, cap 5 attempts → real attempts never exceed 5, and the meter equals the attempts; repeat 10 times
{ let worst = 0, mismatches = 0, over = 0; for (let rep = 0; rep < 10; rep++) { const q = makeQuota(); attempts = 0; mode = 'ok'; await burst(env({ QUOTA: q.ns }), 40, `r${rep}`); worst = Math.max(worst, attempts); if (attempts > 5) over++; if (q.store.get('all') !== attempts * 100) mismatches++; }
  ok('40 simultaneous requests (40 new products, worst case) × 10 runs, cap 5: attempts never exceed 5', over === 0 && worst === 5, `worst ${worst} attempts per run`);
  ok('…and in every run the meter equals the attempts really made (nothing uncounted)', mismatches === 0, `${mismatches} mismatching runs`); }
// 2b. burst on ONE product with a shared cut-out cache: the budget is spent on fittings
{ let worst = 0, over = 0, served = []; for (let rep = 0; rep < 10; rep++) { const q = makeQuota(); const kv = new Map(); const MEDIA = { get: async (k) => kv.get(k) ?? null, put: async (k, v) => { kv.set(k, v); } }; await call(env({ QUOTA: q.ns, MEDIA }), '1.1.1.1', 'plano-bag/images/main.jpg?warm'); attempts = 0; const before = q.store.get('all'); const res = await Promise.all(Array.from({ length: 40 }, (_, i) => call(env({ QUOTA: q.ns, MEDIA }), `10.b${rep}.${i}.1`, 'plano-bag/images/main.jpg?warm'))); const used = attempts; worst = Math.max(worst, used); if (used > 3) over++; served.push(res.filter((r) => r.status === 200).length); }
  ok('40 simultaneous requests on a cached product × 10 runs (3 units left after warm-up): attempts never exceed what was left', over === 0, `worst ${worst} attempts, fully served per run: ${served.join(',')}`); }
// 3. retries are metered: Gemini answers text-only → 3 attempts per call; cap 5 stops the storm
{ const q = makeQuota(); attempts = 0; mode = 'text'; const res = await burst(env({ QUOTA: q.ns }), 20, 'rt'); ok('retry storm (no image → 3 tries per call): attempts still ≤ 5', attempts <= 5, `${attempts} attempts, statuses ${[...new Set(res.map((r) => r.status))].join('/')}`); mode = 'ok'; }
// 4. HTTP 503 from Google is not refunded (it may be billed) and is retried → metered per attempt
{ const q = makeQuota(); attempts = 0; mode = 'e503'; await call(env({ QUOTA: q.ns }), '8.8.8.8', 'plano-bag/images/main.jpg?e=1'); ok('503 answers are metered (no refund) — attempts ≤ cap, counter = attempts', attempts <= 5 && q.store.get('all') === attempts * 100, `${attempts} attempts, ${q.store.get('all') / 100} units`); mode = 'ok'; }
// 5. NO refunds: a call that failed (network error before any answer) keeps its unit spent — and cannot be retried past the cap
{ const q = makeQuota(); attempts = 0; mode = 'throw'; await call(env({ QUOTA: q.ns }), '7.7.7.7', 'plano-bag/images/main.jpg?t=1'); const spent = q.store.get('all');
  ok('network failure before any answer: the unit stays spent (no refund)', spent === attempts * 100 && attempts > 0, `${attempts} attempts, counter ${spent / 100} units`);
  attempts = 0; for (let i = 0; i < 5; i++) await call(env({ QUOTA: q.ns }), '7.7.7.7', `plano-bag/images/main.jpg?t=${i + 2}`);
  ok('a storm of failing calls cannot get past the cap (failures are not free retries)', attempts <= 5 - spent / 100 + 0 && q.store.get('all') <= 500, `${attempts} more attempts, counter ${q.store.get('all') / 100} units (cap 5)`); mode = 'ok'; }
{ const q = makeQuota(); const r = await q.ns.get('x').fetch('https://quota/refund', { method: 'POST', body: JSON.stringify({ ip: '1.1.1.1', cost: 100 }) }); const b = await r.json(); ok('the counter has no refund endpoint (a bogus refund request gives nothing back)', !(q.store.get('all') < 0) && b.ok !== true || r.status >= 400, `answered ${r.status} ${JSON.stringify(b)}`); }
// 6. per-address cap
{ const q = makeQuota(); attempts = 0; const e = env({ QUOTA: q.ns, TRYON_DAILY_UNITS_SITE: '999', TRYON_DAILY_UNITS_PER_IP: '3' }); const res = await Promise.all(Array.from({ length: 12 }, () => call(e, '6.6.6.6', 'plano-bag/images/main.jpg?p=1'))); ok('per-address cap 3 with 12 simultaneous requests from one address: attempts ≤ 3', attempts <= 3, `${attempts} attempts`); }
// 7. duplicate / retried requests are charged each time
{ const q = makeQuota(); const kv = new Map(); const e = env({ QUOTA: q.ns, MEDIA: { get: async (k) => kv.get(k) ?? null, put: async (k, v) => { kv.set(k, v); } }, TRYON_DAILY_UNITS_SITE: '999' }); attempts = 0; await call(e, '5.5.5.5'); const a = q.store.get('all'); await call(e, '5.5.5.5'); await call(e, '5.5.5.5'); ok('identical repeated requests are each charged (no free retries)', q.store.get('all') === a + 200, `${a / 100} → ${q.store.get('all') / 100} units`); }
// 8–11. fail closed
for (const [label, opts] of [['counter storage read fails', { failGet: true }], ['counter storage write fails', { failPut: true }], ['counter object unreachable', { unreachable: true }], ['counter answers garbage', { garbage: true }]]) {
  const q = makeQuota(opts); attempts = 0; mode = 'ok'; const r = await call(env({ QUOTA: q.ns }), '4.4.4.4', `plano-bag/images/main.jpg?f=${label.length}`); const b = await r.json();
  ok(`FAIL CLOSED — ${label}: no Gemini call, 503 quota_unavailable`, attempts === 0 && r.status === 503 && b.reason === 'quota_unavailable', `${attempts} attempts, ${r.status} ${b.reason}`);
}
{ attempts = 0; const r = await call(env(), '3.3.3.3'); const b = await r.json(); ok('FAIL CLOSED — no QUOTA binding at all: no Gemini call, 503', attempts === 0 && r.status === 503 && b.reason === 'quota_unavailable', `${attempts} attempts, ${r.status}`); }
{ attempts = 0; const r = await call(env({ TRYON_DAILY_UNITS_SITE: 'abc' , QUOTA: makeQuota().ns }), '3.3.3.4'); ok('FAIL CLOSED — nonsense cap setting: no Gemini call', attempts === 0 && r.status === 503); }
{ attempts = 0; const r = await call(env({ TRYON_QUOTA: 'unmetered' }), '3.3.3.5'); ok('TRYON_QUOTA=unmetered (local tests only) lets calls through', r.status === 200 && attempts >= 1); }
// 12. half-applied counters are impossible: both counters written in one put (put failure leaves nothing)
{ const q = makeQuota({ failPut: true }); await call(env({ QUOTA: q.ns }), '2.2.2.2', 'plano-bag/images/main.jpg?h=1'); ok('a failed counter write leaves no partial count', !q.store.has('all') && ![...q.store.keys()].some((k) => k.startsWith('ip:'))); }
// 13. unchanged behaviour
{ const q = makeQuota(); const bad = await w.fetch(new Request('https://w/', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: '{}' }), env({ QUOTA: q.ns })); ok('origin not on the list: 403 (unchanged)', bad.status === 403); }
