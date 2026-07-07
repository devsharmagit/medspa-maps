"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
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
  kind: "zip" | "city";
  postal_code: string | null;
  city: string;
  state_code: string | null;
  lat: number;
  lng: number;
}

interface LocationTypeaheadProps {
  value: string;
  onChange: (sel: LocationSelection) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  label?: string;
  className?: string;
  inputClassName?: string;
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
        const res = await fetch(
          `/api/locations/suggest?q=${encodeURIComponent(q)}`,
          { signal: ctrl.signal },
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
      const urlValue = `${s.city}${s.state_code ? `, ${s.state_code}` : ""}`;
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

      {open && query.trim().length >= 2 && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute left-0 top-full z-50 mt-2 max-h-[280px] w-full min-w-[260px] overflow-y-auto rounded-xl border border-[#e8e0e8] bg-white py-1.5 shadow-[0_12px_40px_rgba(170,78,179,0.12)] backdrop-blur-sm"
          style={{ scrollbarWidth: "thin" }}
        >
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
        </ul>
      )}
    </div>
  );
}
