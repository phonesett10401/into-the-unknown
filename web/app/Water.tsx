"use client";

import { useEffect, useRef } from "react";

export type WaterState = { depth: number; travel: number; rgb: [number, number, number] };

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 uRes;
uniform float uScale;
uniform float uTime;
uniform float uDepth;
uniform float uTravel;
uniform vec3 uWater;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float snow(vec2 css, float cell, float speed, float size, float seed) {
  vec2 p = css / cell;
  p.y -= mod(uTravel * speed, cell * 512.0) / cell;
  p.y += uTime * 0.03 * speed;
  vec2 id = floor(p);
  vec2 f = fract(p);
  float h = hash(id + seed);
  vec2 c = vec2(hash(id + seed + 1.3), hash(id + seed + 7.1));
  c.x += 0.12 * sin(uTime * 0.4 + h * 6.283);
  float d = length(f - c) * cell;
  return step(0.5, h) * smoothstep(size, 0.0, d);
}

float bio(vec2 css) {
  float cell = 150.0;
  vec2 p = css / cell;
  p.y -= mod(uTravel * 0.7, cell * 512.0) / cell;
  vec2 id = floor(p);
  vec2 f = fract(p);
  float h = hash(id + 3.7);
  if (h < 0.9) return 0.0;
  vec2 c = vec2(hash(id + 2.0), hash(id + 5.0));
  float d = length(f - c) * cell;
  float pulse = pow(0.5 + 0.5 * sin(uTime * (0.8 + h * 2.5) + h * 40.0), 5.0);
  return pulse * (exp(-d / 5.0) + 0.35 * exp(-d / 22.0));
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 css = gl_FragCoord.xy / uScale;
  float aspect = uRes.x / uRes.y;
  float light = exp(-uDepth / 170.0);

  vec3 col = uWater;
  col *= mix(1.0, 0.7 + 0.6 * uv.y, light);

  float x = uv.x + (1.0 - uv.y) * 0.35;
  float rays = (0.5 + 0.5 * sin(x * 9.0 + uTime * 0.3)) * (0.5 + 0.5 * sin(x * 23.0 - uTime * 0.21));
  rays = pow(rays, 3.0) * smoothstep(0.1, 1.0, uv.y);
  col += vec3(0.55, 0.8, 1.0) * rays * light * 0.32;

  float ca = sin(uv.x * 22.0 * aspect + sin(uv.y * 13.0 + uTime * 0.9)) * sin(uv.y * 19.0 + sin(uv.x * 11.0 * aspect - uTime * 0.7));
  col += vec3(0.6, 0.9, 1.0) * pow(abs(ca), 7.0) * light * light * 0.22 * smoothstep(0.45, 1.0, uv.y);

  vec2 q = (uv - vec2(0.5, 0.55)) * vec2(aspect, 1.0);
  float lamp = (1.0 - light) * smoothstep(0.85, 0.0, length(q));
  col += vec3(0.16, 0.24, 0.3) * lamp * 0.35;

  float s = snow(css, 90.0, 1.0, 1.7, 0.0) + 0.55 * snow(css, 150.0, 0.55, 2.4, 11.0) + 0.8 * snow(css, 60.0, 1.5, 1.1, 23.0);
  col += vec3(0.78, 0.88, 0.96) * s * (0.1 + 0.45 * light + 0.55 * lamp);

  float bioAmt = smoothstep(150.0, 700.0, uDepth) * (1.0 - smoothstep(6500.0, 9500.0, uDepth));
  float b = bio(css);
  vec3 bioCol = mix(vec3(0.15, 0.95, 1.0), vec3(0.35, 0.55, 1.0), step(0.5, hash(floor(css / 150.0))));
  col += bioCol * b * bioAmt * 0.9;

  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.warn("Water shader failed:", gl.getShaderInfoLog(s));
    return null;
  }
  return s;
}

/**
 * Optional WebGL water behind the page. If anything fails, it removes itself and
 * the page keeps its plain depth-tinted background.
 */
export default function Water({ state }: { state: React.MutableRefObject<WaterState> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fail = () => {
      canvas.style.display = "none";
    };

    let gl: WebGLRenderingContext | null = null;
    try {
      gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
    } catch {
      gl = null;
    }
    if (!gl) return fail();

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return fail();
    const prog = gl.createProgram();
    if (!prog) return fail();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return fail();
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const u = (n: string) => gl!.getUniformLocation(prog, n);
    const uRes = u("uRes"), uScale = u("uScale"), uTime = u("uTime"), uDepth = u("uDepth"), uTravel = u("uTravel"), uWater = u("uWater");

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let scale = 1;
    const resize = () => {
      const mobile = window.innerWidth < 700;
      scale = Math.min(window.devicePixelRatio || 1, 1) * (mobile ? 0.6 : 0.8);
      canvas.width = Math.max(1, Math.round(window.innerWidth * scale));
      canvas.height = Math.max(1, Math.round(window.innerHeight * scale));
      gl!.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    const lost = (e: Event) => {
      e.preventDefault();
      fail();
    };
    canvas.addEventListener("webglcontextlost", lost);

    let raf = 0;
    const t0 = performance.now();
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const s = state.current;
      gl!.uniform2f(uRes, canvas.width, canvas.height);
      gl!.uniform1f(uScale, scale);
      gl!.uniform1f(uTime, reduce ? 0 : (performance.now() - t0) / 1000);
      gl!.uniform1f(uDepth, s.depth);
      gl!.uniform1f(uTravel, s.travel);
      gl!.uniform3f(uWater, s.rgb[0] / 255, s.rgb[1] / 255, s.rgb[2] / 255);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    };
    frame();
    canvas.style.opacity = "1";

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("webglcontextlost", lost);
    };
  }, [state]);

  return <canvas ref={canvasRef} className="water" aria-hidden="true" />;
}
