import { useEffect, useRef, useState } from 'react';
import { WHY_LAGI, WHY_LAGI_RULE } from '@/content/whyLagi';

/**
 * WHY LAGI (reference: Method). On wide screens the four criteria travel sideways as the page
 * scrolls, joined by a dashed line; on phones they stack. Copy is the brand's official wording.
 */
export default function Why() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(() => window.innerWidth >= 1200 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 1200 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!wide) return;
    const wrap = wrapRef.current;
    const track = trackRef.current;
    if (!wrap || !track) return;
    const distance = () => track.scrollWidth - window.innerWidth;
    setHeight(distance() + window.innerHeight);
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = wrap.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, -r.top / (r.height - window.innerHeight)));
        track.style.transform = `translate3d(${(-p * distance()).toFixed(1)}px,0,0)`;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [wide]);

  const intro = (
    <div className="w-full shrink-0 lg:w-[34vw]">
      <h1 className="t-display">왜 라기</h1>
      <p className="t-body mt-6 max-w-sm">라기가 제품을 고르는 네 가지 기준입니다.</p>
      <p className="t-body mt-2 max-w-sm font-semibold">{WHY_LAGI_RULE}</p>
    </div>
  );

  const steps = WHY_LAGI.map((c, i) => (
    <section key={c.key} className="relative w-full shrink-0 border-t border-[var(--c-ink)] pt-5 lg:w-[38vw] lg:border-0 lg:pt-0" style={wide ? { marginTop: `${[18, 2, 26, 8][i]}vh` } : undefined}>
      <p className="t-h3 text-[var(--c-blue)]">{String(i + 1).padStart(2, '0')}.</p>
      <h2 className="t-h2 mt-2">{c.key}</h2>
      <p className="t-body mt-5 max-w-md">{c.question}</p>
    </section>
  ));

  if (!wide)
    return (
      <div className="px-page pb-32 pt-page">
        {intro}
        <div className="mt-20 space-y-16">{steps}</div>
      </div>
    );

  return (
    <div ref={wrapRef} style={{ height: height ?? '300vh' }} className="relative">
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <div ref={trackRef} className="flex h-full items-start gap-[8vw] px-page pt-page will-change-transform" style={{ width: 'max-content' }}>
          {intro}
          {steps}
          <div className="w-[10vw] shrink-0" />
        </div>
        <svg className="pointer-events-none absolute inset-x-0 bottom-[14vh] h-24 w-full" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 70 C 150 10, 300 90, 450 50 S 750 10, 1000 60" fill="none" stroke="var(--c-ink)" strokeWidth="1" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
    </div>
  );
}
