"use client";

import { useEffect, useRef } from "react";
import { onCallouts } from "@/lib/callouts";
import { INFO } from "./ocean/info";

const KEYS = Object.keys(INFO);

/**
 * Labels for things in the 3D ocean: a line from the creature or vessel to a
 * card with its name, depth, one line of information and a link to read more.
 * Positions arrive every frame from the scene and are applied directly to the DOM.
 */
export default function Callouts() {
  const cards = useRef<Record<string, HTMLDivElement | null>>({});
  const lines = useRef<Record<string, SVGLineElement | null>>({});
  const dots = useRef<Record<string, SVGCircleElement | null>>({});
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let shown = new Set<string>();
    type Box = { left: number; top: number; right: number; bottom: number };
    // Everything a label must not cover: page text, gates, the floor's badges, and the fixed chrome.
    let obstacleEls: Element[] = [];
    let frame = 0;
    const collect = () => {
      obstacleEls = [...document.querySelectorAll("main > section > *, .hud .readout, .shelf, .eiffel-count, .toast, .diver")];
    };
    return onCallouts((list, compact) => {
      root.current?.classList.toggle("compact", compact);
      const vw = window.innerWidth, vh = window.innerHeight;
      if (frame++ % 30 === 0) collect();
      const obstacles: Box[] = [];
      for (const el of obstacleEls) {
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh || r.width === 0) continue;
        obstacles.push({ left: r.left - 8, top: r.top - 8, right: r.right + 8, bottom: r.bottom + 8 });
      }
      const gap = vw < 640 ? 22 : 44;
      const placed: Box[] = [];
      const hits = (x: number, y: number, w: number, h: number) =>
        [...obstacles, ...placed].some((o) => x < o.right && x + w > o.left && y < o.bottom && y + h > o.top);
      const now = new Set<string>();
      for (const c of list) {
        const el = cards.current[c.key], ln = lines.current[c.key], dot = dots.current[c.key];
        if (!el || !ln || !dot) continue;
        const w = el.offsetWidth, h = el.offsetHeight;
        // Prefer above the target (so the label never hides it), outer side first; then below.
        const outer = c.x > vw / 2 ? 1 : -1;
        let spot: { x: number; y: number } | null = null;
        for (const up of [true, false]) {
          for (const side of [outer, -outer]) {
            let x = side > 0 ? c.x + gap : c.x - gap - w;
            let y = up ? c.y - h - gap : c.y + gap;
            x = Math.max(12, Math.min(vw - w - 12, x));
            y = Math.max(12, Math.min(vh - h - 12, y));
            if (!hits(x, y, w, h)) {
              spot = { x, y };
              break;
            }
          }
          if (spot) break;
        }
        if (!spot) continue; // nowhere clear right now: skip rather than cover text
        now.add(c.key);
        const lx = spot.x, ly = spot.y;
        placed.push({ left: lx - 8, top: ly - 8, right: lx + w + 8, bottom: ly + h + 8 });
        el.style.transform = `translate3d(${lx.toFixed(1)}px, ${ly.toFixed(1)}px, 0)`;
        el.style.opacity = c.a.toFixed(3);
        el.classList.add("on");
        el.setAttribute("aria-hidden", "false");
        const ex = Math.max(lx, Math.min(lx + w, c.x));
        const ey = Math.max(ly, Math.min(ly + h, c.y));
        ln.setAttribute("x1", c.x.toFixed(1));
        ln.setAttribute("y1", c.y.toFixed(1));
        ln.setAttribute("x2", ex.toFixed(1));
        ln.setAttribute("y2", ey.toFixed(1));
        ln.style.opacity = dot.style.opacity = c.a.toFixed(3);
        dot.setAttribute("cx", c.x.toFixed(1));
        dot.setAttribute("cy", c.y.toFixed(1));
      }
      for (const k of shown) {
        if (now.has(k)) continue;
        const el = cards.current[k];
        if (el) {
          el.style.opacity = "0";
          el.classList.remove("on");
          el.setAttribute("aria-hidden", "true");
        }
        const ln = lines.current[k], dot = dots.current[k];
        if (ln) ln.style.opacity = "0";
        if (dot) dot.style.opacity = "0";
      }
      shown = now;
    });
  }, []);

  return (
    <div className="callouts" ref={root}>
      <svg className="callout-lines" aria-hidden="true">
        {KEYS.map((k) => (
          <g key={k}>
            <line
              ref={(el) => {
                lines.current[k] = el;
              }}
            />
            <circle
              r={3.5}
              ref={(el) => {
                dots.current[k] = el;
              }}
            />
          </g>
        ))}
      </svg>
      {KEYS.map((k) => {
        const info = INFO[k];
        return (
          <div
            key={k}
            className="callout"
            aria-hidden="true"
            ref={(el) => {
              cards.current[k] = el;
            }}
          >
            <p className="c-name">{info.name}</p>
            <p className="c-meta">{info.meta}</p>
            <p className="c-note">{info.note}</p>
            <a href={info.url} target="_blank" rel="noreferrer">
              See more ↗
            </a>
          </div>
        );
      })}
    </div>
  );
}
