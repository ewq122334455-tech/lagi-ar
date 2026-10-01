import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProducts } from '@/hooks/useProducts';
import { ProductCard } from '@/components/ProductCard';
import { Loading } from '@/components/Loading';
import { ErrorState } from '@/components/ErrorState';
import { canUseAR } from '@/utils/arAvailability';
import type { Product } from '@/data/productTypes';

type SortKey = 'recommended' | 'price-asc' | 'price-desc' | 'name';

const SORT_LABELS: Record<SortKey, string> = {
  recommended: '추천순',
  'price-asc': '낮은 가격순',
  'price-desc': '높은 가격순',
  name: '이름순',
};

/** Products with no price sort last — an unpriced item shouldn't top a price sort. */
function comparePrice(a: Product, b: Product, direction: 1 | -1): number {
  const pa = a.price.value;
  const pb = b.price.value;
  if (pa === null && pb === null) return 0;
  if (pa === null) return 1;
  if (pb === null) return -1;
  return (pa - pb) * direction;
}

export default function ProductCollection() {
  const state = useProducts();
  const [category, setCategory] = useState<string>('ALL');
  const [sort, setSort] = useState<SortKey>('recommended');
  const [onlyAR, setOnlyAR] = useState(false);
  const [only3D, setOnly3D] = useState(false);
  const [searchParams] = useSearchParams();
  const query = (searchParams.get('q') ?? '').trim().toLowerCase();

  const categories = useMemo(() => {
    if (state.status !== 'ready') return ['ALL'];
    const set = new Set<string>();
    state.data.forEach((p) => {
      if (p.category.value) set.add(p.category.value);
    });
    return ['ALL', ...Array.from(set)];
  }, [state]);

  const products = useMemo(() => {
    if (state.status !== 'ready') return [];
    const filtered = state.data
      .filter((p) => category === 'ALL' || p.category.value === category)
      .filter((p) => !onlyAR || canUseAR(p))
      .filter((p) => !only3D || !!p.model3D)
      .filter((p) => {
        if (!query) return true;
        const haystack = [p.name.value, p.shortDescription.value, p.category.value, p.id]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      });

    const sorted = [...filtered];
    if (sort === 'price-asc') sorted.sort((a, b) => comparePrice(a, b, 1));
    else if (sort === 'price-desc') sorted.sort((a, b) => comparePrice(a, b, -1));
    else if (sort === 'name')
      sorted.sort((a, b) => (a.name.value ?? '').localeCompare(b.name.value ?? '', 'ko'));
    else sorted.sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
    return sorted;
  }, [state, category, sort, onlyAR, only3D, query]);

  const total = state.status === 'ready' ? state.data.length : 0;

  return (
    <div className="px-6 py-20 lg:px-10 lg:py-28">
      <div className="mx-auto max-w-canvas">
        <p className="eyebrow">PRODUCT</p>
        <h1 className="mt-3 font-display text-5xl lg:text-6xl">COLLECTION</h1>
        {query && (
          <p className="mt-3 text-sm text-stone">
            ‘{searchParams.get('q')}’ 검색 결과 {products.length}건
          </p>
        )}

        {state.status === 'ready' && (
          <div className="mt-10 space-y-5 border-y border-line py-6">
            {categories.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    aria-pressed={category === c}
                    className={`rounded-full border-2 px-4 py-2 font-heading text-sm font-extrabold focus-ring ${
                      category === c
                        ? 'border-ink bg-ink text-paper'
                        : 'border-line text-graphite hover:border-ink'
                    }`}
                  >
                    {c === 'ALL' ? '전체' : c}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                <FilterToggle active={only3D} onClick={() => setOnly3D((v) => !v)}>
                  3D 보기 가능
                </FilterToggle>
                <FilterToggle active={onlyAR} onClick={() => setOnlyAR((v) => !v)}>
                  AR 가능
                </FilterToggle>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm text-stone">
                  {products.length}/{total}개
                </span>
                <label className="flex items-center gap-2 text-sm">
                  <span className="sr-only">정렬 기준</span>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortKey)}
                    className="rounded-full border-2 border-line bg-paper px-4 py-2 font-heading text-sm font-bold focus-ring"
                  >
                    {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                      <option key={k} value={k}>
                        {SORT_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </div>
        )}

        <div className="mt-14">
          {state.status === 'loading' && <Loading label="제품을 불러오는 중" />}
          {state.status === 'error' && <ErrorState message={state.message} />}
          {state.status === 'ready' && products.length === 0 && (
            <p className="text-sm text-stone">
              {query ? '검색 결과가 없습니다.' : '조건에 맞는 제품이 없습니다.'}
            </p>
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

function FilterToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border-2 px-4 py-2 text-sm font-bold focus-ring ${
        active ? 'border-blue bg-blue text-paper' : 'border-line text-graphite hover:border-ink'
      }`}
    >
      {children}
    </button>
  );
}
