import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Vector3 } from 'three';
import type { ModelBounds } from './bounds';

export type ViewPreset = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | 'reset';

export interface CameraRigHandle {
  goToView: (preset: ViewPreset) => void;
  flyTo: (position: [number, number, number], lookAt: [number, number, number]) => void;
}

interface CameraRigProps {
  bounds: ModelBounds;
}

/** Unit direction vectors per preset — scaled by the model's own bounding-sphere radius at use time,
 *  never a fixed world-space distance (spec §3: never hardcode camera position for an unknown GLB). */
const VIEW_DIRECTIONS: Record<Exclude<ViewPreset, 'reset'>, Vector3> = {
  front: new Vector3(0, 0.06, 1),
  back: new Vector3(0, 0.06, -1),
  left: new Vector3(-1, 0.06, 0),
  right: new Vector3(1, 0.06, 0),
  top: new Vector3(0, 1, 0.01),
  bottom: new Vector3(0, -1, 0.01),
};
const RESET_DIRECTION = new Vector3(0.75, 0.48, 0.9);
const DISTANCE_FACTOR = 2.6;

export const CameraRig = forwardRef<CameraRigHandle, CameraRigProps>(({ bounds }, ref) => {
  const controls = useRef<any>(null);
  const { camera } = useThree();

  const targetPos = useRef(new Vector3());
  const targetLook = useRef(new Vector3());
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;

  function applyView(direction: Vector3) {
    const { center, radius } = boundsRef.current;
    const c = new Vector3(center[0], center[1], center[2]);
    targetLook.current.copy(c);
    targetPos.current.copy(c).addScaledVector(direction, radius * DISTANCE_FACTOR);
  }

  useImperativeHandle(ref, () => ({
    goToView(preset) {
      applyView(preset === 'reset' ? RESET_DIRECTION : VIEW_DIRECTIONS[preset]);
    },
    flyTo(position, lookAt) {
      targetPos.current.set(...position);
      targetLook.current.set(...lookAt);
    },
  }));

  // Auto-frame whenever a model's bounds change — covers both the initial mount (placeholder
  // bounds) and the moment a real GLB finishes loading and reports its true size/position.
  useEffect(() => {
    applyView(RESET_DIRECTION);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds.center[0], bounds.center[1], bounds.center[2], bounds.radius]);

  useFrame(() => {
    camera.position.lerp(targetPos.current, 0.08);
    if (controls.current) {
      controls.current.target.lerp(targetLook.current, 0.08);
      controls.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controls}
      enableDamping
      dampingFactor={0.08}
      minDistance={Math.max(bounds.radius * 0.6, 0.05)}
      maxDistance={bounds.radius * 6}
      makeDefault
    />
  );
});
CameraRig.displayName = 'CameraRig';
