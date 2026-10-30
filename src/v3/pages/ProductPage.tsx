import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCart } from '@/commerce/CartContext';
import { aiTryOnEnabled } from '@/tryon/aiTryOn';
import { WHY_LAGI, WHY_LAGI_RULE } from '@/content/whyLagi';
import { isPublished } from '@/utils/contentStatus';
import { ProductViews } from '../ProductViews';
import { ProductCard } from '../ProductCard';
import { Point } from '../Point';
import { Reviews } from '../Reviews';
import { fetchReviews } from '../reviews';
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

/** One collapsible row of the buy panel (DESCRIPTION / SIZE / … in the reference). */
function Fold({ title, children, open: initial = false }: { title: string; children: React.ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(initial);
  return (
    <div className="border-b border-black/10">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between py-3.5 text-left">
        <span className="t-caption kr font-semibold">{title}</span>
        <span aria-hidden="true" className={`text-lg leading-none transition-transform duration-300 ${open ? 'rotate-45' : ''}`}>
          +
        </span>
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="t-caption kr pb-4 text-[#3a3a3a]">{children}</div>
        </div>
      </div>
    </div>
  );
}

type Tab = 'detail' | 'review' | 'qna';

/**
 * Product detail. Top: photos with a thumbnail strip, and the buy panel (name, price, highlights,
 * collapsible information, quantity, buy / cart / AI fitting). Below: tabs for detail, reviews, Q&A.
 * Shown: checked facts and LAGI's published copy (BRAND_COPY, labelled); AI drafts stay hidden.
 */
export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const { products, loading } = useRealProducts();
  const navigate = useNavigate();
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [shot, setShot] = useState(0);
  const [tab, setTab] = useState<Tab>('detail');
  const [reviewCount, setReviewCount] = useState<number | null>(null);
  const arrived = useArrivedFromGallery(id);
  useEffect(() => {
    setShot(0);
    setTab('detail');
    setQty(1);
    setAdded(false);
    setReviewCount(null);
  }, [id]);
  const onCount = useCallback((n: number) => setReviewCount(n), []);
  // The review count shows in the tab label before the tab is opened.
  useEffect(() => {
    if (id) fetchReviews(id, 1).then((d) => setReviewCount(d.total), () => undefined);
  }, [id]);

  const index = products.findIndex((p) => p.id === id);
  const p = products[index];
  if (loading) return <p className="t-caption kr px-page pt-page">불러오는 중…</p>;
  if (!p)
    return (
      <div className="px-page pb-32 pt-page">
        <h1 className="t-h1 kr">제품을 찾을 수 없습니다.</h1>
        <Link to="/discover" className="btn btn-line mt-6">
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
  const shipping = p.shipping ? shippingText(p.shipping) : null;

  // Photos for the gallery: the real photo, the views of the reference sheet, then styling shots.
  const shots = [
    ...(hero ? [{ src: hero, label: p.views?.main ?? '실제 사진', fit: 'cover' as const, note: null as string | null }] : []),
    ...(p.drawings ?? []).filter((x) => x.group !== 'detail').map((x) => ({ src: x.src, label: x.label, fit: 'contain' as const, note: '제품 도면(렌더링)' })),
    ...(p.styledImages ?? []).map((src) => ({ src, label: '착용 연출', fit: 'cover' as const, note: 'AI 연출 이미지 · 실제와 다를 수 있음' })),
  ];
  const current = shots[Math.min(shot, shots.length - 1)];

  const related = products.filter((o) => o.id !== p.id).slice(0, 4);
  const info = (
    [
      ['제품명', p.name.value],
      ['브랜드 표기', p.brandLabel ?? 'LAGI'],
      ['제작', maker ? `${maker} (라기는 발견하고 선별해 소개합니다)` : null],
      ['분류', category || null],
      ['크기', size ? `가로 × 높이 × 폭 ${size}` : null],
      ['주요 소재', materialText],
      ['가격', price(p.price.value)],
      ['배송', shipping],
      ['관리 방법', care],
      ['교환 · 반품', '라기 공식 스마트스토어 기준을 따릅니다.'],
    ] as [string, string | null][]
  ).filter(([, v]) => v);

  function addToCart(go?: boolean) {
    add({ productId: p.id, variantId: null, size: null, color: null, quantity: qty, unitPrice: p.price.value, name: p.name.value, image: hero ?? null });
    setAdded(true);
    if (go) navigate('/checkout');
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'detail', label: '상세정보' },
    { key: 'review', label: `구매평${reviewCount ? ` ${reviewCount}` : ''}` },
    { key: 'qna', label: 'Q&A' },
  ];

  return (
    <article className="px-page pb-32 pt-[calc(var(--top)-12px)] md:pb-24" data-arrived={arrived || undefined}>
      {/* 1 · Photos + buy panel */}
      <div className="grid grid-cols-1 gap-x-[calc(var(--gap)*2)] gap-y-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <nav aria-label="현재 위치" className="t-caption kr mb-3 flex gap-2 text-[var(--c-mute)]">
            <Link to="/" className="hover:text-[var(--c-ink)]">
              홈
            </Link>
            <span aria-hidden="true">/</span>
            <Link to="/discover" className="hover:text-[var(--c-ink)]">
              제품
            </Link>
            {category && (
              <>
                <span aria-hidden="true">/</span>
                <Link to={`/discover?c=${encodeURIComponent(catKey)}`} className="hover:text-[var(--c-ink)]">
                  {category}
                </Link>
              </>
            )}
          </nav>
          {current && (
            <figure>
              <div className={`relative aspect-square overflow-hidden rounded-[var(--radius-card)] ${current.fit === 'contain' ? 'bg-white ring-1 ring-black/5' : 'bg-[var(--c-gray)]'}`}>
                <img
                  key={current.src}
                  src={current.src}
                  alt={`${p.name.value ?? ''} — ${current.label}`}
                  data-testid="product-hero"
                  className={`h-full w-full ${current.fit === 'contain' ? 'object-contain p-[6%]' : 'object-cover'} ${arrived && shot === 0 ? 'arrive' : 'rise'}`}
                />
                {current.note && <span className="t-label kr absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1">{current.note}</span>}
              </div>
              <figcaption className="t-caption kr mt-2 text-[var(--c-mute)]">{current.label}</figcaption>
            </figure>
          )}
          {shots.length > 1 && (
            <div className="mt-3 grid grid-cols-6 gap-2 sm:grid-cols-8" role="tablist" aria-label="제품 사진" data-testid="thumbs">
              {shots.map((s, i) => (
                <button
                  key={s.src}
                  type="button"
                  role="tab"
                  aria-selected={i === shot}
                  aria-label={s.label}
                  onClick={() => setShot(i)}
                  className={`aspect-square overflow-hidden rounded-[6px] bg-white ring-1 transition ${i === shot ? 'ring-2 ring-[var(--c-ink)]' : 'ring-black/10 hover:ring-black/40'}`}
                >
                  <img src={s.src} alt="" loading="lazy" className={`h-full w-full ${s.fit === 'contain' ? 'object-contain p-1' : 'object-cover'}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="lg:col-span-5" aria-label="구매">
          <div className="lg:sticky lg:top-[80px]">
            <div className="flex items-center justify-between">
              <p className="t-caption t-mark text-[var(--c-mute)]">{p.brandLabel ?? 'LAGI'}</p>
              <span className="t-caption t-mark tabular-nums text-[var(--c-mute)]" data-testid="product-index">
                {pad(index + 1)} / {pad(products.length)}
              </span>
            </div>
            <h1 className="t-h1 kr mt-2 !font-bold">{p.name.value}</h1>
            {p.shortDescription.value && <p className="t-kr-sub mt-1.5">{p.shortDescription.value}</p>}
            <p className="t-h2 kr mt-5 tabular-nums">{price(p.price.value)}</p>
            {highlights.length > 0 && (
              <ul className="t-caption kr mt-4 grid gap-1.5" data-testid="product-highlights">
                {highlights.map((h) => (
                  <li key={h} className="flex gap-2">
                    <span aria-hidden="true" className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-[var(--c-blue)]" />
                    {h}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-6 border-t border-black/10">
              {intro && (
                <Fold title="제품 설명" open>
                  {intro}
                </Fold>
              )}
              {size && (
                <Fold title="크기">
                  가로 × 높이 × 폭 {size}
                </Fold>
              )}
              {(materialText || care) && (
                <Fold title="소재 · 관리">
                  {materialText && <p>주요 소재: {materialText}</p>}
                  {care && <p className={materialText ? 'mt-2' : ''}>{care}</p>}
                </Fold>
              )}
              <Fold title="배송 · 교환">
                {shipping && <p>배송: {shipping}</p>}
                <p className={shipping ? 'mt-2' : ''}>교환 · 반품은 라기 공식 스마트스토어 기준을 따릅니다.</p>
              </Fold>
            </div>

            <div className="mt-5 rounded-[var(--radius-card)] bg-[var(--c-gray)] p-4">
              <div className="flex items-center justify-between gap-4">
                <p className="t-caption kr text-[var(--c-mute)]">수량</p>
                <div className="inline-flex items-center rounded-full border border-black/15 bg-white">
                  <button type="button" className="h-9 w-9 rounded-full hover:bg-[var(--c-label)]" aria-label="수량 줄이기" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                    −
                  </button>
                  <span className="t-value w-8 text-center tabular-nums" aria-live="polite">
                    {qty}
                  </span>
                  <button type="button" className="h-9 w-9 rounded-full hover:bg-[var(--c-label)]" aria-label="수량 늘리기" onClick={() => setQty((q) => Math.min(20, q + 1))}>
                    +
                  </button>
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between border-t border-black/10 pt-3">
                <p className="t-caption kr">총 금액</p>
                <p className="t-value kr tabular-nums" data-testid="total">
                  {price((p.price.value ?? 0) * qty)}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" className="btn btn-primary" onClick={() => addToCart(true)}>
                바로 구매
              </button>
              <button type="button" className="btn btn-line" onClick={() => addToCart()}>
                {added ? '담았습니다 ✓' : '장바구니'}
              </button>
              {aiTryOnEnabled(p) && (
                <Link to={`/again?p=${p.id}`} className="btn btn-blue col-span-2" data-testid="fit-button">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
                    <circle cx="12" cy="12" r="3.2" />
                  </svg>
                  AI 피팅 · 내 모습에 입혀 보기
                </Link>
              )}
            </div>
            <div className="t-caption kr mt-3 flex flex-wrap items-center justify-between gap-2">
              <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-[var(--c-blue)]">
                스마트스토어에서 구매 ↗
              </a>
              {added && (
                <Link to="/cart" className="font-semibold underline underline-offset-4">
                  장바구니 보기 →
                </Link>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* 2 · Tabs */}
      <div className="sticky top-16 z-20 mt-20 border-b border-black/10 bg-white lg:top-14" role="tablist" aria-label="제품 정보">
        <div className="grid grid-cols-3">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`t-caption kr relative py-4 font-semibold transition-colors ${tab === t.key ? 'text-[var(--c-ink)]' : 'text-[var(--c-mute)] hover:text-[var(--c-ink)]'}`}
              data-testid={`tab-${t.key}`}
            >
              {t.label}
              <span aria-hidden="true" className={`absolute inset-x-0 -bottom-px h-[2px] bg-[var(--c-ink)] transition-transform duration-300 ${tab === t.key ? 'scale-x-100' : 'scale-x-0'}`} />
            </button>
          ))}
        </div>
      </div>

      {tab === 'detail' && (
        <div role="tabpanel" aria-label="상세정보">
          {/* Introduction and story, centred like an editorial page */}
          {(intro || story) && (
            <section className="mx-auto mt-16 max-w-2xl text-center" data-testid="product-intro">
              <p className="t-label t-mark text-[var(--c-mute)]">About this piece</p>
              {intro && <p className="t-h3 kr mt-4 !font-medium !leading-[1.7]">{intro}</p>}
              {story && <p className="t-body kr mt-6 text-[var(--c-mute)]">{story}</p>}
            </section>
          )}

          {(p.views || p.drawings?.length) && hero && <ProductViews src={hero} name={p.name.value ?? ''} product={p} />}

          {!!p.styledImages?.length && (
            <section className="mt-20" aria-labelledby="styled-title">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-black/15 pt-4">
                <h2 id="styled-title" className="t-h3 kr">
                  착용 연출
                </h2>
                <p className="t-caption kr text-[var(--c-mute)]">AI로 만든 연출 이미지입니다. 라벨·프린트·형태 등 실제 제품과 다를 수 있어요.</p>
              </div>
              <div className="mt-6 grid grid-cols-1 items-start gap-[var(--gap)] md:grid-cols-3">
                {p.styledImages.map((src) => (
                  <figure key={src} className="relative overflow-hidden rounded-[var(--radius-card)] bg-[var(--c-gray)]" data-testid="styled-image">
                    <img src={src} alt={`AI 연출 이미지 — ${p.name.value ?? '제품'} 착용 모습`} loading="lazy" className="block h-auto w-full" />
                    <figcaption className="t-label kr absolute left-2 top-2 rounded-full bg-[var(--c-ink)] px-2.5 py-1 text-[var(--c-white)]">AI 연출 이미지 · 실제와 다를 수 있음</figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}

          {/* Material & making */}
          {(materials.length > 0 || steps.length > 0 || maker) && (
            <section className="mt-20 grid grid-cols-1 gap-x-[var(--gap)] gap-y-4 border-t border-black/15 pt-4 lg:grid-cols-12" aria-labelledby="made-title">
              <div className="lg:col-span-3">
                <h2 id="made-title" className="t-h3 kr">
                  소재와 제작
                </h2>
                <p className="t-label t-mark mt-1 text-[var(--c-mute)]">Material & making</p>
              </div>
              <div className="lg:col-span-8 lg:col-start-5">
                {materials.map((m) => (
                  <div key={m.name.value} className="grid grid-cols-1 gap-x-6 gap-y-1 border-b border-black/10 py-4 md:grid-cols-[10rem_1fr]" data-testid="material">
                    <p className="t-value kr font-semibold">{m.name.value}</p>
                    <div className="t-body kr">
                      {isPublished(m.characteristics) && <p>{m.characteristics.value}</p>}
                      <p className="t-caption mt-1 text-[var(--c-mute)]">
                        {[isPublished(m.productLocation) ? `사용 부위 · ${m.productLocation.value}` : null, isPublished(m.reasonForUse) ? `${m.reasonForUse.value}` : null].filter(Boolean).join(' — ')}
                      </p>
                    </div>
                  </div>
                ))}
                {steps.length > 0 && (
                  <ol className="mt-8 grid grid-cols-1 gap-x-[var(--gap)] gap-y-6 md:grid-cols-3" data-testid="process">
                    {steps.map((st, i) => (
                      <li key={st.order} className="rounded-[var(--radius-card)] bg-[var(--c-gray)] p-5">
                        <span className="t-label t-mark tabular-nums text-[var(--c-mute)]">{pad(i + 1)}</span>
                        <p className="t-value kr mt-2 font-semibold">{st.title}</p>
                        <p className="t-caption kr mt-1 text-[var(--c-mute)]">{st.description.value}</p>
                      </li>
                    ))}
                  </ol>
                )}
                {maker && <p className="t-body kr mt-8 text-[var(--c-mute)]">협업 브랜드 {maker}. 제품은 제작사가 만들고, 라기는 발견하고 선별해 소개합니다.</p>}
              </div>
            </section>
          )}

          {/* Why LAGI selected this — inset, not edge to edge */}
          <section className="mt-20 rounded-[calc(var(--radius-card)*2)] bg-[var(--c-ink)] px-6 py-14 text-[var(--c-white)] lg:px-14 lg:py-20" aria-labelledby="why-title">
            <div className="grid grid-cols-1 gap-x-[var(--gap)] gap-y-4 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <p className="t-label t-mark text-white/80">Why LAGI selected this?</p>
                <h2 id="why-title" className="t-h2 kr mt-3">
                  이 제품을 고른 이유
                </h2>
              </div>
              <div className="lg:col-span-6 lg:col-start-7 lg:self-end">
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

          {/* Product information */}
          <section className="mt-20 grid grid-cols-1 gap-x-[var(--gap)] gap-y-4 border-t border-black/15 pt-4 lg:grid-cols-12" aria-labelledby="info-title">
            <div className="lg:col-span-3">
              <h2 id="info-title" className="t-h3 kr">
                제품 정보
              </h2>
              <p className="t-label t-mark mt-1 text-[var(--c-mute)]">Details</p>
            </div>
            <div className="lg:col-span-8 lg:col-start-5">
              <dl data-testid="product-info">
                {info.map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[7rem_1fr] gap-4 border-b border-black/10 py-3 md:grid-cols-[9rem_1fr]">
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
        </div>
      )}

      {tab === 'review' && (
        <div role="tabpanel" aria-label="구매평" className="mx-auto mt-12 max-w-3xl">
          <Reviews productId={p.id} onCount={onCount} />
        </div>
      )}

      {tab === 'qna' && (
        <div role="tabpanel" aria-label="Q&A" className="mx-auto mt-12 max-w-3xl" data-testid="qna">
          <p className="t-value kr">제품 문의</p>
          <p className="t-body kr mt-2 text-[var(--c-mute)]">크기, 소재, 배송 등 궁금한 점은 아래로 문의해 주세요. 보통 하루 안에 답변드립니다.</p>
          <div className="mt-6 grid grid-cols-1 gap-[var(--gap)] sm:grid-cols-2">
            <a href={OFFICIAL_LINKS.instagram} target="_blank" rel="noopener noreferrer" className="rounded-[var(--radius-card)] border border-black/15 p-5 transition-colors hover:border-[var(--c-ink)]">
              <p className="t-value kr">인스타그램 DM ↗</p>
              <p className="t-caption kr mt-1 text-[var(--c-mute)]">@lagi.official 로 메시지를 보내 주세요.</p>
            </a>
            <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="rounded-[var(--radius-card)] border border-black/15 p-5 transition-colors hover:border-[var(--c-ink)]">
              <p className="t-value kr">스마트스토어 Q&A ↗</p>
              <p className="t-caption kr mt-1 text-[var(--c-mute)]">상품 문의 게시판에 남겨 주세요.</p>
            </a>
          </div>
        </div>
      )}

      {/* 3 · Other products */}
      {related.length > 0 && (
        <section className="mt-24 lg:mt-32" aria-labelledby="more-title">
          <div className="flex items-baseline justify-between border-t-2 border-[var(--c-ink)] pt-4">
            <h2 id="more-title" className="t-h3 kr">
              함께 보면 좋은 제품
            </h2>
            <Link to="/discover" className="t-caption kr underline underline-offset-4 hover:text-[var(--c-blue)]">
              전체 보기
            </Link>
          </div>
          <ul className="mt-6 grid grid-cols-2 gap-x-[var(--gap)] gap-y-10 md:grid-cols-4">
            {related.map((o) => (
              <li key={o.id}>
                <ProductCard p={o} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {next && next.id !== p.id && (
        <Link to={`/product/${next.id}`} className="group mt-20 flex items-center justify-between gap-6 rounded-[var(--radius-card)] bg-[var(--c-gray)] p-5 lg:p-8">
          <span>
            <span className="t-caption kr block text-[var(--c-mute)]">다음 제품 · {pad(((index + 1) % products.length) + 1)}</span>
            <span className="t-h2 t-mark mt-2 block transition-colors group-hover:text-[var(--c-blue)]">Next →</span>
            <span className="t-value kr mt-1 block">{next.name.value}</span>
          </span>
          {next.images[0] && (
            <span className="block w-24 overflow-hidden rounded-[6px] sm:w-32" style={{ aspectRatio: 1 }}>
              <img src={next.images[0]} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]" />
            </span>
          )}
        </Link>
      )}

      {/* Mobile buy bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-black/10 bg-[var(--c-white)] px-page py-3 pb-[max(12px,env(safe-area-inset-bottom))] md:hidden">
        <span className="min-w-0 flex-1">
          <span className="t-caption kr block truncate text-[var(--c-mute)]">{p.name.value}</span>
          <span className="t-value kr block tabular-nums">{price(p.price.value)}</span>
        </span>
        <button type="button" className="btn btn-line !min-h-[44px] !px-4" onClick={() => addToCart()} aria-label="장바구니 담기">
          {added ? '✓' : '담기'}
        </button>
        <button type="button" className="btn btn-primary !min-h-[44px]" onClick={() => addToCart(true)}>
          바로 구매
        </button>
      </div>
    </article>
  );
}
