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
import { QRCodeImage } from '@/components/QRCode';
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
          <Link to="/products" className="eyebrow mt-2 border border-ink px-6 py-3 hover:bg-ink hover:text-paper focus-ring">
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
  const displayName = product.name.value ?? `Product ${product.id.replace('product-', '#')}`;
  const arUrl = `${window.location.origin}${window.location.pathname}#/ar/${product.id}`;

  return (
    <div>
      {/* HEADER / SPLIT LAYOUT */}
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
          <p className="eyebrow text-stone">{product.category.value ?? 'PRODUCT'}</p>
          <h1 className="mt-3 text-4xl font-medium leading-tight lg:text-5xl">{displayName}</h1>

          <div className="mt-5 flex items-center gap-3">
            {product.price.value != null ? (
              <p className="text-xl">{product.price.value.toLocaleString('ko-KR')}원</p>
            ) : (
              <ContentBadge status={product.price.status} />
            )}
          </div>

          {product.shortDescription.value ? (
            <p className="mt-6 max-w-md text-graphite">{product.shortDescription.value}</p>
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

          <div className="mt-10 flex flex-wrap gap-4">
            {product.arAvailable ? (
              <Link
                to={`/ar/${product.id}`}
                className="eyebrow border border-ink px-7 py-4 transition-colors hover:bg-ink hover:text-paper focus-ring"
              >
                VIEW IN AR
              </Link>
            ) : (
              <span className="eyebrow border border-dashed border-line px-7 py-4 text-stone">
                AR — CONTENT REQUIRED
              </span>
            )}

            {product.shopUrl.value ? (
              <a
                href={product.shopUrl.value}
                target="_blank"
                rel="noopener noreferrer"
                className="eyebrow border border-line px-7 py-4 text-graphite transition-colors hover:border-ink hover:text-ink focus-ring"
              >
                BUY PRODUCT →
              </a>
            ) : (
              <span className="eyebrow border border-dashed border-line px-7 py-4 text-stone">
                SHOP URL — CONTENT REQUIRED
              </span>
            )}
          </div>

          {product.hotspots.length > 0 && (
            <div className="mt-12">
              <p className="eyebrow mb-4">SPOTLIGHT — SELECT A DETAIL</p>
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

      {/* MATERIAL */}
      <DetailSection eyebrow="MATERIAL" title="소재">
        {product.materials.length === 0 ? (
          <ContentBadge status="CONTENT_REQUIRED" />
        ) : (
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {product.materials.map((m, i) => (
              <div key={i} className="border-t border-ink pt-5">
                <p className="font-medium">{m.name.value ?? <ContentBadge status={m.name.status} />}</p>
                {m.characteristics.value && <p className="mt-2 text-sm text-graphite">{m.characteristics.value}</p>}
                {m.reasonForUse.value && <p className="mt-2 text-sm text-stone">{m.reasonForUse.value}</p>}
              </div>
            ))}
          </div>
        )}
      </DetailSection>

      {/* PROCESS */}
      <DetailSection eyebrow="PROCESS" title="공정">
        {product.process.length === 0 ? (
          <ContentBadge status="CONTENT_REQUIRED" />
        ) : (
          <ol className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {product.process
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((step) => (
                <li key={step.order} className="border-t border-ink pt-5">
                  <p className="text-xs text-stone">0{step.order}</p>
                  <p className="mt-2 font-medium">{step.title}</p>
                  {step.description.value && <p className="mt-2 text-sm text-graphite">{step.description.value}</p>}
                </li>
              ))}
          </ol>
        )}
      </DetailSection>

      {/* STORY */}
      <DetailSection eyebrow="STORY" title="이야기">
        {product.story.value ? (
          <p className="max-w-2xl text-lg leading-relaxed text-graphite">{product.story.value}</p>
        ) : (
          <ContentBadge status={product.story.status} />
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

      {/* AR / QR BRIDGE */}
      <section className="border-t border-line bg-ink px-6 py-24 text-paper lg:px-10 lg:py-32">
        <div className="mx-auto flex max-w-canvas flex-col items-center gap-10 text-center lg:flex-row lg:justify-between lg:text-left">
          <div>
            <p className="eyebrow text-mist">DESKTOP TO MOBILE</p>
            <h2 className="mt-3 max-w-md text-3xl font-medium leading-tight lg:text-4xl">
              휴대폰으로 QR을 스캔하면
              <br />
              바로 AR을 시작할 수 있습니다.
            </h2>
          </div>
          {product.arAvailable ? (
            <div className="border border-paper/20 bg-paper p-4">
              <QRCodeImage value={arUrl} />
            </div>
          ) : (
            <p className="eyebrow text-mist">AR — CONTENT REQUIRED</p>
          )}
        </div>
      </section>
    </div>
  );
}
