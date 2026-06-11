"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import Image from "next/image";
import { useRef } from "react";

const treatments = [
  {
    name: "Fillers",
    clinics: 842,
    startingPrice: 199,
    icon: "/images/landingpage/fillers.png",
  },
  {
    name: "Botox",
    clinics: 1254,
    startingPrice: 122,
    icon: "/images/landingpage/botox.png",
  },
  {
    name: "Laser",
    clinics: 536,
    startingPrice: 99,
    icon: "/images/landingpage/laser.png",
  },
  {
    name: "Microneedling",
    clinics: 368,
    startingPrice: 299,
    icon: "/images/landingpage/microneedling.png",
  },
  {
    name: "Chemical Peel",
    clinics: 788,
    startingPrice: 69,
    icon: "/images/landingpage/checmical-peel.png",
  },
  {
    name: "Skin Resurfacing",
    clinics: 218,
    startingPrice: 299,
    icon: "/images/landingpage/skin-resurfacing.png",
  },
  {
    name: "IV Therapy",
    clinics: 524,
    startingPrice: 89,
    icon: "/images/landingpage/iv-therapy.png",
  },
  {
    name: "Body Contouring",
    clinics: 189,
    startingPrice: 199,
    icon: "/images/landingpage/body-countring.png",
  },
];

function TreatmentCard({
  name,
  clinics,
  startingPrice,
  icon,
}: {
  name: string;
  clinics: number;
  startingPrice: number;
  icon: string;
}) {
  return (
    <div className="box-border flex h-[201px] w-[161px] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl bg-white px-[10px] pt-[3px] shadow-[0px_6px_10.5px_1px_rgba(0,0,0,0.05)]">
      <div className="flex h-[62px] w-[66px] items-center justify-center rounded-[10px] border border-[#F5DEE8] bg-[linear-gradient(144.23deg,#F5F0F7_-33.1%,#FFFFFF_48.72%)]">
        <div className="relative h-[32px] w-[32px]">
          <Image
            src={icon}
            alt={name}
            fill
            sizes="32px"
            className="object-contain"
          />
        </div>
      </div>

      {/* Title */}
      <p className="flex h-[30px] w-[124px] items-center justify-center text-center font-montserrat text-[14px] font-medium leading-[116.02%] text-[#383838]">
        {name}
      </p>

      {/* Clinics */}
      <p className="flex items-center justify-center text-center font-inter text-[12px] font-normal leading-[100%] text-[#9A9A9A]">
        {clinics} clinics
      </p>

      {/* Divider */}
      <div className="w-[105px] border-t border-[rgba(245,222,232,0.5)]" />

      {/* Price */}
      <p className="flex items-end justify-center text-center font-inter text-[12px] font-normal leading-[100%] text-[#9A9A9A]">
        Starting from ${startingPrice}
      </p>
    </div>
  );
}

export function PopularTreatments() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 169; // card width + gap
      scrollContainerRef.current.scrollTo({
        left:
          scrollContainerRef.current.scrollLeft +
          (direction === "left" ? -scrollAmount : scrollAmount),
        behavior: "smooth",
      });
    }
  };

  return (
    <section className="flex w-full flex-col items-center pt-[44px]">
      {/* ── Section Header ── */}
      <div className="mb-[38px] flex h-[39px] w-full max-w-[1342px] items-center gap-[40px] px-4">
        <div className="h-0 flex-1 border-t border-[rgba(193,121,165,0.4)]" />
        <h2 className="whitespace-nowrap text-center font-montserrat text-[34px] font-normal leading-[116.02%] tracking-[-0.04em] text-[#373634]">
          Popular <span className="font-heading">Treatments</span>
        </h2>
        <div className="h-0 flex-1 border-t border-[rgba(193,121,165,0.4)]" />
      </div>

      {/* ── Cards + Nav ── */}
      <div className="relative w-full max-w-[1342px] flex items-center">
        {/* Left arrow — pill on left, flat on right, centered vertically */}
        <button
          onClick={() => scroll("left")}
          aria-label="Previous treatments"
          className="absolute -left-[24px] z-10 flex h-[48px] w-[56px] items-center justify-center rounded-l-[99px] rounded-r-none border border-r-0 border-[#E3CED8] shadow-[0px_6px_10.5px_1px_rgba(0,0,0,0.05)] hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
          style={{
            background: "linear-gradient(291.82deg, #FFFFFF 33.27%, #EDD8EF 159.97%)",
          }}
        >
          <ArrowLeft size={20} color="#CF5B9D" />
        </button>

        {/* Scrollable card row */}
        <div
          ref={scrollContainerRef}
          className="flex w-full gap-2 overflow-x-auto px-2 py-[38px] scrollbar-none"
        >
          {treatments.map((treatment) => (
            <TreatmentCard key={treatment.name} {...treatment} />
          ))}
        </div>

        {/* Right arrow — flat on left, pill on right, centered vertically */}
        <button
          onClick={() => scroll("right")}
          aria-label="Next treatments"
          className="absolute -right-[24px] z-10 flex h-[48px] w-[56px] items-center justify-center rounded-r-[99px] rounded-l-none border border-l-0 border-[#E3CED8] shadow-[0px_6px_10.5px_1px_rgba(0,0,0,0.05)] hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
          style={{
            background: "linear-gradient(111.82deg, #FFFFFF 33.27%, #EDD8EF 159.97%)",
          }}
        >
          <ArrowRight size={20} color="#CF5B9D" />
        </button>
      </div>
    </section>
  );
}
