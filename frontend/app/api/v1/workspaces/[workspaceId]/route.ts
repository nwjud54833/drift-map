import { NextResponse } from "next/server";
import { apiError, authenticatedUserId, readJsonBody } from "@/lib/server/api";
import { prisma } from "@/lib/db/prisma";
import { workspaceUpdateSchema } from "@/lib/server/contracts";
type Context = { params: Promise<{ workspaceId: string }> };

export async function GET(_request: Request, context: Context) {
  const userId = await authenticatedUserId();
  if (!userId) return apiError("Sign in is required.", 401);
  const { workspaceId } = await context.params;
  const workspace = await prisma.workspace.findFirst({ where: { id: workspaceId, userId }, include: { snapshots: { orderBy: { createdAt: "asc" }, include: { samples: true } } } });
  if (!workspace) return apiError("Workspace not found.", 404);
  return NextResponse.json({ workspace });
}

export async function PATCH(request: Request, context: Context) {
  const userId = await authenticatedUserId();
  if (!userId) return apiError("Sign in is required.", 401);
  const { workspaceId } = await context.params;
  try {
    const parsed = workspaceUpdateSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return apiError("Invalid workspace request.", 400);
    const result = await prisma.workspace.updateMany({ where: { id: workspaceId, userId }, data: parsed.data });
    if (result.count !== 1) return apiError("Workspace not found.", 404);
    const workspace = await prisma.workspace.findFirst({ where: { id: workspaceId, userId }, select: { id: true, name: true, direction: true, baselineSnapshotId: true, candidateSnapshotId: true, createdAt: true, updatedAt: true } });
    return NextResponse.json({ workspace });
  } catch (error) {
    return apiError(error instanceof RangeError ? error.message : "Invalid workspace request.", error instanceof RangeError ? 413 : 400);
  }
}

export async function DELETE(_request: Request, context: Context) {
  const userId = await authenticatedUserId();
  if (!userId) return apiError("Sign in is required.", 401);
  const { workspaceId } = await context.params;
  const result = await prisma.workspace.deleteMany({ where: { id: workspaceId, userId } });
  if (result.count !== 1) return apiError("Workspace not found.", 404);
  return new NextResponse(null, { status: 204 });
}
