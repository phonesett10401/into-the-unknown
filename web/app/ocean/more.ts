import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { tagAt, type Creature, type Place } from "./creatures";
import { fbm, fishGeometry, glowTexture, latheBody, merge, swim } from "./util";

const std = (color: number, o: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.08, ...o });

/** Grey back, white belly: colour each vertex by which way it faces. */
function countershade(geo: THREE.BufferGeometry, top: number, belly: number) {
  const n = geo.attributes.normal;
  const a = new THREE.Color(top), b = new THREE.Color(belly), c = new THREE.Color();
  const col = new Float32Array(n.count * 3);
  for (let i = 0; i < n.count; i++) {
    const t = THREE.MathUtils.smoothstep(n.getY(i), -0.35, 0.25);
    c.copy(b).lerp(a, t);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
}

function glowDot(color: number, size: number) {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
  );
  s.scale.setScalar(size);
  return s;
}

// ---------------------------------------------------------------- sunlight

/** A great white shark cruising a slow circle. */
export function greatWhite(p: Place, o: { depth: number; xn: number; z: number }): Creature {
  const body = latheBody(
    [[0, -2.5], [0.12, -2.1], [0.3, -1.4], [0.55, -0.4], [0.62, 0.4], [0.55, 1.2], [0.38, 1.9], [0.15, 2.35], [0, 2.52]],
    22,
  );
  body.scale(1, 1, 0.82);
  const dorsal = new THREE.ShapeGeometry(
    new THREE.Shape([new THREE.Vector2(0.6, 0.45), new THREE.Vector2(-0.1, 1.45), new THREE.Vector2(-0.45, 0.45)]),
  );
  const caudal = new THREE.ShapeGeometry(
    new THREE.Shape([new THREE.Vector2(-2.3, 0), new THREE.Vector2(-3.25, 1.3), new THREE.Vector2(-2.85, 0.1), new THREE.Vector2(-3.05, -0.85)]),
  );
  const pecs = [1, -1].map((s) => {
    const g = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0.45, 0), new THREE.Vector2(-0.45, 1.05), new THREE.Vector2(-0.15, 0)]));
    g.rotateX(Math.PI / 2);
    g.scale(1, 1, s);
    g.rotateX(s * 0.4);
    g.translate(0.7, -0.35, s * 0.32);
    return g;
  });
  const geo = merge([body, dorsal, caudal, ...pecs]);
  geo.computeVertexNormals();
  countershade(geo, 0x5b6872, 0xe7eaea);
  const mat = swim(std(0xffffff, { vertexColors: true, roughness: 0.42, side: THREE.DoubleSide }), {
    amp: 0.14, freq: 2.2, speed: 4.5, head: 0.6, tail: -3, axis: "z",
  });
  const shark = new THREE.Mesh(geo, mat);
  const group = new THREE.Group();
  group.add(shark);
  return {
    group, anchor: () => p.wy(o.depth), xn: o.xn, z: o.z, span: 5,
    tags: [tagAt(shark, "Great white shark", 0, 1.4, 0)],
    update(e) {
      const a = e.t * 0.14;
      shark.position.set(Math.cos(a) * 5, Math.sin(e.t * 0.3) * 0.5, Math.sin(a) * 2.5);
      shark.rotation.set(0, Math.atan2(-Math.cos(a) * 2.5, -Math.sin(a) * 5), Math.sin(e.t * 0.3) * 0.05);
    },
  };
}

/** A Portuguese man o' war floating at the surface, tentacles trailing down. */
export function manOWar(p: Place): Creature {
  const floatGeo = new THREE.SphereGeometry(1, 24, 16);
  floatGeo.scale(0.9, 0.42, 0.38);
  const crest = new THREE.SphereGeometry(1, 24, 12);
  crest.scale(0.72, 0.34, 0.05);
  crest.translate(0.05, 0.32, 0);
  const float = new THREE.Mesh(
    merge([floatGeo, crest]),
    std(0x9db4ff, { transparent: true, opacity: 0.82, emissive: 0x3a3fa0, roughness: 0.18 }),
  );
  const T = 12, P = 34, len = 7.5;
  const pos = new Float32Array(T * (P - 1) * 6);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const lines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0x7088ff, transparent: true, opacity: 0.55 }));
  lines.frustumCulled = false;
  const body = new THREE.Group();
  body.add(float, lines);
  const group = new THREE.Group();
  group.add(body);
  return {
    group, anchor: () => p.heroY() + 8.6, xn: 0.12, z: -24, span: 9,
    tags: [tagAt(body, "Portuguese man o war", 0, 0.6, 0)],
    update(e) {
      body.position.y = Math.sin(e.t * 0.9) * 0.12;
      body.rotation.z = Math.sin(e.t * 0.7) * 0.06;
      let k = 0;
      for (let j = 0; j < T; j++) {
        const ox = (j / (T - 1) - 0.5) * 1.2, oz = Math.sin(j * 2.1) * 0.2;
        let px = ox, py = -0.3, pz = oz;
        for (let s = 1; s < P; s++) {
          const f = s / (P - 1);
          const nx = ox + Math.sin(e.t * 0.8 + s * 0.3 + j) * 0.35 * f + f * 0.6;
          const ny = -0.3 - f * len * (0.7 + 0.3 * ((j * 7) % 5) / 5);
          const nz = oz + Math.cos(e.t * 0.6 + s * 0.25 + j * 1.3) * 0.3 * f;
          pos[k++] = px; pos[k++] = py; pos[k++] = pz;
          pos[k++] = nx; pos[k++] = ny; pos[k++] = nz;
          px = nx; py = ny; pz = nz;
        }
      }
      lineGeo.attributes.position.needsUpdate = true;
    },
  };
}

/** A scuba diver, about 1.8 m, finning slowly. Extra stage tanks for a record-depth dive. */
export function scubaDiver(p: Place, o: { depth: number; xn: number; z: number; info: string; stageTanks?: boolean }): Creature {
  const suit = std(0x16191e, { roughness: 0.75 });
  const tankMat = std(0xe8b416, { roughness: 0.35, metalness: 0.4 });
  const steel = std(0x9aa3aa, { roughness: 0.3, metalness: 0.7 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.62, 6, 12).rotateZ(Math.PI / 2), suit);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), suit);
  head.position.set(0.56, 0.04, 0);
  const mask = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.2), std(0x223549, { roughness: 0.05, metalness: 0.6 }));
  mask.position.set(0.68, 0.06, 0);
  const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.5, 4, 12).rotateZ(Math.PI / 2), tankMat);
  tank.position.set(-0.02, 0.24, 0);
  const diver = new THREE.Group();
  diver.add(torso, head, mask, tank);
  if (o.stageTanks) {
    [-0.28, 0.28].forEach((zz, i) => {
      const s = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.5, 4, 10).rotateZ(Math.PI / 2), i ? steel : tankMat);
      s.position.set(0.05, -0.08, zz);
      diver.add(s);
    });
    const s3 = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.45, 4, 10).rotateZ(Math.PI / 2), steel);
    s3.position.set(0.1, -0.2, 0.2);
    diver.add(s3);
  }
  const arms = [1, -1].map((s) => {
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.42, 4, 8).rotateZ(Math.PI / 2), suit);
    a.position.set(0.28, -0.1, s * 0.22);
    diver.add(a);
    return a;
  });
  const legs = [1, -1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(-0.42, 0, s * 0.1);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.52, 4, 8).rotateZ(Math.PI / 2), suit);
    leg.position.x = -0.32;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.17), std(o.stageTanks ? 0x1f1f1f : 0xf0c419));
    fin.position.x = -0.78;
    pivot.add(leg, fin);
    diver.add(pivot);
    return pivot;
  });
  const B = 14;
  const bpos = new Float32Array(B * 3);
  const bGeo = new THREE.BufferGeometry();
  bGeo.setAttribute("position", new THREE.BufferAttribute(bpos, 3));
  const bubbles = new THREE.Points(
    bGeo,
    new THREE.PointsMaterial({ map: glowTexture(), color: 0xdff4ff, size: 0.12, transparent: true, opacity: 0.8, depthWrite: false }),
  );
  bubbles.frustumCulled = false;
  const group = new THREE.Group();
  group.add(diver, bubbles);
  void arms;
  return {
    group, anchor: () => p.wy(o.depth), xn: o.xn, z: o.z, span: 3,
    tags: [tagAt(diver, o.info, 0.2, 0.5, 0)],
    update(e) {
      legs.forEach((l, i) => (l.rotation.z = (i ? -1 : 1) * 0.32 * Math.sin(e.t * 2.6)));
      diver.position.set(Math.sin(e.t * 0.08) * 1.5, Math.sin(e.t * 0.5) * 0.15, 0);
      diver.rotation.set(0, Math.cos(e.t * 0.08) > 0 ? 0.25 : Math.PI - 0.25, 0.08 * Math.sin(e.t * 0.5));
      const hx = diver.position.x + (Math.cos(e.t * 0.08) > 0 ? 0.6 : -0.6);
      for (let i = 0; i < B; i++) {
        const f = ((e.t * 0.35 + i / B) % 1);
        bpos[i * 3] = hx + Math.sin(i * 3.1 + e.t) * 0.08;
        bpos[i * 3 + 1] = 0.2 + f * 2.2;
        bpos[i * 3 + 2] = Math.cos(i * 2.3) * 0.08;
      }
      bGeo.attributes.position.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- twilight

/** A nuclear attack submarine gliding through, far enough off to be a shape in the gloom. */
export function nuclearSub(p: Place, o: { depth: number; z: number }): Creature {
  const hull = latheBody(
    [[0, -20], [0.8, -19], [1.6, -16], [2.0, -12], [2.1, -4], [2.1, 12], [1.9, 16], [1.2, 18.8], [0, 20]],
    28,
  );
  const sail = new RoundedBoxGeometry(3.2, 3.2, 0.9, 3, 0.35);
  sail.translate(9, 2.8, 0);
  const planes = new THREE.BoxGeometry(0.6, 0.08, 3.6);
  planes.translate(9, 3.2, 0);
  const rudder = new THREE.BoxGeometry(1.6, 4.2, 0.12);
  rudder.translate(-18, 0, 0);
  const stern = new THREE.BoxGeometry(1.6, 0.12, 4.2);
  stern.translate(-18, 0, 0);
  const geo = merge([hull, sail, planes, rudder, stern]);
  const sub = new THREE.Mesh(geo, std(0x2c3136, { roughness: 0.5, metalness: 0.45 }));
  const group = new THREE.Group();
  group.add(sub);
  return {
    group, anchor: () => p.wy(o.depth), xn: 0, z: o.z, span: 8,
    tags: [tagAt(sub, "Nuclear submarine", 9, 4.6, 0)],
    update(e) {
      sub.position.set(Math.sin(e.t * 0.02) * 18, Math.sin(e.t * 0.2) * 0.3, 0);
      sub.rotation.y = Math.cos(e.t * 0.02) > 0 ? 0 : Math.PI;
    },
  };
}

/** A vampire squid: dark cloak, blue eyes, lights at its arm tips. */
export function vampireSquid(p: Place, o: { depth: number; xn: number; z: number }): Creature {
  const skin = std(0x4a0f18, { roughness: 0.45, emissive: 0x1a0407, side: THREE.DoubleSide });
  const mantle = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), skin);
  mantle.scale.set(0.42, 0.52, 0.4);
  mantle.position.y = 0.45;
  const cloakGeo = new THREE.ConeGeometry(0.85, 0.9, 40, 3, true);
  const cp = cloakGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i);
    const a = Math.atan2(z, x);
    const f = (0.45 - y) / 0.9;
    const k = 1 + 0.22 * Math.pow(Math.abs(Math.cos(a * 4)), 4) * f;
    cp.setXYZ(i, x * k, y, z * k);
  }
  cloakGeo.computeVertexNormals();
  const cloak = new THREE.Mesh(cloakGeo, skin);
  cloak.position.y = -0.2;
  const fins = [1, -1].map((s) => {
    const g = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), skin);
    g.scale.set(0.22, 0.05, 0.14);
    g.position.set(s * 0.42, 0.75, 0);
    return g;
  });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x4d7cff, toneMapped: false });
  const eyes = [1, -1].map((s) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), eyeMat);
    m.position.set(s * 0.2, 0.32, 0.33);
    return m;
  });
  const tips = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const d = glowDot(0x7fe8ff, 0.45);
    d.position.set(Math.cos(a) * 1.05, -0.68, Math.sin(a) * 1.05);
    return d;
  });
  const squid = new THREE.Group();
  squid.add(mantle, cloak, ...fins, ...eyes, ...tips);
  squid.scale.setScalar(1.1);
  const group = new THREE.Group();
  group.add(squid);
  return {
    group, anchor: () => p.wy(o.depth), xn: o.xn, z: o.z, span: 3,
    tags: [tagAt(squid, "Vampire squid", 0, 1.1, 0)],
    update(e) {
      const ph = Math.sin(e.t * 1.1);
      cloak.scale.set(1 + 0.12 * ph, 1 - 0.06 * ph, 1 + 0.12 * ph);
      squid.position.y = Math.sin(e.t * 0.6) * 0.3;
      squid.rotation.set(0.25, e.t * 0.1, Math.sin(e.t * 0.4) * 0.1);
      tips.forEach((t, i) => (t.material.opacity = 0.4 + 0.6 * Math.pow(0.5 + 0.5 * Math.sin(e.t * 2 + i * 0.8), 3)));
    },
  };
}

// ---------------------------------------------------------------- midnight

/** A gulper eel: an enormous loose mouth on a whip of a body, with a light at the tail. */
export function gulperEel(p: Place, o: { depth: number; xn: number; z: number }): Creature {
  const body = latheBody([[0, -5.5], [0.03, -4.5], [0.07, -3], [0.13, -1.5], [0.18, -0.5], [0.2, 0], [0.12, 0.3]], 12);
  const mouth = new THREE.ConeGeometry(0.75, 1.4, 24, 1, true);
  mouth.rotateZ(Math.PI / 2);
  mouth.translate(0.4, 0, 0);
  const mat = swim(std(0x1d1820, { roughness: 0.35, metalness: 0.2, side: THREE.DoubleSide }), {
    amp: 0.35, freq: 1.3, speed: 2.4, head: 0, tail: -5.5, axis: "z",
  });
  const eel = new THREE.Mesh(merge([body, mouth]), mat);
  const lure = glowDot(0xff7ab8, 0.7);
  lure.position.set(-5.5, 0, 0);
  const holder = new THREE.Group();
  holder.add(eel, lure);
  holder.rotation.set(0, -0.5, 0.15);
  const group = new THREE.Group();
  group.add(holder);
  return {
    group, anchor: () => p.wy(o.depth), xn: o.xn, z: o.z, span: 4,
    tags: [tagAt(holder, "Gulper eel", 0.5, 0.9, 0)],
    update(e) {
      holder.position.set(Math.sin(e.t * 0.1) * 1.5, Math.sin(e.t * 0.35) * 0.4, 0);
      lure.material.opacity = 0.5 + 0.5 * Math.pow(0.5 + 0.5 * Math.sin(e.t * 1.7), 4);
      lure.position.z = Math.sin(e.t * 2.4 + 5.5 * 1.3) * 0.35;
    },
  };
}

/** A Cuvier's beaked whale on a record-depth dive: slim, short-beaked, pale-headed. */
export function cuviersWhale(p: Place, o: { depth: number; xn: number; z: number }): Creature {
  const body = latheBody(
    [[0.03, -3], [0.15, -2.7], [0.35, -2], [0.55, -1], [0.62, 0], [0.6, 1], [0.5, 1.9], [0.35, 2.4], [0.18, 2.7], [0.08, 2.95], [0.05, 3.1]],
    24,
  );
  body.scale(1, 0.95, 0.9);
  const fl = new THREE.Shape();
  fl.moveTo(0.1, 0);
  fl.quadraticCurveTo(-0.3, 0.3, -0.7, 0.8);
  fl.quadraticCurveTo(-0.5, 0.2, -0.6, 0);
  fl.quadraticCurveTo(-0.5, -0.2, -0.7, -0.8);
  fl.quadraticCurveTo(-0.3, -0.3, 0.1, 0);
  const flukes = new THREE.ShapeGeometry(fl, 6);
  flukes.rotateX(Math.PI / 2);
  flukes.translate(-2.9, 0, 0);
  const dorsal = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0.2, 0), new THREE.Vector2(-0.25, 0.3), new THREE.Vector2(-0.4, 0)]));
  dorsal.translate(-1.2, 0.5, 0);
  const geo = merge([body, flukes, dorsal]);
  geo.computeVertexNormals();
  const pa = geo.attributes.position;
  const col = new Float32Array(pa.count * 3);
  const dark = new THREE.Color(0x6b6158), pale = new THREE.Color(0xd9d2c8), c = new THREE.Color();
  for (let i = 0; i < pa.count; i++) {
    c.copy(dark).lerp(pale, THREE.MathUtils.smoothstep(pa.getX(i), 1.2, 2.2));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const mat = swim(std(0xffffff, { vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }), {
    amp: 0.12, freq: 1.0, speed: 1.8, head: 1, tail: -3, axis: "y",
  });
  const whale = new THREE.Mesh(geo, mat);
  whale.rotation.set(0, 0.3, -1.25);
  const dir = new THREE.Vector3(1, 0, 0).applyEuler(whale.rotation);
  const group = new THREE.Group();
  group.add(whale);
  return {
    group, anchor: () => p.wy(o.depth), xn: o.xn, z: o.z, span: 4,
    tags: [tagAt(whale, "Cuviers beaked whale", 0.5, 0.9, 0)],
    update(e) {
      const k = Math.sin(e.t * 0.05) * 2.5;
      whale.position.set(dir.x * k, dir.y * k, dir.z * k);
    },
  };
}

// ---------------------------------------------------------------- abyss

/**
 * The abyssal plain, seen as a ledge beside the trench: sediment, a cliff edge,
 * tripod fish standing into the current, sea pigs walking, and Nautile above.
 */
export function abyssalPlain(p: Place, nautile: THREE.Object3D): Creature {
  const W = 150;
  const top = new THREE.PlaneGeometry(W, W, 80, 80);
  top.rotateX(-Math.PI / 2);
  const ground = (x: number, z: number) => (fbm(x * 0.05 + 7, z * 0.05, 4) - 0.5) * 2.2;
  const tp = top.attributes.position;
  for (let i = 0; i < tp.count; i++) tp.setY(i, ground(tp.getX(i) - W / 2 - 3, tp.getZ(i) - 60));
  top.computeVertexNormals();
  const sediment = std(0x5c5146, { roughness: 1, metalness: 0, side: THREE.DoubleSide });
  const ledge = new THREE.Mesh(top, sediment);
  ledge.position.set(-W / 2 - 3, -4, -60);
  const CH = 70;
  const cliffGeo = new THREE.PlaneGeometry(W, CH, 90, 40);
  const cp2 = cliffGeo.attributes.position;
  for (let i = 0; i < cp2.count; i++) cp2.setZ(i, (fbm(cp2.getX(i) * 0.06, cp2.getY(i) * 0.08 + 3, 4) - 0.5) * 4);
  cliffGeo.computeVertexNormals();
  // Fade the cliff to black toward its foot, so it has no visible bottom edge from the trench below.
  const cc = new Float32Array(cp2.count * 3);
  const sedCol = new THREE.Color(0x5c5146);
  for (let i = 0; i < cp2.count; i++) {
    const k = THREE.MathUtils.smoothstep((cp2.getY(i) + CH / 2) / CH, 0.05, 0.75);
    cc[i * 3] = sedCol.r * k; cc[i * 3 + 1] = sedCol.g * k; cc[i * 3 + 2] = sedCol.b * k;
  }
  cliffGeo.setAttribute("color", new THREE.BufferAttribute(cc, 3));
  const cliff = new THREE.Mesh(cliffGeo, std(0xffffff, { vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide }));
  cliff.rotation.y = Math.PI / 2;
  cliff.position.set(-3, -4 - CH / 2, -60);

  const g = (x: number, z: number) => ground(x, z) - 4;
  const tripodMat = std(0x3c4148, { roughness: 0.5, metalness: 0.25 });
  const rayMat = std(0x8a8f96, { roughness: 0.6 });
  const ray = (from: THREE.Vector3, to: THREE.Vector3) => {
    const d = new THREE.Vector3().subVectors(to, from);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, d.length(), 5), rayMat);
    m.position.copy(from).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return m;
  };
  const tripods = [[-8, -14, 0.3], [-14, -21, -0.2], [-6.5, -25, 0.6]].map(([x, z, yaw]) => {
    const fish = new THREE.Group();
    const bodyGeo = fishGeometry();
    bodyGeo.scale(1.3, 1.3, 1.3);
    const b = new THREE.Mesh(bodyGeo, tripodMat);
    b.position.y = 0.9;
    fish.add(b);
    const base = 0;
    fish.add(ray(new THREE.Vector3(0.15, 0.82, 0.12), new THREE.Vector3(0.45, base, 0.35)));
    fish.add(ray(new THREE.Vector3(0.15, 0.82, -0.12), new THREE.Vector3(0.45, base, -0.35)));
    fish.add(ray(new THREE.Vector3(-0.6, 0.85, 0), new THREE.Vector3(-0.95, base, 0)));
    fish.add(ray(new THREE.Vector3(0.3, 0.98, 0.1), new THREE.Vector3(0.95, 1.9, 0.35)));
    fish.add(ray(new THREE.Vector3(0.3, 0.98, -0.1), new THREE.Vector3(0.95, 1.9, -0.35)));
    fish.position.set(x, g(x, z), z);
    fish.rotation.y = yaw;
    return fish;
  });

  const pigMat = std(0xe4a3a0, { roughness: 0.35, transparent: true, opacity: 0.88, emissive: 0x2a0f0e });
  const pigs = Array.from({ length: 5 }, (_, i) => {
    const pig = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), pigMat);
    body.scale.set(0.42, 0.2, 0.22);
    body.position.y = 0.28;
    pig.add(body);
    for (let k = 0; k < 5; k++) {
      [1, -1].forEach((s) => {
        const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.12, 2, 6), pigMat);
        leg.position.set(-0.3 + k * 0.15, 0.1, s * 0.15);
        pig.add(leg);
      });
    }
    [-0.06, 0.06].forEach((zz) => {
      const pap = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.28, 6), pigMat);
      pap.position.set(0.28, 0.5, zz);
      pap.rotation.z = -0.5;
      pig.add(pap);
    });
    const base = new THREE.Vector3(-10 - i * 2.2, 0, -30 - (i % 2) * 3);
    return { pig, base, ph: i * 1.3 };
  });

  nautile.position.set(-12, -0.5, -18);
  nautile.rotation.y = 0.5;

  const group = new THREE.Group();
  group.add(ledge, cliff, ...tripods, ...pigs.map((q) => q.pig), nautile);
  return {
    group, anchor: () => p.wy(5750), xn: 0, z: 0, span: 34,
    tags: [
      tagAt(group, "Tripod fish", tripods[0].position.x, tripods[0].position.y + 2.2, tripods[0].position.z),
      tagAt(pigs[0].pig, "Sea pig", 0, 0.9, 0),
      tagAt(nautile, "DSV Nautile", 0, 1.9, 0),
    ],
    update(e) {
      pigs.forEach((q) => {
        const dx = Math.sin(e.t * 0.04 + q.ph) * 2.5;
        const x = q.base.x + dx, z = q.base.z;
        q.pig.position.set(x, g(x, z), z);
        q.pig.rotation.y = Math.cos(e.t * 0.04 + q.ph) >= 0 ? 0 : Math.PI;
      });
      nautile.position.y = -0.5 + Math.sin(e.t * 0.4) * 0.2;
    },
  };
}
