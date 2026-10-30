/**
 * Real-product overlay for the live try-on. The realtime AI redraws the product every frame, so its
 * design drifts; this lays the actual product photo (keyed from a green-background matte) over the AI
 * video where the product should be, following the body with MediaPipe pose tracking.
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
    PoseLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: POSE_MODEL, delegate }, runningMode: 'VIDEO', numPoses: 1 });
  try {
    return await make('GPU');
  } catch {
    return make('CPU');
  }
}

type Pt = { x: number; y: number; visibility?: number };
/** Where the product sits, in video pixels: centre x, top y, width (height follows the image). */
export type Placement = { cx: number; top: number; w: number };

const seen = (p: Pt | undefined) => !!p && (p.visibility ?? 1) > 0.5;

/**
 * Place the product for a way of wearing it. `widthCm` is the product's real width (falls back to a
 * typical tote); shoulder width (~38 cm) gives the scale.
 */
export function placeFor(style: string, kind: 'bag' | 'acc', lm: Pt[], vw: number, vh: number, aspect: number, widthCm?: number): Placement | null {
  const P = (i: number) => ({ x: lm[i].x * vw, y: lm[i].y * vh, visibility: lm[i].visibility });
  const [ls, rs, le, re, lw, rw, lh, rh] = [11, 12, 13, 14, 15, 16, 23, 24].map(P);
  if (!seen(ls) || !seen(rs)) return null;
  const shoulderW = Math.hypot(ls.x - rs.x, ls.y - rs.y);
  const scale = Math.min(1.6, Math.max(0.3, (widthCm ?? (kind === 'bag' ? 40 : 15)) / 38));
  const w = shoulderW * scale;
  const h = w / aspect;
  const midX = (ls.x + rs.x) / 2;
  // Prefer the person's right side (screen left on the plain camera); fall back to whichever side is tracked.
  const right = seen(rw) || !seen(lw);
  const [s, e, wr, hp] = right ? [rs, re, rw, rh] : [ls, le, lw, lh];
  const out = Math.sign(s.x - midX) || 1; // away from the body
  const torso = seen(hp) ? hp.y - s.y : shoulderW * 1.4;

  switch (kind === 'acc' ? `acc-${style}` : style) {
    case 'hand':
    case 'acc-hand':
      if (!seen(wr)) return null;
      return kind === 'bag' ? { cx: wr.x, top: wr.y - 0.06 * h, w } : { cx: wr.x, top: wr.y - 0.35 * h, w };
    case 'acc-show':
      if (!seen(wr)) return null;
      return { cx: wr.x, top: wr.y - 0.8 * h, w };
    case 'elbow':
      if (!seen(e)) return null;
      return { cx: e.x + out * 0.1 * w, top: e.y - 0.12 * h, w };
    case 'shoulder':
    case 'back':
      return { cx: s.x + out * 0.28 * w, top: s.y - 0.08 * h, w };
    case 'cross':
      return { cx: (seen(hp) ? hp.x : s.x) + out * 0.15 * w, top: s.y + torso * 0.55, w };
    case 'hug':
    case 'front':
      return { cx: midX, top: s.y + torso * 0.2, w };
    case 'acc-clip':
    case 'acc-pocket':
      return { cx: seen(hp) ? hp.x : s.x, top: s.y + torso * 0.9, w };
    case 'acc-table':
      return { cx: midX, top: Math.min(vh - h, s.y + torso * 1.3), w };
    default:
      return { cx: s.x + out * 0.28 * w, top: s.y - 0.08 * h, w };
  }
}

/** Ease towards the new placement so the overlay does not jitter with the tracker. */
export function smooth(prev: Placement | null, next: Placement, k = 0.45): Placement {
  if (!prev) return next;
  return { cx: prev.cx + (next.cx - prev.cx) * k, top: prev.top + (next.top - prev.top) * k, w: prev.w + (next.w - prev.w) * k };
}

/** Draw the product with a soft contact shadow. `map` turns video pixels into canvas pixels. */
export function paint(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, p: Placement, map: { s: number; ox: number; oy: number }) {
  const w = p.w * map.s;
  const h = w * (img.height / img.width);
  const x = p.cx * map.s + map.ox - w / 2;
  const y = p.top * map.s + map.oy;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.32)';
  ctx.shadowBlur = w * 0.05;
  ctx.shadowOffsetY = w * 0.02;
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}
