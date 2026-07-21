import { notFound } from "next/navigation";
import React from "react";
import type { Metadata } from "next";
import { CalendarDays, Star } from "lucide-react";
import { HeroHeader } from "@/components/hero/hero-header";
import { Footer } from "@/components/footer";
import { getClinicData } from "@/lib/clinics/queries";
import { toStateCode } from "@/lib/location/states";
import { ClinicGallery } from "./gallery";
import { ClinicBeforeAfterCarousel } from "./before-after";
import { ClinicLocationsSection } from "./locations";
import { HoursCard, hasWeeklyHours } from "./hours";
import { ClinicContactCard } from "./contact-card";
import { OtherProvidersCarousel } from "@/components/shared/other-providers-carousel";
import { ClinicTreatmentsCarousel } from "@/components/shared/clinic-treatments-carousel";
import { ClinicConcernsSection } from "./concerns-section";
import { ClinicReviewsSection } from "@/components/shared/clinic-reviews-section";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { ClinicSocialLinks } from "@/components/shared/clinic-social-links";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getClinicData(slug);
  if (!data) return { title: "Clinic not found" };
  const { clinic } = data;
  const loc = data.stats.city ?? "";
  return {
    title: `${clinic.name} — Medspa Map`,
    description:
      clinic.about?.slice(0, 155) ??
      clinic.tagline ??
      (loc ? `Book at ${clinic.name} in ${loc}` : undefined),
  };
}

function buildMapsUrl(parts: (string | null)[]): string {
  const q = parts.filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default async function ClinicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getClinicData(slug);
  if (!data) notFound();

  const { clinic, locations, treatments, concerns, gallery, gallery_total, before_after, reviews, stats } =
    data;

  const primaryLoc = locations.find((l) => l.is_primary) ?? locations[0] ?? null;
  // Full postal address, shown in the Contact Information card: street + "City, ST ZIP".
  // Addresses live only on clinic_locations now (clinic-level city/state/zip dropped);
  // the clinic row still carries a free-text `address` for single-location fallback.
  const heroAddress = (() => {
    const street = (primaryLoc?.address ?? clinic.address)?.trim() || null;
    const city = primaryLoc?.city ?? null;
    const state = primaryLoc?.state ?? null;
    const zip = primaryLoc?.zip ?? null;
    const stateAbbr = state ? (toStateCode(state) ?? state) : null;
    const cityLine = [[city, stateAbbr].filter(Boolean).join(", "), zip]
      .filter(Boolean)
      .join(" ")
      .trim();
    const skipCityLine =
      street && city && street.toLowerCase().includes(city.toLowerCase());
    return [street, skipCityLine ? null : cityLine].filter(Boolean).join(", ") || null;
  })();
  const isPremium = clinic.featured;
  // Fall back to the representative location's map link/address, since the
  // clinic row carries no headline address (every location lives on its own).
  const mapsUrl =
    primaryLoc?.google_maps_url ||
    clinic.google_maps_url ||
    buildMapsUrl([
      primaryLoc?.address ?? clinic.address,
      primaryLoc?.city,
      primaryLoc?.state,
      primaryLoc?.zip,
    ]);
  const bookUrl = clinic.booking_url || clinic.website;
  // Excerpt shows the admin-provided tagline ONLY — no about-snippet fallback.
  // (Never present derived text as if it were a curated tagline.)
  const excerpt = clinic.tagline ?? null;

  return (
    <main className="flex min-h-screen flex-col bg-[#FDFDFD] text-zinc-950 overflow-x-clip">
      <div className="bg-gradient-to-r from-[#7b2d6b] via-[#9b3a6e] to-[#b6663f]">
        <HeroHeader />
      </div>

      <div className="mx-auto w-full max-w-[1440px] flex-1 px-[16px] sm:px-[34px] pt-[35px] pb-[60px] flex flex-col gap-[35px]">
        {/* Breadcrumb */}
        <div className="-mb-[10px]">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Clinics", href: "/clinics" },
              { label: clinic.name },
            ]}
          />
        </div>

        {/* ── Hero Card ── */}
        <section className="flex flex-col rounded-[18px] border border-[#DEDEDE] bg-white p-5 sm:p-8 shadow-[0px_9px_11.1px_rgba(240,223,241,0.6)]">
          <div className="grid gap-8 lg:gap-[40px] lg:grid-cols-[1fr_560px]">
            {/* LEFT */}
            <div className="flex flex-col justify-center gap-[34px]">
              {/* Logo + name */}
              <div className="flex items-center gap-3 sm:gap-[16px]">
                {clinic.logo_url ? (
                  <div className="flex h-[84px] w-[96px] sm:h-[106px] sm:w-[122px] shrink-0 items-center justify-center overflow-hidden rounded-[16px] border border-[#E5E5E5] bg-[#faf5fa] p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={clinic.logo_url}
                      alt={`${clinic.name} logo`}
                      className="size-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex h-[84px] w-[96px] sm:h-[106px] sm:w-[122px] shrink-0 items-center justify-center rounded-[16px] border border-[#E5E5E5] bg-[#faf5fa] text-3xl font-semibold text-[#CF5D9A]">
                    {initials(clinic.name)}
                  </div>
                )}
                <div className="flex flex-col gap-[10px] min-w-0">
                  {isPremium && (
                    <span className="inline-flex w-fit items-center rounded-[4px] bg-[#D3A845] px-[10px] py-[4px] font-montserrat text-[10px] sm:text-[12px] font-semibold uppercase tracking-[0.1em] leading-[116.02%] text-white">
                      FEATURED
                    </span>
                  )}
                  <h1 className="font-montserrat text-[26px] sm:text-[36px] font-medium leading-[116.02%] tracking-[-0.04em] text-[#373634]">
                    {clinic.name}
                  </h1>
                </div>
              </div>

              {/* Tagline / excerpt */}
              {excerpt && (
                <p className="font-montserrat text-[16px] font-normal leading-[150%] tracking-[0.02em] text-[#575757]">
                  {excerpt}
                </p>
              )}

              {/* Stat strip — rating, then treatment & concern counts. Only
                  present metrics render; dividers sit between present items. */}
              {(() => {
                const statItems = [
                  stats.rating != null ? (
                    <div key="rating" className="flex flex-col justify-center items-start gap-[4px]">
                      <div className="flex items-center gap-[4px]">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-[17px] w-[18px] ${
                              i < Math.round(Number(stats.rating))
                                ? "fill-[#FFBA19] text-[#FFBA19]"
                                : "text-[#DEDEDE]"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="font-montserrat text-[12px] font-medium leading-[130%] tracking-[0.02em] text-[#616161]">
                        {stats.rating} ({stats.review_count} Reviews)
                      </span>
                    </div>
                  ) : null,
                  stats.treatments_count > 0 ? (
                    <div key="treat" className="flex flex-col justify-center items-start gap-[3px]">
                      <span className="font-montserrat text-[24px] font-semibold leading-none text-[#373634]">
                        {stats.treatments_count}
                      </span>
                      <span className="font-montserrat text-[12px] font-medium leading-[130%] tracking-[0.02em] text-[#616161]">
                        Treatments
                      </span>
                    </div>
                  ) : null,
                  concerns.length > 0 ? (
                    <div key="concern" className="flex flex-col justify-center items-start gap-[3px]">
                      <span className="font-montserrat text-[24px] font-semibold leading-none text-[#373634]">
                        {concerns.length}
                      </span>
                      <span className="font-montserrat text-[12px] font-medium leading-[130%] tracking-[0.02em] text-[#616161]">
                        Concerns Treated
                      </span>
                    </div>
                  ) : null,
                ].filter(Boolean);

                if (statItems.length === 0) return null;
                return (
                  <div className="flex flex-row flex-wrap items-center gap-x-[8px] gap-y-4 rounded-[16px] bg-white px-4 sm:px-[36px] py-4 sm:py-[16px] shadow-[0px_6px_10.5px_1px_rgba(0,0,0,0.05)] w-fit max-w-full">
                    {statItems.map((item, idx) => (
                      <React.Fragment key={idx}>
                        {idx > 0 && (
                          <div className="h-[46px] w-0 border border-[rgba(229,199,218,0.4)] mx-[12px] sm:mx-[20px]" />
                        )}
                        {item}
                      </React.Fragment>
                    ))}
                  </div>
                );
              })()}

              {/* CTAs */}
              <div className="flex flex-row flex-wrap items-center gap-[16px]">
                {bookUrl ? (
                  <a
                    href={bookUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-[48px] w-full sm:w-[210px] items-center justify-center gap-[10px] rounded-[8px] bg-[linear-gradient(90deg,#DE7F4C_0%,#C341D7_100%)] px-[24px] py-[10px] transition-opacity hover:opacity-90"
                  >
                    <span className="font-montserrat text-[14px] font-semibold leading-[17px] text-white whitespace-nowrap">
                      Book Appointment
                    </span>
                    <CalendarDays className="h-[20px] w-[20px] shrink-0 text-white" strokeWidth={1.5} />
                  </a>
                ) : null}

                {/* Social media links — sit alongside the Book CTA in place of
                    the old Call / Visit Website buttons. */}
                <ClinicSocialLinks socials={clinic} />
              </div>
            </div>

            {/* RIGHT — gallery (shown first on mobile as the hero image) */}
            <div className="order-first flex h-full items-center justify-center p-2 sm:p-0 lg:order-none">
              <ClinicGallery
                images={gallery}
                total={gallery_total}
                name={clinic.name}
              />
            </div>
          </div>
        </section>

        {/* ── Hours + Contact Information ── */}
        {(hasWeeklyHours(clinic.hours) || clinic.phone || clinic.email || heroAddress || clinic.website) && (
          <section className="grid items-stretch gap-[24px] px-0 sm:px-[24px] pt-[8px] lg:grid-cols-2">
            <HoursCard hours={clinic.hours} />
            <ClinicContactCard
              phone={clinic.phone}
              email={clinic.email}
              address={heroAddress}
              website={clinic.website}
              mapsUrl={mapsUrl}
              socials={clinic}
            />
          </section>
        )}

        {/* ── Before & After ── */}
        {before_after.length > 0 && (
          <ClinicBeforeAfterCarousel images={before_after} name={clinic.name} />
        )}

        {/* ── Treatments Offered ── */}
        <ClinicTreatmentsCarousel
          treatments={treatments}
          clinicName={clinic.name}
        />

        {/* ── Concerns (evidence-based, from the clinic's own website) ── */}
        <ClinicConcernsSection concerns={concerns} clinicName={clinic.name} />

        {/* ── Our Locations ── */}
        <ClinicLocationsSection locations={locations} clinicName={clinic.name} />

        {/* ── About ── */}
        {clinic.about && (
          <section className="flex flex-col gap-[24px] px-0 sm:px-[24px] pt-[24px] pb-[12px]">
            <h2 className="font-fraunces italic text-[28px] sm:text-[34px] font-normal leading-[116.02%] tracking-[-0.04em] text-[#373634]">
              About {clinic.name}
            </h2>
            <p className="font-montserrat text-[16px] font-normal leading-[150%] tracking-[0.02em] text-[#575757] whitespace-pre-line">
              {clinic.about}
            </p>
            {bookUrl && (
              <a
                href={bookUrl}
                target="_blank"
                rel="noreferrer"
                className="flex h-[48px] w-full sm:w-[210px] items-center justify-center gap-[10px] rounded-[8px] bg-[linear-gradient(90deg,#DE7F4C_0%,#C341D7_100%)] px-[24px] py-[10px] transition-opacity hover:opacity-90"
              >
                <span className="font-montserrat text-[14px] font-semibold leading-[17px] text-white whitespace-nowrap">
                  Book Appointment
                </span>
                <CalendarDays className="h-[20px] w-[20px] shrink-0 text-white" strokeWidth={1.5} />
              </a>
            )}
          </section>
        )}

        {/* ── Meet Experts ── */}
        {data.providers && data.providers.length > 0 && (
          <OtherProvidersCarousel
            title="Meet the Experts"
            providers={data.providers}
            bookUrl={bookUrl ?? "#"}
            clinicPhone={clinic.phone}
            linkToProfile={false}
          />
        )}

        {/* ── Reviews ── */}
        <ClinicReviewsSection reviews={reviews} />
      </div>
      <Footer />
    </main>
  );
}
