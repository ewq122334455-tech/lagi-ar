/**
 * A tote built from the reference sheet: an open box at the real size, each outer face textured with
 * the sheet's own view (front, back, side, bottom), a lining inside, a rim and two flat strap handles.
 * The group's origin is the top of the handles (where the hand holds it), so it hangs from the hand.
 */
import * as THREE from 'three';
import type { Product } from '@/data/productTypes';

type Model = NonNullable<Product['model3d']>;

export interface Bag3D {
  /** Hangs from its origin (handle top). Units: metres. */
  group: THREE.Group;
  widthM: number;
  dispose: () => void;
}

export async function buildBag(model: Model, base: string): Promise<Bag3D> {
  const w = model.widthCm / 100;
  const h = model.heightCm / 100;
  const d = model.depthCm / 100;
  const handleH = model.handleCm / 100;
  const loader = new THREE.TextureLoader();
  const load = (u: string) =>
    new Promise<THREE.Texture>((ok, fail) =>
      loader.load(
        new URL(u, base).toString(),
        (t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          t.anisotropy = 8;
          ok(t);
        },
        undefined,
        fail,
      ),
    );
  const [front, back, side, bottom] = await Promise.all([model.textures.front, model.textures.back, model.textures.side, model.textures.bottom].map(load));
  const sideR = side.clone();
  sideR.wrapS = THREE.RepeatWrapping;
  sideR.repeat.x = -1;
  sideR.offset.x = 1;
  sideR.needsUpdate = true;

  const disposables: { dispose: () => void }[] = [front, back, side, sideR, bottom];
  const mat = (map: THREE.Texture) => {
    const m = new THREE.MeshStandardMaterial({ map, roughness: 0.85, metalness: 0 });
    disposables.push(m);
    return m;
  };
  const inside = new THREE.MeshStandardMaterial({ color: '#cfcac0', roughness: 0.95, side: THREE.BackSide });
  const none = new THREE.MeshBasicMaterial({ visible: false });
  const rimMat = new THREE.MeshStandardMaterial({ color: model.rimColor, roughness: 0.8 });
  const strapMat = new THREE.MeshStandardMaterial({ color: model.handleColor, roughness: 0.7 });
  disposables.push(inside, none, rimMat, strapMat);

  const bag = new THREE.Group();
  const geo = (g: THREE.BufferGeometry) => (disposables.push(g), g);
  // Open top: the outer faces carry the sheet's views; an inner box seen from inside is the lining.
  const body = new THREE.Mesh(geo(new THREE.BoxGeometry(w, h, d)), [mat(sideR), mat(side), none, mat(bottom), mat(front), mat(back)]);
  body.position.y = h / 2;
  bag.add(body);
  const lining = new THREE.Mesh(geo(new THREE.BoxGeometry(w * 0.985, h * 0.99, d * 0.97)), [inside, inside, none, inside, inside, inside]);
  lining.position.y = h / 2 + h * 0.005;
  bag.add(lining);
  // Rim: a thin frame around the opening.
  const t = 0.006;
  const rh = h * 0.035;
  for (const [sx, sz, px, pz] of [
    [w + t, t, 0, d / 2],
    [w + t, t, 0, -d / 2],
    [t, d + t, w / 2, 0],
    [t, d + t, -w / 2, 0],
  ]) {
    const bar = new THREE.Mesh(geo(new THREE.BoxGeometry(sx, rh, sz)), rimMat);
    bar.position.set(px, h - rh / 2, pz);
    bag.add(bar);
  }
  // Two flat strap handles, front and back.
  const strap = (z: number) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-w * 0.2, h * 0.86, z),
      new THREE.Vector3(-w * 0.2, h + handleH * 0.55, z),
      new THREE.Vector3(-w * 0.1, h + handleH, z),
      new THREE.Vector3(w * 0.1, h + handleH, z),
      new THREE.Vector3(w * 0.2, h + handleH * 0.55, z),
      new THREE.Vector3(w * 0.2, h * 0.86, z),
    ]);
    const m = new THREE.Mesh(geo(new THREE.TubeGeometry(curve, 64, 0.0085, 8, false)), strapMat);
    m.scale.z = 0.35;
    m.position.z = z * 0.65;
    return m;
  };
  bag.add(strap(d / 2 + 0.002), strap(-d / 2 - 0.002));
  // Hang from the handle top.
  bag.position.y = -(h + handleH);
  const group = new THREE.Group();
  group.add(bag);
  return { group, widthM: w, dispose: () => disposables.forEach((x) => x.dispose()) };
}

/**
 * A transparent WebGL layer the size of the video, with an orthographic camera in video pixels
 * (x right, y down), lights, and the bag. `place` positions it each frame.
 */
export function createBagLayer(canvas: HTMLCanvasElement, bag: Bag3D) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight('#ffffff', '#9a9488', 1.6);
  const key = new THREE.DirectionalLight('#ffffff', 1.4);
  key.position.set(0.4, 1, 1);
  scene.add(hemi, key, bag.group);
  const camera = new THREE.OrthographicCamera(0, 1, 0, -1, -5000, 5000);
  return {
    /** Put the handle top at (x, y) video pixels, the bag `widthPx` wide, turned `yaw` and tilted `roll` (radians). */
    render(W: number, H: number, p: { x: number; y: number; widthPx: number; yaw: number; roll: number; brightness: number } | null) {
      if (canvas.width !== W || canvas.height !== H) {
        renderer.setSize(W, H, false);
        camera.right = W;
        camera.bottom = -H;
        camera.updateProjectionMatrix();
      }
      bag.group.visible = !!p;
      if (p) {
        const s = p.widthPx / bag.widthM;
        bag.group.scale.setScalar(s);
        bag.group.position.set(p.x, -p.y, 0);
        // A small pitch so the opening reads; yaw follows the body; roll is the swing.
        bag.group.rotation.set(0.12, p.yaw, p.roll, 'YXZ');
        hemi.intensity = 1.1 + p.brightness * 0.9;
        key.intensity = 0.8 + p.brightness * 0.9;
      }
      renderer.render(scene, camera);
    },
    dispose() {
      renderer.dispose();
      bag.dispose();
    },
  };
}
