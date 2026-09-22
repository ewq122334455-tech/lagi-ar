import { useState } from 'react';
import { Billboard } from '@react-three/drei';
import type { Hotspot } from '@/data/productTypes';

interface HotspotMarkersProps {
  hotspots: Hotspot[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function HotspotMarkers({ hotspots, selectedId, onSelect }: HotspotMarkersProps) {
  return (
    <group>
      {hotspots.map((h) => (
        <HotspotMarker key={h.id} hotspot={h} active={h.id === selectedId} onSelect={() => onSelect(h.id)} />
      ))}
    </group>
  );
}

function HotspotMarker({ hotspot, active, onSelect }: { hotspot: Hotspot; active: boolean; onSelect: () => void }) {
  const [hovered, setHovered] = useState(false);
  const { x, y, z } = hotspot.position;
  const scale = active ? 1.4 : hovered ? 1.2 : 1;

  return (
    <group
      position={[x, y, z]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      <mesh scale={scale}>
        <sphereGeometry args={[0.035, 16, 16]} />
        <meshBasicMaterial color={active ? '#111110' : '#f7f6f3'} />
      </mesh>
      <Billboard>
        <mesh scale={scale}>
          <ringGeometry args={[0.05, 0.06, 24]} />
          <meshBasicMaterial color={active ? '#111110' : '#3a3a37'} transparent opacity={active ? 1 : 0.7} />
        </mesh>
      </Billboard>
    </group>
  );
}
