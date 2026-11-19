// Photo compositing client: clothes send the CLEAN garment photo + garment kind, bags are unchanged. No network (fetch is stubbed).
// Usage (from the repo root): npx esbuild src/tryon/aiTryOn.ts --bundle --format=esm --alias:@=./src --outfile=$T/c.mjs && node docs/ai-fitting-upgrade/tools/clothes-photo-client-test.mjs $T/c.mjs
import fs from 'node:fs';
globalThis.window = { location: { origin: 'https://x.test', pathname: '/lagi-ar/', hash: '' } };
let sent;
globalThis.fetch = async (u, i) => { sent = JSON.parse(i.body); return new Response(JSON.stringify({ image: 'data:image/png;base64,AA' })); };
const { requestAiTryOn } = await import(process.argv[2]);
const ok = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);
const rd = (id) => JSON.parse(fs.readFileSync(`public/products/${id}/product.json`, 'utf8'));
const set = rd('lagi-star-knit-denim-set'), top = rd('lagi-again-tee-black'), bag = rd('plano-bag');
await requestAiTryOn({ person: 'p', product: set, style: 'worn naturally' });
ok('set: clean set photo (drawings/front), garment=set — not the model photo', /drawings\/front/.test(sent.productImage) && sent.garment === 'set' && !/main/.test(sent.productImage));
await requestAiTryOn({ person: 'p', product: top, style: 'worn naturally' });
ok('top: plain top (its only photo is the product photo): garment=top is sent', sent.garment === 'top');
await requestAiTryOn({ person: 'p', product: bag, style: 'hand' });
ok('bag: unchanged (main photo, no garment)', /main/.test(sent.productImage) && sent.garment === undefined);
