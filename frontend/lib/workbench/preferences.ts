export type WorkbenchMode = "local" | "cloud";
export type PreferenceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const MODE_KEY = "driftmap.workbench.mode";
const ACTIVE_WORKSPACE_KEY = "driftmap.workbench.active";

export function browserPreferenceStorage(): PreferenceStorage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; }
  catch { return null; }
}

export function readWorkbenchMode(storage: PreferenceStorage | null | undefined): WorkbenchMode {
  try {
    return storage?.getItem(MODE_KEY) === "cloud" ? "cloud" : "local";
  } catch {
    return "local";
  }
}

export function writeWorkbenchMode(storage: PreferenceStorage | null | undefined, mode: WorkbenchMode): void {
  try { storage?.setItem(MODE_KEY, mode); } catch { /* Preferences are optional when browser storage is unavailable. */ }
}

export function readActiveWorkspaceId(storage: PreferenceStorage | null | undefined, mode: WorkbenchMode): string | null {
  try { return storage?.getItem(`${ACTIVE_WORKSPACE_KEY}.${mode}`) ?? null; }
  catch { return null; }
}

export function writeActiveWorkspaceId(storage: PreferenceStorage | null | undefined, mode: WorkbenchMode, workspaceId: string | null): void {
  try {
    if (workspaceId) storage?.setItem(`${ACTIVE_WORKSPACE_KEY}.${mode}`, workspaceId);
    else storage?.removeItem(`${ACTIVE_WORKSPACE_KEY}.${mode}`);
  } catch { /* Preferences are optional when browser storage is unavailable. */ }
}
