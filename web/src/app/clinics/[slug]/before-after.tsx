"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Lightbox, type GalleryImage } from "./gallery";

/**
 * "Before & After" — horizontal carousel of the clinic's before/after treatment
 * photos (single composite images). Separate from the regular gallery. Mirrors
 * the OtherProvidersCarousel / ReviewsSection look; tiles are landscape (the
 * composites are wide) and open the shared full-screen Lightbox on click.
 */
export function ClinicBeforeAfterCarousel({
  images,
  name,
}: {
  images: GalleryImage[];
  name: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const checkScrollability = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(Math.ceil(scrollLeft) < scrollWidth - clientWidth);
  };

  useEffect(() => {
    checkScrollability();
    window.addEventListener("resize", checkScrollability);
    return () => window.removeEventListener("resize", checkScrollability);
  }, [images]);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      left: scrollRef.current.scrollLeft + (dir === "left" ? -324 : 324),
      behavior: "smooth",
    });
  };

  if (images.length === 0) return null;

  return (
    <section className="box-border flex w-full flex-col items-start gap-[16px] rounded-[18px] border border-[#DEDEDE] bg-white py-[40px] shadow-[0px_9px_11.1px_rgba(240,223,241,0.6)]">
      {/* Header */}
      <div className="flex w-full flex-row items-center justify-between px-[20px] sm:px-[48px]">
        <h2 className="font-montserrat text-[22px] sm:text-[34px] font-normal leading-[116.02%] tracking-[-0.04em] text-[#373634]">
          Before &amp; <span className="font-fraunces italic">After</span>
        </h2>

        <div className="hidden sm:flex h-[31px] w-[83px] flex-row items-center gap-[3px]">
          <button
            onClick={() => scroll("left")}
            aria-label="Previous before & after"
            disabled={!canScrollLeft}
            className={`flex h-[31px] w-[40px] items-center justify-center rounded-l-full border-[0.6px] border-[#D9D9D9] bg-white transition-all ${
              canScrollLeft ? "cursor-pointer hover:bg-gray-50" : "cursor-not-allowed opacity-50"
            }`}
          >
            <ArrowLeft className="h-[14px] w-[14px] text-[#CF5D9A]" />
          </button>
          <button
            onClick={() => scroll("right")}
            aria-label="Next before & after"
            disabled={!canScrollRight}
            className={`flex h-[31px] w-[40px] items-center justify-center rounded-r-full border-[0.6px] border-[#A5A5A5] bg-white transition-all ${
              canScrollRight ? "cursor-pointer hover:bg-gray-50" : "cursor-not-allowed opacity-50"
            }`}
          >
            <ArrowRight className="h-[14px] w-[14px] text-[#CF5D9A]" />
          </button>
        </div>
      </div>

      {/* Carousel row */}
      <div className="w-full px-[20px] sm:px-[48px] py-[10px]">
        <div
          ref={scrollRef}
          onScroll={checkScrollability}
          className="flex w-full flex-row items-start gap-[24px] overflow-x-auto scrollbar-none snap-x snap-mandatory pb-[10px]"
        >
          {images.map((img, i) => (
            <button
              type="button"
              key={i}
              onClick={() => {
                setIndex(i);
                setOpen(true);
              }}
              className="group relative aspect-[4/3] w-[280px] sm:w-[300px] shrink-0 snap-start overflow-hidden rounded-[22px] border border-[#EFE3EC] bg-[#F5F0F5] shadow-[0px_6px_10.5px_1px_rgba(0,0,0,0.05)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.source_url}
                alt={img.alt_text || `${name} before and after`}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.05]"
                loading="lazy"
              />
              {img.alt_text && (
                <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-3 pb-2 pt-6 text-left font-montserrat text-[12px] font-medium text-white">
                  {img.alt_text}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {open && (
        <Lightbox
          images={images}
          index={index}
          setIndex={setIndex}
          onClose={() => setOpen(false)}
          name={name}
        />
      )}
    </section>
  );
}
