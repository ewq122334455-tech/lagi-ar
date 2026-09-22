import type { Object3D } from 'three';

/**
 * AR provider abstraction (spec §60, §69). The concrete implementation used today is
 * MindAR (image tracking) + three.js, chosen for iOS Safari / Android Chrome
 * compatibility without native app installs. A different WebAR engine (e.g. an
 * 8th Wall-style SLAM tracker) can be dropped in later by implementing this
 * same interface — nothing above this layer depends on MindAR directly.
 */
export interface ARTargetHandle {
  /** The three.js group anchored to the recognized target. Add product content as children. */
  group: Object3D;
}

export interface ARProvider {
  /** Mounts the camera + renderer into `container` and starts tracking `targetUrl`. */
  start(container: HTMLElement, targetUrl: string): Promise<ARTargetHandle>;
  stop(): Promise<void>;
  onTargetFound(cb: () => void): void;
  onTargetLost(cb: () => void): void;
  /** Renders the current frame; call once per animation frame. */
  tick(): void;
}

export type ARFailureReason =
  | 'CAMERA_PERMISSION_DENIED'
  | 'CAMERA_UNAVAILABLE'
  | 'WEBGL_UNSUPPORTED'
  | 'TARGET_LOAD_FAILED'
  | 'UNKNOWN';

export class ARStartError extends Error {
  reason: ARFailureReason;
  constructor(reason: ARFailureReason, message?: string) {
    super(message ?? reason);
    this.reason = reason;
  }
}
