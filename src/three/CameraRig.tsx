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
  /** Only true while a preset/hotspot move is playing. Otherwise the rig must leave the
   *  camera alone, or it fights OrbitControls and drags slip out of the user's hand. */
  const animating = useRef(false);

  function applyView(direction: Vector3) {
    const { center, radius } = boundsRef.current;
    const c = new Vector3(center[0], center[1], center[2]);
    targetLook.current.copy(c);
    targetPos.current.copy(c).addScaledVector(direction, radius * DISTANCE_FACTOR);
    animating.current = true;
  }

  useImperativeHandle(ref, () => ({
    goToView(preset) {
      applyView(preset === 'reset' ? RESET_DIRECTION : VIEW_DIRECTIONS[preset]);
    },
    flyTo(position, lookAt) {
      targetPos.current.set(...position);
      targetLook.current.set(...lookAt);
      animating.current = true;
    },
  }));

  // Auto-frame whenever a model's bounds change — covers both the initial mount (placeholder
  // bounds) and the moment a real GLB finishes loading and reports its true size/position.
  useEffect(() => {
    applyView(RESET_DIRECTION);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds.center[0], bounds.center[1], bounds.center[2], bounds.radius]);

  useFrame(() => {
    if (!animating.current) return;
    camera.position.lerp(targetPos.current, 0.08);
    if (controls.current) {
      controls.current.target.lerp(targetLook.current, 0.08);
      controls.current.update();
    }
    // Hand control back once the move has essentially arrived, so damping and user input take over.
    const settle = Math.max(boundsRef.current.radius * 0.004, 0.001);
    if (
      camera.position.distanceTo(targetPos.current) < settle &&
      (!controls.current || controls.current.target.distanceTo(targetLook.current) < settle)
    ) {
      animating.current = false;
    }
  });

  return (
    <OrbitControls
      ref={controls}
      enableDamping
      dampingFactor={0.15}
      minDistance={Math.max(bounds.radius * 0.6, 0.05)}
      maxDistance={bounds.radius * 6}
      // Any touch/drag cancels an in-flight move — the user's hand wins over the rig.
      onStart={() => {
        animating.current = false;
      }}
      makeDefault
    />
  );
});
CameraRig.displayName = 'CameraRig';
