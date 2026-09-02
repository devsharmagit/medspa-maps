import Link from "next/link";
import { ArrowRight, Check, MapPin, Sparkles } from "lucide-react";

import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { ListingHero } from "@/components/shared/listing-hero";
import { MedicalDisclaimer } from "@/components/shared/medical-disclaimer";
import { JsonLd } from "@/components/shared/json-ld";
import { faqPageJsonLd } from "@/lib/seo/json-ld";
import { SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/site";
import type { BreadcrumbItem } from "@/components/shared/breadcrumbs";
import type { LandingContent } from "@/lib/landing/types";

import { FeatureSection, LandingHeading } from "./feature-section";
import { LandingFaq } from "./landing-faq";
import { LandingImage } from "./image-placeholder";

const CONTENT_WIDTH = "max-w-[1240px]";

/** Shared template for every /treatment/[slug] and /condition/[slug] page. */
export function LandingPage({ content }: { content: LandingContent }) {
  // Breadcrumb reads "Treatments"/"Conditions" but still points to the
  // Patients' Favourites page, so clicking it lands there.
  const sectionBase = "/patients-favourites";
  const sectionLabel = content.kind === "treatment" ? "Treatments" : "Conditions";
  const guideLabel = content.kind === "treatment" ? "treatment guide" : "condition guide";
  const pagePath = `/${content.kind}/${content.slug}`;
  const pageUrl = absoluteUrl(pagePath);

  const crumbs: BreadcrumbItem[] = [
    { label: "Home", href: "/" },
    { label: sectionLabel, href: sectionBase },
    { label: content.shortName },
  ];

  // BreadcrumbList JSON-LD is emitted by <ListingHero>; don't duplicate it here.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "MedicalWebPage",
        "@id": `${pageUrl}#webpage`,
        url: pageUrl,
        name: content.title,
        headline: content.title,
        description: content.metaDescription,
        inLanguage: "en-US",
        about: { "@type": content.schemaAbout.type, name: content.schemaAbout.name },
        lastReviewed: content.dateModifiedISO,
        datePublished: content.datePublishedISO,
        dateModified: content.dateModifiedISO,
        medicalAudience: { "@type": "MedicalAudience", audienceType: "Patient" },
        specialty: "Dermatology",
        isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
        publisher: {
          "@type": "Organization",
          name: SITE_NAME,
          logo: { "@type": "ImageObject", url: absoluteUrl("/images/hero/logo.png") },
        },
      },
      { ...faqPageJsonLd(content.faqs), "@id": `${pageUrl}#faq` },
    ],
  };

  // Alternate the image side across the sections that carry an image.
  let imageIndex = -1;

  return (
    <main
      className="flex min-h-screen flex-col bg-[#faf7fb] text-zinc-950"
      style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
    >
      <JsonLd data={jsonLd} />

      <ListingHero crumbs={crumbs} title={content.title} contentClassName={CONTENT_WIDTH}>
        <p className="font-montserrat text-[13px] text-zinc-500 sm:text-[14px]">
          A <span className="font-medium text-zinc-700">{SITE_NAME}</span> {guideLabel}
          <span className="mx-2 text-zinc-300">·</span>
          Updated {content.updated}
        </p>
      </ListingHero>

      <article className={`mx-auto w-full ${CONTENT_WIDTH} flex-1 px-4 pb-16 sm:px-6`}>
        {/* Lead image (wide banner) */}
        {content.hero && (
          <LandingImage
            slot={content.hero}
            className="aspect-[16/7] w-full rounded-[26px] shadow-[0px_18px_48px_rgba(123,45,107,0.16)]"
            priority
            sizes="(max-width: 1280px) 100vw, 1240px"
          />
        )}

        {/* At a glance */}
        <section className="mt-12 rounded-[24px] border border-[#F0E2EC] bg-[linear-gradient(135deg,#ffffff_0%,#fdf4fb_100%)] p-6 shadow-[0px_10px_30px_rgba(123,45,107,0.07)] sm:p-9">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-full bg-[#FCEFF6] text-[#CF5B9D]">
              <Sparkles className="size-[18px]" aria-hidden />
            </span>
            <h2 className="font-montserrat text-[20px] font-semibold text-[#373634]">At a glance</h2>
          </div>
          <ul className="mt-5 grid gap-x-8 gap-y-3.5 sm:grid-cols-2">
            {content.atGlance.map((item) => (
              <li key={item} className="flex items-start gap-3 text-[15.5px] leading-[1.55] text-zinc-700">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#CF5B9D]" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Content sections (alternating image/text) */}
        {content.sections.map((section) => {
          const flip = section.image ? (++imageIndex % 2 === 1) : false;
          return <FeatureSection key={section.id} section={section} flip={flip} />;
        })}

        {/* What to look for in a provider */}
        <section id="choose-provider" className="mt-16 scroll-mt-28 sm:mt-24">
          <div className="mx-auto max-w-[900px]">
            <LandingHeading heading="What to look for in a" accent="provider" />
            {content.provider.intro.map((p, i) => (
              <p key={i} className="mt-5 text-[16.5px] leading-[1.75] text-zinc-700">
                {p}
              </p>
            ))}
            <ul className="mt-7 grid gap-3.5 sm:grid-cols-2">
              {content.provider.tips.map((tip) => {
                const idx = tip.indexOf(":");
                const label = idx > 0 && idx < 42 ? tip.slice(0, idx + 1) : null;
                return (
                  <li
                    key={tip}
                    className="flex items-start gap-3 rounded-[16px] border border-[#F0E2EC] bg-white p-4 text-[15px] leading-[1.55] text-zinc-700 shadow-[0px_6px_14px_rgba(170,78,179,0.05)]"
                  >
                    <Check className="mt-0.5 size-[18px] shrink-0 text-[#68bf52]" aria-hidden />
                    <span>
                      {label ? (
                        <>
                          <strong className="font-semibold text-[#373634]">{label}</strong>
                          {tip.slice(idx + 1)}
                        </>
                      ) : (
                        tip
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>

            {/* Quick jump to the directory search (same target as the final CTA) */}
            <div className="mt-6 flex flex-col gap-3 rounded-[16px] border border-[#F0E2EC] bg-[#fdf4fb] p-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[15.5px] font-medium text-[#373634]">
                {content.kind === "treatment"
                  ? `Looking for a ${content.shortName} provider?`
                  : `Looking for a provider who treats ${content.shortName.toLowerCase()}?`}
              </p>
              <Button asChild variant="gradient" size="search" className="shrink-0">
                <Link href={content.searchCta.href}>
                  <MapPin className="size-[18px]" aria-hidden />
                  {content.searchCta.label}
                  <ArrowRight className="size-[18px]" aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Medical disclaimer (from the source copy) */}
        <div className="mx-auto max-w-[900px]">
          <MedicalDisclaimer />
        </div>

        {/* FAQ */}
        <LandingFaq faqs={content.faqs} />

        {/* Final CTA */}
        <section className="mt-20">
          <div className="overflow-hidden rounded-[28px] bg-gradient-to-r from-[#7b2d6b] via-[#9b3a6e] to-[#b6663f] px-6 py-14 text-center sm:px-12 sm:py-16">
            <h2 className="font-montserrat text-[26px] font-medium leading-[116%] tracking-[-0.03em] text-white sm:text-[34px]">
              {content.searchCta.label.replace(/\s*near you\s*$/, " ")}
              <span className="font-fraunces font-normal italic">near you</span>
            </h2>
            <p className="mx-auto mt-3 max-w-[580px] text-[15.5px] leading-[1.6] text-white/85">
              Search {SITE_NAME} to find and compare licensed practices, read real patient reviews,
              and book directly with the provider.
            </p>
            <div className="mt-8 flex justify-center">
              <Button asChild size="search" className="bg-white text-[#9b3a6e] hover:bg-white/90">
                <Link href={content.searchCta.href}>
                  <MapPin className="size-[18px]" aria-hidden />
                  {content.searchCta.label}
                  <ArrowRight className="size-[18px]" aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </article>

      <Footer />
    </main>
  );
}
