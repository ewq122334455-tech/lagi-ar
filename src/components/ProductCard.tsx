import { Link } from 'react-router-dom';
import type { Product } from '@/data/productTypes';
import { ContentBadge } from '@/components/ContentBadge';
import { canUseAR } from '@/utils/arAvailability';

export function ProductCard({ product }: { product: Product }) {
  const displayName = product.name.value ?? `Product ${product.id.replace('product-', '#')}`;
  const cover = product.images[0];

  return (
    <Link to={`/product/${product.id}`} className="group focus-ring block" aria-label={`${displayName} 상세보기`}>
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-card bg-mist">
        {cover ? (
          <img
            src={cover}
            alt={displayName}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-stone">
            <span className="font-display text-4xl tracking-[0.02em]">LAGI</span>
            <span className="eyebrow">IMAGE CONTENT REQUIRED</span>
          </div>
        )}

        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {canUseAR(product) && (
            <span className="bg-blue px-2 py-1 font-heading text-[0.6rem] font-medium uppercase tracking-[0.18em] text-paper">
              AR
            </span>
          )}
          {product.threeDAvailable && (
            <span className="bg-ochre px-2 py-1 font-heading text-[0.6rem] font-medium uppercase tracking-[0.18em] text-ink">
              3D
            </span>
          )}
        </div>
      </div>

      <div className="mt-4">
        {product.category.value && <p className="eyebrow mb-1">{product.category.value}</p>}
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-heading text-[0.95rem] font-medium tracking-[-0.005em]">
            {product.name.value ?? <span className="text-stone">이름 미등록</span>}
          </h3>
          <div className="shrink-0 text-right">
            {product.price.value != null ? (
              <p className="font-heading font-semibold">{product.price.value.toLocaleString('ko-KR')}원</p>
            ) : (
              <ContentBadge status={product.price.status} />
            )}
          </div>
        </div>
        {product.shortDescription.value && (
          <p className="mt-1 line-clamp-1 text-sm text-graphite">{product.shortDescription.value}</p>
        )}
        <p className="mt-3 inline-block border-b border-ink/30 pb-0.5 font-heading text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink transition-colors group-hover:border-blue group-hover:text-blue">제품 보기</p>
      </div>
    </Link>
  );
}
