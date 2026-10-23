import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Product } from '@/data/productTypes';
import { price } from './data';

/**
 * LAGI curved gallery. Products sit on one chain that runs from the bottom-left (near, large) to
 * the top-right (far, small); the front product links to its page.
 *
 * Two ways to drive it:
 * - 'scroll' (home): the section is tall and its stage sticks to the screen; ordinary page
 *   scrolling moves the chain, so the page is never hijacked. Buttons and arrow keys scroll to a product.
 * - 'stage': a one-screen stage driven by wheel, drag, swipe and arrow keys.
 *
 * Differences from the reference on purpose (docs/rebuild/03-design-system.md):
 * - DOM links + CSS transforms instead of WebGL, so every product is a real, focusable link;
 * - no 3D tilt — photos are only moved, uniformly scaled and turned a few degrees, never skewed;
 * - CROP: a product further back is cut by a LAGI motif-shaped mask that opens fully at the front.
 */

interface Geometry {
  vw: number;
  vh: number;
  mobile: boolean;
  frontW: number;
  cx: number;
  cy: number;
  spanX: number;
  spanY: number;
}

function geometry(): Geometry {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const mobile = vw < 810;
  return mobile
    ? { vw, vh, mobile, frontW: Math.min(vw * 0.78, vh * 0.46), cx: vw * 0.46, cy: vh * 0.5, spanX: vw * 0.62, spanY: vh * 0.42 }
    : { vw, vh, mobile, frontW: Math.min(vw * 0.34, vh * 0.58), cx: vw * 0.45, cy: vh * 0.45, spanX: vw * 0.62, spanY: vh * 0.42 };
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Where a card sits for its distance `d` from the front (0 = front, +1 = next back, −1 = just passed). */
function place(d: number, g: Geometry) {
  const u = 1 - Math.exp(-0.5 * d); // eases toward the far end, runs off quickly toward the viewer
  const x = g.cx + g.spanX * u;
  const y = g.cy - g.spanY * u + g.vh * 0.07 * u * u; // a slight bow, so the chain reads as a curve
  // Behind the front: shrinks with distance. Passed the front: grows only gently as it leaves.
  const s = d >= 0 ? 1 / (1 + 0.42 * d) : 1 - 0.3 * d;
  const rot = -1.5 - 1.6 * u;
  return { x, y, s, rot };
}

/** CROP: motif-shaped mask, fully open at the front and closing as the card recedes. */
function crop(d: number, i: number) {
  const k = clamp(d / 3, 0, 1) * 0.34;
  if (k <= 0.001) return 'none';
  const p = (v: number) => `${(v * 100).toFixed(2)}%`;
  switch (i % 4) {
    case 0: // L — the open top-right corner
      return `polygon(0 0, ${p(1 - k)} 0, ${p(1 - k)} ${p(k)}, 100% ${p(k)}, 100% 100%, 0 100%)`;
    case 1: // Λ — a sheared top-left corner
      return `polygon(${p(k)} 0, 100% 0, 100% 100%, 0 100%, 0 ${p(k * 1.3)})`;
    case 2: // G — one rounded corner
      return `inset(0 0 0 0 round 0 0 0 ${p(k * 1.4)})`;
    default: // I — trimmed to an upright block
      return `inset(${p(k * 0.5)} ${p(k * 0.5)} ${p(k * 0.5)} ${p(k * 0.5)})`;
  }
}

export function CurvedGallery({
  products,
  ratios,
  mode = 'stage',
}: {
  products: Product[];
  ratios: Record<string, number>;
  mode?: 'stage' | 'scroll';
}) {
  const n = products.length;
  const scrollMode = mode === 'scroll';
  const sectionRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const pos = useRef(0);
  const target = useRef(0);
  const snapTimer = useRef(0);
  const drag = useRef<{ x: number; y: number; start: number; moved: boolean; lastX: number; lastY: number; lastT: number; v: number } | null>(null);
  const [g, setG] = useState<Geometry | null>(null);
  const [front, setFront] = useState(0);
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  // Opening a product: the chain first brings it to the front, then it grows into the page.
  const opening = useRef<{ i: number; phase: 'travel' | 'zoom'; t: number; done?: boolean } | null>(null);
  const [zooming, setZooming] = useState(false);

  useLayoutEffect(() => {
    const update = () => setG(geometry());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const scheduleSnap = useCallback(() => {
    window.clearTimeout(snapTimer.current);
    snapTimer.current = window.setTimeout(() => {
      if (!drag.current) target.current = Math.round(target.current);
    }, 160);
  }, []);

  const step = useCallback(
    (delta: number) => {
      const sec = sectionRef.current;
      if (scrollMode && sec) {
        // Scroll the page to the product instead of moving the chain behind the scroll's back.
        const i = clamp(Math.round(target.current) + delta, 0, n - 1);
        const top = sec.getBoundingClientRect().top + window.scrollY;
        const range = sec.offsetHeight - window.innerHeight;
        window.scrollTo({ top: top + (range * i) / Math.max(1, n - 1), behavior: reduced ? 'auto' : 'smooth' });
        return;
      }
      target.current = Math.round(target.current) + delta;
      if (reduced) pos.current = target.current;
    },
    [reduced, scrollMode, n],
  );

  // Render loop: the chain eases after the target, then rests.
  useEffect(() => {
    if (!g || n === 0) return;
    let raf = 0;
    let lastFront = -1;
    const paint = () => {
      const sec = sectionRef.current;
      if (scrollMode && sec && !opening.current) {
        const r = sec.getBoundingClientRect();
        const p = clamp(-r.top / Math.max(1, r.height - g.vh), 0, 1);
        target.current = p * (n - 1);
      }
      pos.current = reduced ? target.current : pos.current + (target.current - pos.current) * (opening.current ? 0.14 : 0.09);
      if (Math.abs(target.current - pos.current) < 0.0005) pos.current = target.current;
      const op = opening.current;
      const now = performance.now();
      if (op?.phase === 'travel' && (Math.abs(target.current - pos.current) < 0.01 || now - op.t > 1100)) {
        op.phase = 'zoom';
        op.t = now;
        setZooming(true);
      }
      // Zoom phase: 0 → 1 over 560ms (ease-in-out).
      const zr = op?.phase === 'zoom' ? clamp((now - op.t) / 560, 0, 1) : 0;
      const z = zr < 0.5 ? 2 * zr * zr : 1 - (-2 * zr + 2) ** 2 / 2;
      if (op?.phase === 'zoom' && zr >= 1 && !op.done) {
        op.done = true;
        try {
          sessionStorage.setItem('lagi-opened', products[op.i].id);
        } catch {
          // fine without the entrance hand-off
        }
        navigate(`/product/${products[op.i].id}`);
      }
      for (let i = 0; i < n; i++) {
        const el = cardRefs.current[i];
        if (!el) continue;
        let d = (((i - pos.current + 2) % n) + n) % n - 2; // wrap: the chain is endless
        if (n <= 3) d = i - pos.current;
        const pl = place(d, g);
        let { x, y, s, rot } = pl;
        let fade = 1;
        if (op?.phase === 'zoom') {
          if (i === op.i) {
            // The chosen product grows toward the centre, straightening as it comes.
            x += (g.vw / 2 - x) * z;
            y += (g.vh * 0.56 - y) * z;
            s *= 1 + (g.mobile ? 0.18 : 0.42) * z;
            rot *= 1 - z;
          } else fade = 1 - z;
        }
        const visible = d > -1.6 && d < 5.6;
        el.style.visibility = visible ? 'visible' : 'hidden';
        if (!visible) continue;
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) rotate(${rot.toFixed(2)}deg) scale(${s.toFixed(4)})`;
        el.style.zIndex = String(100 - Math.round(d * 10));
        el.style.opacity = String(clamp(d > 0 ? (5.6 - d) / 1.2 : (d + 1.6) / 0.5, 0, 1) * fade);
        if (op?.phase === 'zoom' && i === op.i) el.style.zIndex = '140';
        const img = el.firstElementChild as HTMLElement | null;
        if (img) img.style.clipPath = op?.phase === 'zoom' && i === op.i ? 'none' : crop(d, i);
      }
      const f = ((Math.round(pos.current) % n) + n) % n;
      if (f !== lastFront) {
        lastFront = f;
        setFront(f);
      }
      raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [g, n, reduced, navigate, products, scrollMode]);

  const open = (i: number) => {
    if (opening.current) return;
    if (reduced) {
      navigate(`/product/${products[i].id}`);
      return;
    }
    window.clearTimeout(snapTimer.current);
    bringToFront(i);
    opening.current = { i, phase: 'travel', t: performance.now() };
  };

  // Wheel and trackpad.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || scrollMode) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (opening.current) return;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
      const delta = (Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * unit;
      if (reduced) {
        if (Math.abs(delta) > 4) step(Math.sign(delta));
        return;
      }
      target.current += delta * 0.0022;
      scheduleSnap();
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [reduced, scheduleSnap, step, scrollMode]);

  // Drag (mouse) and swipe (touch/pen) through pointer events.
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || opening.current || scrollMode) return;
    drag.current = { x: e.clientX, y: e.clientY, start: target.current, moved: false, lastX: e.clientX, lastY: e.clientY, lastT: performance.now(), v: 0 };
    window.clearTimeout(snapTimer.current);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const dr = drag.current;
    if (!dr || !g) return;
    const dx = e.clientX - dr.x;
    const dy = e.clientY - dr.y;
    if (!dr.moved && Math.hypot(dx, dy) > 6) {
      dr.moved = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    if (!dr.moved) return;
    // Pulling left or up brings the next product forward (same direction as scrolling down).
    const unit = g.mobile ? g.vw * 0.55 : g.vw * 0.3;
    target.current = dr.start + (-dx - dy) / unit;
    const now = performance.now();
    const dt = Math.max(1, now - dr.lastT);
    dr.v = ((-(e.clientX - dr.lastX) - (e.clientY - dr.lastY)) / unit / dt) * 1000;
    dr.lastX = e.clientX;
    dr.lastY = e.clientY;
    dr.lastT = now;
  };
  const onPointerUp = () => {
    const dr = drag.current;
    if (dr?.moved) {
      target.current = Math.round(target.current + clamp(dr.v * 0.18, -2, 2));
      window.setTimeout(() => (drag.current = null), 0); // let the click handler see `moved`
    } else drag.current = null;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (['ArrowRight', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      step(1);
    } else if (['ArrowLeft', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      step(-1);
    }
  };

  const bringToFront = (i: number) => {
    const cur = Math.round(target.current);
    const off = ((((i - cur) % n) + n + Math.floor(n / 2)) % n) - Math.floor(n / 2);
    target.current = cur + off;
  };

  const current = products[front];

  const stage = (
    <div
      ref={stageRef}
      className={`relative h-full w-full select-none ${scrollMode ? '' : 'touch-none'}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      role="region"
      aria-roledescription="gallery"
      aria-label={scrollMode ? 'LAGI 제품 갤러리 — 스크롤하거나 화살표 키로 넘겨 보세요' : 'LAGI 제품 갤러리 — 스크롤, 드래그, 화살표 키로 넘겨 보세요'}
    >
      {g &&
        products.map((p, i) => (
          <Link
            key={p.id}
            to={`/product/${p.id}`}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            draggable={false}
            onFocus={() => (scrollMode ? undefined : bringToFront(i))}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // new tab / window: leave it to the browser
              e.preventDefault();
              if (!drag.current?.moved) open(i);
            }}
            aria-label={`${p.name.value}, ${price(p.price.value)}`}
            className="absolute left-0 top-0 block will-change-transform"
            style={{ width: g.frontW, visibility: 'hidden' }}
          >
            <img
              src={p.images[0]}
              alt=""
              draggable={false}
              className="block w-full bg-[var(--c-white)] object-cover"
              style={{ aspectRatio: ratios[p.id] ?? 1 }}
            />
          </Link>
        ))}

      {/* While a product opens, everything but the photo steps back. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[130] bg-[var(--c-white)] transition-opacity duration-[560ms] ease-[cubic-bezier(.65,0,.35,1)]"
        style={{ opacity: zooming ? 0.92 : 0 }}
      />
      {current && (
        <div
          className={`pointer-events-none absolute z-[120] w-[min(320px,60vw)] ${
            scrollMode
              ? 'bottom-6 right-[var(--page-x)] bg-[rgba(241,241,241,0.92)] p-2 text-right'
              : 'left-[var(--page-x)] top-20 md:left-auto md:right-[var(--page-x)] md:top-auto md:bottom-6 md:text-right'
          }`}
        >
          <p className="t-caption tabular-nums text-[var(--c-mute)]">
            {String(front + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}
          </p>
          <p className="t-value kr mt-1">{current.name.value}</p>
          <p className="t-caption kr tabular-nums">{price(current.price.value)}</p>
          <div className={`pointer-events-auto mt-3 flex gap-1 t-nav ${scrollMode ? 'justify-end' : 'md:justify-end'}`}>
            <button type="button" className="tag" onClick={() => step(-1)} aria-label="이전 제품">
              ←
            </button>
            <button type="button" className="tag" onClick={() => step(1)} aria-label="다음 제품">
              →
            </button>
            <button type="button" className="tag tag-ink kr" onClick={() => open(front)}>
              자세히 보기
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (!scrollMode) return stage;
  return (
    <section ref={sectionRef} aria-label="DISCOVER" className="relative bg-[var(--c-gray)]" style={{ height: `${Math.max(2, n) * 55 + 100}svh` }}>
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <div className="pointer-events-none absolute left-[var(--page-x)] top-20 z-[125] bg-[rgba(241,241,241,0.92)] p-2 pl-0 lg:top-24">
          <p className="t-label t-mark text-[var(--c-mute)]">02</p>
          <h2 className="t-h2 t-mark mt-1">DISCOVER</h2>
          <p className="t-caption kr mt-2 max-w-[18rem] text-[var(--c-mute)]">스크롤하면 제품이 차례로 앞으로 나옵니다. 사진을 누르면 상세 페이지로 들어갑니다.</p>
        </div>
        {stage}
      </div>
    </section>
  );
}
