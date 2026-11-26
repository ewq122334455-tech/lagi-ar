import { Link } from 'react-router-dom';
import { Reviews, Stars } from '../Reviews';
import { SAMPLE_REVIEWS } from '../sampleReviews';
import { cleanImage } from '../ProductCard';
import { useRealProducts } from '../data';
import { responsive } from '../img';

const average = SAMPLE_REVIEWS.reduce((n, r) => n + r.rating, 0) / SAMPLE_REVIEWS.length;

/**
 * Reviews. The page is full of example reviews (clearly marked "예시") so it never looks empty; real customer
 * reviews, when there are any, are listed under them.
 */
export default function ReviewPage() {
  const { products } = useRealProducts();
  const byId = new Map(products.map((p) => [p.id, p]));
  return (
    <div className="px-page pb-[var(--section)] pt-page">
      <h1 className="sr-only">Review</h1>

      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4" data-testid="review-summary">
          <div className="flex items-end gap-4">
            <p className="t-mark text-[clamp(48px,6vw,80px)] font-bold leading-none tabular-nums">{average.toFixed(1)}</p>
            <div className="pb-1.5">
              <Stars value={Math.round(average)} size={20} />
              <p className="t-caption kr mt-1 tabular-nums">{SAMPLE_REVIEWS.length}개</p>
            </div>
          </div>
          <p className="t-caption kr rounded-full border border-[var(--c-blue)]/30 px-3 py-1" data-testid="review-sample-note">
            예시 구매평 · 실제 구매자 후기가 아닙니다
          </p>
        </div>

        <ul className="mt-10 gap-4 [column-fill:_balance] md:columns-2 md:gap-5 lg:columns-3" data-testid="sample-reviews">
          {SAMPLE_REVIEWS.map((r, i) => {
            const p = byId.get(r.productId);
            if (!p) return null;
            const img = cleanImage(p);
            return (
              <li key={i} className="mb-4 break-inside-avoid rounded-[var(--radius-card)] border border-black/10 bg-white p-5 md:mb-5" data-testid="sample-review">
                <div className="flex items-center gap-3">
                  <Link to={`/product/${p.id}`} className="block h-14 w-14 shrink-0 overflow-hidden rounded-[6px] bg-white ring-1 ring-black/10" aria-label={p.nameEn ?? p.name.value ?? ''}>
                    <img {...responsive(img, '96px')} src={img} alt="" loading="lazy" className="h-full w-full object-contain p-1" />
                  </Link>
                  <div className="min-w-0">
                    <Link to={`/product/${p.id}`} className="t-caption t-mark pname line-clamp-2 hover:underline">
                      {p.nameEn ?? p.name.value}
                    </Link>
                    <Stars value={r.rating} />
                  </div>
                </div>
                <p className="kr mt-4 text-[15px] leading-[1.8]">{r.text}</p>
                <p className="t-caption kr mt-4 flex items-center justify-between gap-2 text-[var(--c-mute)]">
                  <span>
                    {r.author} · {r.date}
                  </span>
                  <span className="rounded-full border border-[var(--c-blue)]/30 px-2 py-0.5 text-[11px] text-[var(--c-blue)]">예시</span>
                </p>
              </li>
            );
          })}
        </ul>

        <div className="mt-16">
          <Reviews productId={null} />
        </div>
      </div>
    </div>
  );
}
