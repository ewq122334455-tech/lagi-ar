var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../../../server/tryon-worker/src/index.ts
var MAX_PERSON_BYTES = 4 * 1024 * 1024;
var MAX_PRODUCT_BYTES = 6 * 1024 * 1024;
var recent = /* @__PURE__ */ new Map();
function throttled(ip, limit = 6, windowMs = 6e4) {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  recent.set(ip, hits);
  return hits.length > limit;
}
__name(throttled, "throttled");
function cors(origin, env) {
  const allowed = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
  const ok = origin && allowed.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : allowed[0],
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}
__name(cors, "cors");
function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
}
__name(json, "json");
function parseDataUrl(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  return m ? { mime: m[1], data: m[2] } : null;
}
__name(parseDataUrl, "parseDataUrl");
function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(bin);
}
__name(toBase64, "toBase64");
function buildPromptV2(r, cutout, faceCount = 0) {
  const style = (r.style ?? "").slice(0, 200);
  const facts = (r.facts ?? "").slice(0, 300);
  const name = [r.productName?.slice(0, 120), r.category?.slice(0, 40)].filter(Boolean).join(", ");
  const carry = /shoulder/i.test(style) ? "The handles or strap rest on the shoulder and the bag hangs down the same side of the body at about hip height, the strap taut where it carries the weight." : /cross/i.test(style) ? "The strap runs diagonally across the chest from one shoulder to the opposite hip, and the bag sits against the hip." : /hand|hold/i.test(style) ? "The person's own hand grips the handle at the top; the bag hangs straight down below the fist under gravity, fingers wrapped around the handle (never through the bag), the bag body in front of the leg and not floating." : "";
  return [
    "You are a virtual fitting room for a bag brand. Image 1 is a photo of a person. Image 2 shows ONLY the product" + (name ? ` (${name})` : "") + (cutout ? " on a plain background" : "") + " \u2014 it is the exact design to reproduce.",
    `Create one photorealistic photo of the SAME person from image 1 carrying exactly ONE of that product${style ? `, ${style}` : ""}.`,
    facts ? `Product facts: ${facts}.` : "",
    r.size ? `Real size ${r.size}: scale it to the person's body accordingly (do not make it larger or smaller than that).` : "Scale the product realistically to the person's body.",
    carry,
    "KEEP THE PERSON: the same face, identity, hair, skin, body shape, clothing, pose and background as in image 1. Only the arm and hand that hold or wear the product may move, and only as far as needed. No extra people.",
    "ANATOMY: exactly two arms and two hands with five fingers each, all belonging to this person; never add a hand, arm or finger, and take no hands, arms, bodies or background from image 2.",
    "KEEP THE PRODUCT: the same shape, proportions, colours, materials, hardware (zippers, buckles, clips, rings), handles and straps, and the same prints and lettering \u2014 letters must keep their spelling, orientation and position; do not redraw, translate, simplify or add logos. Do not add other bags or accessories.",
    faceCount > 0 ? `Image${faceCount > 1 ? "s" : ""} 3${faceCount > 1 ? `\u2013${2 + faceCount}` : ""} ${faceCount > 1 ? "are" : "is a"} flat, unretouched photo${faceCount > 1 ? "s" : ""} of the product's real surface${faceCount > 1 ? "s" : ""}: copy printed lettering, graphics, colours and material texture exactly from ${faceCount > 1 ? "them" : "it"} (they show surface only, not the product's outline \u2014 take the outline from image 2).` : "",
    "LIGHT AND CONTACT: match the light direction, colour and shadows of image 1; give the product a soft contact shadow and let the body or hand overlap it where it naturally would.",
    "FRAMING: output the same framing and aspect ratio as image 1, without cropping or zooming. Return only the edited photo."
  ].filter(Boolean).join(" ");
}
__name(buildPromptV2, "buildPromptV2");
function buildPrompt(r, cutout) {
  r = { ...r, style: r.style?.slice(0, 200), productName: r.productName?.slice(0, 120) };
  const what = [r.productName, r.category].filter(Boolean).join(", ");
  return [
    "You are a virtual fitting room. Image 1 is a photo of a person. Image 2 shows ONLY a product" + (what ? ` (${what})` : "") + (cutout ? " on a plain background." : "."),
    "Create one photorealistic photo of the SAME person from image 1 naturally wearing or carrying that product" + (r.style ? `, ${r.style}` : "") + ".",
    "Keep the person's face, identity, body shape, hair, clothing and the background exactly as in image 1. Change their arm and hand position only as much as needed to hold or wear the product.",
    // The most common failure: an extra hand or arm copied from the product photo, or grown to hold the product.
    "ANATOMY RULES: the person has exactly two arms and two hands, each with five fingers, attached naturally at the shoulders. Never add a third hand, arm or finger, and never show a hand that does not belong to this person. Use only image 2 as a reference for the product itself; take no hands, arms, bodies or background from it. If the product is held, it is held by one of the person's own hands.",
    "Reproduce the product faithfully: same shape, colours, prints, text, materials, hardware and proportions as in image 2.",
    r.size ? `The product's real size is ${r.size}; scale it realistically to the person's body.` : "Scale the product realistically to the body.",
    "Match the lighting, perspective and shadows of image 1 so the product looks physically present (straps resting on the shoulder or held in the hand, natural contact shadows).",
    "Return only the edited photo."
  ].join(" ");
}
__name(buildPrompt, "buildPrompt");
var CUTOUT_PROMPT = [
  "This photo shows a product, possibly worn or held by a person.",
  "Output a clean product photo of ONLY that product: the whole product, complete and unobstructed, seen from the front, centred on a plain white background.",
  "Remove every person, hand, arm, finger and background. Where a hand covered the product, restore the hidden part so it matches the rest.",
  "Keep the product exactly as it is: same shape, colours, prints, text, materials, hardware and proportions. Do not redesign it.",
  "Return only the image."
].join(" ");
async function productCutout(env, url, product, budget) {
  const key = `cutout:v1:${url}`;
  const cached = await env.MEDIA?.get(key);
  if (cached) return { cut: JSON.parse(cached) };
  const out = await geminiImage(env, [{ text: CUTOUT_PROMPT }, { inline_data: { mime_type: product.mime, data: product.data } }], budget);
  if (out.quota) return { quota: out.quota };
  if (!out.image) return { busy: out.reason === "busy" };
  const m = /^data:([^;]+);base64,(.+)$/.exec(out.image);
  if (!m) return {};
  const cut = { mime: m[1], data: m[2] };
  await env.MEDIA?.put(key, JSON.stringify(cut));
  return { cut };
}
__name(productCutout, "productCutout");
var DESCRIBE_PROMPT = "Describe this product for a video generator in one English sentence of at most 45 words. Only what is visible: the kind of item, its overall shape and proportions, each main colour and the part it is on (body, top band, handles, straps, pockets, trims), and where the prints, lettering and label sit and their colours. No brand names, no opinions.";
async function productDescription(env, url, product, budget) {
  const key = `desc:v1:${url}`;
  const cached = await env.MEDIA?.get(key);
  if (cached) return { text: cached };
  try {
    const res = await callGemini(
      env,
      JSON.stringify({
        contents: [{ parts: [{ text: DESCRIBE_PROMPT }, { inline_data: { mime_type: product.mime, data: product.data } }] }],
        // Roomy budget: newer Flash models may think before writing; the answer is cut to 400 chars below.
        generationConfig: { temperature: 0.2, maxOutputTokens: 2048 }
      }),
      env.GEMINI_TEXT_MODEL ?? "gemini-3.8-flash",
      budget,
      Number(env.TRYON_TEXT_UNIT ?? 0.1)
    );
    if (!res.ok) return { note: `HTTP ${res.status} ${(await res.text()).replace(/\s+/g, " ").slice(0, 200)}` };
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map((x) => x.text ?? "").join(" ").replace(/\s+/g, " ").trim();
    if (!text) return { note: `no text (${data.candidates?.[0]?.finishReason ?? "no candidate"})` };
    const clean2 = text.slice(0, 400);
    await env.MEDIA?.put(key, clean2);
    return { text: clean2 };
  } catch (e) {
    return { note: e.message.slice(0, 200) };
  }
}
__name(productDescription, "productDescription");
var MATTE_PROMPT = [
  "Place this exact product, alone, on a perfectly flat pure green background (#00FF00), filling most of the frame, seen from the front.",
  "No shadow, no reflection, no gradient, no floor: every background pixel is the same pure green.",
  "Keep the product exactly as it is: same shape, colours, prints, text, materials, hardware and proportions. Do not redesign it.",
  "Return only the image."
].join(" ");
async function productMatte(env, url, product, budget) {
  const key = `matte:v1:${url}`;
  const cached = await env.MEDIA?.get(key);
  if (cached) return JSON.parse(cached);
  const out = await geminiImage(env, [{ text: MATTE_PROMPT }, { inline_data: { mime_type: product.mime, data: product.data } }], budget);
  const m = out.image && /^data:([^;]+);base64,(.+)$/.exec(out.image);
  if (!m) return void 0;
  const matte = { mime: m[1], data: m[2] };
  await env.MEDIA?.put(key, JSON.stringify(matte));
  return matte;
}
__name(productMatte, "productMatte");
var SESSION_TTL = 60 * 60 * 24 * 30;
var PBKDF2_ITERATIONS = 1e5;
var toHex = /* @__PURE__ */ __name((buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join(""), "toHex");
var randomHex = /* @__PURE__ */ __name((bytes) => toHex(crypto.getRandomValues(new Uint8Array(bytes))), "randomHex");
async function hashPassword(password, saltHex) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const salt = new Uint8Array(saltHex.match(/../g).map((h) => parseInt(h, 16)));
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS }, key, 256);
  return toHex(bits);
}
__name(hashPassword, "hashPassword");
function sameString(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
__name(sameString, "sameString");
var publicUser = /* @__PURE__ */ __name((u) => ({ id: u.id, email: u.email, name: u.name, createdAt: u.createdAt }), "publicUser");
async function newSession(kv, email) {
  const token = randomHex(32);
  await kv.put(`session:${token}`, email, { expirationTtl: SESSION_TTL });
  return token;
}
__name(newSession, "newSession");
async function deleteMember(env, user, policy) {
  const users = env.USERS;
  const email = user.email.toLowerCase();
  const orders = env.ORDERS;
  let reviews = 0;
  let orderLinks = 0;
  if (orders) {
    const mine = await orders.list({ prefix: `reviewby:${email}:`, limit: 1e3 });
    for (const k of mine.keys) {
      const productId = k.name.split(":").pop();
      const id = await orders.get(k.name);
      const key = `review:${productId}:${id}`;
      const raw = id ? await orders.get(key) : null;
      if (raw) {
        if (policy === "delete") {
          await Promise.all([orders.delete(key), orders.delete(`reviewall:${id}`), env.MEDIA?.delete(`review-img:${id}`)]);
        } else {
          const r = JSON.parse(raw);
          await orders.put(key, JSON.stringify({ ...r, author: "\uD0C8\uD1F4 \uD68C\uC6D0", email: "" }));
        }
        reviews++;
      }
      await orders.delete(k.name);
    }
    const links = await orders.list({ prefix: `byemail:${email}:`, limit: 1e3 });
    for (const k of links.keys) await orders.delete(k.name);
    orderLinks = links.keys.length;
  }
  let cursor;
  let scanned = 0;
  do {
    const page = await users.list({ prefix: "session:", cursor, limit: 1e3 });
    for (const k of page.keys) if (await users.get(k.name) === email) await users.delete(k.name);
    scanned += page.keys.length;
    cursor = page.list_complete ? void 0 : page.cursor;
  } while (cursor && scanned < 2e4);
  await Promise.all([users.delete(`user:${email}`), users.delete(`loginfail:${email}`)]);
  return { reviews, orderLinks };
}
__name(deleteMember, "deleteMember");
var LOGIN_MAX_FAILS = 10;
var LOGIN_LOCK_SECONDS = 15 * 60;
async function sessionUser(kv, request) {
  const token = /^Bearer ([0-9a-f]{64})$/.exec(request.headers.get("Authorization") ?? "")?.[1];
  if (!token) return null;
  const email = await kv.get(`session:${token}`);
  const raw = email && await kv.get(`user:${email}`);
  return raw ? { token, user: JSON.parse(raw) } : null;
}
__name(sessionUser, "sessionUser");
async function handleAuth(path, request, env, headers) {
  const kv = env.USERS;
  if (path === "/auth/me" && request.method === "GET") {
    const s = await sessionUser(kv, request);
    return s ? json({ user: publicUser(s.user) }, 200, headers) : json({ error: "\uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 401, headers);
  }
  if (request.method !== "POST") return json({ error: "not found" }, 404, headers);
  if (path === "/auth/logout") {
    const s = await sessionUser(kv, request);
    if (s) await kv.delete(`session:${s.token}`);
    return json({ ok: true }, 200, headers);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON" }, 400, headers);
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) return json({ error: "\uC774\uBA54\uC77C \uC8FC\uC18C\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694." }, 400, headers);
  if (path === "/auth/signup") {
    const name = (body.name ?? "").trim();
    if (!name || name.length > 30) return json({ error: "\uC774\uB984\uC744 1~30\uC790\uB85C \uC785\uB825\uD574 \uC8FC\uC138\uC694." }, 400, headers);
    if (password.length < 8 || password.length > 72) return json({ error: "\uBE44\uBC00\uBC88\uD638\uB294 8\uC790 \uC774\uC0C1\uC73C\uB85C \uC785\uB825\uD574 \uC8FC\uC138\uC694." }, 400, headers);
    if (body.agree !== true) return json({ error: "\uD544\uC218 \uC57D\uAD00\uC5D0 \uB3D9\uC758\uD574 \uC8FC\uC138\uC694." }, 400, headers);
    if (await kv.get(`user:${email}`)) return json({ error: "\uC774\uBBF8 \uAC00\uC785\uB41C \uC774\uBA54\uC77C\uC785\uB2C8\uB2E4." }, 409, headers);
    const salt = randomHex(16);
    const user = {
      id: randomHex(8),
      email,
      name,
      salt,
      hash: await hashPassword(password, salt),
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      marketing: body.marketing === true
    };
    await kv.put(`user:${email}`, JSON.stringify(user));
    return json({ token: await newSession(kv, email), user: publicUser(user) }, 201, headers);
  }
  if (path === "/auth/login") {
    const locked = { error: "\uB85C\uADF8\uC778 \uC2DC\uB3C4\uAC00 \uB108\uBB34 \uB9CE\uC2B5\uB2C8\uB2E4. 15\uBD84 \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.", reason: "locked" };
    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    if (env.LOGIN_LIMIT && !(await env.LOGIN_LIMIT.limit({ key: `${email}|${ip}` })).success) return json(locked, 429, headers);
    const failKey = `loginfail:${email}`;
    const failRaw = await kv.get(failKey);
    const fail = failRaw ? JSON.parse(failRaw) : { n: 0 };
    if (fail.until && fail.until > Date.now()) return json(locked, 429, headers);
    const raw = await kv.get(`user:${email}`);
    const user = raw ? JSON.parse(raw) : null;
    const hash = await hashPassword(password, user?.salt ?? "00".repeat(16));
    if (!user || !sameString(hash, user.hash)) {
      const n = (fail.until ? 0 : fail.n) + 1;
      const next = n >= LOGIN_MAX_FAILS ? { n, until: Date.now() + LOGIN_LOCK_SECONDS * 1e3 } : { n };
      await kv.put(failKey, JSON.stringify(next), { expirationTtl: LOGIN_LOCK_SECONDS });
      return json(n >= LOGIN_MAX_FAILS ? locked : { error: "\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uB9DE\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." }, n >= LOGIN_MAX_FAILS ? 429 : 401, headers);
    }
    if (failRaw) await kv.delete(failKey);
    return json({ token: await newSession(kv, email), user: publicUser(user) }, 200, headers);
  }
  if (path === "/auth/delete") {
    const me = await sessionUser(kv, request);
    if (!me) return json({ error: "\uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 401, headers);
    if (me.user.email.toLowerCase() !== email) return json({ error: "\uB85C\uADF8\uC778\uD55C \uACC4\uC815\uC758 \uC774\uBA54\uC77C\uC744 \uC785\uB825\uD574 \uC8FC\uC138\uC694." }, 403, headers);
    const check = await hashPassword(password, me.user.salt);
    if (!sameString(check, me.user.hash)) return json({ error: "\uBE44\uBC00\uBC88\uD638\uAC00 \uB9DE\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." }, 403, headers);
    if (body.confirm !== "\uD0C8\uD1F4") return json({ error: "\uD655\uC778 \uBB38\uAD6C\uB97C \uC815\uD655\uD788 \uC785\uB825\uD574 \uC8FC\uC138\uC694." }, 400, headers);
    const policy = env.WITHDRAW_REVIEW_POLICY;
    if (policy !== "keep-anonymous" && policy !== "delete")
      return json({ error: "\uC628\uB77C\uC778 \uD68C\uC6D0 \uD0C8\uD1F4\uB294 \uC900\uBE44 \uC911\uC785\uB2C8\uB2E4. \uC778\uC2A4\uD0C0\uADF8\uB7A8 DM\uC73C\uB85C \uC694\uCCAD\uD574 \uC8FC\uC2DC\uBA74 \uCC98\uB9AC\uD574 \uB4DC\uB9BD\uB2C8\uB2E4.", reason: "not_configured" }, 503, headers);
    const result = await deleteMember(env, me.user, policy);
    return json({ ok: true, ...result, reviewPolicy: policy }, 200, headers);
  }
  return json({ error: "not found" }, 404, headers);
}
__name(handleAuth, "handleAuth");
var PENDING_TTL = 60 * 60 * 24;
async function memberOrders(kv, email, limit) {
  const listed = await kv.list({ prefix: `byemail:${email}:`, limit });
  const raws = await Promise.all(listed.keys.map((k) => kv.get(`order:${k.name.split(":").pop()}`)));
  return raws.filter(Boolean).map((r) => JSON.parse(r)).filter((o) => o.status === "PAID" && o.memberEmail === email);
}
__name(memberOrders, "memberOrders");
var clean = /* @__PURE__ */ __name((v, max) => typeof v === "string" ? v.trim().slice(0, max) : "", "clean");
var orderSummary = /* @__PURE__ */ __name((o) => ({
  orderId: o.orderId,
  status: o.status,
  orderName: o.orderName,
  lines: o.lines,
  itemsTotal: o.itemsTotal,
  shippingFee: o.shippingFee,
  amount: o.amount,
  shipping: o.shipping,
  customer: { name: o.customer.name },
  payment: o.payment ? { method: o.payment.method, approvedAt: o.payment.approvedAt, receiptUrl: o.payment.receiptUrl } : void 0
}), "orderSummary");
async function publishedProduct(env, id) {
  if (!/^[a-z0-9-]{1,64}$/.test(id)) return null;
  const res = await fetch(new URL(`${id}/product.json`, env.PRODUCTS_BASE_URL).toString(), { cf: { cacheTtl: 60 } });
  if (!res.ok) return null;
  const p = await res.json();
  if (p.sample || p.name?.status !== "VERIFIED" || p.price?.status !== "VERIFIED" || typeof p.price.value !== "number") return null;
  return p;
}
__name(publishedProduct, "publishedProduct");
function shippingFor(products, itemsTotal) {
  let fee = 0;
  let freeOver;
  for (const p of products) {
    const f = p.shipping?.fee ?? 0;
    if (f > fee) {
      fee = f;
      freeOver = p.shipping?.freeOver;
    }
  }
  return freeOver != null && itemsTotal >= freeOver ? 0 : fee;
}
__name(shippingFor, "shippingFor");
async function handleOrders(path, request, env, headers) {
  const kv = env.ORDERS;
  if (path === "/admin/orders" && request.method === "GET") {
    const token = /^Bearer (.+)$/.exec(request.headers.get("Authorization") ?? "")?.[1] ?? "";
    if (!env.ADMIN_TOKEN || !sameString(token, env.ADMIN_TOKEN)) return json({ error: "unauthorized" }, 401, headers);
    const listed = await kv.list({ prefix: "order:", limit: 100 });
    const orders = (await Promise.all(listed.keys.map((k) => kv.get(k.name)))).filter(Boolean).map((r) => JSON.parse(r));
    return json({ orders: orders.filter((o) => o.status === "PAID") }, 200, headers);
  }
  if (path === "/orders/mine" && request.method === "GET") {
    const me = env.USERS ? await sessionUser(env.USERS, request) : null;
    if (!me) return json({ error: "\uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 401, headers);
    const orders = (await memberOrders(kv, me.user.email.toLowerCase(), 50)).map(orderSummary);
    orders.sort((a, b) => a.orderId < b.orderId ? 1 : -1);
    return json({ orders }, 200, headers);
  }
  if (request.method !== "POST") return json({ error: "not found" }, 404, headers);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON" }, 400, headers);
  }
  if (path === "/orders") {
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length || items.length > 20) return json({ error: "\uC8FC\uBB38\uD560 \uC81C\uD488\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." }, 400, headers);
    const c = body.customer ?? {};
    const sh = body.shipping ?? {};
    const customer = { name: clean(c.name, 30), phone: clean(c.phone, 20).replace(/[^0-9]/g, ""), email: clean(c.email, 120) };
    const shipping = {
      recipient: clean(sh.recipient, 30),
      phone: clean(sh.phone, 20).replace(/[^0-9]/g, ""),
      zonecode: clean(sh.zonecode, 10),
      address: clean(sh.address, 200),
      addressDetail: clean(sh.addressDetail, 100),
      memo: clean(sh.memo, 100)
    };
    if (!customer.name || !/^01[0-9]{8,9}$/.test(customer.phone) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email))
      return json({ error: "\uC8FC\uBB38\uC790 \uC774\uB984, \uD734\uB300\uD3F0 \uBC88\uD638, \uC774\uBA54\uC77C\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694." }, 400, headers);
    if (!shipping.recipient || !/^0[0-9]{8,10}$/.test(shipping.phone) || !/^[0-9]{5}$/.test(shipping.zonecode) || !shipping.address || !shipping.addressDetail)
      return json({ error: "\uBC1B\uB294 \uBD84, \uC5F0\uB77D\uCC98, \uC6B0\uD3B8\uBC88\uD638, \uC8FC\uC18C, \uC0C1\uC138 \uC8FC\uC18C\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694." }, 400, headers);
    if (body.agree !== true) return json({ error: "\uC8FC\uBB38 \uB0B4\uC6A9 \uD655\uC778 \uBC0F \uACB0\uC81C \uC9C4\uD589\uC5D0 \uB3D9\uC758\uD574 \uC8FC\uC138\uC694." }, 400, headers);
    const merged = /* @__PURE__ */ new Map();
    for (const it of items) {
      const id = typeof it.productId === "string" ? it.productId : "";
      const q = Number(it.quantity);
      if (!Number.isInteger(q) || q < 1 || q > 20) return json({ error: "\uC218\uB7C9\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694." }, 400, headers);
      merged.set(id, (merged.get(id) ?? 0) + q);
    }
    const products = [];
    const lines = [];
    for (const [id, quantity] of merged) {
      const p = await publishedProduct(env, id);
      if (!p) return json({ error: "\uD310\uB9E4 \uC911\uC774 \uC544\uB2CC \uC81C\uD488\uC774 \uD3EC\uD568\uB418\uC5B4 \uC788\uC2B5\uB2C8\uB2E4." }, 400, headers);
      products.push(p);
      lines.push({ productId: id, name: p.name.value ?? id, unitPrice: p.price.value, quantity });
    }
    const itemsTotal = lines.reduce((n, l) => n + l.unitPrice * l.quantity, 0);
    const shippingFee = shippingFor(products, itemsTotal);
    const date = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10).replace(/-/g, "");
    const order = {
      orderId: `LAGI-${date}-${randomHex(6).toUpperCase()}`,
      status: "PENDING",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      orderName: lines.length > 1 ? `${lines[0].name} \uC678 ${lines.length - 1}\uAC74` : lines[0].name,
      lines,
      itemsTotal,
      shippingFee,
      amount: itemsTotal + shippingFee,
      customer,
      shipping
    };
    const member = env.USERS ? await sessionUser(env.USERS, request) : null;
    if (member) order.memberEmail = member.user.email.toLowerCase();
    await kv.put(`order:${order.orderId}`, JSON.stringify(order), { expirationTtl: PENDING_TTL });
    return json(orderSummary(order), 201, headers);
  }
  if (path === "/payments/confirm") {
    const paymentKey = clean(body.paymentKey, 200);
    const orderId = clean(body.orderId, 64);
    const amount = Number(body.amount);
    const raw = await kv.get(`order:${orderId}`);
    if (!raw || !paymentKey) return json({ error: "\uC8FC\uBB38\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404, headers);
    const order = JSON.parse(raw);
    if (order.status === "PAID") {
      return order.payment?.paymentKey === paymentKey ? json(orderSummary(order), 200, headers) : json({ error: "\uC774\uBBF8 \uACB0\uC81C\uB41C \uC8FC\uBB38\uC785\uB2C8\uB2E4." }, 409, headers);
    }
    if (amount !== order.amount) return json({ error: "\uACB0\uC81C \uAE08\uC561\uC774 \uC8FC\uBB38 \uAE08\uC561\uACFC \uB2E4\uB985\uB2C8\uB2E4." }, 400, headers);
    if (!env.TOSS_SECRET_KEY) return json({ error: "\uACB0\uC81C \uC2B9\uC778 \uD0A4\uAC00 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." }, 503, headers);
    const res = await fetch(`${env.TOSS_API_BASE || "https://api.tosspayments.com"}/v1/payments/confirm`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${env.TOSS_SECRET_KEY}:`)}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `confirm-${orderId}`
      },
      body: JSON.stringify({ paymentKey, orderId, amount })
    });
    const toss = await res.json().catch(() => ({}));
    if (!res.ok || toss.status !== "DONE" || toss.totalAmount !== order.amount) {
      return json({ error: toss.message ?? "\uACB0\uC81C \uC2B9\uC778\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", code: toss.code }, res.ok ? 502 : res.status, headers);
    }
    order.status = "PAID";
    order.payment = { paymentKey, method: toss.method, approvedAt: toss.approvedAt, receiptUrl: toss.receipt?.url };
    await kv.put(`order:${order.orderId}`, JSON.stringify(order));
    if (order.memberEmail) await kv.put(`byemail:${order.memberEmail}:${order.orderId}`, order.lines.map((l) => l.productId).join(","));
    return json(orderSummary(order), 200, headers);
  }
  if (path === "/orders/lookup") {
    const orderId = clean(body.orderId, 64).toUpperCase();
    const phone = clean(body.phone, 20).replace(/[^0-9]/g, "");
    const raw = /^LAGI-\d{8}-[0-9A-F]{6,16}$/.test(orderId) ? await kv.get(`order:${orderId}`) : null;
    const order = raw ? JSON.parse(raw) : null;
    if (!order || !phone || order.customer.phone !== phone && order.shipping.phone !== phone)
      return json({ error: "\uC8FC\uBB38 \uBC88\uD638\uC640 \uD734\uB300\uD3F0 \uBC88\uD638\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694." }, 404, headers);
    return json(orderSummary(order), 200, headers);
  }
  return json({ error: "not found" }, 404, headers);
}
__name(handleOrders, "handleOrders");
var REVIEW_PAGE = 10;
var MAX_REVIEW_PHOTO = 9e5;
var maskName = /* @__PURE__ */ __name((n) => n.length <= 1 ? `${n}*` : `${n[0]}${"*".repeat(Math.min(3, n.length - 1))}`, "maskName");
var publicReview = /* @__PURE__ */ __name((r) => ({ id: r.id, productId: r.productId, productName: r.productName, author: r.author, rating: r.rating, text: r.text, photo: r.photo, verified: r.verified, createdAt: r.createdAt }), "publicReview");
async function handleReviews(path, request, env, headers) {
  const kv = env.ORDERS;
  const url = new URL(request.url);
  if (path.startsWith("/reviews/photo/") && request.method === "GET") {
    const id = path.slice("/reviews/photo/".length);
    const data = /^[0-9a-z-]{8,60}$/.test(id) ? await env.MEDIA?.get(`review-img:${id}`) : null;
    if (!data) return json({ error: "not found" }, 404, headers);
    const bin = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    return new Response(bin, { headers: { ...headers, "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" } });
  }
  if (path === "/reviews" && request.method === "GET") {
    const product = url.searchParams.get("product") ?? "";
    const page = Math.max(1, Math.min(50, Number(url.searchParams.get("page")) || 1));
    const prefix = product ? `review:${product}:` : "reviewall:";
    if (product && !/^[a-z0-9-]{1,64}$/.test(product)) return json({ error: "invalid product" }, 400, headers);
    const keys = [];
    let cursor;
    do {
      const l = await kv.list({ prefix, cursor, limit: 1e3 });
      keys.push(...l.keys.map((k) => k.name));
      cursor = l.list_complete ? void 0 : l.cursor;
    } while (cursor && keys.length < 2e3);
    const slice = keys.slice((page - 1) * REVIEW_PAGE, page * REVIEW_PAGE);
    const raws = await Promise.all(slice.map(async (k) => product ? kv.get(k) : kv.get(await kv.get(k) ?? "")));
    const viewer = env.USERS && request.headers.get("Authorization") ? await sessionUser(env.USERS, request) : null;
    const reviews = raws.filter(Boolean).map((raw) => {
      const r = JSON.parse(raw);
      return { ...publicReview(r), mine: !!viewer && viewer.user.email.toLowerCase() === r.email };
    });
    return json({ reviews, total: keys.length, page, pages: Math.max(1, Math.ceil(keys.length / REVIEW_PAGE)) }, 200, headers);
  }
  const me = env.USERS ? await sessionUser(env.USERS, request) : null;
  if (!me) return json({ error: "\uB85C\uADF8\uC778\uD55C \uD68C\uC6D0\uB9CC \uAD6C\uB9E4\uD3C9\uC744 \uC4F8 \uC218 \uC788\uC2B5\uB2C8\uB2E4." }, 401, headers);
  const email = me.user.email.toLowerCase();
  if (path === "/reviews" && request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid JSON" }, 400, headers);
    }
    const productId = clean(body.productId, 64);
    const product = await publishedProduct(env, productId);
    if (!product) return json({ error: "\uD310\uB9E4 \uC911\uC778 \uC81C\uD488\uC5D0\uB9CC \uAD6C\uB9E4\uD3C9\uC744 \uC4F8 \uC218 \uC788\uC2B5\uB2C8\uB2E4." }, 400, headers);
    const rating = Number(body.rating);
    const text = clean(body.text, 1e3);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return json({ error: "\uBCC4\uC810\uC744 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694." }, 400, headers);
    if (text.length < 10) return json({ error: "\uAD6C\uB9E4\uD3C9\uC740 10\uC790 \uC774\uC0C1 \uC368 \uC8FC\uC138\uC694." }, 400, headers);
    if (await kv.get(`reviewby:${email}:${productId}`)) return json({ error: "\uC774 \uC81C\uD488\uC5D0\uB294 \uC774\uBBF8 \uAD6C\uB9E4\uD3C9\uC744 \uB0A8\uACBC\uC2B5\uB2C8\uB2E4." }, 409, headers);
    const photo = typeof body.photo === "string" ? /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(body.photo)?.[1] : void 0;
    if (body.photo && !photo) return json({ error: "\uC0AC\uC9C4\uC740 JPEG\uB85C \uC62C\uB824 \uC8FC\uC138\uC694." }, 400, headers);
    if (photo && photo.length > MAX_REVIEW_PHOTO) return json({ error: "\uC0AC\uC9C4 \uC6A9\uB7C9\uC774 \uB108\uBB34 \uD07D\uB2C8\uB2E4." }, 413, headers);
    const verified = (await memberOrders(kv, email, 100)).some((o) => o.lines.some((l) => l.productId === productId));
    const now = Date.now();
    const id = `${(9999999999999 - now).toString().padStart(13, "0")}-${randomHex(4)}`;
    const review = {
      id,
      productId,
      productName: product.name.value ?? productId,
      author: maskName(me.user.name || email.split("@")[0]),
      email,
      rating,
      text,
      photo: !!photo,
      verified,
      createdAt: new Date(now).toISOString()
    };
    if (photo) await env.MEDIA?.put(`review-img:${id}`, photo);
    await kv.put(`review:${productId}:${id}`, JSON.stringify(review));
    await kv.put(`reviewall:${id}`, `review:${productId}:${id}`);
    await kv.put(`reviewby:${email}:${productId}`, id);
    return json(publicReview(review), 201, headers);
  }
  if (path.startsWith("/reviews/") && request.method === "DELETE") {
    const [productId, id] = path.slice("/reviews/".length).split("/");
    const raw = productId && id ? await kv.get(`review:${productId}:${id}`) : null;
    const review = raw ? JSON.parse(raw) : null;
    if (!review) return json({ error: "\uAD6C\uB9E4\uD3C9\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404, headers);
    if (review.email !== email) return json({ error: "\uB0B4\uAC00 \uC4F4 \uAD6C\uB9E4\uD3C9\uB9CC \uC9C0\uC6B8 \uC218 \uC788\uC2B5\uB2C8\uB2E4." }, 403, headers);
    await Promise.all([kv.delete(`review:${productId}:${id}`), kv.delete(`reviewall:${id}`), kv.delete(`reviewby:${email}:${productId}`), env.MEDIA?.delete(`review-img:${id}`)]);
    return json({ ok: true }, 200, headers);
  }
  if (path === "/reviews/mine" && request.method === "GET") {
    const l = await kv.list({ prefix: `reviewby:${email}:`, limit: 200 });
    return json({ products: l.keys.map((k) => k.name.split(":").pop()) }, 200, headers);
  }
  return json({ error: "not found" }, 404, headers);
}
__name(handleReviews, "handleReviews");
var REALTIME_SECONDS = 20;
var REALTIME_PER_IP = 3;
async function realtime(path, request, env, headers) {
  if (request.method !== "POST") return json({ error: "POST only" }, 405, headers);
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  if (path === "/cutout") {
    if (throttled(`cutout:${ip}`, 10)) return json({ error: "\uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694." }, 429, headers);
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid JSON" }, 400, headers);
    }
    const allowed = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
    const product = await fetchProductImage(body.productImage ?? "", allowed);
    if ("error" in product) return json({ error: product.error }, product.status, headers);
    if (body.matte) {
      const matte = env.GEMINI_API_KEY ? await productMatte(env, body.productImage, product, { ip }) : void 0;
      if (!matte) return json({ error: "\uC81C\uD488 \uC774\uBBF8\uC9C0\uB97C \uC900\uBE44\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4." }, 502, headers);
      return json({ matte: `data:${matte.mime};base64,${matte.data}` }, 200, headers);
    }
    const [{ cut, quota }, desc] = env.GEMINI_API_KEY ? await Promise.all([productCutout(env, body.productImage, product, { ip }), productDescription(env, body.productImage, product, { ip })]) : [{}, {}];
    if (quota) return json({ error: QUOTA_MESSAGE[quota], reason: quota }, quota === "quota_unavailable" ? 503 : 429, headers);
    const img = cut ?? product;
    return json({ image: `data:${img.mime};base64,${img.data}`, cutout: !!cut, description: desc.text, descriptionNote: desc.note }, 200, headers);
  }
  if (!env.DECART_API_KEY) return json({ error: "\uC2E4\uC2DC\uAC04 \uCC29\uC6A9\uC740 \uC544\uC9C1 \uC900\uBE44 \uC911\uC785\uB2C8\uB2E4.", reason: "not_configured" }, 503, headers);
  if (throttled(`rt:${ip}`, 5)) return json({ error: "\uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694." }, 429, headers);
  const dailyAll = Number(env.REALTIME_DAILY_SESSIONS ?? 100);
  const unlimited = (env.REALTIME_UNLIMITED ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const member = unlimited.length && env.USERS ? await sessionUser(env.USERS, request) : null;
  const vip = !!member && unlimited.includes(member.user.email.toLowerCase());
  let usedToday = 0;
  if (!vip) {
    try {
      usedToday = (await meter(env, "rt", ip, 1, dailyAll, REALTIME_PER_IP)).ipSpent;
    } catch (e) {
      if (!(e instanceof QuotaError)) throw e;
      if (e.reason === "daily_limit") return json({ error: `\uC2E4\uC2DC\uAC04 \uCC29\uC6A9\uC740 \uD558\uB8E8 ${REALTIME_PER_IP}\uBC88\uAE4C\uC9C0 \uCCB4\uD5D8\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uB0B4\uC77C \uB2E4\uC2DC \uC774\uC6A9\uD574 \uC8FC\uC138\uC694.`, reason: "daily_limit" }, 429, headers);
      if (e.reason === "site_limit") return json({ error: "\uC624\uB298 \uC2E4\uC2DC\uAC04 \uCC29\uC6A9 \uCCB4\uD5D8\uC774 \uBAA8\uB450 \uC18C\uC9C4\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC0AC\uC9C4 \uD569\uC131\uC744 \uC774\uC6A9\uD574 \uC8FC\uC138\uC694.", reason: "site_limit" }, 429, headers);
      return json({ error: "\uC2E4\uC2DC\uAC04 \uCC29\uC6A9\uC744 \uC9C0\uAE08\uC740 \uC774\uC6A9\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.", reason: "quota_unavailable" }, 503, headers);
    }
  }
  const origins = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
  const res = await fetch("https://api.decart.ai/v1/client/tokens", {
    method: "POST",
    headers: { "X-API-KEY": env.DECART_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      expiresIn: 60,
      // enough to connect; an open session is capped by maxSessionDuration
      allowedModels: ["lucy-2.6"],
      allowedOrigins: origins,
      constraints: { realtime: { maxSessionDuration: REALTIME_SECONDS } }
    })
  });
  if (!res.ok) {
    console.log("decart token error", res.status, (await res.text()).slice(0, 300));
    return json({ error: "\uC2E4\uC2DC\uAC04 \uCC29\uC6A9 \uC11C\uBC84\uC5D0 \uC5F0\uACB0\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.", reason: "provider" }, 502, headers);
  }
  const token = await res.json();
  if (!token.apiKey) return json({ error: "\uC2E4\uC2DC\uAC04 \uCC29\uC6A9 \uC11C\uBC84\uC5D0 \uC5F0\uACB0\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", reason: "provider" }, 502, headers);
  if (vip) return json({ apiKey: token.apiKey, expiresAt: token.expiresAt, seconds: REALTIME_SECONDS, remainingToday: null }, 200, headers);
  return json({ apiKey: token.apiKey, expiresAt: token.expiresAt, seconds: REALTIME_SECONDS, remainingToday: Math.max(0, REALTIME_PER_IP - usedToday) }, 200, headers);
}
__name(realtime, "realtime");
var src_default = {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const headers = cors(origin, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    if (path.startsWith("/reviews/photo/") && request.method === "GET" && env.ORDERS) return handleReviews(path, request, env, headers);
    const allowed = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
    if (!origin || !allowed.includes(origin)) return json({ error: "origin not allowed" }, 403, headers);
    if (path === "/reviews" || path.startsWith("/reviews/")) {
      if (!env.ORDERS || !env.PRODUCTS_BASE_URL) return json({ error: "\uAD6C\uB9E4\uD3C9 \uAE30\uB2A5\uC774 \uC544\uC9C1 \uC5F0\uACB0\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." }, 503, headers);
      const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
      if (request.method !== "GET" && throttled(`review:${ip}`, 10)) return json({ error: "\uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694." }, 429, headers);
      return handleReviews(path, request, env, headers);
    }
    if (path === "/orders" || path === "/orders/lookup" || path === "/orders/mine" || path === "/payments/confirm" || path === "/admin/orders") {
      if (!env.ORDERS || !env.PRODUCTS_BASE_URL) return json({ error: "\uC628\uB77C\uC778 \uACB0\uC81C\uAC00 \uC544\uC9C1 \uC5F0\uACB0\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." }, 503, headers);
      const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
      if (throttled(`order:${ip}`, 20)) return json({ error: "\uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694." }, 429, headers);
      return handleOrders(path, request, env, headers);
    }
    if (path === "/realtime/token" || path === "/cutout") return realtime(path, request, env, headers);
    if (path.startsWith("/auth/")) {
      if (!env.USERS) return json({ error: "\uD68C\uC6D0 \uAE30\uB2A5\uC774 \uC544\uC9C1 \uC5F0\uACB0\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." }, 503, headers);
      const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
      if (throttled(`auth:${ip}`, 20)) return json({ error: "\uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694." }, 429, headers);
      return handleAuth(path, request, env, headers);
    }
    return tryOn(request, env, headers);
  }
};
var UNITS_SITE_DEFAULT = 400;
var UNITS_PER_IP_DEFAULT = 24;
var QuotaError = class extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
  reason;
  static {
    __name(this, "QuotaError");
  }
};
var QUOTA_MESSAGE = {
  daily_limit: "AI \uC0AC\uC9C4 \uD569\uC131 \uC774\uC6A9 \uD55C\uB3C4(\uD558\uB8E8)\uC5D0 \uB3C4\uB2EC\uD588\uC2B5\uB2C8\uB2E4. \uB0B4\uC77C \uB2E4\uC2DC \uC774\uC6A9\uD574 \uC8FC\uC138\uC694.",
  site_limit: "\uC624\uB298 AI \uC0AC\uC9C4 \uD569\uC131 \uC774\uC6A9\uB7C9\uC774 \uBAA8\uB450 \uC18C\uC9C4\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uB0B4\uC77C \uB2E4\uC2DC \uC774\uC6A9\uD574 \uC8FC\uC138\uC694.",
  quota_unavailable: "AI \uC0AC\uC9C4 \uD569\uC131\uC744 \uC9C0\uAE08\uC740 \uC774\uC6A9\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694."
};
var centi = /* @__PURE__ */ __name((units) => Math.round(units * 100), "centi");
async function takeUnits(env, budget, units) {
  const siteCap = Number(env.TRYON_DAILY_UNITS_SITE ?? UNITS_SITE_DEFAULT);
  const ipCap = Number(env.TRYON_DAILY_UNITS_PER_IP ?? UNITS_PER_IP_DEFAULT);
  await meter(env, "tryon", budget.ip, units, siteCap, ipCap);
}
__name(takeUnits, "takeUnits");
function localOnly(env) {
  return env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean).every((o) => {
    try {
      return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(o).hostname);
    } catch {
      return false;
    }
  });
}
__name(localOnly, "localOnly");
async function meter(env, scope, ip, units, siteCapUnits, ipCapUnits) {
  if (env.TRYON_QUOTA === "unmetered") {
    if (localOnly(env)) return { ipSpent: 0 };
    throw new QuotaError("quota_unavailable");
  }
  if (!env.QUOTA) throw new QuotaError("quota_unavailable");
  const day = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const siteCap = centi(siteCapUnits);
  const ipCap = centi(ipCapUnits);
  if (!Number.isFinite(siteCap) || !Number.isFinite(ipCap) || !Number.isFinite(units) || units <= 0) throw new QuotaError("quota_unavailable");
  let out;
  try {
    const stub = env.QUOTA.get(env.QUOTA.idFromName(`${scope}:${day}`));
    const res = await stub.fetch("https://quota/take", { method: "POST", body: JSON.stringify({ ip, cost: centi(units), siteCap, ipCap }) });
    if (!res.ok) throw new Error(`counter ${res.status}`);
    out = await res.json();
  } catch {
    throw new QuotaError("quota_unavailable");
  }
  if (out.ok === true && typeof out.ipSpentCenti === "number") return { ipSpent: out.ipSpentCenti / 100 };
  if (out.ok === false && (out.reason === "daily_limit" || out.reason === "site_limit")) throw new QuotaError(out.reason);
  throw new QuotaError("quota_unavailable");
}
__name(meter, "meter");
var QuotaCounter = class {
  constructor(state) {
    this.state = state;
  }
  state;
  static {
    __name(this, "QuotaCounter");
  }
  async fetch(request) {
    const body = await request.json();
    const site = Number(await this.state.storage.get("all") ?? 0);
    const mine = Number(await this.state.storage.get(`ip:${body.ip}`) ?? 0);
    if (!Number.isFinite(body.cost) || body.cost <= 0) return Response.json({ ok: false, reason: "bad_request" }, { status: 400 });
    if (mine + body.cost > (body.ipCap ?? 0)) return Response.json({ ok: false, reason: "daily_limit" });
    if (site + body.cost > (body.siteCap ?? 0)) return Response.json({ ok: false, reason: "site_limit" });
    await this.state.storage.put({ all: site + body.cost, [`ip:${body.ip}`]: mine + body.cost });
    return Response.json({ ok: true, spentCenti: site + body.cost, ipSpentCenti: mine + body.cost });
  }
};
async function tryOn(request, env, headers) {
  if (request.method !== "POST") return json({ error: "POST only" }, 405, headers);
  const allowed = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
  if (!env.GEMINI_API_KEY) return json({ error: "server not configured" }, 500, headers);
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  if (throttled(ip, 10)) return json({ error: "\uC694\uCCAD\uC774 \uB9CE\uC2B5\uB2C8\uB2E4. 1\uBD84 \uB4A4\uC5D0 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694." }, 429, headers);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON" }, 400, headers);
  }
  const person = parseDataUrl(body.person ?? "");
  if (!person) return json({ error: "\uC0AC\uC9C4 \uD615\uC2DD\uC744 \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 400, headers);
  if (person.data.length * 0.75 > MAX_PERSON_BYTES) return json({ error: "\uC0AC\uC9C4\uC774 \uB108\uBB34 \uD07D\uB2C8\uB2E4." }, 413, headers);
  const product = await fetchProductImage(body.productImage, allowed);
  if ("error" in product) return json({ error: product.error }, product.status, headers);
  const budget = { ip };
  const { cut: cutout, busy, quota } = await productCutout(env, body.productImage, product, budget);
  if (quota) return json({ error: QUOTA_MESSAGE[quota], reason: quota }, quota === "quota_unavailable" ? 503 : 429, headers);
  if (busy) return json({ error: "AI \uC11C\uBC84\uAC00 \uC7A0\uC2DC \uBC14\uC069\uB2C8\uB2E4. 1\uBD84 \uB4A4\uC5D0 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.", reason: "busy" }, 503, headers);
  const ref = cutout ?? product;
  const v2 = body.promptVersion === "v2" || env.PROMPT_VERSION === "v2";
  const faces = [];
  if (v2 && Array.isArray(body.faces))
    for (const u of body.faces.slice(0, 3)) {
      const f = typeof u === "string" ? await fetchProductImage(u, allowed) : null;
      if (f && !("error" in f)) faces.push(f);
    }
  const out = await geminiImage(
    env,
    [
      { text: v2 ? buildPromptV2(body, !!cutout, faces.length) : buildPrompt(body, !!cutout) },
      { inline_data: { mime_type: person.mime, data: person.data } },
      { inline_data: { mime_type: ref.mime, data: ref.data } },
      ...faces.map((f) => ({ inline_data: { mime_type: f.mime, data: f.data } }))
    ],
    budget
  );
  if (out.quota) return json({ error: QUOTA_MESSAGE[out.quota], reason: out.quota }, out.quota === "quota_unavailable" ? 503 : 429, headers);
  if (!out.image) {
    const message = out.reason === "busy" ? "AI \uC11C\uBC84\uAC00 \uC7A0\uC2DC \uBC14\uC069\uB2C8\uB2E4. 1\uBD84 \uB4A4\uC5D0 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694." : out.reason === "blocked" ? "AI\uAC00 \uC774 \uC0AC\uC9C4\uC740 \uCC98\uB9AC\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uD55C \uC0AC\uB78C\uB9CC, \uC5BC\uAD74\uACFC \uBAB8\uC774 \uC798 \uBCF4\uC774\uB294 \uB2E4\uB978 \uC0AC\uC9C4\uC73C\uB85C \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694." : "\uC774\uBC88\uC5D0\uB294 AI\uAC00 \uC774\uBBF8\uC9C0\uB97C \uB9CC\uB4E4\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uBC1D\uACE0 \uC815\uBA74\uC5D0\uC11C \uCC0D\uC740 \uC0AC\uC9C4\uC73C\uB85C \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.";
    return json({ error: message, reason: out.reason, detail: out.detail }, out.reason === "busy" ? 503 : 502, headers);
  }
  return json({ image: out.image }, 200, headers);
}
__name(tryOn, "tryOn");
async function fetchProductImage(url, allowed) {
  let productUrl;
  try {
    productUrl = new URL(url);
  } catch {
    return { error: "invalid product image", status: 400 };
  }
  if (!allowed.includes(productUrl.origin)) return { error: "product image not allowed", status: 400 };
  const res = await fetch(productUrl.toString());
  if (!res.ok) return { error: "\uC0C1\uD488 \uC774\uBBF8\uC9C0\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", status: 502 };
  const mime = (res.headers.get("Content-Type") ?? "image/jpeg").split(";")[0];
  if (!/^image\/(jpeg|png|webp)$/.test(mime)) return { error: "unsupported product image", status: 400 };
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_PRODUCT_BYTES) return { error: "product image too large", status: 413 };
  return { mime, data: toBase64(buf) };
}
__name(fetchProductImage, "fetchProductImage");
async function callGemini(env, body, model, budget, units = 1) {
  await takeUnits(env, budget, units);
  return callGeminiUnmetered(env, body, model);
}
__name(callGemini, "callGemini");
async function callGeminiUnmetered(env, body, model = env.GEMINI_MODEL) {
  if (env.RELAY) {
    const stub = env.RELAY.get(env.RELAY.idFromName("gemini-us-west"), { locationHint: "wnam" });
    return stub.fetch("https://relay/gemini", { method: "POST", headers: { "Content-Type": "application/json", "x-model": model }, body });
  }
  return geminiFetch(env.GEMINI_API_KEY, model, body, env.GEMINI_BASE_URL);
}
__name(callGeminiUnmetered, "callGeminiUnmetered");
function geminiFetch(key, model, body, base = "https://generativelanguage.googleapis.com") {
  return fetch(`${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body
  });
}
__name(geminiFetch, "geminiFetch");
async function egress() {
  try {
    const t = await (await fetch("https://cloudflare.com/cdn-cgi/trace")).text();
    return `${/colo=(\w+)/.exec(t)?.[1] ?? "?"}/${/loc=(\w+)/.exec(t)?.[1] ?? "?"}`;
  } catch {
    return "?";
  }
}
__name(egress, "egress");
var GeminiRelay = class {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }
  state;
  env;
  static {
    __name(this, "GeminiRelay");
  }
  async fetch(request) {
    const res = await geminiFetch(this.env.GEMINI_API_KEY, request.headers.get("x-model") || this.env.GEMINI_MODEL, await request.text(), this.env.GEMINI_BASE_URL);
    const headers = new Headers(res.headers);
    if (!res.ok) headers.set("x-lagi-egress", `relay ${await egress()}`);
    return new Response(res.body, { status: res.status, headers });
  }
};
var SAFETY = ["HARM_CATEGORY_HARASSMENT", "HARM_CATEGORY_HATE_SPEECH", "HARM_CATEGORY_SEXUALLY_EXPLICIT", "HARM_CATEGORY_DANGEROUS_CONTENT"].map((category) => ({
  category,
  threshold: "BLOCK_ONLY_HIGH"
}));
async function geminiImage(env, parts, budget) {
  let reason = "no_image";
  let detail = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, reason === "busy" ? 2e3 * attempt : 800 * attempt));
    const askParts = attempt > 0 && reason === "no_image" ? [...parts, { text: "Respond with the edited image only. Do not reply with text; always return an image." }] : parts;
    let res;
    try {
      res = await callGemini(
        env,
        JSON.stringify({
          contents: [{ role: "user", parts: askParts }],
          generationConfig: { responseModalities: attempt === 0 ? ["IMAGE"] : ["TEXT", "IMAGE"] },
          safetySettings: SAFETY
        }),
        env.GEMINI_MODEL,
        budget
      );
    } catch (e) {
      if (e instanceof QuotaError) return { quota: e.reason };
      reason = "error";
      detail = e.message.slice(0, 120);
      continue;
    }
    if (!res.ok) {
      const text = (await res.text()).slice(0, 300);
      console.log("gemini error", attempt, res.status, text);
      reason = res.status === 429 || res.status === 503 ? "busy" : "error";
      detail = `HTTP ${res.status} ${(/"message":\s*"([^"]{0,120})/.exec(text)?.[1] ?? "").trim()} [via ${res.headers.get("x-lagi-egress") ?? "direct"}]`;
      if (res.status === 400 && attempt > 0) return { reason, detail };
      continue;
    }
    const result = await res.json();
    const got = result.candidates?.[0]?.content?.parts ?? [];
    for (const part of got) {
      const img = part.inlineData ?? (part.inline_data && { mimeType: part.inline_data.mime_type, data: part.inline_data.data });
      if (img?.data) return { image: `data:${img.mimeType};base64,${img.data}` };
    }
    const finish = result.candidates?.[0]?.finishReason ?? "";
    const said = got.map((p) => p.text ?? "").join(" ").replace(/\s+/g, " ").trim();
    const blocked = !!result.promptFeedback?.blockReason || /SAFETY|PROHIBITED|BLOCKLIST|RECITATION/.test(finish);
    console.log("gemini no image", attempt, finish, result.promptFeedback?.blockReason, said.slice(0, 200));
    reason = blocked ? "blocked" : "no_image";
    detail = [finish || result.promptFeedback?.blockReason || "NO_IMAGE", said.slice(0, 140)].filter(Boolean).join(" \xB7 ");
    if (blocked && attempt >= 1) return { reason, detail };
  }
  return { reason, detail };
}
__name(geminiImage, "geminiImage");

// ../../../../../../../tmp/wr/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../../../../tmp/wr/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-43XpaV/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../../../../../../tmp/wr/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-43XpaV/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  GeminiRelay,
  QuotaCounter,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  buildPrompt,
  buildPromptV2,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
