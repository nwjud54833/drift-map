import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: "unauthenticated" }),
}));

import { AuthPage } from "@/components/auth/auth-page";

describe("sign-in providers", () => {
  it("renders Google and GitHub sign-in buttons", () => {
    const html = renderToStaticMarkup(<AuthPage mode="signin" />);

    expect(html).toContain("Continue with Google");
    expect(html).toContain("Continue with GitHub");
    expect(html).toContain("Continue locally");
    expect(html).toContain("Sign-in associates your cloud workspace with your account.");
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/terms"');
    expect(html).not.toContain("End-to-end encrypted in transit");
    expect(html).not.toContain("<150ms");
  });
});
