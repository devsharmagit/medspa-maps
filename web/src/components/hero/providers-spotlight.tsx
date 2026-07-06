"use client";

import Link from "next/link";
import { useRef } from "react";

import type { ConcernProvider } from "@/lib/providers/queries";

/** Fallback headshot when a provider has no image (matches ProvidersCarousel). */
const DEFAULT_PHOTO =
  "https://images.stockcake.com/public/1/9/d/19d13828-c999-4e2d-a191-9da4dd8bd824_large/confident-medical-professional-stockcake.jpg";

function providerHref(p: ConcernProvider) {
  return `/providers/${p.id}/${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

// ─── Verified badge — pink checkmark circle ────────────────────────────────────
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

// ─── Chevron arrow SVG ────────────────────────────────────────────────────────
function ChevronArrow({ color }: { color: string }) {
  return (
    <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
      <path
        d="M1 1L7 7L1 13"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── ProviderCard ─────────────────────────────────────────────────────────────
// Width: 401px, Height: 341px
// Left half: photo filling full height (rounded-l-[22px])
// Right half: info column with name, specialty, divider, details, CTA button

function ProviderCard({ provider }: { provider: ConcernProvider }) {
  const specialty = provider.title || "Aesthetic Provider";
  const description = provider.card_tagline?.trim() || null;
  const rating = provider.review_rating ?? provider.avg_rating;

  return (
    <div
      className="flex min-h-[341px] h-auto sm:h-[341px] w-[326px] sm:w-[401px] shrink-0 overflow-hidden rounded-[22px] border border-[#DEDEDE] bg-white"
      style={{ boxShadow: "0px 6px 10.5px 1px rgba(0,0,0,0.05)" }}
    >
      {/* ── Photo — left half ── */}
      <div className="relative w-[150px] sm:w-[200.5px] shrink-0 bg-zinc-100">
        {/* Arbitrary scraped/CDN URLs — use a plain img (not next/image, which
            requires each host in remotePatterns). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={provider.image_url || DEFAULT_PHOTO}
          alt={provider.name}
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
      </div>

      {/* ── Info — right half ── */}
      <div className="flex h-full flex-1 sm:w-[200.5px] flex-col items-start justify-between bg-white px-4 sm:px-6 py-7 gap-[20px]">
        {/* Top block: name, specialty, divider, details */}
        <div className="flex w-full flex-col gap-[20px]">
          {/* Name + badge + specialty */}
          <div className="flex flex-col gap-2">
            <div className="flex gap-1">
              <h3 className="font-montserrat text-[18px] font-medium leading-[116.02%] tracking-[0.02em] text-[#383838] line-clamp-1">
                {provider.name}
              </h3>
              {provider.is_verified && <VerifiedBadge />}
            </div>
            <span className="font-montserrat text-[14px] leading-[138%] tracking-[0.02em] text-[#727272] line-clamp-1">
              {specialty}
            </span>
          </div>

          {/* Divider */}
          <div className="h-px w-full bg-[#DDC3DF]" />

          {/* Experience + description + rating */}
          <div className="flex flex-col gap-3">
            {provider.years_experience != null && (
              <p className="font-montserrat text-[12px] font-semibold uppercase leading-[130%] tracking-[0.02em] text-[#616161]">
                {provider.years_experience}+ years of Experience
              </p>
            )}
            {description && (
              <p className="font-montserrat text-[11px] leading-[138%] tracking-[0.02em] text-[#727272] line-clamp-3">
                {description}
              </p>
            )}
            {rating && (
              <div className="flex items-center gap-1">
                <span className="font-montserrat text-[11px] leading-[138%] tracking-[0.02em] text-[#727272]">
                  Customer Rating
                </span>
                <span className="font-inter text-[13px] font-medium leading-[21px] text-[#FFBA19]">★</span>
                <span className="font-montserrat text-[12px] font-semibold uppercase leading-[130%] tracking-[0.02em] text-[#616161]">
                  {rating}
                </span>
                {provider.review_count ? (
                  <span className="font-montserrat text-[11px] leading-[138%] tracking-[0.02em] text-[#9A9A9A]">
                    ({provider.review_count})
                  </span>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* View Profile button — full width gradient */}
        <Link
          href={providerHref(provider)}
          className="flex h-10 w-full items-center justify-center rounded-lg bg-[linear-gradient(90deg,#DE7F4C_0%,#C341D7_100%)] font-montserrat text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          View Profile
        </Link>
      </div>
    </div>
  );
}

// ─── ProvidersSpotlight ───────────────────────────────────────────────────────

export function ProvidersSpotlight({ providers = [] }: { providers?: ConcernProvider[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      left: scrollRef.current.scrollLeft + (dir === "left" ? -433 : 433),
      behavior: "smooth",
    });
  };

  // Nothing to spotlight — don't render an empty carousel.
  if (providers.length === 0) return null;

  return (
    /* Outer card: 1372px wide, 536px tall, white bg, border, pink shadow, 18px radius */
    <section className="flex w-[calc(100%-2rem)] max-w-[1372px] flex-col items-center justify-center gap-6 lg:gap-9 rounded-[18px] border border-[#DEDEDE] bg-white pt-7 lg:pt-9 pb-[5px] shadow-[0px_9px_11.1px_rgba(240,223,241,0.6)]">

      {/* ── Header row ── */}
      <div className="flex w-full flex-col gap-4 px-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-16">
        {/* Title */}
        <h2 className="font-montserrat text-[26px] sm:text-[30px] lg:text-[34px] font-normal leading-[116.02%] tracking-[-0.04em] text-[#373634]">
          Providers <span className="font-heading italic ">Spotlight</span>
        </h2>

        {/* Right group: View All + nav arrows */}
        <div className="flex items-center justify-between gap-8 lg:justify-normal">
          {/* View All Providers link */}
          <Link
            href="/providers"
            className="flex items-center gap-[5px] transition-opacity hover:opacity-70"
          >
            <span className="font-montserrat text-[16px] font-medium leading-[116.02%] text-[#CF5D9A]">
              View All Providers
            </span>
            {/* Arrow → pointing right */}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 8H13M13 8L8 3M13 8L8 13"
                stroke="#CF5D9A"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>

          {/* Prev / Next arrows */}
          <div className="flex items-center gap-[3px]">
            {/* Left arrow — dim, pill on right side (mirrored) */}
            <button
              onClick={() => scroll("left")}
              aria-label="Previous providers"
              className="flex h-[31px] w-10 items-center justify-center border-[0.6px] border-[#D9D9D9] py-1 px-0.5 transition-opacity hover:opacity-70"
              style={{ borderRadius: "0px 99px 99px 0px", transform: "scaleX(-1)" }}
            >
              <ChevronArrow color="rgba(187,55,167,0.4)" />
            </button>
            {/* Right arrow — vibrant pink, pill on right side */}
            <button
              onClick={() => scroll("right")}
              aria-label="Next providers"
              className="flex h-[31px] w-10 items-center justify-center border-[0.6px] border-[#A5A5A5] py-1 px-0.5 transition-opacity hover:opacity-70"
              style={{ borderRadius: "0px 99px 99px 0px" }}
            >
              <ChevronArrow color="#CF5D9A" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Provider cards row ── */}
      <div
        ref={scrollRef}
        className="flex w-full items-center gap-5 sm:gap-8 overflow-x-auto px-5 sm:px-[52px] pb-[38px] scrollbar-none"
      >
        {providers.map((provider) => (
          <ProviderCard key={provider.id} provider={provider} />
        ))}
      </div>
    </section>
  );
}
