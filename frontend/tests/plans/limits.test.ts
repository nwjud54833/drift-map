import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAN,
  PLAN_LIMITS,
  getMonthKey,
  getMonthKeyResetsAt,
  isPlan,
  normalizePlan,
} from "@/lib/plans/limits";

describe("PLAN_LIMITS", () => {
  it("pins the monthly cloud-run allowance for every tier", () => {
    expect(PLAN_LIMITS.free.cloudRunsPerMonth).toBe(50);
    expect(PLAN_LIMITS.pro.cloudRunsPerMonth).toBe(1000);
    expect(PLAN_LIMITS.team.cloudRunsPerMonth).toBe(5000);
  });

  it("pins the workspace and history limits", () => {
    expect(PLAN_LIMITS.free).toEqual({ cloudRunsPerMonth: 50, workspaces: 3, historyDays: 30 });
    expect(PLAN_LIMITS.pro).toEqual({ cloudRunsPerMonth: 1000, workspaces: Infinity, historyDays: 365 });
    expect(PLAN_LIMITS.team).toEqual({ cloudRunsPerMonth: 5000, workspaces: Infinity, historyDays: 365 });
    expect(PLAN_LIMITS.founder).toEqual({ cloudRunsPerMonth: 1000, workspaces: Infinity, historyDays: 365 });
  });

  it("keeps each tier at least as generous as the one below it", () => {
    expect(PLAN_LIMITS.pro.cloudRunsPerMonth).toBeGreaterThan(PLAN_LIMITS.free.cloudRunsPerMonth);
    expect(PLAN_LIMITS.team.cloudRunsPerMonth).toBeGreaterThan(PLAN_LIMITS.pro.cloudRunsPerMonth);
  });
});

describe("getMonthKey", () => {
  it("formats the UTC month with a zero-padded month number", () => {
    expect(getMonthKey(new Date("2026-11-11T00:00:00.000Z"))).toBe("2026-11");
    expect(getMonthKey(new Date("2026-01-05T12:30:00.000Z"))).toBe("2026-01");
    expect(getMonthKey(new Date("2026-09-30T23:59:59.999Z"))).toBe("2026-09");
  });

  it("buckets by UTC, not by the host time zone", () => {
    // 2026-12-01T00:30 in UTC+05:30 is still November in UTC. A local-time
    // implementation would bill this run to December.
    expect(getMonthKey(new Date("2026-11-30T19:00:00.000Z"))).toBe("2026-11");
    // 2027-01-01T00:30 in UTC+05:30 is still December in UTC.
    expect(getMonthKey(new Date("2026-12-31T19:00:00.000Z"))).toBe("2026-12");
  });

  it("keeps the last instant of a month in that month and rolls the next instant over", () => {
    expect(getMonthKey(new Date("2026-11-30T23:59:59.999Z"))).toBe("2026-11");
    expect(getMonthKey(new Date("2026-12-01T00:00:00.000Z"))).toBe("2026-12");
  });

  it("rejects an invalid date instead of producing a NaN bucket", () => {
    expect(() => getMonthKey(new Date("not a date"))).toThrow(RangeError);
  });
});

describe("getMonthKeyResetsAt", () => {
  it("returns midnight UTC on the first day of the following month", () => {
    expect(getMonthKeyResetsAt("2026-11").toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(getMonthKeyResetsAt("2026-01").toISOString()).toBe("2026-02-01T00:00:00.000Z");
  });

  it("rolls December over into the next year", () => {
    expect(getMonthKeyResetsAt("2026-12").toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("agrees with getMonthKey at the reset boundary", () => {
    const resetsAt = getMonthKeyResetsAt("2026-11");
    expect(getMonthKey(new Date(resetsAt.getTime() - 1))).toBe("2026-11");
    expect(getMonthKey(resetsAt)).toBe("2026-12");
  });

  it("rejects anything that is not a YYYY-MM bucket key", () => {
    for (const bad of ["2026-13", "2026-1", "2026", "2026-00", "", "2026-11-01"]) {
      expect(() => getMonthKeyResetsAt(bad)).toThrow(RangeError);
    }
  });
});

describe("normalizePlan", () => {
  it("passes through the known tiers", () => {
    expect(normalizePlan("free")).toBe("free");
    expect(normalizePlan("pro")).toBe("pro");
    expect(normalizePlan("team")).toBe("team");
    expect(normalizePlan("founder")).toBe("founder");
  });

  it("falls back to the most restrictive tier for anything else", () => {
    // `plan` is a String column, so an unknown value is reachable in the
    // database. Falling back to `free` keeps a typo from granting more runs.
    expect(normalizePlan("enterprise")).toBe(DEFAULT_PLAN);
    expect(normalizePlan("FREE")).toBe(DEFAULT_PLAN);
    expect(normalizePlan(null)).toBe(DEFAULT_PLAN);
    expect(normalizePlan(undefined)).toBe(DEFAULT_PLAN);
    expect(normalizePlan(7)).toBe(DEFAULT_PLAN);
    expect(normalizePlan({ plan: "team" })).toBe(DEFAULT_PLAN);
  });

  it("defaults to free", () => {
    expect(DEFAULT_PLAN).toBe("free");
  });
});

describe("isPlan", () => {
  it("accepts only the declared tiers", () => {
    expect(isPlan("free")).toBe(true);
    expect(isPlan("team")).toBe(true);
    expect(isPlan("founder")).toBe(true);
    expect(isPlan("Enterprise")).toBe(false);
    expect(isPlan(null)).toBe(false);
  });
});
