import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Box3,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  PMREMGenerator,
  PerspectiveCamera,
  Raycaster,
  SRGBColorSpace,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { Material, Mesh, MeshStandardMaterial, Object3D } from 'three';
import { GLTFLoader, OrbitControls, RoomEnvironment } from 'three-stdlib';
import { REMIX_PARTS } from './remix';
import type { RemixColors } from './remix';
import { renderObjectToPng } from '@/tryon/renderModelToPng';

export interface RemixViewerHandle {
  /** The viewer exactly as shown, for saving. */
  snapshot(): string | null;
  /** A front-view transparent cut-out of the current combination, for try-on and cards. */
  cutout(): string | null;
}

interface RemixViewerProps {
  modelUrl: string;
  colors: RemixColors;
  selectedPart: string | null;
  onSelectPart: (key: string) => void;
  /** Incrementing this plays a quick turn — the "다시!" moment. */
  spinKey: number;
  className?: string;
}

interface PartState {
  materials: MeshStandardMaterial[];
  original: Color[];
}

/** Which remix part an object belongs to, by its own or an ancestor's node name. */
function partOf(obj: Object3D | null): string | null {
  for (let o = obj; o; o = o.parent) {
    const hit = REMIX_PARTS.find((p) => p.match.test(o!.name));
    if (hit) return hit.key;
  }
  return null;
}

export const RemixViewer = forwardRef<RemixViewerHandle, RemixViewerProps>(function RemixViewer(
  { modelUrl, colors, selectedPart, onSelectPart, spinKey, className },
  ref
) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const modelRef = useRef<Group | null>(null);
  const partsRef = useRef<Record<string, PartState>>({});
  const spinRef = useRef<{ start: number } | null>(null);
  const renderRef = useRef<() => void>(() => {});
  const onSelectRef = useRef(onSelectPart);
  onSelectRef.current = onSelectPart;
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;

    const renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    rendererRef.current = renderer;

    const scene = new Scene();
    const pmrem = new PMREMGenerator(renderer);
    const env = pmrem.fromScene(RoomEnvironment(), 0.04);
    scene.environment = env.texture;
    scene.add(new HemisphereLight(0xffffff, 0x9a948a, 0.5));
    const key = new DirectionalLight(0xffffff, 1.1);
    key.position.set(2, 3, 4);
    scene.add(key);

    const camera = new PerspectiveCamera(32, 1, 0.01, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.8;

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = mount;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    let raf = 0;
    const tick = () => {
      const model = modelRef.current;
      if (model && spinRef.current) {
        const t = Math.min(1, (performance.now() - spinRef.current.start) / 700);
        const eased = 1 - Math.pow(1 - t, 3);
        model.rotation.y = eased * Math.PI * 2;
        model.position.y = Math.sin(t * Math.PI) * 0.06;
        if (t >= 1) {
          spinRef.current = null;
          model.rotation.y = 0;
          model.position.y = 0;
        }
      }
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    renderRef.current = () => renderer.render(scene, camera);

    new GLTFLoader()
      .loadAsync(modelUrl)
      .then((gltf) => {
        if (disposed) return;
        const holder = gltf.scene;
        const box = new Box3().setFromObject(holder);
        const center = box.getCenter(new Vector3());
        const radius = box.getSize(new Vector3()).length() / 2;
        holder.position.sub(center);
        const model = holder;
        // Centred inside a pivot, so the "다시!" turn spins the bag in place.
        const pivot = new Group();
        pivot.add(model);
        scene.add(pivot);
        modelRef.current = pivot;

        // One cloned material per part, so recolouring never leaks into the shared GLB cache
        // or into parts that happened to share a material with it.
        const parts: Record<string, PartState> = {};
        const cloned = new Map<string, Map<Material, MeshStandardMaterial>>();
        model.traverse((obj) => {
          const mesh = obj as Mesh;
          if (!mesh.isMesh) return;
          const keyName = partOf(mesh);
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          const next = mats.map((m) => {
            const std = m as MeshStandardMaterial;
            if (std.isMeshStandardMaterial) std.envMapIntensity = 0.45;
            if (!keyName || !std.isMeshStandardMaterial) return m;
            const perPart = cloned.get(keyName) ?? new Map();
            cloned.set(keyName, perPart);
            let c = perPart.get(m);
            if (!c) {
              c = std.clone();
              perPart.set(m, c);
              parts[keyName] ??= { materials: [], original: [] };
              parts[keyName].materials.push(c);
              parts[keyName].original.push(c.color.clone());
            }
            return c;
          });
          mesh.material = Array.isArray(mesh.material) ? next : next[0];
        });
        partsRef.current = parts;

        camera.position.set(radius * 1.4, radius * 0.7, radius * 2.6);
        controls.target.set(0, 0, 0);
        controls.minDistance = radius * 1.4;
        controls.maxDistance = radius * 5;
        setStatus('ready');
      })
      .catch(() => !disposed && setStatus('error'));

    // A tap (not a drag) selects the part under the pointer.
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
      controls.autoRotate = false;
    };
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6 || !modelRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const pointer = new Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      const ray = new Raycaster();
      ray.setFromCamera(pointer, camera);
      for (const hit of ray.intersectObject(modelRef.current, true)) {
        const k = partOf(hit.object);
        if (k) {
          onSelectRef.current(k);
          break;
        }
      }
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);

    tick();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      controls.dispose();
      env.texture.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      modelRef.current = null;
      rendererRef.current = null;
    };
  }, [modelUrl]);

  // Apply colours (and briefly brighten the selected part so it is clear what a swatch will change).
  useEffect(() => {
    if (status !== 'ready') return;
    for (const [k, part] of Object.entries(partsRef.current)) {
      part.materials.forEach((m, i) => {
        if (colors[k]) m.color.set(colors[k]);
        else m.color.copy(part.original[i]);
        m.emissive.set(k === selectedPart ? 0x2a2a2a : 0x000000);
      });
    }
  }, [colors, selectedPart, status]);

  useEffect(() => {
    if (spinKey > 0) spinRef.current = { start: performance.now() };
  }, [spinKey]);

  useImperativeHandle(
    ref,
    () => ({
      snapshot() {
        if (!rendererRef.current) return null;
        renderRef.current();
        return rendererRef.current.domElement.toDataURL('image/png');
      },
      cutout() {
        const model = modelRef.current;
        if (!model) return null;
        const copy = model.clone(true);
        copy.rotation.set(0, 0, 0);
        copy.position.set(0, 0, 0);
        // Drop the selection glow from the copy.
        copy.traverse((o) => {
          const mesh = o as Mesh;
          if (!mesh.isMesh) return;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          const fixed = mats.map((m) => {
            const std = m as MeshStandardMaterial;
            if (!std.isMeshStandardMaterial || std.emissive.getHex() === 0) return m;
            const c = std.clone();
            c.emissive.set(0x000000);
            return c;
          });
          mesh.material = Array.isArray(mesh.material) ? fixed : fixed[0];
        });
        return renderObjectToPng(copy);
      },
    }),
    []
  );

  return (
    <div className={`relative ${className ?? ''}`}>
      <div ref={mountRef} className="absolute inset-0" />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-ink/20 border-t-ink" aria-hidden="true" />
        </div>
      )}
      {status === 'error' && (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-stone">3D 모델을 불러오지 못했습니다.</p>
      )}
    </div>
  );
});
