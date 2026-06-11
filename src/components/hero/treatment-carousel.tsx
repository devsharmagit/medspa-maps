"use client";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import Image from "next/image";
import starsvg from "@/../public/images/landingpage/star-svg.svg"

import { cn } from "@/lib/utils";

const treatments = [
  { lines: ["Chemical", "Peel"] },
  { lines: ["Microneedling"] },
  { lines: ["Botox"] },
  { lines: ["Body", "Recountring"] },
  { lines: ["Fillers"] },
  { lines: ["Laser"] },
  { lines: ["Skin", "Rejuvenation"] },
] as const;

function TreatmentItem({ lines }: { lines: readonly string[] }) {
  return (
    <div className="flex shrink-0 items-center gap-2 px-1">
<Image src={starsvg} alt="star" width={35} height={31} style={{ height: "auto" }} />
    
      <div className="text-sm font-medium leading-tight tracking-wide text-brand-carousel">
        {lines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </div>
    </div>
  );
}

export function TreatmentCarousel({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative z-10 mx-auto -mt-11 w-[calc(100%-2rem)] max-w-[1292px] rounded-full border border-[#e4e4e4] bg-white py-1 shadow-[0_8px_7px_rgba(0,0,0,0.02)]",
        className,
      )}
    >
      <div className="flex h-[70px] items-center gap-4 overflow-x-auto px-4 scrollbar-none sm:gap-6 sm:px-6">
        {/* Left button — flat side faces right, pill side faces left */}
        <button
          type="button"
          className="flex h-[50px] w-16 shrink-0 cursor-pointer items-center justify-center rounded-[99px_0px_0px_99px] border-none bg-[linear-gradient(90deg,#FFE0FB_0%,#FFFFFF_100%)] transition-opacity duration-200 hover:opacity-75"
          aria-label="Previous treatments"
        >
          <ArrowLeft size={20} color="#C026D3" />
        </button>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-4 sm:gap-6">
          {treatments.map((treatment, index) => (
            <div
              key={treatment.lines.join("-")}
              className="flex items-center gap-4 sm:gap-6"
            >
              <TreatmentItem lines={treatment.lines} />
              {index < treatments.length - 1 && (
                <div className="hidden h-10 w-px shrink-0 bg-[#e4e4e4] sm:block" />
              )}
            </div>
          ))}
        </div>

        {/* Right button — flat side faces left, pill side faces right */}
        <button
          type="button"
          className="flex h-[50px] w-16 shrink-0 cursor-pointer items-center justify-center rounded-[0px_99px_99px_0px] border-none bg-[linear-gradient(90deg,#FFFFFF_0%,#FFE0FB_100%)] transition-opacity duration-200 hover:opacity-75"
          aria-label="Next treatments"
        >
          <ArrowRight size={20} color="#C026D3" />
        </button>
      </div>
    </div>
  );
}
