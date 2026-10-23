import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCart } from '@/commerce/CartContext';
import { aiTryOnEnabled } from '@/tryon/aiTryOn';
import { shippingLabel } from '@/utils/shipping';
import { WHY_LAGI, WHY_LAGI_RULE } from '@/content/whyLagi';
import { CATEGORY_KO, OFFICIAL_LINKS, price, useImageRatios, useRealProducts } from '../data';

/**
 * Product detail (reference: Project Detail). Shows only checked facts — name, price, one-line
 * description, size, shipping, brand line — plus the official selection criteria. Unverified
 * drafts (long description, materials, story) are deliberately left out.
 */
export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const { products, loading } = useRealProducts();
  const ratios = useImageRatios(products);
  const navigate = useNavigate();
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const index = products.findIndex((p) => p.id === id);
  const p = products[index];
  if (loading) return <p className="t-label px-page pt-page">불러오는 중</p>;
  if (!p)
    return (
      <div className="px-page pb-32 pt-page">
        <h1 className="t-display">제품을 찾을 수 없어요</h1>
        <Link to="/discover" className="t-nav tag tag-ink mt-10">
          디스커버로
        </Link>
      </div>
    );
  const next = products[(index + 1) % products.length];
  const d = p.dimensions;
  const size = d.widthCm ? `${d.widthCm} × ${d.heightCm ?? '—'} × ${d.depthCm ?? '—'} cm` : null;
  const brandLine = p.brandLabel ?? 'LAGI';

  const meta: [string, string | null][] = [
    ['가격', price(p.price.value)],
    ['크기 (가로·높이·폭)', size],
    ['배송', p.shipping ? shippingLabel(p.shipping) : null],
    ['분류 · 브랜드', `${CATEGORY_KO[p.category.value ?? ''] ?? p.category.value ?? ''} · ${brandLine}`],
  ];

  function addToCart(go?: boolean) {
    add({ productId: p.id, variantId: null, size: null, color: null, quantity: qty, unitPrice: p.price.value, name: p.name.value, image: p.images[0] ?? null });
    setAdded(true);
    if (go) navigate('/cart');
  }

  return (
    <article className="px-page pb-24 pt-page">
      <h1 className="t-display">{p.name.value}</h1>
      {p.shortDescription.value && <p className="t-h1 mt-3 max-w-[22ch] lg:max-w-none">{p.shortDescription.value}</p>}

      <dl className="rule mt-14 grid grid-cols-2 gap-x-[var(--gap)] gap-y-6 pt-4 md:grid-cols-4 lg:mt-24">
        {meta.map(([k, v]) =>
          v ? (
            <div key={k}>
              <dt className="t-label text-[var(--c-mute)]">{k}</dt>
              <dd className="t-value mt-2">{v}</dd>
            </div>
          ) : null,
        )}
      </dl>

      <div className="mt-14 grid grid-cols-1 gap-[var(--gap)] md:grid-cols-2 lg:mt-20">
        <div className="space-y-[var(--gap)]">
          {[...p.images, ...p.gallery].map((src, i) => (
            <img
              key={src}
              src={src}
              alt={i === 0 ? p.name.value ?? '' : ''}
              className="block w-full rounded-[var(--radius-card)] bg-[var(--c-gray)] object-cover"
              style={{ aspectRatio: i === 0 ? ratios[p.id] ?? 1 : undefined }}
            />
          ))}
        </div>

        <div className="md:sticky md:top-24 md:self-start">
          <div className="rule-1 pt-4">
            <p className="t-label text-[var(--c-mute)]">수량</p>
            <div className="t-value mt-2 inline-flex items-center gap-1">
              <button type="button" className="tag" aria-label="수량 줄이기" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                −
              </button>
              <span className="w-10 text-center tabular-nums" aria-live="polite">
                {qty}
              </span>
              <button type="button" className="tag" aria-label="수량 늘리기" onClick={() => setQty((q) => q + 1)}>
                +
              </button>
            </div>
          </div>
          <div className="t-nav mt-8 flex flex-wrap gap-2">
            <button type="button" className="tag tag-ink px-4 py-3" onClick={() => addToCart(true)}>
              구매하기
            </button>
            <button type="button" className="tag bg-[var(--c-label)] px-4 py-3" onClick={() => addToCart()}>
              {added ? '장바구니에 담았어요' : '장바구니 담기'}
            </button>
            {aiTryOnEnabled(p) && (
              <Link to={`/ai-fit/${p.id}`} className="tag bg-[var(--c-label)] px-4 py-3">
                AI로 입어보기
              </Link>
            )}
          </div>
          <p className="t-caption mt-5 max-w-sm text-[var(--c-mute)]">
            결제와 배송은 라기 공식{' '}
            <a href={p.shopUrl.value ?? OFFICIAL_LINKS.store} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              스마트스토어
            </a>
            에서 진행됩니다.
          </p>

          <section className="rule mt-14 pt-4" aria-labelledby="why-title">
            <h2 id="why-title" className="t-label text-[var(--c-mute)]">
              라기 선정 기준
            </h2>
            <ol className="mt-4 space-y-4">
              {WHY_LAGI.map((c, i) => (
                <li key={c.key} className="grid grid-cols-[2.5rem_1fr] gap-2">
                  <span className="t-value tabular-nums text-[var(--c-blue)]">{String(i + 1).padStart(2, '0')}</span>
                  <span>
                    <span className="t-value block">{c.key}</span>
                    <span className="t-caption mt-1 block text-[var(--c-mute)]">{c.question}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="t-caption mt-5">{WHY_LAGI_RULE}</p>
          </section>
        </div>
      </div>

      {next && next.id !== p.id && (
        <Link to={`/product/${next.id}`} className="t-display mt-28 block hover:text-[var(--c-blue)] lg:mt-40">
          다음 제품 ›<span className="t-h3 mt-3 block text-[var(--c-mute)]">{next.name.value}</span>
        </Link>
      )}
    </article>
  );
}
