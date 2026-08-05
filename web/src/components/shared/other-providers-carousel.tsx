"use client";

import { ArrowLeft, ArrowRight, BadgeCheck, Calendar, Phone, X, Loader2 } from "lucide-react";
import { useRef, useState, useEffect } from "react";

import { useDragScroll } from "@/lib/hooks/use-drag-scroll";

/** Two-letter initials from a name, for the photo-less avatar fallback. */
function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

interface OtherProvider {
  id: string;
  name: string;
  title: string | null;
  image_url: string | null;
  is_verified: boolean;
  expertise_summary?: string | null;
}

interface Props {
  clinicName?: string;
  title?: string;
  providers: OtherProvider[];
  bookUrl: string | null;
  clinicPhone?: string | null;
  /** Retained for API compatibility; provider profile pages no longer exist, so
   *  cards are always static. */
  linkToProfile?: boolean;
}

export function OtherProvidersCarousel({ clinicName, title, providers, bookUrl, clinicPhone }: Props) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dragScroll = useDragScroll(scrollContainerRef);
  const [activeProvider, setActiveProvider] = useState<OtherProvider | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScrollability = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 1);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
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

  if (providers.length === 0) return null;

  /** Display subtitle for a provider — the full title as-is, so every clinic
   *  renders consistently (no credential chip). Separators are normalized:
   *  " - " and " | " both become " · ". */
  const formatTitle = (raw: string | null): string => {
    if (!raw) return "Aesthetic Specialist";
    return raw.replace(/\s+-\s+/g, " · ").replace(/\s*\|\s*/g, " · ").trim() || "Aesthetic Specialist";
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
            className={`flex h-[31px] w-[40px] items-center justify-center rounded-r-full border-[0.6px] border-[#D9D9D9] bg-white transition-all ${
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
          {...dragScroll}
          className="flex w-full flex-row items-start gap-8 overflow-x-auto scrollbar-none pb-3 cursor-grab active:cursor-grabbing select-none"
        >
          {providers.map((other) => {
            const role = formatTitle(other.title);
            const cardClassName =
              "group relative flex w-[264px] shrink-0 flex-col overflow-hidden rounded-2xl bg-white transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_16px_40px_rgba(207,93,154,0.18)]";
            const cardStyle = { boxShadow: "0 4px 20px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" };

            const cardContent = (
              <>
                {/* ── Image with gradient overlay ── */}
                <div className="relative h-[340px] w-full overflow-hidden">
                  {other.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={other.image_url}
                      alt={other.name}
                      className="h-full w-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.06]"
                      draggable={false}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#CF5D9A] to-[#C341D7] text-6xl font-semibold text-white/90">
                      {initials(other.name)}
                    </div>
                  )}

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

            return (
              <button
                key={other.id}
                type="button"
                onClick={() => setActiveProvider(other)}
                className={`${cardClassName} cursor-pointer text-left`}
                style={cardStyle}
                aria-label={`View ${other.name}'s expertise`}
              >
                {cardContent}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Footer Buttons ── */}
      <div className="flex w-full flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-start gap-4 px-5 sm:px-12">
        {bookUrl && (
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
        )}

        {clinicPhone && (
          <a
            href={`tel:${clinicPhone}`}
            className="flex h-[48px] w-full sm:w-[150px] items-center justify-center gap-2.5 rounded-lg border-[1.5px] border-[#CF5B9D] px-4 sm:px-6 py-2.5 transition-colors hover:bg-pink-50"
          >
            <span className="font-montserrat text-[14px] font-semibold leading-[17px] text-[#CF5B9D] whitespace-nowrap">
              Call Practice
            </span>
            <Phone className="h-[17px] w-[17px] text-[#CF5B9D] shrink-0" />
          </a>
        )}
      </div>

      {activeProvider && (
        <ProviderExpertiseModal
          provider={activeProvider}
          onClose={() => setActiveProvider(null)}
        />
      )}
    </section>
  );
}

/** Modal showing a provider's expertise. Uses the cached `expertise_summary`
 *  when present; otherwise fetches (and generates+caches) it on open. */
function ProviderExpertiseModal({
  provider,
  onClose,
}: {
  provider: OtherProvider;
  onClose: () => void;
}) {
  const [summary, setSummary] = useState<string | null>(
    provider.expertise_summary?.trim() || null
  );
  const [loading, setLoading] = useState(!provider.expertise_summary?.trim());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (summary) return; // cached — nothing to fetch
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/providers/${provider.id}/expertise`);
        const payload = (await res.json()) as {
          success: boolean;
          data?: { summary: string };
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !payload.success || !payload.data?.summary) {
          setError(payload.error || "Couldn't load this provider's details.");
        } else {
          setSummary(payload.data.summary);
        }
      } catch {
        if (!cancelled) setError("Network error. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider.id]);

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${provider.name} — expertise`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-4 p-5 sm:p-6">
          {provider.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={provider.image_url}
              alt={provider.name}
              className="h-20 w-20 shrink-0 rounded-xl object-cover object-top"
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#CF5D9A] to-[#C341D7] text-2xl font-semibold text-white">
              {initials(provider.name)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-montserrat text-[20px] font-semibold leading-tight text-[#373634]">
                {provider.name}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-[#6b6a68] transition-colors hover:bg-[#f3eef3]"
              >
                <X className="size-5" />
              </button>
            </div>
            {provider.title && (
              <p className="mt-0.5 font-montserrat text-[13px] text-[#727272]">{provider.title}</p>
            )}
          </div>
        </div>

        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-[#727272]">
              <Loader2 className="size-4 animate-spin" />
              Summarizing this provider&apos;s expertise…
            </div>
          ) : error ? (
            <p className="py-4 text-sm text-red-600">{error}</p>
          ) : (
            <>
              <p className="whitespace-pre-line font-montserrat text-[14px] leading-[160%] text-[#575757]">
                {summary}
              </p>
              <p className="mt-4 font-montserrat text-[11px] italic leading-[150%] text-[#9a9a9a]">
                AI-generated summary of publicly available information. Not medical advice — confirm
                details with the practice.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
