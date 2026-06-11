"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useEffect } from "react";

const citiesList = [
  "Los Angeles",
  "Miami",
  "New York",
  "Dallas",
  "Chicago",
  "Illinois",
  "Georgia",
];

export function TopCities() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScrollLimits = () => {
    const container = scrollContainerRef.current;
    if (container) {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      // Buffer of 2px to prevent rounding issues
      setCanScrollLeft(scrollLeft > 2);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", checkScrollLimits);
      // Run initially and after window resizing
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
      const scrollAmount = 300; // scroll by ~1.5 cards
      const targetScroll =
        direction === "left"
          ? container.scrollLeft - scrollAmount
          : container.scrollLeft + scrollAmount;

      container.scrollTo({
        left: targetScroll,
        behavior: "smooth",
      });
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-[1372px] flex-col items-center justify-center gap-4 py-6 px-4 lg:px-0">
      {/* Header Row */}
      <div className="flex w-full items-center justify-between h-[39px]">
        {/* Title */}
        <h2 className="font-montserrat font-normal text-[#373634] text-[28px] sm:text-[34px] tracking-[-0.04em] leading-[116.02%]">
          Top <span className="font-heading italic">Cities</span>
        </h2>

        {/* Navigation & Action Wrapper */}
        <div className="flex items-center gap-[32px] h-[31px]">
          {/* View All Button */}
          <Link
            href="/locations"
            className="group flex items-center gap-[5px] h-[19px]"
          >
            <span className="font-montserrat font-medium text-[16px] leading-[116.02%] text-[#CF5D9A]">
              View All
            </span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="inline-block transition-transform group-hover:translate-x-1"
            >
              <path
                d="M3.33331 8H12.6666M12.6666 8L8 3.33331M12.6666 8L8 12.6666"
                stroke="#CF5D9A"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>

          {/* Carousel Arrows Capsule */}
          <div className="flex items-center gap-[3px] h-[31px]">
            {/* Left Scroll Button */}
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

            {/* Right Scroll Button */}
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
      </div>

      {/* Cities Row */}
      <div
        ref={scrollContainerRef}
        className="flex w-full gap-[14px] overflow-x-auto pb-4 scroll-smooth scrollbar-none snap-x snap-mandatory"
        onScroll={checkScrollLimits}
      >
        {citiesList.map((city, index) => (
          <Link
            href={`/locations/${city.toLowerCase().replace(/\s+/g, "-")}`}
            key={index}
            className="box-sizing-border-box flex h-[63px] w-[184px] shrink-0 items-center justify-center rounded-[16px] border border-[#FCEAFE] bg-white px-2.5 py-px shadow-[0px_6px_10.5px_1px_rgba(0,0,0,0.03)] hover:border-[#CB97CE] hover:shadow-[0px_6px_12px_2px_rgba(203,151,206,0.1)] transition-all snap-start"
          >
            <span className="font-montserrat font-medium text-[18px] leading-[116.02%] tracking-[0.02em] text-[#616161]">
              {city}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
