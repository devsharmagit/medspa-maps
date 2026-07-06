"use client";

import { useEffect, useState } from "react";
import { Globe, MapPinOff, X } from "lucide-react";

import { useLocation } from "@/lib/location/location-context";

const DISMISS_KEY = "medspa.usaOnlyNotice.dismissed.v1";
/** Fired by pages (e.g. search "Near Me") to resurface the notice after dismissal. */
export const NOTICE_REFRESH_EVENT = "medspa:location-refresh";

/**
 * A single, small, non-blocking toast about the visitor's location, rendered
 * ONCE globally from the root layout so it can never collide across pages. It
 * shows in two cases, both based purely on the browser's own geolocation:
 *   • the visitor is outside the USA (where we don't list medspas yet), or
 *   • we couldn't get their location at all (denied / unavailable) — so they get
 *     clear feedback instead of silence.
 * Dismissal is remembered for the session; an explicit re-detect resurfaces it.
 */
export function UsaOnlyNotice() {
  const { outsideUS, status, location } = useLocation();
  const [dismissed, setDismissed] = useState(true); // start hidden until mounted

  // Read the session dismissal only after mount to avoid a hydration mismatch
  // (server render can't see sessionStorage, so first client render must match).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Let an explicit re-detect (e.g. tapping "Near Me") bring the notice back even
  // if it was dismissed — otherwise the button looks broken.
  useEffect(() => {
    const resurface = () => {
      try {
        sessionStorage.removeItem(DISMISS_KEY);
      } catch {
        /* storage may be unavailable */
      }
      setDismissed(false);
    };
    window.addEventListener(NOTICE_REFRESH_EVENT, resurface);
    return () => window.removeEventListener(NOTICE_REFRESH_EVENT, resurface);
  }, []);

  // Which message (if any) applies. Outside-US takes priority; otherwise, if the
  // browser couldn't give us a location, show the fallback.
  const mode: "outside" | "failed" | null = outsideUS
    ? "outside"
    : status === "denied" || status === "unavailable"
      ? "failed"
      : null;

  if (!mode || dismissed) return null;

  const place = location?.city
    ? `${location.city}${location.stateName ? `, ${location.stateName}` : ""}`
    : null;

  const close = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* storage may be unavailable */
    }
  };

  const Icon = mode === "outside" ? Globe : MapPinOff;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-5 z-[300] flex justify-center px-4 animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="pointer-events-auto flex max-w-[92vw] items-center gap-3 rounded-2xl border border-[#E7B9DB] bg-white py-2.5 pl-2.5 pr-2.5 shadow-[0_18px_50px_-10px_rgba(123,45,107,0.55)] ring-1 ring-black/5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#DE7F4C] to-[#C341D7] text-white shadow-sm">
          <Icon className="size-[18px]" aria-hidden />
        </span>
        {mode === "outside" ? (
          <p className="text-[13px] leading-snug text-[#3a3a3a]">
            <span className="font-semibold text-[#1a1a1a]">USA-only for now.</span>{" "}
            {place ? `We don't list medspas near ${place} yet — ` : ""}
            <span className="whitespace-nowrap">showing U.S. clinics.</span>
          </p>
        ) : (
          <p className="text-[13px] leading-snug text-[#3a3a3a]">
            <span className="font-semibold text-[#1a1a1a]">
              Couldn&apos;t detect your location.
            </span>{" "}
            <span className="whitespace-nowrap">Showing all U.S. clinics.</span>
          </p>
        )}
        <button
          type="button"
          onClick={close}
          className="shrink-0 rounded-full p-1.5 text-[#9a7b94] transition-colors hover:bg-[#f6ecf4] hover:text-[#7b2d6b]"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
