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
    <main className="flex min-h-screen flex-col bg-[#faf7fb] text-zinc-950">
      {/* Banner + nav */}
      <div className="bg-gradient-to-r from-[#7b2d6b] via-[#9b3a6e] to-[#b6663f]">
        <HeroHeader />
      </div>

      <div className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 sm:px-6">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-zinc-500">
          <Link href="/" className="hover:text-zinc-800">
            Home
          </Link>
          <ChevronRight className="size-3.5" />
          <Link href="/clinics" className="hover:text-zinc-800">
            Clinics
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="text-zinc-700">
            {clinic.name}
            {loc ? `, ${loc}` : ""}
          </span>
        </nav>

        {/* Hero card */}
        <section className="mt-6 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-zinc-100">
          <div className="grid gap-0 lg:grid-cols-2">
            {/* LEFT */}
            <div className="flex flex-col gap-5 p-7 sm:p-10">
              <div className="flex items-center gap-4">
                {clinic.logo_url ? (
                  // Branded dark chip so logos with white lettering (common for
                  // medspas) stay visible — a white logo vanishes on white.
                  <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#7b2d6b] to-[#b6663f] p-2.5 shadow-sm ring-1 ring-black/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={clinic.logo_url}
                      alt={`${clinic.name} logo`}
                      className="size-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#d96f8e]/15 to-[#9b3a9b]/15 text-xl font-semibold text-[#9b3a9b]">
                    {initials(clinic.name)}
                  </div>
                )}
                {isPremium && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#e08a4f]/15 to-[#d96f8e]/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#9b3a6e]">
                    <Star className="size-3.5 fill-[#e08a4f] text-[#e08a4f]" />
                    Featured Premium Clinic
                  </span>
                )}
              </div>

              <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
                {clinic.name}
              </h1>

              {excerpt && (
                <p className="max-w-xl text-base leading-relaxed text-zinc-600">
                  {excerpt}
                </p>
              )}

              {/* Info row */}
              <div className="grid grid-cols-1 gap-4 rounded-2xl border border-zinc-100 bg-zinc-50/60 p-4 sm:grid-cols-3">
                {hasMultipleLocations ? (
                  <div className="flex items-start gap-2.5 text-sm text-zinc-600">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-[#9b3a9b]" />
                    <span>{locations.length} locations — {loc}</span>
                  </div>
                ) : (clinic.address || loc) ? (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-start gap-2.5 text-sm text-zinc-600 transition hover:text-[#9b3a9b]"
                  >
                    <MapPin className="mt-0.5 size-4 shrink-0 text-[#9b3a9b]" />
                    <span>{clinic.address || loc}</span>
                  </a>
                ) : null}
                {todayHours && (
                  <div className="flex items-start gap-2.5 text-sm text-zinc-600">
                    <Clock className="mt-0.5 size-4 shrink-0 text-[#9b3a9b]" />
                    <span>
                      Open Today {todayHours.open}–{todayHours.close}
                    </span>
                  </div>
                )}
                {stats.rating != null && (
                  <div className="flex items-start gap-2.5 text-sm text-zinc-600">
                    <Star className="mt-0.5 size-4 shrink-0 fill-amber-400 text-amber-400" />
                    <span>
                      {stats.rating} ★
                      {stats.review_count != null && (
                        <> ({stats.review_count} Reviews)</>
                      )}
                    </span>
                  </div>
                )}
              </div>

              {/* CTAs */}
              <div className="flex flex-wrap gap-3">
                {bookUrl ? (
                  <a
                    href={bookUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#e08a4f] to-[#d96f8e] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
                  >
                    <CalendarDays className="size-4" /> Book Appointment
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-400">
                    <CalendarDays className="size-4" /> Book Appointment
                  </span>
                )}
                {clinic.phone && (
                  <a
                    href={`tel:${clinic.phone}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:border-[#d96f8e] hover:text-[#9b3a9b]"
                  >
                    <Phone className="size-4" /> Call Clinic
                  </a>
                )}
              </div>
            </div>

            {/* RIGHT — gallery */}
            <div className="bg-zinc-50 p-7 sm:p-10">
              <ClinicGallery
                images={gallery}
                total={gallery_total}
                name={clinic.name}
              />
            </div>
          </div>
        </section>

        {/* Treatments Offered */}
        {treatments.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
              Treatment{" "}
              <span className="font-fraunces italic font-normal">Offered</span>{" "}
              By {clinic.name}
            </h2>
            <div className="mt-6 flex flex-wrap gap-3">
              {treatments.map((t, i) => {
                const inner = (
                  <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:-translate-y-0.5 hover:border-[#d96f8e] hover:bg-[#fdf4f9] hover:text-[#9b3a9b] hover:shadow">
                    <Sparkles className="size-3.5 text-[#d96f8e]" />
                    {t.name}
                    {t.slug && (
                      <ChevronRight className="size-3.5 text-zinc-300 transition group-hover:text-[#9b3a9b]" />
                    )}
                  </span>
                );
                return t.slug ? (
                  <Link key={i} href={`/treatments/${t.slug}`} className="group">
                    {inner}
                  </Link>
                ) : (
                  <span key={i}>{inner}</span>
                );
              })}
            </div>
          </section>
        )}

        {/* Locations — only shown when a clinic has 2+ locations */}
        {hasMultipleLocations && (
          <section className="mt-12">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
              Our{" "}
              <span className="font-fraunces italic font-normal">Locations</span>
            </h2>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {locations.map((location) => {
                const addrLine = [location.address, location.city, location.state, location.zip]
                  .filter(Boolean)
                  .join(", ");
                const mapLink =
                  location.google_maps_url ||
                  (addrLine
                    ? `https://maps.google.com/?q=${encodeURIComponent(addrLine)}`
                    : null);
                return (
                  <div
                    key={location.id}
                    className="flex flex-col gap-3 rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="size-4 shrink-0 text-[#9b3a9b]" />
                      <span className="font-semibold text-sm text-zinc-900">
                        {location.label || location.city || "Location"}
                      </span>
                      {location.is_primary && (
                        <span className="ml-auto text-[10px] font-medium text-[#9b3a9b] bg-[#fdf4f9] px-2 py-0.5 rounded-full border border-[#d96f8e]/20">
                          Main
                        </span>
                      )}
                    </div>
                    {addrLine && (
                      <p className="text-xs text-zinc-500 leading-relaxed">{addrLine}</p>
                    )}
                    {location.phone && (
                      <a
                        href={`tel:${location.phone}`}
                        className="text-xs text-zinc-600 hover:text-[#9b3a9b] transition"
                      >
                        {location.phone}
                      </a>
                    )}
                    <div className="flex flex-wrap gap-2 mt-auto pt-2">
                      {mapLink && (
                        <a
                          href={mapLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium text-[#9b3a9b] hover:underline"
                        >
                          View on Maps →
                        </a>
                      )}
                      {location.booking_url && (
                        <a
                          href={location.booking_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium text-[#9b3a9b] hover:underline"
                        >
                          Book Here →
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Before & After — hidden for now */}
        {false && before_after.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
              Before{" "}
              <span className="font-fraunces italic font-normal">&amp; After</span>
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              Real results from {clinic.name}
              {before_after_total > 0 ? ` · ${before_after_total} photos` : ""}
            </p>
            <BeforeAfterGallery
              images={before_after}
              total={before_after_total}
              name={clinic.name}
            />
          </section>
        )}

        {/* About */}
        {clinic.about && (
          <section className="mt-12">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
              About {clinic.name}
              {loc ? `, ${loc}` : ""}
            </h2>
            {clinic.founded_year != null && (
              <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-600">
                Established {clinic.founded_year}
              </p>
            )}
            <p className="mt-4 max-w-3xl whitespace-pre-line text-base leading-relaxed text-zinc-600">
              {clinic.about}
            </p>
          </section>
        )}

        {/* Stats strip */}
        <section className="mt-12 rounded-3xl bg-white p-7 shadow-sm ring-1 ring-zinc-100 sm:p-10">
          <div className="grid grid-cols-2 divide-zinc-200 sm:grid-cols-4 sm:divide-x">
            <div className="flex flex-col items-center px-4 py-3 text-center">
              <span className="text-3xl font-semibold text-zinc-900">
                {stats.treatments_count}
              </span>
              <span className="mt-1 text-sm text-zinc-500">Treatments</span>
            </div>
            <div className="flex flex-col items-center px-4 py-3 text-center">
              <span className="text-3xl font-semibold text-zinc-900">
                {stats.rating ?? "—"}
              </span>
              <span className="mt-1 text-sm text-zinc-500">Avg Rating</span>
            </div>
            <div className="flex flex-col items-center px-4 py-3 text-center">
              <span className="text-3xl font-semibold text-zinc-900">
                {stats.review_count ?? 0}
              </span>
              <span className="mt-1 text-sm text-zinc-500">Reviews</span>
            </div>
            <div className="flex flex-col items-center px-4 py-3 text-center">
              <span className="text-3xl font-semibold text-zinc-900">
                {loc || "—"}
              </span>
              <span className="mt-1 text-sm text-zinc-500">Location</span>
            </div>
          </div>
        </section>

        {/* Reviews */}
        {reviews.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">
              What Our Clients Say
            </h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {reviews.map((r, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
                >
                  {r.rating != null && (
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, s) => (
                        <Star
                          key={s}
                          className={`size-4 ${
                            s < r.rating!
                              ? "fill-amber-400 text-amber-400"
                              : "text-zinc-200"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                  <p className="mt-3 text-sm leading-relaxed text-zinc-600">
                    “{r.body}”
                  </p>
                  <div className="mt-4 text-sm font-medium text-zinc-800">
                    — {r.reviewer_name || "Verified Patient"}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <Footer />
    </main>
  );
}
