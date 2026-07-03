"use client";

import { useState, useMemo } from "react";
import { ChevronDown, BadgeCheck, Star, ArrowLeft } from "lucide-react";
import Link from "next/link";

export interface SharedProviderData {
  id: string;
  name: string;
  title: string | null;
  bio?: string | null;
  card_tagline?: string | null;
  image_url: string | null;
  years_experience: number | null;
  is_verified?: boolean;
  clinic_slug?: string;
  clinic_name: string;
  featured?: boolean;
  verified?: boolean;
  distance_km?: number | null;
  avg_rating: string | null;
  review_rating?: string | null;
  review_count?: number;
}

const DEFAULT_PHOTO =
  "https://images.stockcake.com/public/1/9/d/19d13828-c999-4e2d-a191-9da4dd8bd824_large/confident-medical-professional-stockcake.jpg";

function providerHref(p: SharedProviderData) {
  return `/providers/${p.id}/${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}
function providerTagline(p: SharedProviderData) {
  return p.card_tagline?.trim() || (p.bio ? p.bio.split(". ")[0] + "." : "");
}

/** Original desktop card (unchanged) — 50/50 photo + info split. */
function DesktopProviderCard({ p }: { p: SharedProviderData }) {
  const tagline = providerTagline(p);
  const rating = p.review_rating ?? p.avg_rating;

  return (
    <div className="flex bg-white shadow-[0px_6px_10.5px_1px_rgba(0,0,0,0.05)] rounded-[22px] overflow-hidden">
      <div className="w-1/2 relative bg-zinc-100 min-h-[340px]">
        {p.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image_url} alt={p.name} className="absolute inset-0 w-full h-full object-cover" />
        )}
      </div>

      <div className="w-1/2 p-6 flex flex-col justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-[18px] font-medium leading-[116%] tracking-[0.02em] text-[#383838]">{p.name}</h3>
            {p.is_verified && (
              <div className="relative w-5 h-5 flex items-center justify-center bg-[#CF5D9A] rounded-full text-white flex-shrink-0">
                <BadgeCheck className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
          {p.title && <p className="text-[14px] leading-[138%] tracking-[0.02em] text-[#727272]">{p.title}</p>}
        </div>

        <hr className="border-t border-[#DDC3DF] my-4" />

        <div className="flex flex-col gap-3 flex-1">
          {p.years_experience != null && (
            <p className="text-[12px] font-semibold leading-[130%] tracking-[0.02em] uppercase text-[#616161]">
              {p.years_experience}+ years of Experience
            </p>
          )}
          <p className="text-[11px] leading-[138%] tracking-[0.02em] text-[#727272] line-clamp-4">{tagline}</p>
          {rating && (
            <div className="flex items-center gap-1 mt-auto">
              <span className="text-[11px] leading-[138%] tracking-[0.02em] text-[#727272]">Customer Rating</span>
              <Star className="w-3.5 h-3.5 fill-[#FFBA19] text-[#FFBA19]" />
              <span className="text-[12px] font-semibold leading-[130%] tracking-[0.02em] uppercase text-[#616161]">{rating}</span>
              {p.review_count ? <span className="text-[11px] leading-[138%] tracking-[0.02em] text-[#9A9A9A]">({p.review_count})</span> : null}
            </div>
          )}
        </div>

        <Link href={providerHref(p)} className="mt-4 flex items-center justify-center w-full py-2.5 bg-gradient-to-r from-[#DE7F4C] to-[#C341D7] rounded-[8px] text-[14px] font-semibold text-white transition hover:opacity-95">
          View Profile
        </Link>
      </div>
    </div>
  );
}

/** Mobile card — matches the landing "Providers Spotlight" card. */
function MobileProviderCard({ p }: { p: SharedProviderData }) {
  const tagline = providerTagline(p);
  const rating = p.review_rating ?? p.avg_rating;

  return (
    <div className="flex min-h-[320px] overflow-hidden rounded-[22px] border border-[#DEDEDE] bg-white shadow-[0px_6px_10.5px_1px_rgba(0,0,0,0.05)]">
      {/* Photo — left */}
      <div className="relative w-[150px] min-[420px]:w-[168px] shrink-0 bg-zinc-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.image_url || DEFAULT_PHOTO} alt={p.name} className="absolute inset-0 h-full w-full object-cover object-top" />
      </div>

      {/* Info — right */}
      <div className="flex flex-1 flex-col justify-between gap-4 p-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <h3 className="text-[18px] font-medium leading-[116%] tracking-[0.02em] text-[#383838]">{p.name}</h3>
              {p.is_verified && <BadgeCheck className="size-[18px] shrink-0 fill-[#CF5D9A] text-white" />}
            </div>
            {p.title && <span className="text-[14px] leading-[138%] tracking-[0.02em] text-[#727272]">{p.title}</span>}
          </div>

          <div className="h-px w-full bg-[#DDC3DF]" />

          <div className="flex flex-col gap-2.5">
            {p.years_experience != null && (
              <p className="text-[12px] font-semibold uppercase leading-[130%] tracking-[0.02em] text-[#616161]">
                {p.years_experience}+ years of Experience
              </p>
            )}
            {tagline && <p className="text-[11px] leading-[138%] tracking-[0.02em] text-[#727272] line-clamp-3">{tagline}</p>}
            {rating && (
              <div className="flex items-center gap-1">
                <span className="text-[11px] leading-[138%] tracking-[0.02em] text-[#727272]">Customer Rating</span>
                <Star className="size-3.5 fill-[#FFBA19] text-[#FFBA19]" />
                <span className="text-[12px] font-semibold uppercase leading-[130%] tracking-[0.02em] text-[#616161]">{rating}</span>
                {p.review_count ? <span className="text-[11px] leading-[138%] tracking-[0.02em] text-[#9A9A9A]">({p.review_count})</span> : null}
              </div>
            )}
          </div>
        </div>

        <Link href={providerHref(p)} className="flex h-10 w-full items-center justify-center rounded-lg bg-[linear-gradient(90deg,#DE7F4C_0%,#C341D7_100%)] text-[14px] font-semibold text-white transition-opacity hover:opacity-90">
          View Profile
        </Link>
      </div>
    </div>
  );
}

export function ProvidersCarousel({ providers }: { providers: SharedProviderData[] }) {
  const [sortBy, setSortBy] = useState<"Distance" | "Rating">("Distance");
  const [currentPage, setCurrentPage] = useState(1);
  const [mobileVisible, setMobileVisible] = useState(6);
  const itemsPerPage = 3;

  const sortedProviders = useMemo(() => {
    return [...providers].sort((a, b) => {
      if (sortBy === "Distance") {
        if (a.distance_km == null && b.distance_km == null) {
          const ar = Number(a.avg_rating) || 0;
          const br = Number(b.avg_rating) || 0;
          if (ar !== br) return br - ar;
          return (b.review_count || 0) - (a.review_count || 0);
        }
        if (a.distance_km == null) return 1;
        if (b.distance_km == null) return -1;
        return a.distance_km - b.distance_km;
      } else {
        const ar = Number(a.avg_rating) || 0;
        const br = Number(b.avg_rating) || 0;
        if (ar !== br) return br - ar;
        return (b.review_count || 0) - (a.review_count || 0);
      }
    });
  }, [providers, sortBy]);

  const totalPages = Math.ceil(sortedProviders.length / itemsPerPage) || 1;
  const currentProviders = sortedProviders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (providers.length === 0) return null;

  return (
    <section className="mt-16 sm:mt-[100px]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-[26px] sm:text-[34px] font-normal leading-[116%] tracking-[-0.04em] text-[#373634]">
            Doctors & <span className="font-fraunces italic font-normal">Providers</span>
          </h2>
          <p className="mt-2 text-[16px] sm:text-[20px] font-normal leading-[116%] text-[#373634] capitalize">
            {sortedProviders.length} providers found
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[14px] text-[#9A9A9A]" style={{ fontFamily: "var(--font-inter), sans-serif" }}>Sorted by:</span>
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as "Distance" | "Rating");
                setCurrentPage(1);
                setMobileVisible(6);
              }}
              className="appearance-none cursor-pointer flex items-center justify-between rounded-[4px] border border-[#D2C3D3] bg-white px-5 py-2 pr-10 min-w-[150px] text-[14px] text-[#727272] outline-none shadow-sm"
            >
              <option value="Distance">Distance</option>
              <option value="Rating">Rating</option>
            </select>
            <ChevronDown className="size-4 text-[#353535] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ── Mobile: spotlight-style cards, batched with Load More ── */}
      <div className="lg:hidden">
        <div className="grid grid-cols-1 gap-5">
          {sortedProviders.slice(0, mobileVisible).map((p) => (
            <MobileProviderCard key={p.id} p={p} />
          ))}
        </div>
        {mobileVisible < sortedProviders.length && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => setMobileVisible((v) => v + 6)}
              className="inline-flex items-center gap-2 rounded-full border border-[#E3CED8] bg-white px-6 py-3 text-sm font-semibold text-[#CF5B9D] shadow-sm transition hover:bg-pink-50"
            >
              Load More ({sortedProviders.length - mobileVisible})
            </button>
          </div>
        )}
      </div>

      {/* ── Desktop: original paginated grid (unchanged) ── */}
      <div className="hidden lg:block">
        <div className="grid gap-8 lg:grid-cols-3">
          {currentProviders.map((p) => (
            <DesktopProviderCard key={p.id} p={p} />
          ))}
        </div>

        {totalPages > 1 && (
          <div className="mt-12 flex items-center justify-center gap-3">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex h-[50px] w-[98px] items-center justify-end pr-4 rounded-r-full bg-gradient-to-r from-transparent to-white text-[#815E42] hover:bg-zinc-50 rotate-180 origin-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="size-[17px] rotate-180" />
            </button>
            <div className="flex gap-[12.5px] flex-wrap justify-center">
              {Array.from({ length: totalPages }).map((_, i) => {
                const pageNum = i + 1;
                const isActive = pageNum === currentPage;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`flex h-[50px] w-[50px] items-center justify-center rounded-[12.5px] text-[14px] font-medium shadow-[0px_4px_8px_rgba(0,0,0,0.05)] transition ${
                      isActive
                        ? "bg-[#CF5D9A] text-white hover:bg-[#b54a83]"
                        : "bg-white text-[#616161] hover:bg-zinc-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex h-[50px] w-[98px] items-center justify-end pr-4 rounded-r-full bg-gradient-to-r from-transparent to-white text-[#815E42] hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="size-[17px] rotate-180" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
