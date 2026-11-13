
import fs from 'node:fs';
import { OneEuro, OneEuroAngle, isHandJump, HAND_HOLD_MS } from '/home/user/lagi-ar/src/v3/fitFilter.ts';
const R = process.argv[2];
const handYawOf = (w, side, mirrored) => { const a = { x: w[5][0] - w[17][0], z: w[5][2] - w[17][2] }; const sign = side === 'Right' ? 1 : -1; const yaw = Math.atan2(-a.z * sign, a.x * sign); return mirrored ? -yaw : yaw; };
const easeAngle = (from, to, k) => { let d = to - from; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return from + d * k; };
const BONES = [[0, 5], [0, 9], [0, 13], [0, 17], [5, 9], [9, 13], [13, 17], [5, 6], [9, 10]];
const PRODUCT = { widthCm: 14, handleCm: 5 };
function measure(d, W, H) {
  const hl = d.hl, hw = d.hw; const pts = hl.map((q) => ({ x: W - q[0] * W, y: q[1] * H }));
  let pix = 0, met = 0; for (const [a, b] of BONES) { pix += Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y); met += Math.hypot(hw[a][0] - hw[b][0], hw[a][1] - hw[b][1]); }
  const scale = met > 0.01 ? pix / met / 100 : 0;
  const grip = { x: (pts[5].x + pts[17].x) / 2, y: (pts[5].y + pts[17].y) / 2 };
  const palm = Math.hypot(pts[5].x - pts[17].x, pts[5].y - pts[17].y);
  const place = (sc) => { const fistBottom = Math.max(...pts.map((q) => q.y)); const gx = [5, 9, 13, 17].reduce((a, i) => a + pts[i].x, 0) / 4; return { cx: gx, top: fistBottom - PRODUCT.handleCm * sc * 0.55, w: PRODUCT.widthCm * sc }; };
  return { grip, palm, scale, place, yaw: handYawOf(hw, d.side ?? 'Right', true) };
}
const smoothV1 = (prev, n, k = 0.4) => (prev ? { cx: prev.cx + (n.cx - prev.cx) * k, top: prev.top + (n.top - prev.top) * k, w: prev.w + (n.w - prev.w) * k } : n);
function run(series, engine, P) {
  const W = series[0].W, H = series[0].H, out = [];
  let di = -1, handYaw = 0, handScale = 0, grip = null, last = null, miss = 0, rawGrip = null, rejected = 0, placed = null, lastHandAt = -1e9;
  const fx = new OneEuro(P.v2c ?? 2.0, P.v2b ?? 0.008), fy = new OneEuro(P.v2c ?? 2.0, P.v2b ?? 0.008), fw = new OneEuro(0.8, 0.002), fyaw = new OneEuroAngle(1.5, 0.8);
  const tx = null, ty = null, tw = null;
  const rawTrace = []; let truth = [];
  const T = series[series.length - 1].t;
  for (let t = 0; t <= T; t += 1000 / 60) {
    let detected = false;
    while (di + 1 < series.length && series[di + 1].t <= t) {
      di++; const d = series[di];
      if (d.ok) {
        const m = measure(d, W, H);
        const jumped = engine !== 'v1' && isHandJump(rawGrip, m.grip, m.palm);
        if (jumped) { rejected++; miss++; }
        else {
          handYaw = engine !== 'v1' ? m.yaw : easeAngle(handYaw, m.yaw, 0.45);
          grip = m.grip; rawGrip = m.grip; last = m;
          if (m.scale > 0) handScale = engine !== 'v1' ? m.scale : handScale ? handScale + (m.scale - handScale) * 0.25 : m.scale;
          miss = 0; detected = true;
          
          rawTrace.push({ t: d.t, ...m.place(handScale || m.palm / 7.5) });
        }
      } else if (++miss > 8) { handScale = 0; grip = null; last = null; rawGrip = null; }
    }
    const fromHand = !!(grip && last);
    let vis = false, p = null, yaw = handYaw;
    if (fromHand) {
      const next = last.place(handScale || last.palm / 7.5);
      if (engine === 'v2') { p = { cx: fx.filter(next.cx, t), top: fy.filter(next.top, t), w: fw.filter(next.w, t) }; yaw = fyaw.filter(handYaw, t); }
      
      else p = smoothV1(placed, next);
      if (engine !== 'v1') lastHandAt = t;
      placed = p; vis = true;
    } else if (engine !== 'v1' && placed && t - lastHandAt < HAND_HOLD_MS) { p = placed; yaw = fyaw.filter(handYaw, t); vis = true; }
    out.push({ t, vis, ...(p ?? {}), yaw });
  }
  return { out, rawTrace, rejected };
}
const rms = (a) => Math.sqrt(a.reduce((x, y) => x + y * y, 0) / Math.max(1, a.length));
function metrics(out, rawTrace) {
  const v = out.filter((o) => o.vis);
  const step = [], acc = [], wacc = [], yacc = [], ystep = [];
  for (let i = 2; i < v.length; i++) {
    if (v[i].t - v[i - 2].t > 60) continue;
    step.push(Math.hypot(v[i].cx - v[i - 1].cx, v[i].top - v[i - 1].top)); ystep.push(Math.abs(v[i].yaw - v[i - 1].yaw));
    acc.push(Math.hypot(v[i].cx - 2 * v[i - 1].cx + v[i - 2].cx, v[i].top - 2 * v[i - 1].top + v[i - 2].top));
    wacc.push(v[i].w - 2 * v[i - 1].w + v[i - 2].w); yacc.push(v[i].yaw - 2 * v[i - 1].yaw + v[i - 2].yaw);
  }
  const raw = (t) => { let lo = 0; while (lo + 1 < rawTrace.length && rawTrace[lo + 1].t <= t) lo++; const a = rawTrace[lo], b = rawTrace[Math.min(lo + 1, rawTrace.length - 1)]; if (!a || t < a.t) return null; if (b.t - a.t > 150) return null; const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0; return { cx: a.cx + (b.cx - a.cx) * Math.min(1, f), top: a.top + (b.top - a.top) * Math.min(1, f) }; };
  let bestLag = 0, bestErr = 1e9, err0 = 0;
  for (let lag = 0; lag <= 400; lag += 17) { const e = []; for (const o of v) { const r = raw(o.t - lag); if (r) e.push(Math.hypot(o.cx - r.cx, o.top - r.top)); } const m = rms(e); if (lag === 0) err0 = m; if (m < bestErr) { bestErr = m; bestLag = lag; } }
  return { stepMean: step.reduce((a, b) => a + b, 0) / Math.max(1, step.length), accRms: rms(acc), wAccRms: rms(wacc), yawAccRms: rms(yacc), lagMs: bestLag, followErr0: err0 };
}
const P = { minC: 1.2, beta: 0.012, ahead: 90, ...(process.argv[3] ? JSON.parse(process.argv[3]) : {}) };
const res = {};
for (const video of ['fist3', 'fist3-pan', 'fist3-drop']) {
  const series = JSON.parse(fs.readFileSync(`${R}/aiq/series-${video}.json`));
  res[video] = {};
  for (const engine of ['v1', 'v2']) {
    const { out, rawTrace, rejected } = run(series, engine, P);
    const m = metrics(out, rawTrace);
    if (video === 'fist3-drop') {
      const vis = (a, b) => { const w = out.filter((o) => o.t >= a && o.t < b); return w.filter((o) => o.vis).length / w.length; };
      let gap = 0, maxGap = 0, snap = 0, prev = null;
      for (const o of out) { if (!o.vis) { gap += 1000 / 60; maxGap = Math.max(maxGap, gap); } else { if (gap > 0 && prev) snap = Math.max(snap, Math.hypot(o.cx - prev.cx, o.top - prev.top)); gap = 0; prev = o; } }
      Object.assign(m, { visLongDrop: vis(7000, 8000), maxGapMs: Math.round(maxGap), snapPx: snap });
    }
    res[video][engine] = m;
  }
}
fs.writeFileSync(`${R}/aiq/sim-results.json`, JSON.stringify({ P, res }, null, 1));
const f = (x) => (typeof x === 'number' ? (Math.abs(x) < 10 ? x.toFixed(3) : x.toFixed(1)) : x);
for (const video of Object.keys(res)) { console.log('\n==', video, '            V1       V2      V2b'); for (const k of Object.keys(res[video].v1)) console.log(k.padEnd(12), ...['v1','v2'].map((e) => String(f(res[video][e][k])).padStart(8))); }
