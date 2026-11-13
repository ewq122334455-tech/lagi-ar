
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
// ---- Sync study: how far is the drawn bag from where the hand really is in the frame on screen? ----
// Truth = the recorded clip's own tracker output at the shown frame's time (interpolated). Variants differ only in how
// the pose is produced from the detections that have arrived by then (detection runs every `every`-th sample).
const rms = (a) => Math.sqrt(a.reduce((x, y) => x + y * y, 0) / Math.max(1, a.length));
const load = (name, speed = 1) => JSON.parse(fs.readFileSync(`${R}/aiq/series-${name}.json`)).map((d) => ({ ...d, t: d.t / speed }));
function place(d) { const m = measure(d, d.W, d.H); const p = m.place(m.scale || m.palm / 7.5); return { cx: p.cx, top: p.top, palm: m.palm }; }
function study(name, speed, every, variant) {
  const all = load(name, speed).filter((d) => d.ok); const W = all[0].W;
  const truthPts = all.map((d) => ({ t: d.t, ...place(d) }));
  const truth = (t) => { let lo = 0; while (lo + 1 < truthPts.length && truthPts[lo + 1].t <= t) lo++; const a = truthPts[lo], b = truthPts[Math.min(lo + 1, truthPts.length - 1)]; const f = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0; return { cx: a.cx + (b.cx - a.cx) * f, top: a.top + (b.top - a.top) * f }; };
  const dets = truthPts.filter((_, i) => i % every === 0);
  const fx = new OneEuro(2.0, 0.008), fy = new OneEuro(2.0, 0.008);
  let di = -1, last = null, prev = null, v = { x: 0, y: 0 };
  const err = [], acc = [], out = []; const T = dets[dets.length - 1].t; const palm = truthPts[0].palm;
  for (let t = 0; t <= T; t += 1000 / 60) {
    while (di + 1 < dets.length && dets[di + 1].t <= t) {
      di++; prev = last; last = dets[di];
      if (prev) { const dt = (last.t - prev.t) / 1000; const nv = { x: (last.cx - prev.cx) / dt, y: (last.top - prev.top) / dt }; v = { x: v.x * 0.5 + nv.x * 0.5, y: v.y * 0.5 + nv.y * 0.5 }; }
    }
    if (!last) continue;
    let x = fx.filter(last.cx, t), y = fy.filter(last.top, t);
    if (variant.lead !== undefined) {
      const age = (t - last.t + variant.lead) / 1000; // time since the detection + fixed extra lead
      const sp = Math.hypot(v.x, v.y) / palm; // palm widths per second
      const gate = Math.min(1, Math.max(0, (sp - 0.3) / 0.7)); // no lead for a (nearly) still hand
      let dx = v.x * age * gate, dy = v.y * age * gate; const mag = Math.hypot(dx, dy), cap = palm * 0.6; if (mag > cap) { dx *= cap / mag; dy *= cap / mag; }
      x += dx; y += dy;
    }
    const tr = truth(t); err.push(Math.hypot(x - tr.cx, y - tr.top) / palm); out.push({ x, y });
  }
  for (let i = 2; i < out.length; i++) acc.push(Math.hypot(out[i].x - 2 * out[i - 1].x + out[i - 2].x, out[i].y - 2 * out[i - 1].y + out[i - 2].y));
  const s = [...err].sort((a, b) => a - b);
  return { meanErrPalm: +(err.reduce((a, b) => a + b, 0) / err.length).toFixed(3), p95ErrPalm: +s[Math.floor(s.length * 0.95)].toFixed(3), accRmsPx: +rms(acc).toFixed(2) };
}
const rows = [];
const variants = { 'V3 (filter only)': {}, 'lead=age': { lead: 0 }, 'lead=age+40ms': { lead: 40 }, 'lead=age+80ms': { lead: 80 } };
for (const [clip, speed] of [['fist3', 1], ['fist3-pan', 1], ['fist3-pan', 4], ['fist3-pan', 8]])
  for (const every of [1, 2, 3]) for (const [vn, vv] of Object.entries(variants)) rows.push({ clip: `${clip}${speed > 1 ? ' x' + speed : ''}`, detHz: +(15 * speed / every).toFixed(1), variant: vn, ...study(clip, speed, every, vv) });
console.table(rows);
fs.writeFileSync(`${R}/aiq/sync-study.json`, JSON.stringify(rows, null, 1));
