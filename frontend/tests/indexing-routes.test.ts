import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

describe("search indexing routes", () => {
  it("allows public pages and disallows API routes", () => {
    expect(robots()).toEqual({
      rules: { userAgent: "*", allow: ["/", "/workbench", "/privacy", "/terms"], disallow: "/api/" },
      sitemap: "https://driftmap.in/sitemap.xml",
      host: "https://driftmap.in",
    });
  });

  it("lists public landing, Workbench, Privacy, and Terms pages", () => {
    expect(sitemap().map(({ url }) => url)).toEqual([
      "https://driftmap.in/",
      "https://driftmap.in/workbench",
      "https://driftmap.in/privacy",
      "https://driftmap.in/terms",
    ]);
  });
});
