import { Link } from 'react-router-dom';
import { useProducts } from '@/hooks/useProducts';
import { ProductCard } from '@/components/ProductCard';
import { Loading } from '@/components/Loading';
import { ErrorState } from '@/components/ErrorState';
import { PhoneMockup } from '@/components/PhoneMockup';
import { ContentBadge } from '@/components/ContentBadge';
import { HeroConfigurator } from '@/components/HeroConfigurator';
import { Faq } from '@/components/Faq';
import { Band } from '@/components/ui/Band';
import { Card } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';
import { canUseAR } from '@/utils/arAvailability';

const HOTSPOT_TONES = ['ochre', 'white', 'dark'] as const;

export default function Home() {
  const state = useProducts();
  const products = state.status === 'ready' ? state.data : [];
  const featured = products.filter((p) => p.featured);
  // The hero always shows a real product, but its name is never the page's heading —
  // the heading is the fixed LOOK CLOSER wordmark.
  const heroProduct = featured[0] ?? products[0] ?? null;
  const arUrl =
    heroProduct && canUseAR(heroProduct)
      ? `${window.location.origin}${window.location.pathname}#/ar/${heroProduct.id}`
      : null;

  // Every number below is counted from the catalogue, never estimated.
  const stats = [
    { value: String(products.length), label: '등록된 제품' },
    { value: String(products.filter((p) => p.threeDAvailable).length), label: '3D로 볼 수 있는 제품' },
    { value: String(products.filter(canUseAR).length), label: 'AR로 볼 수 있는 제품' },
  ];

  return (
    <div>
      {/* ───────── HERO ───────── */}
      <Band tone="soft" className="pt-10 lg:pt-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div>
            <p className="eyebrow">LAGI DIGITAL EXPERIENCE</p>
            <h1 className="mt-4 font-display text-[16vw] leading-[0.86] tracking-tight lg:text-[7vw]">
              LOOK
              <br />
              CLOSER
            </h1>
            <p className="mt-6 max-w-md text-lg font-medium leading-relaxed text-graphite">
              평범한 것도, 조금 더 가까이 보면
              <br />
              새로운 이야기가 시작됩니다.
            </p>
            <p className="mt-2 max-w-md text-sm text-stone">
              Everyday objects, a closer perspective.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to="/products" variant="dark">
                제품 보러 가기
              </ButtonLink>
              {arUrl && heroProduct && (
                <ButtonLink to={`/ar/${heroProduct.id}`} variant="tertiary">
                  VIEW IN AR
                </ButtonLink>
              )}
            </div>
          </div>

          <div>
            {state.status === 'ready' && heroProduct ? (
              <HeroConfigurator product={heroProduct} />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded-card bg-paper">
                {state.status === 'error' ? (
                  <ErrorState message={state.message} />
                ) : (
                  <Loading label="제품을 불러오는 중" />
                )}
              </div>
            )}
          </div>
        </div>
      </Band>

      {/* ───────── STAT STRIP ───────── */}
      <Band tone="plain" className="py-10 lg:py-12">
        <dl className="grid grid-cols-3 gap-6">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="sr-only">{s.label}</dt>
              <dd>
                <span className="block font-display text-4xl leading-none lg:text-5xl">
                  {s.value}
                </span>
                <span className="mt-2 block text-xs text-stone lg:text-sm">{s.label}</span>
              </dd>
            </div>
          ))}
        </dl>
      </Band>

      {/* ───────── FEATURED PRODUCTS ───────── */}
      <Band tone="plain" className="pt-0">
        <div className="flex items-end justify-between gap-6">
          <h2 className="font-display text-4xl lg:text-6xl">FEATURED PRODUCTS</h2>
          <Link
            to="/products"
            className="hidden shrink-0 font-heading text-sm font-extrabold hover:text-blue focus-ring lg:block"
          >
            전체 보기 →
          </Link>
        </div>

        <div className="mt-10 lg:mt-14">
          {state.status === 'loading' && <Loading label="제품을 불러오는 중" />}
          {state.status === 'error' && <ErrorState message={state.message} />}
          {state.status === 'ready' && featured.length === 0 && (
            <p className="text-sm text-stone">CONTENT REQUIRED — 게시된 제품이 없습니다.</p>
          )}
          {state.status === 'ready' && featured.length > 0 && (
            <div className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {featured.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </Band>

      {/* ───────── LOOK CLOSER ───────── */}
      <Band tone="soft">
        <h2 className="font-display text-4xl lg:text-6xl">LOOK CLOSER</h2>
        <p className="mt-3 max-w-md text-graphite">Same object, a new angle.</p>

        <div className="mt-10 lg:mt-14">
          {heroProduct && heroProduct.hotspots.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {heroProduct.hotspots.slice(0, 3).map((h, i) => {
                const tone = HOTSPOT_TONES[i % HOTSPOT_TONES.length];
                return (
                  <Link
                    key={h.id}
                    to={`/product/${heroProduct.id}?hotspot=${h.id}`}
                    className="group focus-ring block"
                  >
                    <Card tone={tone} className="flex min-h-[15rem] flex-col justify-between">
                      <p className="text-xs font-bold uppercase tracking-[0.24em] opacity-70">
                        {h.category}
                      </p>
                      <div>
                        <h3 className="font-heading text-xl font-extrabold lg:text-2xl">
                          {h.title}
                        </h3>
                        {h.description.value && (
                          <p className="mt-3 text-sm leading-relaxed opacity-85">
                            {h.description.value}
                          </p>
                        )}
                        <p className="mt-5 font-heading text-sm font-extrabold group-hover:underline">
                          자세히 보기 →
                        </p>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          ) : (
            <Card className="text-center">
              <ContentBadge status="CONTENT_REQUIRED" />
              <p className="mx-auto mt-3 max-w-md text-sm text-stone">
                등록된 Look Closer 디테일이 아직 없습니다.
              </p>
            </Card>
          )}
        </div>
      </Band>

      {/* ───────── AR — the one dark band ───────── */}
      <Band tone="dark">
        <div className="flex flex-col items-center gap-12 lg:flex-row lg:justify-between lg:gap-16">
          <div className="text-center lg:text-left">
            <p className="eyebrow !text-ochre">AR EXPERIENCE</p>
            <h2 className="mt-3 font-display text-4xl text-ochre lg:text-6xl">EXPERIENCE IN AR</h2>
            <p className="mt-5 max-w-md text-lg font-medium leading-relaxed text-mist">
              지금, 당신의 공간에서
              <br />
              LAGI를 직접 만나보세요.
            </p>
            <p className="mt-3 max-w-md text-sm text-stone">
              앱 설치 없이 휴대폰 브라우저에서 바로 실행됩니다.
            </p>
            <ButtonLink
              to={heroProduct ? `/ar/${heroProduct.id}` : '/ar'}
              variant="primary"
              className="mt-8"
            >
              AR 시작하기
            </ButtonLink>
          </div>
          <PhoneMockup arUrl={arUrl} label="SCAN TO SEE IN AR" />
        </div>
      </Band>

      {/* ───────── MATERIALS / PROCESS / STORY ───────── */}
      <Band tone="cool">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {[
            {
              index: '01',
              eyebrow: 'MATERIALS',
              title: '소재를 더 가까이.',
              subtitle: 'LAGI 제품에 사용된 소재와 그 이유를 확인하세요.',
              cta: 'VIEW MATERIALS',
              to: '/materials',
            },
            {
              index: '02',
              eyebrow: 'PROCESS',
              title: '어떻게 만들어졌는지.',
              subtitle: '제품이 완성되기까지의 과정을 살펴보세요.',
              cta: 'VIEW PROCESS',
              to: heroProduct ? `/product/${heroProduct.id}#process` : '/products',
            },
            {
              index: '03',
              eyebrow: 'STORY',
              title: '왜 의미 있는지.',
              subtitle: 'LAGI가 이 제품을 소개하는 이유를 들어보세요.',
              cta: 'VIEW STORY',
              to: '/story',
            },
          ].map((b) => (
            <Link key={b.index} to={b.to} className="group focus-ring block">
              <Card className="flex min-h-[17rem] flex-col justify-between">
                <p className="text-xs font-bold tracking-[0.2em] text-stone">{b.index}</p>
                <div>
                  <p className="eyebrow">{b.eyebrow}</p>
                  <h3 className="mt-2 font-display text-2xl leading-snug lg:text-3xl">{b.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-graphite">{b.subtitle}</p>
                  <p className="mt-5 font-heading text-sm font-extrabold group-hover:text-blue">
                    {b.cta} →
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </Band>

      {/* ───────── FAQ ───────── */}
      <Band tone="plain">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <p className="eyebrow">SUPPORT</p>
            <h2 className="mt-3 font-display text-4xl lg:text-5xl">자주 묻는 질문</h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-graphite">
              사이트 사용에 대한 답은 여기에서 확인하실 수 있습니다. 브랜드 정책에 대한 답변은
              아직 등록되지 않았습니다.
            </p>
          </div>
          <Faq />
        </div>
      </Band>

      {/* ───────── FOLLOW / SHOP ───────── */}
      <Band tone="soft">
        <div className="grid gap-5 sm:grid-cols-2">
          <Card className="flex flex-col items-start justify-between gap-6">
            <div>
              <p className="eyebrow">FOLLOW</p>
              <p className="mt-2 font-heading text-2xl font-extrabold">@lagi.official</p>
              <p className="mt-2 text-sm text-graphite">새 제품과 소식을 가장 먼저 만나보세요.</p>
            </div>
            <ButtonLink
              to="https://www.instagram.com/lagi.official/"
              external
              variant="tertiary"
            >
              인스타그램
            </ButtonLink>
          </Card>
          <Card tone="dark" className="flex flex-col items-start justify-between gap-6">
            <div>
              <p className="eyebrow !text-ochre">SHOP</p>
              <p className="mt-2 font-heading text-2xl font-extrabold">LAGI Smart Store</p>
              <p className="mt-2 text-sm text-mist">실제 주문과 결제는 공식 스토어에서 이루어집니다.</p>
            </div>
            <ButtonLink
              to="https://smartstore.naver.com/lagi_official"
              external
              variant="primary"
            >
              스토어 가기
            </ButtonLink>
          </Card>
        </div>
      </Band>
    </div>
  );
}
