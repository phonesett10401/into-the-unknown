"use client";

import { useEffect, useRef } from "react";
import { dive, subscribe } from "@/lib/dive";

const TOWER_M = 330; // Eiffel Tower to the antenna tip
const DIVER_M = 2.3; // a 1.8 m diver plus fins
const SLOTS = 3;
const TOTAL = Math.ceil(10935 / TOWER_M);

// The image is cropped antenna tip to feet; ASPECT is its width over height.
const ASPECT = 2330 / 3548;
// Half-width of the tower, measured from the image, in units where the tower is 330 tall.
const PROFILE: [number, number][] = [
  [0, 0.5], [15, 1], [30, 9.9], [45, 8], [75, 8.4], [105, 9.1], [135, 10.6], [165, 12.8], [195, 16.4], [210, 21.4],
  [225, 21.6], [240, 25.7], [255, 30.3], [270, 36.6], [285, 41.3], [300, 49.9], [315, 58.4], [330, 108],
];
function halfWidth(y: number) {
  for (let i = 1; i < PROFILE.length; i++) {
    const [y1, w1] = PROFILE[i];
    const [y0, w0] = PROFILE[i - 1];
    if (y <= y1) return w0 + ((w1 - w0) * (y - y0)) / (y1 - y0);
  }
  return 108;
}

/**
 * Eiffel Towers stacked tip to base down the left side, at one constant giant scale.
 * You pass them one at a time; a diver drawn at the same scale marks where you are.
 */
export default function EiffelColumn() {
  const towers = useRef<(HTMLImageElement | null)[]>([]);
  const diver = useRef<HTMLDivElement>(null);
  const count = useRef<HTMLParagraphElement>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let lastPx = 0, lastO = "";
    const update = () => {
      const vh = dive.vh, vw = window.innerWidth;
      const px = vh * 2.6;
      const ppm = px / TOWER_M;
      const w = px * ASPECT;
      const cx = vw < 640 ? vw * 0.1 : vw * 0.09;
      const d = dive.depth;
      const first = Math.floor(d / TOWER_M) - 1;
      for (let i = 0; i < SLOTS; i++) {
        const el = towers.current[i];
        if (!el) continue;
        const k = first + i;
        if (k < 0 || k >= TOTAL) {
          el.style.visibility = "hidden";
          continue;
        }
        const top = (k * TOWER_M - d) * ppm + vh / 2;
        el.style.visibility = "visible";
        if (px !== lastPx) {
          el.style.height = `${px}px`;
          el.style.width = `${w}px`;
        }
        el.style.transform = `translate3d(${cx - w / 2}px, ${top}px, 0)`;
      }
      if (diver.current) {
        const within = ((d % TOWER_M) + TOWER_M) % TOWER_M;
        const edge = (halfWidth((within / TOWER_M) * 330) / 330) * px;
        diver.current.style.transform = `translate3d(${cx + Math.min(edge, 44) + 8}px, ${vh / 2}px, 0)`;
        diver.current.style.setProperty("--diver-h", `${Math.max(4, DIVER_M * ppm)}px`);
      }
      if (count.current) {
        const n = d / TOWER_M;
        count.current.textContent = d < 1 ? "0 Eiffel Towers down" : `${n < 10 ? n.toFixed(1) : Math.round(n)} Eiffel Towers down`;
      }
      lastPx = px;
      if (root.current) {
        // Dim with opacity only: it is composited, where a changing filter would repaint the image.
        const o = (0.14 + 0.5 * Math.exp(-d / 170)).toFixed(3);
        if (o !== lastO) root.current.style.setProperty("--tower-o", o);
        lastO = o;
      }
    };
    update();
    window.addEventListener("resize", update);
    const unsub = subscribe(update);
    return () => {
      unsub();
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div className="eiffel" ref={root} aria-hidden="true">
      {Array.from({ length: SLOTS }, (_, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <picture key={i}>
          {/* Phones get a small pre-tinted image; desktops keep the detailed drawing. */}
          <source media="(max-width: 700px), (pointer: coarse)" srcSet="/eiffel-m.webp" />
          <img
            ref={(el) => {
              towers.current[i] = el;
            }}
            className="tower-img"
            src="/eiffel.svg"
            alt=""
            draggable={false}
            decoding="async"
          />
        </picture>
      ))}
      <div className="diver" ref={diver}>
        <svg viewBox="0 0 10 30" className="diver-body">
          <path d="M3 1 L2 5 L4 6 L5 3 Z M7 1 L8 5 L6 6 L5 3 Z" fill="#f4d35e" />
          <rect x="3.6" y="5" width="2.8" height="14" rx="1.4" fill="#e9eef2" />
          <rect x="1.9" y="7" width="1.8" height="8" rx="0.9" fill="#f4d35e" />
          <circle cx="5" cy="22.5" r="3" fill="#e9eef2" />
          <rect x="3.2" y="21.2" width="3.6" height="1.6" rx="0.8" fill="#7fe3ff" />
          <path d="M2 11 L0.6 17 M8 11 L9.4 17" stroke="#e9eef2" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
        <span className="diver-tag">You, 1.8 m</span>
      </div>
      <p className="eiffel-count" ref={count} />
    </div>
  );
}
