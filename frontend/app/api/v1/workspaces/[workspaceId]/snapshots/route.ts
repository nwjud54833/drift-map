import { NextResponse } from "next/server";
import { apiError, authenticatedUserId, readJsonBody } from "@/lib/server/api";
import { prisma } from "@/lib/db/prisma";
import { parsePayloadText } from "@/lib/contract/parse";
import { inferContract } from "@/lib/contract/infer";
import { snapshotCreateSchema } from "@/lib/server/contracts";
type Context = { params: Promise<{ workspaceId: string }> };

export async function GET(_request: Request, context: Context) {
  const userId = await authenticatedUserId();
  if (!userId) return apiError("Sign in is required.", 401);
  const { workspaceId } = await context.params;
  const workspace = await prisma.workspace.findFirst({ where: { id: workspaceId, userId }, select: { id: true } });
  if (!workspace) return apiError("Workspace not found.", 404);
  const snapshots = await prisma.contractSnapshot.findMany({ where: { workspaceId }, orderBy: { createdAt: "asc" }, include: { samples: true } });
  return NextResponse.json({ snapshots });
}

export async function POST(request: Request, context: Context) {
  const userId = await authenticatedUserId();
  if (!userId) return apiError("Sign in is required.", 401);
  const { workspaceId } = await context.params;
  try {
    const workspace = await prisma.workspace.findFirst({ where: { id: workspaceId, userId }, select: { id: true } });
    if (!workspace) return apiError("Workspace not found.", 404);
    const parsed = snapshotCreateSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return apiError("Invalid snapshot request.", 400);
    const samples = parsePayloadText(JSON.stringify(parsed.data.payloads), { source: "paste" });
    const contract = inferContract(samples);
    const snapshot = await prisma.contractSnapshot.create({ data: { workspaceId, versionLabel: parsed.data.versionLabel, notes: parsed.data.notes, sourceFileName: parsed.data.sourceFileName, contract: contract as never, samples: { create: samples.map((sample) => ({ label: sample.label, source: "paste", capturedAt: new Date(sample.capturedAt), value: sample.value as never })) } }, include: { samples: true } });
    return NextResponse.json({ snapshot }, { status: 201 });
  } catch (error) {
    return apiError(error instanceof RangeError ? error.message : error instanceof Error ? error.message : "Unable to save the snapshot.", error instanceof RangeError ? 413 : 400);
  }
}
