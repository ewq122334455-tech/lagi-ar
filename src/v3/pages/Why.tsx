import { useEffect, useRef, useState } from 'react';
import { WHY_LAGI, WHY_LAGI_RULE } from '@/content/whyLagi';

/** The three questions the whole site answers. */
const QUESTIONS = [
  { q: 'WHY LAGI?', a: '다시 볼 이유가 있는 리사이클링 제품만 골라 소개합니다.' },
  { q: 'WHY DID LAGI SELECT THIS?', a: '아래 네 가지 기준을 모두 충족했기 때문입니다.' },
  { q: 'WHAT VALUE DOES LAGI GIVE?', a: '익숙한 제품에서 새로운 가치와 가능성을 다시 발견하게 합니다.' },
];

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
      <h1 className="t-display t-mark">WHY LAGI</h1>
      <p className="t-en mt-6 max-w-sm">Four criteria. Every product meets all four.</p>
      <p className="t-kr-sub mt-3 max-w-sm">라기가 모든 제품을 고르는 네 가지 기준입니다. {WHY_LAGI_RULE}</p>
      <dl className="mt-10 max-w-sm space-y-4">
        {QUESTIONS.map((x) => (
          <div key={x.q} className="rule-1 pt-3">
            <dt className="t-label t-mark">{x.q}</dt>
            <dd className="t-caption kr mt-1 text-[var(--c-mute)]">{x.a}</dd>
          </div>
        ))}
      </dl>
    </div>
  );

  const steps = WHY_LAGI.map((c, i) => (
    <section key={c.key} className="relative w-full shrink-0 border-t border-[var(--c-ink)] pt-5 lg:w-[38vw] lg:border-0 lg:pt-0" style={wide ? { marginTop: `${[18, 2, 26, 8][i]}vh` } : undefined}>
      <p className="t-h3 t-mark text-[var(--c-blue)]">{String(i + 1).padStart(2, '0')}.</p>
      <h2 className="t-h2 t-mark mt-2">{c.key}</h2>
      <p className="t-lead kr mt-5 max-w-md">{c.question}</p>
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
