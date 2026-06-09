import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

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
      <Sparkles className="size-[30px] shrink-0 stroke-[1.25] text-brand-carousel" />
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
        <button
          type="button"
          className="flex size-10 shrink-0 items-center justify-center text-brand-purple transition-opacity hover:opacity-70"
          aria-label="Previous treatments"
        >
          <ChevronLeft className="size-6" />
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

        <button
          type="button"
          className="flex size-10 shrink-0 items-center justify-center text-brand-purple transition-opacity hover:opacity-70"
          aria-label="Next treatments"
        >
          <ChevronRight className="size-6" />
        </button>
      </div>
    </div>
  );
}
