/** sessionStorage key for a recoloured bag cut-out handed from /again to the try-on. */
export const REMIX_GARMENT_KEY = 'lagi.again.remixGarment';

export function readRemixGarment(): string | null {
  try {
    return sessionStorage.getItem(REMIX_GARMENT_KEY);
  } catch {
    return null;
  }
}
