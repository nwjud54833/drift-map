import { NextResponse } from "next/server";
import { apiError, authenticatedUserId } from "@/lib/server/api";
import { prisma } from "@/lib/db/prisma";
type Context = { params: Promise<{ snapshotId: string }> };

export async function GET(_request: Request, context: Context) {
  const userId = await authenticatedUserId();
  if (!userId) return apiError("Sign in is required.", 401);
  const { snapshotId } = await context.params;
  const snapshot = await prisma.contractSnapshot.findFirst({ where: { id: snapshotId, workspace: { userId } }, include: { samples: true } });
  if (!snapshot) return apiError("Snapshot not found.", 404);
  return NextResponse.json({ snapshot });
}

export async function DELETE(_request: Request, context: Context) {
  const userId = await authenticatedUserId();
  if (!userId) return apiError("Sign in is required.", 401);
  const { snapshotId } = await context.params;
  const result = await prisma.contractSnapshot.deleteMany({ where: { id: snapshotId, workspace: { userId } } });
  if (result.count !== 1) return apiError("Snapshot not found.", 404);
  return new NextResponse(null, { status: 204 });
}

export async function PATCH(request: Request, context: Context) {
  const userId = await authenticatedUserId();
  if (!userId) return apiError("Sign in is required.", 401);
  const { snapshotId } = await context.params;
  const { snapshotUpdateSchema } = await import("@/lib/server/contracts");
  try {
    const parsed = snapshotUpdateSchema.safeParse(await (await import("@/lib/server/api")).readJsonBody(request));
    if (!parsed.success) return apiError("Invalid snapshot request.", 400);
    const result = await prisma.contractSnapshot.updateMany({ where: { id: snapshotId, workspace: { userId } }, data: parsed.data });
    if (result.count !== 1) return apiError("Snapshot not found.", 404);
    const snapshot = await prisma.contractSnapshot.findFirst({ where: { id: snapshotId, workspace: { userId } }, include: { samples: true } });
    return NextResponse.json({ snapshot });
  } catch (error) {
    return apiError(error instanceof RangeError ? error.message : "Invalid snapshot request.", error instanceof RangeError ? 413 : 400);
  }
}
