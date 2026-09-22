export function ErrorState({
  title = '문제가 발생했습니다',
  message,
  action,
}: {
  title?: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="flex min-h-[40vh] w-full flex-col items-center justify-center gap-3 py-24 text-center"
      role="alert"
    >
      <p className="eyebrow">오류</p>
      <h2 className="text-xl font-medium">{title}</h2>
      <p className="max-w-md text-sm text-graphite">{message}</p>
      {action}
    </div>
  );
}
