import { NextResponse } from "next/server";
import { z } from "zod";
import { buildDiff, compareContracts } from "@/lib/contract/compare";
import { inferContract } from "@/lib/contract/infer";
import { parsePayloadText } from "@/lib/contract/parse";
import type { ContractDirection, SnapshotSource } from "@/lib/contract/types";
import { prisma } from "@/lib/db/prisma";
import { apiError, authenticatedUserId, readJsonBody } from "@/lib/server/api";

const directions = ["response", "request", "event"] as const;
const sideSchema = z.object({
  label: z.string().trim().min(1).max(120),
  payloads: z.array(z.unknown()).min(1).max(100),
}).strict();
const diffRequestSchema = z.object({
  workspaceId: z.string().uuid().optional(),
  workspaceName: z.string().trim().min(1).max(120).optional(),
  direction: z.enum(directions),
  baseline: sideSchema,
  candidate: sideSchema,
}).strict();

const sourceToDb: Record<SnapshotSource, "paste" | "file" | "fixture" | "workspace_import"> = {
  paste: "paste", file: "file", fixture: "fixture", "workspace-import": "workspace_import",
};
const kindToDb = (kind: string) => kind.replaceAll("-", "_") as "field_added" | "field_removed" | "type_changed" | "became_required" | "became_optional";

export async function POST(request: Request) {
  const userId = await authenticatedUserId();
  if (!userId) return apiError("Sign in is required.", 401);

  let body: z.infer<typeof diffRequestSchema>;
  try {
    const parsed = diffRequestSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return apiError("Invalid diff request.", 400);
    body = parsed.data;
  } catch (error) {
    if (error instanceof RangeError) return apiError(error.message, 413);
    return apiError("Request body must be valid JSON.", 400);
  }

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
            beforeNode: change.before as never, afterNode: change.after as never,
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
  } catch {
    return apiError("Unable to save the diff.", 500);
  }
}
