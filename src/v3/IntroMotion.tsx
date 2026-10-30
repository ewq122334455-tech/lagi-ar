import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { EMBLEM_BODY, EMBLEM_CUTOUT, EMBLEM_VIEWBOX } from '@/components/logoPaths';

const SEEN = 'lagi-intro-seen';

/** Where each emblem piece flies in from (dx, dy in viewBox units, rotation) — spread around the mark. */
const FROM = [
  [-260, -180, -28],
  [220, -210, 24],
  [-300, 40, 18],
  [280, 60, -22],
  [-180, 260, 30],
  [200, 250, -16],
  [0, -300, 12],
  [-320, -60, -36],
  [320, -40, 32],
  [-60, 300, -20],
  [90, 320, 26],
];

// eslint-disable-next-line react-refresh/only-export-components
export function introSeen() {
  try {
    return sessionStorage.getItem(SEEN) === '1';
  } catch {
    return false;
  }
}

/**
 * The brand motion before the home page: on black, the eleven pieces of the LAGI emblem fly in and
 * assemble (the finished mark is the official emblem, unaltered), the L Λ G I letters cut in, the
 * line "LAGI in AGAIN" arrives, then a tap anywhere lifts the black sheet to reveal the home page.
 * Shown once per visit.
 */
export function IntroMotion({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const t = window.setTimeout(() => setReady(true), 2600);
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = '';
    };
  }, []);

  const enter = () => {
    if (leaving) return;
    setLeaving(true);
    try {
      sessionStorage.setItem(SEEN, '1');
    } catch {
      // private mode: the intro simply shows again next visit
    }
    window.setTimeout(onDone, 900);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        enter();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return createPortal(
    <div
      className={`v3 intro fixed inset-0 z-[400] flex cursor-pointer select-none flex-col items-center justify-center bg-[#0b0b0b] text-white ${leaving ? 'intro-leave' : ''}`}
      onClick={enter}
      role="button"
      tabIndex={0}
      aria-label="LAGI — 화면을 눌러 시작하세요"
      data-testid="intro"
    >
      <svg viewBox={EMBLEM_VIEWBOX} className="intro-mark h-[38vh] max-h-[340px] min-h-[180px] w-auto overflow-visible" aria-hidden="true">
        {EMBLEM_BODY.map((d, i) => {
          const [dx, dy, r] = FROM[i % FROM.length];
          return (
            <path
              key={d}
              d={d}
              fill="#1d5198"
              className="intro-piece"
              style={{ '--dx': `${dx}px`, '--dy': `${dy}px`, '--r': `${r}deg`, animationDelay: `${120 + i * 70}ms` } as React.CSSProperties}
            />
          );
        })}
        {/* The letters are cut out of the mark; on black, drawing them in the background colour is the same cut. */}
        {EMBLEM_CUTOUT.map((d, i) => (
          <path key={d} d={d} fill="#0b0b0b" className="intro-cut" style={{ animationDelay: `${1350 + i * 140}ms` }} />
        ))}
      </svg>
      <p className="t-h1 t-mark intro-line mt-8 text-white" style={{ animationDelay: '1900ms' }}>
        LAGI in AGAIN
      </p>
      <p className="t-caption kr intro-line mt-2 text-white/70" style={{ animationDelay: '2150ms' }}>
        다시 쓰임을 얻은 물건들을 발견하고 소개합니다
      </p>
      <p className={`t-label t-mark absolute bottom-10 text-white transition-opacity duration-700 ${ready ? 'intro-hint opacity-100' : 'opacity-0'}`}>
        화면을 눌러 시작하세요 · Click to enter
      </p>
    </div>,
    document.body,
  );
}
