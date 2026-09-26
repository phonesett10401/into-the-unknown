import * as THREE from "three";
import { fbm, fishGeometry, glowTexture, jellyMaterial, latheBody, merge, rng, swim, tailFin } from "./util";

/** What every creature can read each frame. */
export type Env = {
  t: number;
  dt: number;
  camY: number;
  light: number; // 1 at the surface, ~0 below 1,000 m
  lamp: number; // submersible lamp strength, the inverse of light
  fogDensity: number;
  halfW: (dist: number) => number; // half the visible width at a distance in front of the camera
};

/** Placement helpers the scene hands to every factory. */
export type Place = {
  wy: (depth: number) => number | null; // world Y where the page reads this depth
  heroY: () => number; // camera Y at the very top of the page
  floorY: () => number | null; // camera Y resting on the Challenger Deep
};

export type Creature = {
  group: THREE.Object3D;
  anchor: () => number | null; // world Y of the creature's centre, null if unreachable
  xn: number; // horizontal position as a fraction of half the visible width
  z: number; // distance into the scene (negative)
  span: number; // vertical half-extent, for visibility culling
  update: (e: Env) => void;
};

const dummy = new THREE.Object3D();
dummy.rotation.order = "YZX";

function orient(x: number, y: number, z: number, vx: number, vy: number, vz: number, roll = 0) {
  dummy.position.set(x, y, z);
  const h = Math.hypot(vx, vz) || 1e-4;
  dummy.rotation.set(roll, Math.atan2(-vz, vx), Math.atan2(vy, h) * 0.8);
  dummy.updateMatrix();
  return dummy.matrix;
}

// ---------------------------------------------------------------- sunlight

/** A spinning ball of sardines, silver and catching the sun. Lives in the opening view. */
export function baitBall(p: Place): Creature {
  const N = 260;
  const geo = fishGeometry();
  geo.scale(0.8, 0.8, 0.8);
  const mat = swim(new THREE.MeshStandardMaterial({ color: 0xc4d6e0, metalness: 0.85, roughness: 0.26 }), {
    amp: 0.05, freq: 7, speed: 16, head: 0.05, tail: -0.45, instanced: true,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  const group = new THREE.Group();
  group.add(mesh);
  group.rotation.x = 0.45;
  const R = rng(7);
  const fish = Array.from({ length: N }, () => {
    const h = (R() * 2 - 1) * 2.8;
    const r = (1.1 + R() * 3.1) * Math.sqrt(Math.max(0.12, 1 - (h / 3.1) ** 2));
    return { h, r, ph: R() * Math.PI * 2, sp: 0.8 + R() * 0.4, wob: R() * 10 };
  });
  return {
    group, anchor: () => p.heroY() - 1.5, xn: 0.5, z: -30, span: 6,
    update(e) {
      group.rotation.y = e.t * 0.05;
      for (let i = 0; i < N; i++) {
        const f = fish[i];
        const a = f.ph + e.t * f.sp * (2.2 / f.r);
        const x = Math.cos(a) * f.r, z = Math.sin(a) * f.r * 0.85;
        const y = f.h + Math.sin(e.t * 1.3 + f.wob) * 0.18;
        mesh.setMatrixAt(i, orient(x, y, z, -Math.sin(a), Math.cos(e.t * 1.3 + f.wob) * 0.1, Math.cos(a) * 0.85, 0.3));
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

/** A humpback crossing far off, a silhouette softened by the water between you. */
export function whale(p: Place): Creature {
  const body = latheBody(
    [
      [0.05, -8], [0.28, -7.3], [0.55, -6], [0.95, -4], [1.35, -1.8], [1.55, 0.4],
      [1.55, 2.4], [1.38, 4.4], [1.05, 6.1], [0.6, 7.4], [0.12, 8.1],
    ],
    28,
  );
  body.scale(1, 0.86, 0.95);
  const fluke = new THREE.Shape();
  fluke.moveTo(0.4, 0);
  fluke.bezierCurveTo(-0.6, 0.6, -1.4, 2.2, -2.2, 2.9);
  fluke.bezierCurveTo(-1.6, 1.6, -1.5, 0.5, -1.9, 0);
  fluke.bezierCurveTo(-1.5, -0.5, -1.6, -1.6, -2.2, -2.9);
  fluke.bezierCurveTo(-1.4, -2.2, -0.6, -0.6, 0.4, 0);
  const flukes = new THREE.ShapeGeometry(fluke, 10);
  flukes.rotateX(Math.PI / 2);
  flukes.translate(-7.7, 0, 0);
  const fins = [1, -1].map((s) => {
    const g = new THREE.SphereGeometry(1, 16, 8);
    g.scale(2.7, 0.12, 0.42);
    g.translate(-2.2, 0, 0);
    g.rotateY(s * 0.55);
    g.rotateX(s * 0.35);
    g.translate(3.2, -0.75, s * 1.25);
    return g;
  });
  const geo = merge([body, flukes, ...fins]);
  const mat = swim(new THREE.MeshStandardMaterial({ color: 0x26343f, roughness: 0.8, metalness: 0.05, side: THREE.DoubleSide }), {
    amp: 0.35, freq: 0.32, speed: 1.1, head: 3, tail: -8, axis: "y",
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.setScalar(1.35);
  const group = new THREE.Group();
  group.add(mesh);
  return {
    group, anchor: () => p.wy(95), xn: 0, z: -66, span: 16,
    update(e) {
      mesh.position.x = ((e.t * 1.8 + 95) % 230) - 115;
      mesh.position.y = Math.sin(e.t * 0.3) * 0.9;
      mesh.rotation.z = Math.cos(e.t * 0.3) * 0.04;
    },
  };
}

// ---------------------------------------------------------------- twilight

export function jellyfish(p: Place, o: { depth: number; xn: number; z: number; size: number; inner: number; rim: number; seed: number }): Creature {
  const bellGeo = new THREE.SphereGeometry(1, 40, 18, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const bellMat = jellyMaterial(new THREE.Color(o.inner), new THREE.Color(o.rim));
  const bell = new THREE.Mesh(bellGeo, bellMat);
  const T = 14, P = 28;
  const pos = new Float32Array(T * (P - 1) * 2 * 3);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const lineMat = new THREE.LineBasicMaterial({
    color: o.rim, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  lines.frustumCulled = false;
  const body = new THREE.Group();
  body.add(bell, lines);
  body.scale.setScalar(o.size);
  const group = new THREE.Group();
  group.add(body);
  const rimY = Math.cos(Math.PI * 0.55);
  const len = 5.5;
  return {
    group, anchor: () => p.wy(o.depth), xn: o.xn, z: o.z, span: 4 + len * o.size,
    update(e) {
      const ph = e.t * 1.5 + o.seed;
      const c = Math.pow(Math.max(0, Math.sin(ph)), 2);
      bell.scale.set(1 - 0.2 * c, 1 + 0.12 * c, 1 - 0.2 * c);
      body.position.y = Math.sin(e.t * 0.22 + o.seed) * 1.2 + c * 0.25;
      body.rotation.y = e.t * 0.05 + o.seed;
      body.rotation.z = Math.sin(e.t * 0.3 + o.seed) * 0.12;
      const fog = Math.exp(-Math.pow(e.fogDensity * -o.z, 2));
      const glow = 0.55 + 0.9 * (1 - e.light);
      bellMat.uniforms.uGlow.value = glow;
      bellMat.uniforms.uFogDensity.value = e.fogDensity;
      lineMat.opacity = 0.38 * fog * glow;
      const rimR = Math.sin(Math.PI * 0.55) * (1 - 0.2 * c) * 0.92;
      let k = 0;
      for (let j = 0; j < T; j++) {
        const th = (j / T) * Math.PI * 2;
        let px = Math.cos(th) * rimR, py = rimY, pz = Math.sin(th) * rimR;
        for (let s = 1; s < P; s++) {
          const f = s / (P - 1);
          const nx = Math.cos(th) * rimR * (1 - 0.35 * f) + Math.sin(e.t * 1.1 + s * 0.33 + j) * 0.22 * f;
          const nz = Math.sin(th) * rimR * (1 - 0.35 * f) + Math.cos(e.t * 0.9 + s * 0.29 + j * 1.7) * 0.22 * f;
          const ny = rimY - f * len * (0.85 + 0.15 * c) + Math.sin(ph - s * 0.25) * 0.05 * s * 0.1;
          pos[k++] = px; pos[k++] = py; pos[k++] = pz;
          pos[k++] = nx; pos[k++] = ny; pos[k++] = nz;
          px = nx; py = ny; pz = nz;
        }
      }
      lineGeo.attributes.position.needsUpdate = true;
    },
  };
}

/** A milling school of lanternfish, each with a light on its flank. */
export function lanternfish(p: Place, o: { depth: number; xn: number; z: number; seed: number }): Creature {
  const N = 90;
  const geo = fishGeometry();
  geo.scale(0.7, 0.7, 0.7);
  const mat = swim(new THREE.MeshStandardMaterial({ color: 0x33434d, metalness: 0.7, roughness: 0.32 }), {
    amp: 0.05, freq: 7, speed: 13, head: 0.05, tail: -0.45, instanced: true,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  const dots = new Float32Array(N * 3);
  const cols = new Float32Array(N * 3);
  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute("position", new THREE.BufferAttribute(dots, 3));
  dotGeo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  const dotMat = new THREE.PointsMaterial({
    map: glowTexture(), size: 0.55, vertexColors: true, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, fog: false, sizeAttenuation: true,
  });
  const photophores = new THREE.Points(dotGeo, dotMat);
  photophores.frustumCulled = false;
  const group = new THREE.Group();
  group.add(mesh, photophores);
  const R = rng(o.seed);
  const fish = Array.from({ length: N }, () => ({
    ph: R() * 1.4, oy: (R() * 2 - 1) * 3, ox: (R() * 2 - 1) * 1.5, oz: (R() * 2 - 1) * 1.5,
    sp: 0.1 + R() * 0.03, blink: R() * 20, wob: R() * 6,
  }));
  const tmp = new THREE.Vector3();
  return {
    group, anchor: () => p.wy(o.depth), xn: o.xn, z: o.z, span: 8,
    update(e) {
      const bright = 0.35 + 0.8 * (1 - e.light);
      for (let i = 0; i < N; i++) {
        const f = fish[i];
        const a = f.ph + e.t * f.sp;
        const x = Math.cos(a) * 9 + f.ox, z = Math.sin(a) * 4 + f.oz;
        const y = f.oy + Math.sin(e.t * 0.6 + f.wob) * 0.35;
        const m = orient(x, y, z, -Math.sin(a) * 9, Math.cos(e.t * 0.6 + f.wob) * 0.2, Math.cos(a) * 4);
        mesh.setMatrixAt(i, m);
        tmp.set(0.08, -0.05, 0.1).applyMatrix4(m);
        dots[i * 3] = tmp.x; dots[i * 3 + 1] = tmp.y; dots[i * 3 + 2] = tmp.z;
        const b = bright * (0.55 + 0.45 * Math.pow(0.5 + 0.5 * Math.sin(e.t * 1.7 + f.blink), 6));
        cols[i * 3] = 0.45 * b; cols[i * 3 + 1] = 0.95 * b; cols[i * 3 + 2] = 1.0 * b;
      }
      mesh.instanceMatrix.needsUpdate = true;
      dotGeo.attributes.position.needsUpdate = true;
      dotGeo.attributes.color.needsUpdate = true;
    },
  };
}

/** A colonial siphonophore: a long glowing chain with light running along it. */
export function siphonophore(p: Place, o: { depth: number; xn: number; z: number }): Creature {
  const N = 130;
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const mat = new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
  const group = new THREE.Group();
  group.add(mesh);
  group.rotation.z = -0.55;
  const col = new THREE.Color();
  const base = new THREE.Color(0x6fe7ff), tip = new THREE.Color(0xb48cff);
  const L = 22;
  return {
    group, anchor: () => p.wy(o.depth), xn: o.xn, z: o.z, span: 12,
    update(e) {
      const fog = Math.exp(-Math.pow(e.fogDensity * -o.z, 2));
      const wave = (e.t * 0.22) % 1.3;
      for (let i = 0; i < N; i++) {
        const s = i / (N - 1);
        const x = (s - 0.5) * L;
        const y = Math.sin(s * 5 + e.t * 0.45) * 1.3;
        const z = Math.sin(s * 3.3 - e.t * 0.35) * 1.8;
        const bell = s < 0.1;
        const r = bell ? 0.32 - s * 1.2 : 0.09 + 0.07 * (0.5 + 0.5 * Math.sin(i * 1.7));
        dummy.position.set(x, y, z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(r, bell ? r * 1.3 : r, r);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        const pulse = Math.exp(-Math.pow(s - wave, 2) / 0.003);
        const k = (0.22 + 1.4 * pulse) * fog * (bell ? 0.5 : 1);
        col.copy(base).lerp(tip, s).multiplyScalar(k);
        mesh.setColorAt(i, col);
      }
      dummy.scale.set(1, 1, 1);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor!.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- midnight

/** An anglerfish, almost invisible except where its own lure lights it. */
export function anglerfish(p: Place, o: { depth: number; xn: number; z: number }): Creature {
  const bodyGeo = latheBody(
    [[0.05, -1.5], [0.3, -1.2], [0.7, -0.8], [1.05, -0.2], [1.12, 0.35], [0.95, 0.85], [0.55, 1.2], [0.1, 1.35]],
    26,
  );
  bodyGeo.scale(1, 1, 0.85);
  const tail = tailFin(0.9, 0.7);
  tail.translate(-1.35, 0, 0);
  const skin = new THREE.MeshStandardMaterial({ color: 0x1b1613, roughness: 0.42, metalness: 0.15, side: THREE.DoubleSide });
  const body = new THREE.Mesh(merge([bodyGeo, tail]), swim(skin, { amp: 0.07, freq: 2, speed: 2.2, head: 0.2, tail: -2.2 }));
  const tooth = new THREE.ConeGeometry(0.035, 0.32, 5);
  const teethMat = new THREE.MeshStandardMaterial({ color: 0xe9e2cf, roughness: 0.3, metalness: 0 });
  const teeth = new THREE.InstancedMesh(tooth, teethMat, 26);
  for (let i = 0; i < 26; i++) {
    const upper = i < 12;
    const n = upper ? 12 : 14;
    const k = upper ? i : i - 12;
    const a = (k / (n - 1) - 0.5) * 2.2;
    dummy.position.set(1.18 + Math.cos(a) * 0.12, upper ? 0.22 : -0.34, Math.sin(a) * 0.55);
    dummy.rotation.set(0, 0, upper ? Math.PI + 0.15 : -0.25);
    const s = 0.7 + 0.6 * Math.abs(Math.sin(i * 2.3));
    dummy.scale.set(1, s, 1);
    dummy.updateMatrix();
    teeth.setMatrixAt(i, dummy.matrix);
  }
  dummy.scale.set(1, 1, 1);
  const eyeGeo = new THREE.SphereGeometry(0.09, 12, 8);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.05, metalness: 0.4 });
  const eyes = [1, -1].map((s) => {
    const m = new THREE.Mesh(eyeGeo, eyeMat);
    m.position.set(0.72, 0.55, s * 0.62);
    return m;
  });
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.55, 0.95, 0), new THREE.Vector3(1.1, 2.0, 0), new THREE.Vector3(2.0, 2.3, 0), new THREE.Vector3(2.7, 1.6, 0),
  ]);
  const rod = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.028, 6), skin);
  const lure = new THREE.Group();
  const esca = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), new THREE.MeshBasicMaterial({ color: 0xeaffff, toneMapped: false }));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: 0x8ff1ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  halo.scale.setScalar(3.4);
  const light = new THREE.PointLight(0x9ff4ff, 28, 10, 1.6);
  lure.add(esca, halo, light);
  lure.position.set(2.72, 1.5, 0);
  const rig = new THREE.Group();
  rig.add(rod, lure);
  const fish = new THREE.Group();
  fish.add(body, teeth, ...eyes, rig);
  fish.rotation.y = -0.45;
  const group = new THREE.Group();
  group.add(fish);
  return {
    group, anchor: () => p.wy(o.depth), xn: o.xn, z: o.z, span: 5,
    update(e) {
      const flick = Math.sin(e.t * 13) > 0.97 ? 0.4 : 1;
      const pulse = (0.75 + 0.25 * Math.sin(e.t * 2.2)) * flick;
      light.intensity = 28 * pulse;
      halo.material.opacity = 0.9 * pulse;
      rig.rotation.z = Math.sin(e.t * 0.8) * 0.06;
      lure.position.y = 1.5 + Math.sin(e.t * 1.6) * 0.07;
      fish.position.y = Math.sin(e.t * 0.35) * 0.5;
      fish.position.x = Math.sin(e.t * 0.12) * 1.2;
      fish.rotation.y = -0.45 + Math.sin(e.t * 0.12) * 0.15;
    },
  };
}

// ---------------------------------------------------------------- abyss

/** A dumbo octopus hovering, ear-fins sculling. Only the lamp shows it. */
export function dumbo(p: Place, o: { depth: number; xn: number; z: number }): Creature {
  const skin = new THREE.MeshStandardMaterial({ color: 0xd98f78, roughness: 0.78, metalness: 0, emissive: 0x3a160c, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
  const mantle = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 24), skin);
  mantle.scale.set(1, 1.18, 0.95);
  mantle.position.y = 0.55;
  const skirtGeo = new THREE.ConeGeometry(1.5, 1.4, 48, 5, true);
  const sp = skirtGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i);
    const a = Math.atan2(z, x);
    const f = (0.7 - y) / 1.4;
    const scallop = 1 - 0.18 * Math.pow(Math.abs(Math.cos(a * 4)), 3) * f;
    sp.setXYZ(i, x * scallop, y, z * scallop);
  }
  skirtGeo.computeVertexNormals();
  const skirt = new THREE.Mesh(skirtGeo, skin);
  skirt.position.y = -0.25;
  const finGeo = new THREE.SphereGeometry(1, 20, 12);
  finGeo.scale(0.62, 0.09, 0.36);
  finGeo.translate(0.5, 0, 0);
  const fins = [1, -1].map((s) => {
    const pivot = new THREE.Group();
    const m = new THREE.Mesh(finGeo, skin);
    pivot.add(m);
    pivot.position.set(s * 0.72, 1.15, 0);
    pivot.scale.x = s;
    return pivot;
  });
  const eyeGeo = new THREE.SphereGeometry(0.17, 12, 8);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0b1320, roughness: 0.15, metalness: 0.3 });
  const eyes = [1, -1].map((s) => {
    const m = new THREE.Mesh(eyeGeo, eyeMat);
    m.position.set(s * 0.42, 0.62, 0.84);
    return m;
  });
  const octo = new THREE.Group();
  octo.add(mantle, skirt, ...fins, ...eyes);
  octo.scale.setScalar(0.85);
  const group = new THREE.Group();
  group.add(octo);
  return {
    group, anchor: () => p.wy(o.depth), xn: o.xn, z: o.z, span: 4,
    update(e) {
      const ph = e.t * 1.25;
      skirt.scale.set(1 + 0.14 * Math.sin(ph), 1 - 0.08 * Math.sin(ph), 1 + 0.14 * Math.sin(ph));
      fins.forEach((f, i) => (f.rotation.z = (i ? -1 : 1) * (0.2 + 0.45 * Math.sin(e.t * 2.6))));
      octo.position.y = Math.sin(e.t * 0.7) * 0.45 - Math.cos(ph) * 0.1;
      octo.rotation.y = Math.sin(e.t * 0.25) * 0.5;
      octo.rotation.z = Math.sin(e.t * 0.4) * 0.08;
    },
  };
}

// ---------------------------------------------------------------- hadal

/** Pale, soft, slow: the deepest fish there is. */
export function snailfish(p: Place, o: { depth: number; xn: number; z: number; seed: number }): Creature {
  const bodyGeo = latheBody(
    [[0.0, -1.7], [0.05, -1.5], [0.12, -1.1], [0.22, -0.55], [0.36, 0], [0.45, 0.35], [0.43, 0.62], [0.3, 0.84], [0.0, 0.95]],
    20,
  );
  bodyGeo.scale(1, 1, 0.75);
  const fold = new THREE.Shape();
  fold.moveTo(0.1, 0.3);
  fold.quadraticCurveTo(-0.9, 0.45, -1.72, 0);
  fold.quadraticCurveTo(-0.9, -0.42, 0.1, -0.28);
  const finFold = new THREE.ShapeGeometry(fold, 8);
  const pecs = [1, -1].map((s) => {
    const g = new THREE.SphereGeometry(1, 14, 8);
    g.scale(0.34, 0.26, 0.03);
    g.translate(-0.18, -0.12, 0);
    g.rotateY(s * 0.9);
    g.translate(0.22, -0.12, s * 0.3);
    return g;
  });
  const mat = new THREE.MeshStandardMaterial({
    color: 0xe7b3a8, roughness: 0.55, metalness: 0, emissive: 0x3a1a14, transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false,
  });
  const body = new THREE.Mesh(merge([bodyGeo, finFold, ...pecs]), swim(mat, { amp: 0.14, freq: 2.2, speed: 3.6, head: 0.1, tail: -1.7 }));
  const eyeGeo = new THREE.SphereGeometry(0.07, 10, 8);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0a0a12, roughness: 0.1, metalness: 0.5 });
  const eyes = [1, -1].map((s) => {
    const e = new THREE.Mesh(eyeGeo, eyeMat);
    e.position.set(0.62, 0.14, s * 0.27);
    return e;
  });
  const mesh = new THREE.Group();
  mesh.add(body, ...eyes);
  const group = new THREE.Group();
  group.add(mesh);
  return {
    group, anchor: () => p.wy(o.depth), xn: o.xn, z: o.z, span: 4,
    update(e) {
      const a = e.t * 0.09 + o.seed;
      mesh.position.set(Math.cos(a) * 3.5, Math.sin(e.t * 0.3 + o.seed) * 0.6, Math.sin(a) * 2);
      mesh.rotation.y = Math.atan2(-Math.cos(a) * 2, -Math.sin(a) * 3.5);
    },
  };
}

/** Rock walls closing in on both sides of the trench. */
export function trenchWalls(p: Place): Creature {
  const H = 320, W = 120;
  const geo = new THREE.PlaneGeometry(W, H, 90, 240);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const n = fbm(x * 0.045 + 3.1, y * 0.03, 5);
    const ridge = 1 - Math.abs(fbm(x * 0.02, y * 0.012 + 9, 3) * 2 - 1);
    pos.setZ(i, (n - 0.5) * 11 + ridge * 5);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0x3e3b38, roughness: 0.95, metalness: 0, flatShading: true, side: THREE.DoubleSide });
  const left = new THREE.Mesh(geo, mat);
  const right = new THREE.Mesh(geo, mat);
  left.rotation.y = Math.PI / 2 - 0.42;
  right.rotation.y = -Math.PI / 2 + 0.42;
  const group = new THREE.Group();
  group.add(left, right);
  let top = 0, bottom = 0;
  return {
    group,
    anchor: () => {
      const a = p.wy(6100);
      if (a === null) return null;
      top = a;
      bottom = p.floorY() ?? a - H;
      return (top + bottom) / 2;
    },
    xn: 0, z: 0, span: H / 2,
    update(e) {
      const span = Math.max(40, top - bottom + 30);
      group.scale.y = span / H;
      const d = 26;
      const x = e.halfW(d) * 0.9;
      left.position.set(-x, 0, -d);
      right.position.set(x, 0, -d);
    },
  };
}

/** The floor of the Challenger Deep: sediment, xenophyophores, and a swarm of amphipods. */
export function seabed(p: Place): Creature {
  const S = 320;
  const height = (x: number, z: number) =>
    (fbm(x * 0.035, z * 0.035, 5) - 0.5) * 4.5 + Math.sin(x * 0.55 + fbm(x * 0.1, z * 0.1, 2) * 6) * 0.12;
  const geo = new THREE.PlaneGeometry(S, S, 160, 160);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, height(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x75695c, roughness: 1, metalness: 0 }));
  ground.position.z = -S / 2 + 10;

  const xenoGeo = new THREE.IcosahedronGeometry(1, 3);
  const xp = xenoGeo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < xp.count; i++) {
    v.fromBufferAttribute(xp, i);
    const n = 1 + (fbm(v.x * 2 + 5, v.y * 2 + v.z * 1.3, 3) - 0.5) * 0.7;
    v.multiplyScalar(n);
    xp.setXYZ(i, v.x, v.y * 0.75, v.z);
  }
  xenoGeo.computeVertexNormals();
  const X = 34;
  const xenos = new THREE.InstancedMesh(xenoGeo, new THREE.MeshStandardMaterial({ color: 0xd9ccb4, roughness: 0.9 }), X);
  const R = rng(99);
  for (let i = 0; i < X; i++) {
    const x = (R() * 2 - 1) * 26, z = -6 - R() * 40;
    const s = 0.18 + R() * 0.35;
    dummy.position.set(x, height(x, z + S / 2 - 10) + s * 0.35, z);
    dummy.rotation.set(R() * 0.4, R() * 6, R() * 0.4);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    xenos.setMatrixAt(i, dummy.matrix);
  }
  dummy.scale.set(1, 1, 1);

  const A = 180;
  const apos = new Float32Array(A * 3);
  const aGeo = new THREE.BufferGeometry();
  aGeo.setAttribute("position", new THREE.BufferAttribute(apos, 3));
  const amphipods = new THREE.Points(aGeo, new THREE.PointsMaterial({ color: 0xf4efe4, size: 0.16, map: glowTexture(), sizeAttenuation: true, transparent: true, opacity: 0.75, depthWrite: false }));
  amphipods.frustumCulled = false;
  const swarm = Array.from({ length: A }, () => ({ r: R() * 2.2, a: R() * 6.283, h: R() * 1.6, sp: 0.6 + R() * 1.4, j: R() * 50 }));
  const bait = new THREE.Vector3(5, 0, -13);
  bait.y = height(bait.x, bait.z + S / 2 - 10) + 0.6;

  const group = new THREE.Group();
  group.add(ground, xenos, amphipods);
  return {
    group,
    anchor: () => {
      const f = p.floorY();
      return f === null ? null : f - 5.5;
    },
    xn: 0, z: 0, span: 30,
    update(e) {
      for (let i = 0; i < A; i++) {
        const s = swarm[i];
        const a = s.a + e.t * s.sp;
        apos[i * 3] = bait.x + Math.cos(a) * s.r + Math.sin(e.t * 7 + s.j) * 0.05;
        apos[i * 3 + 1] = bait.y + s.h + Math.sin(e.t * 3 + s.j) * 0.15;
        apos[i * 3 + 2] = bait.z + Math.sin(a) * s.r;
      }
      aGeo.attributes.position.needsUpdate = true;
    },
  };
}
