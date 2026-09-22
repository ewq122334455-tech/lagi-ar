import { Link } from 'react-router-dom';
import { useProducts } from '@/hooks/useProducts';
import { ProductCard } from '@/components/ProductCard';
import { Loading } from '@/components/Loading';
import { ErrorState } from '@/components/ErrorState';
import { ColorBlockLink } from '@/components/ColorBlockLink';
import { PhoneMockup } from '@/components/PhoneMockup';
import { ContentBadge } from '@/components/ContentBadge';
import { ProductViewer } from '@/three/ProductViewer';

const HOTSPOT_COLORS = ['bg-lime text-ink', 'bg-orange text-paper', 'bg-blue text-paper'] as const;

export default function Home() {
  const state = useProducts();
  const products = state.status === 'ready' ? state.data : [];
  const featured = products.filter((p) => p.featured);
  // The hero always shows a real product's visuals, but its own name/id is never the
  // page's primary heading — the heading is always the fixed "LOOK CLOSER" wordmark.
  const heroProduct = featured[0] ?? products[0] ?? null;
  const arUrl = heroProduct?.arAvailable
    ? `${window.location.origin}${window.location.pathname}#/ar/${heroProduct.id}`
    : null;

  return (
    <div>
      {/* HERO */}
      <section className="grid grid-cols-1 items-center gap-12 px-6 pb-20 pt-14 lg:grid-cols-2 lg:gap-10 lg:px-10 lg:pb-28 lg:pt-20">
        <div>
          <p className="eyebrow">LAGI DIGITAL EXPERIENCE</p>
          <h1 className="mt-4 font-display text-[18vw] leading-[0.85] tracking-tight lg:text-[6.5vw]">
            LOOK
            <br />
            CLOSER
          </h1>
          <p className="mt-6 max-w-md text-lg font-medium text-graphite">
            평범한 것도, 조금 더 가까이 보면
            <br />
            새로운 이야기가 시작됩니다.
          </p>
          <p className="mt-2 max-w-md text-sm text-stone">Everyday objects, a closer perspective.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              to="/products"
              className="inline-flex items-center gap-2 rounded-full bg-ink px-7 py-4 font-heading text-sm font-extrabold text-paper transition-transform hover:-translate-y-0.5 focus-ring"
            >
              EXPLORE PRODUCTS →
            </Link>
            {arUrl && (
              <Link
                to={`/ar/${heroProduct!.id}`}
                className="inline-flex items-center gap-2 rounded-full border-2 border-ink px-7 py-4 font-heading text-sm font-extrabold text-ink transition-transform hover:-translate-y-0.5 focus-ring"
              >
                VIEW IN AR
              </Link>
            )}
          </div>
        </div>

        <div className="mx-auto w-full max-w-md rounded-[2.5rem] bg-lime p-6 lg:max-w-none lg:p-10">
          {state.status === 'ready' && heroProduct ? (
            heroProduct.model3D || !heroProduct.images[0] ? (
              <ProductViewer
                className="aspect-square w-full rounded-[1.75rem]"
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
                className="aspect-square w-full rounded-[1.75rem] object-cover shadow-2xl"
              />
            )
          ) : (
            <div className="flex aspect-square w-full items-center justify-center rounded-[1.75rem] bg-paper">
              <span className="font-display text-6xl">LAGI</span>
            </div>
          )}
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      <section className="border-t-2 border-ink px-6 py-20 lg:px-10 lg:py-28">
        <div className="mx-auto max-w-canvas">
          <div className="flex items-end justify-between gap-6">
            <h2 className="font-display text-4xl lg:text-6xl">FEATURED PRODUCTS</h2>
            <Link to="/products" className="hidden shrink-0 font-heading text-sm font-extrabold hover:text-blue focus-ring lg:block">
              VIEW ALL →
            </Link>
          </div>

          <div className="mt-14">
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
      <section className="border-t-2 border-ink bg-ink px-6 py-20 text-paper lg:px-10 lg:py-28">
        <div className="mx-auto max-w-canvas">
          <h2 className="font-display text-4xl lg:text-6xl">LOOK CLOSER</h2>
          <p className="mt-3 max-w-md text-mist">Same object, a new angle.</p>

          <div className="mt-14">
            {heroProduct && heroProduct.hotspots.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {heroProduct.hotspots.slice(0, 3).map((h, i) => (
                  <Link
                    key={h.id}
                    to={`/product/${heroProduct.id}?hotspot=${h.id}`}
                    className={`group flex min-h-[16rem] flex-col justify-between p-7 transition-transform hover:-translate-y-1 focus-ring ${HOTSPOT_COLORS[i % HOTSPOT_COLORS.length]}`}
                  >
                    <p className="eyebrow opacity-70">{h.category}</p>
                    <div>
                      <h3 className="font-heading text-2xl font-extrabold">{h.title}</h3>
                      {h.description.value && <p className="mt-3 text-sm opacity-90">{h.description.value}</p>}
                      <p className="mt-5 font-heading text-sm font-extrabold group-hover:underline">자세히 보기 →</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="border border-dashed border-paper/30 px-8 py-14 text-center">
                <ContentBadge status="CONTENT_REQUIRED" />
                <p className="mx-auto mt-3 max-w-md text-sm text-mist">
                  등록된 Look Closer 디테일이 아직 없습니다.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* MATERIALS / PROCESS / STORY */}
      <section className="px-6 py-20 lg:px-10 lg:py-28">
        <div className="mx-auto grid max-w-canvas grid-cols-1 gap-6 sm:grid-cols-3">
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
      <section className="border-t-2 border-ink px-6 py-20 lg:px-10 lg:py-28">
        <div className="mx-auto flex max-w-canvas flex-col items-center gap-14 lg:flex-row lg:justify-between">
          <div className="text-center lg:text-left">
            <h2 className="font-display text-4xl lg:text-6xl">EXPERIENCE IN AR</h2>
            <p className="mt-4 max-w-md text-lg font-medium text-graphite">
              지금, 당신의 공간에서
              <br />
              LAGI를 직접 만나보세요.
            </p>
            <Link
              to={heroProduct ? `/ar/${heroProduct.id}` : '/ar'}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-ink px-7 py-4 font-heading text-sm font-extrabold text-paper transition-transform hover:-translate-y-0.5 focus-ring"
            >
              AR 시작하기 →
            </Link>
          </div>
          <PhoneMockup arUrl={arUrl} label="SCAN TO SEE IN AR" />
        </div>
      </section>

      {/* INSTAGRAM / SHOP */}
      <section className="grid grid-cols-1 gap-px border-t-2 border-ink bg-ink sm:grid-cols-2">
        <a
          href="https://www.instagram.com/lagi.official/"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col items-center justify-center gap-3 bg-paper px-8 py-16 text-center transition-colors hover:bg-blue hover:text-paper focus-ring"
        >
          <p className="eyebrow text-stone group-hover:text-paper/70">FOLLOW</p>
          <p className="font-heading text-2xl font-extrabold">@lagi.official</p>
          <p className="font-heading text-sm font-extrabold">INSTAGRAM →</p>
        </a>
        <a
          href="https://smartstore.naver.com/lagi_official"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col items-center justify-center gap-3 bg-paper px-8 py-16 text-center transition-colors hover:bg-orange hover:text-paper focus-ring"
        >
          <p className="eyebrow text-stone group-hover:text-paper/70">SHOP</p>
          <p className="font-heading text-2xl font-extrabold">LAGI Smart Store</p>
          <p className="font-heading text-sm font-extrabold">SHOP NOW →</p>
        </a>
      </section>
    </div>
  );
}
