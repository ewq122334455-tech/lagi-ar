import { AI_TRYON_URL } from '@/tryon/aiTryOn';

/**
 * On-site payment through Toss Payments (payment widget, SDK v2).
 *
 * - The client key is public by design and comes from the build variable VITE_TOSS_CLIENT_KEY.
 *   Without it the checkout keeps the address form but says payment is not connected yet.
 * - Orders are priced and confirmed by the Worker (server/tryon-worker, /orders and
 *   /payments/confirm). The Toss secret key exists only there.
 */
export const TOSS_CLIENT_KEY: string = import.meta.env.VITE_TOSS_CLIENT_KEY ?? '';
export const API_BASE: string = import.meta.env.VITE_ORDER_API_URL || AI_TRYON_URL;
export const paymentsEnabled = () => TOSS_CLIENT_KEY.length > 0;

export interface OrderInput {
  items: { productId: string; quantity: number }[];
  customer: { name: string; phone: string; email: string };
  shipping: { recipient: string; phone: string; zonecode: string; address: string; addressDetail: string; memo: string };
  agree: boolean;
}

export interface OrderSummary {
  orderId: string;
  status: 'PENDING' | 'PAID' | 'FAILED';
  orderName: string;
  lines: { productId: string; name: string; unitPrice: number; quantity: number }[];
  itemsTotal: number;
  shippingFee: number;
  amount: number;
  shipping: OrderInput['shipping'];
  customer: { name: string };
  payment?: { method?: string; approvedAt?: string; receiptUrl?: string };
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new Error('결제 서버에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.');
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `요청에 실패했습니다 (${res.status}).`);
  return data;
}

/** Creates a pending order; the server returns the amount it computed from the published prices. */
export const createOrder = (input: OrderInput) => post<OrderSummary>('/orders', input);

/** Confirms a payment Toss sent back to the success page. */
export const confirmPayment = (q: { paymentKey: string; orderId: string; amount: number }) => post<OrderSummary>('/payments/confirm', q);

// --- Toss SDK -----------------------------------------------------------------------------------

export interface TossWidgets {
  setAmount(a: { currency: 'KRW'; value: number }): Promise<void>;
  renderPaymentMethods(o: { selector: string; variantKey?: string }): Promise<unknown>;
  renderAgreement(o: { selector: string; variantKey?: string }): Promise<unknown>;
  requestPayment(o: {
    orderId: string;
    orderName: string;
    successUrl: string;
    failUrl: string;
    customerEmail?: string;
    customerName?: string;
    customerMobilePhone?: string;
  }): Promise<void>;
}
type TossPaymentsFn = ((clientKey: string) => { widgets(o: { customerKey: string }): TossWidgets }) & { ANONYMOUS: string };

let sdk: Promise<TossPaymentsFn> | null = null;
export function loadToss(): Promise<TossPaymentsFn> {
  sdk ??= new Promise((resolve, reject) => {
    const w = window as unknown as { TossPayments?: TossPaymentsFn };
    if (w.TossPayments) return resolve(w.TossPayments);
    const s = document.createElement('script');
    s.src = 'https://js.tosspayments.com/v2/standard';
    s.onload = () => (w.TossPayments ? resolve(w.TossPayments) : reject(new Error('결제 모듈을 불러오지 못했습니다.')));
    s.onerror = () => {
      sdk = null;
      reject(new Error('결제 모듈을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'));
    };
    document.head.appendChild(s);
  });
  return sdk;
}

/** Absolute URL of a route on this HashRouter site, for Toss to send the visitor back to. */
export function routeUrl(route: string) {
  return `${window.location.origin}${window.location.pathname}#${route}`;
}

// --- Korean address search (Kakao/Daum postcode, free, no key) -----------------------------------

export interface PostcodeResult {
  zonecode: string;
  roadAddress: string;
  jibunAddress: string;
  buildingName?: string;
}
type PostcodeCtor = new (o: { oncomplete: (d: PostcodeResult) => void; width?: string; height?: string }) => { embed(el: HTMLElement): void };

let postcode: Promise<PostcodeCtor> | null = null;
export function loadPostcode(): Promise<PostcodeCtor> {
  postcode ??= new Promise((resolve, reject) => {
    const w = window as unknown as { daum?: { Postcode: PostcodeCtor } };
    if (w.daum?.Postcode) return resolve(w.daum.Postcode);
    const s = document.createElement('script');
    s.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    s.onload = () => (w.daum?.Postcode ? resolve(w.daum.Postcode) : reject(new Error('주소 검색을 불러오지 못했습니다.')));
    s.onerror = () => {
      postcode = null;
      reject(new Error('주소 검색을 불러오지 못했습니다. 우편번호와 주소를 직접 입력해 주세요.'));
    };
    document.head.appendChild(s);
  });
  return postcode;
}

const PENDING_KEY = 'lagi.pendingOrder';
/** The order being paid, kept for the success/fail pages (same tab only). */
export function rememberPending(o: OrderSummary) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(o));
  } catch {
    // the success page still works from the server's answer
  }
}
export function pendingOrder(): OrderSummary | null {
  try {
    return JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? 'null');
  } catch {
    return null;
  }
}
