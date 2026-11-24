/**
 * AGAIN screen layout (photo compositing and AI video share it): the picture on the left, everything you press on
 * the right, side by side, sized to one browser window on computers (no scrolling to reach a button).
 * On phones they stack, picture first.
 */
export const FRAME = 'grid grid-cols-1 gap-6 lg:h-[calc(100svh-var(--top)+20px)] lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8';
export const LEFT = 'flex min-h-0 flex-col gap-3';
export const RIGHT = 'min-h-0 space-y-2.5 lg:overflow-y-auto lg:pr-1';
/** The picture box: 42% of the screen high on phones, fills the left column's height on computers. */
export const STAGE = 'relative flex h-[42svh] w-full items-center justify-center overflow-hidden rounded-[var(--radius-card)] lg:h-auto lg:min-h-0 lg:flex-1';
