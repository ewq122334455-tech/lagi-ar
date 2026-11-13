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


/**
 * Fitting engine V3 — what to show while the hand tracker has lost the hand.
 *
 * V2 kept the bag where it last was for a fixed time. Re-checked against ground truth (a clip with a
 * detection window blanked out, compared with the same clip undropped; docs/ai-fitting-upgrade/V3-LOSS-REANALYSIS.md)
 * that is only right when the hand was still: on a moving hand the stale bag was further from the real
 * hand than V1's, and on recovery it jumped about twice as far. So V3 holds in proportion to how still
 * the hand was, fades the bag out instead of cutting it, and eases back onto the hand when it returns.
 *
 * `fresh()` is called with every real detection, `show()` on every rendered frame.
 */
export class HoldPolicy {
  private pose: { cx: number; top: number; w: number } | null = null;
  private freshAt = -1e9;
  private speed = 0; // hand speed in palm widths per second, smoothed
  private prev: { cx: number; top: number; at: number } | null = null;
  private offset = { x: 0, y: 0 };
  private recoverAt = -1e9;
  private lastShown: { cx: number; top: number; w: number } | null = null;
  private alphaNow = 1;
  private lastTick = 0;
  private interval = 60; // typical time between detections (ms), so a slow device is not mistaken for a loss
  constructor(
    /** How long a still hand may be held (ms). */
    readonly maxHoldMs = 900,
    /** Hold time for a fast hand (ms). */
    readonly minHoldMs = 120,
    /** Speed (palm widths / s) at which the hold has shrunk to `minHoldMs`. */
    readonly fastSpeed = 1.5,
    /** Time constant of the glide back onto the hand (ms). */
    readonly glideMs = 110,
  ) {}

  private staleMs() {
    return Math.min(2500, Math.max(150, this.interval * 2.5));
  }

  /** A real detection: the (filtered) placement the hand now gives, and the palm width in px. */
  fresh(now: number, pose: { cx: number; top: number; w: number }, palmPx: number) {
    if (this.prev) this.interval += (Math.min(3000, now - this.prev.at) - this.interval) * 0.4;
    if (this.prev && palmPx > 0) {
      const dt = Math.max(1, now - this.prev.at) / 1000;
      const v = Math.hypot(pose.cx - this.prev.cx, pose.top - this.prev.top) / palmPx / dt;
      this.speed += (v - this.speed) * Math.min(1, dt / 0.12);
    }
    // Back after a gap: remember how far the bag on screen is from where the hand now puts it.
    if (this.lastShown && now - this.freshAt > this.staleMs()) {
      this.offset = { x: this.lastShown.cx - pose.cx, y: this.lastShown.top - pose.top };
      this.recoverAt = now;
    }
    this.prev = { cx: pose.cx, top: pose.top, at: now };
    this.pose = pose;
    this.freshAt = now;
  }

  /** The pose to draw this frame and its opacity (0 = hidden). `target` is the live placement while the tracker has the hand. */
  show(now: number, target: { cx: number; top: number; w: number } | null): { pose: { cx: number; top: number; w: number }; alpha: number } | null {
    const dt = Math.min(100, Math.max(0, now - this.lastTick));
    this.lastTick = now;
    const age = now - this.freshAt;
    const stale = age > this.staleMs();
    let out: { cx: number; top: number; w: number } | null = null;
    let alpha = 1;
    if (!stale && target) {
      const k = Math.exp(-(now - this.recoverAt) / this.glideMs);
      out = { cx: target.cx + this.offset.x * k, top: target.top + this.offset.y * k, w: target.w };
      this.alphaNow = Math.min(1, this.alphaNow + dt / 120);
      alpha = this.alphaNow;
    } else if (this.pose) {
      const hold = this.minHoldMs + (this.maxHoldMs - this.minHoldMs) * Math.max(0, 1 - this.speed / this.fastSpeed);
      if (age > hold) {
        this.alphaNow = 0;
        return null;
      }
      const fadeFrom = hold * 0.6;
      this.alphaNow = age <= fadeFrom ? 1 : Math.max(0, 1 - (age - fadeFrom) / (hold - fadeFrom));
      alpha = this.alphaNow;
      out = this.pose;
    }
    if (!out) return null;
    this.lastShown = out;
    return { pose: out, alpha };
  }

  reset() {
    this.pose = this.prev = this.lastShown = null;
    this.freshAt = this.recoverAt = -1e9;
    this.speed = 0;
    this.alphaNow = 1;
    this.offset = { x: 0, y: 0 };
    this.interval = 60;
  }
}

/**
 * Fitting engine V3 — a hanging bag swings. A bag that follows the hand rigidly, with no inertia, reads
 * as pasted on; a real one lags when the hand starts moving and swings on when it stops. This is a
 * damped pendulum hung from the hand: its pivot's sideways acceleration drives it.
 *
 * Angle is in radians, positive = the bottom of the bag towards +x (screen right).
 */
export class Swing {
  private theta = 0;
  private omega = 0;
  private vx = 0;
  private ax = 0;
  private lastX: number | null = null;
  private lastT = 0;
  constructor(
    /** Equivalent pendulum length in metres (about 2/3 of the hang length for a bag). */
    private lengthM = 0.2,
    /** Damping ratio: 0 = swings forever, 1 = no overshoot. */
    private zeta = 0.35,
    /** Largest swing (radians). */
    private maxAngle = 0.45,
  ) {}

  setLength(m: number) {
    this.lengthM = Math.max(0.05, m);
  }

  /** `x` is the pivot's screen x in px, `pxPerM` its scale. Returns the angle to roll the bag by. */
  step(now: number, x: number, pxPerM: number): number {
    if (this.lastX === null || now - this.lastT > 250) {
      this.lastX = x;
      this.lastT = now;
      this.vx = 0;
      this.ax = 0;
      return this.theta;
    }
    const dt = Math.min(0.05, (now - this.lastT) / 1000);
    if (dt <= 0) return this.theta;
    const vRaw = (x - this.lastX) / pxPerM / dt;
    this.lastX = x;
    this.lastT = now;
    // Smooth the velocity and the acceleration so a 15 Hz detection does not kick the bag.
    const k = Math.min(1, dt / 0.06);
    const vNew = this.vx + (vRaw - this.vx) * k;
    const aRaw = (vNew - this.vx) / dt;
    this.vx = vNew;
    this.ax += (Math.max(-12, Math.min(12, aRaw)) - this.ax) * Math.min(1, dt / 0.08);
    const a = Math.abs(this.ax) < 0.15 ? 0 : this.ax; // ignore the hand's own tremor
    const g = 9.81;
    const L = this.lengthM;
    const w0 = Math.sqrt(g / L);
    let left = dt;
    while (left > 1e-6) {
      const h = Math.min(left, 0.008);
      const acc = -(g / L) * Math.sin(this.theta) - 2 * this.zeta * w0 * this.omega - (a / L) * Math.cos(this.theta);
      this.omega += acc * h;
      this.theta += this.omega * h;
      left -= h;
    }
    if (this.theta > this.maxAngle) {
      this.theta = this.maxAngle;
      this.omega = Math.min(0, this.omega);
    }
    if (this.theta < -this.maxAngle) {
      this.theta = -this.maxAngle;
      this.omega = Math.max(0, this.omega);
    }
    return this.theta;
  }

  reset() {
    this.theta = this.omega = this.vx = this.ax = 0;
    this.lastX = null;
  }
}
