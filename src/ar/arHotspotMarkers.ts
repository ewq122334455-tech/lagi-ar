import { Group, Mesh, MeshBasicMaterial, RingGeometry, SphereGeometry } from 'three';
import type { Object3D } from 'three';
import type { Hotspot } from '@/data/productTypes';

const MARKER_KEY = 'lagiHotspotId';

/** Vanilla-three hotspot markers for the AR scene (spec §26-28, shared data with the 3D viewer). */
export function buildHotspotMarkers(hotspots: Hotspot[]): { root: Group; setActive: (id: string | null) => void } {
  const root = new Group();
  const spheres = new Map<string, Mesh>();

  hotspots.forEach((h) => {
    const group = new Group();
    group.position.set(h.position.x, h.position.y, h.position.z);
    group.userData[MARKER_KEY] = h.id;

    const sphere = new Mesh(new SphereGeometry(0.035, 16, 16), new MeshBasicMaterial({ color: '#f7f6f3' }));
    sphere.userData[MARKER_KEY] = h.id;
    const ring = new Mesh(new RingGeometry(0.05, 0.06, 24), new MeshBasicMaterial({ color: '#3a3a37', transparent: true, opacity: 0.75 }));
    ring.userData[MARKER_KEY] = h.id;

    group.add(sphere, ring);
    root.add(group);
    spheres.set(h.id, sphere);
  });

  function setActive(id: string | null) {
    spheres.forEach((mesh, hid) => {
      const active = hid === id;
      (mesh.material as MeshBasicMaterial).color.set(active ? '#111110' : '#f7f6f3');
      mesh.scale.setScalar(active ? 1.4 : 1);
    });
  }

  return { root, setActive };
}

export function findHotspotId(object: Object3D | null): string | null {
  let current: Object3D | null = object;
  while (current) {
    const id = current.userData[MARKER_KEY];
    if (id) return id;
    current = current.parent;
  }
  return null;
}
