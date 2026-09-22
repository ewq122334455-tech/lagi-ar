import type { Hotspot } from '@/data/productTypes';
import { ContentBadge } from '@/components/ContentBadge';

interface SpotlightPanelProps {
  hotspot: Hotspot | null;
  onClose: () => void;
}

export function SpotlightPanel({ hotspot, onClose }: SpotlightPanelProps) {
  if (!hotspot) return null;

  return (
    <div
      role="dialog"
      aria-label={hotspot.title}
      className="absolute right-4 top-4 z-10 w-[calc(100%-2rem)] max-w-sm border border-line bg-paper/95 p-6 shadow-lg backdrop-blur lg:right-6 lg:top-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-stone">{hotspot.category}</p>
          <h3 className="mt-1 text-lg font-medium">{hotspot.title}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="shrink-0 border border-line px-2.5 py-1 text-sm hover:border-ink focus-ring"
        >
          ✕
        </button>
      </div>

      {hotspot.image && (
        <img src={hotspot.image} alt={hotspot.title} className="mt-4 aspect-[4/3] w-full object-cover" />
      )}

      <div className="mt-4 flex items-start gap-2">
        {hotspot.description.value ? (
          <p className="text-sm text-graphite">{hotspot.description.value}</p>
        ) : (
          <ContentBadge status={hotspot.description.status} />
        )}
      </div>
      {hotspot.description.value && hotspot.description.status !== 'VERIFIED' && (
        <div className="mt-2">
          <ContentBadge status={hotspot.description.status} />
        </div>
      )}
    </div>
  );
}
