import { LandingFaq } from "@/components/driftmap/landing-faq";
import { LandingV4 } from "@/components/driftmap/landing-v4";
import { SEO_METADATA } from "@/lib/seo/metadata";
import { FAQ_PAGE_SCHEMA, SOFTWARE_APPLICATION_SCHEMA, serializeJsonLd } from "@/lib/seo/structured-data";

export const metadata = SEO_METADATA.home;

export default function HomePage() {
  return (
    <>
      <LandingV4 faq={<LandingFaq />} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(SOFTWARE_APPLICATION_SCHEMA) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(FAQ_PAGE_SCHEMA) }} />
    </>
  );
}
