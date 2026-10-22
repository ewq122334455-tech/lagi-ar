import type { ShippingInfo } from '@/data/productTypes';

export function shippingLabel(shipping: ShippingInfo | undefined): string | null {
  if (!shipping) return null;
  if (shipping.fee === 0) return '무료배송';
  const fee = `배송비 ${shipping.fee.toLocaleString('ko-KR')}원`;
  return shipping.freeOver ? `${fee} (${shipping.freeOver.toLocaleString('ko-KR')}원 이상 무료)` : fee;
}
