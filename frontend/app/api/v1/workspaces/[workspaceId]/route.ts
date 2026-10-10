import { NextResponse } from "next/server";
import { apiError, authenticatedUserId, isUuid, readJsonBody } from "@/lib/server/api";
import { prisma } from "@/lib/db/prisma";
import { workspaceUpdateSchema } from "@/lib/server/contracts";
type Context = { params: Promise<{ workspaceId: string }> };

export async function GET(_request: Request, context: Context) {
  const userId = await authenticatedUserId();
  if (!userId) return apiError("Sign in is required.", 401);
  const { workspaceId } = await context.params;
  if (!isUuid(workspaceId)) return apiError("Invalid workspace ID.", 400);
  const workspace = await prisma.workspace.findFirst({ where: { id: workspaceId, userId }, include: { snapshots: { orderBy: { createdAt: "asc" }, include: { samples: true } } } });
  if (!workspace) return apiError("Workspace not found.", 404);
  return NextResponse.json({ workspace });
}

export async function PATCH(request: Request, context: Context) {
  const userId = await authenticatedUserId();
  if (!userId) return apiError("Sign in is required.", 401);
  const { workspaceId } = await context.params;
  if (!isUuid(workspaceId)) return apiError("Invalid workspace ID.", 400);
  try {
    const parsed = workspaceUpdateSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return apiError("Invalid workspace request.", 400);
    const hasBaseline = Object.prototype.hasOwnProperty.call(parsed.data, "baselineSnapshotId");
    const hasCandidate = Object.prototype.hasOwnProperty.call(parsed.data, "candidateSnapshotId");
    const updated = await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.findFirst({ where: { id: workspaceId, userId }, select: { id: true } });
      if (!workspace) return null;
      const pointerIds = [parsed.data.baselineSnapshotId, parsed.data.candidateSnapshotId].filter((id): id is string => Boolean(id));
      if (pointerIds.length) {
        const ownedSnapshots = await tx.contractSnapshot.count({ where: { id: { in: pointerIds }, workspaceId } });
        if (ownedSnapshots !== pointerIds.length) return "invalid-snapshot" as const;
      }
      if (hasBaseline || hasCandidate) {
        const { baselineSnapshotId, candidateSnapshotId, ...attributes } = parsed.data;
        return await tx.workspace.update({
          where: { id: workspace.id },
          data: {
            ...attributes,
            ...(hasBaseline ? { baselineSnapshot: baselineSnapshotId ? { connect: { id: baselineSnapshotId } } : { disconnect: true } } : {}),
            ...(hasCandidate ? { candidateSnapshot: candidateSnapshotId ? { connect: { id: candidateSnapshotId } } : { disconnect: true } } : {}),
          },
          select: { id: true, name: true, direction: true, baselineSnapshotId: true, candidateSnapshotId: true, createdAt: true, updatedAt: true },
        });
      }
      return await tx.workspace.update({
        where: { id: workspace.id },
        data: {
          ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
          ...(parsed.data.direction !== undefined ? { direction: parsed.data.direction } : {}),
        },
        select: { id: true, name: true, direction: true, baselineSnapshotId: true, candidateSnapshotId: true, createdAt: true, updatedAt: true },
      });
    });
    if (!updated) return apiError("Workspace not found.", 404);
    if (updated === "invalid-snapshot") return apiError("Referenced snapshot not found.", 404);
    return NextResponse.json({ workspace: updated });
  } catch (error) {
    return apiError(error instanceof RangeError ? error.message : "Unable to update the workspace.", error instanceof RangeError ? 413 : 500);
  }
}

export async function DELETE(_request: Request, context: Context) {
  const userId = await authenticatedUserId();
  if (!userId) return apiError("Sign in is required.", 401);
  const { workspaceId } = await context.params;
  if (!isUuid(workspaceId)) return apiError("Invalid workspace ID.", 400);
  const result = await prisma.workspace.deleteMany({ where: { id: workspaceId, userId } });
  if (result.count !== 1) return apiError("Workspace not found.", 404);
  return new NextResponse(null, { status: 204 });
}
