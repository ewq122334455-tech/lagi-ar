import { Link } from 'react-router-dom';
import type { Product } from '@/data/productTypes';
import { aiTryOnEnabled } from '@/tryon/aiTryOn';
import { productCover, productDisplayName } from '@/utils/productImage';
import { LagiLogo } from '@/components/LagiLogo';

interface ProductCardProps {
  product: Product;
  /** Ranking position, shown as a number tab on the image. */
  rank?: number;
}

/** Compact store-grid card: image, brand, name, price, and what the product can do. */
export function ProductCard({ product, rank }: ProductCardProps) {
  const name = productDisplayName(product);
  const cover = productCover(product);
  const tryOn = aiTryOnEnabled(product);

  return (
    <Link to={`/product/${product.id}`} className="group block focus-ring" aria-label={`${name} 상세보기`}>
      <div className="relative aspect-[5/6] w-full overflow-hidden rounded-md bg-mist">
        {cover ? (
          <img
            src={cover}
            alt={name}
            loading="lazy"
            className={`h-full w-full transition-transform duration-500 ease-out group-hover:scale-[1.04] ${
              product.images[0] ? 'object-cover' : 'object-contain p-[12%]'
            }`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-stone">
            <LagiLogo className="h-12 w-auto opacity-40" />
          </div>
        )}
        {rank !== undefined && (
          <span
            className={`absolute left-0 top-0 flex h-7 min-w-7 items-center justify-center rounded-br-md px-1.5 text-xs font-bold ${
              rank <= 3 ? 'bg-blue text-paper' : 'bg-ink text-paper'
            }`}
          >
            {rank}
          </span>
        )}
        <div className="absolute bottom-2 left-2 flex gap-1">
          {tryOn && <Tag className="bg-lime text-ink">AI 피팅</Tag>}
          {product.sample && <Tag className="bg-paper/90 text-ink">출시 예정</Tag>}
        </div>
      </div>

      <div className="mt-2.5 space-y-0.5 px-0.5">
        <p className="text-[11px] font-bold tracking-wide">{product.brandLabel ?? 'LAGI'}</p>
        <h3 className="line-clamp-2 text-[13px] leading-snug text-graphite group-hover:text-ink">{name}</h3>
        <p className="pt-1 text-sm font-bold">
          {product.price.value != null ? (
            `${product.price.value.toLocaleString('ko-KR')}원`
          ) : (
            <span className="text-xs font-medium text-stone">가격 정보 준비 중</span>
          )}
        </p>
        {product.shipping && (
          <p className={`text-[11px] ${product.shipping.fee === 0 ? 'font-semibold text-blue' : 'text-stone'}`}>
            {product.shipping.fee === 0 ? '무료배송' : `배송비 ${product.shipping.fee.toLocaleString('ko-KR')}원`}
          </p>
        )}
      </div>
    </Link>
  );
}

function Tag({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`rounded-sm px-1.5 py-0.5 text-[10px] font-bold ${className}`}>{children}</span>;
}
