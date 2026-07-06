"use client";

import { useRef } from "react";
import { Star, ArrowLeft, ArrowRight } from "lucide-react";

interface ClinicReview {
  rating: number | null;
  body: string;
  reviewer_name: string | null;
}

function StarRating({ rating }: { rating: number | null }) {
  const filled = rating != null ? Math.round(rating) : 0;
  return (
    <div className="flex items-center gap-[3px]">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-[17px] w-[18px] ${
            i < filled
              ? "fill-[#FFBA19] text-[#FFBA19]"
              : "fill-[#E0E0E0] text-[#E0E0E0]"
          }`}
        />
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: ClinicReview }) {
  return (
    <div className="relative flex w-[290px] sm:w-[305px] shrink-0" style={{ paddingTop: "27px" }}>
      {/* Depth layer — furthest back */}
      <div className="absolute top-[7px] left-[5px] right-[-1px] bottom-0 rounded-[22px] bg-white/40 border border-[rgba(233,233,233,0.6)] shadow-[0px_6px_10.5px_1px_rgba(0,0,0,0.05)]" />
      {/* Depth layer — middle */}
      <div className="absolute top-[14px] left-[3px] right-[-1px] bottom-0 rounded-[22px] bg-white/60 border border-[rgba(233,233,233,0.8)] shadow-[0px_6px_10.5px_1px_rgba(0,0,0,0.05)]" />
      {/* Main front card — fills the row height so short reviews don't float */}
      <div className="relative flex w-full min-h-[186px] flex-col gap-[14px] rounded-[22px] bg-white shadow-[0px_6px_10.5px_1px_rgba(0,0,0,0.05)] px-[25px] py-[20px]">
        <StarRating rating={review.rating} />
        <p className="flex-1 font-montserrat text-[14px] font-normal leading-[138%] tracking-[0.02em] text-[#727272] line-clamp-5">
          {review.body}
        </p>
        <span className="font-montserrat text-[16px] font-medium leading-[116.02%] tracking-[0.02em] text-[#393939]">
          - {review.reviewer_name || "Verified Patient"}
        </span>
      </div>
    </div>
  );
}

export function ClinicReviewsSection({
  reviews,
}: {
  reviews: ClinicReview[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!reviews || reviews.length === 0) return null;

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      left: scrollRef.current.scrollLeft + (dir === "left" ? -329 : 329),
      behavior: "smooth",
    });
  };

  return (
    <section className="box-border flex w-full flex-col items-center gap-6 rounded-[18px] border border-[#DEDEDE] bg-white pt-8 sm:pt-10 pb-6 sm:pb-[24px] shadow-[0px_9px_11.1px_rgba(240,223,241,0.6)]">
      {/* Header */}
      <div className="flex w-full flex-row items-center justify-between px-[20px] sm:px-[64px]">
        <h2 className="font-montserrat text-[22px] sm:text-[34px] font-normal leading-[116.02%] tracking-[-0.04em] text-[#373634]">
          What our{" "}
          <span className="font-fraunces italic font-normal">patient says</span>
        </h2>
        <div className="flex h-[31px] items-center gap-[3px]">
          <button
            onClick={() => scroll("left")}
            aria-label="Previous review"
            className="flex h-[31px] w-[40px] cursor-pointer items-center justify-center rounded-l-full border-[0.6px] border-[#D9D9D9] bg-white hover:bg-gray-50 active:bg-gray-100"
          >
            <ArrowLeft className="h-[14px] w-[14px] text-[#CF5D9A] opacity-40" />
          </button>
          <button
            onClick={() => scroll("right")}
            aria-label="Next review"
            className="flex h-[31px] w-[40px] cursor-pointer items-center justify-center rounded-r-full border-[0.6px] border-[#A5A5A5] bg-white hover:bg-gray-50 active:bg-gray-100"
          >
            <ArrowRight className="h-[14px] w-[14px] text-[#CF5D9A]" />
          </button>
        </div>
      </div>

      {/* Scrollable review cards */}
      <div
        ref={scrollRef}
        className="flex w-full gap-[24px] overflow-x-auto scrollbar-none px-[20px] sm:px-[64px] pb-[20px]"
      >
        {reviews.map((review, idx) => (
          <ReviewCard key={idx} review={review} />
        ))}
      </div>
    </section>
  );
}
