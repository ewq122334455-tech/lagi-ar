import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import type { Hotspot, ProductAnimation } from '@/data/productTypes';
import { Model } from './Model';
import { PlaceholderModel } from './PlaceholderModel';
import { CameraRig, type CameraRigHandle, type ViewPreset } from './CameraRig';
import { HotspotMarkers } from './HotspotMarkers';
import { ViewerControls } from './ViewerControls';
import { CanvasLoader } from './CanvasLoader';
import { ModelErrorBoundary } from './ModelErrorBoundary';
import { PLACEHOLDER_BOUNDS, type ModelBounds } from './bounds';

interface ProductViewerProps {
  modelUrl: string;
  hotspots: Hotspot[];
  selectedHotspotId: string | null;
  onSelectHotspot: (id: string) => void;
  animations?: ProductAnimation[];
  activeAnimation?: string | null;
  onSetAnimation?: (clipName: string | null) => void;
  className?: string;
  /** Hide the FRONT/BACK/... preset buttons — used for lightweight brand-moment embeds (e.g. the homepage hero). */
  showControls?: boolean;
}

export function ProductViewer({
  modelUrl,
  hotspots,
  selectedHotspotId,
  onSelectHotspot,
  animations = [],
  activeAnimation = null,
  onSetAnimation,
  className,
  showControls = true,
}: ProductViewerProps) {
  const rigRef = useRef<CameraRigHandle>(null);
  const [webglOk, setWebglOk] = useState(true);
  const [bounds, setBounds] = useState<ModelBounds>(PLACEHOLDER_BOUNDS);

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) setWebglOk(false);
    } catch {
      setWebglOk(false);
    }
  }, []);

  // Reset to the placeholder's known bounds whenever there's no model to measure
  // (e.g. navigating to a different product with no verified GLB yet).
  useEffect(() => {
    if (!modelUrl) setBounds(PLACEHOLDER_BOUNDS);
  }, [modelUrl]);

  useEffect(() => {
    const hotspot = hotspots.find((h) => h.id === selectedHotspotId);
    if (hotspot && rigRef.current) {
      if (hotspot.cameraTarget) {
        const { position, lookAt } = hotspot.cameraTarget;
        rigRef.current.flyTo([position.x, position.y, position.z], [lookAt.x, lookAt.y, lookAt.z]);
      } else {
        const { x, y, z } = hotspot.position;
        rigRef.current.flyTo([x * 2.2, y * 2.2 + 0.3, z * 2.2 + 1], [x, y, z]);
      }
    }
  }, [selectedHotspotId, hotspots]);

  if (!webglOk) {
    return (
      <div className={`flex items-center justify-center bg-mist text-center ${className ?? ''}`}>
        <div className="px-6">
          <p className="eyebrow">WEBGL UNSUPPORTED</p>
          <p className="mt-2 text-sm text-graphite">
            이 브라우저는 3D 보기를 지원하지 않습니다. 최신 브라우저에서 다시 시도해 주세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative bg-mist ${className ?? ''}`}>
      <ModelErrorBoundary resetKey={modelUrl}>
        <Canvas
          camera={{ position: [1.8, 1.1, 2.2], fov: 40 }}
          dpr={[1, 2]}
          gl={{ antialias: true, preserveDrawingBuffer: true }}
        >
          <hemisphereLight args={['#ffffff', '#3a3a3a', 0.6]} />
          <ambientLight intensity={0.4} />
          <directionalLight position={[3, 4, 2]} intensity={1.3} castShadow />
          <directionalLight position={[-3, 2, -2]} intensity={0.5} />
          <Suspense fallback={<CanvasLoader />}>
            {modelUrl ? (
              <Model url={modelUrl} activeAnimation={activeAnimation} onBounds={setBounds} />
            ) : (
              <PlaceholderModel />
            )}
          </Suspense>
          <ContactShadows position={[0, bounds.center[1] - bounds.radius, 0]} opacity={0.35} scale={bounds.radius * 4} blur={2.4} far={bounds.radius * 2} />
          <HotspotMarkers hotspots={hotspots} selectedId={selectedHotspotId} onSelect={onSelectHotspot} />
          <CameraRig ref={rigRef} bounds={bounds} />
        </Canvas>
      </ModelErrorBoundary>

      {showControls && (
        <ViewerControls
          onView={(preset: ViewPreset) => rigRef.current?.goToView(preset)}
          animations={animations}
          activeAnimation={activeAnimation}
          onSetAnimation={onSetAnimation}
        />
      )}
    </div>
  );
}
