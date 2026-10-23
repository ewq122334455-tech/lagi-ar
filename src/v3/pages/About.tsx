import { useEffect, useRef } from 'react';
import { CATEGORY_LABEL, useImageRatios, useRealProducts } from '../data';

const STATEMENT =
  'LAGI is a curation brand that discovers, selects, introduces and connects recycled products. We do not make them ourselves — we choose products of value and help you discover them again, from a new point of view.';

/** ABOUT (reference: The studio) — name, a ribbon of products, the statement, information lists. */
export default function About() {
  const { products } = useRealProducts();
  const ratios = useImageRatios(products);
  const ribbonRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const collabs = [...new Set(products.map((p) => p.brandLabel).filter((b): b is string => !!b && b.includes('×')))].map((b) => b.split('×')[1].trim());
  const categories = [...new Set(products.map((p) => p.category.value).filter(Boolean))] as string[];

  useEffect(() => {
    let raf = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        const ribbon = ribbonRef.current;
        if (ribbon) {
          const shift = reduced ? 0 : -y * 0.6;
          ribbon.style.transform = `translate3d(${shift.toFixed(1)}px,0,0)`;
          // Each photo rides a wave across the screen and leans with its slope, so the row reads as a bent ribbon.
          const vw = window.innerWidth;
          const amp = window.innerHeight * 0.07;
          for (const el of Array.from(ribbon.children) as HTMLElement[]) {
            const cx = el.offsetLeft + el.offsetWidth / 2 + shift;
            const t = (cx / vw) * Math.PI * 1.4;
            el.style.transform = `translateY(${(Math.sin(t) * amp).toFixed(1)}px) rotate(${(Math.cos(t) * 9).toFixed(2)}deg)`;
          }
        }
        // The statement darkens word by word as it scrolls into place.
        const el = textRef.current;
        if (el) {
          const r = el.getBoundingClientRect();
          const p = reduced ? 1 : Math.min(1, Math.max(0, (window.innerHeight * 0.85 - r.top) / (r.height + window.innerHeight * 0.35)));
          const words = el.children;
          for (let i = 0; i < words.length; i++) (words[i] as HTMLElement).style.opacity = i / words.length < p ? '1' : '0.25';
        }
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [products.length]);

  const ribbon = [...products, ...products, ...products];

  return (
    <div className="pb-32 pt-page">
      <h1 className="t-display px-page">
        LAGI
        <br />
        in AGAIN
      </h1>

      <div className="mt-12 overflow-hidden lg:mt-16" aria-hidden="true">
        <div ref={ribbonRef} className="flex w-max items-center gap-1 py-[8vh] pl-[10vw] will-change-transform">
          {ribbon.map((p, i) => (
            <img
              key={`${p.id}-${i}`}
              src={p.images[0]}
              alt=""
              className="block h-[26vh] w-auto rounded-[var(--radius-card)] object-cover lg:h-[34vh]"
              style={{ aspectRatio: ratios[p.id] ?? 1 }}
            />
          ))}
        </div>
      </div>

      <p ref={textRef} className="t-h1 mt-20 px-page lg:ml-[33%] lg:mt-28 lg:w-[60%]">
        {STATEMENT.split(' ').map((w, i) => (
          <span key={i} className="transition-opacity duration-300">
            {w}{' '}
          </span>
        ))}
      </p>

      <section className="rule mx-[var(--page-x)] mt-24 grid grid-cols-1 gap-x-[var(--gap)] gap-y-12 pt-6 lg:mt-36 lg:grid-cols-12 [&>*]:min-w-0">
        <h2 className="t-h1 lg:col-span-5">Information</h2>
        <div className="lg:col-span-3">
          <h3 className="t-h3">Role</h3>
          <ul className="t-body mt-4 text-[var(--c-mute)]">
            {['Discover', 'Select', 'Introduce', 'Connect'].map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
        <div className="lg:col-span-2">
          <h3 className="t-h3">Categories</h3>
          <ul className="t-body mt-4 text-[var(--c-mute)]">
            {categories.map((c) => (
              <li key={c}>{CATEGORY_LABEL[c] ?? c}</li>
            ))}
          </ul>
        </div>
        {collabs.length > 0 && (
          <div className="lg:col-span-2">
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
