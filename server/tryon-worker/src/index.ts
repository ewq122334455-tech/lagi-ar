/**
 * LAGI AI try-on proxy (Cloudflare Worker).
 *
 * The website sends a visitor's photo and a product; this Worker asks Google's Gemini image model
 * to compose a photo of that person wearing/carrying the product and returns the image. It exists
 * so the Gemini API key stays secret — it is never shipped to the browser. Photos are not stored.
 *
 * It also holds member accounts (/auth/*) and on-site orders (/orders, /payments/confirm): prices are
 * always re-read from the published product data and the Toss Payments secret key stays here.
 */

/** The slice of Cloudflare's KV API the member store uses. */
interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; cursor?: string; limit?: number }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
}

export interface Env {
  /** Member accounts and login sessions. Bound in wrangler.toml ([[kv_namespaces]] USERS). */
  USERS?: KV;
  /** Text model for the product description (realtime try-on). Defaults to gemini-3.8-flash. */
  GEMINI_TEXT_MODEL?: string;
  /** Comma-separated member emails with no daily realtime limit (the owner) — a Worker secret, never in the repo. */
  REALTIME_UNLIMITED?: string;
  /** Google AI Studio API key — set with `npx wrangler secret put GEMINI_API_KEY`. */
  GEMINI_API_KEY: string;
  /** Gemini image model id, e.g. "gemini-2.5-flash-image". Set in wrangler.toml [vars]. */
  GEMINI_MODEL: string;
  /** Comma-separated site origins allowed to call this Worker and to serve product images. */
  ALLOWED_ORIGINS: string;
  /** Decart API key (dct_…) for the realtime try-on — `wrangler secret put DECART_API_KEY`. Never sent to browsers. */
  DECART_API_KEY?: string;
  /** Realtime sessions allowed per day across the whole site (cost cap). Default 100. */
  REALTIME_DAILY_SESSIONS?: string;
  /** Gemini relay pinned to the western US (Durable Object) — see GeminiRelay below. Optional. */
  RELAY?: { idFromName(name: string): unknown; get(id: unknown, opts?: { locationHint?: string }): { fetch(input: string, init?: RequestInit): Promise<Response> } };
  /** Product cut-outs (product alone on white), made once per product photo. Optional. */
  MEDIA?: KV;
  /** Orders. Bound in wrangler.toml ([[kv_namespaces]] ORDERS). */
  ORDERS?: KV;
  /** Where the published product data lives, e.g. "https://…github.io/lagi-ar/products/". Prices come from here. */
  PRODUCTS_BASE_URL?: string;
  /** Toss Payments secret key (test_sk_… / live_sk_…) — `npx wrangler secret put TOSS_SECRET_KEY`. */
  TOSS_SECRET_KEY?: string;
  /** Override for tests only. Defaults to https://api.tosspayments.com. */
  TOSS_API_BASE?: string;
  /** Token for reading orders (GET /admin/orders) — `npx wrangler secret put ADMIN_TOKEN`. */
  ADMIN_TOKEN?: string;
}

interface TryOnRequest {
  /** Visitor photo as a data URL (image/jpeg or image/png). */
  person: string;
  /** Absolute URL of the product image; must be on an allowed origin. */
  productImage: string;
  productName: string;
  category?: string;
  /** e.g. "W280 × H250 × D130 mm" — helps the model keep a realistic scale. */
  size?: string;
  /** How to wear it: shoulder, hand, crossbody, … (free text, short). */
  style?: string;
}

const MAX_PERSON_BYTES = 4 * 1024 * 1024;
const MAX_PRODUCT_BYTES = 6 * 1024 * 1024;

// Best-effort per-instance throttle. For real abuse protection add a Cloudflare rate-limiting rule.
const recent = new Map<string, number[]>();
function throttled(ip: string, limit = 6, windowMs = 60_000) {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  recent.set(ip, hits);
  return hits.length > limit;
}

function cors(origin: string | null, env: Env): Record<string, string> {
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
  const ok = origin && allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : allowed[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}

function parseDataUrl(dataUrl: string): { mime: string; data: string } | null {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  return m ? { mime: m[1], data: m[2] } : null;
}

function toBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function buildPrompt(r: TryOnRequest, cutout: boolean) {
  r = { ...r, style: r.style?.slice(0, 200), productName: r.productName?.slice(0, 120) };
  const what = [r.productName, r.category].filter(Boolean).join(', ');
  return [
    'You are a virtual fitting room. Image 1 is a photo of a person. Image 2 shows ONLY a product' + (what ? ` (${what})` : '') + (cutout ? ' on a plain background.' : '.'),
    'Create one photorealistic photo of the SAME person from image 1 naturally wearing or carrying that product' + (r.style ? `, ${r.style}` : '') + '.',
    "Keep the person's face, identity, body shape, hair, clothing and the background exactly as in image 1. Change their arm and hand position only as much as needed to hold or wear the product.",
    // The most common failure: an extra hand or arm copied from the product photo, or grown to hold the product.
    'ANATOMY RULES: the person has exactly two arms and two hands, each with five fingers, attached naturally at the shoulders. Never add a third hand, arm or finger, and never show a hand that does not belong to this person. Use only image 2 as a reference for the product itself; take no hands, arms, bodies or background from it. If the product is held, it is held by one of the person\'s own hands.',
    'Reproduce the product faithfully: same shape, colours, prints, text, materials, hardware and proportions as in image 2.',
    r.size ? `The product's real size is ${r.size}; scale it realistically to the person's body.` : 'Scale the product realistically to the body.',
    'Match the lighting, perspective and shadows of image 1 so the product looks physically present (straps resting on the shoulder or held in the hand, natural contact shadows).',
    'Return only the edited photo.',
  ].join(' ');
}

const CUTOUT_PROMPT = [
  'This photo shows a product, possibly worn or held by a person.',
  'Output a clean product photo of ONLY that product: the whole product, complete and unobstructed, seen from the front, centred on a plain white background.',
  'Remove every person, hand, arm, finger and background. Where a hand covered the product, restore the hidden part so it matches the rest.',
  'Keep the product exactly as it is: same shape, colours, prints, text, materials, hardware and proportions. Do not redesign it.',
  'Return only the image.',
].join(' ');

/**
 * Product photos on the site often show someone wearing or holding the product. Sent as they are,
 * the AI tends to copy that person's hand into the result (the "third hand"). So the product is
 * first isolated on white — once per photo, kept in KV — and the fitting uses that cut-out.
 */
async function productCutout(env: Env, url: string, product: { mime: string; data: string }): Promise<{ cut?: { mime: string; data: string }; busy?: boolean }> {
  const key = `cutout:v1:${url}`;
  const cached = await env.MEDIA?.get(key);
  if (cached) return { cut: JSON.parse(cached) as { mime: string; data: string } };
  const out = await geminiImage(env, [{ text: CUTOUT_PROMPT }, { inline_data: { mime_type: product.mime, data: product.data } }]);
  if (!out.image) return { busy: out.reason === 'busy' };
  const m = /^data:([^;]+);base64,(.+)$/.exec(out.image);
  if (!m) return {};
  const cut = { mime: m[1], data: m[2] };
  await env.MEDIA?.put(key, JSON.stringify(cut));
  return { cut };
}

const DESCRIBE_PROMPT =
  'Describe this product for a video generator in one English sentence of at most 45 words. Only what is visible: ' +
  'the kind of item, its overall shape and proportions, each main colour and the part it is on (body, top band, handles, ' +
  'straps, pockets, trims), and where the prints, lettering and label sit and their colours. No brand names, no opinions.';

/** A plain visual description of the product, so the realtime model is steered by words as well as the image. Cached. */
async function productDescription(env: Env, url: string, product: { mime: string; data: string }): Promise<{ text?: string; note?: string }> {
  const key = `desc:v1:${url}`;
  const cached = await env.MEDIA?.get(key);
  if (cached) return { text: cached };
  try {
    const res = await callGemini(
      env,
      JSON.stringify({
        contents: [{ parts: [{ text: DESCRIBE_PROMPT }, { inline_data: { mime_type: product.mime, data: product.data } }] }],
        // Roomy budget: newer Flash models may think before writing; the answer is cut to 400 chars below.
        generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
      }),
      env.GEMINI_TEXT_MODEL ?? 'gemini-3.8-flash',
    );
    if (!res.ok) return { note: `HTTP ${res.status} ${(await res.text()).replace(/\s+/g, ' ').slice(0, 200)}` };
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[] };
    const text = data.candidates?.[0]?.content?.parts?.map((x) => x.text ?? '').join(' ').replace(/\s+/g, ' ').trim();
    if (!text) return { note: `no text (${data.candidates?.[0]?.finishReason ?? 'no candidate'})` };
    const clean = text.slice(0, 400);
    await env.MEDIA?.put(key, clean);
    return { text: clean };
  } catch (e) {
    return { note: (e as Error).message.slice(0, 200) };
  }
}

const MATTE_PROMPT = [
  'Place this exact product, alone, on a perfectly flat pure green background (#00FF00), filling most of the frame, seen from the front.',
  'No shadow, no reflection, no gradient, no floor: every background pixel is the same pure green.',
  'Keep the product exactly as it is: same shape, colours, prints, text, materials, hardware and proportions. Do not redesign it.',
  'Return only the image.',
].join(' ');

/** The product on pure green, for the browser to key out and lay over the live video. Cached per product. */
async function productMatte(env: Env, url: string, product: { mime: string; data: string }): Promise<{ mime: string; data: string } | undefined> {
  const key = `matte:v1:${url}`;
  const cached = await env.MEDIA?.get(key);
  if (cached) return JSON.parse(cached) as { mime: string; data: string };
  const out = await geminiImage(env, [{ text: MATTE_PROMPT }, { inline_data: { mime_type: product.mime, data: product.data } }]);
  const m = out.image && /^data:([^;]+);base64,(.+)$/.exec(out.image);
  if (!m) return undefined;
  const matte = { mime: m[1], data: m[2] };
  await env.MEDIA?.put(key, JSON.stringify(matte));
  return matte;
}

// ---- Members: sign-up / log-in --------------------------------------------------------------

interface StoredUser {
  id: string;
  email: string;
  name: string;
  salt: string;
  hash: string;
  createdAt: string;
  marketing: boolean;
}

const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days
// Cloudflare Workers cap PBKDF2 at 100k iterations.
const PBKDF2_ITERATIONS = 100_000;

const toHex = (buf: ArrayBuffer | Uint8Array) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const randomHex = (bytes: number) => toHex(crypto.getRandomValues(new Uint8Array(bytes)));

async function hashPassword(password: string, saltHex: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const salt = new Uint8Array(saltHex.match(/../g)!.map((h) => parseInt(h, 16)));
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS }, key, 256);
  return toHex(bits);
}

function sameString(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const publicUser = (u: StoredUser) => ({ id: u.id, email: u.email, name: u.name, createdAt: u.createdAt });

async function newSession(kv: KV, email: string) {
  const token = randomHex(32);
  await kv.put(`session:${token}`, email, { expirationTtl: SESSION_TTL });
  return token;
}

async function sessionUser(kv: KV, request: Request): Promise<{ token: string; user: StoredUser } | null> {
  const token = /^Bearer ([0-9a-f]{64})$/.exec(request.headers.get('Authorization') ?? '')?.[1];
  if (!token) return null;
  const email = await kv.get(`session:${token}`);
  const raw = email && (await kv.get(`user:${email}`));
  return raw ? { token, user: JSON.parse(raw) as StoredUser } : null;
}

async function handleAuth(path: string, request: Request, kv: KV, headers: Record<string, string>): Promise<Response> {
  if (path === '/auth/me' && request.method === 'GET') {
    const s = await sessionUser(kv, request);
    return s ? json({ user: publicUser(s.user) }, 200, headers) : json({ error: '로그인이 필요합니다.' }, 401, headers);
  }
  if (request.method !== 'POST') return json({ error: 'not found' }, 404, headers);

  if (path === '/auth/logout') {
    const s = await sessionUser(kv, request);
    if (s) await kv.delete(`session:${s.token}`);
    return json({ ok: true }, 200, headers);
  }

  let body: { email?: string; password?: string; name?: string; agree?: boolean; marketing?: boolean };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid JSON' }, 400, headers);
  }
  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) return json({ error: '이메일 주소를 확인해 주세요.' }, 400, headers);

  if (path === '/auth/signup') {
    const name = (body.name ?? '').trim();
    if (!name || name.length > 30) return json({ error: '이름을 1~30자로 입력해 주세요.' }, 400, headers);
    if (password.length < 8 || password.length > 72) return json({ error: '비밀번호는 8자 이상으로 입력해 주세요.' }, 400, headers);
    if (body.agree !== true) return json({ error: '필수 약관에 동의해 주세요.' }, 400, headers);
    if (await kv.get(`user:${email}`)) return json({ error: '이미 가입된 이메일입니다.' }, 409, headers);
    const salt = randomHex(16);
    const user: StoredUser = {
      id: randomHex(8),
      email,
      name,
      salt,
      hash: await hashPassword(password, salt),
      createdAt: new Date().toISOString(),
      marketing: body.marketing === true,
    };
    await kv.put(`user:${email}`, JSON.stringify(user));
    return json({ token: await newSession(kv, email), user: publicUser(user) }, 201, headers);
  }

  if (path === '/auth/login') {
    const raw = await kv.get(`user:${email}`);
    const user = raw ? (JSON.parse(raw) as StoredUser) : null;
    // Hash even for unknown emails so response time does not reveal which emails exist.
    const hash = await hashPassword(password, user?.salt ?? '00'.repeat(16));
    if (!user || !sameString(hash, user.hash)) return json({ error: '이메일 또는 비밀번호가 맞지 않습니다.' }, 401, headers);
    return json({ token: await newSession(kv, email), user: publicUser(user) }, 200, headers);
  }

  return json({ error: 'not found' }, 404, headers);
}

// ---- Orders & payments (Toss Payments) -------------------------------------------------------

interface PublishedProduct {
  id: string;
  sample?: boolean;
  name: { value: string | null; status: string };
  price: { value: number | null; status: string };
  shipping?: { fee: number; freeOver?: number };
}

interface OrderLine {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

interface Order {
  orderId: string;
  status: 'PENDING' | 'PAID' | 'FAILED';
  createdAt: string;
  orderName: string;
  lines: OrderLine[];
  itemsTotal: number;
  shippingFee: number;
  amount: number;
  customer: { name: string; phone: string; email: string };
  shipping: { recipient: string; phone: string; zonecode: string; address: string; addressDetail: string; memo: string };
  payment?: { paymentKey: string; method?: string; approvedAt?: string; receiptUrl?: string };
}

const PENDING_TTL = 60 * 60 * 24; // unpaid orders vanish after a day
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** The figures a visitor may see about their own order. */
const orderSummary = (o: Order) => ({
  orderId: o.orderId,
  status: o.status,
  orderName: o.orderName,
  lines: o.lines,
  itemsTotal: o.itemsTotal,
  shippingFee: o.shippingFee,
  amount: o.amount,
  shipping: o.shipping,
  customer: { name: o.customer.name },
  payment: o.payment ? { method: o.payment.method, approvedAt: o.payment.approvedAt, receiptUrl: o.payment.receiptUrl } : undefined,
});

/** Reads one product from the published site — the only source of prices the Worker trusts. */
async function publishedProduct(env: Env, id: string): Promise<PublishedProduct | null> {
  if (!/^[a-z0-9-]{1,64}$/.test(id)) return null;
  const res = await fetch(new URL(`${id}/product.json`, env.PRODUCTS_BASE_URL).toString(), { cf: { cacheTtl: 60 } } as RequestInit);
  if (!res.ok) return null;
  const p = (await res.json()) as PublishedProduct;
  // Same rule as the site: only real products whose name and price were checked can be sold.
  if (p.sample || p.name?.status !== 'VERIFIED' || p.price?.status !== 'VERIFIED' || typeof p.price.value !== 'number') return null;
  return p;
}

/**
 * Shipping for a combined order: the highest single-item fee applies once, and it is waived when
 * the items total reaches that item's free-shipping threshold. Products marked free ship free.
 */
function shippingFor(products: PublishedProduct[], itemsTotal: number) {
  let fee = 0;
  let freeOver: number | undefined;
  for (const p of products) {
    const f = p.shipping?.fee ?? 0;
    if (f > fee) {
      fee = f;
      freeOver = p.shipping?.freeOver;
    }
  }
  return freeOver != null && itemsTotal >= freeOver ? 0 : fee;
}

async function handleOrders(path: string, request: Request, env: Env, headers: Record<string, string>): Promise<Response> {
  const kv = env.ORDERS!;

  if (path === '/admin/orders' && request.method === 'GET') {
    const token = /^Bearer (.+)$/.exec(request.headers.get('Authorization') ?? '')?.[1] ?? '';
    if (!env.ADMIN_TOKEN || !sameString(token, env.ADMIN_TOKEN)) return json({ error: 'unauthorized' }, 401, headers);
    const listed = await kv.list({ prefix: 'order:', limit: 100 });
    const orders = (await Promise.all(listed.keys.map((k) => kv.get(k.name)))).filter(Boolean).map((r) => JSON.parse(r!) as Order);
    return json({ orders: orders.filter((o) => o.status === 'PAID') }, 200, headers);
  }
  if (request.method !== 'POST') return json({ error: 'not found' }, 404, headers);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid JSON' }, 400, headers);
  }

  if (path === '/orders') {
    const items = Array.isArray(body.items) ? (body.items as { productId?: unknown; quantity?: unknown }[]) : [];
    if (!items.length || items.length > 20) return json({ error: '주문할 제품이 없습니다.' }, 400, headers);
    const c = (body.customer ?? {}) as Record<string, unknown>;
    const sh = (body.shipping ?? {}) as Record<string, unknown>;
    const customer = { name: clean(c.name, 30), phone: clean(c.phone, 20).replace(/[^0-9]/g, ''), email: clean(c.email, 120) };
    const shipping = {
      recipient: clean(sh.recipient, 30),
      phone: clean(sh.phone, 20).replace(/[^0-9]/g, ''),
      zonecode: clean(sh.zonecode, 10),
      address: clean(sh.address, 200),
      addressDetail: clean(sh.addressDetail, 100),
      memo: clean(sh.memo, 100),
    };
    if (!customer.name || !/^01[0-9]{8,9}$/.test(customer.phone) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email))
      return json({ error: '주문자 이름, 휴대폰 번호, 이메일을 확인해 주세요.' }, 400, headers);
    if (!shipping.recipient || !/^0[0-9]{8,10}$/.test(shipping.phone) || !/^[0-9]{5}$/.test(shipping.zonecode) || !shipping.address || !shipping.addressDetail)
      return json({ error: '받는 분, 연락처, 우편번호, 주소, 상세 주소를 확인해 주세요.' }, 400, headers);
    if (body.agree !== true) return json({ error: '주문 내용 확인 및 결제 진행에 동의해 주세요.' }, 400, headers);

    const merged = new Map<string, number>();
    for (const it of items) {
      const id = typeof it.productId === 'string' ? it.productId : '';
      const q = Number(it.quantity);
      if (!Number.isInteger(q) || q < 1 || q > 20) return json({ error: '수량을 확인해 주세요.' }, 400, headers);
      merged.set(id, (merged.get(id) ?? 0) + q);
    }
    const products: PublishedProduct[] = [];
    const lines: OrderLine[] = [];
    for (const [id, quantity] of merged) {
      const p = await publishedProduct(env, id);
      if (!p) return json({ error: '판매 중이 아닌 제품이 포함되어 있습니다.' }, 400, headers);
      products.push(p);
      lines.push({ productId: id, name: p.name.value ?? id, unitPrice: p.price.value!, quantity });
    }
    const itemsTotal = lines.reduce((n, l) => n + l.unitPrice * l.quantity, 0);
    const shippingFee = shippingFor(products, itemsTotal);
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const order: Order = {
      orderId: `LAGI-${date}-${randomHex(6).toUpperCase()}`,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      orderName: lines.length > 1 ? `${lines[0].name} 외 ${lines.length - 1}건` : lines[0].name,
      lines,
      itemsTotal,
      shippingFee,
      amount: itemsTotal + shippingFee,
      customer,
      shipping,
    };
    await kv.put(`order:${order.orderId}`, JSON.stringify(order), { expirationTtl: PENDING_TTL });
    return json(orderSummary(order), 201, headers);
  }

  if (path === '/payments/confirm') {
    const paymentKey = clean(body.paymentKey, 200);
    const orderId = clean(body.orderId, 64);
    const amount = Number(body.amount);
    const raw = await kv.get(`order:${orderId}`);
    if (!raw || !paymentKey) return json({ error: '주문을 찾을 수 없습니다.' }, 404, headers);
    const order = JSON.parse(raw) as Order;
    // Already paid with this payment (e.g. the success page was reloaded): answer the same again.
    if (order.status === 'PAID') {
      return order.payment?.paymentKey === paymentKey ? json(orderSummary(order), 200, headers) : json({ error: '이미 결제된 주문입니다.' }, 409, headers);
    }
    // The amount coming back from the browser must match what the server priced.
    if (amount !== order.amount) return json({ error: '결제 금액이 주문 금액과 다릅니다.' }, 400, headers);
    if (!env.TOSS_SECRET_KEY) return json({ error: '결제 승인 키가 설정되지 않았습니다.' }, 503, headers);

    const res = await fetch(`${env.TOSS_API_BASE || 'https://api.tosspayments.com'}/v1/payments/confirm`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${env.TOSS_SECRET_KEY}:`)}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `confirm-${orderId}`,
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });
    const toss = (await res.json().catch(() => ({}))) as {
      status?: string;
      method?: string;
      approvedAt?: string;
      totalAmount?: number;
      receipt?: { url?: string };
      message?: string;
      code?: string;
    };
    if (!res.ok || toss.status !== 'DONE' || toss.totalAmount !== order.amount) {
      return json({ error: toss.message ?? '결제 승인에 실패했습니다.', code: toss.code }, res.ok ? 502 : res.status, headers);
    }
    order.status = 'PAID';
    order.payment = { paymentKey, method: toss.method, approvedAt: toss.approvedAt, receiptUrl: toss.receipt?.url };
    await kv.put(`order:${order.orderId}`, JSON.stringify(order)); // paid orders are kept
    return json(orderSummary(order), 200, headers);
  }

  return json({ error: 'not found' }, 404, headers);
}

// ---- Realtime try-on (Decart Lucy VTON) ----------------------------------------------------

/** Seconds one realtime session may run — enforced by Decart through the token, not only the page. */
const REALTIME_SECONDS = 20;
/** Realtime sessions per visitor (IP) per day. */
const REALTIME_PER_IP = 3;

/**
 * POST /realtime/token — a short-lived Decart client token for one 20-second session.
 * POST /cutout — the product alone on white (cached), used as the garment reference.
 * The permanent Decart key stays here; usage is capped per visitor and per day (KV `MEDIA`).
 */
async function realtime(path: string, request: Request, env: Env, headers: Record<string, string>): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405, headers);
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';

  if (path === '/cutout') {
    if (throttled(`cutout:${ip}`, 10)) return json({ error: '잠시 후 다시 시도해 주세요.' }, 429, headers);
    let body: { productImage?: string; matte?: boolean };
    try {
      body = await request.json();
    } catch {
      return json({ error: 'invalid JSON' }, 400, headers);
    }
    const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
    const product = await fetchProductImage(body.productImage ?? '', allowed);
    if ('error' in product) return json({ error: product.error }, product.status, headers);
    if (body.matte) {
      const matte = env.GEMINI_API_KEY ? await productMatte(env, body.productImage!, product) : undefined;
      if (!matte) return json({ error: '제품 이미지를 준비하지 못했습니다.' }, 502, headers);
      return json({ matte: `data:${matte.mime};base64,${matte.data}` }, 200, headers);
    }
    const [{ cut }, desc] = env.GEMINI_API_KEY
      ? await Promise.all([productCutout(env, body.productImage!, product), productDescription(env, body.productImage!, product)])
      : [{}, {}];
    const img = cut ?? product;
    // descriptionNote: why there is no description (shown only in the response, for diagnosis).
    return json({ image: `data:${img.mime};base64,${img.data}`, cutout: !!cut, description: desc.text, descriptionNote: desc.note }, 200, headers);
  }

  if (!env.DECART_API_KEY) return json({ error: '실시간 착용은 아직 준비 중입니다.', reason: 'not_configured' }, 503, headers);
  if (throttled(`rt:${ip}`, 5)) return json({ error: '잠시 후 다시 시도해 주세요.' }, 429, headers);

  // Daily caps: per visitor, and for the whole site (the bill is per second).
  const day = new Date().toISOString().slice(0, 10);
  const kv = env.MEDIA;
  const ipKey = `rt:${day}:${ip}`;
  const allKey = `rt:${day}:all`;
  const used = Number((await kv?.get(ipKey)) ?? 0);
  const usedAll = Number((await kv?.get(allKey)) ?? 0);
  const dailyAll = Number(env.REALTIME_DAILY_SESSIONS ?? 100);
  const unlimited = (env.REALTIME_UNLIMITED ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const member = unlimited.length && env.USERS ? await sessionUser(env.USERS, request) : null;
  const vip = !!member && unlimited.includes(member.user.email.toLowerCase());
  if (!vip && used >= REALTIME_PER_IP) return json({ error: `실시간 착용은 하루 ${REALTIME_PER_IP}번까지 체험할 수 있습니다. 내일 다시 이용해 주세요.`, reason: 'daily_limit' }, 429, headers);
  if (!vip && usedAll >= dailyAll) return json({ error: '오늘 실시간 착용 체험이 모두 소진되었습니다. 사진 합성을 이용해 주세요.', reason: 'site_limit' }, 429, headers);

  const origins = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
  const res = await fetch('https://api.decart.ai/v1/client/tokens', {
    method: 'POST',
    headers: { 'X-API-KEY': env.DECART_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      expiresIn: 60, // enough to connect; an open session is capped by maxSessionDuration
      allowedModels: ['lucy-2.6'],
      allowedOrigins: origins,
      constraints: { realtime: { maxSessionDuration: REALTIME_SECONDS } },
    }),
  });
  if (!res.ok) {
    console.log('decart token error', res.status, (await res.text()).slice(0, 300));
    return json({ error: '실시간 착용 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.', reason: 'provider' }, 502, headers);
  }
  const token = (await res.json()) as { apiKey?: string; expiresAt?: string };
  if (!token.apiKey) return json({ error: '실시간 착용 서버에 연결하지 못했습니다.', reason: 'provider' }, 502, headers);
  if (vip) return json({ apiKey: token.apiKey, expiresAt: token.expiresAt, seconds: REALTIME_SECONDS, remainingToday: null }, 200, headers);
  await kv?.put(ipKey, String(used + 1), { expirationTtl: 60 * 60 * 26 });
  await kv?.put(allKey, String(usedAll + 1), { expirationTtl: 60 * 60 * 26 });
  return json({ apiKey: token.apiKey, expiresAt: token.expiresAt, seconds: REALTIME_SECONDS, remainingToday: REALTIME_PER_IP - used - 1 }, 200, headers);
}

// ---- Router ----------------------------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const headers = cors(origin, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });

    const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
    if (!origin || !allowed.includes(origin)) return json({ error: 'origin not allowed' }, 403, headers);

    const path = new URL(request.url).pathname.replace(/\/+$/, '') || '/';
    if (path === '/orders' || path === '/payments/confirm' || path === '/admin/orders') {
      if (!env.ORDERS || !env.PRODUCTS_BASE_URL) return json({ error: '온라인 결제가 아직 연결되지 않았습니다.' }, 503, headers);
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      if (throttled(`order:${ip}`, 20)) return json({ error: '잠시 후 다시 시도해 주세요.' }, 429, headers);
      return handleOrders(path, request, env, headers);
    }
    if (path === '/realtime/token' || path === '/cutout') return realtime(path, request, env, headers);
    if (path.startsWith('/auth/')) {
      if (!env.USERS) return json({ error: '회원 기능이 아직 연결되지 않았습니다.' }, 503, headers);
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      if (throttled(`auth:${ip}`, 20)) return json({ error: '잠시 후 다시 시도해 주세요.' }, 429, headers);
      return handleAuth(path, request, env.USERS, headers);
    }
    return tryOn(request, env, headers);
  },
};

/** POST / — compose the visitor photo with the product via Gemini. */
async function tryOn(request: Request, env: Env, headers: Record<string, string>): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405, headers);
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
  if (!env.GEMINI_API_KEY) return json({ error: 'server not configured' }, 500, headers);

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (throttled(ip, 10)) return json({ error: '요청이 많습니다. 1분 뒤에 다시 시도해 주세요.' }, 429, headers);

  let body: TryOnRequest;
  try {
    body = (await request.json()) as TryOnRequest;
  } catch {
    return json({ error: 'invalid JSON' }, 400, headers);
  }

  const person = parseDataUrl(body.person ?? '');
  if (!person) return json({ error: '사진 형식을 읽을 수 없습니다.' }, 400, headers);
  if (person.data.length * 0.75 > MAX_PERSON_BYTES) return json({ error: '사진이 너무 큽니다.' }, 413, headers);

  const product = await fetchProductImage(body.productImage, allowed);
  if ('error' in product) return json({ error: product.error }, product.status, headers);

  // Falls back to the original photo if the cut-out could not be made this time.
  const { cut: cutout, busy } = await productCutout(env, body.productImage, product);
  // Gemini is over its limit right now — asking again for the fitting would only wait longer.
  if (busy) return json({ error: 'AI 서버가 잠시 바쁩니다. 1분 뒤에 다시 시도해 주세요.', reason: 'busy' }, 503, headers);
  const ref = cutout ?? product;
  const out = await geminiImage(env, [
    { text: buildPrompt(body, !!cutout) },
    { inline_data: { mime_type: person.mime, data: person.data } },
    { inline_data: { mime_type: ref.mime, data: ref.data } },
  ]);
  if (!out.image) {
    const message =
      out.reason === 'busy'
        ? 'AI 서버가 잠시 바쁩니다. 1분 뒤에 다시 시도해 주세요.'
        : out.reason === 'blocked'
          ? 'AI가 이 사진은 처리하지 않았습니다. 한 사람만, 얼굴과 몸이 잘 보이는 다른 사진으로 시도해 주세요.'
          : '이번에는 AI가 이미지를 만들지 못했습니다. 밝고 정면에서 찍은 사진으로 다시 시도해 주세요.';
    // `detail` is what the model actually answered (finish reason, its words) — shown small, for diagnosis.
    return json({ error: message, reason: out.reason, detail: out.detail }, out.reason === 'busy' ? 503 : 502, headers);
  }
  return json({ image: out.image }, 200, headers);
}

/** Fetches a product photo — only ever from the LAGI site itself, never an arbitrary URL. */
async function fetchProductImage(
  url: string,
  allowed: string[],
): Promise<{ mime: string; data: string } | { error: string; status: number }> {
  let productUrl: URL;
  try {
    productUrl = new URL(url);
  } catch {
    return { error: 'invalid product image', status: 400 };
  }
  if (!allowed.includes(productUrl.origin)) return { error: 'product image not allowed', status: 400 };
  const res = await fetch(productUrl.toString());
  if (!res.ok) return { error: '상품 이미지를 불러오지 못했습니다.', status: 502 };
  const mime = (res.headers.get('Content-Type') ?? 'image/jpeg').split(';')[0];
  if (!/^image\/(jpeg|png|webp)$/.test(mime)) return { error: 'unsupported product image', status: 400 };
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_PRODUCT_BYTES) return { error: 'product image too large', status: 413 };
  return { mime, data: toBase64(buf) };
}

type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };

/**
 * Gemini image call with retries. The image model sometimes answers with text only, is briefly
 * overloaded (429/503) or blocks one attempt; asking again usually works, so up to three tries are
 * made before giving up. The first try asks for an image only, later tries also allow text.
 */
/**
 * Gemini's image model refuses calls from some locations ("User location is not supported for
 * the API use"). Calls therefore go through GeminiRelay, a Durable Object created in the western
 * US: wherever the visitor is, the request to Google leaves from there. Without the binding (e.g.
 * local tests) the call is made directly.
 */
async function callGemini(env: Env, body: string, model = env.GEMINI_MODEL): Promise<Response> {
  if (env.RELAY) {
    const stub = env.RELAY.get(env.RELAY.idFromName('gemini-us-west'), { locationHint: 'wnam' });
    return stub.fetch('https://relay/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-model': model }, body });
  }
  return geminiFetch(env.GEMINI_API_KEY, model, body);
}

function geminiFetch(key: string, model: string, body: string) {
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body,
  });
}

/** Where a request leaves Cloudflare from (colo and country), for the failure note. */
async function egress(): Promise<string> {
  try {
    const t = await (await fetch('https://cloudflare.com/cdn-cgi/trace')).text();
    return `${/colo=(\w+)/.exec(t)?.[1] ?? '?'}/${/loc=(\w+)/.exec(t)?.[1] ?? '?'}`;
  } catch {
    return '?';
  }
}

/** Durable Object that makes the Gemini call from its own (western US) location. */
export class GeminiRelay {
  constructor(
    private state: unknown,
    private env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const res = await geminiFetch(this.env.GEMINI_API_KEY, request.headers.get('x-model') || this.env.GEMINI_MODEL, await request.text());
    const headers = new Headers(res.headers);
    // On a refusal, say where the call left from — the visible clue when location is the problem.
    if (!res.ok) headers.set('x-lagi-egress', `relay ${await egress()}`);
    return new Response(res.body, { status: res.status, headers });
  }
}

type GeminiResult = { image?: string; reason?: 'busy' | 'blocked' | 'no_image' | 'error'; detail?: string };

// People photos trip the general filters more often than they should; only clearly harmful content is blocked.
const SAFETY = ['HARM_CATEGORY_HARASSMENT', 'HARM_CATEGORY_HATE_SPEECH', 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'HARM_CATEGORY_DANGEROUS_CONTENT'].map((category) => ({
  category,
  threshold: 'BLOCK_ONLY_HIGH',
}));

async function geminiImage(env: Env, parts: GeminiPart[]): Promise<GeminiResult> {
  let reason: GeminiResult['reason'] = 'no_image';
  let detail = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, reason === 'busy' ? 2000 * attempt : 800 * attempt));
    // When the model answered with words instead of a picture, ask again — firmly — for the picture.
    const askParts: GeminiPart[] =
      attempt > 0 && reason === 'no_image'
        ? [...parts, { text: 'Respond with the edited image only. Do not reply with text; always return an image.' }]
        : parts;
    const res = await callGemini(
      env,
      JSON.stringify({
        contents: [{ role: 'user', parts: askParts }],
        generationConfig: { responseModalities: attempt === 0 ? ['IMAGE'] : ['TEXT', 'IMAGE'] },
        safetySettings: SAFETY,
      }),
    );
    if (!res.ok) {
      const text = (await res.text()).slice(0, 300);
      console.log('gemini error', attempt, res.status, text);
      reason = res.status === 429 || res.status === 503 ? 'busy' : 'error';
      detail = `HTTP ${res.status} ${(/"message":\s*"([^"]{0,120})/.exec(text)?.[1] ?? '').trim()} [via ${res.headers.get('x-lagi-egress') ?? 'direct'}]`;
      // A bad request will not get better by repeating it — unless it was the image-only setting.
      if (res.status === 400 && attempt > 0) return { reason, detail };
      continue;
    }
    const result = (await res.json()) as {
      promptFeedback?: { blockReason?: string };
      candidates?: {
        finishReason?: string;
        content?: { parts?: { text?: string; inlineData?: { mimeType: string; data: string }; inline_data?: { mime_type: string; data: string } }[] };
      }[];
    };
    const got = result.candidates?.[0]?.content?.parts ?? [];
    for (const part of got) {
      const img = part.inlineData ?? (part.inline_data && { mimeType: part.inline_data.mime_type, data: part.inline_data.data });
      if (img?.data) return { image: `data:${img.mimeType};base64,${img.data}` };
    }
    const finish = result.candidates?.[0]?.finishReason ?? '';
    const said = got.map((p) => p.text ?? '').join(' ').replace(/\s+/g, ' ').trim();
    const blocked = !!result.promptFeedback?.blockReason || /SAFETY|PROHIBITED|BLOCKLIST|RECITATION/.test(finish);
    console.log('gemini no image', attempt, finish, result.promptFeedback?.blockReason, said.slice(0, 200));
    reason = blocked ? 'blocked' : 'no_image';
    detail = [finish || result.promptFeedback?.blockReason || 'NO_IMAGE', said.slice(0, 140)].filter(Boolean).join(' · ');
    // The same photo will be blocked again; stop early.
    if (blocked && attempt >= 1) return { reason, detail };
  }
  return { reason, detail };
}
