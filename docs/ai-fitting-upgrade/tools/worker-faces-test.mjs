// Worker: optional real-surface references (`faces`). Mock Gemini — this checks the REQUEST STRUCTURE only, not image quality.
// Usage: node worker-faces-test.mjs <scratch dir containing worker.mjs bundle and fake-gemini.png>
import fs from 'node:fs';
const D = process.argv[2];
const png = fs.readFileSync(D + '/fake-gemini.png').toString('base64');
const jpg = fs.readFileSync('/home/user/lagi-ar/public/products/plano-bag/images/main.jpg');
const calls = [];
globalThis.fetch = async (url, init) => {
  url = String(url);
  if (url.includes('generativelanguage')) {
    const parts = JSON.parse(init.body).contents[0].parts;
    calls.push({ text: parts[0].text, images: parts.filter((p) => p.inline_data).length });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png } }] } }] }));
  }
  if (url.includes('/products/')) return new Response(jpg, { headers: { 'Content-Type': 'image/jpeg' } });
  throw new Error('unexpected fetch ' + url);
};
const { default: w } = await import(D + '/worker.mjs');
const kv = () => { const m = new Map(); return { get: async (k) => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); }, delete: async (k) => m.delete(k), list: async () => ({ keys: [], list_complete: true }) }; };
const O = 'https://ewq122334455-tech.github.io';
const env = () => ({ GEMINI_API_KEY: 'k', GEMINI_MODEL: 'gemini-2.5-flash-image', ALLOWED_ORIGINS: O, MEDIA: kv() });
const person = 'data:image/jpeg;base64,' + jpg.toString('base64');
const F = (n) => `${O}/lagi-ar/products/plano-bag/model/${n}.jpg`;
const req = (extra) => new Request('https://w/', { method: 'POST', headers: { Origin: O, 'Content-Type': 'application/json' }, body: JSON.stringify({ person, productImage: F('front').replace('model/front', 'images/main'), productName: 'Plano', category: 'Bag', style: 'held in one hand', ...extra }) });
const ok = (n, c, i = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${i ? '  — ' + i : ''}`);
const fit = async (extra) => { calls.length = 0; const r = await w.fetch(req(extra), env()); await r.json(); return calls.at(-1); };
let c = await fit({ promptVersion: 'v2', faces: [F('front'), F('back')] });
ok('v2 + 2 faces: fitting call carries person + cut-out + 2 faces = 4 images', c.images === 4, `${c.images}`);
ok('v2 + faces: prompt tells the model they are surface photos, outline from image 2', /Images 3–4 are flat, unretouched/.test(c.text) && /outline from image 2/.test(c.text));
c = await fit({ promptVersion: 'v2', faces: [F('front')] });
ok('v2 + 1 face: singular wording', /Image 3 is a flat, unretouched photo/.test(c.text) && c.images === 3);
c = await fit({ faces: [F('front'), F('back')] });
ok('v1 (default) ignores faces: 2 images, v1 prompt unchanged', c.images === 2 && !/unretouched/.test(c.text));
c = await fit({ promptVersion: 'v2' });
ok('v2 without faces: no extra wording, 2 images', c.images === 2 && !/unretouched/.test(c.text));
c = await fit({ promptVersion: 'v2', faces: [F('front'), F('back'), F('left'), F('right'), F('top')] });
ok('at most 3 faces are used', c.images === 5, `${c.images}`);
c = await fit({ promptVersion: 'v2', faces: ['https://evil.example/x.jpg', F('front')] });
ok('a face from another origin is skipped, same-origin kept', c.images === 3, `${c.images}`);
c = await fit({ promptVersion: 'v2', faces: 'not-an-array' });
ok('malformed faces ignored', c.images === 2);
