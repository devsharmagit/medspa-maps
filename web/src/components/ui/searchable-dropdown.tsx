"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DropdownOption {
  label: string;
  value: string;
  /** Optional group heading; consecutive options sharing a group render under
   *  one non-interactive header row (e.g. "Treatments" / "Conditions"). */
  group?: string;
  /** Clinics matching this option in the caller's current location scope.
   *  Rendered right-aligned; `0` options sink below an "unavailable" divider. */
  count?: number;
}

interface SearchableDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  label?: string;
  className?: string;
  inputClassName?: string;
  /** If true, user can also type a freeform value not in the list */
  allowFreeText?: boolean;
  /** Counts are being refetched for a new location — dim them, keep the list. */
  countsStale?: boolean;
  /** The option list has not arrived yet — show a loading row, not "no results". */
  loading?: boolean;
  /**
   * Fires ONLY when the user actually picks an option (click, or Enter on a
   * match) — never on every keystroke, even with allowFreeText. Callers that
   * apply filters live (e.g. a results page) should use this to push the change
   * immediately, instead of waiting for a separate "Search" submit.
   */
  onSelect?: (option: DropdownOption) => void;
}

export function SearchableDropdown({
  options,
  value,
  onChange,
  placeholder = "Search…",
  icon,
  label,
  className,
  inputClassName,
  allowFreeText = false,
  countsStale = false,
  loading = false,
  onSelect,
}: SearchableDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();

  // The list is portaled to <body> and positioned via fixed coordinates so it
  // can escape any ancestor's `overflow: hidden` (e.g. the hero section uses
  // that to clip its background image) instead of being cut off by it. `open`
  // only ever becomes true after a user interaction on the client, so the
  // portal never renders during SSR — no mount-check needed.
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(
    null
  );

  // Derive display text from value
  const selectedLabel = options.find((o) => o.value === value)?.label || value;

  // Filter + rank options based on typed query — startsWith matches float to
  // the top of their group, ahead of mid-string contains matches, so typing
  // "bo" surfaces "Botox" before something like "Sculptra Body".
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Options arrive already sorted by count desc, so the idle list needs no
    // work — zero-count options are last by construction.
    if (!q) return options;
    return options
      .map((o, originalIdx) => {
        const label = o.label.toLowerCase();
        const matchIdx = label.indexOf(q);
        return { option: o, originalIdx, matchIdx };
      })
      .filter((entry) => entry.matchIdx !== -1)
      .sort((a, b) => {
        // Unavailable options stay below available ones even while typing —
        // otherwise a "0" result would jump above a real one on match position
        // and interleave with the divider below.
        const aEmpty = a.option.count === 0 ? 1 : 0;
        const bEmpty = b.option.count === 0 ? 1 : 0;
        if (aEmpty !== bEmpty) return aEmpty - bEmpty;
        if (a.matchIdx !== b.matchIdx) return a.matchIdx - b.matchIdx;
        return a.originalIdx - b.originalIdx;
      })
      .map((entry) => entry.option);
  }, [options, query]);

  const hasMultipleGroups = useMemo(
    () => new Set(options.map((o) => o.group).filter(Boolean)).size > 1,
    [options]
  );

  // Close on outside click — the list is portaled outside containerRef, so a
  // click inside it must also be treated as "inside".
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const inContainer = containerRef.current?.contains(target);
      const inList = listRef.current?.contains(target);
      if (!inContainer && !inList) {
        setOpen(false);
        // Reset query to selected label if we close without selecting
        if (!allowFreeText) setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [allowFreeText]);

  // Track the trigger's position while open so the portaled list can follow
  // it on scroll/resize.
  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setPosition({ top: rect.bottom + 8, left: rect.left, width: rect.width });
    };
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIdx >= 0 && listRef.current) {
      const item = listRef.current.querySelector(
        `[data-idx="${highlightedIdx}"]`
      ) as HTMLElement | null;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIdx]);

  const handleSelect = useCallback(
    (option: DropdownOption) => {
      onChange(option.value);
      onSelect?.(option);
      setQuery("");
      setOpen(false);
      setHighlightedIdx(-1);
    },
    [onChange, onSelect]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    // Reset scroll position and default the keyboard highlight to the top
    // match so Enter picks the best result without an extra ArrowDown.
    if (listRef.current) listRef.current.scrollTop = 0;
    const nextFiltered = val.trim()
      ? options.filter((o) => o.label.toLowerCase().includes(val.trim().toLowerCase()))
      : options;
    setHighlightedIdx(val.trim() && nextFiltered.length > 0 ? 0 : -1);
    if (!open) setOpen(true);
    if (allowFreeText) onChange(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setHighlightedIdx((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIdx >= 0 && filtered[highlightedIdx]) {
        handleSelect(filtered[highlightedIdx]);
      } else if (filtered.length === 1) {
        handleSelect(filtered[0]);
      } else if (open) {
        // Close and keep current query as value if freetext
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      setHighlightedIdx(-1);
    }
  };

  const handleFocus = () => {
    setOpen(true);
    // Clear the input to show all options when user clicks in
    setQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setQuery("");
    setHighlightedIdx(-1);
    inputRef.current?.focus();
  };

  const showClear = open ? query.length > 0 : selectedLabel.length > 0;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Label row */}
      {(icon || label) && (
        <div className="flex items-center gap-2 mb-1">
          {icon}
          {label && (
            <span className="text-sm font-semibold uppercase tracking-wide text-brand-muted">
              {label}
            </span>
          )}
        </div>
      )}

      {/* Input + chevron */}
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={open ? query : selectedLabel}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "w-full border-0 bg-transparent p-0 text-sm text-foreground placeholder:text-brand-placeholder focus:outline-none focus:ring-0 pr-5",
            showClear && "pr-10",
            inputClassName
          )}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-activedescendant={
            highlightedIdx >= 0 ? `${listboxId}-option-${highlightedIdx}` : undefined
          }
          autoComplete="off"
        />
        {showClear && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear"
            className="absolute right-4 flex size-4 items-center justify-center rounded-full text-brand-muted/60 hover:bg-black/5 hover:text-brand-muted"
          >
            <X className="size-3" />
          </button>
        )}
        <ChevronDown
          className={cn(
            "pointer-events-none absolute right-0 size-3.5 text-brand-muted/60 transition-transform duration-200",
            showClear && "opacity-0",
            open && "rotate-180"
          )}
        />
      </div>

      {/* Dropdown list — portaled to <body> so it can't be clipped by an
          ancestor's overflow-hidden (e.g. the hero section's background
          clipping), then pinned to the trigger via fixed coordinates. */}
      {open && position &&
        createPortal(
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-busy={loading || countsStale}
          className="fixed z-50 max-h-[288px] min-w-[220px] overflow-y-auto overscroll-contain rounded-xl border border-[#e8e0e8] bg-white py-1.5 shadow-[0_12px_40px_rgba(170,78,179,0.12)] backdrop-blur-sm"
          style={{
            scrollbarWidth: "thin",
            top: position.top,
            left: position.left,
            width: position.width,
          }}
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-center text-xs text-brand-muted/60">
              {/* An empty list while the options are still being fetched is not
                  "no results" — and with no query typed it used to read as
                  No results found for "". */}
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="size-3 animate-spin rounded-full border-2 border-brand-magenta/25 border-t-brand-magenta" />
                  Loading&hellip;
                </span>
              ) : query ? (
                <>No results found for &ldquo;{query}&rdquo;</>
              ) : (
                <>No options available</>
              )}
            </li>
          ) : (
            filtered.map((option, idx) => {
              const isSelected = option.value === value;
              const isHighlighted = idx === highlightedIdx;
              // Only worth a header when the list actually mixes groups —
              // callers that pre-filter to one group (e.g. the Treatment/
              // Condition toggle) don't need it repeated on every option.
              const showGroupHeader =
                hasMultipleGroups &&
                !!option.group &&
                option.group !== filtered[idx - 1]?.group;

              // First zero-count option, when something available came before
              // it — everything below this line has no clinics in the current
              // location scope.
              const showUnavailableDivider =
                option.count === 0 && (filtered[idx - 1]?.count ?? 0) > 0;

              const q = query.trim();
              const matchStart = q
                ? option.label.toLowerCase().indexOf(q.toLowerCase())
                : -1;

              return (
                <li key={`${option.group ?? ""}${option.value}`} role="presentation">
                  {showUnavailableDivider && (
                    <div
                      aria-hidden="true"
                      className="mt-1 border-t border-brand-muted/15 px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-brand-muted/50 select-none"
                    >
                      Not available near you
                    </div>
                  )}
                  {showGroupHeader && (
                    <div
                      aria-hidden="true"
                      className="sticky top-0 z-10 bg-white px-4 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-widest text-brand-muted/70 select-none"
                    >
                      {option.group}
                    </div>
                  )}
                  <div
                    id={`${listboxId}-option-${idx}`}
                    role="option"
                    aria-selected={isSelected}
                    data-idx={idx}
                    onClick={() => handleSelect(option)}
                    onMouseEnter={() => setHighlightedIdx(idx)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 px-4 py-2 text-sm transition-colors",
                      isHighlighted
                        ? "bg-brand-magenta/8 text-brand-magenta"
                        : isSelected
                          ? "bg-brand-magenta/5 text-[#1a1a1a] font-medium"
                          : "text-[#4a4a4a] hover:bg-[#faf7fa]"
                    )}
                  >
                    <span className="flex-1 truncate">
                      {matchStart === -1 ? (
                        option.label
                      ) : (
                        <>
                          {option.label.slice(0, matchStart)}
                          <span className="font-semibold">
                            {option.label.slice(matchStart, matchStart + q.length)}
                          </span>
                          {option.label.slice(matchStart + q.length)}
                        </>
                      )}
                    </span>
                    {typeof option.count === "number" && (
                      <span
                        className={cn(
                          "shrink-0 tabular-nums text-xs transition-opacity",
                          option.count === 0 ? "text-brand-muted/40" : "text-brand-muted/70",
                          countsStale && "opacity-40"
                        )}
                      >
                        {option.count.toLocaleString()}
                      </span>
                    )}
                    <span className="flex w-3.5 shrink-0 justify-end">
                      {isSelected && <Check className="size-3.5 text-brand-magenta" />}
                    </span>
                  </div>
                </li>
              );
            })
          )}
        </ul>,
        document.body
      )}
    </div>
  );
}
