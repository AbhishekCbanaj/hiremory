"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

// Canvas is client-only — never server-rendered (avoids SSR/hydration crashes).
const Hero3DScene = dynamic(() => import("./Hero3DScene"), { ssr: false });

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return (
      !!window.WebGLRenderingContext &&
      !!(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

// Interactive 3D hero centerpiece. Fills its container; drag the gem to rotate
// it. Falls back to a soft gradient orb when the user prefers reduced motion or
// WebGL is unavailable — never a blank canvas or a crash.
export function Hero3D() {
  const reduce = useReducedMotion();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(webglAvailable());
  }, []);

  if (reduce || !ready) {
    return (
      <div className="absolute inset-0 grid place-items-center" aria-hidden>
        <div className="h-64 w-64 rounded-full bg-gradient-to-br from-sage/40 via-clay/30 to-amber/20 blur-2xl" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      <Hero3DScene />
      <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-white/60 bg-white/60 px-3 py-1 text-[12px] text-ink2 backdrop-blur">
        Drag to rotate
      </span>
    </div>
  );
}
