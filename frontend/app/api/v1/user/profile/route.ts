import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { apiError, readJsonBody, requireAuthenticatedUser } from "@/lib/server/api";

export const dynamic = "force-dynamic";

const MAX_PROFILE_BODY_BYTES = 4 * 1024;
const profileSchema = z.object({
  companySize: z.enum(["solo", "2-10", "11-50", "51-200", "201-1000", "1000+"]),
  primaryApiType: z.enum(["rest", "graphql", "grpc", "event-driven", "other"]),
  cicdTool: z.enum(["github-actions", "gitlab-ci", "circleci", "jenkins", "azure-devops", "other"]),
}).strict();

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) return apiError("Cross-origin requests are not accepted.", 403);
    } catch {
      return apiError("Invalid request origin.", 403);
    }
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return apiError("Content-Type must be application/json.", 415);
  }

  const authenticated = await requireAuthenticatedUser();
  if (!authenticated.ok) return authenticated.response;

  let body: unknown;
  try {
    body = await readJsonBody(request, MAX_PROFILE_BODY_BYTES);
  } catch (error) {
    return apiError(error instanceof RangeError ? "Survey response is too large." : "Request must contain valid JSON.", error instanceof RangeError ? 413 : 400);
  }
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) return apiError("Choose a company size, API type, and CI/CD tool.", 400);

  try {
    await prisma.$transaction([
      prisma.userProfile.upsert({
        where: { userId: authenticated.userId },
        create: { userId: authenticated.userId, ...parsed.data },
        update: parsed.data,
        select: { userId: true },
      }),
      prisma.user.update({
        where: { id: authenticated.userId },
        data: { surveyCompleted: true },
        select: { id: true },
      }),
    ]);
    return NextResponse.json({ status: "saved" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Your survey could not be saved. Please try again." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
