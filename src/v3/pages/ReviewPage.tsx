import { Link } from 'react-router-dom';
import { Reviews } from '../Reviews';
import { useRealProducts } from '../data';
import { cleanImage } from '../ProductCard';
import { responsive } from '../img';

/** All reviews, newest first. Members write one per product from the product page. */
export default function ReviewPage() {
  const { products } = useRealProducts();
  return (
    <div className="px-page pb-[var(--section)] pt-page">
      <h1 className="sr-only">Review</h1>

      <div className="mx-auto max-w-4xl">
        <div>
          <p className="t-caption kr text-[var(--c-mute)]">구매평 쓰기</p>
          <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">
            {products.map((p) => (
              <Link key={p.id} to={`/product/${p.id}`} className="block" aria-label={`${p.name.value} 구매평 쓰기`}>
                <span className="block aspect-square overflow-hidden rounded-[6px] bg-white">
                  <img {...responsive(cleanImage(p), '160px')} src={cleanImage(p)} alt="" loading="lazy" className="h-full w-full object-contain p-2" />
                </span>
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-24">
          <Reviews productId={null} />
        </div>
      </div>
    </div>
  );
}
