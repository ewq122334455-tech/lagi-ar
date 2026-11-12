// Swing (pendulum) on real tracked hand motion: still hand must not rock the bag; a moving one should lag and settle.
import fs from 'node:fs';
import { OneEuro, Swing } from '/home/user/lagi-ar/src/v3/fitFilter.ts';
const R = process.argv[2];
const meas = (d) => { const W = d.W; const hl = d.hl; return { x: W - (hl[5][0] + hl[17][0]) / 2 * W, palm: Math.hypot((hl[5][0] - hl[17][0]) * W, (hl[5][1] - hl[17][1]) * d.H) }; };
const out = [];
for (const [name, speed] of [['fist3', 1], ['fist3-pan', 1], ['fist3-pan', 4], ['fist3-pan', 8]]) {
  const series = JSON.parse(fs.readFileSync(`${R}/aiq/series-${name}.json`)).filter((d) => d.ok).map((d) => ({ ...d, t: d.t / speed }));
  const fx = new OneEuro(2.0, 0.008); const sw = new Swing(0.2);
  let di = -1, cur = null; const th = []; const T = series[series.length - 1].t;
  for (let t = 0; t <= T; t += 1000 / 60) {
    while (di + 1 < series.length && series[di + 1].t <= t) { di++; cur = meas(series[di]); }
    if (!cur) continue;
    const pxPerM = (cur.palm / 0.075); // knuckle line ≈ 7.5 cm
    th.push(sw.step(t, fx.filter(cur.x, t), pxPerM));
  }
  const deg = th.map((r) => (r * 180) / Math.PI);
  const rms = Math.sqrt(deg.reduce((a, b) => a + b * b, 0) / deg.length);
  const step = Math.max(...deg.slice(1).map((d, i) => Math.abs(d - deg[i])));
  out.push({ clip: name, speed, rmsDeg: +rms.toFixed(2), maxDeg: +Math.max(...deg.map(Math.abs)).toFixed(1), maxStepDegPerFrame: +step.toFixed(2) });
}
console.table(out);
fs.writeFileSync(`${R}/aiq/swing-test.json`, JSON.stringify(out, null, 1));
