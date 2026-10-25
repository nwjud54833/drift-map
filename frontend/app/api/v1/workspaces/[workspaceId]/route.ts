import { NextResponse } from "next/server";
import { apiError, isUuid, readJsonBody, requireAuthenticatedUser, tooManyRequests } from "@/lib/server/api";
import { checkRateLimit, WRITE_RATE_LIMIT } from "@/lib/server/rate-limit";
import { prisma } from "@/lib/db/prisma";
import { workspaceUpdateSchema } from "@/lib/server/contracts";
type Context = { params: Promise<{ workspaceId: string }> };

export async function GET(_request: Request, context: Context) {
  const authResult = await requireAuthenticatedUser();
  if (!authResult.ok) return authResult.response;
  const { workspaceId } = await context.params;
  if (!isUuid(workspaceId)) return apiError("Invalid workspace ID.", 400);
  try {
    const workspace = await prisma.workspace.findFirst({ where: { id: workspaceId, userId: authResult.userId }, include: { snapshots: { orderBy: { createdAt: "asc" }, include: { samples: true } } } });
    if (!workspace) return apiError("Workspace not found.", 404);
    return NextResponse.json({ workspace });
  } catch {
    return apiError("Unable to load the workspace.", 500);
  }
}

export async function PATCH(request: Request, context: Context) {
  const authResult = await requireAuthenticatedUser();
  if (!authResult.ok) return authResult.response;
  const limit = checkRateLimit("v1:workspace:patch", authResult.userId, WRITE_RATE_LIMIT.limit, WRITE_RATE_LIMIT.windowMs);
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);
  const { workspaceId } = await context.params;
  if (!isUuid(workspaceId)) return apiError("Invalid workspace ID.", 400);
  try {
    const parsed = workspaceUpdateSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return apiError("Invalid workspace request.", 400);
    const hasBaseline = Object.prototype.hasOwnProperty.call(parsed.data, "baselineSnapshotId");
    const hasCandidate = Object.prototype.hasOwnProperty.call(parsed.data, "candidateSnapshotId");
    const updated = await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.findFirst({ where: { id: workspaceId, userId: authResult.userId }, select: { id: true } });
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
  const authResult = await requireAuthenticatedUser();
  if (!authResult.ok) return authResult.response;
  const limit = checkRateLimit("v1:workspace:delete", authResult.userId, WRITE_RATE_LIMIT.limit, WRITE_RATE_LIMIT.windowMs);
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);
  const { workspaceId } = await context.params;
  if (!isUuid(workspaceId)) return apiError("Invalid workspace ID.", 400);
  try {
    const result = await prisma.workspace.deleteMany({ where: { id: workspaceId, userId: authResult.userId } });
    if (result.count !== 1) return apiError("Workspace not found.", 404);
    return new NextResponse(null, { status: 204 });
  } catch {
    return apiError("Unable to delete the workspace.", 500);
  }
}
