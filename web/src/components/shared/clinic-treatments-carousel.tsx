"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import Image from "next/image";
import { useRef } from "react";
import Link from "next/link";

const TREATMENT_ICON_MAP: Record<string, string> = {
  botox: "/images/landingpage/botox.png",
  dysport: "/images/landingpage/botox.png",
  "dermal-fillers": "/images/landingpage/fillers.png",
  "lip-fillers": "/images/landingpage/fillers.png",
  kybella: "/images/landingpage/fillers.png",
  sculptra: "/images/landingpage/fillers.png",
  fillers: "/images/landingpage/fillers.png",
  "laser-hair-removal": "/images/landingpage/laser.png",
  laser: "/images/landingpage/laser.png",
  "laser-skin-resurfacing": "/images/landingpage/laser.png",
  microneedling: "/images/landingpage/microneedling.png",
  prp: "/images/landingpage/microneedling.png",
  "pdo-threads": "/images/landingpage/microneedling.png",
  "chemical-peel": "/images/landingpage/checmical-peel.png",
  "skin-resurfacing": "/images/landingpage/skin-resurfacing.png",
  "iv-therapy": "/images/landingpage/iv-therapy.png",
  "iv-vitamin-therapy": "/images/landingpage/iv-therapy.png",
  "body-contouring": "/images/landingpage/body-countring.png",
  coolsculpting: "/images/landingpage/body-countring.png",
};

const DEFAULT_ICON = "/images/landingpage/fillers.png";

export interface ClinicTreatment {
  name: string;
  slug: string | null;
  price_from: number | null;
  price_unit: string | null;
}

function ClinicTreatmentCard({ treatment }: { treatment: ClinicTreatment }) {
  const icon = treatment.slug
    ? (TREATMENT_ICON_MAP[treatment.slug] ?? DEFAULT_ICON)
    : DEFAULT_ICON;

  const inner = (
    <div className="box-border flex h-[166px] w-[130px] sm:h-[201px] sm:w-[161px] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl bg-white px-[10px] pt-[3px] shadow-[0px_6px_10.5px_1px_rgba(0,0,0,0.05)] hover:-translate-y-1 transition-transform">
      <div className="flex h-[52px] w-[56px] sm:h-[62px] sm:w-[66px] items-center justify-center rounded-[10px] border border-[#F5DEE8] bg-[linear-gradient(144.23deg,#F5F0F7_-33.1%,#FFFFFF_48.72%)]">
        <div className="relative h-[26px] w-[26px] sm:h-[32px] sm:w-[32px]">
          <Image
            src={icon}
            alt={treatment.name}
            fill
            sizes="32px"
            className="object-contain"
          />
        </div>
      </div>
      <p className="flex h-auto sm:h-[30px] w-[104px] sm:w-[124px] items-center justify-center text-center font-montserrat text-[13px] sm:text-[14px] font-medium leading-[116.02%] text-[#383838]">
        {treatment.name}
      </p>
      {treatment.price_from != null && (
        <>
          <div className="w-[105px] h-0 border-t border-[rgba(245,222,232,0.5)]" />
          <p className="flex items-center justify-center text-center font-inter text-[12px] font-normal leading-[100%] text-[#9A9A9A]">
            Starting from ${treatment.price_from}
          </p>
        </>
      )}
    </div>
  );

  if (treatment.slug) {
    return (
      <Link href={`/treatments/${treatment.slug}`} className="shrink-0">
        {inner}
      </Link>
    );
  }
  return <div className="shrink-0">{inner}</div>;
}

export function ClinicTreatmentsCarousel({
  treatments,
  clinicName,
}: {
  treatments: ClinicTreatment[];
  clinicName: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      left: scrollRef.current.scrollLeft + (dir === "left" ? -169 : 169),
      behavior: "smooth",
    });
  };

  if (!treatments.length) return null;

  const firstName = clinicName.split(" ")[0];

  return (
    <section className="flex w-full flex-col items-center pt-[44px]">
      {/* Header */}
      <div className="mb-8 sm:mb-[38px] flex w-full max-w-[1342px] items-center gap-[16px] px-4">
        <h2 className="whitespace-nowrap font-montserrat text-[19px] sm:text-[34px] font-normal leading-[116.02%] tracking-[-0.04em] text-[#373634]">
          Treatment{" "}
          <span className="font-fraunces italic font-normal">Offered</span> By{" "}
          {firstName}
        </h2>
        <div className="h-0 flex-1 border-t border-[rgba(193,121,165,0.4)]" />
      </div>

      {/* Cards + Nav */}
      <div className="relative w-full max-w-[1342px] flex items-center">
        <button
          onClick={() => scroll("left")}
          aria-label="Previous treatments"
          className="absolute -left-[24px] z-10 hidden h-[48px] w-[56px] items-center justify-center rounded-l-[99px] rounded-r-none border border-r-0 border-[#E3CED8] shadow-[0px_6px_10.5px_1px_rgba(0,0,0,0.05)] hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer lg:flex"
          style={{
            background: "linear-gradient(291.82deg, #FFFFFF 33.27%, #EDD8EF 159.97%)",
          }}
        >
          <ArrowLeft size={20} color="#CF5B9D" />
        </button>

        <div
          ref={scrollRef}
          className="flex w-full gap-2 overflow-x-auto px-2 py-[38px] scrollbar-none"
        >
          {treatments.map((t) => (
            <ClinicTreatmentCard key={t.slug ?? t.name} treatment={t} />
          ))}
        </div>

        <button
          onClick={() => scroll("right")}
          aria-label="Next treatments"
          className="absolute -right-[24px] z-10 hidden h-[48px] w-[56px] items-center justify-center rounded-r-[99px] rounded-l-none border border-l-0 border-[#E3CED8] shadow-[0px_6px_10.5px_1px_rgba(0,0,0,0.05)] hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer lg:flex"
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
