"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DropdownOption {
  label: string;
  value: string;
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
  onSelect,
}: SearchableDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Derive display text from value
  const selectedLabel = options.find((o) => o.value === value)?.label || value;

  // Filter options based on typed query
  const filtered = query
    ? options.filter((o) =>
        o.label.toLowerCase().includes(query.toLowerCase())
      )
    : options;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        // Reset query to selected label if we close without selecting
        if (!allowFreeText) setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [allowFreeText]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIdx >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIdx] as HTMLElement;
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
    setHighlightedIdx(-1);
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
            inputClassName
          )}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          autoComplete="off"
        />
        <ChevronDown
          className={cn(
            "pointer-events-none absolute right-0 size-3.5 text-brand-muted/60 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </div>

      {/* Dropdown list */}
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute left-0 top-full z-50 mt-2 max-h-[240px] w-full min-w-[220px] overflow-y-auto rounded-xl border border-[#e8e0e8] bg-white py-1.5 shadow-[0_12px_40px_rgba(170,78,179,0.12)] backdrop-blur-sm"
          style={{ scrollbarWidth: "thin" }}
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-center text-xs text-brand-muted/60">
              No results found
            </li>
          ) : (
            filtered.map((option, idx) => {
              const isSelected = option.value === value;
              const isHighlighted = idx === highlightedIdx;

              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
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
                  <span className="flex-1 truncate">{option.label}</span>
                  {isSelected && (
                    <Check className="size-3.5 shrink-0 text-brand-magenta" />
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
