import { NextResponse } from "next/server";
import { apiError, authenticatedUserId, isUuid, readJsonBody } from "@/lib/server/api";
import { prisma } from "@/lib/db/prisma";
import { parsePayloadText } from "@/lib/contract/parse";
import { inferContract } from "@/lib/contract/infer";
import { snapshotCreateSchema } from "@/lib/server/contracts";
type Context = { params: Promise<{ workspaceId: string }> };

export async function GET(_request: Request, context: Context) {
  const userId = await authenticatedUserId();
  if (!userId) return apiError("Sign in is required.", 401);
  const { workspaceId } = await context.params;
  if (!isUuid(workspaceId)) return apiError("Invalid workspace ID.", 400);
  try {
    const workspace = await prisma.workspace.findFirst({ where: { id: workspaceId, userId }, select: { id: true } });
    if (!workspace) return apiError("Workspace not found.", 404);
    const snapshots = await prisma.contractSnapshot.findMany({ where: { workspaceId }, orderBy: { createdAt: "asc" }, include: { samples: true } });
    return NextResponse.json({ snapshots });
  } catch {
    return apiError("Unable to load snapshots.", 500);
  }
}

export async function POST(request: Request, context: Context) {
  const userId = await authenticatedUserId();
  if (!userId) return apiError("Sign in is required.", 401);
  const { workspaceId } = await context.params;
  if (!isUuid(workspaceId)) return apiError("Invalid workspace ID.", 400);

  let body: ReturnType<typeof snapshotCreateSchema.parse>;
  try {
    const parsed = snapshotCreateSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return apiError("Invalid snapshot request.", 400);
    body = parsed.data;
  } catch (error) {
    return apiError(error instanceof RangeError ? error.message : "Request body must be valid JSON.", error instanceof RangeError ? 413 : 400);
  }

  let samples;
  try {
    samples = parsePayloadText(JSON.stringify(body.payloads), { source: "paste" });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Invalid payload samples.", 400);
  }
  const contract = inferContract(samples);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.findFirst({ where: { id: workspaceId, userId }, select: { id: true } });
      if (!workspace) return null;
      const snapshot = await tx.contractSnapshot.create({
        data: {
          workspaceId,
          versionLabel: body.versionLabel,
          notes: body.notes,
          sourceFileName: body.sourceFileName,
          contract: contract as never,
          samples: { create: samples.map((sample) => ({
            label: sample.label,
            source: "paste",
            capturedAt: new Date(sample.capturedAt),
            value: sample.value as never,
          })) },
        },
        include: { samples: true },
      });
      await tx.workspace.update({ where: { id: workspace.id }, data: {
        [body.side === "baseline" ? "baselineSnapshotId" : "candidateSnapshotId"]: snapshot.id,
      } });
      const updatedWorkspace = await tx.workspace.findFirst({ where: { id: workspace.id, userId }, select: {
        id: true, baselineSnapshotId: true, candidateSnapshotId: true, updatedAt: true,
      } });
      return { snapshot, workspace: updatedWorkspace };
    });
    if (!result) return apiError("Workspace not found.", 404);
    return NextResponse.json(result, { status: 201 });
  } catch {
    return apiError("Unable to save the snapshot.", 500);
  }
}
