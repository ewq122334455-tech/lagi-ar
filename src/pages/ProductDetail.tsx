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
import { BuyPanel } from '@/components/BuyPanel';
import { ProductViewer } from '@/three/ProductViewer';
import { canUseAR } from '@/utils/arAvailability';
import { canUseTryOn } from '@/utils/tryOnAvailability';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const state = useProduct(id);

  if (state.status === 'loading') return <Loading label="제품 정보를 불러오는 중" />;
  if (state.status === 'error')
    return (
      <ErrorState
        message={state.message}
        action={
          <Link to="/products" className="inline-block rounded-full bg-ink px-6 py-3 font-heading text-sm font-semibold text-paper focus-ring">
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
  const arUrl = canUseAR(product)
    ? `${window.location.origin}${window.location.pathname}#/ar/${product.id}`
    : null;
  const tryOnUrl = canUseTryOn(product)
    ? `${window.location.origin}${window.location.pathname}#/try-on/${product.id}`
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
            <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-[-0.035em] lg:text-5xl">{product.name.value}</h1>
          ) : (
            <div className="mt-3">
              <ContentBadge status={product.name.status} />
            </div>
          )}

          <div className="mt-5 flex items-center gap-3">
            {product.price.value != null ? (
              <p className="font-heading text-2xl font-semibold">{product.price.value.toLocaleString('ko-KR')}원</p>
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

          <BuyPanel product={product} />

          {product.hotspots.length > 0 && (
            <div className="mt-12">
              <p className="font-display text-3xl">Look closer.</p>
              <p className="mb-4 mt-1 text-sm text-stone">Same object, a new angle.</p>
              <SpotlightMenu hotspots={product.hotspots} selectedId={selectedId} onSelect={select} />
            </div>
          )}
        </div>
      </section>

      {/* DESCRIPTION */}
      {product.description.value && (
        <DetailSection eyebrow="DESCRIPTION">
          <p className="max-w-2xl text-lg leading-relaxed text-graphite">{product.description.value}</p>
        </DetailSection>
      )}

      {/* MATERIALS */}
      {product.materials.length > 0 && (
        <DetailSection id="materials" eyebrow="MATERIALS" title="소재" accent="lime">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {product.materials.map((m, i) => (
              <div key={i} className="border-t border-line pt-5">
                <p className="text-lg font-semibold">{m.name.value ?? <ContentBadge status={m.name.status} />}</p>
                {m.characteristics.value && <p className="mt-2 text-sm text-graphite">{m.characteristics.value}</p>}
                {m.reasonForUse.value && <p className="mt-2 text-sm text-stone">{m.reasonForUse.value}</p>}
              </div>
            ))}
          </div>
        </DetailSection>
      )}

      {/* PROCESS */}
      {product.process.length > 0 && (
        <DetailSection id="process" eyebrow="PROCESS" title="공정" accent="orange">
          <ol className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {product.process
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((step) => (
                <li key={step.order} className="border-t border-line pt-5">
                  <p className="font-display text-2xl text-stone">0{step.order}</p>
                  <p className="mt-2 text-lg font-semibold">{step.title}</p>
                  {step.description.value && <p className="mt-2 text-sm text-graphite">{step.description.value}</p>}
                </li>
              ))}
          </ol>
        </DetailSection>
      )}

      {/* LAGI'S VIEW */}
      {product.lagiSelectionReason.value && (
        <DetailSection eyebrow="LAGI'S VIEW" title="LAGI가 이 제품을 선택한 이유">
          <p className="max-w-2xl text-lg leading-relaxed text-graphite">{product.lagiSelectionReason.value}</p>
        </DetailSection>
      )}

      {/* STORY */}
      {product.story.value && (
        <DetailSection id="story" eyebrow="STORY" title="이야기" accent="blue">
          <p className="max-w-2xl text-lg leading-relaxed text-graphite">{product.story.value}</p>
        </DetailSection>
      )}

      {/* Sections with no brand-supplied content yet are listed once here instead of
          each rendering an empty block — honest, without the page reading as unfinished. */}
      {missingSections(product).length > 0 && (
        <section id={product.process.length === 0 ? 'process' : undefined} className="scroll-mt-[var(--nav-height)] border-t border-line px-6 py-10 lg:px-10">
          <div className="mx-auto flex max-w-canvas flex-wrap items-center gap-x-4 gap-y-2 text-sm text-stone">
            <ContentBadge status="CONTENT_REQUIRED" />
            <span>준비 중인 정보: {missingSections(product).join(' · ')}</span>
          </div>
        </section>
      )}

      {/* AR EXPERIENCE */}
      <section className="border-t border-line px-6 py-20 lg:px-10 lg:py-28">
        <div className="mx-auto flex max-w-canvas flex-col items-center gap-14 lg:flex-row lg:justify-between">
          <div className="text-center lg:text-left">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-stone">AR EXPERIENCE</p>
            <h2 className="mt-3 max-w-md text-3xl font-semibold leading-tight tracking-[-0.03em] lg:text-4xl">
              휴대폰으로 QR을 스캔하면
              <br />
              바로 AR을 시작할 수 있습니다.
            </h2>
          </div>
          <div className="flex flex-wrap justify-center gap-8">
            <PhoneMockup arUrl={arUrl} label="SCAN TO SEE IN AR" />
            {tryOnUrl && <PhoneMockup arUrl={tryOnUrl} label="SCAN TO TRY IT ON" />}
          </div>
        </div>
      </section>

      {/* SHOP */}
      <section className="border-t border-line bg-ink px-6 py-20 text-paper lg:px-10 lg:py-28">
        <div className="mx-auto flex max-w-canvas flex-col items-center gap-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-mist">SHOP</p>
          {product.name.value ? (
            <h2 className="text-3xl font-semibold tracking-[-0.03em] lg:text-4xl">{product.name.value}</h2>
          ) : (
            <ContentBadge status={product.name.status} />
          )}
          {product.price.value != null && (
            <p className="font-heading text-2xl font-semibold">{product.price.value.toLocaleString('ko-KR')}원</p>
          )}
          {product.shopUrl.value ? (
            <a
              href={product.shopUrl.value}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-2 rounded-full bg-lime px-8 py-4 font-heading text-sm font-semibold text-ink transition-transform hover:-translate-y-0.5 focus-ring"
            >
              구매하러 가기 →
            </a>
          ) : (
            <span className="mt-2 rounded-full border border-dashed border-paper/30 px-8 py-4 font-heading text-sm font-bold text-mist">
              SHOP URL — CONTENT REQUIRED
            </span>
          )}
        </div>
      </section>
    </div>
  );
}

function missingSections(product: import('@/data/productTypes').Product): string[] {
  const missing: string[] = [];
  if (!product.description.value) missing.push('제품 설명');
  if (product.materials.length === 0) missing.push('소재');
  if (product.process.length === 0) missing.push('공정');
  if (!product.lagiSelectionReason.value) missing.push('선정 이유');
  if (!product.story.value) missing.push('이야기');
  return missing;
}
