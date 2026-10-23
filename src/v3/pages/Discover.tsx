import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CATEGORY_LABEL, price, useImageRatios, useRealProducts } from '../data';

/** All products on sale, as an editorial grid (reference: Projects). Filter by category via ?c=. */
export default function Discover() {
  const { products, loading, error } = useRealProducts();
  const ratios = useImageRatios(products);
  const [params, setParams] = useSearchParams();
  const active = params.get('c');
  const categories = useMemo(() => [...new Set(products.map((p) => p.category.value).filter(Boolean))] as string[], [products]);
  const list = active ? products.filter((p) => p.category.value === active) : products;

  return (
    <div className="px-page pb-32 pt-page">
      <div className="flex flex-wrap items-start justify-between gap-8">
        <h1 className="t-display">DISCOVER</h1>
        <div className="flex gap-6">
          <p className="t-value">Category</p>
          <ul className="t-value">
            {[null, ...categories].map((c) => (
              <li key={c ?? 'all'}>
                <button
                  type="button"
                  onClick={() => setParams(c ? { c } : {})}
                  aria-pressed={active === c}
                  className={active === c ? 'text-[var(--c-ink)]' : 'text-[var(--c-mute)] hover:text-[var(--c-ink)]'}
                >
                  {c ? CATEGORY_LABEL[c] ?? c : 'All'} <span className="tabular-nums">{c ? products.filter((p) => p.category.value === c).length : products.length}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {loading && <p className="t-label mt-20">Loading…</p>}
      {error && <p className="t-label mt-20">{error}</p>}

      <ul className="mt-20 grid grid-cols-1 gap-x-[var(--gap)] gap-y-14 md:grid-cols-2 lg:mt-28 lg:grid-cols-3">
        {list.map((p) => (
          <li key={p.id}>
            <Link to={`/product/${p.id}`} className="group block">
              <span className="block overflow-hidden rounded-[var(--radius-card)] bg-[var(--c-gray)]">
                <img
                  src={p.images[0]}
                  alt={p.name.value ?? ''}
                  loading="lazy"
                  className="block w-full object-cover transition-transform duration-[900ms] ease-[cubic-bezier(.2,.7,.2,1)] group-hover:scale-[1.03]"
                  style={{ aspectRatio: ratios[p.id] ?? 1 }}
                />
              </span>
              <span className="rule-1 mt-3 flex items-baseline justify-between gap-4 pt-2">
                <span className="t-body">{p.name.value}</span>
                <span className="t-label shrink-0 tabular-nums text-[var(--c-mute)]">{price(p.price.value)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
