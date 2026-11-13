// Real workerd + real Durable Object + LOCAL mock Gemini (a node http server). No call leaves this machine.
// node run.mjs <wrangler binary> <fake-gemini.png>
import http from 'node:http'; import fs from 'node:fs'; import { spawn } from 'node:child_process'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const [WR, PNG] = process.argv.slice(2);
const png = fs.readFileSync(PNG).toString('base64');
const jpg = fs.readFileSync('/home/user/lagi-ar/public/products/plano-bag/images/main.jpg');
let hits = 0;
const mock = http.createServer((req, res) => {
  if (req.url.includes(':generateContent')) {
    hits++; let body = ''; req.on('data', (d) => (body += d));
    req.on('end', () => { const wantsImage = /responseModalities/.test(body); setTimeout(() => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ candidates: [{ content: { parts: [wantsImage ? { inlineData: { mimeType: 'image/png', data: png } } : { text: 'A mock product description.' }] } }] })); }, 30); });
    return;
  }
  if (req.url.startsWith('/lagi-ar/products/')) {
    const f = '/home/user/lagi-ar/public/' + decodeURIComponent(req.url.split('?')[0].replace('/lagi-ar/', ''));
    if (fs.existsSync(f) && fs.statSync(f).isFile()) { res.writeHead(200, { 'Content-Type': f.endsWith('.json') ? 'application/json' : f.endsWith('.png') ? 'image/png' : 'image/jpeg' }); return res.end(fs.readFileSync(f)); }
    res.writeHead(200, { 'Content-Type': 'image/jpeg' }); return res.end(jpg);
  }
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
  for (let rep = 1; rep <= (process.env.ONLY === 'pre' ? 0 : 5); rep++) {
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
  // one request = several attempts: new products cost 2 units each (cut-out + fitting), so a cap of 5 serves exactly 2 requests, then the 3rd gets the 5th unit for its cut-out and is refused at the fitting
  if (process.env.ONLY !== 'pre') { const state = `/tmp/wr/state-seq-${Date.now()}`; await start(state); hits = 0; const seq = []; for (let i = 0; i < 4; i++) seq.push((await post('10.99.0.1', `plano-bag/images/main.jpg?seq=${i}`)).status);
    ok('sequential new-product requests, cap 5 units: statuses 200,200,429,429 and exactly 5 Gemini attempts', JSON.stringify(seq) === '[200,200,429,429]' && hits === 5, `statuses ${JSON.stringify(seq)}, ${hits} attempts`); await stop(); }
  // pre-generation: first run makes the cut-outs (paid in production, mock here), the second run is all cache hits
  { const state = `/tmp/wr/state-pre-${Date.now()}`; await start(state);
    const run = () => new Promise((resolve) => { const c = spawn('node', ['/home/user/lagi-ar/scripts/pregenerate-cutouts.mjs', '--worker', `http://127.0.0.1:${PORT}`, '--site', 'http://127.0.0.1:9911/lagi-ar/', '--products', 'plano-bag,daily-tote', '--yes', '--max-usd', '5', '--out', '/tmp/wr/pre-out.json'], { env: { ...process.env, LAGI_AB_CONFIRM_PAID: 'yes' } }); let stdout = ''; c.stdout.on('data', (d) => (stdout += d)); c.on('close', () => resolve({ stdout })); });
    hits = 0; const r1 = await run(); const first = hits;
    hits = 0; const r2 = await run(); const second = hits;
    ok('pre-generation, 1st run: both products get a cut-out (2 cut-out attempts + 2 text calls)', /2\/2 cut-outs ready/.test(r1.stdout) && first === 4, `${first} Gemini calls; ${(r1.stdout.match(/\d\/\d cut-outs ready/) || [''])[0]}`);
    ok('pre-generation, 2nd run: everything is a cache hit — 0 Gemini calls', /2\/2 cut-outs ready/.test(r2.stdout) && second === 0, `${second} Gemini calls`);
    await stop(); }
  for (const r of results) ok(`burst ${r.rep}: 48 simultaneous requests, cap 5 units → Gemini attempts ≤ 5`, r.attempts <= 5, `${r.attempts} attempts; ${r.served} fully served, ${r.refused429} refused (429), other ${JSON.stringify(r.other)}`);
} finally { await stop(); mock.close(); }
