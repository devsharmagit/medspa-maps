"use client";

/**
 * search-options.ts — shared options for the "Treatment or Condition" search
 * dropdown (hero bar, Find-the-Perfect-Clinic, /search filters).
 *
 * One grouped dropdown enforces the product rule that treatment+condition
 * combos are NOT supported: the single selected value is EITHER a treatment
 * (plain service slug / free text → `q`) OR a condition (concern slug encoded
 * as `c:<slug>` → `condition`), never both.
 *
 * Each option carries the number of clinics that match it in the caller's
 * current location, so a user can see there are 25 Botox practices near them
 * before committing to the search. Counts come from /api/search-options, which
 * scopes them exactly as the search engine would — see option-counts.ts.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { DropdownOption } from "@/components/ui/searchable-dropdown";

const CONDITION_PREFIX = "c:";

export function conditionValue(slug: string): string {
  return `${CONDITION_PREFIX}${slug}`;
}

/** Split a dropdown value into the search params it stands for. */
export function splitSearchSelection(value: string): { q: string; condition: string } {
  const v = value.trim();
  if (v.startsWith(CONDITION_PREFIX)) {
    return { q: "", condition: v.slice(CONDITION_PREFIX.length) };
  }
  return { q: v, condition: "" };
}

/** Where the user is searching — drives the counts, not the option set. */
export interface OptionScope {
  location?: string;
  lat?: number | null;
  lng?: number | null;
  radius?: string | null;
}

interface CountedOption {
  slug: string;
  name: string;
  count: number;
}

/** Debounce for scope changes — the location typeahead emits per keystroke. */
const SCOPE_DEBOUNCE_MS = 250;

function scopeParams(scope?: OptionScope): string {
  const p = new URLSearchParams();
  if (scope?.location) p.set("location", scope.location);
  if (scope?.lat != null && scope?.lng != null) {
    p.set("lat", String(scope.lat));
    p.set("lng", String(scope.lng));
  }
  if (scope?.radius) p.set("radius", scope.radius);
  return p.toString();
}

/**
 * Treatments + conditions as one grouped option list, with location-scoped
 * clinic counts. The option SET never changes with location — only the counts —
 * so a selection made before picking a location always stays resolvable.
 */
export function useTreatmentConditionOptions(scope?: OptionScope): {
  options: DropdownOption[];
  countsStale: boolean;
  /** No options yet — the first fetch is still in flight. */
  loading: boolean;
} {
  const [options, setOptions] = useState<DropdownOption[]>([]);
  const [countsStale, setCountsStale] = useState(false);
  // Flips once the FIRST request settles, success or failure — so a failed
  // fetch shows an empty list rather than spinning forever.
  const [settled, setSettled] = useState(false);
  const query = scopeParams(scope);
  // First load fires immediately; later scope changes are debounced.
  const loadedOnce = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    if (loadedOnce.current) setCountsStale(true);

    const run = async () => {
      try {
        const res = await fetch(`/api/search-options${query ? `?${query}` : ""}`, {
          signal: controller.signal,
        });
        const body = await res.json();
        const treatments = (body?.data?.treatments ?? []) as CountedOption[];
        const concerns = (body?.data?.concerns ?? []) as CountedOption[];
        if (cancelled || (!treatments.length && !concerns.length)) return;
        setOptions([
          ...treatments.map((t) => ({
            label: t.name,
            value: t.slug,
            group: "Treatments",
            count: t.count,
          })),
          ...concerns.map((c) => ({
            label: c.name,
            value: conditionValue(c.slug),
            group: "Conditions",
            count: c.count,
          })),
        ]);
        loadedOnce.current = true;
      } catch {
        // Aborted or failed — keep whatever list is already on screen rather
        // than blanking the dropdown mid-interaction.
      } finally {
        if (!cancelled) {
          setCountsStale(false);
          setSettled(true);
        }
      }
    };

    if (!loadedOnce.current) {
      void run();
      return () => {
        cancelled = true;
        controller.abort();
      };
    }
    const timer = setTimeout(run, SCOPE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return useMemo(
    () => ({ options, countsStale, loading: !settled && options.length === 0 }),
    [options, countsStale, settled]
  );
}
