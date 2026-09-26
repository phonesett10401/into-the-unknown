import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { floorHeight, tagAt, type Creature, type Place, type Tag } from "./creatures";
import { glowTexture, latheBody } from "./util";

export type SubKind = "alvin" | "shinkai" | "jiaolong" | "nautile" | "trieste" | "challenger" | "limiting" | "fendouzhe";

export const SUB_NAMES: Record<SubKind, string> = {
  alvin: "DSV Alvin",
  shinkai: "DSV Shinkai 6500",
  jiaolong: "DSV Jiaolong",
  nautile: "DSV Nautile",
  trieste: "Bathyscaphe Trieste",
  challenger: "Deepsea Challenger",
  limiting: "DSV Limiting Factor",
  fendouzhe: "Fendouzhe",
};

const mats = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: number, rough = 0.45, metal = 0.1) {
  const k = `${color}-${rough}-${metal}`;
  // A faint self-glow, as if lit by their own lamps, so hulls read in the dark.
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive: color, emissiveIntensity: 0.16 }));
  return mats.get(k)!;
}

/** A hull that is a cylinder with rounded ends, length along x. */
function hull(len: number, r: number) {
  const L = len / 2;
  return latheBody(
    [[0, -L], [r * 0.55, -L + r * 0.25], [r * 0.85, -L + r * 0.6], [r, -L + r * 1.2], [r, L - r * 1.2], [r * 0.85, L - r * 0.6], [r * 0.55, L - r * 0.25], [0, L]],
    28,
  );
}

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  return o;
}

function lamp(x: number, y: number, z: number) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff6dd, toneMapped: false })));
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff0cc, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
  );
  s.scale.setScalar(1.3);
  g.add(s);
  g.position.set(x, y, z);
  return g;
}

function viewports(g: THREE.Group, x: number, y: number, spread: number) {
  const glass = mat(0x1b2733, 0.05, 0.6);
  [-spread, 0, spread].forEach((z) => g.add(mesh(new THREE.SphereGeometry(0.13, 12, 8), glass, x, y, z)));
}

function thrusters(g: THREE.Group, x: number, spread: number, color = 0x222222) {
  [-spread, spread].forEach((z) => {
    const t = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.5, 14, 1, true), mat(color, 0.6), x, 0, z);
    t.rotation.z = Math.PI / 2;
    g.add(t);
  });
}

function xTail(g: THREE.Group, x: number, size: number, color: number) {
  [0, Math.PI / 2].forEach((rot) => {
    const f = mesh(new THREE.BoxGeometry(size * 0.9, size * 2.2, 0.08), mat(color), x, 0, 0);
    f.rotation.x = rot + Math.PI / 4;
    g.add(f);
  });
}

/** Build a submersible at roughly real size (1 unit = 1 m), bow at +x. */
export function buildSub(kind: SubKind): THREE.Group {
  const g = new THREE.Group();
  const white = mat(0xf1efe9);
  switch (kind) {
    case "alvin": {
      g.add(mesh(hull(6.4, 1.25).scale(1, 0.95, 0.9), white));
      g.add(mesh(new RoundedBoxGeometry(1.8, 1.1, 0.5, 3, 0.15), mat(0xd23a26), -0.3, 1.45, 0));
      viewports(g, 3.05, -0.35, 0.35);
      g.add(mesh(new RoundedBoxGeometry(0.9, 0.25, 1.3, 2, 0.06), mat(0x7d858c, 0.6, 0.4), 3.3, -1.05, 0));
      [-0.5, 0.5].forEach((z) => g.add(mesh(new THREE.BoxGeometry(1.1, 0.08, 0.08), mat(0x9aa3aa, 0.4, 0.6), 3.4, -0.75, z)));
      thrusters(g, -3.1, 0.8);
      g.add(lamp(3.1, -0.75, 0.6), lamp(3.1, -0.75, -0.6));
      break;
    }
    case "shinkai": {
      g.add(mesh(hull(9.7, 1.35).scale(1, 1.05, 0.85), white));
      g.add(mesh(new RoundedBoxGeometry(6.6, 0.7, 1.6, 3, 0.2), mat(0xf2b705), 0.2, 1.3, 0));
      viewports(g, 4.55, -0.45, 0.35);
      xTail(g, -4.6, 0.8, 0xf2b705);
      g.add(lamp(4.5, -0.9, 0.55), lamp(4.5, -0.9, -0.55));
      break;
    }
    case "jiaolong": {
      g.add(mesh(hull(8.2, 1.4), white));
      g.add(mesh(new RoundedBoxGeometry(5.6, 0.85, 1.9, 3, 0.25), mat(0xf28c1b), 0, 1.25, 0));
      viewports(g, 3.85, -0.4, 0.4);
      xTail(g, -3.9, 0.9, 0xf28c1b);
      g.add(lamp(3.8, -0.95, 0.6), lamp(3.8, -0.95, -0.6));
      break;
    }
    case "nautile": {
      g.add(mesh(hull(8.0, 1.3), mat(0xf5c518)));
      g.add(mesh(new RoundedBoxGeometry(7.0, 0.55, 2.0, 3, 0.2), white, 0, -0.95, 0));
      g.add(mesh(new RoundedBoxGeometry(1.4, 0.8, 0.5, 3, 0.15), mat(0xf5c518), -0.6, 1.4, 0));
      viewports(g, 3.75, -0.3, 0.35);
      thrusters(g, -3.9, 0.7);
      g.add(lamp(3.7, -0.8, 0.55), lamp(3.7, -0.8, -0.55));
      break;
    }
    case "trieste": {
      g.add(mesh(hull(18.1, 1.9), mat(0xb9c0c4, 0.5, 0.2)));
      g.add(mesh(new RoundedBoxGeometry(2.2, 1.6, 1.2, 3, 0.2), mat(0xa9b0b4, 0.5, 0.2), 0.5, 2.3, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.8, 12), mat(0x4c5357, 0.4, 0.5), 0.5, -2.1, 0));
      g.add(mesh(new THREE.SphereGeometry(1.1, 24, 16), mat(0x4c5357, 0.35, 0.55), 0.5, -3.2, 0));
      g.add(mesh(new THREE.SphereGeometry(0.12, 10, 8), mat(0x1b2733, 0.05, 0.6), 1.55, -3.2, 0));
      [-2.5, 3.5].forEach((x) => g.add(mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.6, 14), mat(0x222222, 0.6), x, -2.3, 0)));
      g.add(lamp(1.6, -3.5, 0));
      break;
    }
    case "challenger": {
      const body = mesh(hull(7.3, 0.75).rotateZ(Math.PI / 2), mat(0x8cc63f, 0.4));
      g.add(body);
      g.add(mesh(new THREE.SphereGeometry(0.62, 20, 14), mat(0x2f3a2f, 0.35, 0.3), 0.35, -3.0, 0));
      g.add(mesh(new THREE.BoxGeometry(2.8, 0.12, 0.12), mat(0x333333, 0.5, 0.5), 1.1, 0.4, 0));
      [0.2, 1.1, 2.3].forEach((x) => g.add(lamp(x, 0.25, 0)));
      break;
    }
    case "limiting": {
      g.add(mesh(new RoundedBoxGeometry(4.6, 3.2, 1.9, 4, 0.35), mat(0xf3f3f0, 0.5)));
      g.add(mesh(new THREE.SphereGeometry(0.75, 20, 14), mat(0x39424a, 0.3, 0.6), 1.9, -0.9, 0));
      g.add(mesh(new THREE.BoxGeometry(4.2, 0.2, 2.1), mat(0x1b1b1b, 0.7), 0, -1.75, 0));
      g.add(mesh(new THREE.BoxGeometry(1.2, 0.3, 0.6), mat(0xf07a1a), -0.6, 1.72, 0));
      [[1.9, 1.2], [-1.9, 1.2], [1.9, -1.2], [-1.9, -1.2]].forEach(([x, z]) => {
        const t = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.45, 12, 1, true), mat(0x1b1b1b, 0.6), x, 0.6, z);
        g.add(t);
      });
      g.add(lamp(2.35, -0.3, 0.6), lamp(2.35, -0.3, -0.6));
      break;
    }
    case "fendouzhe": {
      g.add(mesh(hull(10.2, 1.5), white));
      g.add(mesh(new RoundedBoxGeometry(8.6, 0.8, 2.4, 3, 0.25), mat(0x2f9e5b), 0, -1.05, 0));
      viewports(g, 4.85, -0.35, 0.4);
      xTail(g, -4.9, 1.0, 0x2f9e5b);
      g.add(lamp(4.8, -0.9, 0.6), lamp(4.8, -0.9, -0.6));
      break;
    }
  }
  return g;
}

/** A submersible hovering in open water on its way down. */
export function vessel(p: Place, o: { kind: SubKind; depth: number; xn: number; z: number; yaw: number }): Creature {
  const sub = buildSub(o.kind);
  sub.rotation.y = o.yaw;
  const group = new THREE.Group();
  group.add(sub);
  const top = o.kind === "trieste" ? 3.3 : 2.2;
  return {
    group, anchor: () => p.wy(o.depth), xn: o.xn, z: o.z, span: 6,
    tags: [tagAt(sub, SUB_NAMES[o.kind], 0, top, 0)],
    update(e) {
      sub.position.y = Math.sin(e.t * 0.45 + o.depth) * 0.25;
      sub.rotation.z = Math.sin(e.t * 0.3 + o.depth) * 0.03;
    },
  };
}

/** The four submersibles that reached the bottom, resting on the Challenger Deep. */
export function floorFleet(p: Place): Creature {
  const spots: { kind: SubKind; x: number; z: number; lift: number; yaw: number; top: number }[] = [
    { kind: "trieste", x: 19, z: -32, lift: 9.2, yaw: 0.5, top: 1.6 },
    { kind: "challenger", x: -16.3, z: -24, lift: 9, yaw: 0.3, top: 4.2 },
    { kind: "limiting", x: 10.5, z: -17, lift: 1.9, yaw: -0.6, top: 2.1 },
    { kind: "fendouzhe", x: -12, z: -24, lift: 2.4, yaw: 1.3, top: 1.9 },
  ];
  const group = new THREE.Group();
  const tags: Tag[] = [];
  const subs = spots.map((s) => {
    const sub = buildSub(s.kind);
    sub.position.set(s.x, floorHeight(s.x, s.z) + s.lift, s.z);
    sub.rotation.y = s.yaw;
    group.add(sub);
    tags.push(tagAt(sub, SUB_NAMES[s.kind], 0, s.top, 0));
    return { sub, s, lift: s.lift };
  });
  // Phones: distant, smaller subs placed around the edges, so the floor text and quiz stay clear.
  const NARROW: Record<SubKind, { x: number; z: number; lift: number; k: number }> = {
    challenger: { x: -4.6, z: -40, lift: 5, k: 0.45 },
    trieste: { x: 5.2, z: -46, lift: 6.5, k: 0.4 },
    limiting: { x: 3.8, z: -30, lift: 1.3, k: 0.5 },
    fendouzhe: { x: -3.6, z: -32, lift: 1.2, k: 0.45 },
    alvin: { x: 0, z: -30, lift: 1, k: 0.5 }, shinkai: { x: 0, z: -30, lift: 1, k: 0.5 },
    jiaolong: { x: 0, z: -30, lift: 1, k: 0.5 }, nautile: { x: 0, z: -30, lift: 1, k: 0.5 },
  };
  return {
    group,
    anchor: () => {
      const f = p.floorY();
      return f === null ? null : f - 5.5;
    },
    xn: 0, z: 0, span: 30, tags, fixedScale: true,
    update(e) {
      const narrow = e.halfW(40) < 12;
      const k = Math.min(1, e.halfW(40) / 30);
      subs.forEach((q, i) => {
        const n = NARROW[q.s.kind];
        const x = narrow ? n.x : q.s.x * k, z = narrow ? n.z : q.s.z, lift = narrow ? n.lift : q.lift;
        q.sub.scale.setScalar(narrow ? n.k : 1);
        q.sub.position.set(x, floorHeight(x, z) + lift + Math.sin(e.t * 0.35 + i) * 0.12, z);
      });
    },
  };
}
