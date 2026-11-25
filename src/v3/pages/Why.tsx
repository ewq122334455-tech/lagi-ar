import { WHY_LAGI } from '@/content/whyLagi';

/** One dot of colour per criterion, taken from LAGI's printed cards (the photo): blue, orange, lilac, green. */
const DOT = ['#1d5198', '#d9652a', '#a97fa3', '#6c8e3d'];

/**
 * WHY LAGI, kept empty on purpose: the brand card photo, the line printed on those cards, and the four selection
 * criteria as plain text. Nothing else.
 */
export default function Why() {
  return (
    <div className="px-page pb-[var(--section)] pt-page">
      <h1 className="sr-only">Why LAGI</h1>

      <figure className="-mx-[var(--page-x)] overflow-hidden" data-testid="why-photo">
        <img
          src="media/why-lagi.jpg"
          srcSet="media/why-lagi-1000.jpg 1000w, media/why-lagi.jpg 2000w, media/why-lagi-4000.jpg 4000w"
          sizes="100vw"
          alt="LAGI 명함과 카드 — LOOK AGAIN, FIND ANOTHER REASON"
          className="block h-[42svh] w-full object-cover object-[50%_55%] md:h-[58svh]"
          width={2000}
          height={1125}
        />
      </figure>

      <p className="t-mark mt-[clamp(72px,10vw,144px)] text-center text-[clamp(18px,1.8vw,24px)] font-bold">Look again, find another reason.</p>

      <ul className="mx-auto mt-[clamp(56px,8vw,112px)] grid max-w-4xl grid-cols-1 gap-x-16 gap-y-12 sm:grid-cols-2" data-testid="why-list">
        {WHY_LAGI.map((c, i) => (
          <li key={c.key}>
            <h2 className="t-mark flex items-center gap-2.5 text-[15px] font-bold">
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: DOT[i % DOT.length] }} />
              {c.key}
            </h2>
            <p className="kr mt-3 text-[15px] leading-[1.8] text-[var(--c-mute)]">{c.question}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
