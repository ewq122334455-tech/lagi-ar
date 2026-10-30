import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CATEGORY_LABEL, useRealProducts } from '../data';
import { ProductCard } from '../ProductCard';

type Sort = 'default' | 'low' | 'high';

/** The shop: every product as a card (clean front view, real photo on hover). Filter by ?c=, sort by price. */
export default function Discover() {
  const { products, loading, error } = useRealProducts();
  const [params, setParams] = useSearchParams();
  const active = params.get('c');
  const [sort, setSort] = useState<Sort>('default');
  const categories = useMemo(() => [...new Set(products.map((p) => p.category.value).filter(Boolean))] as string[], [products]);
  const list = useMemo(() => {
    const l = active ? products.filter((p) => p.category.value === active) : [...products];
    if (sort === 'low') l.sort((a, b) => (a.price.value ?? 0) - (b.price.value ?? 0));
    if (sort === 'high') l.sort((a, b) => (b.price.value ?? 0) - (a.price.value ?? 0));
    return l;
  }, [products, active, sort]);

  return (
    <div className="px-page pb-32 pt-page">
      <div className="text-center">
        <p className="t-label t-mark text-[var(--c-mute)]">Shop</p>
        <h1 className="t-h2 t-mark mt-2">ALL PRODUCTS</h1>
        <p className="t-kr-sub mt-2">라기가 발견하고 선별한 제품</p>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-b border-black/10 pb-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="분류">
          {[null, ...categories].map((c) => (
            <button key={c ?? 'all'} type="button" onClick={() => setParams(c ? { c } : {})} aria-pressed={active === c} className="chip">
              {c ? CATEGORY_LABEL[c] ?? c : '전체'}
              <span className="tabular-nums opacity-60">{c ? products.filter((p) => p.category.value === c).length : products.length}</span>
            </button>
          ))}
        </div>
        <label className="t-caption kr flex items-center gap-2 text-[var(--c-mute)]">
          정렬
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-full border border-black/20 bg-white px-3 py-1.5 text-[var(--c-ink)]" data-testid="sort">
            <option value="default">추천순</option>
            <option value="low">낮은 가격순</option>
            <option value="high">높은 가격순</option>
          </select>
        </label>
      </div>

      {loading && <p className="t-caption kr mt-20">불러오는 중…</p>}
      {error && <p className="t-caption kr mt-20">{error}</p>}

      <ul className="mt-10 grid grid-cols-2 gap-x-[var(--gap)] gap-y-12 md:grid-cols-3 lg:grid-cols-4" data-testid="shop-grid">
        {list.map((p, i) => (
          <li key={p.id}>
            <ProductCard p={p} eager={i < 8} />
          </li>
        ))}
      </ul>
    </div>
  );
}
