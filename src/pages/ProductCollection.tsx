import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProducts } from '@/hooks/useProducts';
import { ProductCard } from '@/components/ProductCard';
import { Loading } from '@/components/Loading';
import { ErrorState } from '@/components/ErrorState';
import { aiTryOnEnabled } from '@/tryon/aiTryOn';
import type { Product } from '@/data/productTypes';

type SortKey = 'ranking' | 'recommended' | 'price-asc' | 'price-desc' | 'name';

const SORT_LABELS: Record<SortKey, string> = {
  ranking: 'LAGI 픽',
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [category, setCategory] = useState<string>('ALL');
  const query = (searchParams.get('q') ?? '').trim().toLowerCase();
  const sort = (searchParams.get('sort') as SortKey) in SORT_LABELS ? (searchParams.get('sort') as SortKey) : 'recommended';
  const onlyTryOn = searchParams.get('filter') === 'tryon';
  const [only3D, setOnly3D] = useState(false);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  }

  const categories = useMemo(() => {
    if (state.status !== 'ready') return ['ALL'];
    const set = new Set<string>();
    state.data.forEach((p) => {
      if (p.category.value && p.category.status === 'VERIFIED') set.add(p.category.value);
    });
    return ['ALL', ...Array.from(set)];
  }, [state]);

  const products = useMemo(() => {
    if (state.status !== 'ready') return [];
    const filtered = state.data
      .filter((p) => category === 'ALL' || p.category.value === category)
      .filter((p) => !onlyTryOn || aiTryOnEnabled(p))
      .filter((p) => !only3D || !!p.model3D)
      .filter((p) => {
        if (!query) return true;
        const haystack = [p.name.value, p.shortDescription.value, p.category.value, p.id, ...p.hotspots.map((h) => h.title)]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      });

    const sorted = [...filtered];
    if (sort === 'price-asc') sorted.sort((a, b) => comparePrice(a, b, 1));
    else if (sort === 'price-desc') sorted.sort((a, b) => comparePrice(a, b, -1));
    else if (sort === 'name') sorted.sort((a, b) => (a.name.value ?? '').localeCompare(b.name.value ?? '', 'ko'));
    else sorted.sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
    return sorted;
  }, [state, category, sort, onlyTryOn, only3D, query]);

  const title = query ? `‘${searchParams.get('q')}’ 검색 결과` : sort === 'ranking' ? 'LAGI 랭킹' : onlyTryOn ? 'AI 피팅 가능 상품' : '전체 상품';

  return (
    <div className="px-4 pb-20 pt-6 lg:px-10 lg:pt-10">
      <div className="flex items-baseline gap-2">
        <h1 className="text-2xl font-bold tracking-[-0.03em] lg:text-[28px]">{title}</h1>
        {state.status === 'ready' && <span className="text-sm text-stone">{products.length}개</span>}
      </div>
      {sort === 'ranking' && <p className="mt-1 text-sm text-stone">라기가 고른 순서예요. 판매량 기준이 아닙니다.</p>}

      {state.status === 'ready' && (
        <div className="sticky top-[var(--nav-height)] z-20 -mx-4 mt-5 border-b border-line bg-paper px-4 lg:-mx-10 lg:px-10">
          {categories.length > 1 && (
            <div className="no-scrollbar flex gap-2 overflow-x-auto pt-3">
              {categories.map((c) => (
                <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
                  {c === 'ALL' ? '전체' : c}
                </Chip>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              <Chip active={onlyTryOn} onClick={() => setParam('filter', onlyTryOn ? null : 'tryon')}>
                AI 피팅
              </Chip>
              <Chip active={only3D} onClick={() => setOnly3D((v) => !v)}>
                3D 보기
              </Chip>
            </div>
            <div className="no-scrollbar flex items-center gap-3 overflow-x-auto text-[13px]">
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k, i) => (
                <span key={k} className="flex shrink-0 items-center gap-3">
                  {i > 0 && <span className="h-3 w-px bg-line" aria-hidden="true" />}
                  <button
                    type="button"
                    onClick={() => setParam('sort', k === 'recommended' ? null : k)}
                    aria-pressed={sort === k}
                    className={`focus-ring ${sort === k ? 'font-bold text-ink' : 'text-stone hover:text-ink'}`}
                  >
                    {SORT_LABELS[k]}
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6">
        {state.status === 'loading' && <Loading label="상품을 불러오는 중" />}
        {state.status === 'error' && <ErrorState message={state.message} />}
        {state.status === 'ready' && products.length === 0 && (
          <p className="py-20 text-center text-sm text-stone">{query ? '검색 결과가 없습니다.' : '조건에 맞는 상품이 없습니다.'}</p>
        )}
        {state.status === 'ready' && products.length > 0 && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {products.map((p, i) => (
              <ProductCard key={p.id} product={p} rank={sort === 'ranking' ? i + 1 : undefined} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] focus-ring ${
        active ? 'border-ink bg-ink font-semibold text-paper' : 'border-line text-graphite hover:border-ink'
      }`}
    >
      {children}
    </button>
  );
}
