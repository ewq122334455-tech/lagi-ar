import { forwardRef, useImperativeHandle, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Vector3 } from 'three';

export type ViewPreset = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | 'reset';

const VIEW_POSITIONS: Record<ViewPreset, Vector3> = {
  front: new Vector3(0, 0.1, 2.6),
  back: new Vector3(0, 0.1, -2.6),
  left: new Vector3(-2.6, 0.1, 0),
  right: new Vector3(2.6, 0.1, 0),
  top: new Vector3(0, 2.6, 0.01),
  bottom: new Vector3(0, -2.6, 0.01),
  reset: new Vector3(1.8, 1.1, 2.2),
};

export interface CameraRigHandle {
  goToView: (preset: ViewPreset) => void;
  flyTo: (position: [number, number, number], lookAt: [number, number, number]) => void;
}

export const CameraRig = forwardRef<CameraRigHandle>((_props, ref) => {
  const controls = useRef<any>(null);
  const { camera } = useThree();

  const targetPos = useRef(new Vector3(1.8, 1.1, 2.2));
  const targetLook = useRef(new Vector3(0, 0, 0));

  useImperativeHandle(ref, () => ({
    goToView(preset) {
      targetPos.current.copy(VIEW_POSITIONS[preset]);
      targetLook.current.set(0, 0, 0);
    },
    flyTo(position, lookAt) {
      targetPos.current.set(...position);
      targetLook.current.set(...lookAt);
    },
  }));

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
      minDistance={1.2}
      maxDistance={5}
      makeDefault
    />
  );
});
CameraRig.displayName = 'CameraRig';
