
import fs from 'node:fs';
import { OneEuro, OneEuroAngle, isHandJump, HAND_HOLD_MS, HoldPolicy } from '/home/user/lagi-ar/src/v3/fitFilter.ts';
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
  const tx = null, ty = null, tw = null; const pol = engine === 'v3' ? new HoldPolicy() : null; let lastFreshT = -1e9;
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
    let vis = false, p = null, yaw = handYaw; let alphaOut = 1;
    if (fromHand) {
      const next = last.place(handScale || last.palm / 7.5);
      if (engine === 'v2' || engine === 'v3') { p = { cx: fx.filter(next.cx, t), top: fy.filter(next.top, t), w: fw.filter(next.w, t) }; yaw = fyaw.filter(handYaw, t); }
      
      else p = smoothV1(placed, next);
      if (engine === 'v2') lastHandAt = t;
      placed = p; vis = true;
      if (pol) { if (detected) pol.fresh(t, p, last.palm); const s = pol.show(t, p); if (s) { p = { ...s.pose }; alphaOut = s.alpha; } else { vis = false; p = null; } }
    } else if (pol) { const s = pol.show(t, null); if (s) { p = s.pose; vis = true; alphaOut = s.alpha; } }
    else if (engine !== 'v1' && placed && t - lastHandAt < HAND_HOLD_MS) { p = placed; yaw = fyaw.filter(handYaw, t); vis = true; }
    out.push({ t, vis: vis && alphaOut > 0.5, ...(p ?? {}), yaw });
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
// ---- Loss study: is the V2 "visible during a gap" ratio real tracking or a stale pose? ----
// Ground truth = the same clip with no dropout (raw measured placement). We then blank a detection window
// and measure how far the displayed bag is from where the hand really is, and how far it snaps on recovery.
const P0 = {};
const base = (name, speed = 1) => JSON.parse(fs.readFileSync(`${R}/aiq/series-${name}.json`)).map((d) => ({ ...d, t: Math.round(d.t / speed) }));
const truthAt = (series, t) => { // placement the hand really has at time t (from the undropped clip)
  const W = series[0].W, H = series[0].H; let lo = 0; while (lo + 1 < series.length && series[lo + 1].t <= t) lo++;
  const m = measure(series[lo], W, H); return m.place(m.scale || m.palm / 7.5);
};
const blank = (series, a, b) => series.map((d) => (d.t >= a && d.t < b ? { ...d, ok: false } : d));
function study(name, speed, gapMs, starts) {
  const clean = base(name, speed); const rows = [];
  for (const engine of ['v1', 'v2', 'v3']) {
    let shown = 0, total = 0, errSum = 0, errMax = 0, snapMax = 0, staleShown = 0, wrongShown = 0, n = 0;
    for (const a of starts) {
      const b = a + gapMs; const { out } = run(blank(clean, a, b), engine, P0);
      const palm = measure(clean[0], clean[0].W, clean[0].H).palm;
      let prev = null, gap = false;
      for (const o of out) {
        const tr = truthAt(clean, o.t);
        if (o.t >= a && o.t < b + 400) {
          total++;
          if (o.vis) { shown++; const e = Math.hypot(o.cx - tr.cx, o.top - tr.top); errSum += e; n++; errMax = Math.max(errMax, e); if (e > palm * 0.5) wrongShown++; }
        }
        if (o.vis && prev && o.t - prev.t < 25 && o.t >= b && o.t < b + 400) snapMax = Math.max(snapMax, Math.hypot(o.cx - prev.cx, o.top - prev.top));
        prev = o.vis ? o : null;
      }
    }
    rows.push({ clip: name, speed, gapMs, engine, shownPct: +(100 * shown / total).toFixed(0), meanErrPx: +(errSum / Math.max(1, n)).toFixed(1), maxErrPx: +errMax.toFixed(0), wrongShownPct: +(100 * wrongShown / Math.max(1, shown)).toFixed(0), snapMaxPx: +snapMax.toFixed(0) });
  }
  return rows;
}
const all = [];
for (const [clip, speed, gaps] of [['fist3', 1, [300, 600, 1000]], ['fist3-pan', 1, [300, 600, 1000]], ['fist3-pan', 4, [150, 300, 600]], ['fist3-pan', 8, [100, 200, 300]]])
  for (const gap of gaps) { const dur = 11900 / speed; all.push(...study(clip, speed, gap, [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7].map((f) => Math.round(f * dur)))); }
console.table(all);
fs.writeFileSync(`${R}/aiq/loss-study.json`, JSON.stringify(all, null, 1));

// Trace of one scenario for the plot: pan clip, 600 ms blanked at 40 % of the clip.
{
  const clean = base('fist3-pan', 1); const a = Math.round(0.4 * 11900), b = a + 600; const tr = { gap: [a, b], truth: [], engines: {} };
  for (const engine of ['v1', 'v2', 'v3']) { const { out } = run(blank(clean, a, b), engine, P0); tr.engines[engine] = out.filter((o) => o.t >= a - 600 && o.t <= b + 900).map((o) => ({ t: Math.round(o.t), cx: o.vis ? +o.cx.toFixed(1) : null })); }
  for (let t = a - 600; t <= b + 900; t += 1000 / 60) tr.truth.push({ t: Math.round(t), cx: +truthAt(clean, t).cx.toFixed(1) });
  fs.writeFileSync(`${R}/aiq/loss-trace.json`, JSON.stringify(tr));
}
