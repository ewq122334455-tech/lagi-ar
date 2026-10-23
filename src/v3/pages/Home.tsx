import { useState } from 'react';
import { CurvedGallery } from '../CurvedGallery';
import { BrandFilmOverlay } from '../BrandFilm';
import { useImageRatios, useRealProducts } from '../data';

export default function Home() {
  const { products, error } = useRealProducts();
  const ratios = useImageRatios(products);
  const ready = products.length > 0 && products.every((p) => ratios[p.id]);
  const [film, setFilm] = useState(false);
  return (
    <div className="relative h-full">
      {ready && <CurvedGallery products={products} ratios={ratios} />}
      {error && <p className="t-caption kr absolute left-[var(--page-x)] top-24">{error}</p>}
      {/* Wordmark: white text in a difference-blend layer, so it inverts over photos (as in the reference). */}
      <button type="button" onClick={() => setFilm(true)} className="t-nav tag tag-ink kr absolute left-[var(--page-x)] top-20 z-[160] max-md:top-auto max-md:bottom-[calc(var(--t-display)*2+28px)]">
        ▶ 브랜드 영상
      </button>
      {film && <BrandFilmOverlay onClose={() => setFilm(false)} />}
      <div className="pointer-events-none absolute bottom-5 left-[var(--page-x)] z-[150] mix-blend-difference">
        <h1 className="t-display t-mark text-white">
          LAGI
          <br />
          in AGAIN
        </h1>
      </div>
    </div>
  );
}
