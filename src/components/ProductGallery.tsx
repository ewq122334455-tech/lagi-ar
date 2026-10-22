import { useState } from 'react';
import type { Product } from '@/data/productTypes';
import { productCover, productDisplayName } from '@/utils/productImage';
import { LagiLogo } from '@/components/LagiLogo';

/** Product photos: one large image with thumbnails underneath when there is more than one. */
export function ProductGallery({ product, children }: { product: Product; children?: React.ReactNode }) {
  const photos = [...product.images, ...product.gallery];
  const fallback = productCover(product);
  if (photos.length === 0 && fallback) photos.push(fallback);
  const [index, setIndex] = useState(0);
  const current = photos[Math.min(index, photos.length - 1)];
  const name = productDisplayName(product);

  return (
    <div>
      <div className="relative aspect-square w-full overflow-hidden bg-mist lg:rounded-xl">
        {current ? (
          <img
            src={current}
            alt={name}
            className={`h-full w-full ${product.images.length > 0 ? 'object-cover' : 'object-contain p-[10%]'}`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-stone">
            <LagiLogo className="h-6 w-auto" />
          </div>
        )}
        {children}
      </div>
      {photos.length > 1 && (
        <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto px-4 lg:px-0">
          {photos.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`${i + 1}번째 사진`}
              aria-current={i === index}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 bg-mist focus-ring lg:h-20 lg:w-20 ${
                i === index ? 'border-ink' : 'border-transparent'
              }`}
            >
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
