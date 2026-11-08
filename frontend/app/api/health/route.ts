import { NextResponse } from "next/server";

const VERSION = "2.5.6";

export const dynamic = "force-dynamic";

export async function GET() {
  let db: "connected" | "error" = "connected";

  try {
    // Import lazily so missing database configuration is reported as degraded
    // health instead of making the route fail during module initialization.
    const { prisma } = await import("@/lib/db/prisma");
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = "error";
  }

  const status = db === "connected" ? "ok" : "degraded";
  return NextResponse.json(
    {
      status,
      db,
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_COMMIT_SHA ?? "unknown",
      version: VERSION,
    },
    {
      status: db === "connected" ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
