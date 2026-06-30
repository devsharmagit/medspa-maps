"use client";

import { useState } from "react";
import { Star } from "lucide-react";

/**
 * Interactive 1–5 star picker for the admin review forms.
 * Click the active star again (or "Clear") to set the rating back to null.
 */
export function StarPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const active = hover ?? value ?? 0;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? null : n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(null)}
          className="rounded p-0.5 transition-transform hover:scale-110 focus:outline-none"
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          <Star
            size={22}
            className={
              n <= active
                ? "fill-brand-star text-brand-star"
                : "text-brand-star/30"
            }
          />
        </button>
      ))}
      {value != null && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="ml-2 text-xs text-slate-400 hover:text-slate-600"
        >
          Clear
        </button>
      )}
    </div>
  );
}
