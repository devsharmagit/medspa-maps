"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, MapPin, BadgeCheck, ChevronLeft, ChevronRight } from "lucide-react";
import type { ConcernPageData } from "@/lib/concerns/queries";

const TABS = ["Overview", "Clinics & Diagnosis", "Doctors & Providers"] as const;
type Tab = (typeof TABS)[number];

// Card layout mirrors the concern-page design: a left column of stacked
// labelled paragraphs and a right grid of detail cards.
const LEFT_FIELDS: { key: string; label: string }[] = [
  { key: "signs", label: "Signs" },
  { key: "causes", label: "Causes" },
  { key: "candidate", label: "Who Is a Candidate?" },
  { key: "results", label: "Expected Results" },
];
const CARD_FIELDS: { key: string; label: string }[] = [
  { key: "treatment_areas", label: "Common Treatment Areas" },
  { key: "injectables", label: "Injectable Treatments" },
  { key: "benefits", label: "Benefits" },
  { key: "prevention", label: "Preventative Care" },
];

// ─── Verified badge — pink checkmark circle (mirrors ProvidersSpotlight) ───────
function VerifiedBadge() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
        stroke="#CF5D9A"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

const PROVIDER_DEFAULT_PHOTO =
  "https://images.stockcake.com/public/1/9/d/19d13828-c999-4e2d-a191-9da4dd8bd824_large/confident-medical-professional-stockcake.jpg";

function providerHref(p: { id: string; name: string }) {
  return `/providers/${p.id}/${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

// ─── ProviderCard — visual style mirrors hero/providers-spotlight.tsx ──────────
function ProviderCard({
  provider,
}: {
  provider: ConcernPageData["providers"][number];
}) {
  const years = provider.years_experience ?? 10;
  return (
    <div
      className="flex min-h-[341px] w-[360px] shrink-0 snap-start self-stretch overflow-hidden rounded-[22px] border border-[#DEDEDE] bg-white"
      style={{ boxShadow: "0px 6px 10.5px 1px rgba(0,0,0,0.05)" }}
    >
      {/* ── Photo — left half ── */}
      <div className="relative w-1/2 shrink-0 bg-slate-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={provider.image_url || PROVIDER_DEFAULT_PHOTO}
          alt={provider.name}
          className="h-full w-full object-cover object-top"
        />
      </div>

      {/* ── Info — right half ── */}
      <div className="flex h-full w-1/2 flex-col items-start justify-between bg-white px-6 py-7 gap-[20px]">
        <div className="flex w-full flex-col gap-[20px]">
          {/* Name + badge + title */}
          <div className="flex flex-col gap-2">
            <div className="flex gap-1">
              <h3 className="font-montserrat text-[18px] font-medium leading-[116.02%] tracking-[0.02em] text-[#383838]">
                {provider.name}
              </h3>
              {provider.is_verified && <VerifiedBadge />}
            </div>
            <span className="font-montserrat text-[14px] leading-[138%] tracking-[0.02em] text-[#727272]">
              {provider.title || "Aesthetic Specialist"}
            </span>
          </div>

          {/* Divider */}
          <div className="h-px w-full bg-[#DDC3DF]" />

          {/* Experience + clinic + rating */}
          <div className="flex flex-col gap-3">
            <p className="font-montserrat text-[12px] font-semibold uppercase leading-[130%] tracking-[0.02em] text-[#616161]">
              {years}+ Years of Experience
            </p>
            <p className="font-montserrat text-[11px] leading-[138%] tracking-[0.02em] text-[#727272]">
              {provider.clinic_name}
            </p>
            <div className="flex items-center gap-1">
              <span className="font-montserrat text-[11px] leading-[138%] tracking-[0.02em] text-[#727272]">
                Customer Rating
              </span>
              <span className="font-inter text-[13px] font-medium leading-[21px] text-[#FFBA19]">
                ★
              </span>
              <span className="font-montserrat text-[12px] font-semibold uppercase leading-[130%] tracking-[0.02em] text-[#616161]">
                {provider.avg_rating ? Number(provider.avg_rating).toFixed(1) : "5.0"}
              </span>
            </div>
          </div>
        </div>

        {/* View Profile button — full width gradient */}
        <Link
          href={providerHref(provider)}
          className="mt-4 flex h-10 w-full shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(90deg,#DE7F4C_0%,#C341D7_100%)] font-montserrat text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          View Profile
        </Link>
      </div>
    </div>
  );
}

// ─── DoctorsSlider — horizontal scroller with prev/next arrows ────────────────
function DoctorsSlider({
  providers,
}: {
  providers: ConcernPageData["providers"];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -388 : 388, behavior: "smooth" });
  };

  return (
    <div className="relative">
      {/* Nav arrows — hidden when everything fits on one screen on small lists */}
      {providers.length > 1 && (
        <div className="mb-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => scroll("left")}
            aria-label="Previous providers"
            className="flex size-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-50"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => scroll("right")}
            aria-label="Next providers"
            className="flex size-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-50"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {providers.map((p) => (
          <ProviderCard key={p.id} provider={p} />
        ))}
      </div>
    </div>
  );
}

export function ConcernTabs({ data }: { data: ConcernPageData }) {
  const [tab, setTab] = useState<Tab>("Overview");
  const { concern, services, clinics, providers } = data;
  const details = concern.details ?? {};

  return (
    <div>
      {/* Tab bar */}
      <div className="flex flex-wrap gap-3">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-xl px-5 py-2.5 text-sm font-medium transition ${
              tab === t
                ? "bg-purple-100 text-purple-900 shadow-sm"
                : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "Overview" && (
          <section className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-9 shadow-sm">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">
              What is {concern.name}?
            </h2>
            {concern.overview && (
              <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-zinc-600">
                {concern.overview}
              </p>
            )}

            <div className="mt-8 grid gap-8 lg:grid-cols-2">
              {/* left stacked fields */}
              <div className="space-y-6">
                {LEFT_FIELDS.filter((f) => details[f.key]).map((f) => (
                  <div key={f.key}>
                    <div className="flex items-center gap-2 text-[15px] font-semibold text-zinc-900">
                      <ArrowRight className="size-4 text-pink-500" />
                      {f.label}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                      {details[f.key]}
                    </p>
                  </div>
                ))}
              </div>

              {/* right card grid */}
              <div className="grid gap-5 sm:grid-cols-2">
                {CARD_FIELDS.filter((f) => details[f.key]).map((f) => (
                  <div
                    key={f.key}
                    className="rounded-2xl border border-zinc-200 p-5 transition hover:shadow-sm"
                  >
                    <h3 className="text-[15px] font-semibold text-zinc-900">
                      {f.label}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                      {details[f.key]}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {services.length > 0 && (
              <div className="mt-9 border-t border-zinc-100 pt-6">
                <h3 className="text-sm font-semibold text-zinc-900">
                  Treatments for {concern.name}
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {services.map((s) => (
                    <Link
                      key={s.id}
                      href={`/treatments/${s.slug}`}
                      className="rounded-full bg-pink-50 px-3.5 py-1.5 text-sm font-medium text-pink-700 ring-1 ring-pink-100 transition hover:bg-pink-100"
                    >
                      {s.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {tab === "Clinics & Diagnosis" && (
          <section>
            {clinics.length === 0 ? (
              <Empty label="No clinics offering these treatments yet." />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {clinics.map((c) => (
                  <div
                    key={c.id}
                    className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
                  >
                    <div className="h-36 w-full bg-zinc-100">
                      {c.cover_image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.cover_image}
                          alt={c.name}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-1.5">
                        <h3 className="truncate font-semibold text-zinc-900">
                          {c.name}
                        </h3>
                        {c.verified && (
                          <BadgeCheck className="size-4 shrink-0 text-pink-500" />
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-sm text-zinc-500">
                        <MapPin className="size-3.5" />
                        {[c.city, c.state].filter(Boolean).join(", ") || "—"}
                      </div>
                      <div className="mt-2 text-sm text-zinc-600">
                        {c.avg_rating
                          ? `★ ${Number(c.avg_rating).toFixed(1)} (${c.review_count})`
                          : "No reviews yet"}
                      </div>
                      {(c.booking_url || c.website) && (
                        <a
                          href={c.booking_url || c.website || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-pink-600 hover:text-pink-700"
                        >
                          View Clinic <ArrowRight className="size-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "Doctors & Providers" && (
          <section>
            {providers.length === 0 ? (
              <Empty label="Provider profiles for this concern are coming soon." />
            ) : (
              <DoctorsSlider providers={providers} />
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-12 text-center text-sm text-zinc-500">
      {label}
    </div>
  );
}
