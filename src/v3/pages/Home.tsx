import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CurvedGallery } from '../CurvedGallery';
import { BrandFilmOverlay } from '../BrandFilm';
import { IntroMotion, introSeen } from '../IntroMotion';
import { OFFICIAL_LINKS, useImageRatios, useRealProducts } from '../data';
import { ProductCard, cleanImage } from '../ProductCard';

function SectionTitle({ en, kr, to, href }: { en: string; kr: string; to?: string; href?: string }) {
  const more = to ? (
    <Link to={to} className="t-label t-mark underline underline-offset-4 hover:text-[var(--c-blue)]">
      View
    </Link>
  ) : href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="t-label t-mark underline underline-offset-4 hover:text-[var(--c-blue)]">
      @lagi.official
    </a>
  ) : null;
  return (
    <div className="text-center">
      <h2 className="t-h2 t-mark">{en}</h2>
      <p className="t-caption kr mt-1 text-[var(--c-mute)]">{kr}</p>
      <div className="mt-3">{more}</div>
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
  const archive = [
    { to: '/why', en: 'Why LAGI', kr: '라기가 제품을 고르는 네 가지 기준', img: byId('plano-bag')?.images[0], tone: 'photo' },
    { to: '/about', en: 'LAGI Film', kr: '다시 쓰임을 얻은 물건들의 기록', img: byId('origami-picnic-bag')?.images[0], tone: 'photo' },
    { to: '/again', en: 'Again · AI Fitting', kr: '내 사진이나 카메라로 제품을 입혀 보기', img: byId('daily-tote') && cleanImage(byId('daily-tote')!), tone: 'blue' },
  ];

  return (
    <div>
      {intro && <IntroMotion onDone={() => setIntro(false)} />}
      {/* 1 · The curved gallery, one screen (vertical scroll moves the page; drag sideways to turn it). */}
      <section className="relative h-[100svh] overflow-hidden bg-[var(--c-gray)]" aria-label="LAGI 제품 갤러리">
        {ready && <CurvedGallery products={products} ratios={ratios} pageScroll />}
        {error && <p className="t-caption kr absolute left-[var(--page-x)] top-24">{error}</p>}
        <button type="button" onClick={() => setFilm(true)} className="t-nav tag tag-ink t-mark absolute right-[var(--page-x)] top-20 z-[160] lg:top-[150px]">
          ▶ Brand film
        </button>
        {film && <BrandFilmOverlay onClose={() => setFilm(false)} />}
        <div className="pointer-events-none absolute bottom-6 left-[var(--page-x)] z-[150]">
          <h1 className="t-display t-mark text-[var(--c-ink)]">
            LAGI
            <br />
            in AGAIN
          </h1>
        </div>
      </section>

      {/* 2 · New — the products as cards, clean front view first, the real photo on hover */}
      <section className="px-page pt-24 lg:pt-32" aria-labelledby="new-title">
        <div id="new-title">
          <SectionTitle en="New! LAGI" kr="라기가 새로 고른 제품" to="/discover" />
        </div>
        <div className="-mx-[var(--page-x)] mt-10 flex snap-x scroll-px-[var(--page-x)] gap-[var(--gap)] overflow-x-auto px-[var(--page-x)] pb-2 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0" data-testid="home-new">
          {products.slice(0, 8).map((p, i) => (
            <div key={p.id} className="w-[62vw] shrink-0 snap-start md:w-auto">
              <ProductCard p={p} eager={i < 4} />
            </div>
          ))}
        </div>
      </section>

      {/* 3 · Archive — the brand's stories */}
      <section className="px-page pt-24 lg:pt-32" aria-labelledby="archive-title">
        <div id="archive-title">
          <SectionTitle en="Archive" kr="라기의 기준과 기록" />
        </div>
        <div className="mt-10 grid grid-cols-1 gap-[var(--gap)] md:grid-cols-3" data-testid="home-archive">
          {archive.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className={`group relative flex aspect-[4/5] flex-col justify-between overflow-hidden rounded-[var(--radius-card)] p-5 lg:p-7 ${
                a.tone === 'blue' ? 'bg-[var(--c-blue)] text-white' : 'bg-[var(--c-gray)] text-white'
              }`}
            >
              {a.img && (
                <img
                  src={a.img}
                  alt=""
                  loading="lazy"
                  className={
                    a.tone === 'blue'
                      ? 'absolute left-1/2 top-[16%] h-[44%] w-auto -translate-x-1/2 rounded-[6px] object-contain transition-transform duration-700 group-hover:scale-105'
                      : 'absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105'
                  }
                />
              )}
              {a.tone !== 'blue' && <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/55" />}
              <span className="t-label t-mark relative">LAGI Journal</span>
              <span className="relative">
                <span className="t-h2 t-mark block">{a.en}</span>
                <span className="t-caption kr mt-1 block opacity-90">{a.kr}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 4 · Follow — real photos, out to Instagram */}
      <section className="pb-24 pt-24 lg:pb-32 lg:pt-32" aria-labelledby="follow-title">
        <div id="follow-title" className="px-page">
          <SectionTitle en="Follow LAGI" kr="인스타그램에서 더 많은 이야기를 만나 보세요" href={OFFICIAL_LINKS.instagram} />
        </div>
        <div className="mt-10 flex snap-x scroll-px-[var(--page-x)] gap-3 overflow-x-auto px-[var(--page-x)] pb-2" data-testid="home-follow">
          {products.map((p) => (
            <a key={p.id} href={OFFICIAL_LINKS.instagram} target="_blank" rel="noopener noreferrer" className="group relative block aspect-square w-[58vw] shrink-0 snap-start overflow-hidden rounded-[var(--radius-card)] sm:w-[34vw] lg:w-[19vw]" aria-label={`${p.name.value} — 인스타그램에서 보기`}>
              <img src={p.images[0]} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
