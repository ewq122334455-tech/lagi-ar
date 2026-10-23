import { useId } from 'react';
import { MOTIFS } from '@/components/motifs';

/**
 * CROP motif as a working mask: the photo shows only through the L·Λ·G·I blocks of one brand
 * motif. On hover or keyboard focus of the surrounding `group`, the full photo opens — "seeing the
 * product again" from a part to the whole. The photo itself is never stretched (slice fit).
 */
export function MotifCrop({ src, motif = 0, className = '' }: { src: string; motif?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  const m = MOTIFS[((motif % MOTIFS.length) + MOTIFS.length) % MOTIFS.length];
  const [x, y, w, h] = m.viewBox.split(' ').map(Number);
  return (
    <svg viewBox={m.viewBox} className={className} aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <defs>
        <clipPath id={`crop-${id}`}>
          {m.paths.map((d) => (
            <path key={d} d={d} />
          ))}
        </clipPath>
      </defs>
      {/* Full photo underneath, faded in on hover. */}
      <image
        href={src}
        x={x}
        y={y}
        width={w}
        height={h}
        preserveAspectRatio="xMidYMid slice"
        className="opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100 group-focus-visible:opacity-100"
      />
      <image href={src} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid slice" clipPath={`url(#crop-${id})`} />
    </svg>
  );
}

/** POINT: the small blue dot from the emblem, used to mark "this one". */
export function Point({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--c-blue)] ${className}`} />;
}
