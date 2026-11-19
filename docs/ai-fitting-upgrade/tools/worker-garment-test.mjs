// Photo compositing with CLOTHES: the clean garment photo goes in as it is (no bag cut-out step) with the garment prompt. MOCK Gemini only.
// Usage: node worker-garment-test.mjs <dir with worker.mjs and fake-gemini.png>
import fs from 'node:fs';
import { makeQuotaNs } from './quota-mock.mjs';
const D = process.argv[2];
const png = fs.readFileSync(D + '/fake-gemini.png').toString('base64');
const jpg = fs.readFileSync('/home/user/lagi-ar/public/products/plano-bag/images/main.jpg');
let calls = [];
globalThis.fetch = async (url, init) => {
  url = String(url);
  if (url.includes('generativelanguage')) {
    calls.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png } }] } }] }));
  }
  if (url.includes('/products/')) return new Response(jpg, { headers: { 'Content-Type': 'image/jpeg' } });
  throw new Error('unexpected fetch ' + url);
};
const { default: w, QuotaCounter } = await import(D + '/worker.mjs');
const O = 'https://ewq122334455-tech.github.io';
const ok = (n, c, i = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${i ? '  — ' + i : ''}`);
const person = 'data:image/jpeg;base64,' + jpg.toString('base64');
const env = () => ({ ALLOWED_ORIGINS: O, QUOTA: makeQuotaNs(QuotaCounter), GEMINI_API_KEY: 'g', GEMINI_MODEL: 'm', TRYON_DAILY_UNITS_SITE: '100', TRYON_DAILY_UNITS_PER_IP: '100' });
const post = (e, b, ip) => w.fetch(new Request('https://w/', { method: 'POST', headers: { Origin: O, 'CF-Connecting-IP': ip, 'Content-Type': 'application/json' }, body: JSON.stringify(b) }), e);
const base = { person, productImage: `${O}/lagi-ar/products/plano-bag/images/drawings/front.jpg`, productName: '스타 니트 세트', style: 'worn naturally' };
const text = (c) => c.contents[0].parts[0].text;
const nimg = (c) => c.contents[0].parts.filter((p) => p.inline_data).length;

let e = env(); calls = [];
let r = await post(e, { ...base, garment: 'set' }, '1.1.1.1');
ok('clothing: 200 with an image', r.status === 200 && !!(await r.json()).image);
ok('clothing: exactly ONE Gemini call (no cut-out step)', calls.length === 1, String(calls.length));
ok('clothing: person + garment photo only (two images)', nimg(calls[0]) === 2);
ok('clothing: garment prompt (keep body, no underwear, replace outfit) and no bag wording', /virtual fitting room for a clothing brand/.test(text(calls[0])) && /NO underwear/.test(text(calls[0])) && !/carrying|handle|backpack/i.test(text(calls[0])));
e = env(); calls = [];
r = await post(e, { ...base, garment: 'bag-hack' }, '2.2.2.2'); await r.json();
ok('an unknown garment value is ignored (old bag path: cut-out + compose)', calls.length === 2);
e = env(); calls = [];
r = await post(e, base, '3.3.3.3'); await r.json();
ok('no garment: old path unchanged (cut-out + compose)', calls.length === 2);
