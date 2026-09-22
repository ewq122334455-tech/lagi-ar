const ACCENT_BORDER = {
  lime: 'border-lime',
  orange: 'border-orange',
  blue: 'border-blue',
} as const;

const ACCENT_TEXT = {
  lime: 'text-ink',
  orange: 'text-orange',
  blue: 'text-blue',
} as const;

export function DetailSection({
  eyebrow,
  title,
  children,
  className,
  id,
  accent,
}: {
  eyebrow: string;
  title?: string;
  children: React.ReactNode;
  className?: string;
  /** Anchor target for cross-page deep links (e.g. Home's "VIEW PROCESS" block → #process). */
  id?: string;
  /** MATERIAL/PROCESS/STORY get a signature accent color (spec §09); other sections stay neutral. */
  accent?: keyof typeof ACCENT_BORDER;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-[var(--nav-height)] border-t-2 ${accent ? ACCENT_BORDER[accent] : 'border-line'} px-6 py-20 lg:px-10 lg:py-28 ${className ?? ''}`}
    >
      <div className="mx-auto max-w-canvas">
        <p className={`text-xs font-bold uppercase tracking-[0.24em] ${accent ? ACCENT_TEXT[accent] : 'text-stone'}`}>
          {eyebrow}
        </p>
        {title && <h2 className="mt-3 max-w-2xl font-display text-4xl leading-tight lg:text-5xl">{title}</h2>}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}
