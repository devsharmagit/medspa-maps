"use client";

import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import Image from "next/image";
import { useRef } from "react";

const testimonials = [
  {
    id: 1,
    name: "Jessica R.",
    rating: 4.5,
    text: "Found the best provider near me. Easy booking and amazing results!",
    image: "/images/hero/avatar-1.png",
  },
  {
    id: 2,
    name: "Jessica R.",
    rating: 5,
    text: "Found the best provider near me. Easy booking and amazing results!",
    image: "/images/hero/avatar-2.png",
  },
  {
    id: 3,
    name: "Jessica R.",
    rating: 4.5,
    text: "Found the best provider near me. Easy booking and amazing results!",
    image: "/images/hero/avatar-3.png",
  },
  {
    id: 4,
    name: "Jessica R.",
    rating: 5,
    text: "Found the best provider near me. Easy booking and amazing results!",
    image: "/images/hero/avatar-4.png",
  },
  {
    id: 5,
    name: "Jessica R.",
    rating: 4.5,
    text: "Found the best provider near me. Easy booking and amazing results!",
    image: "/images/hero/avatar-5.png",
  },
];

function TestimonialCard({
  testimonial,
}: {
  testimonial: (typeof testimonials)[0];
}) {
  const fullStars = Math.floor(testimonial.rating);
  const hasHalfStar = testimonial.rating % 1 !== 0;

  return (
    <div className="relative h-[239px] w-[336px] shrink-0 overflow-hidden rounded-2xl bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
      {/* Left side - Text content */}
      <div className="absolute left-0 top-0 flex h-full w-[180px] flex-col items-start justify-between bg-white p-6">
        {/* Stars */}
        <div className="flex items-center gap-1">
          {[...Array(fullStars)].map((_, i) => (
            <Star
              key={i}
              className="h-4 w-4 fill-[#FFBA19] text-[#FFBA19]"
            />
          ))}
          {hasHalfStar && (
            <div className="relative h-4 w-4">
              <Star className="absolute h-4 w-4 text-[#FFBA19]" />
              <div className="absolute left-0 top-0 h-4 w-2 overflow-hidden">
                <Star className="h-4 w-4 fill-[#FFBA19] text-[#FFBA19]" />
              </div>
            </div>
          )}
        </div>

        {/* Testimonial Text */}
        <p className="font-montserrat text-sm leading-[140%] text-[#6B6B6B]">
          {testimonial.text}
        </p>

        {/* Author */}
        <p className="font-montserrat text-sm font-medium text-[#383838]">
          - {testimonial.name}
        </p>
      </div>

      {/* Right side - Image */}
      <div className="absolute right-0 top-0 h-full w-[156px]">
        <Image
          src={testimonial.image}
          alt={testimonial.name}
          fill
          className="rounded-r-2xl object-cover"
        />
      </div>
    </div>
  );
}

export function Testimonials() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 360; // Card width + gap
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
    <section className="flex w-full max-w-[1372px] flex-col items-start gap-6 py-8">
      {/* Header */}
      <div className="flex w-full items-center justify-between">
        {/* Title */}
        <h2 className="font-montserrat text-[40px] font-normal leading-[116.02%] text-[#383838]">
          What our <span className="font-heading italic">Client Says</span>
        </h2>

        {/* View All and Navigation */}
        <div className="flex items-center gap-6">
          {/* View All Link */}
          <a
            href="#"
            className="flex items-center gap-2 transition-opacity hover:opacity-70"
          >
            <span className="font-montserrat text-base font-medium text-[#CF5D9A]">
              View All Reviews
            </span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="rotate-180"
            >
              <path
                d="M10 4L6 8L10 12"
                stroke="#CF5D9A"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>

          {/* Navigation Arrows */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => scroll("left")}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#E8E8E8] bg-white transition-colors hover:bg-gray-50"
              aria-label="Previous testimonials"
            >
              <ChevronLeft className="h-5 w-5 text-[#8B8B8B]" />
            </button>
            <button
              onClick={() => scroll("right")}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#E8E8E8] bg-white transition-colors hover:bg-gray-50"
              aria-label="Next testimonials"
            >
              <ChevronRight className="h-5 w-5 text-[#8B8B8B]" />
            </button>
          </div>
        </div>
      </div>

      {/* Testimonial Cards */}
      <div
        ref={scrollContainerRef}
        className="flex w-full gap-6 overflow-x-auto scrollbar-none"
      >
        {testimonials.map((testimonial) => (
          <TestimonialCard key={testimonial.id} testimonial={testimonial} />
        ))}
      </div>
    </section>
  );
}
