import { LandingFaq } from "@/components/driftmap/landing-faq";
import { LandingPage } from "@/components/driftmap/landing-page";
import { SEO_METADATA } from "@/lib/seo/metadata";
import { FAQ_PAGE_SCHEMA, SOFTWARE_APPLICATION_SCHEMA, serializeJsonLd } from "@/lib/seo/structured-data";

export const metadata = SEO_METADATA.home;

export default function HomePage() {
  return (
    <>
      <LandingPage faq={<LandingFaq />} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(SOFTWARE_APPLICATION_SCHEMA) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(FAQ_PAGE_SCHEMA) }} />
    </>
  );
}
