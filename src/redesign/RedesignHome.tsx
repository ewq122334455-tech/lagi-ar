import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProducts } from '@/hooks/useProducts';
import type { Product } from '@/data/productTypes';
import { LagiLogo } from '@/components/LagiLogo';
import { Motif } from '@/components/Motif';
import { Reveal } from '@/components/Reveal';
import { DiscoverFlow } from './DiscoverFlow';
import type { DiscoverItem } from './DiscoverFlow';

/**
 * LAGI homepage redesign (prototype, /v2). Editorial, product-first, quiet: white space, strong
 * type, the official emblem untouched, brand colours only as points. Lives beside the current
 * home page — nothing existing is replaced.
 */

const BRAND_BLUE = '#1D5198'; // the emblem's own blue

/** Real products only: photographed items on sale — no samples, no renders. */
function useRealProducts(): Product[] {
  const state = useProducts();
  return useMemo(
    () => (state.status === 'ready' ? state.data.filter((p) => !p.sample && p.images.length > 0 && p.name.status === 'VERIFIED') : []),
    [state],
  );
}

/** Reads each photo's natural proportions so frames never stretch or squash a product. */
function useRatios(products: Product[]) {
  const [ratios, setRatios] = useState<Record<string, number>>({});
  useEffect(() => {
    let alive = true;
    products.forEach((p) => {
      const img = new Image();
      img.onload = () => alive && setRatios((r) => ({ ...r, [p.id]: img.naturalWidth / img.naturalHeight }));
      img.src = p.images[0];
    });
    return () => {
      alive = false;
    };
  }, [products]);
  return ratios;
}

export default function RedesignHome() {
  const products = useRealProducts();
  const ratios = useRatios(products);
  const ready = products.length > 0 && products.every((p) => ratios[p.id]);
  const items: DiscoverItem[] = ready
    ? products.map((p) => ({ id: p.id, name: p.name.value ?? p.id, price: p.price.value, image: p.images[0], ratio: ratios[p.id] }))
    : [];
  const hero = products[0];

  return (
    <div className="min-h-screen bg-paper text-ink antialiased">
      <Header />
      <main>
        <Hero product={hero} ratio={hero ? ratios[hero.id] : undefined} />
        {ready ? <DiscoverFlow items={items} /> : <div className="h-screen" />}
        <Selected products={products} ratios={ratios} />
        <WhyLagi />
        <About />
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between bg-paper/90 px-5 py-3 backdrop-blur-sm lg:px-12 lg:py-4">
      <Link to="/v2" aria-label="LAGI" className="focus-ring">
        <LagiLogo className="h-10 w-auto text-[#1D5198] lg:h-12" title="LAGI" />
      </Link>
      <nav aria-label="주요 메뉴" className="flex items-center gap-5 text-[12px] tracking-[0.16em] lg:gap-10 lg:text-[13px]">
        <a href="#discover" onClick={(e) => scrollToId(e, 'discover')} className="hover:opacity-60 focus-ring">
          DISCOVER
        </a>
        <a href="#selected" onClick={(e) => scrollToId(e, 'selected')} className="hidden hover:opacity-60 focus-ring sm:inline">
          PRODUCTS
        </a>
        <a href="#about" onClick={(e) => scrollToId(e, 'about')} className="hover:opacity-60 focus-ring">
          ABOUT
        </a>
        <Link to="/products" className="hover:opacity-60 focus-ring">
          SHOP
        </Link>
      </nav>
    </header>
  );
}

// HashRouter owns the URL hash, so in-page links scroll by id instead of changing the hash.
function scrollToId(e: React.MouseEvent, id: string) {
  e.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

const rise = 'animate-[lagi-rise_1.1s_cubic-bezier(.2,.7,.2,1)_both]';

function Hero({ product, ratio }: { product?: Product; ratio?: number }) {
  return (
    <section className="relative grid min-h-[100svh] grid-cols-1 items-end gap-10 px-5 pb-14 pt-28 lg:grid-cols-12 lg:gap-12 lg:px-12 lg:pb-16 lg:pt-32">
      <div className="lg:col-span-5 lg:self-stretch lg:pb-4">
        <div className="flex h-full flex-col justify-between gap-12">
          <p className={`text-[11px] tracking-[0.3em] text-ink/50 ${rise}`} style={{ animationDelay: '100ms' }}>
            01 — RECYCLED PRODUCTS, CURATED
          </p>
          <div>
            {/* The official emblem, at its own proportions and colour. */}
            <LagiLogo className={`h-40 w-auto text-[#1D5198] lg:h-64 ${rise}`} title="LAGI" />
            <h1
              className={`mt-10 font-display text-[11vw] leading-[0.92] tracking-[0.01em] lg:text-[5.6vw] ${rise}`}
              style={{ animationDelay: '250ms', color: BRAND_BLUE }}
            >
              LAGI
              <br />
              IN AGAIN
            </h1>
            <p className={`mt-8 max-w-sm text-[15px] leading-relaxed text-ink/70 ${rise}`} style={{ animationDelay: '400ms' }}>
              리사이클링 제품을 발견하고, 선별하고, 소개하고, 연결합니다.
            </p>
          </div>
        </div>
      </div>
      <div className="lg:col-span-6 lg:col-start-7">
        {product && ratio ? (
          <Link to={`/product/${product.id}`} className="group block focus-ring" aria-label={`${product.name.value} 자세히 보기`}>
            <span
              className="block overflow-hidden bg-mist animate-[lagi-unveil_1.4s_cubic-bezier(.65,0,.35,1)_both]"
              style={{ aspectRatio: ratio }}
            >
              <img
                src={product.images[0]}
                alt={product.name.value ?? ''}
                className="h-full w-full object-cover transition-transform duration-[1.6s] ease-out group-hover:scale-[1.02]"
              />
            </span>
            <span className="mt-3 flex justify-between text-[12px] text-ink/60">
              <span>{product.name.value}</span>
              <span className="tracking-[0.16em]">VIEW →</span>
            </span>
          </Link>
        ) : (
          <div className="aspect-square bg-mist" />
        )}
      </div>
    </section>
  );
}

function SectionHead({ index, title, note }: { index: string; title: string; note?: string }) {
  return (
    <Reveal className="flex flex-wrap items-end justify-between gap-6 border-t border-ink pt-6">
      <div>
        <p className="text-[11px] tracking-[0.3em] text-ink/50">{index}</p>
        <h2 className="mt-2 font-display text-3xl tracking-[0.02em] lg:text-5xl">{title}</h2>
      </div>
      {note && <p className="max-w-xs text-[13px] leading-relaxed text-ink/60">{note}</p>}
    </Reveal>
  );
}

/** Editorial product spreads: uneven columns, each photo at its own proportions. */
function Selected({ products, ratios }: { products: Product[]; ratios: Record<string, number> }) {
  const picks = products.slice(0, 6);
  // Column placement per row on large screens: [image span, image start, text start].
  const layout: [string, string][] = [
    ['lg:col-span-7', 'lg:col-span-4 lg:col-start-9'],
    ['lg:col-span-4 lg:col-start-2', 'lg:col-span-4 lg:col-start-7'],
    ['lg:col-span-5 lg:col-start-6', 'lg:col-span-3 lg:col-start-2 lg:row-start-1'],
  ];
  return (
    <section id="selected" className="scroll-mt-24 px-5 pb-28 pt-32 lg:px-12 lg:pb-40">
      <SectionHead index="03" title="SELECTED PRODUCTS" note="라기가 고른 리사이클링 제품. 공식 스토어의 정보를 그대로 옮겼습니다." />
      <div className="mt-16 space-y-24 lg:mt-24 lg:space-y-40">
        {picks.map((p, i) => {
          const [imgCls, textCls] = layout[i % layout.length];
          return (
            <Reveal key={p.id} className="grid grid-cols-1 items-end gap-6 lg:grid-cols-12 lg:gap-12">
              <Link to={`/product/${p.id}`} className={`group block focus-ring ${imgCls}`} aria-label={`${p.name.value} 자세히 보기`}>
                <span className="block overflow-hidden bg-mist" style={{ aspectRatio: ratios[p.id] ?? 1 }}>
                  <img
                    src={p.images[0]}
                    alt={p.name.value ?? ''}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-[1.4s] ease-out group-hover:scale-[1.02]"
                  />
                </span>
              </Link>
              <div className={textCls}>
                <p className="font-display text-sm tracking-[0.2em] text-ink/40">{String(i + 1).padStart(2, '0')}</p>
                <p className="mt-3 text-[11px] tracking-[0.16em] text-ink/50">{p.brandLabel ?? 'LAGI'}</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.02em] lg:text-[28px]">{p.name.value}</h3>
                {p.shortDescription.value && <p className="mt-3 text-[14px] leading-relaxed text-ink/65">{p.shortDescription.value}</p>}
                <div className="mt-6 flex items-baseline justify-between border-t border-line pt-4 text-[13px]">
                  <span className="tabular-nums">{p.price.value != null ? `${p.price.value.toLocaleString('ko-KR')}원` : ''}</span>
                  <Link to={`/product/${p.id}`} className="tracking-[0.16em] hover:opacity-60 focus-ring">
                    VIEW →
                  </Link>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

/**
 * The four selection criteria. No official wording has been supplied, so the slots are laid out
 * and marked as waiting for it rather than filled with invented copy.
 */
function WhyLagi() {
  return (
    <section className="bg-mist px-5 py-28 lg:px-12 lg:py-40">
      <SectionHead index="04" title="WHY LAGI" note="라기가 제품을 고르는 네 가지 기준." />
      <ol className="mt-16 grid grid-cols-1 gap-px bg-ink/10 sm:grid-cols-2 lg:mt-24 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Reveal
            as="li"
            key={i}
            delay={i * 90}
            className="flex min-h-[260px] flex-col justify-between bg-mist p-6 lg:min-h-[360px] lg:p-8"
          >
            <div className="flex items-start justify-between">
              <span className="font-display text-5xl lg:text-6xl" style={{ color: BRAND_BLUE }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <Motif index={[0, 6, 4, 9][i]} className="h-6 w-auto opacity-80" />
            </div>
            <div>
              <p className="text-[11px] tracking-[0.2em] text-ink/40">CRITERION {String(i + 1).padStart(2, '0')}</p>
              <p className="mt-2 border-t border-dashed border-ink/25 pt-3 text-[13px] text-ink/45">공식 문구 제공 후 입력</p>
            </div>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

function About() {
  const roles = [
    ['발견', 'DISCOVER'],
    ['선별', 'SELECT'],
    ['소개', 'INTRODUCE'],
    ['연결', 'CONNECT'],
  ];
  return (
    <section id="about" className="scroll-mt-24 px-5 py-28 lg:px-12 lg:py-40">
      <SectionHead index="05" title="ABOUT" />
      <div className="mt-16 grid grid-cols-1 gap-16 lg:mt-24 lg:grid-cols-12 lg:gap-12">
        <Reveal className="lg:col-span-6">
          <p className="text-[26px] font-semibold leading-[1.45] tracking-[-0.02em] lg:text-[40px]">
            LAGI는 리사이클링 제품을 발견하고, 선별하고, 소개하고, 연결하는 큐레이션 브랜드입니다.
          </p>
          <p className="mt-8 max-w-md text-[15px] leading-relaxed text-ink/65">
            브랜드의 핵심은 제품을 새로운 관점에서 다시 발견하는 경험입니다.
          </p>
        </Reveal>
        <ul className="lg:col-span-5 lg:col-start-8">
          {roles.map(([ko, en], i) => (
            <Reveal
              as="li"
              key={en}
              delay={i * 80}
              className="flex items-baseline justify-between border-t border-ink/15 py-6 last:border-b"
            >
              <span className="text-2xl font-semibold lg:text-3xl">{ko}</span>
              <span className="font-display text-sm tracking-[0.2em] text-ink/45">{en}</span>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-ink px-5 py-12 lg:px-12">
      <div className="flex flex-wrap items-end justify-between gap-8">
        <LagiLogo className="h-14 w-auto text-[#1D5198]" title="LAGI" />
        <div className="flex gap-8 text-[12px] tracking-[0.16em]">
          <a
            href="https://smartstore.naver.com/lagi_official"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-60 focus-ring"
          >
            SMART STORE
          </a>
          <a
            href="https://www.instagram.com/lagi.official/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-60 focus-ring"
          >
            INSTAGRAM
          </a>
        </div>
      </div>
    </footer>
  );
}
