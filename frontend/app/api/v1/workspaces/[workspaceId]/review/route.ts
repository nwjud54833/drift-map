import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { apiError, isUuid } from "@/lib/server/api";
import { verifyBaselineToken } from "@/lib/server/baseline-token";

export const dynamic = "force-dynamic";
const MAX_REVIEW_BYTES = 4 * 1024 * 1024;
type Context = { params: Promise<{ workspaceId: string }> };

export async function GET(request: Request, context: Context) {
  const { workspaceId } = await context.params;
  if (!isUuid(workspaceId)) return apiError("Invalid workspace ID.", 400);
  const authorization = request.headers.get("authorization");
  const match = authorization ? /^Bearer ([A-Za-z0-9_.-]{1,4096})$/.exec(authorization) : null;
  const claims = match ? verifyBaselineToken(match[1], workspaceId, "review") : null;
  if (!claims) return apiError("A valid read-only review token is required.", 401);

  try {
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, userId: claims.userId },
      select: {
        id: true,
        name: true,
        direction: true,
        snapshots: {
          where: { id: { in: [claims.baselineSnapshotId!, claims.candidateSnapshotId!] } },
          select: { id: true, versionLabel: true, contract: true, samples: { select: { value: true }, orderBy: { capturedAt: "asc" } } },
        },
      },
    });
    const baselineSnapshot = workspace?.snapshots.find((snapshot) => snapshot.id === claims.baselineSnapshotId);
    const candidateSnapshot = workspace?.snapshots.find((snapshot) => snapshot.id === claims.candidateSnapshotId);
    if (!workspace || !baselineSnapshot || !candidateSnapshot) return apiError("Workspace review snapshots were not found.", 404);

    const asDocument = (snapshot: typeof baselineSnapshot) => {
      if (snapshot.contract && typeof snapshot.contract === "object" && "kind" in snapshot.contract && snapshot.contract.kind === "openapi") {
        return snapshot.contract.document;
      }
      const samples = snapshot.samples.map((sample) => sample.value);
      return samples.length === 1 ? samples[0] : samples;
    };
    const review = {
      version: 1,
      workspace: { id: workspace.id, name: workspace.name, direction: workspace.direction },
      baseline: { id: baselineSnapshot.id, versionLabel: baselineSnapshot.versionLabel, document: asDocument(baselineSnapshot) },
      candidate: { id: candidateSnapshot.id, versionLabel: candidateSnapshot.versionLabel, document: asDocument(candidateSnapshot) },
    };
    if (Buffer.byteLength(JSON.stringify(review), "utf8") > MAX_REVIEW_BYTES) return apiError("Workspace review exceeds the 4 MiB preview limit.", 413);
    return NextResponse.json({ review }, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", Vary: "Authorization" } });
  } catch {
    return apiError("Unable to load the workspace review.", 503);
  }
}
