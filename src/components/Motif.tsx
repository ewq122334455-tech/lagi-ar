import { MOTIFS } from './motifs';

/** One of the brand motifs, in its own colour unless a `color` is given. Decorative by default. */
export function Motif({ index, color, className }: { index: number; color?: string; className?: string }) {
  const m = MOTIFS[((index % MOTIFS.length) + MOTIFS.length) % MOTIFS.length];
  return (
    <svg viewBox={m.viewBox} className={className} aria-hidden="true" fill={color ?? m.color}>
      {m.paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
