// Real workerd + real Durable Object + LOCAL mock Gemini (a node http server). No call leaves this machine.
// node run.mjs <wrangler binary> <fake-gemini.png>
import http from 'node:http'; import fs from 'node:fs'; import { spawn } from 'node:child_process'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const [WR, PNG] = process.argv.slice(2);
const png = fs.readFileSync(PNG).toString('base64');
const jpg = fs.readFileSync('/home/user/lagi-ar/public/products/plano-bag/images/main.jpg');
let hits = 0;
const mock = http.createServer((req, res) => {
  if (req.url.includes(':generateContent')) { hits++; setTimeout(() => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png } }] } }] })); }, 30); req.resume(); return; }
  if (req.url.startsWith('/lagi-ar/products/')) { res.writeHead(200, { 'Content-Type': 'image/jpeg' }); return res.end(jpg); }
  res.writeHead(404); res.end();
});
await new Promise((r) => mock.listen(9911, '127.0.0.1', r));
const ok = (n, c, i = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${i ? '  — ' + i : ''}`);
const person = 'data:image/jpeg;base64,' + jpg.toString('base64');
const PORT = 8798;
let dev = null;
async function start(state) {
  dev = spawn(WR, ['dev', '--local', '--port', String(PORT), '--ip', '127.0.0.1', '--persist-to', state], { cwd: here, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
  for (let i = 0; i < 90; i++) { await new Promise((r) => setTimeout(r, 1000)); if (/Ready on/.test(log)) { await new Promise((r) => setTimeout(r, 1500)); return; } }
  throw new Error('wrangler did not start:\n' + log.slice(-600));
}
const stop = async () => { dev?.kill('SIGTERM'); await new Promise((r) => setTimeout(r, 1500)); dev?.kill('SIGKILL'); };
const post = (ip, product) => fetch(`http://127.0.0.1:${PORT}/`, { method: 'POST', headers: { Origin: 'http://127.0.0.1:9911', 'CF-Connecting-IP': ip, 'Content-Type': 'application/json' }, body: JSON.stringify({ person, productImage: `http://127.0.0.1:9911/lagi-ar/products/${product}`, productName: 'p', style: 'held' }) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const burst = (k, tag, productFor = (i) => `plano-bag/images/main.jpg?u=${tag}${i}`) => Promise.all(Array.from({ length: k }, (_, i) => post(`10.${tag}.${i % 250}.1`, productFor(i))));
const results = [];
try {
  // repeated bursts, each on a clean state (cap 5 units per day)
  for (let rep = 1; rep <= 5; rep++) {
    const state = `/tmp/wr/state-${rep}-${Date.now()}`; fs.rmSync(state, { recursive: true, force: true }); await start(state); hits = 0;
    const res = await burst(48, `${rep}`);
    results.push({ rep, attempts: hits, served: res.filter((r) => r.status === 200).length, refused429: res.filter((r) => r.status === 429).length, other: res.filter((r) => ![200, 429].includes(r.status)).map((r) => r.status) });
    if (rep === 1) {
      // same day, budget used up: nothing may go out
      hits = 0; const again = await burst(20, 'again'); ok('budget spent: 20 more simultaneous requests → 0 Gemini attempts', hits === 0, `${hits} attempts, statuses ${[...new Set(again.map((r) => r.status))]}`);
      // server restart: the Durable Object state survives
      await stop(); await start(state); hits = 0; const afterRestart = await burst(10, 'restart');
      ok('after a server restart the spent budget is remembered: 0 attempts', hits === 0, `${hits} attempts, statuses ${[...new Set(afterRestart.map((r) => r.status))]}`);
    }
    await stop();
  }
  for (const r of results) ok(`burst ${r.rep}: 48 simultaneous requests, cap 5 units → Gemini attempts ≤ 5`, r.attempts <= 5, `${r.attempts} attempts; ${r.served} fully served, ${r.refused429} refused (429), other ${JSON.stringify(r.other)}`);
} finally { await stop(); mock.close(); }
