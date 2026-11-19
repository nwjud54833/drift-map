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
  });
});
