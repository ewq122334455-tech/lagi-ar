#!/usr/bin/env node
/**
 * Adds ONE clothing product (top, bottom, set, outer, dress) to the site from a small spec file and the photos you give.
 * It writes public/products/<id>/product.json + images, and appends the id to public/products/manifest.json.
 * Nothing is invented: every text you do not provide is marked CONTENT_REQUIRED (the page then shows nothing for it),
 * and a product is only listed on the site once its name and price are provided (status VERIFIED = "the owner gave it").
 *
 *   node scripts/add-clothing.mjs spec.json [--dry-run]
 *
 * spec.json (only id, name, category, price and main are required):
 * {
 *   "id": "lagi-again-set-black",                // folder name, lowercase letters, digits, dashes
 *   "name": "AGAIN 스웻 세트 블랙",               // the exact product name; for a set, the name says it is a set
 *   "category": "Set",                           // Top | Bottom | Set | Outer | Dress
 *   "price": 98000,
 *   "setItems": ["AGAIN 스웻 후드 블랙", "AGAIN 스웻 팬츠 블랙"],   // Set only: what the set contains, exact names
 *   "shortDescription": "…", "description": "…",
 *   "colors": ["#1D1D1F"],
 *   "sizes": ["S", "M", "L"],
 *   "materials": [{ "name": "…", "characteristics": "…" }],
 *   "main": "/path/main.jpg",                    // the clean product photo (flat lay or ghost mannequin, plain background) — also what the AI fitting uses
 *   "gallery": ["/path/detail1.jpg"],            // optional extra photos
 *   "shipping": { "fee": 3000, "freeOver": 50000 }
 * }
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const specFile = process.argv[2];
const dry = process.argv.includes('--dry-run');
if (!specFile || !fs.existsSync(specFile)) {
  console.log('usage: node scripts/add-clothing.mjs spec.json [--dry-run]   (see the top of this file for the spec format)');
  process.exit(2);
}
const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
const fail = (m) => {
  console.log('ERROR: ' + m);
  process.exit(3);
};
const CATS = ['Top', 'Bottom', 'Set', 'Outer', 'Dress'];
if (!/^[a-z0-9][a-z0-9-]{2,60}$/.test(spec.id ?? '')) fail('id must be lowercase letters, digits and dashes (3-60 characters).');
if (typeof spec.name !== 'string' || spec.name.trim().length < 2) fail('name is required (the exact product name).');
if (!CATS.includes(spec.category)) fail(`category must be one of ${CATS.join(', ')}.`);
if (!Number.isInteger(spec.price) || spec.price <= 0) fail('price must be a whole number in KRW.');
if (!spec.main || !fs.existsSync(spec.main)) fail('main: the path of the clean product photo is required and must exist.');
if (spec.category === 'Set') {
  if (!Array.isArray(spec.setItems) || spec.setItems.length < 2) fail('a Set needs setItems: the exact names of the pieces it contains (at least 2).');
  if (!/세트|set/i.test(spec.name)) fail('the name of a Set must say it is a set (for example "… 세트").');
}
const dir = path.join(root, 'public', 'products', spec.id);
if (fs.existsSync(path.join(dir, 'product.json'))) fail(`public/products/${spec.id} already exists. Pick another id or remove it first.`);

const today = new Date().toISOString().slice(0, 10);
const src = `사용자 제공 (${today})`;
const v = (value) => ({ value, status: 'VERIFIED', source: src });
const missing = () => ({ value: null, status: 'CONTENT_REQUIRED' });
const opt = (value) => (typeof value === 'string' && value.trim() ? v(value.trim()) : missing());
const ext = (f) => path.extname(f).toLowerCase() || '.jpg';

const files = [];
const main = `products/${spec.id}/images/main${ext(spec.main)}`;
files.push([spec.main, main]);
// The clean photo is also the "front" reference the AI fitting uses (drawings/front), so nothing is redrawn.
const front = `products/${spec.id}/images/drawings/front${ext(spec.main)}`;
files.push([spec.main, front]);
const gallery = (spec.gallery ?? []).map((g, i) => {
  if (!fs.existsSync(g)) fail(`gallery photo not found: ${g}`);
  const to = `products/${spec.id}/images/detail${i + 1}${ext(g)}`;
  files.push([g, to]);
  return to;
});

const sizes = Array.isArray(spec.sizes) && spec.sizes.length ? spec.sizes : [];
const product = {
  id: spec.id,
  brandLabel: 'LAGI',
  name: v(spec.name.trim()),
  category: v(spec.category),
  price: v(spec.price),
  currency: 'KRW',
  shortDescription: opt(spec.shortDescription),
  description: opt(spec.description),
  images: [main],
  gallery,
  colors: spec.colors ?? [],
  variants: sizes.map((s) => ({ id: `${spec.id}-${String(s).toLowerCase()}`, size: String(s), color: null, stock: null })),
  dimensions: {},
  shipping: spec.shipping ?? { fee: 3000, freeOver: 50000 },
  materials: (spec.materials ?? []).map((m) => ({ name: v(m.name), characteristics: opt(m.characteristics), productLocation: missing(), reasonForUse: missing() })),
  process: [],
  details: [],
  story: missing(),
  lagiSelectionReason: missing(),
  drawings: [{ src: front, label: '정면', group: 'view' }],
  // Not on the smart store unless the spec says so: the page then shows no store links and no buy buttons.
  storeListed: spec.storeListed === true,
  ...(spec.category === 'Set' ? { setItems: spec.setItems.map((s) => String(s).trim()) } : {}),
  model3D: '',
  animations: [],
  arTarget: '',
  arSettings: { scale: 1, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
  hotspots: [],
  shopUrl: { value: spec.shopUrl ?? 'https://smartstore.naver.com/lagi_official', status: 'VERIFIED', source: spec.shopUrl ? src : 'Official LAGI Smart Store' },
  instagramUrl: 'https://www.instagram.com/lagi.official/',
  arAvailable: false,
  threeDAvailable: false,
  featured: false,
};

console.log(`Product : ${spec.name} (${spec.category}${spec.category === 'Set' ? `: ${product.setItems.join(' + ')}` : ''}) — ${spec.price.toLocaleString('ko-KR')}원`);
console.log(`Folder  : public/products/${spec.id}`);
console.log(`Photos  : ${files.length} file(s) copied, listed as ${main}${gallery.length ? ` + ${gallery.length} detail photo(s)` : ''}`);
console.log(`Missing : ${['shortDescription', 'description'].filter((k) => !spec[k]).join(', ') || 'nothing'} (shown as nothing on the page until you provide it)`);
if (dry) {
  console.log('(dry run: nothing written)');
  process.exit(0);
}
for (const [from, to] of files) {
  const target = path.join(root, 'public', to);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(from, target);
}
fs.writeFileSync(path.join(dir, 'product.json'), JSON.stringify(product, null, 2) + '\n');
const manifestFile = path.join(root, 'public', 'products', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
if (!manifest.products.includes(spec.id)) manifest.products.push(spec.id);
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
console.log('Written. Open the site and check the list, the product page and the AI fitting tab.');
