"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useRef } from "react";

const providers = [
  {
    id: 1,
    name: "Dr. Larissa Joe",
    verified: true,
    specialty: "Injectable Specialist",
    experience: "10+ years of Experience",
    description:
      "Expert in Botox, fillers and laser treatments. Provides soft and natural looking results.",
    rating: 4.9,
    image: "/images/hero/avatar-1.png",
  },
  {
    id: 2,
    name: "Dr. Larissa Joe",
    verified: true,
    specialty: "Injectable Specialist",
    experience: "10+ years of Experience",
    description:
      "Expert in Botox, fillers and laser treatments. Provides soft and natural looking results.",
    rating: 4.9,
    image: "/images/hero/avatar-2.png",
  },
  {
    id: 3,
    name: "Dr. Larissa Joe",
    verified: true,
    specialty: "Injectable Specialist",
    experience: "10+ years of Experience",
    description:
      "Expert in Botox, fillers and laser treatments. Provides soft and natural looking results.",
    rating: 4.9,
    image: "/images/hero/avatar-3.png",
  },
];

function ProviderCard({
  provider,
}: {
  provider: (typeof providers)[0];
}) {
  return (
    <div className="flex h-[341px] w-[401px] shrink-0 items-center justify-center rounded-[22px] bg-white p-px shadow-[0_6px_10.5px_1px_rgba(0,0,0,0.05)]">
      {/* Provider Image */}
      <div className="relative h-[339px] w-[200.5px] flex-1 self-stretch">
        <Image
          src={provider.image}
          alt={provider.name}
          fill
          className="rounded-l-[22px] object-cover"
        />
      </div>

      {/* Provider Info */}
      <div className="flex h-[339px] w-[200.5px] flex-1 flex-col items-start gap-5 self-stretch bg-white p-6">
        <div className="flex w-full flex-col items-start gap-5 self-stretch">
          {/* Name and Title */}
          <div className="flex flex-col items-start gap-2">
            {/* Name with Verification */}
            <div className="flex items-center justify-center gap-2">
              <h3 className="font-montserrat text-lg font-medium leading-[116.02%] tracking-[0.02em] text-[#383838]">
                {provider.name}
              </h3>
              {provider.verified && (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M10 2L12 8L18 10L12 12L10 18L8 12L2 10L8 8L10 2Z"
                    fill="#CF5D9A"
                  />
                </svg>
              )}
            </div>

            {/* Specialty */}
            <span className="text-center font-montserrat text-sm leading-[138%] tracking-[0.02em] text-[#727272]">
              {provider.specialty}
            </span>
          </div>

          {/* Divider */}
          <div className="h-0 w-full self-stretch border-t border-[#DDC3DF]" />

          {/* Details Section */}
          <div className="flex flex-col items-start gap-3 self-stretch">
            {/* Experience */}
            <p className="self-stretch font-montserrat text-xs font-semibold uppercase leading-[130%] tracking-[0.02em] text-[#616161]">
              {provider.experience}
            </p>

            {/* Description */}
            <p className="self-stretch font-montserrat text-[11px] leading-[138%] tracking-[0.02em] text-[#727272]">
              {provider.description}
            </p>

            {/* Customer Rating */}
            <div className="flex items-center gap-1">
              <span className="font-montserrat text-[11px] leading-[138%] tracking-[0.02em] text-[#727272]">
                Customer Rating
              </span>
              <span className="flex items-center font-inter text-[13px] font-medium leading-[21px] text-[#FFBA19]">
                ★
              </span>
              <span className="font-montserrat text-xs font-semibold uppercase leading-[130%] tracking-[0.02em] text-[#616161]">
                {provider.rating}
              </span>
            </div>
          </div>
        </div>

        {/* View Profile Button */}
        <button className="flex h-10 w-full items-center justify-center self-stretch rounded-lg bg-brand-gradient px-6 py-2.5 transition-opacity hover:opacity-90">
          <span className="font-montserrat text-sm font-semibold leading-[17px] text-white">
            View Profile
          </span>
        </button>
      </div>
    </div>
  );
}

export function ProvidersSpotlight() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 433; // Card width + gap
      const newScrollLeft =
        scrollContainerRef.current.scrollLeft +
        (direction === "left" ? -scrollAmount : scrollAmount);
      scrollContainerRef.current.scrollTo({
        left: newScrollLeft,
        behavior: "smooth",
      });
    }
  };

  return (
    <section className="flex w-full max-w-[1372px] flex-col items-center justify-center gap-9 rounded-[18px] border border-[#DEDEDE] bg-white px-0 py-1.5 shadow-[0_9px_11.1px_rgba(240,223,241,0.6)]">
      {/* Header */}
      <div className="flex w-full items-start justify-center gap-[29px] self-stretch px-16">
        {/* Title */}
        <h2 className="flex-1 font-montserrat text-[34px] font-normal leading-[116.02%] tracking-[-0.04em] text-[#373634]">
          Providers <span className="font-heading italic">Spotlight</span>
        </h2>

        {/* View All and Navigation */}
        <div className="flex items-center gap-8">
          {/* View All Link */}
          <a
            href="#"
            className="flex items-center gap-[5px] transition-opacity hover:opacity-70"
          >
            <span className="font-montserrat text-base font-medium leading-[116.02%] text-[#CF5D9A]">
              View All Providers
            </span>
            <svg
              width="16"
              height="29"
              viewBox="0 0 16 29"
              fill="none"
              className="rotate-90"
            >
              <path
                d="M3 3.5L13 14.5L3 25.5"
                stroke="#CF5D9A"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>

          {/* Navigation Arrows */}
          <div className="flex items-center gap-[3px]">
            <button
              onClick={() => scroll("left")}
              className="flex h-[31px] w-10 items-center justify-center rounded-r-full border-[0.6px] border-[#D9D9D9] p-[4px] transition-opacity hover:opacity-70"
              style={{ transform: "scaleX(-1)" }}
              aria-label="Previous providers"
            >
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
                <path
                  d="M1 1L7 7L1 13"
                  stroke="rgba(187, 55, 167, 0.4)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              onClick={() => scroll("right")}
              className="flex h-[31px] w-10 items-center justify-center rounded-r-full border-[0.6px] border-[#A5A5A5] p-[4px] transition-opacity hover:opacity-70"
              aria-label="Next providers"
            >
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
                <path
                  d="M1 1L7 7L1 13"
                  stroke="#CF5D9A"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Provider Cards */}
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-8 overflow-x-auto px-[52px] scrollbar-none"
      >
        {providers.map((provider) => (
          <ProviderCard key={provider.id} provider={provider} />
        ))}
      </div>
    </section>
  );
}
