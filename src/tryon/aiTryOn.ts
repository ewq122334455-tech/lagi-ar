import type { CarryStyle, Product } from '@/data/productTypes';

/** URL of the AI try-on Worker (server/tryon-worker). The build variable can override the deployed default. */
export const AI_TRYON_URL: string = import.meta.env.VITE_TRYON_API_URL || 'https://lagi-tryon.lagi-official.workers.dev';

/** AI fitting needs only a product photo to show the visitor. */
export function aiTryOnEnabled(product: Pick<Product, 'images'>): boolean {
  return product.images.length > 0;
}

/** Downscale a photo to at most `max` px on its long side as a JPEG data URL (keeps uploads small). */
export async function photoToDataUrl(file: File, max = 1280): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * s);
    canvas.height = Math.round(img.naturalHeight * s);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.9);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** How to wear a bag, as told to the AI — keyed like the camera try-on's carry styles. */
export const CARRY_PROMPTS: Record<CarryStyle, string> = {
  SHOULDER: 'with the handles resting on one shoulder',
  HAND: 'held by the handles in one hand, arm relaxed at the side',
  CROSSBODY: 'worn cross-body with the strap across the chest',
};

export interface AiTryOnInput {
  person: string;
  product: Product;
  style?: string;
  /** Lets the caller cancel (or time out) the request. */
  signal?: AbortSignal;
}

export async function requestAiTryOn({ person, product, style, signal }: AiTryOnInput): Promise<string> {
  const base = `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}`;
  const d = product.dimensions;
  const size = d.widthCm ? `W${d.widthCm * 10} × H${(d.heightCm ?? 0) * 10} × D${(d.depthCm ?? 0) * 10} mm` : undefined;
  const res = await fetch(AI_TRYON_URL, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      person,
      productImage: new URL(product.images[0], base).toString(),
      productName: product.name.value ?? 'LAGI product',
      category: product.category.value ?? undefined,
      size,
      style,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { image?: string; error?: string };
  if (!res.ok || !body.image) throw new Error(body.error ?? 'AI 피팅에 실패했습니다.');
  return body.image;
}
