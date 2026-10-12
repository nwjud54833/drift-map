import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma, type ChangeKind as PrismaChangeKind } from "@prisma/client";
import { buildDiff, compareContracts } from "@/lib/contract/compare";
import { OpenApiComparisonError } from "@/lib/contract/openapi";
import { inferContract } from "@/lib/contract/infer";
import { parsePayloadText } from "@/lib/contract/parse";
import type { ChangeKind, ContractDirection, SnapshotSource, StoredContract } from "@/lib/contract/types";
import { prisma } from "@/lib/db/prisma";
import { apiError, isUuid, readJsonBody, requireAuthenticatedUser } from "@/lib/server/api";

const directions = ["response", "request", "event"] as const;
const sideSchema = z.object({
  label: z.string().trim().min(1).max(120),
  payloads: z.array(z.unknown()).min(1).max(100),
}).strict();
const payloadDiffRequestSchema = z.object({
  workspaceId: z.string().uuid().optional(),
  workspaceName: z.string().trim().min(1).max(120).optional(),
  direction: z.enum(directions),
  baseline: sideSchema,
  candidate: sideSchema,
}).strict();
const snapshotDiffRequestSchema = z.object({
  workspaceId: z.string().uuid(),
  baselineSnapshotId: z.string().uuid(),
  candidateSnapshotId: z.string().uuid(),
}).strict();
const diffRequestSchema = z.union([payloadDiffRequestSchema, snapshotDiffRequestSchema]);

const sourceToDb: Record<SnapshotSource, "paste" | "file" | "fixture" | "workspace_import"> = {
  paste: "paste", file: "file", fixture: "fixture", "workspace-import": "workspace_import",
};
const kindToDb = (kind: ChangeKind): PrismaChangeKind => kind.replaceAll("-", "_") as PrismaChangeKind;

/**
 * Lists persisted diffs for the session user. When `workspaceId` query
 * parameters identify a pair of snapshots, returns the full diff including its
 * persisted change details; otherwise returns summary rows for every diff the
 * user can access.
 */
export async function GET(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser();
    if (!authResult.ok) return authResult.response;

    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId") ?? "";
    const baselineSnapshotId = url.searchParams.get("baselineSnapshotId") ?? "";
    const candidateSnapshotId = url.searchParams.get("candidateSnapshotId") ?? "";
    const directionParam = url.searchParams.get("direction");
    const wantsDetail = workspaceId !== "" || baselineSnapshotId !== "" || candidateSnapshotId !== "";

    if (wantsDetail) {
      if (!isUuid(workspaceId) || !isUuid(baselineSnapshotId) || !isUuid(candidateSnapshotId)) {
        return apiError("Invalid diff identifiers.", 400);
      }
      if (directionParam !== null && !directions.includes(directionParam as ContractDirection)) return apiError("Invalid diff direction.", 400);
      const diff = await prisma.contractDiff.findFirst({
        where: {
          workspaceId,
          baselineSnapshotId,
          candidateSnapshotId,
          ...(directionParam ? { direction: directionParam as ContractDirection } : {}),
          workspace: { userId: authResult.userId },
        },
        include: { changes: { orderBy: [{ severity: "asc" }, { pointer: "asc" }] } },
      });
      if (!diff) return apiError("Diff not found.", 404);
      return NextResponse.json({ diff });
    }

    const diffs = await prisma.contractDiff.findMany({
      where: { workspace: { userId: authResult.userId } },
      orderBy: { generatedAt: "desc" },
      select: {
        id: true,
        workspaceId: true,
        baselineSnapshotId: true,
        candidateSnapshotId: true,
        direction: true,
        summary: true,
        generatedAt: true,
      },
    });
    return NextResponse.json({ diffs });
  } catch {
    return apiError("Unable to load diffs.", 500);
  }
}

export async function POST(request: Request) {
  const authResult = await requireAuthenticatedUser();
  if (!authResult.ok) return authResult.response;
  const userId = authResult.userId;

  let body: z.infer<typeof diffRequestSchema>;
  try {
    const parsed = diffRequestSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return apiError("Invalid diff request.", 400);
    body = parsed.data;
  } catch (error) {
    if (error instanceof RangeError) return apiError(error.message, 413);
    return apiError("Request body must be valid JSON.", 400);
  }

  if ("baselineSnapshotId" in body) return saveSnapshotDiff(body, userId);

  let baselineSamples;
  let candidateSamples;
  try {
    baselineSamples = parsePayloadText(JSON.stringify(body.baseline.payloads), { source: "paste" });
    candidateSamples = parsePayloadText(JSON.stringify(body.candidate.payloads), { source: "paste" });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Invalid payload samples.", 400);
  }

  const direction = body.direction as ContractDirection;
  const baselineContract = inferContract(baselineSamples);
  const candidateContract = inferContract(candidateSamples);
  const changes = compareContracts(baselineContract, candidateContract, direction);
  const generatedAt = new Date().toISOString();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const workspace = body.workspaceId
        ? await tx.workspace.findFirst({ where: { id: body.workspaceId, userId } })
        : await tx.workspace.create({
            data: { userId, name: body.workspaceName ?? "Contract diff", direction },
          });
      if (!workspace) return null;

      const [baseline, candidate] = await Promise.all([
        tx.contractSnapshot.create({
          data: {
            workspaceId: workspace.id, versionLabel: body.baseline.label,
            contract: baselineContract as never,
            samples: { create: baselineSamples.map((sample) => ({
              label: sample.label, source: sourceToDb[sample.source], capturedAt: new Date(sample.capturedAt), value: sample.value as never,
            })) },
          },
        }),
        tx.contractSnapshot.create({
          data: {
            workspaceId: workspace.id, versionLabel: body.candidate.label,
            contract: candidateContract as never,
            samples: { create: candidateSamples.map((sample) => ({
              label: sample.label, source: sourceToDb[sample.source], capturedAt: new Date(sample.capturedAt), value: sample.value as never,
            })) },
          },
        }),
      ]);
      const diff = buildDiff(baseline.id, candidate.id, direction, changes, generatedAt);
      const savedDiff = await tx.contractDiff.create({
        data: {
          workspaceId: workspace.id, baselineSnapshotId: baseline.id, candidateSnapshotId: candidate.id,
          direction, summary: diff.summary,
          changes: { create: changes.map((change) => ({
            id: `${baseline.id}:${candidate.id}:${change.id}`,
            pointer: change.pointer, kind: kindToDb(change.kind), severity: change.severity,
            title: change.title, explanation: change.explanation,
            beforeNode: change.before === null ? Prisma.DbNull : change.before as never,
            afterNode: change.after === null ? Prisma.DbNull : change.after as never,
          })) },
        },
      });
      await tx.workspace.update({ where: { id: workspace.id }, data: {
        direction, baselineSnapshotId: baseline.id, candidateSnapshotId: candidate.id,
      } });
      return { workspaceId: workspace.id, baselineSnapshotId: baseline.id, candidateSnapshotId: candidate.id, diff: { ...diff, id: savedDiff.id } };
    });
    if (!result) return apiError("Workspace not found.", 404);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof OpenApiComparisonError) return apiError(error.message, 422);
    return apiError("Unable to save the diff.", 500);
  }
}

async function saveSnapshotDiff(body: z.infer<typeof snapshotDiffRequestSchema>, userId: string) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.findFirst({ where: { id: body.workspaceId, userId } });
      if (!workspace) return null;
      const [baseline, candidate] = await Promise.all([
        tx.contractSnapshot.findFirst({ where: { id: body.baselineSnapshotId, workspaceId: workspace.id } }),
        tx.contractSnapshot.findFirst({ where: { id: body.candidateSnapshotId, workspaceId: workspace.id } }),
      ]);
      if (!baseline || !candidate) return null;
      const direction = workspace.direction as ContractDirection;
      const changes = compareContracts(baseline.contract as unknown as StoredContract, candidate.contract as unknown as StoredContract, direction);
      const diff = buildDiff(baseline.id, candidate.id, direction, changes);
      const unique = { baselineSnapshotId: baseline.id, candidateSnapshotId: candidate.id, direction };
      const saved = await tx.contractDiff.upsert({
        where: { baselineSnapshotId_candidateSnapshotId_direction: unique },
        create: { workspaceId: workspace.id, ...unique, summary: diff.summary },
        update: { workspaceId: workspace.id, summary: diff.summary },
      });
      await tx.contractChange.deleteMany({ where: { diffId: saved.id } });
      if (changes.length) await tx.contractChange.createMany({ data: changes.map((change) => ({
        id: `${saved.id}:${change.id}`,
        diffId: saved.id,
        pointer: change.pointer,
        kind: kindToDb(change.kind),
        severity: change.severity,
        title: change.title,
        explanation: change.explanation,
        beforeNode: change.before === null ? Prisma.DbNull : change.before as never,
        afterNode: change.after === null ? Prisma.DbNull : change.after as never,
      })) });
      return tx.contractDiff.findUnique({ where: { id: saved.id }, include: { changes: { orderBy: [{ severity: "asc" }, { pointer: "asc" }] } } });
    });
    if (!result) return apiError("Workspace or snapshot not found.", 404);
    return NextResponse.json({ diff: result }, { status: 200 });
  } catch (error) {
    if (error instanceof OpenApiComparisonError) return apiError(error.message, 422);
    return apiError("Unable to save the diff.", 500);
  }
}
