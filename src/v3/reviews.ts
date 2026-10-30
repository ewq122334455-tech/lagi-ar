import { AI_TRYON_URL } from '@/tryon/aiTryOn';

/** Reviews and order lookup live on the same Worker as members and orders. */
const API = AI_TRYON_URL.replace(/\/+$/, '');

export interface ReviewItem {
  id: string;
  productId: string;
  productName: string;
  author: string;
  rating: number;
  text: string;
  photo: boolean;
  verified: boolean;
  createdAt: string;
  /** The viewer wrote it (only when logged in). */
  mine?: boolean;
}

export interface ReviewPage {
  reviews: ReviewItem[];
  total: number;
  page: number;
  pages: number;
}

export interface OrderSummary {
  orderId: string;
  status: 'PENDING' | 'PAID' | 'FAILED';
  orderName: string;
  lines: { productId: string; name: string; unitPrice: number; quantity: number }[];
  itemsTotal: number;
  shippingFee: number;
  amount: number;
  shipping: { recipient: string; address: string; addressDetail: string; zonecode: string };
  payment?: { method?: string; approvedAt?: string; receiptUrl?: string };
}

function session() {
  try {
    return localStorage.getItem('lagi-session');
  } catch {
    return null;
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = session();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  }).catch(() => {
    throw new Error('서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? '요청을 처리하지 못했습니다.');
  return body;
}

export const reviewPhotoUrl = (id: string) => `${API}/reviews/photo/${id}`;
export const fetchReviews = (product: string | null, page = 1) => call<ReviewPage>(`/reviews?${product ? `product=${encodeURIComponent(product)}&` : ''}page=${page}`);
export const postReview = (input: { productId: string; rating: number; text: string; photo?: string }) => call<ReviewItem>('/reviews', { method: 'POST', body: JSON.stringify(input) });
export const deleteReview = (productId: string, id: string) => call<{ ok: true }>(`/reviews/${productId}/${id}`, { method: 'DELETE' });
export const myReviewedProducts = () => call<{ products: string[] }>('/reviews/mine');
export const lookupOrder = (orderId: string, phone: string) => call<OrderSummary>('/orders/lookup', { method: 'POST', body: JSON.stringify({ orderId, phone }) });
export const myOrders = () => call<{ orders: OrderSummary[] }>('/orders/mine');

/** Shrink a photo to a JPEG data URL (long side ≤ 1280 px) before upload. */
export async function photoForReview(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c.toDataURL('image/jpeg', 0.82);
}
