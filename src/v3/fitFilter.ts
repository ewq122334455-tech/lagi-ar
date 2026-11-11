/**
 * Fitting engine V2 — smoothing for the live 3D try-on.
 *
 * V1 eased each frame by a fixed fraction (placement 40 % per frame, hand scale 25 %, hand turn 45 %
 * per detection): frame-rate dependent, the same amount of smoothing whether the hand is still
 * (jitter shows) or moving fast (lag shows), and a detection that jumped was followed at once.
 *
 * V2 uses the One Euro filter (Casiez, Roussel, Vogel, CHI 2012): the cut-off rises with the signal's
 * speed, so a still hand is held steady and a fast one is followed closely. It works on timestamps, so
 * the result does not depend on the frame rate. (Measured on recorded hand tracking, position smoothing
 * lands on the same smoothness/lag trade-off as V1 — the gains are in the turn angle, mis-detection
 * rejection and holding through a short loss; docs/ai-fitting-upgrade/REALTIME-FITTING-IMPROVEMENTS.md.
 * A carry-forward predictor was tried and dropped: it doubled the frame-to-frame acceleration.) `OneEuro` is for plain numbers, `OneEuroAngle` for
 * angles (it unwraps ±π so a turn through 180° does not spin the long way round).
 */

const alpha = (cutoff: number, dt: number) => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};

export class OneEuro {
  private x: number | null = null;
  private dx = 0;
  private t = 0;
  constructor(
    /** Cut-off (Hz) when still: lower = steadier but laggier. */
    private minCutoff = 1.5,
    /** How fast the cut-off rises with speed: higher = less lag when moving. */
    private beta = 0.01,
    private dCutoff = 1,
  ) {}

  reset() {
    this.x = null;
    this.dx = 0;
  }

  /** Estimated speed of the signal, per second. */
  get velocity() {
    return this.dx;
  }

  /** `t` in milliseconds. Returns the filtered value. */
  filter(value: number, t: number): number {
    if (this.x === null) {
      this.x = value;
      this.t = t;
      return value;
    }
    const dt = Math.max(1e-3, (t - this.t) / 1000);
    this.t = t;
    const rawDx = (value - this.x) / dt;
    this.dx += alpha(this.dCutoff, dt) * (rawDx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }
}

export class OneEuroAngle {
  private f: OneEuro;
  private last: number | null = null;
  private unwrapped = 0;
  constructor(minCutoff = 1.5, beta = 0.8, dCutoff = 1) {
    this.f = new OneEuro(minCutoff, beta, dCutoff);
  }
  reset() {
    this.f.reset();
    this.last = null;
  }
  filter(angle: number, t: number): number {
    if (this.last === null) this.unwrapped = angle;
    else {
      let d = angle - this.last;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      this.unwrapped += d;
    }
    this.last = angle;
    return this.f.filter(this.unwrapped, t);
  }
}

/** A detection that jumped further than a hand could move between two detections (a mis-detection). */
export function isHandJump(prev: { x: number; y: number } | null, next: { x: number; y: number }, handPx: number, factor = 2.5): boolean {
  if (!prev || handPx <= 0) return false;
  return Math.hypot(next.x - prev.x, next.y - prev.y) > handPx * factor;
}

/** How long the last hand placement is kept when the hand is lost for a moment (ms). */
export const HAND_HOLD_MS = 350;

