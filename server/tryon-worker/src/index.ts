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
  /** AI photo fittings allowed per day across the whole site (cost cap; each is 1–2 Gemini calls). Default 300. */
  TRYON_DAILY_SITE?: string;
  /** AI photo fittings per visitor address per day. Default 12. */
  TRYON_DAILY_PER_IP?: string;
  /** Realtime sessions allowed per day across the whole site (cost cap). Default 100. */
  REALTIME_DAILY_SESSIONS?: string;
  /** Gemini relay pinned to the western US (Durable Object) — see GeminiRelay below. Optional. */
  /** Atomic daily counters for the AI-photo cost caps (Durable Object `QuotaCounter`). Without it the caps fall back to KV, which is NOT atomic. */
  QUOTA?: { idFromName(name: string): unknown; get(id: unknown): { fetch(input: string, init?: RequestInit): Promise<Response> } };
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
  /**
   * What happens to a member's reviews when they delete their account: "keep-anonymous" (the review
   * stays, without name or email) or "delete". Until the owner sets it, account deletion answers 503
   * and points to the help channel — the policy is the owner's decision, not the code's.
   */
  WITHDRAW_REVIEW_POLICY?: string;
  /** Which photo-fitting prompt to use: "v2" for the improved one. Unset = v1 (the prompt used so far). */
  PROMPT_VERSION?: string;
  /** Optional Cloudflare Rate Limiting binding for log-in attempts ([[ratelimits]] in wrangler.toml). */
  LOGIN_LIMIT?: { limit(options: { key: string }): Promise<{ success: boolean }> };
  /** Token for reading orders (GET /admin/orders) — `npx wrangler secret put ADMIN_TOKEN`. */
  ADMIN_TOKEN?: string;
}

export interface TryOnRequest {
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
  /** Plain facts about the product from the site's own data (kind, handle drop …), short. Used by prompt v2. */
  facts?: string;
  /**
   * Absolute URLs of up to 3 flat, unretouched photos of the product's real surfaces (the ones the 3D model is
   * textured with). Sent as extra references so printed lettering and graphics can be copied from the real thing
   * instead of from the AI-redrawn cut-out. Only used with prompt v2; same-origin only.
   */
  faces?: string[];
  /** "v2" asks for the improved prompt on this request (otherwise the PROMPT_VERSION setting decides; default v1). */
  promptVersion?: string;
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
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
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

/**
 * Prompt v2 — same job, stricter and more specific. Adds: the product's own facts, a list of what must
 * not change in the product and in the person, exactly one product, the physical way each carry style
 * hangs, and "keep the framing". It is only used when asked for (`promptVersion: "v2"` in the request or
 * PROMPT_VERSION="v2"); whether it is better than v1 has to be judged on real generations
 * (scripts/ai-fitting-ab.mjs) — it was not measured with paid calls.
 */
export function buildPromptV2(r: TryOnRequest, cutout: boolean, faceCount = 0) {
  const style = (r.style ?? '').slice(0, 200);
  const facts = (r.facts ?? '').slice(0, 300);
  const name = [r.productName?.slice(0, 120), r.category?.slice(0, 40)].filter(Boolean).join(', ');
  const carry = /shoulder/i.test(style)
    ? 'The handles or strap rest on the shoulder and the bag hangs down the same side of the body at about hip height, the strap taut where it carries the weight.'
    : /cross/i.test(style)
      ? 'The strap runs diagonally across the chest from one shoulder to the opposite hip, and the bag sits against the hip.'
      : /hand|hold/i.test(style)
        ? "The person's own hand grips the handle at the top; the bag hangs straight down below the fist under gravity, fingers wrapped around the handle (never through the bag), the bag body in front of the leg and not floating."
        : '';
  return [
    'You are a virtual fitting room for a bag brand. Image 1 is a photo of a person. Image 2 shows ONLY the product' + (name ? ` (${name})` : '') + (cutout ? ' on a plain background' : '') + ' — it is the exact design to reproduce.',
    `Create one photorealistic photo of the SAME person from image 1 carrying exactly ONE of that product${style ? `, ${style}` : ''}.`,
    facts ? `Product facts: ${facts}.` : '',
    r.size ? `Real size ${r.size}: scale it to the person's body accordingly (do not make it larger or smaller than that).` : "Scale the product realistically to the person's body.",
    carry,
    'KEEP THE PERSON: the same face, identity, hair, skin, body shape, clothing, pose and background as in image 1. Only the arm and hand that hold or wear the product may move, and only as far as needed. No extra people.',
    'ANATOMY: exactly two arms and two hands with five fingers each, all belonging to this person; never add a hand, arm or finger, and take no hands, arms, bodies or background from image 2.',
    'KEEP THE PRODUCT: the same shape, proportions, colours, materials, hardware (zippers, buckles, clips, rings), handles and straps, and the same prints and lettering — letters must keep their spelling, orientation and position; do not redraw, translate, simplify or add logos. Do not add other bags or accessories.',
    faceCount > 0
      ? `Image${faceCount > 1 ? 's' : ''} 3${faceCount > 1 ? `–${2 + faceCount}` : ''} ${faceCount > 1 ? 'are' : 'is a'} flat, unretouched photo${faceCount > 1 ? 's' : ''} of the product's real surface${faceCount > 1 ? 's' : ''}: copy printed lettering, graphics, colours and material texture exactly from ${faceCount > 1 ? 'them' : 'it'} (they show surface only, not the product's outline — take the outline from image 2).`
      : '',
    'LIGHT AND CONTACT: match the light direction, colour and shadows of image 1; give the product a soft contact shadow and let the body or hand overlap it where it naturally would.',
    'FRAMING: output the same framing and aspect ratio as image 1, without cropping or zooming. Return only the edited photo.',
  ]
    .filter(Boolean)
    .join(' ');
}

export function buildPrompt(r: TryOnRequest, cutout: boolean) {
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

/**
 * Removes a member: their reviews (deleted or kept without name/email, per the owner's policy), the
 * links from their account to their orders (the order records themselves are kept, untouched — how long
 * paid orders must be kept is a legal question for the owner), every login session, and the account.
 */
async function deleteMember(env: Env, user: StoredUser, policy: 'keep-anonymous' | 'delete') {
  const users = env.USERS!;
  const email = user.email.toLowerCase();
  const orders = env.ORDERS;
  let reviews = 0;
  let orderLinks = 0;
  if (orders) {
    const mine = await orders.list({ prefix: `reviewby:${email}:`, limit: 1000 });
    for (const k of mine.keys) {
      const productId = k.name.split(':').pop()!;
      const id = await orders.get(k.name);
      const key = `review:${productId}:${id}`;
      const raw = id ? await orders.get(key) : null;
      if (raw) {
        if (policy === 'delete') {
          await Promise.all([orders.delete(key), orders.delete(`reviewall:${id}`), env.MEDIA?.delete(`review-img:${id}`)]);
        } else {
          const r = JSON.parse(raw) as Review;
          await orders.put(key, JSON.stringify({ ...r, author: '탈퇴 회원', email: '' }));
        }
        reviews++;
      }
      await orders.delete(k.name);
    }
    const links = await orders.list({ prefix: `byemail:${email}:`, limit: 1000 });
    for (const k of links.keys) await orders.delete(k.name);
    orderLinks = links.keys.length;
  }
  // Sessions are keyed by token; drop every one that points at this account.
  let cursor: string | undefined;
  let scanned = 0;
  do {
    const page = await users.list({ prefix: 'session:', cursor, limit: 1000 });
    for (const k of page.keys) if ((await users.get(k.name)) === email) await users.delete(k.name);
    scanned += page.keys.length;
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor && scanned < 20_000);
  await Promise.all([users.delete(`user:${email}`), users.delete(`loginfail:${email}`)]);
  return { reviews, orderLinks };
}

/** Failed log-ins per email: after LOGIN_MAX_FAILS the address is locked for LOGIN_LOCK_SECONDS. */
const LOGIN_MAX_FAILS = 10;
const LOGIN_LOCK_SECONDS = 15 * 60;

async function sessionUser(kv: KV, request: Request): Promise<{ token: string; user: StoredUser } | null> {
  const token = /^Bearer ([0-9a-f]{64})$/.exec(request.headers.get('Authorization') ?? '')?.[1];
  if (!token) return null;
  const email = await kv.get(`session:${token}`);
  const raw = email && (await kv.get(`user:${email}`));
  return raw ? { token, user: JSON.parse(raw) as StoredUser } : null;
}

async function handleAuth(path: string, request: Request, env: Env, headers: Record<string, string>): Promise<Response> {
  const kv = env.USERS!;
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
    const locked = { error: '로그인 시도가 너무 많습니다. 15분 후 다시 시도해 주세요.', reason: 'locked' };
    // Cloudflare's rate limiter (if bound) per address + IP; then the per-email lock kept in KV.
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    if (env.LOGIN_LIMIT && !(await env.LOGIN_LIMIT.limit({ key: `${email}|${ip}` })).success) return json(locked, 429, headers);
    const failKey = `loginfail:${email}`;
    const failRaw = await kv.get(failKey);
    const fail = failRaw ? (JSON.parse(failRaw) as { n: number; until?: number }) : { n: 0 };
    if (fail.until && fail.until > Date.now()) return json(locked, 429, headers);
    const raw = await kv.get(`user:${email}`);
    const user = raw ? (JSON.parse(raw) as StoredUser) : null;
    // Hash even for unknown emails so response time does not reveal which emails exist.
    const hash = await hashPassword(password, user?.salt ?? '00'.repeat(16));
    if (!user || !sameString(hash, user.hash)) {
      const n = (fail.until ? 0 : fail.n) + 1; // a lock that ran out starts a fresh count
      const next = n >= LOGIN_MAX_FAILS ? { n, until: Date.now() + LOGIN_LOCK_SECONDS * 1000 } : { n };
      await kv.put(failKey, JSON.stringify(next), { expirationTtl: LOGIN_LOCK_SECONDS });
      return json(n >= LOGIN_MAX_FAILS ? locked : { error: '이메일 또는 비밀번호가 맞지 않습니다.' }, n >= LOGIN_MAX_FAILS ? 429 : 401, headers);
    }
    if (failRaw) await kv.delete(failKey);
    return json({ token: await newSession(kv, email), user: publicUser(user) }, 200, headers);
  }

  // Account deletion: the member proves it is them (session + password, typed confirmation).
  if (path === '/auth/delete') {
    const me = await sessionUser(kv, request);
    if (!me) return json({ error: '로그인이 필요합니다.' }, 401, headers);
    if (me.user.email.toLowerCase() !== email) return json({ error: '로그인한 계정의 이메일을 입력해 주세요.' }, 403, headers);
    const check = await hashPassword(password, me.user.salt);
    if (!sameString(check, me.user.hash)) return json({ error: '비밀번호가 맞지 않습니다.' }, 403, headers);
    if ((body as { confirm?: string }).confirm !== '탈퇴') return json({ error: '확인 문구를 정확히 입력해 주세요.' }, 400, headers);
    const policy = env.WITHDRAW_REVIEW_POLICY;
    if (policy !== 'keep-anonymous' && policy !== 'delete')
      return json({ error: '온라인 회원 탈퇴는 준비 중입니다. 인스타그램 DM으로 요청해 주시면 처리해 드립니다.', reason: 'not_configured' }, 503, headers);
    const result = await deleteMember(env, me.user, policy);
    return json({ ok: true, ...result, reviewPolicy: policy }, 200, headers);
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
  /** The member account that placed the order (from its login session, set by the server). Guest orders have none. */
  memberEmail?: string;
}

const PENDING_TTL = 60 * 60 * 24; // unpaid orders vanish after a day

/**
 * Paid orders that belong to this member account. An order belongs to an account only if it was placed
 * while logged in to it (memberEmail, set by the server) — never because the checkout form had the same
 * email, which anyone can type or register without proving they own it.
 */
async function memberOrders(kv: KV, email: string, limit: number): Promise<Order[]> {
  const listed = await kv.list({ prefix: `byemail:${email}:`, limit });
  const raws = await Promise.all(listed.keys.map((k) => kv.get(`order:${k.name.split(':').pop()}`)));
  return raws
    .filter(Boolean)
    .map((r) => JSON.parse(r!) as Order)
    .filter((o) => o.status === 'PAID' && o.memberEmail === email);
}
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
  if (path === '/orders/mine' && request.method === 'GET') {
    const me = env.USERS ? await sessionUser(env.USERS, request) : null;
    if (!me) return json({ error: '로그인이 필요합니다.' }, 401, headers);
    const orders = (await memberOrders(kv, me.user.email.toLowerCase(), 50)).map(orderSummary);
    orders.sort((a, b) => (a.orderId < b.orderId ? 1 : -1));
    return json({ orders }, 200, headers);
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
    // Logged in: the order belongs to that account (the server decides, not the form's email field).
    const member = env.USERS ? await sessionUser(env.USERS, request) : null;
    if (member) order.memberEmail = member.user.email.toLowerCase();
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
    // Index member orders by their account: members see their orders, and reviews of bought products are marked.
    // Guest orders are not linked to any account; they are found with order number + phone (/orders/lookup).
    if (order.memberEmail) await kv.put(`byemail:${order.memberEmail}:${order.orderId}`, order.lines.map((l) => l.productId).join(','));
    return json(orderSummary(order), 200, headers);
  }

  // Guest order lookup: order number + the phone number given at checkout.
  if (path === '/orders/lookup') {
    const orderId = clean(body.orderId, 64).toUpperCase();
    const phone = clean(body.phone, 20).replace(/[^0-9]/g, '');
    const raw = /^LAGI-\d{8}-[0-9A-F]{6,16}$/.test(orderId) ? await kv.get(`order:${orderId}`) : null;
    const order = raw ? (JSON.parse(raw) as Order) : null;
    if (!order || !phone || (order.customer.phone !== phone && order.shipping.phone !== phone))
      return json({ error: '주문 번호와 휴대폰 번호를 확인해 주세요.' }, 404, headers);
    return json(orderSummary(order), 200, headers);
  }

  return json({ error: 'not found' }, 404, headers);
}

// ---- Reviews ---------------------------------------------------------------------------------
// Members write one review per product (rating, text, optional photo). Stored in ORDERS KV:
//   review:<productId>:<newest-first key>   the review
//   reviewall:<newest-first key>            pointer, for the all-reviews page
//   reviewby:<email>:<productId>            one per member per product
// Photos live in MEDIA as review-img:<id>.

interface Review {
  id: string;
  productId: string;
  productName: string;
  author: string;
  email: string;
  rating: number;
  text: string;
  photo: boolean;
  verified: boolean;
  createdAt: string;
}

const REVIEW_PAGE = 10;
const MAX_REVIEW_PHOTO = 900_000; // base64 chars (~650 KB JPEG)
const maskName = (n: string) => (n.length <= 1 ? `${n}*` : `${n[0]}${'*'.repeat(Math.min(3, n.length - 1))}`);
const publicReview = (r: Review) => ({ id: r.id, productId: r.productId, productName: r.productName, author: r.author, rating: r.rating, text: r.text, photo: r.photo, verified: r.verified, createdAt: r.createdAt });

async function handleReviews(path: string, request: Request, env: Env, headers: Record<string, string>): Promise<Response> {
  const kv = env.ORDERS!;
  const url = new URL(request.url);

  if (path.startsWith('/reviews/photo/') && request.method === 'GET') {
    const id = path.slice('/reviews/photo/'.length);
    const data = /^[0-9a-z-]{8,60}$/.test(id) ? await env.MEDIA?.get(`review-img:${id}`) : null;
    if (!data) return json({ error: 'not found' }, 404, headers);
    const bin = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    return new Response(bin, { headers: { ...headers, 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' } });
  }

  if (path === '/reviews' && request.method === 'GET') {
    const product = url.searchParams.get('product') ?? '';
    const page = Math.max(1, Math.min(50, Number(url.searchParams.get('page')) || 1));
    const prefix = product ? `review:${product}:` : 'reviewall:';
    if (product && !/^[a-z0-9-]{1,64}$/.test(product)) return json({ error: 'invalid product' }, 400, headers);
    // KV lists keys in order; the key starts with an inverted time, so the newest come first.
    const keys: string[] = [];
    let cursor: string | undefined;
    do {
      const l = await kv.list({ prefix, cursor, limit: 1000 });
      keys.push(...l.keys.map((k) => k.name));
      cursor = l.list_complete ? undefined : l.cursor;
    } while (cursor && keys.length < 2000);
    const slice = keys.slice((page - 1) * REVIEW_PAGE, page * REVIEW_PAGE);
    const raws = await Promise.all(slice.map(async (k) => (product ? kv.get(k) : kv.get((await kv.get(k)) ?? ''))));
    const viewer = env.USERS && request.headers.get('Authorization') ? await sessionUser(env.USERS, request) : null;
    const reviews = raws.filter(Boolean).map((raw) => {
      const r = JSON.parse(raw!) as Review;
      return { ...publicReview(r), mine: !!viewer && viewer.user.email.toLowerCase() === r.email };
    });
    return json({ reviews, total: keys.length, page, pages: Math.max(1, Math.ceil(keys.length / REVIEW_PAGE)) }, 200, headers);
  }

  const me = env.USERS ? await sessionUser(env.USERS, request) : null;
  if (!me) return json({ error: '로그인한 회원만 구매평을 쓸 수 있습니다.' }, 401, headers);
  const email = me.user.email.toLowerCase();

  if (path === '/reviews' && request.method === 'POST') {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'invalid JSON' }, 400, headers);
    }
    const productId = clean(body.productId, 64);
    const product = await publishedProduct(env, productId);
    if (!product) return json({ error: '판매 중인 제품에만 구매평을 쓸 수 있습니다.' }, 400, headers);
    const rating = Number(body.rating);
    const text = clean(body.text, 1000);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return json({ error: '별점을 선택해 주세요.' }, 400, headers);
    if (text.length < 10) return json({ error: '구매평은 10자 이상 써 주세요.' }, 400, headers);
    if (await kv.get(`reviewby:${email}:${productId}`)) return json({ error: '이 제품에는 이미 구매평을 남겼습니다.' }, 409, headers);
    const photo = typeof body.photo === 'string' ? /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(body.photo)?.[1] : undefined;
    if (body.photo && !photo) return json({ error: '사진은 JPEG로 올려 주세요.' }, 400, headers);
    if (photo && photo.length > MAX_REVIEW_PHOTO) return json({ error: '사진 용량이 너무 큽니다.' }, 413, headers);

    const verified = (await memberOrders(kv, email, 100)).some((o) => o.lines.some((l) => l.productId === productId));
    const now = Date.now();
    const id = `${(9_999_999_999_999 - now).toString().padStart(13, '0')}-${randomHex(4)}`;
    const review: Review = {
      id,
      productId,
      productName: product.name.value ?? productId,
      author: maskName(me.user.name || email.split('@')[0]),
      email,
      rating,
      text,
      photo: !!photo,
      verified,
      createdAt: new Date(now).toISOString(),
    };
    if (photo) await env.MEDIA?.put(`review-img:${id}`, photo);
    await kv.put(`review:${productId}:${id}`, JSON.stringify(review));
    await kv.put(`reviewall:${id}`, `review:${productId}:${id}`);
    await kv.put(`reviewby:${email}:${productId}`, id);
    return json(publicReview(review), 201, headers);
  }

  if (path.startsWith('/reviews/') && request.method === 'DELETE') {
    const [productId, id] = path.slice('/reviews/'.length).split('/');
    const raw = productId && id ? await kv.get(`review:${productId}:${id}`) : null;
    const review = raw ? (JSON.parse(raw) as Review) : null;
    if (!review) return json({ error: '구매평을 찾을 수 없습니다.' }, 404, headers);
    if (review.email !== email) return json({ error: '내가 쓴 구매평만 지울 수 있습니다.' }, 403, headers);
    await Promise.all([kv.delete(`review:${productId}:${id}`), kv.delete(`reviewall:${id}`), kv.delete(`reviewby:${email}:${productId}`), env.MEDIA?.delete(`review-img:${id}`)]);
    return json({ ok: true }, 200, headers);
  }

  // Which products this member already reviewed (to hide the form).
  if (path === '/reviews/mine' && request.method === 'GET') {
    const l = await kv.list({ prefix: `reviewby:${email}:`, limit: 200 });
    return json({ products: l.keys.map((k) => k.name.split(':').pop()) }, 200, headers);
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

    const path = new URL(request.url).pathname.replace(/\/+$/, '') || '/';
    // Review photos are public images loaded by <img> tags, which send no Origin header.
    if (path.startsWith('/reviews/photo/') && request.method === 'GET' && env.ORDERS) return handleReviews(path, request, env, headers);

    const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
    if (!origin || !allowed.includes(origin)) return json({ error: 'origin not allowed' }, 403, headers);

    if (path === '/reviews' || path.startsWith('/reviews/')) {
      if (!env.ORDERS || !env.PRODUCTS_BASE_URL) return json({ error: '구매평 기능이 아직 연결되지 않았습니다.' }, 503, headers);
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      if (request.method !== 'GET' && throttled(`review:${ip}`, 10)) return json({ error: '잠시 후 다시 시도해 주세요.' }, 429, headers);
      return handleReviews(path, request, env, headers);
    }
    if (path === '/orders' || path === '/orders/lookup' || path === '/orders/mine' || path === '/payments/confirm' || path === '/admin/orders') {
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
      return handleAuth(path, request, env, headers);
    }
    return tryOn(request, env, headers);
  },
};

const TRYON_SITE_DEFAULT = 300;
const TRYON_PER_IP_DEFAULT = 12;

/**
 * Returns a refusal when today's AI-photo budget is used up; otherwise counts this fitting and returns null.
 *
 * With the QUOTA Durable Object bound, the check-and-count is ATOMIC: one object per day handles requests one at a
 * time, so N simultaneous requests can never get past the cap. Without it (local tests, or before the binding is
 * deployed) it falls back to KV, which is read-then-write and therefore only an approximate cap under bursts.
 */
async function tryOnQuota(env: Env, ip: string): Promise<{ reason: string; message: string } | null> {
  const day = new Date().toISOString().slice(0, 10);
  const siteCap = Number(env.TRYON_DAILY_SITE ?? TRYON_SITE_DEFAULT);
  const ipCap = Number(env.TRYON_DAILY_PER_IP ?? TRYON_PER_IP_DEFAULT);
  const refuse = (reason: string | undefined) =>
    reason === 'daily_limit'
      ? { reason, message: `AI 사진 합성은 하루 ${ipCap}번까지 이용할 수 있습니다. 내일 다시 이용해 주세요.` }
      : { reason: 'site_limit', message: '오늘 AI 사진 합성 이용량이 모두 소진되었습니다. 내일 다시 이용해 주세요.' };
  if (env.QUOTA) {
    const stub = env.QUOTA.get(env.QUOTA.idFromName(`tryon:${day}`));
    const res = await stub.fetch('https://quota/take', { method: 'POST', body: JSON.stringify({ ip, siteCap, ipCap }) });
    const out = (await res.json()) as { ok: boolean; reason?: string };
    return out.ok ? null : refuse(out.reason);
  }
  const kv = env.MEDIA;
  if (!kv) return null; // no storage bound (local tests): no cap
  const siteKey = `tryon:${day}:all`;
  const ipKey = `tryon:${day}:${ip}`;
  const site = Number((await kv.get(siteKey)) ?? 0);
  const mine = Number((await kv.get(ipKey)) ?? 0);
  if (mine >= ipCap) return refuse('daily_limit');
  if (site >= siteCap) return refuse('site_limit');
  const ttl = { expirationTtl: 60 * 60 * 26 };
  await kv.put(ipKey, String(mine + 1), ttl);
  await kv.put(siteKey, String(site + 1), ttl);
  return null;
}

/**
 * Durable Object: the day's AI-photo counters. A Durable Object runs one request at a time between its storage
 * operations (input gates), so read-check-write here cannot interleave — which is what makes the cap hold under bursts.
 * One instance per day (`tryon:<date>`); old days simply stop being used.
 */
export class QuotaCounter {
  constructor(private state: { storage: { get(k: string): Promise<unknown>; put(k: string, v: unknown): Promise<void> } }) {}

  async fetch(request: Request): Promise<Response> {
    const { ip, siteCap, ipCap } = (await request.json()) as { ip: string; siteCap: number; ipCap: number };
    const site = Number((await this.state.storage.get('all')) ?? 0);
    const mine = Number((await this.state.storage.get(`ip:${ip}`)) ?? 0);
    if (mine >= ipCap) return Response.json({ ok: false, reason: 'daily_limit' });
    if (site >= siteCap) return Response.json({ ok: false, reason: 'site_limit' });
    await this.state.storage.put('all', site + 1);
    await this.state.storage.put(`ip:${ip}`, mine + 1);
    return Response.json({ ok: true });
  }
}

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
  // Daily cost caps (site-wide and per visitor address). Counted before the paid call, so a failed call still counts
  // (Google may bill it too). KV is not atomic: a burst can overshoot by about the per-minute throttle, never unbounded.
  const quota = await tryOnQuota(env, ip);
  if (quota) return json({ error: quota.message, reason: quota.reason }, 429, headers);

  const { cut: cutout, busy } = await productCutout(env, body.productImage, product);
  // Gemini is over its limit right now — asking again for the fitting would only wait longer.
  if (busy) return json({ error: 'AI 서버가 잠시 바쁩니다. 1분 뒤에 다시 시도해 주세요.', reason: 'busy' }, 503, headers);
  const ref = cutout ?? product;
  const v2 = body.promptVersion === 'v2' || env.PROMPT_VERSION === 'v2';
  // Real surface photos as extra references (prompt v2 only; same-origin only; a failed fetch just skips that one).
  const faces: { mime: string; data: string }[] = [];
  if (v2 && Array.isArray(body.faces))
    for (const u of body.faces.slice(0, 3)) {
      const f = typeof u === 'string' ? await fetchProductImage(u, allowed) : null;
      if (f && !('error' in f)) faces.push(f);
    }
  const out = await geminiImage(env, [
    { text: v2 ? buildPromptV2(body, !!cutout, faces.length) : buildPrompt(body, !!cutout) },
    { inline_data: { mime_type: person.mime, data: person.data } },
    { inline_data: { mime_type: ref.mime, data: ref.data } },
    ...faces.map((f) => ({ inline_data: { mime_type: f.mime, data: f.data } })),
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
