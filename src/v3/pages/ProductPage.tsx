import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCart } from '@/commerce/CartContext';
import { aiTryOnEnabled } from '@/tryon/aiTryOn';
import { WHY_LAGI, WHY_LAGI_RULE } from '@/content/whyLagi';
import { Point } from '../Point';
import { CATEGORY_LABEL, OFFICIAL_LINKS, makerOf, price, shippingText, useImageRatios, useRealProducts } from '../data';

/** Close-up crops of the main photo: a uniform zoom around a focal point, never stretched. */
const CROPS = [
  { x: 45, y: 50, zoom: 1.7 },
  { x: 38, y: 62, zoom: 2.6 },
  { x: 62, y: 45, zoom: 2.3 },
];

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
 * Product detail. Only checked facts are shown — name, price, the store's one-line description,
 * category, maker, size and shipping. Draft copy (long description, materials, process, story,
 * selection reason) is held back until the brand confirms it; sections without facts are left out.
 */
export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const { products, loading } = useRealProducts();
  const ratios = useImageRatios(products);
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
        <Link to="/discover" className="t-nav tag tag-ink kr mt-10">
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
  const ratio = ratios[p.id] ?? 1;
  const more = [...p.images.slice(1), ...p.gallery];
  const storeUrl = p.shopUrl.value ?? OFFICIAL_LINKS.store;
  const related = [
    ...products.filter((o) => o.id !== p.id && o.category.value === p.category.value),
    ...products.filter((o) => o.id !== p.id && o.category.value !== p.category.value),
  ]
    .filter((o) => o.id !== next?.id)
    .slice(0, 3);

  const facts = (
    [
      ['가격', price(p.price.value)],
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
    <article className="pb-32 pt-page md:pb-24" data-arrived={arrived || undefined}>
      <div className="t-caption kr flex items-center justify-between px-page text-[var(--c-mute)]">
        <nav aria-label="현재 위치" className="flex gap-2">
          <Link to="/discover" className="hover:text-[var(--c-ink)]">
            제품
          </Link>
          <span aria-hidden="true">/</span>
          {category && (
            <Link to={`/discover?c=${encodeURIComponent(catKey)}`} className="hover:text-[var(--c-ink)]">
              {category}
            </Link>
          )}
        </nav>
        <span className="t-mark tabular-nums" data-testid="product-index">
          {pad(index + 1)} / {pad(products.length)}
        </span>
      </div>

      {/* 1 · Main photo */}
      {hero && (
        <figure className="mt-6 px-page">
          <div className="relative flex items-center justify-center overflow-hidden rounded-[var(--radius-card)] bg-[var(--c-gray)] px-6 py-10 md:py-14 lg:min-h-[74svh] lg:py-16">
            <img
              src={hero}
              alt={p.name.value ?? ''}
              data-testid="product-hero"
              className={`block h-auto w-full max-w-[560px] object-cover lg:max-h-[62svh] lg:w-auto lg:max-w-full ${arrived ? 'arrive' : 'rise'}`}
              style={{ aspectRatio: ratio }}
            />
            {p.brandLabel && <span className="t-label t-mark absolute bottom-4 left-5 text-[var(--c-mute)]">{p.brandLabel}</span>}
          </div>
        </figure>
      )}

      {/* 2 · Name, price, buying */}
      <div className="mt-12 grid grid-cols-1 gap-x-[var(--gap)] gap-y-12 px-page md:grid-cols-12 lg:mt-16">
        <header className="md:col-span-7">
          <h1 className="t-h1 kr !font-bold">{p.name.value}</h1>
          {p.shortDescription.value && <p className="t-lead kr mt-3 text-[var(--c-mute)]">{p.shortDescription.value}</p>}
          <dl className="mt-10">
            {facts.map(([k, v]) => (
              <div key={k} className="rule-1 grid grid-cols-[9rem_1fr] gap-6 py-3 md:grid-cols-[12rem_1fr]">
                <dt className="t-caption kr text-[var(--c-mute)]">{k}</dt>
                <dd className="t-value kr">{v}</dd>
              </div>
            ))}
          </dl>
        </header>

        <aside className="md:col-span-5 lg:col-span-4 lg:col-start-9" aria-label="구매">
          <div className="rounded-[var(--radius-card)] bg-[var(--c-gray)] p-5 md:sticky md:top-24 lg:p-7">
            <p className="t-caption kr text-[var(--c-mute)]">가격</p>
            <p className="t-h2 kr mt-1 tabular-nums">{price(p.price.value)}</p>
            {p.shipping && <p className="t-caption kr mt-2 text-[var(--c-mute)]">{shippingText(p.shipping)}</p>}

            <div className="rule-1 mt-6 flex items-center justify-between pt-4">
              <p className="t-caption kr text-[var(--c-mute)]">수량</p>
              <div className="t-value inline-flex items-center gap-1">
                <button type="button" className="tag bg-[var(--c-white)] px-3" aria-label="수량 줄이기" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                  −
                </button>
                <span className="w-10 text-center tabular-nums" aria-live="polite">
                  {qty}
                </span>
                <button type="button" className="tag bg-[var(--c-white)] px-3" aria-label="수량 늘리기" onClick={() => setQty((q) => Math.min(20, q + 1))}>
                  +
                </button>
              </div>
            </div>

            <div className="t-nav kr mt-6 grid gap-2">
              <button type="button" className="tag tag-ink w-full px-4 py-3.5 text-center" onClick={() => addToCart(true)}>
                바로 구매
              </button>
              <button type="button" className="tag w-full bg-[var(--c-white)] px-4 py-3.5 text-center" onClick={() => addToCart()}>
                {added ? '장바구니에 담았습니다' : '장바구니 담기'}
              </button>
              <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="tag w-full border border-[var(--c-ink)] px-4 py-3.5 text-center">
                스마트스토어에서 구매
              </a>
            </div>
            {added && (
              <Link to="/cart" className="t-caption kr mt-3 block underline underline-offset-2">
                장바구니 보기
              </Link>
            )}
          </div>
        </aside>
      </div>

      {/* 3 · Detail photos */}
      {hero && (
        <section className="mt-24 px-page lg:mt-36" aria-labelledby="closer-title">
          <div className="rule flex flex-wrap items-baseline justify-between gap-2 pt-4">
            <h2 id="closer-title" className="t-label t-mark">
              Detail
            </h2>
            <span className="t-caption kr text-[var(--c-mute)]">제품 사진의 일부를 확대했습니다</span>
          </div>
          <ul className="mt-6 grid grid-cols-1 gap-[var(--gap)] sm:grid-cols-3">
            {CROPS.map((c, i) => (
              <li key={i}>
                <div className="aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] bg-[var(--c-gray)]">
                  <img
                    src={hero}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                    style={{ objectPosition: `${c.x}% ${c.y}%`, transform: `scale(${c.zoom})`, transformOrigin: `${c.x}% ${c.y}%` }}
                  />
                </div>
                <p className="t-label t-mark mt-3 text-[var(--c-mute)]">Crop {pad(i + 1)}</p>
              </li>
            ))}
          </ul>
          {more.length > 0 && (
            <div className="mt-[var(--gap)] grid grid-cols-1 gap-[var(--gap)] md:grid-cols-2">
              {more.map((src) => (
                <img key={src} src={src} alt="" loading="lazy" className="block w-full rounded-[var(--radius-card)] bg-[var(--c-gray)]" />
              ))}
            </div>
          )}
        </section>
      )}

      {/* 4–5 · Why LAGI selected this */}
      <section className="mt-24 bg-[var(--c-ink)] px-page py-14 text-[var(--c-white)] lg:mt-36 lg:py-20" aria-labelledby="why-title">
        <div className="grid grid-cols-1 gap-x-[var(--gap)] gap-y-4 lg:grid-cols-12">
          <h2 id="why-title" className="t-h2 t-mark lg:col-span-6">
            Why LAGI selected this?
          </h2>
          <p className="t-body kr text-white/75 lg:col-span-5 lg:col-start-8">
            라기의 모든 제품은 아래 네 가지 기준을 모두 충족해야 소개됩니다. 이 제품도 같은 기준으로 선정되었습니다.
          </p>
        </div>
        <ol className="mt-10 grid grid-cols-1 gap-x-[var(--gap)] gap-y-8 md:grid-cols-2 lg:grid-cols-4">
          {WHY_LAGI.map((c, i) => (
            <li key={c.key} className="border-t border-white/30 pt-4">
              <span className="t-label t-mark tabular-nums text-white/60">{pad(i + 1)}</span>
              <span className="t-h3 t-mark mt-3 flex items-center gap-2">
                <Point />
                {c.key}
              </span>
              <span className="t-body kr mt-3 block text-white/80">{c.question}</span>
            </li>
          ))}
        </ol>
        <p className="t-value kr mt-10">{WHY_LAGI_RULE}</p>
      </section>

      {/* 6 · Material & making — only what is confirmed */}
      {(p.shortDescription.value || maker) && (
        <section className="mt-24 grid grid-cols-1 gap-x-[var(--gap)] gap-y-6 px-page lg:mt-36 lg:grid-cols-12" aria-labelledby="made-title">
          <h2 id="made-title" className="t-label t-mark lg:col-span-3">
            Material & making
          </h2>
          <div className="lg:col-span-8 lg:col-start-5">
            {p.shortDescription.value && <p className="t-h3 kr !font-medium">{p.shortDescription.value}</p>}
            {maker && (
              <p className="t-body kr mt-4 text-[var(--c-mute)]">
                협업 브랜드 {maker}. 라기는 제품을 직접 제조하지 않고, 가치 있는 제품을 선별해 소개합니다.
              </p>
            )}
          </div>
        </section>
      )}

      {/* 7 · AI compositing */}
      {aiTryOnEnabled(p) && (
        <section className="mx-[var(--page-x)] mt-24 grid grid-cols-1 items-center gap-x-[var(--gap)] gap-y-6 rounded-[var(--radius-card)] bg-[var(--c-gray)] p-6 lg:mt-36 lg:grid-cols-12 lg:p-10">
          <div className="lg:col-span-8">
            <p className="t-label t-mark text-[var(--c-mute)]">Again experience</p>
            <p className="t-h3 kr mt-2">내 사진에 이 제품을 합성해 보세요.</p>
            <p className="t-caption kr mt-2 text-[var(--c-mute)]">AI가 만든 이미지입니다. 실제 크기와 색은 다를 수 있습니다.</p>
          </div>
          <Link to={`/again?p=${p.id}`} className="t-nav tag tag-ink kr justify-self-start px-5 py-3.5 lg:col-span-4 lg:justify-self-end">
            AI 이미지 합성
          </Link>
        </section>
      )}

      {/* 8 · Buying, once more at the end */}
      <section className="mt-24 px-page lg:mt-36" aria-label="구매 방법">
        <div className="rule grid grid-cols-1 gap-x-[var(--gap)] gap-y-6 pt-4 lg:grid-cols-12">
          <p className="t-label t-mark lg:col-span-3">Purchase</p>
          <div className="t-body kr lg:col-span-8 lg:col-start-5">
            <p>이 사이트에서 바로 주문하거나, 라기 공식 네이버 스마트스토어에서 구매할 수 있습니다.</p>
            <div className="t-nav mt-5 flex flex-wrap gap-2">
              <button type="button" className="tag tag-ink px-4 py-3" onClick={() => addToCart(true)}>
                바로 구매
              </button>
              <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="tag bg-[var(--c-label)] px-4 py-3">
                스마트스토어 ↗
              </a>
            </div>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="mt-24 px-page lg:mt-36" aria-labelledby="more-title">
          <div className="rule flex items-baseline justify-between pt-4">
            <h2 id="more-title" className="t-label t-mark">
              More from LAGI
            </h2>
            <Link to="/discover" className="t-caption kr text-[var(--c-mute)] hover:text-[var(--c-ink)]">
              전체 보기
            </Link>
          </div>
          <ul className="mt-6 grid grid-cols-1 gap-[var(--gap)] sm:grid-cols-2 lg:grid-cols-3">
            {related.map((o) => (
              <li key={o.id}>
                <Link to={`/product/${o.id}`} className="group block">
                  <div className="overflow-hidden rounded-[var(--radius-card)] bg-[var(--c-gray)]" style={{ aspectRatio: 0.877 }}>
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
            <span className="t-label t-mark block text-[var(--c-mute)]">Next · {pad(((index + 1) % products.length) + 1)}</span>
            <span className="t-display t-mark mt-4 block transition-colors group-hover:text-[var(--c-blue)]">Next ›</span>
            <span className="t-h3 kr mt-2 block text-[var(--c-mute)]">{next.name.value}</span>
          </span>
          {next.images[0] && (
            <span className="block w-24 overflow-hidden rounded-[var(--radius-card)] bg-[var(--c-gray)] sm:w-40 lg:w-56" style={{ aspectRatio: 0.877 }}>
              <img src={next.images[0]} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]" />
            </span>
          )}
        </Link>
      )}

      {/* Mobile buy bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-[var(--c-ink)] bg-[var(--c-white)] px-page py-3 md:hidden">
        <span className="min-w-0">
          <span className="t-caption kr block truncate text-[var(--c-mute)]">{p.name.value}</span>
          <span className="t-value kr block tabular-nums">{price(p.price.value)}</span>
        </span>
        <button type="button" className="t-nav tag tag-ink kr shrink-0 px-5 py-3" onClick={() => addToCart(true)}>
          바로 구매
        </button>
      </div>
    </article>
  );
}
