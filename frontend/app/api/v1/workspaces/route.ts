import { NextResponse } from "next/server";
import { apiError, readJsonBody, requireAuthenticatedUser, tooManyRequests } from "@/lib/server/api";
import { checkRateLimit, WRITE_RATE_LIMIT } from "@/lib/server/rate-limit";
import { prisma } from "@/lib/db/prisma";
import { workspaceCreateSchema } from "@/lib/server/contracts";

export async function GET() {
  const authResult = await requireAuthenticatedUser();
  if (!authResult.ok) return authResult.response;
  try {
    const workspaces = await prisma.workspace.findMany({ where: { userId: authResult.userId }, orderBy: { updatedAt: "desc" }, select: { id: true, name: true, direction: true, baselineSnapshotId: true, candidateSnapshotId: true, createdAt: true, updatedAt: true } });
    return NextResponse.json({ workspaces });
  } catch {
    return apiError("Unable to load workspaces.", 500);
  }
}

export async function POST(request: Request) {
  const authResult = await requireAuthenticatedUser();
  if (!authResult.ok) return authResult.response;
  const limit = checkRateLimit("v1:workspaces:post", authResult.userId, WRITE_RATE_LIMIT.limit, WRITE_RATE_LIMIT.windowMs);
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);
  let data: ReturnType<typeof workspaceCreateSchema.parse>;
  try {
    const parsed = workspaceCreateSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return apiError("Invalid workspace request.", 400);
    data = parsed.data;
  } catch (error) {
    return apiError(error instanceof RangeError ? error.message : "Request body must be valid JSON.", error instanceof RangeError ? 413 : 400);
  }
  try {
    const workspace = await prisma.workspace.create({ data: { ...data, userId: authResult.userId }, select: { id: true, name: true, direction: true, baselineSnapshotId: true, candidateSnapshotId: true, createdAt: true, updatedAt: true } });
    return NextResponse.json({ workspace }, { status: 201 });
  } catch {
    return apiError("Unable to create the workspace.", 500);
  }
}
