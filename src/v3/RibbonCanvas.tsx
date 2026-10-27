import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export interface RibbonImage {
  src: string;
  /** Edge print under the frame, e.g. the product name and price. */
  caption?: string;
  /** Where clicking the frame goes. */
  href?: string;
  /** Accessible name for the frame's link. */
  label?: string;
}

/*
 * LAGI film: the band is a strip of film stock. Each frame is one product photo (at its own ratio)
 * between two black edges. The edges carry POINT-dot perforations and an edge print —
 * "LAGI in AGAIN", the frame number, and the product.
 */
const PHOTO_H = 512;
const EDGE = 76;
const GAP = 14;
const ATLAS_H = PHOTO_H + EDGE * 2;
const INK = '#0f0f0f';
const HOLE = '#f1f1f1';
const BLUE = '#1d5198';

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

interface Atlas {
  canvas: HTMLCanvasElement;
  /** Left edge of each frame in the atlas, plus the total width at the end. */
  starts: number[];
  /** Which input image each frame shows. */
  index: number[];
}

/** Lays the frames end to end on film stock: photo at its natural ratio, edges, perforations, edge print. */
async function buildAtlas(images: RibbonImage[]): Promise<Atlas | null> {
  const loaded = (await Promise.all(images.map((i) => loadImage(i.src)))).map((img, i) => ({ img, i })).filter((x) => !!x.img && x.img.naturalWidth > 0) as {
    img: HTMLImageElement;
    i: number;
  }[];
  if (!loaded.length) return null;
  await document.fonts?.ready.catch(() => undefined);
  const widths = loaded.map(({ img }) => Math.round((img.naturalWidth / img.naturalHeight) * PHOTO_H) + GAP);
  const total = Math.min(widths.reduce((a, b) => a + b, 0), 8192);
  const canvas = document.createElement('canvas');
  canvas.width = total;
  canvas.height = ATLAS_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, total, ATLAS_H);

  // Perforations: POINT dots running the whole length of both edges.
  const pitch = 34;
  for (let x = pitch / 2; x < total; x += pitch) {
    for (const y of [20, ATLAS_H - 20]) {
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = HOLE;
      ctx.fill();
    }
  }

  const starts: number[] = [];
  const index: number[] = [];
  let x = 0;
  loaded.forEach(({ img, i }, n) => {
    if (x >= total) return;
    starts.push(x);
    index.push(i);
    const w = widths[n] - GAP;
    const px = x + GAP / 2;
    ctx.drawImage(img, px, EDGE, w, PHOTO_H);
    // Edge print above the frame: brand + frame number, the number in LAGI blue.
    const num = String(n + 1).padStart(2, '0');
    ctx.textBaseline = 'alphabetic';
    ctx.font = "700 17px 'posterama-2001', 'Posterama 2001', 'Pretendard Variable', Pretendard, sans-serif";
    ctx.fillStyle = BLUE;
    ctx.beginPath();
    ctx.arc(px + 8, EDGE - 19, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${num}`, px + 22, EDGE - 13);
    ctx.globalAlpha = 0.8;
    ctx.fillText('LAGI IN AGAIN', px + 58, EDGE - 13);
    ctx.globalAlpha = 1;
    // Edge print below: the product.
    const caption = images[i].caption;
    if (caption) {
      ctx.font = "600 17px 'Pretendard Variable', Pretendard, sans-serif";
      ctx.fillStyle = '#ffffff';
      ctx.fillText(caption, px + 4, EDGE + PHOTO_H + 26, w - 8);
    }
    x += widths[n];
  });
  starts.push(x);
  return { canvas, starts, index };
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
export function RibbonCanvas({ images, className = '', onSelect }: { images: RibbonImage[]; className?: string; onSelect?: (href: string) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
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
    let atlas: Atlas | null = null;
    let disposed = false;
    let hovering = false;

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

    buildAtlas(images).then((built) => {
      if (disposed || !built) return;
      atlas = built;
      const canvas = built.canvas;
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
      // The film slows almost to a stop while a frame is under the pointer, so it can be clicked.
      offset -= (hovering ? 0.12 : 1) * (dt * 0.012 + velocity * 0.00035);
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

    // Which frame is under the pointer: ray → band UV → position in the atlas → frame.
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const frameAt = (e: PointerEvent | MouseEvent) => {
      if (!atlas) return null;
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObject(mesh)[0];
      if (!hit?.uv) return null;
      const u = hit.uv.x * uniforms.uRepeat.value + uniforms.uOffset.value;
      const px = (u - Math.floor(u)) * atlas.canvas.width;
      for (let k = 0; k < atlas.index.length; k++) if (px >= atlas.starts[k] && px < atlas.starts[k + 1]) return images[atlas.index[k]];
      return null;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const f = frameAt(e);
      hovering = !!f?.href;
      renderer.domElement.style.cursor = f?.href ? 'pointer' : '';
      const r = host.getBoundingClientRect();
      setHover(f?.href ? { x: e.clientX - r.left, y: e.clientY - r.top, text: f.caption ?? f.label ?? '' } : null);
    };
    const onLeave = () => {
      hovering = false;
      setHover(null);
    };
    const onClick = (e: MouseEvent) => {
      const f = frameAt(e);
      if (f?.href) selectRef.current?.(f.href);
    };
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerleave', onLeave);
    renderer.domElement.addEventListener('click', onClick);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener('scroll', onScroll);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerleave', onLeave);
      renderer.domElement.removeEventListener('click', onClick);
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
  return (
    <div ref={hostRef} className={className}>
      {hover && (
        <span
          className="t-caption kr pointer-events-none absolute z-20 whitespace-nowrap bg-[var(--c-white)] px-2 py-1 font-semibold"
          style={{ left: hover.x + 14, top: hover.y + 14 }}
        >
          {hover.text} →
        </span>
      )}
      {/* The film for keyboards and screen readers: the same frames as plain links. */}
      <ul className="sr-only">
        {images.map((i, n) =>
          i.href ? (
            <li key={n}>
              <a
                href={`#${i.href}`}
                onClick={(e) => {
                  e.preventDefault();
                  selectRef.current?.(i.href!);
                }}
              >
                {i.label ?? i.caption}
              </a>
            </li>
          ) : null,
        )}
      </ul>
    </div>
  );
}
