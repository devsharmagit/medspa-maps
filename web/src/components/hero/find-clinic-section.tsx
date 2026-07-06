"use client";

import { ChevronDown, LocateFixed, MapPin, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { FeaturedClinic } from "@/lib/clinics/featured";
import { useLocation } from "@/lib/location/location-context";
import { toStateCode } from "@/lib/location/states";

// ─── Distance helpers ───────────────────────────────────────────────────────

/** Haversine distance in MILES between two lat/lng points. */
function milesBetween(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3959; // Earth radius in miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatMiles(miles: number): string {
  const v = miles < 10 ? miles.toFixed(1) : String(Math.round(miles));
  return `${v} mi away`;
}

// A clinic with a distance label resolved for the current viewer.
type DisplayClinic = FeaturedClinic & { distanceLabel: string | null };

// ─── Carousel Helpers ─────────────────────────────────────────────────────────

function getOffset(idx: number, current: number, total: number): number {
  let d = idx - current;
  if (d > total / 2) d -= total;
  if (d < -total / 2) d += total;
  return d;
}

// Card is 660px wide. Side cards peek from behind — no Y shift, no skew, no opacity reduction.
// We just scale them down and push them behind the active card.
function getSlotStyle(offset: number) {
  const CARD_W = 660;
  const baseX = -CARD_W / 2;
  const baseY = -250;

  if (offset === 0) {
    return {
      transform: `translateX(${baseX}px) translateY(${baseY}px) translateZ(0px) rotateY(0deg) scale(1)`,
      opacity: 1,
      zIndex: 20,
      pointerEvents: "auto" as const,
      cursor: "default",
    };
  }

  if (Math.abs(offset) === 1) {
    const dir = offset > 0 ? 1 : -1;
    return {
      transform: `translateX(${baseX + dir * 240}px) translateY(${baseY}px) translateZ(-140px) rotateY(${-dir * 26}deg) scale(0.9)`,
      opacity: 0.9,
      zIndex: 14,
      pointerEvents: "auto" as const,
      cursor: "pointer",
    };
  }

  if (Math.abs(offset) === 2) {
    const dir = offset > 0 ? 1 : -1;
    return {
      transform: `translateX(${baseX + dir * 420}px) translateY(${baseY}px) translateZ(-260px) rotateY(${-dir * 40}deg) scale(0.78)`,
      opacity: 0.65,
      zIndex: 8,
      pointerEvents: "auto" as const,
      cursor: "pointer",
    };
  }

  const dir = offset > 0 ? 1 : -1;
  return {
    transform: `translateX(${baseX + dir * 560}px) translateY(${baseY}px) translateZ(-380px) rotateY(${-dir * 54}deg) scale(0.6)`,
    opacity: 0,
    zIndex: 2,
    pointerEvents: "none" as const,
    cursor: "default",
  };
}

// ─── ClinicCard ───────────────────────────────────────────────────────────────

function ClinicCard({ clinic }: { clinic: DisplayClinic }) {
  const stateCode = toStateCode(clinic.state) ?? clinic.state ?? "";
  const cityLabel = (clinic.city || "").replace(/[,\s]+$/, "");
  const location = [cityLabel, stateCode].filter(Boolean).join(", ");
  const initials = clinic.name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const thumbs = clinic.gallery.filter((src) => src !== clinic.coverImage).slice(0, 3);
  const totalGallery = clinic.gallery.filter((src) => src !== clinic.coverImage).length;
  const extra = Math.max(0, totalGallery - thumbs.length);

  const profileUrl = `/clinics/${clinic.slug}`;
  const bookUrl = clinic.bookingUrl || clinic.website || profileUrl;
  const bookExternal = Boolean(clinic.bookingUrl || clinic.website);

  return (
    <div
      className="w-full overflow-hidden rounded-[18px] border-2 border-white bg-white"
      style={{ boxShadow: "0px 4px 21.3px #E2D8E6" }}
    >
      {/* ── Main Image ── */}
      <div className="relative h-[200px] lg:h-[302px] w-full overflow-hidden">
        {clinic.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={clinic.coverImage}
            alt={clinic.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#DE7F4C]/20 to-[#C341D7]/20 text-5xl font-semibold text-white/70">
            {initials}
          </div>
        )}

        {/* Featured badge */}
        {clinic.featured && (
          <div className="absolute left-[22px] top-[23px] rounded bg-[#D3A845] px-[10px] py-1">
            <span className="font-montserrat text-[14px] font-semibold uppercase tracking-[-0.02em] text-white">
              Featured
            </span>
          </div>
        )}
      </div>

      {/* ── Card Body ── */}
      <div className="bg-white px-4 lg:px-[30px] pt-5 pb-5 lg:pt-[24px] lg:pb-[24px]">

        {/* Row 1: Logo + Name/Location  |  Thumbnails */}
        <div className="flex items-start justify-between gap-4">
          {/* Left: logo + text */}
          <div className="flex items-start gap-[11px]">
            {/* Logo */}
            <div className="flex h-[50px] w-[57px] shrink-0 items-center justify-center overflow-hidden rounded-[6px] border border-[#E5E5E5] bg-[#faf5fa]">
              {clinic.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={clinic.logo}
                  alt={`${clinic.name} logo`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="font-montserrat text-[15px] font-semibold text-[#CF5D9A]">
                  {initials}
                </span>
              )}
            </div>

            {/* Name + location */}
            <div className="flex flex-col gap-[4px]">
              <div className="flex items-center gap-[4px]">
                <h3 className="font-montserrat text-[20px] font-medium leading-[116.02%] tracking-[0.02em] text-[#383838] line-clamp-1">
                  {clinic.name}
                </h3>
                {clinic.verified && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0">
                    <path
                      d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                      stroke="#CF5D9A"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              <div className="flex items-center gap-[13px] text-[12px] text-[#727272]">
                {location && (
                  <span className="font-montserrat font-medium tracking-[0.02em] line-clamp-1">
                    {location}
                  </span>
                )}
                {clinic.distanceLabel && (
                  <>
                    <div className="h-[14px] w-px bg-[#DBDBDB]" />
                    <div className="flex items-center gap-[2px]">
                      <MapPin className="h-[13px] w-[13px] text-[#EE97C6]" />
                      <span className="font-montserrat tracking-[0.02em] whitespace-nowrap">
                        {clinic.distanceLabel}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: thumbnails */}
          {thumbs.length > 0 && (
            <div className="hidden lg:flex shrink-0 items-center gap-[9px]">
              {thumbs.map((img, idx) => (
                <div
                  key={idx}
                  className="relative h-[56px] w-[76px] overflow-hidden rounded-[6px]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img}
                    alt={`${clinic.name} gallery ${idx + 1}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  {idx === thumbs.length - 1 && extra > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-[6px] bg-black/40">
                      <span className="font-montserrat text-[14px] font-semibold text-white">
                        +{extra}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Row 2: Rating */}
        {clinic.rating != null && (
          <div className="mt-[14px] flex items-center gap-[6px] text-[12px] text-[#727272]">
            <span className="font-montserrat tracking-[-0.02em]">
              {clinic.rating.toFixed(1)}
            </span>
            <div className="flex items-center gap-[4px]">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-[14px] w-[14px] fill-[#FFBA19] text-[#FFBA19]" />
              ))}
            </div>
            {clinic.reviewCount > 0 && (
              <span className="font-montserrat tracking-[-0.02em]">({clinic.reviewCount})</span>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 lg:flex-row lg:justify-between lg:gap-4">

          {/* Row 3: Treatment tags */}
          <div className="mt-[10px] flex flex-wrap items-center gap-[6px]">
            {clinic.services.slice(0, 5).map((t) => (
              <span
                key={t.slug}
                className="rounded border-[0.5px] border-[#DFDFDF] bg-[#F5F5F5] px-[10px] py-1 font-montserrat text-[12px] tracking-[0.02em] text-[#7F7F7F]"
              >
                {t.name}
              </span>
            ))}
          </div>

          {/* Row 4: CTA buttons */}
          <div className="mt-1 lg:mt-[20px] flex items-center gap-[9px] shrink-0">
            <a
              href={profileUrl}
              className="flex h-[43px] flex-1 lg:w-[120px] lg:flex-none items-center justify-center rounded-lg border border-[#CF5B9D] font-montserrat text-[14px] font-semibold text-[#CF5B9D] transition-colors hover:bg-pink-50"
            >
              View Profile
            </a>
            <a
              href={bookUrl}
              {...(bookExternal ? { target: "_blank", rel: "noreferrer" } : {})}
              className="flex h-[43px] flex-1 lg:w-[127px] lg:flex-none items-center justify-center rounded-lg bg-[linear-gradient(90deg,#DE7F4C_0%,#C341D7_100%)] font-montserrat text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              Book Now
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Filter Icon SVGs ─────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="white" strokeWidth="2" />
      <path d="M16.5 16.5L21 21" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"
        fill="white"
      />
    </svg>
  );
}

function StarOutlineIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        stroke="white"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── FindClinicSection ────────────────────────────────────────────────────────

const TREATMENT_OPTIONS = [
  { value: "botox", label: "Botox" },
  { value: "dermal-fillers", label: "Dermal Fillers" },
  { value: "kybella", label: "Kybella" },
  { value: "pdo-threads", label: "PDO Threads" },
  { value: "prp-prf", label: "PRP / PRF" },
  { value: "microneedling", label: "Microneedling" },
  { value: "chemical-peels", label: "Chemical Peels" },
  { value: "hydrafacial", label: "HydraFacial" },
  { value: "rf-skin-tightening", label: "RF Skin Tightening" },
  { value: "ultherapy", label: "Ultherapy" },
  { value: "laser-skin-resurfacing", label: "Laser Resurfacing" },
  { value: "laser-hair-removal", label: "Laser Hair Removal" },
  { value: "ipl-photofacial", label: "IPL / Photofacial" },
  { value: "coolsculpting", label: "CoolSculpting" },
  { value: "body-contouring", label: "Body Contouring" },
];

const DISTANCE_OPTIONS = [
  { value: "10", label: "Within 10 Miles" },
  { value: "25", label: "Within 25 Miles" },
  { value: "50", label: "Within 50 Miles" },
  { value: "100", label: "Within 100 Miles" },
];

const RATING_OPTIONS = [
  { value: "4.0", label: "4.0+ and More Rating" },
  { value: "4.5", label: "4.5+ and More Rating" },
  { value: "5.0", label: "5.0 Only" },
];

export function FindClinicSection({ clinics }: { clinics: FeaturedClinic[] }) {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const total = clinics.length;
  const { status, location: userLoc } = useLocation();

  // We can only offer distance features when we KNOW the visitor is in the USA.
  const inUS = Boolean(
    status === "granted" &&
      userLoc &&
      !userLoc.outsideUS &&
      userLoc.lat != null &&
      userLoc.lng != null,
  );

  // Filter states
  const [selectedTreatment, setSelectedTreatment] = useState("");
  const [selectedDistance, setSelectedDistance] = useState("25");
  const [selectedRating, setSelectedRating] = useState("");

  const dragStart = useRef<number | null>(null);
  const isDragging = useRef(false);

  const goTo = useCallback(
    (idx: number) => {
      if (total === 0) return;
      setCurrent(((idx % total) + total) % total);
    },
    [total]
  );

  const prev = useCallback(() => goTo(current - 1), [current, goTo]);
  const next = useCallback(() => goTo(current + 1), [current, goTo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragStart.current = e.clientX;
    isDragging.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragStart.current !== null && Math.abs(e.clientX - dragStart.current) > 5) {
      isDragging.current = true;
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (dragStart.current === null) return;
    const dx = e.clientX - dragStart.current;
    if (Math.abs(dx) > 40) goTo(current + (dx < 0 ? 1 : -1));
    dragStart.current = null;
  };

  // Attach a viewer-relative distance label to each clinic (US visitors only).
  const displayClinics: DisplayClinic[] = useMemo(() => {
    return clinics.map((c) => {
      let distanceLabel: string | null = null;
      if (inUS && c.lat != null && c.lng != null) {
        const miles = milesBetween(userLoc!.lat, userLoc!.lng, c.lat, c.lng);
        distanceLabel = formatMiles(miles);
      }
      return { ...c, distanceLabel };
    });
  }, [clinics, inUS, userLoc]);

  // Detected location label for the chip
  const detectedLabel = inUS
    ? userLoc!.city
      ? `${userLoc!.city}${userLoc!.stateName ? `, ${userLoc!.stateName}` : ""}`
      : userLoc!.stateName ?? null
    : null;

  const handleApplyFilters = () => {
    const params = new URLSearchParams();

    if (selectedTreatment) params.set("q", selectedTreatment);
    if (selectedRating) params.set("rating", selectedRating);

    // Distance + origin are USA-only. Never send lat/lng for outside-US visitors.
    if (inUS) {
      if (selectedDistance) params.set("radius", selectedDistance);
      if (userLoc!.stateCode) params.set("location", userLoc!.stateCode);
      params.set("lat", userLoc!.lat.toFixed(6));
      params.set("lng", userLoc!.lng.toFixed(6));
    }

    router.push(`/search?${params.toString()}`);
  };

  const handleClearFilters = () => {
    setSelectedTreatment("");
    setSelectedDistance("25");
    setSelectedRating("");
  };

  if (total === 0) return null;

  return (
    <section className="flex w-full flex-col items-center gap-[27px] overflow-hidden pb-16 pt-0">
      {/* ── Title ── */}
      <h2 className="w-full px-4 text-center font-montserrat text-[26px] sm:text-[30px] lg:text-[34px] font-normal leading-[116.02%] tracking-[-0.04em] text-[#373634]">
        Find the <em className="font-normal font-heading" >Perfect Clinic</em>
      </h2>

      {/* Detected location chip (US visitors only) */}
      {detectedLabel && (
        <div className="flex items-center gap-2 rounded-full border border-[#E5C7DA] bg-[#faf5fa] px-4 py-2 -mt-3">
          <LocateFixed className="size-4 text-[#CF5D9A]" />
          <span className="font-montserrat text-[13px] font-medium text-[#727272]">
            Showing clinics near
          </span>
          <span className="font-montserrat text-[13px] font-semibold text-[#CF5D9A]">
            {detectedLabel}
          </span>
        </div>
      )}

      {/* ── Filter Bar — single row on desktop, stacked on mobile ── */}
      <div className="flex w-full max-w-[1355px] flex-col xl:flex-row items-stretch xl:items-center justify-center gap-4 xl:gap-[25px] px-4 lg:px-8">
        {/* Filter dropdowns group */}
        <div className="flex flex-col xl:flex-row w-full xl:flex-1 items-stretch xl:items-center gap-4 xl:gap-[27px]">
          {/* Treatments */}
          <div className="flex w-full xl:flex-1 xl:min-w-0 items-center gap-[8px]">
            <div className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full bg-[#CF5D9A]">
              <SearchIcon />
            </div>
            <div className="relative w-full xl:flex-1 xl:min-w-0">
              <select
                value={selectedTreatment}
                onChange={(e) => setSelectedTreatment(e.target.value)}
                className="flex h-[50px] w-full cursor-pointer appearance-none items-center justify-between rounded-[4px] border border-[#D2C3D3] bg-white px-[22px] font-montserrat text-[16px] leading-[140%] text-[#727272] focus:outline-none focus:ring-2 focus:ring-[#CF5D9A]"
              >
                <option value="">Treatments</option>
                {TREATMENT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-[22px] top-1/2 h-4 w-4 -translate-y-1/2 text-[#353535]" />
            </div>
          </div>

          {/* Distance — USA-only. Disabled for outside-US / unknown-location visitors. */}
          <div className="flex w-full xl:flex-1 xl:min-w-0 items-center gap-[8px]">
            <div
              className={`flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full ${inUS ? "bg-[#CF5D9A]" : "bg-[#CBB8CB]"}`}
            >
              <LocationIcon />
            </div>
            <div className="relative w-full xl:flex-1 xl:min-w-0">
              <select
                value={selectedDistance}
                onChange={(e) => setSelectedDistance(e.target.value)}
                disabled={!inUS}
                title={inUS ? undefined : "Distance filtering is available for USA locations only"}
                className="flex h-[50px] w-full appearance-none items-center justify-between rounded-[4px] border border-[#D2C3D3] bg-white px-[22px] font-montserrat text-[16px] leading-[140%] text-[#727272] focus:outline-none focus:ring-2 focus:ring-[#CF5D9A] enabled:cursor-pointer disabled:cursor-not-allowed disabled:bg-[#F4F0F4] disabled:text-[#B7A9B7]"
              >
                {DISTANCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-[22px] top-1/2 h-4 w-4 -translate-y-1/2 text-[#353535]" />
            </div>
          </div>

          {/* Rating */}
          <div className="flex w-full xl:flex-1 xl:min-w-0 items-center gap-[8px]">
            <div className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full bg-[#CF5D9A]">
              <StarOutlineIcon />
            </div>
            <div className="relative w-full xl:flex-1 xl:min-w-0">
              <select
                value={selectedRating}
                onChange={(e) => setSelectedRating(e.target.value)}
                className="flex h-[50px] w-full cursor-pointer appearance-none items-center justify-between rounded-[4px] border border-[#D2C3D3] bg-white px-[22px] font-montserrat text-[16px] leading-[140%] text-[#727272] focus:outline-none focus:ring-2 focus:ring-[#CF5D9A]"
              >
                <option value="">All Ratings</option>
                {RATING_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-[22px] top-1/2 h-4 w-4 -translate-y-1/2 text-[#353535]" />
            </div>
          </div>
        </div>

        {/* Divider + actions */}
        <div className="flex items-center justify-between xl:justify-normal gap-4 xl:gap-[20px] w-full xl:w-auto">
          <div className="hidden xl:block h-[50px] w-px bg-[#D2D2D2]" />
          <button
            onClick={handleClearFilters}
            className="whitespace-nowrap font-montserrat text-[16px] font-medium text-[#CF5D9A] transition-opacity hover:opacity-70"
          >
            Clear Filters
          </button>
          <button
            onClick={handleApplyFilters}
            className="flex h-[47px] w-[160px] lg:w-[127px] shrink-0 items-center justify-center rounded-[8px] bg-[linear-gradient(90deg,#DE7F4C_0%,#C341D7_100%)] font-montserrat text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* Distance-availability hint for non-US / unknown-location visitors */}
      {!inUS && (
        <p className="-mt-2 px-4 text-center font-montserrat text-[12px] text-[#9a9a9a]">
          Distance filtering is available for USA locations only.
        </p>
      )}

      {/* ── Mobile / tablet carousel — swipeable scroll-snap row (up to xl) ── */}
      <div className="w-full xl:hidden">
        <div className="flex w-full snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth scrollbar-none px-4 pb-4">
          {displayClinics.map((clinic) => (
            <div
              key={clinic.id}
              className="w-[88vw] max-w-[440px] shrink-0 snap-center py-2"
            >
              <ClinicCard clinic={clinic} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Desktop carousel — 3D coverflow (xl and up) ── */}
      <div
        className="relative hidden w-full max-w-[1346px] xl:block"
        style={{ height: 520, perspective: "1400px", perspectiveOrigin: "50% 50%" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {displayClinics.map((clinic, idx) => {
          const offset = getOffset(idx, current, total);
          const slot = getSlotStyle(offset);

          return (
            <div
              key={clinic.id}
              onClick={() => {
                if (!isDragging.current && offset !== 0) goTo(idx);
              }}
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: 660,
                transform: slot.transform,
                opacity: slot.opacity,
                zIndex: slot.zIndex,
                pointerEvents: slot.pointerEvents,
                cursor: slot.cursor,
                transition: "all 0.55s cubic-bezier(0.4, 0, 0.2, 1)",
                transformStyle: "preserve-3d",
                willChange: "transform, opacity",
              }}
            >
              <ClinicCard clinic={clinic} />
            </div>
          );
        })}

        {/* Left nav — inset from edge */}
        <button
          onClick={prev}
          className="absolute left-8 top-1/2 z-30 flex h-[56px] w-[56px] -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-[#E1CCE3] bg-white shadow-sm transition-opacity hover:opacity-80"
          aria-label="Previous clinic"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M5 12L12 5M5 12L12 19" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Right nav — inset from edge */}
        <button
          onClick={next}
          className="absolute right-8 top-1/2 z-30 flex h-[56px] w-[56px] -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-[#E1CCE3] bg-white shadow-sm transition-opacity hover:opacity-80"
          aria-label="Next clinic"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </section>
  );
}
