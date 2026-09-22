import { useEffect, useRef } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Box3, Sphere } from 'three';
import type { Group } from 'three';
import type { ModelBounds } from './bounds';

interface ModelProps {
  url: string;
  activeAnimation?: string | null;
  /** Called once per loaded model with its bounding sphere, in the model's own local space. */
  onBounds?: (bounds: ModelBounds) => void;
}

/**
 * Loads a real, verified GLB asset (spec §16-17, §24). Must be wrapped in <Suspense>.
 *
 * Never assumes the model is centered at the origin or any particular scale — an uploaded
 * GLB's proportions are unknown ahead of time, so the camera can't be framed with fixed
 * constants. Instead this reports the model's bounding sphere so CameraRig can frame it.
 */
export function Model({ url, activeAnimation, onBounds }: ModelProps) {
  const group = useRef<Group>(null);
  const { scene, animations } = useGLTF(url);
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    const box = new Box3().setFromObject(scene);
    if (box.isEmpty()) {
      onBounds?.({ center: [0, 0, 0], radius: 1.2 });
      return;
    }
    const sphere = box.getBoundingSphere(new Sphere());
    const radius = Number.isFinite(sphere.radius) && sphere.radius > 0 ? sphere.radius : 1.2;
    onBounds?.({ center: [sphere.center.x, sphere.center.y, sphere.center.z], radius });
    // Re-measure only when a new model (scene) loads, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  useEffect(() => {
    Object.values(actions).forEach((action) => action?.stop());
    if (activeAnimation && actions[activeAnimation]) {
      actions[activeAnimation]!.reset().fadeIn(0.3).play();
    }
    return () => {
      if (activeAnimation && actions[activeAnimation]) {
        actions[activeAnimation]!.fadeOut(0.2);
      }
    };
  }, [activeAnimation, actions]);

  return <primitive ref={group} object={scene} dispose={null} />;
}

export function preloadModel(url: string) {
  useGLTF.preload(url);
}
