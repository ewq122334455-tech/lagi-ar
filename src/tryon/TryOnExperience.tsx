import { useCallback, useEffect, useRef, useState } from 'react';
import type { CarryStyle, Product, TryOnSettings } from '@/data/productTypes';
import { CARRY_STYLE_LABELS } from '@/utils/tryOnAvailability';
import { PoseTracker } from './PoseTracker';
import type { BodyLandmark } from './PoseTracker';
import { bodyPoints, drawGarment, smoothPoints } from './garmentFit';
import { CARRY_PROMPTS, aiTryOnEnabled, requestAiTryOn } from './aiTryOn';
import { PersonSegmenter } from './PersonSegmenter';
import type { PersonMasks } from './PersonSegmenter';
import { BagSway, RealismCompositor } from './realism';
import { fetchCutout } from './cutouts';
import type { BodyPoints, FitAdjust, ScreenSide } from './garmentFit';

type TryOnState = 'ready-to-start' | 'loading' | 'camera-denied' | 'camera-unavailable' | 'engine-error' | 'live' | 'photo';

type Facing = 'user' | 'environment';

const CARRY_ORDER: CarryStyle[] = ['HAND', 'SHOULDER', 'CROSSBODY'];

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
export function TryOnExperience({ product, settings: rawSettings, onExit }: TryOnExperienceProps) {
  const isBag = rawSettings.garmentType === 'BAG';
  // A bag is sized from its real width: the try-on setting first, then the product's recorded dimensions.
  const [settings] = useState<TryOnSettings>(() => ({
    ...rawSettings,
    realWidthCm: rawSettings.realWidthCm || product.dimensions.widthCm,
  }));
  // Swapped for the stored photoreal cut-out when there is one (see the cut-out studio).
  const settingsRef = useRef(settings);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackerRef = useRef<PoseTracker | null>(null);
  const garmentRef = useRef<HTMLImageElement | null>(null);
  const photoRef = useRef<HTMLImageElement | null>(null);
  const photoLandmarksRef = useRef<BodyLandmark[] | null>(null);
  const pointsRef = useRef<BodyPoints | null>(null);
  const rafRef = useRef<number | null>(null);
  const adjustRef = useRef<FitAdjust>({
    fit: 1,
    offsetY: 0,
    carry: 'SHOULDER',
    side: 'R',
  });
  const showGarmentRef = useRef(true);
  const segmenterRef = useRef<PersonSegmenter | null>(null);
  const masksRef = useRef<PersonMasks | null>(null);
  const compositorRef = useRef<RealismCompositor | null>(null);
  const swayRef = useRef(new BagSway());
  const hangRef = useRef<{ pivot: { x: number; y: number }; height: number } | null>(null);
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
  const [carry, setCarry] = useState<CarryStyle>(rawSettings.carry ?? 'SHOULDER');
  const [side, setSide] = useState<ScreenSide>('R');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const canAi = aiTryOnEnabled(product);

  adjustRef.current = { fit, offsetY, carry, side };
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
      segmenterRef.current?.close();
      segmenterRef.current = null;
    },
    [stopCamera],
  );

  /** Loads the garment image and pose model once; both are reused across camera/photo modes. */
  const prepare = useCallback(async () => {
    if (!garmentRef.current) {
      const cutout = await fetchCutout(product.id);
      if (cutout) settingsRef.current = { ...settings, garmentImage: cutout.image, anchorLeft: cutout.anchorLeft, anchorRight: cutout.anchorRight };
      garmentRef.current = await loadImage(settingsRef.current.garmentImage).catch(() => {
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
    if (!segmenterRef.current) {
      // Optional: without it the garment is still drawn, just without silhouette/occlusion.
      const segmenter = new PersonSegmenter();
      segmenterRef.current = await segmenter.load().then(
        () => segmenter,
        () => null,
      );
    }
  }, [settings, product.id]);

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

      const next = landmarks ? bodyPoints(landmarks, width, height, mirrored) : null;
      pointsRef.current = next ? (smooth ? smoothPoints(pointsRef.current, next) : next) : null;
      const points = pointsRef.current;
      if (!points || !garmentRef.current) return false;

      // The garment goes onto its own layer first so it can be lit, shaded and tucked behind
      // the face and hands before it joins the picture.
      compositorRef.current ??= new RealismCompositor();
      const comp = compositorRef.current;
      const layer = comp.begin(width, height);
      const current = settingsRef.current;
      const isBag = current.garmentType === 'BAG';
      const hang = hangRef.current;
      const sway = isBag && smooth ? swayRef.current.update(hang?.pivot ?? null, hang?.height ?? 0) : 0;
      hangRef.current = null;
      const placed = drawGarment(layer, garmentRef.current, current, points, {
        ...adjustRef.current,
        sway,
        onHang: (pivot, h) => (hangRef.current = { pivot, height: h }),
      });
      // While comparing, the placement still runs (invisibly) so the "step back" guidance does not flash.
      if (placed && showGarmentRef.current) {
        const a = adjustRef.current;
        const span =
          points.shoulderL && points.shoulderR
            ? Math.hypot(points.shoulderR.x - points.shoulderL.x, points.shoulderR.y - points.shoulderL.y)
            : width * 0.25;
        comp.finish(ctx, source, width, height, mirrored, {
          kind: isBag ? 'BAG' : current.garmentType === 'BOTTOM' ? 'BOTTOM' : 'TOP',
          masks: masksRef.current,
          span,
          hand: isBag && a.carry === 'HAND' ? (a.side === 'L' ? points.handL : points.handR) : null,
        });
      }
      return placed;
    },
    [],
  );

  const startCamera = useCallback(
    async (nextFacing: Facing = facing) => {
      stopCamera();
      photoRef.current = null;
      photoLandmarksRef.current = null;
      pointsRef.current = null;
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
          video: {
            facingMode: nextFacing,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
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
      swayRef.current.reset();
      masksRef.current = null;
      let lastFound = false;
      let frame = 0;
      const loop = async () => {
        const tracker = trackerRef.current;
        if (!tracker || !streamRef.current) return;
        if (video.readyState >= 2 && video.videoWidth > 0) {
          const landmarks = await tracker.detectVideo(video).catch(() => null);
          // The body outline changes slowly; refreshing it every other frame keeps phones smooth.
          if (segmenterRef.current && frame++ % 2 === 0) {
            masksRef.current = (await segmenterRef.current.segmentVideo(video).catch(() => null)) ?? masksRef.current;
          }
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
    [facing, prepare, renderFrame, stopCamera],
  );

  const redrawPhoto = useCallback(() => {
    const photo = photoRef.current;
    if (!photo) return;
    setBodyFound(renderFrame(photo, photo.naturalWidth, photo.naturalHeight, false, photoLandmarksRef.current, false) ?? false);
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
        masksRef.current = (await segmenterRef.current?.segmentImage(photo).catch(() => null)) ?? null;
        setState('photo');
        // Canvas is laid out by now; draw on the next frame.
        requestAnimationFrame(redrawPhoto);
      } catch (err) {
        setErrorMessage((err as Error).message || '사진을 처리하지 못했습니다.');
        setState('engine-error');
      } finally {
        URL.revokeObjectURL(url);
      }
    },
    [prepare, redrawPhoto, stopCamera],
  );

  // Photo mode has no render loop — redraw when the adjustments change.
  useEffect(() => {
    if (state === 'photo') redrawPhoto();
  }, [state, fit, offsetY, showGarment, carry, side, redrawPhoto]);

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
      if (blob) await shareBlob(blob, `lagi-tryon-${product.id}.png`, 'LAGI 가상 피팅');
    } finally {
      setSaving(false);
    }
  }, [product.id]);

  /** The current camera frame (or uploaded photo) without the overlay, as the AI's person photo. */
  const personFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const photo = photoRef.current;
    const live = state === 'live' && video && video.videoWidth > 0;
    const src: CanvasImageSource | null = live ? video : photo;
    const w = live ? video.videoWidth : (photo?.naturalWidth ?? 0);
    const h = live ? video.videoHeight : (photo?.naturalHeight ?? 0);
    if (!src || !w || !h) return null;
    const scale = Math.min(1, 1280 / Math.max(w, h));
    const out = document.createElement('canvas');
    out.width = Math.round(w * scale);
    out.height = Math.round(h * scale);
    const ctx = out.getContext('2d')!;
    // Keep what the visitor sees: the selfie camera is shown mirrored.
    if (live && facing === 'user') {
      ctx.translate(out.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(src, 0, 0, out.width, out.height);
    return out.toDataURL('image/jpeg', 0.9);
  }, [state, facing]);

  const runAi = useCallback(async () => {
    const person = personFrame();
    if (!person) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const where = side === 'R' ? 'on the right side of the photo' : 'on the left side of the photo';
      const style = isBag ? `${CARRY_PROMPTS[carry]}, ${where}` : undefined;
      setAiResult(await requestAiTryOn({ person, product, style }));
    } catch (e) {
      setAiError((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  }, [personFrame, side, isBag, carry, product]);

  // Live camera: count down 3-2-1 so the visitor can step back and pose; a photo goes straight away.
  const startAi = useCallback(() => {
    if (state === 'live') setCountdown(3);
    else runAi();
  }, [state, runAi]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      runAi();
      return;
    }
    const t = window.setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => window.clearTimeout(t);
  }, [countdown, runAi]);

  const saveAi = useCallback(async () => {
    if (!aiResult) return;
    const blob = await (await fetch(aiResult)).blob();
    await shareBlob(blob, `lagi-ai-fit-${product.id}.png`, 'LAGI AI 피팅');
  }, [aiResult, product.id]);

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
            {isBag
              ? '카메라에서 한두 걸음 떨어져 어깨부터 골반, 손까지 화면에 들어오게 서 주세요. 손에 들기·어깨에 메기·크로스로 메기를 바꿔볼 수 있습니다.'
              : '카메라에서 한두 걸음 떨어져 어깨부터 허리(하의는 무릎)까지 화면에 들어오게 서 주세요. 움직이면 옷이 따라 움직입니다.'}
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
            실시간 화면은 이 기기 안에서만 처리됩니다. ‘AI로 진짜처럼 찍기’를 누를 때만 그 순간의 사진 한 장이 AI 합성을 위해 전송되며,
            저장되지 않습니다.
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
              : isBag && carry === 'HAND'
                ? '어깨와 가방을 들 손이 화면에 보이도록 서 주세요'
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
            <div className="absolute inset-x-4 bottom-44 z-20 mx-auto max-w-sm space-y-4 bg-ink/80 p-5 backdrop-blur">
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

          <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 p-4">
            {canAi && (
              <button
                type="button"
                onClick={startAi}
                disabled={aiBusy || countdown !== null}
                className="rounded-full bg-lime px-7 py-4 text-base font-bold text-ink shadow-lg hover:brightness-95 focus-ring disabled:opacity-60"
              >
                ✦ AI로 진짜처럼 찍기
              </button>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              <ControlButton
                onPointerDown={() => setShowGarment(false)}
                onPointerUp={() => setShowGarment(true)}
                onPointerLeave={() => setShowGarment(true)}
              >
                누르고 비교
              </ControlButton>
              {isBag && (
                <>
                  <ControlButton onClick={() => setCarry((c) => CARRY_ORDER[(CARRY_ORDER.indexOf(c) + 1) % CARRY_ORDER.length])}>
                    {CARRY_STYLE_LABELS[carry]}
                  </ControlButton>
                  <ControlButton onClick={() => setSide((v) => (v === 'L' ? 'R' : 'L'))}>좌우 바꾸기</ControlButton>
                </>
              )}
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
                {saving ? '저장 중' : '화면 저장'}
              </button>
            </div>
          </div>
        </>
      )}

      {countdown !== null && countdown > 0 && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <span
            key={countdown}
            className="text-[30vw] font-bold leading-none text-paper drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)] lg:text-[16vw]"
          >
            {countdown}
          </span>
        </div>
      )}

      {aiBusy && (
        <Overlay>
          <Spinner />
          <p className="mt-4 text-base font-semibold">AI가 착용 사진을 만드는 중… (10~40초)</p>
          <p className="mt-2 text-sm text-mist/70">카메라는 그대로 두셔도 돼요.</p>
        </Overlay>
      )}

      {aiError && !aiBusy && (
        <div className="absolute inset-x-4 top-20 z-30 mx-auto flex max-w-sm items-start gap-3 rounded-lg bg-orange px-4 py-3 text-sm text-paper">
          <p className="flex-1">{aiError}</p>
          <button type="button" onClick={() => setAiError(null)} className="font-bold focus-ring" aria-label="닫기">
            ✕
          </button>
        </div>
      )}

      {aiResult && (
        <div className="absolute inset-0 z-40 flex flex-col bg-ink">
          <img src={aiResult} alt="AI 피팅 결과" className="min-h-0 flex-1 object-contain" />
          <div className="flex flex-wrap justify-center gap-2 p-4">
            <button
              type="button"
              onClick={saveAi}
              className="rounded-full bg-paper px-6 py-3 text-sm font-bold text-ink hover:bg-mist focus-ring"
            >
              사진 저장 · 공유
            </button>
            <button
              type="button"
              onClick={() => setAiResult(null)}
              className="rounded-full border border-paper/60 px-6 py-3 text-sm font-bold hover:border-paper focus-ring"
            >
              다시 찍기
            </button>
          </div>
          <p className="pb-4 text-center text-xs text-mist/60">AI가 만든 참고용 이미지라 실제 크기·색감과 다를 수 있어요.</p>
        </div>
      )}
    </div>
  );
}

async function shareBlob(blob: Blob, filename: string, title: string) {
  const file = new File([blob], filename, { type: blob.type || 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title }).catch(() => undefined);
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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

function ControlButton({ children, pressed, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { pressed?: boolean }) {
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
  return <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-ink/90 px-8 text-center">{children}</div>;
}

function Spinner() {
  return <div className="h-8 w-8 animate-spin rounded-full border-2 border-paper/30 border-t-paper" aria-hidden="true" />;
}
