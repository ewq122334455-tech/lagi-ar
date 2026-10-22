import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useProducts } from '@/hooks/useProducts';
import { AGAIN_WORDS } from '@/components/AgainMarquee';
import { RemixViewer } from '@/again/RemixViewer';
import type { RemixViewerHandle } from '@/again/RemixViewer';
import { AgainCard } from '@/again/AgainCard';
import { REMIX_PALETTE, REMIX_PARTS, decodeColors, encodeColors, shuffleColors, swatchName } from '@/again/remix';
import type { RemixColors } from '@/again/remix';

export default function Again() {
  const state = useProducts();
  const products = state.status === 'ready' ? state.data : [];
  // The remix needs a GLB whose parts are separately named: a product's remixModel, or its main model.
  const product = products.find((p) => p.remixModel) ?? products.find((p) => p.model3D && p.tryOn?.garmentType === 'BAG') ?? null;

  return (
    <div>
      <AgainHero />
      {product ? (
        <RemixSection productId={product.id} modelUrl={product.remixModel || product.model3D} name={product.name.value} />
      ) : (
        <section className="border-t border-line px-6 py-20 text-center text-sm text-stone lg:px-10">
          {state.status === 'loading' ? '불러오는 중…' : '조합할 수 있는 3D 제품이 아직 없습니다.'}
        </section>
      )}
    </div>
  );
}

function AgainHero() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % AGAIN_WORDS.length), 1600);
    return () => window.clearInterval(id);
  }, []);
  const current = AGAIN_WORDS[index];

  return (
    <section className="relative overflow-hidden bg-ink px-6 pb-20 pt-16 text-paper lg:px-10 lg:pb-28 lg:pt-24">
      <div className="mx-auto max-w-canvas">
        <p className="text-xs font-semibold tracking-[0.2em] text-paper/50">lagi · /ˈla.gi/ · adv.</p>
        <div className="mt-8 flex min-h-[1.1em] items-baseline gap-6 text-[22vw] font-medium leading-none tracking-[-0.04em] lg:text-[13vw]" aria-live="polite">
          <span key={current.word} className={`animate-[lagi-word_1.6s_ease-in-out] ${/^[ -~]+$/.test(current.word) ? 'italic' : 'font-bold'}`}>
            {current.word}
          </span>
          <span className="hidden text-base font-normal not-italic tracking-normal text-paper/40 sm:inline lg:text-lg">{current.lang}</span>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-10 border-t border-paper/15 pt-10 lg:grid-cols-3">
          <p className="text-2xl font-semibold leading-snug tracking-[-0.03em] lg:col-span-2 lg:text-3xl">
            ‘lagi’는 말레이·인도네시아어로 <span className="text-lime">‘다시’</span>라는 뜻입니다.
            <br className="hidden lg:block" /> 한 번 더 보고, 다시 조합하고, 다시 메어보세요.
          </p>
          <ol className="flex flex-col gap-3 text-sm text-paper/70">
            <li>
              <a href="#remix" className="hover:text-paper focus-ring">01 — 다시 조합하기: 색을 바꿔 나만의 가방</a>
            </li>
            <li>
              <a href="#card" className="hover:text-paper focus-ring">02 — 다시 카드: 다시 하고 싶은 것 한 줄</a>
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}

function RemixSection({ productId, modelUrl, name }: { productId: string; modelUrl: string; name: string | null }) {
  const [params, setParams] = useSearchParams();
  const viewerRef = useRef<RemixViewerHandle>(null);
  const [colors, setColors] = useState<RemixColors>(() => decodeColors(params.get('c')));
  const [selected, setSelected] = useState<string>('body');
  const [spinKey, setSpinKey] = useState(0);
  const [count, setCount] = useState(0);
  const [copied, setCopied] = useState(false);

  // Keep the combination in the URL so it can be shared as-is.
  useEffect(() => {
    const encoded = encodeColors(colors);
    if ((params.get('c') ?? '') === encoded) return;
    const next = new URLSearchParams(params);
    if (encoded) next.set('c', encoded);
    else next.delete('c');
    setParams(next, { replace: true });
  }, [colors, params, setParams]);

  const again = useCallback(() => {
    setSpinKey((k) => k + 1);
    setCount((c) => c + 1);
    // Swap colours mid-turn, when the bag is side-on, so the change reads as part of the spin.
    window.setTimeout(() => setColors((prev) => shuffleColors(prev)), 300);
  }, []);

  const paint = (hex: string) => setColors((prev) => ({ ...prev, [selected]: hex }));

  const shareUrl = useMemo(
    () => `${window.location.origin}${window.location.pathname}#/again?c=${encodeColors(colors)}`,
    [colors]
  );

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('이 링크를 복사하세요', shareUrl);
    }
  }

  function savePng() {
    const png = viewerRef.current?.snapshot();
    if (!png) return;
    const a = document.createElement('a');
    a.href = png;
    a.download = `lagi-again-${count || 0}.png`;
    a.click();
  }

  const getBagImage = useCallback(() => viewerRef.current?.cutout() ?? null, []);
  const selectedPart = REMIX_PARTS.find((p) => p.key === selected);

  return (
    <>
      <section id="remix" className="scroll-mt-[var(--nav-height)] px-6 py-20 lg:px-10 lg:py-28">
        <div className="mx-auto max-w-canvas">
          <div className="flex flex-wrap items-end justify-between gap-6 border-b border-line pb-6">
            <div>
              <p className="eyebrow">01 · Remix</p>
              <h2 className="mt-3 font-display text-5xl lg:text-7xl">
                Again, <em>differently.</em>
              </h2>
            </div>
            <p className="max-w-sm text-graphite">
              {name ?? 'LAGI 가방'}의 부분을 눌러 색을 고르거나, ‘다시!’를 눌러 새로운 조합을 만나보세요.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-12">
            <div className="relative lg:col-span-7">
              <RemixViewer
                ref={viewerRef}
                modelUrl={modelUrl}
                colors={colors}
                selectedPart={selected}
                onSelectPart={setSelected}
                spinKey={spinKey}
                className="aspect-square w-full rounded-[2rem] bg-mist"
              />
              {count > 0 && (
                <p className="pointer-events-none absolute left-5 top-5 rounded-full bg-paper/90 px-4 py-2 text-xs font-semibold backdrop-blur">
                  다시 × {count}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-8 lg:col-span-5">
              <button
                type="button"
                onClick={again}
                className="group flex items-center justify-between rounded-[1.5rem] bg-blue px-8 py-7 text-left text-paper transition-transform active:scale-[0.98] focus-ring"
              >
                <span>
                  <span className="block text-5xl font-bold leading-none tracking-[-0.05em]">다시!</span>
                  <span className="mt-2 block text-sm text-paper/70">랜덤으로 새 조합 만들기</span>
                </span>
                <span className="text-4xl transition-transform duration-500 group-hover:rotate-180" aria-hidden="true">
                  ↻
                </span>
              </button>

              <div>
                <p className="eyebrow mb-3">부분 선택</p>
                <div className="flex flex-wrap gap-2">
                  {REMIX_PARTS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setSelected(p.key)}
                      aria-pressed={selected === p.key}
                      className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm focus-ring ${
                        selected === p.key ? 'border-ink bg-ink text-paper' : 'border-line text-graphite hover:border-ink'
                      }`}
                    >
                      <span
                        className="h-3 w-3 rounded-full border border-black/10"
                        style={{ backgroundColor: colors[p.key] ?? 'transparent' }}
                      />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="eyebrow mb-3">{selectedPart?.label} 색상 — {colors[selected] ? swatchName(colors[selected]) : '오리지널'}</p>
                <div className="grid max-w-sm grid-cols-6 gap-2.5">
                  {REMIX_PALETTE.map((s) => (
                    <button
                      key={s.hex}
                      type="button"
                      onClick={() => paint(s.hex)}
                      title={s.name}
                      aria-label={s.name}
                      aria-pressed={colors[selected] === s.hex}
                      className={`aspect-square rounded-full border border-black/10 transition-transform hover:scale-110 focus-ring ${
                        colors[selected] === s.hex ? 'ring-2 ring-ink ring-offset-2 ring-offset-paper' : ''
                      }`}
                      style={{ backgroundColor: s.hex }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-line pt-6">
                <button type="button" onClick={copyLink} className="rounded-full border border-ink/25 px-5 py-3 text-sm font-semibold hover:border-ink focus-ring">
                  {copied ? '링크 복사됨 ✓' : '조합 링크 복사'}
                </button>
                <button type="button" onClick={savePng} className="rounded-full border border-ink/25 px-5 py-3 text-sm font-semibold hover:border-ink focus-ring">
                  이미지 저장
                </button>
                <button
                  type="button"
                  onClick={() => setColors({})}
                  className="rounded-full px-4 py-3 text-sm text-stone hover:text-ink focus-ring"
                >
                  원래대로
                </button>
              </div>
              <p className="text-xs text-stone">
                색 조합은 디지털 미리보기이며, 실제 판매 중인 컬러와 다를 수 있습니다.{' '}
                <Link to={`/product/${productId}`} className="underline hover:text-ink">
                  실제 제품 보기
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="card" className="scroll-mt-[var(--nav-height)] border-t border-line px-6 py-20 lg:px-10 lg:py-28">
        <div className="mx-auto max-w-canvas">
          <div className="flex flex-wrap items-end justify-between gap-6 border-b border-line pb-6">
            <div>
              <p className="eyebrow">02 · Card</p>
              <h2 className="mt-3 font-display text-5xl lg:text-7xl">
                What would you do <em>again?</em>
              </h2>
            </div>
            <p className="max-w-sm text-graphite">다시 하고 싶은 것을 한 줄로 적으면, 저장하고 공유할 수 있는 카드가 됩니다.</p>
          </div>
          <div className="mt-12">
            <AgainCard getBagImage={getBagImage} bagKey={encodeColors(colors)} />
          </div>
        </div>
      </section>
    </>
  );
}
