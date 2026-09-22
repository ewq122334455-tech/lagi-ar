import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimationMixer, Clock, Raycaster, Vector2 } from 'three';
import type { AnimationAction } from 'three';
import type { Product } from '@/data/productTypes';
import { MindARProvider } from './MindARProvider';
import { ARStartError } from './ARProvider';
import { loadARModel } from './arModelLoader';
import { buildHotspotMarkers, findHotspotId } from './arHotspotMarkers';
import { SpotlightPanel } from '@/components/SpotlightPanel';

type ARState =
  | 'ready-to-start'
  | 'requesting-camera'
  | 'camera-denied'
  | 'camera-unavailable'
  | 'model-loading'
  | 'model-error'
  | 'scanning'
  | 'found'
  | 'engine-error';

interface ARExperienceProps {
  product: Product;
  onExit: () => void;
}

export function ARExperience({ product, onExit }: ARExperienceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const providerRef = useRef<MindARProvider | null>(null);
  const mixerRef = useRef<AnimationMixer | null>(null);
  const actionsRef = useRef<Record<string, AnimationAction>>({});
  const markersRef = useRef<ReturnType<typeof buildHotspotMarkers> | null>(null);
  const rafRef = useRef<number | null>(null);

  const [state, setState] = useState<ARState>('ready-to-start');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);

  const cleanup = useCallback(async () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    await providerRef.current?.stop();
    providerRef.current = null;
    mixerRef.current = null;
    actionsRef.current = {};
    markersRef.current = null;
  }, []);

  useEffect(() => () => { cleanup(); }, [cleanup]);

  const handleExit = useCallback(async () => {
    await cleanup();
    onExit();
  }, [cleanup, onExit]);

  const handleStart = useCallback(async () => {
    if (!containerRef.current) return;
    setState('requesting-camera');
    setErrorMessage(null);

    const provider = new MindARProvider();
    providerRef.current = provider;

    try {
      const { group } = await provider.start(containerRef.current, product.arTarget);

      setState('model-loading');
      const { scene, animations } = await loadARModel(product.model3D, product.arSettings);
      group.add(scene);

      if (animations.length > 0) {
        const mixer = new AnimationMixer(scene);
        mixerRef.current = mixer;
        animations.forEach((clip) => {
          actionsRef.current[clip.name] = mixer.clipAction(clip);
        });
      }

      if (product.hotspots.length > 0) {
        const markers = buildHotspotMarkers(product.hotspots);
        markersRef.current = markers;
        group.add(markers.root);
      }

      provider.onTargetFound(() => setState('found'));
      provider.onTargetLost(() => setState('scanning'));

      setState('scanning');

      const clock = new Clock();
      const loop = () => {
        const delta = clock.getDelta();
        mixerRef.current?.update(delta);
        provider.tick();
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch (err) {
      if (err instanceof ARStartError) {
        if (err.reason === 'CAMERA_PERMISSION_DENIED') setState('camera-denied');
        else if (err.reason === 'CAMERA_UNAVAILABLE') setState('camera-unavailable');
        else {
          setState('engine-error');
          setErrorMessage(err.message);
        }
      } else {
        setState('model-error');
        setErrorMessage('3D 모델을 불러오지 못했습니다.');
      }
    }
  }, [product]);

  const handleTap = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const provider = providerRef.current as any;
      if (!provider?.engine || !markersRef.current) return;
      const rect = containerRef.current!.getBoundingClientRect();
      const pointer = new Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new Raycaster();
      raycaster.setFromCamera(pointer, provider.engine.camera);
      const hits = raycaster.intersectObjects(markersRef.current.root.children, true);
      if (hits.length > 0) {
        const id = findHotspotId(hits[0].object);
        if (id) setSelectedHotspotId(id);
      }
    },
    []
  );

  useEffect(() => {
    markersRef.current?.setActive(selectedHotspotId);
  }, [selectedHotspotId]);

  const runAnimation = useCallback((clipName: string) => {
    Object.values(actionsRef.current).forEach((a) => a.stop());
    actionsRef.current[clipName]?.reset().play();
  }, []);

  const selectedHotspot = product.hotspots.find((h) => h.id === selectedHotspotId) ?? null;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-ink text-paper">
      <div ref={containerRef} className="absolute inset-0" onPointerDown={handleTap} />

      {/* EXIT — always available */}
      <button
        type="button"
        onClick={handleExit}
        className="absolute right-4 top-4 z-20 eyebrow border border-paper/40 bg-ink/60 px-4 py-2.5 backdrop-blur focus-ring"
      >
        EXIT
      </button>

      {state === 'ready-to-start' && (
        <Overlay>
          <p className="eyebrow text-mist">WEB AR</p>
          <h2 className="mt-3 text-2xl font-medium">카메라로 LAGI 제품을 스캔하세요</h2>
          <p className="mt-3 max-w-xs text-sm text-mist/80">
            카메라 접근 권한이 필요합니다. 실물 제품을 화면 안에 비춰주세요.
          </p>
          <button
            type="button"
            onClick={handleStart}
            className="eyebrow mt-8 border border-paper px-7 py-4 hover:bg-paper hover:text-ink focus-ring"
          >
            카메라 시작
          </button>
        </Overlay>
      )}

      {state === 'requesting-camera' && (
        <Overlay>
          <Spinner />
          <p className="eyebrow mt-4">카메라 권한 요청 중</p>
        </Overlay>
      )}

      {state === 'model-loading' && (
        <Overlay>
          <Spinner />
          <p className="eyebrow mt-4">3D 모델 준비 중</p>
        </Overlay>
      )}

      {state === 'camera-denied' && (
        <Overlay>
          <p className="eyebrow text-mist">카메라 권한 거부됨</p>
          <h2 className="mt-3 text-xl font-medium">카메라 접근이 차단되었습니다</h2>
          <p className="mt-3 max-w-xs text-sm text-mist/80">
            브라우저 설정에서 이 사이트의 카메라 권한을 허용한 뒤 다시 시도해 주세요.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={handleStart} className="eyebrow border border-paper px-7 py-4 hover:bg-paper hover:text-ink focus-ring">
              다시 시도
            </button>
            <button type="button" onClick={handleExit} className="eyebrow border border-paper/40 px-7 py-4 text-mist hover:border-paper hover:text-paper focus-ring">
              VIEW IN 3D
            </button>
          </div>
        </Overlay>
      )}

      {state === 'camera-unavailable' && (
        <Overlay>
          <p className="eyebrow text-mist">AR IS NOT SUPPORTED ON THIS DEVICE</p>
          <h2 className="mt-3 text-xl font-medium">사용 가능한 카메라를 찾을 수 없습니다</h2>
          <p className="mt-3 max-w-xs text-sm text-mist/80">카메라가 있는 모바일 기기의 브라우저에서 열어주세요.</p>
          <button type="button" onClick={handleExit} className="eyebrow mt-8 border border-paper px-7 py-4 hover:bg-paper hover:text-ink focus-ring">
            VIEW IN 3D
          </button>
        </Overlay>
      )}

      {(state === 'engine-error' || state === 'model-error') && (
        <Overlay>
          <p className="eyebrow text-mist">오류</p>
          <h2 className="mt-3 text-xl font-medium">AR을 시작하지 못했습니다</h2>
          <p className="mt-3 max-w-xs text-sm text-mist/80">{errorMessage ?? '알 수 없는 오류가 발생했습니다.'}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={handleStart} className="eyebrow border border-paper px-7 py-4 hover:bg-paper hover:text-ink focus-ring">
              다시 시도
            </button>
            <button type="button" onClick={handleExit} className="eyebrow border border-paper/40 px-7 py-4 text-mist hover:border-paper hover:text-paper focus-ring">
              VIEW IN 3D
            </button>
          </div>
        </Overlay>
      )}

      {state === 'scanning' && (
        <div className="pointer-events-none absolute inset-x-0 top-1/3 z-10 flex flex-col items-center gap-3 text-center">
          <div className="h-48 w-48 rounded-full border border-paper/50" />
          <p className="eyebrow">SCAN THE PRODUCT</p>
        </div>
      )}

      {state === 'found' && (
        <>
          <p className="absolute left-1/2 top-6 z-10 -translate-x-1/2 eyebrow bg-paper px-3 py-1.5 text-ink">
            PRODUCT FOUND
          </p>

          <SpotlightPanel hotspot={selectedHotspot} onClose={() => setSelectedHotspotId(null)} />

          <div className="absolute inset-x-0 bottom-0 z-10 flex flex-wrap justify-center gap-2 p-4">
            {product.hotspots.length > 0 && (
              <>
                {['MATERIAL', 'DETAIL', 'PROCESS'].map((cat) => {
                  const match = product.hotspots.find((h) => h.category === cat);
                  if (!match) return null;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedHotspotId(match.id)}
                      className="eyebrow border border-paper/50 bg-ink/60 px-4 py-3 backdrop-blur hover:border-paper focus-ring"
                    >
                      {cat}
                    </button>
                  );
                })}
              </>
            )}
            {product.animations.some((a) => a.id === 'open') && (
              <button
                type="button"
                onClick={() => runAnimation(product.animations.find((a) => a.id === 'open')!.clipName)}
                className="eyebrow border border-paper/50 bg-ink/60 px-4 py-3 backdrop-blur hover:border-paper focus-ring"
              >
                OPEN
              </button>
            )}
            {product.animations.some((a) => a.id === 'close') && (
              <button
                type="button"
                onClick={() => runAnimation(product.animations.find((a) => a.id === 'close')!.clipName)}
                className="eyebrow border border-paper/50 bg-ink/60 px-4 py-3 backdrop-blur hover:border-paper focus-ring"
              >
                CLOSE
              </button>
            )}
          </div>
        </>
      )}
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
