import { LOGO_PATHS, LOGO_VIEWBOX } from './logoPaths';

/**
 * The LAGI wordmark — L, a crossbar-less Λ, G, I — redrawn as strokes from the brand graphic
 * (legacy-prototype/LAGI.png) so it stays sharp at any size and takes the surrounding text colour.
 */
export function LagiLogo({ className, title = 'LAGI' }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox={`0 0 ${LOGO_VIEWBOX.width} ${LOGO_VIEWBOX.height}`}
      className={className}
      role="img"
      aria-label={title}
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="butt"
      strokeLinejoin="miter"
    >
      {LOGO_PATHS.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
