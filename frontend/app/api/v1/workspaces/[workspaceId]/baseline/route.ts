import { NextResponse } from "next/server";
import { verifyBaselineReadToken } from "@/lib/server/baseline-token";
import { apiError, isUuid, requireAuthenticatedUser } from "@/lib/server/api";
import { prisma } from "@/lib/db/prisma";

type Context = { params: Promise<{ workspaceId: string }> };
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export async function GET(request: Request, context: Context) {
  const { workspaceId } = await context.params;
  if (!isUuid(workspaceId)) return apiError("Invalid workspace ID.", 400);

  const authorization = request.headers.get("authorization");
  let userId: string;
  if (authorization !== null) {
    const match = /^Bearer ([A-Za-z0-9_.-]{1,4096})$/.exec(authorization);
    if (!match) return apiError("A valid workspace baseline token is required.", 401);
    const claims = verifyBaselineReadToken(match[1], workspaceId);
    if (!claims) return apiError("A valid workspace baseline token is required.", 401);
    userId = claims.userId;
  } else {
    const authResult = await requireAuthenticatedUser();
    if (!authResult.ok) return authResult.response;
    userId = authResult.userId;
  }

  try {
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, userId },
      select: {
        id: true,
        name: true,
        direction: true,
        baselineSnapshot: {
          select: {
            id: true,
            versionLabel: true,
            contract: true,
            samples: { select: { value: true }, orderBy: { capturedAt: "asc" } },
          },
        },
      },
    });
    if (!workspace?.baselineSnapshot) return apiError("Workspace baseline not found.", 404);

    const payload = {
      baseline: {
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        direction: workspace.direction,
        snapshotId: workspace.baselineSnapshot.id,
        versionLabel: workspace.baselineSnapshot.versionLabel,
        contract: workspace.baselineSnapshot.contract,
        samples: workspace.baselineSnapshot.samples.map((sample) => sample.value),
      },
    };
    if (Buffer.byteLength(JSON.stringify(payload), "utf8") > MAX_RESPONSE_BYTES) {
      return apiError("Workspace baseline exceeds the 2 MiB fetch limit.", 413);
    }

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, no-store", Vary: "Authorization, Cookie" },
    });
  } catch {
    return apiError("Unable to load the workspace baseline.", 500);
  }
}
