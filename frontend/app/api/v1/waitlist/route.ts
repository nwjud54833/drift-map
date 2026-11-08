import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/** Admin-only aggregate; waitlist PII is never returned by this endpoint. */
export async function GET() {
  try {
    const session = await auth();
    const email = session?.user?.email?.trim().toLowerCase();
    const admins = (process.env.DRIFTMAP_ADMIN_EMAILS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    if (!email || !admins.includes(email)) {
      return NextResponse.json({ error: "Admin access is required." }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }

    const count = await prisma.earlyAccessRequest.count();
    return NextResponse.json({ waitlist: { count } }, { headers: { "Cache-Control": "no-store", Vary: "Cookie" } });
  } catch {
    return NextResponse.json({ error: "Unable to read waitlist summary." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
