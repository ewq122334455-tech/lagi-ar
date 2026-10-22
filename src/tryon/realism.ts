import type { PersonMasks } from './PersonSegmenter';
import type { Pt } from './garmentFit';

/**
 * Makes the flat garment cut-out read as part of the camera picture instead of a sticker on top:
 * - lighting: tints and dims the garment to the scene's average colour and brightness;
 * - shading (clothes): multiplies in the luminance of what the wearer has on, so real folds and
 *   shadows show through the new garment;
 * - silhouette (clothes): trims the garment to the wearer's outline;
 * - depth: draws hair/face (and, for a bag held in the hand, the fingers) back over the garment;
 * - shadow (bags): a soft drop shadow so the bag sits against the body.
 */
export class RealismCompositor {
  /** The garment is drawn here first, then finished and composited onto the frame. */
  readonly layer = document.createElement('canvas');
  private alpha = document.createElement('canvas');
  private scratch = document.createElement('canvas');
  private sample = document.createElement('canvas');
  private shade = document.createElement('canvas');
  private frameNo = 0;
  private brightness = 1;
  private tint = 'rgb(255,255,255)';

  /** Clears the layer at frame size and returns its context for drawGarment. */
  begin(width: number, height: number): CanvasRenderingContext2D {
    for (const c of [this.layer, this.alpha, this.scratch]) {
      if (c.width !== width || c.height !== height) {
        c.width = width;
        c.height = height;
      }
    }
    const ctx = this.layer.getContext('2d')!;
    ctx.clearRect(0, 0, width, height);
    return ctx;
  }

  /** Average colour and brightness of the frame, refreshed every few frames (cheap 12×12 sample). */
  private measure(source: CanvasImageSource) {
    if (this.frameNo++ % 6 !== 0) return;
    this.sample.width = this.sample.height = 12;
    const sctx = this.sample.getContext('2d', { willReadFrequently: true })!;
    sctx.drawImage(source, 0, 0, 12, 12);
    const d = sctx.getImageData(0, 0, 12, 12).data;
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < d.length; i += 4) {
      r += d[i];
      g += d[i + 1];
      b += d[i + 2];
    }
    const n = d.length / 4;
    r /= n;
    g /= n;
    b /= n;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    // A product photo is lit brighter than a living room; bring it down to the room, never above studio.
    this.brightness = Math.min(1.04, Math.max(0.62, 0.55 + lum * 0.75));
    // Keep only the colour cast (normalised to the brightest channel), mostly washed toward white.
    const max = Math.max(r, g, b, 1);
    const cast = (v: number) => Math.round(255 - (255 - (v / max) * 255) * 0.2);
    this.tint = `rgb(${cast(r)},${cast(g)},${cast(b)})`;
  }

  private drawSource(ctx: CanvasRenderingContext2D, source: CanvasImageSource, w: number, h: number, mirrored: boolean) {
    ctx.save();
    if (mirrored) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(source, 0, 0, w, h);
    ctx.restore();
  }

  /** Copies the frame pixels that fall inside `mask` (optionally only near `near`) onto ctx. */
  private drawMasked(
    ctx: CanvasRenderingContext2D,
    source: CanvasImageSource,
    mask: HTMLCanvasElement,
    w: number,
    h: number,
    mirrored: boolean,
    near?: { at: Pt; radius: number },
  ) {
    const s = this.scratch.getContext('2d')!;
    s.save();
    s.clearRect(0, 0, w, h);
    s.imageSmoothingEnabled = true;
    this.drawSource(s, mask, w, h, mirrored);
    if (near) {
      s.globalCompositeOperation = 'destination-in';
      const g = s.createRadialGradient(near.at.x, near.at.y, near.radius * 0.5, near.at.x, near.at.y, near.radius);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      s.fillStyle = g;
      s.fillRect(0, 0, w, h);
    }
    s.globalCompositeOperation = 'source-in';
    this.drawSource(s, source, w, h, mirrored);
    s.restore();
    ctx.drawImage(this.scratch, 0, 0);
  }

  /**
   * Grey image centred on 50% that holds only the frame's fold-sized light/dark detail:
   * 0.5·grey + 0.5·(255 − blurred grey) = 128 + (grey − blur)/2, contrast-boosted. Worked at
   * quarter size — the detail that matters is folds, not texture.
   */
  private highPass(source: CanvasImageSource, w: number, h: number, mirrored: boolean, span: number) {
    const sw = Math.max(1, Math.round(w / 4));
    const sh = Math.max(1, Math.round(h / 4));
    if (this.shade.width !== sw || this.shade.height !== sh) {
      this.shade.width = sw;
      this.shade.height = sh;
    }
    const c = this.shade.getContext('2d')!;
    c.save();
    c.globalAlpha = 1;
    c.filter = 'grayscale(1)';
    this.drawSource(c, source, sw, sh, mirrored);
    c.globalAlpha = 0.5;
    c.filter = `grayscale(1) invert(1) blur(${Math.max(2, (span / 4) * 0.12).toFixed(1)}px)`;
    this.drawSource(c, source, sw, sh, mirrored);
    c.restore();
    // Stretch the ±detail around mid-grey so folds read clearly.
    c.save();
    c.filter = 'contrast(2.6)';
    c.globalCompositeOperation = 'copy';
    c.drawImage(this.shade, 0, 0);
    c.restore();
    return this.shade;
  }

  /** Finishes the layer drawn since begin() and composites it onto the frame in ctx. */
  finish(
    ctx: CanvasRenderingContext2D,
    source: CanvasImageSource,
    w: number,
    h: number,
    mirrored: boolean,
    opts: { kind: 'BAG' | 'TOP' | 'BOTTOM'; masks: PersonMasks | null; span: number; hand?: Pt | null },
  ) {
    this.measure(source);
    const l = this.layer.getContext('2d')!;
    const a = this.alpha.getContext('2d')!;
    a.clearRect(0, 0, w, h);
    a.drawImage(this.layer, 0, 0);

    l.save();
    // Room colour cast.
    l.globalCompositeOperation = 'multiply';
    l.fillStyle = this.tint;
    l.fillRect(0, 0, w, h);
    if (opts.kind !== 'BAG') {
      // Real folds and shadows of what the wearer has on, carried into the new garment — only the
      // local light/dark variation (a high-pass), so a white shirt over a black one stays white.
      l.globalCompositeOperation = 'soft-light';
      l.imageSmoothingEnabled = true;
      l.drawImage(this.highPass(source, w, h, mirrored, opts.span), 0, 0, w, h);
    }
    l.globalCompositeOperation = 'source-over';
    // Multiply also painted the transparent area — cut back to the garment's own shape.
    l.globalCompositeOperation = 'destination-in';
    l.drawImage(this.alpha, 0, 0);
    if (opts.kind !== 'BAG' && opts.masks) {
      l.imageSmoothingEnabled = true;
      this.drawSource(l, opts.masks.person, w, h, mirrored);
    }
    l.restore();

    ctx.save();
    ctx.filter = `brightness(${this.brightness.toFixed(3)})`;
    if (opts.kind === 'BAG') {
      ctx.shadowColor = 'rgba(0,0,0,0.38)';
      ctx.shadowBlur = opts.span * 0.12;
      ctx.shadowOffsetX = opts.span * 0.015;
      ctx.shadowOffsetY = opts.span * 0.05;
    }
    ctx.drawImage(this.layer, 0, 0);
    ctx.restore();

    if (opts.masks) {
      this.drawMasked(ctx, source, opts.masks.head, w, h, mirrored);
      if (opts.kind === 'BAG' && opts.hand) {
        this.drawMasked(ctx, source, opts.masks.skin, w, h, mirrored, { at: opts.hand, radius: opts.span * 0.22 });
      }
      if (opts.kind === 'BOTTOM') this.drawMasked(ctx, source, opts.masks.skin, w, h, mirrored);
    }
  }
}

/**
 * A bag hanging from a moving hand or shoulder swings like a pendulum: it lags behind sideways
 * acceleration and settles back. Returns the swing angle (radians) for the current frame.
 */
export class BagSway {
  private angle = 0;
  private velocity = 0;
  private lastPivot: Pt | null = null;
  private lastPivotVel = 0;
  private lastTime = 0;

  update(pivot: Pt | null, lengthPx: number, now = performance.now()): number {
    if (!pivot || lengthPx < 1) {
      this.lastPivot = null;
      return (this.angle *= 0.9);
    }
    const dt = Math.min(0.05, Math.max(0.001, (now - (this.lastTime || now - 16)) / 1000));
    this.lastTime = now;
    const pivotVel = this.lastPivot ? (pivot.x - this.lastPivot.x) / dt : 0;
    const accel = this.lastPivot ? (pivotVel - this.lastPivotVel) / dt : 0;
    this.lastPivot = pivot;
    this.lastPivotVel = pivotVel;
    // θ'' = −(g/L)·θ − damping·θ' + a_pivot/L (canvas angles are clockwise, so a pivot pushed right
    // swings the bottom of the bag left). g is in px/s², scaled to the bag's on-screen size.
    const g = 9.8 * (lengthPx / 0.35);
    const acc = -(g / lengthPx) * this.angle - 3.2 * this.velocity + accel / lengthPx;
    this.velocity += acc * dt;
    this.angle += this.velocity * dt;
    this.angle = Math.max(-0.4, Math.min(0.4, this.angle));
    return this.angle;
  }

  reset() {
    this.angle = this.velocity = 0;
    this.lastPivot = null;
  }
}
