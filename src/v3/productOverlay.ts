/**
 * Image-mapped live try-on. The actual product photo (keyed from a green-background matte) is laid
 * over the visitor's own camera where the product should be, following the body with MediaPipe pose
 * tracking, so its shape and print never change. Runs entirely in the browser.
 */
import type { PoseLandmarker } from '@mediapipe/tasks-vision';

const MP_VERSION = '0.10.21';
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
const POSE_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

/** Product on a flat green background → canvas with that background transparent, cropped to the product. */
export async function keyMatte(dataUrl: string, max = 720): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * k);
  const h = Math.round(img.naturalHeight * k);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const im = ctx.getImageData(0, 0, w, h);
  const px = im.data;

  // Background colour: median of a few border samples (the model's "green" is rarely pure).
  const samples = [
    [2, 2],
    [w - 3, 2],
    [2, h - 3],
    [w - 3, h - 3],
    [w >> 1, 2],
    [2, h >> 1],
    [w - 3, h >> 1],
  ].map(([x, y]) => (y * w + x) * 4);
  const bg = [0, 1, 2].map((ch) => samples.map((i) => px[i + ch]).sort((a, b) => a - b)[samples.length >> 1]);
  const dist = (i: number) => Math.hypot(px[i] - bg[0], px[i + 1] - bg[1], px[i + 2] - bg[2]);
  const greenish = (i: number) => px[i + 1] - Math.max(px[i], px[i + 2]) > 12;

  // Background = green-ish pixels connected to the border, so prints inside the product never key out.
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const p = stack.pop()!;
    if (seen[p]) continue;
    const i = p * 4;
    if (dist(i) >= 80 || !greenish(i)) continue;
    seen[p] = 1;
    const x = p % w;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (p >= w) stack.push(p - w);
    if (p < w * (h - 1)) stack.push(p + w);
  }

  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    const d = dist(i);
    let a = 1;
    if (seen[p]) a = Math.min(1, Math.max(0, (d - 35) / 40));
    // Enclosed pockets of background (between handles) are near-identical to it.
    else if (d < 34 && greenish(i)) a = Math.min(1, Math.max(0, (d - 20) / 14));
    if (a < 1) {
      const m = Math.max(px[i], px[i + 2]);
      if (px[i + 1] > m) px[i + 1] = Math.round(px[i + 1] * a + m * (1 - a)); // remove green spill on edges
    }
    px[i + 3] = Math.round(a * 255);
    if (a > 0.5) {
      const x = p % w;
      const y = (p / w) | 0;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  ctx.putImageData(im, 0, 0);
  if (x1 < 0) return c;
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext('2d')!.drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

export async function loadPose(): Promise<PoseLandmarker> {
  const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
  const files = await FilesetResolver.forVisionTasks(WASM);
  const make = (delegate: 'GPU' | 'CPU') =>
    PoseLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: POSE_MODEL, delegate },
      runningMode: 'VIDEO',
      numPoses: 1,
      // The person mask lets the hand be drawn back over the handles it holds.
      outputSegmentationMasks: true,
    });
  try {
    return await make('GPU');
  } catch {
    return make('CPU');
  }
}

export type Pt = { x: number; y: number; visibility?: number };
/** Where the product sits, in video pixels: centre x, top y, width, and rotation (radians) about its top centre. */
export type Placement = { cx: number; top: number; w: number; rot: number };

const seen = (p: Pt | undefined) => !!p && (p.visibility ?? 1) > 0.5;
const clampRot = (r: number, max = 0.5) => Math.max(-max, Math.min(max, r));

/**
 * Place the product for a way of wearing it. `widthCm` is the product's real width (falls back to a
 * typical size); shoulder width (~38 cm) gives the scale; `size` is the visitor's own adjustment.
 * Landmarks are in video pixels as displayed (already mirrored for the front camera).
 */
export function placeFor(style: string, kind: 'bag' | 'acc', lm: Pt[], aspect: number, widthCm?: number, size = 1): Placement | null {
  const [ls, rs, le, re, lw, rw, lh, rh] = [11, 12, 13, 14, 15, 16, 23, 24].map((i) => lm[i]);
  if (!seen(ls) || !seen(rs)) return null;
  const shoulderW = Math.hypot(ls.x - rs.x, ls.y - rs.y);
  // Pixels per cm: shoulders (~38 cm) shrink when the visitor turns, so the torso (~50 cm from
  // shoulder line to hip line) is used too, whichever is larger.
  const hips = seen(lh) && seen(rh) ? { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 } : null;
  const torsoLen = hips ? Math.hypot(hips.x - (ls.x + rs.x) / 2, hips.y - (ls.y + rs.y) / 2) : 0;
  const pxPerCm = Math.max(shoulderW / 38, torsoLen / 50);
  const w = (widthCm ?? (kind === 'bag' ? 40 : 15)) * pxPerCm * size;
  const h = w / aspect;
  const midX = (ls.x + rs.x) / 2;
  // The side whose wrist is tracked (and lower, i.e. hanging) carries the product.
  const useRight = seen(rw) && (!seen(lw) || rw.y >= lw.y);
  const [s, e, wr, hp] = useRight ? [rs, re, rw, rh] : [ls, le, lw, lh];
  const out = Math.sign(s.x - midX) || 1; // away from the body
  const torso = seen(hp) ? hp.y - s.y : shoulderW * 1.4;
  const shoulderTilt = Math.atan2(rs.y - ls.y, rs.x - ls.x);
  const tilt = clampRot(useRight ? shoulderTilt : shoulderTilt - Math.PI * Math.sign(shoulderTilt || 1), 0.35);
  // A hanging bag swings a little with the forearm but stays mostly upright.
  const sway = seen(e) && seen(wr) ? clampRot((Math.atan2(wr.y - e.y, wr.x - e.x) - Math.PI / 2) * -0.25, 0.25) : 0;

  switch (kind === 'acc' ? `acc-${style}` : style) {
    case 'hand':
      if (!seen(wr)) return null;
      return { cx: wr.x, top: wr.y - 0.07 * h, w, rot: sway };
    case 'acc-hand':
      if (!seen(wr)) return null;
      return { cx: wr.x, top: wr.y - 0.35 * h, w, rot: sway };
    case 'acc-show':
      if (!seen(wr)) return null;
      return { cx: wr.x, top: wr.y - 0.85 * h, w, rot: 0 };
    case 'elbow':
      if (!seen(e)) return null;
      return { cx: e.x + out * 0.08 * w, top: e.y - 0.1 * h, w, rot: sway };
    case 'shoulder':
    case 'back':
      // Handles over the shoulder; a small bag on a strap hangs lower, its bottom ~45 cm below the shoulder.
      return { cx: s.x + out * 0.22 * w, top: s.y + Math.max(-0.06 * h, 45 * pxPerCm * size - h), w, rot: tilt * 0.6 };
    case 'cross':
      return { cx: (seen(hp) ? hp.x : s.x) + out * 0.12 * w, top: s.y + torso * 0.5, w, rot: tilt * 0.4 };
    case 'hug':
    case 'front':
      return { cx: midX, top: s.y + torso * 0.18, w, rot: tilt * 0.3 };
    case 'acc-clip':
    case 'acc-pocket':
      return { cx: seen(hp) ? hp.x : s.x, top: s.y + torso * 0.85, w, rot: 0 };
    case 'acc-table':
      return { cx: midX, top: s.y + torso * 1.25, w, rot: 0 };
    default:
      return { cx: s.x + out * 0.22 * w, top: s.y + Math.max(-0.06 * h, 45 * pxPerCm * size - h), w, rot: tilt * 0.6 };
  }
}

/** Ease towards the new placement so the overlay does not jitter with the tracker. */
export function smooth(prev: Placement | null, next: Placement, k = 0.4): Placement {
  if (!prev) return next;
  const m = (a: number, b: number) => a + (b - a) * k;
  return { cx: m(prev.cx, next.cx), top: m(prev.top, next.top), w: m(prev.w, next.w), rot: m(prev.rot, next.rot) };
}

/** Draw the product, rotated about its top centre, with a soft contact shadow. `map` turns video pixels into canvas pixels. */
export function paint(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, p: Placement, map: { s: number; ox: number; oy: number }) {
  const w = p.w * map.s;
  const h = w * (img.height / img.width);
  ctx.save();
  ctx.translate(p.cx * map.s + map.ox, p.top * map.s + map.oy);
  ctx.rotate(p.rot);
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = w * 0.06;
  ctx.shadowOffsetY = w * 0.03;
  ctx.drawImage(img, -w / 2, 0, w, h);
  ctx.restore();
}
