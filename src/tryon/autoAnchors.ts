import type { Point2D } from '@/data/productTypes';

/**
 * Finds a bag cut-out's handle/strap tops from its alpha channel: the outermost opaque runs a
 * little below the topmost opaque row. Lets a freshly rendered bag (e.g. a colour remix) be
 * hung on the body without anyone clicking calibration points.
 */
export function detectHandleAnchors(img: HTMLImageElement): { anchorLeft: Point2D; anchorRight: Point2D } | null {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, w, h);
  const opaque = (x: number, y: number) => data[(y * w + x) * 4 + 3] > 24;

  let top = -1;
  for (let y = 0; y < h && top < 0; y++) {
    for (let x = 0; x < w; x++) if (opaque(x, y)) { top = y; break; }
  }
  if (top < 0) return null;

  const y = Math.min(h - 1, top + Math.round(h * 0.03));
  const runs: [number, number][] = [];
  let start = -1;
  for (let x = 0; x <= w; x++) {
    const on = x < w && opaque(x, y);
    if (on && start < 0) start = x;
    if (!on && start >= 0) {
      runs.push([start, x - 1]);
      start = -1;
    }
  }
  if (runs.length === 0) return null;
  const first = runs[0];
  const last = runs[runs.length - 1];
  // A single run (handles meeting at the top) is split at its quarter points.
  const left = runs.length > 1 ? (first[0] + first[1]) / 2 : first[0] + (first[1] - first[0]) * 0.25;
  const right = runs.length > 1 ? (last[0] + last[1]) / 2 : first[0] + (first[1] - first[0]) * 0.75;
  return { anchorLeft: { x: left / w, y: y / h }, anchorRight: { x: right / w, y: y / h } };
}
