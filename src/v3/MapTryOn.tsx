import { useEffect, useRef, useState } from 'react';
import type { HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { Product } from '@/data/productTypes';
import { AI_TRYON_URL, requestAiTryOn } from '@/tryon/aiTryOn';
import { easeAngle, handYaw as handYawOf, keyMatte, loadHands, loadPose, paint, placeFor, smooth, type Placement, type Pt } from './productOverlay';
import { buildBag, createBagLayer } from './bag3d';
import { FitBench } from './fitBench';
import { HAND_HOLD_MS, HoldPolicy, OneEuro, OneEuroAngle, Swing, isHandJump } from './fitFilter';

/** Fitting engine from the page address: `?engine=v1` (original), `v2` (default), `v3` (contact shadow, swing, loss policy). */
const engineOf = (): 'v1' | 'v2' | 'v3' => {
  const e = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('engine');
  return e === 'v1' || e === 'v3' ? e : 'v2';
};

type Phase = 'idle' | 'loading' | 'live' | 'ended';

/** Ways of wearing where the hand holds the product, so the hand is drawn back over it. */
const HELD = new Set(['hand', 'elbow', 'acc-hand', 'acc-show']);

const thumbCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
/** A 48×27 colour thumbnail, for matching the late AI frame to the moment it was made from. */
function thumb(src: CanvasImageSource): Uint8ClampedArray {
  const c = thumbCanvas!;
  c.width = 48;
  c.height = 27;
  const x = c.getContext('2d', { willReadFrequently: true })!;
  x.drawImage(src, 0, 0, 48, 27);
  return x.getImageData(0, 0, 48, 27).data;
}

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
  const layer = useRef<{ id: string; l: ReturnType<typeof createBagLayer>; aspect: number; widthCm: number; handleCm: number; gripCm?: number } | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const pose = useRef<Promise<PoseLandmarker> | null>(null);
  const hands = useRef<Promise<HandLandmarker | null> | null>(null);
  const [handSeen, setHandSeen] = useState(false);
  const matte = useRef<{ id: string; img: HTMLCanvasElement } | null>(null);
  const placed = useRef<Placement | null>(null);
  // Live values the drawing loop reads without restarting.
  // Turning the 3D bag: the hand turns it; dragging on the stage adds a turn of its own.
  const spin = useRef(0);
  const dragX = useRef<number | null>(null);
  // AI realism: the composited scene goes to the realtime AI, which only re-lights it.
  const [aiOn, setAiOn] = useState(false);
  const [aiState, setAiState] = useState<{ busy: boolean; left?: number; error?: string }>({ busy: false });
  const aiVideo = useRef<HTMLVideoElement>(null);
  const aiOut = useRef<HTMLCanvasElement>(null);
  const aiConn = useRef<{ stop: () => void } | null>(null);
  const opts = useRef({ styleKey, size, product, facing, aiOn });
  opts.current = { styleKey, size, product, facing, aiOn };

  const stop = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    placed.current = null;
    setPhase((p) => (p === 'idle' ? p : 'ended'));
  };
  useEffect(() => stop, []);
  // Leaving the page: free the 3D layer (WebGL context, textures) and the body/hand models.
  const gone = useRef(false);
  useEffect(() => {
    gone.current = false;
    return () => {
      gone.current = true;
      layer.current?.l.dispose(true);
      layer.current = null;
      pose.current?.then((m) => m.close()).catch(() => undefined);
      hands.current?.then((m) => m?.close()).catch(() => undefined);
      pose.current = null;
      hands.current = null;
    };
  }, []);
  useEffect(() => {
    const onHide = () => document.hidden && stop();
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  // A different product while live: fetch its image; the loop picks it up.
  useEffect(() => {
    if (phase !== 'live' || !product || product.model3d || matte.current?.id === product.id) return;
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
      // The hand model turns a held 3D bag with the hand; without it the bag still follows the wrist.
      if (product.model3d) hands.current ??= loadHands().catch(() => null);
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
        if (gone.current) {
          bag.dispose();
          return;
        }
        layer.current = { id: product.id, l: createBagLayer(gl.current!, bag, { realism: engineOf() === 'v3' }), aspect: model.widthCm / (model.heightCm + model.handleCm), widthCm: model.widthCm, handleCm: model.handleCm, gripCm: model.gripCm };
      }
      setStatus(null);
      setPhase('live');
      // Never wait long for the hand model: the bag follows the wrist until it is ready.
      const handReady = product.model3d && hands.current ? await Promise.race([hands.current, new Promise<null>((ok) => window.setTimeout(() => ok(null), 8000))]) : null;
      run(marker, handReady);
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
  function run(marker: PoseLandmarker, handMarker: HandLandmarker | null) {
    const v = video.current;
    const c = canvas.current;
    if (!v || !c) return;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    const raw = document.createElement('canvas');
    const rctx = raw.getContext('2d', { willReadFrequently: true })!;
    let lm: Pt[] | null = null;
    let bodyYaw = 0;
    let handYaw = 0;
    // Where the hand holds the bag (knuckle line) when the hand model sees it, in video pixels.
    let grip: { x: number; y: number } | null = null;
    // The 21 hand joints in display pixels, for drawing the whole hand (every finger) over the bag.
    let handPts: { x: number; y: number }[] | null = null;
    // Pixels per cm of the hand, from its 3D joints, eased: does not change when the hand turns.
    let handScale = 0;
    // Fitting engine: V2 (One Euro smoothing, jump rejection, short hold on loss) unless `?engine=v1`.
    // V1 stays selectable for side-by-side comparison. `?fitdebug=1` records per-frame telemetry on window.__fit.
    const query = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
    const eng = engineOf();
    const v2 = eng !== 'v1';
    const v3 = eng === 'v3';
    const policy = new HoldPolicy();
    const swing = new Swing();
    let freshAt = -1e9; // time of the last real hand detection
    let freshSeen = -1e9;
    let tint: [number, number, number] = [1, 1, 1];
    const telemetry: Record<string, number | boolean>[] | null = query.get('fitdebug') ? ((window as unknown as { __fit: unknown[] }).__fit = []) as Record<string, number | boolean>[] : null;
    const fx = new OneEuro(2.0, 0.008);
    const fy = new OneEuro(2.0, 0.008);
    const fw = new OneEuro(0.8, 0.002);
    const fyaw = new OneEuroAngle(1.5, 0.8);
    let lastFromHand: Placement | null = null;
    let lastHandAt = -1e9;
    let rawGrip: { x: number; y: number } | null = null;
    let rejected = 0;
    // V3: the person mask as an alpha canvas, to trim the hand overlay's halo (background pixels near the fingers).
    let personVer = 0;
    let personDrawn = -1;
    const personCv = document.createElement('canvas');
    const personCtx = personCv.getContext('2d')!;
    const shade = document.createElement('canvas');
    const shadeCtx = shade.getContext('2d')!;
    const handMask = document.createElement('canvas');
    const hmctx = handMask.getContext('2d')!;
    let handMiss = 0;
    const handCrop = document.createElement('canvas');
    const handCtx = handCrop.getContext('2d', { willReadFrequently: true })!;
    let brightness = 0.6;
    let tick = 0;
    const tctx = top.current?.getContext('2d');
    let mask: { data: Float32Array; w: number; h: number } | null = null;
    let lastDetect = 0;
    let lastT = -1;
    let misses = 0;

    const bench = query.get('bench')
      ? new FitBench(`${engineOf()} ${product?.id ?? ''}`, { durSec: Number(query.get('dur')) || 0, device: query.get('dev') ?? undefined, post: !!query.get('post') })
      : null;
    const benchWrapped = new WeakSet<object>();
    const frame = (now: number) => {
      if (!stream.current) {
        bench?.stop();
        return;
      }
      const t0 = performance.now();
      if (bench && layer.current && !benchWrapped.has(layer.current)) {
        // Feed the bench with where the bag is actually drawn each frame.
        benchWrapped.add(layer.current);
        const l = layer.current.l;
        const orig = l.render.bind(l);
        l.render = (W, H, p) => {
          bench.draw(performance.now(), p ? { x: p.x, y: p.y, alpha: p.alpha ?? 1 } : null);
          return orig(W, H, p);
        };
      }
      bench?.track(now, !!grip && now - freshAt < 250);
      frameBody(now);
      bench?.frame(now, performance.now() - t0);
    };
    const frameBody = (now: number) => {
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
        const d0 = performance.now();
        const res = marker.detectForVideo(v, now);
        bench?.det('pose', performance.now() - d0);
        const l = res.landmarks[0];
        lm = l ? l.map((q) => ({ x: (mirrored ? 1 - q.x : q.x) * W, y: q.y * H, visibility: q.visibility })) : null;
        // Body turn from the 3D landmarks (metres): the shoulder line's depth gives the yaw.
        const wl = res.worldLandmarks?.[0];
        if (wl) {
          const dx = wl[12].x - wl[11].x;
          const dz = wl[12].z - wl[11].z;
          const target = Math.max(-1.3, Math.min(1.3, Math.atan2(dz, Math.abs(dx)) * (mirrored ? -1 : 1) * Math.sign(dx || 1) * -1));
          bodyYaw += (target - bodyYaw) * 0.35;
        }
        // The hand: its full turn (palm, side, back of the hand) turns the held bag the same way.
        if (handMarker) {
          // A hand far from the camera is small; look at an enlarged square around the wrist the pose found.
          let crop: { x: number; y: number; size: number } | null = null;
          if (lm) {
            const useR = (lm[16]?.visibility ?? 0) >= (lm[15]?.visibility ?? 0);
            const wr = lm[useR ? 16 : 15];
            const el = lm[useR ? 14 : 13];
            if ((wr?.visibility ?? 0) > 0.4) {
              const fore = el ? Math.hypot(wr.x - el.x, wr.y - el.y) : W * 0.1;
              const size = Math.max(96, Math.min(W, H, fore * 2.4));
              // Centre a little past the wrist, towards the fingers.
              const cxm = wr.x + (el ? (wr.x - el.x) * 0.35 : 0);
              const cym = wr.y + (el ? (wr.y - el.y) * 0.35 : 0);
              const cx = mirrored ? W - cxm : cxm; // back to raw camera coordinates
              crop = { x: Math.max(0, Math.min(W - size, cx - size / 2)), y: Math.max(0, Math.min(H - size, cym - size / 2)), size };
            }
          }
          let src: HTMLCanvasElement | HTMLVideoElement = v;
          if (crop && crop.size < Math.min(W, H) * 0.8) {
            handCrop.width = handCrop.height = 256;
            handCtx.drawImage(v, crop.x, crop.y, crop.size, crop.size, 0, 0, 256, 256);
            src = handCrop;
          } else crop = null;
          const h0 = performance.now();
          const hr = handMarker.detectForVideo(src, now);
          bench?.det('hand', performance.now() - h0);
          const hw = hr.worldLandmarks?.[0];
          const hl = hr.landmarks?.[0];
          const side = (hr.handedness?.[0]?.[0]?.categoryName ?? 'Right') as 'Left' | 'Right';
          const nx0 = hl ? (hl[5].x + hl[17].x) / 2 : 0;
          const ny0 = hl ? (hl[5].y + hl[17].y) / 2 : 0;
          const gx0 = hl ? (crop ? crop.x + nx0 * crop.size : nx0 * W) : 0;
          const gy0 = hl ? (crop ? crop.y + ny0 * crop.size : ny0 * H) : 0;
          const cand = { x: mirrored ? W - gx0 : gx0, y: gy0 };
          const palmNow = hl ? Math.hypot((hl[5].x - hl[17].x) * (crop ? crop.size : W), (hl[5].y - hl[17].y) * (crop ? crop.size : H)) : 0;
          // V2: a detection that jumps further than a hand can move between two detections is a mis-detection.
          const jumped = v2 && !!hw && !!hl && isHandJump(rawGrip, cand, palmNow);
          if (jumped) rejected++;
          if (hw && hl && !jumped) {
            handYaw = v2 ? handYawOf(hw, side, mirrored) : easeAngle(handYaw, handYawOf(hw, side, mirrored), 0.45);
            grip = cand;
            rawGrip = cand;
            handPts = hl.map((q) => {
              const px = crop ? crop.x + q.x * crop.size : q.x * W;
              return { x: mirrored ? W - px : px, y: crop ? crop.y + q.y * crop.size : q.y * H };
            });
            // The hand's 3D joints are in metres; each bone's on-screen length divided by its length across the
            // image plane gives pixels per metre whichever way the hand is turned (both shrink together).
            let pix = 0;
            let met = 0;
            for (const [a, b] of [
              [0, 5],
              [0, 9],
              [0, 13],
              [0, 17],
              [5, 9],
              [9, 13],
              [13, 17],
              [5, 6],
              [9, 10],
            ]) {
              pix += Math.hypot(handPts[a].x - handPts[b].x, handPts[a].y - handPts[b].y);
              met += Math.hypot(hw[a].x - hw[b].x, hw[a].y - hw[b].y);
            }
            if (met > 0.01) {
              const s = pix / met / 100;
              handScale = v2 ? s : handScale ? handScale + (s - handScale) * 0.25 : s;
            }
            handMiss = 0;
            freshAt = now;
          } else if (++handMiss > 8) {
            handScale = 0;
            grip = null;
            handPts = null;
            rawGrip = null;
          }
          setHandSeen(handMiss < 8 && !!grip);
        }
        const m = res.segmentationMasks?.[0];
        mask = m ? { data: m.getAsFloat32Array().slice(), w: m.width, h: m.height } : null;
        personVer++;
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
        if (v3) {
          // The room's colour, from four patches spread over the frame (the bag is lit by it, partly).
          let r = 0;
          let g = 0;
          let b = 0;
          for (const [qx, qy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
            const d = rctx.getImageData(Math.round(W * qx) - 4, Math.round(H * qy) - 4, 8, 8).data;
            for (let i = 0; i < d.length; i += 4) {
              r += d[i];
              g += d[i + 1];
              b += d[i + 2];
            }
          }
          const m = (r + g + b) / 3 || 1;
          const nt: [number, number, number] = [r, g, b].map((c) => Math.max(0.8, Math.min(1.2, c / m))) as [number, number, number];
          tint = [tint[0] + (nt[0] - tint[0]) * 0.3, tint[1] + (nt[1] - tint[1]) * 0.3, tint[2] + (nt[2] - tint[2]) * 0.3];
        }
      }
      const l3 = p && layer.current?.id === p.id ? layer.current : null;
      const img = p && matte.current?.id === p.id ? matte.current.img : null;
      const out = l3 ? tctx ?? ctx : ctx;
      if (tctx && top.current) tctx.clearRect(0, 0, top.current.width, top.current.height);
      // Held in a hand the hand model sees: size and place from the hand itself. The knuckle line
      // (index to little finger) is about 7.5 cm, which holds even when the shoulders are off screen.
      const fromHand = !!(l3 && grip && handPts && HELD.has(style) && p);
      // V2: a hand lost for a moment keeps the bag where it was for a short time instead of hiding it.
      // V3: a lost hand is held only as long as it was still, faded out rather than cut (HoldPolicy).
      if (v3 && !fromHand && lastFromHand && l3 && p && HELD.has(style)) {
        const sh = policy.show(now, null);
        if (sh) {
          const yawH = fyaw.filter(spin.current + handYaw, now);
          const roll = (placed.current?.rot ?? 0) + swing.step(now, sh.pose.cx, sh.pose.w / (l3.widthCm / 100));
          l3.l.render(W, H, { x: sh.pose.cx, y: sh.pose.top, widthPx: sh.pose.w, yaw: yawH, roll, brightness, tint, alpha: sh.alpha });
          if (telemetry) telemetry.push({ t: now, cx: sh.pose.cx, top: sh.pose.top, w: sh.pose.w, yaw: yawH, rawCx: -1, rawTop: -1, rawW: -1, hand: false, held: true, rejected, alpha: sh.alpha });
          return;
        }
      }
      const holdHand = v2 && !v3 && !fromHand && lastFromHand && now - lastHandAt < HAND_HOLD_MS && l3 && p && HELD.has(style);
      if (holdHand && lastFromHand) {
        const yawH = fyaw.filter(spin.current + handYaw, now);
        if (telemetry) telemetry.push({ t: now, cx: placed.current?.cx ?? 0, top: placed.current?.top ?? 0, w: placed.current?.w ?? 0, yaw: yawH, rawCx: -1, rawTop: -1, rawW: -1, hand: false, held: true, rejected });
        if (placed.current) l3!.l.render(W, H, { x: placed.current.cx, y: placed.current.top, widthPx: placed.current.w, yaw: yawH, roll: placed.current.rot, brightness });
        return;
      }
      if (!p || (!img && !l3) || (!lm && !fromHand)) {
        l3?.l.render(W, H, null);
        return;
      }
      const kind = (p.category.value ?? '').toLowerCase().includes('bag') ? 'bag' : 'acc';
      let next = lm ? placeFor(style, kind, lm, l3 ? l3.aspect : img!.width / img!.height, p.dimensions.widthCm ?? undefined, sz) : null;
      if (fromHand) {
        const hp = handPts!;
        // Size from the hand's 3D scale (turn-proof); the knuckle line (~7.5 cm) only until that is known.
        const pxPerCm = handScale || Math.hypot(hp[5].x - hp[17].x, hp[5].y - hp[17].y) / 7.5;
        const widthCm = l3!.widthCm;
        // The bag hangs below the whole hand: its handle loops up into the fist, the body starts under it.
        const fistBottom = Math.max(...hp.map((q) => q.y));
        const xs = [5, 9, 13, 17].map((i) => hp[i].x);
        const gx = xs.reduce((a, b) => a + b, 0) / xs.length;
        const handlePx = l3!.handleCm * pxPerCm * sz;
        // V3: the handle's apex goes where the fingers curl round it — about 3 cm above the bottom of the fist
        // whatever the handle's length. (V1/V2 put it 55 % of the handle length up: right for a 5 cm handle, but a
        // 13 cm tote handle ended up with its apex above the fist, the hand floating inside the loop.)
        const apexUp = v3 ? Math.min(handlePx * 0.55, (l3!.gripCm ?? 3) * pxPerCm * sz) : handlePx * 0.55;
        next = { cx: gx, top: fistBottom - apexUp, w: widthCm * pxPerCm * sz, rot: next?.rot ?? 0 };
      }
      if (!next) {
        l3?.l.render(W, H, null);
        return;
      }
      if (v2) {
        // Time-based One Euro smoothing (steady when still, close when fast), no snap on source changes.
        const prev = placed.current;
        placed.current = { cx: fx.filter(next.cx, now), top: fy.filter(next.top, now), w: fw.filter(next.w, now), rot: prev ? prev.rot + (next.rot - prev.rot) * 0.3 : next.rot };
        if (fromHand) {
          lastFromHand = next;
          lastHandAt = now;
        }
      } else placed.current = smooth(placed.current, next);
      const held = ['hand', 'elbow'].includes(style);
      // Held and the hand seen: the bag turns with the hand, all the way round. Otherwise it follows the body.
      const yawRaw = spin.current + (held && grip ? handYaw : bodyYaw);
      const yaw = v2 ? fyaw.filter(yawRaw, now) : yawRaw;
      if (telemetry) telemetry.push({ t: now, cx: placed.current.cx, top: placed.current.top, w: placed.current.w, yaw, rawCx: next.cx, rawTop: next.top, rawW: next.w, hand: fromHand, rejected });
      let shown = placed.current;
      if (l3 && v3) {
        let pose = placed.current;
        let alpha = 1;
        if (fromHand) {
          if (freshAt !== freshSeen) {
            freshSeen = freshAt;
            policy.fresh(now, placed.current, Math.hypot(handPts![5].x - handPts![17].x, handPts![5].y - handPts![17].y));
          }
          const sh = policy.show(now, placed.current);
          if (!sh) {
            l3.l.render(W, H, null);
            return;
          }
          pose = { ...placed.current, ...sh.pose };
          alpha = sh.alpha;
          if (telemetry) telemetry.push({ t: now, v3: true, alpha, age: now - freshAt });
        }
        let roll = pose.rot;
        if (held && fromHand) {
          swing.setLength(((l3.widthCm / l3.aspect) / 100) * 0.66);
          roll += swing.step(now, pose.cx, pose.w / (l3.widthCm / 100));
        } else swing.reset();
        shown = pose;
        l3.l.render(W, H, { x: pose.cx, y: pose.top, widthPx: pose.w, yaw, roll, brightness, tint, alpha });
      } else if (l3) l3.l.render(W, H, { x: placed.current.cx, y: placed.current.top, widthPx: placed.current.w, yaw, roll: placed.current.rot, brightness });
      else paint(ctx, img!, placed.current, { s: 1, ox: 0, oy: 0 });

      // The holding hand goes back on top of the handles: person pixels from the mask, around the wrist.
      const holding = HELD.has(kind === 'acc' ? `acc-${style}` : style);
      // The hand model sees the hand: draw the camera's own hand, opaque, over the bag — palm filled and every
      // finger as a thick stroke, edges softly feathered — so no finger is hidden or see-through.
      if (holding && handPts && l3) {
        if (handMask.width !== W || handMask.height !== H) {
          handMask.width = W;
          handMask.height = H;
        }
        const pts = handPts;
        const palmW = Math.hypot(pts[5].x - pts[17].x, pts[5].y - pts[17].y);
        hmctx.clearRect(0, 0, W, H);
        hmctx.filter = `blur(${Math.max(1, palmW * 0.025)}px)`;
        hmctx.fillStyle = hmctx.strokeStyle = '#fff';
        hmctx.lineCap = hmctx.lineJoin = 'round';
        // The whole hand (palm and fingers) over the handle; the bag body hangs below it and the forearm stays behind.
        const palmTop = [pts[0], pts[1], pts[2], pts[5], pts[9], pts[13], pts[17]];
        hmctx.beginPath();
        palmTop.forEach((q, n) => (n ? hmctx.lineTo(q.x, q.y) : hmctx.moveTo(q.x, q.y)));
        hmctx.closePath();
        hmctx.fill();
        hmctx.lineWidth = palmW * 0.22;
        hmctx.stroke();
        for (const finger of [
          [2, 3, 4],
          [5, 6, 7, 8],
          [9, 10, 11, 12],
          [13, 14, 15, 16],
          [17, 18, 19, 20],
        ]) {
          hmctx.lineWidth = palmW * (finger[0] === 2 ? 0.32 : 0.3);
          hmctx.beginPath();
          finger.forEach((i, n) => (n ? hmctx.lineTo(pts[i].x, pts[i].y) : hmctx.moveTo(pts[i].x, pts[i].y)));
          hmctx.stroke();
        }
        hmctx.filter = 'none';
        hmctx.globalCompositeOperation = 'source-in';
        hmctx.drawImage(raw, 0, 0);
        if (v3 && mask) {
          // Keep only what the person segmentation also calls person (generously: only clear background goes),
          // so the stroke-widened hand shape does not paint wall pixels over the handles.
          if (personDrawn !== personVer) {
            personCv.width = mask.w;
            personCv.height = mask.h;
            const id = personCtx.createImageData(mask.w, mask.h);
            for (let i = 0; i < mask.data.length; i++) id.data[i * 4 + 3] = Math.round(Math.max(0, Math.min(1, (mask.data[i] - 0.12) / 0.25)) * 255);
            personCtx.putImageData(id, 0, 0);
            personDrawn = personVer;
          }
          hmctx.globalCompositeOperation = 'destination-in';
          hmctx.save();
          if (mirrored) {
            hmctx.translate(W, 0);
            hmctx.scale(-1, 1);
          }
          hmctx.drawImage(personCv, 0, 0, W, H);
          hmctx.restore();
        }
        if (v3) {
          // Contact: the bag's shadow on the skin where the handle leaves the fist (only hand pixels take it),
          // and the fist's shadow on the top of the bag (only bag pixels take it). Light comes from upper right.
          const fist = Math.max(...pts.map((q) => q.y));
          const gx = shown.cx;
          hmctx.globalCompositeOperation = 'source-atop';
          const g1 = hmctx.createRadialGradient(gx - palmW * 0.05, fist, 0, gx - palmW * 0.05, fist, palmW * 0.55);
          g1.addColorStop(0, 'rgba(20,12,8,0.38)');
          g1.addColorStop(1, 'rgba(20,12,8,0)');
          hmctx.fillStyle = g1;
          hmctx.fillRect(gx - palmW, fist - palmW, palmW * 2, palmW * 2);
          hmctx.globalCompositeOperation = 'source-over';
          const r = Math.ceil(palmW * 1.2);
          const x0 = Math.max(0, Math.floor(gx - r));
          const y0 = Math.max(0, Math.floor(fist - r * 0.3));
          const sw = Math.min(W - x0, r * 2);
          const sh = Math.min(H - y0, r * 1.4);
          if (sw > 0 && sh > 0 && gl.current) {
            shade.width = sw;
            shade.height = sh;
            shadeCtx.globalCompositeOperation = 'source-over';
            shadeCtx.clearRect(0, 0, sw, sh);
            const g2 = shadeCtx.createRadialGradient(gx - x0 - palmW * 0.1, fist - y0, 0, gx - x0 - palmW * 0.1, fist - y0, palmW * 0.9);
            g2.addColorStop(0, 'rgba(0,0,0,0.42)');
            g2.addColorStop(1, 'rgba(0,0,0,0)');
            shadeCtx.fillStyle = g2;
            shadeCtx.fillRect(0, 0, sw, sh);
            shadeCtx.globalCompositeOperation = 'destination-in';
            shadeCtx.drawImage(gl.current, x0, y0, sw, sh, 0, 0, sw, sh);
            out.drawImage(shade, x0, y0);
          }
        }
        hmctx.globalCompositeOperation = 'source-over';
        out.drawImage(handMask, 0, 0);
      } else if (holding && mask && lm) {
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
      if (l3 && opts.current.aiOn) composeAi(W, H);
    };
    requestAnimationFrame(frame);
  }

  /** The full scene (camera + 3D bag + hand) as one canvas — what the AI receives. */
  const scene = useRef<HTMLCanvasElement | null>(null);
  function composeScene(W: number, H: number) {
    const sc = (scene.current ??= document.createElement('canvas'));
    if (sc.width !== W || sc.height !== H) {
      sc.width = W;
      sc.height = H;
    }
    const x = sc.getContext('2d')!;
    x.drawImage(canvas.current!, 0, 0, W, H);
    if (gl.current) x.drawImage(gl.current, 0, 0, W, H);
    if (top.current) x.drawImage(top.current, 0, 0, W, H);
    return sc;
  }
  /**
   * AI frame back, with the real design locked onto it. The AI video arrives a few hundred ms late, so
   * the overlay (3D bag + hand) of that same moment is looked up in a short history: the latency is
   * measured by matching the AI frame against recent scenes. Inside the bag our own colours are kept
   * and only the AI's light and shadow (its brightness relative to ours) is applied, so the print,
   * shape and colours are exactly the product's; outside the bag the AI frame is shown as it is.
   */
  const aiHist = useRef<{ t: number; overlay: HTMLCanvasElement; scene: Uint8ClampedArray }[]>([]);
  const aiLag = useRef(0);
  const aiTick = useRef(0);
  const aiLock = useRef<HTMLCanvasElement | null>(null);
  function composeAi(W: number, H: number) {
    const sc = composeScene(W, H);
    const v = aiVideo.current;
    const o = aiOut.current;
    const now = performance.now();
    // History: the overlay at half size (for compositing) and a tiny scene thumbnail (for matching).
    const hw = W >> 1;
    const hh = H >> 1;
    const hist = aiHist.current;
    const slot = hist.length >= 24 ? hist.shift()! : { t: 0, overlay: document.createElement('canvas'), scene: new Uint8ClampedArray(0) };
    slot.t = now;
    slot.overlay.width = hw;
    slot.overlay.height = hh;
    const ox = slot.overlay.getContext('2d', { willReadFrequently: true })!;
    ox.clearRect(0, 0, hw, hh);
    if (gl.current) ox.drawImage(gl.current, 0, 0, hw, hh);
    if (top.current) ox.drawImage(top.current, 0, 0, hw, hh);
    slot.scene = thumb(sc);
    hist.push(slot);
    if (!v || !o || v.readyState < 2 || !v.videoWidth) return;
    if (o.width !== W || o.height !== H) {
      o.width = W;
      o.height = H;
    }
    const x = o.getContext('2d', { willReadFrequently: true })!;
    x.drawImage(v, 0, 0, W, H);
    // Re-measure the delay about twice a second.
    if (++aiTick.current % 15 === 1 && hist.length > 2) {
      const ai = thumb(o);
      let best = 0;
      let bestErr = Infinity;
      for (const h of hist) {
        let e = 0;
        for (let i = 0; i < ai.length; i += 4) e += Math.abs(ai[i] - h.scene[i]) + Math.abs(ai[i + 1] - h.scene[i + 1]) + Math.abs(ai[i + 2] - h.scene[i + 2]);
        if (e < bestErr) {
          bestErr = e;
          best = now - h.t;
        }
      }
      aiLag.current = aiLag.current ? aiLag.current * 0.6 + best * 0.4 : best;
    }
    const want = now - aiLag.current;
    let match = hist[hist.length - 1];
    for (const h of hist) if (Math.abs(h.t - want) < Math.abs(match.t - want)) match = h;
    // Lock the design: our colours × the AI's relative brightness, only where the overlay is.
    const ov = (aiLock.current ??= document.createElement('canvas'));
    ov.width = W;
    ov.height = H;
    const ovx = ov.getContext('2d', { willReadFrequently: true })!;
    ovx.drawImage(match.overlay, 0, 0, W, H);
    const od = ovx.getImageData(0, 0, W, H).data;
    const frame = x.getImageData(0, 0, W, H);
    const fd = frame.data;
    for (let i = 0; i < fd.length; i += 4) {
      const a = od[i + 3] / 255;
      if (a < 0.02) continue;
      const lo = 0.299 * od[i] + 0.587 * od[i + 1] + 0.114 * od[i + 2];
      const la = 0.299 * fd[i] + 0.587 * fd[i + 1] + 0.114 * fd[i + 2];
      const shade = Math.max(0.65, Math.min(1.35, (la + 12) / (lo + 12)));
      fd[i] = fd[i] * (1 - a) + Math.min(255, od[i] * shade) * a;
      fd[i + 1] = fd[i + 1] * (1 - a) + Math.min(255, od[i + 1] * shade) * a;
      fd[i + 2] = fd[i + 2] * (1 - a) + Math.min(255, od[i + 2] * shade) * a;
    }
    x.putImageData(frame, 0, 0);
  }

  async function startAi() {
    if (aiOn || aiState.busy || !product) return;
    if (!window.confirm('20초 동안 화면 영상이 AI 서버(Decart)로 실시간 전송되어 실사처럼 보정됩니다. 라기는 영상을 저장하지 않습니다. 진행할까요?')) return;
    setAiState({ busy: true });
    try {
      let token: string | null = null;
      try {
        token = localStorage.getItem('lagi-session');
      } catch {
        // private mode
      }
      const res = await fetch(`${AI_TRYON_URL}/realtime/token`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: '{}' });
      const tk = (await res.json().catch(() => ({}))) as { apiKey?: string; seconds?: number; error?: string };
      if (!res.ok || !tk.apiKey) throw new Error(tk.error ?? 'AI 보정을 시작하지 못했습니다.');
      const sdk = await import('@decartai/sdk');
      const model = sdk.models.realtime('lucy-2.6');
      const v = video.current!;
      const sc = composeScene(v.videoWidth, v.videoHeight);
      const input = sc.captureStream(30);
      const client = sdk.createDecartClient({ apiKey: tk.apiKey });
      const conn = await client.realtime.connect(input, {
        model,
        onRemoteStream: (remote: MediaStream) => {
          const av = aiVideo.current;
          if (!av) return;
          av.srcObject = remote;
          void av.play().catch(() => undefined);
        },
      });
      await conn.setPrompt(
        'Photorealistic video. Keep everything exactly as it is: the person, the background, and the tote bag in their hand with its exact shape, position, colours and print. Only make the bag look real: natural fabric, soft contact shadows, light that matches the room, fingers wrapped around the handles.',
        { enhance: false },
      );
      const until = Date.now() + (tk.seconds ?? 20) * 1000;
      const timer = window.setInterval(() => {
        const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
        setAiState({ busy: false, left });
        if (left <= 0) stopAi();
      }, 250);
      const stopAi = () => {
        window.clearInterval(timer);
        conn.disconnect();
        input.getTracks().forEach((t) => t.stop());
        if (aiVideo.current) aiVideo.current.srcObject = null;
        aiHist.current = [];
        aiLag.current = 0;
        aiConn.current = null;
        setAiOn(false);
        setAiState({ busy: false });
      };
      conn.on('sessionEnded', stopAi);
      conn.on('error', (e: { message?: string }) => {
        stopAi();
        setAiState({ busy: false, error: e?.message ? `AI 연결이 끊겼습니다: ${e.message}` : 'AI 연결이 끊겼습니다.' });
      });
      aiConn.current = { stop: stopAi };
      setAiOn(true);
    } catch (e) {
      setAiState({ busy: false, error: (e as Error).message });
    }
  }
  useEffect(() => () => aiConn.current?.stop(), []);
  useEffect(() => {
    if (phase !== 'live') aiConn.current?.stop();
  }, [phase]);

  function save() {
    const c = canvas.current;
    if (!c || !product) return;
    const out = document.createElement('canvas');
    out.width = c.width;
    out.height = c.height;
    const ctx = out.getContext('2d')!;
    ctx.drawImage(aiOn && aiOut.current?.width ? aiOut.current : c, 0, 0, c.width, c.height);
    if (layer.current?.id === product.id && !aiOn) {
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
        <div
          className={`relative flex aspect-[4/3] touch-pan-y items-center justify-center overflow-hidden rounded-[var(--radius-card)] bg-[var(--c-ink)] md:aspect-video ${live && product?.model3d ? 'cursor-grab active:cursor-grabbing' : ''}`}
          data-testid="map-stage"
          onPointerDown={(e) => {
            if (!product?.model3d) return;
            dragX.current = e.clientX;
          }}
          onPointerMove={(e) => {
            if (dragX.current == null) return;
            spin.current += (e.clientX - dragX.current) * 0.012;
            dragX.current = e.clientX;
          }}
          onPointerUp={() => (dragX.current = null)}
          onPointerLeave={() => (dragX.current = null)}
        >
          <video ref={video} playsInline muted className="hidden" />
          <canvas ref={canvas} className={`h-full w-full object-contain ${live ? '' : 'hidden'}`} data-testid="map-canvas" />
          <canvas ref={gl} aria-hidden="true" className={`pointer-events-none absolute inset-0 h-full w-full object-contain ${live && product?.model3d ? '' : 'hidden'}`} data-testid="map-gl" />
          <canvas ref={top} aria-hidden="true" className={`pointer-events-none absolute inset-0 h-full w-full object-contain ${live && product?.model3d ? '' : 'hidden'}`} />
          <video ref={aiVideo} playsInline muted className="hidden" />
          <canvas ref={aiOut} aria-hidden="true" className={`pointer-events-none absolute inset-0 h-full w-full object-contain ${live && aiOn ? '' : 'hidden'}`} data-testid="map-ai" />
          {live && aiOn && (
            <span className="t-label t-mark absolute right-3 top-3 rounded-full bg-[var(--c-blue)] px-2.5 py-1 text-white tabular-nums">AI 실사 · {aiState.left ?? 20}</span>
          )}
          {!live && (
            <p className="t-body kr max-w-xs px-6 text-center text-white/80" data-testid="map-status">
              {status ?? (phase === 'ended' ? '착용을 끝냈습니다. 다시 시작할 수 있습니다.' : '시작을 누르면 카메라 화면에 실제 제품 이미지가 몸을 따라 입혀집니다.')}
            </p>
          )}
          {live && (
            <>
              <span className="t-label t-mark absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[var(--c-ink)]">Real product · AR</span>
              {((!found && !handSeen) || status) && (
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

        {product?.model3d && (
          <section aria-labelledby="m25">
            <h2 id="m25" className="t-h3 kr">
              <span className="t-mark text-[var(--c-mute)]">03</span> 손으로 돌려 보기
            </h2>
            <p className="t-caption kr mt-2 text-[var(--c-mute)]">
              ‘손에 들기’로 손바닥이 보이게 들고, 손을 천천히 돌려 보세요. 손바닥 → 옆 → 손등으로 돌리면 가방도 정면 → 옆면 → 뒷면으로 같이 돌아갑니다.
            </p>
            <p className={`t-caption kr mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 ${live && handSeen ? 'bg-[var(--c-blue)] text-white' : 'bg-[var(--c-gray)] text-[var(--c-mute)]'}`} data-testid="hand-status">
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${live && handSeen ? 'bg-white' : 'bg-[#b5b5b5]'}`} />
              {live ? (handSeen ? '손 인식 중 · 손을 돌려 보세요' : '손이 화면에 보이게 해 주세요') : '착용을 시작하면 손을 인식합니다'}
            </p>
          </section>
        )}

        {product?.model3d && (
          <section aria-labelledby="m26">
            <h2 id="m26" className="t-h3 kr">
              <span className="t-mark text-[var(--c-mute)]">04</span> AI 실사 보정 · 20초
            </h2>
            <p className="t-caption kr mt-2 text-[var(--c-mute)]">내 손을 따라가는 3D 가방을 AI가 실사 영상처럼 다시 그립니다. 가방 부분은 실제 제품 디자인으로 고정하고 AI의 조명·그림자만 입혀서, 무늬·글자·형태가 바뀌지 않아요.</p>
            <button type="button" className="btn btn-blue mt-3 w-full" disabled={!live || aiOn || aiState.busy} onClick={startAi} data-testid="ai-refine">
              {aiState.busy ? 'AI 연결 중…' : aiOn ? `AI 보정 중 · ${aiState.left ?? 20}초` : 'AI 실사 보정 켜기'}
            </button>
            {!live && <p className="t-caption kr mt-2 text-[var(--c-mute)]">먼저 실시간 착용을 시작하세요.</p>}
            {aiState.error && (
              <p className="t-caption kr mt-2 text-[var(--c-blue)]" role="alert">
                {aiState.error}
              </p>
            )}
          </section>
        )}

        <section aria-labelledby="m3">
          <h2 id="m3" className="t-h3 kr">
            <span className="t-mark text-[var(--c-mute)]">{product?.model3d ? '05' : '03'}</span> 크기 · 카메라
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
