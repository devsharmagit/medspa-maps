import { notFound } from "next/navigation";
import React from "react";
import type { Metadata } from "next";
import {
  CalendarDays,
  Phone,
  MapPin,
  Clock,
  Star,
} from "lucide-react";
import { HeroHeader } from "@/components/hero/hero-header";
import { Footer } from "@/components/footer";
import { getClinicData } from "@/lib/clinics/queries";
import { ClinicGallery } from "./gallery";
import { ClinicLocationsSection } from "./locations";
import { OtherProvidersCarousel } from "@/components/shared/other-providers-carousel";
import { ClinicTreatmentsCarousel } from "@/components/shared/clinic-treatments-carousel";
import { ClinicReviewsSection } from "@/components/shared/clinic-reviews-section";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";

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
  const loc = [clinic.city, clinic.state].filter(Boolean).join(", ");
  return {
    title: `${clinic.name} — Medspa Map`,
    description:
      clinic.about?.slice(0, 155) ??
      clinic.tagline ??
      (loc ? `Book at ${clinic.name} in ${loc}` : undefined),
  };
}

const DAY_KEYS = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

type HoursMap = Record<
  string,
  { open: string | null; close: string | null; is_open: boolean }
>;

function getTodayHours(hours: unknown): { open: string; close: string } | null {
  if (!hours || typeof hours !== "object") return null;
  const map = hours as HoursMap;
  const key = DAY_KEYS[new Date().getDay()];
  const h = map[key];
  if (!h || !h.is_open || !h.open || !h.close) return null;
  return { open: h.open, close: h.close };
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

  const { clinic, locations, treatments, gallery, gallery_total, reviews, stats } =
    data;

  const primaryLoc = locations.find((l) => l.is_primary) ?? locations[0] ?? null;
  const loc = primaryLoc
    ? [primaryLoc.city, primaryLoc.state].filter(Boolean).join(", ")
    : [clinic.city, clinic.state].filter(Boolean).join(", ");
  const isPremium = clinic.featured || clinic.verified;
  const todayHours = getTodayHours(clinic.hours);
  const mapsUrl =
    clinic.google_maps_url ||
    buildMapsUrl([clinic.address, clinic.city, clinic.state, clinic.zip]);
  const bookUrl = clinic.booking_url || clinic.website;
  // Excerpt shows the admin-provided tagline ONLY — no about-snippet fallback.
  // (Never present derived text as if it were a curated tagline.)
  const excerpt = clinic.tagline ?? null;

  // Hero stats show ONLY values the admin explicitly entered (clinic.stat_*).
  // Nothing is computed, defaulted, or invented: a blank stat is omitted, and
  // if none were entered the whole stats row is hidden (see render below).
  // Product decision — never display numbers the admin didn't actually provide.
  const statsConfig = [
    { value: clinic.stat_experts, line1: "CERTIFIED", line2: "EXPERT" },
    { value: clinic.stat_cities, line1: "CITIES", line2: "COVERED" },
    { value: clinic.stat_treatments, line1: "ADVANCED", line2: "TREATMENT" },
    { value: clinic.stat_rating, line1: "AVERAGE", line2: "RATING" },
    { value: clinic.stat_patients, line1: "PATIENT", line2: "TRANSFORMED" },
  ]
    .filter((s) => s.value != null && String(s.value).trim() !== "")
    .map((s, i) => ({
      value: String(s.value),
      line1: s.line1,
      line2: s.line2,
      align: (i === 0 ? "start" : "center") as "start" | "center",
    }));

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
                  <div className="flex h-[84px] w-[96px] sm:h-[106px] sm:w-[122px] shrink-0 items-center justify-center overflow-hidden rounded-[16px] border border-[#E5C7DA] bg-white p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={clinic.logo_url}
                      alt={`${clinic.name} logo`}
                      className="size-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex h-[84px] w-[96px] sm:h-[106px] sm:w-[122px] shrink-0 items-center justify-center rounded-[16px] border border-[#E5C7DA] bg-gradient-to-br from-[#d96f8e]/15 to-[#9b3a9b]/15 text-3xl font-semibold text-[#9b3a9b]">
                    {initials(clinic.name)}
                  </div>
                )}
                <div className="flex flex-col gap-[10px] min-w-0">
                  {isPremium && (
                    <span className="inline-flex w-fit items-center rounded-[4px] bg-[linear-gradient(90deg,rgba(211,168,69,0.6)_0%,rgba(109,87,36,0.6)_100%)] px-[10px] py-[4px] font-montserrat text-[10px] sm:text-[12px] font-semibold uppercase tracking-[0.1em] leading-[116.02%] text-[#FFFCF8]">
                      FEATURED PREMIUM CLINIC
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

              {/* Info row — only renders items that have data, dividers only between present items */}
              {(() => {
                const infoItems = [
                  (clinic.address || loc) ? (
                    <div key="addr" className="flex items-center gap-[8px]">
                      <MapPin className="h-[24px] w-[24px] text-[#EE97C6] shrink-0" strokeWidth={1.5} />
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-montserrat text-[12px] font-medium leading-[130%] tracking-[0.02em] text-[#616161] hover:underline max-w-[145px]"
                      >
                        {clinic.address || loc}
                      </a>
                    </div>
                  ) : null,
                  todayHours ? (
                    <div key="hours" className="flex items-center gap-[8px]">
                      <Clock className="h-[24px] w-[24px] text-[#EE97C6] shrink-0" strokeWidth={1.5} />
                      <div className="flex flex-col gap-[4px]">
                        <span className="font-montserrat text-[12px] font-medium leading-[130%] tracking-[0.02em] text-[#616161]">
                          Open Today
                        </span>
                        <span className="font-inter text-[12px] font-normal leading-[100%] text-[#9A9A9A]">
                          {todayHours.open} - {todayHours.close}
                        </span>
                      </div>
                    </div>
                  ) : null,
                  stats.rating != null ? (
                    <div key="rating" className="flex flex-col justify-center items-start gap-[2px]">
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
                ].filter(Boolean);

                if (infoItems.length === 0) return null;
                return (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-[8px] rounded-[16px] bg-white px-4 sm:px-[40px] py-4 sm:py-[1px] min-h-0 sm:min-h-[66px] shadow-[0px_6px_10.5px_1px_rgba(0,0,0,0.05)] w-full max-w-[608px]">
                    {infoItems.map((item, idx) => (
                      <React.Fragment key={idx}>
                        {idx > 0 && (
                          <div className="hidden sm:block h-[49px] w-0 border border-[rgba(229,199,218,0.4)] mx-[8px]" />
                        )}
                        {item}
                      </React.Fragment>
                    ))}
                  </div>
                );
              })()}

              {/* CTAs */}
              <div className="flex flex-row flex-wrap items-start gap-[16px]">
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
                {clinic.phone && (
                  <a
                    href={`tel:${clinic.phone}`}
                    className="flex h-[48px] w-full sm:w-[150px] items-center justify-center gap-[10px] rounded-[8px] border-[1px] border-[#E5C7DA] px-[24px] py-[10px] transition-colors hover:bg-pink-50"
                  >
                    <span className="font-montserrat text-[14px] font-semibold leading-[17px] text-[#CF5B9D] whitespace-nowrap">
                      Call Clinic
                    </span>
                    <Phone className="h-[17px] w-[17px] shrink-0 text-[#CF5B9D]" strokeWidth={1.5} />
                  </a>
                )}
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

        {/* ── Treatments Offered ── */}
        <ClinicTreatmentsCarousel
          treatments={treatments}
          clinicName={clinic.name}
        />

        {/* ── About + Stats ── */}
        <section className="flex flex-col gap-[36px] px-0 sm:px-[24px] pt-[36px] pb-[36px]">
          <h2 className="font-fraunces italic text-[28px] sm:text-[34px] font-normal leading-[116.02%] tracking-[-0.04em] text-[#373634]">
            About {clinic.name}
          </h2>

          {clinic.about && (
            <p className="font-montserrat text-[16px] font-normal leading-[150%] tracking-[0.02em] text-[#575757] whitespace-pre-line">
              {clinic.about}
            </p>
          )}

          {/* Stats row — rendered only when the admin entered ≥1 stat */}
          {statsConfig.length > 0 && (
          <div className="flex flex-row flex-wrap items-center gap-y-6">
            {statsConfig.map((stat, idx) => (
              <div key={idx} className="flex items-center">
                {idx > 0 && (
                  <div className="hidden sm:block h-[109px] w-[1px] bg-[rgba(193,121,165,0.4)] mx-[20px] lg:mx-[30px]" />
                )}
                <div
                  className={`flex flex-col ${
                    stat.align === "start" ? "items-start" : "items-center"
                  } min-w-[120px] sm:min-w-[150px]`}
                >
                  <span className="font-fraunces text-[42px] sm:text-[56px] font-light leading-[116.02%] text-[#373634]">
                    {stat.value}
                  </span>
                  <span
                    className={`font-montserrat text-[13px] sm:text-[16px] font-semibold leading-[116.02%] tracking-[0.1em] uppercase text-[#A8698B] ${
                      stat.align === "center" ? "text-center" : ""
                    }`}
                  >
                    {stat.line1}
                    <br />
                    {stat.line2}
                  </span>
                </div>
              </div>
            ))}
          </div>
          )}

          {/* CTAs */}
          <div className="flex flex-row flex-wrap items-start gap-[16px]">
            {bookUrl && (
              <a
                href={bookUrl}
                target="_blank"
                rel="noreferrer"
                className="flex h-[48px] w-[210px] items-center justify-center gap-[10px] rounded-[8px] bg-[linear-gradient(90deg,#DE7F4C_0%,#C341D7_100%)] px-[24px] py-[10px] transition-opacity hover:opacity-90"
              >
                <span className="font-montserrat text-[14px] font-semibold leading-[17px] text-white whitespace-nowrap">
                  Book Appointment
                </span>
                <CalendarDays className="h-[20px] w-[20px] shrink-0 text-white" strokeWidth={1.5} />
              </a>
            )}
            {clinic.phone && (
              <a
                href={`tel:${clinic.phone}`}
                className="flex h-[48px] w-[150px] items-center justify-center gap-[10px] rounded-[8px] border-[1px] border-[#E5C7DA] px-[24px] py-[10px] transition-colors hover:bg-pink-50"
              >
                <span className="font-montserrat text-[14px] font-semibold leading-[17px] text-[#CF5B9D] whitespace-nowrap">
                  Call Clinic
                </span>
                <Phone className="h-[17px] w-[17px] shrink-0 text-[#CF5B9D]" strokeWidth={1.5} />
              </a>
            )}
          </div>
        </section>

        {/* ── Our Locations (multi-location clinics only) ── */}
        <ClinicLocationsSection locations={locations} fallbackBookUrl={bookUrl} />

        {/* ── Meet Experts ── */}
        {data.providers && data.providers.length > 0 && (
          <OtherProvidersCarousel
            title={`Meet ${clinic.name.split(" ")[0]} Experts`}
            providers={data.providers}
            bookUrl={bookUrl ?? "#"}
            clinicPhone={clinic.phone}
          />
        )}

        {/* ── Reviews ── */}
        <ClinicReviewsSection reviews={reviews} />
      </div>
      <Footer />
    </main>
  );
}
