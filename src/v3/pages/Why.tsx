import { WHY_LAGI } from '@/content/whyLagi';

/** One colour per criterion, taken from LAGI's printed cards: blue, orange, lilac, green. */
const COLOR = ['#1d5198', '#d9652a', '#a97fa3', '#6c8e3d'];

/**
 * WHY LAGI: a wide photo strip, the line from LAGI's cards, and the four selection criteria as four cards
 * (a colour bar, the criterion, the question). Nothing else.
 */
export default function Why() {
  return (
    <div className="px-page pb-[var(--section)] pt-page">
      <h1 className="sr-only">Why LAGI</h1>

      <figure className="-mx-[var(--page-x)] overflow-hidden" data-testid="why-photo">
        <img
          src="media/why-strip-4000.jpg"
          srcSet="media/why-strip-1600.jpg 1600w, media/why-strip-4000.jpg 4000w"
          sizes="100vw"
          alt="LAGI 제품을 입은 모습 — 토트백, 그래픽 티, 점퍼"
          className="block h-[42svh] w-full object-cover object-center md:h-[50svh]"
          width={4000}
          height={1600}
        />
      </figure>

      <p className="t-mark mt-[clamp(64px,9vw,128px)] text-center text-[clamp(18px,1.8vw,24px)] font-bold">Look again, find another reason.</p>

      <ul className="mx-auto mt-[clamp(40px,6vw,80px)] grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5" data-testid="why-list">
        {WHY_LAGI.map((c, i) => (
          <li
            key={c.key}
            className="relative flex min-h-[180px] flex-col justify-between overflow-hidden rounded-[var(--radius-card)] border border-black/10 bg-white p-6 shadow-[0_8px_28px_rgba(29,81,152,0.07)] transition-transform duration-300 hover:-translate-y-1 md:min-h-[220px] md:p-8"
            data-testid="why-card"
          >
            <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5" style={{ background: COLOR[i % COLOR.length] }} />
            <h2 className="t-mark text-[clamp(18px,1.7vw,22px)] font-bold" style={{ color: COLOR[i % COLOR.length] }}>
              {c.key}
            </h2>
            <p className="kr mt-8 text-[16px] font-medium leading-[1.75]">{c.question}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
