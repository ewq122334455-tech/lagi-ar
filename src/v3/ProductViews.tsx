import type { Product } from '@/data/productTypes';

type Drawing = NonNullable<Product['drawings']>[number];

/** A close-up of the real store photo — the same pixels, cropped, never generated. */
function PhotoDetail({ src, x, y, label, zoom = 2.4 }: { src: string; x: number; y: number; label: string; zoom?: number }) {
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

function Tile({ d, name, fit = 'contain' }: { d: Drawing; name: string; fit?: 'contain' | 'cover' }) {
  return (
    <figure data-testid="product-drawing">
      <div className={`flex items-center justify-center overflow-hidden bg-white ${fit === 'contain' ? 'aspect-[4/5] p-4' : 'aspect-square'}`}>
        <img src={d.src} alt={`${name} — ${d.label}`} loading="lazy" className={fit === 'contain' ? 'max-h-full max-w-full object-contain' : 'h-full w-full object-cover'} />
      </div>
      <figcaption className="t-caption kr mt-2 text-[var(--c-mute)]">{d.label}</figcaption>
    </figure>
  );
}

function Block({ title, en, note, children }: { title: string; en: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="mt-14 first:mt-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="t-value kr font-semibold">{title}</h3>
        <span className="t-label t-mark text-[var(--c-mute)]">{en}</span>
        {note && <span className="t-caption kr text-[var(--c-mute)] md:ml-auto">{note}</span>}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

/**
 * The product from every side. 구도 · 형태 · 디테일 come from the brand's 3D modelling reference
 * sheet (renderings, labelled as such); 착용 is the real store photo and close-ups of it.
 */
export function ProductViews({ src, name, product }: { src: string; name: string; product: Product }) {
  const drawings = product.drawings ?? [];
  const views = drawings.filter((d) => d.group === 'view');
  const forms = drawings.filter((d) => d.group === 'form');
  // Wide sample strips (several materials side by side) read best uncropped, on their own row.
  const isStrip = (d: Drawing) => d.label.startsWith('소재') && !d.label.includes('·');
  const details = drawings.filter((d) => d.group === 'detail' && !isStrip(d));
  const strips = drawings.filter((d) => d.group === 'detail' && isStrip(d));
  const photo = product.views;
  return (
    <section className="mt-20" aria-labelledby="views-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-black/15 pt-4">
        <h2 id="views-title" className="t-h3 kr">
          구도 · 형태 · 착용
        </h2>
        <p className="t-label t-mark text-[var(--c-mute)]">Views, form & fit</p>
      </div>

      {views.length > 0 && (
        <Block title="구도" en="Views" note="제품 도면(3D 모델링 렌더링) · 실제 제품과 세부가 다를 수 있어요">
          <div className={`grid grid-cols-2 gap-[var(--gap)] ${views.length >= 5 ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
            {views.map((d) => (
              <Tile key={d.src} d={d} name={name} />
            ))}
          </div>
        </Block>
      )}

      {forms.length > 0 && (
        <Block title="형태" en="Form">
          <div className="grid grid-cols-1 gap-[var(--gap)] sm:grid-cols-2 lg:grid-cols-3">
            {forms.map((d) => (
              <figure key={d.src} data-testid="product-drawing">
                <div className="flex aspect-[3/2] items-center justify-center overflow-hidden bg-white p-4">
                  <img src={d.src} alt={`${name} — ${d.label}`} loading="lazy" className="max-h-full max-w-full object-contain" />
                </div>
                <figcaption className="t-caption kr mt-2 text-[var(--c-mute)]">{d.label}</figcaption>
              </figure>
            ))}
          </div>
        </Block>
      )}

      {(details.length > 0 || strips.length > 0) && (
        <Block title="디테일 · 소재" en="Details & material">
          <div className="grid grid-cols-2 gap-[var(--gap)] md:grid-cols-4">
            {details.map((d) => (
              <Tile key={d.src} d={d} name={name} fit="cover" />
            ))}
          </div>
          {strips.map((d) => (
            <figure key={d.src} className="mt-[var(--gap)]" data-testid="product-drawing">
              <img src={d.src} alt={`${name} — ${d.label}`} loading="lazy" className="block h-auto w-full bg-white" />
              <figcaption className="t-caption kr mt-2 text-[var(--c-mute)]">{d.label}</figcaption>
            </figure>
          ))}
        </Block>
      )}

      {photo && (
        <Block title="실제 사진 · 착용" en="Real photo, worn & in use" note="실제 제품 사진">
          <div className="grid grid-cols-2 gap-[var(--gap)] lg:grid-cols-4">
            <figure className="col-span-2 row-span-2" data-testid="product-view-main">
              <img src={src} alt={`${name} — ${photo.main}`} loading="lazy" className="block aspect-square w-full bg-[var(--c-gray)] object-cover" />
              <figcaption className="t-caption kr mt-2 text-[var(--c-mute)]">{photo.main}</figcaption>
            </figure>
            {photo.details.slice(0, 2).map((d) => (
              <PhotoDetail key={d.label} src={src} x={d.x} y={d.y} label={d.label} />
            ))}
          </div>
        </Block>
      )}
    </section>
  );
}
