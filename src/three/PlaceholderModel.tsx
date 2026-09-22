import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { Group } from 'three';

/**
 * Stand-in geometry shown when a product has no verified GLB yet (spec §18-19: never
 * present a placeholder as if it were the real, generated product).
 */
export function PlaceholderModel() {
  const group = useRef<Group>(null);

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.15;
  });

  return (
    <group ref={group}>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.9, 1.1, 0.4]} />
        <meshStandardMaterial color="#d8d6cf" wireframe />
      </mesh>
      <mesh position={[0, 0.68, 0]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.32, 0.03, 8, 24, Math.PI]} />
        <meshStandardMaterial color="#8a8880" wireframe />
      </mesh>
      <Html center position={[0, -0.85, 0]} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            color: '#8a8880',
            whiteSpace: 'nowrap',
            fontFamily: 'sans-serif',
          }}
        >
          3D MODEL — CONTENT REQUIRED
        </div>
      </Html>
    </group>
  );
}
