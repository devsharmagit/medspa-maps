import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

type StarRatingProps = {
  rating: number;
  max?: number;
  className?: string;
  starClassName?: string;
};

export function StarRating({
  rating,
  max = 5,
  className,
  starClassName,
}: StarRatingProps) {
  return (
    <div
      className={cn("flex items-center gap-1", className)}
      role="img"
      aria-label={`${rating} out of ${max} stars`}
    >
      {Array.from({ length: max }, (_, index) => {
        const fillAmount = Math.min(Math.max(rating - index, 0), 1);

        return (
          <span key={index} className="relative size-5 shrink-0">
            <Star
              className={cn(
                "absolute inset-0 size-5 text-brand-star/30",
                starClassName,
              )}
              aria-hidden
            />
            <span
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${fillAmount * 100}%` }}
              aria-hidden
            >
              <Star
                className={cn(
                  "size-5 fill-brand-star text-brand-star",
                  starClassName,
                )}
              />
            </span>
          </span>
        );
      })}
    </div>
  );
}
