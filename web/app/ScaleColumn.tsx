"use client";

import { useEffect, useState } from "react";
import buildingsData from "@/lib/buildings.json";
import { useDepth } from "@/lib/dive";

const buildings = buildingsData.buildings;
const DEFAULT = "mahanakhon";
const KEY = "itu-building";

const TOWER = "M9.5 0H10.5V8H12V14H14L15 100H5L6 14H8V8H9.5Z";
const EIFFEL = "M9.6 0H10.4L10.7 10L12.2 30L13.4 50L20 100H15L10 80L5 100H0L6.6 50L7.8 30L9.3 10Z";

/** Stack of the viewer's chosen building, filling from the surface down to the current depth. */
export default function ScaleColumn() {
  const depth = useDepth();
  const [id, setId] = useState(DEFAULT);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved && buildings.some((b) => b.id === saved)) setId(saved);
    } catch {}
  }, []);

  const choose = (v: string) => {
    setId(v);
    try {
      localStorage.setItem(KEY, v);
    } catch {}
  };

  const b = buildings.find((x) => x.id === id) ?? buildings[0];
  const count = depth / b.height;
  const span = Math.max(depth, b.height * 3);
  const fillPct = (depth / span) * 100;
  const n = depth < 1 ? 0 : Math.min(Math.ceil(count), 160);
  const blockPct = depth < 1 ? 0 : (b.height / depth) * 100;
  const shown = count < 10 ? count.toFixed(1) : Math.round(count).toLocaleString("en-US");

  return (
    <aside className="scale" aria-label={`${shown} times ${b.name}`}>
      <label className="scale-pick">
        <span>measure in</span>
        <select value={id} onChange={(e) => choose(e.target.value)}>
          {buildings.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      </label>
      <div className="scale-track">
        <div className="scale-fill" style={{ height: `${fillPct}%` }}>
          {Array.from({ length: n }, (_, k) => (
            <svg
              key={k}
              className="tower"
              style={{ height: `${blockPct}%` }}
              viewBox="0 0 20 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d={b.id === "eiffel" ? EIFFEL : TOWER} />
            </svg>
          ))}
        </div>
      </div>
      <p className="scale-count">
        <strong>{shown} ×</strong>
        <span className="nm">{b.name}</span>
      </p>
    </aside>
  );
}
