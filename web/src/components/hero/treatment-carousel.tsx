"use client";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import starsvg from "@/../public/images/landingpage/star-svg.svg";
import { cn } from "@/lib/utils";

const TREATMENTS = [
  { slug: "botox",                  label: ["Botox"] },
  { slug: "dermal-fillers",         label: ["Dermal", "Fillers"] },
  { slug: "kybella",                label: ["Kybella"] },
  { slug: "pdo-threads",            label: ["PDO", "Threads"] },
  { slug: "prp-prf",                label: ["PRP /", "PRF"] },
  { slug: "microneedling",          label: ["Microneedling"] },
  { slug: "chemical-peels",         label: ["Chemical", "Peels"] },
  { slug: "hydrafacial",            label: ["HydraFacial"] },
  { slug: "rf-skin-tightening",     label: ["RF Skin", "Tightening"] },
  { slug: "ultherapy",              label: ["Ultherapy"] },
  { slug: "laser-skin-resurfacing", label: ["Laser", "Resurfacing"] },
  { slug: "laser-hair-removal",     label: ["Laser Hair", "Removal"] },
  { slug: "ipl-photofacial",        label: ["IPL /", "Photofacial"] },
  { slug: "coolsculpting",          label: ["CoolSculpting"] },
  { slug: "body-contouring",        label: ["Body", "Contouring"] },
] as const;

function TreatmentItem({ slug, label }: { slug: string; label: readonly string[] }) {
  return (
    <Link
      href={`/treatments/${slug}`}
      className="flex shrink-0 items-center gap-2 px-1 transition-opacity hover:opacity-70"
    >
      <Image src={starsvg} alt="" width={35} height={31} style={{ height: "auto" }} />
      <div className="text-sm font-medium leading-tight tracking-wide text-brand-carousel">
        {label.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </div>
    </Link>
  );
}

export function TreatmentCarousel({ className }: { className?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -200 : 200,
      behavior: "smooth",
    });
  };

  return (
    <div
      className={cn(
        "relative z-1 mx-auto -mt-11 w-[calc(100%-2rem)] max-w-[1292px] rounded-full border border-[#e4e4e4] bg-white py-1 shadow-[0_8px_7px_rgba(0,0,0,0.02)]",
        className,
      )}
    >
      <div className="flex h-[70px] items-center px-4 sm:px-6">
        {/* Left button */}
        <button
          type="button"
          onClick={() => scroll("left")}
          className="flex h-[50px] w-16 shrink-0 cursor-pointer items-center justify-center rounded-[99px_0px_0px_99px] border-none bg-[linear-gradient(90deg,#FFE0FB_0%,#FFFFFF_100%)] transition-opacity duration-200 hover:opacity-75"
          aria-label="Previous treatments"
        >
          <ArrowLeft size={20} color="#C026D3" />
        </button>

        {/* Scrollable treatment list */}
        <div
          ref={scrollRef}
          className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto scrollbar-none sm:gap-6"
        >
          {TREATMENTS.map((treatment, index) => (
            <div key={treatment.slug} className="flex shrink-0 items-center gap-4 sm:gap-6">
              <TreatmentItem slug={treatment.slug} label={treatment.label} />
              {index < TREATMENTS.length - 1 && (
                <div className="h-10 w-px shrink-0 bg-[#e4e4e4]" />
              )}
            </div>
          ))}
        </div>

        {/* Right button */}
        <button
          type="button"
          onClick={() => scroll("right")}
          className="flex h-[50px] w-16 shrink-0 cursor-pointer items-center justify-center rounded-[0px_99px_99px_0px] border-none bg-[linear-gradient(90deg,#FFFFFF_0%,#FFE0FB_100%)] transition-opacity duration-200 hover:opacity-75"
          aria-label="Next treatments"
        >
          <ArrowRight size={20} color="#C026D3" />
        </button>
      </div>
    </div>
  );
}
