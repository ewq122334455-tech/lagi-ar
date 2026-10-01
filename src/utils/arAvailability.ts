import type { Product } from '@/data/productTypes';

/**
 * Whether the AR experience can run for a product.
 *
 * A 3D model is enough: with a compiled image target the experience tracks that image, and
 * without one it falls back to markerless placement. `arAvailable` stays meaningful as an
 * editorial switch for hiding AR on a product even when the assets exist.
 */
export function canUseAR(product: Pick<Product, 'model3D' | 'arAvailable' | 'arTarget'>): boolean {
  if (!product.model3D) return false;
  return product.arAvailable || !product.arTarget;
}

/** True when AR will run without an image target, so the UI can explain the difference. */
export function isMarkerlessAR(product: Pick<Product, 'arTarget'>): boolean {
  return !product.arTarget;
}
