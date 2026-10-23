import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProducts } from '@/hooks/useProducts';
import { ProductCard } from '@/components/ProductCard';
import { Loading } from '@/components/Loading';
import { ErrorState } from '@/components/ErrorState';
import { aiTryOnEnabled } from '@/tryon/aiTryOn';
import { productCover } from '@/utils/productImage';
import type { Product } from '@/data/productTypes';
import { HeroVideo } from '@/components/HeroVideo';
import { Reveal } from '@/components/Reveal';
import { Motif } from '@/components/Motif';
import { MOTIFS } from '@/components/motifs';

export default function Home() {
  const state = useProducts();
  const products = state.status === 'ready' ? state.data : [];
  const featured = products.filter((p) => p.featured);
  const picks = (featured.length > 0 ? featured : products).slice(0, 12);
  const hero = picks[0] ?? null;
  const tryOnProducts = products.filter((p) => aiTryOnEnabled(p) && (p.category.value ?? '').toLowerCase() === 'bag');
  const tops = products.filter((p) => p.category.value === 'Top');
  const bottoms = products.filter((p) => p.category.value === 'Bottom');

  return (
    <div className="pb-16">
      <HeroVideo tryOnId={tryOnProducts[0]?.id ?? null} />
      <MotifStrip />
      <QuickMenu hero={hero} tryOnId={tryOnProducts[0]?.id ?? null} />

      {/* LAGI PICK */}
      <Section
        title="LAGI PICK"
        subtitle="라기가 고른 순서대로"
        more={{ to: '/products?sort=ranking', label: '전체보기' }}
      >
        {state.status === 'loading' && <Loading label="상품을 불러오는 중" />}
        {state.status === 'error' && <ErrorState message={state.message} />}
        {state.status === 'ready' && picks.length === 0 && <p className="text-sm text-stone">등록된 상품이 없습니다.</p>}
        {picks.length > 0 && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {picks.map((p, i) => (
              <Reveal key={p.id} delay={(i % 6) * 70}>
                <ProductCard product={p} rank={i + 1} />
              </Reveal>
            ))}
          </div>
        )}
      </Section>

      {(tops.length > 0 || bottoms.length > 0) && <WearSection tops={tops} bottoms={bottoms} />}

      <Reveal>
        <BannerBento hero={hero} tryOnId={tryOnProducts[0]?.id ?? null} />
      </Reveal>

      {/* TRY-ON band */}
      {tryOnProducts.length > 0 && (
        <Reveal as="section" className="relative mx-4 mt-14 overflow-hidden rounded-xl bg-lime lg:mx-10">
          <Motif index={7} color="#ffffff" className="pointer-events-none absolute -right-6 -top-6 h-40 w-auto opacity-40" />
          <div className="grid grid-cols-1 items-center gap-8 p-6 lg:grid-cols-12 lg:p-10">
            <div className="lg:col-span-4">
              <p className="text-xs font-bold tracking-[0.2em]">AI FITTING</p>
              <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] lg:text-[32px] lg:leading-tight">
                사기 전에,
                <br />
                내 사진으로 먼저 메어보세요
              </h2>
              <p className="mt-3 text-sm text-ink/70">사진 한 장이면 AI가 가방을 든 내 모습을 만들어 드려요. 손에 들기 · 어깨에 메기 · 크로스로 메기까지.</p>
              <Link
                to={`/ai-fit/${tryOnProducts[0].id}`}
                className="mt-5 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper hover:bg-blue focus-ring"
              >
                AI 피팅 해보기 →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-8 lg:grid-cols-4">
              {tryOnProducts.slice(0, 4).map((p) => (
                <div key={p.id} className="rounded-md bg-paper p-2">
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      )}

      {/* LOOK CLOSER details */}
      {hero && hero.hotspots.length > 0 && (
        <Section title="LOOK CLOSER" subtitle="가까이 볼수록 보이는 디테일" more={{ to: `/product/${hero.id}`, label: '자세히 보기' }}>
          <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 lg:mx-0 lg:grid lg:grid-cols-3 lg:px-0">
            {hero.hotspots.map((h, i) => (
              <Link
                key={h.id}
                to={`/product/${hero.id}?hotspot=${h.id}`}
                className="group flex w-[72vw] shrink-0 snap-start items-center gap-4 rounded-lg border border-line p-4 hover:border-ink focus-ring sm:w-[45vw] lg:w-auto"
              >
                <span
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-black text-paper ${
                    ['bg-blue', 'bg-orange', 'bg-ink'][i % 3]
                  }`}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-bold tracking-[0.15em] text-stone">{h.category}</span>
                  <span className="block truncate text-[15px] font-bold">{h.title}</span>
                  {h.description.value && <span className="block truncate text-xs text-graphite">{h.description.value}</span>}
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* Brand band */}
      <Reveal as="section" className="mx-4 mt-14 grid grid-cols-1 overflow-hidden rounded-xl lg:mx-10 lg:grid-cols-2">
        <Link to="/about" className="group flex flex-col justify-between gap-10 bg-blue p-7 text-paper focus-ring lg:p-10">
          <p className="text-xs font-bold tracking-[0.2em] text-paper/70">BRAND</p>
          <div>
            <p className="font-display text-3xl tracking-[-0.02em] lg:text-5xl">LAGI IN AGING</p>
            <p className="mt-3 max-w-md text-sm text-paper/80">
              라기의 물건은 오래 쓸수록 멋이 듭니다. 바랜 색과 생활 자국까지 당신의 시간이 되도록, 처음부터 오래 쓸 것을 생각하며 만들어요.
            </p>
            <p className="mt-5 text-sm font-semibold group-hover:underline">브랜드 이야기 →</p>
          </div>
        </Link>
        <div className="grid grid-cols-2">
          <a
            href="https://www.instagram.com/lagi.official/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col justify-end gap-1 bg-cream p-6 hover:brightness-95 focus-ring lg:p-8"
          >
            <span className="text-xs font-bold tracking-[0.2em] text-ink/60">INSTAGRAM</span>
            <span className="text-lg font-bold">@lagi.official</span>
          </a>
          <a
            href="https://smartstore.naver.com/lagi_official"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col justify-end gap-1 bg-orange p-6 text-paper hover:brightness-95 focus-ring lg:p-8"
          >
            <span className="text-xs font-bold tracking-[0.2em] text-paper/70">SMART STORE</span>
            <span className="text-lg font-bold">공식 스토어 →</span>
          </a>
        </div>
      </Reveal>
    </div>
  );
}

interface Slide {
  key: string;
  eyebrow: string;
  title: React.ReactNode;
  text: string;
  cta: string;
  to: string;
  className: string;
  image?: string | null;
}

/** Big auto-rotating banner on the left, two fixed promos stacked on the right. */
function BannerBento({ hero, tryOnId }: { hero: Product | null; tryOnId: string | null }) {
  const cover = hero ? productCover(hero) : null;
  const slides: Slide[] = [
    {
      key: 'look',
      eyebrow: 'LAGI · LOOK CLOSER',
      title: (
        <>
          가까이,
          <br />
          그리고 다시.
        </>
      ),
      text: '라기의 가방과 소품을 가까이, 그리고 다시 들여다보세요.',
      cta: '제품 보기',
      to: hero ? `/product/${hero.id}` : '/products',
      className: 'bg-blue text-paper',
      image: cover,
    },
    ...(tryOnId
      ? [
          {
            key: 'tryon',
            eyebrow: 'AI FITTING',
            title: (
              <>
                거울 대신
                <br />
                내 사진으로.
              </>
            ),
            text: '사진 한 장으로, AI가 가방을 든 내 모습을 만들어 드려요.',
            cta: 'AI 피팅',
            to: `/ai-fit/${tryOnId}`,
            className: 'bg-lime text-ink',
            image: cover,
          },
        ]
      : []),
  ];

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), 5000);
    return () => window.clearInterval(id);
  }, [paused, slides.length]);
  const slide = slides[index % slides.length];

  return (
    <section className="grid grid-cols-1 gap-3 px-4 pt-4 lg:grid-cols-3 lg:px-10 lg:pt-6">
      <div
        className={`relative overflow-hidden rounded-xl transition-colors duration-500 lg:col-span-2 ${slide.className}`}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <Link to={slide.to} className="grid min-h-[340px] grid-cols-5 items-center gap-2 p-6 focus-ring sm:min-h-[400px] lg:min-h-[460px] lg:p-12">
          <div className="col-span-3 self-end lg:self-center" key={slide.key}>
            <p className="text-[11px] font-bold tracking-[0.2em] opacity-70">{slide.eyebrow}</p>
            <h2 className="mt-3 text-[28px]/[1.18] font-bold tracking-[-0.04em] sm:text-4xl/[1.15] lg:text-[54px]/[1.12]">{slide.title}</h2>
            <p className="mt-4 hidden max-w-sm text-sm opacity-80 sm:block">{slide.text}</p>
            <span className="mt-6 inline-flex rounded-full border border-current px-4 py-2 text-sm font-semibold">{slide.cta} →</span>
          </div>
          <div className="col-span-2 flex h-full items-center justify-center">
            {slide.image && (
              <img
                src={slide.image}
                alt=""
                className={`max-h-[260px] w-auto object-contain drop-shadow-[0_24px_30px_rgba(0,0,0,0.25)] transition-transform duration-700 lg:max-h-[380px] ${
                  slide.key === 'tryon' ? '-rotate-6' : ''
                }`}
              />
            )}
          </div>
        </Link>
        <div className="absolute bottom-4 right-4 flex items-center gap-2 lg:bottom-6 lg:right-6">
          <div className="flex gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`${i + 1}번 배너`}
                aria-current={i === index}
                className={`h-1.5 rounded-full bg-current transition-all ${i === index ? 'w-6 opacity-100' : 'w-1.5 opacity-40'}`}
              />
            ))}
          </div>
          <span className="rounded-full bg-black/25 px-2.5 py-1 text-[11px] font-semibold text-paper">
            {index + 1} / {slides.length}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
        <Link to="/about#why" className="flex min-h-[160px] flex-col justify-between rounded-xl bg-cream p-5 hover:brightness-[0.97] focus-ring lg:p-7">
          <p className="text-[11px] font-bold tracking-[0.2em] text-ink/60">WHY LAGI</p>
          <div>
            <p className="text-lg font-bold leading-snug tracking-[-0.03em] lg:text-2xl">
              라기가 고르는
              <br />네 가지 기준
            </p>
            <p className="mt-2 text-xs text-ink/60">ATTRACTION · POSSIBILITY · PROCESS & PEOPLE · CRAFT & SENSE →</p>
          </div>
        </Link>
        <Link
          to="/products"
          className="flex min-h-[160px] flex-col justify-between rounded-xl bg-ink p-5 text-paper hover:bg-[#262626] focus-ring lg:p-7"
        >
          <p className="text-[11px] font-bold tracking-[0.2em] text-paper/60">ALL ITEMS</p>
          <div>
            <p className="text-lg font-bold leading-snug tracking-[-0.03em] lg:text-2xl">
              라기의 모든
              <br />
              가방과 소품
            </p>
            <p className="mt-2 text-xs text-paper/60">전체 상품 보기 →</p>
          </div>
        </Link>
      </div>
    </section>
  );
}

function QuickMenu({ hero, tryOnId }: { hero: Product | null; tryOnId: string | null }) {
  const items: { label: string; to: string; external?: boolean; glyph: string; tone: string }[] = [
    { label: '랭킹', to: '/products?sort=ranking', glyph: 'TOP', tone: 'bg-blue text-paper' },
    { label: '전체 상품', to: '/products', glyph: 'ALL', tone: 'bg-mist text-ink' },
    ...(tryOnId ? [{ label: 'AI 피팅', to: `/ai-fit/${tryOnId}`, glyph: 'AI', tone: 'bg-lime text-ink' }] : []),
    { label: '왜 라기', to: '/about#why', glyph: 'WHY', tone: 'bg-cream text-ink' },
    { label: '소재', to: '/materials', glyph: 'MAT', tone: 'bg-mist text-ink' },
    { label: '스마트스토어', to: 'https://smartstore.naver.com/lagi_official', external: true, glyph: 'N', tone: 'bg-[#03c75a] text-paper' },
  ];
  return (
    <nav aria-label="바로가기" className="px-4 pt-8 lg:px-10">
      <ul className="no-scrollbar flex gap-4 overflow-x-auto lg:justify-between lg:gap-2">
        {items.map((it, i) => {
          const inner = (
            <>
              <span className={`flex h-14 w-14 items-center justify-center rounded-2xl text-[13px] font-black tracking-wide transition-transform duration-300 group-hover:-translate-y-1 lg:h-16 lg:w-16 ${it.tone}`}>{it.glyph}</span>
              <span className="text-xs font-medium">{it.label}</span>
            </>
          );
          const cls = 'group flex w-16 flex-col items-center gap-2 focus-ring lg:w-20';
          return (
            <Reveal as="li" key={it.label} delay={i * 50} className="shrink-0">
              {it.external ? (
                <a href={it.to} target="_blank" rel="noopener noreferrer" className={cls}>
                  {inner}
                </a>
              ) : (
                <Link to={it.to} className={cls}>
                  {inner}
                </Link>
              )}
            </Reveal>
          );
        })}
      </ul>
    </nav>
  );
}

function Section({
  title,
  subtitle,
  more,
  children,
}: {
  title: string;
  subtitle?: string;
  more?: { to: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="px-4 pt-16 lg:px-10 lg:pt-20">
      <Reveal className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-[-0.04em] lg:text-[32px]">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-stone">{subtitle}</p>}
        </div>
        {more && (
          <Link to={more.to} className="shrink-0 text-sm text-graphite hover:text-ink focus-ring">
            {more.label} &gt;
          </Link>
        )}
      </Reveal>
      {children}
    </section>
  );
}

/** A slow ribbon of the brand motifs between the hero and the shop. */
function MotifStrip() {
  const row = [...MOTIFS.keys(), ...MOTIFS.keys()];
  return (
    <div className="overflow-hidden border-b border-line bg-paper py-5" aria-hidden="true">
      <div className="animate-marquee flex w-max items-center gap-14">
        {[...row, ...row].map((m, i) => (
          <Motif key={i} index={m} className="h-8 w-auto shrink-0 lg:h-10" />
        ))}
      </div>
    </div>
  );
}

/** New apparel line: T-shirts and pants, switchable with two tabs. */
function WearSection({ tops, bottoms }: { tops: Product[]; bottoms: Product[] }) {
  const [tab, setTab] = useState<'top' | 'bottom'>(tops.length > 0 ? 'top' : 'bottom');
  const list = tab === 'top' ? tops : bottoms;
  return (
    <section className="relative mt-20 overflow-hidden bg-cream px-4 py-16 lg:px-10 lg:py-20">
      <Motif index={2} className="pointer-events-none absolute -right-10 top-8 h-36 w-auto opacity-90 lg:h-52" />
      <Reveal className="relative flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-[11px] font-bold tracking-[0.3em] text-ink/60">NEW · LAGI WEAR</p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] lg:text-5xl">
            오래 입을수록,
            <br />
            내 옷이 되는.
          </h2>
        </div>
        <div className="flex gap-2" role="tablist" aria-label="의류 종류">
          {(
            [
              ['top', '티셔츠', tops.length],
              ['bottom', '팬츠', bottoms.length],
            ] as const
          ).map(([k, label, n]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              disabled={n === 0}
              className={`rounded-full px-5 py-2.5 text-sm font-bold transition-colors focus-ring ${
                tab === k ? 'bg-ink text-paper' : 'bg-paper/70 text-graphite hover:bg-paper'
              }`}
            >
              {label} <span className="opacity-60">{n}</span>
            </button>
          ))}
        </div>
      </Reveal>
      <div key={tab} className="relative mt-10 grid grid-cols-2 gap-x-3 gap-y-8 lg:grid-cols-4 lg:gap-x-5">
        {list.map((p, i) => (
          <div key={p.id} className="animate-[lagi-rise_0.7s_cubic-bezier(.2,.7,.2,1)_both]" style={{ animationDelay: `${i * 90}ms` }}>
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
