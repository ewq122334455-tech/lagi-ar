import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FILM_POSTER, FILM_SRC, FILM_WEBM } from './BrandFilm';

const SEEN = 'lagi-intro-seen';

// eslint-disable-next-line react-refresh/only-export-components
export function introSeen() {
  try {
    return sessionStorage.getItem(SEEN) === '1';
  } catch {
    return false;
  }
}

/**
 * The brand film before the home page. It plays on its own (muted, as browsers require), full screen on the brand blue,
 * and one click (or Enter / Space / Esc) lifts it away and opens the site. Shown once per visit. The same film file is
 * used on the ABOUT page, so it is already in the cache by then.
 */
export function IntroMotion({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const [hint, setHint] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const t = window.setTimeout(() => setHint(true), 1200);
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    // Visitors who asked for less motion get the still frame; everyone else gets the film.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    v.play().catch(() => undefined);
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
      className={`v3 intro fixed inset-0 z-[400] flex cursor-pointer select-none items-center justify-center bg-[var(--c-blue)] ${leaving ? 'intro-leave' : ''}`}
      onClick={enter}
      role="button"
      tabIndex={0}
      aria-label="LAGI — 화면을 눌러 사이트로 들어가세요"
      data-testid="intro"
    >
      <video ref={video} poster={FILM_POSTER} muted playsInline autoPlay preload="auto" className="absolute inset-0 h-full w-full object-cover" data-testid="intro-film">
        <source src={FILM_WEBM} type="video/webm" />
        <source src={FILM_SRC} type="video/mp4" />
      </video>
      <p className={`t-label t-mark absolute bottom-8 rounded-full border border-white/70 bg-[var(--c-blue)] px-5 py-2 text-white shadow-[0_0_0_6px_rgba(255,255,255,0.18)] transition-opacity duration-700 ${hint ? 'intro-hint opacity-100' : 'opacity-0'}`}>Click to enter</p>
    </div>,
    document.body,
  );
}
