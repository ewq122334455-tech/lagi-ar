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
import { BuyPanel } from '@/components/BuyPanel';
import { ProductGallery } from '@/components/ProductGallery';
import { aiTryOnEnabled } from '@/tryon/aiTryOn';
import { shippingLabel } from '@/utils/shipping';

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
  const tryOnUrl = aiTryOnEnabled(product)
    ? `${window.location.origin}${window.location.pathname}#/ai-fit/${product.id}`
    : null;

  return (
    <div>
      {/* PRODUCT HERO — photos left, sticky buy column right */}
      <section className="grid grid-cols-1 gap-6 px-0 pt-0 lg:grid-cols-12 lg:gap-10 lg:px-10 lg:pt-6">
        <div className="lg:col-span-7">
          <ProductGallery product={product}>
            <SpotlightPanel hotspot={selected} onClose={clear} />
          </ProductGallery>
        </div>

        <div className="px-4 lg:col-span-5 lg:px-0">
          <div className="lg:sticky lg:top-[calc(var(--nav-height)+24px)]">
            <nav aria-label="경로" className="text-xs text-stone">
              <Link to="/" className="hover:text-ink">홈</Link> <span aria-hidden="true">›</span>{' '}
              <Link to="/products" className="hover:text-ink">전체 상품</Link>
              {product.category.value && product.category.status === 'VERIFIED' && (
                <>
                  {' '}<span aria-hidden="true">›</span> {product.category.value}
                </>
              )}
            </nav>

            <Link to="/about" className="mt-4 flex items-center justify-between rounded-md bg-mist px-3 py-2.5 text-sm hover:bg-line focus-ring">
              <span className="flex items-center gap-2 font-bold">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue text-[10px] font-black text-paper">L</span>
                {product.brandLabel ?? 'LAGI'}
              </span>
              <span className="text-xs text-stone">브랜드 보기 ›</span>
            </Link>

            <h1 className="mt-4 text-xl font-bold leading-snug tracking-[-0.03em] lg:text-2xl">
              {product.name.value ?? <span className="text-stone">상품명 준비 중</span>}
            </h1>
            {product.shortDescription.value && <p className="mt-2 text-sm text-graphite">{product.shortDescription.value}</p>}

            <p className="mt-4 text-2xl font-bold">
              {product.price.value != null ? (
                `${product.price.value.toLocaleString('ko-KR')}원`
              ) : (
                <span className="text-base font-medium text-stone">가격은 스마트스토어에서 확인해 주세요</span>
              )}
            </p>

            <dl className="mt-5 divide-y divide-line border-y border-line text-[13px]">
              {(product.dimensions.widthCm || product.dimensions.heightCm || product.dimensions.depthCm) && (
                <InfoRow label="사이즈">
                  {product.dimensions.widthCm ?? '—'} × {product.dimensions.heightCm ?? '—'} × {product.dimensions.depthCm ?? '—'} cm
                </InfoRow>
              )}
              {product.colors.length > 0 && (
                <InfoRow label="색상">
                  <span className="flex gap-1.5">
                    {product.colors.map((c) => (
                      <span key={c} className="h-4 w-4 rounded-full border border-line" style={{ backgroundColor: c }} title={c} />
                    ))}
                  </span>
                </InfoRow>
              )}
              <InfoRow label="체험">
                <span className="flex flex-wrap gap-1.5">
                  {tryOnUrl && <Pill tone="lime">AI 피팅</Pill>}
                  {product.remixModel && <Pill tone="orange">다시 조합</Pill>}
                </span>
              </InfoRow>
              {product.shipping && <InfoRow label="배송">{shippingLabel(product.shipping)}</InfoRow>}
              <InfoRow label="구매처">공식 네이버 스마트스토어</InfoRow>
            </dl>

            <BuyPanel product={product} />

            {product.hotspots.length > 0 && (
              <div className="mt-8">
                <p className="mb-3 text-sm font-bold">디테일 가까이 보기</p>
                <SpotlightMenu hotspots={product.hotspots} selectedId={selectedId} onSelect={select} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* In-page tabs */}
      <nav aria-label="상품 상세 메뉴" className="sticky top-[var(--nav-height)] z-20 mt-12 border-y border-line bg-paper">
        <ul className="no-scrollbar flex overflow-x-auto px-4 lg:px-10">
          {[
            ['#info', '상품 정보'],
            ['#experience', '체험하기'],
            ['#shop', '구매하기'],
          ].map(([href, label]) => (
            <li key={href} className="flex-1 lg:flex-none">
              <a href={href} onClick={(e) => { e.preventDefault(); document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' }); }} className="block whitespace-nowrap px-5 py-3.5 text-center text-sm font-semibold text-graphite hover:text-ink focus-ring">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div id="info" className="scroll-mt-[calc(var(--nav-height)+48px)]" />

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

      {/* EXPERIENCE — QR codes so a desktop visitor can continue on their phone */}
      <section id="experience" className="scroll-mt-[calc(var(--nav-height)+48px)] border-t border-line px-4 py-14 lg:px-10">
        <h2 className="text-xl font-bold tracking-[-0.03em]">휴대폰으로 체험하기</h2>
        <p className="mt-1 text-sm text-stone">QR을 휴대폰 카메라로 찍으면 바로 열립니다.</p>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-3xl">
          {tryOnUrl && <QrCard url={tryOnUrl} title="AI 피팅" text="내 사진으로 메어보기" tone="bg-lime" />}
        </div>
      </section>

      {/* SHOP */}
      <section id="shop" className="scroll-mt-[calc(var(--nav-height)+48px)] mx-4 mb-6 mt-4 flex flex-col items-start justify-between gap-5 rounded-xl bg-blue p-7 text-paper sm:flex-row sm:items-center lg:mx-10 lg:p-10">
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-paper/70">OFFICIAL STORE</p>
          <p className="mt-2 text-2xl font-bold tracking-[-0.03em]">{product.name.value ?? 'LAGI'} 구매하기</p>
          <p className="mt-1 text-sm text-paper/75">결제와 배송은 공식 네이버 스마트스토어에서 진행됩니다.</p>
        </div>
        {product.shopUrl.value && (
          <a
            href={product.shopUrl.value}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-md bg-paper px-6 py-3.5 text-sm font-bold text-blue hover:bg-mist focus-ring"
          >
            스마트스토어에서 보기 →
          </a>
        )}
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

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-2.5">
      <dt className="w-16 shrink-0 text-stone">{label}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone?: 'lime' | 'orange' }) {
  const cls = tone === 'lime' ? 'bg-lime text-ink' : tone === 'orange' ? 'bg-orange text-paper' : 'bg-ink text-paper';
  return <span className={`rounded-sm px-1.5 py-0.5 text-[11px] font-bold ${cls}`}>{children}</span>;
}

function QrCard({ url, title, text, tone }: { url: string; title: string; text: string; tone: string }) {
  return (
    <div className={`flex items-center gap-5 rounded-xl p-5 ${tone}`}>
      <div className="shrink-0 rounded-md bg-paper p-2">
        <QRCodeImage value={url} size={96} />
      </div>
      <div>
        <p className="text-lg font-bold">{title}</p>
        <p className="text-sm text-graphite">{text}</p>
        <a href={url} className="mt-2 inline-block text-sm font-semibold underline underline-offset-4 focus-ring">
          이 기기에서 열기
        </a>
      </div>
    </div>
  );
}
