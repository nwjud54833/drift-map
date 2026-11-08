import { NextResponse } from "next/server";
import { createBaselineReadToken } from "@/lib/server/baseline-token";
import { apiError, isUuid, requireAuthenticatedUser } from "@/lib/server/api";
import { prisma } from "@/lib/db/prisma";

type Context = { params: Promise<{ workspaceId: string }> };

export async function POST(_request: Request, context: Context) {
  const authResult = await requireAuthenticatedUser();
  if (!authResult.ok) return authResult.response;

  const { workspaceId } = await context.params;
  if (!isUuid(workspaceId)) return apiError("Invalid workspace ID.", 400);

  try {
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, userId: authResult.userId },
      select: { id: true, baselineSnapshotId: true },
    });
    if (!workspace) return apiError("Workspace not found.", 404);
    if (!workspace.baselineSnapshotId) return apiError("Set a baseline snapshot before creating a CI read token.", 409);

    const issued = createBaselineReadToken(authResult.userId, workspace.id);
    if (!issued) return apiError("Baseline token signing is unavailable.", 503);
    return NextResponse.json(issued, {
      headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
    });
  } catch {
    return apiError("Unable to create a workspace baseline token.", 500);
  }
}
