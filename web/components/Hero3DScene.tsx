"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// Hiremory "Momentum" palette
const EMERALD = 0x0b8f66;
const EMERALD_DARK = 0x047857;
const SAGE = 0x34d399;
const PAPER = 0xfbfdfc;

// Interactive brand centerpiece: a 3D envelope with a letter peeking out — the
// literal "a letter, not a blast." Drag to rotate (with inertia); idle bob +
// slow spin + pointer drift. Vanilla three.js so it works on any React version.
function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export default function Hero3DScene() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 6.5);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "pan-y";
    renderer.domElement.style.cursor = "grab";

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    scene.add(new THREE.AmbientLight(0xffffff, 1.0));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(4, 6, 6);
    scene.add(keyLight);
    const fill = new THREE.PointLight(SAGE, 26, 0, 2);
    fill.position.set(-4, -2, 4);
    scene.add(fill);

    const group = new THREE.Group();
    group.rotation.set(-0.12, 0.35, 0);
    scene.add(group);

    const W = 3.2, H = 2.1, D = 0.34;

    // envelope body
    const bodyGeo = new THREE.ExtrudeGeometry(roundedRect(W, H, 0.16), {
      depth: D, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2,
    });
    bodyGeo.center();
    const body = new THREE.Mesh(
      bodyGeo,
      new THREE.MeshPhysicalMaterial({ color: EMERALD, roughness: 0.32, metalness: 0.1, clearcoat: 0.8, clearcoatRoughness: 0.3, envMapIntensity: 1 }),
    );
    group.add(body);

    // letter peeking out the top (sits inside the envelope, top edge shows)
    const letter = new THREE.Mesh(
      new THREE.BoxGeometry(W - 0.5, H + 0.2, 0.04),
      new THREE.MeshStandardMaterial({ color: PAPER, roughness: 0.55, metalness: 0 }),
    );
    letter.position.set(0, 0.5, 0);
    group.add(letter);

    // text lines on the visible (peeking) part of the letter
    const lineMat = new THREE.MeshStandardMaterial({ color: EMERALD, roughness: 0.5 });
    [[1.35, 1.4], [1.22, 1.0], [1.09, 1.6]].forEach(([y, w]) => {
      const ln = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, 0.02), lineMat);
      ln.position.set(-(1.6 - w / 2 - 0.25), y, 0.03);
      group.add(ln);
    });

    // front flap (classic envelope V), apex pointing down
    const flapShape = new THREE.Shape();
    flapShape.moveTo(-W / 2 + 0.02, H / 2 - 0.02);
    flapShape.lineTo(W / 2 - 0.02, H / 2 - 0.02);
    flapShape.lineTo(0, -0.05);
    flapShape.closePath();
    const flapGeo = new THREE.ExtrudeGeometry(flapShape, { depth: 0.05, bevelEnabled: false });
    const flap = new THREE.Mesh(
      flapGeo,
      new THREE.MeshPhysicalMaterial({ color: EMERALD_DARK, roughness: 0.3, metalness: 0.1, clearcoat: 0.8, clearcoatRoughness: 0.3 }),
    );
    flap.position.set(0, 0, D / 2 + 0.001);
    group.add(flap);

    // wax-seal dot at the flap apex
    const seal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.06, 24),
      new THREE.MeshPhysicalMaterial({ color: SAGE, roughness: 0.25, metalness: 0.2, clearcoat: 1 }),
    );
    seal.rotation.x = Math.PI / 2;
    seal.position.set(0, -0.02, D / 2 + 0.08);
    group.add(seal);

    // ---- pointer interaction (drag to rotate, with inertia) ----
    let dragging = false;
    let lastX = 0, lastY = 0;
    let velX = 0, velY = 0;
    const targetTilt = { x: -0.12, y: 0.35 };

    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX; lastY = e.clientY;
      renderer.domElement.style.cursor = "grabbing";
      renderer.domElement.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const rect = mount.getBoundingClientRect();
      targetTilt.y = 0.35 + ((e.clientX - rect.left) / rect.width - 0.5) * 0.6;
      targetTilt.x = -0.12 + ((e.clientY - rect.top) / rect.height - 0.5) * 0.5;
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

    let raf = 0;
    let running = true;
    const start = performance.now();

    function frame() {
      raf = requestAnimationFrame(frame);
      if (!running) return;
      const t = (performance.now() - start) / 1000;

      if (!dragging) {
        velX *= 0.94; velY *= 0.94;
        group.rotation.y += velY + (targetTilt.y - group.rotation.y) * 0.04;
        group.rotation.x += velX + (targetTilt.x - group.rotation.x) * 0.04;
      }
      group.position.y = Math.sin(t * 1.1) * 0.08; // gentle float

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
