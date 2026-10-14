"use client";

import { useEffect, useRef } from "react";

/**
 * Interactive 3D perspective horizon grid.
 *
 * Ported from `initHeroPerspectiveCanvas` in the Obsidian v2.5 "Spatial"
 * reference build: a vanishing-point lane grid with a cursor-reactive node
 * lattice and four travelling data pulses.
 *
 * Differences from the reference, all deliberate:
 *  - the animation loop stops when the tab is hidden, and on unmount;
 *  - `prefers-reduced-motion` draws exactly one frame instead of looping;
 *  - device pixel ratio is capped at 2 so a 4K display does not allocate a
 *    canvas four times larger than it can show.
 */

interface Pulse {
  lane: number;
  z: number;
  speed: number;
  color: string;
}

const PULSES: readonly Pulse[] = [
  { lane: -4, z: 0.1, speed: 0.0045, color: "#FB7185" },
  { lane: -1.5, z: 0.5, speed: 0.0038, color: "#38BDF8" },
  { lane: 1.5, z: 0.3, speed: 0.0052, color: "#34D399" },
  { lane: 4, z: 0.7, speed: 0.004, color: "#FBBF24" },
];

const NUM_LANES = 16;
const DEPTH_STEPS = 12;
const CURSOR_RADIUS = 150;

export function HeroPerspectiveCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // `section` is the scroll container's element; the reference sizes the
    // canvas to the whole hero section rather than to the canvas box, which is
    // what makes the horizon read as a backdrop instead of an inset panel.
    const host = canvas.parentElement;
    if (!host) return;

    let width = 0;
    let height = 0;
    let cursorX = -1000;
    let cursorY = -1000;
    let frame = 0;
    const pulses = PULSES.map((pulse) => ({ ...pulse }));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function resize() {
      if (!host) return;
      const rect = host.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function drawFrame() {
      if (!ctx || width === 0 || height === 0) return;
      ctx.clearRect(0, 0, width, height);

      const horizonY = height * 0.22;
      const vanishX = width * 0.5;
      const spreadBottom = width * 1.35;

      // Vanishing-point lanes.
      ctx.lineWidth = 1;
      for (let lane = -NUM_LANES / 2; lane <= NUM_LANES / 2; lane += 1) {
        const bottomX = vanishX + (lane / (NUM_LANES / 2)) * (spreadBottom / 2);
        ctx.beginPath();
        ctx.moveTo(vanishX, horizonY);
        ctx.lineTo(bottomX, height);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.032)";
        ctx.stroke();
      }

      // Depth rungs, with a cursor-reactive node lattice at each intersection.
      for (let depth = 1; depth <= DEPTH_STEPS; depth += 1) {
        const t = Math.pow(depth / DEPTH_STEPS, 1.65);
        const y = horizonY + t * (height - horizonY);

        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.015 + t * 0.035})`;
        ctx.stroke();

        for (let lane = -NUM_LANES / 2; lane <= NUM_LANES / 2; lane += 1) {
          const bottomX = vanishX + (lane / (NUM_LANES / 2)) * (spreadBottom / 2);
          const x = vanishX + (bottomX - vanishX) * t;
          const distance = Math.hypot(x - cursorX, y - cursorY);
          if (distance < CURSOR_RADIUS) {
            const alpha = (1 - distance / CURSOR_RADIUS) * 0.65;
            ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
            ctx.beginPath();
            ctx.arc(x, y, 2.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Travelling data pulses.
      for (const pulse of pulses) {
        pulse.z += pulse.speed;
        if (pulse.z > 1) pulse.z = 0.05;

        const t = Math.pow(pulse.z, 1.65);
        const bottomX = vanishX + (pulse.lane / (NUM_LANES / 2)) * (spreadBottom / 2);
        const x = vanishX + (bottomX - vanishX) * t;
        const y = horizonY + t * (height - horizonY);

        ctx.save();
        ctx.fillStyle = pulse.color;
        ctx.shadowColor = pulse.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(x, y, 2.4 * (0.4 + t * 0.8), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    function loop() {
      drawFrame();
      if (!reducedMotion && !document.hidden) frame = requestAnimationFrame(loop);
    }

    function onPointerMove(event: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      cursorX = event.clientX - rect.left;
      cursorY = event.clientY - rect.top;
    }

    function onPointerLeave() {
      cursorX = -1000;
      cursorY = -1000;
    }

    function onVisibility() {
      cancelAnimationFrame(frame);
      if (!document.hidden && !reducedMotion) frame = requestAnimationFrame(loop);
    }

    resize();
    loop();

    const observer = new ResizeObserver(() => {
      resize();
      if (reducedMotion) drawFrame();
    });
    observer.observe(host);

    host.addEventListener("mousemove", onPointerMove);
    host.addEventListener("mouseleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      host.removeEventListener("mousemove", onPointerMove);
      host.removeEventListener("mouseleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas id="hero-perspective-canvas" ref={canvasRef} className={className} aria-hidden="true" />;
}
