// Realtime session controls in REAL workerd + a real Durable Object, against a LOCAL mock of Decart's token API. No call leaves this machine.
// node run-realtime.mjs <wrangler binary>
import http from 'node:http'; import fs from 'node:fs'; import { spawn } from 'node:child_process'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const WR = process.argv[2];
let minted = [], mode = 'ok';
const mock = http.createServer((req, res) => {
  if (req.url === '/v1/client/tokens' && req.method === 'POST') {
    let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => {
      setTimeout(() => { if (mode === 'fail') { res.writeHead(502); return res.end('{}'); } minted.push(JSON.parse(b)); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ apiKey: 'eyJ.mock.token', expiresAt: 'x' })); }, 20);
    }); return;
  }
  res.writeHead(404); res.end();
});
await new Promise((r) => mock.listen(9912, '127.0.0.1', r));
const ok = (n, c, i = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${i ? '  — ' + i : ''}`);
const PORT = 8799; let dev = null;
async function start(state) {
  dev = spawn(WR, ['dev', '-c', 'wrangler-rt.toml', '--local', '--port', String(PORT), '--ip', '127.0.0.1', '--persist-to', state], { cwd: here, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
  for (let i = 0; i < 90; i++) { await new Promise((r) => setTimeout(r, 1000)); if (/Ready on/.test(log)) { await new Promise((r) => setTimeout(r, 1500)); return; } }
  throw new Error('wrangler did not start:\n' + log.slice(-600));
}
const stop = async () => { dev?.kill('SIGTERM'); await new Promise((r) => setTimeout(r, 1500)); dev?.kill('SIGKILL'); };
const H = (ip) => ({ Origin: 'http://127.0.0.1:9912', 'CF-Connecting-IP': ip, 'Content-Type': 'application/json' });
const tok = (ip) => fetch(`http://127.0.0.1:${PORT}/realtime/token`, { method: 'POST', headers: H(ip), body: '{}' }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const rep = (ip, body) => fetch(`http://127.0.0.1:${PORT}/realtime/report`, { method: 'POST', headers: H(ip), body: JSON.stringify(body) }).then((r) => r.status);
const usage = () => fetch(`http://127.0.0.1:${PORT}/admin/usage`, { headers: { Origin: 'http://127.0.0.1:9912', Authorization: 'Bearer local-admin-token' } }).then((r) => r.json());
const state = `/tmp/wr/state-rt-${Date.now()}`; fs.rmSync(state, { recursive: true, force: true });
try {
  await start(state);
  // 1. burst from 30 different visitors at once
  minted = []; const burst = await Promise.all(Array.from({ length: 30 }, (_, i) => tok(`10.8.${i}.1`)));
  ok('1 30 simultaneous visitors: at most 3 tokens minted (site-wide open-session ceiling), the rest 429 busy_site', minted.length === 3 && burst.filter((r) => r.body.reason === 'busy_site').length === 27, `${minted.length} minted; ${burst.filter((r) => r.status === 200).length} served`);
  ok('2 token request: 20 s cap, one model, 20 s expiry', minted.every((m) => m.constraints.realtime.maxSessionDuration === 20 && m.allowedModels.length === 1 && m.allowedModels[0] === 'lucy-2.6' && m.expiresIn === 20));
  ok('3 response carries the chosen model and seconds', burst.find((r) => r.status === 200).body.model === 'lucy-2.6' && burst.find((r) => r.status === 200).body.seconds === 20);
  // 2. the same visitor again
  const first = burst.find((r) => r.status === 200); void first;
  const again = await tok('10.8.0.1'); const winner = burst.findIndex((r) => r.status === 200);
  const again2 = await tok(`10.8.${winner}.1`);
  ok('4 same visitor while their session is open → 429 busy_ip', again2.body.reason === 'busy_ip' || again2.body.reason === 'busy_site', again2.body.reason);
  // 3. restart: leases live in the Durable Object, not in memory
  await stop(); await start(state); minted = [];
  const afterRestart = await tok(`10.8.${winner}.1`);
  ok('5 after a Worker restart the visitor\'s open session is still remembered (no new token)', afterRestart.status === 429 && minted.length === 0, `${afterRestart.status} ${afterRestart.body.reason}`);
  // 4. page reports are advisory and capped
  ok('6 usage report accepted', (await rep('10.8.0.1', { seconds: 12.5, ok: true })) === 200);
  await rep('10.8.0.2', { seconds: 9999, ok: true }); await rep('10.8.0.3', { seconds: -5, ok: false });
  await new Promise((r) => setTimeout(r, 500));
  let u = await usage(); const rt = u.realtime;
  ok('7 /admin/usage: tokens counted, reserved seconds = tokens × 20', rt.tokens === 3 && rt.reservedSeconds === 60, JSON.stringify({ tokens: rt.tokens, reserved: rt.reservedSeconds }));
  ok('8 reported seconds are capped per report (12.5 + 20 + 0), and reports never free a lease', rt.reportedByPagesSeconds === 32.5 && (await tok(`10.8.${winner}.1`)).status === 429, String(rt.reportedByPagesSeconds));
  ok('9 caveat is stated (server cannot see the real connection)', /cannot see the real WebRTC connection/.test(rt.caveat));
  // 5. leases expire by themselves (35 s); THEN the provider-failure path on a clean site
  console.log('…waiting 37 s for the leases to expire by themselves');
  await new Promise((r) => setTimeout(r, 37000));
  const later = await tok(`10.8.${winner}.1`);
  ok('10 a session that was never reported finished (killed tab) expires by itself after ~35 s: the visitor can start again', later.status === 200, `${later.status} ${later.body.reason ?? ''}`);
  mode = 'fail'; const fail = await tok('10.9.0.1'); mode = 'ok';
  ok('11 provider failure → 502 with the reservation released: the same visitor retries at once and gets a token', fail.status === 502 && (await tok('10.9.0.1')).status === 200, `${fail.status}/${fail.body.reason}`);
} finally { await stop(); mock.close(); }
