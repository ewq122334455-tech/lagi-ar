import { Suspense, lazy, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { price, useRealProducts } from '../data';
import { BrandFilmSection } from '../BrandFilm';
// three.js is only needed for the ribbon — load it after the page text.
const RibbonCanvas = lazy(() => import('../RibbonCanvas').then((m) => ({ default: m.RibbonCanvas })));

const STATEMENT_EN = 'We discover, select, introduce and connect products worth seeing again.';
// One honest line is kept: the products are made by their makers, LAGI curates them.
const STATEMENT_KR = '제품은 각 제작사가 만들고, 라기는 발견하고 선별해 소개합니다.';

/** ABOUT — name, a ribbon of products, one statement, the film. The rest is space. */
export default function About() {
  const { products } = useRealProducts();
  const navigate = useNavigate();
  const textRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    let raf = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // The statement darkens word by word as it scrolls into place.
        const el = textRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const p = reduced ? 1 : Math.min(1, Math.max(0, (window.innerHeight * 0.95 - r.top) / (r.height + window.innerHeight * 0.45)));
        const words = el.children;
        for (let i = 0; i < words.length; i++) (words[i] as HTMLElement).style.opacity = i / words.length < p ? '1' : '0.25';
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [products.length]);

  // One frame per product; the film repeats on its own along the band.
  const ribbon = products
    .filter((p) => !!p.images[0])
    .map((p) => ({ src: p.images[0], caption: `${p.name.value} · ${price(p.price.value)}`, href: `/product/${p.id}`, label: `${p.name.value} 보기` }));

  return (
    <div className="pb-[var(--section)]">
      <section className="relative h-[100svh] min-h-[560px] overflow-hidden" aria-label="LAGI in AGAIN">
        {ribbon.length > 0 && (
          <Suspense fallback={null}>
            <RibbonCanvas images={ribbon} className="absolute inset-0" onSelect={(href) => navigate(href)} />
          </Suspense>
        )}
        <h1 className="t-display t-mark pointer-events-none relative z-10 px-page pt-page lg:pl-[8%]">
          LAGI
          <br />
          in AGAIN
        </h1>
      </section>

      <div className="relative z-10 -mt-[12svh] px-page lg:ml-[56%] lg:w-[38%] lg:-mt-[18svh]">
        <p ref={textRef} className="t-en">
          {STATEMENT_EN.split(' ').map((w, i) => (
            <span key={i} className="transition-opacity duration-300">
              {w}{' '}
            </span>
          ))}
        </p>
        <p className="t-kr-sub mt-4 max-w-[26rem]">{STATEMENT_KR}</p>
      </div>

      <div className="mt-[var(--section)]">
        <BrandFilmSection />
      </div>
    </div>
  );
}
