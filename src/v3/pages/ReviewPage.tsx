import { Link } from 'react-router-dom';
import { Reviews } from '../Reviews';
import { useRealProducts } from '../data';
import { cleanImage } from '../ProductCard';

/** All reviews, newest first. Members write one per product from the product page. */
export default function ReviewPage() {
  const { products } = useRealProducts();
  return (
    <div className="px-page pb-32 pt-page">
      <div className="text-center">
        <p className="t-label t-mark text-[var(--c-mute)]">Review</p>
        <h1 className="t-h2 t-mark mt-2">REVIEW</h1>
        <p className="t-kr-sub mt-2">라기 제품을 받아 본 분들의 이야기</p>
      </div>

      <div className="mx-auto mt-12 max-w-4xl">
        <div className="rounded-[var(--radius-card)] bg-[var(--c-gray)] p-5">
          <p className="t-value kr">구매평 쓰기</p>
          <p className="t-caption kr mt-1 text-[var(--c-mute)]">제품을 고르면 그 제품 페이지의 구매평 탭으로 이동합니다. 회원만 쓸 수 있고, 라기에서 결제한 제품에는 ‘구매 확인’이 표시됩니다.</p>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {products.map((p) => (
              <Link key={p.id} to={`/product/${p.id}`} className="w-24 shrink-0 text-center" aria-label={`${p.name.value} 구매평 쓰기`}>
                <span className="block aspect-square overflow-hidden rounded-[6px] bg-white">
                  <img src={cleanImage(p)} alt="" loading="lazy" className="h-full w-full object-contain p-2" />
                </span>
                <span className="t-label kr mt-1.5 block truncate">{p.name.value}</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-12">
          <Reviews productId={null} />
        </div>
      </div>
    </div>
  );
}
