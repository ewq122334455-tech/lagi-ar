import {
  ACESFilmicToneMapping,
  AmbientLight,
  DirectionalLight,
  Group,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import type { ARProvider, ARTargetHandle } from './ARProvider';
import { ARStartError } from './ARProvider';

/**
 * Markerless AR: camera passthrough with the product composited over it, positioned by hand.
 *
 * Image tracking needs a printed target compiled into a .mind file. Until one exists, this
 * provider still opens the rear camera and puts the product in the user's space — they drag to
 * move it, pinch to scale, and twist with two fingers to turn it. It is not surface tracking,
 * so the model does not stay locked to the floor when the phone moves; it is the honest
 * amount of AR available without a target, and it works on iOS Safari and Android Chrome alike.
 */
export class PlacementARProvider implements ARProvider {
  private renderer: WebGLRenderer | null = null;
  private scene: Scene | null = null;
  private camera: PerspectiveCamera | null = null;
  private content: Group | null = null;
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private container: HTMLElement | null = null;
  private foundCb: (() => void) | null = null;
  private live = false;
  private moveHint: HTMLElement | null = null;
  private detach: (() => void) | null = null;
  private onResize: (() => void) | null = null;

  async start(container: HTMLElement): Promise<ARTargetHandle> {
    this.container = container;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
    } catch (e) {
      const name = (e as { name?: string })?.name ?? '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        throw new ARStartError('CAMERA_PERMISSION_DENIED', '카메라 접근이 거부되었습니다.');
      }
      if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        throw new ARStartError('CAMERA_UNAVAILABLE', '사용 가능한 카메라를 찾을 수 없습니다.');
      }
      throw new ARStartError('UNKNOWN', (e as Error)?.message ?? 'AR을 시작하지 못했습니다.');
    }

    const video = document.createElement('video');
    video.setAttribute('playsinline', 'true'); // iOS: keep it inline instead of going fullscreen
    video.muted = true;
    video.autoplay = true;
    video.srcObject = this.stream;
    Object.assign(video.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    } satisfies Partial<CSSStyleDeclaration>);
    container.appendChild(video);
    this.video = video;
    await video.play().catch(() => {
      // Autoplay can be refused until a gesture; the user already tapped to enter AR,
      // and the frame loop keeps rendering regardless.
    });

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      throw new ARStartError('WEBGL_UNSUPPORTED', '이 기기에서 3D를 표시할 수 없습니다.');
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    Object.assign(renderer.domElement.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      touchAction: 'none',
    } satisfies Partial<CSSStyleDeclaration>);
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new Scene();
    scene.add(new AmbientLight(0xffffff, 0.9));
    const key = new DirectionalLight(0xffffff, 1.6);
    key.position.set(1.5, 3, 2);
    scene.add(key);
    const fill = new DirectionalLight(0xffffff, 0.5);
    fill.position.set(-2, 1, -1.5);
    scene.add(fill);
    this.scene = scene;

    const camera = new PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.01,
      100,
    );
    camera.position.set(0, 0, 0);
    this.camera = camera;

    // The product sits in front of the camera; gestures move this group.
    const content = new Group();
    content.position.set(0, -0.25, -1.6);
    scene.add(content);
    this.content = content;

    // Shown only while a long press has put the product into move mode, so the gesture
    // is discoverable instead of being a hidden trick.
    const hint = document.createElement('div');
    hint.textContent = '이동 모드 — 끌어서 옮기세요';
    Object.assign(hint.style, {
      position: 'absolute',
      left: '50%',
      bottom: '18%',
      transform: 'translateX(-50%)',
      padding: '8px 16px',
      borderRadius: '999px',
      background: 'rgba(17,17,17,0.72)',
      color: '#fff',
      font: '600 13px/1 system-ui, sans-serif',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
      opacity: '0',
      transition: 'opacity 120ms ease',
    } satisfies Partial<CSSStyleDeclaration>);
    container.appendChild(hint);
    this.moveHint = hint;

    this.attachGestures(renderer.domElement, content);

    this.onResize = () => {
      if (!this.container || !this.renderer || !this.camera) return;
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', this.onResize);

    // Nothing to recognise — the product is placed as soon as the camera is live.
    this.live = true;
    this.foundCb?.();

    return { group: content };
  }

  /**
   * Gestures: one finger turns the product, a long press then drag moves it, and two
   * fingers pinch to zoom. The long press is what separates moving from turning, so a
   * normal drag never shifts the product out from under the user by accident.
   */
  private attachGestures(el: HTMLElement, content: Group) {
    // Yaw before pitch, so dragging reads as a turntable rather than tumbling the model.
    content.rotation.order = 'YXZ';

    type Mode = 'idle' | 'rotate' | 'move' | 'pinch';
    const pointers = new Map<number, { x: number; y: number }>();
    let mode: Mode = 'idle';
    let startDistance = 0;
    let startScale = 1;
    let downAt: { x: number; y: number } | null = null;
    let holdTimer: ReturnType<typeof setTimeout> | null = null;

    const YAW_PER_PX = 0.008;
    const PITCH_PER_PX = 0.006;
    const MAX_PITCH = Math.PI / 3; // keep the product upright-ish instead of flipping over
    const HOLD_MS = 420;
    const SLOP_PX = 10; // movement allowed before a press stops counting as "held"

    const two = () => [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
    const spread = () => {
      const [a, b] = two();
      return Math.hypot(b.x - a.x, b.y - a.y);
    };

    const clearHold = () => {
      if (holdTimer !== null) clearTimeout(holdTimer);
      holdTimer = null;
    };

    const setMoveMode = (on: boolean) => {
      mode = on ? 'move' : mode;
      this.setMoveHint(on);
      if (on) navigator.vibrate?.(15);
    };

    const onDown = (e: PointerEvent) => {
      // Register first: capture is an optimisation, and if it throws (stale or synthetic
      // pointer id) the finger must still drive the gesture.
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Capture unavailable for this pointer; pointermove still fires on the element.
      }

      if (pointers.size === 1) {
        downAt = { x: e.clientX, y: e.clientY };
        mode = 'idle';
        clearHold();
        holdTimer = setTimeout(() => {
          if (pointers.size === 1 && mode === 'idle') setMoveMode(true);
        }, HOLD_MS);
      } else if (pointers.size === 2) {
        clearHold();
        setMoveMode(false);
        mode = 'pinch';
        startDistance = spread();
        startScale = content.scale.x;
      }
    };

    const onMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const next = { x: e.clientX, y: e.clientY };
      pointers.set(e.pointerId, next);

      if (pointers.size === 1) {
        // A press that travels before the hold fires is a turn, not a move.
        if (mode === 'idle' && downAt) {
          if (Math.hypot(next.x - downAt.x, next.y - downAt.y) > SLOP_PX) {
            clearHold();
            mode = 'rotate';
          }
        }

        if (mode === 'rotate') {
          content.rotation.y += (next.x - prev.x) * YAW_PER_PX;
          content.rotation.x = Math.max(
            -MAX_PITCH,
            Math.min(MAX_PITCH, content.rotation.x + (next.y - prev.y) * PITCH_PER_PX),
          );
        } else if (mode === 'move') {
          // The divisor maps screen pixels to metres at the model's default distance.
          content.position.x += (next.x - prev.x) / 340;
          content.position.y -= (next.y - prev.y) / 340;
        }
      } else if (pointers.size === 2 && mode === 'pinch' && startDistance > 0) {
        const scale = Math.min(6, Math.max(0.15, startScale * (spread() / startDistance)));
        content.scale.setScalar(scale);
      }
    };

    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) startDistance = 0;
      if (pointers.size === 0) {
        clearHold();
        this.setMoveHint(false);
        mode = 'idle';
        downAt = null;
      }
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    this.detach = () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }

  private setMoveHint(on: boolean) {
    if (this.moveHint) this.moveHint.style.opacity = on ? '1' : '0';
  }

  async stop() {
    this.detach?.();
    this.detach = null;
    if (this.onResize) window.removeEventListener('resize', this.onResize);
    this.onResize = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video?.remove();
    this.video = null;
    this.moveHint?.remove();
    this.moveHint = null;
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.content = null;
    this.container = null;
    this.live = false;
  }

  onTargetFound(cb: () => void) {
    this.foundCb = cb;
    // Callers register this after start() returns, by which point the product is already
    // placed, so fire straight away rather than waiting for an event that never comes.
    if (this.live) cb();
  }

  onTargetLost() {
    // Markerless placement never loses the product.
  }

  tick() {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
