import { useEffect, useRef, useState } from 'react';
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import type { Product } from '@/data/productTypes';
import { AI_TRYON_URL, requestAiTryOn } from '@/tryon/aiTryOn';
import { keyMatte, loadPose, paint, placeFor, smooth, type Placement, type Pt } from './productOverlay';
import { buildBag, createBagLayer } from './bag3d';

type Phase = 'idle' | 'loading' | 'live' | 'ended';

/** Ways of wearing where the hand holds the product, so the hand is drawn back over it. */
const HELD = new Set(['hand', 'elbow', 'acc-hand', 'acc-show']);

function productUrl(p: Product) {
  const base = `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}`;
  return new URL(p.images[0], base).toString();
}

async function matteFor(p: Product): Promise<HTMLCanvasElement> {
  const res = await fetch(`${AI_TRYON_URL}/cutout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productImage: productUrl(p), matte: true }),
  }).catch(() => {
    throw new Error('제품 이미지를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
  });
  const body = (await res.json().catch(() => ({}))) as { matte?: string; error?: string };
  if (!res.ok || !body.matte) throw new Error(body.error ?? '제품 이미지를 준비하지 못했습니다.');
  return keyMatte(body.matte);
}

/**
 * Live try-on by image mapping: the visitor's camera, body tracking in the browser (MediaPipe), and
 * the real product photo placed and scaled on the body — its shape and print stay exactly as they are.
 * Nothing leaves the device except the product image request; no time limit, no cost.
 */
export function MapTryOn({ product, styleKey, stylePrompt, styleChips }: { product: Product | undefined; styleKey: string; stylePrompt: string; styleChips: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [size, setSize] = useState(1);
  const [found, setFound] = useState(true);
  const [exact, setExact] = useState<{ busy: boolean; image?: string; error?: string }>({ busy: false });
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  // Products with a 3D model: the bag is rendered in 3D (it turns with the body) on a WebGL layer,
  // and the holding hand is drawn on a layer above it.
  const gl = useRef<HTMLCanvasElement>(null);
  const top = useRef<HTMLCanvasElement>(null);
  const layer = useRef<{ id: string; l: ReturnType<typeof createBagLayer>; aspect: number } | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const pose = useRef<Promise<PoseLandmarker> | null>(null);
  const matte = useRef<{ id: string; img: HTMLCanvasElement } | null>(null);
  const placed = useRef<Placement | null>(null);
  // Live values the drawing loop reads without restarting.
  const opts = useRef({ styleKey, size, product, facing });
  opts.current = { styleKey, size, product, facing };

  const stop = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    placed.current = null;
    setPhase((p) => (p === 'idle' ? p : 'ended'));
  };
  useEffect(() => stop, []);
  useEffect(() => {
    const onHide = () => document.hidden && stop();
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  // A different product while live: fetch its image; the loop picks it up.
  useEffect(() => {
    if (phase !== 'live' || !product || matte.current?.id === product.id) return;
    let alive = true;
    setStatus('제품 이미지를 준비하고 있습니다…');
    matteFor(product)
      .then((img) => {
        if (alive) matte.current = { id: product.id, img };
      })
      .catch((e) => alive && setError((e as Error).message))
      .finally(() => alive && setStatus(null));
    return () => {
      alive = false;
    };
  }, [phase, product]);

  async function start() {
    if (!product || phase === 'loading') return;
    setError(null);
    setExact({ busy: false });
    setPhase('loading');
    try {
      setStatus('카메라를 켜고 있습니다…');
      const s = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } } });
      stream.current = s;
      const v = video.current!;
      v.srcObject = s;
      await v.play().catch(() => undefined);
      setStatus('몸 인식 모델과 제품 이미지를 불러오고 있습니다…');
      pose.current ??= loadPose();
      const model = product.model3d;
      const [marker, img] = await Promise.all([
        pose.current,
        model ? Promise.resolve(null) : matte.current?.id === product.id ? Promise.resolve(matte.current.img) : matteFor(product),
      ]);
      if (img) matte.current = { id: product.id, img };
      if (model && layer.current?.id !== product.id) {
        layer.current?.l.dispose();
        const base = `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}`;
        const bag = await buildBag(model, base);
        layer.current = { id: product.id, l: createBagLayer(gl.current!, bag), aspect: model.widthCm / (model.heightCm + model.handleCm) };
      }
      setStatus(null);
      setPhase('live');
      run(marker);
    } catch (e) {
      stop();
      setPhase('idle');
      setStatus(null);
      pose.current = null;
      const name = (e as DOMException)?.name;
      setError(
        name === 'NotAllowedError'
          ? '카메라 권한이 꺼져 있습니다. 주소창의 카메라 설정에서 허용한 뒤 다시 시도해 주세요.'
          : name === 'NotFoundError'
            ? '사용할 수 있는 카메라를 찾지 못했습니다.'
            : (e as Error).message || '실시간 착용을 시작하지 못했습니다.',
      );
    }
  }

  /** The drawing loop: mirrored camera frame, product on the body, then the holding hand on top. */
  function run(marker: PoseLandmarker) {
    const v = video.current;
    const c = canvas.current;
    if (!v || !c) return;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    const raw = document.createElement('canvas');
    const rctx = raw.getContext('2d', { willReadFrequently: true })!;
    let lm: Pt[] | null = null;
    let yaw = 0;
    let brightness = 0.6;
    let tick = 0;
    const tctx = top.current?.getContext('2d');
    let mask: { data: Float32Array; w: number; h: number } | null = null;
    let lastDetect = 0;
    let lastT = -1;
    let misses = 0;

    const frame = (now: number) => {
      if (!stream.current) return;
      requestAnimationFrame(frame);
      const W = v.videoWidth;
      const H = v.videoHeight;
      if (!W || !H) return;
      if (c.width !== W || c.height !== H) {
        c.width = raw.width = W;
        c.height = raw.height = H;
        if (top.current) {
          top.current.width = W;
          top.current.height = H;
        }
      }
      const { styleKey: style, size: sz, product: p, facing: f } = opts.current;
      const mirrored = f === 'user';
      rctx.save();
      if (mirrored) {
        rctx.translate(W, 0);
        rctx.scale(-1, 1);
      }
      rctx.drawImage(v, 0, 0, W, H);
      rctx.restore();
      ctx.drawImage(raw, 0, 0);

      if (now - lastDetect > 45 && v.currentTime !== lastT) {
        lastDetect = now;
        lastT = v.currentTime;
        const res = marker.detectForVideo(v, now);
        const l = res.landmarks[0];
        lm = l ? l.map((q) => ({ x: (mirrored ? 1 - q.x : q.x) * W, y: q.y * H, visibility: q.visibility })) : null;
        // Body turn from the 3D landmarks (metres): the shoulder line's depth gives the yaw.
        const wl = res.worldLandmarks?.[0];
        if (wl) {
          const dx = wl[12].x - wl[11].x;
          const dz = wl[12].z - wl[11].z;
          const target = Math.max(-1.3, Math.min(1.3, Math.atan2(dz, Math.abs(dx)) * (mirrored ? -1 : 1) * Math.sign(dx || 1) * -1));
          yaw += (target - yaw) * 0.35;
        }
        const m = res.segmentationMasks?.[0];
        mask = m ? { data: m.getAsFloat32Array().slice(), w: m.width, h: m.height } : null;
        res.segmentationMasks?.forEach((x) => x.close());
        misses = lm ? 0 : misses + 1;
        setFound(misses < 10);
      }
      // Scene brightness now and then, so the 3D bag is lit like the room.
      if (++tick % 30 === 1) {
        const px = rctx.getImageData(W >> 2, H >> 2, 8, 8).data;
        let L = 0;
        for (let i = 0; i < px.length; i += 4) L += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        brightness = Math.min(1, L / (px.length / 4) / 200);
      }
      const l3 = p && layer.current?.id === p.id ? layer.current : null;
      const img = p && matte.current?.id === p.id ? matte.current.img : null;
      const out = l3 ? tctx ?? ctx : ctx;
      if (tctx && top.current) tctx.clearRect(0, 0, top.current.width, top.current.height);
      if (!lm || !p || (!img && !l3)) {
        l3?.l.render(W, H, null);
        return;
      }
      const kind = (p.category.value ?? '').toLowerCase().includes('bag') ? 'bag' : 'acc';
      const next = placeFor(style, kind, lm, l3 ? l3.aspect : img!.width / img!.height, p.dimensions.widthCm ?? undefined, sz);
      if (!next) {
        l3?.l.render(W, H, null);
        return;
      }
      placed.current = smooth(placed.current, next);
      if (l3) l3.l.render(W, H, { x: placed.current.cx, y: placed.current.top, widthPx: placed.current.w, yaw, roll: placed.current.rot, brightness });
      else paint(ctx, img!, placed.current, { s: 1, ox: 0, oy: 0 });

      // The holding hand goes back on top of the handles: person pixels from the mask, around the wrist.
      const held = HELD.has(kind === 'acc' ? `acc-${style}` : style);
      if (held && mask) {
        const useRight = (lm[16]?.visibility ?? 0) > 0.5 && ((lm[15]?.visibility ?? 0) <= 0.5 || lm[16].y >= lm[15].y);
        const wr = lm[useRight ? 16 : 15];
        const sh = Math.hypot(lm[11].x - lm[12].x, lm[11].y - lm[12].y);
        const r = Math.max(24, sh * 0.2);
        const x0 = Math.max(0, Math.floor(wr.x - r));
        const y0 = Math.max(0, Math.floor(wr.y - r));
        const w = Math.min(W - x0, Math.ceil(r * 2));
        const h = Math.min(H - y0, Math.ceil(r * 2));
        if (w > 0 && h > 0) {
          const patch = rctx.getImageData(x0, y0, w, h);
          const d = patch.data;
          const sx = mask.w / W;
          const sy = mask.h / H;
          for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
              const px = x0 + x;
              const py = y0 + y;
              const mx = Math.min(mask.w - 1, Math.floor((mirrored ? W - 1 - px : px) * sx));
              const my = Math.min(mask.h - 1, Math.floor(py * sy));
              const person = mask.data[my * mask.w + mx];
              const dist = Math.hypot(px - wr.x, py - wr.y) / r;
              const a = person > 0.5 ? Math.max(0, Math.min(1, (1 - dist) * 3)) : 0;
              d[(y * w + x) * 4 + 3] = Math.round(a * 255);
            }
          const tmp = document.createElement('canvas');
          tmp.width = w;
          tmp.height = h;
          tmp.getContext('2d')!.putImageData(patch, 0, 0);
          out.drawImage(tmp, x0, y0);
        }
      }
    };
    requestAnimationFrame(frame);
  }

  function save() {
    const c = canvas.current;
    if (!c || !product) return;
    const out = document.createElement('canvas');
    out.width = c.width;
    out.height = c.height;
    const ctx = out.getContext('2d')!;
    ctx.drawImage(c, 0, 0);
    if (layer.current?.id === product.id) {
      if (gl.current) ctx.drawImage(gl.current, 0, 0, c.width, c.height);
      if (top.current) ctx.drawImage(top.current, 0, 0, c.width, c.height);
    }
    const fs = Math.max(14, Math.round(c.width / 50));
    ctx.font = `700 ${fs}px sans-serif`;
    const text = 'LAGI · 실제 제품 이미지 착용 미리보기';
    ctx.fillStyle = 'rgba(15,15,15,0.85)';
    ctx.fillRect(fs * 0.6, c.height - fs * 2.4, ctx.measureText(text).width + fs, fs * 1.8);
    ctx.fillStyle = '#fff';
    ctx.fillText(text, fs * 1.1, c.height - fs * 1.1);
    out.toBlob((b) => {
      if (!b) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = `lagi-fit-${product.id}.png`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/png');
  }

  /** The current pose (camera only, without the overlay) re-made as a photoreal image by the photo AI. */
  async function exactPhoto() {
    const v = video.current;
    if (!v || !v.videoWidth || !product || exact.busy) return;
    if (!window.confirm('이 장면 한 장을 AI 서버(Cloudflare를 거쳐 Google Gemini)로 보내 실사 사진을 만듭니다. 라기는 사진을 저장하지 않습니다. 진행할까요?')) return;
    const k = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(v.videoWidth * k);
    c.height = Math.round(v.videoHeight * k);
    const ctx = c.getContext('2d')!;
    if (facing === 'user') {
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0, c.width, c.height);
    const person = c.toDataURL('image/jpeg', 0.9);
    setExact({ busy: true });
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 120_000);
    try {
      const ask = () => requestAiTryOn({ person, product, style: stylePrompt, signal: ctrl.signal });
      let image: string;
      try {
        image = await ask();
      } catch (e) {
        if ((e as { reason?: string }).reason === 'blocked' || ctrl.signal.aborted) throw e;
        image = await ask();
      }
      setExact({ busy: false, image });
    } catch (e) {
      setExact({ busy: false, error: ctrl.signal.aborted ? '시간이 너무 오래 걸려 중단했습니다.' : (e as Error).message || '사진을 만들지 못했습니다.' });
    } finally {
      window.clearTimeout(timer);
    }
  }

  const live = phase === 'live';

  return (
    <div className="mt-10 grid grid-cols-1 gap-x-[var(--gap)] gap-y-10 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[var(--radius-card)] bg-[var(--c-ink)] md:aspect-video" data-testid="map-stage">
          <video ref={video} playsInline muted className="hidden" />
          <canvas ref={canvas} className={`h-full w-full object-contain ${live ? '' : 'hidden'}`} data-testid="map-canvas" />
          <canvas ref={gl} aria-hidden="true" className={`pointer-events-none absolute inset-0 h-full w-full object-contain ${live && product?.model3d ? '' : 'hidden'}`} data-testid="map-gl" />
          <canvas ref={top} aria-hidden="true" className={`pointer-events-none absolute inset-0 h-full w-full object-contain ${live && product?.model3d ? '' : 'hidden'}`} />
          {!live && (
            <p className="t-body kr max-w-xs px-6 text-center text-white/80" data-testid="map-status">
              {status ?? (phase === 'ended' ? '착용을 끝냈습니다. 다시 시작할 수 있습니다.' : '시작을 누르면 카메라 화면에 실제 제품 이미지가 몸을 따라 입혀집니다.')}
            </p>
          )}
          {live && (
            <>
              <span className="t-label t-mark absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[var(--c-ink)]">Real product · AR</span>
              {(!found || status) && (
                <p className="t-caption kr absolute inset-x-0 bottom-4 mx-auto w-fit rounded-full bg-black/70 px-4 py-2 text-white" role="status">
                  {status ?? '상반신이 화면에 들어오게 서 주세요'}
                </p>
              )}
            </>
          )}
        </div>
        {live && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" onClick={save} data-testid="map-save">
              이 장면 저장
            </button>
            <button type="button" className="btn btn-line" onClick={exactPhoto} disabled={exact.busy}>
              {exact.busy ? 'AI 사진 만드는 중…' : '이 포즈로 AI 실사 사진 만들기'}
            </button>
            <button type="button" className="btn btn-line" onClick={stop}>
              끝내기
            </button>
          </div>
        )}
        <p className="t-caption kr mt-2 text-[var(--c-mute)]">실제 제품 사진을 몸 위치에 맞춰 입힌 미리보기입니다. 몸을 옆으로 돌리면 정면 모습 그대로 보여요.</p>
        {(exact.busy || exact.image || exact.error) && (
          <div className="mt-6" aria-live="polite">
            {exact.busy && <p className="t-body kr">이 포즈에 제품을 실사처럼 합성하고 있습니다… (10~40초)</p>}
            {exact.error && (
              <p className="t-caption kr text-[var(--c-blue)]" role="alert">
                {exact.error}
              </p>
            )}
            {exact.image && (
              <>
                <img src={exact.image} alt="AI로 합성한 착용 사진" className="block h-auto w-full max-w-xl rounded-[var(--radius-card)]" />
                <a href={exact.image} download={`lagi-ai-${product?.id ?? 'photo'}.png`} className="btn btn-primary mt-3">
                  사진 저장
                </a>
                <p className="t-caption kr mt-2 text-[var(--c-mute)]">AI가 만든 이미지입니다. 실제 크기와 색은 다를 수 있습니다.</p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="space-y-8 rounded-[calc(var(--radius-card)*2)] border border-black/10 p-5 lg:col-span-5 lg:self-start lg:p-7">
        <section aria-labelledby="m2">
          <h2 id="m2" className="t-h3 kr">
            <span className="t-mark text-[var(--c-mute)]">02</span> 착용 방식
          </h2>
          {styleChips}
        </section>

        <section aria-labelledby="m3">
          <h2 id="m3" className="t-h3 kr">
            <span className="t-mark text-[var(--c-mute)]">03</span> 크기 · 카메라
          </h2>
          <label className="t-caption kr mt-4 block">
            <span className="flex justify-between">
              <span>제품 크기</span>
              <span className="tabular-nums text-[var(--c-mute)]">{Math.round(size * 100)}%</span>
            </span>
            <input type="range" min={0.7} max={1.4} step={0.05} value={size} onChange={(e) => setSize(Number(e.target.value))} className="mt-2 w-full accent-[var(--c-ink)]" aria-label="제품 크기" data-testid="map-size" />
          </label>
          <div className="mt-4 flex gap-2">
            {(['user', 'environment'] as const).map((f) => (
              <button key={f} type="button" aria-pressed={facing === f} disabled={live || phase === 'loading'} onClick={() => setFacing(f)} className="chip disabled:opacity-40">
                {f === 'user' ? '앞 카메라' : '뒤 카메라'}
              </button>
            ))}
          </div>
        </section>

        <section>
          <button type="button" onClick={live ? stop : start} disabled={!product || phase === 'loading'} className="btn btn-primary w-full" data-testid="map-start">
            {phase === 'loading' ? '준비 중…' : live ? '끝내기' : phase === 'ended' ? '다시 시작' : '실시간 착용 시작'}
          </button>
          {!product && <p className="t-caption kr mt-2 text-[var(--c-mute)]">먼저 제품을 고르세요.</p>}
          <p className="t-caption kr mt-3 rounded-[var(--radius-card)] bg-[var(--c-gray)] p-3 text-[var(--c-mute)]">
            실시간 착용 중 카메라 영상은 기기 안에서만 처리되고 전송되지 않습니다. 시간 제한과 비용이 없습니다. ‘AI 실사 사진 만들기’를 누를 때만 그 장면 한 장이 AI 서버로 전송됩니다.
          </p>
          {error && (
            <p className="t-caption kr mt-3 text-[var(--c-blue)]" role="alert">
              {error}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
