import { useId } from 'react';
import { EMBLEM_BODY, EMBLEM_CUTOUT, EMBLEM_VIEWBOX } from './logoPaths';

/**
 * The LAGI emblem from the brand's Illustrator file. It takes the surrounding text colour, and the
 * L Λ G I letters are cut out (masked) so whatever is behind the logo shows through them.
 */
export function LagiLogo({ className, title = 'LAGI' }: { className?: string; title?: string }) {
  const mask = `lagi-cut-${useId().replace(/:/g, '')}`;
  const [x, y, w, h] = EMBLEM_VIEWBOX.split(' ');
  return (
    <svg viewBox={EMBLEM_VIEWBOX} className={className} role="img" aria-label={title} fill="currentColor">
      <mask id={mask} maskUnits="userSpaceOnUse" x={x} y={y} width={w} height={h}>
        <rect x={x} y={y} width={w} height={h} fill="#fff" />
        {EMBLEM_CUTOUT.map((d) => (
          <path key={d} d={d} fill="#000" />
        ))}
      </mask>
      <g mask={`url(#${mask})`}>
        {EMBLEM_BODY.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}
