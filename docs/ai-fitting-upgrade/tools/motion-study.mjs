
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
// ---- Motion study: several filter FAMILIES on the SAME recorded tracker output, compared on error AND smoothness ----
// Truth = the recorded clip's own tracker output at the shown frame's time (interpolated). Render at 60 Hz; detections every `every`-th sample.
const rms = (a) => Math.sqrt(a.reduce((x, y) => x + y * y, 0) / Math.max(1, a.length));
const load = (name, speed = 1) => JSON.parse(fs.readFileSync(`${R}/aiq/series-${name}.json`)).map((d) => ({ ...d, t: d.t / speed })).filter((d) => d.ok);
function place(d) { const m = measure(d, d.W, d.H); const p = m.place(m.scale || m.palm / 7.5); return { cx: p.cx, top: p.top, palm: m.palm }; }

// 1-D constant-velocity Kalman filter, updated only when a detection arrives, extrapolated in between
class KF1 {
  constructor(r, sigA, adapt = null, palm = 1) { this.r2 = r * r; this.q = sigA * sigA; this.x = null; this.adapt = adapt; this.palm = palm; }
  update(z, t) {
    if (!this.x) { this.x = [z, 0]; this.P = [[this.r2, 0], [0, 1e8]]; this.t = t; return; }
    const dt = Math.max(1e-3, (t - this.t) / 1000); this.t = t;
    const [p, v] = this.x; this.x = [p + v * dt, v];
    const P = this.P; let q = this.q;
    if (this.adapt) { const sp = Math.abs(this.x[1]) / this.palm; const sg = (this.adapt.base + this.adapt.gain * sp) * this.palm; q = sg * sg; }
    const P00 = P[0][0] + dt * (P[1][0] + P[0][1]) + dt * dt * P[1][1] + q * dt ** 4 / 4;
    const P01 = P[0][1] + dt * P[1][1] + q * dt ** 3 / 2;
    const P10 = P[1][0] + dt * P[1][1] + q * dt ** 3 / 2;
    const P11 = P[1][1] + q * dt * dt;
    const S = P00 + this.r2; const K0 = P00 / S, K1 = P10 / S; const y = z - this.x[0];
    this.x = [this.x[0] + K0 * y, this.x[1] + K1 * y];
    this.P = [[(1 - K0) * P00, (1 - K0) * P01], [P10 - K1 * P00, P11 - K1 * P01]];
  }
  at(t, maxLeadMs) { const lead = Math.min(maxLeadMs, t - this.t) / 1000; return this.x[0] + this.x[1] * Math.max(0, lead); }
}

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
function simulate(name, speed, every, variant, noisePx = 0) {
  const all = load(name, speed); const truthPts = all.map((d) => ({ t: d.t, ...place(d) }));
  const truth = (t) => { let lo = 0; while (lo + 1 < truthPts.length && truthPts[lo + 1].t <= t) lo++; const a = truthPts[lo], b = truthPts[Math.min(lo + 1, truthPts.length - 1)]; const f = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0; return { cx: a.cx + (b.cx - a.cx) * f, top: a.top + (b.top - a.top) * f }; };
  const rnd = rng(12345); const dets = truthPts.filter((_, i) => i % every === 0).map((d) => ({ ...d, cx: d.cx + (noisePx ? gauss(rnd) * noisePx : 0), top: d.top + (noisePx ? gauss(rnd) * noisePx : 0) })); const palm = truthPts[0].palm;
  const T = dets[dets.length - 1].t;
  let fx, fy, kx, ky, di = -1, last = null, prev = null, v = { x: 0, y: 0 };
  if (variant.oe) { fx = new OneEuro(variant.oe[0], variant.oe[1]); fy = new OneEuro(variant.oe[0], variant.oe[1]); }
  let ex = null, ey = null, xfPrev = null, vf = { x: 0, y: 0 }, xfLast = null;
  if (variant.oedet) { ex = new OneEuro(variant.oedet[0], variant.oedet[1]); ey = new OneEuro(variant.oedet[0], variant.oedet[1]); }
  if (variant.kf) { kx = new KF1(variant.kf.r, (variant.kf.sig ?? 0) * palm, variant.kf.adapt ?? null, palm); ky = new KF1(variant.kf.r, (variant.kf.sig ?? 0) * palm, variant.kf.adapt ?? null, palm); }
  const out = [], err = [], tru = [];
  for (let t = 0; t <= T; t += 1000 / 60) {
    while (di + 1 < dets.length && dets[di + 1].t <= t) {
      di++; prev = last; last = dets[di];
      if (prev) { const dt = (last.t - prev.t) / 1000; const nv = { x: (last.cx - prev.cx) / dt, y: (last.top - prev.top) / dt }; v = { x: v.x * 0.5 + nv.x * 0.5, y: v.y * 0.5 + nv.y * 0.5 }; }
      if (kx) { kx.update(last.cx, last.t); ky.update(last.top, last.t); }
      if (ex) { // filter only when a detection arrives, then move on at the filtered velocity until the next one
        const nx = ex.filter(last.cx, last.t), ny = ey.filter(last.top, last.t);
        if (xfLast && last.t > xfLast.t) { const dt = (last.t - xfLast.t) / 1000; vf = { x: vf.x * 0.5 + ((nx - xfLast.x) / dt) * 0.5, y: vf.y * 0.5 + ((ny - xfLast.y) / dt) * 0.5 }; }
        xfLast = { x: nx, y: ny, t: last.t };
      }
    }
    if (!last) continue;
    let x, y;
    if (ex) { const age = Math.min(variant.oedetLead ?? 130, t - xfLast.t) / 1000; const sp = Math.hypot(vf.x, vf.y) / palm; const gate = Math.min(1, Math.max(0, (sp - 0.3) / 0.7)); x = xfLast.x + vf.x * age * gate; y = xfLast.y + vf.y * age * gate; }
    else if (kx) { x = kx.at(t, variant.kf.maxLead); y = ky.at(t, variant.kf.maxLead); }
    else {
      x = fx.filter(last.cx, t); y = fy.filter(last.top, t);
      if (variant.lead) { const age = (t - last.t) / 1000 * variant.lead; const sp = Math.hypot(v.x, v.y) / palm; const gate = Math.min(1, Math.max(0, (sp - 0.3) / 0.7)); let dx = v.x * age * gate, dy = v.y * age * gate; const mag = Math.hypot(dx, dy), cap = palm * 0.6; if (mag > cap) { dx *= cap / mag; dy *= cap / mag; } x += dx; y += dy; }
    }
    const tr = truth(t); out.push({ t, x, y }); tru.push({ t, ...tr }); err.push(Math.hypot(x - tr.cx, y - tr.top) / palm);
  }
  const acc = [], jump = [], revErr = [], accEx = [], accTr = [];
  for (let i = 2; i < out.length; i++) { const ax = out[i].x - 2 * out[i - 1].x + out[i - 2].x, ay = out[i].y - 2 * out[i - 1].y + out[i - 2].y; const tx = tru[i].cx - 2 * tru[i - 1].cx + tru[i - 2].cx, ty = tru[i].top - 2 * tru[i - 1].top + tru[i - 2].top; acc.push(Math.hypot(ax, ay)); accTr.push(Math.hypot(tx, ty)); accEx.push(Math.hypot(ax - tx, ay - ty)); }
  for (let i = 1; i < out.length; i++) jump.push(Math.hypot((out[i].x - out[i - 1].x) - (tru[i].cx - tru[i - 1].cx), (out[i].y - out[i - 1].y) - (tru[i].top - tru[i - 1].top))); // movement the truth does not have
  // direction reversals of the truth (x): error in the 150 ms after
  for (let i = 6; i < tru.length - 12; i++) { const a = tru[i].cx - tru[i - 5].cx, b = tru[i + 5].cx - tru[i].cx; if (a * b < 0 && Math.abs(a) + Math.abs(b) > palm * 0.15) for (let k = 0; k < 9; k++) revErr.push(err[i + k]); }
  const s = [...err].sort((a, b) => a - b);
  return { err: err.reduce((a, b) => a + b, 0) / err.length, p95: s[Math.floor(s.length * 0.95)], acc: rms(acc), accEx: rms(accEx), accTr: rms(accTr), jump: Math.max(...jump), rev: revErr.length ? revErr.reduce((a, b) => a + b, 0) / revErr.length : NaN };
}
const scen = [['fist3-pan', 1, 1], ['fist3-pan', 1, 2], ['fist3-pan', 1, 3], ['fist3-pan', 4, 1], ['fist3-pan', 4, 2], ['fist3-pan', 4, 3], ['fist3-pan', 8, 1], ['fist3-pan', 8, 2]];
const agg = (variant, noise = 0) => { const r = scen.map(([c, s, e]) => simulate(c, s, e, variant, noise)); const m = (k) => r.reduce((a, x) => a + (Number.isNaN(x[k]) ? 0 : x[k]), 0) / r.length; const still = simulate('fist3', 1, 1, variant, noise); return { err: +m('err').toFixed(3), p95: +m('p95').toFixed(3), acc: +m('acc').toFixed(1), accEx: +m('accEx').toFixed(1), accTr: +m('accTr').toFixed(1), jump: +m('jump').toFixed(1), rev: +m('rev').toFixed(3), still: +still.acc.toFixed(3) }; };
const variants = [['V3  OneEuro(2.0,0.008)', { oe: [2.0, 0.008] }], ['V4  V3+lead(1.0)', { oe: [2.0, 0.008], lead: 1 }]];
for (const lead of [0.25, 0.5]) variants.push([`OneEuro+lead(${lead})`, { oe: [2.0, 0.008], lead }]);
for (const [mc, b] of [[4, 0.004], [1, 0.02], [2, 0.02], [4, 0.02], [2, 0.08], [4, 0.08]]) variants.push([`OneEuro(${mc},${b})`, { oe: [mc, b] }]);
for (const [mc, b] of [[2, 0.008], [4, 0.008], [2, 0.02], [4, 0.02]]) variants.push([`OneEuro@detection + glide(${mc},${b})`, { oedet: [mc, b] }]);
for (const sig of [10, 30, 100]) variants.push([`KalmanCV σa=${sig} (fixed)`, { kf: { r: 1.5, sig, maxLead: 100 } }]);
for (const base of [1, 3]) for (const gain of [20, 60]) variants.push([`KalmanCV adaptive σa=${base}+${gain}·speed`, { kf: { r: 1.5, adapt: { base, gain }, maxLead: 100 } }]);
const out2 = [];
for (const noise of [0, 2, 4]) for (const [n, v] of variants) out2.push({ noisePx: noise, variant: n, ...agg(v, noise) });
fs.writeFileSync(`${R}/aiq/motion-study.json`, JSON.stringify(out2, null, 1));
console.log(out2.length, 'rows');
