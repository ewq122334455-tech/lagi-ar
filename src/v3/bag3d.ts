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
  /** Depth (front to back) and the whole hang length from the handle top down, in metres — for the shadow. */
  depthM?: number;
  hangM?: number;
  dispose: () => void;
}

export async function buildBag(model: Model, base: string): Promise<Bag3D> {
  if (model.type === 'pouch') return buildPouch(model, base);
  return model.type === 'box' ? buildBox(model, base) : buildTote(model, base);
}

/** A rounded-rectangle outline (metres), bottom edge at y=0, centred on x. */
function outline(w: number, h: number, rTop: number, rBot: number) {
  const s = new THREE.Shape();
  const x0 = -w / 2;
  const x1 = w / 2;
  rTop = Math.min(rTop, w / 2, h - rBot);
  s.moveTo(x0 + rBot, 0);
  s.lineTo(x1 - rBot, 0);
  s.quadraticCurveTo(x1, 0, x1, rBot);
  s.lineTo(x1, h - rTop);
  s.quadraticCurveTo(x1, h, x1 - rTop, h);
  s.lineTo(x0 + rTop, h);
  s.quadraticCurveTo(x0, h, x0, h - rTop);
  s.lineTo(x0, rBot);
  s.quadraticCurveTo(x0, 0, x0 + rBot, 0);
  return s;
}

/**
 * A soft zip pouch from product photos: a rounded slab whose front and back carry their photos,
 * coloured binding around each face, a white gusset, and the charm it hangs from (cord + carabiner,
 * optional tassel of cords and caps). It hangs from the carabiner by the attach corner, tilted the way
 * gravity would hang it.
 */
async function buildPouch(model: Model, base: string): Promise<Bag3D> {
  const w = model.widthCm / 100;
  const h = model.heightCm / 100;
  const d = model.depthCm / 100;
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
  const [front, back] = await Promise.all([load(model.faces?.front), load(model.faces?.back ?? model.faces?.front)]);
  const std = (o: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0, ...o });
    disposables.push(m);
    return m;
  };
  const geo = <T extends THREE.BufferGeometry>(g: T) => (disposables.push(g), g);
  const body = model.bodyColor ?? '#f4f4f2';
  const pz = model.pouch ?? {};
  const b = Math.min(w, h) * 0.03; // bevel: how far the rounded edge reaches in (the binding covers it)
  const bt = d * 0.25;
  const iw = w - 2 * b;
  const ih = h - 2 * b;
  const rTop = (pz.cornerTop ?? 0.3) * ih;
  const rBot = (pz.cornerBottom ?? 0.08) * ih;
  const core = Math.max(0.002, d - 2 * bt);
  const g = geo(new THREE.ExtrudeGeometry(outline(iw, ih, rTop, rBot), { depth: core, bevelEnabled: true, bevelThickness: bt, bevelSize: b, bevelSegments: 6, curveSegments: 24 }));
  g.translate(0, b, -core / 2);
  // Planar UVs over the flat face; the back is seen from behind, so its u runs the other way.
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const u = (pos.getX(i) + iw / 2) / iw;
    uv.setXY(i, pos.getZ(i) < 0 ? 1 - u : u, (pos.getY(i) - b) / ih);
  }
  uv.needsUpdate = true;
  // Split the caps group into back (z<0) and front (z>0).
  const caps = g.groups[0];
  const rest = g.groups.slice(1);
  g.clearGroups();
  for (let t = caps.start; t < caps.start + caps.count; t += 3) g.addGroup(t, 3, pos.getZ(t) > 0 ? 0 : 1);
  for (const r of rest) g.addGroup(r.start, r.count, 2);
  const face = (map: THREE.Texture | null) => std({ map: map ?? undefined, color: map ? '#ffffff' : body });
  const pouch = new THREE.Group();
  pouch.add(new THREE.Mesh(g, [face(front), face(back), std({ color: body, roughness: 0.85 })]));
  // Binding: a round tube around each face, in that face's colour.
  const ring = outline(iw + b, ih + b, rTop + b * 0.5, rBot + b * 0.5).getSpacedPoints(160);
  const bindR = b * 0.8;
  for (const [sz, color] of [
    [1, pz.bindingFront],
    [-1, pz.bindingBack ?? pz.bindingFront],
  ] as const) {
    if (!color) continue;
    const z = sz * (core / 2 + bt * 0.75);
    const pts = ring.map((p) => new THREE.Vector3(p.x, p.y + b * 0.5, z));
    pouch.add(new THREE.Mesh(geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 240, bindR, 8, true)), std({ color, roughness: 0.6 })));
  }

  // Charm: carabiner on top (the hand holds it), a cord down to the attach corner.
  const ch = pz.charm;
  const root = new THREE.Group();
  const carCm = (ch?.carabinerCm ?? 0) / 100;
  const cordM = (ch?.cordCm ?? 0) / 100;
  const attach = new THREE.Vector3((pz.attachX ?? 0) * w, (pz.attachY ?? 1) * h, 0);
  if (ch) {
    const cr = carCm * 0.06;
    const cw = carCm * (ch.carabinerShape === 'triangle' ? 0.8 : 0.5);
    const loop =
      ch.carabinerShape === 'triangle'
        ? [
            [0, 0],
            [cw / 2, -carCm * 0.9],
            [0, -carCm],
            [-cw / 2, -carCm * 0.9],
          ]
        : Array.from({ length: 14 }, (_, i) => {
            const a = (i / 14) * Math.PI * 2;
            return [Math.sin(a) * cw * 0.5, -carCm / 2 + Math.cos(a) * carCm * 0.5];
          });
    const carCurve = new THREE.CatmullRomCurve3(
      loop.map(([x, y]) => new THREE.Vector3(x, y - cr, 0)),
      true,
      'centripetal',
    );
    root.add(new THREE.Mesh(geo(new THREE.TubeGeometry(carCurve, 96, cr, 10, true)), std({ color: ch.carabinerColor, roughness: 0.3, metalness: 0.55 })));
    const top = -carCm - cr;
    const cordCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, top, 0), new THREE.Vector3(0.002, top - cordM * 0.5, 0.002), new THREE.Vector3(0, top - cordM, 0)]);
    root.add(new THREE.Mesh(geo(new THREE.TubeGeometry(cordCurve, 24, ch.cordWidthCm ? ch.cordWidthCm / 200 : 0.0035, 8, false)), std({ color: ch.cordColor, roughness: 0.9 })));
    // Tassel: cords fanning down from the carabiner, a bottle cap on some.
    (ch.tassel ?? []).forEach((t, i, all) => {
      const n = all.length;
      const spread = (i / Math.max(1, n - 1) - 0.5) * 2;
      const len = t.lenCm / 100;
      const sx = carCm * 0.15 + 0.012 + spread * 0.012;
      const pts = [
        new THREE.Vector3(0, top, 0),
        new THREE.Vector3(sx * 0.6, top - len * 0.3, 0.004 * spread),
        new THREE.Vector3(sx + spread * len * 0.25, top - len * 0.75, 0.008 * spread),
        new THREE.Vector3(sx + spread * len * 0.3, top - len, 0.01 * spread),
      ];
      root.add(new THREE.Mesh(geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.0022, 6, false)), std({ color: t.color, roughness: 0.9 })));
      if (t.cap) {
        const cap = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.014, 0.014, 0.008, 24)), std({ color: t.cap, roughness: 0.4 }));
        cap.rotation.x = Math.PI / 2;
        cap.position.copy(pts[3]).add(new THREE.Vector3(0, -0.01, 0.006));
        root.add(cap);
      }
    });
  }
  // Hang by the attach corner: turn the pouch so its middle sits straight below that corner.
  const mid = new THREE.Vector2(0, h * 0.45);
  const v = mid.clone().sub(new THREE.Vector2(attach.x, attach.y));
  const theta = v.lengthSq() > 1e-8 ? -Math.PI / 2 - Math.atan2(v.y, v.x) : 0;
  pouch.position.set(-attach.x, -attach.y, 0);
  const pivot = new THREE.Group();
  pivot.add(pouch);
  pivot.rotation.z = theta;
  pivot.position.y = -carCm - cordM;
  root.add(pivot);
  const group = new THREE.Group();
  group.add(root);
  return { group, widthM: w, depthM: d, hangM: carCm + cordM + h, dispose: () => disposables.forEach((x) => x.dispose()) };
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
  return { group, widthM: w, depthM: d, hangM: h + handleH, dispose: () => disposables.forEach((x) => x.dispose()) };
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
  const rimMat = new THREE.MeshStandardMaterial({ color: model.rimColor ?? '#222222', roughness: 0.8 });
  const strapMat = new THREE.MeshStandardMaterial({ color: model.handleColor ?? '#222222', roughness: 0.7 });
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
  return { group, widthM: w, depthM: d, hangM: h + handleH, dispose: () => disposables.forEach((x) => x.dispose()) };
}

/**
 * A transparent WebGL layer the size of the video, with an orthographic camera in video pixels
 * (x right, y down), lights, and the bag. `place` positions it each frame.
 *
 * `realism` (engine V3): the bag casts a soft shadow onto a transparent "shadow catcher" plane just
 * behind it — standing in for the body or clothes it hangs against — and the light takes on the colour
 * of the room. It costs one extra 512 px shadow-map pass. There is no depth from the camera, so the
 * shadow is a plausible cue, not a measured one.
 */
export interface LayerPlacement {
  x: number;
  y: number;
  widthPx: number;
  yaw: number;
  roll: number;
  brightness: number;
  /** Room colour, each channel ~1 for neutral (V3). */
  tint?: [number, number, number];
  /** 0..1 opacity of the whole layer (V3 fades a bag out when the hand is lost). */
  alpha?: number;
}

export function createBagLayer(canvas: HTMLCanvasElement, bag: Bag3D, opts: { realism?: boolean; shadow?: boolean } = {}) {
  const real = !!opts.realism;
  const shadowOn = real && opts.shadow !== false;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight('#ffffff', '#9a9488', 1.6);
  const key = new THREE.DirectionalLight('#ffffff', 1.4);
  key.position.set(0.4, 1, 1);
  scene.add(hemi, key, bag.group);
  const camera = new THREE.OrthographicCamera(0, 1, 0, -1, -5000, 5000);
  let catcher: THREE.Mesh | null = null;
  const lightDir = new THREE.Vector3(0.22, 0.5, 1.5).normalize();
  if (shadowOn) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    key.castShadow = true;
    key.shadow.mapSize.set(512, 512);
    key.shadow.radius = 9;
    key.shadow.bias = -0.0004;
    scene.add(key.target);
    bag.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
    });
    catcher = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.3 }));
    catcher.receiveShadow = true;
    scene.add(catcher);
  }
  return {
    /** Put the handle top at (x, y) video pixels, the bag `widthPx` wide, turned `yaw` and tilted `roll` (radians). */
    render(W: number, H: number, p: LayerPlacement | null) {
      if (canvas.width !== W || canvas.height !== H) {
        renderer.setSize(W, H, false);
        camera.right = W;
        camera.bottom = -H;
        camera.updateProjectionMatrix();
      }
      bag.group.visible = !!p;
      if (catcher) catcher.visible = !!p;
      if (p) {
        const s = p.widthPx / bag.widthM;
        bag.group.scale.setScalar(s);
        bag.group.position.set(p.x, -p.y, 0);
        // A small pitch so the opening reads; yaw follows the body; roll is the swing.
        bag.group.rotation.set(0.12, p.yaw, p.roll, 'YXZ');
        hemi.intensity = 1.1 + p.brightness * 0.9;
        key.intensity = 0.8 + p.brightness * 0.9;
        if (real) {
          // V1/V2 light the bag so that a flat sRGB-128 surface comes out at ~0.8 (a white bag looks grey, 10–30 %
          // darker than its photo; measured in docs/ai-fitting-upgrade/V3-RENDER-QUALITY.md). V3 is calibrated to ~1.0
          // at a normal room brightness and still follows the room up and down.
          hemi.intensity = 1.55 + p.brightness * 1.0;
          key.intensity = 1.15 + p.brightness * 0.9;
          const t = p.tint ?? [1, 1, 1];
          // Lean the light towards the room's colour, but only part of the way (a white bag must stay white-ish).
          const c = new THREE.Color(0.5 + 0.5 * t[0], 0.5 + 0.5 * t[1], 0.5 + 0.5 * t[2]);
          hemi.color.copy(c);
          key.color.copy(c);
          const depth = bag.depthM ?? bag.widthM * 0.5;
          const hang = bag.hangM ?? bag.widthM * 1.5;
          const cx = p.x;
          const cy = -p.y - hang * s * 0.5;
          if (catcher) catcher.position.set(cx, cy, -(depth * 0.5 + 0.012) * s);
          if (catcher) catcher.scale.set(Math.max(bag.widthM, hang) * s * 2.6, hang * s * 1.9, 1);
          key.target.position.set(cx, cy, 0);
          key.position.set(cx + lightDir.x * 4 * s, cy + lightDir.y * 4 * s, lightDir.z * 4 * s);
          const R = Math.max(bag.widthM, hang) * s * 1.1;
          const sc = key.shadow.camera;
          sc.left = -R;
          sc.right = R;
          sc.top = R;
          sc.bottom = -R;
          sc.near = 2 * s;
          sc.far = 6.5 * s;
          sc.updateProjectionMatrix();
        }
        if (p.alpha !== undefined) canvas.style.opacity = String(p.alpha);
      }
      renderer.render(scene, camera);
    },
    /** `loseContext`: also release the WebGL context (when the canvas is going away for good). */
    dispose(loseContext = false) {
      renderer.dispose();
      bag.dispose();
      if (catcher) {
        catcher.geometry.dispose();
        (catcher.material as THREE.Material).dispose();
      }
      if (loseContext) renderer.forceContextLoss();
    },
  };
}
