/**
 * Plan tiers and their monthly cloud-run allowances.
 *
 * Everything a plan controls lives in this file so the numbers can be changed
 * in one place. These are the values the server enforces; the landing copy and
 * the privacy page state the same numbers, so change them together.
 *
 * Only `cloudRunsPerMonth` is enforced today — see `lib/plans/usage.ts`.
 * `workspaces` and `historyDays` describe each tier's intended shape and are
 * declared here so there is a single source of truth when enforcement lands.
 * For those two, `Infinity` means "no limit"; note that `Infinity` does not
 * survive `JSON.stringify` (it becomes `null`), so never put a whole
 * `PlanLimit` object directly into an HTTP response.
 */

export type Plan = "free" | "pro" | "team" | "founder";

export interface PlanLimit {
  /** Cloud comparison runs allowed per calendar month. */
  cloudRunsPerMonth: number;
  /** Workspaces the plan may hold. */
  workspaces: number;
  /** Days of contract history the plan retains. */
  historyDays: number;
}

export const PLAN_LIMITS: Record<Plan, PlanLimit> = {
  free: { cloudRunsPerMonth: 50, workspaces: 3, historyDays: 30 },
  pro: { cloudRunsPerMonth: 1000, workspaces: Infinity, historyDays: 365 },
  team: { cloudRunsPerMonth: 5000, workspaces: Infinity, historyDays: 365 },
  founder: { cloudRunsPerMonth: 1000, workspaces: Infinity, historyDays: 365 },
};

export const DEFAULT_PLAN: Plan = "free";

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isPlan(value: unknown): value is Plan {
  return value === "free" || value === "pro" || value === "team" || value === "founder";
}

/**
 * `User.plan` is a String column rather than an enum so a new tier does not
 * need a migration, which means the database can hold a value this build does
 * not know. Unknown values fall back to `free`, the most restrictive tier, so a
 * typo or a tier added by a newer deploy can never hand out a larger allowance.
 */
export function normalizePlan(value: unknown): Plan {
  return isPlan(value) ? value : DEFAULT_PLAN;
}

/** The `YYYY-MM` usage bucket a moment belongs to, in UTC. */
export function getMonthKey(date: Date): string {
  if (Number.isNaN(date.getTime())) throw new RangeError("getMonthKey requires a valid date.");
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * The instant a month bucket resets: midnight UTC on the first day of the
 * following month. Derived from the bucket key rather than from "now" so the
 * reported reset always belongs to the month that was actually metered.
 */
export function getMonthKeyResetsAt(monthKey: string): Date {
  if (!MONTH_KEY_PATTERN.test(monthKey)) throw new RangeError("getMonthKeyResetsAt requires a YYYY-MM month key.");
  const year = Number(monthKey.slice(0, 4));
  // `monthKey`'s 1-based month doubles as the 0-based index of the next month,
  // since Date.UTC rolls a 12 into January of the following year.
  const month = Number(monthKey.slice(5, 7));
  return new Date(Date.UTC(year, month, 1));
}
