import { NextResponse } from "next/server";
import { verifyBaselineToken } from "@/lib/server/baseline-token";
import { apiError, isUuid, readJsonBody, requireAuthenticatedUser } from "@/lib/server/api";
import { prisma } from "@/lib/db/prisma";
import { parseImportArtifact } from "@/lib/workbench/import-artifact";
import type { StoredContract } from "@/lib/contract/types";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";

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
    const claims = verifyBaselineToken(match[1], workspaceId, "read");
    if (!claims) return apiError("A valid workspace baseline token is required.", 401);
    userId = claims.userId;
  } else {
    const queryToken = new URL(request.url).searchParams.get("token");
    if (queryToken) {
      const claims = verifyBaselineToken(queryToken, workspaceId, "read");
      if (!claims) return apiError("A valid workspace baseline token is required.", 401);
      userId = claims.userId;
    } else {
      const authResult = await requireAuthenticatedUser();
      if (!authResult.ok) return authResult.response;
      userId = authResult.userId;
    }
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
      headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", Vary: "Authorization, Cookie" },
    });
  } catch {
    return apiError("Unable to load the workspace baseline.", 500);
  }
}

const promoteBody = z.object({ document: z.string().min(1).max(2 * 1024 * 1024), versionLabel: z.string().trim().min(1).max(100).optional() }).strict();

/** Atomically save a passing main-branch contract as the selected baseline. */
export async function POST(request: Request, context: Context) {
  const { workspaceId } = await context.params;
  if (!isUuid(workspaceId)) return apiError("Invalid workspace ID.", 400);
  const match = /^Bearer ([A-Za-z0-9_.-]{1,4096})$/.exec(request.headers.get("authorization") ?? "");
  if (!match) return apiError("A workspace promotion token is required.", 401);
  const claims = verifyBaselineToken(match[1], workspaceId, "promote");
  if (!claims) return apiError("A valid workspace promotion token is required.", 401);

  let body: unknown;
  try { body = await readJsonBody(request); }
  catch (error) { return apiError(error instanceof RangeError ? "Candidate document exceeds the 4 MiB request limit." : "Request body must be valid JSON.", error instanceof RangeError ? 413 : 400); }
  const input = promoteBody.safeParse(body);
  if (!input.success) return apiError("Provide a candidate document under 2 MiB and an optional version label.", 400);
  const parsed = parseImportArtifact(input.data.document, { source: "workspace-import" });
  if (!parsed.ok) return apiError("Candidate document is not valid JSON payload data or an OpenAPI document.", 400);

  const contract: StoredContract = parsed.artifact.format === "openapi" ? parsed.artifact.contract : (await import("@/lib/contract/infer")).inferContract(parsed.artifact.samples);
  const payloadSamples = parsed.artifact.format === "samples" ? parsed.artifact.samples : [];
  try {
    const result = await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.findFirst({ where: { id: workspaceId, userId: claims.userId }, select: { id: true } });
      if (!workspace) return null;
      const snapshot = await tx.contractSnapshot.create({
        data: {
          workspaceId,
          versionLabel: input.data.versionLabel ?? `main ${new Date().toISOString().slice(0, 10)}`,
          notes: "Automatically promoted from a passing main branch build.",
          sourceFileName: null,
          contract: contract as unknown as Prisma.InputJsonValue,
          samples: payloadSamples.length ? { create: payloadSamples.map((sample) => ({ label: sample.label, source: "workspace_import" as const, capturedAt: new Date(sample.capturedAt), value: sample.value as unknown as Prisma.InputJsonValue })) } : undefined,
        },
        select: { id: true, versionLabel: true, createdAt: true },
      });
      await tx.workspace.update({ where: { id: workspaceId }, data: { baselineSnapshotId: snapshot.id } });
      return snapshot;
    });
    if (!result) return apiError("Workspace not found.", 404);
    return NextResponse.json({ status: "promoted", snapshot: result }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return apiError("Unable to promote the workspace baseline.", 500);
  }
}
