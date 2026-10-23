import { CurvedGallery } from '../CurvedGallery';
import { useImageRatios, useRealProducts } from '../data';

export default function Home() {
  const { products, error } = useRealProducts();
  const ratios = useImageRatios(products);
  const ready = products.length > 0 && products.every((p) => ratios[p.id]);
  return (
    <div className="relative h-full">
      {ready && <CurvedGallery products={products} ratios={ratios} />}
      {error && <p className="t-label absolute left-[var(--page-x)] top-24">{error}</p>}
      {/* Wordmark: white text in a difference-blend layer, so it inverts over photos (as in the reference). */}
      <div className="pointer-events-none absolute bottom-5 left-[var(--page-x)] z-[150] mix-blend-difference">
        <h1 className="t-display text-white">
          LAGI
          <br />
          in AGAIN
        </h1>
      </div>
    </div>
  );
}
