import type { GarmentType, TryOnSettings } from '@/data/productTypes';
import type { BodyLandmark } from './PoseTracker';

/** MediaPipe Pose landmark indices (the wearer's own left/right). */
const LM = { LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12, LEFT_HIP: 23, RIGHT_HIP: 24 } as const;
const MIN_VISIBILITY = 0.5;

/**
 * Per-garment-type correction from where MediaPipe puts the joints to where the garment
 * actually sits. Shoulder landmarks are on the joint, slightly inside the shoulder seam;
 * hip landmarks are the hip joints — narrower than, and well below, a waistband.
 */
const BODY_FIT: Record<GarmentType, { width: number; lift: number }> = {
  TOP: { width: 1.15, lift: 0.08 },
  OUTER: { width: 1.25, lift: 0.1 },
  DRESS: { width: 1.15, lift: 0.08 },
  BOTTOM: { width: 1.6, lift: 0.45 },
};

export interface Pt {
  x: number;
  y: number;
}

export interface BodyAnchors {
  /** The anchor point that appears on the left of the screen. */
  screenLeft: Pt;
  screenRight: Pt;
}

/**
 * Picks the two body points a garment hangs from, in canvas pixels. Mapping by on-screen
 * side (rather than by the wearer's left/right) keeps the garment image un-mirrored, so
 * prints and logos read correctly in a mirrored selfie view as well as in a photo.
 */
export function bodyAnchors(
  landmarks: BodyLandmark[],
  type: GarmentType,
  width: number,
  height: number,
  mirrored: boolean
): BodyAnchors | null {
  const [a, b] =
    type === 'BOTTOM' ? [landmarks[LM.RIGHT_HIP], landmarks[LM.LEFT_HIP]] : [landmarks[LM.RIGHT_SHOULDER], landmarks[LM.LEFT_SHOULDER]];
  if (!a || !b || a.visibility < MIN_VISIBILITY || b.visibility < MIN_VISIBILITY) return null;
  const toPx = (l: BodyLandmark): Pt => ({ x: (mirrored ? 1 - l.x : l.x) * width, y: l.y * height });
  const pa = toPx(a);
  const pb = toPx(b);
  return pa.x <= pb.x ? { screenLeft: pa, screenRight: pb } : { screenLeft: pb, screenRight: pa };
}

/** Exponential smoothing so the garment does not jitter with per-frame landmark noise. */
export function smoothAnchors(prev: BodyAnchors | null, next: BodyAnchors, alpha = 0.45): BodyAnchors {
  if (!prev) return next;
  const mix = (p: Pt, n: Pt): Pt => ({ x: p.x + (n.x - p.x) * alpha, y: p.y + (n.y - p.y) * alpha });
  return { screenLeft: mix(prev.screenLeft, next.screenLeft), screenRight: mix(prev.screenRight, next.screenRight) };
}

/**
 * Draws the garment so its two calibration anchors land on the two body anchors: a
 * similarity transform (uniform scale + rotation + translation) keeps the garment's
 * proportions while following shoulder tilt and distance from the camera.
 */
export function drawGarment(
  ctx: CanvasRenderingContext2D,
  garment: HTMLImageElement,
  settings: TryOnSettings,
  body: BodyAnchors,
  adjust: { fit: number; offsetY: number } = { fit: 1, offsetY: 0 }
) {
  const gw = garment.naturalWidth;
  const gh = garment.naturalHeight;
  if (!gw || !gh) return;

  const gL = { x: settings.anchorLeft.x * gw, y: settings.anchorLeft.y * gh };
  const gR = { x: settings.anchorRight.x * gw, y: settings.anchorRight.y * gh };
  const gSpan = Math.hypot(gR.x - gL.x, gR.y - gL.y);
  const bdx = body.screenRight.x - body.screenLeft.x;
  const bdy = body.screenRight.y - body.screenLeft.y;
  const bSpan = Math.hypot(bdx, bdy);
  if (gSpan < 1 || bSpan < 1) return;

  const typeFit = BODY_FIT[settings.garmentType];
  const scale = (bSpan * typeFit.width * settings.fit * adjust.fit) / gSpan;
  const angle = Math.atan2(bdy, bdx) - Math.atan2(gR.y - gL.y, gR.x - gL.x);

  // Body midpoint, pushed "up" along the body's own vertical axis (perpendicular to the
  // shoulder/hip line) so it also behaves when the wearer leans.
  const nx = bdy / bSpan;
  const ny = -bdx / bSpan;
  const lift = (typeFit.lift - settings.offsetY - adjust.offsetY) * bSpan;
  const cx = (body.screenLeft.x + body.screenRight.x) / 2 + nx * lift;
  const cy = (body.screenLeft.y + body.screenRight.y) / 2 + ny * lift;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.drawImage(garment, -(gL.x + gR.x) / 2, -(gL.y + gR.y) / 2);
  ctx.restore();
}
