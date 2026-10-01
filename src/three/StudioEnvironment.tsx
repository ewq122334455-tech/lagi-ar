import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { PMREMGenerator } from 'three';
import type { Mesh } from 'three';
import { RoomEnvironment } from 'three-stdlib';

/**
 * Image-based lighting for the product viewer.
 *
 * Without an environment map, PBR materials have nothing to reflect, so fabric reads flat and
 * metal reads like grey plastic. RoomEnvironment is generated procedurally at runtime, so this
 * costs no download — important for a statically hosted site.
 */
export function StudioEnvironment() {
  const { gl, scene } = useThree();

  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    // RoomEnvironment is a factory returning a Scene, not a class.
    const room = RoomEnvironment();
    const target = pmrem.fromScene(room, 0.04);
    scene.environment = target.texture;

    // The room is only needed to bake the map; free it now rather than on unmount,
    // since the viewer remounts on every product navigation.
    room.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry?.dispose();
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => m?.dispose());
    });

    return () => {
      scene.environment = null;
      target.texture.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);

  return null;
}
