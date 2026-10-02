import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Variant = 'primary' | 'secondary' | 'tertiary' | 'dark';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-blue text-paper hover:bg-[#27488a]',
  secondary: 'bg-sand text-ink hover:bg-[#e6dfd0]',
  tertiary: 'bg-paper text-ink border border-ink hover:bg-mist',
  dark: 'bg-ink text-paper hover:bg-graphite',
};

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-card px-6 py-3.5 font-heading text-[0.95rem] font-extrabold transition-colors focus-ring disabled:cursor-not-allowed disabled:opacity-40';

type Common = { variant?: Variant; className?: string; children: ReactNode };

/** Primary action is always the blue fill; one per view (DESIGN.md → Button). */
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
  if (external) {
    return (
      <a
        href={to}
        target="_blank"
        rel="noreferrer noopener"
        className={`${BASE} ${VARIANT[variant]} ${className}`}
      >
        {children}
      </a>
    );
  }
  return (
    <Link to={to} className={`${BASE} ${VARIANT[variant]} ${className}`}>
      {children}
    </Link>
  );
}
