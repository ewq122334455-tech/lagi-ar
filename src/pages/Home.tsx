import { Link } from 'react-router-dom';
import { useProducts } from '@/hooks/useProducts';
import { ProductCard } from '@/components/ProductCard';
import { Loading } from '@/components/Loading';
import { ErrorState } from '@/components/ErrorState';

export default function Home() {
  const state = useProducts();
  const featured = state.status === 'ready' ? state.data.filter((p) => p.featured) : [];

  return (
    <div>
      {/* HERO */}
      <section className="relative flex min-h-[92vh] flex-col justify-end overflow-hidden bg-ink px-6 pb-16 pt-32 text-paper lg:px-10 lg:pb-24">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.06]">
          <span className="text-[38vw] font-semibold leading-none tracking-tighter">LAGI</span>
        </div>
        <div className="relative max-w-canvas">
          <p className="eyebrow text-mist">DIGITAL PRODUCT EXPERIENCE</p>
          <h1 className="mt-6 max-w-4xl text-[10vw] font-semibold leading-[0.95] tracking-tight lg:text-[6.5vw]">
            LOOK CLOSER.
          </h1>
          <p className="mt-8 max-w-xl text-base text-mist lg:text-lg">
            LAGI의 제품을 발견하고, 3D로 구조를 살펴보고, AR로 실물과 연결하세요.
            하나의 연속된 디지털 경험 안에서.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              to="/products"
              className="eyebrow border border-paper px-7 py-4 transition-colors hover:bg-paper hover:text-ink focus-ring"
            >
              DISCOVER PRODUCT
            </Link>
            <Link
              to="/ar"
              className="eyebrow border border-paper/40 px-7 py-4 text-mist transition-colors hover:border-paper hover:text-paper focus-ring"
            >
              VIEW IN AR
            </Link>
          </div>
        </div>
      </section>

      {/* JOURNEY */}
      <section className="border-b border-line px-6 py-24 lg:px-10 lg:py-32">
        <div className="mx-auto max-w-canvas">
          <p className="eyebrow">THE EXPERIENCE</p>
          <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-5">
            {['DISCOVER', 'FOCUS', 'UNDERSTAND', 'EXPERIENCE', 'ACT'].map((step, i) => (
              <div key={step} className="border-t border-ink pt-5">
                <p className="text-xs text-stone">0{i + 1}</p>
                <p className="mt-2 text-lg font-medium tracking-tight">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      <section className="px-6 py-24 lg:px-10 lg:py-32">
        <div className="mx-auto max-w-canvas">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="eyebrow">FEATURED</p>
              <h2 className="mt-3 text-3xl font-medium lg:text-4xl">지금 만나는 LAGI 제품</h2>
            </div>
            <Link to="/products" className="eyebrow hidden shrink-0 hover:text-graphite focus-ring lg:block">
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
              <div className="grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {featured.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* AR INTRO */}
      <section className="grid grid-cols-1 border-y border-line lg:grid-cols-2">
        <div className="flex flex-col justify-center px-6 py-24 lg:px-14 lg:py-32">
          <p className="eyebrow">WEB AR</p>
          <h2 className="mt-4 max-w-md text-3xl font-medium leading-tight lg:text-4xl">
            실물 제품에 카메라를 비추면
            <br />
            LAGI가 눈앞에 나타납니다.
          </h2>
          <p className="mt-6 max-w-md text-sm text-graphite lg:text-base">
            AR은 디지털 경험과 실제 제품을 연결하는 LAGI의 핵심 경험입니다. 3D 모델이 실물 위에 그대로 겹쳐지고,
            디테일을 선택해 소재와 공정, 이야기를 확인할 수 있습니다.
          </p>
          <Link
            to="/ar"
            className="eyebrow mt-10 inline-block w-fit border border-ink px-7 py-4 transition-colors hover:bg-ink hover:text-paper focus-ring"
          >
            AR 시작하기
          </Link>
        </div>
        <div className="flex min-h-[50vh] items-center justify-center bg-mist px-10 text-center lg:min-h-[70vh]">
          <div>
            <p className="text-5xl font-light tracking-widest text-stone">AR</p>
            <p className="eyebrow mt-4">MOBILE CAMERA EXPERIENCE</p>
          </div>
        </div>
      </section>

      {/* STORY / PERSPECTIVE */}
      <section className="px-6 py-24 lg:px-10 lg:py-32">
        <div className="mx-auto grid max-w-canvas grid-cols-1 gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-24">
          <div>
            <p className="eyebrow">ABOUT THIS EXPERIENCE</p>
            <h2 className="mt-4 text-3xl font-medium leading-tight lg:text-4xl">
              기술은 제품을 이해하기 쉽게 만들기 위해 존재합니다.
            </h2>
          </div>
          <div className="flex flex-col gap-6 text-graphite">
            <p>
              3D는 제품을 자세히 살펴보기 위해 존재합니다. AR은 디지털 경험과 실물 제품을 연결하기 위해 존재합니다.
              Spotlight는 시선을 안내하기 위해 존재합니다.
            </p>
            <p>
              소재는 무엇으로 만들어졌는지, 공정은 어떻게 만들어졌는지, 스토리는 왜 이 제품이 의미 있는지를
              설명합니다. 인터페이스는 이 모든 것을 연결합니다. 제품은 언제나 주인공입니다.
            </p>
            <Link to="/story" className="eyebrow mt-2 w-fit border-b border-ink pb-1 hover:text-graphite focus-ring">
              STORY 더 보기 →
            </Link>
          </div>
        </div>
      </section>

      {/* INSTAGRAM / SHOP */}
      <section className="grid grid-cols-1 gap-px border-t border-line bg-line sm:grid-cols-2">
        <a
          href="https://www.instagram.com/lagi.official/"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col justify-center gap-4 bg-paper px-8 py-20 transition-colors hover:bg-ink hover:text-paper focus-ring"
        >
          <p className="eyebrow text-stone group-hover:text-mist">FOLLOW</p>
          <p className="text-2xl font-medium">@lagi.official</p>
          <p className="eyebrow">INSTAGRAM →</p>
        </a>
        <a
          href="https://smartstore.naver.com/lagi_official"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col justify-center gap-4 bg-paper px-8 py-20 transition-colors hover:bg-ink hover:text-paper focus-ring"
        >
          <p className="eyebrow text-stone group-hover:text-mist">SHOP</p>
          <p className="text-2xl font-medium">LAGI Smart Store</p>
          <p className="eyebrow">SHOP NOW →</p>
        </a>
      </section>
    </div>
  );
}
