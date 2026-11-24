import { Link } from 'react-router-dom';
import { LagiLogo } from '@/components/LagiLogo';
import { WHY_LAGI, WHY_LAGI_RULE, WHY_LAGI_RULE_EN } from '@/content/whyLagi';

/** Colours taken from LAGI's own printed cards (the photo at the top): blue, orange, lilac, green. */
const TILE = ['#1d5198', '#d9652a', '#a97fa3', '#6c8e3d'];

/**
 * WHY LAGI. The brand's printed cards set the mood (one wide photo), the line printed on them is the headline,
 * and the four selection criteria are four coloured cards in the same palette. No numbering, no scrolling tricks.
 */
export default function Why() {
  return (
    <div className="px-page pb-[var(--section)] pt-page">
      <h1 className="sr-only">Why LAGI</h1>

      <figure className="-mx-[var(--page-x)] overflow-hidden" data-testid="why-photo">
        <img
          src="media/why-lagi.jpg"
          srcSet="media/why-lagi-1000.jpg 1000w, media/why-lagi.jpg 2000w"
          sizes="100vw"
          alt="LAGI 명함과 카드 — LOOK AGAIN, FIND ANOTHER REASON"
          className="block h-[46svh] w-full object-cover object-[50%_55%] md:h-[64svh]"
          width={2000}
          height={1125}
        />
      </figure>

      <div className="mx-auto mt-[clamp(56px,8vw,112px)] max-w-6xl">
        <div className="grid grid-cols-1 items-end gap-6 md:grid-cols-[1fr_auto]">
          <p className="t-mark text-[clamp(30px,4.6vw,64px)] font-bold leading-[1.02]">
            Look again,
            <br />
            find another reason.
          </p>
          <p className="t-caption md:text-right">
            <span className="t-mark block font-bold">{WHY_LAGI_RULE_EN}</span>
            <span className="kr mt-1 block opacity-70">{WHY_LAGI_RULE}</span>
          </p>
        </div>

        <ul className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 md:mt-16 md:gap-4" data-testid="why-list">
          {WHY_LAGI.map((c, i) => (
            <li
              key={c.key}
              className="relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-[var(--radius-card)] p-6 text-white md:min-h-[300px] md:p-9"
              style={{ background: TILE[i % TILE.length] }}
            >
              {/* The emblem, large and cut off by the card edge, like on the printed cards. */}
              <LagiLogo className="pointer-events-none absolute -bottom-[18%] -right-[8%] h-[78%] w-auto text-white opacity-[0.14]" title="" />
              <h2 className="t-mark relative text-[clamp(22px,2.4vw,34px)] font-bold leading-tight">{c.key}</h2>
              <p className="kr relative mt-10 max-w-[30ch] text-[16px] font-medium leading-[1.7] md:text-[17px]">{c.question}</p>
            </li>
          ))}
        </ul>

        <p className="mt-14 text-center">
          <Link to="/discover" className="t-label t-mark hit underline underline-offset-4">
            Shop the selection
          </Link>
        </p>
      </div>
    </div>
  );
}
