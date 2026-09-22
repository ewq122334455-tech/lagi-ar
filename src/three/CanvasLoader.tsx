import { Html, useProgress } from '@react-three/drei';

/** Suspense fallback shown while a GLB is fetched/parsed (spec §3: "로딩 표시"). */
export function CanvasLoader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="flex flex-col items-center gap-3">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-line border-t-ink" />
        <p className="eyebrow text-stone">{Math.round(progress)}%</p>
      </div>
    </Html>
  );
}
