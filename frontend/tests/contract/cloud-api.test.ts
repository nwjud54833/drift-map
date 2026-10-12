import { afterEach, describe, expect, it, vi } from "vitest";
import { loadCloudWorkbench, loadOrCreateCloudDiff } from "@/lib/db/cloud-api";

afterEach(() => vi.unstubAllGlobals());

describe("cloud diff hydration", () => {
  it("reloads cloud workspaces, snapshot pointers, and saved OpenAPI snapshots", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ workspaces: [{ id: "workspace-1" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ workspace: {
        id: "workspace-1", name: "Orders", direction: "response", baselineSnapshotId: "before-1", candidateSnapshotId: "after-1",
        createdAt: "2026-01-01", updatedAt: "2026-01-02", snapshots: [
          { id: "before-1", workspaceId: "workspace-1", versionLabel: "v1", contract: { kind: "openapi", operations: [{ key: "/orders#get" }] }, samples: [] },
          { id: "after-1", workspaceId: "workspace-1", versionLabel: "v2", contract: { kind: "openapi", operations: [{ key: "/orders#get" }] }, samples: [] },
        ],
      } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const loaded = await loadCloudWorkbench();
    expect(loaded.workspaces[0]).toMatchObject({ id: "workspace-1", baselineSnapshotId: "before-1", candidateSnapshotId: "after-1" });
    expect(loaded.snapshots.map((snapshot) => snapshot.id)).toEqual(["before-1", "after-1"]);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/v1/workspaces", { cache: "no-store" });
    expect(fetchMock.mock.calls[1][0]).toBe("/api/v1/workspaces/workspace-1");
  });

  it("does not turn a failed saved-diff read into a create request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Database unavailable." }), { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(loadOrCreateCloudDiff("workspace-1", "before-1", "after-1", "response")).rejects.toThrow("Database unavailable.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("loads the persisted change rows for a saved pair", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ diff: {
      id: "diff-1", summary: { breaking: 1, warning: 0, safe: 0, info: 0, total: 1 }, changes: [{
        id: "row-1", pointer: "/paths/~1orders/get", kind: "endpoint_removed", severity: "breaking",
        title: "Operation removed", explanation: "The operation was removed.", beforeNode: null, afterNode: null,
      }],
    } }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadOrCreateCloudDiff("workspace-1", "before-1", "after-1", "response");
    expect(result.id).toBe("diff-1");
    expect(result.changes[0].kind).toBe("endpoint-removed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("direction=response");
  });

  it("persists a missing pair once and uses the returned stored diff", async () => {
    const saved = { diff: { id: "diff-2", summary: { breaking: 0, warning: 0, safe: 1, info: 0, total: 1 }, changes: [] } };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "Diff not found." }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(saved), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadOrCreateCloudDiff("workspace-1", "before-1", "after-1", "event");
    expect(result.id).toBe("diff-2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ workspaceId: "workspace-1", baselineSnapshotId: "before-1", candidateSnapshotId: "after-1" });
  });
});
