import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const BASE = import.meta.env.BASE_URL;
/** Swap public/media/brand-film.mp4 (and its poster) for the brand film — nothing else changes. */
export const FILM_SRC = `${BASE}media/brand-film.mp4`;
/** Same film as WebM, for browsers without H.264. */
export const FILM_WEBM = `${BASE}media/brand-film.webm`;
export const FILM_POSTER = `${BASE}media/brand-film-poster.jpg`;

function useFilmControls() {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => undefined);
    else v.pause();
  };
  const toggleSound = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };
  const bind = { ref, onPlay: () => setPlaying(true), onPause: () => setPlaying(false) };
  return { ref, playing, muted, toggle, toggleSound, bind };
}

function Controls({ playing, muted, toggle, toggleSound }: { playing: boolean; muted: boolean; toggle: () => void; toggleSound: () => void }) {
  return (
    <div className="t-nav kr flex gap-1">
      <button type="button" onClick={toggle} className="tag tag-ink">
        {playing ? '일시정지' : '재생'}
      </button>
      <button type="button" onClick={toggleSound} className="tag bg-[var(--c-white)]">
        {muted ? '소리 켜기' : '소리 끄기'}
      </button>
    </div>
  );
}

/** The brand film as a page section: plays muted while on screen, pauses when scrolled away. */
export function BrandFilmSection() {
  const f = useFilmControls();
  useEffect(() => {
    const v = f.ref.current;
    if (!v || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? v.play().catch(() => undefined) : v.pause()), { threshold: 0.4 });
    io.observe(v);
    return () => io.disconnect();
  }, [f.ref]);
  return (
    <section id="film" aria-label="브랜드 영상" className="px-page">
      <div className="rule flex items-baseline justify-between pt-4">
        <h2 className="t-label t-mark">LAGI FILM</h2>
        <Controls {...f} />
      </div>
      <video
        {...f.bind}
        poster={FILM_POSTER}
        muted
        loop
        playsInline
        preload="metadata"
        className="mt-4 block aspect-video w-full rounded-[var(--radius-card)] bg-[var(--c-ink)] object-cover"
      >
        <source src={FILM_WEBM} type="video/webm" />
        <source src={FILM_SRC} type="video/mp4" />
      </video>
    </section>
  );
}

/** Full-screen film player opened from the home page. */
export function BrandFilmOverlay({ onClose }: { onClose: () => void }) {
  const f = useFilmControls();
  useEffect(() => {
    f.ref.current?.play().catch(() => undefined);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [f.ref, onClose]);
  // Rendered at the top of the document (inside a .v3 wrapper for the tokens) so it covers the site header.
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="브랜드 영상" className="v3 fixed inset-0 z-[200] flex flex-col bg-[var(--c-ink)] px-page pb-5 pt-5">
      <div className="flex items-center justify-between">
        <p className="t-label t-mark text-[var(--c-white)]">LAGI FILM</p>
        <div className="flex gap-1">
          <Controls {...f} />
          <button type="button" onClick={onClose} className="t-nav tag bg-[var(--c-white)]" autoFocus>
            닫기
          </button>
        </div>
      </div>
      <video {...f.bind} poster={FILM_POSTER} muted loop playsInline className="mt-5 min-h-0 w-full flex-1 object-contain">
        <source src={FILM_WEBM} type="video/webm" />
        <source src={FILM_SRC} type="video/mp4" />
      </video>
    </div>,
    document.body,
  );
}
