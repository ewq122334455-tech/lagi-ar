import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CurvedGallery } from '../CurvedGallery';
import { BrandFilmOverlay } from '../BrandFilm';
import { IntroMotion, introSeen } from '../IntroMotion';
import { OFFICIAL_LINKS, useImageRatios, useRealProducts } from '../data';
import { ProductCard, cleanImage } from '../ProductCard';

function SectionTitle({ en, to, href }: { en: string; to?: string; href?: string }) {
  const more = to ? (
    <Link to={to} className="hit t-label t-mark underline underline-offset-4 hover:text-[var(--c-blue)]">
      View
    </Link>
  ) : href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="hit t-label t-mark underline underline-offset-4 hover:text-[var(--c-blue)]">
      @lagi.official
    </a>
  ) : null;
  return (
    <div className="text-center">
      <h2 className="t-label t-mark">{en}</h2>
      <div className="mt-4">{more}</div>
    </div>
  );
}

export default function Home() {
  const { products, error } = useRealProducts();
  const ratios = useImageRatios(products);
  const ready = products.length > 0 && products.every((p) => ratios[p.id]);
  const [film, setFilm] = useState(false);
  // The brand motion plays once per visit before the home page.
  const [intro, setIntro] = useState(() => !introSeen());
  const byId = (id: string) => products.find((p) => p.id === id);

  return (
    <div>
      {intro && <IntroMotion onDone={() => setIntro(false)} />}
      {/* 1 · The curved gallery, one screen (vertical scroll moves the page; drag sideways to turn it). */}
      <section className="relative h-[100svh] overflow-hidden bg-[var(--c-gray)]" aria-label="LAGI 제품 갤러리">
        {ready && <CurvedGallery products={products} ratios={ratios} pageScroll />}
        {error && <p className="t-caption kr absolute left-[var(--page-x)] top-24">{error}</p>}
        <button type="button" onClick={() => setFilm(true)} className="t-nav tag tag-ink t-mark absolute right-[var(--page-x)] top-24 z-[160] max-md:!bg-[rgba(241,241,241,0.92)] max-md:!px-2 max-md:py-1 lg:top-[176px]">
          ▶ Brand film
        </button>
        {film && <BrandFilmOverlay onClose={() => setFilm(false)} />}
        {/* Phones: on a light panel and above the floating help button, so it never sits on a photo. */}
        <div className="pointer-events-none absolute bottom-6 left-[var(--page-x)] z-[150] max-md:bottom-[84px] max-md:bg-[rgba(241,241,241,0.92)] max-md:px-2 max-md:pt-2">
          <h1 className="t-display t-mark text-[var(--c-ink)]">
            LAGI
            <br />
            in AGAIN
          </h1>
        </div>
      </section>

      {/* 2 · New — the products as cards, clean front view first, the real photo on hover */}
      <section className="px-page pt-[var(--section)]" aria-labelledby="new-title">
        <div id="new-title">
          <SectionTitle en="New" to="/discover" />
        </div>
        <div className="-mx-[var(--page-x)] mt-20 flex snap-x scroll-px-[var(--page-x)] gap-[var(--gap)] overflow-x-auto px-[var(--page-x)] pb-2 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0" data-testid="home-new">
          {products.slice(0, 4).map((p, i) => (
            <div key={p.id} className="w-[62vw] shrink-0 snap-start md:w-auto">
              <ProductCard p={p} eager={i < 4} />
            </div>
          ))}
        </div>
      </section>

      {/* 3 · One quiet line, then space. */}
      <section className="px-page py-[var(--section)] text-center" aria-label="Instagram">
        <a href={OFFICIAL_LINKS.instagram} target="_blank" rel="noopener noreferrer" className="hit t-label t-mark underline underline-offset-4 hover:text-[var(--c-blue)]">
          @lagi.official
        </a>
      </section>
    </div>
  );
}
