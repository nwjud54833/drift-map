import { NextResponse } from "next/server";
import { getUsage } from "@/lib/plans/usage";
import { apiError, requireAuthenticatedUser } from "@/lib/server/api";

export const dynamic = "force-dynamic";

/**
 * The signed-in user's cloud-run position for the current month, used by the
 * workbench indicator.
 *
 * Display only. The numbers here are informational; the limit itself is
 * enforced inside `consumeCloudRun` at each metered endpoint, so a client that
 * ignores or forges this response cannot exceed its allowance.
 */
export async function GET() {
  const authResult = await requireAuthenticatedUser();
  if (!authResult.ok) return authResult.response;

  try {
    const usage = await getUsage(authResult.userId);
    return NextResponse.json({ usage }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return apiError("Unable to load usage.", 500);
  }
}
