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

  useEffect(() => {
    let shown = new Set<string>();
    return onCallouts((list) => {
      const vw = window.innerWidth, vh = window.innerHeight;
      const gap = vw < 640 ? 26 : 44;
      const boxes: { top: number; bottom: number; left: number; right: number }[] = [];
      const now = new Set<string>();
      for (const c of list) {
        const el = cards.current[c.key], ln = lines.current[c.key], dot = dots.current[c.key];
        if (!el || !ln || !dot) continue;
        now.add(c.key);
        const w = el.offsetWidth, h = el.offsetHeight;
        // Put the card on the outer side of the anchor, where the open water is.
        let toRight = c.x > vw / 2;
        if (toRight && c.x + gap + w > vw - 12) toRight = false;
        if (!toRight && c.x - gap - w < 12) toRight = true;
        let lx = toRight ? c.x + gap : c.x - gap - w;
        let ly = c.y - h - gap;
        if (ly < 76) ly = c.y + gap;
        lx = Math.max(12, Math.min(vw - w - 12, lx));
        ly = Math.max(76, Math.min(vh - h - 84, ly));
        for (const b of boxes) {
          const overlapX = lx < b.right + 8 && lx + w > b.left - 8;
          const overlapY = ly < b.bottom + 8 && ly + h > b.top - 8;
          if (overlapX && overlapY) ly = Math.min(vh - h - 84, b.bottom + 10);
        }
        boxes.push({ top: ly, bottom: ly + h, left: lx, right: lx + w });
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
    <div className="callouts">
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
