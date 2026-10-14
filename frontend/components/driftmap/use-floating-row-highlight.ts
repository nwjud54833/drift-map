"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Floating glass row highlight plus ↑/↓ and J/K row physics.
 *
 * Extracted from the Obsidian v2.5 "Spatial" reference build's
 * `updateHeroFloatingHighlight` / `selectHeroRow` pair, which is duplicated
 * between the hero table and the workbench findings list. One hook drives both.
 *
 * The indicator is positioned from the measured row geometry rather than from a
 * hard-coded row height, so it stays correct when a row wraps or the container
 * scrolls.
 */
export interface FloatingRowOptions {
  /** Number of rows currently rendered. */
  count: number;
  /** Disables the global key handler (for example while a modal owns the page). */
  enabled?: boolean;
  /** Called on every selection change, for the audio and telemetry side effects. */
  onSelect?: (index: number) => void;
  /** When true the highlight is hidden (used for empty result sets). */
  hidden?: boolean;
}

export interface FloatingRowResult {
  selectedIndex: number;
  select: (index: number) => void;
  /** Attach to the container that wraps the rows. */
  stageRef: React.RefObject<HTMLDivElement | null>;
  /** Attach to the highlight element. */
  highlightRef: React.RefObject<HTMLDivElement | null>;
  /** Attach to each row, in order. */
  rowId: (index: number) => string;
}

export function useFloatingRowHighlight({ count, enabled = true, onSelect, hidden = false }: FloatingRowOptions): FloatingRowResult {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  const rowId = useCallback((index: number) => `spatial-row-${index}`, []);

  const select = useCallback((index: number) => {
    if (count <= 0) return;
    const next = ((index % count) + count) % count;
    setSelectedIndex(next);
    onSelect?.(next);
  }, [count, onSelect]);

  // Reposition whenever selection, row count, or geometry changes. `useLayoutEffect`
  // keeps the indicator from visibly lagging a frame behind the selection.
  useLayoutEffect(() => {
    const highlight = highlightRef.current;
    const stage = stageRef.current;
    if (!highlight) return;
    if (hidden || count === 0) {
      highlight.style.opacity = "0";
      return;
    }
    highlight.style.opacity = "1";
    const row = stage?.querySelector<HTMLElement>(`#${CSS.escape(rowId(selectedIndex))}`);
    if (!row) {
      highlight.style.opacity = "0";
      return;
    }
    highlight.style.transform = `translateY(${row.offsetTop}px)`;
    highlight.style.height = `${row.offsetHeight}px`;
  }, [selectedIndex, count, hidden, rowId]);

  // Geometry changes without a re-render (fonts loading, container resize).
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(() => {
      const highlight = highlightRef.current;
      const row = stage.querySelector<HTMLElement>(`#${CSS.escape(rowId(selectedIndex))}`);
      if (!highlight || !row) return;
      highlight.style.transform = `translateY(${row.offsetTop}px)`;
      highlight.style.height = `${row.offsetHeight}px`;
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [selectedIndex, rowId]);

  // Keep the selection valid when filtering shrinks the list.
  useEffect(() => {
    if (selectedIndex >= count && count > 0) setSelectedIndex(0);
  }, [count, selectedIndex]);

  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = (target?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable) return;
      const key = event.key.toLowerCase();
      if (key === "arrowdown" || key === "j") {
        event.preventDefault();
        select(selectedIndex + 1);
      } else if (key === "arrowup" || key === "k") {
        event.preventDefault();
        select(selectedIndex - 1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, select, selectedIndex]);

  return { selectedIndex, select, stageRef, highlightRef, rowId };
}
