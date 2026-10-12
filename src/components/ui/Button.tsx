import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Variant = 'primary' | 'secondary' | 'tertiary' | 'dark' | 'quiet';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-blue text-paper hover:bg-blueDeep',
  secondary: 'bg-sand text-ink hover:bg-[#E2DDD1]',
  tertiary: 'border border-ink text-ink hover:bg-ink hover:text-paper',
  dark: 'bg-ink text-paper hover:bg-graphite',
  // A text link with a rule under it — the quietest call to action in the system.
  quiet: 'border-b border-ink/30 text-ink hover:border-ink !px-0 !py-1 !rounded-none',
};

// Small caps-ish: 12px, letter-spaced, medium weight. Nothing shouts.
const BASE =
  'inline-flex items-center justify-center gap-2 rounded-card px-7 py-3.5 font-heading text-[0.78rem] font-medium uppercase tracking-[0.14em] transition-colors duration-200 focus-ring disabled:cursor-not-allowed disabled:opacity-40';

type Common = { variant?: Variant; className?: string; children: ReactNode };

/** Primary action is the blue fill; one per view (DESIGN.md → Button). */
export function Button({
  variant = 'primary',
  className = '',
  children,
  ...rest
}: Common & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`${BASE} ${VARIANT[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  to,
  variant = 'primary',
  className = '',
  children,
  external,
}: Common & { to: string; external?: boolean }) {
  const cls = `${BASE} ${VARIANT[variant]} ${className}`;
  if (external) {
    return (
      <a href={to} target="_blank" rel="noreferrer noopener" className={cls}>
        {children}
      </a>
    );
  }
  return (
    <Link to={to} className={cls}>
      {children}
    </Link>
  );
}
