import { useEffect, useRef, useState } from 'react';
import type { Product } from '@/data/productTypes';
import { AI_TRYON_URL, requestAiTryOn } from '@/tryon/aiTryOn';
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import { keyMatte, loadPose, paint, placeFor, smooth, type Placement } from './productOverlay';

type Phase = 'idle' | 'starting' | 'live' | 'ended';

/** Edit instruction for the general realtime editor (lucy-2.6); the garment-only VTON model turned bags into clothes. */
function promptFor(product: Product, stylePrompt: string, description?: string) {
  const kind = (product.category.value ?? '').toLowerCase().includes('bag') ? 'bag' : 'item';
  // The written description (from the server, per product) pins colours and parts the image alone lets drift.
  if (description)
    return `Add the ${kind} from the reference image, ${stylePrompt}. The ${kind}: ${description} It is an accessory, not clothing: do not change the person's clothes. Copy its exact design, colours and prints; keep the person and background unchanged.`;
  return `Add the ${kind} from the reference image, ${stylePrompt}. It is an accessory, not clothing: do not change the person's clothes. Keep the ${kind}'s exact shape, colours, prints and proportions, realistic size and natural shadows. Keep the person and background unchanged.`;
}

/** Bounding box of the non-white pixels, so the reference is the product and not mostly empty background. */
function productBox(bmp: ImageBitmap) {
  const w = 256;
  const h = Math.max(1, Math.round((bmp.height / bmp.width) * w));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (px[i + 3] > 16 && Math.min(px[i], px[i + 1], px[i + 2]) < 225) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  if (x1 < 0) return { sx: 0, sy: 0, sw: bmp.width, sh: bmp.height };
  const k = bmp.width / w;
  const pad = 0.04 * Math.max(x1 - x0, y1 - y0);
  const sx = Math.max(0, (x0 - pad) * k);
  const sy = Math.max(0, (y0 - pad) * k);
  return { sx, sy, sw: Math.min(bmp.width - sx, (x1 - x0 + 2 * pad) * k), sh: Math.min(bmp.height - sy, (y1 - y0 + 2 * pad) * k) };
}

/** The model wants a small reference: crop to the product, shrink to 768 px on white, send as JPEG (the PNG cutout is ~1 MB). */
async function smallReference(blob: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const { sx, sy, sw, sh } = productBox(bmp);
  const k = Math.min(1, 768 / Math.max(sw, sh));
  const c = document.createElement('canvas');
  c.width = Math.round(sw * k);
  c.height = Math.round(sh * k);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, c.width, c.height);
  bmp.close();
  return new Promise((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error('제품 이미지를 준비하지 못했습니다.'))), 'image/jpeg', 0.88));
}

function sessionToken() {
  try {
    return localStorage.getItem('lagi-session');
  } catch {
    return null;
  }
}

function productUrl(p: Product) {
  const base = `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}`;
  return new URL(p.images[0], base).toString();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  // The member session goes along so the owner's account can skip the daily limit.
  const token = sessionToken();
  const res = await fetch(`${AI_TRYON_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `요청에 실패했습니다 (${res.status}).`);
  return data;
}

/**
 * Realtime try-on (Decart Lucy 2.6, with the real product photo laid over it): the visitor's camera goes to Decart over WebRTC and comes back
 * as a live video of them wearing / carrying the product. Sessions are capped at 20 seconds — the
 * token from our Worker carries that limit, so Decart ends the session even if this page does not.
 * The SDK (WebRTC client) is loaded only when a session starts.
 */
export function LiveTryOn({
  product,
  styleKey,
  stylePrompt,
  styleChips,
}: {
  product: Product | undefined;
  /** Way of wearing (shoulder, hand, …) — decides where the real-product overlay sits. */
  styleKey: string;
  stylePrompt: string;
  styleChips: React.ReactNode;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [left, setLeft] = useState(20);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [remaining, setRemaining] = useState<number | 'unlimited' | null>(null);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  // Connected but the AI has not sent a generated frame yet (queued or warming up).
  const [waiting, setWaiting] = useState<string | null>(null);
  // "정확한 사진": the live pose re-made by the photo compositor, which keeps the real product design.
  const [exact, setExact] = useState<{ busy: boolean; image?: string; error?: string }>({ busy: false });
  const out = useRef<HTMLVideoElement>(null);
  const local = useRef<HTMLVideoElement>(null);
  const session = useRef<{ stop: () => void; setPrompt: (p: string) => Promise<void> } | null>(null);
  const garment = useRef<{ id: string; blob: Blob; description?: string } | null>(null);
  // Real-product overlay: the actual photo, keyed, laid over the AI video and moved with the body.
  const ov = useRef<HTMLCanvasElement>(null);
  const [overlayOn, setOverlayOn] = useState(true);
  const [overlayNote, setOverlayNote] = useState<string | null>(null);
  const overlay = useRef<{ id: string; img: HTMLCanvasElement } | null>(null);
  const pose = useRef<Promise<PoseLandmarker> | null>(null);
  const placed = useRef<Placement | null>(null);

  // Never leave a paid session running: stop on unmount and when the tab is hidden.
  useEffect(() => {
    const onHide = () => document.hidden && session.current?.stop();
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      session.current?.stop();
    };
  }, []);

  // A new product or way of wearing it while live: send the new instruction without reconnecting.
  useEffect(() => {
    if (phase === 'live' && product) void session.current?.setPrompt(promptFor(product, stylePrompt, garment.current?.description)).catch(() => undefined);
  }, [stylePrompt, product, phase]);

  // Draw the real product over the AI video while live (tracking runs on the AI video itself, so the
  // overlay lines up with the arm and shoulder the AI drew).
  useEffect(() => {
    const c = ov.current;
    const clear = () => c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
    placed.current = null;
    if (phase !== 'live' || waiting || !overlayOn || !product) {
      clear();
      return;
    }
    let alive = true;
    let raf = 0;
    let marker: PoseLandmarker | null = null;
    let lm: { x: number; y: number; visibility?: number }[] | null = null;
    let lastDetect = 0;
    let lastT = -1;
    void pose.current?.then((m) => (marker = m)).catch(() => undefined);
    const kind = (product.category.value ?? '').toLowerCase().includes('bag') ? 'bag' : 'acc';
    const loop = (now: number) => {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      const v = out.current;
      const img = overlay.current?.id === product.id ? overlay.current.img : null;
      if (!v || !c) return;
      const r = c.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (c.width !== Math.round(r.width * dpr) || c.height !== Math.round(r.height * dpr)) {
        c.width = Math.round(r.width * dpr);
        c.height = Math.round(r.height * dpr);
      }
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, c.width, c.height);
      if (!marker || !img || v.readyState < 2 || !v.videoWidth) return;
      // ~15 detections a second is plenty; the placement is eased in between.
      if (now - lastDetect > 66 && v.currentTime !== lastT) {
        lastDetect = now;
        lastT = v.currentTime;
        lm = marker.detectForVideo(v, now).landmarks[0] ?? null;
      }
      if (!lm) return;
      const p = placeFor(styleKey, kind, lm, v.videoWidth, v.videoHeight, img.width / img.height, product.dimensions.widthCm ?? undefined);
      if (!p) return;
      placed.current = smooth(placed.current, p);
      const s = Math.min(c.width / v.videoWidth, c.height / v.videoHeight);
      paint(ctx, img, placed.current, { s, ox: (c.width - v.videoWidth * s) / 2, oy: (c.height - v.videoHeight * s) / 2 });
    };
    raf = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      clear();
    };
  }, [phase, waiting, overlayOn, product, styleKey]);

  /** Keyed product photo + pose model, prepared alongside the live connection; failure only drops the overlay. */
  async function prepareOverlay(p: Product) {
    setOverlayNote(null);
    try {
      pose.current ??= loadPose();
      if (overlay.current?.id !== p.id) {
        const { matte } = await post<{ matte: string }>('/cutout', { productImage: productUrl(p), matte: true });
        overlay.current = { id: p.id, img: await keyMatte(matte) };
      }
      await pose.current;
    } catch {
      pose.current = null;
      setOverlayNote('실제 제품 덮기를 준비하지 못해 AI 영상만 보여 드려요.');
    }
  }

  async function garmentBlob(p: Product) {
    if (garment.current?.id === p.id) return garment.current;
    const { image, description } = await post<{ image: string; description?: string }>('/cutout', { productImage: productUrl(p) });
    const blob = await smallReference(await (await fetch(image)).blob());
    garment.current = { id: p.id, blob, description };
    return garment.current;
  }

  async function start() {
    if (!product || phase === 'starting' || phase === 'live' || !consent) return;
    setError(null);
    setExact({ busy: false });
    setPhase('starting');
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    let wentLive = false;
    let gotFrames = false;
    let rt: { disconnect: () => void } | null = null;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      window.clearInterval(timer);
      rt?.disconnect();
      stream?.getTracks().forEach((t) => t.stop());
      if (out.current) out.current.srcObject = null;
      if (local.current) local.current.srcObject = null;
      session.current = null;
      setWaiting(null);
      // Only a session that actually ran "ended"; a failed start goes back to the start state.
      setPhase(wentLive ? 'ended' : 'idle');
    };
    void prepareOverlay(product);
    try {
      const [ref, token, sdk] = await Promise.all([
        garmentBlob(product),
        post<{ apiKey: string; seconds: number; remainingToday: number | null }>('/realtime/token', {}),
        import('@decartai/sdk'),
      ]);
      setRemaining(token.remainingToday ?? 'unlimited');
      const model = sdk.models.realtime('lucy-2.6');
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: facing, frameRate: model.fps, width: model.width, height: model.height },
      });
      if (local.current) local.current.srcObject = stream;
      const client = sdk.createDecartClient({ apiKey: token.apiKey });
      const conn = await client.realtime.connect(stream, {
        model,
        mirror: 'auto',
        onRemoteStream: (remote: MediaStream) => {
          const v = out.current;
          if (!v) return;
          v.srcObject = remote;
          // Mobile browsers do not always autoplay a stream attached while the element was off screen.
          void v.play().catch(() => undefined);
        },
        onQueuePosition: (q: { position: number }) => setWaiting(q.position > 0 ? `대기 중입니다 · ${q.position}번째` : 'AI가 영상을 만들고 있습니다…'),
      });
      rt = conn;
      setWaiting('AI가 영상을 만들고 있습니다…');
      // Sent after connecting so a refused image surfaces as an error instead of a silent video without the product.
      try {
        await conn.setImage(ref.blob, { prompt: promptFor(product, stylePrompt, ref.description), enhance: false });
      } catch (e) {
        throw new Error(`제품 이미지를 AI에 전달하지 못했습니다: ${(e as Error).message}`);
      }
      conn.on('sessionEnded', (e: { reason?: string }) => {
        if (!gotFrames && e?.reason) setError(`AI 영상이 시작되기 전에 세션이 끝났습니다 (${e.reason}).`);
        stop();
      });
      conn.on('error', (e: { message?: string }) => {
        setError(e?.message ? `연결이 끊겼습니다: ${e.message}` : '연결이 끊겼습니다.');
        stop();
      });
      session.current = { stop, setPrompt: (p: string) => conn.setPrompt(p, { enhance: false }) };
      // The page counts down too, so the visitor sees the limit; Decart enforces it either way.
      // The clock starts at connect (that is what Decart bills), but the "waiting" overlay stays up until
      // the first generated frame, and a session that never produces one is stopped early.
      const begun = Date.now();
      const until = begun + token.seconds * 1000;
      const onFrames = () => {
        if (gotFrames) return;
        gotFrames = true;
        setWaiting(null);
      };
      conn.on('generationTick', onFrames);
      setLeft(token.seconds);
      wentLive = true;
      setPhase('live');
      timer = window.setInterval(() => {
        const v = out.current;
        if (!gotFrames && v && v.readyState >= 2 && v.videoWidth > 0 && Date.now() - begun > 1500) onFrames();
        const s = Math.max(0, Math.ceil((until - Date.now()) / 1000));
        setLeft(s);
        if (!gotFrames && Date.now() - begun > 12000) {
          setError('AI 영상이 오지 않아 중단했습니다. 잠시 후 다시 시도해 주세요.');
          stop();
        } else if (s <= 0) stop();
      }, 250);
    } catch (e) {
      stop();
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

  /** Freeze the visitor's own camera frame, end the paid live session, and have the photo AI place the real product. */
  async function exactPhoto() {
    const v = local.current;
    if (!v || !v.videoWidth || !product || exact.busy) return;
    const k = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(v.videoWidth * k);
    c.height = Math.round(v.videoHeight * k);
    c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
    const person = c.toDataURL('image/jpeg', 0.9);
    session.current?.stop();
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
      setExact({ busy: false, error: ctrl.signal.aborted ? '시간이 너무 오래 걸려 중단했습니다. 다시 시도해 주세요.' : (e as Error).message || '사진을 만들지 못했습니다.' });
    } finally {
      window.clearTimeout(timer);
    }
  }

  function saveExact() {
    if (!exact.image || !product) return;
    const a = document.createElement('a');
    a.href = exact.image;
    a.download = `lagi-tryon-${product.id}.png`;
    a.click();
  }

  function saveFrame() {
    const v = out.current;
    if (!v || !v.videoWidth || !product) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(v, 0, 0);
    if (overlayOn && placed.current && overlay.current?.id === product.id) paint(ctx, overlay.current.img, placed.current, { s: 1, ox: 0, oy: 0 });
    const fs = Math.max(14, Math.round(c.width / 48));
    ctx.font = `700 ${fs}px sans-serif`;
    const text = 'AI GENERATED · LAGI';
    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(fs * 0.6, c.height - fs * 2.4, ctx.measureText(text).width + fs, fs * 1.8);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, fs * 1.1, c.height - fs * 1.1);
    c.toBlob((b) => {
      if (!b) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = `lagi-live-${product.id}.png`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/png');
  }

  const live = phase === 'live';

  return (
    <div className="mt-10 grid grid-cols-1 gap-x-[var(--gap)] gap-y-10 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-[var(--c-ink)]" data-testid="live-stage">
          <video ref={out} autoPlay playsInline muted className={`absolute inset-0 h-full w-full object-contain ${live && !waiting ? '' : 'opacity-0'}`} />
          <canvas ref={ov} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" data-testid="product-overlay" />
          {(!live || waiting) && (
            <p className="t-body kr relative max-w-xs px-6 text-center text-white/80" data-testid="live-status">
              {live ? waiting : phase === 'starting' ? '카메라와 AI를 연결하고 있습니다…' : phase === 'ended' ? '체험이 끝났습니다. 다시 시작할 수 있습니다.' : '시작을 누르면 카메라 화면 위에 제품이 실시간으로 입혀집니다.'}
            </p>
          )}
          {/* Own camera, small, so the visitor can frame themselves. */}
          <video ref={local} autoPlay playsInline muted className={`absolute bottom-3 right-3 w-24 -scale-x-100 border border-white/60 md:w-32 ${phase === 'starting' || live ? '' : 'hidden'}`} />
          {live && (
            <>
              <span className="t-label t-mark absolute left-3 top-3 bg-[var(--c-ink)] px-2 py-1 text-[var(--c-white)]">AI live</span>
              <span className="t-h2 t-mark absolute right-3 top-2 tabular-nums text-[var(--c-white)]" aria-live="polite" data-testid="countdown">
                {left}
              </span>
            </>
          )}
        </div>
        {live && (
          <div className="t-nav kr mt-3 flex flex-wrap gap-2">
            <button type="button" className="tag btn-solid px-4 py-3" onClick={exactPhoto} data-testid="exact-photo">
              이 포즈로 정확한 사진 만들기
            </button>
            <button type="button" className="tag bg-[var(--c-label)] px-4 py-3" onClick={saveFrame}>
              이 장면 저장
            </button>
            <button type="button" aria-pressed={overlayOn} className="tag bg-[var(--c-label)] px-4 py-3" onClick={() => setOverlayOn((o) => !o)} data-testid="overlay-toggle">
              실제 제품 덮기 {overlayOn ? '켬' : '끔'}
            </button>
            <button type="button" className="tag bg-[var(--c-label)] px-4 py-3" onClick={() => session.current?.stop()}>
              끝내기
            </button>
          </div>
        )}
        {overlayNote && live && <p className="t-caption kr mt-2 text-[var(--c-mute)]">{overlayNote}</p>}
        {live && <p className="t-caption kr mt-2 text-[var(--c-mute)]">‘실제 제품 덮기’가 켜져 있으면 실제 제품 사진을 몸에 맞춰 덮어 보여 드려요. 위치는 조금 어긋날 수 있어요. 포즈를 잡고 “정확한 사진 만들기”를 누르면 실제 제품 그대로 합성합니다.</p>}
        {(exact.busy || exact.image || exact.error) && (
          <div className="mt-6" data-testid="exact-result" aria-live="polite">
            {exact.busy && <p className="t-body kr">이 포즈에 실제 제품을 합성하고 있습니다… (10~40초)</p>}
            {exact.error && (
              <p className="t-caption kr text-[var(--c-blue)]" role="alert">
                {exact.error}
              </p>
            )}
            {exact.image && (
              <>
                <img src={exact.image} alt="AI로 합성한 착용 사진" className="block h-auto w-full max-w-xl" />
                <div className="t-nav kr mt-3 flex flex-wrap gap-2">
                  <button type="button" className="tag btn-solid px-4 py-3" onClick={saveExact}>
                    사진 저장
                  </button>
                </div>
                <p className="t-caption kr mt-2 text-[var(--c-mute)]">AI가 만든 이미지입니다. 실제 크기와 색은 다를 수 있습니다.</p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="space-y-8 lg:col-span-5">
        <section aria-labelledby="l2">
          <h2 id="l2" className="t-h3 kr">
            <span className="t-mark text-[var(--c-mute)]">02</span> 착용 방식
          </h2>
          {styleChips}
        </section>

        <section aria-labelledby="l3">
          <h2 id="l3" className="t-h3 kr">
            <span className="t-mark text-[var(--c-mute)]">03</span> 실시간 착용 · 20초
          </h2>
          <div className="t-caption kr mt-3 flex gap-2">
            {(['user', 'environment'] as const).map((f) => (
              <button key={f} type="button" aria-pressed={facing === f} disabled={live || phase === 'starting'} onClick={() => setFacing(f)} className={`tag px-3 ${facing === f ? 'font-bold outline outline-2 -outline-offset-2 outline-[var(--c-ink)]' : 'bg-[var(--c-label)]'}`}>
                {f === 'user' ? '앞 카메라' : '뒤 카메라'}
              </button>
            ))}
          </div>
          <label className="t-caption kr mt-4 flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>체험하는 20초 동안 카메라 영상이 AI 서버(Decart)로 실시간 전송되는 것에 동의합니다. 라기는 영상을 저장하지 않습니다.</span>
          </label>
          <button
            type="button"
            onClick={start}
            disabled={!product || !consent || live || phase === 'starting'}
            className="t-nav tag btn-solid kr mt-5 px-5 py-3.5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {phase === 'starting' ? '연결 중…' : phase === 'ended' ? '다시 시작' : '실시간 착용 시작'}
          </button>
          {!product && <p className="t-caption kr mt-2 text-[var(--c-mute)]">먼저 제품을 고르세요.</p>}
          <p className="t-caption kr mt-3 text-[var(--c-mute)]">
            한 번에 20초, 하루 3번까지 체험할 수 있습니다{remaining === 'unlimited' ? ' (이 계정은 횟수 제한 없음)' : remaining != null ? ` (오늘 남은 횟수 ${remaining}번)` : ''}. 화면은 AI가 만든 영상이며, 실제 크기와 색은 다를 수 있습니다.
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
