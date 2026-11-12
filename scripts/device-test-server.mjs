#!/usr/bin/env node
/**
 * A small, access-limited server for testing a BUILT copy of the site on a phone (camera needs HTTPS).
 * It never touches production and never publishes anything by itself.
 *
 *   npm run build
 *   node scripts/device-test-server.mjs --minutes 60                 # HTTP on this machine only (127.0.0.1)
 *   node scripts/device-test-server.mjs --lan --https --minutes 60   # LAN + self-signed HTTPS (phone on the same Wi-Fi)
 *
 * Limits (all on by default):
 *  - a random access key is required (`?k=<key>` once, then a cookie); anything without it gets 403;
 *  - the server stops by itself after --minutes (default 60);
 *  - binds to 127.0.0.1 unless you pass --lan;
 *  - serves only ./dist (no directory listing, no dotfiles), plus POST /__bench-upload which saves a bench result
 *    to ./bench-results/ (size-limited, JSON only, key required);
 *  - the Worker (AI, payments) allows only the real site's origin, so AI calls from this test origin are refused by CORS:
 *    nothing can be spent from here.
 *
 * To reach it from a phone off your network you need your own HTTPS tunnel in front of it (e.g. a tunnel you run
 * yourself); that is outside this script and is a decision for the person who owns the account.
 */
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const flag = (k) => process.argv.includes('--' + k);
const ROOT = path.resolve(arg('root', 'dist'));
const PORT = Number(arg('port', '8443'));
const MINUTES = Number(arg('minutes', '60'));
const LAN = flag('lan');
const KEY = arg('key', crypto.randomBytes(12).toString('hex'));
const OUT = path.resolve(arg('out', 'bench-results'));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.wasm': 'application/wasm', '.task': 'application/octet-stream', '.mp4': 'video/mp4', '.glb': 'model/gltf-binary', '.ico': 'image/x-icon', '.txt': 'text/plain' };

if (!fs.existsSync(path.join(ROOT, 'index.html'))) { console.error(`No build at ${ROOT}. Run "npm run build" first.`); process.exit(2); }

const cookieKey = (req) => /(?:^|;\s*)lagi_dt=([a-f0-9]+)/.exec(req.headers.cookie ?? '')?.[1];
const handler = (req, res) => {
  const url = new URL(req.url, 'http://x');
  const given = url.searchParams.get('k') ?? cookieKey(req);
  const same = given && given.length === KEY.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(KEY));
  if (!same) { res.writeHead(403, { 'Content-Type': 'text/plain' }); return res.end('403'); }
  const headers = { 'Set-Cookie': `lagi_dt=${KEY}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MINUTES * 60}`, 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'no-referrer' };
  if (req.method === 'POST' && url.pathname === '/__bench-upload') {
    let n = 0; const chunks = [];
    req.on('data', (c) => { n += c.length; if (n > 2_000_000) req.destroy(); else chunks.push(c); });
    req.on('end', () => {
      try {
        const j = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (typeof j !== 'object' || !j?.meta) throw new Error('not a bench result');
        fs.mkdirSync(OUT, { recursive: true });
        const name = `bench-${String(j.meta.label ?? 'run').replace(/\W+/g, '-')}-${Date.now()}.json`;
        fs.writeFileSync(path.join(OUT, name), JSON.stringify(j, null, 1));
        console.log('saved', path.join(OUT, name));
        res.writeHead(200, { ...headers, 'Content-Type': 'application/json' }); res.end('{"ok":true}');
      } catch { res.writeHead(400, headers); res.end('bad'); }
    });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, headers); return res.end(); }
  let rel = decodeURIComponent(url.pathname);
  if (rel.split('/').some((p) => p.startsWith('.'))) { res.writeHead(404, headers); return res.end(); }
  let file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403, headers); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) file = path.join(ROOT, 'index.html');
  res.writeHead(200, { ...headers, 'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
};

let server;
if (flag('https')) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lagi-dt-'));
  try { execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(dir, 'k.pem'), '-out', path.join(dir, 'c.pem'), '-days', '1', '-subj', '/CN=lagi-device-test'], { stdio: 'ignore' }); }
  catch { console.error('--https needs openssl (self-signed certificate).'); process.exit(2); }
  server = https.createServer({ key: fs.readFileSync(path.join(dir, 'k.pem')), cert: fs.readFileSync(path.join(dir, 'c.pem')) }, handler);
} else server = http.createServer(handler);

const host = LAN ? '0.0.0.0' : '127.0.0.1';
server.listen(PORT, host, () => {
  const scheme = flag('https') ? 'https' : 'http';
  const ips = LAN ? Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address) : ['127.0.0.1'];
  console.log(`Device test server (${MINUTES} min, key required). Open on the phone, then use the engine links in docs/ai-fitting-upgrade/DEVICE-TEST-PROCEDURE.md:`);
  for (const ip of ips) console.log(`  ${scheme}://${ip}:${PORT}/?k=${KEY}#/again?p=plano-bag&m=map&engine=v3&bench=1&dur=300&post=1&dev=<기기이름>`);
  if (flag('https')) console.log('  (self-signed certificate: the phone shows a warning once — accept it for this test only; iOS may need Settings > trust.)');
  console.log(`Results posted from the phone are saved in ${OUT}. Stops automatically at ${new Date(Date.now() + MINUTES * 60000).toLocaleTimeString()}. Ctrl+C to stop now.`);
});
setTimeout(() => { console.log('time is up — stopping'); process.exit(0); }, MINUTES * 60000).unref?.();
