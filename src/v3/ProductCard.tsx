import { Link } from 'react-router-dom';
import type { Product } from '@/data/productTypes';
import { price } from './data';

/** White-background front view (from the reference sheet) when there is one, else the store photo. */
// eslint-disable-next-line react-refresh/only-export-components
export const cleanImage = (p: Product) => p.drawings?.find((d) => d.group === 'view')?.src ?? p.images[0];

/** Product card: clean front view, the real photo on hover; name and price under it. */
export function ProductCard({ p, eager }: { p: Product; eager?: boolean }) {
  const clean = cleanImage(p);
  const photo = p.images[0];
  return (
    <Link to={`/product/${p.id}`} className="group block" data-testid="product-card">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] bg-white">
        <img src={clean} alt={p.name.value ?? ''} loading={eager ? 'eager' : 'lazy'} className="absolute inset-0 h-full w-full object-contain p-[9%] transition-opacity duration-500 group-hover:opacity-0" />
        {photo !== clean && (
          <img src={photo} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-0 transition-[opacity,transform] duration-700 group-hover:scale-[1.03] group-hover:opacity-100" />
        )}
      </div>
      <p className="t-caption t-mark mt-3 text-[var(--c-mute)]">{p.brandLabel ?? 'LAGI'}</p>
      <p className="t-value kr mt-0.5">{p.name.value}</p>
      <p className="t-caption kr tabular-nums">{price(p.price.value)}</p>
    </Link>
  );
}

