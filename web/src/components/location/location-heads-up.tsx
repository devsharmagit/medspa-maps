"use client";

import { useState } from "react";
import { Globe, X } from "lucide-react";

import { useLocation } from "@/lib/location/location-context";

/**
 * A small, dismissible heads-up shown when we detect the visitor is outside the
 * USA (where we don't list any medspas yet). Rendered as a bottom toast so it
 * never collides with the fixed hero header. Non-blocking — the user can still
 * browse and search.
 */
export function LocationHeadsUp() {
  const { outsideUS, location } = useLocation();
  const [dismissed, setDismissed] = useState(false);

  if (!outsideUS || dismissed) return null;

  const place = location?.city
    ? `${location.city}${location.stateName ? `, ${location.stateName}` : ""}`
    : "your area";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-4 z-[200] flex justify-center px-4"
    >
      <div className="flex max-w-md items-start gap-3 rounded-2xl border border-[#f0d9ef] bg-white/95 px-4 py-3 shadow-[0_10px_40px_rgba(170,78,179,0.18)] backdrop-blur">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-magenta/10 text-brand-magenta">
          <Globe className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 text-sm text-[#4a4a4a]">
          <p className="font-semibold text-[#1a1a1a]">
            We&apos;re USA-only for now
          </p>
          <p className="mt-0.5 leading-snug">
            We don&apos;t list medspas near {place} yet — we currently only cover
            the United States. Feel free to browse and search below.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="ml-1 shrink-0 rounded-full p-1 text-brand-muted transition-colors hover:bg-brand-magenta/5 hover:text-brand-magenta"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
