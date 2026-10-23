import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import type { Product } from '@/data/productTypes';
import { CARRY_PROMPTS, photoToDataUrl, requestAiTryOn } from '@/tryon/aiTryOn';
import { CATEGORY_LABEL, price, useRealProducts } from '../data';

/** Ways of wearing a product the AI is asked for — the same set the Worker prompt supports. */
const STYLES = {
  bag: [
    { key: 'shoulder', label: '어깨에 메기', prompt: CARRY_PROMPTS.SHOULDER },
    { key: 'hand', label: '손에 들기', prompt: CARRY_PROMPTS.HAND },
    { key: 'cross', label: '크로스로 메기', prompt: CARRY_PROMPTS.CROSSBODY },
    { key: 'elbow', label: '팔에 걸기', prompt: 'hung over the forearm in the crook of a bent elbow' },
    { key: 'hug', label: '가슴에 안기', prompt: 'held against the chest with both arms, as if hugging it' },
    { key: 'back', label: '어깨 뒤로 넘기기', prompt: 'slung over one shoulder so the bag rests on the back' },
    { key: 'front', label: '앞으로 들어 보이기', prompt: 'held up with both hands in front of the body, showing the bag to the camera' },
  ],
  acc: [
    { key: 'hand', label: '손에 들기', prompt: 'held naturally in one hand in front of the body' },
    { key: 'show', label: '들어 보이기', prompt: 'held up near the face with one hand, showing it to the camera' },
    { key: 'clip', label: '가방에 걸기', prompt: 'clipped or hanging from the bag or belt loop the person is carrying' },
    { key: 'pocket', label: '주머니에 꽂기', prompt: 'tucked half-way into a front pocket of the outfit, clearly visible' },
    { key: 'table', label: '테이블에 두기', prompt: 'placed on a small table right in front of the person, who looks at it' },
  ],
};
const stylesFor = (p: Product | undefined) => ((p?.category.value ?? '').toLowerCase().includes('bag') ? STYLES.bag : STYLES.acc);

const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const TIMEOUT_MS = 120_000;
/** Server-side hiccups (no image this time, busy, 5xx) are retried once quietly before the visitor sees anything. */
const RETRIES = 1;

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * AGAIN EXPERIENCE — AI image compositing. The visitor picks a product, adds a photo (upload or
 * camera), chooses how to wear it, and the Worker (server/tryon-worker, Gemini) returns a composed
 * image. The API key lives only in the Worker; the photo is sent once and not stored by LAGI.
 */
export default function Again() {
  const { products, loading } = useRealProducts();
  const [params, setParams] = useSearchParams();
  const productId = params.get('p');
  const product = products.find((p) => p.id === productId);
  const styles = stylesFor(product);
  const [style, setStyle] = useState<string>(styles[0].key);
  const [photo, setPhoto] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [before, setBefore] = useState(false);
  const [camera, setCamera] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!styles.some((s) => s.key === style)) setStyle(styles[0].key);
  }, [styles, style]);
  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (!busy) return;
    const t0 = Date.now();
    const t = window.setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 500);
    return () => window.clearInterval(t);
  }, [busy]);

  const step = !product ? 1 : !photo ? 2 : !result ? (busy ? 4 : 3) : 5;

  function choose(p: Product) {
    setParams({ p: p.id }, { replace: true });
    setResult(null);
    setError(null);
  }

  async function takePhoto(f: File | Blob | undefined) {
    if (!f) return;
    setError(null);
    if (f.type && !f.type.startsWith('image/')) return setError('사진 파일을 골라 주세요.');
    if (f.size > MAX_INPUT_BYTES) return setError('15MB 이하의 사진을 사용해 주세요.');
    try {
      // Any format the browser can open (JPG, PNG, WEBP, HEIC on iPhone Safari …) is redrawn as JPEG.
      setPhoto(await photoToDataUrl(f as File));
      setResult(null);
    } catch {
      setError('이 사진 형식은 열 수 없습니다. JPG로 저장한 사진을 쓰거나 카메라로 촬영해 주세요.');
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    void takePhoto(f);
  }

  async function run() {
    if (!photo || !product || busy || !consent) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const timer = window.setTimeout(() => ctrl.abort('timeout'), TIMEOUT_MS);
    setBusy(true);
    setElapsed(0);
    setError(null);
    try {
      const ask = () => requestAiTryOn({ person: photo, product, style: styles.find((s) => s.key === style)?.prompt, signal: ctrl.signal });
      let img: string | null = null;
      for (let attempt = 0; ; attempt++) {
        try {
          img = await ask();
          break;
        } catch (e) {
          const status = (e as { status?: number }).status;
          const retryable = !ctrl.signal.aborted && (e instanceof TypeError || status == null || status >= 500 || status === 429);
          if (!retryable || attempt >= RETRIES) throw e;
          setRetrying(true);
          await new Promise((r) => setTimeout(r, status === 429 ? 4000 : 1500));
        }
      }
      setResult(img);
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (e) {
      if (ctrl.signal.aborted) setError(ctrl.signal.reason === 'timeout' ? '시간이 너무 오래 걸려 중단했습니다. 다시 시도해 주세요.' : '합성을 취소했습니다.');
      else if (e instanceof TypeError) setError('AI 서버에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.');
      else setError((e as Error).message || 'AI 이미지 합성에 실패했습니다.');
    } finally {
      window.clearTimeout(timer);
      abortRef.current = null;
      setBusy(false);
      setRetrying(false);
    }
  }

  async function save() {
    if (!result || !product) return;
    const blob = await labelled(result);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lagi-again-${product.id}.png`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  async function share() {
    if (!result || !product) return;
    const file = new File([await labelled(result)], `lagi-again-${product.id}.png`, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'LAGI AGAIN', text: `${product.name.value} · AI 합성 이미지` }).catch(() => undefined);
    } else save();
  }

  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

  return (
    <div className="px-page pb-32 pt-page">
      <header className="grid grid-cols-1 gap-x-[var(--gap)] gap-y-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <p className="t-label t-mark text-[var(--c-mute)]">Again experience</p>
          <h1 className="t-display t-mark mt-3">AGAIN</h1>
        </div>
        <div className="lg:col-span-5 lg:self-end">
          <p className="t-en">See it again, on you.</p>
          <p className="t-kr-sub mt-3">내 사진 위에 라기 제품을 올려, 일상 속에서 다시 보는 모습을 미리 봅니다.</p>
          <p className="t-caption kr mt-1 text-[var(--c-mute)]">결과는 AI가 만든 이미지이며 실제 제품 사진이 아닙니다.</p>
        </div>
      </header>

      <ol className="t-caption kr rule mt-12 grid grid-cols-3 gap-2 pt-3 md:grid-cols-6" aria-label="진행 단계">
        {['제품 선택', '사진', '착용 방식', '합성', '결과 확인', '저장 · 다시'].map((t, i) => (
          <li key={t} aria-current={step === i + 1 ? 'step' : undefined} className={step === i + 1 ? 'font-bold' : step > i + 1 ? '' : 'text-[var(--c-mute)]'}>
            <span className="t-mark tabular-nums">{pad(i + 1)}</span> {t}
          </li>
        ))}
      </ol>

      {/* 01 Product */}
      <section className="mt-14" aria-labelledby="s1">
        <h2 id="s1" className="t-h3 kr">
          <span className="t-mark text-[var(--c-mute)]">01</span> 제품을 고르세요
        </h2>
        {loading ? (
          <p className="t-caption kr mt-4">불러오는 중…</p>
        ) : (
          <ul className="no-scrollbar mt-5 flex snap-x gap-3 overflow-x-auto pb-2">
            {products.map((p) => (
              <li key={p.id} className="w-[38vw] shrink-0 snap-start sm:w-44">
                <button
                  type="button"
                  aria-pressed={p.id === productId}
                  onClick={() => choose(p)}
                  className={`block w-full text-left outline-offset-2 ${p.id === productId ? 'outline outline-2 outline-[var(--c-ink)]' : ''}`}
                >
                  <span className="block aspect-square overflow-hidden bg-[var(--c-gray)]">
                    <img src={p.images[0]} alt="" className="h-full w-full object-cover" />
                  </span>
                  <span className="t-caption kr mt-2 block px-1 pb-1 font-bold">{p.name.value}</span>
                  <span className="t-caption kr block px-1 pb-1 text-[var(--c-mute)]">
                    {CATEGORY_LABEL[p.category.value ?? ''] ?? ''} · {price(p.price.value)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-14 grid grid-cols-1 gap-x-[var(--gap)] gap-y-12 lg:grid-cols-12">
        {/* Preview */}
        <div className="lg:col-span-7" ref={resultRef}>
          <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-[var(--radius-card)] bg-[var(--c-gray)]">
            {result && !before ? (
              <img src={result} alt="AI가 합성한 이미지" className="h-full w-full object-contain" data-testid="ai-result" />
            ) : photo ? (
              <img src={photo} alt="올린 사진" className="h-full w-full object-contain" />
            ) : (
              <p className="t-body kr px-8 text-center text-[var(--c-mute)]">정면에서 찍은 전신 또는 상반신 사진이 가장 잘 나옵니다.</p>
            )}
            {result && (
              <span className="t-label t-mark absolute left-3 top-3 bg-[var(--c-ink)] px-2 py-1 text-[var(--c-white)]">
                {before ? 'Original photo' : 'AI generated'}
              </span>
            )}
            {busy && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--c-ink)]/75 text-[var(--c-white)]" role="status">
                <p className="t-value kr">이미지를 합성하고 있습니다… {elapsed}초</p>
                <p className="t-caption kr text-white/70">{retrying ? '한 번 더 시도하고 있습니다.' : '보통 10~40초 걸립니다.'}</p>
                <button type="button" className="t-caption kr tag bg-[var(--c-white)] text-[var(--c-ink)]" onClick={() => abortRef.current?.abort('cancel')}>
                  취소
                </button>
              </div>
            )}
          </div>
          {result && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                className="t-caption kr tag bg-[var(--c-label)]"
                onPointerDown={() => setBefore(true)}
                onPointerUp={() => setBefore(false)}
                onPointerLeave={() => setBefore(false)}
                onKeyDown={(e) => e.key === ' ' && setBefore(true)}
                onKeyUp={() => setBefore(false)}
              >
                누르고 있으면 원본 사진
              </button>
              {product && (
                <span className="t-caption kr flex items-center gap-2 text-[var(--c-mute)]">
                  실제 제품 사진
                  <img src={product.images[0]} alt={`${product.name.value} 실제 사진`} className="h-12 w-12 rounded-[var(--radius-card)] object-cover" />
                </span>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="space-y-10 lg:col-span-5">
          <section aria-labelledby="s2">
            <h2 id="s2" className="t-h3 kr">
              <span className="t-mark text-[var(--c-mute)]">02</span> 사진
            </h2>
            <input ref={albumRef} type="file" accept="image/*" className="hidden" onChange={onPick} data-testid="photo-input" />
            <input ref={captureRef} type="file" accept="image/*" capture="user" className="hidden" onChange={onPick} />
            <div className="t-nav kr mt-4 flex flex-wrap gap-2">
              <button type="button" className="tag bg-[var(--c-label)] px-4 py-3" onClick={() => albumRef.current?.click()}>
                사진 올리기
              </button>
              <button
                type="button"
                className="tag bg-[var(--c-label)] px-4 py-3"
                onClick={() => {
                  setError(null);
                  // The camera opens inside the page on phones and computers alike; only browsers
                  // without camera access (some in-app browsers) fall back to the system picker.
                  if (typeof navigator.mediaDevices?.getUserMedia === 'function') setCamera(true);
                  else captureRef.current?.click();
                }}
              >
                카메라로 촬영
              </button>
            </div>
            <p className="t-caption kr mt-2 text-[var(--c-mute)]">15MB 이하 사진 · 정면 전신 또는 상반신 사진이 가장 잘 나옵니다</p>
          </section>

          <section aria-labelledby="s3">
            <h2 id="s3" className="t-h3 kr">
              <span className="t-mark text-[var(--c-mute)]">03</span> 착용 방식
            </h2>
            <div className="t-nav kr mt-4 flex flex-wrap gap-2">
              {styles.map((s) => (
                <button key={s.key} type="button" aria-pressed={style === s.key} onClick={() => setStyle(s.key)} className={`tag px-4 py-3 ${style === s.key ? 'tag-ink' : 'bg-[var(--c-label)]'}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </section>

          <section aria-labelledby="s4">
            <h2 id="s4" className="t-h3 kr">
              <span className="t-mark text-[var(--c-mute)]">04</span> 합성
            </h2>
            <label className="t-caption kr mt-4 flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>
                합성을 위해 내 사진이 AI 서버(Cloudflare를 거쳐 Google Gemini)로 한 번 전송되는 것에 동의합니다. 라기는 사진과 결과를 저장하지 않습니다.
              </span>
            </label>
            <button
              type="button"
              onClick={run}
              disabled={!photo || !product || busy || !consent}
              className="t-nav tag tag-ink kr mt-5 px-5 py-3.5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? '합성 중…' : result ? '같은 사진으로 다시 합성' : 'AI 이미지 합성'}
            </button>
            {!product && <p className="t-caption kr mt-2 text-[var(--c-mute)]">먼저 제품을 고르세요.</p>}
            {product && !photo && <p className="t-caption kr mt-2 text-[var(--c-mute)]">사진을 올리거나 촬영하세요.</p>}
            {error && (
              <p className="t-caption kr mt-3 text-[var(--c-blue)]" role="alert">
                {error}
              </p>
            )}
          </section>

          {result && (
            <section aria-labelledby="s5">
              <h2 id="s5" className="t-h3 kr">
                <span className="t-mark text-[var(--c-mute)]">05</span> 저장 또는 다시
              </h2>
              <div className="t-nav kr mt-4 flex flex-wrap gap-2">
                <button type="button" className="tag tag-ink px-4 py-3" onClick={save}>
                  이미지 저장
                </button>
                {canShare && (
                  <button type="button" className="tag bg-[var(--c-label)] px-4 py-3" onClick={share}>
                    공유
                  </button>
                )}
                <button
                  type="button"
                  className="tag bg-[var(--c-label)] px-4 py-3"
                  onClick={() => {
                    setResult(null);
                    setPhoto(null);
                  }}
                >
                  다른 사진으로
                </button>
              </div>
              <p className="t-caption kr mt-3 text-[var(--c-mute)]">저장하는 이미지 모서리에 ‘AI GENERATED’ 표시가 들어갑니다.</p>
              {product && (
                <Link to={`/product/${product.id}`} className="t-caption kr mt-4 inline-block underline underline-offset-2">
                  {product.name.value} 보러 가기
                </Link>
              )}
            </section>
          )}
        </div>
      </div>

      {camera && (
        <CameraCapture
          onClose={() => setCamera(false)}
          onShot={(blob) => {
            setCamera(false);
            void takePhoto(blob);
          }}
          onPick={() => {
            setCamera(false);
            albumRef.current?.click();
          }}
        />
      )}
    </div>
  );
}

/** Stamps a small "AI GENERATED · LAGI" label into the saved image, so it is never mistaken for a product photo. */
async function labelled(dataUrl: string): Promise<Blob> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const fs = Math.max(14, Math.round(c.width / 48));
  ctx.font = `700 ${fs}px sans-serif`;
  const text = 'AI GENERATED · LAGI';
  const w = ctx.measureText(text).width + fs;
  ctx.fillStyle = '#0f0f0f';
  ctx.fillRect(fs * 0.6, c.height - fs * 2.4, w, fs * 1.8);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, fs * 1.1, c.height - fs * 1.1);
  return new Promise((res) => c.toBlob((b) => res(b!), 'image/png'));
}

/**
 * In-page camera (phones and computers): a live preview to take one still photo, front or back
 * camera. Nothing is recorded or sent until the visitor starts compositing.
 */
function CameraCapture({ onShot, onClose, onPick }: { onShot: (b: Blob) => void; onClose: () => void; onPick: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [problem, setProblem] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let alive = true;
    setReady(false);
    setProblem(null);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false })
      .then((s) => {
        if (!alive) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        const v = video.current;
        if (v) {
          v.srcObject = s;
          v.play().then(() => alive && setReady(true), () => undefined);
        }
      })
      .catch((e: DOMException) => {
        if (!alive) return;
        setProblem(
          e?.name === 'NotAllowedError'
            ? '카메라 권한이 꺼져 있습니다. 브라우저 주소창의 카메라 설정에서 허용한 뒤 다시 시도해 주세요.'
            : e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError'
              ? '사용할 수 있는 카메라를 찾지 못했습니다.'
              : '카메라를 열지 못했습니다. 다른 앱이 카메라를 쓰고 있다면 닫고 다시 시도해 주세요.',
        );
      });
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', esc);
    return () => {
      alive = false;
      stream?.getTracks().forEach((t) => t.stop());
      window.removeEventListener('keydown', esc);
    };
  }, [facing, attempt]);

  const mirrored = facing === 'user';
  function shoot() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext('2d')!;
    // The front camera preview is mirrored like a mirror; the photo keeps what the visitor saw.
    if (mirrored) {
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0);
    c.toBlob((b) => b && onShot(b), 'image/jpeg', 0.92);
  }

  // Rendered at the page root so it sits above the site header.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="카메라로 촬영"
      className="v3 fixed inset-0 z-[300] flex flex-col items-center gap-4 bg-[var(--c-ink)] px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))]"
      data-testid="camera"
    >
      <p className="t-caption kr self-start text-white/70">정면 전신 또는 상반신이 화면에 들어오게 찍어 주세요.</p>
      <div className="flex min-h-0 w-full flex-1 items-center justify-center">
      {problem ? (
        <div className="max-w-sm text-center text-[var(--c-white)]">
          <p className="t-body kr" role="alert">
            {problem}
          </p>
          <div className="t-nav kr mt-6 flex flex-wrap justify-center gap-2">
            <button type="button" className="tag bg-[var(--c-white)] px-4 py-3 text-[var(--c-ink)]" onClick={() => setAttempt((n) => n + 1)}>
              다시 시도
            </button>
            <button type="button" className="tag border border-white px-4 py-3" onClick={onPick}>
              앨범에서 고르기
            </button>
          </div>
        </div>
      ) : (
        <video ref={video} playsInline muted autoPlay className={`max-h-full max-w-full rounded-[var(--radius-card)] bg-black ${mirrored ? '-scale-x-100' : ''}`} />
      )}
      </div>
      <div className="t-nav kr flex flex-wrap justify-center gap-2">
        {!problem && (
          <>
            <button type="button" className="tag border border-white bg-[var(--c-white)] px-6 py-3 text-[var(--c-ink)] disabled:opacity-40" disabled={!ready} onClick={shoot}>
              촬영
            </button>
            <button type="button" className="tag border border-white px-4 py-3 text-[var(--c-white)]" onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}>
              카메라 전환
            </button>
          </>
        )}
        <button type="button" className="tag border border-white px-4 py-3 text-[var(--c-white)]" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>,
    document.body,
  );
}
