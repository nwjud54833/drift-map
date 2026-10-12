/**
 * Real-database integration tests for the persistence and authorization
 * claims of the DriftMap API.
 *
 * Runs ONLY when RUN_DB_TESTS=1: `npm test` stays hermetic by default. The
 * suite runs against a dedicated Postgres schema (`driftmap_test`, prepared by
 * tests/integration/setup-db.mjs) so application and customer data in the
 * default schema are never touched.
 *
 * Usage:
 *   Configure TEST_DATABASE_URL out-of-band for a dedicated test database,
 *   run `node tests/integration/setup-db.mjs`, then set RUN_DB_TESTS=1 and run
 *   `npx vitest run tests/integration`.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
import { parsePayloadText } from "@/lib/contract/parse";
import { inferContract } from "@/lib/contract/infer";
import { compareContracts, buildDiff } from "@/lib/contract/compare";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// The route resolves its session from the real auth module; stub only the
// session accessor so the handler, Prisma layer, and database stay real.
const currentUserId = vi.hoisted(() => ({ value: "" }));
vi.mock("@/auth", () => ({
  auth: async () => (currentUserId.value ? { user: { id: currentUserId.value } } : null),
}));

if (!process.env.RUN_DB_TESTS) {
  describe.skip("database integration", () => { it("skipped without RUN_DB_TESTS=1", () => {}); });
} else {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error("RUN_DB_TESTS=1 requires TEST_DATABASE_URL (see tests/integration/setup-db.mjs).");
  }

  const prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
  let getWorkspaces: typeof import("@/app/api/v1/workspaces/route").GET;
  let postWorkspace: typeof import("@/app/api/v1/workspaces/route").POST;
  let getWorkspace: typeof import("@/app/api/v1/workspaces/[workspaceId]/route").GET;
  let patchWorkspace: typeof import("@/app/api/v1/workspaces/[workspaceId]/route").PATCH;
  let deleteWorkspace: typeof import("@/app/api/v1/workspaces/[workspaceId]/route").DELETE;
  let getWorkspaceSnapshots: typeof import("@/app/api/v1/workspaces/[workspaceId]/snapshots/route").GET;
  let postWorkspaceSnapshot: typeof import("@/app/api/v1/workspaces/[workspaceId]/snapshots/route").POST;
  let getSnapshot: typeof import("@/app/api/v1/snapshots/[snapshotId]/route").GET;
  let patchSnapshot: typeof import("@/app/api/v1/snapshots/[snapshotId]/route").PATCH;
  let deleteSnapshot: typeof import("@/app/api/v1/snapshots/[snapshotId]/route").DELETE;
  let getDiffs: typeof import("@/app/api/v1/diffs/route").GET;
  let postDiff: typeof import("@/app/api/v1/diffs/route").POST;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL!;
    const [workspaces, workspace, snapshots, snapshot, diffs] = await Promise.all([
      import("@/app/api/v1/workspaces/route"),
      import("@/app/api/v1/workspaces/[workspaceId]/route"),
      import("@/app/api/v1/workspaces/[workspaceId]/snapshots/route"),
      import("@/app/api/v1/snapshots/[snapshotId]/route"),
      import("@/app/api/v1/diffs/route"),
    ]);
    getWorkspaces = workspaces.GET;
    postWorkspace = workspaces.POST;
    getWorkspace = workspace.GET;
    patchWorkspace = workspace.PATCH;
    deleteWorkspace = workspace.DELETE;
    getWorkspaceSnapshots = snapshots.GET;
    postWorkspaceSnapshot = snapshots.POST;
    getSnapshot = snapshot.GET;
    patchSnapshot = snapshot.PATCH;
    deleteSnapshot = snapshot.DELETE;
    getDiffs = diffs.GET;
    postDiff = diffs.POST;
  });

  const jsonRequest = (url: string, method: string, body: unknown) => new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  function samplesFor(values: unknown[]) {
    return parsePayloadText(JSON.stringify(values), { source: "paste" });
  }

  async function testUser(email: string) {
    const user = await prisma.user.create({ data: { email, name: email } });
    return prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  }

  async function seedContractData(workspaceId: string) {
    const baselineValues = [{ id: 1, amount: 100 }];
    const candidateValues = [{ id: 1, amount: { cents: 100, currency: "USD" } }];
    const baseline = await prisma.contractSnapshot.create({
      data: {
        workspaceId,
        versionLabel: "baseline",
        contract: inferContract(samplesFor(baselineValues)) as never,
        samples: { create: samplesFor(baselineValues).map((sample) => ({
          label: sample.label, source: "paste" as const, capturedAt: new Date(sample.capturedAt), value: sample.value as never,
        })) },
      },
    });
    const candidate = await prisma.contractSnapshot.create({
      data: {
        workspaceId,
        versionLabel: "candidate",
        contract: inferContract(samplesFor(candidateValues)) as never,
        samples: { create: samplesFor(candidateValues).map((sample) => ({
          label: sample.label, source: "paste" as const, capturedAt: new Date(sample.capturedAt), value: sample.value as never,
        })) },
      },
    });
    return { baseline, candidate };
  }

  async function seedDiffWithChange(workspaceId: string, baselineSnapshotId: string, candidateSnapshotId: string) {
    return prisma.contractDiff.create({
      data: {
        workspaceId,
        baselineSnapshotId,
        candidateSnapshotId,
        direction: "response",
        summary: {},
        changes: { create: [{
          id: `cascade-change-${workspaceId}`,
          pointer: "/value",
          kind: "field_added",
          severity: "safe",
          title: "Added value",
          explanation: "A value was added",
        }] },
      },
      include: { changes: true },
    });
  }

  afterAll(async () => {
    await prisma.$disconnect();
    await globalThis.prisma?.$disconnect();
  });

  const dbTest = (name: string, fn: () => Promise<void>) => it(name, fn, 30_000);

  beforeEach(async () => {
    await prisma.$transaction([
      prisma.contractChange.deleteMany(),
      prisma.contractDiff.deleteMany(),
      prisma.payloadSample.deleteMany(),
      prisma.contractSnapshot.deleteMany(),
      prisma.workspace.deleteMany(),
      prisma.user.deleteMany(),
    ]);
  });

  describe("workspace persistence and ownership", () => {
    dbTest("supports workspace CRUD through authenticated API routes", async () => {
      const user = await testUser("workspace-api@example.com");
      currentUserId.value = user.id;

      const createdResponse = await postWorkspace(jsonRequest("http://localhost/api/v1/workspaces", "POST", {
        name: "API workspace", direction: "response",
      }));
      expect(createdResponse.status).toBe(201);
      const created = (await createdResponse.json() as { workspace: { id: string; name: string } }).workspace;

      const listedResponse = await getWorkspaces();
      const listed = (await listedResponse.json() as { workspaces: Array<{ id: string }> }).workspaces;
      expect(listed.some((workspace) => workspace.id === created.id)).toBe(true);

      const params = { params: Promise.resolve({ workspaceId: created.id }) };
      const detail = await getWorkspace(new Request(`http://localhost/api/v1/workspaces/${created.id}`), params);
      expect(detail.status).toBe(200);
      const renamed = await patchWorkspace(jsonRequest(`http://localhost/api/v1/workspaces/${created.id}`, "PATCH", { name: "Renamed workspace" }), params);
      expect((await renamed.json() as { workspace: { name: string } }).workspace.name).toBe("Renamed workspace");

      const deleted = await deleteWorkspace(new Request(`http://localhost/api/v1/workspaces/${created.id}`, { method: "DELETE" }), params);
      expect(deleted.status).toBe(204);
      expect(await prisma.workspace.findUnique({ where: { id: created.id } })).toBeNull();
    });

    dbTest("deleting a workspace through the API cascades through pointers, snapshots, samples, diffs, and changes", async () => {
      const user = await testUser("workspace-cascade@example.com");
      currentUserId.value = user.id;
      const workspace = await prisma.workspace.create({ data: { userId: user.id, name: "Cascade", direction: "response" } });
      const { baseline, candidate } = await seedContractData(workspace.id);
      await prisma.workspace.update({
        where: { id: workspace.id },
        data: { baselineSnapshotId: baseline.id, candidateSnapshotId: candidate.id },
      });
      const saved = await seedDiffWithChange(workspace.id, baseline.id, candidate.id);
      expect(await prisma.payloadSample.count({ where: { snapshotId: baseline.id } })).toBeGreaterThan(0);

      const response = await deleteWorkspace(
        new Request(`http://localhost/api/v1/workspaces/${workspace.id}`, { method: "DELETE" }),
        { params: Promise.resolve({ workspaceId: workspace.id }) },
      );

      expect(response.status).toBe(204);
      expect(await prisma.workspace.findUnique({ where: { id: workspace.id } })).toBeNull();
      expect(await prisma.contractSnapshot.count({ where: { workspaceId: workspace.id } })).toBe(0);
      expect(await prisma.payloadSample.count({ where: { snapshotId: { in: [baseline.id, candidate.id] } } })).toBe(0);
      expect(await prisma.contractDiff.findUnique({ where: { id: saved.id } })).toBeNull();
      expect(await prisma.contractChange.count({ where: { diffId: saved.id } })).toBe(0);
    });

    dbTest("persists a workspace with payload samples and reloads it", async () => {
      const user = await testUser("owner@example.com");
      const workspace = await prisma.workspace.create({
        data: { userId: user.id, name: "Webhook Migration", direction: "event" },
      });
      const { baseline } = await seedContractData(workspace.id);
      const reloaded = await prisma.workspace.findFirst({
        where: { id: workspace.id, userId: user.id },
        include: { snapshots: { include: { samples: true } } },
      });
      expect(reloaded).not.toBeNull();
      expect(reloaded?.snapshots).toHaveLength(2);
      expect(reloaded?.snapshots[0].samples.length).toBeGreaterThan(0);
      expect(baseline.id).toBeTruthy();
    });

    dbTest("isolates workspaces between two users", async () => {
      const a = await testUser("user-a@example.com");
      const b = await testUser("user-b@example.com");
      const wsA = await prisma.workspace.create({ data: { userId: a.id, name: "A Workspace", direction: "response" } });
      await prisma.workspace.create({ data: { userId: b.id, name: "B Workspace", direction: "response" } });
      const visibleToA = await prisma.workspace.findMany({ where: { userId: a.id } });
      expect(visibleToA).toHaveLength(1);
      expect(visibleToA[0].id).toBe(wsA.id);
      // A query scoped like the API handler must not find B's workspace.
      const foreignAccess = await prisma.workspace.findFirst({ where: { id: wsA.id, userId: b.id } });
      expect(foreignAccess).toBeNull();
    });
  });

  describe("snapshot CRUD with payload samples", () => {
    dbTest("supports snapshot create, list, read, update, and delete through authenticated API routes", async () => {
      const user = await testUser("snapshot-api@example.com");
      currentUserId.value = user.id;
      const workspace = await prisma.workspace.create({ data: { userId: user.id, name: "Snapshot API", direction: "response" } });
      const workspaceParams = { params: Promise.resolve({ workspaceId: workspace.id }) };
      const createResponse = await postWorkspaceSnapshot(jsonRequest(`http://localhost/api/v1/workspaces/${workspace.id}/snapshots`, "POST", {
        versionLabel: "v1", side: "baseline", payloads: [{ id: 1, value: "persisted" }],
      }), workspaceParams);
      expect(createResponse.status).toBe(201);
      const created = (await createResponse.json() as { snapshot: { id: string; samples: Array<{ value: unknown }> } }).snapshot;
      expect(created.samples).toHaveLength(1);

      const listedResponse = await getWorkspaceSnapshots(new Request(`http://localhost/api/v1/workspaces/${workspace.id}/snapshots`), workspaceParams);
      expect((await listedResponse.json() as { snapshots: unknown[] }).snapshots).toHaveLength(1);
      const snapshotParams = { params: Promise.resolve({ snapshotId: created.id }) };
      const readResponse = await getSnapshot(new Request(`http://localhost/api/v1/snapshots/${created.id}`), snapshotParams);
      expect((await readResponse.json() as { snapshot: { samples: unknown[] } }).snapshot.samples).toHaveLength(1);

      const updated = await patchSnapshot(jsonRequest(`http://localhost/api/v1/snapshots/${created.id}`, "PATCH", { versionLabel: "v1-renamed" }), snapshotParams);
      expect((await updated.json() as { snapshot: { versionLabel: string } }).snapshot.versionLabel).toBe("v1-renamed");
      const deleted = await deleteSnapshot(new Request(`http://localhost/api/v1/snapshots/${created.id}`, { method: "DELETE" }), snapshotParams);
      expect(deleted.status).toBe(204);
      expect(await prisma.payloadSample.count({ where: { snapshotId: created.id } })).toBe(0);
      expect((await prisma.workspace.findUniqueOrThrow({ where: { id: workspace.id } })).baselineSnapshotId).toBeNull();
    });

    dbTest("deleting the baseline snapshot through the API clears only the baseline and cascades dependent data", async () => {
      const user = await testUser("baseline-delete@example.com");
      currentUserId.value = user.id;
      const workspace = await prisma.workspace.create({ data: { userId: user.id, name: "Baseline delete", direction: "response" } });
      const { baseline, candidate } = await seedContractData(workspace.id);
      await prisma.workspace.update({
        where: { id: workspace.id },
        data: { baselineSnapshotId: baseline.id, candidateSnapshotId: candidate.id },
      });
      const diff = await seedDiffWithChange(workspace.id, baseline.id, candidate.id);

      const response = await deleteSnapshot(
        new Request(`http://localhost/api/v1/snapshots/${baseline.id}`, { method: "DELETE" }),
        { params: Promise.resolve({ snapshotId: baseline.id }) },
      );

      expect(response.status).toBe(204);
      const reloaded = await prisma.workspace.findUniqueOrThrow({ where: { id: workspace.id } });
      expect(reloaded.baselineSnapshotId).toBeNull();
      expect(reloaded.candidateSnapshotId).toBe(candidate.id);
      expect(await prisma.contractSnapshot.findUnique({ where: { id: baseline.id } })).toBeNull();
      expect(await prisma.payloadSample.count({ where: { snapshotId: baseline.id } })).toBe(0);
      expect(await prisma.contractSnapshot.findUnique({ where: { id: candidate.id } })).not.toBeNull();
      expect(await prisma.payloadSample.count({ where: { snapshotId: candidate.id } })).toBeGreaterThan(0);
      expect(await prisma.contractDiff.findUnique({ where: { id: diff.id } })).toBeNull();
      expect(await prisma.contractChange.count({ where: { diffId: diff.id } })).toBe(0);
    });

    dbTest("deleting the candidate snapshot through the API clears only the candidate and cascades dependent data", async () => {
      const user = await testUser("candidate-delete@example.com");
      currentUserId.value = user.id;
      const workspace = await prisma.workspace.create({ data: { userId: user.id, name: "Candidate delete", direction: "response" } });
      const { baseline, candidate } = await seedContractData(workspace.id);
      await prisma.workspace.update({
        where: { id: workspace.id },
        data: { baselineSnapshotId: baseline.id, candidateSnapshotId: candidate.id },
      });
      const diff = await seedDiffWithChange(workspace.id, baseline.id, candidate.id);

      const response = await deleteSnapshot(
        new Request(`http://localhost/api/v1/snapshots/${candidate.id}`, { method: "DELETE" }),
        { params: Promise.resolve({ snapshotId: candidate.id }) },
      );

      expect(response.status).toBe(204);
      const reloaded = await prisma.workspace.findUniqueOrThrow({ where: { id: workspace.id } });
      expect(reloaded.baselineSnapshotId).toBe(baseline.id);
      expect(reloaded.candidateSnapshotId).toBeNull();
      expect(await prisma.contractSnapshot.findUnique({ where: { id: candidate.id } })).toBeNull();
      expect(await prisma.payloadSample.count({ where: { snapshotId: candidate.id } })).toBe(0);
      expect(await prisma.contractSnapshot.findUnique({ where: { id: baseline.id } })).not.toBeNull();
      expect(await prisma.payloadSample.count({ where: { snapshotId: baseline.id } })).toBeGreaterThan(0);
      expect(await prisma.contractDiff.findUnique({ where: { id: diff.id } })).toBeNull();
      expect(await prisma.contractChange.count({ where: { diffId: diff.id } })).toBe(0);
    });

    dbTest("creates, renames, and deletes a snapshot and samples", async () => {
      const user = await testUser("snap-owner@example.com");
      const workspace = await prisma.workspace.create({ data: { userId: user.id, name: "Snapshots", direction: "response" } });
      const { baseline } = await seedContractData(workspace.id);

      const renamed = await prisma.contractSnapshot.update({
        where: { id: baseline.id },
        data: { versionLabel: "baseline-renamed" },
      });
      expect(renamed.versionLabel).toBe("baseline-renamed");

      await prisma.workspace.update({
        where: { id: workspace.id },
        data: { baselineSnapshot: { disconnect: true } },
      });
      await prisma.contractSnapshot.delete({ where: { id: baseline.id } });

      const samples = await prisma.payloadSample.count({ where: { snapshotId: baseline.id } });
      expect(samples).toBe(0);
    });
  });

  describe("diff persistence and retrieval", () => {
    dbTest("rejects a cross-workspace baseline pointer at the database level", async () => {
      const owner = await testUser("pointer-integrity@example.com");
      const workspaceA = await prisma.workspace.create({ data: { userId: owner.id, name: "Pointer A", direction: "response" } });
      const workspaceB = await prisma.workspace.create({ data: { userId: owner.id, name: "Pointer B", direction: "response" } });
      const { baseline: foreignSnapshot } = await seedContractData(workspaceB.id);

      await expect(prisma.$executeRaw`
        UPDATE "Workspace"
        SET "baselineSnapshotId" = ${foreignSnapshot.id}::uuid
        WHERE "id" = ${workspaceA.id}::uuid
      `).rejects.toThrow();
      await expect(prisma.$executeRaw`
        UPDATE "Workspace"
        SET "candidateSnapshotId" = ${foreignSnapshot.id}::uuid
        WHERE "id" = ${workspaceA.id}::uuid
      `).rejects.toThrow();
    });

    dbTest("rejects a diff that associates snapshots from another workspace", async () => {
      const owner = await testUser("integrity-owner@example.com");
      const workspaceA = await prisma.workspace.create({ data: { userId: owner.id, name: "Workspace A", direction: "response" } });
      const workspaceB = await prisma.workspace.create({ data: { userId: owner.id, name: "Workspace B", direction: "response" } });
      const { baseline } = await seedContractData(workspaceA.id);
      const { candidate } = await seedContractData(workspaceB.id);

      await expect(prisma.contractDiff.create({
        data: {
          workspaceId: workspaceA.id,
          baselineSnapshotId: baseline.id,
          candidateSnapshotId: candidate.id,
          direction: "response",
          summary: {},
        },
      })).rejects.toMatchObject({ code: "P2003" });
    });

    dbTest("saves and reloads a diff with persisted change details", async () => {
      const user = await testUser("diff-owner@example.com");
      const workspace = await prisma.workspace.create({ data: { userId: user.id, name: "Diffs", direction: "response" } });
      const { baseline, candidate } = await seedContractData(workspace.id);
      const changes = compareContracts(
        inferContract(samplesFor([{ id: 1, amount: 100 }])),
        inferContract(samplesFor([{ id: 1, amount: { cents: 100, currency: "USD" } }])),
        "response",
      );
      expect(changes.length).toBeGreaterThan(0);
      const diff = buildDiff(baseline.id, candidate.id, "response", changes, "2026-10-11T00:00:00.000Z");
      await prisma.contractDiff.create({
        data: {
          workspaceId: workspace.id,
          baselineSnapshotId: baseline.id,
          candidateSnapshotId: candidate.id,
          direction: "response",
          summary: diff.summary,
          changes: { create: changes.map((change) => ({
            id: createHash("sha256").update(`${baseline.id}:${candidate.id}:${change.id}`).digest("hex").slice(0, 24),
            pointer: change.pointer, kind: change.kind.replace(/-/g, "_") as never, severity: change.severity,
            title: change.title, explanation: change.explanation,
            beforeNode: change.before === null ? Prisma.DbNull : change.before as never,
            afterNode: change.after === null ? Prisma.DbNull : change.after as never,
          })) },
        },
      });

      const reloaded = await prisma.contractDiff.findFirst({
        where: { workspaceId: workspace.id, workspace: { userId: user.id } },
        include: { changes: true },
      });
      expect(reloaded).not.toBeNull();
      expect(reloaded?.summary).toEqual(diff.summary);
      expect(reloaded?.changes.length).toBe(changes.length);
      for (const change of changes) {
        expect(reloaded?.changes.some((row) => row.pointer === change.pointer && row.kind === change.kind.replace(/-/g, "_"))).toBe(true);
      }
    });

    dbTest("persists a successful POST /api/v1/diffs and cascades change rows when its diff is deleted", async () => {
      const user = await testUser("diff-post@example.com");
      const workspace = await prisma.workspace.create({ data: { userId: user.id, name: "Diff POST", direction: "response" } });
      currentUserId.value = user.id;
      const response = await postDiff(jsonRequest("http://localhost/api/v1/diffs", "POST", {
        workspaceId: workspace.id,
        direction: "response",
        baseline: { label: "before", payloads: [{ id: 1, amount: 10 }] },
        candidate: { label: "after", payloads: [{ id: 1, amount: { value: 10 } }] },
      }));
      expect(response.status).toBe(201);
      const result = (await response.json()) as { diff: { id: string }; baselineSnapshotId: string; candidateSnapshotId: string };
      const reloaded = await prisma.contractDiff.findUniqueOrThrow({
        where: { id: result.diff.id },
        include: { changes: true, baselineSnapshot: { include: { samples: true } }, candidateSnapshot: { include: { samples: true } } },
      });
      expect(reloaded.changes.length).toBeGreaterThan(0);
      expect(reloaded.baselineSnapshot.samples).toHaveLength(1);
      expect(reloaded.candidateSnapshot.samples).toHaveLength(1);

      await prisma.contractDiff.delete({ where: { id: reloaded.id } });
      expect(await prisma.contractChange.count({ where: { diffId: reloaded.id } })).toBe(0);
    });
  });

  describe("GET /api/v1/diffs handler against the real database", () => {
    dbTest("persists an OpenAPI snapshot pair and reloads the semantic change rows", async () => {
      const user = await testUser("openapi-persistence@example.com");
      currentUserId.value = user.id;
      const workspace = await prisma.workspace.create({ data: { userId: user.id, name: "OpenAPI import", direction: "response" } });
      const baselineText = readFileSync("fixtures/openapi-v3.yaml", "utf8");
      const candidateText = baselineText.replace("[open, closed]", "[open, fulfilled]");
      const baselineResponse = await postWorkspaceSnapshot(jsonRequest("http://localhost/api/v1/workspaces/snapshots", "POST", {
        versionLabel: "baseline", side: "baseline", sourceFileName: "api.yaml", documentText: baselineText,
      }), { params: Promise.resolve({ workspaceId: workspace.id }) });
      expect(baselineResponse.status).toBe(201);
      const baseline = (await baselineResponse.json() as { snapshot: { id: string; samples: unknown[]; contract: { kind: string } } }).snapshot;
      expect(baseline.contract.kind).toBe("openapi");
      expect(baseline.samples).toHaveLength(0);

      const candidateResponse = await postWorkspaceSnapshot(jsonRequest("http://localhost/api/v1/workspaces/snapshots", "POST", {
        versionLabel: "candidate", side: "candidate", sourceFileName: "api.yaml", documentText: candidateText,
      }), { params: Promise.resolve({ workspaceId: workspace.id }) });
      expect(candidateResponse.status).toBe(201);
      const candidate = (await candidateResponse.json() as { snapshot: { id: string } }).snapshot;

      const saved = await postDiff(jsonRequest("http://localhost/api/v1/diffs", "POST", {
        workspaceId: workspace.id, baselineSnapshotId: baseline.id, candidateSnapshotId: candidate.id,
      }));
      expect(saved.status).toBe(200);
      const persisted = (await saved.json() as { diff: { id: string; changes: Array<{ kind: string; title: string }> } }).diff;
      expect(persisted.changes.some((change) => change.kind === "enum_changed" && change.title.startsWith("Enum values"))).toBe(true);
      const retried = await postDiff(jsonRequest("http://localhost/api/v1/diffs", "POST", {
        workspaceId: workspace.id, baselineSnapshotId: baseline.id, candidateSnapshotId: candidate.id,
      }));
      expect(retried.status).toBe(200);
      expect(((await retried.json()) as { diff: { id: string } }).diff.id).toBe(persisted.id);
      expect(await prisma.contractDiff.count({ where: { baselineSnapshotId: baseline.id, candidateSnapshotId: candidate.id, direction: "response" } })).toBe(1);

      const reload = await getDiffs(new Request(`http://localhost/api/v1/diffs?workspaceId=${workspace.id}&baselineSnapshotId=${baseline.id}&candidateSnapshotId=${candidate.id}&direction=response`));
      expect(reload.status).toBe(200);
      const loaded = (await reload.json() as { diff: { id: string; changes: Array<{ kind: string }> } }).diff;
      expect(loaded.id).toBe(persisted.id);
      expect(loaded.changes.some((change) => change.kind === "enum_changed")).toBe(true);
    });

    dbTest("returns saved diffs with change details for the owning session", async () => {
      const user = await testUser("route-owner@example.com");
      const workspace = await prisma.workspace.create({ data: { userId: user.id, name: "Route Diffs", direction: "event" } });
      const { baseline, candidate } = await seedContractData(workspace.id);
      const changes = compareContracts(
        inferContract(samplesFor([{ id: 1, total_cents: 100 }])),
        inferContract(samplesFor([{ id: 1, total: { amount: 100 } }])),
        "event",
      );
      const diff = buildDiff(baseline.id, candidate.id, "event", changes, "2026-10-11T00:00:00.000Z");
      await prisma.contractDiff.create({
        data: {
          workspaceId: workspace.id,
          baselineSnapshotId: baseline.id,
          candidateSnapshotId: candidate.id,
          direction: "event",
          summary: diff.summary,
          changes: { create: changes.map((change) => ({
            id: createHash("sha256").update(`${baseline.id}:${candidate.id}:${change.id}`).digest("hex").slice(0, 24),
            pointer: change.pointer, kind: change.kind.replace(/-/g, "_") as never, severity: change.severity,
            title: change.title, explanation: change.explanation,
            beforeNode: change.before === null ? Prisma.DbNull : change.before as never,
            afterNode: change.after === null ? Prisma.DbNull : change.after as never,
          })) },
        },
      });
      currentUserId.value = user.id;

      const list = await getDiffs(new Request("http://localhost/api/v1/diffs"));
      expect(list.status).toBe(200);
      const listed = (await list.json() as { diffs: Array<{ workspaceId: string; summary: unknown }> }).diffs;
      expect(listed).toHaveLength(1);
      expect(listed[0].workspaceId).toBe(workspace.id);
      expect(listed[0].summary).toEqual(diff.summary);

      const detail = await getDiffs(new Request(
        `http://localhost/api/v1/diffs?workspaceId=${workspace.id}&baselineSnapshotId=${baseline.id}&candidateSnapshotId=${candidate.id}`,
      ));
      expect(detail.status).toBe(200);
      const loaded = (await detail.json() as { diff: { summary: unknown; changes: Array<{ pointer: string }> } }).diff;
      expect(loaded.summary).toEqual(diff.summary);
      expect(loaded.changes.map((change) => change.pointer).sort()).toEqual(changes.map((change) => change.pointer).sort());
    });

    dbTest("hides foreign diffs and rejects malformed identifiers", async () => {
      const owner = await testUser("route-hidden-owner@example.com");
      const workspace = await prisma.workspace.create({ data: { userId: owner.id, name: "Hidden", direction: "response" } });
      const { baseline, candidate } = await seedContractData(workspace.id);
      const diff = buildDiff(baseline.id, candidate.id, "response", [], "2026-10-11T00:00:00.000Z");
      await prisma.contractDiff.create({
        data: {
          workspaceId: workspace.id,
          baselineSnapshotId: baseline.id,
          candidateSnapshotId: candidate.id,
          direction: "response",
          summary: diff.summary,
        },
      });

      currentUserId.value = "someone-else";
      const foreign = await getDiffs(new Request(
        `http://localhost/api/v1/diffs?workspaceId=${workspace.id}&baselineSnapshotId=${baseline.id}&candidateSnapshotId=${candidate.id}`,
      ));
      expect(foreign.status).toBe(404);
      const foreignList = await getDiffs(new Request("http://localhost/api/v1/diffs"));
      expect(((await foreignList.json()) as { diffs: unknown[] }).diffs).toHaveLength(0);

      currentUserId.value = owner.id;
      const malformed = await getDiffs(new Request(
        `http://localhost/api/v1/diffs?workspaceId=not-a-uuid&baselineSnapshotId=${baseline.id}&candidateSnapshotId=${candidate.id}`,
      ));
      expect(malformed.status).toBe(400);
    });
  });
}
