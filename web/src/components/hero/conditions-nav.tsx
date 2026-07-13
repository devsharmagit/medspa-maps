"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import { CANONICAL_CONCERNS } from "@/lib/taxonomy/canonical";
import { cn } from "@/lib/utils";

// The 10 canonical (Phase-0) conditions — a static import from the single
// source of truth, so the nav always matches the real catalog.
const CLOSE_DELAY_MS = 150;

/**
 * Desktop hover mega-menu for the "Conditions" nav item (xl and up). Shows all
 * 10 canonical conditions in a flat two-column list — mirrors
 * TreatmentsNavDesktop, minus category grouping (conditions have none).
 * Hoverable AND keyboard-accessible (focus opens, Escape / focus-out closes).
 */
export function ConditionsNavDesktop({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const openNow = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  }, []);
  const closeSoon = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }, []);
  const closeNow = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(false);
  }, []);

  const handleBlur = (e: React.FocusEvent) => {
    if (wrapperRef.current && !wrapperRef.current.contains(e.relatedTarget as Node)) {
      closeNow();
    }
  };

  return (
    <div
      ref={wrapperRef}
      className={cn("relative", className)}
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
      onBlur={handleBlur}
    >
      <Link
        href="/conditions"
        onFocus={openNow}
        onKeyDown={(e) => {
          if (e.key === "Escape") closeNow();
        }}
        className="flex items-center gap-1.5 text-base font-medium text-white transition-opacity hover:opacity-80"
        aria-haspopup="true"
        aria-expanded={open}
      >
        Conditions
        <ChevronDown
          className={cn("size-3.5 transition-transform duration-200", open ? "rotate-0" : "rotate-[-90deg]")}
          aria-hidden
        />
      </Link>

      <div
        role="menu"
        aria-label="Conditions"
        className={cn(
          "absolute left-0 top-full z-50 mt-3 w-[420px] max-w-[92vw] rounded-2xl border border-[#f0e0ea] bg-white p-6 shadow-[0_20px_60px_-10px_rgba(123,45,107,0.28)] transition-all duration-200 ease-out",
          open
            ? "visible translate-y-0 opacity-100"
            : "invisible translate-y-1 opacity-0 pointer-events-none",
        )}
      >
        <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
          {CANONICAL_CONCERNS.map((c) => (
            <Link
              key={c.slug}
              href={`/search?condition=${c.slug}`}
              role="menuitem"
              onClick={closeNow}
              className="block text-sm text-[#383838] transition-colors hover:text-brand-magenta"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Mobile accordion for the "Conditions" row inside the slide-down mobile menu
 * (hover doesn't apply below xl). Tapping the label navigates like any other
 * nav row; tapping the chevron expands the same 10-condition list in place.
 */
export function ConditionsNavMobile({ onNavigate }: { onNavigate: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-white/10">
      <div className="flex items-center justify-between py-3.5">
        <Link
          href="/conditions"
          onClick={onNavigate}
          className="text-base font-medium text-white transition-opacity hover:opacity-80"
        >
          Conditions
        </Link>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse conditions list" : "Expand conditions list"}
          className="-mr-2 flex size-9 items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/10"
        >
          <ChevronDown
            className={cn("size-4 transition-transform duration-200", expanded ? "rotate-0" : "-rotate-90")}
            aria-hidden
          />
        </button>
      </div>

      <div
        className={cn(
          "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
          expanded ? "max-h-[420px] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <ul className="flex flex-col gap-2.5 pb-4">
          {CANONICAL_CONCERNS.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/search?condition=${c.slug}`}
                onClick={onNavigate}
                className="block text-sm text-white/90 transition-opacity hover:opacity-80"
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
