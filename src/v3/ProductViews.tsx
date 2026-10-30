import type { Product, ProductDimensions } from '@/data/productTypes';

type ProductViewsData = NonNullable<Product['views']>;

/** A close-up of the real photo — the same pixels, cropped, never generated. */
function Detail({ src, x, y, label, zoom = 2.4 }: { src: string; x: number; y: number; label: string; zoom?: number }) {
  return (
    <figure data-testid="product-detail-crop">
      <div
        className="aspect-square w-full bg-[var(--c-gray)] bg-no-repeat"
        style={{ backgroundImage: `url(${src})`, backgroundSize: `${zoom * 100}%`, backgroundPosition: `${x}% ${y}%` }}
        role="img"
        aria-label={`확대 · ${label}`}
      />
      <figcaption className="t-caption kr mt-2 text-[var(--c-mute)]">확대 · {label}</figcaption>
    </figure>
  );
}

/** Oblique size drawing from the verified dimensions (cm). */
function SizeDrawing({ w, h, d }: { w: number; h: number; d: number }) {
  const s = 100 / Math.max(w + d * 0.5, h + d * 0.5); // fit in 100 units
  const W = w * s;
  const H = h * s;
  const dx = d * s * 0.5;
  const dy = d * s * 0.35;
  const x0 = 18;
  const y0 = 14 + dy;
  const line = 'stroke-[var(--c-ink)]';
  return (
    <svg viewBox={`0 0 ${x0 + W + dx + 34} ${y0 + H + 26}`} className="max-h-full w-full" role="img" aria-label={`크기 도면: 가로 ${w}cm, 높이 ${h}cm, 폭 ${d}cm`} data-testid="size-drawing">
      <g fill="none" strokeWidth={0.6} className={line}>
        <path d={`M${x0} ${y0} h${W} v${H} h${-W} Z`} className="fill-[var(--c-gray)]" />
        <path d={`M${x0} ${y0} l${dx} ${-dy} h${W} l${-dx} ${dy}`} />
        <path d={`M${x0 + W + dx} ${y0 - dy} v${H} l${-dx} ${dy}`} />
      </g>
      <g className="fill-[var(--c-blue)] stroke-[var(--c-blue)]" strokeWidth={0.5}>
        <path d={`M${x0} ${y0 + H + 7} h${W}`} />
        <path d={`M${x0 - 7} ${y0} v${H}`} />
        <path d={`M${x0 + W + 5} ${y0 + H + 3} l${dx} ${-dy}`} />
      </g>
      <g className="fill-[var(--c-ink)] kr" fontSize={5}>
        <text x={x0 + W / 2} y={y0 + H + 15} textAnchor="middle">
          가로 {w}cm
        </text>
        <text x={x0 - 10} y={y0 + H / 2} textAnchor="middle" transform={`rotate(-90 ${x0 - 10} ${y0 + H / 2})`}>
          높이 {h}cm
        </text>
        <text x={x0 + W + dx / 2 + 8} y={y0 + H - dy / 2 + 2}>폭 {d}cm</text>
      </g>
    </svg>
  );
}

/**
 * Size next to a 170 cm figure. A guide drawn to scale from the verified size — not a worn photo.
 * Bags hang from the hand; small things are held at the waist.
 */
function ScaleGuide({ w, h, small }: { w: number; h: number; small: boolean }) {
  const handY = small ? 100 : 76; // cm above the floor
  const top = 180 - handY - (small ? h / 2 : 0);
  const x = 66;
  return (
    <svg viewBox="0 0 140 186" className="h-full max-w-full" role="img" aria-label={`크기 가이드: 키 170cm 사람 옆의 ${w} × ${h}cm`} data-testid="scale-guide">
      <g className="fill-[var(--c-label)]">
        <circle cx={45} cy={21} r={10.5} />
        <path d="M33 34 h24 q6 0 7 7 l5 42 q1 6 -4 6 h-2 l-4 -36 v38 l2 89 h-10 l-3 -70 l-3 70 h-10 l2 -89 v-38 l-4 36 h-2 q-5 0 -4 -6 l5 -42 q1 -7 7 -7 Z" />
      </g>
      <path d="M0 180.5 H140" className="stroke-[var(--c-ink)]" strokeWidth={0.5} />
      <rect x={x} y={top} width={w} height={h} rx={1.2} className="fill-[var(--c-blue)] opacity-80" />
      <g className="fill-[var(--c-ink)] kr" fontSize={5.5}>
        <text x={x} y={Math.max(14, top - 3)}>
          {w} × {h}cm
        </text>
        <text x={4} y={8}>
          170cm
        </text>
      </g>
    </svg>
  );
}

/**
 * The product's views: the store photo (labelled with what it shows), two close-ups of it, a size
 * drawing and a size guide. Everything comes from the real photo and the verified dimensions.
 */
export function ProductViews({ src, name, views, dims, small }: { src: string; name: string; views: ProductViewsData; dims: ProductDimensions; small: boolean }) {
  const hasSize = !!(dims.widthCm && dims.heightCm);
  return (
    <section className="mt-24 px-page lg:mt-36" aria-labelledby="views-title">
      <div className="rule flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pt-4">
        <h2 id="views-title" className="t-h3 kr">
          구도 · 형태 · 착용
        </h2>
        <p className="t-label t-mark text-[var(--c-mute)]">Views, form & fit</p>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-[var(--gap)] lg:grid-cols-4">
        <figure className="col-span-2 row-span-2" data-testid="product-view-main">
          <img src={src} alt={`${name} — ${views.main}`} loading="lazy" className="block aspect-square w-full bg-[var(--c-gray)] object-cover" />
          <figcaption className="t-caption kr mt-2 text-[var(--c-mute)]">{views.main}</figcaption>
        </figure>
        {views.details.slice(0, 2).map((d) => (
          <Detail key={d.label} src={src} x={d.x} y={d.y} label={d.label} />
        ))}
        {hasSize && (
          <>
            <figure className="flex flex-col">
              <div className="flex aspect-square items-center justify-center overflow-hidden bg-[var(--c-gray)] p-4">
                <SizeDrawing w={dims.widthCm!} h={dims.heightCm!} d={dims.depthCm ?? 0} />
              </div>
              <figcaption className="t-caption kr mt-2 text-[var(--c-mute)]">형태 · 크기 도면</figcaption>
            </figure>
            <figure className="flex flex-col">
              <div className="flex aspect-square items-end justify-center overflow-hidden bg-[var(--c-gray)] px-4 pt-4">
                <ScaleGuide w={dims.widthCm!} h={dims.heightCm!} small={small} />
              </div>
              <figcaption className="t-caption kr mt-2 text-[var(--c-mute)]">착용 · 키 170cm 기준 크기 비교</figcaption>
            </figure>
          </>
        )}
      </div>
    </section>
  );
}
