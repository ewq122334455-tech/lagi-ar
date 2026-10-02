import type { ReactNode } from 'react';

type Tone = 'plain' | 'soft' | 'cool' | 'dark';

const TONE: Record<Tone, string> = {
  plain: 'bg-paper text-ink',
  soft: 'bg-sand text-ink',
  cool: 'bg-haze text-ink',
  dark: 'bg-ink text-paper',
};

/**
 * A full-width horizontal band — the page is a stack of these (DESIGN.md → Band).
 *
 * The tinted tones are what white cards sit on; that surface contrast is the only
 * elevation cue the system uses, so bands never carry a shadow or a border.
 */
export function Band({
  tone = 'plain',
  className = '',
  innerClassName = '',
  children,
}: {
  tone?: Tone;
  className?: string;
  innerClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className={`${TONE[tone]} px-6 py-14 lg:px-10 lg:py-band ${className}`}>
      <div className={`mx-auto w-full max-w-band ${innerClassName}`}>{children}</div>
    </section>
  );
}
