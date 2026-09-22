# LAGI — Digital Product Experience

A large-screen-first web platform for LAGI: product discovery, a real-time 3D
product viewer, a Spotlight/hotspot inspection system, and a GLB-based WebAR
experience (image tracking via MindAR + three.js), all driven by one shared
product data model.

This replaces the earlier `legacy-prototype/` PNG-overlay AR demo (kept for
reference only — nothing in this app depends on it).

## Stack

- React 18 + TypeScript + Vite
- Tailwind CSS (editorial design system, tokens in `tailwind.config.js` / `src/index.css`)
- React Three Fiber + drei (3D viewer)
- MindAR (image tracking) + three.js, loaded on demand (AR route only)
- React Router (`HashRouter`, so the build deploys to static hosting — e.g. GitHub Pages — with no server rewrite rules)

## Getting started

```bash
npm install
npm run dev       # http://localhost:5173
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build locally
```

## Project structure

```
src/
  ai/            AIProvider / ThreeDGenerationProvider abstractions (spec §20-21)
  ar/            AR provider abstraction + MindAR implementation + AR experience UI
  components/    Shared UI (Nav, Footer, ProductCard, ContentBadge, SpotlightPanel, QRCode…)
  data/          Product schema, product engine (fetch/cache), content-status types
  hooks/         useProducts / useProduct / useSpotlight
  pages/         Route-level pages, incl. pages/workspace/ (admin tool)
  three/         3D viewer (ProductViewer, Model, PlaceholderModel, CameraRig, Hotspots)
public/
  products/manifest.json         list of published product IDs
  products/<id>/product.json     one product's full data
  products/<id>/images|model|ar|textures/   that product's assets
```

## Product data & content-status rules

Every factual field on a `Product` (`src/data/productTypes.ts`) is a
`VerifiableField<T>` carrying a status: `VERIFIED`, `AI_DRAFT`, `UNKNOWN`, or
`CONTENT_REQUIRED`. The UI never presents unverified content as fact — it
renders a `CONTENT REQUIRED` / `UNVERIFIED` badge instead. Nothing in this
codebase invents price, materials, dimensions, brand history, or
sustainability claims; see `src/utils/contentStatus.ts`.

`product-001`'s only populated content today is the three hotspot callouts
("Zipper Detail", "Handle Detail", "Modular Zipper") lifted verbatim from the
brand-supplied `legacy-prototype/LAGI.png` graphic — everything else on that
record is `CONTENT_REQUIRED` on purpose.

## Adding a product

**Static hosting has no server to write to**, so publishing is a two-step,
no-rebuild-needed process:

1. Open `/#/workspace` (an internal, unlinked-from-nav tool — do not expose
   it to visitors). Fill in product info, images, GLB, AR target/calibration,
   hotspots, materials, process. "Save Draft" stores it in this browser's
   `localStorage` so you can preview it live at `/product/<id>` and
   `/ar/<id>` immediately.
2. Click "Download product.json", save it to
   `public/products/<id>/product.json`, add the real asset files under
   `public/products/<id>/{images,model,ar,textures}/`, and add `"<id>"` to
   `public/products/manifest.json`. Commit and deploy — no rebuild logic
   needed beyond the normal static build, and the app picks it up at runtime.

## 3D & AR status

The 3D viewer, Spotlight/hotspot system, and AR camera/tracking/error-state
architecture are fully built and exercised by `product-001`. What's
**not** included, because no real assets exist yet, is:

- A real GLB model for any product (the viewer shows a labeled placeholder
  mesh instead — see `src/three/PlaceholderModel.tsx` — never a fake "real"
  model).
- A compiled `.mind` AR target image for any product. Compile one with the
  [MindAR image target compiler](https://hiukim.github.io/mind-ar-js-doc/tools/compile)
  and point `arTarget` at the resulting file (see the workspace's "3D & AR" tab).

Once both exist for a product, set `threeDAvailable` / `arAvailable: true`
and the 3D and AR experiences activate immediately — no code changes.

## AI provider & 3D generation provider

`src/ai/AIProvider.ts` and `src/ai/ThreeDGenerationProvider.ts` define
provider-agnostic interfaces (image analysis, description drafting, 3D
generation). No API keys live in this frontend. By default both resolve to a
`Null…Provider` that is honest about being unavailable and never fabricates
results. To connect a real backend, set `VITE_AI_API_BASE` /
`VITE_3D_GENERATION_API_BASE` to a secure server you control (frontend →
your API → the AI/3D vendor — the vendor key never touches the browser).

## Deployment (static hosting / GitHub Pages)

```bash
npm run build
# deploy the dist/ folder to your static host, or push it to a gh-pages branch
```

`vite.config.ts` uses `base: './'` and the app uses `HashRouter`, so the
build works from any subpath without extra server configuration.
