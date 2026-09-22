export function DetailSection({
  eyebrow,
  title,
  children,
  className,
}: {
  eyebrow: string;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`border-t border-line px-6 py-20 lg:px-10 lg:py-28 ${className ?? ''}`}>
      <div className="mx-auto max-w-canvas">
        <p className="eyebrow">{eyebrow}</p>
        {title && <h2 className="mt-3 max-w-2xl text-3xl font-medium leading-tight lg:text-4xl">{title}</h2>}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}
