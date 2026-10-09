"use client";

import { useEffect, useRef } from "react";

// Ambient "flowing particles" behind the whole page — soft motes drifting
// upward with a gentle twinkle (from the Flowing Particles handoff). On the
// light theme the motes use the deeper text gold; the brand gold #cdb584
// barely shows on white. Colors come from the theme tokens (--particle-rgb,
// --particle-min/max in globals.css) and update when the theme switches. Renders nothing for visitors who ask
// for reduced motion, and pauses while the tab is hidden. Nothing reacts
// to the mouse. Kept light: standard canvas resolution, and
// redrawn at ~30fps (the drift is slow enough that it looks the same).
const AREA = 18000; // px per particle (lower = denser)
const MIN_COUNT = 28;
const MAX_COUNT = 80;
const SIZE_MIN = 0.5;
const SIZE_MAX = 2.2;
const RISE = 0.22;
const DRIFT = 0.12;

type Particle = { x: number; y: number; r: number; vx: number; vy: number; base: number; tw: number; ph: number };

export default function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Low-power devices (set by the head script in layout.tsx) get fewer motes.
    const lite = Boolean((window as Window & { __oxLite?: boolean }).__oxLite);
    const dpr = 1;
    const FRAME_MS = 1000 / 30;
    let W = 0;
    let H = 0;
    let parts: Particle[] = [];
    let raf: number | null = null;

    // Theme colors. Each mote keeps a 0–1 brightness; the theme's opacity
    // range is applied when drawing, so a theme switch needs no rebuild.
    let rgb = "200,178,138";
    let opMin = 0.12;
    let opMax = 0.57;
    const readTheme = () => {
      const cs = getComputedStyle(document.documentElement);
      rgb = cs.getPropertyValue("--particle-rgb").trim().replace(/\s+/g, "") || rgb;
      opMin = parseFloat(cs.getPropertyValue("--particle-min")) || opMin;
      opMax = parseFloat(cs.getPropertyValue("--particle-max")) || opMax;
    };
    readTheme();
    const themeObserver = new MutationObserver(readTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const make = (): Particle => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * (SIZE_MAX - SIZE_MIN) + SIZE_MIN,
      vy: -(Math.random() * RISE + 0.04),
      vx: (Math.random() - 0.5) * DRIFT,
      base: Math.random(),
      tw: Math.random() * 0.018 + 0.004,
      ph: Math.random() * Math.PI * 2,
    });
    function build() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas!.width = Math.round(W * dpr);
      canvas!.height = Math.round(H * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(MIN_COUNT, Math.min(MAX_COUNT, Math.round((W * H) / AREA)));
      parts = Array.from({ length: lite ? Math.round(count * 0.6) : count }, make);
    }

    let last = 0;
    function tick(now: number) {
      raf = requestAnimationFrame(tick);
      if (now - last < FRAME_MS - 2) return;
      last = now;
      ctx!.clearRect(0, 0, W, H);
      for (const p of parts) {
        // Two 60fps steps per drawn frame, so the speed stays the same.
        p.x += p.vx * 2;
        p.y += p.vy * 2;
        p.ph += p.tw * 2;
        const edge = p.r + 6;
        if (p.y < -edge) {
          p.y = H + edge;
          p.x = Math.random() * W;
        }
        if (p.x < -edge) p.x = W + edge;
        else if (p.x > W + edge) p.x = -edge;

        const a = (opMin + p.base * (opMax - opMin)) * (0.55 + 0.45 * Math.sin(p.ph));
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${rgb},${a.toFixed(3)})`;
        ctx!.fill();
      }
    }

    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(build, 200);
    };
    const onVisibility = () => {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf);
        raf = null;
      } else if (!raf) {
        raf = requestAnimationFrame(tick);
      }
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);

    build();
    raf = requestAnimationFrame(tick);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      themeObserver.disconnect();
    };
  }, []);

  // z-index -1 keeps it above the body's background but under all content.
  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 h-full w-full" />;
}
