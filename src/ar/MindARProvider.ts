import type { ARProvider, ARTargetHandle } from './ARProvider';
import { ARStartError } from './ARProvider';

/**
 * MindAR (image tracking) + three.js implementation of ARProvider.
 * Loaded dynamically so the ~1MB tracker never ships in the main bundle
 * (spec §56 — do not load every 3D/AR asset up front).
 */
export class MindARProvider implements ARProvider {
  private engine: import('mind-ar/dist/mindar-image-three.prod.js').MindARThree | null = null;
  private anchor: import('mind-ar/dist/mindar-image-three.prod.js').MindARAnchor | null = null;
  private foundCb: (() => void) | null = null;
  private lostCb: (() => void) | null = null;

  async start(container: HTMLElement, targetUrl: string): Promise<ARTargetHandle> {
    let MindARThree: typeof import('mind-ar/dist/mindar-image-three.prod.js').MindARThree;
    try {
      const mod = await import('mind-ar/dist/mindar-image-three.prod.js');
      MindARThree = mod.MindARThree;
    } catch {
      throw new ARStartError('UNKNOWN', 'AR 엔진을 불러오지 못했습니다.');
    }

    this.engine = new MindARThree({ container, imageTargetSrc: targetUrl, uiScanning: false, uiLoading: false, uiError: false });
    this.anchor = this.engine.addAnchor(0);
    this.anchor.onTargetFound = () => this.foundCb?.();
    this.anchor.onTargetLost = () => this.lostCb?.();

    try {
      await this.engine.start();
    } catch (e: any) {
      const name = e?.name ?? '';
      if (name === 'NotAllowedError') throw new ARStartError('CAMERA_PERMISSION_DENIED', '카메라 접근이 거부되었습니다.');
      if (name === 'NotFoundError' || name === 'OverconstrainedError')
        throw new ARStartError('CAMERA_UNAVAILABLE', '사용 가능한 카메라를 찾을 수 없습니다.');
      throw new ARStartError('UNKNOWN', e?.message ?? 'AR을 시작하지 못했습니다.');
    }

    return { group: this.anchor.group };
  }

  async stop() {
    this.engine?.renderer?.setAnimationLoop(null);
    this.engine?.stop();
    this.engine = null;
    this.anchor = null;
  }

  onTargetFound(cb: () => void) {
    this.foundCb = cb;
  }

  onTargetLost(cb: () => void) {
    this.lostCb = cb;
  }

  tick() {
    if (this.engine) {
      this.engine.renderer.render(this.engine.scene, this.engine.camera);
    }
  }
}
