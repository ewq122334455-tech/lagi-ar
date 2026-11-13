// Usage ledger (/admin/usage): attempts vs outcomes, auth, scope separation. Mock Gemini only — NO real call.
// Usage: node worker-usage-test.mjs <dir with worker.mjs and fake-gemini.png>
import fs from 'node:fs';
import { makeQuotaNs } from './quota-mock.mjs';
const D = process.argv[2];
const png = fs.readFileSync(D + '/fake-gemini.png').toString('base64');
const jpg = fs.readFileSync('/home/user/lagi-ar/public/products/plano-bag/images/main.jpg');
let mode = 'ok', attempts = 0;
globalThis.fetch = async (url) => {
  url = String(url);
  if (url.includes('generativelanguage')) {
    attempts++;
    if (mode === 'e503') return new Response('{"error":"busy"}', { status: 503 });
    if (mode === 'text') return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'words' }] } }] }));
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png } }] } }] }));
  }
  if (url.includes('/products/')) return new Response(jpg, { headers: { 'Content-Type': 'image/jpeg' } });
  throw new Error('unexpected fetch ' + url);
};
const { default: w, QuotaCounter } = await import(D + '/worker.mjs');
const O = 'https://ewq122334455-tech.github.io';
const person = 'data:image/jpeg;base64,' + jpg.toString('base64');
const ok = (n, c, i = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${i ? '  — ' + i : ''}`);
const q = makeQuotaNs(QuotaCounter);
const env = { GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm', ALLOWED_ORIGINS: O, TRYON_DAILY_UNITS_SITE: '50', TRYON_DAILY_UNITS_PER_IP: '50', QUOTA: q, ADMIN_TOKEN: 'secret-admin', TRYON_USD_PER_UNIT: '0.05' };
const post = (p) => w.fetch(new Request('https://w/', { method: 'POST', headers: { Origin: O, 'CF-Connecting-IP': '7.7.7.7', 'Content-Type': 'application/json' }, body: JSON.stringify({ person, productImage: `${O}/lagi-ar/products/plano-bag/images/main.jpg?${p}`, productName: 'p', style: 'held' }) }), env);
const usage = (tok) => w.fetch(new Request('https://w/admin/usage', { headers: { Origin: O, ...(tok ? { Authorization: 'Bearer ' + tok } : {}) } }), env);
await post('a');
mode = 'text'; await post('b');
mode = 'e503'; await post('c');
await new Promise((r) => setTimeout(r, 50));
ok('no token -> 401', (await usage()).status === 401);
ok('wrong token -> 401', (await usage('nope')).status === 401);
const u = await (await usage('secret-admin')).json();
const g = u.gemini;
console.log(JSON.stringify(g));
ok('reserved units equal the attempts that left the Worker', g.unitsReserved === attempts, `${g.unitsReserved} vs ${attempts}`);
ok('outcomes recorded (http_ok / http_503 / no_image)', g.outcomes.http_ok > 0 && g.outcomes.http_503 > 0 && g.outcomes.no_image > 0, JSON.stringify(g.outcomes));
const o = g.outcomes;
ok('http outcomes add up to attempts', o.http_ok + o.http_429 + o.http_500 + o.http_503 + o.http_400 + o.http_403 + o.network_error === attempts);
ok('estimated USD = units x configured price', Math.abs(g.estimatedUsd - Number((attempts * 0.05).toFixed(2))) < 0.011, `$${g.estimatedUsd}`);
ok('realtime scope is separate (0 reserved)', u.realtime.sessionsReserved === 0);
ok('note says it is not a bill', /real bill/i.test(u.note));
ok('no secret in the response', !JSON.stringify(u).includes('secret-admin'));
mode = 'ok';
env.QUOTA = { ...q, get: (id) => { const s = q.get(id); return { fetch: (url, init) => (String(url).endsWith('/record') ? Promise.reject(new Error('x')) : s.fetch(url, init)) }; } };
ok('a broken ledger never blocks a call', (await post('d')).status === 200);
