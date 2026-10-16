import type { PoseLandmarker } from '@mediapipe/tasks-vision';

/**
 * Body-pose tracking for the camera try-on, backed by MediaPipe Pose Landmarker.
 * The JS is code-split (only the try-on route pulls it in); the WASM runtime and the
 * ~5MB "lite" pose model are fetched from their public CDNs on first use, pinned to the
 * same version as the npm package so the JS and WASM always match.
 */
const MEDIAPIPE_VERSION = '0.10.14';
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const POSE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export interface BodyLandmark {
  /** Normalised 0–1 across the source frame. */
  x: number;
  y: number;
  visibility: number;
}

export type RunningMode = 'VIDEO' | 'IMAGE';

export class PoseTracker {
  private landmarker: PoseLandmarker | null = null;
  private mode: RunningMode = 'VIDEO';
  private lastTimestamp = -1;

  async load(): Promise<void> {
    if (this.landmarker) return;
    const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
    const create = (delegate: 'GPU' | 'CPU') =>
      PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: POSE_MODEL, delegate },
        runningMode: 'VIDEO',
        numPoses: 1,
      });
    // Some mobile browsers expose WebGL but fail to build MediaPipe's GPU graph — fall back to CPU.
    try {
      this.landmarker = await create('GPU');
    } catch {
      this.landmarker = await create('CPU');
    }
    this.mode = 'VIDEO';
  }

  private async setMode(mode: RunningMode) {
    if (!this.landmarker || this.mode === mode) return;
    await this.landmarker.setOptions({ runningMode: mode });
    this.mode = mode;
    this.lastTimestamp = -1;
  }

  /** Detects the pose in the current video frame. Returns null when no body is in view. */
  async detectVideo(video: HTMLVideoElement): Promise<BodyLandmark[] | null> {
    if (!this.landmarker) return null;
    await this.setMode('VIDEO');
    // MediaPipe rejects non-increasing timestamps.
    const ts = Math.max(performance.now(), this.lastTimestamp + 1);
    this.lastTimestamp = ts;
    const result = this.landmarker.detectForVideo(video, ts);
    return result.landmarks[0] ?? null;
  }

  /** Detects the pose in a still photo. */
  async detectImage(image: HTMLImageElement): Promise<BodyLandmark[] | null> {
    if (!this.landmarker) return null;
    await this.setMode('IMAGE');
    const result = this.landmarker.detect(image);
    return result.landmarks[0] ?? null;
  }

  close() {
    this.landmarker?.close();
    this.landmarker = null;
  }
}
