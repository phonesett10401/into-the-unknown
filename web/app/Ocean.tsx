"use client";

import { useEffect, useRef } from "react";

/** Mounts the 3D ocean behind the page. Loaded lazily; if it fails, the canvas removes itself. */
export default function Ocean() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let disposed = false;
    let handle: { dispose: () => void } | null = null;
    const hide = () => {
      if (ref.current) ref.current.style.display = "none";
    };
    import("./ocean/scene")
      .then(({ createOcean }) => {
        if (disposed || !ref.current) return;
        try {
          handle = createOcean(ref.current);
        } catch (e) {
          console.warn("Ocean failed to start:", e);
          handle = null;
        }
        if (handle) ref.current.classList.add("live");
        else hide();
      })
      .catch(hide);
    return () => {
      disposed = true;
      handle?.dispose();
    };
  }, []);

  return <canvas ref={ref} className="ocean" aria-hidden="true" />;
}
