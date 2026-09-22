import { Link } from 'react-router-dom';
import type { Product } from '@/data/productTypes';
import { ContentBadge } from '@/components/ContentBadge';

export function ProductCard({ product }: { product: Product }) {
  const displayName = product.name.value ?? `Product ${product.id.replace('product-', '#')}`;
  const cover = product.images[0];

  return (
    <Link
      to={`/product/${product.id}`}
      className="group focus-ring block"
      aria-label={`${displayName} 상세보기`}
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-mist">
        {cover ? (
          <img
            src={cover}
            alt={displayName}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-stone">
            <span className="text-4xl font-light tracking-widest">LAGI</span>
            <span className="eyebrow">IMAGE CONTENT REQUIRED</span>
          </div>
        )}

        <div className="absolute left-3 top-3 flex flex-col gap-2">
          {product.arAvailable && <span className="eyebrow bg-ink px-2 py-1 text-paper">AR</span>}
          {product.threeDAvailable && <span className="eyebrow bg-paper/90 px-2 py-1 text-ink">3D</span>}
        </div>
      </div>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-medium">
            {product.name.value ?? <span className="text-stone">이름 미등록</span>}
          </h3>
          {product.shortDescription.value && (
            <p className="mt-1 line-clamp-1 text-sm text-graphite">{product.shortDescription.value}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          {product.price.value != null ? (
            <p className="text-sm">{product.price.value.toLocaleString('ko-KR')}원</p>
          ) : (
            <ContentBadge status={product.price.status} />
          )}
        </div>
      </div>
    </Link>
  );
}
