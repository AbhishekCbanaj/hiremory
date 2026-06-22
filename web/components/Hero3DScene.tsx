"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

// Hiremory "Momentum" palette
const EMERALD = 0x0b8f66;
const EMERALD_DARK = 0x047857;
const SAGE = 0x34d399;
const AMBER = 0xd97706;

type Spec = {
  geo: THREE.BufferGeometry;
  color: number;
  pos: [number, number, number];
  scale: number;
  wire: boolean;
  spin: number; // rotation speed
  phase: number; // float phase
};

// Vanilla Three.js (no react-reconciler) — works on any React/Next version.
export default function Hero3DScene() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 7);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    mount.appendChild(renderer.domElement);

    // ---- lights (physically-based units in three r16x) ----
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const dir = new THREE.DirectionalLight(0xffffff, 2.6);
    dir.position.set(5, 5, 5);
    scene.add(dir);
    const amber = new THREE.PointLight(AMBER, 55, 0, 2);
    amber.position.set(-4, -2, 3);
    scene.add(amber);

    // ---- objects ----
    const group = new THREE.Group();
    scene.add(group);
    const meshes: { mesh: THREE.Mesh; baseY: number; spec: Spec }[] = [];

    const specs: Spec[] = [
      { geo: new THREE.IcosahedronGeometry(1.4, 1), color: EMERALD, pos: [3.1, 0, 0], scale: 1, wire: false, spin: 0.12, phase: 0 },
      { geo: new THREE.IcosahedronGeometry(1.62, 1), color: SAGE, pos: [3.1, 0, 0], scale: 1, wire: true, spin: -0.08, phase: 0 },
      { geo: new THREE.IcosahedronGeometry(1, 0), color: EMERALD_DARK, pos: [2.6, 1.7, -1], scale: 0.5, wire: false, spin: 0.5, phase: 1.1 },
      { geo: new THREE.OctahedronGeometry(1, 0), color: AMBER, pos: [4.0, -1.3, -1], scale: 0.55, wire: false, spin: 0.6, phase: 2.3 },
      { geo: new THREE.DodecahedronGeometry(1, 0), color: SAGE, pos: [1.9, -1.6, 0.6], scale: 0.5, wire: true, spin: 0.45, phase: 3.0 },
      { geo: new THREE.TorusGeometry(0.8, 0.3, 16, 40), color: EMERALD, pos: [4.4, 1.4, -0.6], scale: 0.6, wire: true, spin: 0.55, phase: 4.2 },
    ];

    for (const spec of specs) {
      const mat = new THREE.MeshStandardMaterial({
        color: spec.color,
        flatShading: true,
        wireframe: spec.wire,
        roughness: 0.35,
        metalness: 0.12,
        transparent: spec.wire,
        opacity: spec.wire ? 0.55 : 1,
      });
      const mesh = new THREE.Mesh(spec.geo, mat);
      mesh.position.set(...spec.pos);
      mesh.scale.setScalar(spec.scale);
      group.add(mesh);
      meshes.push({ mesh, baseY: spec.pos[1], spec });
    }

    // ---- responsive sizing ----
    function resize() {
      const w = mount!.clientWidth || 1;
      const h = mount!.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    // ---- animation loop, paused when offscreen or tab hidden ----
    let raf = 0;
    let running = true;
    const start = performance.now();

    function frame() {
      raf = requestAnimationFrame(frame);
      if (!running) return;
      const t = (performance.now() - start) / 1000;
      group.rotation.y = Math.sin(t * 0.15) * 0.15;
      for (const { mesh, baseY, spec } of meshes) {
        mesh.rotation.x += spec.spin * 0.01;
        mesh.rotation.y += spec.spin * 0.013;
        mesh.position.y = baseY + Math.sin(t * 1.1 + spec.phase) * 0.22;
      }
      renderer.render(scene, camera);
    }
    frame();

    const io = new IntersectionObserver(
      ([entry]) => { running = entry.isIntersecting; },
      { threshold: 0 },
    );
    io.observe(mount);
    const onVisibility = () => { running = document.visibilityState === "visible"; };
    document.addEventListener("visibilitychange", onVisibility);

    // ---- cleanup ----
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      for (const { mesh } of meshes) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="h-full w-full" />;
}
