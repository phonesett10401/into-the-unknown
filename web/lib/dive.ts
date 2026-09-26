import { useSyncExternalStore } from "react";

/** Where the diver is. Written by the page's scroll loop, read by the HUD and the 3D ocean. */
export type ZoneRect = { top: number; height: number; from: number; to: number };

export const DEPTH_CURVE = 1.4;

export const dive = {
  depth: 0,
  scrollY: 0,
  vh: 800,
  rgb: [42, 143, 196] as [number, number, number],
  zones: [] as ZoneRect[],
  floorTop: null as number | null,
  maxDepth: 10935,
  oceanLive: false, // when the 3D ocean is drawing, the page background is hidden behind it
};

const subs = new Set<() => void>();

export function publish() {
  subs.forEach((fn) => fn());
}

export function subscribe(fn: () => void) {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

/** Depth in whole metres; components using it re-render only when the metre changes. */
export function useDepth() {
  return useSyncExternalStore(
    subscribe,
    () => Math.round(dive.depth),
    () => 0,
  );
}

/** Page scroll position (px) at which the middle of the viewport reads `depth`. Null if not reachable yet. */
export function scrollMidForDepth(depth: number): number | null {
  if (depth >= dive.maxDepth && dive.floorTop !== null) return dive.floorTop;
  for (const z of dive.zones) {
    if (depth >= z.from && depth <= z.to) {
      const t = Math.pow((depth - z.from) / (z.to - z.from), 1 / DEPTH_CURVE);
      return z.top + t * z.height;
    }
  }
  return null;
}

/** Water colour by depth (sRGB 0-255). Shared by the page background and the 3D fog. */
const COLOR_STOPS: [number, [number, number, number]][] = [
  [0, [30, 108, 156]],
  [200, [14, 66, 112]],
  [1000, [6, 30, 62]],
  [4000, [3, 11, 26]],
  [6000, [1, 5, 12]],
  [10935, [0, 1, 3]],
];

export function waterAt(d: number): [number, number, number] {
  for (let i = 1; i < COLOR_STOPS.length; i++) {
    const [d1, c1] = COLOR_STOPS[i];
    const [d0, c0] = COLOR_STOPS[i - 1];
    if (d <= d1) {
      const t = (d - d0) / (d1 - d0);
      return c0.map((v, k) => v + (c1[k] - v) * t) as [number, number, number];
    }
  }
  return COLOR_STOPS[COLOR_STOPS.length - 1][1];
}

/**
 * Viewport height that ignores the phone toolbar showing and hiding during a scroll.
 * Reads a fixed 100lvh probe (the largest viewport), so it only changes on a real resize or rotation.
 */
let probe: HTMLDivElement | null = null;
export function stableVh(): number {
  if (typeof document === "undefined") return 800;
  if (!probe) {
    probe = document.createElement("div");
    probe.style.cssText = "position:fixed;top:0;left:0;width:0;height:100vh;visibility:hidden;pointer-events:none;";
    if (CSS.supports("height", "100lvh")) probe.style.height = "100lvh";
    document.body.appendChild(probe);
  }
  return probe.offsetHeight || window.innerHeight;
}
