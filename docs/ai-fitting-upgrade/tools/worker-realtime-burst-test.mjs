// Realtime (Decart) token minting under a simultaneous burst. Mock Decart; NO real call. Usage: node … <dir with worker.mjs>
const D = process.argv[2];
let minted = 0;
globalThis.fetch = async (url) => { if (String(url) === 'https://api.decart.ai/v1/client/tokens') { minted++; return new Response(JSON.stringify({ apiKey: 'eyJ.fake.token', expiresAt: 'x' })); } throw new Error('unexpected ' + url); };
const { default: w, QuotaCounter } = await import(D + '/worker.mjs');
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const O = 'https://ewq122334455-tech.github.io';
const kvm = () => { const m = new Map(); return { get: async (k) => { await delay(5); return m.get(k) ?? null; }, put: async (k, v) => { await delay(5); m.set(k, v); }, delete: async () => {}, list: async () => ({ keys: [], list_complete: true }) }; };
function makeQuota() { const store = new Map(); let chain = Promise.resolve(); const inst = new QuotaCounter({ storage: { get: async (k) => { await delay(2); return store.get(k); }, put: async (e) => { await delay(2); for (const [k, v] of Object.entries(e)) store.set(k, v); } } }); return { idFromName: (n) => n, get: () => ({ fetch: (u, init) => (chain = chain.then(() => inst.fetch(new Request(u, init)))) }) }; }
const req = (ip) => new Request('https://w/realtime/token', { method: 'POST', headers: { Origin: O, 'CF-Connecting-IP': ip, 'Content-Type': 'application/json' }, body: '{}' });
const ok = (n, c, i = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${i ? '  — ' + i : ''}`);
const run = async (extra) => { minted = 0; const env = { GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm', ALLOWED_ORIGINS: O, DECART_API_KEY: 'dct', MEDIA: kvm(), REALTIME_DAILY_SESSIONS: '5', ...extra }; const res = await Promise.all(Array.from({ length: 40 }, (_, i) => w.fetch(req(`10.7.${i}.1`), env))); return { minted, served: res.filter((r) => r.status === 200).length }; };
const a = await run({}); ok('Decart tokens: no counter bound → no token (fail closed; the old KV counter let all 40 through)', a.minted === 0, `${a.minted} tokens minted`);
const b = await run({ QUOTA: makeQuota() }); ok('Decart tokens: same burst with the Durable Object counter', b.minted <= 5, `${b.minted} tokens minted (cap 5)`);
const c = await run({ QUOTA: { idFromName: (n) => n, get: () => ({ fetch: () => Promise.reject(new Error('down')) }) } }); ok('Decart tokens: counter down → no token (fail closed)', c.minted === 0, `${c.minted} tokens`);
