import type { ReactNode } from 'react';

type Tone = 'white' | 'lime' | 'cool' | 'soft' | 'dark';

const TONE: Record<Tone, string> = {
  white: 'bg-paper text-ink',
  lime: 'bg-limePale text-ink',
  cool: 'bg-haze text-ink',
  soft: 'bg-sand text-ink',
  dark: 'bg-ink text-paper',
};

/**
 * The one card shape in the system: 24px radius, flat, no border (DESIGN.md → Card).
 * On a tinted band a white card reads as raised without any shadow.
 */
export function Card({
  tone = 'white',
  className = '',
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return <div className={`rounded-card p-6 lg:p-8 ${TONE[tone]} ${className}`}>{children}</div>;
}
