import { Link } from 'react-router-dom';

/** "Again" in many languages — LAGI's own name means "again" in Malay/Indonesian. */
export const AGAIN_WORDS = [
  { word: 'lagi', lang: 'Bahasa' },
  { word: '다시', lang: '한국어' },
  { word: 'again', lang: 'English' },
  { word: 'encore', lang: 'Français' },
  { word: 'また', lang: '日本語' },
  { word: 'otra vez', lang: 'Español' },
  { word: '再', lang: '中文' },
  { word: 'wieder', lang: 'Deutsch' },
  { word: 'ancora', lang: 'Italiano' },
  { word: 'igen', lang: 'Svenska' },
] as const;

export function AgainMarquee() {
  const row = AGAIN_WORDS.map((w) => w.word);
  return (
    <Link
      to="/again"
      aria-label="다시(again) — LAGI의 의미 보러 가기"
      className="group block overflow-hidden border-y border-line bg-paper py-5 focus-ring"
    >
      <div className="animate-marquee flex w-max gap-10 whitespace-nowrap group-hover:[animation-play-state:paused]" aria-hidden="true">
        {[...row, ...row].map((w, i) => (
          <span key={i} className={`flex items-center gap-10 text-3xl text-graphite lg:text-4xl ${/^[\x00-\x7f ]+$/.test(w) ? 'italic' : 'font-semibold'}`}>
            {w}
            <span className="h-1.5 w-1.5 rounded-full bg-orange not-italic" />
          </span>
        ))}
      </div>
    </Link>
  );
}
