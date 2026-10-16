import { Link } from 'react-router-dom';

const COLOR_CLASSES = {
  lime: 'bg-lime text-ink',
  orange: 'bg-orange text-paper',
  blue: 'bg-blue text-paper',
} as const;

interface ColorBlockLinkProps {
  index: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  to: string;
  color: keyof typeof COLOR_CLASSES;
  image?: string;
}

/** One MATERIALS/PROCESS/STORY color block (spec §09) — real content + one accent color, not a generic gray card. */
export function ColorBlockLink({ index, eyebrow, title, subtitle, ctaLabel, to, color, image }: ColorBlockLinkProps) {
  return (
    <Link
      to={to}
      className={`group flex min-h-[20rem] flex-col justify-between rounded-2xl p-8 transition-transform duration-300 hover:-translate-y-1 focus-ring lg:p-10 ${COLOR_CLASSES[color]}`}
    >
      <div className="flex items-start justify-between">
        <span className="font-display text-3xl opacity-60">{index}</span>
        {image && (
          <img src={image} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover" />
        )}
      </div>
      <div>
        {/* Raw utilities, not `.eyebrow`: that class forces a grey that disappears on a colour block. */}
        <p className="text-xs font-bold uppercase tracking-[0.24em] opacity-75">{eyebrow}</p>
        <h3 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.03em] lg:text-4xl">{title}</h3>
        <p className="mt-4 max-w-xs text-sm opacity-90">{subtitle}</p>
        <p className="mt-6 font-heading text-sm font-semibold underline-offset-4 group-hover:underline">
          {ctaLabel} →
        </p>
      </div>
    </Link>
  );
}
