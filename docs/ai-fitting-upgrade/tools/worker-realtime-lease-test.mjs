// Realtime concurrency lease + token constraints. Mock Decart; NO real call. Usage: node … <dir with worker.mjs>
import { makeQuotaNs } from './quota-mock.mjs';
const D = process.argv[2];
let minted = [], decartStatus = 200;
globalThis.fetch = async (url, init) => { if (String(url) === 'https://api.decart.ai/v1/client/tokens') { if (decartStatus !== 200) return new Response('{"e":1}', { status: decartStatus }); minted.push(JSON.parse(init.body)); return new Response(JSON.stringify({ apiKey: 'eyJ.fake.token', expiresAt: 'x' })); } throw new Error('unexpected ' + url); };
const { default: w, QuotaCounter } = await import(D + '/worker.mjs');
const O = 'https://ewq122334455-tech.github.io';
const ok = (n, c, i = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${i ? '  — ' + i : ''}`);
const req = (ip) => new Request('https://w/realtime/token', { method: 'POST', headers: { Origin: O, 'CF-Connecting-IP': ip, 'Content-Type': 'application/json' }, body: '{}' });
const mk = (extra = {}) => ({ GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm', ALLOWED_ORIGINS: O, DECART_API_KEY: 'dct', QUOTA: makeQuotaNs(QuotaCounter), REALTIME_DAILY_SESSIONS: '50', ...extra });
const code = async (r) => { const j = await r.json(); return `${r.status}/${j.reason ?? 'ok'}`; };
const realNow = Date.now; let offset = 0; Date.now = () => realNow() + offset;

{ const env = mk(); minted = [];
  ok('1 first session for a visitor gets a token', (await code(await w.fetch(req('1.1.1.1'), env))) === '200/ok');
  ok('2 a second session from the same visitor while the first is open is refused (busy_ip), no token', (await code(await w.fetch(req('1.1.1.1'), env))) === '429/busy_ip' && minted.length === 1);
  offset = 60_000;
  ok('3 after the lease expires (session + margin) the visitor can start again', (await code(await w.fetch(req('1.1.1.1'), env))) === '200/ok'); offset = 0; }
{ const env = mk({ REALTIME_MAX_CONCURRENT: '2' }); minted = [];
  const r = await Promise.all(['2.1.1.1', '2.1.1.2', '2.1.1.3', '2.1.1.4'].map((ip) => w.fetch(req(ip), env)));
  const codes = await Promise.all(r.map(code));
  ok('4 site-wide: only 2 sessions may be open at once (4 simultaneous requests)', minted.length === 2 && codes.filter((c) => c === '429/busy_site').length === 2, codes.join(' ')); }
{ const env = mk({ REALTIME_DAILY_SESSIONS: '1' }); minted = [];
  await w.fetch(req('3.1.1.1'), env); offset = 60_000;
  ok('5 daily cap still applies after the lease', (await code(await w.fetch(req('3.1.1.2'), env))) === '429/site_limit' && minted.length === 1);
  offset = 0; }
{ const env = mk(); minted = []; decartStatus = 502;
  ok('6 provider failure → 502 and the lease is released (the visitor can retry at once)', (await code(await w.fetch(req('4.1.1.1'), env))) === '502/provider');
  decartStatus = 200; ok('6b retry right after works', (await code(await w.fetch(req('4.1.1.1'), env))) === '200/ok'); }
{ const env = mk({ QUOTA: { idFromName: (n) => n, get: () => ({ fetch: () => Promise.reject(new Error('down')) }) } }); minted = [];
  ok('7 counter down → no token (fail closed)', (await code(await w.fetch(req('5.1.1.1'), env))) === '503/quota_unavailable' && minted.length === 0); }
{ const env = mk(); minted = []; await w.fetch(req('6.1.1.1'), env); const t = minted[0];
  ok('8 token request: 20 s session cap, single model, our origins only, short expiry', t.constraints.realtime.maxSessionDuration === 20 && t.allowedModels.length === 1 && t.allowedModels[0] === 'lucy-2.6' && t.allowedOrigins.every((o) => o.startsWith('https://')) && t.expiresIn <= 30, JSON.stringify({ exp: t.expiresIn, max: t.constraints.realtime.maxSessionDuration })); }
{ const env = mk({ REALTIME_DISABLED: '1' }); minted = [];
  ok('9 kill switch REALTIME_DISABLED=1: no token, reason "disabled"', (await code(await w.fetch(req('7.1.1.1'), env))) === '503/disabled' && minted.length === 0); }
Date.now = realNow;
