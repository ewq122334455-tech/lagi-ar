import { Link } from 'react-router-dom';
import { useProducts } from '@/hooks/useProducts';
import { ProductCard } from '@/components/ProductCard';
import { Loading } from '@/components/Loading';
import { ErrorState } from '@/components/ErrorState';
import { ColorBlockLink } from '@/components/ColorBlockLink';
import { PhoneMockup } from '@/components/PhoneMockup';
import { ContentBadge } from '@/components/ContentBadge';
import { AgainMarquee } from '@/components/AgainMarquee';
import { ProductViewer } from '@/three/ProductViewer';
import { canUseAR } from '@/utils/arAvailability';
import { canUseTryOn } from '@/utils/tryOnAvailability';

const HOTSPOT_ACCENTS = ['bg-lime', 'bg-orange', 'bg-blue'] as const;

export default function Home() {
  const state = useProducts();
  const products = state.status === 'ready' ? state.data : [];
  const featured = products.filter((p) => p.featured);
  // The hero always shows a real product's visuals, but its own name/id is never the
  // page's primary heading — the heading is always the fixed wordmark line.
  const heroProduct = featured[0] ?? products[0] ?? null;
  const arUrl = heroProduct && canUseAR(heroProduct)
    ? `${window.location.origin}${window.location.pathname}#/ar/${heroProduct.id}`
    : null;
  const tryOnProduct = products.find((p) => canUseTryOn(p)) ?? null;

  return (
    <div>
      {/* HERO */}
      <section className="px-6 pb-16 pt-10 lg:px-10 lg:pb-24 lg:pt-14">
        <div className="mx-auto grid max-w-canvas grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-5">
            <p className="eyebrow">LAGI — “lagi” means “again”</p>
            <h1 className="mt-6 font-display text-[17vw] leading-[0.88] lg:text-[7.2vw]">
              Look closer,
              <br />
              <em className="text-blue">again.</em>
            </h1>
            <p className="mt-8 max-w-sm text-lg leading-relaxed text-graphite">
              평범한 것도 조금 더 가까이 보면,
              <br />
              그리고 한 번 더 보면 — 새로운 이야기가 시작됩니다.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <PrimaryLink to="/products">제품 보기</PrimaryLink>
              <SecondaryLink to="/again">다시, 조합하기</SecondaryLink>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="relative overflow-hidden rounded-[2rem] bg-mist">
              {state.status === 'ready' && heroProduct ? (
                heroProduct.model3D || !heroProduct.images[0] ? (
                  <ProductViewer
                    className="aspect-[4/3.4] w-full"
                    modelUrl={heroProduct.model3D}
                    hotspots={[]}
                    selectedHotspotId={null}
                    onSelectHotspot={() => {}}
                    showControls={false}
                  />
                ) : (
                  <img
                    src={heroProduct.images[0]}
                    alt={heroProduct.name.value ?? 'LAGI product'}
                    className="aspect-[4/3.4] w-full object-cover"
                  />
                )
              ) : (
                <div className="flex aspect-[4/3.4] w-full items-center justify-center">
                  <span className="font-display text-6xl">LAGI</span>
                </div>
              )}
              <div className="pointer-events-none absolute inset-x-5 bottom-5 flex items-end justify-between gap-4">
                <p className="eyebrow text-graphite">Drag to turn · 드래그해서 돌려보기</p>
                {heroProduct && (
                  <Link
                    to={`/product/${heroProduct.id}`}
                    className="pointer-events-auto rounded-full bg-paper/90 px-4 py-2 text-xs font-semibold backdrop-blur hover:bg-paper focus-ring"
                  >
                    자세히 →
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <AgainMarquee />

      {/* FEATURED PRODUCTS */}
      <section className="px-6 py-20 lg:px-10 lg:py-28">
        <div className="mx-auto max-w-canvas">
          <SectionHeader eyebrow="Collection" title="Featured" link={{ to: '/products', label: '전체 보기' }} />
          <div className="mt-12">
            {state.status === 'loading' && <Loading label="제품을 불러오는 중" />}
            {state.status === 'error' && <ErrorState message={state.message} />}
            {state.status === 'ready' && featured.length === 0 && (
              <p className="text-sm text-stone">CONTENT REQUIRED — 게시된 제품이 없습니다.</p>
            )}
            {state.status === 'ready' && featured.length > 0 && (
              <div className="grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {featured.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* LOOK CLOSER — hotspot preview */}
      <section className="bg-ink px-6 py-20 text-paper lg:px-10 lg:py-28">
        <div className="mx-auto max-w-canvas">
          <p className="eyebrow text-paper/50">Details</p>
          <h2 className="mt-4 font-display text-5xl lg:text-7xl">Look closer.</h2>
          <p className="mt-3 max-w-md text-paper/60">같은 물건, 새로운 각도.</p>
          <div className="mt-14">
            {heroProduct && heroProduct.hotspots.length > 0 ? (
              <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl bg-paper/10 sm:grid-cols-3">
                {heroProduct.hotspots.slice(0, 3).map((h, i) => (
                  <Link
                    key={h.id}
                    to={`/product/${heroProduct.id}?hotspot=${h.id}`}
                    className="group flex min-h-[15rem] flex-col justify-between bg-ink p-7 transition-colors hover:bg-[#201f1d] focus-ring lg:p-9"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display text-3xl text-paper/40">0{i + 1}</span>
                      <span className={`h-2.5 w-2.5 rounded-full ${HOTSPOT_ACCENTS[i % HOTSPOT_ACCENTS.length]}`} />
                    </div>
                    <div>
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-paper/50">{h.category}</p>
                      <h3 className="mt-2 text-xl font-semibold">{h.title}</h3>
                      {h.description.value && <p className="mt-2 text-sm text-paper/70">{h.description.value}</p>}
                      <p className="mt-6 text-sm font-semibold text-paper/80 group-hover:text-paper">자세히 보기 →</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-paper/30 px-8 py-14 text-center">
                <ContentBadge status="CONTENT_REQUIRED" />
                <p className="mx-auto mt-3 max-w-md text-sm text-paper/70">등록된 Look Closer 디테일이 아직 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* AGAIN — the brand name's meaning, as something to play with */}
      <section className="px-6 py-20 lg:px-10 lg:py-28">
        <div className="mx-auto grid max-w-canvas grid-cols-1 items-end gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className="eyebrow">Lagi · 다시</p>
            <h2 className="mt-4 font-display text-5xl leading-[0.95] lg:text-8xl">
              One bag,
              <br />
              <em>again</em> &amp; again.
            </h2>
          </div>
          <div className="lg:col-span-5">
            <p className="text-lg leading-relaxed text-graphite">
              LAGI는 말레이·인도네시아어로 ‘다시’라는 뜻입니다. 같은 가방을 다시 보고, 다시 조합하고, 다시 입어보세요.
              색을 바꿔 나만의 조합을 만들고, 그 조합 그대로 카메라로 메어볼 수 있습니다.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <PrimaryLink to="/again">다시 조합하기</PrimaryLink>
              {tryOnProduct && <SecondaryLink to={`/try-on/${tryOnProduct.id}`}>가상으로 메어보기</SecondaryLink>}
            </div>
          </div>
        </div>
      </section>

      {/* MATERIALS / PROCESS / STORY */}
      <section className="px-6 pb-20 lg:px-10 lg:pb-28">
        <div className="mx-auto grid max-w-canvas grid-cols-1 gap-4 sm:grid-cols-3">
          <ColorBlockLink
            index="01"
            eyebrow="MATERIALS"
            title="소재를 더 가까이."
            subtitle="LAGI 제품에 사용된 소재와 그 이유를 확인하세요."
            ctaLabel="VIEW MATERIALS"
            to="/materials"
            color="lime"
          />
          <ColorBlockLink
            index="02"
            eyebrow="PROCESS"
            title="어떻게 만들어졌는지."
            subtitle="제품이 완성되기까지의 과정을 살펴보세요."
            ctaLabel="VIEW PROCESS"
            to={heroProduct ? `/product/${heroProduct.id}#process` : '/products'}
            color="orange"
          />
          <ColorBlockLink
            index="03"
            eyebrow="STORY"
            title="왜 의미 있는지."
            subtitle="LAGI가 이 제품을 소개하는 이유를 들어보세요."
            ctaLabel="VIEW STORY"
            to="/story"
            color="blue"
          />
        </div>
      </section>

      {/* AR SECTION */}
      <section className="border-t border-line px-6 py-20 lg:px-10 lg:py-28">
        <div className="mx-auto flex max-w-canvas flex-col items-center gap-14 lg:flex-row lg:justify-between">
          <div className="text-center lg:text-left">
            <p className="eyebrow">Web AR · Try-on</p>
            <h2 className="mt-4 font-display text-5xl lg:text-7xl">In your space.</h2>
            <p className="mt-4 max-w-md text-lg text-graphite">
              앱 설치 없이, 휴대폰 카메라로
              <br />
              LAGI를 공간에 놓고 직접 메어보세요.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
              <PrimaryLink to={heroProduct ? `/ar/${heroProduct.id}` : '/ar'}>AR 시작하기</PrimaryLink>
              <SecondaryLink to="/ar">AR 제품 전체</SecondaryLink>
            </div>
          </div>
          <PhoneMockup arUrl={arUrl} label="SCAN TO SEE IN AR" />
        </div>
      </section>

      {/* INSTAGRAM / SHOP */}
      <section className="grid grid-cols-1 border-t border-line sm:grid-cols-2">
        <a
          href="https://www.instagram.com/lagi.official/"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col items-center justify-center gap-3 px-8 py-16 text-center transition-colors hover:bg-blue hover:text-paper focus-ring sm:border-r sm:border-line"
        >
          <p className="eyebrow group-hover:text-paper/70">Follow</p>
          <p className="font-display text-4xl">@lagi.official</p>
          <p className="text-sm font-semibold">인스타그램 →</p>
        </a>
        <a
          href="https://smartstore.naver.com/lagi_official"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col items-center justify-center gap-3 border-t border-line px-8 py-16 text-center transition-colors hover:bg-orange hover:text-paper focus-ring sm:border-t-0"
        >
          <p className="eyebrow group-hover:text-paper/70">Shop</p>
          <p className="font-display text-4xl">Smart Store</p>
          <p className="text-sm font-semibold">스토어 가기 →</p>
        </a>
      </section>
    </div>
  );
}

function SectionHeader({ eyebrow, title, link }: { eyebrow: string; title: string; link?: { to: string; label: string } }) {
  return (
    <div className="flex items-end justify-between gap-6 border-b border-line pb-6">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-3 font-display text-5xl lg:text-7xl">{title}</h2>
      </div>
      {link && (
        <Link to={link.to} className="shrink-0 text-sm font-semibold hover:text-blue focus-ring">
          {link.label} →
        </Link>
      )}
    </div>
  );
}

function PrimaryLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-sm font-semibold text-paper transition-colors hover:bg-blue focus-ring"
    >
      {children} →
    </Link>
  );
}

function SecondaryLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2 rounded-full border border-ink/25 px-6 py-3.5 text-sm font-semibold text-ink transition-colors hover:border-ink focus-ring"
    >
      {children}
    </Link>
  );
}
