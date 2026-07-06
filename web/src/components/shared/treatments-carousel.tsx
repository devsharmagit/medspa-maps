"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRef, useState, useEffect } from "react";

interface Service {
  id: string;
  name: string;
  description: string;
  clinic_count: number;
}

interface Props {
  providerName: string;
  services: Service[];
}

export function TreatmentsCarousel({ providerName, services }: Props) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScrollability = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(Math.ceil(scrollLeft) < scrollWidth - clientWidth);
    }
  };

  useEffect(() => {
    checkScrollability();
    window.addEventListener("resize", checkScrollability);
    return () => window.removeEventListener("resize", checkScrollability);
  }, [services]);

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

  if (services.length === 0) return null;

  return (
    <section className="flex flex-col gap-[36px] mt-[40px] mb-[40px]">
      {/* ── Header (Left Aligned) ── */}
      <div className="flex items-center gap-[16px]">
        <h2 className="text-[20px] sm:text-[28px] font-normal tracking-[-0.02em] text-[#373634] shrink-0">
          Treatment <span className="font-fraunces italic font-normal text-[#373634]">Offered</span> By {providerName}
        </h2>
        <div className="h-[1px] bg-[#E5C7DA]/60 w-full"></div>
      </div>

      {/* ── Cards + Nav ── */}
      <div className="relative w-full flex items-center">
        {/* Left arrow */}
        <button
          onClick={() => scroll("left")}
          aria-label="Previous treatments"
          className={`absolute -left-[24px] z-10 h-[48px] w-[56px] items-center justify-center rounded-l-[99px] rounded-r-none border border-r-0 border-[#E3CED8] shadow-[0px_6px_10.5px_1px_rgba(0,0,0,0.05)] hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer ${canScrollLeft ? "hidden lg:flex" : "hidden"}`}
          style={{
            background: "linear-gradient(291.82deg, #FFFFFF 33.27%, #EDD8EF 159.97%)",
          }}
        >
          <ArrowLeft size={20} color="#CF5B9D" />
        </button>

        {/* Scrollable card row */}
        <div
          ref={scrollContainerRef}
          onScroll={checkScrollability}
          className="flex w-full gap-[8px] overflow-x-auto px-[10px] py-[10px] scrollbar-none snap-x snap-mandatory"
        >
          {services.map((svc) => {
            const n = svc.name.toLowerCase();
            let icon = "/images/landingpage/botox.png";
            if (n.includes("filler")) icon = "/images/landingpage/fillers.png";
            else if (n.includes("botox") || n.includes("neuromodulator") || n.includes("toxin")) icon = "/images/landingpage/botox.png";
            else if (n.includes("laser")) icon = "/images/landingpage/laser.png";
            else if (n.includes("microneedling")) icon = "/images/landingpage/microneedling.png";
            else if (n.includes("peel")) icon = "/images/landingpage/checmical-peel.png";
            else if (n.includes("resurfacing")) icon = "/images/landingpage/skin-resurfacing.png";
            else if (n.includes("iv")) icon = "/images/landingpage/iv-therapy.png";
            else if (n.includes("contour") || n.includes("sculpt")) icon = "/images/landingpage/body-countring.png";

            return (
              <div
                key={svc.id}
                className="box-border flex h-[166px] w-[130px] sm:h-[201px] sm:w-[161px] shrink-0 flex-col items-center justify-center gap-[8px] rounded-[16px] bg-white px-[10px] pt-[3px] shadow-[0px_6px_10.5px_1px_rgba(0,0,0,0.05)] snap-start"
              >
                <div className="flex h-[52px] w-[56px] sm:h-[62px] sm:w-[66px] items-center justify-center rounded-[10px] border border-[#F5DEE8] bg-[linear-gradient(144.23deg,#F5F0F7_-33.1%,#FFFFFF_48.72%)]">
                  <div className="relative h-[26px] w-[26px] sm:h-[32px] sm:w-[32px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={icon}
                      alt={svc.name}
                      className="object-contain w-full h-full"
                    />
                  </div>
                </div>

                {/* Title */}
                <p className="flex h-auto sm:h-[30px] w-[104px] sm:w-[124px] items-center justify-center text-center font-montserrat text-[13px] sm:text-[14px] font-medium leading-[116.02%] text-[#383838]">
                  {svc.name}
                </p>
              </div>
            );
          })}
        </div>

        {/* Right arrow */}
        <button
          onClick={() => scroll("right")}
          aria-label="Next treatments"
          className={`absolute -right-[24px] z-10 h-[48px] w-[56px] items-center justify-center rounded-r-[99px] rounded-l-none border border-l-0 border-[#E3CED8] shadow-[0px_6px_10.5px_1px_rgba(0,0,0,0.05)] hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer ${canScrollRight ? "hidden lg:flex" : "hidden"}`}
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
