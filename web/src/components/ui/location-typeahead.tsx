"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Ecommerce-style (Blinkit/Flipkart pincode) location typeahead.
 *
 * Fetches zip + city suggestions from /api/locations/suggest (local
 * postal_codes table — instant, free) as the user types, debounced. Selecting
 * a suggestion hands back the label AND its coordinates so the caller can run
 * a radius search immediately. Free text is still allowed (the search API
 * resolves bare zips / "City, ST" server-side as a fallback).
 */

export interface LocationSelection {
  /** Display text, e.g. "37203 — Nashville, TN" or "Nashville, TN" */
  label: string;
  /** Query value to put in the URL (zip for zips, "City, ST" for cities) */
  value: string;
  lat: number | null;
  lng: number | null;
}

interface Suggestion {
  label: string;
  kind: "zip" | "city" | "state";
  postal_code: string | null;
  city: string;
  state_code: string | null;
  /** null for "state" — picking it runs a statewide text search, not a
   *  radius from a point. */
  lat: number | null;
  lng: number | null;
}

interface LocationTypeaheadProps {
  value: string;
  onChange: (sel: LocationSelection) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  label?: string;
  className?: string;
  inputClassName?: string;
  /**
   * When provided, the dropdown shows a "Use my current location" row (opening
   * the field on focus/click, even before the user types). Clicking it runs the
   * caller's geolocation flow. Nothing is requested until the user clicks.
   */
  onUseMyLocation?: () => void;
  /** True while geolocation is resolving (shows "Detecting…" on the row). */
  locating?: boolean;
}

const DEBOUNCE_MS = 180;

export function LocationTypeahead({
  value,
  onChange,
  placeholder = "ZIP code or city…",
  icon,
  label,
  className,
  inputClassName,
  onUseMyLocation,
  locating = false,
}: LocationTypeaheadProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Debounced suggestion fetch ─────────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        // cache: "no-store" — bypass the browser's HTTP cache outright. A
        // response cached under an earlier, longer-lived Cache-Control (from
        // before a suggestion-ranking fix) would otherwise keep being replayed
        // for that exact query until it expires on its own, regardless of any
        // server-side header change; explicit no-store here self-heals it
        // immediately instead of requiring every visitor to hard-refresh.
        const res = await fetch(
          `/api/locations/suggest?q=${encodeURIComponent(q)}`,
          { signal: ctrl.signal, cache: "no-store" },
        );
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
      } catch {
        /* aborted or network error — keep previous list */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // ── Close on outside click ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close the dropdown once an in-flight "use my location" detection settles
  // (locating true → false) so the freshly-filled value is shown, not the menu.
  const prevLocatingRef = useRef(locating);
  useEffect(() => {
    if (prevLocatingRef.current && !locating) setOpen(false);
    prevLocatingRef.current = locating;
  }, [locating]);

  useEffect(() => {
    if (highlightedIdx >= 0 && listRef.current) {
      (listRef.current.children[highlightedIdx] as HTMLElement)?.scrollIntoView({
        block: "nearest",
      });
    }
  }, [highlightedIdx]);

  const handleSelect = useCallback(
    (s: Suggestion) => {
      // Show the AREA, not the raw zip: picking "37203 — Nashville, TN"
      // displays (and puts in the URL) "Nashville, TN". The suggestion's exact
      // coordinates ride along, so the radius search still centers on the zip.
      // A "state" pick carries no coordinates on purpose — it puts just the
      // state code in the URL so the search API runs its statewide text
      // match (STATE_ABBR_TO_NAME) across every clinic in the state, instead
      // of a radius around one arbitrary point.
      const urlValue = s.kind === "state" ? (s.state_code ?? s.city) : `${s.city}${s.state_code ? `, ${s.state_code}` : ""}`;
      onChange({ label: s.label, value: urlValue, lat: s.lat, lng: s.lng });
      setQuery("");
      setOpen(false);
      setHighlightedIdx(-1);
    },
    [onChange],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setHighlightedIdx(-1);
    if (!open) setOpen(true);
    // Free text rides along (server resolves zips / "City, ST" itself)
    onChange({ label: val, value: val, lat: null, lng: null });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setHighlightedIdx((p) => Math.min(p + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIdx((p) => Math.max(p - 1, 0));
    } else if (e.key === "Enter") {
      // A typed US state ("Utah", "TX", "Texas") always gets its own "state"
      // suggestion ranked first by the API — picking it runs a statewide
      // search (no coordinates), so it's always safe for Enter to auto-select
      // the top suggestion here, unlike a bare city match which could
      // silently narrow a broader query down to one point.
      if (highlightedIdx >= 0 && suggestions[highlightedIdx]) {
        e.preventDefault();
        handleSelect(suggestions[highlightedIdx]);
      } else if (suggestions.length > 0 && open && query.trim().length >= 2) {
        // Blinkit behavior: Enter on a typed query takes the top suggestion
        e.preventDefault();
        handleSelect(suggestions[0]);
      } else {
        setOpen(false); // let the surrounding form submit with free text
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlightedIdx(-1);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {(icon || label) && (
        <div className="mb-1 flex items-center gap-2">
          {icon}
          {label && (
            <span className="text-sm font-semibold uppercase tracking-wide text-brand-muted">
              {label}
            </span>
          )}
        </div>
      )}

      <div className="relative flex items-center">
        <input
          type="text"
          value={open && query !== "" ? query : value}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "w-full border-0 bg-transparent p-0 pr-5 text-sm text-foreground placeholder:text-brand-placeholder focus:outline-none focus:ring-0",
            inputClassName,
          )}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          autoComplete="off"
        />
      </div>

      {open && (onUseMyLocation || query.trim().length >= 2) && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute left-0 top-full z-50 mt-2 max-h-[280px] w-full min-w-[260px] overflow-y-auto rounded-xl border border-[#e8e0e8] bg-white py-1.5 shadow-[0_12px_40px_rgba(170,78,179,0.12)] backdrop-blur-sm"
          style={{ scrollbarWidth: "thin" }}
        >
          {onUseMyLocation && (
            <li>
              <button
                type="button"
                // keep focus on the input so the panel doesn't blur-close first
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { if (!locating) onUseMyLocation(); }}
                disabled={locating}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-brand-magenta transition-colors hover:bg-brand-magenta/8 disabled:opacity-70"
              >
                <LocateFixed className={cn("size-4 shrink-0", locating && "animate-pulse")} aria-hidden />
                <span className="flex-1">
                  {locating ? "Detecting your location…" : "Use my current location"}
                </span>
              </button>
            </li>
          )}
          {onUseMyLocation && query.trim().length < 2 && (
            <li className="px-4 pb-1.5 pt-1 text-[11px] text-brand-muted/60">
              …or type a ZIP code or city
            </li>
          )}
          {query.trim().length >= 2 && (
            <>
              {onUseMyLocation && <li className="mx-4 my-1 border-t border-[#f0e6f0]" role="separator" />}
              {loading && suggestions.length === 0 ? (
            <li className="px-4 py-3 text-center text-xs text-brand-muted/60">
              Searching…
            </li>
          ) : suggestions.length === 0 ? (
            <li className="px-4 py-3 text-center text-xs text-brand-muted/60">
              No matching ZIP or city
            </li>
          ) : (
            suggestions.map((s, idx) => (
              <li
                key={`${s.kind}-${s.postal_code ?? s.city}-${s.state_code}-${idx}`}
                role="option"
                aria-selected={idx === highlightedIdx}
                onClick={() => handleSelect(s)}
                onMouseEnter={() => setHighlightedIdx(idx)}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 px-4 py-2 text-sm transition-colors",
                  idx === highlightedIdx
                    ? "bg-brand-magenta/8 text-brand-magenta"
                    : "text-[#4a4a4a] hover:bg-[#faf7fa]",
                )}
              >
                <MapPin className="size-3.5 shrink-0 text-brand-magenta/60" />
                <span className="flex-1 truncate">{s.label}</span>
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-brand-muted/50">
                  {s.kind}
                </span>
              </li>
            ))
          )}
            </>
          )}
        </ul>
      )}
    </div>
  );
}
