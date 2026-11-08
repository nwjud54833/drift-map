import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

function counts(rows: { [key: string]: unknown; _count: { _all: number } }[], key: string) {
  return Object.fromEntries(rows.map((row) => [String(row[key]), row._count._all]));
}

export async function GET() {
  try {
    const session = await auth();
    const email = session?.user?.email?.trim().toLowerCase();
    const allowlist = (process.env.DRIFTMAP_ADMIN_EMAILS ?? "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);
    if (!email || !allowlist.includes(email)) {
      return NextResponse.json({ error: "Admin access is required." }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }

    const [totalResponses, companySizes, apiTypes, cicdTools] = await Promise.all([
      prisma.userProfile.count(),
      prisma.userProfile.groupBy({ by: ["companySize"], _count: { _all: true } }),
      prisma.userProfile.groupBy({ by: ["primaryApiType"], _count: { _all: true } }),
      prisma.userProfile.groupBy({ by: ["cicdTool"], _count: { _all: true } }),
    ]);
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      totalResponses,
      companySize: counts(companySizes, "companySize"),
      primaryApiType: counts(apiTypes, "primaryApiType"),
      cicdTool: counts(cicdTools, "cicdTool"),
    }, { headers: { "Cache-Control": "no-store", Vary: "Cookie" } });
  } catch {
    return NextResponse.json({ error: "Unable to export survey metrics." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
