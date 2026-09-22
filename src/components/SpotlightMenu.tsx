import type { Hotspot } from '@/data/productTypes';

interface SpotlightMenuProps {
  hotspots: Hotspot[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function SpotlightMenu({ hotspots, selectedId, onSelect }: SpotlightMenuProps) {
  if (hotspots.length === 0) {
    return <p className="text-sm text-stone">CONTENT REQUIRED — 등록된 Spotlight 디테일이 없습니다.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Spotlight 디테일 선택">
      {hotspots.map((h) => (
        <button
          key={h.id}
          type="button"
          role="tab"
          aria-selected={h.id === selectedId}
          onClick={() => onSelect(h.id)}
          className={`border px-4 py-2.5 text-left transition-colors focus-ring ${
            h.id === selectedId ? 'border-ink bg-ink text-paper' : 'border-line hover:border-ink'
          }`}
        >
          <p className="eyebrow" style={{ color: h.id === selectedId ? 'var(--lagi-mist)' : undefined }}>
            {h.category}
          </p>
          <p className="mt-0.5 text-sm font-medium">{h.title}</p>
        </button>
      ))}
    </div>
  );
}
