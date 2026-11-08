import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { apiError, isUuid } from "@/lib/server/api";
import { verifyBaselineToken } from "@/lib/server/baseline-token";
import { contractPathCount } from "@/lib/server/baseline-audit";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ workspaceId: string }> };

function svgBadge(pathCount: number) {
  const label = `${Math.max(0, Math.min(999_999, Math.floor(pathCount)))} contract paths`;
  const labelWidth = Math.max(92, label.length * 7 + 18);
  const totalWidth = 81 + labelWidth;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="28" role="img" aria-label="DriftMap: ${label}">
  <title>DriftMap | ${label}</title>
  <linearGradient id="g" x2="0" y2="100%"><stop offset="0" stop-color="#292a34"/><stop offset="1" stop-color="#17181f"/></linearGradient>
  <clipPath id="r"><rect width="${totalWidth}" height="28" rx="5"/></clipPath>
  <g clip-path="url(#r)"><rect width="81" height="28" fill="url(#g)"/><rect x="81" width="${labelWidth}" height="28" fill="#0b5a48"/><rect x="81" width="${labelWidth}" height="14" fill="#00bd8b" opacity=".32"/></g>
  <path fill="#7ee8ff" d="M13 7h9l-3.2 5H24l-9 10 2-7h-4z"/>
  <g fill="#fff" font-family="Verdana,Geneva,sans-serif" font-size="11" font-weight="600"><text x="29" y="18">DriftMap</text><text x="91" y="18">${label}</text></g>
</svg>`;
}

function unauthorized() {
  return new NextResponse("A valid workspace badge token is required.", {
    status: 401,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export async function GET(request: Request, context: Context) {
  const { workspaceId } = await context.params;
  if (!isUuid(workspaceId)) return apiError("Invalid workspace ID.", 400);

  const authorization = request.headers.get("authorization");
  let token: string | null = null;
  if (authorization !== null) {
    const match = /^Bearer ([A-Za-z0-9_.-]{1,4096})$/.exec(authorization);
    if (!match) return unauthorized();
    token = match[1];
  } else {
    token = new URL(request.url).searchParams.get("token");
  }
  if (!token) return unauthorized();
  const claims = verifyBaselineToken(token, workspaceId, "badge") ?? verifyBaselineToken(token, workspaceId, "read");
  if (!claims) return unauthorized();

  try {
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, userId: claims.userId },
      select: { id: true, baselineSnapshot: { select: { id: true, contract: true } } },
    });
    if (!workspace?.baselineSnapshot) return apiError("Workspace baseline not found.", 404);
    return new NextResponse(svgBadge(contractPathCount(workspace.baselineSnapshot.contract)), {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return apiError("Unable to load the workspace badge.", 503);
  }
}
