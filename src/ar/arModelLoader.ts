import { GLTFLoader } from 'three-stdlib';
import type { Object3D, AnimationClip } from 'three';
import type { ARSettings } from '@/data/productTypes';

export interface LoadedARModel {
  scene: Object3D;
  animations: AnimationClip[];
}

/** Loads a verified GLB and applies the product's AR calibration (spec §35). */
export async function loadARModel(url: string, settings: ARSettings): Promise<LoadedARModel> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  const scene = gltf.scene;
  scene.scale.setScalar(settings.scale);
  scene.position.set(settings.position.x, settings.position.y, settings.position.z);
  scene.rotation.set(settings.rotation.x, settings.rotation.y, settings.rotation.z);
  return { scene, animations: gltf.animations };
}
