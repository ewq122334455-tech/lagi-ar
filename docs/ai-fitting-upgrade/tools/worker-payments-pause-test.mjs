// On-site payment pause: with PAYMENTS_DISABLED=1 no NEW order can be created; looking up / confirming existing ones is not touched. NO real call.
// Usage: node worker-payments-pause-test.mjs <dir with worker.mjs>
import { makeQuotaNs } from './quota-mock.mjs';
const D = process.argv[2];
let toss = 0, kvWrites = 0;
globalThis.fetch = async (url) => { if (String(url).includes('tosspayments')) toss++; return new Response('not found', { status: 404 }); }; // no network: every outside address answers 404
const { default: w, QuotaCounter } = await import(D + '/worker.mjs');
const O = 'https://ewq122334455-tech.github.io';
const ok = (n, c, i = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${i ? '  — ' + i : ''}`);
const orders = { get: async () => null, put: async () => { kvWrites++; }, list: async () => ({ keys: [] }), delete: async () => {} };
const mk = (over = {}) => ({ ALLOWED_ORIGINS: O, QUOTA: makeQuotaNs(QuotaCounter), ORDERS: orders, PRODUCTS_BASE_URL: O + '/lagi-ar/products', TOSS_SECRET_KEY: 'tk', ...over });
const call = (env, path, body) => w.fetch(new Request('https://w' + path, { method: 'POST', headers: { Origin: O, 'CF-Connecting-IP': '1.2.3.4', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), env);
const order = { items: [{ productId: 'daily-tote', quantity: 1 }], customer: { name: 'a', phone: '01000000000', email: 'a@b.co' }, shipping: { recipient: 'a', phone: '01000000000', zonecode: '12345', address: 'x', addressDetail: 'y', memo: '' }, agree: true };

let r = await call(mk({ PAYMENTS_DISABLED: '1' }), '/orders', order);
let j = await r.json();
ok('paused: creating an order is refused with 503 "paused" and a message that points to the store', r.status === 503 && j.reason === 'paused' && /스마트스토어/.test(j.error));
ok('paused: nothing was written and no payment provider was contacted', kvWrites === 0 && toss === 0);
r = await call(mk({ PAYMENTS_DISABLED: '1' }), '/payments/confirm', { paymentKey: 'k', orderId: 'o', amount: 1 });
j = await r.json();
ok('paused: confirming an EXISTING order is not blocked by the pause (a customer who already paid still gets confirmed)', j.reason !== 'paused', `status ${r.status}`);
r = await call(mk(), '/orders', order);
j = await r.json().catch(() => ({}));
ok('not paused: the pause message does not appear', j.reason !== 'paused', `status ${r.status}`);
