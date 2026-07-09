"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Globe, MapPinOff, X } from "lucide-react";

import { useLocation } from "@/lib/location/location-context";

/** Fired by pages (e.g. search "Near Me") to resurface the notice after it hides. */
export const NOTICE_REFRESH_EVENT = "medspa:location-refresh";

/** Only these pages ever show the location notice. */
const ALLOWED_PATHS = new Set(["/", "/search"]);

/** How long the toast stays on screen before it fades on its own (ms). */
const AUTO_HIDE_MS = 8000;

/**
 * A single, small, non-blocking toast about the visitor's location, rendered
 * ONCE globally from the root layout but shown ONLY on the home ("/") and
 * search ("/search") pages. It has three states, all based purely on the
 * browser's own geolocation:
 *   • detected inside the USA → confirm we're showing nearby clinics,
 *   • outside the USA (where we don't list medspas yet) → USA-only note, or
 *   • detection failed (denied / unavailable) → graceful fallback.
 * It reappears on every page load/refresh and auto-hides after a few seconds;
 * an explicit re-detect (e.g. search "Near Me") also brings it back.
 */
export function UsaOnlyNotice() {
  const pathname = usePathname();
  const { outsideUS, status, location, requested } = useLocation();
  const [hidden, setHidden] = useState(false);

  // Which message (if any) applies. We only surface the two cases the user needs
  // feedback on: outside the US (we don't list clinics there) or a failed
  // detection. A SUCCESSFUL US detection shows nothing — the location box just
  // fills with the city/state instead.
  const mode: "outside" | "failed" | null = outsideUS
    ? "outside"
    : status === "denied" || status === "unavailable"
      ? "failed"
      : null;

  // Only ever show as the result of an explicit "Use my current location" click
  // this session — never from a position rehydrated from storage on page load.
  const visible = ALLOWED_PATHS.has(pathname) && requested && !!mode && !hidden;

  // Re-show on each navigation (and refresh) so the notice appears freshly on
  // both allowed pages, even after it auto-hid on the previous one.
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setHidden(false);
  }, [pathname]);

  // Auto-hide after a few seconds so the toast never lingers. The timer resets
  // whenever a new message becomes visible (e.g. idle → detected).
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setHidden(true), AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [visible, mode]);

  // An explicit re-detect (e.g. tapping "Near Me") brings the notice back even
  // after it auto-hid or was dismissed — otherwise the button looks broken.
  useEffect(() => {
    const resurface = () => setHidden(false);
    window.addEventListener(NOTICE_REFRESH_EVENT, resurface);
    return () => window.removeEventListener(NOTICE_REFRESH_EVENT, resurface);
  }, []);

  if (!visible) return null;

  const place = location?.city
    ? `${location.city}${location.stateName ? `, ${location.stateName}` : ""}`
    : null;

  const close = () => setHidden(true);

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
