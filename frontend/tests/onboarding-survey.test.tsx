import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

import { OnboardingSurveyForm } from "@/components/driftmap/onboarding-survey-form";

describe("post-registration survey", () => {
  it("renders the company size, API type, and CI/CD questions with a continue action", () => {
    const html = renderToStaticMarkup(<OnboardingSurveyForm />);
    expect(html).toContain("Company size");
    expect(html).toContain("Primary API type");
    expect(html).toContain("CI/CD tool");
    expect(html).toContain("Continue to Workbench");
    expect(html).toContain('id="company-size"');
  });
});
