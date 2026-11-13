/**
 * Lets the browser start the first photos while the app is still starting.
 *
 * The home gallery and the product page only know which photo to show after the app has loaded and
 * fetched the product data, so the browser discovers the main photo late. This step (run after
 * build-images.mjs) adds a small inline script to dist/index.html that, for the home page and for a
 * product page, preloads exactly the files those pages request anyway:
 *  - home: the first gallery photo, with the same srcset/sizes as its <img> so the browser picks the
 *    same file (preloading every gallery photo was measured slower: it competes with the app itself);
 *  - /product/<id>: that product's main photo, again with the <img>'s srcset/sizes.
 * Other pages are untouched. Nothing visible changes; a wrong guess only costs one extra request.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PUB = path.join(ROOT, 'public');
const DIST = path.join(ROOT, 'dist');
const WIDTHS = [480, 960, 1600];
const copy = (src, w) => `_img/${src.replace(/\.(jpe?g|png)$/i, '')}-${w}.webp`;
const local = (src) => /^products\/.+\.(jpe?g|png)$/i.test(src);

const manifest = JSON.parse(fs.readFileSync(path.join(PUB, 'products', 'manifest.json'), 'utf8'));
const ids = manifest.products.map((p) => (typeof p === 'string' ? p : p.id));
// Same rule as the site (src/v3/data.ts isReal): only real, checked products are shown.
const real = ids
  .map((id) => JSON.parse(fs.readFileSync(path.join(PUB, 'products', id, 'product.json'), 'utf8')))
  .filter((p) => !p.sample && p.images?.length > 0 && p.name?.status === 'VERIFIED' && p.price?.status === 'VERIFIED')
  .filter((p) => local(p.images[0]));

for (const p of real) for (const w of WIDTHS) if (!fs.existsSync(path.join(DIST, copy(p.images[0], w)))) throw new Error(`preload-images: missing ${copy(p.images[0], w)}`);

const set = (src) => WIDTHS.map((w) => `${copy(src, w)} ${w}w`).join(', ');
const data = {
  home: { first: real[0] && { srcset: set(real[0].images[0]), sizes: '(max-width: 767px) 70vw, 40vw' } },
  product: Object.fromEntries(real.map((p) => [p.id, { srcset: set(p.images[0]), sizes: '(max-width: 1023px) 100vw, 50vw' }])),
};

const script = `<script>(function(){var d=${JSON.stringify(data)};var h=location.hash.replace(/^#/,'')||'/';function pre(o,hi){var l=document.createElement('link');l.rel='preload';l.as='image';if(o.href)l.href=o.href;if(o.srcset){l.setAttribute('imagesrcset',o.srcset);l.setAttribute('imagesizes',o.sizes);}if(hi)l.setAttribute('fetchpriority','high');document.head.appendChild(l);}if(/^\\/(\\?|$)/.test(h)){if(d.home.first)pre(d.home.first,true);}else{var m=/^\\/product\\/([a-z0-9-]+)/.exec(h);if(m&&d.product[m[1]])pre(d.product[m[1]],true);}})();</script>`;

const file = path.join(DIST, 'index.html');
const html = fs.readFileSync(file, 'utf8');
if (html.includes('preload-images:start')) throw new Error('preload-images: already applied');
fs.writeFileSync(file, html.replace('</head>', `<!-- preload-images:start -->${script}<!-- preload-images:end -->\n  </head>`));
console.log(`preload-images: home 1 file, ${Object.keys(data.product).length} product pages`);
