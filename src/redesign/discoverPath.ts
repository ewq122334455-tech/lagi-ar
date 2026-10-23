/**
 * The DISCOVER flow line, built from the LAGI motif rather than a generic wave. One cycle reads
 * the four letters left to right:
 *   L — a level stretch, then a drop (the foot of the L);
 *   Λ — a straight climb to a peak and back down;
 *   G — a round arch;
 *   I — a level stretch.
 * Returns the vertical offset (−1…1, up is negative) for a position `s` measured in cycles.
 */
const smooth = (t: number) => t * t * (3 - 2 * t);

export function motifOffset(s: number): number {
  const t = ((s % 1) + 1) % 1;
  if (t < 0.25) {
    // L: level high, then a soft step down into the next letter.
    const u = t / 0.25;
    return u < 0.7 ? -0.6 : -0.6 + 1.2 * smooth((u - 0.7) / 0.3);
  }
  if (t < 0.5) {
    // Λ: climb to a peak, descend.
    const u = (t - 0.25) / 0.25;
    return u < 0.5 ? 0.6 - 1.6 * smooth(u / 0.5) : -1 + 1.6 * smooth((u - 0.5) / 0.5);
  }
  if (t < 0.75) {
    // G: a round arch, like the bowl of the G turned over.
    const u = (t - 0.5) / 0.25;
    return 0.6 - 0.95 * Math.sin(u * Math.PI);
  }
  // I: level, easing back to the L's height to close the loop.
  const u = (t - 0.75) / 0.25;
  return 0.6 - 1.2 * smooth(u);
}

/** Which motif letter a position falls in — used to pick each image's mask. */
export type MotifLetter = 'L' | 'A' | 'G' | 'I';
export function letterAt(index: number): MotifLetter {
  return (['L', 'A', 'G', 'I'] as const)[index % 4];
}

/**
 * Mask for an image frame: the frame keeps the photo's own proportions; the mask only hides an
 * edge or corner, borrowed from the letter it sits on, and opens from the right as it enters.
 * `reveal` 0 = hidden, 1 = fully shown.
 */
export function maskFor(letter: MotifLetter, reveal: number): string {
  const hide = ((1 - reveal) * 100).toFixed(2);
  switch (letter) {
    case 'L':
      // L: square, with the top-right notch of the letter's open corner.
      return `polygon(${hide}% 0, 82% 0, 82% 14%, 100% 14%, 100% 100%, ${hide}% 100%)`;
    case 'A':
      // Λ: the top-left corner sheared off.
      return `polygon(calc(${hide}% + 16%) 0, 100% 0, 100% 100%, ${hide}% 100%, ${hide}% 22%)`;
    case 'G':
      // G: one large rounded corner.
      return `inset(0 0 0 ${hide}% round 0 0 0 48%)`;
    default:
      // I: a plain upright block.
      return `inset(0 0 0 ${hide}%)`;
  }
}
