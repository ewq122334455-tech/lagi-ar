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

/** Skin-like (a hand in front of the bag): red-led, moderately saturated, not dark. */
function skinLike(r: number, g: number, b: number) {
  if (r < 90 || r < g || g < b) return false;
  const mx = r;
  const mn = Math.min(g, b);
  const sat = (mx - mn) / mx;
  return sat > 0.12 && sat < 0.62 && r - g > 8;
}

/** The visitor's own camera, the same view the AI was given: used to show what is really behind green the real shape does not cover. */
export interface CameraSource {
  source: CanvasImageSource;
  /** The AI sees the front camera mirrored (selfie view), so the camera frame is flipped to line up with it. */
  mirror: boolean;
  width: number;
  height: number;
}

export interface DesignMapper {
  /** Draw `src` (the AI video) into `ctx` with the product mapped onto the green bag. Returns whether green was found. */
  draw(ctx: CanvasRenderingContext2D, src: CanvasImageSource, W: number, H: number, camera?: CameraSource): boolean;
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
  const camC = document.createElement('canvas');
  const camCtx = camC.getContext('2d', { willReadFrequently: true })!;
  const aspect = product.width / product.height;
  let box: { x: number; y: number; w: number; h: number } | null = null;
  let miss = 0;

  return {
    draw(ctx, src, W, H, camera) {
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
      // The camera's own pixels for this box, lined up with the AI frame (flipped when the AI got a mirrored view).
      // Used only when the camera has the same shape as the AI frame, otherwise the soft fill below is used.
      let cam: Uint8ClampedArray | null = null;
      if (camera && camera.width > 0 && camera.height > 0 && Math.abs(camera.width / camera.height - W / H) < 0.03) {
        camC.width = bw;
        camC.height = bh;
        camCtx.save();
        if (camera.mirror) {
          camCtx.translate(bw, 0);
          camCtx.scale(-1, 1);
          camCtx.drawImage(camera.source, W - x0 - bw, y0, bw, bh, 0, 0, bw, bh);
        } else camCtx.drawImage(camera.source, x0, y0, bw, bh, 0, 0, bw, bh);
        camCtx.restore();
        try {
          cam = camCtx.getImageData(0, 0, bw, bh).data;
        } catch {
          cam = null;
        }
      }

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
      // Pixels within 3 px of the green: where a thin green edge or spill can survive.
      const near = new Uint8Array(bw * bh);
      {
        const tmp = new Uint8Array(bw * bh);
        for (let y = 0; y < bh; y++)
          for (let x = 0; x < bw; x++) {
            if (gmask[y * bw + x] <= 0.25) continue;
            const a0 = Math.max(0, x - 3);
            const a1 = Math.min(bw - 1, x + 3);
            for (let xx = a0; xx <= a1; xx++) tmp[y * bw + xx] = 1;
          }
        for (let y = 0; y < bh; y++)
          for (let x = 0; x < bw; x++) {
            if (!tmp[y * bw + x]) continue;
            const b0 = Math.max(0, y - 3);
            const b1 = Math.min(bh - 1, y + 3);
            for (let yy = b0; yy <= b1; yy++) near[yy * bw + x] = 1;
          }
      }
      // Colours just outside the green, per row, then averaged over +-12 rows so the fill reads as soft background
      // (no vertical or horizontal streaks).
      const sideL = new Float32Array(bh * 3).fill(-1);
      const sideR = new Float32Array(bh * 3).fill(-1);
      for (let y = 0; y < bh; y++) {
        const l = spanL[y];
        const r = spanR[y];
        if (l > 3) for (let ch = 0; ch < 3; ch++) sideL[y * 3 + ch] = orig[(y * bw + l - 4) * 4 + ch];
        if (r >= 0 && r < bw - 4) for (let ch = 0; ch < 3; ch++) sideR[y * 3 + ch] = orig[(y * bw + r + 4) * 4 + ch];
      }
      const smoothSide = (src: Float32Array) => {
        const out = new Float32Array(bh * 3).fill(-1);
        for (let y = 0; y < bh; y++) {
          const acc = [0, 0, 0];
          let n = 0;
          for (let yy = Math.max(0, y - 12); yy <= Math.min(bh - 1, y + 12); yy++) {
            if (src[yy * 3] < 0) continue;
            acc[0] += src[yy * 3];
            acc[1] += src[yy * 3 + 1];
            acc[2] += src[yy * 3 + 2];
            n++;
          }
          if (n) for (let ch = 0; ch < 3; ch++) out[y * 3 + ch] = acc[ch] / n;
        }
        return out;
      };
      const fillL = smoothSide(sideL);
      const fillR = smoothSide(sideR);

      for (let y = 0; y < bh; y++) {
        const l = spanL[y];
        const r = spanR[y];
        const hasL = fillL[y * 3] >= 0;
        const hasR = fillR[y * 3] >= 0;
        for (let x = 0; x < bw; x++) {
          const j = y * bw + x;
          const i = j * 4;
          const a = gmask[j];
          const pa = pp[i + 3] / 255;
          const inSpan = l >= 0 && x >= l && x <= r;
          // Inside the AI's bag the AI sometimes draws its own dark or white parts instead of flat green. Those are still
          // the bag: paint the real product over them. Only skin (a hand in front of the bag) is left alone.
          const aiBag = inSpan && a === 0 && !skinLike(orig[i], orig[i + 1], orig[i + 2]);
          if (pa > 0.02 && (a > 0 || !inSpan || aiBag)) {
            // Product pixel: over the green it takes the green's light; elsewhere it is drawn as is.
            const shade = a > 0 ? Math.max(0.5, Math.min(1.3, orig[i + 1] / gMean)) : 1;
            // Thin parts (straps, edges) come out of the keying half transparent: make them solid so the AI's own
            // drawing does not show through.
            const solid = Math.min(1, Math.max(0, (pa - 0.08) / 0.5));
            const k = a > 0 ? solid * Math.max(a, 0.85) : aiBag ? solid : pa;
            for (let ch = 0; ch < 3; ch++) fp[i + ch] = Math.min(255, orig[i + ch] * (1 - k) + pp[i + ch] * shade * k);
            if (k < 1) {
              const m = Math.max(fp[i], fp[i + 2]);
              if (fp[i + 1] > m + 3) fp[i + 1] = m + 3;
            }
          } else if (a > 0 && cam) {
            // Green outside the real shape: show what the camera really sees there.
            const aa = Math.min(1, a * 1.4);
            fp[i] = orig[i] * (1 - aa) + cam[i] * aa;
            fp[i + 1] = Math.max(orig[i], orig[i + 2]) * (1 - aa) + cam[i + 1] * aa;
            fp[i + 2] = orig[i + 2] * (1 - aa) + cam[i + 2] * aa;
          } else if (a > 0) {
            // Green outside the real shape (no camera view): fill with the soft colours of both sides of the bag, blended by position.
            let fr = 200, fg = 200, fb = 200;
            if (hasL || hasR) {
              const t = hasL && hasR ? (x - l) / Math.max(1, r - l) : hasL ? 0 : 1;
              const A = hasL ? y * 3 : y * 3 + 0;
              const FA = hasL ? fillL : fillR;
              const FB = hasR ? fillR : fillL;
              const tt = Math.min(1, Math.max(0, t));
              fr = FA[A] * (1 - tt) + FB[A] * tt;
              fg = FA[A + 1] * (1 - tt) + FB[A + 1] * tt;
              fb = FA[A + 2] * (1 - tt) + FB[A + 2] * tt;
              fg = Math.min(fg, Math.max(fr, fb) + 4);
            }
            const aa = Math.min(1, a * 1.4);
            fp[i] = orig[i] * (1 - aa) + fr * aa;
            fp[i + 1] = Math.max(orig[i], orig[i + 2]) * (1 - aa) + fg * aa;
            fp[i + 2] = orig[i + 2] * (1 - aa) + fb * aa;
          } else if (cam && ((inSpan && a === 0) || near[j]) && !skinLike(orig[i], orig[i + 1], orig[i + 2])) {
            // The AI's own non-green parts outside the real shape, and the soft edge around its green: show the real camera view
            // (a hand in front of the bag, being skin, keeps the AI's own pixels).
            const w = inSpan && a === 0 ? 0.95 : 0.7;
            const m = Math.max(orig[i], orig[i + 2]);
            const dg = Math.min(orig[i + 1], m + 3);
            fp[i] = orig[i] * (1 - w) + cam[i] * w;
            fp[i + 1] = dg * (1 - w) + cam[i + 1] * w;
            fp[i + 2] = orig[i + 2] * (1 - w) + cam[i + 2] * w;
          } else {
            // Edges and hands: remove green spill. Right next to the green any green lead is removed; elsewhere only a clear one.
            const m = Math.max(orig[i], orig[i + 2]);
            const lim = near[j] ? 3 : 14;
            if (orig[i + 1] > m + lim && (near[j] || (greenness(orig[i], orig[i + 1], orig[i + 2]) === 0 && orig[i + 1] - m < 40))) fp[i + 1] = m + lim;
          }
        }
      }
      ctx.putImageData(frame, x0, y0);
      return true;
    },
  };
}
