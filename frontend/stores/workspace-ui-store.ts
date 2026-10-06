import { create } from "zustand";
import type { ChangeSeverity, ImportDraft, WorkspaceUIState } from "@/lib/contract/types";

const initialDraft: ImportDraft = { rawText: "", source: "paste", fileName: null, versionLabel: "", parseError: null, previewSampleCount: 0 };
interface UIStore extends WorkspaceUIState {
  setActiveWorkspace: (id: string | null) => void;
  selectChange: (id: string | null, pointer: string | null) => void;
  setQuery: (query: string) => void;
  toggleSeverity: (severity: ChangeSeverity) => void;
  resetFilters: () => void;
  setImportOpen: (open: boolean) => void;
  setRawOpen: (open: boolean) => void;
  setPaletteOpen: (open: boolean) => void;
  setImportDraft: (draft: Partial<ImportDraft>) => void;
}
export const useWorkspaceUIStore = create<UIStore>((set) => ({
  activeWorkspaceId: null, activePointer: null, focusedChangeId: null,
  isImportSheetOpen: false, isRawJsonDrawerOpen: false, isCommandPaletteOpen: false,
  filters: { query: "", severities: ["breaking", "warning", "safe", "info"], showUnchanged: false }, importDraft: initialDraft,
  setActiveWorkspace: (id) => set({ activeWorkspaceId: id, activePointer: null, focusedChangeId: null }),
  selectChange: (id, pointer) => set({ focusedChangeId: id, activePointer: pointer }),
  setQuery: (query) => set((state) => ({ filters: { ...state.filters, query } })),
  toggleSeverity: (severity) => set((state) => ({ filters: { ...state.filters, severities: state.filters.severities.includes(severity) ? state.filters.severities.filter((item) => item !== severity) : [...state.filters.severities, severity] } })),
  resetFilters: () => set((state) => ({ filters: { ...state.filters, query: "", severities: ["breaking", "warning", "safe", "info"] } })),
  setImportOpen: (open) => set((state) => ({ isImportSheetOpen: open, importDraft: open ? initialDraft : state.importDraft })),
  setRawOpen: (open) => set({ isRawJsonDrawerOpen: open }),
  setPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  setImportDraft: (draft) => set((state) => ({ importDraft: { ...state.importDraft, ...draft } })),
}));
