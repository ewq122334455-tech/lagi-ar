import { parsePipeline, carryOf, garmentOf, isGarment, realtimePrompt, type RealtimeModel } from './pipelines';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Product } from '@/data/productTypes';
import { AI_TRYON_URL, requestAiTryOn } from '@/tryon/aiTryOn';
import { keyMatte } from './productOverlay';
import { createDesignMapper, greenReference, type DesignMapper } from './greenMap';

type Phase = 'idle' | 'starting' | 'live' | 'ended';
/** What the visitor sees as the current step (11 states). */
type Step = 'before' | 'ready' | 'permission' | 'checking' | 'prefit' | 'connecting' | 'processing' | 'live' | 'failed' | 'disconnected' | 'limited' | 'unsupported' | 'ended';
const STEP_LABEL: Record<Step, string> = {
  before: '제품을 고르고 동의하면 시작할 수 있어요',
  ready: '준비 완료 · 시작을 누르세요',
  permission: '카메라 권한을 확인하는 중',
  checking: '카메라 입력과 제품 이미지를 확인하는 중',
  prefit: '내가 제품을 든 참조 사진을 만드는 중 (몇 초)',
  connecting: 'AI 서버에 연결하는 중',
  processing: 'AI가 영상을 만드는 중',
  live: '실시간 AI 영상 출력 중',
  failed: '시작하지 못했어요',
  disconnected: '연결이 끊겼어요',
  limited: '지금은 사용할 수 없어요 (사용량 제한)',
  unsupported: '이 브라우저에서는 쓸 수 없어요',
  ended: '체험이 끝났어요',
};
/** The Worker keeps a visitor's "session open" lease this long after the token (session length + this margin) unless the page releases it. */
const LEASE_MARGIN_S = 15;
const STEP_ORDER: Step[] = ['ready', 'permission', 'checking', 'prefit', 'connecting', 'processing', 'live', 'ended'];
/** Measurements of one session. They exist so a person can tell a REAL Decart output from a mock or from the camera passed through. */
type Evidence = {
  at: string; pipeline: string; model: string; sdkIsMock: boolean; speed: 'standard'; requestedSeconds: number; product: string; designMapping: boolean;
  msTokenReceived: number | null; msConnected: number | null; msFirstGenerationTick: number | null; msFirstVideoFrame: number | null;
  generationTicks: number; firstFrameCameFromTick: boolean; outputResolution: string | null; framesSeen: number; fps: number | null; maxFrameGapMs: number | null; stalls200ms: number;
  meanDiffFromInput: number | null; diffSamples: number; sessionEndedReason: string | null; error: string | null; actualSessionSeconds: number | null;
  // What the SDK itself reported, so a missing AI output can be explained (state changes, connection phases, queue, generation end).
  // Try-on reference photo (Decart's step for bags): did we make one for this visitor, how long it took, why not.
  prefit: { used: boolean; ms: number | null; note: string | null; checks?: string | null };
  network?: string;
  /** What the camera really delivered (width x height @ fps), so a blurry result can be told apart from a low-resolution camera. */
  camera?: string;
  // Exactly what was sent to the model, so a wrong result can be explained: the instruction text and which picture was the reference.
  prompt?: string;
  referenceUsed?: string;
  connectionStates: { state: string; ms: number }[]; diagnostics: { name: string; ms: number; data: string }[]; queuePositions: { position: number; ms: number }[]; generationEnded: { ms: number; data: string }[];
};
class ApiError extends Error {
  reason?: string;
}

/** What the browser lacks for a live AI session (null = nothing missing). Checked before anything paid can happen. */
function missingSupport(): string | null {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return '카메라를 쓸 수 없는 환경입니다. 주소가 https:// 이거나 localhost 인지, 최신 Chrome·Safari 인지 확인해 주세요.';
  if (typeof RTCPeerConnection === 'undefined') return '이 브라우저는 실시간 영상 연결(WebRTC)을 지원하지 않습니다. 최신 Chrome 또는 Safari로 열어 주세요.';
  return null;
}

/** The instruction for the realtime model: its own wording per model family and per carry style (see pipelines.ts). */
function promptFor(product: Product, stylePrompt: string, description: string | undefined, model: string, prefit: boolean) {
  const kind = (product.category.value ?? '').toLowerCase().includes('bag') ? 'bag' : 'item';
  return realtimePrompt({ model: model as RealtimeModel, carry: carryOf(stylePrompt), kind, description, prefit, garment: garmentOf(product.fitting?.part ?? product.category.value) });
}

/** Design mapping: the AI draws the product as a flat green bag of its exact shape; the real design goes on top. */
function greenPromptFor(product: Product, stylePrompt: string, vton = false) {
  const kind = (product.category.value ?? '').toLowerCase().includes('bag') ? 'bag' : 'item';
  if (vton) return `Add a plain flat chroma-key green (#00FF00) ${kind} with exactly the outline shown in the reference image to the outfit, ${stylePrompt}. No print, no logo, no texture, no other colour.`;
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
async function smallReference(blob: Blob, max = 768, quality = 0.88): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const { sx, sy, sw, sh } = productBox(bmp);
  const k = Math.min(1, max / Math.max(sw, sh));
  const c = document.createElement('canvas');
  c.width = Math.round(sw * k);
  c.height = Math.round(sh * k);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, c.width, c.height);
  bmp.close();
  return new Promise((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error('제품 이미지를 준비하지 못했습니다.'))), 'image/jpeg', quality));
}

/** Fire-and-forget usage note for the owner's records (survives the page closing). */
async function report(seconds: number, ok: boolean) {
  try {
    await fetch(`${AI_TRYON_URL}/realtime/report`, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seconds: Math.round(seconds * 10) / 10, ok }) });
  } catch {
    /* bookkeeping only */
  }
}

function sessionToken() {
  try {
    return localStorage.getItem('lagi-session');
  } catch {
    return null;
  }
}

/** The whole picture (no cropping), longest side `max` px, as JPEG. */
async function scaledJpeg(blob: Blob, max: number): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return new Promise((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error('참조 사진을 준비하지 못했습니다.'))), 'image/jpeg', 0.9));
}

/** One still from the live camera (longest side 1024 px, JPEG) — the "person" of the try-on reference photo. */
async function cameraStill(video: HTMLVideoElement | null, mirror: boolean): Promise<string | null> {
  if (!video) return null;
  for (let i = 0; i < 20 && (!video.videoWidth || video.readyState < 2); i++) await new Promise((r) => setTimeout(r, 100));
  if (!video.videoWidth) return null;
  const k = Math.min(1, 1024 / Math.max(video.videoWidth, video.videoHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(video.videoWidth * k);
  c.height = Math.round(video.videoHeight * k);
  const g = c.getContext('2d');
  if (!g) return null;
  // The Decart connection flips a front camera (mirror:'auto') before sending; the still must match what the AI will see.
  if (mirror) {
    g.translate(c.width, 0);
    g.scale(-1, 1);
  }
  g.drawImage(video, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.9);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  // The member session goes along so the owner's account can skip the daily limit.
  const token = sessionToken();
  let res: Response;
  try {
    res = await fetch(`${AI_TRYON_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
  } catch {
    const err = new ApiError('AI 서버에 닿지 못했습니다. 인터넷 연결을 확인해 주세요. 계속되면 서버가 점검 중일 수 있어요.');
    err.reason = 'network';
    throw err;
  }
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
  // Seconds until a new session may start: the server still counts the last one as open until it releases it or its lease runs out.
  const [wait, setWait] = useState(0);
  const leaseUntil = useRef(0);
  const [left, setLeft] = useState(20);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [remaining, setRemaining] = useState<number | 'unlimited' | null>(null);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  // Connected but the AI has not sent a generated frame yet (queued or warming up).
  const [waiting, setWaiting] = useState<string | null>(null);
  const [stage, setStage] = useState<'permission' | 'checking' | 'prefit' | 'connecting' | null>(null);
  const [fail, setFail] = useState<'failed' | 'disconnected' | 'limited' | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);
  // Optional local recording of the output video (never uploaded).
  const [recOn, setRecOn] = useState(false);
  const [recording, setRecording] = useState(false);
  const [clip, setClip] = useState<{ url: string; ext: string; size: number } | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  // Diagnostic mode (add &debug=1 to the address): keeps one picture of the AI's raw frame, the camera and the result side by side.
  const debug = typeof window !== 'undefined' && /[?&]debug=1(&|$)/.test(window.location.hash);
  // Developer settings and the measurement panel are for people comparing pipelines; visitors never see them. Any developer flag in the address turns them on.
  const [diag, setDiag] = useState<string | null>(null);
  // "정확한 사진": the live pose re-made by the photo compositor, which keeps the real product design.
  const [exact, setExact] = useState<{ busy: boolean; image?: string; error?: string }>({ busy: false });
  const out = useRef<HTMLVideoElement>(null);
  const local = useRef<HTMLVideoElement>(null);
  const session = useRef<{ stop: () => void; setPrompt: (p: string) => Promise<void>; setImage: (b: Blob, p: string) => Promise<void> } | null>(null);
  const garment = useRef<{ id: string; blob: Blob; description?: string; green?: Blob; product?: HTMLCanvasElement } | null>(null);
  // Real design mapped onto the green bag the AI draws (on by default); off shows the AI's own drawing.
  // The default is the "Anywear" way: the Worker's model (Decart's virtual try-on, which draws the product itself from the reference
  // photo) and no green-screen overlay. Address flags go back to the old way: &model=lucy-2.6 and &map=1.
  const flags = typeof window !== 'undefined' ? window.location.hash : '';
  const devMode = /[?&](debug|pipe|prefit|provider|map|model)=/.test(flags);
  const pipe = parsePipeline(flags);
  const wantModel = pipe.model;
  // Anywear's step for bags (Decart's examples): first make one still of THIS visitor holding THIS product and use it as the
  // reference, instead of the bare product photo. Opt-in with &prefit=1 until it has been checked on real runs.
  const prefitOn = pipe.reference === 'prefit';
  const [mapOn, setMapOn] = useState(/[?&]map=1(&|$)/.test(flags));
  // The flags are read again when the address changes while no session is running (a pasted address does not rebuild the page).
  useEffect(() => {
    if (phase === 'idle' || phase === 'ended') setMapOn(/[?&]map=1(&|$)/.test(flags));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flags]);
  const vtonRef = useRef(false);
  const liveModel = useRef<string>('lucy-vton-3.6');
  const livePrefit = useRef(false);
  const liveProductId = useRef<string | null>(null);
  const mapped = useRef<HTMLCanvasElement>(null);
  const mapper = useRef<DesignMapper | null>(null);

  // Counts the wait down once a second (only while there is one).
  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setInterval(() => setWait((w) => Math.max(0, w - 1)), 1000);
    return () => window.clearInterval(id);
  }, [wait > 0]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // A new way of wearing it, or another product, while live: send it without reconnecting (Anywear's "switch without reconnecting").
  useEffect(() => {
    const s = session.current;
    if (phase !== 'live' || !product || !s) return;
    if (!mapOn && liveProductId.current && liveProductId.current !== product.id) {
      liveProductId.current = product.id;
      void garmentBlob(product)
        .then((r) => s.setImage(r.blob, promptFor(product, stylePrompt, r.description, liveModel.current, livePrefit.current)))
        .catch(() => undefined);
      return;
    }
    void s.setPrompt(mapOn ? greenPromptFor(product, stylePrompt, vtonRef.current) : promptFor(product, stylePrompt, garment.current?.description, liveModel.current, livePrefit.current)).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const cam = local.current;
      m.draw(c.getContext('2d', { willReadFrequently: true })!, v, c.width, c.height, cam && cam.videoWidth > 0 && cam.readyState >= 2 ? { source: cam, mirror: facing === 'user', width: cam.videoWidth, height: cam.videoHeight } : undefined);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, waiting, mapOn, facing]);

  // Diagnostic picture, refreshed every 1.5 s while live so the last one before the session ends can be saved.
  useEffect(() => {
    if (!debug || phase !== 'live' || waiting) return;
    const take = () => {
      const v = out.current;
      const cam = local.current;
      if (!v || !v.videoWidth) return;
      const pw = 960;
      const ph = Math.round((v.videoHeight / v.videoWidth) * pw);
      const c = document.createElement('canvas');
      c.width = pw * 3;
      c.height = ph + 36;
      const g = c.getContext('2d')!;
      g.fillStyle = '#000';
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(v, 0, 36, pw, ph);
      if (cam && cam.videoWidth) {
        g.save();
        if (facing === 'user') {
          g.translate(pw * 2, 0);
          g.scale(-1, 1);
          g.drawImage(cam, 0, 36, pw, ph);
        } else g.drawImage(cam, pw, 36, pw, ph);
        g.restore();
      }
      const m = mapped.current;
      if (mapOn && m && m.width) g.drawImage(m, pw * 2, 36, pw, ph);
      else g.drawImage(v, pw * 2, 36, pw, ph);
      g.fillStyle = '#fff';
      g.font = '700 22px sans-serif';
      g.fillText('1 AI raw frame', 10, 26);
      g.fillText('2 camera (flipped like the AI input)', pw + 10, 26);
      g.fillText(`3 result (design mapping ${mapOn ? 'ON' : 'OFF'})`, pw * 2 + 10, 26);
      c.toBlob((b) => {
        if (!b) return;
        setDiag((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(b);
        });
      }, 'image/png');
    };
    const id = window.setInterval(take, 1500);
    return () => window.clearInterval(id);
  }, [debug, phase, waiting, mapOn, facing]);

  /** The clean product photo of the product's own data (white background, front view): used as it is, never redrawn. */
  const cleanRef = (p: Product) => p.fitting?.image ?? p.drawings?.find((d) => d.group === 'view')?.src ?? p.images[0];

  async function garmentBlob(p: Product) {
    if (garment.current?.id === p.id && (!mapOn || garment.current.product)) return garment.current;
    const base = `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}`;
    if (pipe.reference !== 'legacy') {
      // The ORIGINAL photo, only trimmed to the product and padded on white (no AI redraw: colours, prints, logo, handles stay as they are).
      const url = new URL(cleanRef(p), base).toString();
      // A hand-written exact description from the product data beats the one the server writes from the photo (and costs nothing).
      const [{ description }, photo] = await Promise.all([
        p.fitting?.description ? Promise.resolve({ description: p.fitting.description }) : post<{ description?: string }>('/cutout', { productImage: url, describeOnly: true }),
        fetch(url).then((r) => (r.ok ? r.blob() : Promise.reject(new Error('제품 사진을 불러오지 못했습니다.')))),
      ]);
      garment.current = { id: p.id, blob: await smallReference(photo, 1280, 0.95), description };
    } else {
      const { image, description } = await post<{ image: string; description?: string }>('/cutout', { productImage: new URL(p.images[0], base).toString() });
      garment.current = { id: p.id, blob: await smallReference(await (await fetch(image)).blob()), description };
    }
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
      if (typeof MediaRecorder === 'undefined') {
        setRecError('이 브라우저는 영상 녹화를 지원하지 않아요. 영상은 보이지만 저장되지 않습니다.');
        return;
      }
      const src: MediaStream | null = mapOn && mapped.current ? mapped.current.captureStream(30) : ((out.current?.srcObject as MediaStream | null) ?? null);
      if (!src) return;
      const type = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t));
      const rec = new MediaRecorder(src, type ? { mimeType: type } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        setRecording(false);
        if (!chunks.length) {
          setRecError('녹화된 영상이 비어 있어 저장할 수 없어요.');
          return;
        }
        const blob = new Blob(chunks, { type: rec.mimeType || 'video/webm' });
        setClip((old) => {
          if (old) URL.revokeObjectURL(old.url);
          return { url: URL.createObjectURL(blob), ext: blob.type.includes('mp4') ? 'mp4' : 'webm', size: blob.size };
        });
      };
      rec.onerror = () => setRecError('녹화 중 오류가 발생해 저장하지 못했어요.');
      rec.start(1000);
      recorder.current = rec;
      setRecording(true);
    } catch {
      setRecording(false);
      setRecError('녹화를 시작하지 못했어요. 영상은 계속 보이지만 저장되지 않습니다.');
    }
  }

  async function start() {
    if (!product || phase === 'starting' || phase === 'live' || !consent) return;
    setError(null);
    setFail(null);
    setRecError(null);
    setUnsupported(false);
    const lacking = missingSupport();
    if (lacking) {
      setFail('failed');
      setUnsupported(true);
      setError(lacking);
      return;
    }
    if (!product.images?.[0]) {
      setFail('failed');
      setError('이 상품의 사진을 찾지 못해 AI 영상을 시작할 수 없어요. 다른 상품을 골라 주세요.');
      return;
    }
    setEvidence(null);
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
    let tokenAt = 0;
    let connectedAt = 0;
    const t0 = Date.now();
    const ev: Evidence = {
      at: new Date().toISOString(), pipeline: pipe.id + (pipe.provider ? `/${pipe.provider}` : ''), model: '', sdkIsMock: false, speed: 'standard', requestedSeconds: 0, product: product.id, designMapping: mapOn,
      msTokenReceived: null, msConnected: null, msFirstGenerationTick: null, msFirstVideoFrame: null, generationTicks: 0, firstFrameCameFromTick: false,
      outputResolution: null, framesSeen: 0, fps: null, maxFrameGapMs: null, stalls200ms: 0, meanDiffFromInput: null, diffSamples: 0, sessionEndedReason: null, error: null, actualSessionSeconds: null,
      prefit: { used: false, ms: null, note: prefitOn ? null : '꺼짐' },
      connectionStates: [], diagnostics: [], queuePositions: [], generationEnded: [],
    };
    let lastFrameAt = 0;
    let firstFrameAt = 0;
    let diffSum = 0;
    let stopFrames: (() => void) | null = null;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      stopFrames?.();
      if (tokenAt) {
        ev.actualSessionSeconds = connectedAt ? Math.round((Date.now() - connectedAt) / 100) / 10 : null;
        ev.fps = firstFrameAt && ev.framesSeen > 1 ? Math.round((ev.framesSeen / ((lastFrameAt - firstFrameAt) / 1000)) * 10) / 10 : null;
        ev.meanDiffFromInput = ev.diffSamples ? Math.round((diffSum / ev.diffSamples) * 10) / 10 : null;
        setEvidence({ ...ev });
      }
      // Tell the Worker how long it really ran. Advisory bookkeeping only (the Worker never trusts it for limits).
      if (tokenAt) void report(connectedAt ? (Date.now() - connectedAt) / 1000 : 0, !!connectedAt && gotFrames);
      // The session is over: free this visitor's "open session" slot so they can start again at once. A server that does not
      // know this call yet (or a failed call) leaves the slot to run out by itself, so show the visitor a short countdown.
      if (tokenAt) {
        const left = Math.ceil((leaseUntil.current - Date.now()) / 1000);
        if (left > 0) setWait(left);
        void post('/realtime/release', {})
          .then(() => {
            leaseUntil.current = 0;
            setWait(0);
          })
          .catch(() => undefined);
      }
      window.clearInterval(timer);
      try {
        if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
      } catch {
        /* already stopped */
      }
      recorder.current = null;
      try {
        rt?.disconnect();
      } catch {
        /* a failed disconnect must not leave the camera on: the tracks are stopped just below */
      }
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
        // The best picture the camera can give: ask for 1080p (the browser picks the closest the device has, never failing for a
        // camera that stops at 720p), at the model's frame rate. The model itself works at 1280x720, so a sharper source simply
        // gives it more to work from.
        video: { facingMode: facing, frameRate: model.fps, width: { ideal: Math.max(1920, model.width) }, height: { ideal: Math.max(1080, model.height) } },
      });
      if (local.current) local.current.srcObject = stream;
      // 2. Check what will be sent: the camera really delivers video, and the product reference is ready.
      setStage('checking');
      const track = stream.getVideoTracks()[0];
      {
        const st = track?.getSettings?.() ?? {};
        ev.camera = st.width && st.height ? `${st.width}×${st.height}${st.frameRate ? ` @ ${Math.round(st.frameRate)}fps` : ''}` : undefined;
      }
      if (!track || track.readyState !== 'live') throw new Error('카메라 영상이 들어오지 않습니다. 다른 앱이 카메라를 쓰고 있지 않은지 확인해 주세요.');
      // 2a. The network, before anything is paid for: gather ICE candidates (a free STUN probe, no Decart session is opened). A network
      //     that cannot carry realtime video at all (transport "failed", e.g. a blocking mobile network or office firewall) stops here with a
      //     clear message instead of spending a token, a reference picture and a session on a video that cannot arrive.
      try {
        const probe = (await Promise.race([
          sdk.createDecartClient({ apiKey: 'preflight-only' }).realtime.checkConnectivity?.({ iceGatherTimeoutMs: 3000 }),
          new Promise<undefined>((r) => window.setTimeout(() => r(undefined), 5000)),
        ])) as { quality?: string; metrics?: { transport?: string; rttMs?: number | null } } | undefined;
        ev.network = probe?.metrics ? `${probe.metrics.transport ?? '-'} · ${probe.quality ?? '-'}${probe.metrics.rttMs != null ? ` · RTT ${Math.round(probe.metrics.rttMs)} ms` : ''}` : '확인 못 함';
        if (probe?.metrics?.transport === 'failed') throw new Error('이 네트워크에서는 실시간 영상 연결이 되지 않습니다. 와이파이나 다른 네트워크로 바꿔서 다시 시도해 주세요.');
      } catch (e) {
        if ((e as Error).message?.startsWith('이 네트워크')) throw e;
        ev.network = '확인 못 함';
      }
      const ref = await garmentBlob(product);
      // 2b. Anywear's step for bags (opt-in): one still of THIS visitor holding THIS product, made before the paid realtime
      //     session starts, used as the reference. If it cannot be made, the plain product photo is used and the record says so.
      let prefitBlob: Blob | null = null;
      if (prefitOn) {
        setStage('prefit');
        const p0 = Date.now();
        try {
          const still = await cameraStill(local.current, facing === 'user');
          if (!still) throw new Error('카메라 화면을 잡지 못했어요');
          const base = `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}`;
          const made = await post<{ image: string; verified?: boolean; provider?: string; checks?: Record<string, unknown> }>('/realtime/prefit', { person: still, productImage: new URL(cleanRef(product), base).toString(), productName: product.name.value ?? '', carry: carryOf(stylePrompt), ...(isGarment(garmentOf(product.fitting?.part ?? product.category.value)) ? { garment: garmentOf(product.fitting?.part ?? product.category.value) } : {}), ...(pipe.provider ? { provider: pipe.provider } : {}), ...(/[?&]variant=official(&|$)/.test(flags) ? { variant: 'official' } : {}) });
          prefitBlob = await scaledJpeg(await (await fetch(made.image)).blob(), 1024);
          ev.prefit = { used: true, ms: Date.now() - p0, note: made.verified ? '검사 통과' : null, checks: made.checks ? JSON.stringify(made.checks) : null };
        } catch (e) {
          ev.prefit = { used: false, ms: Date.now() - p0, note: `${(e as Error).message || '실패'} → 원본 제품 사진으로 진행` };
        }
      }
      // 3. The token last, right before connecting (it is minted and metered only now).
      setStage('connecting');
      const token = await post<{ apiKey: string; seconds: number; model?: string; remainingToday: number | null }>('/realtime/token', wantModel ? { model: wantModel } : {});
      setRemaining(token.remainingToday ?? 'unlimited');
      tokenAt = Date.now();
      leaseUntil.current = tokenAt + (token.seconds + LEASE_MARGIN_S) * 1000;
      ev.msTokenReceived = tokenAt - t0;
      ev.requestedSeconds = token.seconds;
      ev.sdkIsMock = !!(sdk as { isMock?: boolean }).isMock;
      // The model is chosen by the Worker (default lucy-2.6); the page never switches it by itself. Standard speed: no `speed` option (fast mode bills 2x).
      const rtModel = sdk.models.realtime((token.model ?? 'lucy-2.6') as Parameters<typeof sdk.models.realtime>[0]);
      ev.model = String(rtModel.name ?? token.model ?? '');
      vtonRef.current = ev.model.startsWith('lucy-vton');
      liveModel.current = ev.model || wantModel;
      livePrefit.current = !!prefitBlob;
      const client = sdk.createDecartClient({ apiKey: token.apiKey });
      // The product photo and the instruction go in WITH the connection (Decart's initialState), so the session starts already
      // applying them. Sending them after connecting made the AI wait several seconds before it began to generate.
      const useGreen = !!(mapOn && ref.green && ref.product);
      if (useGreen) mapper.current = createDesignMapper(ref.product!);
      const initImage = useGreen ? ref.green! : (prefitBlob ?? ref.blob);
      const initPrompt = useGreen ? greenPromptFor(product, stylePrompt, vtonRef.current) : promptFor(product, stylePrompt, ref.description, liveModel.current, !!prefitBlob);
      ev.prompt = initPrompt;
      ev.referenceUsed = useGreen ? '초록 실루엣(디자인 입히기)' : prefitBlob ? '내가 입은 참조 사진(검사 통과)' : cleanRef(product);
      let conn: Awaited<ReturnType<typeof client.realtime.connect>>;
      try {
        conn = await client.realtime.connect(stream, {
          model: rtModel,
          mirror: 'auto',
          retries: 1, // a failed first dial is tried once more, not five times (every dial competes for a slot and may be billed)
          initialState: { image: initImage, prompt: { text: initPrompt, enhance: false } },
          onRemoteStream: (remote: MediaStream) => {
            const v = out.current;
            if (!v) return;
            v.srcObject = remote;
            // Mobile browsers do not always autoplay a stream attached while the element was off screen.
            void v.play().catch(() => undefined);
          },
          onQueuePosition: (q: { position: number }) => setWaiting(q.position > 0 ? `대기 중입니다 · ${q.position}번째` : 'AI가 영상을 만들고 있습니다…'),
        });
      } catch (e) {
        throw new Error(`AI 연결 또는 제품 이미지 전달에 실패했습니다: ${(e as Error).message}`);
      }
      rt = conn;
      connectedAt = Date.now();
      ev.msConnected = connectedAt - t0;
      setStage(null);
      setWaiting('AI가 영상을 만들고 있습니다…');
      const short = (v: unknown) => {
        try {
          return JSON.stringify(v).slice(0, 500);
        } catch {
          return String(v).slice(0, 500);
        }
      };
      const stamp = () => Date.now() - t0;
      conn.on('connectionChange', (st) => {
        if (ev.connectionStates.length < 40) ev.connectionStates.push({ state: String(st), ms: stamp() });
        // The SDK would dial again by itself (up to 5 times) after a drop, and each new dial is another billed session that the
        // 20-second cap of the first one does not cover. A dropped session is simply ended; the visitor can press start again
        // (which goes through the Worker's limits).
        if (String(st) === 'reconnecting' && !stopped) {
          ev.error = '연결이 끊겨 자동 재연결 없이 종료했습니다';
          setFail('disconnected');
          setError('연결이 끊겼습니다. 비용 보호를 위해 자동으로 다시 연결하지 않습니다. 다시 시작해 주세요.');
          stop();
        }
      });
      conn.on('diagnostic', (d) => {
        if (ev.diagnostics.length < 30) ev.diagnostics.push({ name: String((d as { name?: string }).name ?? 'diagnostic'), ms: stamp(), data: short((d as { data?: unknown }).data ?? d) });
      });
      conn.on('queuePosition', (q) => {
        if (ev.queuePositions.length < 30) ev.queuePositions.push({ position: Number((q as { position?: number }).position ?? -1), ms: stamp() });
      });
      conn.on('generationEnded', (g) => {
        if (ev.generationEnded.length < 10) ev.generationEnded.push({ ms: stamp(), data: short(g) });
      });
      conn.on('sessionEnded', (e: { reason?: string }) => {
        ev.sessionEndedReason = e?.reason ?? 'ended';
        if (!gotFrames && e?.reason) {
          setFail('failed');
          setError(`AI 영상이 시작되기 전에 세션이 끝났습니다 (${e.reason}).`);
        }
        stop();
      });
      conn.on('error', (e: { message?: string }) => {
        ev.error = e?.message ?? 'error';
        setFail('disconnected');
        setError(e?.message ? `연결이 끊겼습니다: ${e.message}` : '연결이 끊겼습니다.');
        stop();
      });
      liveProductId.current = product.id;
      session.current = { stop, setPrompt: (p: string) => conn.setPrompt(p, { enhance: false }), setImage: (b: Blob, p: string) => conn.setImage(b, { prompt: p, enhance: false }) };
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
      conn.on('generationTick', () => {
        ev.generationTicks++;
        if (ev.msFirstGenerationTick === null) {
          ev.msFirstGenerationTick = Date.now() - t0;
          if (!gotFrames) ev.firstFrameCameFromTick = true;
        }
        onFrames();
      });
      // Frame statistics of the output element: count, gaps (stalls) and how different it is from the camera input.
      const outV = out.current as (HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number; cancelVideoFrameCallback?: (id: number) => void }) | null;
      if (outV?.requestVideoFrameCallback) {
        let id = 0;
        let on = true;
        const probe = document.createElement('canvas');
        probe.width = 32;
        probe.height = 18;
        const pg = probe.getContext('2d', { willReadFrequently: true });
        const probe2 = document.createElement('canvas');
        probe2.width = 32;
        probe2.height = 18;
        const pg2 = probe2.getContext('2d', { willReadFrequently: true });
        let lastDiffAt = 0;
        const tick = () => {
          if (!on) return;
          const now = performance.now();
          if (!firstFrameAt) {
            firstFrameAt = now;
            ev.msFirstVideoFrame = Date.now() - t0;
            ev.outputResolution = `${outV.videoWidth}x${outV.videoHeight}`;
          } else {
            const gap = now - lastFrameAt;
            ev.maxFrameGapMs = Math.max(ev.maxFrameGapMs ?? 0, Math.round(gap));
            if (gap > 200) ev.stalls200ms++;
          }
          lastFrameAt = now;
          ev.framesSeen++;
          const lv = local.current;
          if (pg && pg2 && lv && lv.videoWidth && now - lastDiffAt > 500) {
            lastDiffAt = now;
            try {
              pg.drawImage(outV, 0, 0, 32, 18);
              pg2.drawImage(lv, 0, 0, 32, 18);
              const a = pg.getImageData(0, 0, 32, 18).data;
              const b = pg2.getImageData(0, 0, 32, 18).data;
              // the AI output may be mirrored relative to the camera: take the smaller of the two differences
              let d1 = 0;
              let d2 = 0;
              for (let y = 0; y < 18; y++)
                for (let x = 0; x < 32; x++) {
                  const i = (y * 32 + x) * 4;
                  const j = (y * 32 + (31 - x)) * 4;
                  for (let c = 0; c < 3; c++) {
                    d1 += Math.abs(a[i + c] - b[i + c]);
                    d2 += Math.abs(a[i + c] - b[j + c]);
                  }
                }
              diffSum += Math.min(d1, d2) / (32 * 18 * 3);
              ev.diffSamples++;
            } catch {
              /* a frame that cannot be read is simply not counted */
            }
          }
          id = outV.requestVideoFrameCallback!(tick);
        };
        id = outV.requestVideoFrameCallback(tick);
        stopFrames = () => {
          on = false;
          outV.cancelVideoFrameCallback?.(id);
        };
      }
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
      ev.error = (e as Error)?.message ?? String(e);
      stop();
      const name = (e as DOMException)?.name;
      const reason = (e as ApiError).reason;
      if (reason === 'busy_ip') {
        // The previous session's slot is still counted as open on the server: it frees itself in a few seconds.
        setWait(Math.max(5, Math.ceil((leaseUntil.current - Date.now()) / 1000)));
        ev.error = '이전 체험을 정리하는 중';
      }
      const limited = reason === 'daily_limit' || reason === 'site_limit' || reason === 'busy_ip' || reason === 'busy_site' || reason === 'quota_unavailable';
      setFail(limited ? 'limited' : 'failed');
      setError(
        name === 'NotAllowedError'
          ? '카메라 권한이 꺼져 있습니다. 주소창의 카메라 설정에서 허용한 뒤 다시 시작해 주세요.'
          : name === 'NotFoundError' || name === 'OverconstrainedError'
            ? '사용할 수 있는 카메라를 찾지 못했습니다. 카메라가 연결되어 있는지 확인해 주세요.'
            : name === 'NotReadableError' || name === 'AbortError'
              ? '카메라를 열지 못했습니다. 다른 앱이나 탭이 카메라를 쓰고 있다면 닫은 뒤 다시 시작해 주세요.'
              : reason === 'busy_ip'
                ? '이전 체험을 정리하는 중입니다. 몇 초 뒤에 다시 시작해 주세요.'
                : reason === 'network'
                  ? (e as Error).message
                  : (e as Error).message || '실시간 착용을 시작하지 못했습니다. 잠시 뒤에 다시 시작해 주세요.',
      );
    }
  }

  function saveEvidence() {
    if (!evidence) return;
    const blob = new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lagi-live-measure-${evidence.product}-${evidence.at.replace(/[:.]/g, '-')}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
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
    : unsupported ? 'unsupported'
    : fail ? fail
    : phase === 'ended' ? 'ended'
    : product && consent ? 'ready' : 'before';

  return (
    <div className="mt-16 grid grid-cols-1 gap-x-[var(--gap)] gap-y-16 lg:grid-cols-12">
      <div className="lg:col-span-12">
        {/* The fitting screen is the biggest thing on the page: edge to edge on phones, wider than the text column on desktop, brand blue (never black) around the picture. */}
        <div className="relative -mx-[var(--page-x)] flex aspect-[4/5] items-center justify-center overflow-hidden bg-[var(--c-blue)] md:mx-0 md:aspect-video md:rounded-[var(--radius-card)] lg:-mx-[6vw]" data-testid="live-stage">
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
              <span className="t-label t-mark absolute left-3 top-3 bg-white px-2 py-1 text-[var(--c-blue)]">AI live</span>
              <span className="t-h2 t-mark absolute right-3 top-2 tabular-nums text-[var(--c-white)]" aria-live="polite" data-testid="countdown">
                {left}
              </span>
            </>
          )}
        </div>
        <div className="mt-3" data-testid="live-steps" data-step={step}>
          <ol className="flex flex-wrap gap-x-4 gap-y-1" aria-label="진행 단계">
            {STEP_ORDER.filter((k) => k !== 'prefit' || prefitOn).map((k) => {
              const at = STEP_ORDER.indexOf(step);
              const here = k === step;
              const done = at > STEP_ORDER.indexOf(k);
              return (
                <li key={k} className={`t-caption kr ${here ? 'font-bold text-[var(--c-ink)]' : done ? 'text-[var(--c-ink)]' : 'text-[var(--c-mute)]'}`} aria-current={here ? 'step' : undefined}>
                  {done ? '✓ ' : here ? '● ' : '○ '}
                  {k === 'ready' ? '준비' : k === 'permission' ? '카메라' : k === 'checking' ? '입력 검사' : k === 'prefit' ? '참조 사진' : k === 'connecting' ? '서버 연결' : k === 'processing' ? 'AI 처리' : k === 'live' ? '영상 출력' : '종료'}
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
        {evidence && devMode && (
          <div className="mt-6 rounded-[var(--radius-card)] border border-black/10 p-4" data-testid="evidence">
            <h3 className="t-h3 kr">이번 세션 측정 기록</h3>
            {evidence.sdkIsMock && (
              <p className="t-caption kr mt-2 font-bold text-[var(--c-blue)]" data-testid="evidence-mock">
                모의 SDK 화면입니다. 실제 AI가 만든 영상이 아닙니다.
              </p>
            )}
            <dl className="t-caption kr mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt>파이프라인</dt><dd>{evidence.pipeline}</dd>
              <dt>카메라 입력</dt><dd>{evidence.camera ?? '-'}</dd>
              <dt>네트워크 사전 검사</dt><dd>{evidence.network ?? '-'}</dd>
              <dt>기준 사진</dt><dd>{evidence.referenceUsed ?? '-'}</dd>
              <dt>AI에게 보낸 지시문</dt><dd className="break-words">{evidence.prompt ?? '-'}</dd>
              <dt>모델 · 속도</dt><dd>{evidence.model || '-'} · 표준</dd>
              <dt>토큰까지</dt><dd>{evidence.msTokenReceived ?? '-'} ms</dd>
              <dt>연결까지</dt><dd>{evidence.msConnected ?? '-'} ms</dd>
              <dt>내가 든 참조 사진(prefit)</dt><dd>{evidence.prefit.used ? `사용 · ${evidence.prefit.ms} ms · ${evidence.prefit.note ?? ''} ${evidence.prefit.checks ?? ''}` : `사용 안 함${evidence.prefit.note ? ` · ${evidence.prefit.note}` : ''}`}</dd>
              <dt>첫 AI 생성 신호(generationTick)</dt><dd>{evidence.msFirstGenerationTick ?? '없음'} ms · {evidence.generationTicks}회</dd>
              <dt>첫 영상 프레임</dt><dd>{evidence.msFirstVideoFrame ?? '없음'} ms{evidence.msFirstVideoFrame !== null && !evidence.firstFrameCameFromTick ? ' (생성 신호보다 먼저 화면이 재생됨)' : ''}</dd>
              <dt>출력 해상도 · FPS</dt><dd>{evidence.outputResolution ?? '-'} · {evidence.fps ?? '-'}</dd>
              <dt>끊김(200ms 이상)</dt><dd>{evidence.stalls200ms}회 (최대 {evidence.maxFrameGapMs ?? '-'} ms)</dd>
              <dt>입력과 다른 정도</dt><dd>{evidence.meanDiffFromInput ?? '-'} / 255 ({evidence.diffSamples}회 표본)</dd>
              <dt>실제 세션 시간</dt><dd>{evidence.actualSessionSeconds ?? '-'} 초 (요청 {evidence.requestedSeconds}초)</dd>
              <dt>연결 상태 변화(SDK)</dt><dd>{evidence.connectionStates.length ? evidence.connectionStates.map((c) => `${c.state}@${c.ms}`).join(' → ') : '기록 없음'}</dd>
              <dt>진단(SDK)</dt><dd>{evidence.diagnostics.length ? evidence.diagnostics.map((d) => d.name).join(', ') : '없음'}</dd>
              <dt>종료 사유 · 오류</dt><dd>{evidence.sessionEndedReason ?? '-'} · {evidence.error ?? '없음'}</dd>
            </dl>
            <button type="button" className="btn btn-line mt-3" onClick={saveEvidence} data-testid="save-evidence">
              측정 기록 저장 (JSON)
            </button>
          </div>
        )}
        {debug && diag && (
          <p className="mt-3">
            <a href={diag} download={`lagi-diag-${product?.id ?? 'product'}.png`} className="btn btn-line" data-testid="save-diag">
              진단 이미지 저장 (AI 원본 · 카메라 · 합성)
            </a>
          </p>
        )}
        {recError && (
          <p className="t-caption kr mt-2 text-[var(--c-blue)]" role="alert" data-testid="rec-error">
            {recError}
          </p>
        )}
        {phase === 'ended' && product && (
          <p className="mt-4">
            <Link to={`/product/${product.id}`} className="t-caption kr font-semibold underline underline-offset-2" data-testid="to-product">
              {product.name.value ?? '이 상품'} 상품 상세 보기
            </Link>
          </p>
        )}
        {recording && (
          <p className="t-caption kr mt-2 text-[var(--c-ink)]" data-testid="rec-on">
            ● 이 기기에 녹화 중입니다 (서버로 보내지 않습니다)
          </p>
        )}
        {clip && (
          <div className="mt-6" data-testid="clip-result">
            <video src={clip.url} controls playsInline muted className="block h-auto w-full max-w-xl bg-[var(--c-blue)]" />
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

      <div className="mx-auto w-full max-w-xl space-y-8 lg:col-span-12">

        <section aria-labelledby="l3">
          <h2 id="l3" className="t-h3 kr">
            실시간 착용
          </h2>
          <div className="mt-3 flex gap-2">
            {(['user', 'environment'] as const).map((f) => (
              <button key={f} type="button" aria-pressed={facing === f} disabled={live || phase === 'starting'} onClick={() => setFacing(f)} className="chip disabled:opacity-40">
                {f === 'user' ? '앞 카메라' : '뒤 카메라'}
              </button>
            ))}
          </div>
          {devMode && (
          <label className="t-caption kr mt-4 flex items-start gap-3 rounded-[var(--radius-card)] border border-black/10 p-3">
            <input type="checkbox" className="mt-1" checked={mapOn} disabled={live || phase === 'starting'} onChange={(e) => setMapOn(e.target.checked)} data-testid="map-toggle" />
            <span>
              <b className="block text-[var(--c-ink)]">실제 디자인 입히기 (실험)</b>
              켜면 AI는 제품 모양의 초록 가방만 들게 만들고, 그 위에 실제 제품 사진을 붙입니다. 사진이 평평하게 붙어 움직임이 어색할 수 있어요. 끄면 AI가 제품을 직접 그려 자연스럽지만 무늬가 실제와 조금 다를 수 있어요.
            </span>
          </label>
          )}
          {typeof MediaRecorder !== 'undefined' && (
            <label className="t-caption kr mt-4 flex items-start gap-3 rounded-[var(--radius-card)] border border-black/10 p-3">
              <input type="checkbox" className="mt-1" checked={recOn} disabled={live || phase === 'starting'} onChange={(e) => setRecOn(e.target.checked)} data-testid="rec-toggle" />
              <span>
                <b className="block text-[var(--c-ink)]">영상 녹화</b>
                이 기기에만 저장됩니다.
              </span>
            </label>
          )}
          <label className="t-caption kr mt-4 flex items-start gap-2 rounded-[var(--radius-card)] bg-[var(--c-gray)] p-3">
            <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>카메라 영상이 AI 서버(Decart)로 실시간 전송되는 것에 동의합니다. 라기는 영상을 저장하지 않습니다.</span>
          </label>
          <button
            type="button"
            onClick={start}
            disabled={!product || !consent || live || phase === 'starting' || wait > 0}
            className="btn btn-primary mt-5 w-full"
            data-testid="start-button"
          >
            {phase === 'starting' ? '연결 중…' : wait > 0 ? `정리 중 · ${wait}초 후 다시 시작` : phase === 'ended' ? '다시 시작' : '실시간 착용 시작'}
          </button>
          {!product && <p className="t-caption kr mt-2 text-[var(--c-mute)]">먼저 제품을 고르세요.</p>}
          <p className="t-caption kr mt-3 text-[var(--c-mute)]">
            20초 · 하루 3번{remaining === 'unlimited' ? ' (제한 없음)' : remaining != null ? ` (남은 횟수 ${remaining}번)` : ''} · AI가 만든 영상이라 실제와 다를 수 있습니다.
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
