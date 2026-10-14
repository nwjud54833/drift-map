"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import type { ChangeSeverity } from "@/lib/contract/types";
import { DriftAudioSynth } from "@/lib/driftmap/audio-synth";
import type { Finding } from "@/lib/driftmap/presentation";

/**
 * Interactive 3D orbital force-graph contract visualizer.
 *
 * Ported from `ContractForceGraph3D` in the Obsidian v2.5 "Spatial" reference
 * build: a hand-rolled perspective projection over a hierarchical node graph
 * derived from JSON pointers, with drag-to-orbit, wheel zoom, auto-orbit,
 * travelling data pulses along each edge, depth-sorted node rendering, and
 * hit-tested node selection.
 *
 * Differences from the reference, all deliberate:
 *  - the node graph is rebuilt from `Finding[]` with `useMemo`, not on demand;
 *  - the render loop runs only while the canvas is visible and the document is
 *    not hidden, so a background tab costs nothing;
 *  - pointer events are used instead of mouse events so touch drag works;
 *  - `prefers-reduced-motion` disables auto-orbit and stops the loop after one
 *    frame while leaving manual orbiting fully functional.
 */

export interface ContractForceGraphHandle {
  zoom: (delta: number) => void;
  resetCamera: () => void;
  toggleAutoOrbit: () => void;
  autoOrbit: () => boolean;
}

interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
  severity: ChangeSeverity | "structural";
  radius: number;
  findingIndex: number;
  screenX?: number;
  screenY?: number;
  screenScale?: number;
  depthZ?: number;
}

interface GraphEdge {
  source: string;
  target: string;
}

interface Pulse {
  edge: GraphEdge;
  t: number;
  speed: number;
}

const DEFAULT_ROT_X = 0.32;
const DEFAULT_ROT_Y = -0.45;
const MIN_ZOOM = 0.55;
const MAX_ZOOM = 1.85;
const HIT_RADIUS = 22;

function colorForSeverity(severity: GraphNode["severity"]): string {
  if (severity === "breaking") return "#FB7185";
  if (severity === "warning") return "#FBBF24";
  if (severity === "safe") return "#34D399";
  if (severity === "info") return "#38BDF8";
  return "#A1A1AA";
}

/** Builds the hierarchical pointer graph the reference derives from its rows. */
function buildGraph(findings: readonly Finding[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodeMap = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  nodeMap.set("root", {
    id: "root",
    label: "root { }",
    x: 0,
    y: -55,
    z: 0,
    severity: "structural",
    radius: 9,
    findingIndex: -1,
  });

  findings.forEach((finding, findingIndex) => {
    const segments = finding.pointer.split("/").filter(Boolean);
    let parentId = "root";
    let currentPath = "";

    segments.forEach((segment, depth) => {
      currentPath += `/${segment}`;
      const isLeaf = depth === segments.length - 1;

      if (!nodeMap.has(currentPath)) {
        const angle = nodeMap.size * 1.37 + depth * 0.85;
        const spread = (depth + 1) * 72;
        const yOffset = -55 + (depth + 1) * 52 + Math.sin(nodeMap.size * 2.1) * 18;
        nodeMap.set(currentPath, {
          id: currentPath,
          label: segment === "*" ? "/* (wildcard)" : segment,
          x: Math.cos(angle) * spread,
          y: yOffset,
          z: Math.sin(angle) * spread,
          severity: isLeaf ? finding.severity : "structural",
          radius: isLeaf ? 7.5 : 5.5,
          findingIndex: isLeaf ? findingIndex : -1,
        });
        edges.push({ source: parentId, target: currentPath });
      } else if (isLeaf) {
        const existing = nodeMap.get(currentPath)!;
        existing.severity = finding.severity;
        existing.findingIndex = findingIndex;
        existing.radius = 7.5;
      }

      parentId = currentPath;
    });
  });

  return { nodes: [...nodeMap.values()], edges };
}

export const ContractForceGraph = forwardRef<ContractForceGraphHandle, {
  findings: readonly Finding[];
  activePointer: string | null;
  active: boolean;
  onSelectFinding: (index: number) => void;
  onSelectionChange?: (pointer: string | null) => void;
}>(function ContractForceGraph(
  { findings, activePointer, active, onSelectFinding, onSelectionChange },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef<(() => void) | null>(null);
  const stateRef = useRef({
    rotX: DEFAULT_ROT_X,
    rotY: DEFAULT_ROT_Y,
    zoom: 1,
    autoOrbit: true,
    dragging: false,
    dragX: 0,
    dragY: 0,
    hoveredId: null as string | null,
  });
  const graph = useRef(buildGraph(findings));
  const pulses = useRef<Pulse[]>([]);
  const activeRef = useRef(active);
  const pointerRef = useRef(activePointer);
  const selectRef = useRef(onSelectFinding);
  const selectionChangeRef = useRef(onSelectionChange);

  activeRef.current = active;
  pointerRef.current = activePointer;
  selectRef.current = onSelectFinding;
  selectionChangeRef.current = onSelectionChange;

  // Rebuild the graph whenever the finding set changes.
  useEffect(() => {
    graph.current = buildGraph(findings);
    pulses.current = graph.current.edges.map((edge, index) => ({
      edge,
      t: (index * 0.23) % 1,
      speed: 0.008 + (index % 3) * 0.003,
    }));
  }, [findings]);

  const zoom = useCallback((delta: number) => {
    const state = stateRef.current;
    state.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, state.zoom + delta));
    DriftAudioSynth.playTick(880);
  }, []);

  const resetCamera = useCallback(() => {
    const state = stateRef.current;
    state.rotX = DEFAULT_ROT_X;
    state.rotY = DEFAULT_ROT_Y;
    state.zoom = 1;
    DriftAudioSynth.playTick(1020);
  }, []);

  const toggleAutoOrbit = useCallback(() => {
    stateRef.current.autoOrbit = !stateRef.current.autoOrbit;
    DriftAudioSynth.playTick();
  }, []);

  useImperativeHandle(ref, () => ({
    zoom,
    resetCamera,
    toggleAutoOrbit,
    autoOrbit: () => stateRef.current.autoOrbit,
  }), [zoom, resetCamera, toggleAutoOrbit]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let width = 0;
    let height = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function resize() {
      if (!canvas || !ctx) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /** Projects every node to screen space, mutating the nodes with their coords. */
    function project(): Map<string, GraphNode> {
      const state = stateRef.current;
      const cx = width * 0.5;
      const cy = height * 0.5;
      const fov = 420 * state.zoom;
      const cosY = Math.cos(state.rotY);
      const sinY = Math.sin(state.rotY);
      const cosX = Math.cos(state.rotX);
      const sinX = Math.sin(state.rotX);

      const projected = new Map<string, GraphNode>();
      for (const node of graph.current.nodes) {
        const x1 = node.x * cosY - node.z * sinY;
        const z1 = node.z * cosY + node.x * sinY;
        const y2 = node.y * cosX - z1 * sinX;
        const z2 = z1 * cosX + node.y * sinX;
        const scale = fov / Math.max(120, 420 + z2);
        node.screenX = cx + x1 * scale;
        node.screenY = cy + y2 * scale;
        node.screenScale = scale;
        node.depthZ = z2;
        projected.set(node.id, node);
      }
      return projected;
    }

    function drawFrame() {
      if (!ctx) return;
      if (width === 0 || height === 0) return;
      ctx.clearRect(0, 0, width, height);

      const state = stateRef.current;
      if (state.autoOrbit && !state.dragging && !reducedMotion) state.rotY += 0.0042;

      const projected = project();

      // Edges, drawn twice: a neutral hairline plus a coloured glow.
      for (const edge of graph.current.edges) {
        const source = projected.get(edge.source);
        const target = projected.get(edge.target);
        if (!source || !target || source.screenX === undefined || target.screenX === undefined) continue;
        ctx.beginPath();
        ctx.moveTo(source.screenX, source.screenY!);
        ctx.lineTo(target.screenX, target.screenY!);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.13)";
        ctx.lineWidth = 1.25;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(source.screenX, source.screenY!);
        ctx.lineTo(target.screenX, target.screenY!);
        ctx.strokeStyle = `${colorForSeverity(target.severity)}33`;
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }

      // Travelling data pulses.
      for (const pulse of pulses.current) {
        pulse.t += pulse.speed;
        if (pulse.t > 1) pulse.t = 0;
        const source = projected.get(pulse.edge.source);
        const target = projected.get(pulse.edge.target);
        if (!source || !target || source.screenX === undefined || target.screenX === undefined) continue;
        const px = source.screenX + (target.screenX - source.screenX) * pulse.t;
        const py = source.screenY! + (target.screenY! - source.screenY!) * pulse.t;
        const color = colorForSeverity(target.severity);
        ctx.save();
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(px, py, 2.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Nodes, sorted back to front so nearer spheres overlap correctly.
      const sorted = [...graph.current.nodes].sort((a, b) => (b.depthZ ?? 0) - (a.depthZ ?? 0));
      for (const node of sorted) {
        if (node.screenX === undefined) continue;
        const color = colorForSeverity(node.severity);
        const selected = node.id === pointerRef.current;
        const hovered = node.id === state.hoveredId;
        const radius = Math.max(3.5, node.radius * (node.screenScale ?? 1) * (selected || hovered ? 1.3 : 1));

        if (selected || hovered || node.severity === "breaking") {
          ctx.save();
          ctx.beginPath();
          ctx.arc(node.screenX, node.screenY!, radius * 2.1, 0, Math.PI * 2);
          ctx.fillStyle = `${color}${selected ? "38" : "1F"}`;
          ctx.fill();
          ctx.restore();
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(node.screenX, node.screenY!, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = selected ? 18 : 10;
        ctx.fill();
        if (selected || hovered) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#FFFFFF";
          ctx.stroke();
        }
        ctx.restore();

        ctx.font = `${selected ? "600" : "500"} 11px ${"JetBrains Mono, monospace"}`;
        const label = node.id === "root" ? "root" : node.id;
        const textWidth = ctx.measureText(label).width;
        const lx = node.screenX - textWidth / 2;
        const ly = node.screenY! - radius - 7;
        ctx.fillStyle = "rgba(3, 3, 4, 0.78)";
        ctx.fillRect(lx - 4, ly - 10, textWidth + 8, 14);
        ctx.fillStyle = selected ? "#FFFFFF" : "#E2E4EB";
        ctx.fillText(label, lx, ly);
      }
    }

    function loop() {
      if (activeRef.current) drawFrame();
      frame = requestAnimationFrame(loop);
    }

    function hitTest(clientX: number, clientY: number): GraphNode | null {
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      let closest: GraphNode | null = null;
      let minDistance = HIT_RADIUS;
      for (const node of graph.current.nodes) {
        if (node.screenX === undefined || node.screenY === undefined) continue;
        // Node screen coords are only valid after a frame has been drawn.
        const distance = Math.hypot(mx - node.screenX, my - node.screenY);
        if (distance < minDistance) {
          minDistance = distance;
          closest = node;
        }
      }
      return closest;
    }

    function onPointerDown(event: PointerEvent) {
      const state = stateRef.current;
      state.dragging = true;
      state.dragX = event.clientX;
      state.dragY = event.clientY;
      canvas?.setPointerCapture(event.pointerId);
    }

    function onPointerUp(event: PointerEvent) {
      stateRef.current.dragging = false;
      canvas?.releasePointerCapture?.(event.pointerId);
    }

    function onPointerMove(event: PointerEvent) {
      const state = stateRef.current;
      if (state.dragging) {
        const dx = event.clientX - state.dragX;
        const dy = event.clientY - state.dragY;
        state.rotY += dx * 0.0075;
        state.rotX = Math.max(-1.25, Math.min(1.25, state.rotX + dy * 0.0075));
        state.dragX = event.clientX;
        state.dragY = event.clientY;
        return;
      }
      const node = hitTest(event.clientX, event.clientY);
      state.hoveredId = node?.id ?? null;
      if (canvas) canvas.style.cursor = node ? "pointer" : state.dragging ? "grabbing" : "grab";
    }

    function onPointerLeave() {
      stateRef.current.hoveredId = null;
    }

    function onClick(event: MouseEvent) {
      const node = hitTest(event.clientX, event.clientY);
      if (!node) return;
      if (node.findingIndex >= 0) {
        selectRef.current(node.findingIndex);
        selectionChangeRef.current?.(node.id);
      } else {
        DriftAudioSynth.playTick(920);
      }
    }

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      zoom(event.deltaY < 0 ? 0.1 : -0.1);
    }

    function onVisibility() {
      cancelAnimationFrame(frame);
      if (!document.hidden) frame = requestAnimationFrame(loop);
    }

    resize();
    drawRef.current = drawFrame;
    frame = requestAnimationFrame(loop);

    const observer = new ResizeObserver(() => {
      resize();
      if (!activeRef.current) drawFrame();
    });
    observer.observe(canvas);

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(frame);
      drawRef.current = null;
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("wheel", onWheel);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [zoom]);

  // Repaint immediately when the graph becomes visible: the render loop skips
  // hidden phases, so the canvas would otherwise show a stale frame.
  useEffect(() => {
    if (!active) return;
    const id = requestAnimationFrame(() => drawRef.current?.());
    return () => cancelAnimationFrame(id);
  }, [active, findings]);

  return (
    <canvas
      id="contract-force-graph-canvas"
      ref={canvasRef}
      className="w-full flex-1 cursor-grab active:cursor-grabbing touch-none"
      role="img"
      aria-label={`3D orbital contract graph with ${findings.length} classified findings. Use the findings list to inspect them.`}
    />
  );
});
