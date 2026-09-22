import { useMemo, useState } from 'react';
import { useProducts } from '@/hooks/useProducts';
import { ProductCard } from '@/components/ProductCard';
import { Loading } from '@/components/Loading';
import { ErrorState } from '@/components/ErrorState';

export default function ProductCollection() {
  const state = useProducts();
  const [category, setCategory] = useState<string>('ALL');

  const categories = useMemo(() => {
    if (state.status !== 'ready') return ['ALL'];
    const set = new Set<string>();
    state.data.forEach((p) => {
      if (p.category.value) set.add(p.category.value);
    });
    return ['ALL', ...Array.from(set)];
  }, [state]);

  const products =
    state.status === 'ready'
      ? state.data.filter((p) => category === 'ALL' || p.category.value === category)
      : [];

  return (
    <div className="px-6 py-20 lg:px-10 lg:py-28">
      <div className="mx-auto max-w-canvas">
        <p className="eyebrow">PRODUCT</p>
        <h1 className="mt-3 text-4xl font-medium lg:text-5xl">Collection</h1>

        {state.status === 'ready' && categories.length > 1 && (
          <div className="mt-10 flex flex-wrap gap-3">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`eyebrow border px-4 py-2 focus-ring ${
                  category === c ? 'border-ink bg-ink text-paper' : 'border-line text-graphite hover:border-ink'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        <div className="mt-14">
          {state.status === 'loading' && <Loading label="제품을 불러오는 중" />}
          {state.status === 'error' && <ErrorState message={state.message} />}
          {state.status === 'ready' && products.length === 0 && (
            <p className="text-sm text-stone">해당 카테고리에 게시된 제품이 없습니다.</p>
          )}
          {state.status === 'ready' && products.length > 0 && (
            <div className="grid grid-cols-1 gap-x-6 gap-y-16 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
