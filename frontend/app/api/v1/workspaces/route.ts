import { NextResponse } from "next/server";
import { apiError, authenticatedUserId, readJsonBody } from "@/lib/server/api";
import { prisma } from "@/lib/db/prisma";
import { workspaceCreateSchema } from "@/lib/server/contracts";

export async function GET() {
  const userId = await authenticatedUserId();
  if (!userId) return apiError("Sign in is required.", 401);
  const workspaces = await prisma.workspace.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, select: { id: true, name: true, direction: true, baselineSnapshotId: true, candidateSnapshotId: true, createdAt: true, updatedAt: true } });
  return NextResponse.json({ workspaces });
}

export async function POST(request: Request) {
  const userId = await authenticatedUserId();
  if (!userId) return apiError("Sign in is required.", 401);
  try {
    const parsed = workspaceCreateSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return apiError("Invalid workspace request.", 400);
    const workspace = await prisma.workspace.create({ data: { ...parsed.data, userId }, select: { id: true, name: true, direction: true, baselineSnapshotId: true, candidateSnapshotId: true, createdAt: true, updatedAt: true } });
    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error) {
    return apiError(error instanceof RangeError ? error.message : "Invalid workspace request.", error instanceof RangeError ? 413 : 400);
  }
}
