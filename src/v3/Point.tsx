/** POINT: the small blue dot from the emblem, used to mark "this one". */
export function Point({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--c-blue)] ${className}`} />;
}
