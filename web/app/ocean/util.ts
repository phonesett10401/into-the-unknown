import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Shared clock uniform; every animated shader reads the same one. */
export const time = { value: 0 };

// ---------- noise ----------

function hash2(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function valueNoise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x: number, y: number, octaves = 5) {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * f, y * f);
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}

/** Deterministic pseudo-random, so every visitor sees the same ocean. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ---------- textures ----------

let glow: THREE.Texture | null = null;
/** Soft radial falloff used for every glowing point and halo. */
export function glowTexture() {
  if (glow) return glow;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.18, "rgba(255,255,255,0.85)");
  grad.addColorStop(0.45, "rgba(255,255,255,0.22)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glow = new THREE.CanvasTexture(c);
  return glow;
}

// ---------- geometry ----------

/** Revolve a [radius, x] profile (tail to head) into a body lying along +x. */
export function latheBody(profile: [number, number][], segments = 20) {
  const pts = profile.map(([r, x]) => new THREE.Vector2(Math.max(r, 0.001), x));
  const g = new THREE.LatheGeometry(pts, segments);
  g.rotateZ(-Math.PI / 2);
  return g;
}

/** A forked tail fin in the XY plane, attached at x = 0 and trailing into -x. */
export function tailFin(length: number, span: number) {
  const s = new THREE.Shape();
  s.moveTo(0.05 * length, 0);
  s.quadraticCurveTo(-0.5 * length, 0.35 * span, -length, span);
  s.quadraticCurveTo(-0.72 * length, 0.1 * span, -0.62 * length, 0);
  s.quadraticCurveTo(-0.72 * length, -0.1 * span, -length, -span);
  s.quadraticCurveTo(-0.5 * length, -0.35 * span, 0.05 * length, 0);
  return new THREE.ShapeGeometry(s, 6);
}

export function merge(parts: THREE.BufferGeometry[]) {
  const clean = parts.map((p) => {
    const g = p.index ? p.toNonIndexed() : p.clone();
    for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal") g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    return g;
  });
  const out = mergeGeometries(clean, false)!;
  return out;
}

/** A small laterally-compressed fish, ~1 unit long, head at +x. */
export function fishGeometry() {
  const body = latheBody(
    [
      [0.0, -0.5],
      [0.05, -0.42],
      [0.1, -0.3],
      [0.16, -0.1],
      [0.18, 0.08],
      [0.15, 0.26],
      [0.09, 0.4],
      [0.0, 0.5],
    ],
    14,
  );
  body.scale(1, 1, 0.45);
  const tail = tailFin(0.32, 0.2);
  tail.translate(-0.46, 0, 0);
  const dorsal = new THREE.ShapeGeometry(
    new THREE.Shape([new THREE.Vector2(0.12, 0.16), new THREE.Vector2(-0.14, 0.28), new THREE.Vector2(-0.12, 0.13)]),
  );
  return merge([body, tail, dorsal]);
}

// ---------- materials ----------

/**
 * Make a material swim: bend the body sideways (or vertically) in a travelling
 * wave that grows toward the tail. Works for instanced meshes (per-instance phase).
 */
export function swim(
  mat: THREE.Material,
  opts: { amp: number; freq: number; speed: number; head: number; tail: number; axis?: "z" | "y"; instanced?: boolean },
) {
  const axis = opts.axis ?? "z";
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time;
    sh.vertexShader = "uniform float uTime;\n" + sh.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      float swimPhase = ${opts.instanced ? "float(gl_InstanceID) * 1.731" : "0.0"};
      float swimTail = smoothstep(${opts.head.toFixed(3)}, ${opts.tail.toFixed(3)}, position.x);
      transformed.${axis} += sin(uTime * ${opts.speed.toFixed(3)} + swimPhase - position.x * ${opts.freq.toFixed(3)}) * ${opts.amp.toFixed(3)} * swimTail;`,
    );
  };
  mat.customProgramCacheKey = () => `swim-${axis}-${opts.amp}-${opts.freq}-${opts.speed}-${opts.head}-${opts.tail}-${!!opts.instanced}`;
  return mat;
}

/** Translucent bell with a bright fresnel rim and radial canals; additive, fogged manually. */
export function jellyMaterial(inner: THREE.Color, rim: THREE.Color) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uInner: { value: inner },
      uRim: { value: rim },
      uGlow: { value: 1 },
      uFogDensity: { value: 0.02 },
    },
    vertexShader: `
      varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying float vDist;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        vUv = uv;
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uInner; uniform vec3 uRim; uniform float uGlow; uniform float uFogDensity;
      varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying float vDist;
      void main() {
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
        float canals = smoothstep(0.9, 1.0, abs(sin(vUv.x * 3.14159 * 8.0))) * (1.0 - vUv.y);
        float gonad = smoothstep(0.35, 0.0, abs(vUv.y - 0.82)) * (0.5 + 0.5 * sin(vUv.x * 3.14159 * 8.0));
        vec3 c = mix(uInner, uRim, fres) * (0.18 + fres) + uRim * canals * 0.35 + uInner * gonad * 0.25;
        float fog = exp(-pow(uFogDensity * vDist, 2.0));
        gl_FragColor = vec4(c * uGlow * fog, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}
