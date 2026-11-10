/**
 * Lighter display copies of the product photos (WebP at 480/960/1600 px, made at build time by
 * scripts/build-images.mjs into dist/_img). Only offered in the published build and only for local
 * product photos; `src` always stays the original, which the AI fitting and 3D models also use.
 */
const PROD = import.meta.env.PROD;
const WIDTHS = [480, 960, 1600];
const local = (src: string) => /^products\/.+\.(jpe?g|png)$/i.test(src);
const copy = (src: string, w: number) => `_img/${src.replace(/\.(jpe?g|png)$/i, '')}-${w}.webp`;

/** srcSet + sizes for an <img> showing a product photo; empty in development or for other images. */
export function responsive(src: string | null | undefined, sizes: string): { srcSet?: string; sizes?: string } {
  if (!src || !PROD || !local(src)) return {};
  return { srcSet: WIDTHS.map((w) => `${copy(src, w)} ${w}w`).join(', '), sizes };
}

/** The smallest copy — enough for reading a photo's proportions. */
export function smallCopy(src: string): string {
  return PROD && local(src) ? copy(src, 480) : src;
}

/** The largest copy (1600 px) — for close-up crops drawn as a CSS background, where srcset does not apply. */
export function largeCopy(src: string): string {
  return PROD && local(src) ? copy(src, 1600) : src;
}
