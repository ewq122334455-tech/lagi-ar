import { useCallback, useState } from 'react';
import type { Hotspot } from '@/data/productTypes';

/**
 * Shared Spotlight selection state (spec §25-28). The same hook drives the
 * hotspot info panel in both the 3D viewer and the AR experience, so
 * hotspot data never has to be duplicated per surface.
 */
export function useSpotlight(hotspots: Hotspot[]) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const select = useCallback((id: string | null) => setSelectedId(id), []);
  const clear = useCallback(() => setSelectedId(null), []);

  const selected = hotspots.find((h) => h.id === selectedId) ?? null;

  return { selected, selectedId, select, clear };
}
