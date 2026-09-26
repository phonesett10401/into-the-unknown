import * as THREE from "three";
import { tagAt, type Creature, type Place } from "./creatures";
import { fbm, latheBody, merge, swim } from "./util";

/** A sperm whale diving head-first into the dark: box head, underslung jaw, wrinkled skin. */
export function spermWhale(p: Place, o: { depth: number; xn: number; z: number }): Creature {
  const body = latheBody(
    [
      [0.08, -8], [0.3, -7.2], [0.55, -6], [0.95, -4.5], [1.45, -2.5], [1.75, -0.5], [1.85, 1.5],
      [1.9, 3.5], [1.9, 5.5], [1.86, 6.9], [1.6, 7.6], [0.95, 8.0], [0.1, 8.15],
    ],
    32,
  );
  body.scale(1, 1, 0.78);
  body.computeVertexNormals();
  const bp = body.attributes.position;
  const bn = body.attributes.normal;
  const n = new THREE.Vector3();
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i);
    if (x > 4.5) continue;
    n.fromBufferAttribute(bn, i);
    const w = (fbm(x * 1.6, Math.atan2(z, y) * 3, 3) - 0.5) * 0.09 + Math.sin(x * 7 + y) * 0.012;
    bp.setXYZ(i, x + n.x * w, y + n.y * w, z + n.z * w);
  }
  const jaw = new THREE.SphereGeometry(1, 18, 8);
  jaw.scale(2.7, 0.17, 0.3);
  jaw.translate(5.0, -1.58, 0);
  const hump = new THREE.SphereGeometry(1, 14, 8);
  hump.scale(0.9, 0.38, 0.3);
  hump.translate(-3.4, 1.28, 0);
  const flippers = [1, -1].map((s) => {
    const g = new THREE.SphereGeometry(1, 14, 8);
    g.scale(0.95, 0.08, 0.42);
    g.rotateY(s * 0.6);
    g.translate(4.3, -1.15, s * 1.25);
    return g;
  });
  const fluke = new THREE.Shape();
  fluke.moveTo(0.3, 0);
  fluke.lineTo(-1.2, 2.3);
  fluke.quadraticCurveTo(-1.5, 1.0, -1.1, 0);
  fluke.quadraticCurveTo(-1.5, -1.0, -1.2, -2.3);
  fluke.lineTo(0.3, 0);
  const flukes = new THREE.ShapeGeometry(fluke, 6);
  flukes.rotateX(Math.PI / 2);
  flukes.translate(-7.8, 0, 0);
  const geo = merge([body, jaw, hump, ...flippers, flukes]);
  geo.computeVertexNormals();
  const mat = swim(new THREE.MeshStandardMaterial({ color: 0x4d4a47, roughness: 0.82, metalness: 0.05, side: THREE.DoubleSide }), {
    amp: 0.32, freq: 0.34, speed: 0.9, head: 3, tail: -8, axis: "y",
  });
  const whale = new THREE.Mesh(geo, mat);
  whale.rotation.set(0, Math.PI, -1.2);
  const dir = new THREE.Vector3(1, 0, 0).applyEuler(whale.rotation);
  const group = new THREE.Group();
  group.add(whale);
  return {
    group, anchor: () => p.wy(o.depth), xn: o.xn, z: o.z, span: 16,
    tags: [tagAt(whale, "Sperm whale", 2, 2.2, 0)],
    update(e) {
      const k = Math.sin(e.t * 0.035) * 6;
      whale.position.set(dir.x * k, dir.y * k, dir.z * k);
    },
  };
}

/** Giant or colossal squid: mantle, fins, big eyes, eight arms and two club-tipped tentacles. */
export function squid(
  p: Place,
  o: {
    depth: number; xn: number; z: number; seed: number;
    mantleLen: number; mantleR: number; finSpan: number; armLen: number; armR: number; tentLen: number;
    eye: number; color: number; tilt: number; yaw: number; info?: string;
  },
): Creature {
  const L = o.mantleLen, R = o.mantleR;
  const skin = new THREE.MeshStandardMaterial({
    color: o.color, roughness: 0.42, metalness: 0.04, emissive: new THREE.Color(o.color).multiplyScalar(0.1), side: THREE.DoubleSide,
  });
  const mantle = latheBody(
    [[R * 0.82, 0], [R * 0.97, 0.12 * L], [R, 0.32 * L], [R * 0.9, 0.56 * L], [R * 0.6, 0.8 * L], [R * 0.25, 0.95 * L], [0.0, 1.02 * L]],
    26,
  );
  const fin = new THREE.Shape();
  fin.moveTo(0.62 * L, 0);
  fin.quadraticCurveTo(0.8 * L, o.finSpan, 1.0 * L, 0);
  fin.quadraticCurveTo(0.8 * L, -o.finSpan, 0.62 * L, 0);
  const fins = new THREE.ShapeGeometry(fin, 8);
  fins.rotateX(Math.PI / 2);
  const head = new THREE.SphereGeometry(1, 22, 16);
  head.scale(R * 0.95, R * 0.8, R * 0.85);
  head.translate(-R * 0.45, 0, 0);
  const bodyMesh = new THREE.Mesh(merge([mantle, fins, head]), skin);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0b0c14, roughness: 0.06, metalness: 0.35 });
  const eyes = [1, -1].map((s) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(o.eye, 16, 12), eyeMat);
    m.position.set(-R * 0.45, R * 0.12, s * R * 0.72);
    return m;
  });

  const ARM = 8, AS = 12, TS = 26;
  const N = ARM * AS + 2 * TS;
  const limbs = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 7, 1, true), skin, N);
  limbs.frustumCulled = false;
  const hx = -R * 1.25, ring = R * 0.5;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3(), mid = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  const m4 = new THREE.Matrix4();
  const sc = new THREE.Vector3();
  const point = (out: THREE.Vector3, th: number, s: number, len: number, t: number, j: number, tent: boolean) => {
    const spread = ring + s * len * (tent ? 0.08 : 0.2);
    const w = (tent ? 0.18 : 0.26) * len * s * s;
    return out.set(
      hx - s * len,
      Math.cos(th) * spread + Math.sin(t * (tent ? 0.6 : 0.9) + s * 5 + j * 1.3 + o.seed) * w,
      Math.sin(th) * spread + Math.cos(t * (tent ? 0.5 : 0.7) + s * 4.2 + j + o.seed) * w,
    );
  };

  const squidBody = new THREE.Group();
  squidBody.add(bodyMesh, ...eyes, limbs);
  squidBody.rotation.set(0, o.yaw, o.tilt);
  const group = new THREE.Group();
  group.add(squidBody);
  return {
    group, anchor: () => p.wy(o.depth), xn: o.xn, z: o.z, span: 4 + o.tentLen,
    tags: o.info ? [tagAt(squidBody, o.info, L * 0.5, R + 0.15, 0)] : undefined,
    update(e) {
      const t = e.t;
      const pulse = Math.sin(t * 1.1 + o.seed);
      bodyMesh.scale.set(1, 1 + 0.04 * pulse, 1 + 0.04 * pulse);
      squidBody.position.set(Math.sin(t * 0.18 + o.seed) * 1.2, Math.sin(t * 0.27 + o.seed) * 0.6, 0);
      let k = 0;
      for (let j = 0; j < ARM + 2; j++) {
        const tent = j >= ARM;
        const th = tent ? (j === ARM ? 1 : -1) * (Math.PI * 0.5 + 0.35) : (j / ARM) * Math.PI * 2;
        const len = tent ? o.tentLen : o.armLen;
        const segs = tent ? TS : AS;
        for (let s = 0; s < segs; s++) {
          const s0 = s / segs, s1 = (s + 1) / segs;
          point(a, th, s0, len, t, j, tent);
          point(b, th, s1, len, t, j, tent);
          d.subVectors(b, a);
          const l = d.length() || 1e-4;
          q.setFromUnitVectors(Y, d.divideScalar(l));
          const club = tent && s0 > 0.8;
          const r = tent ? (club ? o.armR * 0.75 : o.armR * 0.38 * (1 - s0 * 0.4)) : o.armR * (1 - s0 * 0.85);
          sc.set(r, l * 1.12, club ? r * 0.55 : r);
          mid.addVectors(a, b).multiplyScalar(0.5);
          m4.compose(mid, q, sc);
          limbs.setMatrixAt(k++, m4);
        }
      }
      limbs.instanceMatrix.needsUpdate = true;
    },
  };
}
