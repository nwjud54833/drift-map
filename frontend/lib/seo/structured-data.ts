import { LANDING_FAQ_ITEMS } from "./landing-faq";

export const SOFTWARE_APPLICATION_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "DriftMap",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  url: "https://driftmap.in/",
  description: "DriftMap compares JSON payload samples and OpenAPI 3.0 documents, infers API contracts, and classifies structural changes by compatibility.",
};

export const FAQ_PAGE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: LANDING_FAQ_ITEMS.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  })),
};

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
