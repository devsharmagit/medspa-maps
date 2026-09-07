"use client";

/**
 * search-options.ts — shared options for the "Treatment or Condition" search
 * dropdown (hero bar, Find-the-Perfect-Clinic, /search filters).
 *
 * One grouped dropdown enforces the product rule that treatment+condition
 * combos are NOT supported: the single selected value is EITHER a treatment
 * (plain service slug → `q`) OR a condition (concern slug encoded as
 * `c:<slug>` → `condition`), never both.
 *
 * A treatment/concern search is a CHOICE, not free text. Typing filters the
 * list; it cannot become a search term. Use `resolveSelection` below to turn a
 * dropdown value into params — it refuses anything that is not a real option,
 * which is what keeps a stale URL or a half-typed word out of the engine.
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

/**
 * Split a dropdown value into the search params it stands for.
 *
 * UNVALIDATED — it will happily return any string as `q`. Use it only where the
 * value is already known to be an option (e.g. inside the dropdown's own
 * `onSelect`). For anything driven by component state, use `resolveSelection`.
 */
export function splitSearchSelection(value: string): { q: string; condition: string } {
  const v = value.trim();
  if (v.startsWith(CONDITION_PREFIX)) {
    return { q: "", condition: v.slice(CONDITION_PREFIX.length) };
  }
  return { q: v, condition: "" };
}

/**
 * Shown when the box holds text that is not one of the options. Lives here
 * beside `resolveSelection` so the copy and the rule that triggers it cannot
 * drift apart across the three search forms.
 */
export const SELECTION_REQUIRED = "Please select a listed treatment or concern.";

/**
 * Validating form of `splitSearchSelection`: returns params only when `value`
 * is one of `options`, and `null` otherwise.
 *
 * Every search submit goes through this. The dropdown can no longer emit typed
 * text, but two other routes still can: the location field's Enter key submits
 * the surrounding form (it deliberately does not preventDefault), and /search
 * seeds this state from the URL — so `?q=morpheus8` would otherwise be handed
 * straight back to the engine on the next submit.
 */
export function resolveSelection(
  value: string,
  options: DropdownOption[],
): { q: string; condition: string } | null {
  const v = value.trim();
  if (!v) return null;
  if (!options.some((o) => o.value === v)) return null;
  return splitSearchSelection(v);
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
