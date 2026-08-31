"use client";

import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import { useEffect, useState } from "react";

import type { ClinicResult } from "@/components/shared/clinic-card";
import { Button } from "@/components/ui/button";
import { toStateCode } from "@/lib/location/states";

/**
 * Sidebar widget: a few top practices that offer the article's treatment, plus
 * a button into the full search. The article page itself is static (SSG), so we
 * fetch the practices CLIENT-side from /api/search — the same engine the
 * /search page uses — rather than baking (stale) clinic data at build time.
 *
 * `apiQuery` is the query string from the post's CTA href (e.g.
 * "q=laser-skin-resurfacing" or "condition=hyperpigmentation").
 */
export function TreatmentPractices({
  apiQuery,
  searchHref,
  ctaLabel,
}: {
  apiQuery: string;
  searchHref: string;
  ctaLabel: string;
}) {
  const [status, setStatus] = useState<"loading" | "done">("loading");
  const [clinics, setClinics] = useState<ClinicResult[]>([]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(apiQuery);
    params.set("limit", "3");

    fetch(`/api/search?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("search failed"))))
      .then((data: { results?: ClinicResult[] }) => {
        if (!active) return;
        setClinics(Array.isArray(data.results) ? data.results.slice(0, 3) : []);
        setStatus("done");
      })
      .catch(() => {
        if (active) setStatus("done");
      });

    return () => {
      active = false;
    };
  }, [apiQuery]);

  return (
    <section className="rounded-[18px] border border-[#F0E2EC] bg-white p-5 shadow-[0px_8px_14px_rgba(0,0,0,0.02)]">
      <h2 className="font-montserrat text-[13px] font-semibold uppercase tracking-[0.1em] text-[#AC467B]">
        Practices offering this treatment
      </h2>

      <div className="mt-4 flex flex-col gap-3">
        {status === "loading" &&
          [0, 1, 2].map((i) => (
            <div key={i} className="h-[58px] animate-pulse rounded-lg bg-[#F5EEF5]" />
          ))}

        {status === "done" &&
          clinics.map((clinic) => <MiniPractice key={clinic.clinic_id} clinic={clinic} />)}

        {status === "done" && clinics.length === 0 && (
          <p className="font-montserrat text-[13px] leading-[1.5] text-zinc-500">
            Browse qualified, vetted practices near you and compare reviews.
          </p>
        )}
      </div>

      <Button
        asChild
        variant="gradient"
        className="mt-5 h-auto min-h-[46px] w-full gap-2 whitespace-normal rounded-xl px-4 py-2.5 text-center text-[13px] font-semibold leading-snug"
      >
        <Link href={searchHref}>
          <MapPin className="size-4 shrink-0" aria-hidden />
          <span>{ctaLabel}</span>
        </Link>
      </Button>
    </section>
  );
}

function MiniPractice({ clinic }: { clinic: ClinicResult }) {
  const cover = clinic.gallery_images?.[0] ?? clinic.cover_image_url ?? null;
  const ratingRaw = clinic.avg_rating ?? clinic.ext_rating;
  const ratingValue = ratingRaw != null ? Number(ratingRaw) : null;
  const stateCode = toStateCode(clinic.state) ?? clinic.state;
  const city = (clinic.city || "").replace(/[,\s]+$/, "");
  const initials = clinic.clinic_name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2);

  return (
    <a href={`/practices/${clinic.clinic_slug}`} className="group flex gap-3">
      <div className="relative h-[58px] w-[68px] shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-brand-coral/20 to-brand-purple/20">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={clinic.clinic_name} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-sm font-semibold text-white/70">
            {initials}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <h3 className="line-clamp-1 font-montserrat text-[13.5px] font-semibold text-[#373634] transition-colors group-hover:text-[#CF5B9D]">
          {clinic.clinic_name}
        </h3>
        <div className="mt-1 flex items-center gap-2.5 font-montserrat text-[11px] text-zinc-500">
          {city && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="size-3 shrink-0 text-brand-magenta/60" aria-hidden />
              <span className="line-clamp-1">
                {city}
                {stateCode ? `, ${stateCode}` : ""}
              </span>
            </span>
          )}
          {ratingValue != null && (
            <span className="inline-flex shrink-0 items-center gap-1">
              <Star className="size-3 fill-[#FFBA19] text-[#FFBA19]" aria-hidden />
              {ratingValue.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </a>
  );
}
