import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { letterAt, maskFor, motifOffset } from './discoverPath';

export interface DiscoverItem {
  id: string;
  name: string;
  price: number | null;
  image: string;
  /** Natural width / height of the photo — frames always keep it. */
  ratio: number;
}

// Frame widths as a share of the viewport — deliberately uneven so no two neighbours match.
const WIDTHS_DESKTOP = [0.27, 0.17, 0.31, 0.2, 0.24, 0.15, 0.29, 0.19];
const WIDTHS_MOBILE = [0.64, 0.5, 0.72, 0.54, 0.6, 0.46, 0.68, 0.52];

interface Layout {
  vw: number;
  vh: number;
  mobile: boolean;
  widths: number[];
  /** Track position of each frame's left edge, from the start of the run. */
  starts: number[];
  travel: number;
  amp: number;
  cycle: number;
  midY: number;
}

function computeLayout(count: number): Layout {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const mobile = vw < 768;
  const pattern = mobile ? WIDTHS_MOBILE : WIDTHS_DESKTOP;
  const gap = vw * (mobile ? 0.14 : 0.075);
  const widths = Array.from({ length: count }, (_, i) => pattern[i % pattern.length] * vw);
  const starts: number[] = [];
  let x = 0;
  for (const w of widths) {
    starts.push(x);
    x += w + gap;
  }
  const trackEnd = x - gap;
  return {
    vw,
    vh,
    mobile,
    widths,
    starts,
    // From "first frame just off the right edge" to "last frame just off the left edge".
    travel: trackEnd + vw,
    amp: vh * (mobile ? 0.11 : 0.12),
    cycle: vw * (mobile ? 2.2 : 1.25),
    midY: vh * (mobile ? 0.52 : 0.56),
  };
}

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/**
 * LAGI DISCOVER: products glide right-to-left along a line drawn from the L·Λ·G·I motif as the
 * page scrolls. The line stays put on screen; the photos travel along it, opening from behind a
 * motif-shaped mask as they arrive. Vertical scrolling drives it, so touch scrolling on phones
 * works the same way as a mouse wheel.
 */
export function DiscoverFlow({ items }: { items: DiscoverItem[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const frameRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const imgRefs = useRef<(HTMLImageElement | null)[]>([]);
  const maskRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const captionRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const counterRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useLayoutEffect(() => {
    const update = () => setLayout(computeLayout(items.length));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [items.length]);

  useEffect(() => {
    if (!layout || reduced) return;
    const section = sectionRef.current;
    if (!section) return;
    let current = 0;
    let raf = 0;
    let running = false;

    const target = () => {
      const r = section.getBoundingClientRect();
      return clamp(-r.top / (r.height - layout.vh));
    };

    const paint = (p: number) => {
      const { vw, widths, starts, travel, amp, cycle, midY } = layout;
      let nearest = 0;
      let nearestDist = Infinity;
      for (let i = 0; i < items.length; i++) {
        const el = frameRefs.current[i];
        if (!el) continue;
        const w = widths[i];
        const h = w / items[i].ratio;
        const left = vw + starts[i] - p * travel;
        const cx = left + w / 2;
        const y = midY + amp * motifOffset(cx / cycle + 0.15) - h / 2;
        // Opens over the first ~30% of the screen it crosses, from the right.
        const reveal = clamp((vw - left) / (vw * (layout.mobile ? 0.5 : 0.3)));
        el.style.transform = `translate3d(${left.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        const mask = maskRefs.current[i];
        if (mask) mask.style.clipPath = maskFor(letterAt(i), reveal);
        const cap = captionRefs.current[i];
        if (cap) cap.style.opacity = clamp((reveal - 0.6) / 0.4).toFixed(3);
        el.style.visibility = left > vw + 40 || left + w < -40 ? 'hidden' : 'visible';
        const img = imgRefs.current[i];
        // A slight counter-drift inside the frame gives depth without scaling the product.
        if (img) img.style.transform = `translate3d(${((cx - vw / 2) * -0.035).toFixed(1)}px, 0, 0)`;
        const d = Math.abs(cx - vw / 2);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = i;
        }
      }
      if (counterRef.current)
        counterRef.current.textContent = `${String(nearest + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;
      if (barRef.current) barRef.current.style.transform = `scaleX(${p.toFixed(4)})`;
    };

    const tick = () => {
      const t = target();
      // Eased follow: the flow trails the scroll a little and settles, rather than snapping.
      current += (t - current) * 0.085;
      if (Math.abs(t - current) < 0.00005) current = t;
      paint(current);
      raf = running ? requestAnimationFrame(tick) : 0;
    };

    current = target();
    paint(current);
    const io = new IntersectionObserver(([e]) => {
      running = e.isIntersecting;
      if (running && !raf) raf = requestAnimationFrame(tick);
    });
    io.observe(section);
    return () => {
      io.disconnect();
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [layout, items, reduced]);

  if (reduced) {
    // Motion off: a plain swipeable row, same photos and links.
    return (
      <section id="discover" aria-label="DISCOVER" className="px-5 py-24 lg:px-12">
        <DiscoverHeading />
        <ul className="no-scrollbar mt-10 flex snap-x gap-6 overflow-x-auto">
          {items.map((it, i) => (
            <li key={it.id} className="w-[64vw] shrink-0 snap-start md:w-[26vw]">
              <Link to={`/product/${it.id}`} className="block focus-ring">
                <img src={it.image} alt={it.name} style={{ aspectRatio: it.ratio }} className="w-full object-cover" />
                <Caption index={i} item={it} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  const pathD = layout ? buildPath(layout) : '';

  return (
    <section
      id="discover"
      ref={sectionRef}
      aria-label="DISCOVER"
      style={{ height: layout ? layout.travel + layout.vh : '300vh' }}
      className="relative"
    >
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between px-5 pt-20 lg:px-12 lg:pt-24">
          <DiscoverHeading />
          <span ref={counterRef} className="font-display text-sm tracking-[0.2em] text-ink/60 tabular-nums">
            01 / {String(items.length).padStart(2, '0')}
          </span>
        </div>

        {layout && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${layout.vw} ${layout.vh}`} aria-hidden="true">
            <path d={pathD} fill="none" stroke="currentColor" strokeWidth="1" className="text-ink/15" />
          </svg>
        )}

        {layout &&
          items.map((it, i) => {
            const w = layout.widths[i];
            return (
              <Link
                key={it.id}
                to={`/product/${it.id}`}
                ref={(el) => {
                  frameRefs.current[i] = el;
                }}
                aria-label={`${it.name} 자세히 보기`}
                className="group absolute left-0 top-0 block will-change-transform focus-ring"
                style={{ width: w, visibility: 'hidden' }}
              >
                <span
                  ref={(el) => {
                    maskRefs.current[i] = el;
                  }}
                  className="block overflow-hidden bg-mist"
                  style={{ aspectRatio: it.ratio }}
                >
                  <img
                    ref={(el) => {
                      imgRefs.current[i] = el;
                    }}
                    src={it.image}
                    alt=""
                    draggable={false}
                    className="h-full w-[108%] max-w-none object-cover transition-[filter] duration-500 group-hover:brightness-[1.04]"
                    style={{ marginLeft: '-4%' }}
                  />
                </span>
                <span
                  ref={(el) => {
                    captionRefs.current[i] = el;
                  }}
                  className="block"
                >
                  <Caption index={i} item={it} />
                </span>
              </Link>
            );
          })}

        <div className="absolute inset-x-5 bottom-8 h-px bg-ink/10 lg:inset-x-12">
          <span ref={barRef} className="absolute inset-0 origin-left bg-ink" style={{ transform: 'scaleX(0)' }} />
        </div>
        <p className="absolute bottom-12 left-5 text-[11px] tracking-[0.2em] text-ink/50 lg:left-12">SCROLL TO DISCOVER</p>
      </div>
    </section>
  );
}

function DiscoverHeading() {
  return (
    <div>
      <p className="text-[11px] tracking-[0.3em] text-ink/50">02</p>
      <h2 className="mt-2 font-display text-3xl tracking-[0.02em] lg:text-5xl">DISCOVER</h2>
    </div>
  );
}

function Caption({ index, item }: { index: number; item: DiscoverItem }) {
  return (
    <span className="mt-3 flex items-baseline justify-between gap-3 text-[12px] lg:text-[13px]">
      <span className="flex items-baseline gap-3">
        <span className="tabular-nums text-ink/40">{String(index + 1).padStart(2, '0')}</span>
        <span className="font-medium text-ink">{item.name}</span>
      </span>
      {item.price != null && <span className="shrink-0 tabular-nums text-ink/60">{item.price.toLocaleString('ko-KR')}</span>}
    </span>
  );
}

/** The motif line across the screen, sampled — the frames' centres ride on it. */
function buildPath(l: Layout) {
  const pts: string[] = [];
  for (let x = -20; x <= l.vw + 20; x += 6) {
    const y = l.midY + l.amp * motifOffset(x / l.cycle + 0.15);
    pts.push(`${pts.length ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return pts.join(' ');
}
