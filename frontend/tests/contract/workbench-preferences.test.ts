import { describe, expect, it } from "vitest";
import {
  readActiveWorkspaceId,
  readWorkbenchMode,
  writeActiveWorkspaceId,
  writeWorkbenchMode,
  type PreferenceStorage,
} from "@/lib/workbench/preferences";

function memoryStorage(): PreferenceStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

describe("Workbench reload preferences", () => {
  it("restores the selected Cloud mode and workspace independently from Local mode", () => {
    const storage = memoryStorage();
    writeWorkbenchMode(storage, "cloud");
    writeActiveWorkspaceId(storage, "cloud", "cloud-workspace");
    writeActiveWorkspaceId(storage, "local", "local-workspace");

    expect(readWorkbenchMode(storage)).toBe("cloud");
    expect(readActiveWorkspaceId(storage, "cloud")).toBe("cloud-workspace");
    expect(readActiveWorkspaceId(storage, "local")).toBe("local-workspace");
  });

  it("defaults to Local and falls back cleanly when browser storage is unavailable", () => {
    expect(readWorkbenchMode(null)).toBe("local");
    expect(readActiveWorkspaceId(null, "cloud")).toBeNull();
    expect(() => writeWorkbenchMode(null, "cloud")).not.toThrow();
    expect(() => writeActiveWorkspaceId(null, "cloud", "workspace")).not.toThrow();
  });

  it("removes the stored selection when the active workspace is deleted", () => {
    const storage = memoryStorage();
    writeActiveWorkspaceId(storage, "cloud", "workspace-1");
    writeActiveWorkspaceId(storage, "cloud", null);
    expect(readActiveWorkspaceId(storage, "cloud")).toBeNull();
  });
});
