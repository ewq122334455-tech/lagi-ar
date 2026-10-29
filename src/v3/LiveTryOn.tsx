import { useEffect, useRef, useState } from 'react';
import type { Product } from '@/data/productTypes';
import { AI_TRYON_URL } from '@/tryon/aiTryOn';

type Phase = 'idle' | 'starting' | 'live' | 'ended';

/** What the realtime model is asked to do with the product (English works best, 20–30 words). */
function promptFor(product: Product, stylePrompt: string) {
  const kind = (product.category.value ?? '').toLowerCase().includes('bag') ? 'bag' : 'item';
  return `Add the ${kind} from the reference image to the person, ${stylePrompt}. Keep its exact shape, colours, prints and proportions, realistic size and natural shadows.`;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${AI_TRYON_URL}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `요청에 실패했습니다 (${res.status}).`);
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
  const [remaining, setRemaining] = useState<number | null>(null);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const out = useRef<HTMLVideoElement>(null);
  const local = useRef<HTMLVideoElement>(null);
  const session = useRef<{ stop: () => void; setPrompt: (p: string) => Promise<void> } | null>(null);
  const garment = useRef<{ id: string; blob: Blob } | null>(null);

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
    if (phase === 'live' && product) void session.current?.setPrompt(promptFor(product, stylePrompt)).catch(() => undefined);
  }, [stylePrompt, product, phase]);

  async function garmentBlob(p: Product) {
    if (garment.current?.id === p.id) return garment.current.blob;
    const base = `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}`;
    const { image } = await post<{ image: string }>('/cutout', { productImage: new URL(p.images[0], base).toString() });
    const blob = await (await fetch(image)).blob();
    garment.current = { id: p.id, blob };
    return blob;
  }

  async function start() {
    if (!product || phase === 'starting' || phase === 'live' || !consent) return;
    setError(null);
    setPhase('starting');
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    let wentLive = false;
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
      // Only a session that actually ran "ended"; a failed start goes back to the start state.
      setPhase(wentLive ? 'ended' : 'idle');
    };
    try {
      const [blob, token, sdk] = await Promise.all([
        garmentBlob(product),
        post<{ apiKey: string; seconds: number; remainingToday: number }>('/realtime/token', {}),
        import('@decartai/sdk'),
      ]);
      setRemaining(token.remainingToday);
      const model = sdk.models.realtime('lucy-vton-latest');
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: facing, frameRate: model.fps, width: model.width, height: model.height },
      });
      if (local.current) local.current.srcObject = stream;
      const client = sdk.createDecartClient({ apiKey: token.apiKey });
      const conn = await client.realtime.connect(stream, {
        model,
        onRemoteStream: (remote: MediaStream) => {
          if (out.current) out.current.srcObject = remote;
        },
        initialState: { image: blob, prompt: { text: promptFor(product, stylePrompt), enhance: false } },
      });
      rt = conn;
      conn.on('sessionEnded', () => stop());
      conn.on('error', (e: { message?: string }) => {
        setError(e?.message ? `연결이 끊겼습니다: ${e.message}` : '연결이 끊겼습니다.');
        stop();
      });
      session.current = { stop, setPrompt: (p: string) => conn.setPrompt(p, { enhance: false }) };
      // The page counts down too, so the visitor sees the limit; Decart enforces it either way.
      const until = Date.now() + token.seconds * 1000;
      setLeft(token.seconds);
      wentLive = true;
      setPhase('live');
      timer = window.setInterval(() => {
        const s = Math.max(0, Math.ceil((until - Date.now()) / 1000));
        setLeft(s);
        if (s <= 0) stop();
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

  function saveFrame() {
    const v = out.current;
    if (!v || !v.videoWidth || !product) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(v, 0, 0);
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
          <video ref={out} autoPlay playsInline muted className={`h-full w-full object-contain ${live ? '' : 'hidden'}`} />
          {!live && (
            <p className="t-body kr max-w-xs px-6 text-center text-white/80" data-testid="live-status">
              {phase === 'starting' ? '카메라와 AI를 연결하고 있습니다…' : phase === 'ended' ? '체험이 끝났습니다. 다시 시작할 수 있습니다.' : '시작을 누르면 카메라 화면 위에 제품이 실시간으로 입혀집니다.'}
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
            <button type="button" className="tag btn-solid px-4 py-3" onClick={saveFrame}>
              이 장면 저장
            </button>
            <button type="button" className="tag bg-[var(--c-label)] px-4 py-3" onClick={() => session.current?.stop()}>
              끝내기
            </button>
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
            한 번에 20초, 하루 3번까지 체험할 수 있습니다{remaining != null ? ` (오늘 남은 횟수 ${remaining}번)` : ''}. 화면은 AI가 만든 영상이며, 실제 크기와 색은 다를 수 있습니다.
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
