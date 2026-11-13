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

/** Plain facts from the site's own product data (nothing invented): kind of bag, handle drop, handle count. */
/** The flat surface photos the 3D model is textured with (real photos, not AI-redrawn), as absolute URLs, at most 3. */
export function productFaceUrls(product: Product, base: string): string[] | undefined {
  const m = product.model3d;
  if (!m) return undefined;
  const paths = [m.faces?.front, m.textures?.front, m.faces?.back, m.textures?.back, m.faces?.left ?? m.faces?.right, m.textures?.side].filter((x): x is string => !!x);
  const urls = [...new Set(paths)].slice(0, 3).map((x) => new URL(x, base).toString());
  return urls.length ? urls : undefined;
}

export function productFacts(product: Product): string | undefined {
  const m = product.model3d;
  if (!m) return undefined;
  // Only what the model data states; "box" is the shape, not a claim about stiffness.
  const kind = m.type === 'box' ? 'a box-shaped bag' : m.type === 'pouch' ? 'a small zip pouch' : 'an open tote bag';
  const handle =
    m.type === 'pouch'
      ? m.handleCm
        ? `hangs from a carabiner and cord about ${m.handleCm} cm long`
        : ''
      : [m.handles?.length ? `${m.handles.length} top handle${m.handles.length > 1 ? 's' : ''}` : '', m.handleCm ? `handle rises about ${m.handleCm} cm above the body` : ''].filter(Boolean).join(', ');
  return [kind, handle, m.openTop ? 'open top' : ''].filter(Boolean).join(', ');
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
      facts: productFacts(product),
      // Opt-in while the improved prompt is being judged: `?prompt=v2` in the address.
      promptVersion: new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('prompt') === 'v2' ? 'v2' : undefined,
      // Opt-in too (`?prompt=v2&ref=faces`): the product's real surface photos as extra references.
      faces: new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('ref') === 'faces' ? productFaceUrls(product, base) : undefined,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { image?: string; error?: string; reason?: string; detail?: string };
  if (!res.ok || !body.image)
    throw Object.assign(new Error(body.error ?? 'AI 이미지 합성에 실패했습니다.'), { status: res.status, reason: body.reason, detail: body.detail });
  return body.image;
}
