import type { GarmentType, Point2D, Product } from '@/data/productTypes';
import { AI_TRYON_URL } from './aiTryOn';
import { detectHandleAnchors } from './autoAnchors';

/**
 * Photoreal cut-outs for the live camera try-on. Gemini redraws a product photo as a studio
 * cut-out on a flat chroma background (in the cut-out studio, by an admin); the background is
 * keyed out here, the hanging/shoulder anchors are found from the shape, and the result is kept
 * on the Worker so every visitor's camera try-on uses it instead of the bundled illustration.
 */
const API = AI_TRYON_URL.replace(/\/+$/, '');

export interface Cutout {
  image: string;
  anchorLeft: Point2D;
  anchorRight: Point2D;
}

/** The stored cut-out for a product, or null (none yet, or the Worker is slow/unreachable). */
export async function fetchCutout(productId: string, timeoutMs = 4000): Promise<Cutout | null> {
  if (!API) return null;
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API}/cutout/${productId}`, { signal: ctrl.signal });
    return res.ok ? ((await res.json()) as Cutout) : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

async function adminCall<T>(path: string, key: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Admin-Key': key },
    body: body ? JSON.stringify(body) : undefined,
  });
  const out = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(out.error ?? '요청을 처리하지 못했습니다.');
  return out;
}

/** Asks Gemini (via the Worker) for a studio cut-out of the product on a flat chroma background. */
export async function generateCutoutSource(product: Product, key: string): Promise<string> {
  const base = `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}`;
  const r = await adminCall<{ image: string }>('/cutout/generate', key, 'POST', {
    productImage: new URL(product.images[0], base).toString(),
    productName: product.name.value ?? product.id,
    category: product.category.value ?? '',
  });
  return r.image;
}

export function saveCutout(productId: string, cutout: Cutout, key: string) {
  return adminCall<{ ok: true }>(`/cutout/${productId}`, key, 'PUT', cutout);
}

export function deleteCutout(productId: string, key: string) {
  return adminCall<{ ok: true }>(`/cutout/${productId}`, key, 'DELETE');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지를 불러오지 못했습니다.'));
    img.src = src;
  });
}

/**
 * Keys out the flat background: flood-fills from the image border over pixels close to the
 * border colour (so a white T-shirt on white survives as long as it does not touch the edge),
 * softens the edge, takes the green/magenta spill off the rim, and trims to the product.
 */
export async function keyOutBackground(src: string, maxSize = 900): Promise<HTMLImageElement> {
  const img = await loadImage(src);
  const s = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * s);
  const h = Math.round(img.naturalHeight * s);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const im = ctx.getImageData(0, 0, w, h);
  const d = im.data;

  // Background colour: the median of the border pixels.
  const border: number[][] = [];
  for (let x = 0; x < w; x += 4) border.push([x, 0], [x, h - 1]);
  for (let y = 0; y < h; y += 4) border.push([0, y], [w - 1, y]);
  const chan = (c: number) => {
    const v = border.map(([x, y]) => d[(y * w + x) * 4 + c]).sort((a, b) => a - b);
    return v[v.length >> 1];
  };
  const bg = [chan(0), chan(1), chan(2)];
  const dist = (i: number) => Math.hypot(d[i] - bg[0], d[i + 1] - bg[1], d[i + 2] - bg[2]);
  const HARD = 70;
  const SOFT = 130;

  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const p = stack.pop()!;
    if (seen[p]) continue;
    const dd = dist(p * 4);
    if (dd > SOFT) continue;
    seen[p] = 1;
    // Fully background below HARD, a soft ramp up to SOFT for anti-aliased edges.
    d[p * 4 + 3] = dd <= HARD ? 0 : Math.round(((dd - HARD) / (SOFT - HARD)) * 255);
    if (dd > HARD) continue; // edge pixel: do not flood past it into the product
    const x = p % w;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (p >= w) stack.push(p - w);
    if (p < w * (h - 1)) stack.push(p + w);
  }
  // Spill: pull the chroma colour out of the rim — semi-transparent pixels and opaque ones within
  // two pixels of the background — without touching the product's own colours further in.
  const greenKey = bg[1] > bg[0] && bg[1] > bg[2];
  const nearEdge = (p: number) => {
    const x = p % w;
    const y = (p / w) | 0;
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && d[(ny * w + nx) * 4 + 3] === 0) return true;
      }
    return false;
  };
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (d[i + 3] === 0 || (d[i + 3] === 255 && !nearEdge(p))) continue;
    if (greenKey) d[i + 1] = Math.min(d[i + 1], Math.max(d[i], d[i + 2]));
    else d[i] = d[i + 2] = Math.min(Math.max(d[i], d[i + 2]), d[i + 1] + 20);
  }
  ctx.putImageData(im, 0, 0);

  // Trim to the opaque bounding box with a small margin.
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (d[(y * w + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) throw new Error('배경을 지우지 못했습니다. 다시 만들어 주세요.');
  const m = 6;
  x0 = Math.max(0, x0 - m);
  y0 = Math.max(0, y0 - m);
  x1 = Math.min(w - 1, x1 + m);
  y1 = Math.min(h - 1, y1 + m);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext('2d')!.drawImage(canvas, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return loadImage(out.toDataURL('image/png'));
}

/** Where the garment meets the body, as fractions of the trimmed cut-out. */
export function cutoutAnchors(img: HTMLImageElement, type: GarmentType): { anchorLeft: Point2D; anchorRight: Point2D } {
  if (type === 'BAG') return detectHandleAnchors(img) ?? { anchorLeft: { x: 0.35, y: 0.02 }, anchorRight: { x: 0.65, y: 0.02 } };
  if (type === 'BOTTOM') {
    // Waistband ends: the outermost opaque pixels just under the top edge.
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    const y = Math.round(h * 0.03);
    const row = ctx.getImageData(0, y, w, 1).data;
    let l = 0;
    let r = w - 1;
    while (l < w && row[l * 4 + 3] < 128) l++;
    while (r > 0 && row[r * 4 + 3] < 128) r--;
    return { anchorLeft: { x: l / w, y: y / h }, anchorRight: { x: r / w, y: y / h } };
  }
  // Tops: shoulder seams sit about a fifth in from each side, a little below the collar.
  return { anchorLeft: { x: 0.22, y: 0.1 }, anchorRight: { x: 0.78, y: 0.1 } };
}

/** The try-on garment type for a product, from its try-on settings or category. */
export function garmentTypeOf(product: Product): GarmentType | null {
  if (product.tryOn) return product.tryOn.garmentType;
  const c = (product.category.value ?? '').toLowerCase();
  return c.includes('bag') ? 'BAG' : c === 'top' ? 'TOP' : c === 'bottom' ? 'BOTTOM' : null;
}
