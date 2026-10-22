import type { Product } from '@/data/productTypes';

/**
 * The image to show for a product in lists: a real photo when one is registered, otherwise the
 * front render of its own 3D model made for the try-on — never a stand-in from another product.
 */
export function productCover(product: Pick<Product, 'images' | 'tryOn'>): string | null {
  return product.images[0] ?? product.tryOn?.garmentImage ?? null;
}

export function productDisplayName(product: Pick<Product, 'name' | 'id'>): string {
  return product.name.value ?? `LAGI ${product.id.replace('product-', 'No.')}`;
}
