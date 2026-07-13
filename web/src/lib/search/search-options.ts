"use client";

/**
 * search-options.ts — shared options for the "Treatment or Condition" search
 * dropdown (hero bar, Find-the-Perfect-Clinic, /search filters).
 *
 * One grouped dropdown enforces the product rule that treatment+condition
 * combos are NOT supported: the single selected value is EITHER a treatment
 * (plain service slug / free text → `q`) OR a condition (concern slug encoded
 * as `c:<slug>` → `condition`), never both.
 */

import { useEffect, useState } from "react";
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

/**
 * Fetch treatments (/api/services) + searchable conditions
 * (/api/concerns?scope=search) and return them as one grouped option list.
 */
export function useTreatmentConditionOptions(): DropdownOption[] {
  const [options, setOptions] = useState<DropdownOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/services")
        .then((r) => r.json())
        .then((d) => (d.services ?? []) as { name: string; slug: string }[])
        .catch(() => []),
      fetch("/api/concerns?scope=search")
        .then((r) => r.json())
        .then((d) => (d.data?.concerns ?? []) as { name: string; slug: string }[])
        .catch(() => []),
    ]).then(([services, concerns]) => {
      if (cancelled) return;
      setOptions([
        ...services.map((s) => ({ label: s.name, value: s.slug, group: "Treatments" })),
        ...concerns.map((c) => ({
          label: c.name,
          value: conditionValue(c.slug),
          group: "Conditions",
        })),
      ]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return options;
}
