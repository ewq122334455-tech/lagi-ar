import type { Point2D } from '@/data/productTypes';

/** sessionStorage key for a recoloured bag cut-out handed from /again to the try-on. */
export const REMIX_GARMENT_KEY = 'lagi.again.remixGarment';

export interface RemixGarment {
  image: string;
  /** Detected from the cut-out itself, since it may come from a different model than the product's own try-on image. */
  anchorLeft?: Point2D;
  anchorRight?: Point2D;
}

export function saveRemixGarment(garment: RemixGarment): void {
  try {
    sessionStorage.setItem(REMIX_GARMENT_KEY, JSON.stringify(garment));
  } catch {
    // Storage full or blocked: the try-on falls back to the product's standard image.
  }
}

export function readRemixGarment(): RemixGarment | null {
  try {
    const raw = sessionStorage.getItem(REMIX_GARMENT_KEY);
    return raw ? (JSON.parse(raw) as RemixGarment) : null;
  } catch {
    return null;
  }
}
