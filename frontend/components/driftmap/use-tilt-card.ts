"use client";

import { useEffect, useRef } from "react";

const TILT_DEGREES = 8;
const SPOTLIGHT_X = "--mouse-x";
const SPOTLIGHT_Y = "--mouse-y";
const TILT_X = "--tilt-x";
const TILT_Y = "--tilt-y";

/**
 * Cursor-tracked 3D tilt + specular spotlight.
 *
 * Ported from `initSpatial3DInteractions` in the Obsidian v2.5 "Spatial"
 * reference build, which attaches `mousemove` listeners to every
 * `[data-tilt-card]` at load time. Here it is a hook, so React owns the
 * lifetime and the listeners are torn down with the component.
 *
 * The hook writes the same four custom properties the reference does. Nothing
 * goes through React state, so tracking the cursor never triggers a re-render —
 * that is the whole reason the reference drives the effect from CSS variables.
 */
export function useTiltCard<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const card = ref.current;
    if (!card || !enabled) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    function onMove(event: MouseEvent) {
      const node = card;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const normalX = mouseX / rect.width - 0.5;
      const normalY = mouseY / rect.height - 0.5;

      node.style.setProperty(SPOTLIGHT_X, `${mouseX}px`);
      node.style.setProperty(SPOTLIGHT_Y, `${mouseY}px`);
      node.style.setProperty(TILT_Y, `${(normalX * TILT_DEGREES).toFixed(2)}deg`);
      node.style.setProperty(TILT_X, `${(-normalY * TILT_DEGREES).toFixed(2)}deg`);
    }

    function onLeave() {
      const node = card;
      if (!node) return;
      node.style.setProperty(TILT_X, "0deg");
      node.style.setProperty(TILT_Y, "0deg");
    }

    card.addEventListener("mousemove", onMove);
    card.addEventListener("mouseleave", onLeave);
    return () => {
      card.removeEventListener("mousemove", onMove);
      card.removeEventListener("mouseleave", onLeave);
    };
  }, [enabled]);

  return ref;
}
