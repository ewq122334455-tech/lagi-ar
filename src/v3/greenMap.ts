/**
 * Design mapping for the realtime AI video, green-screen style. The AI is asked to draw the product as
 * a flat chroma-key green bag in the product's own shape (it handles the hands, pose and lighting);
 * each frame the green is found by colour and the real product image is mapped into it, lit by the
 * green's own light and shadow. A hand in front of the bag is not green, so it stays in front.
 */

/** The product's silhouette in flat green on white — the reference image the AI copies the shape from. */
export function greenReference(product: HTMLCanvasElement, size = 640): Promise<Blob> {
  const k = Math.min(1, (size * 0.8) / Math.max(product.width, product.height));
  const w = Math.round(product.width * k);
  const h = Math.round(product.height * k);
  const sil = document.createElement('canvas');
  sil.width = w;
  sil.height = h;
  const sctx = sil.getContext('2d')!;
  sctx.drawImage(product, 0, 0, w, h);
  sctx.globalCompositeOperation = 'source-in';
  sctx.fillStyle = '#00ff00';
  sctx.fillRect(0, 0, w, h);
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(sil, (size - w) / 2, (size - h) / 2);
  return new Promise((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error('reference'))), 'image/jpeg', 0.92));
}

/** How green a pixel is (0 = not, 1 = clearly chroma green), from its RGB. */
function greenness(r: number, g: number, b: number) {
  const m = Math.max(r, b);
  if (g < 60 || g - m < 30) return 0;
  return Math.min(1, (g - m - 30) / 50);
}

export interface DesignMapper {
  /** Draw `src` (the AI video) into `ctx` with the product mapped onto the green bag. Returns whether green was found. */
  draw(ctx: CanvasRenderingContext2D, src: CanvasImageSource, W: number, H: number): boolean;
}

/** A mapper for one product image (keyed, transparent background). */
export function createDesignMapper(product: HTMLCanvasElement): DesignMapper {
  // The product's dominant colour, for green the AI drew just outside the product's own outline.
  const fill = (() => {
    const d = product.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, product.width, product.height).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 16) if (d[i + 3] > 200) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    return n ? [r / n, g / n, b / n] : [200, 200, 200];
  })();
  const small = document.createElement('canvas');
  const sctx = small.getContext('2d', { willReadFrequently: true })!;
  const fit = document.createElement('canvas');
  const fctx = fit.getContext('2d', { willReadFrequently: true })!;
  // Smoothed box so the design does not shake when the green edge flickers.
  let box: { x: number; y: number; w: number; h: number } | null = null;
  let miss = 0;

  return {
    draw(ctx, src, W, H) {
      ctx.drawImage(src, 0, 0, W, H);
      // 1 · Find the green on a small copy (fast), as a box around its bulk.
      const sw = 160;
      const sh = Math.max(1, Math.round((H / W) * sw));
      small.width = sw;
      small.height = sh;
      sctx.drawImage(src, 0, 0, sw, sh);
      const sp = sctx.getImageData(0, 0, sw, sh).data;
      const cols = new Array<number>(sw).fill(0);
      const rows = new Array<number>(sh).fill(0);
      let total = 0;
      for (let y = 0; y < sh; y++)
        for (let x = 0; x < sw; x++) {
          const i = (y * sw + x) * 4;
          if (greenness(sp[i], sp[i + 1], sp[i + 2]) > 0.3) {
            cols[x]++;
            rows[y]++;
            total++;
          }
        }
      if (total < 40) {
        if (++miss > 6) box = null;
        return false;
      }
      miss = 0;
      // Trim 0.5% of green from each side so stray specks do not stretch the box (thin handles stay in).
      const edge = (arr: number[], from: boolean) => {
        let acc = 0;
        const lim = total * 0.005;
        if (from) for (let i = 0; i < arr.length; i++) { acc += arr[i]; if (acc > lim) return i; }
        else for (let i = arr.length - 1; i >= 0; i--) { acc += arr[i]; if (acc > lim) return i; }
        return from ? 0 : arr.length - 1;
      };
      const kx = W / sw;
      const ky = H / sh;
      const next = { x: edge(cols, true) * kx, y: edge(rows, true) * ky, w: (edge(cols, false) - edge(cols, true) + 1) * kx, h: (edge(rows, false) - edge(rows, true) + 1) * ky };
      const e = 0.35;
      box = box ? { x: box.x + (next.x - box.x) * e, y: box.y + (next.y - box.y) * e, w: box.w + (next.w - box.w) * e, h: box.h + (next.h - box.h) * e } : next;

      // 2 · Full resolution inside the box (grown a little for edges).
      const pad = Math.max(4, box.w * 0.06);
      const x0 = Math.max(0, Math.floor(box.x - pad));
      const y0 = Math.max(0, Math.floor(box.y - pad));
      const x1 = Math.min(W, Math.ceil(box.x + box.w + pad));
      const y1 = Math.min(H, Math.ceil(box.y + box.h + pad));
      const bw = x1 - x0;
      const bh = y1 - y0;
      if (bw < 8 || bh < 8) return false;
      const frame = ctx.getImageData(x0, y0, bw, bh);
      const fp = frame.data;
      // The product laid over the green box itself.
      fit.width = bw;
      fit.height = bh;
      fctx.clearRect(0, 0, bw, bh);
      fctx.drawImage(product, box.x - x0, box.y - y0, box.w, box.h);
      const pp = fctx.getImageData(0, 0, bw, bh).data;
      // Light and shadow: the green channel relative to its average over the bag.
      let gs = 0;
      let gn = 0;
      for (let i = 0; i < fp.length; i += 4) if (greenness(fp[i], fp[i + 1], fp[i + 2]) > 0.5) { gs += fp[i + 1]; gn++; }
      const gMean = gn ? gs / gn : 200;
      for (let i = 0; i < fp.length; i += 4) {
        const r = fp[i];
        const g = fp[i + 1];
        const b = fp[i + 2];
        const a = greenness(r, g, b);
        if (a <= 0) {
          // Green spill on edges (hands, outline): pull green down to the other channels.
          const m = Math.max(r, b);
          if (g > m + 12) fp[i + 1] = m + 12;
          continue;
        }
        const shade = Math.max(0.5, Math.min(1.3, g / gMean));
        const pa = pp[i + 3] / 255;
        // Inside the green but outside the product shape (the AI drew a slightly different outline): the product's main colour.
        const pr = pp[i] * pa + fill[0] * (1 - pa);
        const pg = pp[i + 1] * pa + fill[1] * (1 - pa);
        const pb = pp[i + 2] * pa + fill[2] * (1 - pa);
        fp[i] = Math.min(255, r * (1 - a) + pr * shade * a);
        fp[i + 1] = Math.min(255, Math.max(r, b) * (1 - a) + pg * shade * a);
        fp[i + 2] = Math.min(255, b * (1 - a) + pb * shade * a);
      }
      ctx.putImageData(frame, x0, y0);
      return true;
    },
  };
}
