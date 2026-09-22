import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useProduct } from '@/hooks/useProducts';
import { useSpotlight } from '@/hooks/useSpotlight';
import { Loading } from '@/components/Loading';
import { ErrorState } from '@/components/ErrorState';
import { ContentBadge } from '@/components/ContentBadge';
import { DetailSection } from '@/components/DetailSection';
import { SpotlightMenu } from '@/components/SpotlightMenu';
import { SpotlightPanel } from '@/components/SpotlightPanel';
import { PhoneMockup } from '@/components/PhoneMockup';
import { ProductViewer } from '@/three/ProductViewer';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const state = useProduct(id);

  if (state.status === 'loading') return <Loading label="제품 정보를 불러오는 중" />;
  if (state.status === 'error')
    return (
      <ErrorState
        message={state.message}
        action={
          <Link to="/products" className="inline-block rounded-full bg-ink px-6 py-3 font-heading text-sm font-extrabold text-paper focus-ring">
            제품 목록으로
          </Link>
        }
      />
    );

  return <ProductDetailView product={state.data} />;
}

function ProductDetailView({ product }: { product: import('@/data/productTypes').Product }) {
  const { selected, selectedId, select, clear } = useSpotlight(product.hotspots);
  const [activeAnimation, setActiveAnimation] = useState<string | null>(null);
  const arUrl = product.arAvailable
    ? `${window.location.origin}${window.location.pathname}#/ar/${product.id}`
    : null;

  return (
    <div>
      {/* PRODUCT HERO + 3D/IMAGE + LOOK CLOSER */}
      <section className="grid grid-cols-1 lg:min-h-[88vh] lg:grid-cols-2">
        <div className="relative min-h-[50vh] bg-mist lg:min-h-full">
          <ProductViewer
            className="h-full min-h-[50vh] w-full lg:absolute lg:inset-0"
            modelUrl={product.model3D}
            hotspots={product.hotspots}
            selectedHotspotId={selectedId}
            onSelectHotspot={select}
            animations={product.animations}
            activeAnimation={activeAnimation}
            onSetAnimation={setActiveAnimation}
          />
          <SpotlightPanel hotspot={selected} onClose={clear} />
        </div>

        <div className="flex flex-col justify-center px-6 py-16 lg:px-14 lg:py-16">
          {product.category.value && <p className="eyebrow text-stone">{product.category.value}</p>}
          {product.name.value ? (
            <h1 className="mt-3 font-display text-5xl leading-none lg:text-6xl">{product.name.value}</h1>
          ) : (
            <div className="mt-3">
              <ContentBadge status={product.name.status} />
            </div>
          )}

          <div className="mt-5 flex items-center gap-3">
            {product.price.value != null ? (
              <p className="font-heading text-2xl font-extrabold">{product.price.value.toLocaleString('ko-KR')}원</p>
            ) : (
              <ContentBadge status={product.price.status} />
            )}
          </div>

          {product.shortDescription.value ? (
            <p className="mt-6 max-w-md text-lg text-graphite">{product.shortDescription.value}</p>
          ) : (
            <div className="mt-6"><ContentBadge status={product.shortDescription.status} /></div>
          )}

          {product.colors.length > 0 && (
            <div className="mt-8">
              <p className="eyebrow mb-3">COLOR</p>
              <div className="flex gap-2">
                {product.colors.map((c) => (
                  <span key={c} className="h-7 w-7 rounded-full border border-line" style={{ backgroundColor: c }} title={c} />
                ))}
              </div>
            </div>
          )}

          {(product.dimensions.widthCm || product.dimensions.heightCm || product.dimensions.depthCm) && (
            <div className="mt-8">
              <p className="eyebrow mb-3">DIMENSIONS</p>
              <p className="text-sm text-graphite">
                {product.dimensions.widthCm ?? '—'} × {product.dimensions.heightCm ?? '—'} × {product.dimensions.depthCm ?? '—'} cm
              </p>
            </div>
          )}

          <div className="mt-10 flex flex-wrap gap-3">
            {product.arAvailable ? (
              <Link
                to={`/ar/${product.id}`}
                className="inline-flex items-center gap-2 rounded-full bg-ink px-7 py-4 font-heading text-sm font-extrabold text-paper transition-transform hover:-translate-y-0.5 focus-ring"
              >
                VIEW IN AR
              </Link>
            ) : (
              <span className="rounded-full border-2 border-dashed border-line px-7 py-4 font-heading text-sm font-bold text-stone">
                AR — CONTENT REQUIRED
              </span>
            )}

            {product.shopUrl.value ? (
              <a
                href={product.shopUrl.value}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border-2 border-ink px-7 py-4 font-heading text-sm font-extrabold text-ink transition-transform hover:-translate-y-0.5 focus-ring"
              >
                BUY PRODUCT →
              </a>
            ) : (
              <span className="rounded-full border-2 border-dashed border-line px-7 py-4 font-heading text-sm font-bold text-stone">
                SHOP URL — CONTENT REQUIRED
              </span>
            )}
          </div>

          {product.hotspots.length > 0 && (
            <div className="mt-12">
              <p className="font-display text-2xl">LOOK CLOSER</p>
              <p className="mb-4 mt-1 text-sm text-stone">Same object, a new angle.</p>
              <SpotlightMenu hotspots={product.hotspots} selectedId={selectedId} onSelect={select} />
            </div>
          )}
        </div>
      </section>

      {/* DESCRIPTION */}
      {product.description.value ? (
        <DetailSection eyebrow="DESCRIPTION">
          <p className="max-w-2xl text-lg leading-relaxed text-graphite">{product.description.value}</p>
        </DetailSection>
      ) : (
        <DetailSection eyebrow="DESCRIPTION">
          <ContentBadge status={product.description.status} />
        </DetailSection>
      )}

      {/* MATERIALS */}
      <DetailSection id="materials" eyebrow="MATERIALS" title="소재" accent="lime">
        {product.materials.length === 0 ? (
          <ContentBadge status="CONTENT_REQUIRED" />
        ) : (
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {product.materials.map((m, i) => (
              <div key={i} className="border-t-2 border-ink pt-5">
                <p className="font-heading text-lg font-extrabold">{m.name.value ?? <ContentBadge status={m.name.status} />}</p>
                {m.characteristics.value && <p className="mt-2 text-sm text-graphite">{m.characteristics.value}</p>}
                {m.reasonForUse.value && <p className="mt-2 text-sm text-stone">{m.reasonForUse.value}</p>}
              </div>
            ))}
          </div>
        )}
      </DetailSection>

      {/* PROCESS */}
      <DetailSection id="process" eyebrow="PROCESS" title="공정" accent="orange">
        {product.process.length === 0 ? (
          <ContentBadge status="CONTENT_REQUIRED" />
        ) : (
          <ol className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {product.process
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((step) => (
                <li key={step.order} className="border-t-2 border-ink pt-5">
                  <p className="font-heading text-xs font-bold text-stone">0{step.order}</p>
                  <p className="mt-2 font-heading text-lg font-extrabold">{step.title}</p>
                  {step.description.value && <p className="mt-2 text-sm text-graphite">{step.description.value}</p>}
                </li>
              ))}
          </ol>
        )}
      </DetailSection>

      {/* LAGI'S VIEW */}
      <DetailSection eyebrow="LAGI'S VIEW" title="LAGI가 이 제품을 선택한 이유">
        {product.lagiSelectionReason.value ? (
          <p className="max-w-2xl text-lg leading-relaxed text-graphite">{product.lagiSelectionReason.value}</p>
        ) : (
          <ContentBadge status={product.lagiSelectionReason.status} />
        )}
      </DetailSection>

      {/* STORY */}
      <DetailSection id="story" eyebrow="STORY" title="이야기" accent="blue">
        {product.story.value ? (
          <p className="max-w-2xl text-lg leading-relaxed text-graphite">{product.story.value}</p>
        ) : (
          <ContentBadge status={product.story.status} />
        )}
      </DetailSection>

      {/* AR EXPERIENCE */}
      <section className="border-t-2 border-ink px-6 py-20 lg:px-10 lg:py-28">
        <div className="mx-auto flex max-w-canvas flex-col items-center gap-14 lg:flex-row lg:justify-between">
          <div className="text-center lg:text-left">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-stone">AR EXPERIENCE</p>
            <h2 className="mt-3 max-w-md font-display text-4xl leading-tight lg:text-5xl">
              휴대폰으로 QR을 스캔하면
              <br />
              바로 AR을 시작할 수 있습니다.
            </h2>
          </div>
          <PhoneMockup arUrl={arUrl} label="SCAN TO SEE IN AR" />
        </div>
      </section>

      {/* SHOP */}
      <section className="border-t-2 border-ink bg-ink px-6 py-20 text-paper lg:px-10 lg:py-28">
        <div className="mx-auto flex max-w-canvas flex-col items-center gap-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-mist">SHOP</p>
          {product.name.value ? (
            <h2 className="font-display text-4xl lg:text-5xl">{product.name.value}</h2>
          ) : (
            <ContentBadge status={product.name.status} />
          )}
          {product.price.value != null && (
            <p className="font-heading text-2xl font-extrabold">{product.price.value.toLocaleString('ko-KR')}원</p>
          )}
          {product.shopUrl.value ? (
            <a
              href={product.shopUrl.value}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-2 rounded-full bg-lime px-8 py-4 font-heading text-sm font-extrabold text-ink transition-transform hover:-translate-y-0.5 focus-ring"
            >
              SHOP NOW →
            </a>
          ) : (
            <span className="mt-2 rounded-full border-2 border-dashed border-paper/30 px-8 py-4 font-heading text-sm font-bold text-mist">
              SHOP URL — CONTENT REQUIRED
            </span>
          )}
        </div>
      </section>
    </div>
  );
}
