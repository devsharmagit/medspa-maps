"use client";

import { useState, useMemo } from "react";
import { BadgeCheck, ArrowLeft } from "lucide-react";
import Link from "next/link";

export interface SharedProviderData {
  id: string;
  name: string;
  title: string | null;
  card_tagline?: string | null;
  image_url: string | null;
  is_verified?: boolean;
  clinic_slug?: string;
  clinic_name: string;
  distance_km?: number | null;
}

const DEFAULT_PHOTO =
  "https://images.stockcake.com/public/1/9/d/19d13828-c999-4e2d-a191-9da4dd8bd824_large/confident-medical-professional-stockcake.jpg";

function providerTagline(p: SharedProviderData) {
  return p.card_tagline?.trim() || "";
}

/** Wrap a card in a link to its clinic when a slug is available, else render static. */
function CardShell({
  p,
  className,
  style,
  children,
}: {
  p: SharedProviderData;
  className: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  if (p.clinic_slug) {
    return (
      <Link href={`/clinics/${p.clinic_slug}`} className={className} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}

/** Original desktop card — updated for better 1024px responsiveness. */
function DesktopProviderCard({ p }: { p: SharedProviderData }) {
  const tagline = providerTagline(p);

  return (
    <div className="flex bg-white shadow-[0px_6px_10.5px_1px_rgba(0,0,0,0.05)] rounded-[22px] overflow-hidden h-full">
      <div className="relative w-[130px] xl:w-[150px] shrink-0 bg-zinc-100 min-h-[300px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.image_url || DEFAULT_PHOTO} alt={p.name} className="absolute inset-0 w-full h-full object-cover object-top" />
      </div>

      <div className="flex-1 min-w-0 p-4 xl:p-5 flex flex-col justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="text-[18px] font-medium leading-[116%] tracking-[0.02em] text-[#383838] truncate">{p.name}</h3>
            {p.is_verified && (
              <div className="relative w-4 h-4 flex items-center justify-center bg-[#CF5D9A] rounded-full text-white shrink-0">
                <BadgeCheck className="w-3 h-3" />
              </div>
            )}
          </div>
          {p.title && <p className="text-[14px] leading-[138%] tracking-[0.02em] text-[#727272] line-clamp-2">{p.title}</p>}
        </div>

        <hr className="border-t border-[#DDC3DF] my-3" />

        <div className="flex flex-col gap-2.5 flex-1">
          {tagline && <p className="text-[11px] leading-[138%] tracking-[0.02em] text-[#727272] line-clamp-3">{tagline}</p>}
        </div>

        {p.clinic_slug && (
          <Link href={`/clinics/${p.clinic_slug}`} className="mt-4 flex items-center justify-center w-full py-2.5 bg-gradient-to-r from-[#DE7F4C] to-[#C341D7] rounded-[8px] text-[14px] font-semibold text-white transition hover:opacity-95">
            View Clinic
          </Link>
        )}
      </div>
    </div>
  );
}

/** Mobile card — matches the landing "Providers Spotlight" card. */
function MobileProviderCard({ p }: { p: SharedProviderData }) {
  const tagline = providerTagline(p);

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
            {tagline && <p className="text-[11px] leading-[138%] tracking-[0.02em] text-[#727272] line-clamp-3">{tagline}</p>}
          </div>
        </div>

        {p.clinic_slug && (
          <Link href={`/clinics/${p.clinic_slug}`} className="flex h-10 w-full items-center justify-center rounded-lg bg-[linear-gradient(90deg,#DE7F4C_0%,#C341D7_100%)] text-[14px] font-semibold text-white transition-opacity hover:opacity-90">
            View Clinic
          </Link>
        )}
      </div>
    </div>
  );
}

export function ProvidersCarousel({ providers }: { providers: SharedProviderData[] }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [mobileVisible, setMobileVisible] = useState(6);
  const itemsPerPage = 3;

  const sortedProviders = useMemo(() => {
    return [...providers].sort((a, b) => {
      if (a.distance_km == null && b.distance_km == null) return 0;
      if (a.distance_km == null) return 1;
      if (b.distance_km == null) return -1;
      return a.distance_km - b.distance_km;
    });
  }, [providers]);

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
      </div>

      {/* ── Mobile: spotlight-style cards, batched with Load More ── */}
      <div className="lg:hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
