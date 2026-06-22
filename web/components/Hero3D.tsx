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

// Renders the 3D hero scene as a non-interactive background layer.
// Falls back to nothing (the hero's CSS gradient wash stays visible) when the
// user prefers reduced motion or WebGL isn't available — so it's never a blank
// canvas or a crash.
export function Hero3D() {
  const reduce = useReducedMotion();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(webglAvailable());
  }, []);

  if (reduce || !ready) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-90">
      <Hero3DScene />
    </div>
  );
}
