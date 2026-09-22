declare module 'mind-ar/dist/mindar-image-three.prod.js' {
  import type { Scene, Camera, WebGLRenderer, Group } from 'three';

  export interface MindARAnchor {
    group: Group;
    onTargetFound?: () => void;
    onTargetLost?: () => void;
  }

  export interface MindARThreeOptions {
    container: HTMLElement;
    imageTargetSrc: string;
    maxTrack?: number;
    uiScanning?: boolean;
    uiLoading?: boolean;
    uiError?: boolean;
  }

  export class MindARThree {
    constructor(options: MindARThreeOptions);
    renderer: WebGLRenderer;
    scene: Scene;
    camera: Camera;
    addAnchor(index: number): MindARAnchor;
    start(): Promise<void>;
    stop(): void;
  }
}
