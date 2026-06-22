"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// Hiremory "Momentum" palette
const EMERALD = 0x0b8f66;
const EMERALD_DARK = 0x047857;
const SAGE = 0x34d399;
const AMBER = 0xd97706;

// Interactive Three.js centerpiece: a faceted emerald "gem" with an orbiting
// satellite system. Drag to rotate (with inertia); when idle it auto-spins and
// drifts toward the pointer. Vanilla three.js (no react-reconciler) so it works
// on any React/Next version.
export default function Hero3DScene() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 6);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "pan-y"; // keep vertical page scroll on touch
    renderer.domElement.style.cursor = "grab";

    // Image-based lighting so the gem has real reflections (premium glass look).
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    // ---- lights ----
    scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(4, 6, 5);
    scene.add(keyLight);
    const emeraldLight = new THREE.PointLight(SAGE, 40, 0, 2);
    emeraldLight.position.set(4, 2, 3);
    scene.add(emeraldLight);
    const amberLight = new THREE.PointLight(AMBER, 35, 0, 2);
    amberLight.position.set(-4, -3, 2);
    scene.add(amberLight);

    // ---- centerpiece ----
    const group = new THREE.Group();
    scene.add(group);

    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.5, 1),
      new THREE.MeshPhysicalMaterial({
        color: EMERALD, flatShading: true, roughness: 0.12, metalness: 0.3,
        clearcoat: 1, clearcoatRoughness: 0.25, envMapIntensity: 1.2, reflectivity: 0.6,
      }),
    );
    group.add(core);

    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.92, 1),
      new THREE.MeshStandardMaterial({ color: SAGE, wireframe: true, transparent: true, opacity: 0.5, roughness: 1 }),
    );
    group.add(shell);

    type Sat = { mesh: THREE.Mesh; radius: number; speed: number; phase: number; tilt: number };
    const sats: Sat[] = [];
    const satSpecs = [
      { geo: new THREE.OctahedronGeometry(0.32, 0), color: AMBER, radius: 2.7, speed: 0.6, phase: 0, tilt: 0.3 },
      { geo: new THREE.DodecahedronGeometry(0.26, 0), color: EMERALD_DARK, radius: 2.9, speed: -0.45, phase: 2.0, tilt: -0.5 },
      { geo: new THREE.TetrahedronGeometry(0.3, 0), color: SAGE, radius: 2.5, speed: 0.52, phase: 4.0, tilt: 0.7 },
      { geo: new THREE.IcosahedronGeometry(0.22, 0), color: EMERALD, radius: 3.1, speed: -0.35, phase: 1.0, tilt: -0.2 },
    ];
    for (const s of satSpecs) {
      const mesh = new THREE.Mesh(
        s.geo,
        new THREE.MeshStandardMaterial({ color: s.color, flatShading: true, roughness: 0.3, metalness: 0.2 }),
      );
      group.add(mesh);
      sats.push({ mesh, radius: s.radius, speed: s.speed, phase: s.phase, tilt: s.tilt });
    }

    // ---- pointer interaction (drag to rotate, with inertia) ----
    let dragging = false;
    let lastX = 0, lastY = 0;
    let velX = 0, velY = 0;
    const targetTilt = { x: 0, y: 0 };

    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX; lastY = e.clientY;
      renderer.domElement.style.cursor = "grabbing";
      renderer.domElement.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const rect = mount.getBoundingClientRect();
      targetTilt.y = ((e.clientX - rect.left) / rect.width - 0.5) * 0.5;
      targetTilt.x = ((e.clientY - rect.top) / rect.height - 0.5) * 0.5;
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      velY = dx * 0.005;
      velX = dy * 0.005;
      group.rotation.y += velY;
      group.rotation.x += velX;
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      renderer.domElement.style.cursor = "grab";
      renderer.domElement.releasePointerCapture?.(e.pointerId);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

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

    // ---- animation loop ----
    let raf = 0;
    let running = true;
    const start = performance.now();

    function frame() {
      raf = requestAnimationFrame(frame);
      if (!running) return;
      const t = (performance.now() - start) / 1000;

      if (!dragging) {
        velX *= 0.94; velY *= 0.94;
        group.rotation.y += velY + 0.0026;           // inertia + idle spin
        group.rotation.x += velX + (targetTilt.x - group.rotation.x) * 0.02; // drift toward pointer
      }

      core.rotation.x += 0.002;
      core.rotation.y += 0.003;
      shell.rotation.y -= 0.0016;
      shell.rotation.x += 0.0012;

      for (const s of sats) {
        const a = t * s.speed + s.phase;
        s.mesh.position.set(
          Math.cos(a) * s.radius,
          Math.sin(a) * s.radius * s.tilt,
          Math.sin(a) * s.radius,
        );
        s.mesh.rotation.x += 0.02;
        s.mesh.rotation.y += 0.025;
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
      renderer.domElement.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      pmrem.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="h-full w-full" />;
}
