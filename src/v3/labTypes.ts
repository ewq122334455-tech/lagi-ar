/**
 * Types for the fitting comparison lab (`#/lab`, development builds only — VITE_LAB=1). The lab runs the real
 * MapTryOn pipeline several times on one shared input and reads these back; it never changes how the site works.
 */
export type LabEngine = 'v1' | 'v2' | 'v3' | 'v4' | 'v5';

export interface LabOptions {
  /** The size slider of the normal UI (0.7–1.4). */
  size: number;
  /** A multiplier on the estimated px/cm (hand-made calibration), 0.5–2. */
  gain: number;
  /** Where the handle's top sits above the bottom of the fist, in cm; null = the model's / default (3 cm). */
  gripCm: number | null;
  /** Soft shadow behind the bag and the contact shading on hand and bag. */
  shadow: boolean;
  /** Trim the hand overlay's halo with the person mask. */
  mask: boolean;
  /** Pendulum swing of the hanging bag. */
  swing: boolean;
  /** V3+ handle rule (apex a few cm above the fist); off = the V1/V2 rule (55 % of the handle). */
  grip: boolean;
  /** Which hand-size estimate gives px/cm; `ref` uses a reference-object measurement (see calibration). */
  scale: 'all' | 'mcp' | 'knuckle' | 'ref';
  /** Reference calibration: px/cm measured on a frozen frame at a hand whose knuckle line was `refPalmPx` wide. */
  refPxPerCm: number | null;
  refPalmPx: number | null;
}

export interface LabStats {
  engine: LabEngine;
  fps: number;
  frameMs: number;
  poseMs: number;
  handMs: number;
  /** Time between hand detections (ms) and a rough end-to-end lag estimate: detection time + half the interval. */
  detectIntervalMs: number;
  lagEstimateMs: number;
  tracked: boolean;
  /** Tracking losses since the start, the length of the last finished one, and the current one (ms, 0 = none). */
  losses: number;
  lastLossMs: number;
  currentLossMs: number;
  /** Largest per-frame jump of the drawn bag in the 400 ms after the last recovery (px). */
  recoverStepPx: number;
  drawn: boolean;
  widthPx: number;
  /** px/cm each estimator gives right now, and the knuckle-line width in px. */
  scales: { all: number; mcp: number; knuckle: number; palmPx: number; used: number } | null;
}

export interface LabApi {
  /** The pane as one picture (camera frame + 3D bag + hand overlay), or null before it is live. */
  compose(): HTMLCanvasElement | null;
  /** The camera frame alone, before any fitting is drawn. */
  raw(): HTMLCanvasElement | null;
}

export interface LabControl {
  engine: LabEngine;
  /** The one input every pane shares (camera or a recorded clip's captureStream). Panes never stop it. */
  stream: MediaStream | null;
  /** Mirror the picture (selfie camera yes, recorded clip usually no). */
  mirror: boolean;
  options: LabOptions;
  onStats?: (s: LabStats) => void;
  onApi?: (api: LabApi | null) => void;
}
