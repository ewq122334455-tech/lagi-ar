import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCart } from '@/commerce/CartContext';
import { aiTryOnEnabled } from '@/tryon/aiTryOn';
import { paymentsEnabled } from '@/commerce/payments';
import { isPublished } from '@/utils/contentStatus';
import { ProductViews } from '../ProductViews';
import { ProductCard } from '../ProductCard';
import { Reviews } from '../Reviews';
import { fetchReviews } from '../reviewsApi';
import { CATEGORY_LABEL, isClothing, OFFICIAL_LINKS, makerOf, price, shippingText, useRealProducts } from '../data';
import { largeCopy, responsive } from '../img';
import { usePageMeta } from '../usePageMeta';


/**
 * Phones: the buy bar fixed to the bottom of the screen.
 *
 * It is rendered at the page root (a portal): the page wrapper keeps a transform from its entry
 * animation, and a `position: fixed` element inside a transformed parent is fixed to that parent
 * (the far end of a long page) instead of the screen. Its height is published as `--buybar-h` so the
 * floating help button and the footer stay clear of it. While a text field is focused (on-screen
 * keyboard) it steps aside so it never covers what is being typed.
 */
function MobileBuyBar({ children }: { children: React.ReactNode }) {
  const bar = useRef<HTMLDivElement>(null);
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const root = document.documentElement;
    const publish = () => {
      root.style.setProperty('--buybar-h', `${typing ? 0 : el.offsetHeight}px`);
      // A clear gap between the bar and the floating help button, so it never looks stuck to it.
      root.style.setProperty('--buybar-gap', typing ? '0px' : '12px');
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty('--buybar-h');
      root.style.removeProperty('--buybar-gap');
    };
  }, [typing]);
  useEffect(() => {
    const isField = (t: EventTarget | null) =>
      t instanceof HTMLElement &&
      !bar.current?.contains(t) &&
      (t.matches('input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea, select') || t.isContentEditable);
    // Coming back is delayed: leaving a field by tapping a button (e.g. "구매평 등록") must not put the
    // bar under that same tap, and the on-screen keyboard needs a moment to close.
    let back = 0;
    const onIn = (e: FocusEvent) => {
      if (!isField(e.target)) return;
      window.clearTimeout(back);
      setTyping(true);
    };
    const onOut = (e: FocusEvent) => {
      if (!isField(e.target)) return;
      window.clearTimeout(back);
      back = window.setTimeout(() => !isField(document.activeElement) && setTyping(false), 400);
    };
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    return () => {
      window.clearTimeout(back);
      document.removeEventListener('focusin', onIn);
      document.removeEventListener('focusout', onOut);
    };
  }, []);
  // The wrapper carries the site's tokens and fonts (.v3) without drawing a box: `.v3` itself also
  // paints the dark page background, which must not reach the bar.
  return createPortal(
    <div className="v3" style={{ display: 'contents' }}>
      <div
        ref={bar}
        // Inline style: the `flex` utility would otherwise win over the `hidden` attribute.
        style={typing ? { display: 'none' } : undefined}
        data-testid="mobile-buy-bar"
        className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-black/10 bg-[var(--c-white)] px-page py-3 pb-[max(12px,env(safe-area-inset-bottom))] md:hidden"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

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
    <div className="border-b border-[var(--c-blue)] text-[var(--c-blue)]">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between py-3.5 text-left">
        <span className="t-caption kr font-semibold">{title}</span>
        <span aria-hidden="true" className={`text-lg leading-none transition-transform duration-300 ${open ? 'rotate-45' : ''}`}>
          +
        </span>
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="t-caption kr pb-4">{children}</div>
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
  const metaProduct = products.find((x) => x.id === id);
  usePageMeta(metaProduct ? metaProduct.name.value : products.length ? '제품을 찾을 수 없습니다' : null, metaProduct?.shortDescription.value);
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

  const d = p.dimensions;
  const size = d.widthCm ? `${d.widthCm} × ${d.heightCm ?? '—'} × ${d.depthCm ?? '—'} cm` : null;
  const maker = makerOf(p.brandLabel);
  const catKey = p.category.value ?? '';
  const category = CATEGORY_LABEL[catKey] ?? catKey;
  const hero = p.images[0];
  const storeUrl = p.shopUrl.value ?? OFFICIAL_LINKS.store;
  // Products that are only on this website (not on the smart store yet): nothing on the page sends the visitor to the store, and there is nothing to buy yet.
  const onStore = p.storeListed !== false;
  const care = isPublished(p.care) ? p.care.value : null;
  const materials = p.materials.filter((m) => isPublished(m.name));
  const materialText = materials.length ? materials.map((m) => m.name.value).join(', ') : null;
  const shipping = p.shipping ? shippingText(p.shipping) : null;

  // Photos for the gallery: the real photo, the views of the reference sheet, then styling shots.
  const shots = [
    ...(hero ? [{ src: hero, label: p.views?.main ?? '실제 사진', fit: 'cover' as const, note: null as string | null }] : []),
    ...(p.drawings ?? []).filter((x) => x.group !== 'detail').map((x) => ({ src: x.src, label: x.label, fit: 'contain' as const, note: '제품 도면(렌더링)' })),
    ...(p.styledImages ?? []).map((src) => ({ src, label: '착용 연출', fit: 'cover' as const, note: 'AI 연출 이미지 · 실제와 다를 수 있음' })),
  ];
  const current = shots[Math.min(shot, shots.length - 1)];

  const related = products.filter((o) => o.id !== p.id).slice(0, 4);

  // Without online payment, "바로 구매" goes straight to the official store instead of an order form.
  const online = paymentsEnabled();
  const buyNow = online
    ? { onClick: () => addToCart(true) }
    : { href: storeUrl, target: '_blank', rel: 'noopener noreferrer', 'aria-label': '스마트스토어에서 바로 구매 (새 창)' };

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
      {/* 1 · Editorial opening: small meta line, one big picture, the name in big brand-blue type */}
      <div className="flex items-baseline justify-between text-[var(--c-blue)]">
        <Link to="/" className="t-label t-mark hit">LAGI</Link>
        <nav aria-label="현재 위치" className="t-label t-mark flex gap-3">
          <Link to="/discover" className="hit">SHOP</Link>
          {category && (
            <Link to={`/discover?c=${encodeURIComponent(catKey)}`} className="hit kr !tracking-normal">
              {category}
            </Link>
          )}
        </nav>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-x-[calc(var(--gap)*2)] gap-y-10 lg:grid-cols-12">
        <div className="lg:col-span-7">
          {current && (
            <figure>
              <div className={`relative aspect-[4/5] overflow-hidden ${current.fit === 'contain' ? 'bg-white ring-1 ring-[var(--c-blue)]/15' : 'bg-[var(--c-gray)]'}`}>
                <img
                  key={current.src}
                  {...responsive(current.src, '(max-width: 1023px) 100vw, 58vw')}
                  src={current.src}
                  alt={`${p.name.value ?? ''} — ${current.label}`}
                  data-testid="product-hero"
                  className={`h-full w-full ${current.fit === 'contain' ? 'object-contain p-[6%]' : 'object-cover'} ${arrived && shot === 0 ? 'arrive' : 'rise'}`}
                />
                {current.note && <span className="t-label kr absolute left-3 top-3 bg-white/90 px-2.5 py-1 text-[var(--c-blue)]">{current.note}</span>}
              </div>
              <figcaption className="t-label t-mark mt-2 flex justify-between text-[var(--c-blue)]">
                <span>{String(Math.min(shot, shots.length - 1) + 1).padStart(2, '0')} / {String(shots.length).padStart(2, '0')}</span>
                <span className="kr !tracking-normal">{current.label}</span>
              </figcaption>
            </figure>
          )}
          {shots.length > 1 && (
            <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-5" role="tablist" aria-label="제품 사진" data-testid="thumbs">
              {shots.map((s, i) => (
                <button
                  key={s.src}
                  type="button"
                  role="tab"
                  aria-selected={i === shot}
                  aria-label={s.label}
                  onClick={() => setShot(i)}
                  className="group text-left"
                >
                  <span className={`block aspect-[4/5] overflow-hidden bg-white ring-1 transition ${i === shot ? 'ring-2 ring-[var(--c-blue)]' : 'ring-black/10 group-hover:ring-[var(--c-blue)]'}`}>
                    <img {...responsive(s.src, '120px')} src={s.src} alt="" loading="lazy" className={`h-full w-full ${s.fit === 'contain' ? 'object-contain p-1' : 'object-cover'}`} />
                  </span>
                  <span className="t-label t-mark mt-1 block text-[var(--c-blue)]">{String(i + 1).padStart(2, '0')}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="lg:col-span-5" aria-label="구매">
          <div className="lg:sticky lg:top-[88px]">
            <p className="t-mark text-[clamp(44px,6vw,92px)] font-light leading-none text-[var(--c-blue)]" aria-hidden="true">(1)</p>
            <h1 className="kr mt-6 text-[clamp(30px,3.6vw,56px)] font-bold leading-[1.08] tracking-[-0.03em] text-[var(--c-blue)]">{p.name.value}</h1>
            {p.setItems && p.setItems.length > 0 && (
              <ul className="kr mt-5 space-y-1 text-[15px] text-[var(--c-blue)]" data-testid="set-items" aria-label="세트 구성">
                {p.setItems.map((s, i) => (
                  <li key={s} className="flex gap-3">
                    <span className="t-mark text-[12px] leading-[1.9]">{String(i + 1).padStart(2, '0')}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-8 text-[clamp(26px,2.6vw,38px)] font-bold tabular-nums tracking-[-0.02em] text-[var(--c-blue)]">{price(p.price.value)}</p>

            <div className="mt-10 border-t border-[var(--c-blue)]">
              <Fold title="정보">
                {size && <p>크기 {size}</p>}
                {materialText && <p className={size ? 'mt-2' : ''}>소재 {materialText}</p>}
                {care && <p className="mt-2">{care}</p>}
                {shipping && <p className="mt-2">배송 {shipping}</p>}
                <p className="mt-2">교환 · 반품은 라기 공식 스마트스토어 기준을 따릅니다.</p>
              </Fold>
            </div>

            <div className="mt-6 flex items-center justify-between gap-4">
              <p className="t-caption kr text-[var(--c-blue)]">수량</p>
              <div className="inline-flex items-center border border-[var(--c-blue)] text-[var(--c-blue)]">
                <button type="button" className="h-10 w-10 hover:bg-[var(--c-blue)] hover:text-white" aria-label="수량 줄이기" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                  −
                </button>
                <span className="t-value w-9 text-center tabular-nums" aria-live="polite">
                  {qty}
                </span>
                <button type="button" className="h-10 w-10 hover:bg-[var(--c-blue)] hover:text-white" aria-label="수량 늘리기" onClick={() => setQty((q) => Math.min(20, q + 1))}>
                  +
                </button>
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between border-t border-[var(--c-blue)] pt-3 text-[var(--c-blue)]">
              <p className="t-caption kr">총 금액</p>
              <p className="kr text-[20px] font-bold tabular-nums" data-testid="total">
                {price((p.price.value ?? 0) * qty)}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              {!onStore ? (
                <button type="button" className="btn btn-line col-span-2 cursor-not-allowed opacity-60" disabled data-testid="not-for-sale">
                  구매 준비 중
                </button>
              ) : (
                <>
                  {online ? (
                    <button type="button" className="btn btn-primary" {...buyNow}>
                      바로 구매
                    </button>
                  ) : (
                    <a className="btn btn-primary" data-testid="buy-now-store" {...buyNow}>
                      바로 구매 ↗
                    </a>
                  )}
                  <button type="button" className="btn btn-line" onClick={() => addToCart()}>
                    {added ? '담았습니다 ✓' : '장바구니'}
                  </button>
                </>
              )}
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
            <div className="t-caption kr mt-3 flex flex-wrap items-center justify-between gap-2 text-[var(--c-blue)]">
              {onStore ? (
                <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="hit underline underline-offset-4">
                  스마트스토어에서 구매 ↗
                </a>
              ) : (
                <span>온라인 판매를 준비하고 있어요.</span>
              )}
              {added && (
                <Link to="/cart" className="font-semibold underline underline-offset-4">
                  장바구니 보기 →
                </Link>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* 2 · Big statement (the reference's closing line), made for LAGI */}
      <section className="mt-[var(--section)] text-[var(--c-blue)]" aria-label="LAGI">
        <p className="t-mark text-[clamp(40px,8.4vw,150px)] font-medium uppercase leading-[0.95] tracking-[-0.01em]">
          Wear it
          <br />
          again.
        </p>
        <p className="t-label t-mark mt-6 flex justify-between border-t border-[var(--c-blue)] pt-3">
          <span>LAGI</span>
          <span>(2)</span>
        </p>
      </section>

      {/* 3 · Tabs */}
      <div className="sticky top-16 z-20 mt-[calc(var(--section)/2)] border-b border-[var(--c-blue)] bg-white lg:top-14" role="tablist" aria-label="제품 정보">
        <div className="grid grid-cols-3">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`t-caption kr relative py-4 font-semibold transition-colors ${tab === t.key ? 'text-[var(--c-blue)]' : 'text-[var(--c-mute)] hover:text-[var(--c-blue)]'}`}
              data-testid={`tab-${t.key}`}
            >
              {t.label}
              <span aria-hidden="true" className={`absolute inset-x-0 -bottom-px h-[3px] bg-[var(--c-blue)] transition-transform duration-300 ${tab === t.key ? 'scale-x-100' : 'scale-x-0'}`} />
            </button>
          ))}
        </div>
      </div>

      {tab === 'detail' && (
        <div role="tabpanel" aria-label="상세정보">
          {isClothing(p) && hero ? (
            // Clothing: a mosaic of close-ups cut from the real photo (the same pixels, never generated), like a lookbook page.
            <section className="mt-[var(--section)]" aria-label="디테일" data-testid="detail-mosaic">
              <div className="grid grid-cols-6 gap-3 md:gap-5">
                {[
                  { y: 6, x: 50, zoom: 2.2, span: 'col-span-6 md:col-span-3', ratio: 'aspect-[4/3]' },
                  { y: 55, x: 50, zoom: 2.4, span: 'col-span-3 md:col-span-3', ratio: 'aspect-[4/5] md:aspect-[4/3]' },
                  { y: 96, x: 50, zoom: 2.2, span: 'col-span-3 md:col-span-2', ratio: 'aspect-[4/5]' },
                  { y: 32, x: 50, zoom: 2.0, span: 'col-span-6 md:col-span-4', ratio: 'aspect-[16/9]' },
                ].map((c, i) => (
                  <figure key={i} className={c.span}>
                    <div
                      className={`${c.ratio} w-full bg-[var(--c-gray)] bg-no-repeat`}
                      style={{ backgroundImage: `url(${largeCopy(hero)})`, backgroundSize: `${c.zoom * 100}%`, backgroundPosition: `${c.x}% ${c.y}%` }}
                      role="img"
                      aria-label={`${p.name.value ?? ''} 디테일 ${i + 1}`}
                    />
                    <figcaption className="t-label t-mark mt-1.5 text-[var(--c-blue)]">{String(i + 1).padStart(2, '0')}</figcaption>
                  </figure>
                ))}
              </div>
            </section>
          ) : (
            (p.views || p.drawings?.length) && hero && <ProductViews src={hero} name={p.name.value ?? ''} product={p} />
          )}

          {!!p.styledImages?.length && (
            <section className="mt-[var(--section)]" aria-label="착용 연출 (AI 이미지)">
              <div className="grid grid-cols-1 items-start gap-[var(--gap)] md:grid-cols-3">
                {p.styledImages.map((src) => (
                  <figure key={src} className="relative overflow-hidden bg-[var(--c-gray)]" data-testid="styled-image">
                    <img {...responsive(src, '(max-width: 767px) 100vw, 50vw')} src={src} alt={`AI 연출 이미지 — ${p.name.value ?? '제품'} 착용 모습`} loading="lazy" className="block h-auto w-full" />
                    <figcaption className="t-label kr absolute left-2 top-2 rounded-full bg-[var(--c-ink)] px-2.5 py-1 text-[var(--c-white)]">AI 연출 이미지 · 실제와 다를 수 있음</figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}

          {maker && <p className="t-caption kr mt-[var(--section)] text-center text-[var(--c-mute)]">협업 브랜드 {maker} · 제품은 제작사가 만들고, 라기는 발견하고 선별해 소개합니다.</p>}
        </div>
      )}

      {tab === 'review' && (
        <div role="tabpanel" aria-label="구매평" className="mx-auto mt-12 max-w-3xl">
          <Reviews productId={p.id} onCount={onCount} />
        </div>
      )}

      {tab === 'qna' && (
        <div role="tabpanel" aria-label="Q&A" className="mx-auto mt-12 max-w-3xl" data-testid="qna">
          <div className="grid grid-cols-1 gap-[var(--gap)] sm:grid-cols-2">
            <a href={OFFICIAL_LINKS.instagram} target="_blank" rel="noopener noreferrer" className="rounded-[var(--radius-card)] border border-black/15 p-6 text-center transition-colors hover:border-[var(--c-ink)]">
              <p className="t-value kr">인스타그램 DM ↗</p>
            </a>
            {onStore && (
              <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="rounded-[var(--radius-card)] border border-black/15 p-6 text-center transition-colors hover:border-[var(--c-ink)]">
                <p className="t-value kr">스마트스토어 Q&A ↗</p>
              </a>
            )}
          </div>
        </div>
      )}

      {/* 3 · Other products */}
      {related.length > 0 && (
        <section className="mt-[var(--section)]" aria-label="More">
          <p className="t-label t-mark mb-6 flex justify-between border-t border-[var(--c-blue)] pt-3 text-[var(--c-blue)]"><span>MORE</span><span>(3)</span></p>
          <ul className="grid grid-cols-2 gap-x-[var(--gap)] gap-y-16 md:grid-cols-4">
            {related.map((o) => (
              <li key={o.id}>
                <ProductCard p={o} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Mobile buy bar */}
      <MobileBuyBar>
        <span className="min-w-0 flex-1">
          <span className="t-caption kr block truncate text-[var(--c-mute)]">{p.name.value}</span>
          <span className="t-value kr block tabular-nums">{price(p.price.value)}</span>
        </span>
        {!onStore ? (
          <button type="button" className="btn btn-line !min-h-[44px] cursor-not-allowed opacity-60" disabled data-testid="bar-not-for-sale">
            구매 준비 중
          </button>
        ) : (
          <>
        <button type="button" className="btn btn-line !min-h-[44px] !px-4" onClick={() => addToCart()} aria-label="장바구니 담기">
            {added ? '✓' : '담기'}
          </button>
          {online ? (
            <button type="button" className="btn btn-primary !min-h-[44px]" {...buyNow}>
              바로 구매
            </button>
          ) : (
            <a className="btn btn-primary !min-h-[44px]" data-testid="bar-buy-now-store" {...buyNow}>
              바로 구매 ↗
            </a>
          )}
          </>
        )}
      </MobileBuyBar>
    </article>
  );
}
