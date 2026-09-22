import { useEffect, useRef } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import type { Group } from 'three';

interface ModelProps {
  url: string;
  activeAnimation?: string | null;
}

/** Loads a real, verified GLB asset (spec §16-17, §24). Must be wrapped in <Suspense>. */
export function Model({ url, activeAnimation }: ModelProps) {
  const group = useRef<Group>(null);
  const { scene, animations } = useGLTF(url);
  const { actions } = useAnimations(animations, group);

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
