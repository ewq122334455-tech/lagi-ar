import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Motif } from '@/components/Motif';

const BASE = import.meta.env.BASE_URL;
/** Swap public/media/hero.mp4 (and poster.jpg) for the brand film; nothing else needs to change. */
const VIDEO = `${BASE}media/hero.mp4`;
const POSTER = `${BASE}media/poster.jpg`;

/** Full-bleed brand video at the top of the home page, with the intro copy arriving one piece at a time. */
export function HeroVideo({ tryOnId }: { tryOnId: string | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      v.pause();
      setPlaying(false);
    }
  }, []);

  function toggle() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => undefined);
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }

  const step = (n: number) => ({ animationDelay: `${250 + n * 140}ms` });
  const rise = 'animate-[lagi-rise_0.9s_cubic-bezier(.2,.7,.2,1)_both]';
  const pop = 'animate-[lagi-pop_0.8s_cubic-bezier(.2,.7,.2,1)_both]';

  return (
    <section className="relative isolate h-[78svh] min-h-[480px] w-full overflow-hidden bg-ink text-paper lg:h-[86vh]">
      <video
        ref={videoRef}
        className="absolute inset-0 -z-10 h-full w-full animate-[lagi-fade_1.2s_ease-out_both] object-cover object-[64%_50%] lg:object-center"
        src={VIDEO}
        poster={POSTER}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/20 to-black/5 lg:bg-gradient-to-r lg:from-black/60 lg:via-black/10 lg:to-transparent" />

      {/* A motif drops in beside the headline */}
      <Motif index={9} color="#F7F6F2" className={`absolute left-5 top-8 h-7 w-auto lg:left-12 lg:top-12 lg:h-9 ${pop}`} />

      <div className="absolute inset-x-0 bottom-0 px-5 pb-10 lg:px-12 lg:pb-16">
        <p className={`text-[11px] font-bold tracking-[0.3em] text-paper/80 ${rise}`} style={step(0)}>
          LAGI — LOOK CLOSER, AGAIN
        </p>
        <h1 className="mt-4 font-display text-[15vw] leading-[0.9] tracking-[-0.02em] sm:text-8xl lg:text-[132px]" aria-label="LAGI IN AGING">
          <span className={`block ${rise}`} style={step(1)}>
            LAGI
          </span>
          <span className={`block ${rise}`} style={step(2)}>
            IN AGING
          </span>
        </h1>
        <p className={`mt-5 max-w-md text-sm text-paper/85 lg:text-base ${rise}`} style={step(3)}>
          시간이 쌓일수록 멋이 드는 것들. 쓰임을 다한 재료는 가방으로, 매일의 옷은 오래 입는 기본으로.
        </p>
        <div className={`mt-7 flex flex-wrap gap-2.5 ${rise}`} style={step(4)}>
          <Link to="/products" className="rounded-full bg-paper px-6 py-3.5 text-sm font-bold text-ink transition-transform hover:-translate-y-0.5 focus-ring">
            전체 상품 보기
          </Link>
          {tryOnId && (
            <Link
              to={`/ai-fit/${tryOnId}`}
              className="rounded-full border border-paper/70 px-6 py-3.5 text-sm font-bold backdrop-blur transition-colors hover:bg-paper/10 focus-ring"
            >
              ✦ AI 피팅 해보기
            </Link>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? '영상 일시정지' : '영상 재생'}
        className="absolute right-4 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-paper/50 text-paper backdrop-blur hover:bg-paper/10 focus-ring lg:bottom-16 lg:right-12 lg:top-auto lg:h-11 lg:w-11"
      >
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
            <rect x="2" y="1" width="3.5" height="12" rx="1" />
            <rect x="8.5" y="1" width="3.5" height="12" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
            <path d="M3 1.5v11l9-5.5z" />
          </svg>
        )}
      </button>
    </section>
  );
}
