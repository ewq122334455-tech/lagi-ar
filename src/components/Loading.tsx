export function Loading({ label = '불러오는 중' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] w-full flex-col items-center justify-center gap-4 py-24" role="status" aria-live="polite">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-ink" aria-hidden="true" />
      <p className="eyebrow">{label}</p>
    </div>
  );
}
