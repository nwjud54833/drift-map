import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteHeader } from "@/components/driftmap/site-header";

/**
 * The header owns the only account entry on `/workbench`. Signed out it must
 * offer a way in; signed in it must offer a way out — the account menu is the
 * single `signOut` call site in the app, so a plain link here leaves a signed-in
 * session with no exit.
 */
const sessionState = vi.hoisted(() => ({
  value: { status: "unauthenticated", data: null } as { status: string; data: unknown },
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/workbench" }));
vi.mock("next-auth/react", () => ({
  useSession: () => sessionState.value,
  signOut: vi.fn(),
}));

beforeEach(() => {
  sessionState.value = { status: "unauthenticated", data: null };
});

afterEach(() => vi.unstubAllEnvs());

describe("site header account control", () => {
  it("links to /signin when signed out", () => {
    const header = renderToStaticMarkup(<SiteHeader />);

    expect(header).toContain('href="/signin"');
    expect(header).toContain("Sign in");
    expect(header).not.toContain("Account menu for");
  });

  it("renders the account menu with sign-out when signed in", () => {
    sessionState.value = {
      status: "authenticated",
      data: { user: { name: null, email: "sam@example.com", image: null } },
    };

    const header = renderToStaticMarkup(<SiteHeader />);

    // The trigger is the menu button, and the email names it when there is no display name.
    expect(header).toContain('aria-label="Account menu for sam@example.com"');
    expect(header).toContain('aria-haspopup="menu"');
    expect(header).toContain("dm-account-trigger");
    expect(header).not.toContain('href="/signin"');
  });
});
