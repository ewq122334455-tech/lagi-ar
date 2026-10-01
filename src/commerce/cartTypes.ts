/**
 * Cart model.
 *
 * A line snapshots what was shown at the time it was added (name, image, unit price) so the
 * cart renders without refetching every product. `unitPrice` is deliberately nullable: this
 * site never invents a price, so a product whose price is still CONTENT_REQUIRED can sit in
 * the cart without a fabricated number attached to it.
 */
export interface CartLine {
  productId: string;
  /** null when the product has no variants defined. */
  variantId: string | null;
  size: string | null;
  color: string | null;
  quantity: number;
  /** KRW. null when the product has no verified price yet. */
  unitPrice: number | null;
  name: string | null;
  image: string | null;
}

export const CART_STORAGE_KEY = 'lagi.cart.v1';

/** Identity of a line — same product and same variant stack together. */
export function lineKey(line: Pick<CartLine, 'productId' | 'variantId'>): string {
  return `${line.productId}::${line.variantId ?? ''}`;
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((n, l) => n + l.quantity, 0);
}

/**
 * Subtotal in KRW, plus whether every line could actually be priced. When a line has no
 * verified price the total is incomplete, and the UI must say so rather than show a number
 * that looks authoritative.
 */
export function cartSubtotal(lines: CartLine[]): { amount: number; complete: boolean } {
  let amount = 0;
  let complete = true;
  for (const line of lines) {
    if (line.unitPrice === null) complete = false;
    else amount += line.unitPrice * line.quantity;
  }
  return { amount, complete };
}

export function formatKRW(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}
