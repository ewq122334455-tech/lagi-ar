import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Hotspot } from '@/data/productTypes';

/**
 * Shared Spotlight selection state (spec §25-28). The same hook drives the
 * hotspot info panel in both the 3D viewer and the AR experience, so
 * hotspot data never has to be duplicated per surface.
 *
 * Also reads an initial `?hotspot=<id>` query param so a "LOOK CLOSER" card
 * elsewhere on the site (e.g. the homepage) can deep-link straight into a
 * specific product detail selected on load.
 */
export function useSpotlight(hotspots: Hotspot[]) {
  const [searchParams] = useSearchParams();
  const fromQuery = searchParams.get('hotspot');
  const [selectedId, setSelectedId] = useState<string | null>(
    fromQuery && hotspots.some((h) => h.id === fromQuery) ? fromQuery : null
  );

  const select = useCallback((id: string | null) => setSelectedId(id), []);
  const clear = useCallback(() => setSelectedId(null), []);

  const selected = hotspots.find((h) => h.id === selectedId) ?? null;

  return { selected, selectedId, select, clear };
}
