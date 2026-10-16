import type { GarmentType, Product, TryOnSettings } from '@/data/productTypes';

/** Whether the camera try-on can run for a product: it needs a garment image and the editorial switch on. */
export function canUseTryOn(product: Pick<Product, 'tryOn' | 'tryOnAvailable'>): boolean {
  return Boolean(product.tryOnAvailable && product.tryOn?.garmentImage);
}

export const GARMENT_TYPE_LABELS: Record<GarmentType, string> = {
  TOP: '상의 (티셔츠·셔츠·니트)',
  OUTER: '아우터 (자켓·코트)',
  DRESS: '원피스',
  BOTTOM: '하의 (바지·스커트)',
};

/** Starting anchors for a typical flat-lay garment photo; the workspace lets them be clicked into place. */
export function defaultTryOnSettings(garmentImage = '', garmentType: GarmentType = 'TOP'): TryOnSettings {
  const bottom = garmentType === 'BOTTOM';
  return {
    garmentImage,
    garmentType,
    anchorLeft: { x: bottom ? 0.2 : 0.25, y: bottom ? 0.04 : 0.12 },
    anchorRight: { x: bottom ? 0.8 : 0.75, y: bottom ? 0.04 : 0.12 },
    fit: 1,
    offsetY: 0,
  };
}
