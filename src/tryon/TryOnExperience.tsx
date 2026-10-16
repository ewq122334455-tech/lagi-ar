import { useCallback, useEffect, useRef, useState } from 'react';
import type { Product, TryOnSettings } from '@/data/productTypes';
import { PoseTracker } from './PoseTracker';
import type { BodyLandmark } from './PoseTracker';
import { bodyAnchors, drawGarment, smoothAnchors } from './garmentFit';
import type { BodyAnchors } from './garmentFit';

type TryOnState =
  | 'ready-to-start'
  | 'loading'
  | 'camera-denied'
  | 'camera-unavailable'
  | 'engine-error'
  | 'live'
  | 'photo';

type Facing = 'user' | 'environment';

interface TryOnExperienceProps {
  product: Product;
  settings: TryOnSettings;
  onExit: () => void;
}

/**
 * Camera virtual try-on: tracks the wearer's shoulders/hips with MediaPipe Pose and
 * draws the product's flat garment cut-out onto the body every frame, so the garment
 * follows the wearer as they move. A full-body photo can be used instead of the camera.
 */
export function TryOnExperience({ product, settings, onExit }: TryOnExperienceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackerRef = useRef<PoseTracker | null>(null);
  const garmentRef = useRef<HTMLImageElement | null>(null);
  const photoRef = useRef<HTMLImageElement | null>(null);
  const photoLandmarksRef = useRef<BodyLandmark[] | null>(null);
  const anchorsRef = useRef<BodyAnchors | null>(null);
  const rafRef = useRef<number | null>(null);
  const adjustRef = useRef({ fit: 1, offsetY: 0 });
  const showGarmentRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<TryOnState>('ready-to-start');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [facing, setFacing] = useState<Facing>('user');
  const [bodyFound, setBodyFound] = useState(false);
  const [fit, setFit] = useState(1);
  const [offsetY, setOffsetY] = useState(0);
  const [showGarment, setShowGarment] = useState(true);
  const [showAdjust, setShowAdjust] = useState(false);
  const [saving, setSaving] = useState(false);

  adjustRef.current = { fit, offsetY };
  showGarmentRef.current = showGarment;

  const stopLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const stopCamera = useCallback(() => {
    stopLoop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [stopLoop]);

  useEffect(
    () => () => {
      stopCamera();
      trackerRef.current?.close();
      trackerRef.current = null;
    },
    [stopCamera]
  );

  /** Loads the garment image and pose model once; both are reused across camera/photo modes. */
  const prepare = useCallback(async () => {
    if (!garmentRef.current) {
      garmentRef.current = await loadImage(settings.garmentImage).catch(() => {
        throw new Error('의상 이미지를 불러오지 못했습니다.');
      });
    }
    if (!trackerRef.current) {
      const tracker = new PoseTracker();
      await tracker.load().catch(() => {
        throw new Error('신체 인식 엔진을 불러오지 못했습니다. 네트워크 연결을 확인해 주세요.');
      });
      trackerRef.current = tracker;
    }
  }, [settings.garmentImage]);

  const renderFrame = useCallback(
    (source: CanvasImageSource, width: number, height: number, mirrored: boolean, landmarks: BodyLandmark[] | null, smooth: boolean) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.save();
      if (mirrored) {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(source, 0, 0, width, height);
      ctx.restore();

      const next = landmarks ? bodyAnchors(landmarks, settings.garmentType, width, height, mirrored) : null;
      anchorsRef.current = next ? (smooth ? smoothAnchors(anchorsRef.current, next) : next) : null;
      if (anchorsRef.current && garmentRef.current && showGarmentRef.current) {
        drawGarment(ctx, garmentRef.current, settings, anchorsRef.current, adjustRef.current);
      }
      return Boolean(next);
    },
    [settings]
  );

  const startCamera = useCallback(
    async (nextFacing: Facing = facing) => {
      stopCamera();
      photoRef.current = null;
      photoLandmarksRef.current = null;
      anchorsRef.current = null;
      setState('loading');
      setErrorMessage(null);
      setBodyFound(false);

      try {
        await prepare();
      } catch (e) {
        setErrorMessage((e as Error).message);
        setState('engine-error');
        return;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: nextFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (e: any) {
        const name = e?.name ?? '';
        if (name === 'NotAllowedError' || name === 'SecurityError') setState('camera-denied');
        else setState('camera-unavailable');
        return;
      }
      streamRef.current = stream;

      const video = videoRef.current ?? document.createElement('video');
      videoRef.current = video;
      video.playsInline = true;
      video.muted = true;
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        stopCamera();
        setErrorMessage('카메라 영상을 재생하지 못했습니다.');
        setState('engine-error');
        return;
      }

      setState('live');
      let lastFound = false;
      const loop = async () => {
        const tracker = trackerRef.current;
        if (!tracker || !streamRef.current) return;
        if (video.readyState >= 2 && video.videoWidth > 0) {
          const landmarks = await tracker.detectVideo(video).catch(() => null);
          if (!streamRef.current) return;
          const found = renderFrame(video, video.videoWidth, video.videoHeight, nextFacing === 'user', landmarks, true) ?? false;
          if (found !== lastFound) {
            lastFound = found;
            setBodyFound(found);
          }
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    },
    [facing, prepare, renderFrame, stopCamera]
  );

  const redrawPhoto = useCallback(() => {
    const photo = photoRef.current;
    if (!photo) return;
    renderFrame(photo, photo.naturalWidth, photo.naturalHeight, false, photoLandmarksRef.current, false);
  }, [renderFrame]);

  const handlePhoto = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      stopCamera();
      setState('loading');
      setErrorMessage(null);
      const url = URL.createObjectURL(file);
      try {
        await prepare();
        const photo = await loadImage(url);
        photoRef.current = photo;
        photoLandmarksRef.current = await trackerRef.current!.detectImage(photo);
        setState('photo');
        // Canvas is laid out by now; draw on the next frame.
        requestAnimationFrame(() => {
          redrawPhoto();
          setBodyFound(Boolean(anchorsRef.current));
        });
      } catch (err) {
        setErrorMessage((err as Error).message || '사진을 처리하지 못했습니다.');
        setState('engine-error');
      } finally {
        URL.revokeObjectURL(url);
      }
    },
    [prepare, redrawPhoto, stopCamera]
  );

  // Photo mode has no render loop — redraw when the adjustments change.
  useEffect(() => {
    if (state === 'photo') redrawPhoto();
  }, [state, fit, offsetY, showGarment, redrawPhoto]);

  const switchCamera = useCallback(() => {
    const next: Facing = facing === 'user' ? 'environment' : 'user';
    setFacing(next);
    startCamera(next);
  }, [facing, startCamera]);

  const capture = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) return;
      const filename = `lagi-tryon-${product.id}.png`;
      const file = new File([blob], filename, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'LAGI 가상 피팅' }).catch(() => undefined);
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }
    } finally {
      setSaving(false);
    }
  }, [product.id]);

  const handleExit = useCallback(() => {
    stopCamera();
    onExit();
  }, [onExit, stopCamera]);

  const active = state === 'live' || state === 'photo';
  const productName = product.name.value ?? product.id;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-ink text-paper">
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full ${state === 'photo' ? 'object-contain' : 'object-cover'} ${active ? '' : 'invisible'}`}
      />
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />

      <button
        type="button"
        onClick={handleExit}
        className="absolute right-4 top-4 z-20 eyebrow border border-paper/40 bg-ink/60 px-4 py-2.5 backdrop-blur focus-ring"
      >
        EXIT
      </button>

      {state === 'ready-to-start' && (
        <Overlay>
          <p className="eyebrow text-mist">VIRTUAL TRY-ON</p>
          <h2 className="mt-3 text-2xl font-medium">{productName}, 직접 입어보세요</h2>
          <p className="mt-3 max-w-xs text-sm text-mist/80">
            카메라에서 한두 걸음 떨어져 어깨부터 허리(하의는 무릎)까지 화면에 들어오게 서 주세요. 움직이면 옷이 따라
            움직입니다.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => startCamera()}
              className="eyebrow border border-paper px-7 py-4 hover:bg-paper hover:text-ink focus-ring"
            >
              카메라로 입어보기
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="eyebrow border border-paper/40 px-7 py-4 text-mist hover:border-paper hover:text-paper focus-ring"
            >
              전신 사진으로 입어보기
            </button>
          </div>
          <p className="mt-6 max-w-xs text-xs text-mist/60">
            영상과 사진은 이 기기 안에서만 처리되며 서버로 전송되지 않습니다.
          </p>
        </Overlay>
      )}

      {state === 'loading' && (
        <Overlay>
          <Spinner />
          <p className="eyebrow mt-4">신체 인식 준비 중</p>
        </Overlay>
      )}

      {state === 'camera-denied' && (
        <Overlay>
          <p className="eyebrow text-mist">카메라 권한 거부됨</p>
          <h2 className="mt-3 text-xl font-medium">카메라 접근이 차단되었습니다</h2>
          <p className="mt-3 max-w-xs text-sm text-mist/80">
            브라우저 설정에서 카메라 권한을 허용하거나, 전신 사진으로 입어볼 수 있습니다.
          </p>
          <ErrorActions onRetry={() => startCamera()} onPhoto={() => fileInputRef.current?.click()} />
        </Overlay>
      )}

      {state === 'camera-unavailable' && (
        <Overlay>
          <p className="eyebrow text-mist">카메라 없음</p>
          <h2 className="mt-3 text-xl font-medium">사용 가능한 카메라를 찾을 수 없습니다</h2>
          <p className="mt-3 max-w-xs text-sm text-mist/80">전신 사진을 올려 입어볼 수 있습니다.</p>
          <ErrorActions onRetry={() => startCamera()} onPhoto={() => fileInputRef.current?.click()} />
        </Overlay>
      )}

      {state === 'engine-error' && (
        <Overlay>
          <p className="eyebrow text-mist">오류</p>
          <h2 className="mt-3 text-xl font-medium">가상 피팅을 시작하지 못했습니다</h2>
          <p className="mt-3 max-w-xs text-sm text-mist/80">{errorMessage ?? '알 수 없는 오류가 발생했습니다.'}</p>
          <ErrorActions onRetry={() => startCamera()} onPhoto={() => fileInputRef.current?.click()} />
        </Overlay>
      )}

      {active && !bodyFound && (
        <div className="pointer-events-none absolute inset-x-0 top-1/3 z-10 flex justify-center px-8 text-center">
          <p className="rounded-full bg-ink/70 px-5 py-3 text-sm text-paper">
            {state === 'photo'
              ? '사진에서 몸을 찾지 못했습니다. 상반신이 정면으로 나온 사진을 사용해 주세요.'
              : settings.garmentType === 'BOTTOM'
                ? '허리와 골반이 화면에 보이도록 뒤로 물러나 주세요'
                : '어깨가 화면에 모두 보이도록 뒤로 물러나 주세요'}
          </p>
        </div>
      )}

      {active && (
        <>
          <p className="pointer-events-none absolute left-4 top-5 z-10 max-w-[60%] truncate rounded-full bg-paper px-4 py-2 text-xs font-bold text-ink">
            {productName}
          </p>

          {showAdjust && (
            <div className="absolute inset-x-4 bottom-28 z-20 mx-auto max-w-sm space-y-4 bg-ink/80 p-5 backdrop-blur">
              <Slider label="크기" value={fit} min={0.7} max={1.5} step={0.01} onChange={setFit} />
              <Slider label="위치 (위 ↔ 아래)" value={offsetY} min={-0.6} max={0.6} step={0.01} onChange={setOffsetY} />
              <button
                type="button"
                onClick={() => {
                  setFit(1);
                  setOffsetY(0);
                }}
                className="eyebrow text-mist hover:text-paper focus-ring"
              >
                초기화
              </button>
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 z-10 flex flex-wrap justify-center gap-2 p-4">
            <ControlButton
              onPointerDown={() => setShowGarment(false)}
              onPointerUp={() => setShowGarment(true)}
              onPointerLeave={() => setShowGarment(true)}
            >
              누르고 비교
            </ControlButton>
            <ControlButton onClick={() => setShowAdjust((v) => !v)} pressed={showAdjust}>
              핏 조절
            </ControlButton>
            {state === 'live' ? (
              <ControlButton onClick={switchCamera}>카메라 전환</ControlButton>
            ) : (
              <ControlButton onClick={() => startCamera()}>카메라로</ControlButton>
            )}
            <ControlButton onClick={() => fileInputRef.current?.click()}>사진 올리기</ControlButton>
            <button
              type="button"
              onClick={capture}
              disabled={saving}
              className="eyebrow bg-paper px-5 py-3 text-ink hover:bg-mist focus-ring disabled:opacity-50"
            >
              {saving ? '저장 중' : '촬영 · 저장'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Keeps the canvas exportable when the garment is served from another origin with CORS.
    if (!src.startsWith('blob:') && !src.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지를 불러오지 못했습니다.'));
    img.src = src;
  });
}

function ControlButton({
  children,
  pressed,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pressed?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      {...props}
      className={`eyebrow select-none border px-4 py-3 backdrop-blur focus-ring ${
        pressed ? 'border-paper bg-paper/20' : 'border-paper/50 bg-ink/60 hover:border-paper'
      }`}
    >
      {children}
    </button>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="eyebrow text-mist">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-paper"
      />
    </label>
  );
}

function ErrorActions({ onRetry, onPhoto }: { onRetry: () => void; onPhoto: () => void }) {
  return (
    <div className="mt-8 flex flex-wrap justify-center gap-3">
      <button type="button" onClick={onRetry} className="eyebrow border border-paper px-7 py-4 hover:bg-paper hover:text-ink focus-ring">
        다시 시도
      </button>
      <button
        type="button"
        onClick={onPhoto}
        className="eyebrow border border-paper/40 px-7 py-4 text-mist hover:border-paper hover:text-paper focus-ring"
      >
        사진으로 입어보기
      </button>
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-ink/90 px-8 text-center">
      {children}
    </div>
  );
}

function Spinner() {
  return <div className="h-8 w-8 animate-spin rounded-full border-2 border-paper/30 border-t-paper" aria-hidden="true" />;
}
