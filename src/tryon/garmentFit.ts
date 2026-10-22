import type { CarryStyle, GarmentType, TryOnSettings } from '@/data/productTypes';
import type { BodyLandmark } from './PoseTracker';

/** MediaPipe Pose landmark indices (the wearer's own left/right). */
const LM = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
} as const;
const MIN_VISIBILITY = 0.5;
const MIN_HAND_VISIBILITY = 0.35;

/**
 * Per-garment-type correction from where MediaPipe puts the joints to where the garment
 * actually sits. Shoulder landmarks are on the joint, slightly inside the shoulder seam;
 * hip landmarks are the hip joints — narrower than, and well below, a waistband.
 */
const BODY_FIT: Record<Exclude<GarmentType, 'BAG'>, { width: number; lift: number }> = {
  TOP: { width: 1.15, lift: 0.08 },
  OUTER: { width: 1.25, lift: 0.1 },
  DRESS: { width: 1.15, lift: 0.08 },
  BOTTOM: { width: 1.6, lift: 0.45 },
};

/** Typical adult shoulder (biacromial) width — the ruler that sizes a bag against the wearer. */
const SHOULDER_WIDTH_CM = 38;
/** Typical shoulder-to-hip-joint length — a second ruler that does not shrink when the wearer turns sideways. */
const TORSO_LENGTH_CM = 50;
const DEFAULT_BAG_WIDTH_CM = 32;
const STRAP_WIDTH_CM = 3.5;

export interface Pt {
  x: number;
  y: number;
}

export type ScreenSide = 'L' | 'R';

/**
 * Body points in canvas pixels, keyed by the side of the screen they appear on rather than
 * the wearer's own left/right, so the garment image is never mirrored — prints and logos read
 * correctly in a mirrored selfie view as well as in a photo. null = not confidently visible.
 */
export interface BodyPoints {
  shoulderL: Pt | null;
  shoulderR: Pt | null;
  hipL: Pt | null;
  hipR: Pt | null;
  handL: Pt | null;
  handR: Pt | null;
}

export function bodyPoints(landmarks: BodyLandmark[], width: number, height: number, mirrored: boolean): BodyPoints {
  const toPx = (l: BodyLandmark | undefined, min = MIN_VISIBILITY): Pt | null =>
    l && l.visibility >= min ? { x: (mirrored ? 1 - l.x : l.x) * width, y: l.y * height } : null;
  // Facing the camera, the wearer's right side is on the left of an un-mirrored frame.
  const pick = (left: number, right: number): [BodyLandmark | undefined, BodyLandmark | undefined] =>
    mirrored ? [landmarks[left], landmarks[right]] : [landmarks[right], landmarks[left]];

  const [sL, sR] = pick(LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER);
  const [hL, hR] = pick(LM.LEFT_HIP, LM.RIGHT_HIP);
  const hand = (wrist: number, index: number, pinky: number): Pt | null => {
    // The grip sits between the wrist and the knuckles; fall back to the wrist alone.
    const pts = [landmarks[wrist], landmarks[index], landmarks[pinky]].map((l) => toPx(l, MIN_HAND_VISIBILITY));
    const w = pts[0];
    if (!w) return null;
    const knuckles = pts.slice(1).filter((p): p is Pt => p !== null);
    if (knuckles.length === 0) return w;
    const k = { x: knuckles.reduce((s, p) => s + p.x, 0) / knuckles.length, y: knuckles.reduce((s, p) => s + p.y, 0) / knuckles.length };
    return { x: (w.x + k.x) / 2, y: (w.y + k.y) / 2 };
  };
  const handLeft = mirrored ? hand(LM.LEFT_WRIST, LM.LEFT_INDEX, LM.LEFT_PINKY) : hand(LM.RIGHT_WRIST, LM.RIGHT_INDEX, LM.RIGHT_PINKY);
  const handRight = mirrored ? hand(LM.RIGHT_WRIST, LM.RIGHT_INDEX, LM.RIGHT_PINKY) : hand(LM.LEFT_WRIST, LM.LEFT_INDEX, LM.LEFT_PINKY);

  return {
    shoulderL: toPx(sL),
    shoulderR: toPx(sR),
    hipL: toPx(hL),
    hipR: toPx(hR),
    handL: handLeft,
    handR: handRight,
  };
}

/** Exponential smoothing so the garment does not jitter with per-frame landmark noise. */
export function smoothPoints(prev: BodyPoints | null, next: BodyPoints, alpha = 0.45): BodyPoints {
  if (!prev) return next;
  const mix = (p: Pt | null, n: Pt | null): Pt | null =>
    n && p ? { x: p.x + (n.x - p.x) * alpha, y: p.y + (n.y - p.y) * alpha } : n;
  return {
    shoulderL: mix(prev.shoulderL, next.shoulderL),
    shoulderR: mix(prev.shoulderR, next.shoulderR),
    hipL: mix(prev.hipL, next.hipL),
    hipR: mix(prev.hipR, next.hipR),
    handL: mix(prev.handL, next.handL),
    handR: mix(prev.handR, next.handR),
  };
}

export interface FitAdjust {
  fit: number;
  offsetY: number;
  /** BAG only. */
  carry: CarryStyle;
  /** BAG only: the screen side the bag is carried on. */
  side: ScreenSide;
}

/** Draws the garment onto the body. Returns false when the body points it needs are not visible. */
export function drawGarment(
  ctx: CanvasRenderingContext2D,
  garment: HTMLImageElement,
  settings: TryOnSettings,
  body: BodyPoints,
  adjust: FitAdjust
): boolean {
  if (!garment.naturalWidth || !garment.naturalHeight) return false;
  return settings.garmentType === 'BAG'
    ? drawBag(ctx, garment, settings, body, adjust)
    : drawClothing(ctx, garment, settings, body, adjust);
}

const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
const len = (a: Pt) => Math.hypot(a.x, a.y);
const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** Image-space calibration anchors and their midpoint, in garment pixels. */
function imageAnchors(garment: HTMLImageElement, settings: TryOnSettings) {
  const gL = { x: settings.anchorLeft.x * garment.naturalWidth, y: settings.anchorLeft.y * garment.naturalHeight };
  const gR = { x: settings.anchorRight.x * garment.naturalWidth, y: settings.anchorRight.y * garment.naturalHeight };
  return { gL, gR, mid: lerp(gL, gR, 0.5) };
}

/**
 * Clothing: a similarity transform (uniform scale + rotation + translation) lands the
 * garment's two anchors on the shoulders (or hips), keeping its proportions while following
 * tilt and distance from the camera.
 */
function drawClothing(
  ctx: CanvasRenderingContext2D,
  garment: HTMLImageElement,
  settings: TryOnSettings,
  body: BodyPoints,
  adjust: FitAdjust
): boolean {
  const bottom = settings.garmentType === 'BOTTOM';
  const bL = bottom ? body.hipL : body.shoulderL;
  const bR = bottom ? body.hipR : body.shoulderR;
  if (!bL || !bR) return false;

  const { gL, gR, mid } = imageAnchors(garment, settings);
  const g = sub(gR, gL);
  const b = sub(bR, bL);
  const gSpan = len(g);
  const bSpan = len(b);
  if (gSpan < 1 || bSpan < 1) return false;

  const typeFit = BODY_FIT[settings.garmentType as Exclude<GarmentType, 'BAG'>];
  const scale = (bSpan * typeFit.width * settings.fit * adjust.fit) / gSpan;
  const angle = Math.atan2(b.y, b.x) - Math.atan2(g.y, g.x);

  // Pushed "up" along the body's own vertical axis (perpendicular to the shoulder/hip
  // line) so it also behaves when the wearer leans.
  const up = { x: b.y / bSpan, y: -b.x / bSpan };
  const center = add(lerp(bL, bR, 0.5), mul(up, (typeFit.lift - settings.offsetY - adjust.offsetY) * bSpan));

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.drawImage(garment, -mid.x, -mid.y);
  ctx.restore();
  return true;
}

/**
 * Bags hang upright under gravity rather than turning with the body, so they are only
 * scaled and translated: sized from the bag's real width against the wearer's shoulder
 * width, and hung by the midpoint of their handle/strap anchors from the hand, the shoulder,
 * or (cross-body) the opposite hip with a strap drawn up across the chest.
 */
function drawBag(
  ctx: CanvasRenderingContext2D,
  garment: HTMLImageElement,
  settings: TryOnSettings,
  body: BodyPoints,
  adjust: FitAdjust
): boolean {
  const { shoulderL, shoulderR } = body;
  if (!shoulderL || !shoulderR) return false;
  const across = sub(shoulderR, shoulderL);
  const span = len(across);
  if (span < 1) return false;

  const up = { x: across.y / span, y: -across.x / span };
  // Shoulder width foreshortens as the wearer turns; torso length does not, so take the larger.
  const hipMid = body.hipL && body.hipR ? lerp(body.hipL, body.hipR, 0.5) : null;
  const torsoPx = hipMid ? len(sub(lerp(shoulderL, shoulderR, 0.5), hipMid)) : 0;
  const pxPerCm = Math.max(span / SHOULDER_WIDTH_CM, torsoPx / TORSO_LENGTH_CM);
  const widthCm = settings.realWidthCm || DEFAULT_BAG_WIDTH_CM;
  const scale = (widthCm * pxPerCm * settings.fit * adjust.fit) / garment.naturalWidth;

  const sameL = adjust.side === 'L';
  const shoulder = sameL ? shoulderL : shoulderR;
  const otherShoulder = sameL ? shoulderR : shoulderL;
  // Unit vector pointing away from the body's centre line on the carrying side.
  const outward = mul(sameL ? mul(across, -1) : across, 1 / span);
  // Where a strap rests on top of the shoulder: above the joint and slightly toward the neck.
  const shoulderTop = (s: Pt, out: Pt) => add(add(s, mul(up, 0.12 * span)), mul(out, -0.03 * span));

  let hang: Pt;
  let strapTo: Pt | null = null;
  if (adjust.carry === 'HAND') {
    const hand = sameL ? body.handL : body.handR;
    if (!hand) return false;
    hang = hand;
  } else if (adjust.carry === 'SHOULDER') {
    hang = shoulderTop(shoulder, outward);
  } else {
    // Cross-body: strap over the carrying-side shoulder, bag resting at the opposite hip.
    const otherOut = mul(outward, -1);
    const otherHip = (sameL ? body.hipR : body.hipL) ?? add(otherShoulder, mul(up, -1.3 * span));
    hang = add(lerp(otherShoulder, otherHip, 0.72), mul(otherOut, 0.08 * span));
    strapTo = shoulderTop(shoulder, outward);
  }
  hang = add(hang, mul(up, -(settings.offsetY + adjust.offsetY) * span));

  const { gL, gR, mid } = imageAnchors(garment, settings);
  const toScreen = (p: Pt): Pt => add(hang, mul(sub(p, mid), scale));

  if (strapTo) {
    // The strap leaves from the bag end nearer the shoulder it goes over; the other end runs behind the back.
    const sL = toScreen(gL);
    const sR = toScreen(gR);
    const from = len(sub(sL, strapTo)) < len(sub(sR, strapTo)) ? sL : sR;
    ctx.save();
    ctx.strokeStyle = settings.strapColor || '#1f1f1f';
    ctx.lineWidth = Math.max(2, STRAP_WIDTH_CM * pxPerCm);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(strapTo.x, strapTo.y);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(hang.x, hang.y);
  ctx.scale(scale, scale);
  ctx.drawImage(garment, -mid.x, -mid.y);
  ctx.restore();
  return true;
}
