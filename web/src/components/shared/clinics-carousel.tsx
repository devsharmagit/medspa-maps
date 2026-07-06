"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, BadgeCheck, Star, CalendarDays, MapPin, ArrowLeft, Globe, LocateFixed, MapPinOff } from "lucide-react";

import { useLocation } from "@/lib/location/location-context";
import { toStateCode } from "@/lib/location/states";

export interface SharedClinicData {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  website: string | null;
  booking_url: string | null;
  avg_rating: string | null;
  review_count: number;
  verified: boolean;
  featured: boolean;
  lat?: string | number | null;
  lng?: string | number | null;
  distance_km?: number | null;
  cover_image?: string | null;
  images?: { source_url: string; role: string; sort_order: number }[];
  /** Viewer-relative distance in miles, computed client-side. Internal. */
  _distanceMi?: number | null;
}

/** Haversine distance in MILES between two lat/lng points. */
function milesBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatMiles(miles: number): string {
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi away`;
}

/** Original desktop card — cover + thumbnails + book button (+ location/distance). */
function DesktopClinicCard({ c }: { c: SharedClinicData }) {
  const bookUrl = c.booking_url || c.website;
  const coverImageSrc = c.cover_image || (c.images?.find((img) => img.role === "cover") || c.images?.[0])?.source_url;
  const thumbnails = c.images?.filter((img) => img.source_url !== coverImageSrc) || [];
  const displayThumbnails = thumbnails.slice(0, 3);
  const hasMoreThumbnails = thumbnails.length > 3;
  const loc = [c.city, c.state].filter(Boolean).join(", ");

  return (
    <div className="flex flex-col overflow-hidden rounded-[18px] border border-[#DEDEDE] bg-white p-6 shadow-[0px_9px_11.1px_rgba(240,223,241,0.6)]">
      <div className="relative mb-3 aspect-[4/3] w-full overflow-hidden rounded-[11px] bg-[#D9D9D9]">
        {coverImageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverImageSrc} alt={c.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="h-full w-full bg-zinc-200" />
        )}
        {c.featured && (
          <span className="absolute left-4 top-4 rounded-[4px] bg-[#D3A845] px-2 py-1 text-[12px] font-semibold uppercase tracking-[0.02em] text-white">
            FEATURED
          </span>
        )}
      </div>

      {displayThumbnails.length > 0 && (
        <div className="mb-6 flex gap-3 h-[88px]">
          {displayThumbnails.map((thumb, idx) => (
            <div key={idx} className="flex-1 overflow-hidden rounded-[8px] bg-zinc-100 relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumb.source_url} alt="" className="w-full h-full object-cover" loading="lazy" />
              {idx === 2 && hasMoreThumbnails && (
                <div className="absolute inset-0 bg-black/40 z-10 flex items-center justify-center">
                  <span className="text-[20px] font-semibold text-white">+{thumbnails.length - 2}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col flex-1 justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 max-w-[200px]">
              <h3 className="text-[20px] font-medium leading-[116%] text-[#383838] truncate">{c.name}</h3>
              {c.verified && <BadgeCheck className="size-[18px] shrink-0 fill-[#CF5D9A] text-white" />}
            </div>
            {c.avg_rating != null && c.review_count > 0 && (
              <div className="flex items-center gap-1.5 text-[12px] text-[#727272]">
                <span>{c.avg_rating}</span>
                <Star className="size-4 fill-[#FFBA19] text-[#FFBA19]" />
                <span className="opacity-90">({c.review_count})</span>
              </div>
            )}
          </div>
          {(loc || c._distanceMi != null) && (
            <div className="flex items-center gap-2 text-[13px] text-[#727272]">
              <MapPin className="size-3.5 shrink-0 text-[#EE97C6]" />
              {loc && <span className="truncate">{loc}</span>}
              {c._distanceMi != null && (
                <span className="text-[#9A9A9A] whitespace-nowrap">· {formatMiles(c._distanceMi)}</span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end">
          {bookUrl ? (
            <a href={bookUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-gradient-to-r from-[#DE7F4C] to-[#C341D7] px-6 py-[10px] text-[14px] font-semibold text-white shadow-sm transition hover:opacity-95 h-[48px]">
              Book Appointment <CalendarDays className="size-[20px]" />
            </a>
          ) : (
            <Link href={`/clinics/${c.slug}`} className="inline-flex items-center justify-center gap-2 rounded-[8px] border border-[#E3CED8] px-6 py-[10px] text-[14px] font-semibold text-[#CF5B9D] transition hover:bg-pink-50 h-[48px]">
              View Clinic
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/** Mobile card — clean Zomato/Swiggy-style: one cover image, rating pill, book. */
function MobileClinicCard({ c }: { c: SharedClinicData }) {
  const bookUrl = c.booking_url || c.website;
  // Always use the clinic's cover image only — never a random gallery photo.
  const coverImageSrc = c.cover_image || c.images?.find((img) => img.role === "cover")?.source_url;
  const loc = [c.city, c.state].filter(Boolean).join(", ");
  const href = `/clinics/${c.slug}`;

  return (
    <div className="group flex flex-col overflow-hidden rounded-[18px] border border-[#ECE6EC] bg-white shadow-[0px_6px_14px_rgba(170,78,179,0.06)]">
      <Link href={href} className="relative block aspect-[16/11] w-full overflow-hidden bg-[#F1EAF1]">
        {coverImageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverImageSrc} alt={c.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#d96f8e]/20 to-[#9b3a9b]/20 text-3xl font-semibold text-white/70">
            {c.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent" />
        {c.featured && (
          <span className="absolute left-3 top-3 rounded-[6px] bg-[#D3A845] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-white shadow">
            Featured
          </span>
        )}
        {c.avg_rating != null && c.review_count > 0 && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-lg bg-white/95 px-2 py-1 text-[13px] font-semibold text-[#1a1a1a] shadow-sm">
            <Star className="size-3.5 fill-[#FFBA19] text-[#FFBA19]" />
            {c.avg_rating}
            <span className="font-normal text-[#9A9A9A]">({c.review_count})</span>
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-1.5">
          <Link href={href} className="min-w-0">
            <h3 className="line-clamp-1 text-[18px] font-medium leading-[120%] text-[#383838]">{c.name}</h3>
          </Link>
          {c.verified && <BadgeCheck className="mt-0.5 size-[18px] shrink-0 fill-[#CF5D9A] text-white" />}
        </div>

        {(loc || c._distanceMi != null) && (
          <div className="flex items-center gap-1.5 text-[13px] text-[#727272]">
            <MapPin className="size-3.5 shrink-0 text-[#EE97C6]" />
            {loc && <span className="line-clamp-1">{loc}</span>}
            {c._distanceMi != null && (
              <span className="text-[#9A9A9A] whitespace-nowrap">· {formatMiles(c._distanceMi)}</span>
            )}
          </div>
        )}

        {bookUrl ? (
          <a href={bookUrl} target="_blank" rel="noreferrer" className="mt-auto inline-flex h-[46px] items-center justify-center gap-2 rounded-[10px] bg-gradient-to-r from-[#DE7F4C] to-[#C341D7] px-6 text-[14px] font-semibold text-white transition hover:opacity-95">
            Book Appointment <CalendarDays className="size-[18px]" />
          </a>
        ) : (
          <Link href={href} className="mt-auto inline-flex h-[46px] items-center justify-center gap-2 rounded-[10px] border border-[#E3CED8] px-6 text-[14px] font-semibold text-[#CF5B9D] transition hover:bg-pink-50">
            View Clinic
          </Link>
        )}
      </div>
    </div>
  );
}

export function ClinicsCarousel({ clinics }: { clinics: SharedClinicData[] }) {
  const { status, location: userLoc, requestLocation } = useLocation();

  // Reuse a stored location if present; prompt once otherwise (provider guards
  // against re-prompting). Lets us sort by distance for returning US visitors.
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // Distance features are USA-only and require a resolved position.
  const inUS = Boolean(
    status === "granted" &&
      userLoc &&
      !userLoc.outsideUS &&
      userLoc.lat != null &&
      userLoc.lng != null,
  );
  const outsideUS = status === "granted" && Boolean(userLoc?.outsideUS);

  // For a US visitor, show ONLY the clinics in their state (fall back to all
  // U.S. clinics if we don't know their state, or none exist there yet).
  const userStateCode = inUS ? userLoc!.stateCode : null;
  const stateName = inUS ? userLoc!.stateName ?? userStateCode : null;
  const stateClinics = useMemo(
    () =>
      userStateCode
        ? clinics.filter((c) => toStateCode(c.state) === userStateCode)
        : [],
    [clinics, userStateCode],
  );
  const usingStateFilter = Boolean(userStateCode && stateClinics.length > 0);
  const baseClinics = usingStateFilter ? stateClinics : clinics;

  const [sortBy, setSortBy] = useState<"Distance" | "Rating">("Distance");
  const [currentPage, setCurrentPage] = useState(1);
  const [mobileVisible, setMobileVisible] = useState(6);
  const itemsPerPage = 3;

  // Outside the US (or with no position) we can't sort by distance.
  const effectiveSort: "Distance" | "Rating" = inUS ? sortBy : "Rating";

  // Attach a viewer-relative distance to each clinic (US visitors only).
  const clinicsWithDistance = useMemo<SharedClinicData[]>(() => {
    return baseClinics.map((c) => {
      let _distanceMi: number | null = null;
      if (inUS && c.lat != null && c.lng != null) {
        const la = Number(c.lat);
        const lo = Number(c.lng);
        if (Number.isFinite(la) && Number.isFinite(lo)) {
          _distanceMi = milesBetween(userLoc!.lat, userLoc!.lng, la, lo);
        }
      }
      return { ...c, _distanceMi };
    });
  }, [baseClinics, inUS, userLoc]);

  const sortedClinics = useMemo(() => {
    return [...clinicsWithDistance].sort((a, b) => {
      // Featured always first.
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      if (effectiveSort === "Distance") {
        const ad = a._distanceMi;
        const bd = b._distanceMi;
        if (ad == null && bd == null) {
          const ar = Number(a.avg_rating) || 0;
          const br = Number(b.avg_rating) || 0;
          if (ar !== br) return br - ar;
          return (b.review_count || 0) - (a.review_count || 0);
        }
        if (ad == null) return 1;
        if (bd == null) return -1;
        return ad - bd;
      }
      const ar = Number(a.avg_rating) || 0;
      const br = Number(b.avg_rating) || 0;
      if (ar !== br) return br - ar;
      return (b.review_count || 0) - (a.review_count || 0);
    });
  }, [clinicsWithDistance, effectiveSort]);

  const totalPages = Math.ceil(sortedClinics.length / itemsPerPage) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const currentClinics = sortedClinics.slice(
    (safePage - 1) * itemsPerPage,
    safePage * itemsPerPage
  );

  if (sortedClinics.length === 0) return null;

  return (
    <section className="mt-16 sm:mt-[100px]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[26px] sm:text-[34px] font-normal leading-[116%] tracking-[-0.04em] text-[#373634]">
            {usingStateFilter ? (
              <>Clinics in <span className="font-fraunces italic font-normal">{stateName}</span></>
            ) : (
              <>Top-Rated <span className="font-fraunces italic font-normal">US Clinics</span></>
            )}
          </h2>
          <p className="mt-2 text-[16px] sm:text-[20px] font-normal leading-[116%] text-[#373634] capitalize">
            {sortedClinics.length} Clinics Found
          </p>

          {/* Location-aware note — one line covering every case. */}
          {usingStateFilter ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-[#9A7B94]">
              <LocateFixed className="size-3.5 text-[#CF5D9A]" />
              Showing clinics in {stateName}.
            </p>
          ) : inUS ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-[#9A7B94]">
              <MapPin className="size-3.5 text-[#CF5D9A]" />
              No clinics in {stateName ?? "your state"} yet — showing top-rated U.S. clinics.
            </p>
          ) : outsideUS ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-[#9A7B94]">
              <Globe className="size-3.5 text-[#CF5D9A]" />
              You&apos;re outside the USA — we list U.S. clinics only. Browse top-rated U.S. clinics below.
            </p>
          ) : status === "denied" ? (
            <p className="mt-2 inline-flex flex-wrap items-center gap-1.5 text-[13px] text-[#9A7B94]">
              <MapPinOff className="size-3.5 text-[#CF5D9A]" />
              Share your location to see clinics in your state.
              <button
                onClick={() => requestLocation({ force: true })}
                className="font-semibold text-[#CF5D9A] underline underline-offset-2 transition hover:opacity-80"
              >
                Use my location
              </button>
            </p>
          ) : status === "unavailable" ? (
            <p className="mt-2 inline-flex flex-wrap items-center gap-1.5 text-[13px] text-[#9A7B94]">
              <MapPinOff className="size-3.5 text-[#CF5D9A]" />
              Couldn&apos;t get your location — showing top-rated U.S. clinics.
              <button
                onClick={() => requestLocation({ force: true })}
                className="font-semibold text-[#CF5D9A] underline underline-offset-2 transition hover:opacity-80"
              >
                Try again
              </button>
            </p>
          ) : (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-[#9A7B94]">
              <LocateFixed className="size-3.5 animate-pulse text-[#CF5D9A]" />
              Detecting your location…
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[14px] text-[#9A9A9A]" style={{ fontFamily: "var(--font-inter), sans-serif" }}>Sorted by:</span>
          <div className="relative">
            <select
              value={effectiveSort}
              disabled={!inUS}
              title={inUS ? undefined : "Distance sorting is available for USA locations only"}
              onChange={(e) => {
                setSortBy(e.target.value as "Distance" | "Rating");
                setCurrentPage(1);
                setMobileVisible(6);
              }}
              className="appearance-none flex items-center justify-between rounded-[4px] border border-[#D2C3D3] bg-white px-5 py-2 pr-10 min-w-[150px] text-[14px] text-[#727272] outline-none shadow-sm enabled:cursor-pointer disabled:cursor-not-allowed disabled:bg-[#F4F0F4] disabled:text-[#B7A9B7]"
            >
              <option value="Distance" disabled={!inUS}>
                Distance{inUS ? "" : " (USA only)"}
              </option>
              <option value="Rating">Rating</option>
            </select>
            <ChevronDown className="size-4 text-[#353535] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ── Mobile: clean card list, batched with Load More ── */}
      <div className="mt-8 lg:hidden">
        <div className="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2">
          {sortedClinics.slice(0, mobileVisible).map((c) => (
            <MobileClinicCard key={c.id} c={c} />
          ))}
        </div>
        {mobileVisible < sortedClinics.length && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => setMobileVisible((v) => v + 6)}
              className="inline-flex items-center gap-2 rounded-full border border-[#E3CED8] bg-white px-6 py-3 text-sm font-semibold text-[#CF5B9D] shadow-sm transition hover:bg-pink-50"
            >
              Load More ({sortedClinics.length - mobileVisible})
            </button>
          </div>
        )}
      </div>

      {/* ── Desktop: original paginated grid ── */}
      <div className="hidden lg:block">
        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          {currentClinics.map((c) => (
            <DesktopClinicCard key={c.id} c={c} />
          ))}
        </div>

        {totalPages > 1 && (
          <div className="mt-12 flex items-center justify-center gap-3">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="flex h-[50px] w-[98px] items-center justify-end pr-4 rounded-r-full bg-gradient-to-r from-transparent to-white text-[#815E42] hover:bg-zinc-50 rotate-180 origin-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="size-[17px] rotate-180" />
            </button>
            <div className="flex gap-[12.5px] flex-wrap justify-center">
              {Array.from({ length: totalPages }).map((_, i) => {
                const pageNum = i + 1;
                const isActive = pageNum === safePage;
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
              disabled={safePage === totalPages}
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
