import { chromium } from 'playwright-core';
import fs from 'node:fs';
const S = '/tmp/claude-0/-home-user-lagi-ar/fa4cf5bc-42af-5652-8686-a3b6f4e33b80/scratchpad/'.replace('b80/','b80/');
const R = '/tmp/claude-0/-home-user-lagi-ar/fa4cf5bc-42af-5652-8686-a3b6f4e33b80/scratchpad/';
const WASM = '/home/user/lagi-ar/node_modules/@mediapipe/tasks-vision/wasm/';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--enable-unsafe-swiftshader'] });
for (const video of ['fist3', 'fist3-pan', 'fist3-drop']) {
  const p = await b.newPage(); p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.route('http://det.test/**', (r) => {
    const u = r.request().url().replace('http://det.test', '');
    if (u === '/') return r.fulfill({ contentType: 'text/html', body: '<!doctype html><script src="/bundle.js"></script>' });
    if (u === '/bundle.js') return r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(R + 'aiq/detect-bundle.js') });
    if (u === '/hand.task') return r.fulfill({ body: fs.readFileSync(R + 'mp/hand_landmarker.task') });
    if (u.startsWith('/wasm/')) { const f = u.slice(6); return r.fulfill({ body: fs.readFileSync(WASM + f), contentType: f.endsWith('.wasm') ? 'application/wasm' : 'text/javascript' }); }
    if (u.startsWith('/frames/')) return r.fulfill({ body: fs.readFileSync(R + 'aiq' + u), contentType: 'image/jpeg' });
    return r.fulfill({ status: 404, body: '' });
  });
  await p.goto('http://det.test/'); await p.waitForFunction(() => window.ready);
  const t0 = Date.now();
  const series = await p.evaluate(([v, n]) => window.runDetect(v, n, '/hand.task', '/wasm'), [video, 180]);
  fs.writeFileSync(R + `aiq/series-${video}.json`, JSON.stringify(series));
  console.log(video, 'detected', series.filter((s) => s.ok).length, '/', series.length, 'in', ((Date.now() - t0) / 1000).toFixed(0), 's');
  await p.close();
}
await b.close();
