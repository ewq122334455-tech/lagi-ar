import { useEffect, useRef, useState } from 'react';
import type { Product } from '@/data/productTypes';
import { AI_TRYON_URL, requestAiTryOn } from '@/tryon/aiTryOn';
import { keyMatte } from './productOverlay';
import { createDesignMapper, greenReference, type DesignMapper } from './greenMap';

type Phase = 'idle' | 'starting' | 'live' | 'ended';
/** What the visitor sees as the current step (11 states). */
type Step = 'before' | 'ready' | 'permission' | 'checking' | 'connecting' | 'processing' | 'live' | 'failed' | 'disconnected' | 'limited' | 'ended';
const STEP_LABEL: Record<Step, string> = {
  before: '제품을 고르고 동의하면 시작할 수 있어요',
  ready: '준비 완료 · 시작을 누르세요',
  permission: '카메라 권한을 확인하는 중',
  checking: '카메라 입력과 제품 이미지를 확인하는 중',
  connecting: 'AI 서버에 연결하는 중',
  processing: 'AI가 영상을 만드는 중',
  live: '실시간 AI 영상 출력 중',
  failed: '시작하지 못했어요',
  disconnected: '연결이 끊겼어요',
  limited: '오늘 사용량을 모두 썼어요',
  ended: '체험이 끝났어요',
};
const STEP_ORDER: Step[] = ['ready', 'permission', 'checking', 'connecting', 'processing', 'live', 'ended'];
class ApiError extends Error {
  reason?: string;
}

/** Edit instruction for the general realtime editor (lucy-2.6); the garment-only VTON model turned bags into clothes. */
function promptFor(product: Product, stylePrompt: string, description?: string) {
  const kind = (product.category.value ?? '').toLowerCase().includes('bag') ? 'bag' : 'item';
  // The written description (from the server, per product) pins colours and parts the image alone lets drift.
  if (description)
    return `Add the ${kind} from the reference image, ${stylePrompt}. The ${kind}: ${description} It is an accessory, not clothing: do not change the person's clothes. Copy its exact design, colours and prints; keep the person and background unchanged.`;
  return `Add the ${kind} from the reference image, ${stylePrompt}. It is an accessory, not clothing: do not change the person's clothes. Keep the ${kind}'s exact shape, colours, prints and proportions, realistic size and natural shadows. Keep the person and background unchanged.`;
}

/** Design mapping: the AI draws the product as a flat green bag of its exact shape; the real design goes on top. */
function greenPromptFor(product: Product, stylePrompt: string) {
  const kind = (product.category.value ?? '').toLowerCase().includes('bag') ? 'bag' : 'item';
  const dims = product.dimensions.widthCm ? ` about ${product.dimensions.widthCm} cm wide and ${product.dimensions.heightCm ?? ''} cm tall,` : '';
  // No written description here: its colours made the AI paint the bag instead of keeping it green.
  return `Add a ${kind} with exactly the outline of the green ${kind} in the reference image,${dims} ${stylePrompt}. The ${kind} is plain flat chroma-key green (#00FF00) all over: no print, no logo, no texture, no other colour. It is an accessory, not clothing: do not change the person's clothes. Keep the person and background unchanged.`;
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

async function post<T>(path: string, body: unknown): Promise<T> {
  // The member session goes along so the owner's account can skip the daily limit.
  const token = sessionToken();
  const res = await fetch(`${AI_TRYON_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    const err = new ApiError(data.error ?? `요청에 실패했습니다 (${res.status}).`);
    err.reason = (data as { reason?: string }).reason;
    throw err;
  }
  return data;
}

/**
 * Realtime try-on (Decart Lucy VTON): the visitor's camera goes to Decart over WebRTC and comes back
 * as a live video of them wearing / carrying the product. Sessions are capped at 20 seconds — the
 * token from our Worker carries that limit, so Decart ends the session even if this page does not.
 * The SDK (WebRTC client) is loaded only when a session starts.
 */
export function LiveTryOn({
  product,
  stylePrompt,
  styleChips,
}: {
  product: Product | undefined;
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
  const [stage, setStage] = useState<'permission' | 'checking' | 'connecting' | null>(null);
  const [fail, setFail] = useState<'failed' | 'disconnected' | 'limited' | null>(null);
  // Optional local recording of the output video (never uploaded).
  const [recOn, setRecOn] = useState(false);
  const [recording, setRecording] = useState(false);
  const [clip, setClip] = useState<{ url: string; ext: string; size: number } | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  // "정확한 사진": the live pose re-made by the photo compositor, which keeps the real product design.
  const [exact, setExact] = useState<{ busy: boolean; image?: string; error?: string }>({ busy: false });
  const out = useRef<HTMLVideoElement>(null);
  const local = useRef<HTMLVideoElement>(null);
  const session = useRef<{ stop: () => void; setPrompt: (p: string) => Promise<void> } | null>(null);
  const garment = useRef<{ id: string; blob: Blob; description?: string; green?: Blob; product?: HTMLCanvasElement } | null>(null);
  // Real design mapped onto the green bag the AI draws (on by default); off shows the AI's own drawing.
  const [mapOn, setMapOn] = useState(true);
  const mapped = useRef<HTMLCanvasElement>(null);
  const mapper = useRef<DesignMapper | null>(null);

  // Never leave a paid session running: stop on unmount and when the tab is hidden.
  useEffect(() => {
    const onHide = () => document.hidden && session.current?.stop();
    const onGone = () => session.current?.stop();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onGone);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onGone);
      session.current?.stop();
    };
  }, []);

  // A new product or way of wearing it while live: send the new instruction without reconnecting.
  useEffect(() => {
    if (phase === 'live' && product)
      void session.current?.setPrompt(mapOn ? greenPromptFor(product, stylePrompt) : promptFor(product, stylePrompt, garment.current?.description)).catch(() => undefined);
  }, [stylePrompt, product, phase, mapOn]);

  // Mapping loop: AI frame in, real design on the green bag out.
  useEffect(() => {
    if (phase !== 'live' || waiting || !mapOn) return;
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const v = out.current;
      const c = mapped.current;
      const m = mapper.current;
      if (!v || !c || !m || v.readyState < 2 || !v.videoWidth) return;
      if (c.width !== v.videoWidth || c.height !== v.videoHeight) {
        c.width = v.videoWidth;
        c.height = v.videoHeight;
      }
      m.draw(c.getContext('2d', { willReadFrequently: true })!, v, c.width, c.height);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, waiting, mapOn]);

  async function garmentBlob(p: Product) {
    if (garment.current?.id === p.id && (!mapOn || garment.current.product)) return garment.current;
    const base = `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}`;
    const { image, description } = await post<{ image: string; description?: string }>('/cutout', { productImage: new URL(p.images[0], base).toString() });
    const blob = await smallReference(await (await fetch(image)).blob());
    garment.current = { id: p.id, blob, description };
    if (mapOn) {
      // The product on green (matte) → transparent product for mapping, and its green silhouette for the AI.
      const { matte } = await post<{ matte: string }>('/cutout', { productImage: new URL(p.images[0], base).toString(), matte: true });
      const product = await keyMatte(matte);
      garment.current = { ...garment.current, product, green: await greenReference(product) };
    }
    return garment.current;
  }

  /** The output video as a recordable stream: the design-mapped canvas when mapping is on, else the AI's own video. */
  function startRecording() {
    try {
      if (typeof MediaRecorder === 'undefined') return;
      const src: MediaStream | null = mapOn && mapped.current ? mapped.current.captureStream(30) : ((out.current?.srcObject as MediaStream | null) ?? null);
      if (!src) return;
      const type = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t));
      const rec = new MediaRecorder(src, type ? { mimeType: type } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        setRecording(false);
        if (!chunks.length) return;
        const blob = new Blob(chunks, { type: rec.mimeType || 'video/webm' });
        setClip((old) => {
          if (old) URL.revokeObjectURL(old.url);
          return { url: URL.createObjectURL(blob), ext: blob.type.includes('mp4') ? 'mp4' : 'webm', size: blob.size };
        });
      };
      rec.start(1000);
      recorder.current = rec;
      setRecording(true);
    } catch {
      setRecording(false);
    }
  }

  async function start() {
    if (!product || phase === 'starting' || phase === 'live' || !consent) return;
    setError(null);
    setFail(null);
    setExact({ busy: false });
    if (clip) URL.revokeObjectURL(clip.url);
    setClip(null);
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
      try {
        if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
      } catch {
        /* already stopped */
      }
      recorder.current = null;
      rt?.disconnect();
      stream?.getTracks().forEach((t) => t.stop());
      if (out.current) out.current.srcObject = null;
      if (local.current) local.current.srcObject = null;
      session.current = null;
      setWaiting(null);
      setStage(null);
      // Only a session that actually ran "ended"; a failed start goes back to the start state.
      setPhase(wentLive ? 'ended' : 'idle');
    };
    try {
      // 1. The camera FIRST. A visitor who says no (or has no camera) must not cost a paid token or any Gemini call, and the
      //    30-second token must not run out while the permission dialog is still open.
      setStage('permission');
      const sdk = await import('@decartai/sdk');
      const model = sdk.models.realtime('lucy-2.6');
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: facing, frameRate: model.fps, width: model.width, height: model.height },
      });
      if (local.current) local.current.srcObject = stream;
      // 2. Check what will be sent: the camera really delivers video, and the product reference is ready.
      setStage('checking');
      const track = stream.getVideoTracks()[0];
      if (!track || track.readyState !== 'live') throw new Error('카메라 영상이 들어오지 않습니다. 다른 앱이 카메라를 쓰고 있지 않은지 확인해 주세요.');
      const ref = await garmentBlob(product);
      // 3. The token last, right before connecting (it is minted and metered only now).
      setStage('connecting');
      const token = await post<{ apiKey: string; seconds: number; remainingToday: number | null }>('/realtime/token', {});
      setRemaining(token.remainingToday ?? 'unlimited');
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
      setStage(null);
      setWaiting('AI가 영상을 만들고 있습니다…');
      // Sent after connecting so a refused image surfaces as an error instead of a silent video without the product.
      try {
        if (mapOn && ref.green && ref.product) {
          mapper.current = createDesignMapper(ref.product);
          await conn.setImage(ref.green, { prompt: greenPromptFor(product, stylePrompt), enhance: false });
        } else await conn.setImage(ref.blob, { prompt: promptFor(product, stylePrompt, ref.description), enhance: false });
      } catch (e) {
        throw new Error(`제품 이미지를 AI에 전달하지 못했습니다: ${(e as Error).message}`);
      }
      conn.on('sessionEnded', (e: { reason?: string }) => {
        if (!gotFrames && e?.reason) {
          setFail('failed');
          setError(`AI 영상이 시작되기 전에 세션이 끝났습니다 (${e.reason}).`);
        }
        stop();
      });
      conn.on('error', (e: { message?: string }) => {
        setFail('disconnected');
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
        if (recOn) window.setTimeout(startRecording, 200);
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
          setFail('failed');
          setError('AI 영상이 오지 않아 중단했습니다. 잠시 후 다시 시도해 주세요.');
          stop();
        } else if (s <= 0) stop();
      }, 250);
    } catch (e) {
      stop();
      const name = (e as DOMException)?.name;
      const reason = (e as ApiError).reason;
      const limited = reason === 'daily_limit' || reason === 'site_limit' || reason === 'busy_ip' || reason === 'busy_site' || reason === 'quota_unavailable';
      setFail(limited ? 'limited' : 'failed');
      setError(
        name === 'NotAllowedError'
          ? '카메라 권한이 꺼져 있습니다. 주소창의 카메라 설정에서 허용한 뒤 다시 시도해 주세요.'
          : name === 'NotFoundError'
            ? '사용할 수 있는 카메라를 찾지 못했습니다.'
            : (e as Error).message || '실시간 착용을 시작하지 못했습니다.',
      );
    }
  }

  function saveClip() {
    if (!clip || !product) return;
    const a = document.createElement('a');
    a.href = clip.url;
    a.download = `lagi-live-${product.id}.${clip.ext}`;
    a.click();
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
    ctx.drawImage(mapOn && mapped.current?.width ? mapped.current : v, 0, 0, c.width, c.height);
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
  const step: Step =
    phase === 'live' ? (waiting ? 'processing' : 'live')
    : phase === 'starting' ? (stage ?? 'connecting')
    : fail ? fail
    : phase === 'ended' ? 'ended'
    : product && consent ? 'ready' : 'before';

  return (
    <div className="mt-10 grid grid-cols-1 gap-x-[var(--gap)] gap-y-10 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-[var(--radius-card)] bg-[var(--c-ink)]" data-testid="live-stage">
          <video ref={out} autoPlay playsInline muted className={`absolute inset-0 h-full w-full object-contain ${live && !waiting && !mapOn ? '' : 'opacity-0'}`} />
          <canvas ref={mapped} aria-hidden="true" className={`absolute inset-0 h-full w-full object-contain ${live && !waiting && mapOn ? '' : 'hidden'}`} data-testid="mapped-canvas" />
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
        <div className="mt-3" data-testid="live-steps" data-step={step}>
          <ol className="flex flex-wrap gap-x-4 gap-y-1" aria-label="진행 단계">
            {STEP_ORDER.map((k) => {
              const at = STEP_ORDER.indexOf(step);
              const here = k === step;
              const done = at > STEP_ORDER.indexOf(k);
              return (
                <li key={k} className={`t-caption kr ${here ? 'font-bold text-[var(--c-ink)]' : done ? 'text-[var(--c-ink)]' : 'text-[var(--c-mute)]'}`} aria-current={here ? 'step' : undefined}>
                  {done ? '✓ ' : here ? '● ' : '○ '}
                  {k === 'ready' ? '준비' : k === 'permission' ? '카메라' : k === 'checking' ? '입력 검사' : k === 'connecting' ? '서버 연결' : k === 'processing' ? 'AI 처리' : k === 'live' ? '영상 출력' : '종료'}
                </li>
              );
            })}
          </ol>
          <p className="t-caption kr mt-1 text-[var(--c-mute)]" role="status" data-testid="live-step-label">
            {STEP_LABEL[step]}
          </p>
        </div>
        {live && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" onClick={exactPhoto} data-testid="exact-photo">
              이 포즈로 정확한 사진 만들기
            </button>
            <button type="button" className="btn btn-line" onClick={saveFrame}>
              이 장면 저장
            </button>
            <button type="button" className="btn btn-line" onClick={() => session.current?.stop()}>
              끝내기
            </button>
          </div>
        )}
        {live && <p className="t-caption kr mt-2 text-[var(--c-mute)]">실시간 화면은 미리보기라 제품 모양이 실제와 다를 수 있어요. 포즈를 잡고 “정확한 사진 만들기”를 누르면 실제 제품 그대로 합성합니다.</p>}
        {recording && (
          <p className="t-caption kr mt-2 text-[var(--c-ink)]" data-testid="rec-on">
            ● 이 기기에 녹화 중입니다 (서버로 보내지 않습니다)
          </p>
        )}
        {clip && (
          <div className="mt-6" data-testid="clip-result">
            <video src={clip.url} controls playsInline muted className="block h-auto w-full max-w-xl bg-[var(--c-ink)]" />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-primary" onClick={saveClip}>
                영상 저장 ({clip.ext.toUpperCase()}, {(clip.size / 1048576).toFixed(1)}MB)
              </button>
              <button
                type="button"
                className="btn btn-line"
                onClick={() => {
                  URL.revokeObjectURL(clip.url);
                  setClip(null);
                }}
              >
                삭제
              </button>
            </div>
            <p className="t-caption kr mt-2 text-[var(--c-mute)]">AI가 만든 영상입니다. 이 기기에만 있고, 이 화면을 닫으면 사라집니다.</p>
          </div>
        )}
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
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="btn btn-primary" onClick={saveExact}>
                    사진 저장
                  </button>
                </div>
                <p className="t-caption kr mt-2 text-[var(--c-mute)]">AI가 만든 이미지입니다. 실제 크기와 색은 다를 수 있습니다.</p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="space-y-8 rounded-[calc(var(--radius-card)*2)] border border-black/10 p-5 lg:col-span-5 lg:self-start lg:p-7">
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
          <div className="mt-3 flex gap-2">
            {(['user', 'environment'] as const).map((f) => (
              <button key={f} type="button" aria-pressed={facing === f} disabled={live || phase === 'starting'} onClick={() => setFacing(f)} className="chip disabled:opacity-40">
                {f === 'user' ? '앞 카메라' : '뒤 카메라'}
              </button>
            ))}
          </div>
          <label className="t-caption kr mt-4 flex items-start gap-3 rounded-[var(--radius-card)] border border-black/10 p-3">
            <input type="checkbox" className="mt-1" checked={mapOn} disabled={live || phase === 'starting'} onChange={(e) => setMapOn(e.target.checked)} data-testid="map-toggle" />
            <span>
              <b className="block text-[var(--c-ink)]">실제 디자인 입히기 (권장)</b>
              AI는 제품 모양의 초록 가방을 자연스럽게 들게 만들고, 그 위에 실제 제품 디자인을 그대로 입힙니다. 끄면 AI가 그린 제품이 그대로 보여 모양과 무늬가 달라질 수 있어요.
            </span>
          </label>
          {typeof MediaRecorder !== 'undefined' && (
            <label className="t-caption kr mt-4 flex items-start gap-3 rounded-[var(--radius-card)] border border-black/10 p-3">
              <input type="checkbox" className="mt-1" checked={recOn} disabled={live || phase === 'starting'} onChange={(e) => setRecOn(e.target.checked)} data-testid="rec-toggle" />
              <span>
                <b className="block text-[var(--c-ink)]">결과 영상을 이 기기에 녹화</b>
                끝나면 영상으로 저장할 수 있습니다. 파일은 이 기기에만 만들어지고 라기 서버로 올라가지 않습니다.
              </span>
            </label>
          )}
          <label className="t-caption kr mt-4 flex items-start gap-2 rounded-[var(--radius-card)] bg-[var(--c-gray)] p-3">
            <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>체험하는 20초 동안 카메라 영상이 AI 서버(Decart)로 실시간 전송되는 것에 동의합니다. 라기는 영상을 저장하지 않습니다.</span>
          </label>
          <button
            type="button"
            onClick={start}
            disabled={!product || !consent || live || phase === 'starting'}
            className="btn btn-primary mt-5 w-full"
          >
            {phase === 'starting' ? '연결 중…' : phase === 'ended' ? '다시 시작' : '실시간 착용 시작'}
          </button>
          {!product && <p className="t-caption kr mt-2 text-[var(--c-mute)]">먼저 제품을 고르세요.</p>}
          <p className="t-caption kr mt-3 text-[var(--c-mute)]">
            한 번에 20초, 하루 3번까지 체험할 수 있습니다{remaining === 'unlimited' ? ' (이 계정은 횟수 제한 없음)' : remaining != null ? ` (오늘 남은 횟수 ${remaining}번)` : ''}. 화면은 AI가 만든 영상이며, 실제 크기와 색은 다를 수 있습니다.
          </p>
          {error && (
            <p className="t-caption kr mt-3 text-[var(--c-blue)]" role="alert" data-testid="live-error" data-kind={fail ?? 'failed'}>
              {error}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
