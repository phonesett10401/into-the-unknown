import * as THREE from "three";
import { dive, scrollMidForDepth, waterAt } from "@/lib/dive";
import { time } from "./util";
import {
  Creature, Env, Place, anglerfish, baitBall, dumbo, jellyfish, lanternfish, seabed, siphonophore, snailfish, trenchWalls, whale,
} from "./creatures";
import { spermWhale, squid } from "./hunters";
import { abyssalPlain, cuviersWhale, greatWhite, gulperEel, manOWar, nuclearSub, scubaDiver, vampireSquid } from "./more";
import { buildSub, floorFleet, vessel } from "./subs";
import { emitCallouts, type Callout } from "@/lib/callouts";

const FOV = 50;
const PLANE = 30; // distance at which the 3D world moves exactly with the page text
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));

/**
 * The ocean behind the page. Returns null if WebGL is unavailable, in which case
 * the page keeps its plain depth-tinted background.
 */
export function createOcean(canvas: HTMLCanvasElement): { dispose: () => void } | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  } catch {
    return null;
  }
  const mobile = window.innerWidth < 700;
  const maxDpr = mobile ? 1.5 : 1.75;
  let dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 1400);
  scene.add(camera);
  const fog = new THREE.FogExp2(0x000000, 0.012);
  scene.fog = fog;
  const water = new THREE.Color();
  const waterVec = new THREE.Vector3();

  // k: world units per page pixel, so the plane at PLANE tracks the text.
  const k = () => (2 * PLANE * TAN) / dive.vh;
  const cameraYForScroll = (scrollMid: number) => -scrollMid * k();

  const place: Place = {
    wy: (d) => {
      const s = scrollMidForDepth(d);
      return s === null ? null : cameraYForScroll(s);
    },
    heroY: () => cameraYForScroll(dive.vh / 2),
    floorY: () => (dive.floorTop === null ? null : cameraYForScroll(dive.floorTop)),
  };

  // ---------- light ----------
  const hemi = new THREE.HemisphereLight(0xc4efff, 0x0b1a24, 1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xe4f7ff, 2);
  scene.add(sun, sun.target);
  const lamp = new THREE.SpotLight(0xfff0d8, 0, 80, 0.85, 0.85, 1.1);
  lamp.position.set(0, 0.6, 0.5);
  lamp.target.position.set(0, -3.5, -24);
  camera.add(lamp, lamp.target);

  // ---------- sky dome: brighter overhead near the surface, horizon = fog ----------
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { uWater: { value: waterVec }, uLight: { value: 1 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 uWater; uniform float uLight; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        vec3 glow = mix(uWater, vec3(0.6, 0.86, 0.97), 0.5);
        vec3 c = mix(uWater, glow, smoothstep(0.04, 0.9, d.y) * uLight);
        c *= mix(1.0, 0.5, smoothstep(0.0, -0.9, d.y));
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), skyMat);
  sky.renderOrder = -10;
  scene.add(sky);

  // ---------- the underside of the surface ----------
  const surfMat = new THREE.ShaderMaterial({
    uniforms: { uWater: { value: waterVec }, uTime: time, uFog: { value: 0.012 } },
    vertexShader: `
      varying vec3 vW; varying float vDist;
      void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vDist = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `
      uniform vec3 uWater; uniform float uTime; uniform float uFog; varying vec3 vW; varying float vDist;
      void main(){
        vec2 p = vW.xz * 0.09;
        float r = sin(p.x * 2.6 + uTime * 0.7 + sin(p.y * 1.9 + uTime * 0.45)) + sin(p.y * 3.3 - uTime * 0.55 + sin(p.x * 1.6));
        r = r * 0.25 + 0.5;
        float ca = abs(sin(p.x * 4.1 + sin(p.y * 2.7 + uTime * 0.9)) * sin(p.y * 4.4 + sin(p.x * 2.3 - uTime * 0.8)));
        float caust = pow(1.0 - ca, 7.0);
        vec3 bright = vec3(0.8, 0.94, 1.0);
        vec3 c = mix(uWater * 1.25, bright, 0.28 + 0.3 * r + 0.35 * caust);
        float fog = exp(-pow(uFog * vDist, 2.0));
        gl_FragColor = vec4(mix(uWater, c, fog), 1.0);
      }`,
    side: THREE.DoubleSide, fog: false,
  });
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(900, 900, 1, 1), surfMat);
  surface.rotation.x = Math.PI / 2;
  scene.add(surface);

  // ---------- light shafts hanging from the surface ----------
  const shaftMat = (seed: number) =>
    new THREE.ShaderMaterial({
      uniforms: { uTime: time, uI: { value: 1 }, uSeed: { value: seed } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform float uTime; uniform float uI; uniform float uSeed; varying vec2 vUv;
        void main(){
          float edge = pow(sin(vUv.x * 3.14159), 2.5);
          float fall = pow(vUv.y, 1.6);
          float flicker = 0.65 + 0.35 * sin(uTime * 0.6 + uSeed * 7.0 + vUv.y * 3.0);
          float a = edge * fall * flicker * uI;
          gl_FragColor = vec4(vec3(0.72, 0.92, 1.0) * a, 1.0);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide,
    });
  const shafts: { m: THREE.Mesh; mat: THREE.ShaderMaterial; x: number; z: number; w: number; tilt: number }[] = [];
  for (let i = 0; i < 11; i++) {
    const mat = shaftMat(i);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    const s = { m, mat, x: (i / 10 - 0.5) * 120 + Math.sin(i * 7.3) * 8, z: -20 - ((i * 37) % 60), w: 2 + ((i * 13) % 5), tilt: 0.28 + Math.sin(i) * 0.06 };
    shafts.push(s);
    scene.add(m);
  }

  // ---------- marine snow: real 3D particles, wrapped around the camera ----------
  const SNOW = mobile ? 1600 : 3400;
  const sp = new Float32Array(SNOW * 3);
  const sa = new Float32Array(SNOW * 2);
  for (let i = 0; i < SNOW; i++) {
    sp[i * 3] = Math.random() * 2 - 1;
    sp[i * 3 + 1] = Math.random() * 2000;
    sp[i * 3 + 2] = -(6 + Math.pow(Math.random(), 1.35) * 95);
    sa[i * 2] = 0.5 + Math.random() * 1.2;
    sa[i * 2 + 1] = Math.random();
  }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  snowGeo.setAttribute("aData", new THREE.BufferAttribute(sa, 2));
  const snowMat = new THREE.ShaderMaterial({
    uniforms: {
      uCamY: { value: 0 }, uTime: time, uTan: { value: TAN }, uAspect: { value: 1 }, uScreenH: { value: 800 },
      uLight: { value: 1 }, uLamp: { value: 0 }, uFog: { value: 0.012 }, uReduced: { value: 0 },
    },
    vertexShader: `
      attribute vec2 aData;
      uniform float uCamY; uniform float uTime; uniform float uTan; uniform float uAspect; uniform float uScreenH;
      uniform float uLight; uniform float uLamp; uniform float uFog;
      varying float vA;
      void main(){
        float dist = -position.z;
        float halfH = uTan * dist * 1.15;
        float span = halfH * 2.0;
        float y0 = position.y - uTime * 0.18 * aData.x;
        float y = uCamY + mod(y0 - uCamY + halfH, span) - halfH;
        float x = position.x * halfH * uAspect * 1.1 + sin(uTime * 0.25 + aData.y * 40.0) * 0.35;
        vec4 mv = viewMatrix * vec4(x, y, position.z, 1.0);
        gl_Position = projectionMatrix * mv;
        float size = 0.045 * aData.x;
        gl_PointSize = clamp(size / (2.0 * uTan * dist) * uScreenH, 1.0, uScreenH * 0.0045);
        vec2 ndc = gl_Position.xy / gl_Position.w;
        float beam = uLamp * exp(-dist / 22.0) * smoothstep(1.1, 0.0, length(ndc * vec2(0.8, 1.0) - vec2(0.0, -0.1)));
        float fog = exp(-pow(uFog * dist, 2.0));
        vA = fog * (0.08 + 0.55 * uLight + 0.85 * beam) * (0.45 + 0.55 * aData.y);
      }`,
    fragmentShader: `
      varying float vA;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.15, d) * vA;
        gl_FragColor = vec4(vec3(0.84, 0.9, 0.95) * a, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const snow = new THREE.Points(snowGeo, snowMat);
  snow.frustumCulled = false;
  scene.add(snow);

  // ---------- bioluminescent flashes ----------
  const BIO = mobile ? 140 : 260;
  const bp = new Float32Array(BIO * 3);
  const ba = new Float32Array(BIO * 3);
  for (let i = 0; i < BIO; i++) {
    bp[i * 3] = Math.random() * 2 - 1;
    bp[i * 3 + 1] = Math.random() * 2000;
    bp[i * 3 + 2] = -(8 + Math.random() * 70);
    ba[i * 3] = 0.25 + Math.random() * 0.9;
    ba[i * 3 + 1] = Math.random() * 100;
    ba[i * 3 + 2] = Math.random();
  }
  const bioGeo = new THREE.BufferGeometry();
  bioGeo.setAttribute("position", new THREE.BufferAttribute(bp, 3));
  bioGeo.setAttribute("aData", new THREE.BufferAttribute(ba, 3));
  const bioMat = new THREE.ShaderMaterial({
    uniforms: { uCamY: { value: 0 }, uTime: time, uTan: { value: TAN }, uAspect: { value: 1 }, uScreenH: { value: 800 }, uAmt: { value: 0 }, uFog: { value: 0.02 } },
    vertexShader: `
      attribute vec3 aData;
      uniform float uCamY; uniform float uTime; uniform float uTan; uniform float uAspect; uniform float uScreenH; uniform float uAmt; uniform float uFog;
      varying float vA; varying float vHue;
      void main(){
        float dist = -position.z;
        float halfH = uTan * dist * 1.15;
        float y = uCamY + mod(position.y - uCamY + halfH, halfH * 2.0) - halfH;
        vec4 mv = viewMatrix * vec4(position.x * halfH * uAspect * 1.1, y, position.z, 1.0);
        gl_Position = projectionMatrix * mv;
        float flash = pow(0.5 + 0.5 * sin(uTime * aData.x + aData.y), 14.0);
        float fog = exp(-pow(uFog * dist * 0.7, 2.0));
        vA = flash * uAmt * fog;
        vHue = aData.z;
        gl_PointSize = clamp(0.5 / (2.0 * uTan * dist) * uScreenH, 2.0, uScreenH * 0.02) * (0.6 + 0.8 * flash);
      }`,
    fragmentShader: `
      varying float vA; varying float vHue;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float core = smoothstep(0.12, 0.0, d);
        float halo = smoothstep(0.5, 0.0, d) * 0.35;
        vec3 c = mix(vec3(0.25, 0.95, 1.0), vec3(0.35, 0.55, 1.0), step(0.6, vHue));
        gl_FragColor = vec4(c * (core + halo) * vA, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const bio = new THREE.Points(bioGeo, bioMat);
  bio.frustumCulled = false;
  scene.add(bio);

  // ---------- creatures ----------
  const creatures: Creature[] = [
    baitBall(place),
    manOWar(place),
    scubaDiver(place, { depth: 40, xn: 0.35, z: -8, info: "Recreational scuba" }),
    whale(place),
    greatWhite(place, { depth: 150, xn: 0.45, z: -20 }),
    scubaDiver(place, { depth: 332, xn: -0.35, z: -8, info: "Ahmed Gabr", stageTanks: true }),
    nuclearSub(place, { depth: 500, z: -42 }),
    vampireSquid(place, { depth: 720, xn: -0.55, z: -10 }),
    gulperEel(place, { depth: 2700, xn: 0.5, z: -16 }),
    cuviersWhale(place, { depth: 3000, xn: 0.35, z: -24 }),
    abyssalPlain(place, buildSub("nautile")),
    vessel(place, { kind: "alvin", depth: 6450, xn: 0.5, z: -26, yaw: -0.5 }),
    vessel(place, { kind: "shinkai", depth: 6750, xn: 0.3, z: -32, yaw: 0.6 }),
    vessel(place, { kind: "jiaolong", depth: 7062, xn: 0.5, z: -28, yaw: -0.4 }),
    floorFleet(place),
    jellyfish(place, { depth: 290, xn: -0.62, z: -24, size: 1.3, inner: 0x7b86e0, rim: 0xc6ecff, seed: 1, info: "Jellyfish" }),
    jellyfish(place, { depth: 380, xn: -0.66, z: -16, size: 0.9, inner: 0xd08ac0, rim: 0xffd3f0, seed: 2.4 }),
    jellyfish(place, { depth: 470, xn: -0.2, z: -48, size: 1.6, inner: 0x6f8fe8, rim: 0xbfe6ff, seed: 4.1 }),
    lanternfish(place, { depth: 610, xn: -0.5, z: -30, seed: 11, info: "Lanternfish" }),
    jellyfish(place, { depth: 900, xn: -0.8, z: -40, size: 0.8, inner: 0x86a0ff, rim: 0xd7f3ff, seed: 5.3 }),
    squid(place, {
      depth: 800, xn: -0.42, z: -22, seed: 1.7, mantleLen: 2.3, mantleR: 0.36, finSpan: 0.45,
      armLen: 2.9, armR: 0.085, tentLen: 7.5, eye: 0.19, color: 0xa9493c, tilt: 0.35, yaw: 0.5, info: "Giant squid",
    }),
    jellyfish(place, { depth: 960, xn: -0.7, z: -30, size: 1.2, inner: 0xc07ad8, rim: 0xf0d0ff, seed: 6.6 }),
    spermWhale(place, { depth: 1150, xn: 0.46, z: -32 }),
    siphonophore(place, { depth: 1450, xn: 0.3, z: -42 }),
    lanternfish(place, { depth: 1600, xn: 0.55, z: -34, seed: 23 }),
    squid(place, {
      depth: 1850, xn: 0.5, z: -20, seed: 4.2, mantleLen: 2.5, mantleR: 0.82, finSpan: 1.1,
      armLen: 2.1, armR: 0.17, tentLen: 3.6, eye: 0.28, color: 0x96302c, tilt: -0.25, yaw: -0.45, info: "Colossal squid",
    }),
    jellyfish(place, { depth: 2050, xn: -0.75, z: -45, size: 1.1, inner: 0x7a0f22, rim: 0x46a8ff, seed: 7.7 }),
    anglerfish(place, { depth: 2400, xn: 0.48, z: -15 }),
    jellyfish(place, { depth: 3350, xn: 0.62, z: -20, size: 1.0, inner: 0x8a1428, rim: 0x3f9dff, seed: 9.1 }),
    dumbo(place, { depth: 4900, xn: -0.5, z: -20 }),
    trenchWalls(place),
    snailfish(place, { depth: 7600, xn: 0.45, z: -18, seed: 0.5, info: "Hadal snailfish" }),
    snailfish(place, { depth: 7900, xn: 0.5, z: -24, seed: 2.2 }),
    snailfish(place, { depth: 8200, xn: 0.3, z: -30, seed: 4.4 }),
    seabed(place),
  ];
  creatures.forEach((c) => scene.add(c.group));

  // ---------- sizing ----------
  let aspect = 1;
  // On narrow screens, shrink each creature together with its movement so it stays in view.
  let narrowK = 1;
  const resize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    aspect = w / h;
    narrowK = aspect < 1 ? Math.max(0.5, aspect / 0.9) : 1;
    renderer.setSize(w, h, false);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    snowMat.uniforms.uAspect.value = aspect;
    snowMat.uniforms.uScreenH.value = h * dpr;
    bioMat.uniforms.uAspect.value = aspect;
    bioMat.uniforms.uScreenH.value = h * dpr;
  };
  resize();
  window.addEventListener("resize", resize);

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const halfW = (dist: number) => TAN * dist * aspect;

  // ---------- loop ----------
  let camY: number | null = null;
  let depthS = 0;
  let last = performance.now();
  let raf = 0;
  let slow = 0;
  const env: Env = { t: 0, dt: 0, camY: 0, light: 1, lamp: 0, fogDensity: 0.012, halfW };
  const tagPos = new THREE.Vector3();
  const cands: (Callout & { score: number })[] = [];

  const frame = () => {
    raf = requestAnimationFrame(frame);
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!reduced) time.value += dt;

    // Adaptive quality: if frames are slow for a while, render fewer pixels.
    slow = dt > 0.034 ? slow + dt : Math.max(0, slow - dt * 0.5);
    if (slow > 1.5 && dpr > 0.75) {
      dpr = Math.max(0.75, dpr - 0.25);
      renderer.setPixelRatio(dpr);
      resize();
      slow = 0;
    }

    let target = cameraYForScroll(dive.scrollY + dive.vh / 2);
    const floor = place.floorY();
    if (floor !== null) target = Math.max(target, floor);
    const ease = reduced ? 1 : 1 - Math.exp(-dt * 10);
    camY = camY === null ? target : camY + (target - camY) * ease;
    depthS = depthS + (dive.depth - depthS) * (reduced ? 1 : 1 - Math.exp(-dt * 8));
    camera.position.set(0, camY, 0);

    const light = Math.exp(-depthS / 170);
    const lampK = Math.pow(1 - light, 1.5);
    const fogD = 0.011 + 0.016 * (1 - light);
    const rgb = waterAt(depthS);
    water.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace);
    fog.color.copy(water);
    fog.density = fogD;
    waterVec.set(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
    renderer.setClearColor(water);

    hemi.intensity = 0.12 + 2.0 * light;
    sun.intensity = 3.2 * light;
    sun.position.set(camY * 0 + 12, camY + 40, 10);
    sun.target.position.set(0, camY, -30);
    lamp.intensity = 90 * lampK;

    sky.position.copy(camera.position);
    skyMat.uniforms.uLight.value = light;
    const heroY = place.heroY();
    surface.position.set(0, heroY + 9, -420);
    surfMat.uniforms.uFog.value = fogD;
    surface.visible = camY > heroY - 60;
    for (const s of shafts) {
      s.m.visible = light > 0.03;
      s.m.position.set(s.x, heroY + 9 - 38, s.z);
      s.m.scale.set(s.w, 76, 1);
      s.m.rotation.z = s.tilt + Math.sin(time.value * 0.15 + s.x) * 0.025;
      s.mat.uniforms.uI.value = 0.2 * light * Math.exp(-Math.pow(fogD * -s.z, 2));
    }

    snowMat.uniforms.uCamY.value = camY;
    snowMat.uniforms.uLight.value = light;
    snowMat.uniforms.uLamp.value = lampK;
    snowMat.uniforms.uFog.value = fogD;
    bioMat.uniforms.uCamY.value = camY;
    bioMat.uniforms.uFog.value = fogD;
    bioMat.uniforms.uAmt.value = THREE.MathUtils.smoothstep(depthS, 150, 700) * (1 - THREE.MathUtils.smoothstep(depthS, 6500, 9500)) * 1.4;

    env.t = time.value; env.dt = dt; env.camY = camY; env.light = light; env.lamp = lampK; env.fogDensity = fogD;
    const viewHalf = TAN * 100;
    for (const c of creatures) {
      const y = c.anchor();
      if (y === null || Math.abs(y - camY) > c.span + viewHalf) {
        c.group.visible = false;
        continue;
      }
      c.group.visible = true;
      c.group.position.set(c.xn * halfW(-c.z || PLANE), y, c.z);
      if (!c.fixedScale) c.group.scale.setScalar(narrowK);
      c.update(env);
    }

    renderer.render(scene, camera);

    const W = window.innerWidth, H = window.innerHeight;
    cands.length = 0;
    for (const c of creatures) {
      if (!c.group.visible || !c.tags) continue;
      for (const t of c.tags) {
        t.at.getWorldPosition(tagPos);
        const dist = tagPos.distanceTo(camera.position);
        tagPos.project(camera);
        if (tagPos.z > 1 || Math.abs(tagPos.x) > 0.94 || tagPos.y > 0.9 || tagPos.y < -0.8) continue;
        const fogK = Math.exp(-Math.pow(fogD * dist, 2));
        if (fogK < 0.15) continue;
        const a = Math.min(1, ((tagPos.y > 0 ? 0.9 : 0.8) - Math.abs(tagPos.y)) / 0.12);
        cands.push({
          key: t.key,
          x: ((tagPos.x + 1) / 2) * W,
          y: ((1 - tagPos.y) / 2) * H,
          a,
          score: Math.abs(tagPos.y) + 0.3 * Math.abs(tagPos.x),
        });
      }
    }
    cands.sort((p1, p2) => p1.score - p2.score);
    const atFloor = floor !== null && camY - floor < 1;
    emitCallouts(atFloor ? cands : cands.slice(0, W < 640 ? 2 : 3), atFloor);
  };
  frame();

  const onLost = (e: Event) => {
    e.preventDefault();
    cancelAnimationFrame(raf);
    canvas.style.display = "none";
  };
  canvas.addEventListener("webglcontextlost", onLost);

  return {
    dispose() {
      cancelAnimationFrame(raf);
      emitCallouts([]);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("webglcontextlost", onLost);
      renderer.dispose();
    },
  };
}
