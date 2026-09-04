import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { Footer } from "@/components/footer";
import { ListingHero } from "@/components/shared/listing-hero";
import { ClinicCard, type ClinicResult } from "@/components/shared/clinic-card";
import { BlogFaqSection } from "@/components/blog/blog-faq";
import { MedicalDisclaimer } from "@/components/shared/medical-disclaimer";
import { JsonLd } from "@/components/shared/json-ld";
import { faqPageJsonLd } from "@/lib/seo/json-ld";
import { searchClinics } from "@/lib/search/query";
import {
  getStateCities,
  getStateTopTreatments,
  getStateTopConcerns,
  type StateCity,
  type StateTag,
} from "@/lib/locations/queries";
import {
  stateFromSlug,
  stateSlug,
  stateContent,
  type StateFaq,
} from "@/lib/locations/state-content";
import { absoluteUrl, SITE_NAME } from "@/lib/site";

// Reads request params + DB per request; force-dynamic keeps it build-safe
// (no build-time DB prerender) and always fresh.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ state: string }> };

/** Oxford-comma join: ["a","b","c"] → "a, b, and c". */
function listPhrase(items: string[]): string {
  const a = items.filter(Boolean);
  if (a.length === 0) return "";
  if (a.length === 1) return a[0];
  if (a.length === 2) return `${a[0]} and ${a[1]}`;
  return `${a.slice(0, -1).join(", ")}, and ${a[a.length - 1]}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { state } = await params;
  const st = stateFromSlug(state);
  if (!st) return { title: "State not found" };
  const content = stateContent(st.abbr, st.state);
  const title = `Best Medspas in ${st.state} | Medspa Maps`;
  const path = `/locations/${stateSlug(st.state)}`;
  return {
    title,
    description: content.metaDescription,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      title,
      description: content.metaDescription,
      url: path,
      siteName: SITE_NAME,
      images: [st.image],
    },
  };
}

export default async function StateLocationPage({ params }: Props) {
  const { state } = await params;
  const st = stateFromSlug(state);
  if (!st) notFound();

  const content = stateContent(st.abbr, st.state);
  const slug = stateSlug(st.state);
  const pageUrl = absoluteUrl(`/locations/${slug}`);

  // All data reads degrade gracefully — a DB hiccup renders the page shell
  // rather than 500ing.
  let clinics: ClinicResult[] = [];
  let total = 0;
  let cities: StateCity[] = [];
  let treatments: StateTag[] = [];
  let concerns: StateTag[] = [];
  try {
    const [list, cityRows, treatmentRows, concernRows] = await Promise.all([
      searchClinics(new URLSearchParams({ location: st.state, limit: "50" })),
      getStateCities(st.abbr, st.state),
      getStateTopTreatments(st.abbr, st.state, 12),
      getStateTopConcerns(st.abbr, st.state, 10),
    ]);
    clinics = list.results as unknown as ClinicResult[];
    total = list.total;
    cities = cityRows;
    treatments = treatmentRows;
    concerns = concernRows;
  } catch (err) {
    console.error(`locations/${slug}: data load failed`, err);
  }

  const cityNames = cities.map((c) => c.city);
  const topCities = cityNames.slice(0, 6);

  // Intro data sentence (live) — sits under the evergreen editorial intro.
  const introData =
    total > 0
      ? `Medspa Maps lists ${total} vetted medspa${total === 1 ? "" : "s"} across ${st.state}${
          topCities.length
            ? `, including ${listPhrase(cityNames.slice(0, 3))}`
            : ""
        }.`
      : "";

  // FAQ — data-driven + evergreen + registry extras. All pricing-free.
  const faqs: StateFaq[] = [];
  if (total > 0) {
    faqs.push({
      q: `How many medspas are in ${st.state} on Medspa Maps?`,
      a: `Medspa Maps lists ${total} vetted medspa${total === 1 ? "" : "s"} in ${st.state}${
        topCities.length ? `, across cities like ${listPhrase(cityNames.slice(0, 4))}` : ""
      }.`,
    });
  }
  if (cities.length) {
    faqs.push({
      q: `Which cities in ${st.state} have medspas listed?`,
      a: `${st.state} medspas on Medspa Maps are located in ${listPhrase(topCities)}${
        cities.length > topCities.length ? ", and more" : ""
      }.`,
    });
  }
  if (treatments.length) {
    faqs.push({
      q: `What treatments do medspas in ${st.state} offer?`,
      a: `Popular treatments at ${st.state} medspas include ${listPhrase(
        treatments.slice(0, 6).map((t) => t.name),
      )}.`,
    });
  }
  if (concerns.length) {
    faqs.push({
      q: `What skin concerns do ${st.state} medspas treat?`,
      a: `${st.state} medspas commonly treat concerns such as ${listPhrase(
        concerns.slice(0, 6).map((c) => c.name),
      )}.`,
    });
  }
  faqs.push({
    q: `Are the medspas in ${st.state} on Medspa Maps vetted?`,
    a: `Yes. Every practice is editorially reviewed against our quality standards before it's listed, and each profile shows real patient reviews and the treatments the practice actually offers.`,
  });
  faqs.push({
    q: `How do I book a medspa in ${st.state}?`,
    a: `Open any ${st.state} practice on Medspa Maps and book directly with them through their own booking link or phone number — Medspa Maps never sits between you and your provider.`,
  });
  if (content.extraFaqs) faqs.push(...content.extraFaqs);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${pageUrl}#page`,
        name: `Best Medspas in ${st.state}`,
        description: content.metaDescription,
        url: pageUrl,
        about: {
          "@type": "Place",
          name: st.state,
          address: {
            "@type": "PostalAddress",
            addressRegion: st.abbr,
            addressCountry: "US",
          },
        },
      },
      ...(clinics.length
        ? [
            {
              "@type": "ItemList",
              "@id": `${pageUrl}#clinics`,
              name: `Medspas in ${st.state}`,
              numberOfItems: clinics.length,
              itemListElement: clinics.map((c, i) => ({
                "@type": "ListItem",
                position: i + 1,
                url: absoluteUrl(`/practices/${c.clinic_slug}`),
                name: c.clinic_name,
              })),
            },
          ]
        : []),
      faqPageJsonLd(faqs),
    ],
  };

  const chipClass =
    "rounded-full border border-[#ece6ec] bg-[#faf7fa] px-3 py-1.5 text-sm font-medium text-[#8a6f8a] transition-colors hover:border-brand-magenta/40 hover:text-brand-magenta";
  const headingClass =
    "font-montserrat text-[24px] sm:text-[28px] font-medium leading-[116%] tracking-[-0.03em] text-[#373634]";

  return (
    <main className="flex min-h-screen flex-col bg-[#FDFDFD] text-zinc-950">
      <JsonLd data={jsonLd} />

      <ListingHero
        crumbs={[
          { label: "Home", href: "/" },
          { label: "Find medspas", href: "/search" },
          { label: st.state },
        ]}
        title="Best Medspas in"
        accent={st.state}
        subtitle={content.intro}
      />

      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-12 px-4 pb-20 sm:px-6">
        {introData && (
          <p className="max-w-3xl font-montserrat text-[15px] leading-relaxed text-zinc-600 sm:text-[16px]">
            {introData}
          </p>
        )}

        {treatments.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className={headingClass}>Popular treatments in {st.state}</h2>
            <div className="flex flex-wrap gap-2">
              {treatments.map((t) => (
                <Link
                  key={t.slug}
                  href={`/search?q=${encodeURIComponent(t.slug)}&location=${st.abbr}`}
                  className={chipClass}
                >
                  {t.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="flex flex-col gap-5">
          <h2 className={headingClass}>
            {total > 0
              ? `${total} medspa${total === 1 ? "" : "s"} in ${st.state}`
              : `Medspas in ${st.state}`}
          </h2>
          {clinics.length > 0 ? (
            <div className="flex flex-col gap-4">
              {clinics.map((clinic) => (
                <ClinicCard key={clinic.clinic_id} clinic={clinic} />
              ))}
            </div>
          ) : (
            <p className="font-montserrat text-[15px] text-zinc-600">
              We&apos;re adding vetted medspas in {st.state} — check back soon.
            </p>
          )}
          {total > clinics.length && (
            <Link
              href={`/search?location=${st.abbr}`}
              className="mt-2 inline-flex w-fit items-center gap-2 rounded-xl bg-[linear-gradient(90deg,#DE7F4C_0%,#C341D7_100%)] px-6 py-3 font-montserrat text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              View all {total} medspas in {st.state} →
            </Link>
          )}
        </section>

        {cities.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className={headingClass}>Cities we cover in {st.state}</h2>
            <div className="flex flex-wrap gap-2">
              {cities.slice(0, 24).map((c) => (
                <Link
                  key={c.city}
                  href={`/search?location=${encodeURIComponent(`${c.city}, ${st.abbr}`)}`}
                  className={chipClass}
                >
                  {c.city}
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="flex flex-col">
          <BlogFaqSection faqs={faqs} />
        </section>

        <MedicalDisclaimer />
      </div>

      <Footer />
    </main>
  );
}
