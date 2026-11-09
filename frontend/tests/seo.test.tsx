import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { LandingFaq } from "@/components/driftmap/landing-faq";
import { LANDING_FAQ_ITEMS } from "@/lib/seo/landing-faq";
import { SEO_METADATA } from "@/lib/seo/metadata";
import { FAQ_PAGE_SCHEMA, SOFTWARE_APPLICATION_SCHEMA, serializeJsonLd } from "@/lib/seo/structured-data";

describe("SEO and answer-engine content", () => {
  it("sets a unique short title, concise description, canonical, and social cards for every app page", () => {
    const pages = Object.values(SEO_METADATA);
    const titles = pages.map((metadata) => String(metadata.title));

    expect(new Set(titles).size).toBe(titles.length);
    for (const metadata of pages) {
      expect(String(metadata.title).length).toBeLessThan(60);
      expect(metadata.description?.length).toBeLessThan(160);
      expect(metadata.alternates?.canonical).toBeTruthy();
      expect(metadata.openGraph).toMatchObject({ title: metadata.title, description: metadata.description });
      expect(metadata.twitter).toMatchObject({ title: metadata.title, description: metadata.description, card: "summary_large_image" });
    }
  });

  it("server-renders the visible FAQ answers represented in FAQPage JSON-LD", () => {
    const html = renderToStaticMarkup(<LandingFaq />);
    expect(html).toContain("Frequently asked questions");
    expect(html.match(/<h3/g)).toHaveLength(LANDING_FAQ_ITEMS.length);
    for (const { question, answer } of LANDING_FAQ_ITEMS) {
      expect(html).toContain(question);
      expect(html).toContain(answer.replaceAll("&", "&amp;"));
    }
    expect(FAQ_PAGE_SCHEMA["@type"]).toBe("FAQPage");
    expect(FAQ_PAGE_SCHEMA.mainEntity).toHaveLength(LANDING_FAQ_ITEMS.length);
  });

  it("uses only supported SoftwareApplication facts and safely serializes JSON-LD", () => {
    expect(SOFTWARE_APPLICATION_SCHEMA).toMatchObject({
      "@type": "SoftwareApplication",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      url: "https://driftmap.in/",
    });
    expect(SOFTWARE_APPLICATION_SCHEMA).not.toHaveProperty("aggregateRating");
    expect(SOFTWARE_APPLICATION_SCHEMA).not.toHaveProperty("offers");
    expect(serializeJsonLd({ value: "</script>" })).not.toContain("</script>");
  });

  it("publishes an llms.txt with product facts and canonical page links", () => {
    const llms = readFileSync(resolve(process.cwd(), "public/llms.txt"), "utf8");
    expect(llms).toContain("DriftMap is an API contract testing tool");
    expect(llms).toContain("https://driftmap.in/workbench");
    expect(llms).toContain("https://driftmap.in/privacy");
    expect(llms).toContain("https://driftmap.in/terms");
  });
});
