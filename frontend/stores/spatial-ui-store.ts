import { create } from "zustand";

export type SpatialCenterMode = "table" | "graph";
export type SpatialSimStatus = "idle" | "streaming";
export type SpatialProjection = "orthographic" | "perspective";

export interface SpatialModalRequest {
  kind: "tokens" | "shortcuts";
  /** Increments on every request so a repeat request still re-opens the modal. */
  token: number;
}

interface SpatialUIStore {
  isCommandPaletteOpen: boolean;
  isWorkspaceDrawerOpen: boolean;
  centerMode: SpatialCenterMode;
  simStatus: SpatialSimStatus;
  /** Preferred 3D projection for the contract graph; reset by the user. */
  projection: SpatialProjection;
  modalRequest: SpatialModalRequest | null;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
  setWorkspaceDrawerOpen: (open: boolean) => void;
  setCenterMode: (mode: SpatialCenterMode) => void;
  setSimStatus: (status: SpatialSimStatus) => void;
  setProjection: (projection: SpatialProjection) => void;
  openModal: (kind: SpatialModalRequest["kind"]) => void;
  closeModal: () => void;
}

/**
 * View-level UI state for the Obsidian v2.5 "Spatial" shell.
 *
 * Deliberately separate from `stores/workspace-ui-store.ts`, which owns domain
 * selection (active workspace, focused change, severity filters) and is shared
 * with the contract trees and diff list. This store only holds chrome: which
 * modal is open, how the centre pane is projected, and whether live traffic is
 * streaming.
 */
export const useSpatialUIStore = create<SpatialUIStore>((set) => ({
  isCommandPaletteOpen: false,
  isWorkspaceDrawerOpen: false,
  centerMode: "table",
  simStatus: "idle",
  projection: "perspective",
  modalRequest: null,
  openCommandPalette: () => set({ isCommandPaletteOpen: true }),
  closeCommandPalette: () => set({ isCommandPaletteOpen: false }),
  toggleCommandPalette: () => set((state) => ({ isCommandPaletteOpen: !state.isCommandPaletteOpen })),
  setWorkspaceDrawerOpen: (open) => set({ isWorkspaceDrawerOpen: open }),
  setCenterMode: (centerMode) => set({ centerMode }),
  setSimStatus: (simStatus) => set({ simStatus }),
  setProjection: (projection) => set({ projection }),
  openModal: (kind) => set({ modalRequest: { kind, token: Date.now() } }),
  closeModal: () => set({ modalRequest: null }),
}));
