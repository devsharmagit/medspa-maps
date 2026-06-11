"use client";

import { useRef } from "react";
import Image from "next/image";
import { Star } from "lucide-react";

// ─── Testimonials Data ────────────────────────────────────────────────────────

const testimonials = [
  {
    id: 1,
    name: "Jessica R.",
    rating: 4.5,
    text: "Found the best provider near me. Easy booking and amazing results!",
    image: "/images/landingpage/client-1.png",
  },
  {
    id: 2,
    name: "Jessica R.",
    rating: 5,
    text: "Found the best provider near me. Easy booking and amazing results!",
    image: "/images/landingpage/client-2.png",
  },
  {
    id: 3,
    name: "Jessica R.",
    rating: 4.5,
    text: "Found the best provider near me. Easy booking and amazing results!",
    image: "/images/landingpage/client-1.png",
  },
  {
    id: 4,
    name: "Jessica R.",
    rating: 5,
    text: "Found the best provider near me. Easy booking and amazing results!",
    image: "/images/landingpage/client-2.png",
  },
];

// ─── TestimonialCard Component ───────────────────────────────────────────────

function TestimonialCard({
  testimonial,
}: {
  testimonial: (typeof testimonials)[0];
}) {
  const fullStars = Math.floor(testimonial.rating);
  const hasHalfStar = testimonial.rating % 1 !== 0;

  return (
    <div
      className="relative shrink-0 select-none overflow-visible"
      style={{
        width: 381,
        height: 293,
      }}
    >
      {/* Layer 1 (deepest bg, furthest back) */}
      <div
        className="absolute rounded-[22px] border bg-white/40 shadow-sm"
        style={{
          top: 10.5,
          left: 7,
          width: 366,
          height: 255,
          borderColor: "rgba(233, 233, 233, 0.6)",
          boxShadow: "0px 6px 10.5px 1px rgba(0, 0, 0, 0.05)",
          zIndex: 1,
        }}
      />

      {/* Layer 2 (middle bg) */}
      <div
        className="absolute rounded-[22px] border bg-white/60 shadow-sm"
        style={{
          top: 17.5,
          left: 4,
          width: 373,
          height: 260,
          borderColor: "rgba(233, 233, 233, 0.8)",
          boxShadow: "0px 6px 10.5px 1px rgba(0, 0, 0, 0.05)",
          zIndex: 2,
        }}
      />

      {/* Layer 3 (main front card) */}
      <div
        className="absolute rounded-[22px] bg-white border border-[#E9E9E9]/60 shadow-sm"
        style={{
          top: 24,
          left: 1,
          width: 380,
          height: 269,
          boxShadow: "0px 6px 10.5px 1px rgba(0, 0, 0, 0.05)",
          zIndex: 3,
        }}
      >
        {/* Left content block: stars, text, author */}
        <div
          className="absolute flex flex-col gap-[19px] items-start"
          style={{
            left: 26.5,
            top: 28.5,
            width: 167,
            height: 164,
          }}
        >
          {/* Star Rating Row */}
          <div className="flex items-center gap-[3px] h-[17px]">
            {[...Array(5)].map((_, i) => {
              if (i < fullStars) {
                return (
                  <Star
                    key={i}
                    className="h-[17px] w-[18px] fill-[#FFBA19] text-[#FFBA19]"
                    strokeWidth={0}
                  />
                );
              } else if (i === fullStars && hasHalfStar) {
                return (
                  <div key={i} className="relative h-[17px] w-[18px]">
                    <Star className="absolute h-[17px] w-[18px] text-[#E5E5E5] fill-[#E5E5E5]" strokeWidth={0} />
                    <div className="absolute left-0 top-0 h-[17px] w-[9px] overflow-hidden">
                      <Star className="h-[17px] w-[18px] fill-[#FFBA19] text-[#FFBA19]" strokeWidth={0} />
                    </div>
                  </div>
                );
              } else {
                return (
                  <Star
                    key={i}
                    className="h-[17px] w-[18px] fill-[#E5E5E5] text-[#E5E5E5]"
                    strokeWidth={0}
                  />
                );
              }
            })}
          </div>

          {/* Testimonial text */}
          <p
            className="font-montserrat text-[#727272] tracking-[0.02em] font-normal"
            style={{
              fontSize: 16,
              lineHeight: "138%",
              width: 167,
            }}
          >
            {testimonial.text}
          </p>

          {/* Author */}
          <p
            className="font-montserrat text-[#393939] tracking-[0.02em] font-medium"
            style={{
              fontSize: 18,
              lineHeight: "116.02%",
              width: 167,
            }}
          >
            - {testimonial.name}
          </p>
        </div>
      </div>

      {/* Mask group (Clipping Container for the Client Image) */}
      <div
        className="absolute overflow-hidden pointer-events-none"
        style={{
          width: 380,
          height: 308,
          left: 1,
          top: -25,
          borderRadius: 22,
          zIndex: 4, // above Layer 3
        }}
      >
        {/* Client Image inside the mask */}
        <div
          className="absolute"
          style={{
            width: 309,
            height: 295,
            left: 155,
            top: 13, // top: -12px relative to wrapper
          }}
        >
          <Image
            src={testimonial.image}
            alt={testimonial.name}
            fill
            sizes="309px"
            className="object-contain"
            style={{ transform: "scaleX(-1)" }}
            priority
          />
        </div>
      </div>
    </div>
  );
}

// ─── Testimonials Main Component ──────────────────────────────────────────────

export function Testimonials() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 435; // Wrapper width 381px + gap 54px
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
    <section
      className="mx-auto flex w-full max-w-[1372px] flex-col justify-center items-center bg-white border border-[#DEDEDE] rounded-[18px] py-[35px] px-0 overflow-hidden"
      style={{
        boxShadow: "0px 9px 11.1px rgba(240, 223, 241, 0.6)",
        minHeight: 462,
        gap: 29,
      }}
    >
      {/* ── Header Row ── */}
      <div className="flex w-full items-center justify-between px-6 lg:px-16 h-[39px]">
        {/* Section Title */}
        <h2 className="w-auto font-montserrat text-4xl lg:text-[34px] font-normal leading-[116.02%] tracking-[-0.04em] text-[#373634]">
          What our <span className="font-heading italic">Client Says</span>
        </h2>

        {/* View All & Navigation Arrows */}
        <div className="flex items-center gap-[32px] h-[31px]">
          {/* View All Reviews Link */}
          <a
            href="#"
            className="flex items-center gap-[5px] transition-opacity hover:opacity-75 h-[19px]"
          >
            <span className="font-montserrat text-[16px] font-medium leading-[116.02%] text-[#CF5D9A]">
              View All Reviews
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12H19M19 12L12 5M19 12L12 19"
                stroke="#CF5D9A"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>

          {/* Navigation Arrow Pill Buttons */}
          <div className="flex items-center h-[31px]">
            {/* Prev button */}
            <button
              onClick={() => scroll("left")}
              className="flex h-[31px] w-10 items-center justify-center rounded-l-full border border-r-0 border-[#D9D9D9] transition-colors hover:bg-gray-50 cursor-pointer"
              aria-label="Previous testimonials"
            >
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
                <path
                  d="M7 1L1 7L7 13"
                  stroke="rgba(187, 55, 167, 0.4)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {/* Next button */}
            <button
              onClick={() => scroll("right")}
              className="flex h-[31px] w-10 items-center justify-center rounded-r-full border border-[#A5A5A5] transition-colors hover:bg-gray-50 cursor-pointer"
              aria-label="Next testimonials"
            >
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
                <path
                  d="M1 1L7 7L1 13"
                  stroke="#BB37A7"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Testimonial Cards Slider ── */}
      <div
        ref={scrollContainerRef}
        className="flex w-full gap-[54px] overflow-x-auto px-6 lg:px-16 scrollbar-none pt-[50px] pb-[20px] select-none overflow-y-visible"
        style={{
          width: "100%",
        }}
      >
        {testimonials.map((testimonial) => (
          <div key={testimonial.id} className="shrink-0">
            <TestimonialCard testimonial={testimonial} />
          </div>
        ))}
      </div>
    </section>
  );
}
