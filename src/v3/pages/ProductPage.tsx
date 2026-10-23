import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCart } from '@/commerce/CartContext';
import { aiTryOnEnabled } from '@/tryon/aiTryOn';
import { WHY_LAGI, WHY_LAGI_RULE_EN } from '@/content/whyLagi';
import { PRODUCT_DETAILS } from '@/content/productDetails';
import { CATEGORY_LABEL, OFFICIAL_LINKS, price, shippingText, useImageRatios, useRealProducts } from '../data';

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
 * Product detail (reference: Project Detail). Shows only checked facts — name, price, one-line
 * description, size, shipping, brand line — plus the English detail copy and the official
 * selection criteria.
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
  if (loading) return <p className="t-label px-page pt-page">Loading…</p>;
  if (!p)
    return (
      <div className="px-page pb-32 pt-page">
        <h1 className="t-display">Product not found</h1>
        <Link to="/discover" className="t-nav tag tag-ink mt-10">
          Back to Discover
        </Link>
      </div>
    );
  const next = products[(index + 1) % products.length];
  const d = p.dimensions;
  const size = d.widthCm ? `${d.widthCm} × ${d.heightCm ?? '—'} × ${d.depthCm ?? '—'} cm` : null;
  const brandLine = p.brandLabel ?? 'LAGI';
  const detail = PRODUCT_DETAILS[p.id];
  const catKey = p.category.value ?? '';
  const category = CATEGORY_LABEL[catKey] ?? catKey;
  const hero = p.images[0];
  const ratio = ratios[p.id] ?? 1;
  const more = [...p.images.slice(1), ...p.gallery];
  const related = [
    ...products.filter((o) => o.id !== p.id && o.category.value === p.category.value),
    ...products.filter((o) => o.id !== p.id && o.category.value !== p.category.value),
  ]
    .filter((o) => o.id !== next?.id)
    .slice(0, 3);

  const meta: [string, string | null][] = [
    ['Price', price(p.price.value)],
    ['Size (W × H × D)', size],
    ['Shipping', p.shipping ? shippingText(p.shipping) : null],
    ['Category · Brand', `${category} · ${brandLine}`],
  ];
  const specs = (
    [
      ['Material', detail?.material ?? null],
      ['Use', detail?.use ?? null],
      ['Size (W × H × D)', size],
      ['Made with', brandLine.includes('×') ? brandLine.split('×')[1].trim() : null],
      ['Category', category || null],
    ] as [string, string | null][]
  ).filter(([, v]) => v);

  function addToCart(go?: boolean) {
    add({ productId: p.id, variantId: null, size: null, color: null, quantity: qty, unitPrice: p.price.value, name: p.name.value, image: hero ?? null });
    setAdded(true);
    if (go) navigate('/cart');
  }

  return (
    <article className="pb-32 pt-page md:pb-24" data-arrived={arrived || undefined}>
      {/* Index line */}
      <div className="t-label flex items-center justify-between px-page text-[var(--c-mute)]">
        <nav aria-label="Breadcrumb" className="flex gap-2">
          <Link to="/discover" className="hover:text-[var(--c-ink)]">
            Discover
          </Link>
          <span aria-hidden="true">/</span>
          {category ? (
            <Link to={`/discover?c=${encodeURIComponent(catKey)}`} className="hover:text-[var(--c-ink)]">
              {category}
            </Link>
          ) : null}
        </nav>
        <span className="tabular-nums" data-testid="product-index">
          {pad(index + 1)} / {pad(products.length)}
        </span>
      </div>

      {/* Title block */}
      <header className="mt-6 grid grid-cols-1 gap-x-[var(--gap)] gap-y-4 px-page lg:mt-10 lg:grid-cols-12 lg:items-end">
        <h1 className="t-display lg:col-span-8">{p.name.value}</h1>
        {p.shortDescription.value && <p className="t-lead text-[var(--c-mute)] lg:col-span-4 lg:pb-2">{p.shortDescription.value}</p>}
      </header>

      {/* Hero — the zoomed gallery card lands here */}
      {hero && (
        <figure className="mt-10 px-page lg:mt-14">
          <div className="relative flex items-center justify-center overflow-hidden rounded-[var(--radius-card)] bg-[var(--c-gray)] px-6 py-10 md:py-14 lg:min-h-[78svh] lg:py-16">
            <img
              src={hero}
              alt={p.name.value ?? ''}
              data-testid="product-hero"
              className={`block h-auto w-full max-w-[560px] object-cover lg:max-h-[66svh] lg:w-auto lg:max-w-full ${arrived ? 'arrive' : 'rise'}`}
              style={{ aspectRatio: ratio }}
            />
            <span className="t-label absolute bottom-4 left-5 text-[var(--c-mute)]">{brandLine}</span>
            <span className="t-label absolute bottom-4 right-5 tabular-nums text-[var(--c-mute)]">{pad(index + 1)}</span>
          </div>
        </figure>
      )}

      {/* Facts */}
      <dl className="rule mx-[var(--page-x)] mt-10 grid grid-cols-2 gap-x-[var(--gap)] gap-y-6 pt-4 md:grid-cols-4">
        {meta.map(([k, v]) =>
          v ? (
            <div key={k}>
              <dt className="t-label text-[var(--c-mute)]">{k}</dt>
              <dd className="t-value mt-2">{v}</dd>
            </div>
          ) : null,
        )}
      </dl>

      {/* Story + purchase */}
      <div className="mt-20 grid grid-cols-1 gap-x-[var(--gap)] gap-y-14 px-page md:grid-cols-12 lg:mt-32">
        <section className="md:col-span-7" aria-labelledby="details-title">
          <h2 id="details-title" className="t-label text-[var(--c-mute)]">
            DETAILS
          </h2>
          {detail ? (
            <div className="mt-6 space-y-6">
              {detail.overview.map((t, i) => (
                <p key={t} className={i === 0 ? 't-h3 !font-normal leading-snug' : 't-body max-w-[60ch]'}>
                  {t}
                </p>
              ))}
            </div>
          ) : (
            <p className="t-body mt-6 text-[var(--c-mute)]">Full details are on the official store page.</p>
          )}
          <dl className="mt-12">
            {specs.map(([k, v]) => (
              <div key={k} className="rule-1 grid grid-cols-[9rem_1fr] gap-6 py-3 md:grid-cols-[12rem_1fr]">
                <dt className="t-label text-[var(--c-mute)]">{k}</dt>
                <dd className="t-value">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <aside className="md:col-span-5 md:col-start-8 lg:col-span-4 lg:col-start-9" aria-label="Purchase">
          <div className="rounded-[var(--radius-card)] bg-[var(--c-gray)] p-5 md:sticky md:top-24 lg:p-7">
            <p className="t-label text-[var(--c-mute)]">Price</p>
            <p className="t-h2 mt-1 tabular-nums">{price(p.price.value)}</p>
            {p.shipping && <p className="t-caption mt-2 text-[var(--c-mute)]">{shippingText(p.shipping)}</p>}

            <div className="rule-1 mt-6 flex items-center justify-between pt-4">
              <p className="t-label text-[var(--c-mute)]">Quantity</p>
              <div className="t-value inline-flex items-center gap-1">
                <button type="button" className="tag bg-[var(--c-white)]" aria-label="Decrease quantity" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                  −
                </button>
                <span className="w-10 text-center tabular-nums" aria-live="polite">
                  {qty}
                </span>
                <button type="button" className="tag bg-[var(--c-white)]" aria-label="Increase quantity" onClick={() => setQty((q) => q + 1)}>
                  +
                </button>
              </div>
            </div>

            <div className="t-nav mt-6 grid gap-2">
              <button type="button" className="tag tag-ink w-full px-4 py-3.5 text-center" onClick={() => addToCart(true)}>
                Buy now
              </button>
              <button type="button" className="tag w-full bg-[var(--c-white)] px-4 py-3.5 text-center" onClick={() => addToCart()}>
                {added ? 'Added to cart' : 'Add to cart'}
              </button>
              {aiTryOnEnabled(p) && (
                <Link to={`/ai-fit/${p.id}`} className="tag w-full border border-[var(--c-ink)] px-4 py-3.5 text-center">
                  Try on with AI
                </Link>
              )}
            </div>
            <p className="t-caption mt-5 text-[var(--c-mute)]">
              Payment and delivery are handled by LAGI's official{' '}
              <a href={p.shopUrl.value ?? OFFICIAL_LINKS.store} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                Naver Smart Store
              </a>
              .
            </p>
          </div>
        </aside>
      </div>

      {/* Look closer */}
      {hero && (
        <section className="mt-24 px-page lg:mt-40" aria-labelledby="closer-title">
          <div className="rule flex items-baseline justify-between pt-4">
            <h2 id="closer-title" className="t-label">
              LOOK CLOSER
            </h2>
            <span className="t-label text-[var(--c-mute)]">Crops from the product photo</span>
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
                <p className="t-label mt-3 text-[var(--c-mute)]">CROP {pad(i + 1)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Other photos at their own ratio */}
      {more.length > 0 && (
        <section className="mt-16 grid grid-cols-1 gap-[var(--gap)] px-page md:grid-cols-2" aria-label="More photos">
          {more.map((src) => (
            <img key={src} src={src} alt="" loading="lazy" className="block w-full rounded-[var(--radius-card)] bg-[var(--c-gray)]" />
          ))}
        </section>
      )}

      {/* Selection criteria */}
      <section className="mt-24 bg-[var(--c-ink)] px-page py-14 text-[var(--c-white)] lg:mt-40 lg:py-20" aria-labelledby="why-title">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 id="why-title" className="t-h2">
            Why LAGI chose it
          </h2>
          <Link to="/why" className="t-nav tag bg-[var(--c-white)] text-[var(--c-ink)]">
            Why LAGI
          </Link>
        </div>
        <ol className="mt-10 grid grid-cols-1 gap-x-[var(--gap)] gap-y-8 md:grid-cols-2 lg:grid-cols-4">
          {WHY_LAGI.map((c, i) => (
            <li key={c.key} className="border-t border-white/30 pt-4">
              <span className="t-value tabular-nums text-white/60">{pad(i + 1)}</span>
              <span className="t-h3 mt-3 block">{c.key}</span>
              <span className="t-caption mt-3 block text-white/75">{c.question}</span>
            </li>
          ))}
        </ol>
        <p className="t-caption mt-10 text-white/75">{WHY_LAGI_RULE_EN}</p>
      </section>

      {/* More from LAGI */}
      {related.length > 0 && (
        <section className="mt-24 px-page lg:mt-36" aria-labelledby="more-title">
          <div className="rule flex items-baseline justify-between pt-4">
            <h2 id="more-title" className="t-label">
              MORE FROM LAGI
            </h2>
            <Link to="/discover" className="t-label text-[var(--c-mute)] hover:text-[var(--c-ink)]">
              View all
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
                    <span className="t-value">{o.name.value}</span>
                    <span className="t-label shrink-0 tabular-nums text-[var(--c-mute)]">{price(o.price.value)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Next */}
      {next && next.id !== p.id && (
        <Link to={`/product/${next.id}`} className="group rule mx-[var(--page-x)] mt-24 grid grid-cols-[1fr_auto] items-end gap-6 pt-4 lg:mt-36">
          <span>
            <span className="t-label block text-[var(--c-mute)]">Next · {pad(((index + 1) % products.length) + 1)}</span>
            <span className="t-display mt-4 block transition-colors group-hover:text-[var(--c-blue)]">Next ›</span>
            <span className="t-h3 mt-2 block text-[var(--c-mute)]">{next.name.value}</span>
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
          <span className="t-label block truncate text-[var(--c-mute)]">{p.name.value}</span>
          <span className="t-value block tabular-nums">{price(p.price.value)}</span>
        </span>
        <button type="button" className="t-nav tag tag-ink shrink-0 px-5 py-3" onClick={() => addToCart(true)}>
          Buy now
        </button>
      </div>
    </article>
  );
}
