"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useEffect } from "react";

const statesList = [
  { label: "California", value: "CA" },
  { label: "Texas", value: "TX" },
  { label: "Florida", value: "FL" },
  { label: "New York", value: "NY" },
  { label: "Arizona", value: "AZ" },
  { label: "Georgia", value: "GA" },
  { label: "Colorado", value: "CO" },
  { label: "Illinois", value: "IL" },
  { label: "Nevada", value: "NV" },
  { label: "Washington", value: "WA" },
  { label: "Virginia", value: "VA" },
  { label: "New Jersey", value: "NJ" },
  { label: "Massachusetts", value: "MA" },
  { label: "North Carolina", value: "NC" },
  { label: "Tennessee", value: "TN" },
];

export function TopCities() {
  const router = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScrollLimits = () => {
    const container = scrollContainerRef.current;
    if (container) {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      setCanScrollLeft(scrollLeft > 2);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", checkScrollLimits);
      checkScrollLimits();
      window.addEventListener("resize", checkScrollLimits);
    }
    return () => {
      if (container) {
        container.removeEventListener("scroll", checkScrollLimits);
      }
      window.removeEventListener("resize", checkScrollLimits);
    };
  }, []);

  const handleScroll = (direction: "left" | "right") => {
    const container = scrollContainerRef.current;
    if (container) {
      const scrollAmount = 300;
      container.scrollTo({
        left:
          direction === "left"
            ? container.scrollLeft - scrollAmount
            : container.scrollLeft + scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const handleStateClick = (stateValue: string) => {
    const params = new URLSearchParams();
    params.set("location", stateValue);
    router.push(`/search?${params.toString()}`);
  };

  return (
    <section className="mx-auto flex w-full max-w-[1372px] flex-col items-center justify-center gap-4 py-6 px-4 lg:px-0">
      {/* Header Row */}
      <div className="flex w-full items-center justify-between h-[39px]">
        <h2 className="font-montserrat font-normal text-[#373634] text-[28px] sm:text-[34px] tracking-[-0.04em] leading-[116.02%]">
          Top <span className="font-heading italic">States</span>
        </h2>

        {/* Carousel Arrows */}
        <div className="flex items-center gap-[3px] h-[31px]">
          <button
            onClick={() => handleScroll("left")}
            disabled={!canScrollLeft}
            className={`box-sizing-border-box flex h-[31px] w-[40px] justify-center items-center rounded-l-[99px] rounded-r-none border border-[#DEC6DF] bg-white transition-all ${
              canScrollLeft
                ? "cursor-pointer hover:bg-pink-50 active:scale-95"
                : "opacity-40 cursor-default"
            }`}
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4.5 w-4.5 text-[#CF5D9A]" />
          </button>

          <button
            onClick={() => handleScroll("right")}
            disabled={!canScrollRight}
            className={`box-sizing-border-box flex h-[31px] w-[40px] justify-center items-center rounded-r-[99px] rounded-l-none border border-[#DEC6DF] bg-white transition-all ${
              canScrollRight
                ? "cursor-pointer hover:bg-pink-50 active:scale-95"
                : "opacity-40 cursor-default"
            }`}
            aria-label="Scroll right"
          >
            <ChevronRight className="h-4.5 w-4.5 text-[#CF5D9A]" />
          </button>
        </div>
      </div>

      {/* States Row */}
      <div
        ref={scrollContainerRef}
        className="flex w-full gap-2.5 sm:gap-[14px] overflow-x-auto pb-4 scroll-smooth scrollbar-none snap-x snap-mandatory"
        onScroll={checkScrollLimits}
      >
        {statesList.map((state) => (
          <button
            key={state.value}
            onClick={() => handleStateClick(state.value)}
            className="box-sizing-border-box flex h-[50px] w-[138px] sm:h-[63px] sm:w-[184px] shrink-0 items-center justify-center rounded-[14px] sm:rounded-[16px] border border-[#FCEAFE] bg-white px-2.5 py-px shadow-[0px_6px_10.5px_1px_rgba(0,0,0,0.03)] hover:border-[#CB97CE] hover:shadow-[0px_6px_12px_2px_rgba(203,151,206,0.1)] transition-all snap-start cursor-pointer"
          >
            <span className="font-montserrat font-medium text-[15px] sm:text-[18px] leading-[116.02%] tracking-[0.02em] text-[#616161]">
              {state.label}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
