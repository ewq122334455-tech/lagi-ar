import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCart } from '@/commerce/CartContext';
import { aiTryOnEnabled } from '@/tryon/aiTryOn';
import { WHY_LAGI, WHY_LAGI_RULE } from '@/content/whyLagi';
import { isPublished } from '@/utils/contentStatus';
import { Point } from '../Point';
import { CATEGORY_LABEL, OFFICIAL_LINKS, makerOf, price, shippingText, useRealProducts } from '../data';

const pad = (n: number) => String(n).padStart(2, '0');

/** True once, right after the home gallery zoomed into this product. */
function useArrivedFromGallery(id: string | undefined) {
  const [arrived] = useState(() => {
    try {
      const hit = !!id && sessionStorage.getItem('lagi-opened') === id;
      if (hit) sessionStorage.removeItem('lagi-opened');
      return hit;
    } catch {
      return false;
    }
  });
  return arrived;
}

/**
 * A product photo that is never shown larger than ~1.15× its own pixels, so it stays sharp
 * (the store photos are small). Keeps its ratio; never cropped.
 */
function SharpImage({ src, alt, className = '', testId, eager }: { src: string; alt: string; className?: string; testId?: string; eager?: boolean }) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  return (
    <img
      src={src}
      alt={alt}
      data-testid={testId}
      loading={eager ? 'eager' : 'lazy'}
      onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
      className={`block h-auto w-full ${className}`}
      style={natural ? { maxWidth: Math.round(natural.w * 1.15), aspectRatio: `${natural.w} / ${natural.h}` } : undefined}
    />
  );
}

/**
 * Product detail. The first screen carries one message: the product (photo) and how to buy it.
 * Shown: checked facts (name, price, the store's one-line description, category, size, shipping,
 * brand line) and LAGI's published copy (BRAND_COPY: introduction, story, materials, making,
 * selection reason, care) — the page says LAGI wrote it. AI drafts stay hidden; sections without
 * content are left out.
 */
export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const { products, loading } = useRealProducts();
  const navigate = useNavigate();
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const arrived = useArrivedFromGallery(id);

  const index = products.findIndex((p) => p.id === id);
  const p = products[index];
  if (loading) return <p className="t-caption kr px-page pt-page">불러오는 중…</p>;
  if (!p)
    return (
      <div className="px-page pb-32 pt-page">
        <h1 className="t-h1 kr">제품을 찾을 수 없습니다.</h1>
        <Link to="/discover" className="t-nav tag tag-ink kr mt-6">
          제품 목록으로
        </Link>
      </div>
    );
  const next = products[(index + 1) % products.length];
  const d = p.dimensions;
  const size = d.widthCm ? `${d.widthCm} × ${d.heightCm ?? '—'} × ${d.depthCm ?? '—'} cm` : null;
  const maker = makerOf(p.brandLabel);
  const catKey = p.category.value ?? '';
  const category = CATEGORY_LABEL[catKey] ?? catKey;
  const hero = p.images[0];
  const more = [...p.images.slice(1), ...p.gallery];
  const storeUrl = p.shopUrl.value ?? OFFICIAL_LINKS.store;
  const highlights = isPublished(p.highlights) ? p.highlights.value : [];
  const intro = isPublished(p.description) ? p.description.value : null;
  const story = isPublished(p.story) ? p.story.value : null;
  const reason = isPublished(p.lagiSelectionReason) ? p.lagiSelectionReason.value : null;
  const care = isPublished(p.care) ? p.care.value : null;
  const materials = p.materials.filter((m) => isPublished(m.name));
  const steps = p.process.filter((s) => isPublished(s.description)).sort((a, b) => a.order - b.order);
  const materialText = materials.length ? materials.map((m) => m.name.value).join(', ') : null;
  const usesCopy = [p.highlights, p.description, p.story, p.lagiSelectionReason, p.care].some((f) => f?.status === 'BRAND_COPY');
  const info = (
    [
      ['제품명', p.name.value],
      ['브랜드 표기', p.brandLabel ?? 'LAGI'],
      ['제작', maker ? `${maker} (라기는 발견하고 선별해 소개합니다)` : null],
      ['분류', category || null],
      ['크기', size ? `가로 × 높이 × 폭 ${size}` : null],
      ['주요 소재', materialText],
      ['가격', price(p.price.value)],
      ['배송', p.shipping ? shippingText(p.shipping) : null],
      ['관리 방법', care],
      ['교환 · 반품', '라기 공식 스마트스토어 기준을 따릅니다.'],
    ] as [string, string | null][]
  ).filter(([, v]) => v);
  const related = [
    ...products.filter((o) => o.id !== p.id && o.category.value === p.category.value),
    ...products.filter((o) => o.id !== p.id && o.category.value !== p.category.value),
  ]
    .filter((o) => o.id !== next?.id)
    .slice(0, 3);

  const facts = (
    [
      ['크기 (가로 × 높이 × 폭)', size],
      ['배송', p.shipping ? shippingText(p.shipping) : null],
      ['분류', category || null],
      ['브랜드 표기', p.brandLabel ?? null],
    ] as [string, string | null][]
  ).filter(([, v]) => v);

  function addToCart(go?: boolean) {
    add({ productId: p.id, variantId: null, size: null, color: null, quantity: qty, unitPrice: p.price.value, name: p.name.value, image: hero ?? null });
    setAdded(true);
    if (go) navigate('/checkout');
  }

  return (
    <article className="pb-32 pt-[calc(var(--top)-24px)] md:pb-24" data-arrived={arrived || undefined}>
      {/* 1–2 · Photo, then name, price and buying — one screen, one message */}
      <div className="grid grid-cols-1 gap-x-[var(--gap)] gap-y-8 px-page lg:grid-cols-12">
        <figure className="lg:col-span-7">
          <div className="flex items-center justify-center bg-[var(--c-gray)] px-6 py-10 md:py-14 lg:min-h-[calc(100svh-var(--top)-24px)] lg:px-10">
            {hero && <SharpImage src={hero} alt={p.name.value ?? ''} testId="product-hero" eager className={arrived ? 'arrive' : 'rise'} />}
          </div>
        </figure>

        <aside className="lg:col-span-4 lg:col-start-9" aria-label="구매">
          <div className="lg:sticky lg:top-24">
            <div className="t-caption kr flex items-center justify-between text-[var(--c-mute)]">
              <nav aria-label="현재 위치" className="flex gap-2">
                <Link to="/discover" className="tap px-1.5 hover:text-[var(--c-ink)]">
                  제품
                </Link>
                <span aria-hidden="true" className="tap">
                  /
                </span>
                {category && (
                  <Link to={`/discover?c=${encodeURIComponent(catKey)}`} className="tap px-1.5 hover:text-[var(--c-ink)]">
                    {category}
                  </Link>
                )}
              </nav>
              <span className="t-mark tabular-nums" data-testid="product-index">
                {pad(index + 1)} / {pad(products.length)}
              </span>
            </div>

            <h1 className="t-h1 kr mt-6 !font-bold">{p.name.value}</h1>
            {p.shortDescription.value && <p className="t-kr-sub mt-2">{p.shortDescription.value}</p>}
            <p className="t-h2 kr mt-6 tabular-nums">{price(p.price.value)}</p>
            {highlights.length > 0 && (
              <ul className="t-caption kr mt-5 grid gap-1.5" data-testid="product-highlights">
                {highlights.map((h) => (
                  <li key={h} className="flex gap-2">
                    <span aria-hidden="true" className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-[var(--c-blue)]" />
                    {h}
                  </li>
                ))}
              </ul>
            )}

            <div className="rule-1 mt-6 flex items-center justify-between pt-4">
              <p className="t-caption kr text-[var(--c-mute)]">수량</p>
              <div className="t-value inline-flex items-center gap-1">
                <button type="button" className="tag bg-[var(--c-label)] px-3" aria-label="수량 줄이기" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                  −
                </button>
                <span className="w-10 text-center tabular-nums" aria-live="polite">
                  {qty}
                </span>
                <button type="button" className="tag bg-[var(--c-label)] px-3" aria-label="수량 늘리기" onClick={() => setQty((q) => Math.min(20, q + 1))}>
                  +
                </button>
              </div>
            </div>

            <div className="t-nav kr mt-5 grid gap-2">
              <button type="button" className="tag btn-solid w-full px-4 py-4 text-center" onClick={() => addToCart(true)}>
                바로 구매
              </button>
              <button type="button" className="tag w-full border border-[var(--c-ink)] px-4 py-3.5 text-center" onClick={() => addToCart()}>
                {added ? '장바구니에 담았습니다' : '장바구니 담기'}
              </button>
              {aiTryOnEnabled(p) && (
                <Link to={`/again?p=${p.id}`} className="tag w-full bg-[var(--c-blue)] px-4 py-3.5 text-center text-[var(--c-white)] hover:bg-[var(--c-ink)]">
                  AI 이미지 합성 · 내 사진에 입혀 보기
                </Link>
              )}
            </div>
            <div className="t-caption kr mt-4 flex flex-wrap items-center justify-between gap-2">
              <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="tag tag-ink">
                스마트스토어에서 구매 ↗
              </a>
              {added && (
                <Link to="/cart" className="tag tag-ink">
                  장바구니 보기
                </Link>
              )}
            </div>

            <dl className="mt-8">
              {facts.map(([k, v]) => (
                <div key={k} className="rule-1 grid grid-cols-[8.5rem_1fr] gap-4 py-2.5">
                  <dt className="t-caption kr text-[var(--c-mute)]">{k}</dt>
                  <dd className="t-caption kr font-semibold text-[var(--c-ink)]">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>
      </div>

      {/* 2b · AI styling shots — labelled on every image, kept apart from the real product photos */}
      {!!p.styledImages?.length && (
        <section className="mt-24 px-page lg:mt-36" aria-labelledby="styled-title">
          <div className="rule flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pt-4">
            <h2 id="styled-title" className="t-h3 kr">
              착용 연출
            </h2>
            <p className="t-caption kr text-[var(--c-mute)]">AI로 만든 연출 이미지입니다. 라벨·프린트·형태 등 실제 제품과 다를 수 있어요.</p>
          </div>
          <div className="mt-6 grid grid-cols-1 items-start gap-[var(--gap)] md:grid-cols-3">
            {p.styledImages.map((src) => (
              <figure key={src} className="relative overflow-hidden bg-[var(--c-gray)]" data-testid="styled-image">
                <img src={src} alt={`AI 연출 이미지 — ${p.name.value ?? "제품"} 착용 모습`} loading="lazy" className="block h-auto w-full" />
                <figcaption className="t-label t-mark absolute left-2 top-2 bg-[var(--c-ink)] px-2 py-1 text-[var(--c-white)]">
                  AI 연출 이미지 · 실제와 다를 수 있음
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* 3 · More photos — only when the store has more than one */}
      {more.length > 0 && (
        <section className="mt-24 px-page lg:mt-36" aria-labelledby="photos-title">
          <h2 id="photos-title" className="t-h3 kr rule pt-4">
            사진
          </h2>
          <div className="mt-6 grid grid-cols-1 items-start gap-[var(--gap)] md:grid-cols-2">
            {more.map((src) => (
              <div key={src} className="flex justify-center bg-[var(--c-gray)] p-6">
                <SharpImage src={src} alt="" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4 · Introduction and story */}
      {(intro || story) && (
        <section className="mt-24 grid grid-cols-1 gap-x-[var(--gap)] gap-y-4 px-page lg:mt-36 lg:grid-cols-12" aria-labelledby="intro-title">
          <div className="lg:col-span-3">
            <h2 id="intro-title" className="t-h3 kr">
              제품 소개
            </h2>
            <p className="t-label t-mark mt-1 text-[var(--c-mute)]">About this piece</p>
          </div>
          <div className="lg:col-span-7 lg:col-start-5" data-testid="product-intro">
            {intro && <p className="t-h3 kr !font-medium !leading-[1.6]">{intro}</p>}
            {story && (
              <div className="rule-1 mt-10 pt-5">
                <p className="t-label t-mark text-[var(--c-mute)]">Story</p>
                <p className="t-body kr mt-3 text-[var(--c-mute)]">{story}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 5 · Material & making */}
      {(materials.length > 0 || steps.length > 0 || maker) && (
        <section className="mt-24 grid grid-cols-1 gap-x-[var(--gap)] gap-y-4 px-page lg:mt-36 lg:grid-cols-12" aria-labelledby="made-title">
          <div className="lg:col-span-3">
            <h2 id="made-title" className="t-h3 kr">
              소재와 제작
            </h2>
            <p className="t-label t-mark mt-1 text-[var(--c-mute)]">Material & making</p>
          </div>
          <div className="lg:col-span-7 lg:col-start-5">
            {materials.map((m) => (
              <div key={m.name.value} className="rule-1 grid grid-cols-1 gap-x-6 gap-y-1 py-4 md:grid-cols-[10rem_1fr]" data-testid="material">
                <p className="t-value kr font-semibold">{m.name.value}</p>
                <div className="t-body kr">
                  {isPublished(m.characteristics) && <p>{m.characteristics.value}</p>}
                  <p className="t-caption mt-1 text-[var(--c-mute)]">
                    {[isPublished(m.productLocation) ? `사용 부위 · ${m.productLocation.value}` : null, isPublished(m.reasonForUse) ? `${m.reasonForUse.value}` : null]
                      .filter(Boolean)
                      .join(' — ')}
                  </p>
                </div>
              </div>
            ))}
            {steps.length > 0 && (
              <ol className="mt-8 grid grid-cols-1 gap-x-[var(--gap)] gap-y-6 md:grid-cols-3" data-testid="process">
                {steps.map((st, i) => (
                  <li key={st.order} className="border-t border-[var(--c-ink)] pt-4">
                    <span className="t-label t-mark tabular-nums text-[var(--c-mute)]">{pad(i + 1)}</span>
                    <p className="t-value kr mt-2 font-semibold">{st.title}</p>
                    <p className="t-caption kr mt-1 text-[var(--c-mute)]">{st.description.value}</p>
                  </li>
                ))}
              </ol>
            )}
            {maker && (
              <p className="t-body kr mt-8 text-[var(--c-mute)]">
                협업 브랜드 {maker}. 제품은 제작사가 만들고, 라기는 발견하고 선별해 소개합니다.
              </p>
            )}
          </div>
        </section>
      )}

      {/* 6 · Why LAGI selected this — the four criteria every product passed */}
      <section className="mt-24 bg-[var(--c-ink)] px-page py-16 text-[var(--c-white)] lg:mt-36 lg:py-24" aria-labelledby="why-title">
        <div className="grid grid-cols-1 gap-x-[var(--gap)] gap-y-4 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="t-label t-mark text-white/80">Why LAGI selected this?</p>
            <h2 id="why-title" className="t-h2 kr mt-3">
              이 제품을 고른 이유
            </h2>
          </div>
          <div className="lg:col-span-5 lg:col-start-8 lg:self-end">
            {reason && (
              <p className="t-h3 kr !font-medium" data-testid="selection-reason">
                “{reason}”
              </p>
            )}
            <p className={`t-body kr text-white/80 ${reason ? 'mt-4' : ''}`}>
              라기의 모든 제품은 네 가지 기준을 모두 통과해야 소개됩니다. {p.name.value}도 같은 기준으로 선정되었습니다.
            </p>
          </div>
        </div>
        <ol className="mt-12 grid grid-cols-1 gap-x-[var(--gap)] md:grid-cols-2 lg:grid-cols-4">
          {WHY_LAGI.map((c, i) => (
            <li key={c.key} className="border-t border-white/30 py-6 lg:pr-6">
              <span className="t-label t-mark tabular-nums text-white/80">{pad(i + 1)}</span>
              <span className="t-h3 t-mark mt-3 flex items-center gap-2">
                <Point />
                {c.key}
              </span>
              <span className="t-body kr mt-3 block text-white/80">{c.question}</span>
            </li>
          ))}
        </ol>
        <p className="t-value kr mt-6">{WHY_LAGI_RULE}</p>
      </section>

      {/* 7 · AI compositing */}
      {aiTryOnEnabled(p) && hero && (
        <section className="bg-[var(--c-gray)] px-page py-12 lg:py-16" aria-labelledby="ai-title">
          <div className="grid grid-cols-[72px_1fr] items-center gap-x-5 gap-y-5 md:grid-cols-[96px_1fr_auto]">
            <img src={hero} alt="" className="aspect-square w-full object-cover" loading="lazy" />
            <div>
              <p className="t-label t-mark text-[var(--c-mute)]">Again experience</p>
              <h2 id="ai-title" className="t-h3 kr mt-1">
                내 사진에 이 제품을 합성해 보세요
              </h2>
              <p className="t-caption kr mt-1 text-[var(--c-mute)]">AI가 만든 이미지입니다. 실제 크기와 색은 다를 수 있습니다.</p>
            </div>
            <Link to={`/again?p=${p.id}`} className="t-nav tag btn-solid kr col-span-2 justify-self-start px-5 py-3.5 md:col-span-1">
              AI 이미지 합성
            </Link>
          </div>
        </section>
      )}

      {/* 8 · Product information */}
      <section className="mt-24 grid grid-cols-1 gap-x-[var(--gap)] gap-y-4 px-page lg:mt-32 lg:grid-cols-12" aria-labelledby="info-title">
        <div className="lg:col-span-3">
          <h2 id="info-title" className="t-h3 kr">
            제품 정보
          </h2>
          <p className="t-label t-mark mt-1 text-[var(--c-mute)]">Details</p>
        </div>
        <div className="lg:col-span-7 lg:col-start-5">
          <dl data-testid="product-info">
            {info.map(([k, v]) => (
              <div key={k} className="rule-1 grid grid-cols-[7rem_1fr] gap-4 py-3 md:grid-cols-[9rem_1fr]">
                <dt className="t-caption kr text-[var(--c-mute)]">{k}</dt>
                <dd className="t-caption kr text-[var(--c-ink)]">{v}</dd>
              </div>
            ))}
          </dl>
          {usesCopy && (
            <p className="t-caption kr mt-4 text-[var(--c-mute)]">
              제품 소개 문구는 라기가 제품 기본 정보와 사진을 바탕으로 작성했습니다. 소재와 제작의 세부 사항은 제작사 기준을 따르며, 정확한 정보는{' '}
              <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                스마트스토어
              </a>
              에서 확인할 수 있습니다.
            </p>
          )}
        </div>
      </section>

      {/* 9 · Purchase */}
      <section className="mt-24 grid grid-cols-1 gap-x-[var(--gap)] gap-y-4 px-page lg:mt-32 lg:grid-cols-12" aria-labelledby="buy-title">
        <h2 id="buy-title" className="t-h3 kr lg:col-span-3">
          구매
        </h2>
        <div className="lg:col-span-7 lg:col-start-5">
          <p className="t-body kr">이 사이트에서 바로 주문하거나, 라기 공식 네이버 스마트스토어에서 구매할 수 있습니다.</p>
          <div className="t-nav kr mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
            <button type="button" className="tag btn-solid px-5 py-3.5" onClick={() => addToCart(true)}>
              바로 구매 · {price(p.price.value)}
            </button>
            <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="tag tag-ink">
              스마트스토어 ↗
            </a>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="mt-24 px-page lg:mt-36" aria-labelledby="more-title">
          <div className="rule flex items-baseline justify-between pt-4">
            <h2 id="more-title" className="t-h3 kr">
              다른 제품
            </h2>
            <Link to="/discover" className="tag tag-ink t-caption kr">
              전체 보기
            </Link>
          </div>
          <ul className="mt-6 grid grid-cols-1 gap-[var(--gap)] sm:grid-cols-2 lg:grid-cols-3">
            {related.map((o) => (
              <li key={o.id}>
                <Link to={`/product/${o.id}`} className="group block">
                  <div className="overflow-hidden bg-[var(--c-gray)]" style={{ aspectRatio: 0.877 }}>
                    {o.images[0] && (
                      <img src={o.images[0]} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
                    )}
                  </div>
                  <span className="mt-3 flex items-baseline justify-between gap-4">
                    <span className="t-value kr">{o.name.value}</span>
                    <span className="t-caption kr shrink-0 tabular-nums text-[var(--c-mute)]">{price(o.price.value)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {next && next.id !== p.id && (
        <Link to={`/product/${next.id}`} className="group rule mx-[var(--page-x)] mt-24 grid grid-cols-[1fr_auto] items-end gap-6 pt-4 lg:mt-36">
          <span>
            <span className="t-caption kr block text-[var(--c-mute)]">다음 제품 · {pad(((index + 1) % products.length) + 1)}</span>
            <span className="t-display t-mark mt-3 block transition-colors group-hover:text-[var(--c-blue)]">Next</span>
            <span className="t-h3 kr mt-2 block">{next.name.value}</span>
          </span>
          {next.images[0] && (
            <span className="block w-24 overflow-hidden bg-[var(--c-gray)] sm:w-40 lg:w-48" style={{ aspectRatio: 0.877 }}>
              <img src={next.images[0]} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]" />
            </span>
          )}
        </Link>
      )}

      {/* Mobile buy bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-[var(--c-ink)] bg-[var(--c-white)] px-page py-3 pb-[max(12px,env(safe-area-inset-bottom))] md:hidden">
        <span className="min-w-0">
          <span className="t-caption kr block truncate text-[var(--c-mute)]">{p.name.value}</span>
          <span className="t-value kr block tabular-nums">{price(p.price.value)}</span>
        </span>
        <button type="button" className="t-nav tag btn-solid kr shrink-0 px-5 py-3" onClick={() => addToCart(true)}>
          바로 구매
        </button>
      </div>
    </article>
  );
}
