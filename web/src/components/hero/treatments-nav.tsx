"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import {
  ChevronDown,
  Dumbbell,
  Sparkles,
  Syringe,
  Zap,
} from "lucide-react";

import { CANONICAL_SERVICES, type CanonicalService, type ServiceCategory } from "@/lib/taxonomy/canonical";
import { cn } from "@/lib/utils";

// The 15 canonical (Phase-0) treatments, grouped by category — a static import
// from the single source of truth, so the nav always matches the real catalog.
const CATEGORY_ORDER: ServiceCategory[] = ["Injectables", "Skin", "Laser", "Body"];

const CATEGORY_ICON: Record<string, typeof Syringe> = {
  Injectables: Syringe,
  Skin: Sparkles,
  Laser: Zap,
  Body: Dumbbell,
};

function groupTreatments(): Array<{ category: ServiceCategory; items: CanonicalService[] }> {
  const groups = new Map<ServiceCategory, CanonicalService[]>();
  for (const svc of CANONICAL_SERVICES) {
    const list = groups.get(svc.category);
    if (list) list.push(svc);
    else groups.set(svc.category, [svc]);
  }
  return CATEGORY_ORDER.filter((c) => groups.has(c)).map((category) => ({
    category,
    items: groups.get(category)!,
  }));
}

const TREATMENT_GROUPS = groupTreatments();
const CLOSE_DELAY_MS = 150;

/**
 * Desktop hover mega-menu for the "Treatments" nav item (xl and up). Shows all
 * 15 canonical treatments grouped by category, plus a "View all" link.
 * Hoverable AND keyboard-accessible (focus opens, Escape / focus-out closes).
 */
export function TreatmentsNavDesktop({ className }: { className?: string }) {
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
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onFocus={openNow}
        onKeyDown={(e) => {
          if (e.key === "Escape") closeNow();
        }}
        className="flex items-center gap-1.5 text-base font-medium text-white transition-opacity hover:opacity-80"
        aria-haspopup="true"
        aria-expanded={open}
      >
        Treatments
        <ChevronDown
          className={cn("size-3.5 transition-transform duration-200", open ? "rotate-0" : "rotate-[-90deg]")}
          aria-hidden
        />
      </button>

      <div
        role="menu"
        aria-label="Treatments"
        className={cn(
          "absolute left-0 top-full z-50 mt-3 w-[640px] max-w-[92vw] rounded-2xl border border-[#f0e0ea] bg-white p-6 shadow-[0_20px_60px_-10px_rgba(123,45,107,0.28)] transition-all duration-200 ease-out",
          open
            ? "visible translate-y-0 opacity-100"
            : "invisible translate-y-1 opacity-0 pointer-events-none",
        )}
      >
        <div className="grid grid-cols-4 gap-6">
          {TREATMENT_GROUPS.map(({ category, items }) => {
            const Icon = CATEGORY_ICON[category] ?? Sparkles;
            return (
              <div key={category}>
                <div className="flex items-center gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-magenta/10 text-brand-magenta">
                    <Icon className="size-3.5" aria-hidden />
                  </span>
                  <span className="font-montserrat text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
                    {category}
                  </span>
                </div>
                <ul className="mt-3 flex flex-col gap-2">
                  {items.map((t) => (
                    <li key={t.slug}>
                      <Link
                        href={`/search?q=${t.slug}`}
                        role="menuitem"
                        onClick={closeNow}
                        className="block text-sm text-[#383838] transition-colors hover:text-brand-magenta"
                      >
                        {t.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Mobile accordion for the "Treatments" row inside the slide-down mobile menu
 * (hover doesn't apply below xl). Tapping the label or chevron expands the same
 * 15-treatment list in place.
 */
export function TreatmentsNavMobile({ onNavigate }: { onNavigate: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-white/10">
      <div className="flex items-center justify-between py-3.5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-base font-medium text-white transition-opacity hover:opacity-80"
          aria-expanded={expanded}
        >
          Treatments
        </button>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse treatments list" : "Expand treatments list"}
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
          expanded ? "max-h-[480px] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <div className="flex flex-col gap-4 pb-4">
          {TREATMENT_GROUPS.map(({ category, items }) => (
            <div key={category}>
              <p className="font-montserrat text-[11px] font-semibold uppercase tracking-wide text-white/50">
                {category}
              </p>
              <ul className="mt-2 flex flex-col gap-2.5">
                {items.map((t) => (
                  <li key={t.slug}>
                    <Link
                      href={`/search?q=${t.slug}`}
                      onClick={onNavigate}
                      className="block text-sm text-white/90 transition-opacity hover:opacity-80"
                    >
                      {t.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
