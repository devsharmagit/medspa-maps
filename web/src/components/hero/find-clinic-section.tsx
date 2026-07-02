"use client";

import { ChevronDown, Heart, MapPin, Play, Star } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Clinic {
  id: number;
  name: string;
  abbr: string;
  verified: boolean;
  location: string;
  distance: string;
  rating: number;
  reviewCount: number;
  startingPrice: number;
  treatments: string[];
  featured: boolean;
  discount: string;
  thumbnails: string[];
  additionalImages: number;
  logo: string;
  mainImage: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const CLINIC_IMG = "/images/landingpage/clinic-2.png";
const CLINIC_IMG2 = "/images/landingpage/clinic-3.png";

const clinicData: Clinic[] = [
  {
    id: 1,
    name: "Timeless Aesthetics",
    abbr: "TA",
    verified: true,
    location: "Austin, TX",
    distance: "8.5 Miles Away",
    rating: 4.8,
    reviewCount: 68,
    startingPrice: 129,
    treatments: ["Botox", "Fillers", "Laser", "Skin", "IV Therapy"],
    featured: true,
    discount: "15% Off",
    thumbnails: [CLINIC_IMG2, CLINIC_IMG, CLINIC_IMG2],
    additionalImages: 18,
    logo: "/images/landingpage/clinic-logo.png",
    mainImage: CLINIC_IMG,
  },
  {
    id: 2,
    name: "Revera Med",
    abbr: "RM",
    verified: true,
    location: "Austin, TX",
    distance: "8.5 Miles Away",
    rating: 4.8,
    reviewCount: 54,
    startingPrice: 99,
    treatments: ["Botox", "Fillers"],
    featured: true,
    discount: "15% Off",
    thumbnails: [CLINIC_IMG, CLINIC_IMG2, CLINIC_IMG],
    additionalImages: 18,
    logo: "/images/landingpage/clinic-logo.png",
    mainImage: CLINIC_IMG2,
  },
  {
    id: 3,
    name: "Glow Studio",
    abbr: "GS",
    verified: true,
    location: "Austin, TX",
    distance: "12 Miles Away",
    rating: 4.9,
    reviewCount: 42,
    startingPrice: 99,
    treatments: ["Skin", "Laser", "Peels"],
    featured: true,
    discount: "10% Off",
    thumbnails: [CLINIC_IMG2, CLINIC_IMG, CLINIC_IMG2],
    additionalImages: 18,
    logo: "/images/landingpage/clinic-logo.png",
    mainImage: CLINIC_IMG,
  },
  {
    id: 4,
    name: "Aura Aesthetics",
    abbr: "AA",
    verified: true,
    location: "Austin, TX",
    distance: "5 Miles Away",
    rating: 4.7,
    reviewCount: 91,
    startingPrice: 149,
    treatments: ["Botox", "Skin", "IV Therapy"],
    featured: true,
    discount: "20% Off",
    thumbnails: [CLINIC_IMG, CLINIC_IMG2, CLINIC_IMG],
    additionalImages: 18,
    logo: "/images/landingpage/clinic-logo.png",
    mainImage: CLINIC_IMG2,
  },
  {
    id: 5,
    name: "Beauty Clinic",
    abbr: "BC",
    verified: true,
    location: "Austin, TX",
    distance: "3 Miles Away",
    rating: 4.6,
    reviewCount: 77,
    startingPrice: 79,
    treatments: ["Botox", "Fillers", "Laser"],
    featured: true,
    discount: "12% Off",
    thumbnails: [CLINIC_IMG2, CLINIC_IMG, CLINIC_IMG2],
    additionalImages: 18,
    logo: "/images/landingpage/clinic-logo.png",
    mainImage: CLINIC_IMG,
  },
];

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
// Layout (matching Figma):
//   ┌──────────────────────────────────────────────┐
//   │              Main Image (302px tall)          │
//   │  [FEATURED]         [♥]                       │
//   │              [▶]                              │
//   │ 15% OFF                                       │
//   ├──────────────────────────────────────────────┤
//   │ [Logo] Name ✓          [thumb][thumb][+18]    │
//   │        Austin, TX  📍 8.5 Miles               │
//   │ 4.8 ★★★★★ (68) Starting at $129              │
//   │ [Botox][Fillers][Laser][Skin][IV Therapy]     │
//   │ [View Profile]              [Book Now ▶]      │
//   └──────────────────────────────────────────────┘

function ClinicCard({ clinic }: { clinic: Clinic }) {
  const [isFavorited, setIsFavorited] = useState(false);

  return (
    <div
      className="w-[660px] overflow-hidden rounded-[18px] border-2 border-white bg-white"
      style={{ boxShadow: "0px 4px 21.3px #E2D8E6" }}
    >
      {/* ── Main Image ── */}
      <div className="relative h-[302px] w-full overflow-hidden">
        <Image
          src={clinic.mainImage}
          alt={clinic.name}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 660px"
        />

        {/* Play button */}
        <button
          className="absolute left-1/2 top-1/2 flex h-[79px] w-[79px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/70"
          aria-label="Play video"
        >
          <div className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-black/70">
            <Play className="ml-1 h-5 w-5 fill-white text-white" />
          </div>
        </button>

        {/* Heart */}
        <button
          onClick={() => setIsFavorited(!isFavorited)}
          className="absolute right-[18px] top-[18px] flex h-[40px] w-[40px] items-center justify-center rounded-full border-2 border-white bg-white/20"
          aria-label="Add to favorites"
        >
          <Heart
            className={`h-[18px] w-[18px] ${isFavorited ? "fill-[#CF5D9A] text-[#CF5D9A]" : "fill-white text-white"}`}
          />
        </button>

        {/* Featured badge */}
        {clinic.featured && (
          <div className="absolute left-[22px] top-[23px] rounded bg-[#D3A845] px-[10px] py-1">
            <span className="font-montserrat text-[14px] font-semibold uppercase tracking-[-0.02em] text-white">
              Featured
            </span>
          </div>
        )}

        {/* Discount banner */}
        {clinic.discount && (
          <div
            className="absolute bottom-0 left-0 w-full px-[10px] py-1.5"
            style={{ background: "linear-gradient(90deg, #CF5C9B 15.45%, rgba(211,168,69,0) 100%)" }}
          >
            <span className="font-montserrat text-[14px] font-bold uppercase tracking-[-0.02em] text-white">
              {clinic.discount}
            </span>
          </div>
        )}
      </div>

      {/* ── Card Body ── */}
      <div className="bg-white px-[30px] pt-[24px] pb-[24px]">

        {/* Row 1: Logo + Name/Location  |  Thumbnails */}
        <div className="flex items-start justify-between gap-4">
          {/* Left: logo + text */}
          <div className="flex items-start gap-[11px]">
            {/* Logo */}
            <div className="h-[50px] w-[57px] shrink-0 overflow-hidden rounded-[6px] border border-[#E5E5E5]">
              <Image
                src={clinic.logo}
                alt={`${clinic.name} logo`}
                width={57}
                height={50}
                className="h-full w-full object-cover"
              />
            </div>

            {/* Name + location */}
            <div className="flex flex-col gap-[4px]">
              <div className="flex items-center gap-[4px]">
                <h3 className="font-montserrat text-[20px] font-medium leading-[116.02%] tracking-[0.02em] text-[#383838]">
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
                <span className="font-montserrat font-medium tracking-[0.02em]">{clinic.location}</span>
                <div className="h-[14px] w-px bg-[#DBDBDB]" />
                <div className="flex items-center gap-[2px]">
                  <MapPin className="h-[13px] w-[13px] text-[#EE97C6]" />
                  <span className="font-montserrat tracking-[0.02em]">{clinic.distance}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: thumbnails */}
          <div className="flex shrink-0 items-center gap-[9px]">
            {clinic.thumbnails.map((img, idx) => (
              <div
                key={idx}
                className="relative h-[56px] w-[76px] overflow-hidden rounded-[6px]"
              >
                <Image
                  src={img}
                  alt={`Gallery ${idx + 1}`}
                  fill
                  className="object-cover"
                  sizes="76px"
                />
                {idx === 2 && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-[6px] bg-black/40">
                    <span className="font-montserrat text-[14px] font-semibold text-white">
                      +{clinic.additionalImages}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Row 2: Rating */}
        <div className="mt-[14px] flex items-center gap-[6px] text-[12px] text-[#727272]">
          <span className="font-montserrat tracking-[-0.02em]">{clinic.rating}</span>
          <div className="flex items-center gap-[4px]">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-[14px] w-[14px] fill-[#FFBA19] text-[#FFBA19]" />
            ))}
          </div>
          <span className="font-montserrat tracking-[-0.02em]">({clinic.reviewCount})</span>
        </div>

<div className="flex justify-between ">

        {/* Row 3: Treatment tags */}
        <div className="mt-[10px] flex flex-wrap items-center gap-[6px]">
          {clinic.treatments.map((t) => (
            <span
              key={t}
              className="rounded border-[0.5px] border-[#DFDFDF] bg-[#F5F5F5] px-[10px] py-1 font-montserrat text-[12px] tracking-[0.02em] text-[#7F7F7F]"
            >
              {t}
            </span>
          ))}
        </div>

        {/* Row 4: CTA buttons */}
        <div className="mt-[20px] flex items-center gap-[9px]">
          <button className="flex h-[43px] w-[120px] items-center justify-center rounded-lg border border-[#CF5B9D] font-montserrat text-[14px] font-semibold text-[#CF5B9D] transition-colors hover:bg-pink-50">
            View Profile
          </button>
          <button className="flex h-[43px] w-[127px] items-center justify-center rounded-lg bg-[linear-gradient(90deg,#DE7F4C_0%,#C341D7_100%)] font-montserrat text-[14px] font-semibold text-white transition-opacity hover:opacity-90">
            Book Now
          </button>
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
  { value: "10", label: "10 Miles Away" },
  { value: "25", label: "25 Miles Away" },
  { value: "50", label: "50 Miles Away" },
  { value: "100", label: "100 Miles Away" },
];

const RATING_OPTIONS = [
  { value: "4.0", label: "4.0+ and More Rating" },
  { value: "4.5", label: "4.5+ and More Rating" },
  { value: "5.0", label: "5.0 Only" },
];

export function FindClinicSection() {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const total = clinicData.length;

  // Filter states
  const [selectedTreatment, setSelectedTreatment] = useState("");
  const [selectedDistance, setSelectedDistance] = useState("25");
  const [selectedRating, setSelectedRating] = useState("");

  const dragStart = useRef<number | null>(null);
  const isDragging = useRef(false);

  const goTo = useCallback(
    (idx: number) => setCurrent(((idx % total) + total) % total),
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

  const handleApplyFilters = () => {
    const params = new URLSearchParams();
    
    if (selectedTreatment) {
      params.set("q", selectedTreatment);
    }
    
    if (selectedDistance) {
      params.set("radius", selectedDistance);
    }
    
    if (selectedRating) {
      params.set("rating", selectedRating);
    }
    
    router.push(`/search?${params.toString()}`);
  };

  const handleClearFilters = () => {
    setSelectedTreatment("");
    setSelectedDistance("25");
    setSelectedRating("");
  };

  return (
    <section className="flex w-full flex-col items-center gap-[27px] overflow-hidden pb-16 pt-0">
      {/* ── Title ── */}
      <h2 className="w-full text-center font-montserrat text-[34px] font-normal leading-[116.02%] tracking-[-0.04em] text-[#373634]">
        Find the <em className="font-normal font-heading" >Perfect Clinic</em>
      </h2>

      {/* ── Filter Bar — single row, centred ── */}
      <div className="flex w-full max-w-[1355px] items-center justify-center gap-[25px] px-8">
        {/* Filter dropdowns group */}
        <div className="flex items-center gap-[27px]">
          {/* Treatments */}
          <div className="flex items-center gap-[8px]">
            <div className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full bg-[#CF5D9A]">
              <SearchIcon />
            </div>
            <div className="relative">
              <select
                value={selectedTreatment}
                onChange={(e) => setSelectedTreatment(e.target.value)}
                className="flex h-[50px] w-[280px] cursor-pointer appearance-none items-center justify-between rounded-[4px] border border-[#D2C3D3] bg-white px-[22px] font-montserrat text-[16px] leading-[140%] text-[#727272] focus:outline-none focus:ring-2 focus:ring-[#CF5D9A]"
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

          {/* Distance */}
          <div className="flex items-center gap-[8px]">
            <div className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full bg-[#CF5D9A]">
              <LocationIcon />
            </div>
            <div className="relative">
              <select
                value={selectedDistance}
                onChange={(e) => setSelectedDistance(e.target.value)}
                className="flex h-[50px] w-[280px] cursor-pointer appearance-none items-center justify-between rounded-[4px] border border-[#D2C3D3] bg-white px-[22px] font-montserrat text-[16px] leading-[140%] text-[#727272] focus:outline-none focus:ring-2 focus:ring-[#CF5D9A]"
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
          <div className="flex items-center gap-[8px]">
            <div className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full bg-[#CF5D9A]">
              <StarOutlineIcon />
            </div>
            <div className="relative">
              <select
                value={selectedRating}
                onChange={(e) => setSelectedRating(e.target.value)}
                className="flex h-[50px] w-[280px] cursor-pointer appearance-none items-center justify-between rounded-[4px] border border-[#D2C3D3] bg-white px-[22px] font-montserrat text-[16px] leading-[140%] text-[#727272] focus:outline-none focus:ring-2 focus:ring-[#CF5D9A]"
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
        <div className="flex items-center gap-[20px]">
          <div className="h-[50px] w-px bg-[#D2D2D2]" />
          <button
            onClick={handleClearFilters}
            className="whitespace-nowrap font-montserrat text-[16px] font-medium text-[#CF5D9A] transition-opacity hover:opacity-70"
          >
            Clear Filters
          </button>
          <button
            onClick={handleApplyFilters}
            className="flex h-[47px] w-[127px] shrink-0 items-center justify-center rounded-[8px] bg-[linear-gradient(90deg,#DE7F4C_0%,#C341D7_100%)] font-montserrat text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* ── Carousel ── */}
      <div
        className="relative w-full max-w-[1346px]"
        style={{ height: 520, perspective: "1400px", perspectiveOrigin: "50% 50%" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {clinicData.map((clinic, idx) => {
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