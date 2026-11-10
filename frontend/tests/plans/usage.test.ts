import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  counterCreateMany: vi.fn(),
  counterUpdateMany: vi.fn(),
  counterFindUnique: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findUnique: db.userFindUnique },
    usageCounter: {
      createMany: db.counterCreateMany,
      updateMany: db.counterUpdateMany,
      findUnique: db.counterFindUnique,
    },
    $transaction: db.transaction,
  },
}));

import { consumeCloudRun } from "@/lib/plans/usage";

describe("consumeCloudRun", () => {
  let cloudRuns = 0;
  const tx = {
    user: { findUnique: db.userFindUnique },
    usageCounter: {
      createMany: db.counterCreateMany,
      updateMany: db.counterUpdateMany,
      findUnique: db.counterFindUnique,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    cloudRuns = 0;
    db.userFindUnique.mockResolvedValue({ plan: "free" });
    db.counterCreateMany.mockResolvedValue({ count: 1 });
    db.counterUpdateMany.mockImplementation(async (args: { where: { cloudRuns: { lt: number } }; data: { cloudRuns: { increment: number } } }) => {
      if (cloudRuns >= args.where.cloudRuns.lt) return { count: 0 };
      cloudRuns += args.data.cloudRuns.increment;
      return { count: 1 };
    });
    db.counterFindUnique.mockImplementation(async () => ({ cloudRuns }));
    db.transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
  });

  it("increments a run while under the plan limit", async () => {
    const claim = await consumeCloudRun("user-1", new Date("2026-11-11T12:00:00Z"));
    expect(claim).toEqual({ ok: true, usage: { plan: "free", monthKey: "2026-11", cloudRuns: 1, limit: 50, remaining: 49 } });
    expect(db.counterUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", monthKey: "2026-11", cloudRuns: { lt: 50 } },
      data: { cloudRuns: { increment: 1 } },
    });
  });

  it("rejects once the monthly limit has been reached", async () => {
    cloudRuns = 50;
    const claim = await consumeCloudRun("user-1", new Date("2026-11-11T12:00:00Z"));
    expect(claim).toEqual({ ok: false, usage: { plan: "free", monthKey: "2026-11", cloudRuns: 50, limit: 50, remaining: 0 } });
  });

  it("uses an atomic conditional increment so concurrent claims cannot exceed the limit", async () => {
    cloudRuns = 49;
    const claims = await Promise.all(Array.from({ length: 8 }, () => consumeCloudRun("user-1", new Date("2026-11-11T12:00:00Z"))));
    expect(claims.filter((claim) => claim.ok)).toHaveLength(1);
    expect(cloudRuns).toBe(50);
    expect(claims.filter((claim) => !claim.ok).every((claim) => claim.usage.cloudRuns === 50)).toBe(true);
  });
});
