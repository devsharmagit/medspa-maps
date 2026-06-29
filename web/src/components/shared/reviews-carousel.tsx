"use client";

import { useState } from "react";
import { Star, ArrowLeft, ArrowRight } from "lucide-react";

export interface SharedReviewData {
  rating: number | null;
  body: string;
  reviewer_name: string | null;
  clinic_name?: string | null;
}

export function ReviewsCarousel({ reviews }: { reviews: SharedReviewData[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const itemsPerPage = 4; // Depending on screen size, could be responsive, but let's default to 4 on large screens.

  if (!reviews || reviews.length === 0) return null;

  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(prev + itemsPerPage, reviews.length - 1));
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => Math.max(prev - itemsPerPage, 0));
  };

  return (
    <section className="mt-[100px] mb-20 relative">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-[34px] font-normal leading-[116%] tracking-[-0.04em] text-[#373634]">
          What our <span className="font-fraunces italic font-normal">Client Says</span>
        </h2>
      </div>

      <div className="relative">
        <div className="overflow-hidden">
          <div 
            className="flex gap-6 transition-transform duration-500 ease-in-out"
            style={{ transform: `translateX(-${(currentIndex / itemsPerPage) * 100}%)` }}
          >
            {reviews.map((r, idx) => (
              <div
                key={idx}
                className="w-full sm:w-[calc(50%-12px)] lg:w-[calc(25%-18px)] shrink-0 rounded-[22px] border border-[#F0E6F1] bg-white p-6 shadow-[0px_9px_11.1px_rgba(240,223,241,0.6)] flex flex-col justify-between min-h-[250px]"
              >
                <div>
                  {r.rating != null && (
                    <div className="flex gap-1 mb-4">
                      {Array.from({ length: 5 }).map((_, s) => (
                        <Star
                          key={s}
                          className={`size-[18px] ${
                            s < r.rating!
                              ? "fill-[#FFBA19] text-[#FFBA19]"
                              : "text-zinc-200"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                  <p className="text-[14px] leading-[150%] text-[#727272] italic mb-6 line-clamp-5">
                    "{r.body}"
                  </p>
                </div>
                <div className="font-semibold text-[14px] text-[#373634]">
                  - {r.reviewer_name || "Verified Patient"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation Arrows */}
        {currentIndex > 0 && (
          <button 
            onClick={handlePrev}
            className="absolute left-[-20px] top-1/2 -translate-y-1/2 flex h-[50px] w-[50px] items-center justify-center rounded-full bg-white shadow-[0px_4px_12px_rgba(0,0,0,0.1)] text-[#A8698A] hover:bg-zinc-50 z-10 transition"
          >
            <ArrowLeft className="size-5" />
          </button>
        )}
        
        {currentIndex + itemsPerPage < reviews.length && (
          <button 
            onClick={handleNext}
            className="absolute right-[-20px] top-1/2 -translate-y-1/2 flex h-[50px] w-[50px] items-center justify-center rounded-full bg-white shadow-[0px_4px_12px_rgba(0,0,0,0.1)] text-[#A8698A] hover:bg-zinc-50 z-10 transition"
          >
            <ArrowRight className="size-5" />
          </button>
        )}
      </div>
    </section>
  );
}
