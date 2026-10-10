import { NextResponse } from "next/server";
import { apiError, authenticatedUserId, isUuid, readJsonBody } from "@/lib/server/api";
import { prisma } from "@/lib/db/prisma";
import { snapshotUpdateSchema } from "@/lib/server/contracts";
type Context = { params: Promise<{ snapshotId: string }> };

export async function GET(_request: Request, context: Context) {
  const userId = await authenticatedUserId();
  if (!userId) return apiError("Sign in is required.", 401);
  const { snapshotId } = await context.params;
  if (!isUuid(snapshotId)) return apiError("Invalid snapshot ID.", 400);
  try {
    const snapshot = await prisma.contractSnapshot.findFirst({ where: { id: snapshotId, workspace: { userId } }, include: { samples: true } });
    if (!snapshot) return apiError("Snapshot not found.", 404);
    return NextResponse.json({ snapshot });
  } catch {
    return apiError("Unable to load the snapshot.", 500);
  }
}

export async function DELETE(_request: Request, context: Context) {
  const userId = await authenticatedUserId();
  if (!userId) return apiError("Sign in is required.", 401);
  const { snapshotId } = await context.params;
  if (!isUuid(snapshotId)) return apiError("Invalid snapshot ID.", 400);
  try {
    const result = await prisma.$transaction(async (tx) => {
      const snapshot = await tx.contractSnapshot.findFirst({ where: { id: snapshotId, workspace: { userId } }, select: { id: true, workspaceId: true } });
      if (!snapshot) return null;
      const workspace = await tx.workspace.findFirst({ where: { id: snapshot.workspaceId, userId }, select: { id: true, baselineSnapshotId: true, candidateSnapshotId: true } });
      if (!workspace) return null;
      await tx.workspace.update({ where: { id: workspace.id }, data: {
        ...(workspace.baselineSnapshotId === snapshot.id ? { baselineSnapshot: { disconnect: true } } : {}),
        ...(workspace.candidateSnapshotId === snapshot.id ? { candidateSnapshot: { disconnect: true } } : {}),
      } });
      await tx.contractSnapshot.delete({ where: { id: snapshot.id } });
      return { id: snapshot.id };
    });
    if (!result) return apiError("Snapshot not found.", 404);
    return new NextResponse(null, { status: 204 });
  } catch {
    return apiError("Unable to delete the snapshot.", 500);
  }
}

export async function PATCH(request: Request, context: Context) {
  const userId = await authenticatedUserId();
  if (!userId) return apiError("Sign in is required.", 401);
  const { snapshotId } = await context.params;
  if (!isUuid(snapshotId)) return apiError("Invalid snapshot ID.", 400);
  try {
    const parsed = snapshotUpdateSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return apiError("Invalid snapshot request.", 400);
    const result = await prisma.contractSnapshot.updateMany({ where: { id: snapshotId, workspace: { userId } }, data: parsed.data });
    if (result.count !== 1) return apiError("Snapshot not found.", 404);
    const snapshot = await prisma.contractSnapshot.findFirst({ where: { id: snapshotId, workspace: { userId } }, include: { samples: true } });
    return NextResponse.json({ snapshot });
  } catch (error) {
    return apiError(error instanceof RangeError ? error.message : "Unable to rename the snapshot.", error instanceof RangeError ? 413 : 500);
  }
}
