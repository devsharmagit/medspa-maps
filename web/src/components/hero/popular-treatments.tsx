"use client";

import { ArrowLeft, ArrowRight, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef } from "react";

import { POPULAR_TREATMENTS } from "@/data/popular-treatments";
import { formatCountPlus } from "@/lib/utils";
import { useDragScroll } from "@/lib/hooks/use-drag-scroll";

interface PopularTreatmentsProps {
  titleNode?: React.ReactNode;
}

function TreatmentCard({
  slug,
  name,
  clinicCount,
  icon: Icon,
  onNavigate,
}: {
  slug: string;
  name: string;
  clinicCount: number;
  icon: LucideIcon;
  onNavigate: (slug: string) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      draggable={false}
      onClick={() => onNavigate(slug)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onNavigate(slug);
        }
      }}
      className="box-border flex h-[166px] w-[130px] sm:h-[201px] sm:w-[161px] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl bg-white px-[10px] pt-[3px] shadow-[0px_6px_10.5px_1px_rgba(0,0,0,0.05)] transition-transform hover:scale-105 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#CF5B9D]/60"
    >
      <div className="flex h-[52px] w-[56px] sm:h-[62px] sm:w-[66px] items-center justify-center rounded-[10px] border border-[#F5DEE8] bg-[linear-gradient(144.23deg,#F5F0F7_-33.1%,#FFFFFF_48.72%)]">
        <Icon
          className="h-[26px] w-[26px] sm:h-[32px] sm:w-[32px]"
          strokeWidth={1.75}
          color="#CF5B9D"
          aria-hidden="true"
        />
      </div>

      {/* Title */}
      <p className="flex h-auto sm:h-[30px] w-[104px] sm:w-[124px] items-center justify-center text-center font-montserrat text-[13px] sm:text-[14px] font-medium leading-[116.02%] text-[#383838]">
        {name}
      </p>

      {/* Clinics */}
      <p className="flex items-center justify-center text-center font-inter text-[11px] sm:text-[12px] font-normal leading-[100%] text-[#9A9A9A]">
        {formatCountPlus(clinicCount)} practices
      </p>
    </div>
  );
}

export function PopularTreatments({ titleNode }: PopularTreatmentsProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Cards are plain buttons (not <Link>) so a drag never grabs/ghosts an anchor.
  // Navigation happens here on a genuine click (drags are cancelled in onClickCapture).
  const navigate = (slug: string) => router.push(`/search?q=${slug}`);

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 181; // card width + gap
      scrollContainerRef.current.scrollTo({
        left:
          scrollContainerRef.current.scrollLeft +
          (direction === "left" ? -scrollAmount : scrollAmount),
        behavior: "smooth",
      });
    }
  };

  // Click-and-hold drag-to-scroll (mouse/pen); touch uses native scroll.
  const dragScroll = useDragScroll(scrollContainerRef);

  return (
    <section className="flex w-full flex-col items-center pt-[44px] lg:px-8">
      {/* ── Section Header ── */}
      <div className="mb-[38px] flex h-[39px] w-full max-w-[1342px] items-center gap-4 sm:gap-[40px] px-4">
        <div className="h-0 flex-1 border-t border-[rgba(193,121,165,0.4)]" />
        <h2 className="whitespace-nowrap text-center font-montserrat text-[26px] sm:text-[30px] lg:text-[34px] font-normal leading-[116.02%] tracking-[-0.04em] text-[#373634]">
          {titleNode || (
            <>
              Popular <span className="font-heading">Treatments</span>
            </>
          )}
        </h2>
        <div className="h-0 flex-1 border-t border-[rgba(193,121,165,0.4)]" />
      </div>

      {/* ── Cards + Nav ── */}
      <div className="relative w-full max-w-[1342px] flex items-center">
        {/* Left arrow — pill on left, flat on right, centered vertically */}
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

        {/* Scrollable card row */}
        <div
          ref={scrollContainerRef}
          {...dragScroll}
          className="flex w-full gap-4 sm:gap-5 overflow-x-auto px-2 py-[38px] scrollbar-none select-none cursor-grab active:cursor-grabbing"
        >
          {POPULAR_TREATMENTS.map((treatment) => (
            <TreatmentCard key={treatment.slug} {...treatment} onNavigate={navigate} />
          ))}
        </div>

        {/* Right arrow — flat on left, pill on right, centered vertically */}
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
