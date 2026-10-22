import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useProduct } from '@/hooks/useProducts';
import { Loading } from '@/components/Loading';
import { ErrorState } from '@/components/ErrorState';
import { productDisplayName } from '@/utils/productImage';
import { AI_TRYON_URL, photoToDataUrl, requestAiTryOn } from '@/tryon/aiTryOn';
import type { Product } from '@/data/productTypes';
import { canUseTryOn } from '@/utils/tryOnAvailability';

const BAG_STYLES = [
  { key: 'shoulder', label: '어깨에 메기', prompt: 'with the handles resting on one shoulder' },
  { key: 'hand', label: '손에 들기', prompt: 'held by the handles in one hand, arm relaxed at the side' },
  { key: 'cross', label: '크로스로 메기', prompt: 'worn cross-body with the strap across the chest' },
] as const;
const TOP_STYLES = [
  { key: 'wear', label: '입어보기', prompt: 'worn as the person’s top, replacing only the top they are wearing now' },
  { key: 'tuck', label: '넣어 입기', prompt: 'worn as the person’s top tucked into their trousers, replacing only the top they are wearing now' },
] as const;
const BOTTOM_STYLES = [
  { key: 'wear', label: '입어보기', prompt: 'worn as the person’s trousers, replacing only the trousers, shorts or skirt they are wearing now' },
] as const;
const ACC_STYLES = [
  { key: 'hand', label: '손에 들기', prompt: 'held naturally in one hand in front of the body' },
  { key: 'clip', label: '가방에 걸기', prompt: 'clipped or hanging from the bag or belt loop the person is carrying' },
] as const;

/** AI photo fitting: the visitor's photo + the product photo → a composed photo, made by Gemini via our Worker. */
export default function AiFitPage() {
  const { id } = useParams<{ id: string }>();
  const state = useProduct(id);
  if (state.status === 'loading') return <Loading label="불러오는 중" />;
  if (state.status === 'error') return <ErrorState message={state.message} />;
  return <AiFit product={state.data} />;
}

function AiFit({ product }: { product: Product }) {
  const category = (product.category.value ?? '').toLowerCase();
  const styles = category.includes('bag') ? BAG_STYLES : category === 'top' ? TOP_STYLES : category === 'bottom' ? BOTTOM_STYLES : ACC_STYLES;
  const [style, setStyle] = useState<string>(styles[0].key);
  const [photo, setPhoto] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBefore, setShowBefore] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const name = productDisplayName(product);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setResult(null);
    try {
      setPhoto(await photoToDataUrl(file));
    } catch {
      setError('사진을 읽지 못했습니다. 다른 사진으로 시도해 주세요.');
    }
  }

  async function run() {
    if (!photo) return;
    setBusy(true);
    setError(null);
    try {
      const prompt = styles.find((s) => s.key === style)?.prompt;
      setResult(await requestAiTryOn({ person: photo, product, style: prompt }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!result) return;
    const blob = await (await fetch(result)).blob();
    const file = new File([blob], `lagi-ai-fit-${product.id}.png`, { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: `${name} — LAGI AI 피팅` }).catch(() => undefined);
    } else {
      const a = document.createElement('a');
      a.href = result;
      a.download = file.name;
      a.click();
    }
  }

  const shown = result && !showBefore ? result : photo;

  return (
    <div className="px-4 pb-20 pt-6 lg:px-10 lg:pt-10">
      <nav aria-label="경로" className="text-xs text-stone">
        <Link to={`/product/${product.id}`} className="hover:text-ink">← {name}</Link>
      </nav>
      <h1 className="mt-3 text-2xl font-bold tracking-[-0.03em] lg:text-[28px]">AI 피팅</h1>
      <p className="mt-1 text-sm text-stone">내 사진을 올리면 AI가 {name}을(를) 착용한 사진을 만들어 드려요.</p>

      {!AI_TRYON_URL && (
        <p className="mt-6 rounded-md bg-mist px-4 py-3 text-sm text-graphite">
          AI 피팅 서버가 아직 연결되지 않았습니다. (관리자: <code>server/tryon-worker/README.md</code> 참고)
        </p>
      )}

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Photo / result */}
        <div className="lg:col-span-7">
          <div className="relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-xl bg-mist">
            {shown ? (
              <img src={shown} alt={result && !showBefore ? 'AI 피팅 결과' : '내 사진'} className="h-full w-full object-contain" />
            ) : (
              <div className="px-8 text-center text-sm text-stone">
                <p className="text-base font-semibold text-graphite">전신 또는 상반신 사진을 올려주세요</p>
                <p className="mt-2">정면에 가깝고, 몸과 손이 잘 보이는 밝은 사진일수록 자연스럽게 나와요.</p>
              </div>
            )}
            {busy && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/60 text-paper">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-paper/30 border-t-paper" aria-hidden="true" />
                <p className="text-sm font-semibold">AI가 사진을 만드는 중… (10~40초)</p>
              </div>
            )}
            {result && (
              <button
                type="button"
                onPointerDown={() => setShowBefore(true)}
                onPointerUp={() => setShowBefore(false)}
                onPointerLeave={() => setShowBefore(false)}
                className="absolute bottom-3 left-3 rounded-full bg-ink/70 px-4 py-2 text-xs font-semibold text-paper backdrop-blur focus-ring"
              >
                누르고 원본 보기
              </button>
            )}
          </div>
          <input ref={cameraRef} type="file" accept="image/*" capture="user" className="hidden" onChange={pick} />
          <input ref={albumRef} type="file" accept="image/*" className="hidden" onChange={pick} />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => cameraRef.current?.click()} className="h-12 rounded-md border border-ink text-sm font-bold hover:bg-mist focus-ring">
              사진 찍기
            </button>
            <button type="button" onClick={() => albumRef.current?.click()} className="h-12 rounded-md border border-ink text-sm font-bold hover:bg-mist focus-ring">
              앨범에서 선택
            </button>
          </div>
        </div>

        {/* Product + controls */}
        <div className="lg:col-span-5">
          <div className="flex gap-4 rounded-xl border border-line p-4">
            {product.images[0] && <img src={product.images[0]} alt="" className="h-24 w-24 shrink-0 rounded-md object-cover" />}
            <div className="min-w-0">
              <p className="text-[11px] font-bold">{product.brandLabel ?? 'LAGI'}</p>
              <p className="font-semibold">{name}</p>
              {product.price.value != null && <p className="mt-1 text-sm font-bold">{product.price.value.toLocaleString('ko-KR')}원</p>}
            </div>
          </div>

          <p className="mb-2 mt-6 text-[13px] text-stone">착용 방식</p>
          <div className="flex flex-wrap gap-2">
            {styles.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setStyle(s.key)}
                aria-pressed={style === s.key}
                className={`rounded-full border px-4 py-2 text-sm focus-ring ${style === s.key ? 'border-ink bg-ink font-semibold text-paper' : 'border-line hover:border-ink'}`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={run}
            disabled={!photo || busy || !AI_TRYON_URL}
            className="mt-6 h-14 w-full rounded-md bg-blue text-base font-bold text-paper hover:bg-[#244789] focus-ring disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? '만드는 중…' : result ? '다시 만들기' : 'AI 피팅 시작'}
          </button>
          {error && <p className="mt-3 text-sm text-orange">{error}</p>}
          {result && (
            <button type="button" onClick={save} className="mt-2 h-12 w-full rounded-md border border-ink text-sm font-bold hover:bg-mist focus-ring">
              사진 저장 · 공유
            </button>
          )}

          <ul className="mt-6 space-y-1.5 text-xs leading-relaxed text-stone">
            <li>· 사진은 AI 합성을 위해 서버를 거쳐 Google Gemini로 전송되며, 라기 서버에는 저장하지 않습니다.</li>
            <li>· AI가 만든 참고용 이미지라 실제 크기·색감과 다를 수 있어요.</li>
            {canUseTryOn(product) && (
              <li>· 거울처럼 움직이며 보고 싶다면 <Link to={`/try-on/${product.id}`} className="underline">카메라 피팅</Link>을 이용해 보세요.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
