import { NextResponse } from "next/server";
import { createBaselineToken, type BaselineTokenScope } from "@/lib/server/baseline-token";
import { apiError, isUuid, readJsonBody, requireAuthenticatedUser } from "@/lib/server/api";
import { prisma } from "@/lib/db/prisma";
import { contractPathCount, decodeBaselinePromotionNotes } from "@/lib/server/baseline-audit";
import { z } from "zod";

type Context = { params: Promise<{ workspaceId: string }> };

export async function POST(request: Request, context: Context) {
  const authResult = await requireAuthenticatedUser();
  if (!authResult.ok) return authResult.response;

  const { workspaceId } = await context.params;
  if (!isUuid(workspaceId)) return apiError("Invalid workspace ID.", 400);

  let scope: BaselineTokenScope = "read";
  if (request.headers.get("content-length") || request.body) {
    let body: unknown;
    try { body = await readJsonBody(request); }
    catch { return apiError("Token request body must be valid JSON.", 400); }
    const parsed = z.object({ scope: z.enum(["read", "promote", "badge"]).default("read") }).strict().safeParse(body);
    if (!parsed.success) return apiError("Token scope must be read, promote, or badge.", 400);
    scope = parsed.data.scope;
  }

  try {
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, userId: authResult.userId },
      select: {
        id: true,
        baselineSnapshot: { select: { id: true, versionLabel: true, notes: true, createdAt: true, contract: true } },
      },
    });
    if (!workspace) return apiError("Workspace not found.", 404);
    if (!workspace.baselineSnapshot) return apiError("Set a baseline snapshot before creating a CI token.", 409);

    const issued = createBaselineToken(authResult.userId, workspace.id, scope);
    if (!issued) return apiError("Baseline token signing is unavailable.", 503);
    const audit = decodeBaselinePromotionNotes(workspace.baselineSnapshot.notes);
    return NextResponse.json({
      ...issued,
      baseline: {
        revision: workspace.baselineSnapshot.versionLabel,
        pathCount: audit?.pathCount ?? contractPathCount(workspace.baselineSnapshot.contract),
        lastPromotedAt: audit?.promotedAt ?? null,
        commitSha: audit?.commitSha ?? null,
        actor: audit?.actor ?? null,
      },
    }, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", Vary: "Cookie" } });
  } catch {
    return apiError("Unable to create a workspace baseline token.", 500);
  }
}
