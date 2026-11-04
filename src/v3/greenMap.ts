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

/**
 * How green a pixel is (0 = not, 1 = clearly the chroma green the AI was asked for). Hue/saturation
 * based, so a dull or pale AI green still counts; skin (red-led) and denim (blue-led) never do.
 */
function greenness(r: number, g: number, b: number) {
  if (g < r || g < b) return 0;
  const mn = Math.min(r, b);
  const c = g - mn;
  if (c < 18) return 0;
  const hue = 60 * ((b - r) / c) + 120; // 60 (yellow-green) … 180 (cyan-green)
  if (hue < 72 || hue > 168) return 0;
  const sat = c / g;
  const val = g / 255;
  return Math.min(1, Math.max(0, (sat - 0.22) / 0.18)) * Math.min(1, Math.max(0, (val - 0.14) / 0.14));
}

export interface DesignMapper {
  /** Draw `src` (the AI video) into `ctx` with the product mapped onto the green bag. Returns whether green was found. */
  draw(ctx: CanvasRenderingContext2D, src: CanvasImageSource, W: number, H: number): boolean;
}

/**
 * A mapper for one product image (keyed, transparent background). The product is drawn at its own
 * proportions where the AI put the green bag, so the shape on screen is the real one; green the AI
 * drew outside that shape is filled from the colours beside it; anything in front of the bag (a hand)
 * stays in front.
 */
export function createDesignMapper(product: HTMLCanvasElement): DesignMapper {
  const small = document.createElement('canvas');
  const sctx = small.getContext('2d', { willReadFrequently: true })!;
  const fit = document.createElement('canvas');
  const fctx = fit.getContext('2d', { willReadFrequently: true })!;
  const aspect = product.width / product.height;
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
          if (greenness(sp[i], sp[i + 1], sp[i + 2]) > 0.35) {
            cols[x]++;
            rows[y]++;
            total++;
          }
        }
      if (total < 30) {
        if (++miss > 6) box = null;
        return false;
      }
      miss = 0;
      const edge = (arr: number[], from: boolean) => {
        let acc = 0;
        const lim = total * 0.005;
        if (from) for (let i = 0; i < arr.length; i++) { acc += arr[i]; if (acc > lim) return i; }
        else for (let i = arr.length - 1; i >= 0; i--) { acc += arr[i]; if (acc > lim) return i; }
        return from ? 0 : arr.length - 1;
      };
      const kx = W / sw;
      const ky = H / sh;
      const gx0 = edge(cols, true), gx1 = edge(cols, false), gy0 = edge(rows, true), gy1 = edge(rows, false);
      const next = { x: gx0 * kx, y: gy0 * ky, w: (gx1 - gx0 + 1) * kx, h: (gy1 - gy0 + 1) * ky };
      const e = 0.35;
      box = box ? { x: box.x + (next.x - box.x) * e, y: box.y + (next.y - box.y) * e, w: box.w + (next.w - box.w) * e, h: box.h + (next.h - box.h) * e } : next;

      // 2 · The real product at its own proportions, fitted inside the green box (bottom-aligned: bags hang).
      let pw = box.w;
      let ph = pw / aspect;
      if (ph > box.h) {
        ph = box.h;
        pw = ph * aspect;
      }
      const px = box.x + (box.w - pw) / 2;
      const py = box.y + box.h - ph;
      const pad = Math.max(6, box.w * 0.08);
      const x0 = Math.max(0, Math.floor(Math.min(box.x, px) - pad));
      const y0 = Math.max(0, Math.floor(Math.min(box.y, py) - pad));
      const x1 = Math.min(W, Math.ceil(Math.max(box.x + box.w, px + pw) + pad));
      const y1 = Math.min(H, Math.ceil(Math.max(box.y + box.h, py + ph) + pad));
      const bw = x1 - x0;
      const bh = y1 - y0;
      if (bw < 8 || bh < 8) return false;
      const frame = ctx.getImageData(x0, y0, bw, bh);
      const fp = frame.data;
      const orig = new Uint8ClampedArray(fp);
      fit.width = bw;
      fit.height = bh;
      fctx.clearRect(0, 0, bw, bh);
      fctx.drawImage(product, px - x0, py - y0, pw, ph);
      const pp = fctx.getImageData(0, 0, bw, bh).data;

      // Light and shadow from the green, and per row the span the AI's bag covers.
      let gs = 0;
      let gn = 0;
      const gmask = new Float32Array(bw * bh);
      const spanL = new Int32Array(bh).fill(-1);
      const spanR = new Int32Array(bh).fill(-1);
      for (let y = 0; y < bh; y++)
        for (let x = 0; x < bw; x++) {
          const i = (y * bw + x) * 4;
          const a = greenness(orig[i], orig[i + 1], orig[i + 2]);
          gmask[y * bw + x] = a;
          if (a > 0.5) {
            gs += orig[i + 1];
            gn++;
            if (spanL[y] < 0) spanL[y] = x;
            spanR[y] = x;
          }
        }
      const gMean = gn ? gs / gn : 200;
      // Fill colours are eased down each column so the patch reads as background, not streaks.
      const prev = new Float32Array(bw * 3).fill(-1);

      for (let y = 0; y < bh; y++) {
        // Colours just outside the green on this row, to fill green the real shape does not cover.
        const l = spanL[y];
        const r = spanR[y];
        const li = l > 3 ? (y * bw + l - 4) * 4 : -1;
        const ri = r >= 0 && r < bw - 4 ? (y * bw + r + 4) * 4 : -1;
        for (let x = 0; x < bw; x++) {
          const j = y * bw + x;
          const i = j * 4;
          const a = gmask[j];
          const pa = pp[i + 3] / 255;
          const inSpan = l >= 0 && x >= l && x <= r;
          if (pa > 0.02 && (a > 0 || !inSpan)) {
            // Product pixel: over the green it takes the green's light; outside the AI bag it is drawn as is.
            const shade = a > 0 ? Math.max(0.5, Math.min(1.3, orig[i + 1] / gMean)) : 1;
            const k = a > 0 ? pa * Math.max(a, 0.6) : pa;
            for (let ch = 0; ch < 3; ch++) fp[i + ch] = Math.min(255, orig[i + ch] * (1 - k) + pp[i + ch] * shade * k);
            if (a > 0 && k < 1) {
              const m = Math.max(fp[i], fp[i + 2]);
              if (fp[i + 1] > m + 8) fp[i + 1] = m + 8;
            }
          } else if (a > 0) {
            // Green outside the real shape: fill from beside it (blend left/right by position).
            let fr = 200, fg = 200, fb = 200;
            if (li >= 0 || ri >= 0) {
              const t = li >= 0 && ri >= 0 ? (x - l) / Math.max(1, r - l) : li >= 0 ? 0 : 1;
              const A = li >= 0 ? li : ri;
              const B = ri >= 0 ? ri : li;
              fr = orig[A] * (1 - t) + orig[B] * t;
              fg = Math.min(orig[A + 1] * (1 - t) + orig[B + 1] * t, Math.max(fr, orig[A + 2]) + 10);
              fb = orig[A + 2] * (1 - t) + orig[B + 2] * t;
            }
            const c = x * 3;
            if (prev[c] >= 0) {
              fr = prev[c] * 0.85 + fr * 0.15;
              fg = prev[c + 1] * 0.85 + fg * 0.15;
              fb = prev[c + 2] * 0.85 + fb * 0.15;
            }
            prev[c] = fr;
            prev[c + 1] = fg;
            prev[c + 2] = fb;
            fp[i] = orig[i] * (1 - a) + fr * a;
            fp[i + 1] = Math.max(orig[i], orig[i + 2]) * (1 - a) + fg * a;
            fp[i + 2] = orig[i + 2] * (1 - a) + fb * a;
          } else {
            // Edges and hands: remove green spill.
            const m = Math.max(orig[i], orig[i + 2]);
            if (orig[i + 1] > m + 14 && greenness(orig[i], orig[i + 1], orig[i + 2]) === 0 && orig[i + 1] - m < 40) fp[i + 1] = m + 14;
          }
        }
      }
      ctx.putImageData(frame, x0, y0);
      return true;
    },
  };
}
