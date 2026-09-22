import { Link } from 'react-router-dom';
import { useProducts } from '@/hooks/useProducts';
import { Loading } from '@/components/Loading';
import { ErrorState } from '@/components/ErrorState';
import { ContentBadge } from '@/components/ContentBadge';

export default function Materials() {
  const state = useProducts();
  const withMaterials = state.status === 'ready' ? state.data.filter((p) => p.materials.length > 0) : [];

  return (
    <div>
      <section className="border-b border-line bg-ink px-6 py-24 text-paper lg:px-10 lg:py-32">
        <div className="mx-auto max-w-canvas">
          <p className="eyebrow text-mist">MATERIALS</p>
          <h1 className="mt-4 max-w-2xl font-display text-5xl leading-tight lg:text-6xl">
            무엇으로, 왜 만들어졌는지.
          </h1>
          <p className="mt-6 max-w-xl text-mist/80">
            LAGI 제품에 사용된 소재는 각 제품 페이지에 등록된 정보를 그대로 모아 보여줍니다. 확인되지 않은 소재
            정보는 만들어내지 않습니다.
          </p>
        </div>
      </section>

      <section className="px-6 py-20 lg:px-10 lg:py-28">
        <div className="mx-auto max-w-canvas">
          {state.status === 'loading' && <Loading label="불러오는 중" />}
          {state.status === 'error' && <ErrorState message={state.message} />}

          {state.status === 'ready' && withMaterials.length === 0 && (
            <div className="border border-dashed border-line px-8 py-16 text-center">
              <p className="eyebrow text-stone">CONTENT REQUIRED</p>
              <p className="mx-auto mt-3 max-w-md text-sm text-graphite">
                아직 등록된 소재 정보가 없습니다. 제품 워크스페이스의 MATERIAL & PROCESS 탭에서 소재를 등록하면
                이 페이지에 자동으로 표시됩니다.
              </p>
            </div>
          )}

          {state.status === 'ready' && withMaterials.length > 0 && (
            <div className="flex flex-col gap-24">
              {withMaterials.map((product) => {
                const displayName = product.name.value ?? `Product ${product.id.replace('product-', '#')}`;
                return (
                  <div key={product.id}>
                    <div className="flex items-end justify-between gap-6 border-b border-ink pb-4">
                      <h2 className="text-2xl font-medium">{displayName}</h2>
                      <Link to={`/product/${product.id}`} className="eyebrow shrink-0 hover:text-graphite focus-ring">
                        제품 보기 →
                      </Link>
                    </div>
                    <div className="mt-8 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
                      {product.materials.map((m, i) => (
                        <div key={i}>
                          {m.image && <img src={m.image} alt={m.name.value ?? ''} className="mb-4 aspect-[4/3] w-full object-cover" />}
                          <p className="font-medium">{m.name.value ?? <ContentBadge status={m.name.status} />}</p>
                          {m.characteristics.value ? (
                            <p className="mt-2 text-sm text-graphite">{m.characteristics.value}</p>
                          ) : (
                            <div className="mt-2"><ContentBadge status={m.characteristics.status} /></div>
                          )}
                          {m.reasonForUse.value && <p className="mt-2 text-sm text-stone">{m.reasonForUse.value}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
