import { useEffect, useRef } from 'react';
import { CATEGORY_LABEL, useRealProducts } from '../data';
import { BrandFilmSection } from '../BrandFilm';
import { RibbonCanvas } from '../RibbonCanvas';

const STATEMENT =
  'LAGI is a curation brand that discovers, selects, introduces and connects recycled products. We do not make them ourselves — we choose products of value and help you discover them again, from a new point of view.';

/** ABOUT (reference: The studio) — name, a ribbon of products, the statement, information lists. */
export default function About() {
  const { products } = useRealProducts();
  const textRef = useRef<HTMLParagraphElement>(null);
  const collabs = [...new Set(products.map((p) => p.brandLabel).filter((b): b is string => !!b && b.includes('×')))].map((b) => b.split('×')[1].trim());
  const categories = [...new Set(products.map((p) => p.category.value).filter(Boolean))] as string[];

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

  // Two passes of the real products' main photos, so the band never shows the same one twice in view.
  const ribbon = [...products, ...products].map((p) => ({ src: p.images[0] })).filter((i) => !!i.src);

  return (
    <div className="pb-32">
      <section className="relative h-[100svh] min-h-[560px] overflow-hidden" aria-label="LAGI in AGAIN">
        {ribbon.length > 0 && <RibbonCanvas images={ribbon} className="absolute inset-0" />}
        <h1 className="t-display pointer-events-none relative z-10 px-page pt-page lg:pl-[8%]">
          LAGI
          <br />
          in AGAIN
        </h1>
      </section>

      <p ref={textRef} className="t-h1 relative z-10 -mt-[14svh] px-page lg:ml-[48%] lg:w-[48%] lg:-mt-[20svh]">
        {STATEMENT.split(' ').map((w, i) => (
          <span key={i} className="transition-opacity duration-300">
            {w}{' '}
          </span>
        ))}
      </p>

      <div className="mt-24 lg:mt-36">
        <BrandFilmSection />
      </div>

      <section className="rule mx-[var(--page-x)] mt-24 grid grid-cols-1 gap-x-[var(--gap)] gap-y-12 pt-6 lg:mt-36 lg:grid-cols-12 [&>*]:min-w-0">
        <h2 className="t-h1 lg:col-span-12">Information</h2>
        <div className="lg:col-span-4">
          <h3 className="t-h3">Role</h3>
          <ul className="t-body mt-4 text-[var(--c-mute)]">
            {['Discover', 'Select', 'Introduce', 'Connect'].map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
        <div className="lg:col-span-4">
          <h3 className="t-h3">Categories</h3>
          <ul className="t-body mt-4 text-[var(--c-mute)]">
            {categories.map((c) => (
              <li key={c}>{CATEGORY_LABEL[c] ?? c}</li>
            ))}
          </ul>
        </div>
        {collabs.length > 0 && (
          <div className="lg:col-span-4">
            <h3 className="t-h3">Collaboration</h3>
            <ul className="t-body mt-4 text-[var(--c-mute)]">
              {collabs.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <div className="mt-32 overflow-hidden border-y border-[var(--c-ink)] py-5 lg:mt-48" aria-hidden="true">
        <div className="animate-marquee t-h1 flex w-max gap-12 whitespace-nowrap">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i}>LAGI in AGAIN · Discover it again</span>
          ))}
        </div>
      </div>
    </div>
  );
}
