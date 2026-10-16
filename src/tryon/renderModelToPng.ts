import {
  Box3,
  type Object3D,
  DirectionalLight,
  HemisphereLight,
  PMREMGenerator,
  PerspectiveCamera,
  SRGBColorSpace,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader, RoomEnvironment } from 'three-stdlib';

/**
 * Renders a product GLB from the front onto a transparent background and crops it tight,
 * producing a cut-out PNG the try-on can hang on the body. Lets products that only have a
 * 3D model (e.g. bags) be tried on without a separate product photo shoot.
 */
export async function renderModelToPng(modelUrl: string, size = 1024): Promise<string> {
  const gltf = await new GLTFLoader().loadAsync(modelUrl);
  return renderObjectToPng(gltf.scene, size);
}

/**
 * Same front-view cut-out for an already-loaded object (e.g. a recoloured bag). The object is
 * re-parented into a private scene, so pass a clone if it is still shown elsewhere.
 */
export function renderObjectToPng(model: Object3D, size = 1024): string {

  const renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(size, size, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const envTarget = pmrem.fromScene(RoomEnvironment(), 0.04);
  scene.environment = envTarget.texture;
  scene.add(new HemisphereLight(0xffffff, 0x888888, 0.6));
  const key = new DirectionalLight(0xffffff, 1.2);
  key.position.set(1, 2, 3);
  scene.add(key);
  scene.add(model);

  const box = new Box3().setFromObject(model);
  const center = box.getCenter(new Vector3());
  const dims = box.getSize(new Vector3());
  model.position.sub(center);

  // Long lens from straight ahead, so the cut-out reads as a flat front view.
  const camera = new PerspectiveCamera(15, 1, 0.01, 1000);
  const radius = Math.max(dims.x, dims.y) / 2;
  const distance = (radius / Math.tan((camera.fov * Math.PI) / 360)) * 1.1 + dims.z;
  camera.position.set(0, 0, distance);
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
  const cropped = cropToContent(renderer.domElement);

  envTarget.texture.dispose();
  pmrem.dispose();
  renderer.dispose();
  return cropped;
}

function cropToContent(source: HTMLCanvasElement): string {
  const w = source.width;
  const h = source.height;
  const scratch = document.createElement('canvas');
  scratch.width = w;
  scratch.height = h;
  const sctx = scratch.getContext('2d')!;
  sctx.drawImage(source, 0, 0);
  const { data } = sctx.getImageData(0, 0, w, h);

  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error('3D 모델이 비어 있습니다.');

  const out = document.createElement('canvas');
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext('2d')!.drawImage(scratch, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}
