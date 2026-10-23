import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Product } from '@/data/productTypes';
import { price } from './data';

/**
 * LAGI curved gallery (home). Products sit on one chain that runs from the bottom-left (near,
 * large) to the top-right (far, small); wheel, drag, swipe or arrow keys move the chain and the
 * front product links to its page.
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

export function CurvedGallery({ products, ratios }: { products: Product[]; ratios: Record<string, number> }) {
  const n = products.length;
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
      target.current = Math.round(target.current) + delta;
      if (reduced) pos.current = target.current;
    },
    [reduced],
  );

  // Render loop: the chain eases after the target, then rests.
  useEffect(() => {
    if (!g || n === 0) return;
    let raf = 0;
    let lastFront = -1;
    const paint = () => {
      pos.current = reduced ? target.current : pos.current + (target.current - pos.current) * 0.09;
      if (Math.abs(target.current - pos.current) < 0.0005) pos.current = target.current;
      for (let i = 0; i < n; i++) {
        const el = cardRefs.current[i];
        if (!el) continue;
        let d = (((i - pos.current + 2) % n) + n) % n - 2; // wrap: the chain is endless
        if (n <= 3) d = i - pos.current;
        const { x, y, s, rot } = place(d, g);
        const visible = d > -1.6 && d < 5.6;
        el.style.visibility = visible ? 'visible' : 'hidden';
        if (!visible) continue;
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) rotate(${rot.toFixed(2)}deg) scale(${s.toFixed(4)})`;
        el.style.zIndex = String(100 - Math.round(d * 10));
        el.style.opacity = String(clamp(d > 0 ? (5.6 - d) / 1.2 : (d + 1.6) / 0.5, 0, 1));
        const img = el.firstElementChild as HTMLElement | null;
        if (img) img.style.clipPath = crop(d, i);
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
  }, [g, n, reduced]);

  // Wheel and trackpad.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
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
  }, [reduced, scheduleSnap, step]);

  // Drag (mouse) and swipe (touch/pen) through pointer events.
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
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

  return (
    <div
      ref={stageRef}
      className="relative h-full w-full touch-none select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      role="region"
      aria-roledescription="gallery"
      aria-label="LAGI product gallery — scroll, drag or use the arrow keys"
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
            onFocus={() => bringToFront(i)}
            onClick={(e) => {
              if (drag.current?.moved) e.preventDefault();
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

      {current && (
        <div className="pointer-events-none absolute left-[var(--page-x)] top-20 z-[120] w-[min(320px,60vw)] md:left-auto md:right-[var(--page-x)] md:top-auto md:bottom-6 md:text-right">
          <p className="t-caption tabular-nums text-[var(--c-mute)]">
            {String(front + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}
          </p>
          <p className="t-value mt-1">{current.name.value}</p>
          <p className="t-label tabular-nums">{price(current.price.value)}</p>
          <div className="pointer-events-auto mt-3 flex gap-1 t-nav md:justify-end">
            <button type="button" className="tag" onClick={() => step(-1)} aria-label="Previous product">
              ←
            </button>
            <button type="button" className="tag" onClick={() => step(1)} aria-label="Next product">
              →
            </button>
            <button type="button" className="tag tag-ink" onClick={() => navigate(`/product/${current.id}`)}>
              View
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
