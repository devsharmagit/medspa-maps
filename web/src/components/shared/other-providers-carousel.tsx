"use client";

import { ArrowLeft, ArrowRight, BadgeCheck, Calendar, Phone, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useEffect } from "react";

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
  /** Set false to render provider cards as static (no link to their profile page). */
  linkToProfile?: boolean;
}

export function OtherProvidersCarousel({ clinicName, title, providers, bookUrl, clinicPhone, linkToProfile = true }: Props) {
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
  }, [providers]);

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 296; // card width (264) + gap (32)
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

  /** Split a provider title like "MSN, FNP-C, FMACP - Nurse Practitioner | Functional Medicine Practitioner"
   *  into a credential badge ("MSN, FNP-C, FMACP") and a role ("Nurse Practitioner · Functional Medicine Practitioner"). */
  const parseTitle = (raw: string | null): { credentials: string | null; role: string } => {
    if (!raw) return { credentials: null, role: "Aesthetic Specialist" };
    // Try splitting on " - " first (e.g. "BSN, RN - General Manager | Lead Nurse")
    const dashIdx = raw.indexOf(" - ");
    if (dashIdx !== -1) {
      const creds = raw.slice(0, dashIdx).trim();
      const role = raw.slice(dashIdx + 3).trim().replace(/\s*\|\s*/g, " · ");
      return { credentials: creds || null, role: role || "Aesthetic Specialist" };
    }
    // No dash — entire string is the role (e.g. "Social Media & Marketing Coordinator")
    return { credentials: null, role: raw.replace(/\s*\|\s*/g, " · ") };
  };

  return (
    <section className="box-border flex w-full flex-col items-start justify-center gap-6 rounded-[18px] border border-[#DEDEDE] bg-white py-10 shadow-[0px_9px_11.1px_rgba(240,223,241,0.6)]">
      {/* ── Header ── */}
      <div className="flex w-full flex-row items-center justify-between px-5 sm:px-12">
        <h2 className="font-montserrat text-[22px] sm:text-[34px] font-normal leading-[116.02%] tracking-[-0.04em] text-[#373634]">
          {title ? (
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
            disabled={!canScrollLeft}
            className={`flex h-[31px] w-[40px] items-center justify-center rounded-l-full border-[0.6px] border-[#D9D9D9] bg-white transition-all ${
              canScrollLeft ? "cursor-pointer hover:bg-gray-50 active:bg-gray-100" : "cursor-not-allowed opacity-50"
            }`}
          >
            <ArrowLeft className="h-[14px] w-[14px] text-[#CF5D9A]" />
          </button>
          <button
            onClick={() => scroll("right")}
            aria-label="Next provider"
            disabled={!canScrollRight}
            className={`flex h-[31px] w-[40px] items-center justify-center rounded-r-full border-[0.6px] border-[#A5A5A5] bg-white transition-all ${
              canScrollRight ? "cursor-pointer hover:bg-gray-50 active:bg-gray-100" : "cursor-not-allowed opacity-50"
            }`}
          >
            <ArrowRight className="h-[14px] w-[14px] text-[#CF5D9A]" />
          </button>
        </div>
      </div>

      {/* ── Carousel Row ── */}
      <div className="w-full relative px-5 sm:px-12 py-2">
        <div
          ref={scrollContainerRef}
          onScroll={checkScrollability}
          className="flex w-full flex-row items-start gap-8 overflow-x-auto scrollbar-none snap-x snap-mandatory pb-3"
        >
          {providers.map((other) => {
            const { credentials, role } = parseTitle(other.title);
            const providerSlug = other.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
            const cardClassName =
              "group relative flex w-[264px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl bg-white transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_16px_40px_rgba(207,93,154,0.18)]";
            const cardStyle = { boxShadow: "0 4px 20px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" };

            const cardContent = (
              <>
                {/* ── Image with gradient overlay ── */}
                <div className="relative h-[340px] w-full overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={other.image_url || defaultPhoto}
                    alt={other.name}
                    className="h-full w-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.06]"
                  />

                  {/* Bottom gradient overlay for text readability */}
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%]"
                    style={{
                      background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.35) 50%, transparent 100%)",
                    }}
                  />

                  {/* Verified badge — top-right corner */}
                  {other.is_verified && (
                    <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 shadow-sm backdrop-blur-sm">
                      <BadgeCheck className="h-4 w-4 fill-[#CF5D9A] text-white" />
                      <span className="font-montserrat text-[10px] font-semibold tracking-wide text-[#CF5D9A]">
                        Verified
                      </span>
                    </div>
                  )}

                  {/* ── Provider info overlay ── */}
                  <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2.5 p-5">
                    {/* Credentials badge */}
                    {credentials && (
                      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 backdrop-blur-md">
                        <Sparkles className="h-3 w-3 text-amber-300" />
                        <span className="font-montserrat text-[11px] font-semibold tracking-wide text-white/95">
                          {credentials}
                        </span>
                      </span>
                    )}

                    {/* Name */}
                    <h3 className="font-montserrat text-[20px] font-semibold leading-tight tracking-[-0.01em] text-white drop-shadow-sm">
                      {other.name}
                    </h3>

                    {/* Role / title */}
                    <p className="line-clamp-2 font-montserrat text-[13px] font-normal leading-snug text-white/80">
                      {role}
                    </p>
                  </div>
                </div>

                {/* Hover accent bar at the very bottom */}
                <div
                  className="h-[3px] w-full origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
                  style={{
                    background: "linear-gradient(90deg, #DE7F4C, #CF5D9A, #C341D7)",
                  }}
                />
              </>
            );

            if (!linkToProfile) {
              return (
                <div key={other.id} className={cardClassName} style={cardStyle}>
                  {cardContent}
                </div>
              );
            }

            return (
              <Link
                key={other.id}
                href={`/providers/${other.id}/${providerSlug}`}
                className={cardClassName}
                style={cardStyle}
              >
                {cardContent}
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Footer Buttons ── */}
      <div className="flex w-full flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-start gap-4 px-5 sm:px-12">
        <a
          href={bookUrl}
          target="_blank"
          rel="noreferrer"
          className="flex h-[48px] w-full sm:w-[210px] items-center justify-center gap-2.5 rounded-lg bg-[linear-gradient(90deg,#DE7F4C_0%,#C341D7_100%)] px-4 sm:px-6 py-2.5 transition-opacity hover:opacity-90"
        >
          <span className="font-montserrat text-[14px] font-semibold leading-[17px] text-white whitespace-nowrap">
            Book Appointment
          </span>
          <Calendar className="h-5 w-5 text-white shrink-0" />
        </a>

        {clinicPhone && (
          <a
            href={`tel:${clinicPhone}`}
            className="flex h-[48px] w-full sm:w-[150px] items-center justify-center gap-2.5 rounded-lg border-[1.5px] border-[#CF5B9D] px-4 sm:px-6 py-2.5 transition-colors hover:bg-pink-50"
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
