import { ImageIcon } from "lucide-react";
import Image from "next/image";

import { cn } from "@/lib/utils";
import type { ImageSlot } from "@/lib/landing/types";

/**
 * Renders a real image when `slot.src` is set, otherwise a tasteful branded
 * placeholder (brand gradient + dashed border + icon + the intended alt text as
 * a caption). Swapping to a real image later is a one-field edit in the content
 * registry. The parent controls size; pass `className` for aspect/rounding.
 */
export function LandingImage({
  slot,
  className,
  priority = false,
  sizes,
}: {
  slot: ImageSlot;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  if (slot.src) {
    return (
      <div className={cn("relative overflow-hidden", className)}>
        <Image
          src={slot.src}
          alt={slot.alt}
          fill
          priority={priority}
          className="object-cover"
          style={slot.position ? { objectPosition: slot.position } : undefined}
          sizes={sizes ?? "(max-width: 768px) 100vw, 50vw"}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center gap-3 overflow-hidden rounded-[20px] border border-dashed border-[#CF5B9D]/30 bg-[linear-gradient(135deg,#faf5fa_0%,#f3e6f2_55%,#f7ecdf_100%)] p-6 text-center",
        className,
      )}
      role="img"
      aria-label={slot.alt}
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-white/70 text-[#CF5B9D] shadow-sm">
        <ImageIcon className="size-6" aria-hidden />
      </span>
      <span className="max-w-[80%] text-[12px] font-medium leading-snug text-[#9b6f92]">
        {slot.alt}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c9a9c4]">
        Image placeholder
      </span>
    </div>
  );
}
