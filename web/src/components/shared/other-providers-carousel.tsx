"use client";

import { ArrowLeft, ArrowRight, Calendar, Phone } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

interface OtherProvider {
  id: string;
  name: string;
  title: string | null;
  image_url: string | null;
  is_verified: boolean;
}

interface Props {
  clinicName?: string;
  title?: string;
  providers: OtherProvider[];
  bookUrl: string;
  clinicPhone?: string | null;
}

export function OtherProvidersCarousel({ clinicName, title, providers, bookUrl, clinicPhone }: Props) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 328; // card width (304) + gap (24)
      scrollContainerRef.current.scrollTo({
        left:
          scrollContainerRef.current.scrollLeft +
          (direction === "left" ? -scrollAmount : scrollAmount),
        behavior: "smooth",
      });
    }
  };

  const defaultPhoto = "https://images.stockcake.com/public/1/9/d/19d13828-c999-4e2d-a191-9da4dd8bd824_large/confident-medical-professional-stockcake.jpg";

  if (providers.length === 0) return null;

  return (
    <section className="box-border flex w-full flex-col items-start justify-center gap-[16px] rounded-[18px] border border-[#DEDEDE] bg-white py-[40px] shadow-[0px_9px_11.1px_rgba(240,223,241,0.6)]">
      {/* ── Header ── */}
      <div className="flex w-full flex-row items-center justify-between px-[20px] sm:px-[48px]">
        <h2 className="font-montserrat text-[22px] sm:text-[34px] font-normal leading-[116.02%] tracking-[-0.04em] text-[#373634]">
          {title ? (
            // If the custom title contains "Experts", italicize it as per design
            title.includes("Experts") ? (
              <>
                {title.replace("Experts", "")}
                <span className="italic font-serif">Experts</span>
              </>
            ) : (
              title
            )
          ) : (
            `Other providers from ${clinicName}`
          )}
        </h2>

        {/* Custom Navigation Arrows */}
        <div className="hidden sm:flex h-[31px] w-[83px] flex-row items-center gap-[3px]">
          <button
            onClick={() => scroll("left")}
            aria-label="Previous provider"
            className="flex h-[31px] w-[40px] cursor-pointer items-center justify-center rounded-l-full border-[0.6px] border-[#D9D9D9] bg-white hover:bg-gray-50 active:bg-gray-100"
          >
            <ArrowLeft className="h-[14px] w-[14px] text-[#CF5D9A] opacity-40" />
          </button>
          <button
            onClick={() => scroll("right")}
            aria-label="Next provider"
            className="flex h-[31px] w-[40px] cursor-pointer items-center justify-center rounded-r-full border-[0.6px] border-[#A5A5A5] bg-white hover:bg-gray-50 active:bg-gray-100"
          >
            <ArrowRight className="h-[14px] w-[14px] text-[#CF5D9A]" />
          </button>
        </div>
      </div>

      {/* ── Carousel Row ── */}
      <div className="w-full relative px-[20px] sm:px-[48px] py-[10px]">
        <div
          ref={scrollContainerRef}
          className="flex w-full flex-row items-start gap-[24px] overflow-x-auto scrollbar-none snap-x snap-mandatory pb-[10px]"
        >
          {providers.map((other) => (
            <Link
              key={other.id}
              href={`/providers/${other.id}/${other.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              className="group flex h-[308px] w-[304px] shrink-0 snap-start flex-col rounded-[22px] bg-white shadow-[0px_6px_10.5px_1px_rgba(0,0,0,0.05)] transition-transform hover:-translate-y-1"
            >
              {/* Image */}
              <div className="relative h-[228px] w-[304px] shrink-0 overflow-hidden rounded-t-[22px] bg-[#E4DBD9]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={other.image_url || defaultPhoto}
                  alt={other.name}
                  className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                />
              </div>

              {/* Info container */}
              <div className="flex h-[71px] flex-col items-start justify-center gap-[2px] rounded-b-[22px] bg-white px-[24px] pt-[10px]">
                <div className="flex flex-row items-center justify-start gap-[8px]">
                  <span className="font-montserrat text-[18px] font-medium leading-[116.02%] tracking-[0.02em] text-[#383838]">
                    {other.name}
                  </span>
                  {other.is_verified && (
                    <div className="flex h-[20px] w-[20px] items-center justify-center">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8.0772 2.7667C8.78453 1.63665 10.4284 1.63665 11.1358 2.7667L11.7588 3.76192C12.0628 4.2476 12.6373 4.51659 13.2201 4.44686L14.3916 4.30671C15.7001 4.14953 16.7118 5.29546 16.4428 6.57445L16.2058 7.70208C16.0902 8.25206 16.2758 8.8236 16.6778 9.15573L17.4859 9.8236C18.3888 10.57 18.3888 11.9612 17.4859 12.7076L16.6778 13.3755C16.2758 13.7076 16.0902 14.2792 16.2058 14.8291L16.4428 15.9568C16.7118 17.2357 15.7001 18.3817 14.3916 18.2245L13.2201 18.0843C12.6373 18.0146 12.0628 18.2836 11.7588 18.7693L11.1358 19.7645C10.4284 20.8946 8.78453 20.8946 8.0772 19.7645L7.4542 18.7693C7.15013 18.2836 6.57564 18.0146 5.99288 18.0843L4.82132 18.2245C3.51278 18.3817 2.50117 17.2357 2.77017 15.9568L3.00712 14.8291C3.12275 14.2792 2.93717 13.7076 2.53517 13.3755L1.72702 12.7076C0.824143 11.9612 0.824143 10.57 1.72702 9.8236L2.53517 9.15573C2.93717 8.8236 3.12275 8.25206 3.00712 7.70208L2.77017 6.57445C2.50117 5.29546 3.51278 4.14953 4.82132 4.30671L5.99288 4.44686C6.57564 4.51659 7.15013 4.2476 7.4542 3.76192L8.0772 2.7667Z" fill="#CF5D9A"/>
                        <path d="M7 10L9 12L13 7" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </div>
                <span className="font-montserrat text-[14px] font-normal leading-[138%] tracking-[0.02em] text-[#727272] text-left">
                  {other.title || "Aesthetic Specialist"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Footer Buttons ── */}
      <div className="flex w-full flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-start gap-[16px] px-[20px] sm:px-[42px]">
        <a
          href={bookUrl}
          target="_blank"
          rel="noreferrer"
          className="flex h-[48px] w-full sm:w-[210px] items-center justify-center gap-[10px] rounded-[8px] bg-[linear-gradient(90deg,#DE7F4C_0%,#C341D7_100%)] px-[16px] sm:px-[24px] py-[10px] transition-opacity hover:opacity-90"
        >
          <span className="font-montserrat text-[14px] font-semibold leading-[17px] text-white whitespace-nowrap">
            Book Appointment
          </span>
          <Calendar className="h-[20px] w-[20px] text-white shrink-0" />
        </a>

        {clinicPhone && (
          <a
            href={`tel:${clinicPhone}`}
            className="flex h-[48px] w-full sm:w-[150px] items-center justify-center gap-[10px] rounded-[8px] border-[1.5px] border-[#CF5B9D] px-[16px] sm:px-[24px] py-[10px] transition-colors hover:bg-pink-50"
          >
            <span className="font-montserrat text-[14px] font-semibold leading-[17px] text-[#CF5B9D] whitespace-nowrap">
              Call Clinic
            </span>
            <Phone className="h-[17px] w-[17px] text-[#CF5B9D] shrink-0" />
          </a>
        )}
      </div>
    </section>
  );
}
