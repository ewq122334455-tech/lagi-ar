import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export interface RibbonImage {
  src: string;
}

/** Strip height in the texture atlas, in pixels. Each photo keeps its own ratio inside it. */
const ATLAS_H = 512;

/**
 * Path of the ribbon, in units of the visible half-width (x) / half-height (y) at z = 0.
 * It curls in toward the camera off the left edge, runs low across the left half, climbs to the
 * top right and rolls back toward the camera on the right — both ends stay off-screen.
 */
const PATH: [number, number, number][] = [
  [-1.3, 0.9, -2.5],
  [-1.08, 0.4, -0.8],
  [-0.86, -0.1, 0.9],
  [-0.92, -0.45, 2.2],
  [-1.05, -0.3, 2.8],
  [-0.95, -0.55, 1.2],
  [-0.6, -0.62, 0],
  [-0.1, -0.4, 0],
  [0.4, -0.02, 0],
  [0.8, 0.35, -0.2],
  [1.05, 0.62, 0.3],
  [0.92, 0.38, 2.0],
  [0.78, -0.12, 2.8],
  [0.86, -0.7, 2.4],
  [1.4, -1.3, 1.2],
];

/** Twist (radians, around the path) at each point of PATH, so the band rolls over at the curls. */
const TWIST = [0.9, 0.7, 1.1, 1.5, 1.2, 0.5, 0.1, -0.05, -0.18, -0.3, -0.45, 0.4, 1.3, 1.5, 1.2];

const VERT = /* glsl */ `
  uniform float uRepeat;
  uniform float uOffset;
  varying vec2 vUv;
  varying float vFacing;
  void main() {
    vUv = vec2(uv.x * uRepeat + uOffset, uv.y);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    vFacing = abs(dot(n, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uMap;
  varying vec2 vUv;
  varying float vFacing;
  void main() {
    vec4 c = texture2D(uMap, vUv);
    // Soft light falloff as the band turns away, and a slightly darker back face.
    float shade = mix(0.8, 1.0, vFacing);
    if (!gl_FrontFacing) shade *= 0.9;
    gl_FragColor = vec4(c.rgb * shade, 1.0);
    #include <colorspace_fragment>
  }
`;

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Lays the photos end to end at one height, each at its natural ratio (never stretched). */
async function buildAtlas(images: RibbonImage[]) {
  const loaded = (await Promise.all(images.map((i) => loadImage(i.src)))).filter((i): i is HTMLImageElement => !!i && i.naturalWidth > 0);
  if (!loaded.length) return null;
  const widths = loaded.map((img) => Math.round((img.naturalWidth / img.naturalHeight) * ATLAS_H));
  const total = Math.min(widths.reduce((a, b) => a + b, 0), 8192);
  const canvas = document.createElement('canvas');
  canvas.width = total;
  canvas.height = ATLAS_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  let x = 0;
  loaded.forEach((img, i) => {
    if (x >= total) return;
    ctx.drawImage(img, x, 0, widths[i], ATLAS_H);
    x += widths[i];
  });
  return canvas;
}

/** Positions and normals along the path. The band faces the camera, then twists around the path. */
function buildGeometry(halfW: number, halfH: number, bandW: number, segments = 360) {
  const curve = new THREE.CatmullRomCurve3(
    PATH.map(([x, y, z]) => new THREE.Vector3(x * halfW, y * halfH, z * halfH)),
    false,
    'centripetal',
  );
  const twistAt = (t: number) => {
    const f = t * (TWIST.length - 1);
    const i = Math.min(TWIST.length - 2, Math.floor(f));
    const k = f - i;
    const s = k * k * (3 - 2 * k);
    return TWIST[i] * (1 - s) + TWIST[i + 1] * s;
  };

  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const view = new THREE.Vector3(0, 0, 1);
  const tangent = new THREE.Vector3();
  const side = new THREE.Vector3();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getTangentAt(t, tangent).normalize();
    side.crossVectors(view, tangent).normalize();
    curve.getPointAt(t, p);
    s.copy(side).applyAxisAngle(tangent, twistAt(t));
    n.crossVectors(tangent, s).normalize();
    for (const sign of [1, -1]) {
      pos.push(p.x + s.x * sign * bandW * 0.5, p.y + s.y * sign * bandW * 0.5, p.z + s.z * sign * bandW * 0.5);
      nor.push(n.x, n.y, n.z);
      uv.push(t, sign > 0 ? 1 : 0);
    }
    if (i < segments) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return { geometry: g, length: curve.getLength() };
}

/**
 * A continuous band of product photos bent through space (reference: The studio). The photos
 * flow along the band slowly on their own and faster with scrolling. Falls back to a plain row
 * when WebGL is not available.
 */
export function RibbonCanvas({ images, className = '' }: { images: RibbonImage[]; className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const key = images.map((i) => i.src).join('|');

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !images.length) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
    renderer.domElement.setAttribute('data-testid', 'ribbon-canvas');
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0, 12);
    const uniforms = {
      uMap: { value: null as THREE.Texture | null },
      uRepeat: { value: 1 },
      uOffset: { value: 0 },
    };
    const material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    scene.add(mesh);
    let atlasAspect = 1;
    let disposed = false;

    const layout = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
      const halfW = halfH * camera.aspect;
      const mobile = w < 768;
      const bandW = halfH * (mobile ? 0.32 : 0.48);
      // On narrow screens squeeze the path's height less so the band still crosses the middle.
      const { geometry, length } = buildGeometry(halfW, halfH * (mobile ? 0.8 : 1), bandW);
      mesh.geometry.dispose();
      mesh.geometry = geometry;
      // Tile the atlas along the band at the band's own aspect, so photos keep their ratio.
      uniforms.uRepeat.value = length / bandW / atlasAspect;
    };

    buildAtlas(images).then((canvas) => {
      if (disposed || !canvas) return;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      uniforms.uMap.value = tex;
      atlasAspect = canvas.width / canvas.height;
      layout();
      renderer.render(scene, camera);
      host.dataset.ready = '1';
    });

    let raf = 0;
    let visible = true;
    let last = performance.now();
    let offset = 0;
    let lastScroll = window.scrollY;
    let velocity = 0;
    const tick = (now: number) => {
      raf = 0;
      if (!visible || disposed) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const sy = window.scrollY;
      velocity += (sy - lastScroll - velocity) * 0.2;
      lastScroll = sy;
      offset -= dt * 0.012 + velocity * 0.00035;
      uniforms.uOffset.value = offset;
      if (uniforms.uMap.value) renderer.render(scene, camera);
      if (!reduced) raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) start();
    });
    io.observe(host);
    const ro = new ResizeObserver(() => {
      layout();
      if (uniforms.uMap.value) renderer.render(scene, camera);
    });
    ro.observe(host);
    const onScroll = () => reduced && start();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener('scroll', onScroll);
      mesh.geometry.dispose();
      material.dispose();
      uniforms.uMap.value?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (failed)
    return (
      <div className={`flex items-center gap-1 overflow-hidden ${className}`}>
        {images.map((i, n) => (
          <img key={n} src={i.src} alt="" className="h-[30vh] w-auto" />
        ))}
      </div>
    );
  return <div ref={hostRef} className={className} />;
}
