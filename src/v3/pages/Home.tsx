import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Product } from '@/data/productTypes';
import { useCart } from '@/commerce/CartContext';
import { WHY_LAGI, WHY_LAGI_RULE } from '@/content/whyLagi';
import { ROLES } from '@/content/roles';
import { CurvedGallery } from '../CurvedGallery';
import { BrandFilmOverlay } from '../BrandFilm';
import { MotifCrop, Point } from '../MotifCrop';
import { CATEGORY_LABEL, price, useImageRatios, useRealProducts } from '../data';


const pad = (n: number) => String(n).padStart(2, '0');

export default function Home() {
  const { products, error } = useRealProducts();
  const ratios = useImageRatios(products);
  const ready = products.length > 0 && products.every((p) => ratios[p.id]);
  const [film, setFilm] = useState(false);
  const hero = products[0];

  return (
    <div>
      {/* 01 HERO */}
      <section className="relative grid min-h-[100svh] grid-cols-1 gap-x-[var(--gap)] px-page pb-10 pt-24 lg:grid-cols-12 lg:pt-28" aria-labelledby="hero-title">
        <div className="flex flex-col justify-between lg:col-span-7">
          <div>
            <p className="t-label t-mark text-[var(--c-mute)]">Recycled product curation</p>
            <h1 id="hero-title" className="t-display t-mark mt-4 text-[clamp(56px,11vw,168px)] leading-[0.9]">
              LAGI
              <br />
              in AGAIN
            </h1>
          </div>
          <div className="mt-10 max-w-[34rem] lg:mt-0">
            <p className="t-lead kr">다시 볼 이유가 있는 리사이클링 제품을 발견하고, 고르고, 소개하고, 연결합니다.</p>
            <p className="t-body kr mt-3 text-[var(--c-mute)]">라기는 제품을 직접 만들지 않습니다. 가치 있는 제품을 선별해 새로운 관점에서 다시 보여 줍니다.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link to="/discover" className="t-nav tag tag-ink kr px-4 py-3">
                제품 보기
              </Link>
              <button type="button" onClick={() => setFilm(true)} className="t-nav tag kr bg-[var(--c-label)] px-4 py-3">
                ▶ 브랜드 영상
              </button>
            </div>
          </div>
        </div>
        {hero && (
          <Link to={`/product/${hero.id}`} className="group relative mt-10 block lg:col-span-5 lg:mt-0" aria-label={`${hero.name.value} 자세히 보기`}>
            <div className="h-full min-h-[46svh] overflow-hidden rounded-[var(--radius-card)] bg-[var(--c-gray)]">
              <img src={hero.images[0]} alt="" className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
            </div>
            <span className="t-caption kr absolute bottom-3 left-3 flex items-center gap-2 bg-[var(--c-white)] px-2 py-1">
              <Point className="!h-2 !w-2" />
              {hero.name.value} · {price(hero.price.value)}
            </span>
          </Link>
        )}
        {error && <p className="t-caption kr">{error}</p>}
      </section>

      {/* 02 DISCOVER */}
      {ready && <CurvedGallery products={products} ratios={ratios} mode="scroll" />}

      {/* 03 SELECTED PRODUCTS */}
      {products.length > 0 && <Selected products={products} />}

      {/* 04 WHY LAGI */}
      <section className="px-page pt-28 lg:pt-44" aria-labelledby="why-title">
        <div className="rule grid grid-cols-1 gap-x-[var(--gap)] gap-y-4 pt-4 lg:grid-cols-12">
          <p className="t-label t-mark text-[var(--c-mute)] lg:col-span-2">04</p>
          <div className="lg:col-span-10">
            <h2 id="why-title" className="t-display t-mark">
              WHY LAGI?
            </h2>
            <p className="t-lead kr mt-4 max-w-[36rem] text-[var(--c-mute)]">라기가 제품을 고르는 네 가지 기준입니다.</p>
          </div>
        </div>
        <ol className="mt-14 lg:mt-20">
          {WHY_LAGI.map((c, i) => (
            <li key={c.key} className="rule-1 grid grid-cols-1 gap-x-[var(--gap)] gap-y-3 py-6 lg:grid-cols-12 lg:py-9">
              <span className="t-label t-mark tabular-nums text-[var(--c-mute)] lg:col-span-2">{pad(i + 1)}</span>
              <span className="t-h3 t-mark flex items-center gap-3 lg:col-span-3">
                <Point />
                {c.key}
              </span>
              <span className="t-h3 kr !font-medium lg:col-span-7">{c.question}</span>
            </li>
          ))}
        </ol>
        <div className="rule mt-0 flex flex-wrap items-baseline justify-between gap-4 pt-5">
          <p className="t-lead kr !font-bold">{WHY_LAGI_RULE}</p>
          <Link to="/why" className="t-nav tag kr bg-[var(--c-label)] px-4 py-3">
            선정 기준 자세히
          </Link>
        </div>
      </section>

      {/* 05 AGAIN EXPERIENCE */}
      {hero && (
        <section className="mt-28 bg-[var(--c-gray)] px-page py-20 lg:mt-44 lg:py-32" aria-labelledby="again-title">
          <div className="grid grid-cols-1 items-center gap-x-[var(--gap)] gap-y-12 lg:grid-cols-12">
            <Link to="/again" className="group block lg:col-span-6" aria-label="AI 이미지 합성 시작">
              <MotifCrop src={hero.images[0]} motif={0} className="w-full" />
              <span className="t-caption kr mt-3 block text-[var(--c-mute)]">사진에 마우스를 올리면 전체가 보입니다 — 일부에서 전체로, 다시 보기.</span>
            </Link>
            <div className="lg:col-span-5 lg:col-start-8">
              <p className="t-label t-mark text-[var(--c-mute)]">05 · Again experience</p>
              <h2 id="again-title" className="t-display t-mark mt-3">
                AGAIN
              </h2>
              <p className="t-lead kr mt-5">내 사진 위에 라기 제품을 올려, 일상 속에서 다시 보는 모습을 미리 봅니다.</p>
              <ol className="t-body kr mt-8 space-y-2">
                {['제품 선택', '사진 올리기 또는 촬영', '착용 방식 선택', 'AI 이미지 합성', '결과 저장 또는 다시 시도'].map((t, i) => (
                  <li key={t} className="rule-1 flex gap-4 pt-2">
                    <span className="t-label t-mark w-8 tabular-nums text-[var(--c-mute)]">{pad(i + 1)}</span>
                    {t}
                  </li>
                ))}
              </ol>
              <Link to="/again" className="t-nav tag tag-ink kr mt-8 px-5 py-3.5">
                AI 이미지 합성 시작
              </Link>
              <p className="t-caption kr mt-4 text-[var(--c-mute)]">결과는 AI가 만든 이미지로, 실제 제품의 크기·색과 다를 수 있습니다.</p>
            </div>
          </div>
        </section>
      )}

      {/* 06 ABOUT */}
      <section className="px-page pb-32 pt-28 lg:pb-44 lg:pt-44" aria-labelledby="about-title">
        <div className="grid grid-cols-1 gap-x-[var(--gap)] gap-y-6 lg:grid-cols-12">
          <p className="t-label t-mark text-[var(--c-mute)] lg:col-span-2">06 · About</p>
          <h2 id="about-title" className="t-h1 kr lg:col-span-9">
            라기는 리사이클링 제품을 발견하고, 선별하고, 소개하고, 연결하는 큐레이션 브랜드입니다.
          </h2>
        </div>
        <ul className="mt-14 grid grid-cols-1 gap-x-[var(--gap)] sm:grid-cols-2 lg:mt-20 lg:grid-cols-4">
          {ROLES.map((r) => (
            <li key={r.key} className="rule py-5">
              <p className="t-h3 t-mark">{r.key}</p>
              <p className="t-value kr mt-3">{r.kr}</p>
              <p className="t-body kr mt-1 text-[var(--c-mute)]">{r.text}</p>
            </li>
          ))}
        </ul>
        <Link to="/about" className="t-nav tag kr mt-8 bg-[var(--c-label)] px-4 py-3">
          브랜드 이야기
        </Link>
      </section>

      {film && <BrandFilmOverlay onClose={() => setFilm(false)} />}
    </div>
  );
}

/**
 * Editorial layout for the eight selected products: sizes and offsets differ from card to card,
 * but every card keeps the same reading order — number, name, price, then its own buy action.
 */
const LAYOUT = [
  'lg:col-span-7 aspect-[4/3]',
  'lg:col-span-4 lg:col-start-9 lg:mt-40 aspect-[3/4]',
  'lg:col-span-4 aspect-square',
  'lg:col-span-4 lg:mt-24 aspect-[3/4]',
  'lg:col-span-4 lg:mt-48 aspect-square',
  'lg:col-span-5 lg:col-start-2 aspect-[4/5]',
  'lg:col-span-5 lg:col-start-8 lg:mt-32 aspect-[4/3]',
  'lg:col-span-6 lg:col-start-4 aspect-[16/10]',
];
const MOBILE = ['col-span-2', 'col-span-1', 'col-span-1', 'col-span-2', 'col-span-1', 'col-span-1', 'col-span-2', 'col-span-2'];

function Selected({ products }: { products: Product[] }) {
  const { add } = useCart();
  const [added, setAdded] = useState<string | null>(null);
  const list = products.slice(0, 8);
  return (
    <section className="px-page pt-28 lg:pt-44" aria-labelledby="selected-title">
      <div className="rule grid grid-cols-1 gap-x-[var(--gap)] gap-y-4 pt-4 lg:grid-cols-12">
        <p className="t-label t-mark text-[var(--c-mute)] lg:col-span-2">03</p>
        <div className="flex flex-wrap items-end justify-between gap-6 lg:col-span-10">
          <div>
            <h2 id="selected-title" className="t-display t-mark">
              SELECTED
            </h2>
            <p className="t-lead kr mt-4 text-[var(--c-mute)]">라기가 고른 제품 {list.length}가지</p>
          </div>
          <Link to="/discover" className="t-nav tag kr bg-[var(--c-label)] px-4 py-3">
            전체 제품
          </Link>
        </div>
      </div>
      <ul className="mt-14 grid grid-cols-2 gap-x-[var(--gap)] gap-y-14 lg:mt-20 lg:grid-cols-12 lg:gap-y-24">
        {list.map((p, i) => {
          const cls = LAYOUT[i % LAYOUT.length].split(' ');
          const aspect = cls.find((c) => c.startsWith('aspect-'));
          const spans = cls.filter((c) => !c.startsWith('aspect-'));
          return (
            <li key={p.id} className={`${MOBILE[i % MOBILE.length]} ${spans.join(' ')}`}>
              <Link to={`/product/${p.id}`} className="group block">
                <div className={`overflow-hidden rounded-[var(--radius-card)] bg-[var(--c-gray)] ${aspect}`}>
                  <img src={p.images[0]} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
                </div>
                <span className="mt-3 flex items-baseline gap-3">
                  <span className="t-label t-mark tabular-nums text-[var(--c-mute)]">{pad(i + 1)}</span>
                  <span className="t-value kr">{p.name.value}</span>
                </span>
              </Link>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2 pl-8">
                <span className="t-caption kr tabular-nums text-[var(--c-mute)]">
                  {CATEGORY_LABEL[p.category.value ?? ''] ?? ''} · {price(p.price.value)}
                </span>
                <button
                  type="button"
                  className="t-caption kr tag bg-[var(--c-label)]"
                  onClick={() => {
                    add({ productId: p.id, variantId: null, size: null, color: null, quantity: 1, unitPrice: p.price.value, name: p.name.value, image: p.images[0] ?? null });
                    setAdded(p.id);
                  }}
                >
                  {added === p.id ? '담았습니다' : '장바구니 담기'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
