import type { ProductAnimation } from '@/data/productTypes';
import type { ViewPreset } from './CameraRig';

const VIEWS: { preset: ViewPreset; label: string }[] = [
  { preset: 'front', label: '앞' },
  { preset: 'back', label: '뒤' },
  { preset: 'left', label: '왼쪽' },
  { preset: 'right', label: '오른쪽' },
  { preset: 'top', label: '위' },
  { preset: 'bottom', label: '아래' },
  { preset: 'reset', label: '처음으로' },
];

interface ViewerControlsProps {
  onView: (preset: ViewPreset) => void;
  animations?: ProductAnimation[];
  activeAnimation?: string | null;
  onSetAnimation?: (clipName: string | null) => void;
}

export function ViewerControls({ onView, animations = [], activeAnimation, onSetAnimation }: ViewerControlsProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-3 p-4 lg:p-6">
      <div className="pointer-events-auto flex gap-2 overflow-x-auto pb-1">
        {VIEWS.map((v) => (
          <button
            key={v.preset}
            type="button"
            onClick={() => onView(v.preset)}
            className="shrink-0 rounded-full border-2 border-line bg-paper/90 px-3 py-2 font-heading text-xs font-extrabold text-graphite backdrop-blur transition-colors hover:border-ink hover:text-ink focus-ring"
          >
            {v.label}
          </button>
        ))}
      </div>

      {animations.length > 0 && onSetAnimation && (
        <div className="pointer-events-auto flex flex-wrap gap-2">
          {animations.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onSetAnimation(activeAnimation === a.clipName ? null : a.clipName)}
              className={`rounded-full border-2 px-3 py-2 font-heading text-xs font-extrabold backdrop-blur focus-ring ${
                activeAnimation === a.clipName
                  ? 'border-ink bg-ink text-paper'
                  : 'border-line bg-paper/90 text-graphite hover:border-ink hover:text-ink'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      <p className="pointer-events-none text-[0.65rem] tracking-widest text-stone">
        드래그해서 돌리기 · 스크롤로 확대
      </p>
    </div>
  );
}
