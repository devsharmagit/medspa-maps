"use client";

import { ChevronDown, ChevronLeft, ChevronRight, Heart, MapPin, Play, Search, Star } from "lucide-react";
import Image from "next/image";
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
  images: string[];
  additionalImages: number;
  logo: string;
  mainImage: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

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
    images: ["/clinic image", "/clinic image", "/clinic image"],
    additionalImages: 18,
    logo: "/clinic image",
    mainImage: "/clinic image",
  },
  {
    id: 2,
    name: "Revera Med",
    abbr: "RM",
    verified: true,
    location: "Austin, TX",
    distance: "8.5 Miles Away",
    rating: 4.8,
    reviewCount: 68,
    startingPrice: 129,
    treatments: ["Botox", "Fillers"],
    featured: true,
    discount: "15% Off",
    images: ["/clinic image", "/clinic image", "/clinic image"],
    additionalImages: 18,
    logo: "/clinic image",
    mainImage: "/clinic image",
  },
  {
    id: 3,
    name: "Beauty Clinic",
    abbr: "BC",
    verified: true,
    location: "Austin, TX",
    distance: "8.5 Miles Away",
    rating: 4.8,
    reviewCount: 68,
    startingPrice: 129,
    treatments: ["Botox", "Fillers", "Laser"],
    featured: true,
    discount: "15% Off",
    images: ["/clinic image", "/clinic image", "/clinic image"],
    additionalImages: 18,
    logo: "/clinic image",
    mainImage: "/clinic image",
  },
  {
    id: 4,
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
    images: ["/clinic image", "/clinic image", "/clinic image"],
    additionalImages: 18,
    logo: "/clinic image",
    mainImage: "/clinic image",
  },
  {
    id: 5,
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
    images: ["/clinic image", "/clinic image", "/clinic image"],
    additionalImages: 18,
    logo: "/clinic image",
    mainImage: "/clinic image",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the signed offset of `idx` relative to `current` in a circular
 * array of `total` items, always choosing the shortest path.
 */
function getOffset(idx: number, current: number, total: number): number {
  let d = idx - current;
  if (d > total / 2) d -= total;
  if (d < -total / 2) d += total;
  return d;
}

/**
 * Computes the CSS transform + visual style for a card slot based on its
 * position relative to the active card.
 */
interface SlotStyle {
  transform: string;
  opacity: number;
  zIndex: number;
  pointerEvents: "auto" | "none";
  cursor: string;
}

function getSlotStyle(offset: number): SlotStyle {
  const CARD_W = 580;
  const GAP = 400;
  const SIDE_SCALE = 1;
  const SIDE_SKEW = 30;
  const BACK_SCALE = 1;

  const base = `translateX(${-CARD_W / 2}px) translateY(-260px)`;

  if (offset === 0) {
    return {
      transform: `${base} translateZ(0px) rotateY(0deg) scale(1)`,
      opacity: 1,
      zIndex: 20,
      pointerEvents: "auto",
      cursor: "default",
    };
  }

  if (offset === 1 || offset === -1) {
    const dir = offset > 0 ? 1 : -1;
    const sideY = -260 * SIDE_SCALE + (260 - 260 * SIDE_SCALE);
    return {
      transform: `translateX(${-CARD_W / 2 + dir * GAP * 0.82}px) translateY(${sideY}px) translateZ(-120px) rotateY(${-dir * SIDE_SKEW}deg) scale(${SIDE_SCALE})`,
      opacity: 0.85,
      zIndex: 14,
      pointerEvents: "auto",
      cursor: "pointer",
    };
  }

  if (offset === 2 || offset === -2) {
    const dir = offset > 0 ? 1 : -1;
    const backY = -260 * BACK_SCALE + (260 - 260 * BACK_SCALE);
    return {
      transform: `translateX(${-CARD_W / 2 + dir * GAP * 1.42}px) translateY(${backY}px) translateZ(-240px) rotateY(${-dir * SIDE_SKEW * 1.5}deg) scale(${BACK_SCALE})`,
      opacity: 0.55,
      zIndex: 8,
      pointerEvents: "auto",
      cursor: "pointer",
    };
  }

  // Far / hidden
  const dir = offset > 0 ? 1 : -1;
  return {
    transform: `translateX(${-CARD_W / 2 + dir * GAP * 2}px) translateY(-260px) translateZ(-360px) rotateY(${-dir * SIDE_SKEW * 2}deg) scale(0.52)`,
    opacity: 0,
    zIndex: 2,
    pointerEvents: "none",
    cursor: "default",
  };
}

// ─── ClinicCard ───────────────────────────────────────────────────────────────

function ClinicCard({ clinic }: { clinic: Clinic }) {
  const [isFavorited, setIsFavorited] = useState(false);

  return (
    <div
      className="w-[580px] overflow-hidden rounded-[18px] border-2 border-white bg-white"
      style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.35)" }}
    >
      {/* ── Main Image ── */}
      <div className="relative h-[272px] w-full overflow-hidden bg-[#c8a8bc]">
        <Image
          src={clinic.mainImage}
          alt={clinic.name}
          fill
          className="object-cover"
        />

        {/* Play button */}
        <button
          className="absolute left-1/2 top-1/2 flex h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/70"
          aria-label="Play video"
        >
          <div className="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-black/70">
            <Play className="ml-1 h-5 w-5 fill-white text-white" />
          </div>
        </button>

        {/* Featured badge */}
        {clinic.featured && (
          <div className="absolute left-[18px] top-[18px] rounded bg-[#D3A845] px-2.5 py-1">
            <span className="font-montserrat text-[11px] font-bold uppercase tracking-[0.04em] text-white">
              Featured
            </span>
          </div>
        )}

        {/* Heart button */}
        <button
          onClick={() => setIsFavorited(!isFavorited)}
          className="absolute right-[16px] top-[14px] flex h-[38px] w-[38px] items-center justify-center rounded-full border-2 border-white/90 bg-white/20"
          aria-label="Add to favorites"
        >
          <Heart
            className={`h-[17px] w-[17px] ${
              isFavorited ? "fill-[#CF5D9A] text-[#CF5D9A]" : "fill-white text-white"
            }`}
          />
        </button>

        {/* Discount banner */}
        {clinic.discount && (
          <div className="absolute bottom-0 left-0 w-full px-3.5 py-1.5"
            style={{ background: "linear-gradient(to right, #CF5C9B, rgba(207,92,155,0.3), transparent)" }}
          >
            <span className="font-montserrat text-[13px] font-bold uppercase text-white">
              {clinic.discount}
            </span>
          </div>
        )}
      </div>

      {/* ── Card Body ── */}
      <div className="bg-white px-[26px] pt-5 pb-4">
        {/* Clinic header */}
        <div className="mb-3 flex items-end gap-3">
          {/* Logo / abbr */}
          <div className="flex h-12 w-[52px] flex-shrink-0 items-center justify-center rounded-lg border border-[#e5e5e5] bg-[#f8f3f6] text-[15px] font-bold tracking-tight text-[#CF5D9A]">
            {clinic.abbr}
          </div>

          <div>
            <div className="flex items-center gap-1 mb-[3px]">
              <h3 className="font-montserrat text-[17px] font-semibold leading-tight tracking-[0.01em] text-[#383838]">
                {clinic.name}
              </h3>
              {clinic.verified && (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" className="ml-0.5">
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

            <div className="flex items-center gap-[10px] text-[11px] text-[#727272]">
              <span className="font-montserrat">{clinic.location}</span>
              <div className="h-3.5 w-px bg-[#ddd]" />
              <div className="flex items-center gap-0.5">
                <MapPin className="h-[13px] w-[13px] text-[#EE97C6]" />
                <span className="font-montserrat">{clinic.distance}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Rating row */}
        <div className="mb-3.5 flex items-center gap-1.5 text-[11px] text-[#727272]">
          <span className="font-montserrat">{clinic.rating}</span>
          <div className="flex items-center gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-[13px] w-[13px] fill-[#FFBA19] text-[#FFBA19]" />
            ))}
          </div>
          <span className="font-montserrat">({clinic.reviewCount})</span>
          <span className="font-montserrat">Starting at ${clinic.startingPrice}</span>
        </div>

        {/* Treatments + action buttons */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {clinic.treatments.map((t) => (
              <span
                key={t}
                className="rounded border-[0.5px] border-[#dfdfdf] bg-[#f5f5f5] px-2 py-1 font-montserrat text-[10px] tracking-[0.02em] text-[#7f7f7f]"
              >
                {t}
              </span>
            ))}
          </div>

          <div className="flex flex-shrink-0 items-center gap-2">
            <button className="h-[38px] rounded-lg px-4 font-montserrat text-[12px] font-semibold text-[#CF5D9A] transition-colors hover:bg-pink-50">
              View Profile
            </button>
            <button
              className="h-[38px] rounded-lg px-4 font-montserrat text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #CF5D9A, #e07040)" }}
            >
              Book Now
            </button>
          </div>
        </div>
      </div>

      {/* ── Thumbnails ── */}
      <div className="flex gap-1.5 bg-white px-[26px] pb-4">
        {clinic.images.map((img, idx) => (
          <div key={idx} className="relative h-[50px] w-[68px] flex-shrink-0 overflow-hidden rounded-lg bg-[#c8a8bc]">
            <Image src={img} alt={`Gallery ${idx + 1}`} fill className="object-cover" />
            {idx === 2 && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40">
                <span className="font-montserrat text-[13px] font-semibold text-white">
                  +{clinic.additionalImages}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── FindClinicSection ────────────────────────────────────────────────────────

export function FindClinicSection() {
  const [current, setCurrent] = useState(0);
  const total = clinicData.length;

  // Drag / swipe state
  const dragStart = useRef<number | null>(null);
  const isDragging = useRef(false);

  const goTo = useCallback(
    (idx: number) => {
      setCurrent(((idx % total) + total) % total);
    },
    [total]
  );

  const prev = useCallback(() => goTo(current - 1), [current, goTo]);
  const next = useCallback(() => goTo(current + 1), [current, goTo]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next]);

  // Pointer drag handlers
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

  return (
    <section
      className="flex w-full flex-col items-center gap-0 overflow-hidden rounded-2xl py-10"
      style={{ background: "#0e0e0e" }}
    >
      {/* ── Title ── */}
      <h2 className="mb-8 w-full text-center font-montserrat text-[28px] font-normal leading-[116%] tracking-[-0.04em] text-white">
        Find the{" "}
        <em
          className="not-italic font-semibold"
          style={{ color: "#e8d5b7", fontStyle: "italic" }}
        >
          Perfect Clinic
        </em>
      </h2>

      {/* ── Filter Bar ── */}
      <div className="mb-10 flex flex-wrap items-center justify-center gap-4 px-6">
        {/* Treatment */}
        <div className="flex items-center gap-2">
          <button
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border-none"
            style={{ background: "linear-gradient(135deg, #CF5D9A, #e07040)" }}
          >
            <Search className="h-5 w-5 text-white" />
          </button>
          <div className="flex h-11 w-[200px] items-center justify-between rounded-lg border border-[#333] bg-[#1c1c1c] px-3.5">
            <span className="font-montserrat text-[13px] text-[#aaa]">Treatments</span>
            <ChevronDown className="h-4 w-4 text-[#666]" />
          </div>
        </div>

        {/* Distance */}
        <div className="flex items-center gap-2">
          <button
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border-none"
            style={{ background: "linear-gradient(135deg, #CF5D9A, #e07040)" }}
          >
            <MapPin className="h-5 w-5 text-white" />
          </button>
          <div className="flex h-11 w-[200px] items-center justify-between rounded-lg border border-[#333] bg-[#1c1c1c] px-3.5">
            <span className="font-montserrat text-[13px] text-[#aaa]">25 Miles Away</span>
            <ChevronDown className="h-4 w-4 text-[#666]" />
          </div>
        </div>

        {/* Rating */}
        <div className="flex items-center gap-2">
          <button
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border-none"
            style={{ background: "linear-gradient(135deg, #CF5D9A, #e07040)" }}
          >
            <Star className="h-5 w-5 text-white" />
          </button>
          <div className="flex h-11 w-[200px] items-center justify-between rounded-lg border border-[#333] bg-[#1c1c1c] px-3.5">
            <span className="font-montserrat text-[13px] text-[#aaa]">4.0+ and More Rating</span>
            <ChevronDown className="h-4 w-4 text-[#666]" />
          </div>
        </div>

        <div className="h-10 w-px bg-[#333]" />

        <button className="font-montserrat text-[14px] font-medium text-[#CF5D9A] transition-opacity hover:opacity-70">
          Clear Filters
        </button>

        <button
          className="h-11 rounded-lg px-6 font-montserrat text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #CF5D9A, #e07040)" }}
        >
          Apply Filters
        </button>
      </div>

      {/* ── Carousel ── */}
      <div
        className="relative w-full"
        style={{ height: 520, perspective: "1400px", perspectiveOrigin: "50% 45%" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* Cards */}
        <div
          className="absolute inset-0"
          style={{ transformStyle: "preserve-3d" }}
        >
          {clinicData.map((clinic, idx) => {
            const offset = getOffset(idx, current, total);
            const style = getSlotStyle(offset);

            return (
              <div
                key={clinic.id}
                onClick={() => {
                  // Only navigate on click, not after drag
                  if (!isDragging.current && offset !== 0) goTo(idx);
                }}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: style.transform,
                  opacity: style.opacity,
                  zIndex: style.zIndex,
                  pointerEvents: style.pointerEvents,
                  cursor: style.cursor,
                  transition: "all 0.55s cubic-bezier(0.4, 0, 0.2, 1)",
                  transformStyle: "preserve-3d",
                  willChange: "transform, opacity",
                }}
              >
                <ClinicCard clinic={clinic} />
              </div>
            );
          })}
        </div>

        {/* Left nav */}
        <button
          onClick={prev}
          className="absolute left-5 top-1/2 z-30 flex h-[52px] w-[52px] -translate-y-1/2 items-center justify-center rounded-full bg-white transition-opacity hover:opacity-80"
          style={{ border: "3px solid rgba(225,204,227,0.7)", boxShadow: "0 2px 12px rgba(0,0,0,0.25)" }}
          aria-label="Previous clinic"
        >
          <ChevronLeft className="h-6 w-6 text-[#333]" />
        </button>

        {/* Right nav */}
        <button
          onClick={next}
          className="absolute right-5 top-1/2 z-30 flex h-[52px] w-[52px] -translate-y-1/2 items-center justify-center rounded-full bg-white transition-opacity hover:opacity-80"
          style={{ border: "3px solid rgba(225,204,227,0.7)", boxShadow: "0 2px 12px rgba(0,0,0,0.25)" }}
          aria-label="Next clinic"
        >
          <ChevronRight className="h-6 w-6 text-[#333]" />
        </button>
      </div>

      {/* ── Dots ── */}
      <div className="mt-6 flex items-center gap-2">
        {clinicData.map((_, idx) => (
          <button
            key={idx}
            onClick={() => goTo(idx)}
            aria-label={`Go to clinic ${idx + 1}`}
            style={{
              height: 8,
              width: idx === current ? 22 : 8,
              borderRadius: idx === current ? 4 : 9999,
              background: idx === current ? "#CF5D9A" : "#444",
              border: "none",
              cursor: "pointer",
              transition: "all 0.3s ease",
              padding: 0,
            }}
          />
        ))}
      </div>
    </section>
  );
}