import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const findUserMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() => vi.fn((path: string): never => { throw new Error(`redirect:${path}`); }));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { user: { findUnique: findUserMock } } }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/components/driftmap/workbench-page", () => ({ WorkbenchPage: () => null }));
vi.mock("@/components/driftmap/onboarding-survey-form", () => ({ OnboardingSurveyForm: () => null }));

import WorkbenchRoute from "@/app/workbench/page";
import OnboardingPage from "@/app/onboarding/page";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("onboarding session gate", () => {
  it("redirects signed-in users with incomplete surveys from Workbench", async () => {
    authMock.mockResolvedValue({ user: { id: "new-user" } });
    findUserMock.mockResolvedValue({ surveyCompleted: false });
    await expect(WorkbenchRoute()).rejects.toThrow("redirect:/onboarding");
    expect(findUserMock).toHaveBeenCalledWith({ where: { id: "new-user" }, select: { surveyCompleted: true } });
  });

  it("keeps anonymous local Workbench access available", async () => {
    authMock.mockResolvedValue(null);
    const page = await WorkbenchRoute();
    expect(page).toBeTruthy();
    expect(findUserMock).not.toHaveBeenCalled();
  });

  it("requires sign-in to access onboarding and shows the survey to incomplete users", async () => {
    authMock.mockResolvedValue(null);
    await expect(OnboardingPage()).rejects.toThrow("redirect:/signin?callbackUrl=%2Fonboarding");

    authMock.mockResolvedValue({ user: { id: "new-user" } });
    findUserMock.mockResolvedValue({ surveyCompleted: false });
    expect(await OnboardingPage()).toBeTruthy();
  });
});
