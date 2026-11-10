import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { PLAN_LIMITS, getMonthKey, normalizePlan, type Plan } from "./limits";

/** A user's cloud-run position for one month. Safe to serialise as JSON. */
export interface UsageState {
  plan: Plan;
  /** The `YYYY-MM` UTC bucket these numbers belong to. */
  monthKey: string;
  cloudRuns: number;
  limit: number;
  /** `limit - cloudRuns`, never negative. */
  remaining: number;
}

/** Outcome of trying to spend one run: `ok: false` means the limit was hit. */
export type CloudRunClaim = { ok: true; usage: UsageState } | { ok: false; usage: UsageState };

function toUsageState(plan: Plan, monthKey: string, cloudRuns: number): UsageState {
  const limit = PLAN_LIMITS[plan].cloudRunsPerMonth;
  // Clamped because a mid-month downgrade can leave a month's count above the
  // new tier's allowance, and a negative "remaining" is not meaningful.
  return { plan, monthKey, cloudRuns, limit, remaining: Math.max(0, limit - cloudRuns) };
}

async function readPlan(userId: string): Promise<Plan> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
  return normalizePlan(user?.plan);
}

/**
 * The month's usage without spending anything. Used by `GET /api/v1/usage` to
 * render the workbench indicator.
 */
export async function getUsage(userId: string, now: Date = new Date()): Promise<UsageState> {
  const monthKey = getMonthKey(now);
  const [plan, counter] = await Promise.all([
    readPlan(userId),
    prisma.usageCounter.findUnique({
      where: { userId_monthKey: { userId, monthKey } },
      select: { cloudRuns: true },
    }),
  ]);
  return toUsageState(plan, monthKey, counter?.cloudRuns ?? 0);
}

/**
 * Spend one cloud run, or reject when the month's allowance is used up.
 *
 * The limit check and the increment are the *same* SQL statement
 * (`UPDATE ... SET cloudRuns = cloudRuns + 1 WHERE cloudRuns < limit`), so the
 * database serialises concurrent claims: the loser re-evaluates the predicate
 * against the committed row and updates nothing. Reading the count and then
 * writing it back would let two parallel requests both observe `limit - 1` and
 * both succeed.
 *
 * Read Committed is requested explicitly because the conditional update relies
 * on that behaviour — under Repeatable Read a conflicting write raises a
 * serialisation error instead of re-checking, and the rejection path below
 * would turn into a 500.
 */
export async function consumeCloudRun(userId: string, now: Date = new Date()): Promise<CloudRunClaim> {
  const monthKey = getMonthKey(now);

  return prisma.$transaction(
    async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { plan: true } });
      const plan = normalizePlan(user?.plan);
      const limit = PLAN_LIMITS[plan].cloudRunsPerMonth;

      // Make sure this month's row exists before the conditional update, which
      // can only modify a row that is already there. `skipDuplicates` makes the
      // insert an ON CONFLICT DO NOTHING, so the first two runs of a month
      // racing each other cannot fail on the unique constraint.
      await tx.usageCounter.createMany({
        data: [{ userId, monthKey, cloudRuns: 0 }],
        skipDuplicates: true,
      });

      const claimed = await tx.usageCounter.updateMany({
        where: { userId, monthKey, cloudRuns: { lt: limit } },
        data: { cloudRuns: { increment: 1 } },
      });

      const counter = await tx.usageCounter.findUnique({
        where: { userId_monthKey: { userId, monthKey } },
        select: { cloudRuns: true },
      });

      const usage = toUsageState(plan, monthKey, counter?.cloudRuns ?? 0);
      return claimed.count === 1 ? { ok: true as const, usage } : { ok: false as const, usage };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}

/**
 * Return one previously claimed run to its original UTC month. The conditional
 * update is atomic, so concurrent refunds cannot drive the counter below zero.
 */
export async function refundCloudRun(userId: string, monthKey: string): Promise<boolean> {
  const refunded = await prisma.usageCounter.updateMany({
    where: { userId, monthKey, cloudRuns: { gt: 0 } },
    data: { cloudRuns: { decrement: 1 } },
  });
  return refunded.count === 1;
}
