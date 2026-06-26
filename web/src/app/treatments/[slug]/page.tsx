import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ChevronRight,
  CalendarDays,
  Star,
  Clock,
  Sparkles,
  BadgeCheck,
} from "lucide-react";
import { HeroHeader } from "@/components/hero/hero-header";
import { Footer } from "@/components/footer";
import { FaqAccordion } from "@/components/faq-accordion";
import { getTreatmentData } from "@/lib/treatments/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getTreatmentData(slug);
  if (!data) return { title: "Treatment not found" };
  return {
    title: `${data.service.name} — Medspa Map`,
    description: data.service.summary ?? data.service.description ?? undefined,
  };
}

export default async function TreatmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const latRaw = parseFloat(typeof sp.lat === "string" ? sp.lat : "");
  const lngRaw = parseFloat(typeof sp.lng === "string" ? sp.lng : "");
  const opts = {
    lat: Number.isNaN(latRaw) ? undefined : latRaw,
    lng: Number.isNaN(lngRaw) ? undefined : lngRaw,
  };

  const data = await getTreatmentData(slug, opts);
  if (!data) notFound();

  const { service, clinics, reviews } = data;

  const hasStats =
    service.treatment_time != null ||
    service.results_timeline != null ||
    service.results_duration != null;

  return (
    <main className="flex min-h-screen flex-col bg-[#faf7fb] text-zinc-950">
      {/* Banner + nav */}
      <div className="bg-gradient-to-r from-[#7b2d6b] via-[#9b3a6e] to-[#b6663f]">
        <HeroHeader />
      </div>

      <div className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 sm:px-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-zinc-500">
          <Link href="/" className="hover:text-zinc-800">
            Home
          </Link>
          <ChevronRight className="size-3.5" />
          <Link href="/treatments" className="hover:text-zinc-800">
            Treatments
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="text-zinc-700">{service.name}</span>
        </nav>

        {/* Hero card */}
        <section className="mt-6 rounded-3xl bg-gradient-to-br from-[#d96f8e] to-[#9b3a9b] p-7 text-white shadow-sm sm:p-10">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {service.name}{" "}
            <span className="font-fraunces italic font-normal">Treatment</span>
          </h1>

          {service.hero_rating != null && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
              <span className="inline-flex items-center gap-1">
                {service.hero_rating} <Star className="size-3.5 fill-white" />
                {service.hero_review_count != null && (
                  <span>({service.hero_review_count})</span>
                )}
              </span>
            </div>
          )}

          {service.description && (
            <p className="mt-5 max-w-3xl text-base leading-relaxed text-white/85">
              {service.description}
            </p>
          )}

          {/* Stats bar */}
          {hasStats && (
            <div className="mt-7 grid grid-cols-1 divide-y divide-zinc-200 rounded-2xl bg-white text-zinc-900 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {service.treatment_time != null && (
                <div className="flex items-center gap-3 px-5 py-4">
                  <Clock className="size-5 text-[#9b3a9b]" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Treatment Time
                    </p>
                    <p className="text-sm font-semibold text-zinc-900">
                      {service.treatment_time}
                    </p>
                  </div>
                </div>
              )}
              {service.results_timeline != null && (
                <div className="flex items-center gap-3 px-5 py-4">
                  <Sparkles className="size-5 text-[#9b3a9b]" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Results
                    </p>
                    <p className="text-sm font-semibold text-zinc-900">
                      {service.results_timeline}
                    </p>
                  </div>
                </div>
              )}
              {service.results_duration != null && (
                <div className="flex items-center gap-3 px-5 py-4">
                  <Clock className="size-5 text-[#9b3a9b]" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Duration
                    </p>
                    <p className="text-sm font-semibold text-zinc-900">
                      {service.results_duration}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Best Clinics Near You */}
        <section id="clinics" className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
            Best Clinics{" "}
            <span className="font-fraunces italic font-normal">Near You</span>
          </h2>
          <p className="mt-1.5 text-sm text-zinc-500">
            {clinics.length} Clinics Found
          </p>

          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {clinics.map((c) => {
              const bookUrl = c.booking_url || c.website;
              return (
                <div
                  key={c.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
                >
                  <div className="relative h-44 w-full bg-zinc-100">
                    {c.cover_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.cover_image}
                        alt={c.name}
                        className="h-44 w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-44 w-full bg-zinc-200" />
                    )}
                    {c.verified && (
                      <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-[#9b3a9b] shadow-sm backdrop-blur-sm">
                        FEATURED
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-base font-semibold text-zinc-900">
                        {c.name}
                      </h3>
                      {c.verified && (
                        <BadgeCheck className="size-4 shrink-0 fill-[#d96f8e] text-white" />
                      )}
                    </div>

                    <div className="mt-1.5 text-sm text-zinc-500">
                      {c.review_count > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <Star className="size-3.5 fill-amber-400 text-amber-400" />
                          {c.avg_rating} ({c.review_count})
                        </span>
                      ) : (
                        "No reviews yet"
                      )}
                    </div>

                    <div className="mt-5 border-t border-zinc-100 pt-4">
                      {bookUrl ? (
                        <a
                          href={bookUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#e08a4f] to-[#d96f8e] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
                        >
                          <CalendarDays className="size-4" /> Book Appointment
                        </a>
                      ) : (
                        <span className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-400">
                          <CalendarDays className="size-4" /> Book Appointment
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
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
                    <span className="ml-1 font-normal text-zinc-400">
                      · {r.clinic_name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        {/* FAQs */}
        <FaqAccordion faqs={service.faqs} entityName={service.name} />
      </div>

      <Footer />
    </main>
  );
}
