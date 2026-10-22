/**
 * LAGI AI try-on proxy (Cloudflare Worker).
 *
 * The website sends a visitor's photo and a product; this Worker asks Google's Gemini image model
 * to compose a photo of that person wearing/carrying the product and returns the image. It exists
 * so the Gemini API key stays secret — it is never shipped to the browser. Nothing is stored.
 */

export interface Env {
  /** Google AI Studio API key — set with `npx wrangler secret put GEMINI_API_KEY`. */
  GEMINI_API_KEY: string;
  /** Gemini image model id, e.g. "gemini-2.5-flash-image". Set in wrangler.toml [vars]. */
  GEMINI_MODEL: string;
  /** Comma-separated site origins allowed to call this Worker and to serve product images. */
  ALLOWED_ORIGINS: string;
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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
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

function buildPrompt(r: TryOnRequest) {
  const what = [r.productName, r.category].filter(Boolean).join(', ');
  return [
    'You are a virtual fitting room. Image 1 is a photo of a person. Image 2 shows a product' + (what ? ` (${what})` : '') + '.',
    'Create one photorealistic photo of the SAME person from image 1 naturally wearing or carrying the product from image 2' +
      (r.style ? `, ${r.style}` : '') + '.',
    "Keep the person's face, identity, body shape, pose, hair, outfit and the background exactly as in image 1.",
    'Reproduce the product faithfully: same shape, colours, prints, text, materials, hardware and proportions as in image 2. Ignore any person or background in image 2.',
    r.size ? `The product's real size is ${r.size}; scale it realistically to the person's body.` : 'Scale the product realistically to the body.',
    'Match the lighting, perspective and shadows of image 1 so the product looks physically present (straps resting on the shoulder or held in the hand, natural contact shadows).',
    'Return only the edited photo.',
  ].join(' ');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const headers = cors(origin, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405, headers);

    const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
    if (!origin || !allowed.includes(origin)) return json({ error: 'origin not allowed' }, 403, headers);
    if (!env.GEMINI_API_KEY) return json({ error: 'server not configured' }, 500, headers);

    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    if (throttled(ip)) return json({ error: '잠시 후 다시 시도해 주세요.' }, 429, headers);

    let body: TryOnRequest;
    try {
      body = (await request.json()) as TryOnRequest;
    } catch {
      return json({ error: 'invalid JSON' }, 400, headers);
    }

    const person = parseDataUrl(body.person ?? '');
    if (!person) return json({ error: '사진 형식을 읽을 수 없습니다.' }, 400, headers);
    if (person.data.length * 0.75 > MAX_PERSON_BYTES) return json({ error: '사진이 너무 큽니다.' }, 413, headers);

    let productUrl: URL;
    try {
      productUrl = new URL(body.productImage);
    } catch {
      return json({ error: 'invalid product image' }, 400, headers);
    }
    // Only fetch product images from the LAGI site itself — never arbitrary URLs.
    if (!allowed.includes(productUrl.origin)) return json({ error: 'product image not allowed' }, 400, headers);
    const productRes = await fetch(productUrl.toString());
    if (!productRes.ok) return json({ error: '상품 이미지를 불러오지 못했습니다.' }, 502, headers);
    const productMime = (productRes.headers.get('Content-Type') ?? 'image/jpeg').split(';')[0];
    if (!/^image\/(jpeg|png|webp)$/.test(productMime)) return json({ error: 'unsupported product image' }, 400, headers);
    const productBuf = await productRes.arrayBuffer();
    if (productBuf.byteLength > MAX_PRODUCT_BYTES) return json({ error: 'product image too large' }, 413, headers);

    const gemini = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: buildPrompt(body) },
                { inline_data: { mime_type: person.mime, data: person.data } },
                { inline_data: { mime_type: productMime, data: toBase64(productBuf) } },
              ],
            },
          ],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        }),
      }
    );

    if (!gemini.ok) {
      const detail = await gemini.text();
      console.log('gemini error', gemini.status, detail.slice(0, 500));
      return json({ error: 'AI 합성에 실패했습니다. 잠시 후 다시 시도해 주세요.' }, 502, headers);
    }
    const result = (await gemini.json()) as {
      candidates?: { content?: { parts?: { inlineData?: { mimeType: string; data: string }; inline_data?: { mime_type: string; data: string } }[] } }[];
    };
    for (const part of result.candidates?.[0]?.content?.parts ?? []) {
      const img = part.inlineData ?? (part.inline_data && { mimeType: part.inline_data.mime_type, data: part.inline_data.data });
      if (img?.data) return json({ image: `data:${img.mimeType};base64,${img.data}` }, 200, headers);
    }
    return json({ error: 'AI가 이미지를 만들지 못했습니다. 다른 사진으로 시도해 주세요.' }, 502, headers);
  },
};
