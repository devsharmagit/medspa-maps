import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ChevronRight,
  CalendarDays,
  Phone,
  MapPin,
  Clock,
  Star,
  Sparkles,
} from "lucide-react";
import { HeroHeader } from "@/components/hero/hero-header";
import { Footer } from "@/components/footer";
import { getClinicData } from "@/lib/clinics/queries";
import { ClinicGallery, BeforeAfterGallery } from "./gallery";
import { OtherProvidersCarousel } from "@/components/shared/other-providers-carousel";
import { PopularTreatments } from "@/components/hero/popular-treatments";

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

  const { clinic, locations, treatments, gallery, gallery_total, before_after, before_after_total, reviews, stats } =
    data;

  const primaryLoc = locations.find((l) => l.is_primary) ?? locations[0] ?? null;
  const loc = primaryLoc
    ? [primaryLoc.city, primaryLoc.state].filter(Boolean).join(", ")
    : [clinic.city, clinic.state].filter(Boolean).join(", ");
  const hasMultipleLocations = locations.length > 1;
  const isPremium = clinic.featured || clinic.verified;
  const todayHours = getTodayHours(clinic.hours);
  // Prefer the real maps link captured at ingestion (resolves to the actual
  // pin); fall back to a textual address search only when it's missing.
  const mapsUrl =
    clinic.google_maps_url ||
    buildMapsUrl([clinic.address, clinic.city, clinic.state, clinic.zip]);
  const bookUrl = clinic.booking_url || clinic.website;
  const excerpt = clinic.tagline ?? clinic.about?.slice(0, 240) ?? null;

  return (
    <main className="flex min-h-screen flex-col bg-[#FDFDFD] text-zinc-950">
      <div className="bg-gradient-to-r from-[#7b2d6b] via-[#9b3a6e] to-[#b6663f]">
        <HeroHeader />
      </div>

      <div className="mx-auto w-full max-w-[1440px] flex-1 px-[16px] sm:px-[34px] pt-[35px] pb-[60px] flex flex-col gap-[35px]">
        {/* Breadcrumb */}
        <div className="-mb-[10px]">
          <nav className="flex flex-wrap items-center gap-[16px] text-sm">
            <Link href="/" className="text-[#CF5B9D] hover:underline font-montserrat">
              Home
            </Link>
            <ChevronRight className="size-3.5 text-zinc-400" />
            <Link href="/clinics" className="text-[#CF5B9D] hover:underline font-montserrat">
              Clinics
            </Link>
            <ChevronRight className="size-3.5 text-zinc-400" />
            <span className="text-zinc-500 font-montserrat">
              {clinic.name}
              {loc ? `, ${loc}` : ""}
            </span>
          </nav>
        </div>

        {/* Hero card */}
        <section className="flex flex-col rounded-[18px] border border-[#DEDEDE] bg-white p-5 sm:p-8 shadow-[0px_9px_11.1px_rgba(240,223,241,0.6)]">
          <div className="grid gap-[64px] lg:grid-cols-[1fr_560px]">
            {/* LEFT */}
            <div className="flex flex-col justify-center gap-[34px]">
              <div className="flex items-center gap-[16px]">
                {clinic.logo_url ? (
                  <div className="flex h-[106px] w-[122px] shrink-0 items-center justify-center overflow-hidden rounded-[16px] border border-[#E5C7DA] bg-white p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={clinic.logo_url}
                      alt={`${clinic.name} logo`}
                      className="size-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex h-[106px] w-[122px] shrink-0 items-center justify-center rounded-[16px] border border-[#E5C7DA] bg-gradient-to-br from-[#d96f8e]/15 to-[#9b3a9b]/15 text-3xl font-semibold text-[#9b3a9b]">
                    {initials(clinic.name)}
                  </div>
                )}
                <div className="flex flex-col gap-[10px]">
                  {isPremium && (
                    <span className="inline-flex w-fit items-center rounded-[4px] bg-[linear-gradient(90deg,rgba(211,168,69,0.6)_0%,rgba(109,87,36,0.6)_100%)] px-[10px] py-[4px] font-montserrat text-[12px] font-semibold uppercase tracking-[0.1em] leading-[116.02%] text-[#FFFCF8]">
                      FEATURED PREMIUM CLINIC
                    </span>
                  )}
                  <h1 className="font-montserrat text-[36px] font-medium leading-[116.02%] tracking-[-0.04em] text-[#373634]">
                    {clinic.name}
                  </h1>
                </div>
              </div>

              {excerpt && (
                <p className="font-montserrat text-[16px] font-normal leading-[150%] tracking-[0.02em] text-[#575757]">
                  {excerpt}
                </p>
              )}

              {/* Info row */}
              <div className="flex flex-row items-center justify-between gap-[24px] rounded-[16px] bg-white px-[40px] py-[1px] h-[66.68px] shadow-[0px_6px_10.5px_1px_rgba(0,0,0,0.05)] w-full max-w-[608px]">
                {(clinic.address || loc) && (
                  <div className="flex items-center gap-[8px]">
                    <MapPin className="h-[24px] w-[24px] text-[#EE97C6] shrink-0" strokeWidth={1.5} />
                    <a href={mapsUrl} target="_blank" rel="noreferrer" className="font-montserrat text-[12px] font-medium leading-[130%] tracking-[0.02em] text-[#616161] hover:underline max-w-[145px]">
                      {clinic.address || loc}
                    </a>
                  </div>
                )}

                {/* Divider */}
                <div className="h-[49px] w-0 border border-[rgba(229,199,218,0.4)]" />

                {todayHours && (
                  <div className="flex items-center gap-[8px]">
                    <Clock className="h-[24px] w-[24px] text-[#EE97C6] shrink-0" strokeWidth={1.5} />
                    <div className="flex flex-col gap-[4px] w-[76px]">
                      <span className="font-montserrat text-[12px] font-medium leading-[130%] tracking-[0.02em] text-[#616161]">Open Today</span>
                      <span className="font-inter text-[12px] font-normal leading-[100%] text-[#9A9A9A]">{todayHours.open} - {todayHours.close}</span>
                    </div>
                  </div>
                )}

                {/* Divider */}
                <div className="h-[49px] w-0 border border-[rgba(229,199,218,0.4)]" />

                {stats.rating != null && (
                  <div className="flex flex-col justify-center items-start gap-[2px] w-[109px]">
                    <div className="flex items-center gap-[4px] h-[17px]">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-[17px] w-[18px] ${i < Math.round(Number(stats.rating)) ? "fill-[#FFBA19] text-[#FFBA19]" : "text-[#DEDEDE]"}`} />
                      ))}
                    </div>
                    <span className="font-montserrat text-[12px] font-medium leading-[130%] tracking-[0.02em] text-[#616161]">
                      {stats.rating} ({stats.review_count} Reviews)
                    </span>
                  </div>
                )}
              </div>

              {/* CTAs */}
              <div className="flex flex-row items-start gap-[16px]">
                {bookUrl ? (
                  <a
                    href={bookUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-[48px] w-[210px] items-center justify-center gap-[10px] rounded-[8px] bg-[linear-gradient(90deg,#DE7F4C_0%,#C341D7_100%)] px-[24px] py-[10px] transition-opacity hover:opacity-90"
                  >
                    <span className="font-montserrat text-[14px] font-semibold leading-[17px] text-white whitespace-nowrap">Book Appointment</span>
                    <CalendarDays className="h-[20px] w-[20px] shrink-0 text-white" strokeWidth={1.5} />
                  </a>
                ) : null}
                {clinic.phone && (
                  <a
                    href={`tel:${clinic.phone}`}
                    className="flex h-[48px] w-[150px] items-center justify-center gap-[10px] rounded-[8px] border-[1px] border-[#E5C7DA] px-[24px] py-[10px] transition-colors hover:bg-pink-50"
                  >
                    <span className="font-montserrat text-[14px] font-semibold leading-[17px] text-[#CF5B9D] whitespace-nowrap">Call Clinic</span>
                    <Phone className="h-[17px] w-[17px] shrink-0 text-[#CF5B9D]" strokeWidth={1.5} />
                  </a>
                )}
              </div>
            </div>

            {/* RIGHT — gallery */}
            <div className="flex h-full items-center justify-center p-2 sm:p-0">
              <ClinicGallery
                images={gallery}
                total={gallery_total}
                name={clinic.name}
              />
            </div>
          </div>
        </section>

        {/* Stats Strip */}
        <section className="w-full bg-[linear-gradient(90deg,rgba(255,255,255,0.7)_-5.3%,rgba(253,248,251,0.7)_53.33%,rgba(255,255,255,0.7)_107.03%)] px-[32px] py-[48px] rounded-[18px]">
          <div className="grid grid-cols-2 divide-y sm:grid-cols-5 sm:divide-x sm:divide-y-0 divide-[#DEDEDE]/50">
            <div className="flex flex-col items-center justify-center px-4 py-2 text-center gap-1">
              <span className="font-serif text-[42px] leading-[100%] text-[#373634]">{data.providers.length > 0 ? `${data.providers.length}+` : "20+"}</span>
              <span className="font-montserrat text-[12px] font-bold uppercase tracking-[0.1em] text-[#CF5D9A]">CERTIFIED<br/>EXPERT</span>
            </div>
            <div className="flex flex-col items-center justify-center px-4 py-2 text-center gap-1">
              <span className="font-serif text-[42px] leading-[100%] text-[#373634]">{hasMultipleLocations ? locations.length : 8}</span>
              <span className="font-montserrat text-[12px] font-bold uppercase tracking-[0.1em] text-[#CF5D9A]">CITIES<br/>COVERED</span>
            </div>
            <div className="flex flex-col items-center justify-center px-4 py-2 text-center gap-1">
              <span className="font-serif text-[42px] leading-[100%] text-[#373634]">{stats.treatments_count}+</span>
              <span className="font-montserrat text-[12px] font-bold uppercase tracking-[0.1em] text-[#CF5D9A]">ADVANCED<br/>TREATMENT</span>
            </div>
            <div className="flex flex-col items-center justify-center px-4 py-2 text-center gap-1">
              <span className="font-serif text-[42px] leading-[100%] text-[#373634]">{stats.rating || "5.0"}</span>
              <span className="font-montserrat text-[12px] font-bold uppercase tracking-[0.1em] text-[#CF5D9A]">AVERAGE<br/>RATING</span>
            </div>
            <div className="flex flex-col items-center justify-center px-4 py-2 text-center gap-1">
              <span className="font-serif text-[42px] leading-[100%] text-[#373634]">10k+</span>
              <span className="font-montserrat text-[12px] font-bold uppercase tracking-[0.1em] text-[#CF5D9A]">PATIENT<br/>TRANSFORMED</span>
            </div>
          </div>
        </section>

        {/* Meet Experts Carousel */}
        {data.providers && data.providers.length > 0 && (
          <OtherProvidersCarousel
            title={`Meet ${clinic.name.split(" ")[0]} Experts`}
            providers={data.providers}
            bookUrl={bookUrl ?? "#"}
            clinicPhone={clinic.phone}
          />
        )}

        {/* Treatments Carousel */}
        {/* Using PopularTreatments but styling it for the Clinic page header */}
        <PopularTreatments titleNode={
          <>
            Treatment <span className="font-serif italic font-normal">Offered</span> By {clinic.name}
          </>
        } />

        {/* About */}
        {clinic.about && (
          <section className="mt-8 mb-20 px-4">
            <h2 className="font-montserrat text-[34px] font-normal leading-[116.02%] tracking-[-0.04em] text-[#373634]">
              <span className="font-serif italic font-normal">About</span> {clinic.name}{loc ? `, ${loc}` : ""}
            </h2>
            <p className="mt-6 max-w-4xl whitespace-pre-line font-montserrat text-[16px] leading-[150%] text-[#727272]">
              {clinic.about}
            </p>
          </section>
        )}
      </div>
      <Footer />
    </main>
  );
}
