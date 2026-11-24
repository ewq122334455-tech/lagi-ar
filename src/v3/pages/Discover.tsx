import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CATEGORY_LABEL, useRealProducts } from '../data';
import { ProductCard } from '../ProductCard';

/** The shop: every product as a card (clean front view, real photo on hover), a lot of air between them. Filter by ?c=. */
export default function Discover() {
  const { products, loading, error } = useRealProducts();
  const [params, setParams] = useSearchParams();
  const active = params.get('c');
  const categories = useMemo(() => [...new Set(products.map((p) => p.category.value).filter(Boolean))] as string[], [products]);
  const list = useMemo(() => {
    const l = active ? products.filter((p) => p.category.value === active) : [...products];
    return l;
  }, [products, active]);

  return (
    <div className="px-page pb-[var(--section)] pt-page">
      <h1 className="sr-only">Shop</h1>

      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="분류">
        {[null, ...categories].map((c) => (
          <button key={c ?? 'all'} type="button" onClick={() => setParams(c ? { c } : {})} aria-pressed={active === c} className="chip">
            {c ? CATEGORY_LABEL[c] ?? c : '전체'}
          </button>
        ))}
      </div>

      {loading && <p className="t-caption kr mt-20">불러오는 중…</p>}
      {error && <p className="t-caption kr mt-20">{error}</p>}

      <ul className="mt-20 grid grid-cols-2 gap-x-[var(--gap)] gap-y-14 lg:mt-24 lg:grid-cols-3 lg:gap-y-24" data-testid="shop-grid">
        {list.map((p, i) => (
          <li key={p.id}>
            <ProductCard p={p} eager={i < 8} />
          </li>
        ))}
      </ul>
    </div>
  );
}
