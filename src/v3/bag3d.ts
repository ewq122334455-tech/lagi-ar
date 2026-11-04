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
  return model.type === 'box' ? buildBox(model, base) : buildTote(model, base);
}

/**
 * A rigid box bag from product photos: each face carries its own photo (perspective-corrected),
 * the edges are piped (rounded tubes), and webbing/leather handles rise from the top.
 */
async function buildBox(model: Model, base: string): Promise<Bag3D> {
  const w = model.widthCm / 100;
  const h = model.heightCm / 100;
  const d = model.depthCm / 100;
  const handleH = model.handleCm / 100;
  const disposables: { dispose: () => void }[] = [];
  const loader = new THREE.TextureLoader();
  const load = (u?: string) =>
    u
      ? new Promise<THREE.Texture | null>((ok) =>
          loader.load(
            new URL(u, base).toString(),
            (t) => {
              t.colorSpace = THREE.SRGBColorSpace;
              t.anisotropy = 8;
              disposables.push(t);
              ok(t);
            },
            undefined,
            () => ok(null),
          ),
        )
      : Promise.resolve(null);
  const f = model.faces ?? {};
  const [front, back, left, right, top, bottom] = await Promise.all([f.front, f.back ?? f.front, f.left, f.right ?? f.left, f.top, f.bottom].map(load));
  const mat = (map: THREE.Texture | null, opts: THREE.MeshStandardMaterialParameters = {}) => {
    const m = new THREE.MeshStandardMaterial({ map: map ?? undefined, color: map ? '#ffffff' : model.bodyColor ?? '#222222', roughness: 0.7, metalness: 0, ...opts });
    disposables.push(m);
    return m;
  };
  const geo = <T extends THREE.BufferGeometry>(g: T) => (disposables.push(g), g);
  const none = new THREE.MeshBasicMaterial({ visible: false });
  disposables.push(none);
  const bag = new THREE.Group();
  // BoxGeometry face order: +x (right), -x (left), +y (top), -y (bottom), +z (front), -z (back).
  const faces = [mat(right), mat(left), model.openTop ? none : mat(top), mat(bottom), mat(front), mat(back)];
  const body = new THREE.Mesh(geo(new THREE.BoxGeometry(w, h, d)), faces);
  body.position.y = h / 2;
  bag.add(body);
  if (model.openTop) {
    const lining = new THREE.MeshStandardMaterial({ color: model.liningColor ?? '#ece6d8', roughness: 0.95, side: THREE.BackSide });
    disposables.push(lining);
    const inner = new THREE.Mesh(geo(new THREE.BoxGeometry(w * 0.97, h * 0.99, d * 0.94)), [lining, lining, none, lining, lining, lining]);
    inner.position.y = h / 2 + h * 0.005;
    bag.add(inner);
  }
  // Piped edges: a tube along each of the 12 edges (softens the box's silhouette like real binding).
  const edgeMat = new THREE.MeshStandardMaterial({ color: model.edgeColor ?? '#c9c9c9', roughness: 0.35, metalness: model.edgeColor ? 0.2 : 0.6 });
  disposables.push(edgeMat);
  const r = Math.min(w, h, d) * 0.022;
  const edge = (len: number, axis: 'x' | 'y' | 'z', x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo(new THREE.CylinderGeometry(r, r, len + r * 2, 10)), edgeMat);
    if (axis === 'x') m.rotation.z = Math.PI / 2;
    if (axis === 'z') m.rotation.x = Math.PI / 2;
    m.position.set(x, y, z);
    bag.add(m);
  };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) edge(h, 'y', (sx * w) / 2, h / 2, (sz * d) / 2);
  for (const y of [0, h]) {
    for (const sz of [-1, 1]) edge(w, 'x', 0, y, (sz * d) / 2);
    for (const sx of [-1, 1]) edge(d, 'z', (sx * w) / 2, y, 0);
  }
  // Handles: flat straps arching over the top.
  for (const hd of model.handles ?? []) {
    const hm = new THREE.MeshStandardMaterial({ color: hd.color, roughness: 0.6 });
    disposables.push(hm);
    const x0 = hd.x0 * w;
    const x1 = hd.x1 * w;
    const z = hd.z * d;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x0, h * 0.98, z),
      new THREE.Vector3(x0, h + handleH * 0.6, z),
      new THREE.Vector3(x0 + (x1 - x0) * 0.25, h + handleH, z),
      new THREE.Vector3(x0 + (x1 - x0) * 0.75, h + handleH, z),
      new THREE.Vector3(x1, h + handleH * 0.6, z),
      new THREE.Vector3(x1, h * 0.98, z),
    ]);
    // A flat strap: a thin ribbon swept along the curve.
    const sw = hd.widthCm / 100;
    const m = new THREE.Mesh(geo(new THREE.TubeGeometry(curve, 64, sw / 2, 10, false)), hm);
    m.scale.z = 0.25;
    m.position.z = z * 0.75;
    bag.add(m);
  }
  bag.position.y = -(h + handleH);
  const group = new THREE.Group();
  group.add(bag);
  return { group, widthM: w, dispose: () => disposables.forEach((x) => x.dispose()) };
}

async function buildTote(model: Model, base: string): Promise<Bag3D> {
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
  const tx = model.textures!;
  const [front, back, side, bottom] = await Promise.all([tx.front, tx.back, tx.side, tx.bottom].map(load));
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
